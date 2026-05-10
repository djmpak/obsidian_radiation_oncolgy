const DAY_MS = 24 * 60 * 60 * 1000;

const toIsoDate = (value) => {
  if (!value) return null;
  if (typeof value === "string") {
    const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})/u);
    return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "object" && typeof value.toISODate === "function") {
    return value.toISODate();
  }
  return null;
};

const parseIsoDate = (iso) => {
  const normalized = toIsoDate(iso);
  if (!normalized) return null;
  const [year, month, day] = normalized.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return Number.isNaN(date.getTime()) ? null : date;
};

const dateToIso = (date) => (date instanceof Date && !Number.isNaN(date.getTime()) ? date.toISOString().slice(0, 10) : null);

const shiftIso = (iso, days) => {
  const date = parseIsoDate(iso);
  if (!date) return null;
  return dateToIso(new Date(date.getTime() + days * DAY_MS));
};

const weekdayFromIso = (iso) => {
  const date = parseIsoDate(iso);
  if (!date) return null;
  const weekday = date.getUTCDay();
  return weekday === 0 ? 7 : weekday;
};

const toHolidaySet = (value) => {
  if (value instanceof Set) return new Set(Array.from(value).map(toIsoDate).filter(Boolean));
  if (Array.isArray(value)) return new Set(value.map(toIsoDate).filter(Boolean));
  return new Set();
};

const normalizeConn = (raw) => {
  const text = String(raw || "").trim();
  if (text === "Изолированно (параллельно)") return "Параллельно";
  if (text === "Изолированно (последовательно)") return "Последовательно";
  return text || "Параллельно";
};

const isWorkDay = (iso, holidays = new Set()) => {
  const weekday = weekdayFromIso(iso);
  if (!weekday) return false;
  return weekday <= 5 && !toHolidaySet(holidays).has(toIsoDate(iso));
};

const nextWorkDay = (iso, holidays = new Set(), safetyLimit = 14) => {
  let current = toIsoDate(iso);
  const holidaySet = toHolidaySet(holidays);
  if (!current) return null;
  let safety = 0;
  while (safety < safetyLimit) {
    if (weekdayFromIso(current) <= 5 && !holidaySet.has(current)) return current;
    current = shiftIso(current, 1);
    safety += 1;
  }
  return toIsoDate(iso);
};

const nextWorkDayAfter = (iso, holidays = new Set(), safetyLimit = 30) => {
  let current = shiftIso(iso, 1);
  const holidaySet = toHolidaySet(holidays);
  if (!current) return null;
  let safety = 0;
  while (safety < safetyLimit) {
    if (weekdayFromIso(current) <= 5 && !holidaySet.has(current)) return current;
    current = shiftIso(current, 1);
    safety += 1;
  }
  return shiftIso(iso, 1);
};

const getWorkDays = (startRaw, endRaw, holidays = new Set()) => {
  const start = toIsoDate(startRaw);
  const end = toIsoDate(endRaw);
  const holidaySet = toHolidaySet(holidays);
  if (!start || !end) return 0;

  if (end < start) {
    let count = 0;
    let current = shiftIso(end, 1);
    while (current && current <= start) {
      if (weekdayFromIso(current) <= 5 && !holidaySet.has(current)) count += 1;
      current = shiftIso(current, 1);
    }
    return -count;
  }

  let count = 0;
  let current = shiftIso(start, 1);
  while (current && current <= end) {
    if (weekdayFromIso(current) <= 5 && !holidaySet.has(current)) count += 1;
    current = shiftIso(current, 1);
  }
  return count;
};

const minusWorkDays = (iso, days, holidays = new Set()) => {
  const holidaySet = toHolidaySet(holidays);
  let current = toIsoDate(iso);
  let remaining = Number(days) || 0;
  if (!current) return null;
  while (remaining > 0) {
    current = shiftIso(current, -1);
    if (!current) return null;
    if (weekdayFromIso(current) <= 5 && !holidaySet.has(current)) remaining -= 1;
  }
  return current;
};

