const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..", "..", "..");

const runtimeModulePath = path.join(root, "Архив", "Scripts", "modules", "schedule-runtime.js");
const desktopCalendarRuntimePath = path.join(root, "Архив", "Scripts", "modules", "desktop-calendar-runtime.js");
const patientWorkflowRuntimePath = path.join(root, "Архив", "Scripts", "modules", "patient-workflow-runtime.js");
const desktopRenderPath = path.join(root, "Архив", "Scripts", "src", "shared", "desktop-render.cjs");
const desktopViewPath = path.join(root, "Архив", "Scripts", "views", "desktop", "view.js");
const patientViewPath = path.join(root, "Архив", "Scripts", "views", "patient", "view.js");
const modulesRoot = path.join(root, "Архив", "Scripts", "modules");

const tests = [];
const test = (name, fn) => tests.push({ name, fn });
const readUtf8 = (filePath) => fs.readFileSync(filePath, "utf8");

test("shared runtime schedule module exists", () => {
  assert.equal(fs.existsSync(runtimeModulePath), true, "schedule-runtime.js does not exist");
  const source = readUtf8(runtimeModulePath);
  assert.match(source, /normalizeConn/u);
  assert.match(source, /buildSchedule/u);
});

test("desktop view loads the shared runtime schedule module", () => {
  const source = readUtf8(desktopViewPath);
  assert.match(source, /Архив\/Scripts\/modules\/schedule-runtime\.js/u);
});

test("desktop view keeps date navigation inline", () => {
  const source = readUtf8(desktopViewPath);
  assert.doesNotMatch(source, /Архив\/Scripts\/modules\/desktop-calendar-runtime\.js/u);
  assert.match(source, /const _navDate = async \(newOffset\) =>/u);
  assert.match(source, /const _renderCal = \(\) =>/u);
  assert.match(source, /leaf\.setViewState\(\{ type: 'empty' \}\)/u);
  assert.match(source, /await leaf\.openFile\(file, \{ active: true \}\)/u);
});

test("shared desktop calendar runtime wrapper loads the shared core module", () => {
  assert.equal(fs.existsSync(desktopCalendarRuntimePath), true, "desktop-calendar-runtime.js does not exist");
  const source = readUtf8(desktopCalendarRuntimePath);
  assert.match(source, /desktop-calendar-core\.cjs/u);
});

test("shared patient workflow runtime wrapper loads the shared core module", () => {
  assert.equal(fs.existsSync(patientWorkflowRuntimePath), true, "patient-workflow-runtime.js does not exist");
  const source = readUtf8(patientWorkflowRuntimePath);
  assert.match(source, /patient-workflow-core\.cjs/u);
});

test("desktop view passes active tab state into the shared desktop renderer", () => {
  const source = readUtf8(desktopViewPath);
  assert.match(source, /buildDesktopRender\(\{[\s\S]*activeTab,\s*applyCardFilter/u);
});

test("shared desktop renderer renders the active tab first and defers the rest", () => {
  assert.equal(fs.existsSync(desktopRenderPath), true, "desktop-render.cjs does not exist");
  const source = readUtf8(desktopRenderPath);
  assert.match(source, /const\s+_desktopImmediateTab\s*=\s*_desktopTabRenderers\.find\(item => item\.id === activeTab\)/u);
  assert.match(source, /const\s+_desktopDeferredTabs\s*=\s*_desktopImmediateTab\s*\?/u);
  assert.match(source, /const\s+_desktopSchedule\s*=\s*\(task\)\s*=>/u);
  assert.match(source, /_desktopSchedule\(\(\)\s*=>\s*\{\s*_desktopRenderTabs\(_desktopDeferredTabs\);/su);
  assert.match(source, /_desktopRunApplyCardFilter\(\);/u);
});

test("legacy patient view keeps schedule helpers inline", () => {
  const source = readUtf8(patientViewPath);
  assert.doesNotMatch(source, /Архив\/Scripts\/modules\/schedule-runtime\.js/u);
  assert.match(source, /const normalizeConn = \(raw\) =>/u);
  assert.match(source, /const buildSchedule = \(/u);
});

test("all runtime modules parse with the desktop runtime loader wrapper", () => {
  const AsyncFunction = Object.getPrototypeOf(async function () { }).constructor;
  const files = fs.readdirSync(modulesRoot).filter(name => name.endsWith(".js")).sort();
  assert.ok(files.length > 0, "runtime modules should exist");
  for (const name of files) {
    const source = readUtf8(path.join(modulesRoot, name));
    assert.doesNotThrow(
      () => new AsyncFunction(`"use strict"; return (${source});`),
      `${name} must parse when wrapped as return (${name} source)`
    );
  }
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

console.log(`OK ${passed} shared runtime integration checks passed`);
