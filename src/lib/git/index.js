import helpers from "utils/helpers";
import Url from "utils/Url";
import {
convertToProotPath,
isTerminalSafUri,
toLocalFilePath,
} from "lib/terminalPathUtils";

const AXIS_REFRESH_DEBOUNCE_MS = 200;
const REPO_CACHE_MS = 2000;

function shellEscape(value) {
return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function normalizeExecResult(output) {
return String(output || "").replace(/\r/g, "").trim();
}

function isSafeRelativePath(path) {
if (!path || typeof path !== "string") return false;
if (path.startsWith("/") || path.startsWith("\\")) return false;
const segments = path.split(/[\\/]+/);
return segments.every((segment) => segment && segment !== "." && segment !== "..");
}

function pathRelativeToRoot(rootPath, targetPath) {
if (!rootPath || !targetPath) return null;
if (targetPath === rootPath) return ".";
const rootPrefix = rootPath.endsWith("/") ? rootPath : `${rootPath}/`;
if (!targetPath.startsWith(rootPrefix)) return null;
const relativePath = targetPath.slice(rootPrefix.length);
return isSafeRelativePath(relativePath) ? relativePath : null;
}

class GitRunner {
constructor(alpine) {
this.alpine = alpine;
}

async execute(cwd, args) {
if (!Array.isArray(args) || !args.length) {
throw new Error("Git command is required");
}

const command = `cd ${shellEscape(cwd)} && git ${args.map(shellEscape).join(" ")}`;
if (!window.Executor?.execute) {
	throw new Error("Terminal executor is unavailable");
}
const output = await Executor.execute(command, this.alpine);
return normalizeExecResult(output);
}
}

class GitService {
#repoCache = new Map();
#subscribers = new Set();
#refreshTimers = new Map();
#axsRunner = new GitRunner(true);
#directRunner = new GitRunner(false);

async ensureAxsReady() {
if (!window.Terminal) {
throw new Error("Terminal backend is unavailable");
}
if (!(await Terminal.isInstalled())) {
throw new Error("AXS terminal is not installed");
}
if (await Terminal.isAxsRunning()) return;
await Terminal.startAxs(false, () => {}, console.error);
for (let retry = 0; retry < 10; retry++) {
await new Promise((resolve) => setTimeout(resolve, 500));
if (await Terminal.isAxsRunning()) return;
}
throw new Error("Failed to start AXS terminal backend");
}

async hasFullStorageAccess() {
if (!window.system?.hasGrantedStorageManager) return false;
try {
const granted = await new Promise((resolve) => {
window.system.hasGrantedStorageManager(
(value) => resolve(value === true || value === "true"),
() => resolve(false),
);
});
return granted === true;
} catch {
return false;
}
}

resolvePath(url) {
const parsedUrl = Url.parse(url || "").url || url || "";
if (!parsedUrl) throw new Error("Path is required");

if (parsedUrl.startsWith("content://")) {
if (isTerminalSafUri(parsedUrl)) {
return {
axsPath: convertToProotPath(parsedUrl),
directPath: "",
canAxs: true,
canDirect: false,
};
}
throw new Error(
"This SAF location is not directly git-compatible. Open the folder via terminal mapping first.",
);
}

const localPath = toLocalFilePath(parsedUrl);
if (!localPath) {
throw new Error("Unsupported repository path");
}

const directPath = localPath;
const canDirect =
directPath.startsWith("/sdcard") ||
directPath.startsWith("/storage") ||
directPath.startsWith("/data");

return {
axsPath: convertToProotPath(parsedUrl),
directPath,
canAxs: true,
canDirect,
};
}

async resolveBackend(url) {
const resolved = this.resolvePath(url);
const fullStorageGranted = await this.hasFullStorageAccess();

if (resolved.canDirect && fullStorageGranted) {
return {
runner: this.#directRunner,
path: resolved.directPath,
backend: "direct",
};
}

if (!resolved.canAxs) {
throw new Error("No supported git backend for this path");
}

await this.ensureAxsReady();
return {
runner: this.#axsRunner,
path: resolved.axsPath,
backend: "axs",
};
}

async discoverRepository(url, opts = {}) {
const cacheKey = String(url || "");
const cached = this.#repoCache.get(cacheKey);
if (!opts.force && cached && Date.now() - cached.timestamp < REPO_CACHE_MS) {
return cached.value;
}

let repo = null;
try {
const backend = await this.resolveBackend(url);
const rootPath = await backend.runner.execute(backend.path, [
"rev-parse",
"--show-toplevel",
]);
if (!rootPath) return null;
repo = {
rootPath,
requestedPath: backend.path,
backend: backend.backend,
runner: backend.runner,
};
} catch {
repo = null;
}

this.#repoCache.set(cacheKey, {
timestamp: Date.now(),
value: repo,
});
return repo;
}

async requireRepository(url, opts = {}) {
const repo = await this.discoverRepository(url, opts);
if (!repo) throw new Error("No git repository found for this path");
return repo;
}

