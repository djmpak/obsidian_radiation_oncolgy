const assert = require("node:assert/strict");
const path = require("node:path");

const scheduleCorePath = path.resolve(__dirname, "..", "src", "shared", "schedule-core.cjs");
const {
  normalizeConn,
  nextWorkDay,
  nextWorkDayAfter,
  getWorkDays,
  minusWorkDays,
  addWorkDaysInclusive,
  addWorkDaysFromIso,
  buildSchedule,
  countDeliveredFractions
} = require(scheduleCorePath);

const HOLIDAYS = new Set(["2026-05-01"]);

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

test("normalizeConn converts legacy labels to canonical values", () => {
  assert.equal(normalizeConn("Изолированно (параллельно)"), "Параллельно");
  assert.equal(normalizeConn("Изолированно (последовательно)"), "Последовательно");
  assert.equal(normalizeConn(""), "Параллельно");
});

test("nextWorkDay keeps a workday and skips weekends/holidays", () => {
  assert.equal(nextWorkDay("2026-04-30", HOLIDAYS), "2026-04-30");
  assert.equal(nextWorkDay("2026-05-01", HOLIDAYS), "2026-05-04");
  assert.equal(nextWorkDay("2026-05-02", HOLIDAYS), "2026-05-04");
});

test("nextWorkDayAfter moves to the next workday after the given date", () => {
  assert.equal(nextWorkDayAfter("2026-04-30", HOLIDAYS), "2026-05-04");
  assert.equal(nextWorkDayAfter("2026-05-04", HOLIDAYS), "2026-05-05");
});

test("getWorkDays returns positive and negative offsets excluding the start day", () => {
  assert.equal(getWorkDays("2026-04-29", "2026-05-05", HOLIDAYS), 3);
  assert.equal(getWorkDays("2026-05-05", "2026-04-29", HOLIDAYS), -3);
});

test("minusWorkDays subtracts only real workdays", () => {
  assert.equal(minusWorkDays("2026-05-06", 3, HOLIDAYS), "2026-04-30");
});

test("addWorkDaysInclusive counts the start workday as day one", () => {
  assert.equal(addWorkDaysInclusive("2026-05-01", 2, HOLIDAYS), "2026-05-05");
  assert.equal(addWorkDaysInclusive("2026-05-04", 1, HOLIDAYS), "2026-05-04");
});

test("addWorkDaysFromIso adds workdays after the start date", () => {
  assert.equal(addWorkDaysFromIso("2026-04-30", 1, HOLIDAYS), "2026-05-04");
  assert.equal(addWorkDaysFromIso("2026-04-30", 2, HOLIDAYS), "2026-05-05");
  assert.equal(addWorkDaysFromIso("2026-05-04", 0, HOLIDAYS), "2026-05-04");
});

test("buildSchedule keeps manual weekend fractions and merges them with working days", () => {
  const schedule = buildSchedule({
    fracCount: 6,
    startDate: "2026-04-20",
    modeStr: "Стандартный",
    manualDates: ["2026-04-25"],
    skipDates: [],
    holidays: []
  });

  assert.deepEqual(schedule, [
    "2026-04-20",
    "2026-04-21",
    "2026-04-22",
    "2026-04-23",
    "2026-04-24",
    "2026-04-25"
  ]);
});

test("buildSchedule supports every-other-day mode", () => {
  const schedule = buildSchedule({
    fracCount: 4,
    startDate: "2026-04-20",
    modeStr: "через день",
    manualDates: [],
    skipDates: [],
    holidays: []
  });

  assert.deepEqual(schedule, [
    "2026-04-20",
    "2026-04-22",
    "2026-04-24",
    "2026-04-27"
  ]);
});

test("buildSchedule preserves two fractions on the same workday for BID mode", () => {
  const schedule = buildSchedule({
    fracCount: 4,
    startDate: "2026-04-20",
    modeStr: "2 раза в день",
    manualDates: [],
    skipDates: [],
    holidays: []
  });

  assert.deepEqual(schedule, [
    "2026-04-20",
    "2026-04-20",
    "2026-04-21",
    "2026-04-21"
  ]);
});

test("countDeliveredFractions merges schedule and manual dates, then excludes skipped dates", () => {
  assert.equal(countDeliveredFractions({
    schedule: ["2026-05-01", "2026-05-04", "2026-05-05", "2026-05-06"],
    skipped: ["2026-05-05"],
    added: ["2026-05-10", "2026-05-04"],
    todayIso: "2026-05-10"
  }), 4);
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

console.log(`OK ${passed} shared schedule-core tests passed`);
