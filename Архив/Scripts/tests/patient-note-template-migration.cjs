const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..", "..", "..");

const archivedTemplatePath = path.join(root, "Архив", "Scripts", "templates", "patient-note.md");
const desktopViewPath = path.join(root, "Архив", "Scripts", "views", "desktop", "view.js");

const tests = [];
const test = (name, fn) => tests.push({ name, fn });
const readUtf8 = (filePath) => fs.readFileSync(filePath, "utf8");

test("patient note template is the active dv.view wrapper", () => {
  assert.equal(fs.existsSync(archivedTemplatePath), true, "Архив/Scripts/templates/patient-note.md does not exist");
  const source = readUtf8(archivedTemplatePath);
  assert.match(source, /schemaVersion:\s*1/u);
  assert.match(source, /tags:\s*\[\]/u);
  assert.match(source, /await dv\.view\("Архив\/Scripts\/views\/patient"/u);
  assert.match(source, /notePath:\s*dv\.current\(\)\?\.file\?\.path/u);
  assert.doesNotMatch(source, /Archived patient note template stub/u);
  assert.doesNotMatch(source, /Runtime removed/u);
});

test("desktop view loads the patient note runtime", () => {
  const source = readUtf8(desktopViewPath);
  assert.match(source, /DESKTOP_NEW_PATIENT_RUNTIME_PATH/u);
  assert.match(source, /Архив\/Scripts\/modules\/desktop-new-patient-runtime\.js/u);
  assert.match(source, /_pfDesktopNewPatient\.createPatientNote\(\)/u);
  assert.doesNotMatch(source, /Архив\/Scripts\/templates\/patient-note\.md/u);
});

let passed = 0;
for (const { name, fn } of tests) {
  try {
    fn();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    console.error(error.stack || error.message || String(error));
    process.exit(1);
  }
}

console.log(`OK ${passed} patient note template migration checks passed`);
