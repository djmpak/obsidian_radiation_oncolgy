const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..", "..", "..");

const runtimeModulePath = path.join(root, "Архив", "Scripts", "modules", "diagnosis-runtime.js");
const desktopNewPatientCorePath = path.join(root, "Архив", "Scripts", "src", "shared", "desktop-new-patient-core.cjs");
const desktopViewPath = path.join(root, "Архив", "Scripts", "views", "desktop", "view.js");
const patientViewPath = path.join(root, "Архив", "Scripts", "views", "patient", "view.js");

const tests = [];
const test = (name, fn) => tests.push({ name, fn });
const readUtf8 = (filePath) => fs.readFileSync(filePath, "utf8");

test("shared runtime diagnosis module exists and loads diagnosis-core source", () => {
  assert.equal(fs.existsSync(runtimeModulePath), true, "diagnosis-runtime.js does not exist");
  const source = readUtf8(runtimeModulePath);
  assert.match(source, /src\/shared\/diagnosis-core\.cjs/u);
  assert.match(source, /module\.exports/u);
});

test("desktop view loads the shared runtime diagnosis module", () => {
  const source = readUtf8(desktopViewPath);
  const newPatientCore = readUtf8(desktopNewPatientCorePath);
  assert.match(source, /Архив\/Scripts\/modules\/diagnosis-runtime\.js/u);
  assert.match(source, /_dbNormalizeDiagnosisText\s*=\s*\(value\)\s*=>\s*_pfDiagnosisCore\.normalizeDiagnosisText/u);
  assert.match(newPatientCore, /_npNormalizeEcog\s*=\s*\(raw\)\s*=>\s*_pfDiagnosisCore\.normalizeEcog/u);
});

test("legacy patient view keeps diagnosis helpers inline", () => {
  const source = readUtf8(patientViewPath);
  assert.doesNotMatch(source, /Архив\/Scripts\/modules\/diagnosis-runtime\.js/u);
  assert.match(source, /const normalizeDiagnosisText = \(value\) =>/u);
  assert.match(source, /const normalizeEcog = \(raw\) =>/u);
  assert.match(source, /const matchEcogInText = \(text\) =>/u);
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

console.log(`OK ${passed} shared diagnosis runtime integration checks passed`);
