const assert = require("node:assert/strict");
const path = require("node:path");

const core = require(path.resolve(__dirname, "..", "src", "shared", "patient-note-core.cjs"));

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

test("renderInitialContent creates a patient view note without root template dependency", () => {
  const content = core.renderInitialContent({
    frontmatter: {
      "ФИО": "Иванов Иван",
      "Дата_рождения": "1970-01-02",
      "МКБ 10": "C34",
      "_Открыть_редактор_сразу": true
    }
  });

  assert.match(content, /^---\n/u);
  assert.match(content, /ФИО: Иванов Иван/u);
  assert.match(content, /Дата_рождения: 1970-01-02/u);
  assert.match(content, /МКБ 10: C34/u);
  assert.match(content, /Передан:\s*\n/u);
  assert.match(content, /КС:\s*\n/u);
  assert.match(content, /Палата:\s*\n/u);
  assert.match(content, /ХТ_режим:\s*\n/u);
  assert.match(content, /ХТ_даты: \[\]/u);
  assert.match(content, /ХТ_ручные_смещения: \[\]/u);
  assert.match(content, /ХТ_напоминания: \[\]/u);
  assert.match(content, /Ускоритель: Varian Halcyon/u);
  assert.match(content, /await dv\.view\("Архив\/Scripts\/views\/patient"/u);
  assert.doesNotMatch(content, /Шаблон пациента/u);
  assert.doesNotMatch(content, /_Открыть_редактор_сразу/u);
});

test("ensureInitialFrontmatter preserves required empty collections and scalar defaults", () => {
  const fm = core.ensureInitialFrontmatter({ "ФИО": "Петров Петр" });

  assert.equal(fm["ФИО"], "Петров Петр");
  assert.deepEqual(fm["Контроль_крови"], []);
  assert.deepEqual(fm["ЛС_назначения"], []);
  assert.deepEqual(fm["Лекарственные_препараты"], []);
  assert.deepEqual(fm["Лабораторные"], []);
  assert.deepEqual(fm["ХЛТ_ручные_даты"], []);
  assert.deepEqual(fm["Пропущенные_даты_ХЛТ"], []);
  assert.equal(fm["ХТ_режим"], "");
  assert.deepEqual(fm["ХТ_даты"], []);
  assert.deepEqual(fm["ХТ_ручные_смещения"], []);
  assert.deepEqual(fm["ХТ_напоминания"], []);
  assert.equal(fm["Больничный_лист"], false);
  assert.equal(fm["Открытый_ЭЛН_активен"], false);
  assert.equal(fm["Перерыв_ХЛТ"], null);
  assert.equal(fm["ECOG_статус"], "");
  assert.equal(fm["Ускоритель"], "Varian Halcyon");
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

console.log(`OK ${passed} patient-note core tests passed`);
