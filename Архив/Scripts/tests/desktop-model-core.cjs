const assert = require("node:assert/strict");
const path = require("node:path");

const desktopCore = require(path.resolve(__dirname, "..", "src", "shared", "desktop-core.cjs"));

const scheduleCore = {
  utils: {
    detectMode: () => "ежедневно"
  },
  normalizeConn: (raw) => raw || "Параллельно",
  nextWorkDayAfter: () => "2026-04-23",
  buildSchedule: ({ fracCount, startDate }) => {
    if (fracCount === 3 && startDate === "2026-04-20") {
      return ["2026-04-20", "2026-04-21", "2026-04-22"];
    }
    if (fracCount === 2 && startDate === "2026-04-23") {
      return ["2026-04-23", "2026-04-24"];
    }
    return [];
  },
  minusWorkDays: () => "2026-04-17",
  addWorkDaysInclusive: () => "2026-04-24"
};

const model = desktopCore.buildPatientModel({
  Количество_фракций: 3,
  Дата_начала_лечения: "2026-04-20",
  Фракционирование: "ежедневно",
  Объёмы: [
    { Связь: "Последовательно", Количество_фракций: 2, Фракционирование: "ежедневно", РОД: "2,5" }
  ]
}, {
  todayIso: "2026-04-24",
  holidays: [],
  scheduleCore
});

assert.equal(model.startIso, "2026-04-20");
assert.equal(model.endIso, "2026-04-24");
assert.equal(model.scheduleIsos.length, 3);
assert.equal(model.extraSchedules.length, 1);
assert.equal(model.extraSchedules[0].startIsoN, "2026-04-23");
assert.equal(model.totalFrac, 5);
assert.equal(model.totalCurrFrac, 5);
assert.equal(model.contourDeadlineIso, "2026-04-17");
assert.equal(model.recontourDeadlineIso, "");

console.log("OK desktop model core tests passed");
