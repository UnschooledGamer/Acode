import "./style.scss";
import alert from "dialogs/alert";
import prompt from "dialogs/prompt";
import select from "dialogs/select";
import Sidebar from "components/sidebar";
import gitService from "lib/git";
import { addedFolder } from "lib/openFolder";

let container = null;
let selectedRootUrl = "";
let unsubscribe = null;

const refs = {
repoSelect: null,
backend: null,
branch: null,
summary: null,
status: null,
history: null,
};

export default [
"source",
"git",
strings.git || "Git",
initApp,
false,
onSelected,
];

function onSelected() {
refresh().catch(showError);
}

function initApp(el) {
container = el;
container.classList.add("git-sidebar");
container.content = (
<div className="git-panel">
<div className="header">
<select onchange={onRepoChange} />
<button type="button" onclick={refresh} className="icon-button">
<span className="icon refresh" />
</button>
</div>
<div className="meta">
<div className="backend"></div>
<div className="branch"></div>
<div className="summary"></div>
</div>
<div className="actions">
<button onclick={stageAll}>Stage all</button>
<button onclick={commitChanges}>Commit</button>
<button onclick={switchBranch}>Switch</button>
<button onclick={runFetch}>Fetch</button>
<button onclick={runPull}>Pull</button>
<button onclick={runPush}>Push</button>
</div>
<div className="section-title">Status</div>
<ul className="status scroll" />
<div className="section-title">History</div>
<ul className="history scroll" />
</div>
);
refs.repoSelect = container.get(".header select");
refs.backend = container.get(".meta .backend");
refs.branch = container.get(".meta .branch");
refs.summary = container.get(".meta .summary");
refs.status = container.get(".status");
refs.history = container.get(".history");

if (unsubscribe) unsubscribe();
unsubscribe = gitService.subscribe(() => refresh());
Sidebar.on("show", onSelected);
refresh().catch(showError);
}

function getOpenFolders() {
return addedFolder.map((folder) => ({
url: folder.url,
name: folder.title,
}));
}

async function getGitFolders() {
const folders = getOpenFolders();
const results = await Promise.all(
folders.map(async (folder) => {
const repo = await gitService.getRepository(folder.url);
if (!repo) return null;
return {
...folder,
repo,
};
}),
);
return results.filter(Boolean);
}

async function refresh() {
if (!container) return;
const gitFolders = await getGitFolders();

if (!gitFolders.length) {
refs.repoSelect.content = <option>No repository folder open</option>;
refs.backend.textContent = "";
refs.branch.textContent = "";
refs.summary.textContent = "Open a repository folder to use Git.";
refs.status.content = "";
refs.history.content = "";
return;
}

if (!selectedRootUrl || !gitFolders.find((folder) => folder.url === selectedRootUrl)) {
selectedRootUrl = gitFolders[0].url;
}

refs.repoSelect.content = gitFolders.map((folder) => (
<option value={folder.url} selected={folder.url === selectedRootUrl}>
{folder.name}
</option>
));

const selected = gitFolders.find((folder) => folder.url === selectedRootUrl);
if (!selected) return;

const status = await gitService.status(selected.url, { force: true });
const log = await gitService.log(selected.url, 20);
refs.backend.textContent = `Backend: ${status.repo.backend.toUpperCase()}`;
refs.branch.textContent = status.branch?.replace(/^##\s*/, "") || "";
refs.summary.textContent = gitService.formatStatusSummary(status);

refs.status.content = status.entries.map((entry) => (
<li>
<span className="code">{entry.x}{entry.y}</span>
<span className="path">{entry.path}</span>
</li>
));

refs.history.content = log.entries.map((line) => <li>{line}</li>);
}

async function runAction(action) {
if (!selectedRootUrl) return;
try {
await action(selectedRootUrl);
await refresh();
} catch (error) {
showError(error);
}
}

async function stageAll() {
return runAction((url) => gitService.add(url));
}

async function commitChanges() {
const message = await prompt(strings.commit || "Commit", "", "text", {
required: true,
});
if (!message) return;
return runAction((url) => gitService.commit(url, message));
}

async function switchBranch() {
if (!selectedRootUrl) return;
try {
const branchResult = await gitService.branchList(selectedRootUrl);
const option = await select(
strings.branch || "Branch",
branchResult.branches.map((branch) => [branch, branch]),
);
if (!option) return;
await gitService.switchBranch(selectedRootUrl, option);
await refresh();
} catch (error) {
showError(error);
}
}

async function runFetch() {
return runAction((url) => gitService.fetch(url));
}

async function runPull() {
return runAction((url) => gitService.pull(url));
}

async function runPush() {
return runAction((url) => gitService.push(url));
}

function onRepoChange(event) {
selectedRootUrl = event.target.value;
refresh().catch(showError);
}

function showError(error) {
alert(strings.error || "Error", gitService.readableError(error));
}
