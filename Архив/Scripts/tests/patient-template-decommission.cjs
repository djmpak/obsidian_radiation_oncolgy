const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..", "..", "..");

const desktopViewPath = path.join(root, "Архив", "Scripts", "views", "desktop", "view.js");
const templateNotePath = path.join(root, "Шаблон пациента.md");

const tests = [];
const test = (name, fn) => tests.push({ name, fn });
const readUtf8 = (filePath) => fs.readFileSync(filePath, "utf8");

test("desktop runtime no longer references root patient template", () => {
  const source = readUtf8(desktopViewPath);
  assert.doesNotMatch(source, /PATIENT_TEMPLATE_MAIN_PATH/u);
  assert.doesNotMatch(source, /_findPatientTemplateFile/u);
  assert.doesNotMatch(source, /Шаблон пациента\.md/u);
});

test("Шаблон пациента.md is an archived stub, not a Dataview runtime entrypoint", () => {
  const source = readUtf8(templateNotePath);
  assert.match(source, /выведен из эксплуатации|архив/i);
  assert.doesNotMatch(source, /^```dataviewjs/mu);
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

console.log(`OK ${passed} patient template decommission checks passed`);
