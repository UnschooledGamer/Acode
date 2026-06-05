import Path from "utils/Path";
import Uri from "utils/Uri";

export const isTermuxSafUri = (value = "") =>
value.startsWith("content://com.termux.documents/tree/");

export const isAcodeTerminalPublicSafUri = (value = "") =>
value.startsWith("content://com.foxdebug.acode.documents/tree/");

export const isTerminalSafUri = (value = "") =>
isTermuxSafUri(value) || isAcodeTerminalPublicSafUri(value);

export const getTerminalPaths = () => {
const packageName = window.BuildInfo?.packageName || "com.foxdebug.acode";
const dataDir = `/data/user/0/${packageName}`;
const alpineRoot = `${dataDir}/files/alpine`;
const publicDir = `${dataDir}/files/public`;
return { alpineRoot, publicDir, dataDir };
};

export const isTerminalAccessiblePath = (url = "") => {
if (isAcodeTerminalPublicSafUri(url)) return true;
const { alpineRoot, publicDir } = getTerminalPaths();
const cleanUrl = url.replace(/^file:\/\//, "");
return cleanUrl.startsWith(alpineRoot) || cleanUrl.startsWith(publicDir);
};

export const convertToProotPath = (url = "") => {
const { alpineRoot, publicDir } = getTerminalPaths();
if (isAcodeTerminalPublicSafUri(url)) {
try {
const { docId } = Uri.parse(url);
const cleanDocId = /::/.test(url)
? decodeURIComponent(docId || "")
: docId || "";
if (!cleanDocId) return "/public";
if (cleanDocId.startsWith(publicDir)) {
return cleanDocId.replace(publicDir, "/public") || "/public";
}
if (cleanDocId.startsWith("/public")) {
return cleanDocId;
}
if (cleanDocId.startsWith("public:")) {
const relativePath = cleanDocId.slice("public:".length);
return relativePath ? Path.join("/public", relativePath) : "/public";
}
const relativePath = cleanDocId
.replace(/^\/+/, "")
.replace(/^public\//, "");
return relativePath ? Path.join("/public", relativePath) : "/public";
} catch (error) {
console.warn(
`Failed to parse public SAF URI for terminal conversion: ${url}`,
);
return "/public";
}
}
const cleanUrl = url.replace(/^file:\/\//, "");
if (cleanUrl.startsWith(publicDir)) {
return cleanUrl.replace(publicDir, "/public");
}
if (cleanUrl.startsWith(alpineRoot)) {
return cleanUrl.replace(alpineRoot, "") || "/";
}
if (
cleanUrl.startsWith("/sdcard") ||
cleanUrl.startsWith("/storage") ||
cleanUrl.startsWith("/data")
) {
return cleanUrl;
}
console.warn(`Unrecognized path for terminal conversion: ${url}`);
return cleanUrl;
};

export const toLocalFilePath = (url = "") => {
if (typeof url !== "string") return "";
if (url.startsWith("file://")) return url.slice("file://".length);
if (url.startsWith("/")) return url;
return "";
};
