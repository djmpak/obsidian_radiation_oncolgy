const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..", "..", "..");
const corePath = path.join(root, "Архив", "Scripts", "src", "shared", "desktop-core.cjs");
const runtimeModulePath = path.join(root, "Архив", "Scripts", "modules", "desktop-runtime.js");
const desktopViewPath = path.join(root, "Архив", "Scripts", "views", "desktop", "view.js");

const tests = [];
const test = (name, fn) => tests.push({ name, fn });
const readUtf8 = (filePath) => fs.readFileSync(filePath, "utf8");

test("shared desktop core and runtime module exist", () => {
  assert.equal(fs.existsSync(corePath), true, "desktop-core.cjs does not exist");
  assert.equal(fs.existsSync(runtimeModulePath), true, "desktop-runtime.js does not exist");
  const runtimeSource = readUtf8(runtimeModulePath);
  assert.match(runtimeSource, /src\/shared\/desktop-core\.cjs/u);
  assert.match(runtimeSource, /module\.exports/u);
});

test("desktop view delegates current runtime and helper layers", () => {
  const source = readUtf8(desktopViewPath);
  assert.match(source, /Архив\/Scripts\/modules\/desktop-runtime\.js/u);
  assert.match(source, /Архив\/Scripts\/modules\/desktop-platform-runtime\.js/u);
  assert.match(source, /DESKTOP_DISCHARGE_RUNTIME_PATH/u);
  assert.doesNotMatch(source, /DESKTOP_CALENDAR_RUNTIME_PATH/u);
  assert.doesNotMatch(source, /desktop-calendar-runtime\.js/u);
  assert.doesNotMatch(source, /window\._pfDesktopCalendar/u);
  assert.match(source, /const _navDate = async \(newOffset\) =>/u);
  assert.match(source, /leaf\.setViewState\(\{ type: 'empty' \}\)/u);
  assert.match(source, /await leaf\.openFile\(file, \{ active: true \}\)/u);
  assert.match(source, /renderDesktopDischargeTab/u);
  assert.match(source, /DESKTOP_NEW_PATIENT_RUNTIME_PATH/u);
  assert.match(source, /createPatientBtn\.onclick = \(\) => _pfDesktopNewPatient\.createPatientNote\(\)/u);
  assert.match(source, /_pfDesktopPlatform\.notice/u);
  assert.match(source, /_pfDesktopModelCache/u);
  assert.match(source, /_pfPatientModelCacheKey/u);
  assert.match(source, /const calcPatient = \(p\) =>/u);
  assert.match(source, /_pfDesktopCore\.buildPatientModel\(p,/u);
  assert.match(source, /getPatientBadges\s*=\s*\(p\)\s*=>\s*_pfDesktopCore\.getPatientBadges\(p\)/u);
  assert.match(source, /getFundingType\s*=\s*\(p\)\s*=>\s*_pfDesktopCore\.getFundingType\(p\)/u);
  assert.match(source, /buildPrescText\s*=\s*\(p\)\s*=>\s*_pfDesktopCore\.buildPrescriptionText\(p/u);
  assert.match(source, /buildDesktopRender\(\{[\s\S]*activeTab,\s*applyCardFilter/u);
  assert.doesNotMatch(source, /const\s+calcDeliveredGy\s*=/u);
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

console.log(`OK ${passed} shared desktop runtime integration checks passed`);
