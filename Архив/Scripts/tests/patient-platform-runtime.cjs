const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..", "..", "..");
const runtimePath = path.join(root, "Архив", "Scripts", "modules", "patient-platform-runtime.js");

const readUtf8 = (filePath) => fs.readFileSync(filePath, "utf8");

async function loadRuntime() {
  const runtimeSource = readUtf8(runtimePath);
  const runtimeLoader = new Function(`return (${runtimeSource});`)();
  const notices = [];
  const openedLinks = [];
  const platformCalls = [];
  const platform = {
    openFileByPath: async (requestedPath) => {
      platformCalls.push({ type: "openFileByPath", requestedPath });
      return { ok: false, requestedPath };
    },
    getFile: (requestedPath) => {
      platformCalls.push({ type: "getFile", requestedPath });
      return requestedPath === "existing.md" ? { path: requestedPath } : null;
    }
  };
  const app = {
    workspace: {
      activeLeaf: {
        setViewState: async () => {},
        openFile: async () => {}
      },
      openLinkText: async (linkText, sourcePath) => {
        openedLinks.push({ linkText, sourcePath });
        return { ok: true, linkText, sourcePath };
      }
    }
  };

  const exports = await runtimeLoader({
    platform,
    app,
    Notice: function TestNotice(message) {
      notices.push(message);
      this.message = message;
    }
  });
  return { exports, runtimeSource, notices, openedLinks, platformCalls };
}

(async () => {
  assert.equal(fs.existsSync(runtimePath), true, "patient-platform-runtime.js does not exist");

  const { exports, runtimeSource, notices, openedLinks, platformCalls } = await loadRuntime();
  assert.match(runtimeSource, /openLinkText/u);
  assert.equal(typeof exports.ui.notice, "function");
  assert.equal(typeof exports.ui.openFileByPath, "function");
  assert.equal(typeof exports.ui.getFile, "function");
  assert.equal(typeof exports.ui.openLinkText, "function");

  const openResult = await exports.ui.openFileByPath("missing.md", "Файл не найден");
  assert.equal(openResult.ok, false);
  assert.deepEqual(notices, ["Файл не найден"]);

  assert.deepEqual(exports.ui.getFile("existing.md"), { path: "existing.md" });
  const linkResult = await exports.ui.openLinkText("Пациенты/Смирнов.md", "Рабочий стол.md");
  assert.equal(linkResult.ok, true);
  assert.deepEqual(openedLinks, [{ linkText: "Пациенты/Смирнов.md", sourcePath: "Рабочий стол.md" }]);
  assert.ok(platformCalls.some((call) => call.type === "openFileByPath"));
  console.log("OK patient platform runtime smoke test passed");
})().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exit(1);
});
