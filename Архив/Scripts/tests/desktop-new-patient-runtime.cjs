const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..", "..", "..");
const corePath = path.join(root, "Архив", "Scripts", "src", "shared", "desktop-new-patient-core.cjs");
const runtimePath = path.join(root, "Архив", "Scripts", "modules", "desktop-new-patient-runtime.js");
const desktopViewPath = path.join(root, "Архив", "Scripts", "views", "desktop", "view.js");

const core = require(corePath);

assert.equal(typeof core.createDesktopNewPatientRuntime, "function");

const api = core.createDesktopNewPatientRuntime({
  dv: { date: () => ({ toFormat: () => "" }) },
  document: {},
  _pfDesktopCore: {},
  _pfDesktopPlatform: {},
  _pfDiagnosisCore: {},
  _pfDesktopParserUi: {},
  _pfDesktopClinicalSection: {},
  _pfDesktopHlt: {},
  _pfDesktopTreatmentVolumes: {},
  _pfPatientAcceleratorCore: {},
  _pfPatientNoteCore: {},
  _dbResolvePatientId: () => ({})
});

assert.equal(typeof api.openNewPatientEditorModal, "function");
assert.equal(typeof api.createPatientNote, "function");
assert.deepEqual(api.NEW_PATIENT_ECOG_KEY, "ECOG_статус");
assert.deepEqual(api.NEW_PATIENT_ECOG_OPTS, ["0", "1", "2", "3", "4"]);
assert.deepEqual(api.NEW_PATIENT_ANAM_FIELDS[0], ["Решение консилиума", "Решение_консилиума"]);

const coreSource = fs.readFileSync(corePath, "utf8");
const runtimeSource = fs.readFileSync(runtimePath, "utf8");
const desktopViewSource = fs.readFileSync(desktopViewPath, "utf8");
assert.match(runtimeSource, /desktop-new-patient-core\.cjs/u);
assert.match(runtimeSource, /desktop-parser-runtime\.js/u);
assert.match(runtimeSource, /desktop-editor-clinical-runtime\.js/u);
assert.match(runtimeSource, /desktop-hlt-runtime\.js/u);
assert.match(runtimeSource, /desktop-treatment-volumes-runtime\.js/u);
assert.match(runtimeSource, /patient-accelerator-runtime\.js/u);
assert.match(runtimeSource, /patient-note-runtime\.js/u);
assert.match(runtimeSource, /patient-transfer-runtime\.js/u);
assert.match(coreSource, /normalizeConn\s*=\s*\(raw\)\s*=>\s*String\(raw\s*\|\|\s*""\)/u);
assert.match(runtimeSource, /normalizeConn/u);
assert.match(desktopViewSource, /DESKTOP_NEW_PATIENT_RUNTIME_PATH,\s*\{[\s\S]*?_dbNormalizeDiagnosisText,\s*normalizeConn[\s\S]*?\}\)/u);
assert.match(coreSource, /Архив\/Врачи\.md/u);
assert.match(coreSource, /data-pf-transfer-doctor/u);
assert.match(coreSource, /data-pf-transfer-add-doctor/u);
assert.match(coreSource, /data-pf-inpatient-room/u);
assert.match(coreSource, /bKs\.onclick[\s\S]*?saveNow\(\{\s*"КС":\s*"КС"/u);
assert.match(coreSource, /bDs\.onclick[\s\S]*?saveNow\(\{\s*"КС":\s*"ДС",\s*"Палата":\s*null/u);
assert.match(coreSource, /getVal\("КС"\)\s*===\s*"КС"[\s\S]*?data-pf-inpatient-room/u);
assert.doesNotMatch(coreSource, /data-pf-inpatient-type/u);
assert.match(coreSource, /buildTransferredPatientPatch/u);
assert.match(coreSource, /createUniqueFile\(targetFolder/u);
assert.doesNotMatch(coreSource, /_buildPatientFileBaseName/u);
assert.doesNotMatch(coreSource, /_sanitizeFileName/u);
assert.match(coreSource, /_pfDesktopCore\.buildPatientFileBaseName/u);
assert.match(coreSource, /_pfDesktopCore\.sanitizeFileName/u);

console.log("OK desktop new-patient runtime checks passed");
