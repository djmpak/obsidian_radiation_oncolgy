const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..", "..", "..");
const runtimePath = path.join(root, "Архив", "Scripts", "modules", "patient-db-actions-runtime.js");
const corePath = "Архив/Scripts/src/shared/patient-db-actions.cjs";

const readUtf8 = (filePath) => fs.readFileSync(filePath, "utf8");

async function loadRuntime() {
  const runtimeSource = readUtf8(runtimePath);
  const runtimeLoader = new Function(`return (${runtimeSource});`)();
  const coreSource = readUtf8(path.join(root, corePath));
  const requestedPaths = [];
  const existingIds = new Set(["123-456"]);
  let currentPath = "Пациенты/Иванов.md";
  const dv = {
    io: {
      load: async (requestedPath) => {
        requestedPaths.push(requestedPath);
        assert.equal(requestedPath, corePath, "patient-db runtime loaded the wrong shared core");
        return coreSource;
      }
    }
  };

  const saveCalls = [];
  const upsertCalls = [];
  const removeCalls = [];
  const verifyCalls = [];
  const exportCalls = [];
  const moveCalls = [];

  const exports = await runtimeLoader({
    dv,
    saveNow: async (updates) => saveCalls.push(updates),
    resolveCurrentPatientId: () => ({ id: "123-456", source: "existing" }),
    buildDatabaseRowFromCurrent: () => ({ row: true }),
    upsertDatabaseRowFile: async (...args) => {
      upsertCalls.push(args);
      existingIds.add(args[1]);
    },
    removeDatabaseRowFile: async (...args) => {
      removeCalls.push(args);
      existingIds.delete(args[0]);
    },
    waitForPatientInDatabase: async (...args) => {
      verifyCalls.push(args);
      return existingIds.has(args[0]);
    },
    markDatabaseExportForCurrent: async (...args) => {
      exportCalls.push({ type: "mark", args });
      return { ok: true };
    },
    clearDatabaseExportMarkForCurrent: async (...args) => {
      exportCalls.push({ type: "clear", args });
      return { ok: true };
    },
    moveCurrentFileToFolder: async (...args) => {
      moveCalls.push(args);
      currentPath = `Выписаны/${String(currentPath || "").split("/").pop()}`;
    },
    isDischargedFilePath: (pathValue) => String(pathValue || "").includes("Выписаны"),
    getCurrentFilePath: () => currentPath,
    getCurrentFileName: () => "Иванов.md",
    dischargeFolder: "Выписаны",
    notify: () => {}
  });

  return { exports, requestedPaths, saveCalls, upsertCalls, removeCalls, verifyCalls, exportCalls, moveCalls, runtimeSource };
}

(async () => {
  assert.equal(fs.existsSync(runtimePath), true, "patient-db-actions-runtime.js does not exist");

  const { exports, requestedPaths, saveCalls, upsertCalls, removeCalls, verifyCalls, exportCalls, moveCalls, runtimeSource } = await loadRuntime();
  assert.match(runtimeSource, /createPatientDatabaseActions/u);
  assert.equal(requestedPaths.length, 1);
  assert.equal(typeof exports.actions.savePatientIdentity, "function");
  assert.equal(typeof exports.actions.ensureCurrentPatientId, "function");
  assert.equal(typeof exports.actions.syncPatientToDatabase, "function");
  assert.equal(typeof exports.actions.removePatientFromDatabase, "function");
  assert.equal(typeof exports.actions.dischargeCurrentPatient, "function");

  const saved = await exports.actions.savePatientIdentity({ patientId: " 987-654 " });
  assert.deepEqual(saved, { ok: true, id: "987-654", source: "template" });
  assert.deepEqual(saveCalls, [{ ID_пациента: "987-654" }]);

  const synced = await exports.actions.syncPatientToDatabase({ markExport: true, source: "patient-db-runtime" });
  assert.equal(synced.ok, true);
  assert.deepEqual(upsertCalls[0][0], { row: true });
  assert.equal(upsertCalls[0][1], "123-456");
  assert.equal(verifyCalls.length >= 1, true);
  assert.equal(exportCalls.some((call) => call.type === "mark"), true);

  const removed = await exports.actions.removePatientFromDatabase({ clearExportMark: true });
  assert.equal(removed.ok, true);
  assert.equal(removeCalls.length, 1);
  assert.equal(exportCalls.some((call) => call.type === "clear"), true);

  const discharged = await exports.actions.dischargeCurrentPatient({ source: "patient-db-runtime", targetFolder: "Выписаны" });
  assert.equal(discharged.ok, true);
  assert.equal(moveCalls.length >= 1, true);
  assert.equal(exportCalls.filter((call) => call.type === "mark").length >= 2, true);

  console.log("OK patient db actions runtime smoke test passed");
})().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exit(1);
});
