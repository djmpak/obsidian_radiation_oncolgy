const assert = require("assert");
const schema = require("../src/shared/patient-schema-core.cjs");
const paths = require("../src/shared/paths-config-core.cjs");

const test = (name, fn) => {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    console.error(error);
    process.exitCode = 1;
  }
};

test("ensureInitialFrontmatter applies schema defaults and strips temp keys", () => {
  const fm = schema.ensureInitialFrontmatter({
    "ФИО": "Иванов Иван",
    "_Открыть_редактор_сразу": true
  });

  assert.equal(fm.schemaVersion, schema.PATIENT_SCHEMA_VERSION);
  assert.equal(fm["ФИО"], "Иванов Иван");
  assert.deepEqual(fm["Контроль_крови"], []);
  assert.equal(fm["Больничный_лист"], false);
  assert.equal(Object.prototype.hasOwnProperty.call(fm, "_Открыть_редактор_сразу"), false);
});

test("getDefaultFrontmatter returns independent collections", () => {
  const a = schema.getDefaultFrontmatter();
  const b = schema.getDefaultFrontmatter();
  a.tags.push("x");
  assert.deepEqual(b.tags, []);
});

test("default frontmatter includes transfer and inpatient room fields", () => {
  const fm = schema.getDefaultFrontmatter();
  assert.equal(fm["Передан"], "");
  assert.equal(fm["КС"], "");
  assert.equal(fm["Палата"], "");
  assert.equal(fm["Ускоритель"], "Varian Halcyon");
});

test("default frontmatter includes chemo reminder fields", () => {
  const fm = schema.getDefaultFrontmatter();
  assert.equal(fm["ХТ_режим"], "");
  assert.deepEqual(fm["ХТ_даты"], []);
  assert.deepEqual(fm["ХТ_ручные_смещения"], []);
  assert.deepEqual(fm["ХТ_напоминания"], []);
  assert.deepEqual(fm["Контроль_крови"], []);
});

test("paths config exposes vault paths and sanitizes attachment folders", () => {
  assert.equal(paths.PATHS.patientViewPath, "Архив/Scripts/views/patient");
  assert.equal(paths.DB_EXPORT_KEYS.at, "db_exported_at");
  assert.equal(paths.getPatientAttachmentFolder("A/B:C"), "Архив/Вложения/A_B_C");
  assert.equal(paths.getRuntimeModulePath("patient-schema-runtime.js"), "Архив/Scripts/modules/patient-schema-runtime.js");
});

if (process.exitCode) process.exit(process.exitCode);
console.log("OK patient schema/config tests passed");
