const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..", "..", "..");

const desktopNotePath = path.join(root, "Рабочий стол.md");
const desktopViewPath = path.join(root, "Архив", "Scripts", "views", "desktop", "view.js");
const desktopCssPath = path.join(root, "Архив", "Scripts", "views", "desktop", "view.css");
const patientViewPath = path.join(root, "Архив", "Scripts", "views", "patient", "view.js");
const patientCssPath = path.join(root, "Архив", "Scripts", "views", "patient", "view.css");

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

const readUtf8 = (filePath) => fs.readFileSync(filePath, "utf8");

test("desktop view runtime extracted into Архив/Scripts/views/desktop/view.js", () => {
  assert.equal(fs.existsSync(desktopViewPath), true, "desktop view.js does not exist");
  const source = readUtf8(desktopViewPath);
  assert.match(source, /РАБОЧИЙ СТОЛ\s*—\s*ЕДИНЫЙ БЛОК/u);
});

test("patient view runtime extracted into Архив/Scripts/views/patient/view.js", () => {
  assert.equal(fs.existsSync(patientViewPath), true, "patient view.js does not exist");
  const source = readUtf8(patientViewPath);
  assert.match(source, /ЕДИНЫЙ БЛОК ПАЦИЕНТА/u);
});

test("desktop and patient view.css placeholders exist", () => {
  assert.equal(fs.existsSync(desktopCssPath), true, "desktop view.css does not exist");
  assert.equal(fs.existsSync(patientCssPath), true, "patient view.css does not exist");
});

test("Рабочий стол.md is a thin Dataview wrapper over Архив/Scripts/views/desktop", () => {
  const source = readUtf8(desktopNotePath);
  assert.match(source, /^```dataviewjs\s*/u);
  assert.match(source, /await\s+dv\.view\(\s*["']Архив\/Scripts\/views\/desktop["']/u);
  assert.doesNotMatch(source, /РАБОЧИЙ СТОЛ\s*—\s*ЕДИНЫЙ БЛОК/u);
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

console.log(`OK ${passed} phase 1 migration checks passed`);
