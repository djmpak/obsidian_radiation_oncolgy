const assert = require("node:assert/strict");
const test = require("node:test");

const core = require("../src/shared/patient-chemo-reminders-core.cjs");

test("buildChemoReminders follows rt dates, skips invalid treatment days and propagates a manual workday shift", () => {
  const result = core.buildChemoReminders({
    mode: "rt-days",
    treatmentStartIso: "2026-05-01",
    rtDates: ["2026-05-01", "2026-05-04", "2026-05-05", "2026-05-06"],
    skippedRtDates: ["2026-05-05"],
    holidays: ["2026-05-04"],
    manualShiftFromIso: "2026-05-06",
    manualShiftToIso: "2026-05-07"
  });

  assert.deepEqual(result.chemo.map(item => item.date), ["2026-05-01", "2026-05-06", "2026-05-07"]);
});

test("buildWeeklyLabReminders schedules weekly blood control on next available workdays", () => {
  const result = core.buildWeeklyLabReminders({
    treatmentStartIso: "2026-05-01",
    treatmentEndIso: "2026-05-29",
    holidays: ["2026-05-08"],
    skippedRtDates: ["2026-05-15"]
  });

  assert.deepEqual(result.map(item => item.date), ["2026-05-01", "2026-05-11", "2026-05-18", "2026-05-25"]);
});

