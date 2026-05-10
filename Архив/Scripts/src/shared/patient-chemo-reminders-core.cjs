"use strict";

const schedule = require("./schedule-core.cjs");

const {
  addWorkDaysFromIso,
  getWorkDays,
  nextWorkDay,
  _internal
} = schedule;

const { toIsoDate, shiftIso, weekdayFromIso } = _internal;

const normalizeIsoList = (items = []) => Array.from(new Set(
  (Array.isArray(items) ? items : [])
    .map(toIsoDate)
    .filter(Boolean)
)).sort();

const makeDateItems = (dates = [], source = "generated") => (
  normalizeIsoList(dates).map(date => ({ date, source }))
);

const isAvailableRtDate = (iso, skippedSet, holidaySet) => (
  Boolean(iso) && weekdayFromIso(iso) <= 5 && !skippedSet.has(iso) && !holidaySet.has(iso)
);

const buildBaseChemoDates = ({
  mode = "date-only",
  treatmentStartIso = "",
  treatmentEndIso = "",
  rtDates = [],
  skippedRtDates = [],
  holidays = []
} = {}) => {
  const start = toIsoDate(treatmentStartIso);
  const end = toIsoDate(treatmentEndIso);
  const holidaySet = new Set(normalizeIsoList(holidays));
  const skippedSet = new Set(normalizeIsoList(skippedRtDates));

  if (mode === "rt-days") {
    return normalizeIsoList(rtDates)
      .filter(iso => (!start || iso >= start) && (!end || iso <= end))
      .filter(iso => isAvailableRtDate(iso, skippedSet, holidaySet));
  }

  if (mode === "daily") {
    const dates = [];
    let current = start;
    let guard = 0;
    while (current && (!end || current <= end) && guard < 370) {
      if (weekdayFromIso(current) <= 5 && !holidaySet.has(current)) dates.push(current);
      current = shiftIso(current, 1);
      guard += 1;
    }
    return dates;
  }

  const date = nextWorkDay(start, holidaySet);
  return date ? [date] : [];
};

const applyManualShift = ({
  dates = [],
  manualShiftFromIso = "",
  manualShiftToIso = "",
  holidays = []
} = {}) => {
  const from = toIsoDate(manualShiftFromIso);
  const to = toIsoDate(manualShiftToIso);
  const base = normalizeIsoList(dates);
  if (!from || !to || !base.includes(from)) return base;

  const shift = getWorkDays(from, to, holidays);
  if (!shift) return base;

  const shifted = base
    .filter(iso => iso >= from)
    .map(iso => addWorkDaysFromIso(iso, shift, holidays))
    .filter(Boolean);

  return normalizeIsoList([...base, ...shifted]);
};

const buildChemoReminders = (options = {}) => {
  const baseDates = buildBaseChemoDates(options);
  const shiftedDates = applyManualShift({
    dates: baseDates,
    manualShiftFromIso: options.manualShiftFromIso,
    manualShiftToIso: options.manualShiftToIso,
    holidays: options.holidays
  });

  return {
    mode: options.mode || "date-only",
    chemo: makeDateItems(shiftedDates, "chemo")
  };
};

const buildWeeklyLabReminders = ({
  treatmentStartIso = "",
  treatmentEndIso = "",
  holidays = [],
  skippedRtDates = []
} = {}) => {
  const start = toIsoDate(treatmentStartIso);
  const end = toIsoDate(treatmentEndIso);
  if (!start || !end || start > end) return [];

  const blocked = new Set([...normalizeIsoList(holidays), ...normalizeIsoList(skippedRtDates)]);
  const dates = [];
  let current = start;
  let guard = 0;

  while (current && current <= end && guard < 80) {
    const normalized = nextWorkDay(current, blocked);
    if (normalized && normalized <= end) dates.push(normalized);
    current = shiftIso(normalized || current, 7);
    guard += 1;
  }

  return makeDateItems(dates, "lab");
};

module.exports = {
  normalizeIsoList,
  buildBaseChemoDates,
  applyManualShift,
  buildChemoReminders,
  buildWeeklyLabReminders
};

