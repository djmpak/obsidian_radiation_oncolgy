const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..", "..", "..");
const corePath = path.join(root, "Архив", "Scripts", "src", "shared", "patient-bottom-panels-core.cjs");
const runtimePath = path.join(root, "Архив", "Scripts", "modules", "patient-bottom-panels-runtime.js");
const patientViewPath = path.join(root, "Архив", "Scripts", "views", "patient", "view.js");

const tests = [];
const test = (name, fn) => tests.push({ name, fn });
const readUtf8 = (filePath) => fs.readFileSync(filePath, "utf8");

test("patient bottom panels core and runtime exist", () => {
  assert.equal(fs.existsSync(corePath), true, "patient-bottom-panels-core.cjs does not exist");
  assert.equal(fs.existsSync(runtimePath), true, "patient-bottom-panels-runtime.js does not exist");
  const runtimeSource = readUtf8(runtimePath);
  assert.match(runtimeSource, /src\/shared\/patient-bottom-panels-core\.cjs/u);
  assert.match(runtimeSource, /src\/shared\/patient-reminder-core\.cjs/u);
  assert.match(runtimeSource, /src\/shared\/schedule-core\.cjs/u);
  assert.match(runtimeSource, /src\/platform\/obsidian-adapter\.cjs/u);
  assert.match(runtimeSource, /mountPatientBottomPanels/u);
});

test("legacy patient view mounts the bottom panels inline", () => {
  const source = readUtf8(patientViewPath);
  assert.doesNotMatch(source, /Архив\/Scripts\/modules\/patient-bottom-panels-runtime\.js/u);
  assert.match(source, /const bottomBar = card\.createEl\("div"\);/u);
  assert.match(source, /const _calMonthSet = new Set\(\);/u);
  assert.match(source, /БЛОК 3: УМНЫЙ КАЛЕНДАРЬ/u);
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

console.log(`OK ${passed} patient bottom panels tests passed`);
