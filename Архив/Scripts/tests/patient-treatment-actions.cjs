const assert = require("assert");
const {
  createPatientTreatmentActions,
  normalizeLsAssignments,
  dedupLsAssignments,
  toLsTerm,
  toLsUiDuration
} = require("../src/shared/patient-treatment-actions.cjs");

const test = async (name, fn) => {
  try {
    await fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    console.error(error);
    process.exitCode = 1;
  }
};

(async () => {
  await test("normalizes legacy and new LS assignments", async () => {
    const next = normalizeLsAssignments({
      ЛС_назначения: [
        { Препарат: "  Цисплатин ", Дозировка: " 50 мг ", Срок: "7_дней", Дней: 7, Дата_старта: "2026-05-02" }
      ]
    });
    assert.deepStrictEqual(next, [{
      Препарат: "Цисплатин",
      Дозировка: "50 мг",
      Срок: "7_дней",
      Дней: 7,
      Дата_старта: "2026-05-02"
    }]);

    const legacy = normalizeLsAssignments({
      Лекарственные_препараты: [
        { Препарат: "Капецитабин", Дозировка: "1000 мг", Срок: "14 дней", Дата_начала: "2026-05-02" }
      ]
    });
    assert.deepStrictEqual(legacy, [{
      Препарат: "Капецитабин",
      Дозировка: "1000 мг",
      Срок: "14_дней",
      Дней: 14,
      Дата_старта: "2026-05-02"
    }]);
  });

  await test("dedupes LS assignments by normalized identity", async () => {
    const next = dedupLsAssignments([
      { Препарат: "A", Дозировка: "1", Срок: "весь_курс", Дней: null, Дата_старта: "" },
      { Препарат: "a ", Дозировка: "1 ", Срок: "весь_курс", Дней: null, Дата_старта: "" }
    ]);
    assert.strictEqual(next.length, 1);
  });

  await test("persists named treatment actions", async () => {
    const calls = [];
    const ls = { _volumes: [] };
    const actions = createPatientTreatmentActions({
      saveNow: (updates) => { calls.push(updates); Object.assign(ls, updates); return Promise.resolve(updates); },
      ls
    });

    actions.eln.setHospitalizedOff();
    actions.hlt.saveDrugs([{ Препарат: "Сорафениб", Режим: "ежедневно", Дата: "" }]);
    actions.meds.saveAssignments([
      { Препарат: "Цисплатин", Дозировка: "50 мг", Срок: "7 дней", Дата_старта: "2026-05-02" }
    ]);

    const volume = actions.volumes.addVolume({ Название: "PTV1", Связь: "Параллельно" });
    actions.volumes.setVolumeArea(volume, "Лёгкое");
    actions.volumes.setPrimaryName("PTV-A");
    actions.volumes.insertBoostAt(1, { connection: "Одновременно", name: "SIB" });

    assert.deepStrictEqual(calls[0], { Открытый_ЭЛН: null, Открытый_ЭЛН_активен: false });
    assert.deepStrictEqual(calls[1], { ХЛТ_препараты: [{ Препарат: "Сорафениб", Режим: "ежедневно", Дата: "" }] });
    assert.strictEqual(calls[2].ЛС_назначения[0].Препарат, "Цисплатин");
    assert.strictEqual(calls[3].Объёмы.length, 1);
    assert.strictEqual(calls[4].Объёмы[0].Область_облучения, "Лёгкое");
    assert.deepStrictEqual(calls[5], { Название_PTV: "PTV-A" });
    assert.strictEqual(calls[6].Объёмы[1].Связь, "Одновременно");
  });

  assert.strictEqual(toLsTerm("Весь период лечения").Срок, "весь_курс");
  assert.strictEqual(toLsTerm("14 дней").Дней, 14);
  assert.strictEqual(toLsUiDuration("14_дней", 14), "14 дней");

  if (!process.exitCode) console.log("OK patient treatment actions tests passed");
})();
