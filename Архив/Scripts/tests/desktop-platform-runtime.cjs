const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..", "..", "..");
const runtimePath = path.join(root, "Архив", "Scripts", "modules", "desktop-platform-runtime.js");
const adapterRuntimePath = "Архив/Scripts/modules/obsidian-adapter-runtime.js";

const readUtf8 = (filePath) => fs.readFileSync(filePath, "utf8");

async function loadRuntime() {
  const runtimeSource = readUtf8(runtimePath);
  const runtimeLoader = new Function(`return (${runtimeSource});`)();
  const runtimeCalls = [];
  const ensureFolders = [];
  const creates = [];
  const openedFiles = [];
  const adapter = {
    notice: (message, NoticeCtor) => {
      runtimeCalls.push({ type: "notice", message, NoticeCtor });
      return { message, NoticeCtor };
    },
    getFile: (requestedPath) => (requestedPath === "Folder/Case.md" || requestedPath === "active.md" ? { path: requestedPath } : null),
    ensureFolderPath: async (folderPath) => {
      ensureFolders.push(folderPath);
    },
    normalizeVaultPath: (value) => String(value || ""),
    getParentFolderPath: (value) => {
      const normalized = String(value || "");
      const slash = normalized.lastIndexOf("/");
      return slash >= 0 ? normalized.slice(0, slash) : "";
    },
    openFileByPath: async (requestedPath, leaf) => {
      runtimeCalls.push({ type: "openFileByPath", requestedPath, leaf });
      return { ok: true, requestedPath, leaf };
    }
  };
  const window = {
    _pfLoadRuntimeModule: async (requestedPath) => {
      assert.equal(requestedPath, adapterRuntimePath, "desktop platform runtime loaded the wrong module");
      return { adapter };
    }
  };
  const app = {
    vault: {
      create: async (requestedPath, content) => {
        creates.push({ requestedPath, content });
        return { path: requestedPath, content };
      }
    },
    workspace: {
      activeLeaf: {
        setViewState: async (state) => { runtimeCalls.push({ type: "setViewState", state }); },
        openFile: async (file, options) => { openedFiles.push({ file, options }); }
      },
      getLeaf: () => ({ id: "leaf" }),
      getActiveFile: () => ({ path: "active.md" }),
      trigger: (eventName) => runtimeCalls.push({ type: "trigger", eventName }),
      openLinkText: async (linkText, sourcePath, leaf) => {
        runtimeCalls.push({ type: "openLinkText", linkText, sourcePath, leaf });
        return { ok: true, linkText, sourcePath, leaf };
      }
    }
  };

  const exports = await runtimeLoader({ dv: {}, app, window, Notice: function TestNotice(message) { this.message = message; } });
  return { exports, runtimeSource, runtimeCalls, ensureFolders, creates, openedFiles };
}

(async () => {
  assert.equal(fs.existsSync(runtimePath), true, "desktop-platform-runtime.js does not exist");

  const { exports, runtimeSource, runtimeCalls, ensureFolders, creates, openedFiles } = await loadRuntime();
  assert.match(runtimeSource, /obsidian-adapter-runtime\.js/u);
  assert.equal(typeof exports.notice, "function");
  assert.equal(typeof exports.getFile, "function");
  assert.equal(typeof exports.ensureFolderPath, "function");
  assert.equal(typeof exports.createFile, "function");
  assert.equal(typeof exports.createUniqueFile, "function");
  assert.equal(typeof exports.openFileByPath, "function");
  assert.equal(typeof exports.openLinkText, "function");
  assert.equal(typeof exports.refreshCurrentFile, "function");
  assert.equal(typeof exports.reopenCurrentFile, "function");

  await exports.createFile("Folder/New.md", "alpha");
  assert.deepEqual(ensureFolders, ["Folder"]);
  assert.deepEqual(creates[0], { requestedPath: "Folder/New.md", content: "alpha" });

  const unique = await exports.createUniqueFile("Folder", "Case", "beta");
  assert.equal(unique.path, "Folder/Case (2).md");
  assert.deepEqual(creates[1], { requestedPath: "Folder/Case (2).md", content: "beta" });

  const linkResult = await exports.openLinkText("Пациенты/Иванов.md", "Рабочий стол.md");
  assert.equal(linkResult.ok, true);

  const reopened = await exports.reopenCurrentFile();
  assert.deepEqual(reopened, { path: "active.md" });
  assert.deepEqual(runtimeCalls.filter((call) => call.type === "setViewState"), [{ type: "setViewState", state: { type: "empty" } }]);
  assert.deepEqual(openedFiles, [{ file: { path: "active.md" }, options: { active: true } }]);

  assert.ok(runtimeCalls.some((call) => call.type === "openLinkText"));
  console.log("OK desktop platform runtime smoke test passed");
})().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exit(1);
});
