const assert = require("node:assert/strict");
const path = require("node:path");

const root = path.resolve(__dirname, "..", "..", "..");
const core = require(path.join(root, "Архив", "Scripts", "src", "shared", "desktop-editor-clinical-core.cjs"));

assert.equal(typeof core.mountNewPatientClinicalSection, "function");

assert.throws(() => core.mountNewPatientClinicalSection(), /wrap is required/);
assert.throws(
  () => core.mountNewPatientClinicalSection({
    wrap: {},
    modal: {},
    msc: "pf",
    MODAL_ID: "modal",
    getVal: () => null,
    field: () => {},
    saveNow: () => {},
    window: null,
    document: {},
    _pfDesktopCore: {},
    NEW_PATIENT_ANAM_FIELDS: [],
    SUGGEST: {},
    renderAC: () => {},
    positionAC: () => {}
  }),
  /window is required/
);

console.log("OK desktop editor clinical core export checks passed");