queueRefresh(repoRoot) {
if (!repoRoot) return;
clearTimeout(this.#refreshTimers.get(repoRoot));
const timer = setTimeout(() => {
this.#refreshTimers.delete(repoRoot);
for (const listener of this.#subscribers) {
try {
listener(repoRoot);
} catch (error) {
console.error("Git refresh listener error", error);
}
}
}, AXIS_REFRESH_DEBOUNCE_MS);
this.#refreshTimers.set(repoRoot, timer);
}

subscribe(listener) {
if (typeof listener !== "function") return () => {};
this.#subscribers.add(listener);
return () => this.#subscribers.delete(listener);
}

async status(url, opts = {}) {
const repo = await this.requireRepository(url, opts);
const output = await repo.runner.execute(repo.rootPath, [
"status",
"--porcelain=v1",
"--branch",
]);
const lines = output ? output.split("\n") : [];
const branch = lines.find((line) => line.startsWith("##")) || "";
const entries = lines
.filter((line) => line && !line.startsWith("##"))
.map((line) => ({
x: line.slice(0, 1),
y: line.slice(1, 2),
path: line.slice(3).trim(),
raw: line,
}));
return { repo, branch, entries };
}

async branchList(url) {
const repo = await this.requireRepository(url);
const output = await repo.runner.execute(repo.rootPath, [
"branch",
"--all",
"--format=%(refname:short)",
]);
return {
repo,
branches: output ? output.split("\n").filter(Boolean) : [],
};
}

async log(url, limit = 20) {
const repo = await this.requireRepository(url);
const boundedLimit = Math.max(1, Math.min(100, Number(limit) || 20));
const output = await repo.runner.execute(repo.rootPath, [
"log",
`-n${boundedLimit}`,
"--oneline",
"--decorate",
]);
return {
repo,
entries: output ? output.split("\n").filter(Boolean) : [],
};
}

async diff(url, path = "") {
const repo = await this.requireRepository(url);
const args = ["diff"];
if (path) {
if (!isSafeRelativePath(path)) {
throw new Error("Unsafe diff path");
}
args.push("--", path);
}
const output = await repo.runner.execute(repo.rootPath, args);
return { repo, output };
}

async add(url, paths = []) {
const repo = await this.requireRepository(url, { force: true });
const normalizedPaths = [];
for (const path of paths) {
if (!isSafeRelativePath(path)) throw new Error("Unsafe path for add");
normalizedPaths.push(path);
}
const args = ["add"];
if (normalizedPaths.length) {
args.push("--", ...normalizedPaths);
} else {
args.push("--all");
}
await repo.runner.execute(repo.rootPath, args);
this.queueRefresh(repo.rootPath);
return { repo };
}

async addFromUrl(url, targetUrl) {
const repo = await this.requireRepository(url, { force: true });
const backend = await this.resolveBackend(targetUrl || url);
const relativePath = pathRelativeToRoot(repo.rootPath, backend.path);
if (!relativePath || relativePath === ".") {
throw new Error("Selected item is outside repository root");
}
return this.add(url, [relativePath]);
}

async commit(url, message) {
const repo = await this.requireRepository(url, { force: true });
const cleanMessage = String(message || "").trim();
if (!cleanMessage) throw new Error("Commit message is required");
await repo.runner.execute(repo.rootPath, ["commit", "-m", cleanMessage]);
this.queueRefresh(repo.rootPath);
return { repo };
}

async switchBranch(url, branchName) {
const repo = await this.requireRepository(url, { force: true });
const name = String(branchName || "").trim();
if (!name) throw new Error("Branch name is required");
await repo.runner.execute(repo.rootPath, ["switch", name]);
this.queueRefresh(repo.rootPath);
return { repo };
}

async checkout(url, branchName) {
return this.switchBranch(url, branchName);
}

async fetch(url) {
const repo = await this.requireRepository(url, { force: true });
await repo.runner.execute(repo.rootPath, ["fetch"]);
this.queueRefresh(repo.rootPath);
return { repo };
}

async pull(url) {
const repo = await this.requireRepository(url, { force: true });
await repo.runner.execute(repo.rootPath, ["pull"]);
this.queueRefresh(repo.rootPath);
return { repo };
}

async push(url) {
const repo = await this.requireRepository(url, { force: true });
await repo.runner.execute(repo.rootPath, ["push"]);
this.queueRefresh(repo.rootPath);
return { repo };
}

invalidate(url) {
if (!url) return;
this.#repoCache.delete(String(url));
}

async getRepository(url, opts = {}) {
return this.discoverRepository(url, opts);
}

formatStatusSummary(status) {
if (!status?.entries?.length) return "Working tree clean";
return `${status.entries.length} changed file${
status.entries.length === 1 ? "" : "s"
}`;
}

readableError(error) {
if (!error) return "Unknown git error";
if (typeof error === "string") return error;
return error.message || helpers.parseJSON(error)?.message || String(error);
}
}

const gitService = new GitService();

export function toRepoRelativePath(repoRoot, absolutePath) {
return pathRelativeToRoot(repoRoot, absolutePath);
}

export default gitService;
