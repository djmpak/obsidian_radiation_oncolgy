const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..", "..", "..");
const viewPath = path.join(root, "Архив", "Scripts", "views", "patient", "view.js");
const templatePath = path.join(root, "Архив", "Scripts", "templates", "patient-note.md");
const rootTemplatePath = path.join(root, "Шаблон пациента.md");
const removedLegacyPath = path.join(root, "Шаблон пациента legacy.md");

const readUtf8 = (filePath) => fs.readFileSync(filePath, "utf8");

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

test("legacy patient template file is removed", () => {
  assert.equal(fs.existsSync(removedLegacyPath), false);
});

test("current patient note template is an active dv.view wrapper", () => {
  const source = readUtf8(templatePath);
  assert.match(source, /schemaVersion:\s*1/u);
  assert.match(source, /tags:\s*\[\]/u);
  assert.match(source, /await dv\.view\("Архив\/Scripts\/views\/patient"/u);
  assert.match(source, /notePath:\s*dv\.current\(\)\?\.file\?\.path/u);
  assert.doesNotMatch(source, /Archived patient note template stub/u);
  assert.doesNotMatch(source, /Runtime removed/u);
});

test("patient view remains parseable as DataviewJS", () => {
  const AsyncFunction = Object.getPrototypeOf(async function() {}).constructor;
  assert.doesNotThrow(() => new AsyncFunction(readUtf8(viewPath)));
});

test("root patient template remains an archived stub", () => {
  const source = readUtf8(rootTemplatePath);
  assert.match(source, /status:\s*archived/u);
  assert.match(source, /архивный stub/u);
  assert.doesNotMatch(source, /```dataviewjs/u);
});

test("patient main info renders transfer and inpatient room fields", () => {
  const source = readUtf8(viewPath);
  assert.match(source, /Финансирование:/u);
  assert.match(source, /const patientCardFundingLabel\s*=\s*\(fundRaw\)\s*=>/u);
  assert.match(source, /patientCardFundingLabel\(cur\["Группа ВМП"\]\)/u);
  assert.match(source, /Передан:/u);
  assert.match(source, /Стационар:/u);
  assert.match(source, /stationFromTags/u);
  assert.match(source, /stationLabel\s*\|\|\s*["']КС["']/u);
  assert.match(source, /палата/u);
  assert.match(source, /Ускоритель:/u);
  assert.match(source, /acceleratorLabel/u);
  assert.match(source, /extraVolumes\.map\(vol => vol\?\.Ускоритель\)/u);
});

test("patient form derives inpatient frontmatter from the station type switcher", () => {
  const source = readUtf8(viewPath);
  assert.match(source, /setPending\("КС",\s*statState!==['"]ДС['"]\s*\?\s*['"]ДС['"]\s*:\s*null\)/u);
  assert.match(source, /setPending\("КС",\s*statState!==['"]КС['"]\s*\?\s*['"]КС['"]\s*:\s*null\)/u);
  assert.match(source, /if\s*\(\s*statState\s*===\s*['"]КС['"]\s*\)\s*\{[\s\S]*?field\([^)]*['"]Палата['"][^)]*\)/u);
  assert.match(source, /data-pf-inpatient-room/u);
});

test("patient card editor uses the desktop-style transfer doctor control", () => {
  const source = readUtf8(viewPath);
  assert.match(source, /const renderTransferDoctorField\s*=\s*\(container\)\s*=>/u);
  assert.match(source, /data-pf-transfer-doctor/u);
  assert.match(source, /data-pf-transfer-add-doctor/u);
  assert.match(source, /TRANSFER_ADD_DOCTOR_VALUE/u);
  assert.match(source, /renderTransferDoctorField\(c1\)/u);
  assert.doesNotMatch(source, /field\(c1,\s*["']Передан["'],\s*["']Передан["']/u);
});

test("patient card editor exposes accelerator controls like the desktop PTV editor", () => {
  const source = readUtf8(viewPath);
  assert.match(source, /const acceleratorOptions\s*=\s*\["Varian Halcyon",\s*"Varian TrueBeam"\]/u);
  assert.match(source, /const resolveAccelerator\s*=\s*\(value,\s*context\s*=\s*\{\}\)\s*=>/u);
  assert.match(source, /const getPrimaryAccelerator\s*=\s*\(\)\s*=>/u);
  assert.match(source, /mkVolField\(dose1Row,\s*["']Ускоритель["'],\s*["']select["'][\s\S]*?setPending\(["']Ускоритель["']/u);
  assert.match(source, /mkVolField\(doseRow2,\s*["']Ускоритель["'],\s*["']select["'],\s*vol\.Ускоритель\s*\|\|\s*getPrimaryAccelerator\(\)[\s\S]*?vol\.Ускоритель\s*=\s*v/u);
  assert.match(source, /mkVolField\(newDoseRow,\s*["']Ускоритель["'],\s*["']select["'],\s*getPrimaryAccelerator\(\)[\s\S]*?newVol\.Ускоритель\s*=\s*v/u);
  assert.match(source, /const newBoost = \{ Название: defaultName, Область_облучения: null, РОД: null,\s*Количество_фракций: null, Фракционирование: ["']Стандартный["'], Связь: connType \};/u);
  assert.doesNotMatch(source, /mkVolField\(doseRow,\s*["']Ускоритель["']/u);
  assert.match(source, /const newVol = \{ Название: null, Область_облучения: null, РОД: null,\s*Количество_фракций: null, Фракционирование: ["']Стандартный["'], Связь: ["']Параллельно["'] \};/u);
});

test("failure in reminder fraction panel does not abort calendar and notes", () => {
  const source = readUtf8(viewPath);
  assert.match(source, /Patient reminder\/fraction panel failed; continuing patient page render/u);
  assert.match(source, /БЛОК 3: УМНЫЙ КАЛЕНДАРЬ/u);
  assert.match(source, /БЛОК ЗАМЕТОК/u);
});

test("patient fraction actions support selected multiple dates", () => {
  const source = readUtf8(viewPath);
  assert.match(source, /selectedFractionDates\s*=\s*new Set/u);
  assert.match(source, /data-pf-selected-fraction-date/u);
  assert.match(source, /handleAddMany2/u);
  assert.match(source, /processFrontMatter\(file,\s*fm\s*=>\s*\{[\s\S]*?selectedDates/u);
});

test("patient chemo reminders can be generated from the fraction panel", () => {
  const source = readUtf8(viewPath);
  assert.match(source, /patient-chemo-reminders-runtime\.js/u);
  assert.match(source, /ХТ_режим/u);
  assert.match(source, /ХТ_даты/u);
  assert.match(source, /Сгенерировать/u);
  assert.match(source, /buildChemoReminders/u);
  assert.match(source, /buildWeeklyLabReminders/u);
  assert.match(source, /ХТ_напоминания/u);
  assert.match(source, /Контроль_крови/u);
});

test("patient dose pill shows current delivered dose for each volume on separate lines", () => {
  const source = readUtf8(viewPath);
  assert.match(source, /const allVolumeDoseHtml\s*=\s*\(\(\)\s*=>/u);
  assert.match(source, /delivered1\s*\*\s*rod1/u);
  assert.match(source, /const deliveredN\s*=\s*s\.schedule\.filter\(d\s*=>\s*d\s*<=\s*today\)\.length/u);
  assert.match(source, /items\.push\(`<div>\$\{name\}:/u);
  assert.doesNotMatch(source, /Гр\/\$\{s\.fracN\}\s*фр\./u);
  assert.match(source, /allVolumeDoseHtml\s*\?\s*`<div/u);
});

test("patient discharge snapshot records calculated chemo introductions", () => {
  const source = readUtf8(viewPath);
  assert.match(source, /function buildDischargeChemoSnapshot\(dischargeIso\)/u);
  assert.match(source, /_snapshot\.db_chemo_regimen\s*=\s*_chemoSnapshot/u);
  assert.match(source, /filter\(iso\s*=>\s*iso\s*<=\s*cutoffIso\s*&&\s*!_hltSkippedDates\.has\(iso\)\s*&&\s*!_isHltBreakIso\(iso\)\)/u);
  assert.match(source, /На дату выписки \$\{cutoffIso\}: введено ХТ \$\{totalIntroductions\}/u);
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

console.log(`OK ${passed} patient legacy restoration checks passed`);
