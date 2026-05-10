const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..", "..", "..");
const runtimePath = path.join(root, "Архив", "Scripts", "modules", "patient-save-runtime.js");
const corePath = "Архив/Scripts/src/shared/patient-save-actions.cjs";

const readUtf8 = (filePath) => fs.readFileSync(filePath, "utf8");

async function loadRuntime() {
  const runtimeSource = readUtf8(runtimePath);
  const runtimeLoader = new Function(`return (${runtimeSource});`)();
  const coreSource = readUtf8(path.join(root, corePath));
  const requestedPaths = [];
  const fm = {};
  const liveFm = {};
  const ls = {};
  let flashCount = 0;
  const markPhases = [];
  const patchCalls = [];
  const refreshCalls = [];

  const dv = {
    io: {
      load: async (requestedPath) => {
        requestedPaths.push(requestedPath);
        assert.equal(requestedPath, corePath, "patient-save runtime loaded the wrong shared core");
        return coreSource;
      }
    }
  };

  const exports = await runtimeLoader({
    dv,
    ls,
    patchCurrentFrontmatter: async (mutator, opts) => {
      patchCalls.push(opts);
      mutator(fm);
      return { ok: true };
    },
    mergeIntoStoredFrontmatter: (updates) => {
      Object.entries(updates || {}).forEach(([key, value]) => {
        if (value === undefined) delete liveFm[key];
        else liveFm[key] = value;
      });
    },
    refreshStoredFrontmatter: async () => {
      refreshCalls.push(true);
      return liveFm;
    },
    markPhase: (name) => {
      markPhases.push(name);
    },
    showSaveFlash: () => {
      flashCount += 1;
    }
  });

  return { exports, requestedPaths, fm, liveFm, ls, flashCountRef: () => flashCount, patchCalls, refreshCalls, markPhases, runtimeSource };
}

(async () => {
  assert.equal(fs.existsSync(runtimePath), true, "patient-save-runtime.js does not exist");

  const { exports, requestedPaths, fm, liveFm, ls, flashCountRef, patchCalls, refreshCalls, markPhases, runtimeSource } = await loadRuntime();
  assert.match(runtimeSource, /createPatientSaveActions/u);
  assert.equal(requestedPaths.length, 1);
  assert.equal(typeof exports.actions.clearAutoOpenEditorFlags, "function");
  assert.equal(typeof exports.actions.saveNow, "function");
  assert.equal(typeof exports.actions.saveLater, "function");

  await exports.actions.saveNow({ alpha: 1, beta: "x" });
  assert.deepEqual(ls, { alpha: 1, beta: "x" });
  assert.deepEqual(liveFm, { alpha: 1, beta: "x" });
  assert.deepEqual(fm, { alpha: 1, beta: "x" });
  assert.equal(markPhases[0], "write");
  assert.equal(flashCountRef(), 1);
  assert.equal(patchCalls[0].reread, false);
  assert.equal(typeof patchCalls[0].refresh, "function");
  assert.equal(refreshCalls.length, 0, "refresh callback should be passed through, not invoked by the mock");

  exports.actions.saveLater("gamma", 3);
  await new Promise(resolve => setTimeout(resolve, 450));
  assert.equal(ls.gamma, 3);
  assert.equal(liveFm.gamma, 3);
  assert.equal(fm.gamma, 3);
  assert.equal(flashCountRef(), 2);
  assert.equal(patchCalls.length >= 2, true);

  fm._Открыть_редактор_сразу = true;
  fm._auto_open_editor = true;
  await exports.actions.clearAutoOpenEditorFlags();
  assert.equal(Object.prototype.hasOwnProperty.call(fm, "_Открыть_редактор_сразу"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(fm, "_auto_open_editor"), false);

  console.log("OK patient save runtime smoke test passed");
})().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exit(1);
});