const addWorkDaysInclusive = (startRaw, days, holidays = new Set()) => {
  const holidaySet = toHolidaySet(holidays);
  let current = toIsoDate(startRaw);
  let remaining = Number(days) || 0;
  if (!current || remaining <= 0) return null;

  while (weekdayFromIso(current) > 5 || holidaySet.has(current)) {
    current = shiftIso(current, 1);
  }

  remaining -= 1;
  while (remaining > 0) {
    current = shiftIso(current, 1);
    if (weekdayFromIso(current) <= 5 && !holidaySet.has(current)) remaining -= 1;
  }

  return current;
};

const addWorkDaysFromIso = (startRaw, days, holidays = new Set()) => {
  const holidaySet = toHolidaySet(holidays);
  let current = toIsoDate(startRaw);
  let remaining = Number(days) || 0;
  if (!current) return null;
  if (remaining <= 0) return current;

  while (remaining > 0) {
    current = shiftIso(current, 1);
    if (!current) return null;
    if (weekdayFromIso(current) <= 5 && !holidaySet.has(current)) remaining -= 1;
  }

  return current;
};

const detectMode = (modeStr) => {
  const source = String(modeStr || "").toLowerCase();
  if (/2\s*раза|два\s*раза|bid/u.test(source)) return "bid";
  if (/через\s*день|qod/u.test(source)) return "qod";
  return "standard";
};

const buildSchedule = ({
  fracCount,
  startDate,
  modeStr,
  manualDates = [],
  skipDates = [],
  holidays = []
}) => {
  const start = toIsoDate(startDate);
  const total = Number(fracCount) || 0;
  const holidaySet = toHolidaySet(holidays);
  const skipSet = toHolidaySet(skipDates);
  if (!start || total <= 0) return [];

  const mode = detectMode(modeStr);
  const activeManuals = manualDates
    .map(toIsoDate)
    .filter(Boolean)
    .filter((iso) => iso >= start);

  const autoSchedule = [];
  if (activeManuals.length < total) {
    let current = start;
    let loops = 0;
    const needed = total - activeManuals.length;
    const safeLimit = total + 60;

    while (autoSchedule.length < needed && autoSchedule.length < safeLimit && loops < 2000) {
      loops += 1;
      const workDay = weekdayFromIso(current) <= 5 && !skipSet.has(current) && !holidaySet.has(current);

      if (mode === "bid") {
        if (workDay) {
          autoSchedule.push(current);
          if (autoSchedule.length < needed) autoSchedule.push(current);
        }
        current = shiftIso(current, 1);
      } else if (mode === "qod") {
        if (workDay) {
          autoSchedule.push(current);
          current = shiftIso(current, 2);
        } else {
          current = shiftIso(current, 1);
        }
      } else {
        if (workDay) autoSchedule.push(current);
        current = shiftIso(current, 1);
      }
    }
  }

  return [...autoSchedule, ...activeManuals]
    .sort()
    .slice(0, total);
};

const countDeliveredFractions = ({ schedule = [], skipped = [], added = [], todayIso = "" } = {}) => {
  const today = toIsoDate(todayIso);
  if (!today) return 0;

  const skipSet = toHolidaySet(skipped);
  const unique = new Set([
    ...(Array.isArray(schedule) ? schedule : []).map(toIsoDate).filter(Boolean),
    ...(Array.isArray(added) ? added : []).map(toIsoDate).filter(Boolean)
  ]);

  return Array.from(unique)
    .filter(iso => iso <= today)
    .filter(iso => !skipSet.has(iso))
    .length;
};

module.exports = {
  normalizeConn,
  nextWorkDay,
  nextWorkDayAfter,
  getWorkDays,
  minusWorkDays,
  addWorkDaysInclusive,
  addWorkDaysFromIso,
  buildSchedule,
  countDeliveredFractions,
  _internal: {
    toIsoDate,
    parseIsoDate,
    dateToIso,
    shiftIso,
    weekdayFromIso,
    detectMode,
    isWorkDay
  }
};
