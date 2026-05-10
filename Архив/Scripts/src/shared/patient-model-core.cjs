"use strict";

const defaultScheduleCore = require("./schedule-core.cjs");

const toIso = (value) => {
  if (!value) return "";
  if (typeof value === "object" && value !== null && typeof value.toISODate === "function") return value.toISODate();
  return String(value || "").slice(0, 10);
};

const toIsoList = (value) => (
  Array.isArray(value) ? value.map(toIso).filter(Boolean) : []
);

const getPatientSource = (p) => (p?.page && typeof p.page === "object" ? p.page : p);

const getFirstValue = (source = {}, keys = []) => {
  for (const key of keys) {
    const value = source?.[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return undefined;
};

const getFirstDateList = (source = {}, keys = []) => {
  for (const key of keys) {
    const dates = toIsoList(source?.[key]);
    if (dates.length) return dates;
  }
  return [];
};

const toNumber = (value) => Number(String(value ?? "").replace(",", ".")) || 0;

const formatDoseValue = (value) => (
  (Math.round((Number(value) || 0) * 10) / 10).toFixed(1).replace(".", ",")
);

const buildDisplayDoseLine = ({ plannedDose = 0, doneFractions = 0, totalFractions = 0, percent = 0 } = {}) => (
  `⚡ ${formatDoseValue(plannedDose)} Гр  ·  ${doneFractions}/${totalFractions} фр. (${percent}%)`
);

const resolveTreatmentStartIso = ({ startIso = "", manualDateIsos = [] } = {}) => {
  if (startIso) return startIso;
  return (Array.isArray(manualDateIsos) ? manualDateIsos : [])
    .map(value => String(value || ""))
    .filter(Boolean)
    .sort()[0] || "";
};

const getScheduleManualDateIsos = ({ startIso = "", manualDateIsos = [], fracCount = 0 } = {}) => {
  const manuals = (Array.isArray(manualDateIsos) ? manualDateIsos : [])
    .map(value => String(value || ""))
    .filter(Boolean);
  if (!startIso) return manuals;
  const activeManuals = manuals.filter(iso => iso >= startIso);
  return activeManuals.length >= Number(fracCount || 0) ? activeManuals : manuals;
};

const getSegmentTotals = (segments = []) => segments.reduce((acc, segment) => ({
  totalFrac: acc.totalFrac + (Number(segment?.frac) || 0),
  totalCurrFrac: acc.totalCurrFrac + (Number(segment?.currFrac) || 0)
}), { totalFrac: 0, totalCurrFrac: 0 });

const getBaseTreatmentSegment = ({ frac = 0, currFrac = 0 } = {}) => ({
  frac: Number(frac) || 0,
  currFrac: Number(currFrac) || 0,
  color: "#4caf50"
});

const getVkDateSourceList = (raw) => (Array.isArray(raw) ? raw : [raw]);

const hasFractionOnDate = (scheduleIsoLists = [], dayIso = "") => scheduleIsoLists.some(schedule => (
  Array.isArray(schedule) && schedule.some(iso => String(iso || "") === dayIso)
));

const getExtraVolumeItems = (volumes = []) => (
  Array.isArray(volumes) ? volumes.filter(volume => volume && typeof volume === "object") : []
);

const getExtraVolumePlan = ({
  vol = {},
  baseFrac = 0,
  normalizeConn = (raw) => String(raw || ""),
  parseMode = (raw) => raw
} = {}) => {
  const conn = normalizeConn(vol?.Связь);
  const isSimultaneous = conn === "Одновременно";
  const fracN = isSimultaneous ? (Number(baseFrac) || 0) : Number(vol?.Количество_фракций);
  return {
    vol,
    fracN,
    conn,
    modeN: parseMode(vol?.Фракционирование),
    isSimultaneous,
    hasInvalidFraction: !isSimultaneous && (!fracN || fracN <= 0)
  };
};

const isSequentialConnection = (conn = "") => conn === "Последовательный буст" || conn === "Последовательно";

const getSegmentColor = (conn = "") => {
  if (conn === "Последовательно") return "#ffc107";
  return "#9c27b0";
};

const getExtraVolumeStartIso = ({
  conn = "",
  startIso = "",
  prevEndIso = "",
  nextWorkDayAfterIso = null
} = {}) => {
  if (conn === "Параллельно") return String(startIso || "");
  if (!prevEndIso || typeof nextWorkDayAfterIso !== "function") return "";
  return String(nextWorkDayAfterIso(prevEndIso) || "");
};

const shouldAppendSequentialSegment = (conn = "", endIso = "") => !!endIso && isSequentialConnection(conn);

const getLaterIso = (currentIso = "", candidateIso = "") => {
  if (!currentIso) return String(candidateIso || "");
  if (!candidateIso) return String(currentIso || "");
  return candidateIso > currentIso ? candidateIso : currentIso;
};

const getSequentialSegment = ({
  conn = "",
  endIso = "",
  frac = 0,
  currFrac = 0
} = {}) => (
  shouldAppendSequentialSegment(conn, endIso)
    ? { frac, currFrac, color: getSegmentColor(conn) }
    : null
);

const buildPatientModel = (p, {
  holidays = [],
  todayIso = "",
  scheduleCore = null
} = {}) => {
  const source = getPatientSource(p);
  const activeScheduleCore = scheduleCore || defaultScheduleCore;
  const effectiveHolidays = Array.isArray(p?.holidays) ? p.holidays : holidays;
  const effectiveTodayIso = todayIso || toIso(p?.todayIso);
  const frac = Number(getFirstValue(source, ["Количество_фракций", "Кол-во_фракций"])) || 0;
  const rod = toNumber(getFirstValue(source, ["РОД", "Разовая_доза"]));
  const plannedDose = toNumber(getFirstValue(source, ["Суммарная_доза", "СОД"])) || (frac && rod ? frac * rod : 0);
  const startRawIso = toIso(source?.Дата_начала_лечения);
  const modeRaw = source?.Фракционирование;
  const mode = activeScheduleCore?.utils?.detectMode ? activeScheduleCore.utils.detectMode(modeRaw) : modeRaw;
  const manuals = getFirstDateList(source, ["Внеплановые_фракции", "ХЛТ_ручные_даты"]);
  const skipList = getFirstDateList(source, ["Пропущенные_даты", "Пропущенные_даты_ЛТ"]);
  const skips = new Set(skipList);
  const isSick = !!source?.Больничный_лист;
  const vkDateIsos = getVkDateSourceList(source?.["Очередное_ВК"]).map(toIso).filter(Boolean);

  const startIso = resolveTreatmentStartIso({
    startIso: startRawIso,
    manualDateIsos: manuals
  });

  const scheduleManualIsos = getScheduleManualDateIsos({
    startIso,
    manualDateIsos: manuals,
    fracCount: frac
  });

  let scheduleIsos = [];
  if (activeScheduleCore && typeof activeScheduleCore.buildSchedule === "function") {
    scheduleIsos = activeScheduleCore.buildSchedule({
      fracCount: frac,
      startDate: startIso,
      modeStr: mode,
      manualDates: scheduleManualIsos,
      skipDates: Array.from(skips),
      holidays: effectiveHolidays
    });
  }

  let endIso = scheduleIsos.length ? scheduleIsos[scheduleIsos.length - 1] : "";
  const currFrac = activeScheduleCore && typeof activeScheduleCore.countDeliveredFractions === "function"
    ? activeScheduleCore.countDeliveredFractions({
      schedule: scheduleIsos,
      skipped: skipList,
      added: scheduleManualIsos,
      todayIso: effectiveTodayIso
    })
    : scheduleIsos.filter(iso => iso <= effectiveTodayIso).length;
  const segments = [getBaseTreatmentSegment({ frac, currFrac })];
  const extraSchedules = [];
  let prevEndIso = endIso;

  getExtraVolumeItems(source?.Объёмы).forEach(vol => {
    const rodN = Number(String(vol?.РОД ?? "").replace(",", "."));
    const volPlan = getExtraVolumePlan({
      vol,
      baseFrac: frac,
      normalizeConn: (raw) => activeScheduleCore?.normalizeConn ? activeScheduleCore.normalizeConn(raw) : String(raw || ""),
      parseMode: (raw) => activeScheduleCore?.utils?.detectMode ? activeScheduleCore.utils.detectMode(raw) : raw
    });
    const { fracN, conn, modeN } = volPlan;

    if (volPlan.isSimultaneous) {
      extraSchedules.push({ vol, fracN: frac || 0, rodN, conn, scheduleIsos, startIsoN: startIso, endIsoN: endIso });
      return;
    }
    if (volPlan.hasInvalidFraction) {
      extraSchedules.push({ vol, fracN, rodN, conn, scheduleIsos: [], startIsoN: "", endIsoN: "" });
      return;
    }

    const startIsoN = getExtraVolumeStartIso({
      conn,
      startIso,
      prevEndIso,
      nextWorkDayAfterIso: (iso) => activeScheduleCore?.nextWorkDayAfter ? activeScheduleCore.nextWorkDayAfter(iso, effectiveHolidays, 30) : ""
    });

    if (!startIsoN) {
      extraSchedules.push({ vol, fracN, rodN, conn, scheduleIsos: [], startIsoN: "", endIsoN: "" });
      return;
    }

    const schedIsos = activeScheduleCore && typeof activeScheduleCore.buildSchedule === "function"
      ? activeScheduleCore.buildSchedule({
        fracCount: fracN,
        startDate: startIsoN,
        modeStr: modeN,
        manualDates: manuals,
        skipDates: Array.from(skips),
        holidays: effectiveHolidays
      })
      : [];

    const endIsoN = schedIsos.length ? schedIsos[schedIsos.length - 1] : "";
    const currFracN = activeScheduleCore && typeof activeScheduleCore.countDeliveredFractions === "function"
      ? activeScheduleCore.countDeliveredFractions({
        schedule: schedIsos,
        skipped: skipList,
        added: manuals,
        todayIso: effectiveTodayIso
      })
      : schedIsos.filter(iso => iso <= effectiveTodayIso).length;
    extraSchedules.push({ vol, fracN, rodN, conn, scheduleIsos: schedIsos, startIsoN, endIsoN });

    if (endIsoN) {
      endIso = getLaterIso(endIso, endIsoN);
      const sequentialSegment = getSequentialSegment({ conn, endIso: endIsoN, frac: fracN, currFrac: currFracN });
      if (sequentialSegment) {
        prevEndIso = endIsoN;
        segments.push(sequentialSegment);
      }
    }
  });

  const { totalFrac, totalCurrFrac } = getSegmentTotals(segments);
  const percent = totalFrac > 0 ? Math.min(100, Math.round((totalCurrFrac / totalFrac) * 100)) : 0;
  const allScheduleIsos = [scheduleIsos, ...extraSchedules.map(s => s.scheduleIsos)];
  const hasFractionToday = hasFractionOnDate(allScheduleIsos, effectiveTodayIso);
  const contourDeadlineIso = startIso && activeScheduleCore && typeof activeScheduleCore.minusWorkDays === "function"
    ? activeScheduleCore.minusWorkDays(startIso, 3, effectiveHolidays)
    : "";
  const remarkDateIso = toIso(source?.Дата_переразметки);
  const recontourDeadlineIso = remarkDateIso && source?.Переразметка === true && activeScheduleCore && typeof activeScheduleCore.addWorkDaysInclusive === "function"
    ? activeScheduleCore.addWorkDaysInclusive(remarkDateIso, 2, effectiveHolidays)
    : "";

  return {
    p: source,
    startIso,
    endIso,
    scheduleIsos,
    currFrac,
    frac,
    doneFractions: totalCurrFrac,
    totalFractions: totalFrac,
    percent,
    plannedDose,
    displayDoseLine: buildDisplayDoseLine({
      plannedDose,
      doneFractions: totalCurrFrac,
      totalFractions: totalFrac,
      percent
    }),
    segments,
    totalFrac,
    totalCurrFrac,
    extraSchedules,
    hasFractionToday,
    isSick,
    vkDateIsos,
    contourDeadlineIso,
    remarkDateIso,
    recontourDeadlineIso,
    markIso: toIso(source?.Дата_разметки)
  };
};

module.exports = {
  toIso,
  toIsoList,
  getPatientSource,
  getFirstValue,
  getFirstDateList,
  formatDoseValue,
  buildDisplayDoseLine,
  resolveTreatmentStartIso,
  getScheduleManualDateIsos,
  getSegmentTotals,
  getBaseTreatmentSegment,
  getVkDateSourceList,
  hasFractionOnDate,
  getExtraVolumeItems,
  getExtraVolumePlan,
  isSequentialConnection,
  getSegmentColor,
  getExtraVolumeStartIso,
  shouldAppendSequentialSegment,
  getLaterIso,
  getSequentialSegment,
  buildPatientModel
};
