const assert = require("node:assert/strict");
const acorn = require("acorn");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..", "..", "..");
const desktopViewPath = path.join(root, "Архив", "Scripts", "views", "desktop", "view.js");
const desktopRenderPath = path.join(root, "Архив", "Scripts", "src", "shared", "desktop-render.cjs");
const desktopPlatformPath = path.join(root, "Архив", "Scripts", "modules", "desktop-platform-runtime.js");
const desktopDischargePath = path.join(root, "Архив", "Scripts", "modules", "desktop-discharge-runtime.js");
const desktopNewPatientRuntimePath = path.join(root, "Архив", "Scripts", "modules", "desktop-new-patient-runtime.js");

const readUtf8 = (filePath) => fs.readFileSync(filePath, "utf8");

(async () => {
  assert.equal(fs.existsSync(desktopViewPath), true, "desktop view does not exist");
  assert.equal(fs.existsSync(desktopRenderPath), true, "desktop render core does not exist");
  assert.equal(fs.existsSync(desktopPlatformPath), true, "desktop platform runtime does not exist");
  assert.equal(fs.existsSync(desktopDischargePath), true, "desktop discharge runtime does not exist");
  assert.equal(fs.existsSync(desktopNewPatientRuntimePath), true, "desktop new-patient runtime does not exist");

  const source = readUtf8(desktopViewPath);
  assert.match(source, /DESKTOP_NEW_PATIENT_RUNTIME_PATH/u);
  assert.match(source, /window\._pfDesktopNewPatient = _pfDesktopNewPatient;/u);
  assert.match(source, /DESKTOP_DISCHARGE_RUNTIME_PATH/u);
  assert.match(source, /renderDesktopDischargeTab/u);
  assert.match(source, /createPatientBtn\.onclick = \(\) => _pfDesktopNewPatient\.createPatientNote\(\)/u);
  assert.match(source, /const filterInput = controlsRow\.createEl\("input", \{ cls: "rdt-search-input" \}\)/u);
  assert.doesNotMatch(source, /const aiSearchBtn/u);
  assert.doesNotMatch(source, /rdt-ai-search-btn/u);
  assert.doesNotMatch(source, /rdt-search-wrap/u);
  assert.doesNotMatch(source, /rdt-search-clear/u);
  assert.match(source, /if \(_dateOffset === 0\)/u);
  assert.match(source, /activeTab = "operativka";/u);
  assert.match(source, /filterInput\.oninput = \(\) => \{ try \{ localStorage\.setItem\(FILTER_QUERY_KEY, filterInput\.value\); \} catch \(e\) \{ \} applyCardFilter\(\); \};/u);
  assert.match(source, /_pfDesktopPlatform/u);
  assert.doesNotMatch(source, /_openNewPatientEditorModal/u);
  assert.doesNotMatch(source, /const createPatientNote = async \(\) =>/u);

  const renderSource = readUtf8(desktopRenderPath);
  assert.match(renderSource, /rdt-ms-date-chip/u);
  assert.match(renderSource, /applyDateSelectionPatch/u);
  assert.match(renderSource, /const\s+_desktopImmediateTab\s*=\s*_desktopTabRenderers\.find\(item => item\.id === activeTab\)/u);
  assert.match(renderSource, /const\s+_desktopDeferredTabs\s*=\s*_desktopImmediateTab\s*\?/u);
  assert.match(renderSource, /_desktopSchedule\(\(\)\s*=>\s*\{\s*_desktopRenderTabs\(_desktopDeferredTabs\);/su);
  assert.match(renderSource, /_desktopRunApplyCardFilter\(\);/u);
  assert.match(renderSource, /const\s+renderDischargeCards\s*=\s*\(parent/u);
  assert.match(renderSource, /renderDischargeCards\(tab,\s*\{\s*includeHeader:\s*true\s*\}\)/u);
  assert.ok(
    renderSource.indexOf('// --- Выписка ---') > renderSource.indexOf('// --- Консультации ---'),
    "discharge block should render after consultations"
  );
  assert.ok(
    renderSource.indexOf('// --- Выписка ---') < renderSource.indexOf('// --- Госпитализация'),
    "discharge block should render before hospitalization"
  );
  assert.doesNotMatch(source, /completedVkElnItems/u);
  assert.doesNotMatch(renderSource, /completedVkElnItems/u);
  assert.doesNotMatch(renderSource, /вк продление элн выполнено/u);

  const renderAst = acorn.parse(renderSource, { ecmaVersion: "latest", sourceType: "script", locations: true });
  const buildDecl = renderAst.body.find(node =>
    node.type === "VariableDeclaration"
    && node.declarations[0]?.id?.name === "buildDesktopRender"
  );
  assert.ok(buildDecl, "buildDesktopRender declaration is missing");
  const buildBody = buildDecl.declarations[0].init.body.body;
  const buildLocalNames = new Set(buildBody
    .filter(node => node.type === "VariableDeclaration")
    .map(node => node.declarations[0]?.id?.name)
  );
  assert.equal(buildLocalNames.has("_renderTreatment"), true, "_renderTreatment must stay inside buildDesktopRender");
  assert.equal(buildLocalNames.has("_desktopTabRenderers"), true, "desktop tab startup must stay inside buildDesktopRender");

  console.log("OK desktop flow regression test passed");
})().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exit(1);
});
