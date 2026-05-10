const assert = require("assert");
const patientModelCore = require("../src/shared/patient-model-core.cjs");

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

test("buildPatientModel parses base schedule and progress", () => {
  const model = patientModelCore.buildPatientModel({
    Количество_фракций: 5,
    Дата_начала_лечения: "2026-04-20",
    Фракционирование: "ежедневно",
    Больничный_лист: true
  }, {
    todayIso: "2026-04-22",
    scheduleCore: {
      utils: { detectMode: () => "ежедневно" },
      buildSchedule: () => ["2026-04-20", "2026-04-21", "2026-04-22", "2026-04-23", "2026-04-24"]
    }
  });

  assert.equal(model.isSick, true);
  assert.equal(model.scheduleIsos.length, 5);
  assert.equal(model.currFrac, 3);
  assert.equal(model.endIso, "2026-04-24");
});

test("buildPatientModel exposes planned dose line with actual fraction progress", () => {
  const model = patientModelCore.buildPatientModel({
    page: {
      "Дата_начала_лечения": "2026-05-01",
      "Кол-во_фракций": 15,
      "Разовая_доза": 2,
      "Суммарная_доза": 30,
      "Пропущенные_даты_ЛТ": ["2026-05-05"],
      "ХЛТ_ручные_даты": ["2026-05-24"]
    },
    todayIso: "2026-05-15",
    holidays: []
  });

  assert.equal(model.doneFractions, 10);
  assert.equal(model.totalFractions, 15);
  assert.equal(model.percent, 67);
  assert.equal(model.displayDoseLine, "⚡ 30,0 Гр  ·  10/15 фр. (67%)");
});

test("buildPatientModel handles sequential extra volumes", () => {
  const calls = [];
  const scheduleCore = {
    utils: { detectMode: raw => raw || "standard" },
    normalizeConn: raw => raw || "Параллельно",
    nextWorkDayAfter: () => "2026-04-25",
    buildSchedule: ({ startDate, fracCount }) => {
      calls.push({ startDate, fracCount });
      return fracCount === 3
        ? ["2026-04-20", "2026-04-21", "2026-04-22"]
        : ["2026-04-25", "2026-04-26"];
    }
  };

  const model = patientModelCore.buildPatientModel({
    Количество_фракций: 3,
    Дата_начала_лечения: "2026-04-20",
    Объёмы: [{ Связь: "Последовательно", Количество_фракций: 2, Фракционирование: "standard" }]
  }, {
    todayIso: "2026-04-26",
    scheduleCore
  });

  assert.equal(calls.length, 2);
  assert.equal(model.extraSchedules.length, 1);
  assert.equal(model.extraSchedules[0].startIsoN, "2026-04-25");
  assert.equal(model.totalFrac, 5);
  assert.equal(model.totalCurrFrac, 5);
});

test("buildPatientModel preserves extra volume dose metadata", () => {
  const model = patientModelCore.buildPatientModel({
    Количество_фракций: 2,
    Дата_начала_лечения: "2026-04-20",
    Объёмы: [{ Связь: "Параллельно", Количество_фракций: 2, РОД: "2,5" }]
  }, {
    todayIso: "2026-04-21",
    scheduleCore: {
      normalizeConn: raw => raw || "Параллельно",
      buildSchedule: ({ startDate }) => [startDate, "2026-04-21"]
    }
  });

  assert.equal(model.extraSchedules[0].rodN, 2.5);
});

if (process.exitCode) process.exit(process.exitCode);
console.log("OK patient model core tests passed");
