"use strict";

const getTagList = (page) => (page?.file?.tags || []).map(tag => String(tag || "").toLowerCase());

const hasChemoradiation = (page) => {
  const tags = getTagList(page);
  return tags.some(tag => tag.includes("хлт"))
    || (Array.isArray(page?.ХЛТ_препараты) && page.ХЛТ_препараты.filter(Boolean).length > 0)
    || !!String(page?.Радиомодификация || "").trim()
    || !!String(page?.ХЛТ_режим || "").trim()
    || !!String(page?.ХЛТ_дата_старта || "").trim();
};

const getPatientFilterHints = (page) => {
  const tags = getTagList(page);
  const hints = [];
  if (tags.some(tag => tag.includes("дс"))) hints.push("дс дневной стационар");
  if (tags.some(tag => tag.includes("кс"))) hints.push("кс круглосуточный стационар");
  if (hasChemoradiation(page)) hints.push("хлт химиолучевая радиомодификация");
  if (page?.Больничный_лист === true) hints.push("элн больничный лист");
  if (page?.Госпитализация === true) hints.push("госп госпитализация");
  return hints.join(" ");
};

const getPatientBadges = (page) => {
  const tags = getTagList(page);
  let badges = "";
  if (String(page?.["Передан"] || "").trim()) badges += "📦";
  if (hasChemoradiation(page)) badges += "🧪";
  if (page?.Больничный_лист === true) badges += "🤕";
  if (tags.some(tag => tag.includes("кс"))) badges += "🏥";
  const remarkCount = Array.isArray(page?.Переразметки)
    ? page.Переразметки.filter(item => item && item.Дата).length
    : (page?.Дата_переразметки ? 1 : 0);
  if (remarkCount > 0) {
    badges += `<span style="display:inline-block;background:rgba(63,81,181,0.15);color:#3f51b5;border-radius:3px;padding:0 3px;font-size:0.78em;font-weight:700;vertical-align:middle;margin-right:1px;">${remarkCount}↺</span>`;
  }
  return badges ? `${badges} ` : "";
};

const reminderHasVk = (text) => /(?:^|[^а-яa-z])вк(?:[^а-яa-z]|$)|продление\s+элн/i.test(String(text || ""));

const getReminderFilterHints = (item) => {
  const hints = [getPatientFilterHints(item?.patient), "напоминание"];
  const reminderText = String(item?.reminder?.текст || "").trim().toLowerCase();
  if (reminderText) hints.push(reminderText);
  if (reminderHasVk(reminderText)) hints.push("вк продление элн");
  return hints.filter(Boolean).join(" ");
};

const getPrescriptionFundingLabel = (raw) => {
  const value = String(raw || "").trim();
  const compact = value.replace(/\s+/g, " ");
  const low = value.toLowerCase();
  if (!low) return "";
  if (low.includes("омс")) return "ОМС";
  if (low.includes("пму")) return "ПМУ";
  if (low.includes("дмс")) return "ДМС";
  if (low.includes("мэс")) {
    const match = compact.match(/(?:мэс\D*)(\d+)/iu) || compact.match(/(\d+)\D*мэс/iu);
    return match ? `МЭС ${match[1]}` : "МЭС";
  }
  if (low.includes("вмп") || low.includes("группа")) {
    const tariff = (compact.match(/(?:вмп\D*)(\d+)/iu) || compact.match(/\((\d+)\)/u) || compact.match(/\b(200|300)\b/u))?.[1] || "";
    const group = (compact.match(/группа\s*(\d+)/iu) || compact.match(/групп[аы]\s*(\d+)/iu))?.[1] || "";
    if (tariff && group) return `ВМП ${tariff} (Группа ${group})`;
    if (tariff) return `ВМП ${tariff}`;
    if (group) return `ВМП (Группа ${group})`;
    return "ВМП";
  }
  return compact;
};

const getFundingType = (page) => {
  const raw = String(page?.["Группа ВМП"] || "").toLowerCase();
  if (!raw) return "ОМС";
  if (raw.includes("пму")) return "ПМУ";
  if (raw.includes("300")) return "ВМП300";
  if (raw.includes("200")) return "ВМП200";
  if (raw.includes("вмп")) return "ВМП200";
  return "ОМС";
};

const getSearchStateAfterInput = ({ query = "", activeFilterPreset = "all" } = {}) => {
  const nextQuery = String(query || "");
  return {
    query: nextQuery,
    activeFilterPreset: nextQuery.trim() ? "all" : activeFilterPreset
  };
};

const applyDateSelectionPatch = ({ existing = [], selected = [], mode = "add" } = {}) => {
  const set = new Set(Array.isArray(existing) ? existing.filter(Boolean) : []);
  (Array.isArray(selected) ? selected : []).forEach(iso => {
    if (!iso) return;
    if (mode === "remove") set.delete(iso);
    else set.add(iso);
  });
  return Array.from(set).sort();
};

const sanitizeFileName = (name) => String(name || "").replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, " ").trim();

const normalizeLabDateKey = (raw, dateParser = null) => {
  if (raw === null || raw === undefined || raw === "") return "";
  const readDateObject = (value) => {
    try {
      if (value?.toFormat) return value.toFormat("yyyy-MM-dd");
      if (value?.toISODate) return value.toISODate();
    } catch (error) {
      return "";
    }
    return "";
  };
  if (typeof dateParser === "function") {
    try {
      const parsed = dateParser(raw);
      const parsedString = typeof parsed === "string" ? parsed : readDateObject(parsed);
      if (parsedString) return parsedString;
    } catch (error) { }
  }
  const objectString = readDateObject(raw);
  if (objectString) return objectString;
  const s = String(raw);
  const m = s.match(/\d{4}-\d{2}-\d{2}/);
  return m ? m[0] : s;
};

const yearsWord = (value) => {
  const ageMod100 = Math.abs(Number(value) || 0) % 100;
  const ageMod10 = ageMod100 % 10;
  if (ageMod100 > 10 && ageMod100 < 20) return "лет";
  if (ageMod10 > 1 && ageMod10 < 5) return "года";
  if (ageMod10 === 1) return "год";
  return "лет";
};

const parseIsoDateParts = (iso) => {
  const match = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/u);
  if (!match) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3])
  };
};

const calcAgeFromDobIso = (dobIso, todayIso) => {
  const dob = parseIsoDateParts(dobIso);
  const today = parseIsoDateParts(todayIso || new Date().toISOString().slice(0, 10));
  if (!dob || !today) return null;
  let age = today.year - dob.year;
  if (today.month < dob.month || (today.month === dob.month && today.day < dob.day)) age -= 1;
  return age >= 0 ? age : null;
};

const fundMarkFromGroup = (raw) => {
  const source = String(raw || "").toLowerCase();
  if (source.includes("мэс")) return "М";
  if (source.includes("омс")) return "О";
  if (source.includes("вмп") || source.includes("группа")) return "В";
  if (source.includes("дмс")) return "Д";
  if (source.includes("пму")) return "П";
  return "";
};

const buildPatientFileBaseName = ({ fio, dobIso, mkb10, vmpGroup, todayIso } = {}) => {
  const fioClean = sanitizeFileName(fio);
  const mkbClean = String(mkb10 || "").toUpperCase().replace(/\s+/g, "").replace(/[^A-ZА-Я0-9.\-]/g, "");
  const groupClean = String(vmpGroup || "").trim();
  const age = calcAgeFromDobIso(dobIso, todayIso);
  if (!fioClean || !mkbClean || !groupClean || age === null) return null;
  const mark = fundMarkFromGroup(groupClean);
  return sanitizeFileName(`${mkbClean}${mark} ${fioClean}, ${age} ${yearsWord(age)}`);
};

const matchPreset = (text, presetId) => {
  const source = String(text || "");
  if (presetId === "all") return true;
  if (presetId === "ds") return /(?:^|\s)дс(?:\s|$)|дневн/i.test(source);
  if (presetId === "ks") return /(?:^|\s)кс(?:\s|$)|круглосуточ/i.test(source);
  if (presetId === "eln") return /элн|больнич/i.test(source);
  if (presetId === "vk") return /(?:^|[^а-яa-z])вк(?:[^а-яa-z]|$)|продление элн/i.test(source);
  if (presetId === "overdue") return /проср|задержк|сегодня выписка/i.test(source);
  if (presetId === "contour") return /оконтур|контур/i.test(source);
  if (presetId === "markup") return /разметк|переразмет/i.test(source);
  if (presetId === "consult") return /консультац|мкб|снилс/i.test(source);
  if (presetId === "hlt") return /хлт|химиолуч|радиомодиф/i.test(source);
  if (presetId === "fraction_today") return /фракция сегодня/i.test(source);
  return true;
};

const getCardFilterText = (card) => `${String(card?.textContent || "")} ${String(card?.dataset?.filterHints || "")}`.toLowerCase();

const presetAllowsCard = (card, presetId) => {
  const consultOnly = card?.dataset?.consultFilterOnly === "1";
  const excludeConsult = card?.dataset?.excludeConsultFilter === "1";
  const vkCard = card?.dataset?.vkReminderCard === "1";
  if (consultOnly && presetId !== "consult") return false;
  if (presetId === "consult" && excludeConsult) return false;
  if (presetId === "vk" && !vkCard) return false;
  if (presetId === "fraction_today" && card?.dataset?.todayFraction !== "1") return false;
  return true;
};

const cardMatchesFilter = (card, presetId, query = "", isFiltering = true) => {
  const text = getCardFilterText(card);
  const futureReminderCard = card?.dataset?.futureReminderCard === "1";
  if (!presetAllowsCard(card, presetId)) return false;
  if (!isFiltering && futureReminderCard) return false;
  if (query && !text.includes(query)) return false;
  if (!matchPreset(text, presetId)) return false;
  if (card?.classList?.contains?.("rdt-search-only-card") && query === "") return false;
  return true;
};

const getCardDedupeKey = (card) => {
  const path = String(card?.dataset?.path || "").trim().toLowerCase();
  if (path) return `path:${path}`;
  const href = String(card?.querySelector?.("a.internal-link")?.getAttribute?.("href") || "").trim().toLowerCase();
  if (href) return `href:${href}`;
  const name = String(card?.querySelector?.(".rdt-card-name")?.textContent || "").replace(/\s+/g, " ").trim().toLowerCase();
  if (name) return `name:${name}`;
  const text = String(card?.textContent || "").replace(/\s+/g, " ").trim().toLowerCase();
  return text ? `text:${text.slice(0, 180)}` : "";
};

const calcPercentMarkupByWorkDays = (workDaysToTarget) => {
  const days = Number(workDaysToTarget);
  if (!Number.isFinite(days)) return 0;
  if (days <= 0) return 100;
  return Math.max(15, Math.round((1 - (days / 5)) * 100));
};

const calcPercentContourProgress = ({ isBeforeOrOnMark = false, totalWorkDays = 0, passedWorkDays = 0 } = {}) => {
  if (isBeforeOrOnMark) return 15;
  const total = Number(totalWorkDays);
  const passed = Number(passedWorkDays);
  if (!Number.isFinite(total) || !Number.isFinite(passed)) return 0;
  if (total <= 0) return 100;
  return Math.max(15, Math.min(100, Math.round((passed / total) * 100)));
};

const calcPercentWaitingProgress = ({ hasMark = false, totalWorkDays = 0, passedWorkDays = 0, workDaysToStart = 0 } = {}) => {
  if (hasMark) {
    const total = Number(totalWorkDays);
    const passed = Number(passedWorkDays);
    if (!Number.isFinite(total) || !Number.isFinite(passed)) return 0;
    if (total <= 0) return 100;
    if (passed <= 0) return 0;
    return Math.max(0, Math.min(100, Math.round((passed / total) * 100)));
  }
  const days = Number(workDaysToStart);
  if (!Number.isFinite(days)) return 0;
  if (days <= 0) return 100;
  return Math.max(0, Math.min(100, Math.round((1 - (days / 5)) * 100)));
};

const isOnTreatmentDateIso = ({ startIso = "", endIso = "", dayIso = "" } = {}) => {
  if (!startIso || !dayIso) return false;
  return startIso <= dayIso && (!endIso || endIso >= dayIso);
};

const dateParts = (value) => {
  if (!value) return null;
  if (Number.isFinite(value.year) && Number.isFinite(value.month) && Number.isFinite(value.day)) {
    return { year: Number(value.year), month: Number(value.month), day: Number(value.day) };
  }
  return parseIsoDateParts(value);
};

const formatRuDate = (value) => {
  if (!value) return "—";
  if (typeof value?.toFormat === "function") return value.toFormat("dd.MM.yyyy");
  const parts = dateParts(value);
  if (!parts) return "—";
  return `${String(parts.day).padStart(2, "0")}.${String(parts.month).padStart(2, "0")}.${String(parts.year).padStart(4, "0")}`;
};

const ageFromDateParts = (dob, today) => {
  if (!dob || !today) return null;
  let age = today.year - dob.year;
  if (today.month < dob.month || (today.month === dob.month && today.day < dob.day)) age -= 1;
  return age >= 0 ? age : null;
};

const commaNumber = (value) => (typeof value === "number" ? value.toString() : String(value)).replace(".", ",");
const decimalsOf = (value) => {
  const source = String(value ?? "").replace(",", ".");
  const match = source.match(/\.(\d+)/u);
  return match ? match[1].length : 0;
};
const formatDoseNumber = (value, decimals = 1) => commaNumber(Number(value).toFixed(decimals));
const parseDoseNumber = (value) => Number(String(value ?? "").replace(",", ".")) || 0;

const buildPrescriptionText = (page, {
  todayIso = new Date().toISOString().slice(0, 10),
  normalizeConn = (raw) => String(raw || "")
} = {}) => {
  const fio = String(page?.ФИО ?? "ФИО не указано");
  const dobParts = dateParts(page?.Дата_рождения);
  const todayParts = dateParts(todayIso);
  const dobStr = formatRuDate(page?.Дата_рождения);
  const age = ageFromDateParts(dobParts, todayParts);
  const ageText = age === null ? "—" : age;
  const diagnosis = String(page?.Диагноз ?? "—").replace(/(\r\n|\n|\r)/gm, " ").trim();
  const frac1 = Number(page?.Количество_фракций) || 0;
  const rod1 = parseDoseNumber(page?.РОД);
  const extraVolumes = Array.isArray(page?.Объёмы) ? page.Объёмы.filter(item => item && typeof item === "object") : [];
  const connectionHeaders = {
    "Последовательный буст": "Последовательный буст",
    "Одновременно": "Синхронный интегрированный буст",
    "Параллельно": "Параллельно",
    "Последовательно": "Последовательно"
  };
  const doseOut = [];

  if (extraVolumes.length === 0) {
    if (frac1 > 0 && rod1 > 0) {
      const decimals = Math.max(1, decimalsOf(page?.РОД));
      doseOut.push({
        type: "line",
        text: `${page?.Название_PTV || "PTV"} — ${frac1} фр. по ${formatDoseNumber(rod1, decimals)} Гр (СД ${formatDoseNumber(rod1 * frac1, decimals)} Гр)`
      });
    }
  } else {
    const decimals1 = Math.max(1, decimalsOf(page?.РОД));
    const sd1 = frac1 * rod1;
    if (frac1 > 0 && rod1 > 0) {
      doseOut.push({
        type: "line",
        text: `${page?.Название_PTV || "PTV1"} — ${frac1} фр. по ${formatDoseNumber(rod1, decimals1)} Гр (СД ${formatDoseNumber(sd1, decimals1)} Гр)`
      });
      const firstConn = normalizeConn(extraVolumes[0].Связь || "");
      if (connectionHeaders[firstConn]) doseOut.push({ type: "header", text: connectionHeaders[firstConn] });
    }

    let cumulativeDose = sd1;
    let prevConn = null;
    extraVolumes.forEach((volume, index) => {
      const conn = normalizeConn(volume.Связь || "");
      const fracN = conn === "Одновременно" ? frac1 : Number(volume.Количество_фракций);
      const rodN = parseDoseNumber(volume.РОД);
      if (!fracN || !rodN) return;
      const decimalsN = Math.max(1, decimalsOf(volume.РОД));
      const sdN = rodN * fracN;
      if (prevConn !== null && conn !== prevConn && connectionHeaders[conn]) doseOut.push({ type: "header", text: connectionHeaders[conn] });
      if (conn === "Последовательный буст") cumulativeDose += sdN;
      doseOut.push({
        type: "line",
        text: `${volume.Название || `PTV${index + 2}`} — ${fracN} фр. по ${formatDoseNumber(rodN, decimalsN)} Гр (СД ${formatDoseNumber(conn === "Последовательный буст" ? cumulativeDose : sdN, decimalsN)} Гр)`
      });
      prevConn = conn;
    });
  }

  const areas = [];
  if (page?.Область_облучения) areas.push(page.Область_облучения);
  extraVolumes.forEach(volume => { if (volume.Область_облучения) areas.push(volume.Область_облучения); });
  const thirdLine = `${page?.Цель_лечения ? `${page.Цель_лечения}. ` : ""}${areas.length ? `Объемы: ${areas.join("; ")}` : ""}`;
  const acceleratorLine = page?.Ускоритель ? `Ускоритель: ${page.Ускоритель}` : "";
  const chemoDrugs = (() => {
    const raw = page?.ХЛТ_препараты;
    if (Array.isArray(raw) && raw.length > 0) return raw.filter(Boolean);
    if (page?.Радиомодификация) return [{ Препарат: String(page.Радиомодификация), Режим: page?.ХЛТ_режим || "" }];
    return [];
  })();
  const chemoLine = chemoDrugs.length > 0
    ? `ХЛТ: ${chemoDrugs.map(item => `${String(item?.Препарат ?? "").trim()} ${String(item?.Режим ?? "").toLowerCase()}`.trim()).join(" + ")}`
    : "";
  const startStr = formatRuDate(page?.Дата_начала_лечения);
  const tags = getTagList(page);
  let statusLine = "";
  if (tags.includes("дс")) statusLine = "Дневной стационар.";
  else if (tags.includes("кс")) statusLine = "Круглосуточный стационар.";
  const funding = getPrescriptionFundingLabel(page?.["Группа ВМП"]);
  const fundingLine = funding ? `Финансирование: ${funding}` : "";
  const lineItems = doseOut.filter(item => item.type === "line");
  const doseCopy = doseOut.map(item => {
    if (item.type === "header") return `${item.text}:`;
    return `${item.text}${lineItems.indexOf(item) === lineItems.length - 1 ? "." : ";"}`;
  }).join("\n");

  return [
    `${fio}, ${ageText} лет, ${dobStr}`,
    diagnosis,
    thirdLine,
    acceleratorLine || null,
    chemoLine || null,
    doseCopy,
    `Старт: ${startStr}`,
    statusLine,
    fundingLine
  ].filter(Boolean).join("\n\n");
};

const getModelStats = (models = [], todayIso = "") => {
  const stats = { active: 0, waiting: 0, admitting: 0, discharging: 0 };
  models.forEach(model => {
    const startIso = String(model?.startIso || "");
    const endIso = String(model?.endIso || "");
    if (startIso && startIso <= todayIso && (!endIso || endIso >= todayIso)) stats.active += 1;
    if (!startIso || startIso > todayIso) stats.waiting += 1;
    if (startIso === todayIso) stats.admitting += 1;
    if (endIso === todayIso) stats.discharging += 1;
  });
  return stats;
};

const countItems = (items = []) => (Array.isArray(items) ? items.length : 0);

const getDesktopTabCounts = ({
  activeReminderCount = 0,
  consultations = [],
  starts = [],
  ends = [],
  contourPlan = [],
  markups = [],
  reMarkups = [],
  overdueReMarkups = [],
  overdueAdmissions = [],
  elnVkItems = [],
  reContours = [],
  listMarkup = [],
  listReMarkup = [],
  listContour = [],
  listWaiting = [],
  listTreatment = [],
  dischargeData = []
} = {}) => {
  const startsWithoutHospitalization = (Array.isArray(starts) ? starts : [])
    .filter(item => !item?.p?.Госпитализация).length;
  const activeMarkups = (Array.isArray(markups) ? markups : [])
    .filter(page => !page?.Разметка).length;
  return {
    operativka: (Number(activeReminderCount) || 0)
      + countItems(consultations)
      + startsWithoutHospitalization
      + countItems(ends)
      + countItems(contourPlan)
      + activeMarkups
      + countItems(reMarkups)
      + countItems(overdueReMarkups)
      + countItems(overdueAdmissions)
      + countItems(elnVkItems)
      + countItems(reContours),
    planning: countItems(listMarkup) + countItems(listReMarkup) + countItems(listContour) + countItems(listWaiting) + countItems(reContours),
    treatment: countItems(listTreatment),
    discharge: countItems(dischargeData)
  };
};

const getSearchOnlyStatus = (path) => String(path || "").includes("Выписаны/") ? "discharged" : "not_started";

const getPlanningStatuses = (page, model = {}) => {
  const statuses = [];
  const hospitalized = page?.Госпитализация === true;
  if (hospitalized) statuses.push("treatment");
  if (hospitalized && model?.hasRemarkDate === true && page?.Переразметка !== true) {
    statuses.push("remarkup");
    return statuses;
  }
  if (!hospitalized && page?.Оконтуривание === true) statuses.push("waiting");
  else if (!hospitalized && page?.Разметка === true) statuses.push("contour");
  else if (!hospitalized && model?.hasMark === true) statuses.push("markup");
  return statuses;
};

const getTreatmentBucket = (model = {}, dayIso = "") => {
  const onTreatment = isOnTreatmentDateIso({
    startIso: model?.startIso || "",
    endIso: model?.endIso || "",
    dayIso
  });
  if (!onTreatment) return "other";
  return model?.hasFractionToday === true ? "fraction_today" : "break_today";
};

const isPlannedDischarge = ({ endIso = "", todayIso = "", limitIso = "" } = {}) => !!(
  endIso
  && todayIso
  && limitIso
  && endIso > todayIso
  && endIso <= limitIso
);

const isRecentDischarge = ({ dateIso = "", startIso = "", todayIso = "" } = {}) => !!(
  dateIso
  && startIso
  && todayIso
  && dateIso >= startIso
  && dateIso <= todayIso
);

const parseLegacyConsultOrder = (name, targetDay) => {
  const match = String(name || "").match(/^(\d+)\.(\d+)/u);
  if (!match) return null;
  if (Number(match[1]) !== Number(targetDay)) return null;
  const order = Number(match[2]);
  return Number.isFinite(order) && order > 0 ? order : null;
};

const getAgeLabel = (dobIso, referenceIso) => {
  const age = calcAgeFromDobIso(dobIso, referenceIso);
  return age === null ? "" : `${age} лет`;
};

const getLegacyConsultTime = (legacyOrder) => {
  const order = Number(legacyOrder);
  if (!Number.isFinite(order) || order <= 0) return { sortMinutes: 24 * 60, time: "—" };
  const sortMinutes = 9 * 60 + (order - 1) * 30;
  return {
    sortMinutes,
    time: `${Math.floor(sortMinutes / 60)}:${String(sortMinutes % 60).padStart(2, "0")}`
  };
};

const getConsultSort = ({ hour = null, minute = null, legacyOrder = null } = {}) => {
  if (Number.isFinite(hour) && Number.isFinite(minute)) {
    return { sortMinutes: hour * 60 + minute, time: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}` };
  }
  return getLegacyConsultTime(legacyOrder);
};

const cleanConsultationFileName = (name) => {
  const source = String(name || "");
  const clean = source
    .replace(/^\d+\.\d+\s*/u, "")
    .replace(/^[^\p{L}\p{N}]+/u, "")
    .trim();
  return clean || source;
};

const getConsultationIdentity = ({ fio = "", fileName = "", mkb10 = "", ageLabel = "" } = {}) => {
  const safeFio = String(fio || fileName || "");
  const mkb = String(mkb10 || "—");
  return {
    fio: safeFio,
    mkb,
    displayName: `${mkb} ${safeFio}, ${String(ageLabel || "")}`
  };
};

const compareTodayConsultations = (a = {}, b = {}) => (
  ((Number(a.sortMinutes) || 0) - (Number(b.sortMinutes) || 0))
  || ((Number(a.legacyOrder) || 0) - (Number(b.legacyOrder) || 0))
  || String(a.fio || "").localeCompare(String(b.fio || ""), "ru")
);

const compareScheduledConsultations = (a = {}, b = {}) => (
  ((Number(a.sortMillis) || 0) - (Number(b.sortMillis) || 0))
  || String(a.fio || "").localeCompare(String(b.fio || ""), "ru")
);

const getContourPlan = (items = [], { plannedLimit = 2 } = {}) => {
  const overdue = [];
  const urgent = [];
  const planned = [];
  items.forEach(item => {
    const hasDeadline = !!item?.contourDeadlineIso;
    if (hasDeadline && item.contourDeadlineIso < item.todayIso) overdue.push({ ...item.source, isOverdue: true });
    else if (hasDeadline && Number(item.workDaysToDeadline) <= 1) urgent.push({ ...item.source, isOverdue: false });
    else planned.push({ ...item.source, isOverdue: false });
  });
  return [
    ...overdue,
    ...urgent,
    ...planned.slice(0, plannedLimit)
  ];
};

const getAdmissionPlan = (items = []) => {
  const overdue = [];
  const today = [];
  items.forEach(item => {
    if (item?.hospitalized === true || item?.contoured !== true || !item?.startIso) return;
    if (item.startIso < item.todayIso) overdue.push({ ...item.source, isOverdue: true });
    else if (item.startIso === item.todayIso) today.push({ ...item.source, isOverdue: false });
  });
  return [...overdue, ...today];
};

const splitVkItems = (items = [], todayIso = "") => {
  const todayItems = [];
  const overdueItems = [];
  items.forEach(item => {
    const dates = Array.isArray(item?.dateIsos) ? item.dateIsos : [];
    dates.forEach(dateIso => {
      if (dateIso === todayIso) todayItems.push({ p: item.p, dateIso });
      else if (dateIso && dateIso < todayIso) overdueItems.push({ p: item.p, dateIso });
    });
  });
  return { todayItems, overdueItems };
};

const resolveTreatmentStartIso = ({ startIso = "", manualDateIsos = [] } = {}) => {
  if (startIso) return startIso;
  const sorted = (Array.isArray(manualDateIsos) ? manualDateIsos : [])
    .map(value => String(value || ""))
    .filter(Boolean)
    .sort();
  return sorted[0] || "";
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

const isOverdueTreatmentEnd = ({ endIso = "", todayIso = "", hospitalized = false } = {}) => (
  !!endIso && !!todayIso && endIso < todayIso && hospitalized === true
);

const isOverdueInitialMarkup = ({
  markIso = "",
  todayIso = "",
  markupDone = false,
  hospitalized = false
} = {}) => (
  !!markIso && !!todayIso && markIso < todayIso && markupDone !== true && hospitalized !== true
);

const isTodayModelStart = ({ startIso = "", todayIso = "" } = {}) => !!startIso && startIso === todayIso;

const isTodayModelEnd = ({ endIso = "", todayIso = "" } = {}) => !!endIso && endIso === todayIso;

const isTodayMarkup = ({ markIso = "", todayIso = "" } = {}) => !!markIso && markIso === todayIso;

const isTodayRemarkup = ({
  hospitalized = false,
  remarkIso = "",
  remarkupDone = false,
  todayIso = ""
} = {}) => hospitalized === true && !!remarkIso && remarkIso === todayIso && remarkupDone !== true;

const isOverdueRemarkup = ({
  hospitalized = false,
  remarkIso = "",
  remarkupDone = false,
  todayIso = ""
} = {}) => hospitalized === true && !!remarkIso && !!todayIso && remarkIso < todayIso && remarkupDone !== true;

const normalizeTagList = (tags = []) => (Array.isArray(tags) ? tags : [])
  .map(tag => String(tag || "").toLowerCase());

const hasActiveVkReminder = (reminders = []) => (Array.isArray(reminders) ? reminders : [])
  .some(reminder => String(reminder?.текст || "").includes("ВК") && reminder?.выполнено !== true);

const parseHospitalizationSickAction = (actionType = "") => {
  const value = String(actionType || "");
  if (!value.startsWith("HOSPITALIZATION_SICK|")) {
    return { isHospitalizationSick: false, admissionDateRaw: "", showVkBtn: false };
  }
  const parts = value.split("|");
  return {
    isHospitalizationSick: true,
    admissionDateRaw: parts[1] || "",
    showVkBtn: parts[2] === "SHOW_VK_BTN"
  };
};

const parseRemoveVkAction = (actionType = "") => {
  const value = String(actionType || "");
  if (!value.startsWith("REMOVE_VK|")) return { isRemoveVk: false, dateIso: "" };
  return {
    isRemoveVk: true,
    dateIso: value.split("|")[1] || ""
  };
};

const removeIsoFromDateList = (value, targetIso = "", toIso = null) => {
  const list = Array.isArray(value) ? value : (value ? [value] : []);
  if (!targetIso || list.length === 0) return list.length ? list : null;
  const normalize = typeof toIso === "function"
    ? toIso
    : (item) => String(item || "").slice(0, 10);
  const next = list.filter(item => normalize(item) !== targetIso);
  return next.length ? next : null;
};

const getActionIconKey = (actionType = "") => (actionType === "MOVE" ? "move" : "check");

const getDischargeSubText = ({ isSick = false, vmpGroup = "" } = {}) => {
  const subParts = [];
  if (isSick) subParts.push("<b>ЭЛН:</b> Есть");
  if (vmpGroup) subParts.push(`<b>ВМП:</b> ${vmpGroup}`);
  return subParts.join(" | ");
};

const getDischargeCardMeta = ({
  tags = [],
  isSick = false,
  vmpGroup = "",
  overdue = false
} = {}) => {
  const lowerTags = normalizeTagList(tags);
  const hasKs = lowerTags.some(tag => tag.includes("кс"));
  const hasDs = lowerTags.some(tag => tag.includes("дс"));
  if (overdue) {
    return {
      title: "",
      color: "#ff5252",
      borderStyle: hasKs ? "dashed" : "solid",
      sub: getDischargeSubText({ isSick, vmpGroup })
    };
  }
  if (hasKs) {
    return {
      title: "Выписка из круглосуточного стационара",
      color: "#ff5252",
      borderStyle: "dashed",
      sub: getDischargeSubText({ isSick, vmpGroup })
    };
  }
  if (hasDs) {
    return {
      title: "Выписка из дневного стационара",
      color: "#ff5252",
      borderStyle: "solid",
      sub: getDischargeSubText({ isSick, vmpGroup })
    };
  }
  return {
    title: "Выписка из стационара",
    color: "#2196f3",
    borderStyle: "solid",
    sub: getDischargeSubText({ isSick, vmpGroup })
  };
};

const getHospitalizationCardMeta = ({
  isOverdue = false,
  isSick = false,
  startIso = "",
  startLabel = "",
  overdueWorkDays = 0,
  snils = "",
  hasActiveVk = false
} = {}) => {
  const vkState = hasActiveVk ? "NO_BTN" : "SHOW_VK_BTN";
  if (isOverdue) {
    return {
      title: `<span style='color:#ff5252;font-weight:bold;'>Старт был: ${startLabel} · Проср. ${overdueWorkDays} раб.дн.</span>`,
      sub: "",
      color: "#ff5252",
      actionKey: isSick ? `HOSPITALIZATION_SICK|${startIso}|${vkState}` : "Госпитализация"
    };
  }
  if (isSick) {
    return {
      title: "<b>ЭЛН</b>",
      sub: snils ? `СНИЛС: ${snils}` : "",
      color: "#4caf50",
      actionKey: `HOSPITALIZATION_SICK|${startIso}|${vkState}`
    };
  }
  return {
    title: "Старт курса",
    sub: "",
    color: "#4caf50",
    actionKey: "Госпитализация"
  };
};

const getVkCardMeta = ({
  dateIso = "",
  dateLabel = "",
  isOverdue = false,
  overdueWorkDays = 0
} = {}) => ({
  title: "Продление ЭЛН",
  sub: isOverdue
    ? `<span style='color:#ff5252;font-weight:bold;'>Проср. ${overdueWorkDays} раб.дн. (${dateLabel})</span>`
    : "Требуется ВК",
  color: isOverdue ? "#ff5252" : "#ff9800",
  actionKey: `REMOVE_VK|${dateIso}`
});

const getInitialMarkupCardMeta = ({
  goal = "",
  isOverdue = false,
  overdueWorkDays = 0,
  markLabel = "",
  markTime = ""
} = {}) => ({
  action: "Разметка",
  title: goal || "Разметка",
  sub: isOverdue
    ? `<span style='color:#ff5252;font-weight:bold;'>Проср. ${overdueWorkDays} раб.дн. (${markLabel || "—"})</span>`
    : (markTime || "—"),
  color: isOverdue ? "#ff5252" : "#ab47bc"
});

const getRemarkupCardMeta = ({
  isOverdue = false,
  overdueDays = 0,
  dateTimeLabel = "",
  timeLabel = ""
} = {}) => ({
  action: "Переразметка",
  title: "Переразметка",
  sub: isOverdue
    ? `<span style='color:#ff5252;font-weight:bold;'>Просрочено ${overdueDays} дн.</span>${dateTimeLabel ? ` (${dateTimeLabel})` : ""}`
    : (timeLabel || "—"),
  color: isOverdue ? "#ff5252" : "#e65100"
});

const splitMarkupCards = (cards = []) => {
  const sortByValue = (a, b) => ((Number(a?.sortVal) || 0) - (Number(b?.sortVal) || 0));
  const source = Array.isArray(cards) ? cards : [];
  return {
    initial: source.filter(card => card?.action === "Разметка").sort(sortByValue),
    repeat: source.filter(card => card?.action === "Переразметка").sort(sortByValue)
  };
};

const getDeadlineDisplay = ({ workDaysLeft = null, defaultColor = "#42a5f5" } = {}) => {
  if (workDaysLeft === null || workDaysLeft === undefined || !Number.isFinite(Number(workDaysLeft))) {
    return { color: defaultColor, daysText: "—" };
  }
  const days = Number(workDaysLeft);
  if (days < 0) return { color: "#ff5252", daysText: `Проср. ${Math.abs(days)} дн.` };
  if (days === 0) return { color: "#e65100", daysText: "Сегодня" };
  if (days === 1) return { color: "#e65100", daysText: "1 дн." };
  return { color: defaultColor, daysText: `${days} дн.` };
};

const getContourCardMeta = ({
  title = "Оконтурить",
  datePrefix = "",
  dateLabel = "—",
  workDaysLeft = null,
  defaultColor = "#42a5f5"
} = {}) => {
  const display = getDeadlineDisplay({ workDaysLeft, defaultColor });
  return {
    title,
    sub: `${datePrefix}${dateLabel || "—"} <b style='color:${display.color}'>(${display.daysText})</b>`,
    color: display.color,
    action: "Оконтуривание"
  };
};

const getSearchOnlyCardMeta = ({
  status = "",
  dischargeDateLabel = "",
  consultDateLabel = "",
  mkb10 = ""
} = {}) => {
  const isDischarged = status === "discharged";
  let subTitle = "—";
  if (isDischarged && dischargeDateLabel) {
    subTitle = dischargeDateLabel;
  } else if (!isDischarged && consultDateLabel) {
    subTitle = `${consultDateLabel}${mkb10 ? ` (${mkb10})` : ""}`;
  }
  return {
    title: isDischarged ? "Выписан" : "Консультация (Не начал)",
    subTitle,
    color: isDischarged ? "#4caf50" : "#ff9800"
  };
};

const getReminderCardMeta = ({
  reminderText = "",
  dateIso = "",
  todayIso = "",
  overdueWorkDays = 0
} = {}) => {
  const isPast = !!dateIso && !!todayIso && dateIso < todayIso;
  const isToday = !!dateIso && !!todayIso && dateIso === todayIso;
  const isFuture = !!dateIso && !!todayIso && dateIso > todayIso;
  const textLower = String(reminderText || "").toLowerCase();
  const isVkReminder = reminderHasVk(textLower);
  return {
    color: isPast ? "#f44336" : (isToday ? "#ff9800" : "#2196f3"),
    statusText: isPast ? `Проср. ${Math.abs(Number(overdueWorkDays) || 0)} дн.` : "",
    isPast,
    isToday,
    isFuture,
    isVkReminder,
    isVkEln: isVkReminder && textLower.includes("элн")
  };
};

const getReminderCardState = ({
  patientPath = "",
  filterHints = "",
  reminderText = "",
  dateIso = "",
  todayIso = "",
  overdueWorkDays = 0
} = {}) => {
  const meta = getReminderCardMeta({ reminderText, dateIso, todayIso, overdueWorkDays });
  return {
    ...meta,
    hidden: meta.isFuture,
    dataset: {
      filterHints: String(filterHints || ""),
      path: String(patientPath || ""),
      vkReminderCard: meta.isVkReminder ? "1" : "0",
      futureReminderCard: meta.isFuture ? "1" : "0"
    }
  };
};

const getDueReminderCount = (items = [], todayIso = "", toIso = null) => {
  if (!todayIso) return 0;
  const normalize = typeof toIso === "function"
    ? toIso
    : (item) => String(item?.dateIso || item?.date || "").slice(0, 10);
  return (Array.isArray(items) ? items : [])
    .filter(item => {
      const iso = normalize(item);
      return !!iso && iso <= todayIso;
    }).length;
};

const getOverdueConsultationCardMeta = ({
  name = "",
  snils = "",
  dateShortLabel = "",
  dateLabel = "",
  overdueWorkDays = 0
} = {}) => {
  const snilsInfo = snils ? `СНИЛС: ${snils}` : "";
  return {
    name,
    title: `<span style='color:#ff5252;font-weight:bold;'>Не проведена ${dateShortLabel} · Проср. ${overdueWorkDays} раб.дн.</span>`,
    sub: snilsInfo,
    color: "#ff5252",
    action: "CONSULTATION",
    borderStyle: "solid",
    filterHints: `consult консультация ${snilsInfo} ${dateLabel}`,
    options: { excludeConsultFilter: true }
  };
};

const getTodayConsultationCardMeta = ({
  displayTitle = "",
  time = "—",
  snils = "",
  hasConsultField = false
} = {}) => {
  const snilsInfo = snils ? ` | СНИЛС: ${snils}` : "";
  return {
    title: displayTitle,
    sub: `${time}${snilsInfo}`,
    color: "#9e9e9e",
    action: "CONSULTATION",
    borderStyle: "solid",
    filterHints: `consult консультация ${displayTitle} ${time} ${snilsInfo}`,
    options: { excludeConsultFilter: hasConsultField === true }
  };
};

const getScheduledConsultationCardMeta = ({
  displayTitle = "",
  dateIso = "",
  todayIso = "",
  dateLabel = "",
  dateTimeLabel = "",
  time = "—",
  snils = "",
  source = ""
} = {}) => {
  const sub = [
    time || "—",
    snils ? `СНИЛС: ${snils}` : "",
    source === "patients_folder" ? "из Пациенты" : "из Консультации"
  ].filter(Boolean).join(" · ");
  return {
    title: displayTitle,
    heading: `Дата консультации: ${dateLabel}`,
    sub,
    color: dateIso < todayIso ? "#ff5252" : (dateIso === todayIso ? "#ff9800" : "#9e9e9e"),
    action: "CONSULTATION",
    borderStyle: "solid",
    filterHints: `consult консультация ${displayTitle} ${dateTimeLabel} ${sub}`,
    options: { consultFilterOnly: true }
  };
};

const getActiveReminders = (reminders = []) => (Array.isArray(reminders) ? reminders : [])
  .filter(reminder => reminder && reminder.дата && reminder.текст && reminder.выполнено !== true);

const getActiveReminderCount = (reminders = []) => getActiveReminders(reminders).length;

const hasActiveReminders = (reminders = []) => getActiveReminderCount(reminders) > 0;

const getReminderBellColor = (reminders = []) => (
  hasActiveReminders(reminders) ? "#ff9800" : "var(--text-muted)"
);

const findActiveReminderIndex = (reminders = [], activeIndex = 0) => {
  const source = Array.isArray(reminders) ? reminders : [];
  let seen = 0;
  for (let i = 0; i < source.length; i += 1) {
    const reminder = source[i];
    if (reminder && reminder.дата && reminder.текст && reminder.выполнено !== true) {
      if (seen === activeIndex) return i;
      seen += 1;
    }
  }
  return -1;
};

const findActiveReminderValueIndex = (reminders = [], target = {}) => {
  const source = Array.isArray(reminders) ? reminders : [];
  for (let i = 0; i < source.length; i += 1) {
    const reminder = source[i];
    if (
      reminder
      && reminder.дата
      && reminder.текст
      && reminder.выполнено !== true
      && String(reminder.дата) === String(target?.дата)
      && String(reminder.текст) === String(target?.текст)
    ) {
      return i;
    }
  }
  return -1;
};

const getMissingDateWarnings = ({
  hasMarkupDate = false,
  hasTreatmentStartDate = false
} = {}) => {
  const warnings = [];
  if (!hasMarkupDate) warnings.push("нет даты разметки");
  if (!hasTreatmentStartDate) warnings.push("нет даты начала лечения");
  return warnings;
};

const getMissingDateWarningText = (state = {}) => getMissingDateWarnings(state).join(", ");

const getTreatmentStageMeta = ({
  frac = 0,
  currFrac = 0,
  totalFrac = 0,
  totalCurrFrac = null,
  endIso = "",
  todayIso = "",
  endWeekday = 0,
  dayPhrases = {}
} = {}) => {
  const safeTotalFrac = Number(totalFrac || frac || 0);
  const safeTotalCurrFrac = totalCurrFrac === null || totalCurrFrac === undefined
    ? Number(currFrac || 0)
    : Number(totalCurrFrac || 0);
  const left = safeTotalFrac - safeTotalCurrFrac;
  const isToday = !!endIso && !!todayIso && endIso === todayIso;
  const isDelayed = !!endIso && !!todayIso && endIso < todayIso;
  let mainColor = "#4caf50";
  let warningKind = "";
  let warningText = "";
  let warningColor = "";
  let btnAction = null;

  if (isDelayed) {
    mainColor = "#ff5252";
    warningKind = "delayed";
    warningText = "Задержка";
    warningColor = "#ff5252";
    btnAction = "MOVE";
  } else if (isToday) {
    mainColor = "#ff5252";
    warningKind = "today";
    warningText = "Сегодня выписка";
    warningColor = "#ff5252";
    btnAction = "MOVE";
  } else if (left === 1) {
    const dayPhrase = dayPhrases[endWeekday] || "скоро";
    mainColor = "#ff9800";
    warningKind = "soon";
    warningText = `Выписка ${dayPhrase}`;
    warningColor = "#ff9800";
  }

  return {
    mainColor,
    totalFrac: safeTotalFrac,
    totalCurrFrac: safeTotalCurrFrac,
    left,
    statusText: `Фракции: ${safeTotalCurrFrac}/${safeTotalFrac}`,
    warningKind,
    warningText,
    warningColor,
    btnAction
  };
};

const STAGE_EMPTY_COLOR = "rgba(150,150,150,0.15)";

const getMarkupStageMeta = ({
  kind = "markup",
  dateIso = "",
  todayIso = "",
  dateLabel = "—",
  progressPct = 0
} = {}) => {
  const isRemarkup = kind === "remarkup";
  const mainColor = isRemarkup ? "#ef6c00" : "#ab47bc";
  const isOverdue = !!dateIso && !!todayIso && dateIso < todayIso;
  return {
    mainColor,
    statusText: isRemarkup ? "Переразметка" : "Разметка",
    statusKind: isRemarkup ? "remarkup" : "markup",
    dateLabel: dateLabel || "—",
    dateColor: isOverdue ? "#ff5252" : "",
    dotColor: isOverdue ? "#ff5252" : (isRemarkup ? "#ef6c00" : "#2196f3"),
    isOverdue,
    progressSegments: [
      { pct: Number(progressPct) || 0, color: mainColor },
      { pct: 0, color: STAGE_EMPTY_COLOR },
      { pct: 0, color: STAGE_EMPTY_COLOR }
    ],
    btnKey: isRemarkup ? "Переразметка" : "Разметка"
  };
};

const getContourStageMeta = ({
  kind = "contour",
  deadlineLabel = "—",
  workDaysLeft = null,
  progressPct = 0
} = {}) => {
  const isRecontour = kind === "recontour";
  const baseColor = isRecontour ? "#ef6c00" : "#42a5f5";
  let mainColor = baseColor;
  let textColor = baseColor;
  let textDays = workDaysLeft === null || workDaysLeft === undefined ? "—" : `${workDaysLeft} дн.`;
  if (workDaysLeft !== null && workDaysLeft !== undefined && Number(workDaysLeft) < 0) {
    mainColor = "#ff5252";
    textColor = "#ff5252";
    textDays = `Проср. ${Math.abs(Number(workDaysLeft))} дн.`;
  } else if (workDaysLeft !== null && workDaysLeft !== undefined && Number(workDaysLeft) <= 1) {
    mainColor = isRecontour ? "#ef6c00" : "#ff9800";
    textColor = mainColor;
    textDays = Number(workDaysLeft) === 0 ? "Сегодня" : `${workDaysLeft} дн.`;
  }
  return {
    mainColor,
    statusText: isRecontour ? "Переоконтуривание" : "Оконтуривание",
    statusKind: isRecontour ? "recontour" : "contour",
    deadlineLabel: deadlineLabel || "—",
    textColor,
    textDays,
    dotColor: isRecontour ? "#ef6c00" : "#9e9e9e",
    progressSegments: [
      { pct: 100, color: isRecontour ? "#ef6c00" : "#ab47bc" },
      { pct: Number(progressPct) || 0, color: mainColor },
      { pct: 0, color: STAGE_EMPTY_COLOR }
    ],
    btnKey: "Оконтуривание"
  };
};

const getWaitingStageMeta = ({
  startLabel = "—",
  workDaysLeft = 0,
  progressPct = 0
} = {}) => {
  const days = Number(workDaysLeft);
  const isDue = Number.isFinite(days) && days <= 0;
  return {
    mainColor: "#9e9e9e",
    statusText: "Ожидание",
    statusKind: "waiting",
    startLabel: startLabel || "—",
    textColor: isDue ? "#4caf50" : "var(--text-muted)",
    textDays: isDue ? "Сегодня" : `${workDaysLeft} дн.`,
    dotColor: "#4caf50",
    progressSegments: [
      { pct: 100, color: "#ab47bc" },
      { pct: 100, color: "#42a5f5" },
      { pct: Number(progressPct) || 0, color: "#4caf50" }
    ],
    btnKey: "Госпитализация"
  };
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const parseIsoDateUtc = (iso = "") => {
  const parts = parseIsoDateParts(iso);
  if (!parts) return null;
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
};

const toIsoDateUtc = (date) => date.toISOString().slice(0, 10);

const addDaysIso = (iso = "", days = 0) => {
  const date = parseIsoDateUtc(iso);
  if (!date) return "";
  date.setUTCDate(date.getUTCDate() + Number(days || 0));
  return toIsoDateUtc(date);
};

const diffDaysIso = (fromIso = "", toIso = "") => {
  const from = parseIsoDateUtc(fromIso);
  const to = parseIsoDateUtc(toIso);
  if (!from || !to) return 0;
  return Math.floor((to.getTime() - from.getTime()) / MS_PER_DAY);
};

const weekdayIso = (iso = "") => {
  const date = parseIsoDateUtc(iso);
  if (!date) return 0;
  const day = date.getUTCDay();
  return day === 0 ? 7 : day;
};

const shiftBackFromNonWorkingIso = (iso = "", holidays = []) => {
  const holidaySet = new Set((Array.isArray(holidays) ? holidays : []).map(value => String(value || "")));
  let current = String(iso || "");
  let safety = 0;
  while (current && safety < 10) {
    if (weekdayIso(current) > 5 || holidaySet.has(current)) current = addDaysIso(current, -1);
    else break;
    safety += 1;
  }
  return current;
};

const buildVkElnReminderPayload = ({
  admissionIso = "",
  selectedIso = "",
  todayIso = "",
  holidays = []
} = {}) => {
  if (!admissionIso || !selectedIso || !todayIso) return null;
  let targetIso = selectedIso;
  if (selectedIso === todayIso) {
    let baseIso = admissionIso;
    let daysToAdd = 14;
    if (admissionIso <= todayIso) {
      const diffDays = diffDaysIso(admissionIso, todayIso);
      if (diffDays > 5) {
        baseIso = todayIso;
        daysToAdd = 15;
      }
    }
    targetIso = shiftBackFromNonWorkingIso(addDaysIso(baseIso, daysToAdd), holidays);
  }
  const totalDays = diffDaysIso(admissionIso, targetIso) + 1;
  const admissionInFuture = admissionIso > todayIso;
  const passedDays = admissionInFuture ? 0 : diffDaysIso(admissionIso, todayIso) + 1;
  const addedDays = admissionInFuture ? totalDays : diffDaysIso(todayIso, targetIso);
  return {
    targetIso,
    reminderText: `Написать ВК по ЭЛН (Прошло: ${passedDays} + Доб: ${addedDays} = Итог: ${totalDays})`,
    passedDays,
    addedDays,
    totalDays
  };
};

const getNextVkElnReminderInfo = ({
  admissionIso = "",
  todayIso = "",
  holidays = []
} = {}) => {
  if (!todayIso) return { daysInHospLabel: "?", targetIso: "" };
  if (!admissionIso) {
    return {
      daysInHospLabel: "?",
      targetIso: shiftBackFromNonWorkingIso(addDaysIso(todayIso, 15), holidays)
    };
  }
  const daysInHosp = diffDaysIso(admissionIso, todayIso) + 1;
  let baseIso = admissionIso;
  let daysToAdd = 14;
  if (admissionIso <= todayIso && diffDaysIso(admissionIso, todayIso) > 5) {
    baseIso = todayIso;
    daysToAdd = 15;
  }
  return {
    daysInHospLabel: String(daysInHosp),
    targetIso: shiftBackFromNonWorkingIso(addDaysIso(baseIso, daysToAdd), holidays)
  };
};

const hasVkReminderOnDate = (reminders = [], targetIso = "", toIso = null) => {
  if (!targetIso) return false;
  const normalize = typeof toIso === "function"
    ? toIso
    : (value) => String(value || "").slice(0, 10);
  return (Array.isArray(reminders) ? reminders : []).some(reminder => {
    const reminderIso = normalize(reminder?.дата);
    return reminderIso === targetIso && String(reminder?.текст || "").includes("ВК");
  });
};

const getSortedActiveReminders = (reminders = []) => [...getActiveReminders(reminders)]
  .sort((a, b) => String(a?.дата || "").localeCompare(String(b?.дата || "")));

const getReminderRowMeta = ({
  dateIso = "",
  todayIso = "",
  dateLabel = ""
} = {}) => ({
  dateColor: dateIso && todayIso && dateIso < todayIso
    ? "#f44336"
    : (dateIso && todayIso && dateIso === todayIso ? "#ff9800" : "var(--text-muted)"),
  dateLabel: dateLabel || dateIso || "—"
});

const getPlannedDischargeTimingMeta = ({
  workDaysLeft = 0,
  endWeekday = 0,
  dayPhrases = {}
} = {}) => {
  if (Number(workDaysLeft) === 1) {
    const dayPhrase = dayPhrases[endWeekday] || "";
    return {
      daysText: dayPhrase ? `Выписка ${dayPhrase}` : "Выписка завтра",
      color: "#ff9800"
    };
  }
  return {
    daysText: `через ${workDaysLeft} раб. дн.`,
    color: "#4caf50"
  };
};

const getTreatmentMethodShort = (tags = []) => {
  const lowerTags = normalizeTagList(tags);
  if (lowerTags.some(tag => /sbrt|srt|srs/u.test(tag))) return "SBRT";
  if (lowerTags.some(tag => tag.includes("бфрт"))) return "БФРТ";
  return "ДЛТ";
};

const getInpatientShort = (tags = []) => {
  const lowerTags = normalizeTagList(tags);
  if (lowerTags.some(tag => tag.includes("кс"))) return "КС";
  if (lowerTags.some(tag => tag.includes("дс"))) return "ДС";
  return "";
};

const getPlannedDischargeCardMeta = ({
  title = "",
  fundingType = "",
  tags = [],
  currFrac = 0,
  frac = 0,
  doctor = "Глибичук Д.А.",
  dateLabel = "",
  copied = false,
  workDaysLeft = 0,
  endWeekday = 0,
  dayPhrases = {}
} = {}) => {
  const timing = getPlannedDischargeTimingMeta({ workDaysLeft, endWeekday, dayPhrases });
  const methodShort = getTreatmentMethodShort(tags);
  const inpatientShort = getInpatientShort(tags);
  const infos = [fundingType || "ОМС", methodShort, inpatientShort].filter(Boolean);
  return {
    title,
    dateLabel,
    daysText: timing.daysText,
    color: timing.color,
    fractionsLeft: (Number(frac) || 0) - (Number(currFrac) || 0),
    infos,
    methodShort,
    inpatientShort,
    copyString: `${title}\t\t${infos[0] || ""}\t${methodShort}\t${inpatientShort}\t${doctor}`,
    opacity: copied ? "0.8" : "1",
    bgFilter: copied ? "grayscale(0.3)" : "none"
  };
};

const getRecentDischargeCardMeta = ({
  title = "",
  fundingType = "",
  tags = [],
  dateLabel = "",
  workDaysAgo = 0
} = {}) => {
  const normalizedWorkDaysAgo = Number(workDaysAgo) || 0;
  const methodShort = getTreatmentMethodShort(tags);
  const inpatientShort = getInpatientShort(tags);
  const infos = [fundingType || "ОМС", methodShort, inpatientShort].filter(Boolean);
  return {
    title,
    dateLabel: dateLabel || "—",
    agoText: normalizedWorkDaysAgo === 0
      ? "сегодня"
      : (normalizedWorkDaysAgo === 1 ? "1 раб. дн. назад" : `${normalizedWorkDaysAgo} раб. дн. назад`),
    infos,
    methodShort,
    inpatientShort,
    color: "#607d8b"
  };
};

const getStageLabelHtml = (meta = {}, iconHtml = "") => {
  const statusKind = String(meta?.statusKind || "");
  const background = statusKind === "waiting"
    ? "rgba(158,158,158,0.13)"
    : (statusKind === "remarkup" || statusKind === "recontour"
      ? "rgba(239,108,0,0.13)"
      : (statusKind === "markup" ? "rgba(171,71,188,0.13)" : "rgba(66,165,245,0.13)"));
  const color = statusKind === "waiting" ? "var(--text-muted)" : (meta?.mainColor || "gray");
  return `<span style='display:inline-flex;align-items:center;gap:4px;background:${background};color:${color};padding:1px 7px;border-radius:10px;font-size:0.85em;font-weight:600;'>${iconHtml} ${meta?.statusText || ""}</span>`;
};

const getProgressSegmentHtml = ({
  pct = 0,
  color = STAGE_EMPTY_COLOR,
  emptyColor = STAGE_EMPTY_COLOR,
  radius = "2px"
} = {}) => `<div style='flex: 1; height: 100%; background: ${emptyColor}; border-radius: ${radius};'><div style='width: ${Number(pct) || 0}%; height: 100%; background: ${color}; border-radius: ${radius};'></div></div>`;

const getProgressSegmentsHtml = (segments = [], options = {}) => (
  (Array.isArray(segments) ? segments : []).map(segment => getProgressSegmentHtml({ ...segment, ...options })).join("")
);

const getTreatmentProgressSegmentsHtml = (segments = [], mainColor = "#4caf50", {
  emptyColor = STAGE_EMPTY_COLOR,
  radius = "2px"
} = {}) => (
  (Array.isArray(segments) ? segments : []).map((segment, index) => {
    const frac = Number(segment?.frac) || 0;
    const currFrac = Number(segment?.currFrac) || 0;
    const filledPct = frac > 0 ? Math.min(100, Math.round((currFrac / frac) * 100)) : 0;
    const segmentColor = index === 0 ? mainColor : segment?.color;
    return `<div style='flex:${frac};height:100%;background:${emptyColor};border-radius:${radius};${index > 0 ? "margin-left:2px;" : ""}'><div style='width:${filledPct}%;height:100%;background:${segmentColor};border-radius:${radius};'></div></div>`;
  }).join("")
);

// ── Text merge helpers (extracted from view.js parser flow) ──────

const mergeTimelineText = (existingText, nextText) => {
  const currentText = String(existingText || "").trim();
  const incomingText = String(nextText || "").trim();
  if (!incomingText) return currentText;
  if (!currentText) return incomingText;
  const toLines = text => String(text).split("\n").map(line => line.trim()).filter(Boolean);
  const toStamp = line => {
    const match = line.match(/^(\d{2})\.(\d{2})\.(\d{4})/);
    return match ? parseInt(`${match[3]}${match[2]}${match[1]}`, 10) : 0;
  };
  const existingLines = toLines(currentText);
  const normalized = new Set(existingLines.map(line => line.replace(/\s+/g, " ").toLowerCase()));
  const toAdd = toLines(incomingText).filter(line => !normalized.has(line.replace(/\s+/g, " ").toLowerCase()));
  return toAdd.length ? [...existingLines, ...toAdd].sort((a, b) => toStamp(a) - toStamp(b)).join("\n") : currentText;
};

const mergeDistinctParagraphText = (existingText, nextText) => {
  const currentText = String(existingText || "").trim();
  const incomingText = String(nextText || "").trim();
  if (!incomingText) return currentText;
  if (!currentText) return incomingText;
  const normalize = (text) => String(text || "").replace(/\s+/g, " ").trim().toLowerCase();
  const currentNorm = normalize(currentText);
  const incomingNorm = normalize(incomingText);
  if (!currentNorm) return incomingText;
  if (!incomingNorm) return currentText;
  if (currentNorm === incomingNorm || currentNorm.includes(incomingNorm)) return currentText;
  if (incomingNorm.includes(currentNorm)) return incomingText;
  const splitBlocks = (text) => String(text).split(/\n{2,}|\n/).map(part => part.trim()).filter(Boolean);
  const existingBlocks = splitBlocks(currentText);
  const existingNorms = existingBlocks.map(normalize);
  const toAdd = splitBlocks(incomingText).filter(block => {
    const norm = normalize(block);
    if (!norm) return false;
    return !existingNorms.some(existingNorm => existingNorm === norm || existingNorm.includes(norm) || norm.includes(existingNorm));
  });
  return toAdd.length ? [...existingBlocks, ...toAdd].join("\n") : (incomingNorm.length > currentNorm.length ? incomingText : currentText);
};

const mergeDistinctListText = (existingText, nextText) => {
  const currentText = String(existingText || "").trim();
  const incomingText = String(nextText || "").trim();
  if (!incomingText) return currentText;
  if (!currentText) return incomingText;
  const splitItems = (text) => String(text)
    .split(/\n|;|●/g)
    .map(item => item.trim())
    .filter(Boolean);
  const normalize = (text) => String(text || "").replace(/\s+/g, " ").trim().toLowerCase();
  const existingItems = splitItems(currentText);
  const existingNorms = existingItems.map(normalize);
  const toAdd = splitItems(incomingText).filter(item => {
    const norm = normalize(item);
    if (!norm) return false;
    return !existingNorms.some(existingNorm => existingNorm === norm || existingNorm.includes(norm) || norm.includes(existingNorm));
  });
  return toAdd.length ? [...existingItems, ...toAdd].join("\n") : currentText;
};

const mergePhoneText = (existingText, nextText) => {
  const currentText = String(existingText || "").trim();
  const incomingText = String(nextText || "").trim();
  if (!incomingText) return currentText;
  if (!currentText) return incomingText;
  const normalizePhone = value => String(value || "").replace(/\D/g, "");
  const existingPhones = currentText.split(" / ").map(part => part.trim()).filter(Boolean);
  const existingNorms = new Set(existingPhones.map(normalizePhone));
  const incomingPhones = incomingText.split(/[,;]|\s+\/\s+|\//).map(part => part.trim()).filter(Boolean);
  const toAdd = incomingPhones.filter(phone => phone && !existingNorms.has(normalizePhone(phone)));
  return toAdd.length ? [...existingPhones, ...toAdd].join(" / ") : currentText;
};

const DAY_PHRASES = { 1: "в понедельник", 2: "во вторник", 3: "в среду", 4: "в четверг", 5: "в пятницу", 6: "в субботу", 7: "в воскресенье" };

// ── Build Patient Model ──────────────────────────

const buildPatientModel = (p, {
  holidays = [],
  todayIso = "",
  scheduleCore = null
} = {}) => {
  const frac = Number(p?.Количество_фракций) || 0;
  const startRawIso = typeof p?.Дата_начала_лечения === "object" && p.Дата_начала_лечения !== null && typeof p.Дата_начала_лечения.toISODate === "function" ? p.Дата_начала_лечения.toISODate() : String(p?.Дата_начала_лечения || "").slice(0, 10);
  const mode = scheduleCore?.utils?.detectMode ? scheduleCore.utils.detectMode(p?.Фракционирование) : p?.Фракционирование;
  const manuals = Array.isArray(p?.Внеплановые_фракции) ? p.Внеплановые_фракции.map(v => typeof v === "object" && v !== null && typeof v.toISODate === "function" ? v.toISODate() : String(v || "").slice(0, 10)).filter(Boolean) : [];
  const skips = new Set(Array.isArray(p?.Пропущенные_даты) ? p.Пропущенные_даты.map(v => typeof v === "object" && v !== null && typeof v.toISODate === "function" ? v.toISODate() : String(v || "").slice(0, 10)).filter(Boolean) : []);
  const isSick = !!p?.Больничный_лист;
  const vkRaw = p?.["Очередное_ВК"];
  const vkDateIsos = getVkDateSourceList(vkRaw).map(v => typeof v === "object" && v !== null && typeof v.toISODate === "function" ? v.toISODate() : String(v || "").slice(0, 10)).filter(Boolean);

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
  if (scheduleCore && typeof scheduleCore.buildSchedule === "function") {
    scheduleIsos = scheduleCore.buildSchedule({
      fracCount: frac,
      startDate: startIso,
      modeStr: mode,
      manualDates: scheduleManualIsos,
      skipDates: Array.from(skips),
      holidays: holidays
    });
  }

  let endIso = scheduleIsos.length ? scheduleIsos[scheduleIsos.length - 1] : "";
  const currFrac = scheduleIsos.filter(iso => iso <= todayIso).length;

  const segments = [getBaseTreatmentSegment({ frac, currFrac })];
  const extraVols = getExtraVolumeItems(p?.Объёмы);
  const extraSchedules = [];
  let prevEndIso = endIso;

  if (extraVols.length > 0) {
    extraVols.forEach(vol => {
      const volPlan = getExtraVolumePlan({
        vol,
        baseFrac: frac,
        normalizeConn: (raw) => scheduleCore?.normalizeConn ? scheduleCore.normalizeConn(raw) : String(raw || ""),
        parseMode: (raw) => scheduleCore?.utils?.detectMode ? scheduleCore.utils.detectMode(raw) : raw
      });
      const { fracN, conn, modeN } = volPlan;

      if (volPlan.isSimultaneous) {
        extraSchedules.push({ vol, fracN: frac || 0, conn, scheduleIsos, startIsoN: startIso, endIsoN: endIso });
        return;
      }
      if (volPlan.hasInvalidFraction) {
        extraSchedules.push({ vol, fracN, conn, scheduleIsos: [], startIsoN: "", endIsoN: "" });
        return;
      }

      const startIsoN = getExtraVolumeStartIso({
        conn,
        startIso,
        prevEndIso,
        nextWorkDayAfterIso: (iso) => scheduleCore?.nextWorkDayAfter ? scheduleCore.nextWorkDayAfter(iso, holidays, 30) : ""
      });

      if (!startIsoN) {
        extraSchedules.push({ vol, fracN, conn, scheduleIsos: [], startIsoN: "", endIsoN: "" });
        return;
      }

      let schedIsos = [];
      if (scheduleCore && typeof scheduleCore.buildSchedule === "function") {
        schedIsos = scheduleCore.buildSchedule({
          fracCount: fracN,
          startDate: startIsoN,
          modeStr: modeN,
          manualDates: manuals,
          skipDates: Array.from(skips),
          holidays: holidays
        });
      }

      const endIsoN = schedIsos.length ? schedIsos[schedIsos.length - 1] : "";
      const currFracN = schedIsos.filter(iso => iso <= todayIso).length;
      extraSchedules.push({ vol, fracN, conn, scheduleIsos: schedIsos, startIsoN, endIsoN });

      if (endIsoN) {
        endIso = getLaterIso(endIso, endIsoN);
        const sequentialSegment = getSequentialSegment({
          conn,
          endIso: endIsoN,
          frac: fracN,
          currFrac: currFracN
        });
        if (sequentialSegment) {
          prevEndIso = endIsoN;
          segments.push(sequentialSegment);
        }
      }
    });
  }

  const { totalFrac, totalCurrFrac } = getSegmentTotals(segments);
  const allScheduleIsos = [scheduleIsos, ...extraSchedules.map(s => s.scheduleIsos)];
  const hasFractionToday = hasFractionOnDate(allScheduleIsos, todayIso);

  let contourDeadlineIso = "";
  if (startIso && scheduleCore && typeof scheduleCore.minusWorkDays === "function") {
    contourDeadlineIso = scheduleCore.minusWorkDays(startIso, 3, holidays);
  }

  const remarkDateIso = typeof p?.Дата_переразметки === "object" && typeof p?.Дата_переразметки?.toISODate === "function" ? p.Дата_переразметки.toISODate() : String(p?.Дата_переразметки || "").slice(0, 10);
  let recontourDeadlineIso = "";
  if (remarkDateIso && p?.Переразметка === true && scheduleCore && typeof scheduleCore.addWorkDaysInclusive === "function") {
    recontourDeadlineIso = scheduleCore.addWorkDaysInclusive(remarkDateIso, 2, holidays);
  }

  return {
    p,
    startIso,
    endIso,
    scheduleIsos,
    currFrac,
    frac,
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
    markIso: typeof p?.Дата_разметки === "object" && typeof p?.Дата_разметки?.toISODate === "function" ? p.Дата_разметки.toISODate() : String(p?.Дата_разметки || "").slice(0, 10)
  };
};

// ── Action Patch Generators ───────────────────────

const getConsultationRejectPatch = () => ({
  Консультация_завершена: true,
  Консультация_решение: "отказ",
  Отказ_от_лечения: true,
  Принят_на_лечение: false
});

const getConsultationAcceptPatch = (isConsultFolder = false) => {
  const patch = {
    Консультация_завершена: true,
    Консультация_решение: "принят",
    Принят_на_лечение: true,
    Отказ_от_лечения: false
  };
  if (isConsultFolder) {
    patch.Дата_консультации = null;
  }
  return patch;
};

const getHospitalizationSickPatch = () => ({
  Госпитализация: true
});

const getRemarkupDonePatch = () => ({
  Переразметка: true,
  Оконтуривание: false
});

const getSetFlagPatch = (key) => {
  const normalizedKey = String(key || "").trim();
  return normalizedKey ? { [normalizedKey]: true } : {};
};

const getAddSkippedDatePatch = (currentSkippedDates, skipDateIso) => {
  const dateIso = String(skipDateIso || "").slice(0, 10);
  const dates = Array.isArray(currentSkippedDates) ? currentSkippedDates.map(String) : [];
  if (dateIso && !dates.includes(dateIso)) dates.push(dateIso);
  return { "Пропущенные_даты": dates.sort() };
};

const TREATMENT_TEMPLATE_SYSTEM_TAGS = ["Пациент"];
const TREATMENT_TEMPLATE_KNOWN_TAGS = [
  "РМЖ", "Длинный_курс", "Fast_forward", "SBRT", "КС", "ДС", "РПЖ", "РПК",
  "НМРЛ", "Рак_пищевода", "ОВГМ", "РАК", "Паллиатив", "ХЛТ", "Гипофракционирование"
];

const isStereotacticTreatmentContext = (...values) => values
  .map(value => String(value ?? ""))
  .some(text => /\b(?:SBRT|SRS|SRT)\b|stereotax|стереотакс/iu.test(text));

const getDefaultAccelerator = (context = {}) => (
  isStereotacticTreatmentContext(context.name, context.category, context.method, context.fractionation, ...(context.tags || []))
    ? "Varian TrueBeam"
    : "Varian Halcyon"
);

const normalizeTreatmentTemplateVolume = (volume = {}, context = {}) => ({
  Название: volume?.Название ?? null,
  Область_облучения: volume?.Область_облучения ?? null,
  РОД: volume?.РОД ?? null,
  Количество_фракций: volume?.Количество_фракций ?? null,
  Фракционирование: volume?.Фракционирование ?? "Стандартный",
  Связь: volume?.Связь ?? "Параллельно",
  Ускоритель: volume?.Ускоритель ?? getDefaultAccelerator({
    ...context,
    fractionation: volume?.Фракционирование
  })
});

const getTreatmentTemplateTags = (currentTags = [], template = {}) => {
  let tags = (Array.isArray(currentTags) ? currentTags : [])
    .filter(tag => TREATMENT_TEMPLATE_SYSTEM_TAGS.includes(tag) || !TREATMENT_TEMPLATE_KNOWN_TAGS.includes(tag));
  if (Array.isArray(template?.теги)) {
    template.теги.forEach(tag => {
      if (!tags.includes(tag)) tags.push(tag);
    });
  }
  if (template?.setTag) {
    const conflictTag = template.setTag === "КС" ? "ДС" : "КС";
    tags = tags.filter(tag => tag !== conflictTag);
    if (!tags.includes(template.setTag)) tags.push(template.setTag);
  }
  return tags;
};

const getTreatmentTemplatePatch = (template = {}, {
  currentTags = [],
  treatmentStart = null
} = {}) => {
  const acceleratorContext = {
    name: template?.name,
    category: template?.category,
    tags: Array.isArray(template?.теги) ? template.теги : []
  };
  const volumes = (Array.isArray(template?.extra) ? template.extra : [])
    .map(volume => normalizeTreatmentTemplateVolume(volume, acceleratorContext));
  const patch = {
    Название_PTV: template?.ptv1?.Название,
    Область_облучения: template?.ptv1?.Область_облучения ?? null,
    РОД: template?.ptv1?.РОД,
    Количество_фракций: template?.ptv1?.Количество_фракций,
    Фракционирование: template?.ptv1?.Фракционирование,
    Ускоритель: template?.ptv1?.Ускоритель ?? getDefaultAccelerator({
      ...acceleratorContext,
      fractionation: template?.ptv1?.Фракционирование
    }),
    Объёмы: volumes,
    ХЛТ_препараты: template?.hlt ? [...(template.hlt.препараты ?? [])] : [],
    ХЛТ_дата_старта: template?.hlt ? (treatmentStart ?? null) : null,
    tags: getTreatmentTemplateTags(currentTags, template)
  };
  if (template?.цель) patch.Цель_лечения = template.цель;

  const { Объёмы, ...localStatePatch } = patch;
  localStatePatch._volumes = volumes;

  return {
    patch,
    localStatePatch,
    deleteKeys: ["Радиомодификация", "ХЛТ_режим"]
  };
};

const getMedicationTermUiLabel = (term, days) => {
  if (term === "весь_курс") return "Весь период лечения";
  const n = Number(days);
  if (Number.isFinite(n) && n > 0) return `${n} ${n === 1 ? "день" : (n >= 2 && n <= 4 ? "дня" : "дней")}`;
  const match = String(term || "").match(/^(\d+)_дней$/);
  if (match) {
    const count = Number(match[1]);
    return `${count} ${count === 1 ? "день" : (count >= 2 && count <= 4 ? "дня" : "дней")}`;
  }
  return "Весь период лечения";
};

const parseMedicationTerm = (uiValue) => {
  const value = String(uiValue || "").trim();
  if (!value || /^весь/i.test(value)) return { Срок: "весь_курс", Дней: null };
  const match = value.match(/(\d+)/);
  const days = match ? Number(match[1]) : null;
  if (!days || days < 1) return { Срок: "весь_курс", Дней: null };
  return { Срок: `${days}_дней`, Дней: days };
};

const normalizeMedicationAssignments = (pageObj = {}, {
  normalizeDate = (value) => String(value || "").slice(0, 10)
} = {}) => {
  const rawNew = pageObj?.ЛС_назначения;
  if (Array.isArray(rawNew) && rawNew.length > 0) {
    return rawNew.filter(Boolean).map(item => ({
      Препарат: String(item?.Препарат ?? "").trim(),
      Дозировка: String(item?.Дозировка ?? "").trim(),
      Срок: String(item?.Срок ?? "весь_курс"),
      Дней: Number(item?.Дней) > 0 ? Number(item.Дней) : null,
      Дата_старта: item?.Дата_старта ? (normalizeDate(item.Дата_старта) || "") : ""
    })).filter(item => item.Препарат);
  }

  const rawLegacy = pageObj?.Лекарственные_препараты;
  if (Array.isArray(rawLegacy) && rawLegacy.length > 0) {
    return rawLegacy.filter(Boolean).map(item => {
      const term = parseMedicationTerm(item?.Срок);
      return {
        Препарат: String(item?.Препарат ?? "").trim(),
        Дозировка: String(item?.Дозировка ?? "").trim(),
        Срок: term.Срок,
        Дней: term.Дней,
        Дата_старта: item?.Дата_начала ? (normalizeDate(item.Дата_начала) || "") : ""
      };
    }).filter(item => item.Препарат);
  }

  return [];
};

const dedupeMedicationAssignments = (assignments = []) => {
  const byKey = new Map();
  (Array.isArray(assignments) ? assignments : []).forEach(item => {
    if (!item || !item.Препарат) return;
    const key = [
      String(item.Препарат || "").trim().toLowerCase(),
      String(item.Дозировка || "").trim().toLowerCase(),
      item.Срок || "весь_курс",
      item.Дней || "",
      item.Дата_старта || ""
    ].join("|");
    if (!byKey.has(key)) byKey.set(key, item);
  });
  return Array.from(byKey.values());
};

const createExtraVolume = ({
  name = null,
  area = null,
  rod = null,
  fractions = null,
  fractionation = "Стандартный",
  connection = "Параллельно",
  accelerator = null
} = {}) => ({
  Название: name,
  Область_облучения: area,
  РОД: rod,
  Количество_фракций: fractions,
  Фракционирование: fractionation,
  Связь: connection,
  Ускоритель: accelerator ?? getDefaultAccelerator({ fractionation })
});

const appendExtraVolume = (volumes = [], volume = {}) => [
  ...(Array.isArray(volumes) ? volumes : []),
  volume
];

const insertExtraVolumeAt = (volumes = [], index = 0, volume = {}) => {
  const list = Array.isArray(volumes) ? volumes : [];
  const normalizedIndex = Math.max(0, Math.min(Number(index) || 0, list.length));
  return [
    ...list.slice(0, normalizedIndex),
    volume,
    ...list.slice(normalizedIndex)
  ];
};

const removeExtraVolume = (volumes = [], targetVolume) => (
  Array.isArray(volumes) ? volumes.filter(volume => volume !== targetVolume) : []
);

const createTagMap = (tags = []) => {
  const map = new Map();
  (Array.isArray(tags) ? tags : []).forEach(tag => {
    const value = String(tag || "");
    if (value) map.set(value.toLowerCase(), value);
  });
  return map;
};

const tagMapToList = (tagMap) => Array.from((tagMap instanceof Map ? tagMap : new Map()).values());

const getDsKsTagState = (tagMap) => {
  const map = tagMap instanceof Map ? tagMap : new Map();
  const hasDs = map.has("дс");
  const hasKs = map.has("кс");
  return { hasDs, hasKs, state: hasDs ? "ДС" : (hasKs ? "КС" : null) };
};

const setExclusiveDsKsTag = (tagMap, tag) => {
  const map = new Map(tagMap instanceof Map ? tagMap : []);
  const normalized = String(tag || "").trim().toLowerCase();
  const currentState = getDsKsTagState(map).state;
  map.delete("дс");
  map.delete("кс");
  if (normalized === "дс" && currentState !== "ДС") map.set("дс", "ДС");
  if (normalized === "кс" && currentState !== "КС") map.set("кс", "КС");
  return map;
};

const toggleTagInMap = (tagMap, tag) => {
  const map = new Map(tagMap instanceof Map ? tagMap : []);
  const value = String(tag || "").trim();
  if (!value) return map;
  const key = value.toLowerCase();
  if (map.has(key)) map.delete(key);
  else map.set(key, value);
  return map;
};

const addTagToMap = (tagMap, tag) => {
  const map = new Map(tagMap instanceof Map ? tagMap : []);
  const value = String(tag || "").trim().replace(/^#+/, "");
  if (!value) return map;
  const key = value.toLowerCase();
  if (!map.has(key)) map.set(key, value);
  return map;
};

const removeTagFromMap = (tagMap, tag) => {
  const map = new Map(tagMap instanceof Map ? tagMap : []);
  map.delete(String(tag || "").trim().toLowerCase());
  return map;
};

const getCustomTagsFromMap = (tagMap, presetKeys = new Set()) => {
  const presetSet = presetKeys instanceof Set ? presetKeys : new Set(Array.isArray(presetKeys) ? presetKeys : []);
  return Array.from((tagMap instanceof Map ? tagMap : new Map()).entries())
    .filter(([key]) => !presetSet.has(key) && key !== "пациент")
    .map(([, value]) => value);
};

const PATIENT_DRAFT_SERVICE_KEYS = new Set(["_tagsMap", "_volumes"]);

const getPatientDraftResult = (draft = {}) => {
  const result = { ...(draft || {}) };
  PATIENT_DRAFT_SERVICE_KEYS.forEach(key => { delete result[key]; });
  return result;
};

const isPatientDraftDirty = (draft = {}) => {
  for (const [key, value] of Object.entries(draft || {})) {
    if (PATIENT_DRAFT_SERVICE_KEYS.has(key)) continue;
    if (value === null || value === undefined || value === false || value === "") continue;
    if (Array.isArray(value) && value.length === 0) continue;
    return true;
  }
  return false;
};

const getRemoveVkPatch = (currentVkList, dateIsoToRemove) => {
  if (!currentVkList) return {};
  const updated = removeIsoFromDateList(
    currentVkList,
    dateIsoToRemove,
    value => typeof value === "object" && value !== null && typeof value.toISODate === "function" ? value.toISODate() : String(value || "").slice(0, 10)
  );
  return { "Очередное_ВК": updated };
};

const getAddReminderPatch = (currentReminders, targetIso, reminderText) => {
  const reminders = Array.isArray(currentReminders) ? [...currentReminders] : [];
  reminders.push({ дата: targetIso, текст: reminderText, выполнено: false });
  return { Напоминания: reminders };
};

const getAddVkReminderPatch = (currentReminders, targetIso, reminderText = "Написать ВК по ЭЛН") =>
  getAddReminderPatch(currentReminders, targetIso, reminderText);

const getSnoozeReminderPatch = (currentReminders, index, newDateIso) => {
  const reminders = Array.isArray(currentReminders) ? [...currentReminders] : [];
  if (reminders[index]) {
    reminders[index] = { ...reminders[index], дата: newDateIso };
  }
  return { Напоминания: reminders };
};

const getCompleteReminderPatch = (currentReminders, index) => {
  const reminders = Array.isArray(currentReminders) ? [...currentReminders] : [];
  if (reminders[index]) {
    reminders[index] = { ...reminders[index], выполнено: true };
  }
  return { Напоминания: reminders };
};

const getDeleteReminderPatch = (currentReminders, index) => ({
  Напоминания: Array.isArray(currentReminders)
    ? currentReminders.filter((_, reminderIndex) => reminderIndex !== index)
    : []
});



// --- AI PARSER EXTRACTED ---
const PARSER_PROMPT = `Ты — медицинский ассистент. Из предоставленного текста извлеки данные и верни ТОЛЬКО JSON-объект без пояснений.
Поля для извлечения:
- "ФИО": полное имя пациента (Фамилия Имя Отчество)
- "Дата_рождения": дата рождения в формате yyyy-MM-dd
- "СНИЛС": номер СНИЛС (формат XXX-XXX-XXX XX)
- "Номер_телефона": номер телефона
- "Email": электронная почта пациента (формат name@domain.com)
- "db_sex": пол пациента: "М" или "Ж"
- "db_tumor_location": точная анатомическая локализация опухоли (например "нижняя доля правого лёгкого", "левая молочная железа")
- "db_histotype": гистологический тип опухоли (например "аденокарцинома", "инфильтрирующий протоковый рак", "глиобластома"). Для рака предстательной железы возвращай просто "аденокарцинома" без слов "ацинарная"/"ацинозная".
- "db_date_dx": дата первичного выявления диагноза в формате yyyy-MM (или yyyy если месяц неизвестен)
- "db_surgery_type": тип выполненной операции (например "нижняя лобэктомия справа с медиастинальной лимфодиссекцией")
- "db_prior_treatment": предшествующее противоопухолевое лечение в хронологическом порядке. Строка через "; ". Формат каждой записи: "дд.мм.гггг событие" или "С мм.гггг по мм.гггг событие" или "С мм.гггг событие". Включай операции, лучевую терапию, химиотерапию, гормонотерапию, таргетную терапию и иммунотерапию. Без дозировок.
- "db_chemo_regimen": химиотерапия в хронологическом порядке. Строка через "; ". Для каждой записи указывай даты, число проведённых курсов и формулировку "ХТ по схеме ...". Без дозировок и без линий терапии. Названия препаратов и схем пиши с Заглавной Буквы. Комбинации оформляй через " + " (например "Этопозид + Карбоплатин"), последовательные схемы в одном интервале — через "→" (например "AC → Паклитаксел").
- "db_rt_method": метод лучевой терапии (например "IMRT", "VMAT", "SBRT", "3D-CRT", "брахитерапия")
- "db_hormonal_drug": препараты гормонотерапии, без дозировок, через "; " если несколько
- "db_targeted_drug": таргетные препараты, без дозировок, через "; " если несколько
- "db_immunotherapy_drug": препараты иммунотерапии, без дозировок, через "; " если несколько
- "db_stage": клиническая стадия (только цифра-буква, например "IIA", "IIIB", "IV"). Заполняй ТОЛЬКО исходную стадию на момент первичного стадирования. Если в тексте описано лечение, а затем прогрессирование/метастазы, НЕ рестадируй заболевание в IV стадию задним числом: оставь исходную стадию, а прогрессирование отрази отдельно.
- "db_t": значение T из TNM (например "2a", "3", "4b", "is") — только цифра/буква после T, без префикса c/p/y/r
- "db_n": значение N из TNM (например "0", "1", "2a", "3") — только цифра/буква после N
- "db_m": значение M из TNM (например "0", "1") — только цифра после M
- "db_grade": степень дифференцировки G (например "1", "2", "3") — только цифра
- "db_mol_subtype": молекулярный подтип — число: 1=Люминальный A, 2=Люминальный B HER2-, 3=Люминальный B HER2+, 4=HER2-позитивный, 5=Тройной негативный (только для РМЖ)
- "db_er": значение ER в баллах (число 0–8, например 7)
- "db_pr": значение PR в баллах (число 0–8, например 5)
- "db_her2": значение HER2 (0, 1, 2, 3 — только цифра)
- "db_ki67": Ki67 процент (число, например 35)
- "db_pdl1": экспрессия PD-L1 — строка (например "TPS 60%", "CPS 15", "0%")
- "db_egfr_mut": статус EGFR — 0=дикий тип/отрицательно, 1=мутация/положительно
- "db_alk_status": статус ALK — 0=отрицательно, 1=положительно
- "db_ros1_status": статус ROS1 — 0=отрицательно, 1=положительно
- "db_kras_mut": статус KRAS — 0=дикий тип/отрицательно, 1=мутация/положительно
- "db_nras_mut": статус NRAS — 0=дикий тип/отрицательно, 1=мутация/положительно
- "db_ras_mut": общий статус RAS — 0=дикий тип/отрицательно, 1=мутация/положительно
- "db_braf_mut": статус BRAF — 0=дикий тип/отрицательно, 1=мутация/положительно
- "db_idh_mut": статус IDH1/IDH2 — 0=дикий тип/отрицательно, 1=мутация/положительно
- "db_brca_mut": статус BRCA1/BRCA2 — 0=дикий тип/отрицательно, 1=мутация/положительно
- "db_ret_status": статус RET — 0=отрицательно, 1=положительно
- "db_met_status": статус MET — 0=отрицательно, 1=положительно
- "db_ntrk_status": статус NTRK — 0=отрицательно, 1=положительно
- "db_mgmt_meth": метилирование MGMT — строка "метилирован" или "неметилирован"
- "db_msi_status": микросателлитный статус — строка "MSS", "MSI-H", "MSI-L" или "MSI"
- "db_mmr_status": статус MMR — строка "pMMR" или "dMMR"
- "db_gleason": шкала Глисона (например "4+5=9")
- "db_initial_psa": исходный ПСА / PSA (число, например 47.6)
- "db_other_biomarkers": прочие релевантные биомаркеры, не вошедшие в отдельные поля (например "ATRX loss; 1p/19q codeletion; TERT mutation")
- "db_progression": 1 если в документе упомянуто прогрессирование заболевания, 0 если явно указано отсутствие прогрессирования
- "db_date_prog": дата прогрессирования в формате yyyy-MM (только если явно указана)
- "db_prog_type": тип прогрессирования — число: 1=локальное, 2=регионарное, 3=отдалённые метастазы, 4=смешанное
- "МКБ 10": код МКБ-10 (например C50.1)
- "Диагноз": структурированный текст. При нескольких онкологических диагнозах — нумеруй 1) ... 2) ... каждый с новой строки. СТРУКТУРА ОДНОГО ДИАГНОЗА (всё в одну строку, элементы разделены точкой с пробелом): Строка 1: [Гистологический тип] [локализация], [TNM с префиксом c/p/y/r], G[степень], [стадия]. Строка 2 (если есть ИГХ/молекулярные маркеры): маркеры на английском (ER Xб, PR Xб, HER2 X+, Ki67 X%, PD-L1 TPS X%, EGFR, ALK, KRAS, IDH, MSS и т.д.) + подтип СТРОГО НА РУССКОМ (Люминальный A / Люминальный B HER2-отрицательный / Люминальный B HER2-положительный / HER2-положительный / Тройной негативный). Строки лечения: разовое — "дд.мм.гггг Событие." (без тире); диапазон — "С мм.гггг по мм.гггг Событие."; начато и продолжается — "С мм.гггг Событие.". ПРАВИЛА ЛЕЧЕНИЯ: НЕ писать "Состояние после". НЕ упоминать номера линий терапии. Лучевую терапию (ДЛТ, ХЛТ, брахитерапия, стереотаксис) — **жирным**, без дозировки СОД. Стереотаксическую радиохирургию писать как **Стереотаксическая радиохирургия**. ХТ: только название схемы/комбинации без дозировок, без линий, без числа курсов; комбинации оформляй через "+", последовательные режимы — через "→". Гормонотерапию, таргетную терапию и иммунотерапию — только название препарата, без дозировок. Прогрессирование — отдельной записью: "мм.гггг Прогрессирование, [описание].". СТАДИЯ И TNM В ДИАГНОЗЕ ФИКСИРУЮТСЯ ТОЛЬКО ОДИН РАЗ — на момент первичного стадирования. После начала противоопухолевого лечения НЕ переписывай первую строку диагноза в IV стадию по факту прогрессирования или появления отдалённых метастазов; такие события указывай только отдельными строками прогрессирования. СТРОЖАЙШИЙ ФИЛЬТР: в Диагноз включать ИСКЛЮЧИТЕЛЬНО онкологическое лечение (операции на опухоли, ХТ, ЛТ, гормонотерапия, таргетная терапия, иммунотерапия). Если данные не верифицированы — пиши "предположительно" или "клинически". КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО включать в Диагноз запланированное/рекомендованное лечение из протоколов консилиумов, решений ОК или назначений врача — только ФАКТИЧЕСКИ ПРОВЕДЁННОЕ лечение с реальными датами начала/окончания. Решения консилиума, рекомендации и планируемые курсы → поле "Решение_консилиума", НЕ в "Диагноз". Для рака предстательной железы не используй формулировку "ацинарная/ацинозная аденокарцинома" — пиши просто "Аденокарцинома". ПРИМЕРЫ: "Инфильтрирующий протоковый рак левой молочной железы, pT2N3cM0, G2, IIIC стадия. ER 7б, PR 5б, HER2 0+, Ki67 35%. Люминальный B, HER2-отрицательный. 15.01.2021 Органосохраняющая операция слева с лимфодиссекцией. С 03.2021 по 07.2021 ПХТ AC → Паклитаксел. С 08.2021 по 10.2021 **ДЛТ на молочную железу и зоны регионарного метастазирования**. С 11.2021 Гормонотерапия Тамоксифен. 05.2023 Прогрессирование, метастазы в кости (L2–L4, таз). С 06.2023 по 11.2023 МХТ Капецитабин. 12.2023 Прогрессирование. С 12.2023 Палбоциклиб + Летрозол." | "Аденокарцинома нижней доли правого лёгкого, cT2aN2M0, G2, IIIA стадия. EGFR del19+, ALK отрицательный, PD-L1 TPS 60%. 15.03.2022 Нижняя лобэктомия справа с медиастинальной лимфодиссекцией. С 05.2022 Гефитиниб. 11.2023 Прогрессирование, метастазы в головной мозг. 12.2023 **Стереотаксическая радиохирургия**. С 01.2024 Осимертиниб." | "Аденокарцинома прямой кишки, cT3N1bM0, G2, IIIB стадия. KRAS дикий тип, BRAF дикий тип, MSS. С 01.2024 по 03.2024 **ХЛТ (Капецитабин + ДЛТ)**. 15.04.2024 Низкая передняя резекция прямой кишки. С 06.2024 по 10.2024 ПХТ FOLFOX." | "Аденокарцинома предстательной железы, cT3aN0M0, G3, IIIB стадия. Gleason 4+5=9. Initial PSA 47.6. 20.02.2024 Биопсия простаты. С 03.2024 АДТ Дегареликс. С 04.2024 по 05.2024 **ДЛТ на простату и регионарные лимфоузлы**."
- "Решение_консилиума": решение консилиума, рекомендуемая тактика. Обязательно указывай учреждение, дату и номер консилиума/ОК, если номер есть в документе.
- "Жалобы": жалобы пациента
- "Анамнез_заболевания": история болезни в формате хронологического тайм-лайна. Каждое событие — отдельная строка: "дд.мм.гггг Описание события;" Включай: первичные обращения, выставление диагноза, операции, курсы ХТ/ЛТ, консилиумы, госпитализации, ключевые изменения состояния, прогрессирование. Для консилиумов обязательно указывай номер консилиума/ОК, если он есть в документе: "дд.мм.гггг Онкоконсилиум №XXXX, [учреждение]: [краткое решение];". Гистологические исследования включай в краткой форме: "дд.мм.гггг ПГИ №XXXXXX: [краткое заключение];" и "дд.мм.гггг ИГХ №XXXXXX: [ключевые маркеры];" и "дд.мм.гггг МГИ №XXXXXX: [молекулярный результат];" Из лабораторных данных включай ТОЛЬКО значения онкомаркеров (ПСА, РЭА, СА 19-9, СА 125, АФП, СА 15-3) с датой. НЕ включай ОАК, биохимию, коагулограмму, анализ мочи — они идут в "Лабораторные". Если дата неизвестна — указывай год или мм.гггг.
- "Анамнез_жизни": анамнез жизни: сопутствующие заболевания, наследственность, аллергии. Если в документе явно упомянуты препараты постоянного приёма по сопутствующим заболеваниям — добавь в конце отдельным блоком: "● [Название препарата], [дозировка], [режим]." для каждого препарата. ВАЖНО: вноси ТОЛЬКО препараты, прямо указанные в документе, ничего не додумывать.
- "Описания_исследований": результаты всех исследований в хронологическом порядке. Каждое исследование — отдельная строка с датой и номером протокола (если есть): "дд.мм.гггг ПГИ №XXXXXXX: [полное морфологическое описание без сокращений]." "дд.мм.гггг ИГХ №XXXXXXX: [все маркеры с результатами]." "дд.мм.гггг МГИ №XXXXXXX: [молекулярно-генетические данные]." "дд.мм.гггг УЗИ [область]: [описание]." "дд.мм.гггг КТ [область]: [описание]." "дд.мм.гггг МРТ [область]: [описание]." Сохраняй ВСЕ показатели подробно (ER/PR, Ki67, грейд G, размеры, метастазы). При отсутствии номера протокола — только дата и тип исследования.
- "Сопутствующие_заболевания": сопутствующие диагнозы
- "ECOG_статус": функциональный статус ECOG (целое число 0-4)
- "Лабораторные": массив объектов. Каждый объект — анализы за одну дату взятия биоматериала. Формат: {"Дата":"yyyy-MM-dd","Лейкоциты":число,"Нейтрофилы":число,"Лимфоциты":число,"Моноциты":число,"Эозинофилы":число,"Базофилы":число,"Эритроциты":число,"Гемоглобин":число,"Гематокрит":число,"Тромбоциты":число,"СОЭ":число,"АЛТ":число,"АСТ":число,"ЩФ":число,"ГГТ":число,"Билирубин":число,"Бил_прям":число,"Общий_белок":число,"Мочевина":число,"Креатинин":число,"Глюкоза":число,"Натрий":число,"Калий":число,"МНО":число,"АЧТВ":число,"ТВ":число,"ПТВ":число,"Д_димер":число,"ПСА":число,"РЭА":число,"СА_19_9":число,"СА_125":число,"АФП":число,"СА_15_3":число,"Уробилиноген_м":число,"Удельный_вес_м":число,"pH_мочи":число,"Лейкоциты_мочи":число,"Белок_мочи":число,"Билирубин_мочи":"строка","Глюкоза_мочи":"строка","Кровь_мочи":"строка","Кетоны_мочи":"строка","Нитриты_мочи":"строка"}. МАППИНГ РУССКИХ НАЗВАНИЙ: "Щелочная фосфатаза"→"ЩФ", "гамма-ГТ"/"ГГТ"→"ГГТ", "Билирубин прямой"/"Билирубин конъюгированный"→"Бил_прям", "Общий белок"→"Общий_белок", "D-димер"/"Д-димер"→"Д_димер", "Тромбиновое время"→"ТВ", "Протромбиновое время (с)"→"ПТВ", "CA 19-9"/"СА 19-9"→"СА_19_9", "CA 125"→"СА_125", "CA 15-3"→"СА_15_3", "РЭА"/"CEA"→"РЭА", "АФП"→"АФП", "СКО"/"Гематокрит"→"Гематокрит". АНАЛИЗ МОЧИ: "Уробилиноген" (моча)→"Уробилиноген_м" (число), "Удельный вес" (моча)→"Удельный_вес_м" (число, напр. 1.020), "pH" (моча)→"pH_мочи" (число), "Лейкоциты" (моча, полуколичественно)→"Лейкоциты_мочи" (число), "Белок" (моча)→"Белок_мочи" (число, если есть числовое значение), "Билирубин" (моча, кач.)→"Билирубин_мочи" (строка: "не обнаружен" или числовое значение как строка), "Глюкоза" (моча, кач.)→"Глюкоза_мочи" (строка), "Кровь" (моча)→"Кровь_мочи" (строка), "Кетоновые тела"→"Кетоны_мочи" (строка), "Нитриты"→"Нитриты_мочи" (строка). ВАЖНО: Не путай показатели МОЧИ с показателями КРОВИ — Лейкоциты в крови→"Лейкоциты" (число), Лейкоциты в моче→"Лейкоциты_мочи". Для клеток крови (лейкоциты, нейтрофилы, лимфоциты, эозинофилы, базофилы, моноциты, эритроциты, тромбоциты) ИЩИ И ИЗВЛЕКАЙ ТОЛЬКО АБСОЛЮТНЫЕ ЗНАЧЕНИЯ (например: "Абсолютное количество нейтрофилов 6,12" → 6.12). СТРОГО ИГНОРИРУЙ относительные значения в процентах (%). Бери цифру ТОЛЬКО из колонки "Результат", строго игнорируя колонку "Норма". Если в одном документе несколько дат (разные биоматериалы или разные исследования) — создавай отдельный объект для каждой уникальной даты и объединяй все показатели за эту дату в один объект.

ВАЖНЫЕ ПРАВИЛА:
1. ИСПРАВЛЯЙ опечатки во всех полях, переноси данные структурировано. Не ставь null. Если данных нет или они не упомянуты — не включай поле в JSON.
2. КОНФЛИКТЫ: Если в текстах встречаются противоречивые данные для поля, верни массив строк со всеми вариантами: ["вариант 1", "вариант 2"]. Если данные совпадают — верни строку.
3. ЛУЧЕВАЯ ТЕРАПИЯ: Жирным текстом (с помощью **маркдаун-звёздочек**) выделяй ЛЮБОЕ упоминание проведения ЛУЧЕВОЙ ТЕРАПИИ (ДЛТ, СЛТ, ХЛТ, брахитерапия) в полях "Диагноз", "Анамнез_заболевания" и "Анамнез_жизни".
4. ПОРЯДОК В ДИАГНОЗЕ: строго соблюдай последовательность — [гистотип + локализация] → [TNM] → [G] → [стадия] → [маркеры ER/PR/HER2/Ki67/мутации] → [подтип по-русски] → [лечение хронологически]. Не добавляй заголовки разделов.
5. МОЛЕКУЛЯРНЫЕ ПОДТИПЫ — ТОЛЬКО НА РУССКОМ. Маркеры (ER, PR, HER2, Ki67, EGFR, ALK, KRAS, NRAS, BRAF, IDH, BRCA, MET, RET, NTRK, MGMT, PD-L1, MSS/MSI и т.д.) — на английском. Подтип описывать по-русски: Люминальный A / Люминальный B HER2-отрицательный / Люминальный B HER2-положительный / HER2-положительный / Тройной негативный.
6. БИОМАРКЕРЫ: каждый маркер извлекай НЕЗАВИСИМО. У одного пациента могут одновременно быть положительными несколько маркеров или альтераций (например EGFR и ALK). Для бинарных полей используй: 1 = положительно / мутация / перестройка / амплификация, 0 = отрицательно / дикий тип. Если маркер не исследовался или нет явного результата — НЕ включай поле в JSON.
7. ХИМИОТЕРАПИЯ ДЛЯ БД: поле "db_chemo_regimen" заполняй в хронологическом порядке с датами, числом проведённых курсов и схемой. Форматируй как "С дд.мм.гггг по дд.мм.гггг проведено N курсов ХТ по схеме Название + Название" или "С мм.гггг проведено N курсов ХТ по схеме Название + Название", если известен только месяц. Не включай дозировки, мг/м2 и номера линий терапии.
8. ПРЕДШЕСТВУЮЩЕЕ ЛЕЧЕНИЕ ДЛЯ БД: поле "db_prior_treatment" заполняй по всей фактически проведённой противоопухолевой терапии в хронологии. Включай операции, ЛТ, ХТ, гормонотерапию, таргетную терапию, иммунотерапию. Не включай рекомендации и планы.
9. ДОПОЛНЕНИЕ ДАННЫХ: Если в сообщении есть раздел "=== ТЕКУЩИЕ ДАННЫЕ КАРТЫ ===" — произведи итоговую объединённую версию каждого поля. Не дублируй уже имеющиеся события, препараты или диагнозы. Для "Диагноз" — добавь новые события лечения хронологически к существующим. Для "Анамнез_жизни" — дополни список препаратов, не повторяй уже указанные. Для "Сопутствующие_заболевания" — объедини оба перечня без дублирования. Нельзя терять уже подтверждённые данные карты, если новый документ их не опровергает.
10. TNM И СТАДИЯ: если в документе явно указаны T, N, M или их можно надёжно извлечь из сформированного диагноза, обязательно заполни db_t, db_n, db_m и db_stage. Для рака предстательной железы при наличии T/N/M и данных Gleason и/или PSA постарайся определить стадию максимально точно.
11. ❌ ЗАПРЕЩЕНО ВКЛЮЧАТЬ В "Диагноз" — любое НЕ-онкологическое лечение и события: кардиология (стентирование, АКШ, кардиостимулятор, антикоагулянты), неврология (инсульт, ОНМК), сосудистая хирургия (ТЭЛА, тромбэктомия, имплантация кава-фильтра), ортопедия (эндопротезирование, остеосинтез), офтальмология, стоматология, дерматология, эндокринология (инсулинотерапия, тиреоидэктомия по поводу узлового зоба), гастроэнтерология (холецистэктомия по поводу ЖКБ), урология (ТУР аденомы простаты — НЕ онко; ТУР опухоли мочевого пузыря — ДА, это онко) и т.д. Все перечисленное → "Анамнез_заболевания" или "Анамнез_жизни", НИКОГДА в "Диагноз". В "Диагноз" идут ТОЛЬКО: резекции/удаление опухоли и лимфодиссекции, ПХТ/МХТ, ДЛТ/ХЛТ/брахитерапия/СРХ, гормонотерапия опухоли, таргетная терапия, иммунотерапия, прогрессирование.
12. ❌ ЗАПРЕЩЕНО ВКЛЮЧАТЬ В "Диагноз" запланированное лечение: решения консилиумов, рекомендации врачей, назначения, которые ещё НЕ начаты. Только ФАКТИЧЕСКИ проведённое лечение с датами. План лечения → "Решение_консилиума".
13. ФОРМАТ ДИАГНОЗА: для одного онкологического диагноза ВСЕ части и ВСЕ события пиши в ОДНУ непрерывную строку без переводов строк. Гистология, локализация, TNM, стадия, маркеры и далее все события лечения/прогрессирования должны идти последовательно по хронологии и разделяться точкой с пробелом.
14. ФОРМАТ ХТ В ДИАГНОЗЕ: химиотерапию оформляй как отдельное предложение в той же строке диагноза. Обязательно указывай период лечения, число курсов и формулировку "ХТ по схеме ...". Названия препаратов и схем пиши с Заглавной Буквы. Пример: "С 12.02.2025 по 29.05.2025 проведено 4 курса ХТ по схеме Этопозид + Карбоплатин."`;

const PARSER_PROMPT_VERSION = "2026-04-21-stage-immutability-v1";
const PARSER_REVIEW_THRESHOLD = 0.82;
const PARSER_ALLOWED_KEYS = [
  "ФИО", "Дата_рождения", "СНИЛС", "Номер_телефона", "Email",
  "db_sex", "db_tumor_location", "db_histotype", "db_date_dx", "db_surgery_type",
  "db_prior_treatment", "db_chemo_regimen", "db_rt_method", "db_hormonal_drug",
  "db_targeted_drug", "db_immunotherapy_drug", "db_stage", "db_t", "db_n", "db_m",
  "db_grade", "db_mol_subtype", "db_er", "db_pr", "db_her2", "db_ki67", "db_pdl1",
  "db_egfr_mut", "db_alk_status", "db_ros1_status", "db_kras_mut", "db_nras_mut",
  "db_ras_mut", "db_braf_mut", "db_idh_mut", "db_brca_mut", "db_ret_status",
  "db_met_status", "db_ntrk_status", "db_mgmt_meth", "db_msi_status", "db_mmr_status",
  "db_gleason", "db_initial_psa", "db_other_biomarkers", "db_progression",
  "db_date_prog", "db_prog_type", "db_vital_status", "db_date_death",
  "db_date_last_contact", "db_ecog_last", "МКБ 10", "Диагноз", "Решение_консилиума",
  "Жалобы", "Анамнез_заболевания", "Анамнез_жизни", "Описания_исследований",
  "Сопутствующие_заболевания", "ECOG_статус"
];
const PARSER_LABELS = {
  "db_sex": "Пол",
  "db_tumor_location": "Локализация опухоли",
  "db_histotype": "Гистотип",
  "db_date_dx": "Дата диагноза",
  "db_surgery_type": "Тип операции",
  "db_prior_treatment": "Предшествующее лечение",
  "db_chemo_regimen": "Химиотерапия",
  "db_rt_method": "Метод ЛТ",
  "db_hormonal_drug": "Гормонотерапия",
  "db_targeted_drug": "Таргетная терапия",
  "db_immunotherapy_drug": "Иммунотерапия",
  "db_stage": "Стадия",
  "db_t": "T",
  "db_n": "N",
  "db_m": "M",
  "db_grade": "Grade",
  "db_mol_subtype": "Молекулярный подтип",
  "db_er": "ER",
  "db_pr": "PR",
  "db_her2": "HER2",
  "db_ki67": "Ki67",
  "db_pdl1": "PD-L1",
  "db_egfr_mut": "EGFR",
  "db_alk_status": "ALK",
  "db_ros1_status": "ROS1",
  "db_kras_mut": "KRAS",
  "db_nras_mut": "NRAS",
  "db_ras_mut": "RAS",
  "db_braf_mut": "BRAF",
  "db_idh_mut": "IDH",
  "db_brca_mut": "BRCA",
  "db_ret_status": "RET",
  "db_met_status": "MET",
  "db_ntrk_status": "NTRK",
  "db_mgmt_meth": "MGMT",
  "db_msi_status": "MSI/MSS",
  "db_mmr_status": "MMR",
  "db_gleason": "Gleason",
  "db_initial_psa": "Initial PSA",
  "db_other_biomarkers": "Прочие биомаркеры",
  "db_progression": "Прогрессирование",
  "db_date_prog": "Дата прогрессирования",
  "db_prog_type": "Тип прогрессирования",
  "db_vital_status": "Витальный статус",
  "db_date_death": "Дата смерти",
  "db_date_last_contact": "Последний контакт",
  "db_ecog_last": "ECOG последний",
  "ECOG_статус": "ECOG",
  "МКБ 10": "МКБ-10"
};
const PARSER_TEXTAREA_KEYS = new Set([
  "Диагноз", "Решение_консилиума", "Жалобы", "Анамнез_заболевания", "Анамнез_жизни",
  "Описания_исследований", "Сопутствующие_заболевания", "db_prior_treatment",
  "db_chemo_regimen", "db_other_biomarkers"
]);
const PARSER_INTEGER_KEYS = new Set([
  "db_mol_subtype", "db_er", "db_pr", "db_her2", "db_ki67", "db_egfr_mut", "db_alk_status",
  "db_ros1_status", "db_kras_mut", "db_nras_mut", "db_ras_mut", "db_braf_mut",
  "db_idh_mut", "db_brca_mut", "db_ret_status", "db_met_status", "db_ntrk_status",
  "db_progression", "db_prog_type", "db_vital_status", "ECOG_статус", "db_ecog_last"
]);
const PARSER_FLOAT_KEYS = new Set(["db_initial_psa"]);
const PARSER_BINARY_KEYS = new Set([
  "db_egfr_mut", "db_alk_status", "db_ros1_status", "db_kras_mut", "db_nras_mut",
  "db_ras_mut", "db_braf_mut", "db_idh_mut", "db_brca_mut", "db_ret_status",
  "db_met_status", "db_ntrk_status", "db_progression", "db_vital_status"
]);
const PARSER_SELECT_OPTIONS = {
  "db_sex": ["", "М", "Ж"],
  "db_mol_subtype": ["", "1", "2", "3", "4", "5"],
  "db_progression": ["", "0", "1"],
  "db_prog_type": ["", "1", "2", "3", "4"],
  "db_vital_status": ["", "0", "1"],
  "ECOG_статус": ["", "0", "1", "2", "3", "4"],
  "db_ecog_last": ["", "0", "1", "2", "3", "4"],
  "db_msi_status": ["", "MSS", "MSI-H", "MSI-L", "MSI"],
  "db_mmr_status": ["", "pMMR", "dMMR"],
  "db_mgmt_meth": ["", "метилирован", "неметилирован"]
};
const PARSER_SLOT_META_KEY = "AI_Парсер_слоты_meta_json";
const PARSER_IDENTITY_KEYS = new Set([
  "ФИО", "Дата_рождения", "СНИЛС", "Номер_телефона", "Email", "db_sex"
]);
const PARSER_MERGEABLE_NARRATIVE_KEYS = new Set([
  "Диагноз", "Решение_консилиума", "Жалобы", "Анамнез_заболевания",
  "Анамнез_жизни", "Описания_исследований", "Сопутствующие_заболевания",
  "db_prior_treatment", "db_chemo_regimen", "db_other_biomarkers"
]);
const PARSER_SAFE_AUTOFILL_KEYS = new Set([
  "db_surgery_type", "db_rt_method", "db_hormonal_drug", "db_targeted_drug",
  "db_immunotherapy_drug"
]);
const parserGetRiskLevel = (key) => {
  if (PARSER_IDENTITY_KEYS.has(key)) return "identity";
  if (PARSER_MERGEABLE_NARRATIVE_KEYS.has(key)) return "mergeable_narrative";
  if (PARSER_SAFE_AUTOFILL_KEYS.has(key)) return "safe_autofill";
  return "critical_clinical";
};
const parserGetRiskLabel = (riskLevel) => ({
  identity: "identity",
  critical_clinical: "critical clinical",
  mergeable_narrative: "mergeable narrative",
  safe_autofill: "safe autofill"
}[riskLevel] || riskLevel || "unknown");
const parserRequiresManualReview = (key) => parserGetRiskLevel(key) !== "safe_autofill";
const parserGetSourceTypeScore = (label) => {
  const text = String(label || "").trim().toLowerCase();
  if (!text) return 0.65;
  if (/ручн|ревью|review/.test(text)) return 1;
  if (/диагноз документа|лаборатор|морфолог|игх|мги/.test(text)) return 0.95;
  if (/вставлен|документ|эпикриз|выписк|протокол|заключен/.test(text)) return 0.85;
  if (/пересч[её]т tnm9|tnm9/.test(text)) return 0.55;
  if (/шаблонн|regex|fallback/.test(text)) return 0.4;
  return 0.7;
};
const parserEscapeRegExp = (value) => String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const parserNormalizeCompareText = (value) => String(value || "")
  .toLowerCase()
  .replace(/ё/g, "е")
  .replace(/\u00a0/g, " ")
  .replace(/\s+/g, " ")
  .trim();
const parserBuildStagePhraseRegex = (value) => new RegExp(`(?:^|[^A-Za-zА-Яа-яЁё0-9])${parserEscapeRegExp(value)}\\s+стадия(?:[^A-Za-zА-Яа-яЁё]|$)`, "i");
const parserBuildTnmPartRegex = (key, value) => {
  const escapedValue = parserEscapeRegExp(value);
  if (key === "db_t") return new RegExp(`[cpyr]?T${escapedValue}(?=N|[^A-Za-zА-Яа-яЁё0-9]|$)`, "i");
  if (key === "db_n") return new RegExp(`N${escapedValue}(?=M|[^A-Za-zА-Яа-яЁё0-9]|$)`, "i");
  return new RegExp(`M${escapedValue}(?=[^A-Za-zА-Яа-яЁё0-9]|$)`, "i");
};
const PARSER_STAGE_PHRASE_CAPTURE_RE = /(?:^|[^A-Za-zА-Яа-яЁё0-9])((?:I|II|III|IV)(?:A|B|C)?)\s+стадия(?:[^A-Za-zА-Яа-яЁё]|$)/i;
const PARSER_STAGE_PHRASE_RE = /(?:^|[^A-Za-zА-Яа-яЁё0-9])(?:I|II|III|IV)(?:A|B|C)?\s+стадия(?:[^A-Za-zА-Яа-яЁё]|$)/i;
const parserHasExactQuoteSupport = (key, value, fragment) => {
  const text = String(fragment || "").trim();
  if (!text) return false;
  const valueText = parserValueToString(value);
  if (!valueText) return false;
  const normalizedText = parserNormalizeCompareText(text);
  const normalizedValue = parserNormalizeCompareText(valueText);
  if (!normalizedText || !normalizedValue) return false;
  if (key === "ECOG_статус" || key === "db_ecog_last") {
    return new RegExp(`(?:ECOG(?:\\s*[-/–]?\\s*PS)?|ЭКОГ|WHO\\s*PS)[^0-4]{0,24}${parserEscapeRegExp(valueText)}`, "i").test(text);
  }
  if (key === "db_stage") {
    return parserBuildStagePhraseRegex(valueText).test(text) || normalizedText.includes(normalizedValue);
  }
  if (key === "db_vital_status") {
    if (valueText === "1") return /умер|умерла|умерло|скончал(?:ся|ась)|летальн|deceased|died|dead/i.test(text);
    if (valueText === "0") return /(?:^|[^A-Za-zА-Яа-яЁё])жив(?:а|ой)?(?:[^A-Za-zА-Яа-яЁё]|$)|alive|цензур|под наблюдением|на контроле/i.test(text);
  }
  if (key === "db_t" || key === "db_n" || key === "db_m") {
    return parserBuildTnmPartRegex(key, valueText).test(text);
  }
  if (key === "Дата_рождения" || key === "db_date_dx" || key === "db_date_prog" || key === "db_date_death" || key === "db_date_last_contact") {
    return normalizedText.includes(normalizedValue);
  }
  if (PARSER_INTEGER_KEYS.has(key) || PARSER_FLOAT_KEYS.has(key) || PARSER_SELECT_OPTIONS[key]) {
    return new RegExp(`(^|[^\\d])${parserEscapeRegExp(valueText)}([^\\d]|$)`, "i").test(text) || normalizedText.includes(normalizedValue);
  }
  return normalizedText.includes(normalizedValue);
};
const parserNormalizeSourceDate = (raw) => {
  const value = String(raw || "").trim();
  if (!value) return "";
  const m = value.match(/^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?$/);
  if (!m) return "";
  const year = Number(m[1]);
  const month = m[2] ? Number(m[2]) : 0;
  const day = m[3] ? Number(m[3]) : 0;
  if (!year) return "";
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
};
const parserCompareSourceDates = (left, right) => {
  const a = parserNormalizeSourceDate(left);
  const b = parserNormalizeSourceDate(right);
  if (!a || !b) return null;
  if (a === b) return 0;
  return a > b ? 1 : -1;
};
const parserParseJsonSafe = (raw, fallback = {}) => {
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(String(raw));
    return parsed && typeof parsed === "object" ? parsed : fallback;
  } catch (_) {
    return fallback;
  }
};
const parserGetSlotMetaMap = (getter) => parserParseJsonSafe(getter ? getter(PARSER_SLOT_META_KEY) : "", {});
const parserGetFreshnessAssessment = ({ key, sourceDate, slotMetaMap }) => {
  const currentMeta = slotMetaMap?.[`field:${key}`] || slotMetaMap?.[key] || null;
  const currentSourceDate = currentMeta?.source_date || "";
  const cmp = parserCompareSourceDates(sourceDate, currentSourceDate);
  if (cmp === null) return { status: "unknown", note: "" };
  if (cmp < 0) return { status: "older", note: `Источник старше текущего значения (${sourceDate || "без даты"} < ${currentSourceDate || "без даты"})` };
  if (cmp > 0) return { status: "newer", note: `Источник новее текущего значения (${sourceDate || "без даты"} > ${currentSourceDate || "без даты"})` };
  return { status: "same", note: currentSourceDate ? `Источник той же даты (${currentSourceDate})` : "" };
};
const parserComputeAutoApproveScore = ({
  extractConfidence = 0,
  mergeConfidence = 0,
  sourceTypeScore = 0,
  exactQuoteSupport = false,
  noConflict = true
}) => (
  (((parserClampConfidence(extractConfidence) + parserClampConfidence(mergeConfidence)) / 2) * 0.55)
  + (Math.max(0, Math.min(1, Number(sourceTypeScore) || 0)) * 0.25)
  + ((exactQuoteSupport ? 1 : 0) * 0.15)
  + ((noConflict ? 1 : 0) * 0.05)
);
const parserCanAutoApplyField = ({
  key,
  riskLevel = parserGetRiskLevel(key),
  hasCurrent = false,
  sameAsCurrent = false,
  reviewRequired = false,
  warnings = [],
  freshnessStatus = "unknown",
  extractConfidence = 0,
  mergeConfidence = 0,
  sourceTypeScore = 0,
  exactQuoteSupport = false
}) => {
  if (!key || hasCurrent || sameAsCurrent) return false;
  if (reviewRequired || (warnings || []).length) return false;
  if (freshnessStatus === "older") return false;
  if (riskLevel !== "safe_autofill") return false;
  if (extractConfidence < PARSER_REVIEW_THRESHOLD || mergeConfidence < PARSER_REVIEW_THRESHOLD) return false;
  if (sourceTypeScore < 0.75) return false;
  return parserComputeAutoApproveScore({
    extractConfidence,
    mergeConfidence,
    sourceTypeScore,
    exactQuoteSupport,
    noConflict: !hasCurrent && !sameAsCurrent
  }) >= 0.9;
};
const parserCanAutoApplyLab = ({
  sameDateExists = false,
  reviewRequired = false,
  warnings = [],
  extractConfidence = 0,
  mergeConfidence = 0,
  sourceTypeScore = 0,
  exactQuoteSupport = false
}) => {
  if (sameDateExists || reviewRequired || (warnings || []).length) return false;
  if (extractConfidence < PARSER_REVIEW_THRESHOLD || mergeConfidence < PARSER_REVIEW_THRESHOLD) return false;
  if (sourceTypeScore < 0.8) return false;
  return parserComputeAutoApproveScore({
    extractConfidence,
    mergeConfidence,
    sourceTypeScore,
    exactQuoteSupport,
    noConflict: true
  }) >= 0.88;
};
const PARSER_RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    fields: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          key: { type: "string", enum: PARSER_ALLOWED_KEYS },
          string_value: { type: ["string", "null"] },
          number_value: { type: ["number", "null"] },
          extract_confidence: { type: "number", minimum: 0, maximum: 1 },
          merge_confidence: { type: "number", minimum: 0, maximum: 1 },
          evidence: { type: "string" },
          source_label: { type: "string" },
          source_fragment: { type: "string" },
          source_date: { type: ["string", "null"] },
          note: { type: ["string", "null"] },
          review_required: { type: "boolean" }
        },
        required: ["key", "string_value", "number_value", "extract_confidence", "merge_confidence", "evidence", "source_label", "source_fragment", "source_date", "note", "review_required"]
      }
    },
    conflicts: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          key: { type: "string", enum: PARSER_ALLOWED_KEYS },
          reason: { type: "string" },
          suggested_index: { type: "integer", minimum: 0 },
          options: {
            type: "array",
            minItems: 2,
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                string_value: { type: ["string", "null"] },
                number_value: { type: ["number", "null"] },
                extract_confidence: { type: "number", minimum: 0, maximum: 1 },
                merge_confidence: { type: "number", minimum: 0, maximum: 1 },
                evidence: { type: "string" },
                source_label: { type: "string" },
                source_fragment: { type: "string" },
                source_date: { type: ["string", "null"] },
                note: { type: ["string", "null"] }
              },
              required: ["string_value", "number_value", "extract_confidence", "merge_confidence", "evidence", "source_label", "source_fragment", "source_date", "note"]
            }
          }
        },
        required: ["key", "reason", "suggested_index", "options"]
      }
    },
    lab_batches: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          date: { type: "string" },
          json_payload: { type: "string" },
          extract_confidence: { type: "number", minimum: 0, maximum: 1 },
          merge_confidence: { type: "number", minimum: 0, maximum: 1 },
          evidence: { type: "string" },
          source_label: { type: "string" },
          source_fragment: { type: "string" },
          source_date: { type: ["string", "null"] },
          note: { type: ["string", "null"] },
          review_required: { type: "boolean" }
        },
        required: ["date", "json_payload", "extract_confidence", "merge_confidence", "evidence", "source_label", "source_fragment", "source_date", "note", "review_required"]
      }
    },
    warnings: {
      type: "array",
      items: { type: "string" }
    }
  },
  required: ["fields", "conflicts", "lab_batches", "warnings"]
};
const TNM_STAGE_REVIEW_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    suggested_stage: { type: ["string", "null"] },
    updated_diagnosis: { type: ["string", "null"] },
    reason: { type: "string" },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    review_required: { type: "boolean" }
  },
  required: ["suggested_stage", "updated_diagnosis", "reason", "confidence", "review_required"]
};
const PARSER_REVIEW_APPENDIX = `

ФОРМАТ ОТВЕТА:
1. Верни объект строго по JSON Schema.
2. Поле fields: только извлечённые и реально найденные поля. Не добавляй поле, если оно не определялось.
3. Для каждого элемента fields:
- key: имя поля
- string_value: строковое значение, если поле строковое/текстовое/дата
- number_value: числовое значение, если поле числовое
- extract_confidence: число от 0 до 1, насколько точно значение извлечено из документа
- merge_confidence: число от 0 до 1, насколько безопасно объединять/записывать это значение в текущую карту
- evidence: короткое пояснение, почему выбрано именно это значение
- source_label: кратко укажи источник, например "вставленный документ", "диагноз документа", "лабораторный блок"
- source_fragment: короткая дословная цитата из текста документа, на которой основан вывод
- source_date: дата документа/события/исследования, если её можно понять
- note: краткое пояснение или null
- review_required: true, если есть сомнение, конфликт контекста, неполная дата или двусмысленность
4. Поле conflicts: только реальные противоречия, которые нельзя безопасно разрешить.
5. Поле lab_batches: по одной записи на каждую дату лабораторных данных. json_payload должен быть строкой с JSON-объектом анализов за эту дату.
6. Если уверенность низкая, но значение всё же вероятно, верни его в fields с review_required=true.
7. Для дат соблюдай форматы:
- yyyy-MM-dd для полной даты
- yyyy-MM или yyyy для db_date_dx и db_date_prog
8. Не возвращай лишних полей.`;
const PARSER_SYSTEM_PROMPT = `${PARSER_PROMPT}\n${PARSER_REVIEW_APPENDIX}`;
const getParserFieldLabel = (key) => PARSER_LABELS[key] || key;
const parseOpenRouterJsonContent = (messageContent) => {
  if (typeof messageContent === "string") return JSON.parse(messageContent);
  if (Array.isArray(messageContent)) {
    const text = messageContent.map(part => typeof part === "string" ? part : (part?.text || "")).join("").trim();
    return JSON.parse(text);
  }
  if (messageContent && typeof messageContent === "object") return messageContent;
  throw new Error("Пустой ответ модели");
};
const parserValueToString = (value) => {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value, null, 2);
};
const parserNormalizeKey = (key) => {
  if (key === "ECOG" || key === "ecog" || key === "ECOG статус" || key === "ECOG_status") return "ECOG_статус";
  return key;
};
const parserValueEquals = (a, b) => {
  const sa = parserValueToString(a).replace(/\s+/g, " ").trim();
  const sb = parserValueToString(b).replace(/\s+/g, " ").trim();
  return sa === sb;
};
const parserClampConfidence = (value, fallback = 0) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(1, n));
};
const parserGetExtractConfidence = (item, fallback = 0) => {
  const legacy = parserClampConfidence(item?.confidence, fallback);
  return parserClampConfidence(item?.extract_confidence, legacy);
};
const parserGetMergeConfidence = (item, fallback = 0) => {
  const extract = parserGetExtractConfidence(item, fallback);
  return parserClampConfidence(item?.merge_confidence, extract);
};
const parserNormalizeSourceLabel = (value) => {
  const text = String(value || "").trim();
  return text || "Вставленный документ";
};
const parserNormalizeSourceFragment = (fragment, evidence = "") => {
  const text = String(fragment || "").trim();
  if (text) return text;
  return String(evidence || "").trim();
};
const parserMetaFromRaw = (rawItem) => {
  const extractConfidence = parserGetExtractConfidence(rawItem, 0);
  const mergeConfidence = parserGetMergeConfidence(rawItem, extractConfidence);
  return {
    extract_confidence: extractConfidence,
    merge_confidence: mergeConfidence,
    confidence: extractConfidence,
    evidence: String(rawItem?.evidence || "").trim(),
    source_label: parserNormalizeSourceLabel(rawItem?.source_label),
    source_fragment: parserNormalizeSourceFragment(rawItem?.source_fragment, rawItem?.evidence),
    source_date: rawItem?.source_date ? String(rawItem.source_date).trim() : "",
    note: rawItem?.note ? String(rawItem.note).trim() : "",
    review_required: !!rawItem?.review_required
  };
};
const parserNormalizeProstateTerminology = (value) => String(value || "")
  .replace(/(^|[^A-Za-zА-Яа-яЁё])Ацинарная\s+аденокарцинома(?=$|[^A-Za-zА-Яа-яЁё])/gi, "$1Аденокарцинома")
  .replace(/(^|[^A-Za-zА-Яа-яЁё])Ацинозная\s+аденокарцинома(?=$|[^A-Za-zА-Яа-яЁё])/gi, "$1Аденокарцинома");
const parserCoerceValue = (key, rawValue, helpers = {}) => {
  if (rawValue === null || rawValue === undefined || rawValue === "") return null;
  let value = rawValue;
  if (typeof value === "string") value = value.trim();
  if (key === "ECOG_статус" || key === "db_ecog_last") return helpers.normalizeEcog ? helpers.normalizeEcog(value) : value;
  if (PARSER_INTEGER_KEYS.has(key)) {
    const n = Number(String(value).replace(",", "."));
    return Number.isFinite(n) ? Math.round(n) : value;
  }
  if (PARSER_FLOAT_KEYS.has(key)) {
    const n = Number(String(value).replace(",", "."));
    return Number.isFinite(n) ? n : value;
  }
  if (key === "db_chemo_regimen") return helpers.normalizeHistoryText ? helpers.normalizeHistoryText(value, "chemo") : value;
  if (key === "db_prior_treatment") return helpers.normalizeHistoryText ? helpers.normalizeHistoryText(value, "generic") : value;
  if (key === "db_hormonal_drug" || key === "db_targeted_drug" || key === "db_immunotherapy_drug") return helpers.normalizeDrugNames ? helpers.normalizeDrugNames(value) : value;
  if (key === "db_other_biomarkers") return helpers.normalizeHistoryText ? helpers.normalizeHistoryText(value, "generic") : value;
  if (key === "db_histotype") return parserNormalizeProstateTerminology(value);
  if (key === "Диагноз") return helpers.normalizeDiagnosisText ? helpers.normalizeDiagnosisText(parserNormalizeProstateTerminology(value)) : parserNormalizeProstateTerminology(value);
  return value;
};
const parserValidateValue = (key, value) => {
  const warnings = [];
  let next = value;
  if (next === null || next === undefined || next === "") return { value: null, warnings };
  const s = String(next);
  const num = Number(String(next).replace(",", "."));
  const pushWarn = (msg) => warnings.push(msg);
  if (key === "Дата_рождения" || key === "db_date_death" || key === "db_date_last_contact") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) pushWarn("Ожидался формат yyyy-MM-dd");
  }
  if (key === "db_date_dx" || key === "db_date_prog") {
    if (!/^\d{4}(?:-\d{2})?$/.test(s)) pushWarn("Ожидался формат yyyy-MM или yyyy");
  }
  if (key === "db_stage" && !/^(?:I|II|III|IV)(?:A|B|C)?$/i.test(s)) pushWarn("Необычный формат стадии");
  if (key === "db_t" && !/^(?:is|x|[0-4][a-c]?)$/i.test(s)) pushWarn("Необычный формат T");
  if (key === "db_n" && !/^(?:x|[0-3][a-c]?)$/i.test(s)) pushWarn("Необычный формат N");
  if (key === "db_m" && !/^(?:x|[01][a-c]?)$/i.test(s)) pushWarn("Необычный формат M");
  if (key === "db_er" || key === "db_pr") {
    if (!Number.isFinite(num) || num < 0 || num > 8) pushWarn("ER/PR должны быть в диапазоне 0–8");
  }
  if (key === "db_her2") {
    if (!Number.isFinite(num) || num < 0 || num > 3) pushWarn("HER2 должен быть 0–3");
  }
  if (key === "db_ki67") {
    if (!Number.isFinite(num) || num < 0 || num > 100) pushWarn("Ki67 должен быть в диапазоне 0–100");
  }
  if (key === "ECOG_статус" || key === "db_ecog_last") {
    if (!Number.isFinite(num) || num < 0 || num > 4) pushWarn("ECOG должен быть в диапазоне 0–4");
  }
  if (PARSER_BINARY_KEYS.has(key)) {
    if (!Number.isFinite(num) || ![0, 1].includes(Math.round(num))) pushWarn("Ожидалось значение 0 или 1");
    else next = Math.round(num);
  }
  if (key === "db_prog_type") {
    if (!Number.isFinite(num) || num < 1 || num > 4) pushWarn("Тип прогрессирования должен быть 1–4");
  }
  if (key === "db_mol_subtype") {
    if (!Number.isFinite(num) || num < 1 || num > 5) pushWarn("Подтип должен быть 1–5");
  }
  if (key === "db_chemo_regimen" || key === "db_prior_treatment") {
    if (/\b\d+(?:[.,]\d+)?\s*(?:мг\/м2|мг|г|мкг|мл)\b/i.test(s)) pushWarn("Обнаружены дозировки — проверьте нормализацию");
  }
  return { value: next, warnings };
};
const parserParseLabBatch = (batch) => {
  const raw = String(batch?.json_payload || "").trim();
  if (!raw) throw new Error("Пустой JSON лабораторных");
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Лабораторные должны быть JSON-объектом");
  const clean = {};
  Object.entries(parsed).forEach(([k, v]) => {
    if (v === null || v === "") return;
    clean[k] = v;
  });
  const date = normalizeLabDateKey(batch?.date || clean.Дата);
  if (!date) throw new Error("Не удалось определить дату лабораторных");
  clean.Дата = date;
  return clean;
};

const parserExtractDiagnosisTnmStage = (diagnosisText) => {
  const text = String(diagnosisText || "").trim();
  const firstLine = text.split("\n").map(line => line.trim()).find(Boolean) || text;
  const compactTnm = firstLine.match(/([cpyr]?T(?:is|[0-4X][a-c]?))\s*N([0-3X][a-c]?)\s*M([01X][a-c]?)/i);
  const tFull = compactTnm?.[1] || firstLine.match(/([cpyr]?T(?:is|[0-4X][a-c]?))(?=N|[^A-Za-zА-Яа-яЁё0-9]|$)/i)?.[1] || "";
  const tPrefix = tFull.match(/^([cpyr]?)/i)?.[1] || "";
  const tVal = tFull ? tFull.replace(/^[cpyr]?T/i, "") : "";
  const nVal = compactTnm?.[2] || firstLine.match(/N([0-3X][a-c]?)(?=M|[^A-Za-zА-Яа-яЁё0-9]|$)/i)?.[1] || "";
  const mVal = compactTnm?.[3] || firstLine.match(/M([01X][a-c]?)(?=[^A-Za-zА-Яа-яЁё0-9]|$)/i)?.[1] || "";
  const stage = firstLine.match(PARSER_STAGE_PHRASE_CAPTURE_RE)?.[1] || "";
  return { firstLine, tPrefix, tVal, nVal, mVal, stage };
};

const parserPatchDiagnosisTnmStage = (diagnosisText, nextState) => {
  const text = String(diagnosisText || "").trim();
  if (!text) return "";
  const lines = text.split("\n");
  const firstIdx = lines.findIndex(line => String(line).trim());
  if (firstIdx < 0) return text;
  let firstLine = String(lines[firstIdx] || "").trim();
  const prefix = nextState?.prefix ?? parserExtractDiagnosisTnmStage(firstLine).tPrefix ?? "c";
  const tnmParts = [];
  if (nextState?.t) tnmParts.push(`${prefix}T${nextState.t}`);
  if (nextState?.n) tnmParts.push(`N${nextState.n}`);
  if (nextState?.m) tnmParts.push(`M${nextState.m}`);
  const nextTnm = tnmParts.join("");
  if (nextTnm) {
    if (/\b[cpyr]?T(?:is|[0-4X][a-c]?)[^.\n,;]*N(?:[0-3X][a-c]?)[^.\n,;]*M(?:[01X][a-c]?)\b/i.test(firstLine)) {
      firstLine = firstLine.replace(/\b[cpyr]?T(?:is|[0-4X][a-c]?)[^.\n,;]*N(?:[0-3X][a-c]?)[^.\n,;]*M(?:[01X][a-c]?)\b/i, nextTnm);
    } else if (/,?\s*G[1-4]\b/i.test(firstLine)) {
      firstLine = firstLine.replace(/,?\s*G[1-4]\b/i, `, ${nextTnm}, $&`.replace(", ,", ","));
    } else {
      firstLine = `${firstLine.replace(/\.+$/, "")}, ${nextTnm}`;
    }
  }
  if (nextState?.stage) {
    if (PARSER_STAGE_PHRASE_RE.test(firstLine)) {
      firstLine = firstLine.replace(PARSER_STAGE_PHRASE_RE, match => match.replace(/(?:I|II|III|IV)(?:A|B|C)?/i, `${nextState.stage}`));
    } else {
      firstLine = `${firstLine.replace(/\.+$/, "")}, ${nextState.stage} стадия`;
    }
  }
  lines[firstIdx] = firstLine;
  return lines.join("\n");
};

const parserNormalizeDiagnosisInlineText = (value) => String(value ?? "")
  .replace(/\r?\n+/g, " ")
  .replace(/[•●]/g, " ")
  .replace(/\*\*/g, "")
  .replace(/\s{2,}/g, " ")
  .replace(/\s+([,.;:])/g, "$1")
  .replace(/([,.;:])(?=\S)/g, (match, punct, offset, source) => {
    const prev = source[offset - 1] || "";
    const next = source[offset + 1] || "";
    if (punct === "." && /\d/.test(prev) && /\d/.test(next)) return ".";
    return `${punct} `;
  })
  .trim();

const parserSplitDiagnosisSentences = (value) => parserNormalizeDiagnosisInlineText(value)
  .split(/\.\s+(?=[А-ЯA-Z0-9С])/u)
  .map(part => part.trim().replace(/\.$/, ""))
  .filter(Boolean);

const parserDiagnosisEventStamp = (part) => {
  const text = String(part || "").trim();
  let match = text.match(/^(\d{2})\.(\d{2})\.(\d{4})/);
  if (match) return Number(`${match[3]}${match[2]}${match[1]}`);
  match = text.match(/^С\s+(\d{2})\.(\d{2})\.(\d{4})/i);
  if (match) return Number(`${match[3]}${match[2]}${match[1]}`);
  match = text.match(/^(\d{2})\.(\d{4})/);
  if (match) return Number(`${match[2]}${match[1]}00`);
  match = text.match(/^С\s+(\d{2})\.(\d{4})/i);
  if (match) return Number(`${match[2]}${match[1]}00`);
  match = text.match(/^(\d{4})/);
  if (match) return Number(`${match[1]}0000`);
  match = text.match(/^С\s+(\d{4})/i);
  if (match) return Number(`${match[1]}0000`);
  return null;
};

const parserSplitDiagnosisHeadAndEvents = (parts) => {
  const list = Array.isArray(parts) ? parts.filter(Boolean) : [];
  const eventIdx = list.findIndex(part => parserDiagnosisEventStamp(part) !== null);
  if (eventIdx < 0) return { head: list, events: [] };
  return { head: list.slice(0, eventIdx), events: list.slice(eventIdx) };
};

const parserMergeDistinctSegments = (baseParts, nextParts) => {
  const normalize = (text) => String(text || "").replace(/\s+/g, " ").trim().toLowerCase();
  const result = Array.isArray(baseParts) ? [...baseParts] : [];
  const norms = result.map(normalize);
  for (const part of Array.isArray(nextParts) ? nextParts : []) {
    const norm = normalize(part);
    if (!norm) continue;
    const idx = norms.findIndex(existing => existing === norm || existing.includes(norm) || norm.includes(existing));
    if (idx < 0) {
      result.push(part);
      norms.push(norm);
      continue;
    }
    if (norm.length > norms[idx].length) {
      result[idx] = part;
      norms[idx] = norm;
    }
  }
  return result;
};

const parserBuildDiagnosisText = (parts) => {
  const list = (Array.isArray(parts) ? parts : [])
    .map(part => parserNormalizeDiagnosisInlineText(part).replace(/\.$/, ""))
    .filter(Boolean);
  return list.length ? `${list.join(". ")}.` : "";
};

const parserHasTreatmentEvidence = (text) => /(?:^|[^A-Za-zА-Яа-яЁё])(?:ПХТ|МХТ|ХТ|ЛТ|ДЛТ|ХЛТ|АДТ)(?:[^A-Za-zА-Яа-яЁё]|$)|лучев[а-я\s-]*терап|брахитерап|стереотакс|операц|резекц|лобэктом|лимфодиссекц|мастэктом|биопси|гормонотерап|таргетн|иммунотерап|дегареликс|гозерелин|тамоксифен|летрозол|палбоциклиб|осимертиниб|гефитиниб|капецитабин|цисплатин|карбоплатин|паклитаксел|folfox|folfiri|folfirinox/i.test(String(text || ""));

const parserHasProgressionEvidence = (text) => /(?:прогрессир|прогрессия|прогрессирование|отдал[её]нн[а-я\s-]*метаст|метастаз[а-я\s-]*в|множественн[а-я\s-]*метаст|новые\s+метаст|дистанционн[а-я\s-]*метаст)/i.test(String(text || ""));

const parserPreserveInitialDiagnosisLine = (currentDiagnosis, incomingDiagnosis) => {
  const currentParts = parserSplitDiagnosisSentences(currentDiagnosis);
  const incomingParts = parserSplitDiagnosisSentences(incomingDiagnosis);
  if (!currentParts.length) return parserBuildDiagnosisText(incomingParts);
  if (!incomingParts.length) return parserBuildDiagnosisText(currentParts);
  const currentSplit = parserSplitDiagnosisHeadAndEvents(currentParts);
  const incomingSplit = parserSplitDiagnosisHeadAndEvents(incomingParts);
  const header = currentSplit.head.length ? currentSplit.head : currentParts.slice(0, 1);
  const mergedEvents = parserMergeDistinctSegments(currentSplit.events, incomingSplit.events)
    .map((part, index) => ({ part, index, stamp: parserDiagnosisEventStamp(part) ?? Number.MAX_SAFE_INTEGER }))
    .sort((left, right) => left.stamp === right.stamp ? left.index - right.index : left.stamp - right.stamp)
    .map(item => item.part);
  return parserBuildDiagnosisText([...header, ...mergedEvents]);
};

const parserShouldKeepHistoricalStage = ({
  currentState,
  proposedState,
  currentDiagnosis,
  proposedDiagnosis,
  sourceText,
  getDraftValue = null
}) => {
  const readDraft = typeof getDraftValue === "function" ? getDraftValue : () => "";
  const hasCurrentStage = !!String(currentState?.stage || currentState?.t || currentState?.n || currentState?.m || "").trim();
  if (!hasCurrentStage) return false;
  const changed = ["t", "n", "m", "stage"].some(key => !parserValueEquals(proposedState?.[key], currentState?.[key]));
  if (!changed) return false;
  const treatmentStarted = !!String(readDraft("Дата_начала_лечения") || "").trim()
    || parserHasTreatmentEvidence(currentDiagnosis)
    || parserHasTreatmentEvidence(proposedDiagnosis)
    || parserHasTreatmentEvidence(sourceText)
    || !!String(readDraft("db_prior_treatment") || "").trim()
    || !!String(readDraft("db_chemo_regimen") || "").trim();
  const progressionMentioned = parserHasProgressionEvidence(sourceText)
    || parserHasProgressionEvidence(proposedDiagnosis)
    || parserHasProgressionEvidence(currentDiagnosis)
    || Number(readDraft("db_progression")) === 1;
  return treatmentStarted && progressionMentioned;
};

const parserApplyHistoricalStageGuard = ({ fields, conflicts, warnings, sourceText, getCurrentValue, getDraftValue = null }) => {
  const readCurrent = typeof getCurrentValue === "function" ? getCurrentValue : () => "";
  const currentDiagnosis = String(readCurrent("Диагноз") || "");
  const currentSummary = parserExtractDiagnosisTnmStage(currentDiagnosis);
  const currentState = {
    t: String(readCurrent("db_t") || currentSummary.tVal || ""),
    n: String(readCurrent("db_n") || currentSummary.nVal || ""),
    m: String(readCurrent("db_m") || currentSummary.mVal || ""),
    stage: String(readCurrent("db_stage") || currentSummary.stage || "")
  };
  const safeFields = Array.isArray(fields) ? fields : [];
  const diagnosisField = safeFields.find(item => item.key === "Диагноз");
  const proposedDiagnosis = String(diagnosisField?.value || "");
  const proposedState = {
    t: String(safeFields.find(item => item.key === "db_t")?.value || currentState.t || ""),
    n: String(safeFields.find(item => item.key === "db_n")?.value || currentState.n || ""),
    m: String(safeFields.find(item => item.key === "db_m")?.value || currentState.m || ""),
    stage: String(safeFields.find(item => item.key === "db_stage")?.value || currentState.stage || "")
  };
  if (!parserShouldKeepHistoricalStage({ currentState, proposedState, currentDiagnosis, proposedDiagnosis, sourceText, getDraftValue })) {
    return { fields, conflicts, warnings, policy_trace: [] };
  }
  const stageKeys = new Set(["db_t", "db_n", "db_m", "db_stage"]);
  const nextWarnings = [...new Set([...(warnings || []), "Историческое стадирование сохранено: после начала лечения и прогрессирования парсер не рестадирует диагноз, а оставляет исходные TNM/стадию."])];
  const nextFields = safeFields.map(item => {
    if (!item?.key) return item;
    if (stageKeys.has(item.key)) {
      const currentValue = currentState[item.key === "db_stage" ? "stage" : item.key.replace("db_", "")];
      if (currentValue && !parserValueEquals(item.value, currentValue)) return null;
      return item;
    }
    if (item.key === "Диагноз" && currentDiagnosis) {
      return {
        ...item,
        value: parserPreserveInitialDiagnosisLine(currentDiagnosis, item.value),
        note: [item.note, "Историческая преамбула диагноза сохранена из исходного стадирования."].filter(Boolean).join(" "),
        warnings: [...new Set([...(item.warnings || []), "Историческая преамбула диагноза сохранена без рестадирования"])]
      };
    }
    return item;
  }).filter(Boolean);
  const nextConflicts = (Array.isArray(conflicts) ? conflicts : []).map(conflict => {
    if (!conflict?.key) return conflict;
    if (stageKeys.has(conflict.key)) return null;
    if (conflict.key === "Диагноз" && currentDiagnosis) {
      return {
        ...conflict,
        options: (conflict.options || []).map(opt => ({
          ...opt,
          value: parserPreserveInitialDiagnosisLine(currentDiagnosis, opt.value),
          warnings: [...new Set([...(opt.warnings || []), "Историческая преамбула диагноза сохранена без рестадирования"])]
        }))
      };
    }
    return conflict;
  }).filter(Boolean);
  return {
    fields: nextFields,
    conflicts: nextConflicts,
    warnings: nextWarnings,
    policy_trace: [{
      type: "historical_stage_guard",
      action: "preserve_initial_stage",
      reason: "После начала лечения и прогрессирования стадия/TNM остаются историческими, прогрессирование отражается отдельно.",
      current_state: currentState,
      blocked_keys: ["db_t", "db_n", "db_m", "db_stage"]
    }]
  };
};




const getSuspiciousLabValues = (entries) => {
  const labRefCheck = {
    Лейкоциты: 9, Нейтрофилы: 7.7, Лимфоциты: 4.5, Эозинофилы: 0.54, Базофилы: 0.08,
    Эритроциты: 5.5, Гемоглобин: 160, Тромбоциты: 400, МНО: 1.07, АЧТВ: 36,
    ТВ: 16.6, ПТВ: 12.2, АЛТ: 40, АСТ: 40, ЩФ: 120, ГГТ: 61, Билирубин: 20.5,
    Креатинин: 115, Мочевина: 7.2, Глюкоза: 6.1
  };
  const suspicious = [];
  (entries || []).forEach(entry => {
    Object.entries(entry || {}).forEach(([k, v]) => {
      if (k === "Дата" || typeof v !== "number") return;
      const maxRef = labRefCheck[k];
      if (maxRef && v > maxRef * 8) suspicious.push(`${k}=${v}`);
    });
  });
  return suspicious;
};

const LAB_GROUPS = [
  {
    name: "🩸 Клинический анализ крови", color: "#1565c0", params: {
      Лейкоциты: { min: 4.0, max: 9.0, unit: "×10⁹/л" },
      Нейтрофилы: { min: 1.8, max: 7.7, unit: "×10⁹/л" },
      Лимфоциты: { min: 1.0, max: 4.5, unit: "×10⁹/л" },
      Моноциты: { min: 0.12, max: 0.99, unit: "×10⁹/л" },
      Эозинофилы: { min: 0.04, max: 0.54, unit: "×10⁹/л" },
      Базофилы: { min: 0.01, max: 0.08, unit: "×10⁹/л" },
      Эритроциты: { min: 3.8, max: 5.5, unit: "×10¹²/л" },
      Гемоглобин: { min: 120, max: 160, unit: "г/л" },
      Гематокрит: { min: 37, max: 51, unit: "%" },
      Тромбоциты: { min: 150, max: 400, unit: "×10⁹/л" },
      СОЭ: { min: 2, max: 30, unit: "мм/ч" },
    }
  },
  {
    name: "🧪 Биохимия", color: "#6a1b9a", params: {
      АЛТ: { min: 5, max: 40, unit: "Ед/л" },
      АСТ: { min: 5, max: 40, unit: "Ед/л" },
      ЩФ: { min: 30, max: 120, unit: "Ед/л" },
      ГГТ: { min: 8, max: 61, unit: "Ед/л" },
      Билирубин: { min: 3.4, max: 20.5, unit: "мкмоль/л" },
      Бил_прям: { min: 0.5, max: 5.1, unit: "мкмоль/л" },
      Общий_белок: { min: 64, max: 83, unit: "г/л" },
      Мочевина: { min: 2.8, max: 7.2, unit: "мМоль/л" },
      Креатинин: { min: 44, max: 115, unit: "мкмоль/л" },
      Глюкоза: { min: 3.9, max: 6.1, unit: "мМоль/л" },
      Натрий: { min: 136, max: 145, unit: "мМоль/л" },
      Калий: { min: 3.5, max: 5.1, unit: "мМоль/л" },
    }
  },
  {
    name: "🔴 Коагулограмма", color: "#b71c1c", params: {
      МНО: { min: 0.81, max: 1.07, unit: "" },
      АЧТВ: { min: 24, max: 36, unit: "с" },
      ТВ: { min: 10.3, max: 16.6, unit: "с" },
      ПТВ: { min: 9.2, max: 12.2, unit: "с" },
      Д_димер: { min: 109, max: 560, unit: "нг/мл" },
    }
  },
  {
    name: "🎯 Онкомаркеры", color: "#e65100", params: {
      ПСА: { min: 0, max: 4, unit: "нг/мл" },
      РЭА: { min: 0, max: 5, unit: "нг/мл" },
      СА_19_9: { min: 0, max: 30, unit: "Ед/мл" },
      СА_125: { min: 0, max: 35, unit: "Ед/мл" },
      АФП: { min: 0, max: 8.1, unit: "МЕ/мл" },
      СА_15_3: { min: 0, max: 26.9, unit: "Ед/мл" },
    }
  },
  {
    name: "💛 Анализ мочи", color: "#f9a825", params: {
      Уробилиноген_м: { min: 0, max: 34, unit: "мкмоль/л" },
      Удельный_вес_м: { min: 1.003, max: 1.030, unit: "" },
      pH_мочи: { min: 5.0, max: 7.5, unit: "" },
      Лейкоциты_мочи: { min: 0, max: 25, unit: "/мкл" },
      Белок_мочи: { min: 0, max: 0.15, unit: "г/л" },
      Билирубин_мочи: { qualitative: true, unit: "" },
      Глюкоза_мочи: { qualitative: true, unit: "" },
      Кровь_мочи: { qualitative: true, unit: "" },
      Кетоны_мочи: { qualitative: true, unit: "" },
      Нитриты_мочи: { qualitative: true, unit: "" },
    }
  },
];
const LAB_CHART_COLORS = ["#1e88e5", "#43a047", "#e53935", "#fb8c00", "#8e24aa", "#00897b", "#f4511e", "#3949ab", "#d81b60", "#00acc1", "#c0ca33", "#6d4c41"];

const TREATMENT_TEMPLATES = [
  // ── Рак молочной железы ────────────────────────────────────────────────
  {
    category: "Рак молочной железы", name: "Рак левой молочной железы", цель: "Послеоперационный курс", теги: ["РМЖ", "Длинный_курс", "ДС"],
    ptv1: { Название: "PTV L", Область_облучения: "Левая молочная железа", РОД: 2.67, Количество_фракций: 15, Фракционирование: "Стандартный" }, extra: []
  },
  {
    category: "Рак молочной железы", name: "Рак правой молочной железы", цель: "Послеоперационный курс", теги: ["РМЖ", "Длинный_курс", "ДС"],
    ptv1: { Название: "PTV R", Область_облучения: "Правая молочная железа", РОД: 2.67, Количество_фракций: 15, Фракционирование: "Стандартный" }, extra: []
  },
  {
    category: "Рак молочной железы", name: "Рак левой молочной железы (Fast forward)", цель: "Послеоперационный курс", теги: ["РМЖ", "Fast_forward", "ДС"],
    ptv1: { Название: "PTV L", Область_облучения: "Левая молочная железа", РОД: 5.2, Количество_фракций: 5, Фракционирование: "Стандартный" }, extra: []
  },
  {
    category: "Рак молочной железы", name: "Рак правой молочной железы (Fast forward)", цель: "Послеоперационный курс", теги: ["РМЖ", "Fast_forward", "ДС"],
    ptv1: { Название: "PTV R", Область_облучения: "Правая молочная железа", РОД: 5.2, Количество_фракций: 5, Фракционирование: "Стандартный" }, extra: []
  },
  {
    category: "Рак молочной железы", name: "Рак левой молочной железы + Л/У", цель: "Послеоперационный курс", теги: ["РМЖ", "Длинный_курс", "ДС"],
    ptv1: { Название: "PTV L", Область_облучения: "Левая молочная железа", РОД: 2.67, Количество_фракций: 15, Фракционирование: "Стандартный" },
    extra: [{ Название: "PTV N", Область_облучения: "Зоны регионарного лимфооттока (аксиллярные, подключичные, надключичные лимфатические узлы)", РОД: 2.67, Количество_фракций: 15, Фракционирование: "Стандартный", Связь: "Параллельно" }]
  },
  {
    category: "Рак молочной железы", name: "Рак правой молочной железы + Л/У", цель: "Послеоперационный курс", теги: ["РМЖ", "Длинный_курс", "ДС"],
    ptv1: { Название: "PTV R", Область_облучения: "Правая молочная железа", РОД: 2.67, Количество_фракций: 15, Фракционирование: "Стандартный" },
    extra: [{ Название: "PTV N", Область_облучения: "Зоны регионарного лимфооттока (аксиллярные, подключичные, надключичные лимфатические узлы)", РОД: 2.67, Количество_фракций: 15, Фракционирование: "Стандартный", Связь: "Параллельно" }]
  },

  // ── Рак предстательной железы ──────────────────────────────────────────
  {
    category: "Рак предстательной железы", name: "Рак предстательной железы (Длинный курс)", цель: "Радикальный курс", теги: ["РПЖ", "Длинный_курс", "ДС"],
    ptv1: { Название: "PTV 70", Область_облучения: "Предстательная железа, семенные пузырьки", РОД: 2.5, Количество_фракций: 28, Фракционирование: "Стандартный" }, extra: []
  },
  {
    category: "Рак предстательной железы", name: "Рак предстательной железы + Л/У (Длинный курс)", цель: "Радикальный курс", теги: ["РПЖ", "Длинный_курс", "ДС"],
    ptv1: { Название: "PTV 70", Область_облучения: "Предстательная железа, семенные пузырьки", РОД: 2.5, Количество_фракций: 28, Фракционирование: "Стандартный" },
    extra: [{ Название: "PTV 50.4", Область_облучения: "Зоны регионарного лимфооттока (общие, наружные, внутренние подвздошные и запирательные лимфатические узлы)", РОД: 1.8, Количество_фракций: 28, Фракционирование: "Стандартный", Связь: "Параллельно" }]
  },
  {
    category: "Рак предстательной железы", name: "Рак предстательной железы (SBRT 4 фракции)", цель: "Радикальный курс", теги: ["РПЖ", "SBRT", "ДС"],
    ptv1: { Название: "PTV", Область_облучения: "Предстательная железа, семенные пузырьки", РОД: 9.0, Количество_фракций: 4, Фракционирование: "Через день" }, extra: []
  },
  {
    category: "Рак предстательной железы", name: "Рак предстательной железы (SBRT 5 фракций)", цель: "Радикальный курс", теги: ["РПЖ", "SBRT", "ДС"],
    ptv1: { Название: "PTV", Область_облучения: "Предстательная железа, семенные пузырьки", РОД: 7.25, Количество_фракций: 5, Фракционирование: "Через день" }, extra: []
  },
  {
    category: "Рак предстательной железы", name: "Рак предстательной железы (SBRT 7 фракций)", цель: "Радикальный курс", теги: ["РПЖ", "SBRT", "ДС"],
    ptv1: { Название: "PTV", Область_облучения: "Предстательная железа, семенные пузырьки", РОД: 6.1, Количество_фракций: 7, Фракционирование: "Через день" }, extra: []
  },

  {
    category: "Рак предстательной железы", name: "Рак предстательной железы, ложе + Л/У (Длинный курс)", цель: "Сальважный курс", теги: ["РПЖ", "Длинный_курс", "ДС"],
    ptv1: { Название: "PTV 64.4", Область_облучения: "Ложе предстательной железы", РОД: 2.3, Количество_фракций: 28, Фракционирование: "Стандартный" },
    extra: [
      { Название: "PTV 70", Область_облучения: "Очаг в ложе предстательной железы", РОД: 2.5, Количество_фракций: 28, Фракционирование: "Стандартный", Связь: "Одновременно" },
      { Название: "PTV 50.4", Область_облучения: "Зоны регионарного лимфооттока (общие, наружные, внутренние подвздошные и запирательные лимфатические узлы)", РОД: 1.8, Количество_фракций: 28, Фракционирование: "Стандартный", Связь: "Параллельно" },
    ]
  },

  // ── Рак прямой кишки ───────────────────────────────────────────────────
  {
    category: "Рак прямой кишки", name: "Рак прямой кишки (Короткий курс)", цель: "Предоперационный курс", теги: ["РПК", "ДС"],
    ptv1: { Название: "PTV 25", Область_облучения: "Прямая кишка, мезоректальная клетчатка и зоны регионарного лимфооттока (мезоректальные, пресакральные, внутренние подвздошные лимфатические узлы)", РОД: 5.0, Количество_фракций: 5, Фракционирование: "Стандартный" }, extra: []
  },
  {
    category: "Рак прямой кишки", name: "Рак прямой кишки (Длинный курс, ХЛТ)", цель: "Предоперационный курс", теги: ["РПК", "Длинный_курс", "ХЛТ", "ДС"],
    ptv1: { Название: "PTV 50", Область_облучения: "Прямая кишка, мезоректальная клетчатка", РОД: 2.0, Количество_фракций: 25, Фракционирование: "Стандартный" },
    extra: [{ Название: "PTV 45", Область_облучения: "Зоны регионарного лимфооттока (мезоректальные, пресакральные, внутренние подвздошные лимфатические узлы)", РОД: 1.8, Количество_фракций: 25, Фракционирование: "Стандартный", Связь: "Параллельно" }],
    hlt: { препараты: [{ Препарат: "Капецитабин", Режим: "В дни лучевой терапии" }] }
  },

  // ── Рак легкого ────────────────────────────────────────────────────────
  {
    category: "Рак легкого", name: "Рак лёгкого (Длинный курс)", цель: "Радикальный курс", теги: ["НМРЛ", "Длинный_курс", "ХЛТ", "ДС"],
    ptv1: { Название: "PTV", Область_облучения: "Опухоль лёгкого и поражённые лимфатические узлы с субклиническим отступом", РОД: 2.0, Количество_фракций: 30, Фракционирование: "Стандартный" }, extra: [],
    hlt: { препараты: [{ Препарат: "Паклитаксел + Карбоплатин", Режим: "Еженедельно" }] }
  },
  {
    category: "Рак легкого", name: "Рак лёгкого (Гипофракционирование)", цель: "Радикальный курс", теги: ["НМРЛ", "Гипофракционирование", "ДС"],
    ptv1: { Название: "PTV", Область_облучения: "Опухоль лёгкого и поражённые лимфатические узлы с субклиническим отступом", РОД: 3.0, Количество_фракций: 18, Фракционирование: "Стандартный" }, extra: []
  },

  // ── Рак пищевода ───────────────────────────────────────────────────────
  {
    category: "Рак пищевода", name: "Рак пищевода (Предоперационный)", цель: "Предоперационный курс", теги: ["Рак_пищевода", "ХЛТ", "ДС"],
    ptv1: { Название: "PTV", Область_облучения: "Пищевод", РОД: 1.8, Количество_фракций: 23, Фракционирование: "Стандартный" }, extra: [],
    hlt: { препараты: [{ Препарат: "Паклитаксел + Карбоплатин", Режим: "Еженедельно" }] }
  },
  {
    category: "Рак пищевода", name: "Рак пищевода (Самостоятельный, КС)", цель: "Радикальный курс", теги: ["Рак_пищевода", "ХЛТ", "КС"],
    ptv1: { Название: "PTV", Область_облучения: "Пищевод", РОД: 2.0, Количество_фракций: 25, Фракционирование: "Стандартный" }, extra: [],
    setTag: "КС",
    hlt: { препараты: [{ Препарат: "Паклитаксел + Карбоплатин", Режим: "Еженедельно" }] }
  },
  {
    category: "Рак пищевода", name: "Рак пищевода (Самостоятельный, ДС)", цель: "Радикальный курс", теги: ["Рак_пищевода", "ХЛТ", "ДС"],
    ptv1: { Название: "PTV", Область_облучения: "Пищевод", РОД: 1.8, Количество_фракций: 28, Фракционирование: "Стандартный" }, extra: [],
    setTag: "ДС",
    hlt: { препараты: [{ Препарат: "Паклитаксел + Карбоплатин", Режим: "Еженедельно" }] }
  },

  // ── SBRT ───────────────────────────────────────────────────────────────
  {
    category: "SBRT", name: "SBRT (3 фракции)", цель: "Радикальный курс", теги: ["SBRT", "ДС"],
    ptv1: { Название: "PTV", Область_облучения: null, РОД: 20.0, Количество_фракций: 3, Фракционирование: "Стандартный" }, extra: []
  },
  {
    category: "SBRT", name: "SBRT (5 фракций)", цель: "Радикальный курс", теги: ["SBRT", "ДС"],
    ptv1: { Название: "PTV", Область_облучения: null, РОД: 12.0, Количество_фракций: 5, Фракционирование: "Стандартный" }, extra: []
  },
  {
    category: "SBRT", name: "SBRT (8 фракций)", цель: "Радикальный курс", теги: ["SBRT", "ДС"],
    ptv1: { Название: "PTV", Область_облучения: null, РОД: 7.5, Количество_фракций: 8, Фракционирование: "Стандартный" }, extra: []
  },

  // ── Паллиатив ──────────────────────────────────────────────────────────
  {
    category: "Паллиатив", name: "Паллиативный (1 фракция)", цель: "Паллиативный курс", теги: ["Паллиатив", "ДС"],
    ptv1: { Название: "PTV", Область_облучения: null, РОД: 12.0, Количество_фракций: 1, Фракционирование: "Стандартный" }, extra: []
  },
  {
    category: "Паллиатив", name: "Паллиативный (3 фракции)", цель: "Паллиативный курс", теги: ["Паллиатив", "ДС"],
    ptv1: { Название: "PTV", Область_облучения: null, РОД: 8.0, Количество_фракций: 3, Фракционирование: "Стандартный" }, extra: []
  },
  {
    category: "Паллиатив", name: "Паллиативный (5 фракций)", цель: "Паллиативный курс", теги: ["Паллиатив", "ДС"],
    ptv1: { Название: "PTV", Область_облучения: null, РОД: 5.0, Количество_фракций: 5, Фракционирование: "Стандартный" }, extra: []
  },

  // ── Одиночные шаблоны ─────────────────────────────────────────────────
  {
    category: "Рак анального канала", name: "Рак анального канала (ХЛТ)", цель: "Радикальный курс", теги: ["РАК", "ХЛТ", "ДС"], forceGroup: true,
    ptv1: { Название: "PTV 46", Область_облучения: "Опухоль анального канала, прямая кишка, мезоректальная клетчатка и зоны регионарного лимфооттока (мезоректальные, пресакральные, внутренние и наружные подвздошные, запирательные, поверхностные и глубокие паховые лимфатические узлы)", РОД: 2.0, Количество_фракций: 23, Фракционирование: "Стандартный" },
    extra: [
      { Название: "PTV 50", Область_облучения: null, РОД: 2.0, Количество_фракций: 2, Фракционирование: "Стандартный", Связь: "Последовательный буст" },
      { Название: "PTV 54", Область_облучения: null, РОД: 2.0, Количество_фракций: 2, Фракционирование: "Стандартный", Связь: "Последовательный буст" },
      { Название: "PTV 58", Область_облучения: null, РОД: 2.0, Количество_фракций: 2, Фракционирование: "Стандартный", Связь: "Последовательный буст" },
    ],
    hlt: { препараты: [{ Препарат: "Митомицин С", Режим: "Однократно" }, { Препарат: "Капецитабин", Режим: "В дни лучевой терапии" }] }
  },
  {
    category: "ОВГМ", name: "ОВГМ (10 фракций)", цель: "Паллиативный курс", теги: ["ОВГМ", "Паллиатив", "ДС"],
    ptv1: { Название: "PTV ", Область_облучения: "Весь объем головного мозга", РОД: 3.0, Количество_фракций: 10, Фракционирование: "Стандартный" }, extra: []
  },
  {
    category: "ОВГМ", name: "ОВГМ (5 фракций)", цель: "Паллиативный курс", теги: ["ОВГМ", "Паллиатив", "ДС"],
    ptv1: { Название: "PTV ", Область_облучения: "Весь объем головного мозга", РОД: 4.0, Количество_фракций: 5, Фракционирование: "Стандартный" }, extra: []
  },
];
module.exports = {
  getPatientBadges,
  getPatientFilterHints,
  reminderHasVk,
  getReminderFilterHints,
  getPrescriptionFundingLabel,
  getFundingType,
  getSearchStateAfterInput,
  applyDateSelectionPatch,
  sanitizeFileName,
  normalizeLabDateKey,
  yearsWord,
  calcAgeFromDobIso,
  fundMarkFromGroup,
  buildPatientFileBaseName,
  matchPreset,
  getCardFilterText,
  presetAllowsCard,
  cardMatchesFilter,
  getCardDedupeKey,
  calcPercentMarkupByWorkDays,
  calcPercentContourProgress,
  calcPercentWaitingProgress,
  isOnTreatmentDateIso,
  buildPrescriptionText,
  getModelStats,
  getDesktopTabCounts,
  getSearchOnlyStatus,
  getPlanningStatuses,
  getTreatmentBucket,
  isPlannedDischarge,
  isRecentDischarge,
  parseLegacyConsultOrder,
  getAgeLabel,
  getLegacyConsultTime,
  getConsultSort,
  cleanConsultationFileName,
  getConsultationIdentity,
  compareTodayConsultations,
  compareScheduledConsultations,
  getContourPlan,
  getAdmissionPlan,
  splitVkItems,
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
  isOverdueTreatmentEnd,
  isOverdueInitialMarkup,
  isTodayModelStart,
  isTodayModelEnd,
  isTodayMarkup,
  isTodayRemarkup,
  isOverdueRemarkup,
  hasActiveVkReminder,
  parseHospitalizationSickAction,
  parseRemoveVkAction,
  removeIsoFromDateList,
  getActionIconKey,
  getDischargeSubText,
  getDischargeCardMeta,
  getHospitalizationCardMeta,
  getVkCardMeta,
  getInitialMarkupCardMeta,
  getRemarkupCardMeta,
  splitMarkupCards,
  getDeadlineDisplay,
  getContourCardMeta,
  getSearchOnlyCardMeta,
  getReminderCardMeta,
  getReminderCardState,
  getDueReminderCount,
  getOverdueConsultationCardMeta,
  getTodayConsultationCardMeta,
  getScheduledConsultationCardMeta,
  getActiveReminders,
  getActiveReminderCount,
  hasActiveReminders,
  getReminderBellColor,
  findActiveReminderIndex,
  findActiveReminderValueIndex,
  getMissingDateWarnings,
  getMissingDateWarningText,
  getTreatmentStageMeta,
  getMarkupStageMeta,
  getContourStageMeta,
  getWaitingStageMeta,
  buildVkElnReminderPayload,
  getNextVkElnReminderInfo,
  hasVkReminderOnDate,
  getSortedActiveReminders,
  getReminderRowMeta,
  getPlannedDischargeTimingMeta,
  getTreatmentMethodShort,
  getInpatientShort,
  getPlannedDischargeCardMeta,
  getRecentDischargeCardMeta,
  getStageLabelHtml,
  getProgressSegmentHtml,
  getProgressSegmentsHtml,
  getTreatmentProgressSegmentsHtml,
  mergeTimelineText,
  mergeDistinctParagraphText,
  mergeDistinctListText,
  mergePhoneText,
  DAY_PHRASES,
  buildPatientModel,
  getConsultationRejectPatch,
  getConsultationAcceptPatch,
  getHospitalizationSickPatch,
  getRemarkupDonePatch,
  getSetFlagPatch,
  getAddSkippedDatePatch,
  getDefaultAccelerator,
  getTreatmentTemplateTags,
  getTreatmentTemplatePatch,
  getMedicationTermUiLabel,
  parseMedicationTerm,
  normalizeMedicationAssignments,
  dedupeMedicationAssignments,
  createExtraVolume,
  appendExtraVolume,
  insertExtraVolumeAt,
  removeExtraVolume,
  createTagMap,
  tagMapToList,
  getDsKsTagState,
  setExclusiveDsKsTag,
  toggleTagInMap,
  addTagToMap,
  removeTagFromMap,
  getCustomTagsFromMap,
  getPatientDraftResult,
  isPatientDraftDirty,
  getRemoveVkPatch,
  getAddReminderPatch,
  getAddVkReminderPatch,
  getSnoozeReminderPatch,
  getCompleteReminderPatch,
  getDeleteReminderPatch,
  // AI Parser
  PARSER_PROMPT,
  PARSER_PROMPT_VERSION,
  PARSER_REVIEW_THRESHOLD,
  PARSER_ALLOWED_KEYS,
  PARSER_LABELS,
  PARSER_TEXTAREA_KEYS,
  PARSER_INTEGER_KEYS,
  PARSER_FLOAT_KEYS,
  PARSER_BINARY_KEYS,
  PARSER_SELECT_OPTIONS,
  PARSER_SLOT_META_KEY,
  PARSER_IDENTITY_KEYS,
  PARSER_MERGEABLE_NARRATIVE_KEYS,
  PARSER_SAFE_AUTOFILL_KEYS,
  parserGetRiskLevel,
  parserGetRiskLabel,
  parserRequiresManualReview,
  parserGetSourceTypeScore,
  parserEscapeRegExp,
  parserNormalizeCompareText,
  parserBuildStagePhraseRegex,
  parserBuildTnmPartRegex,
  PARSER_STAGE_PHRASE_CAPTURE_RE,
  PARSER_STAGE_PHRASE_RE,
  parserHasExactQuoteSupport,
  parserNormalizeSourceDate,
  parserCompareSourceDates,
  parserParseJsonSafe,
  parserGetSlotMetaMap,
  parserGetFreshnessAssessment,
  parserComputeAutoApproveScore,
  parserCanAutoApplyField,
  parserCanAutoApplyLab,
  PARSER_RESPONSE_SCHEMA,
  TNM_STAGE_REVIEW_SCHEMA,
  PARSER_REVIEW_APPENDIX,
  PARSER_SYSTEM_PROMPT,
  getParserFieldLabel,
  parseOpenRouterJsonContent,
  parserValueToString,
  parserNormalizeKey,
  parserValueEquals,
  parserClampConfidence,
  parserGetExtractConfidence,
  parserGetMergeConfidence,
  parserNormalizeSourceLabel,
  parserNormalizeSourceFragment,
  parserMetaFromRaw,
  parserNormalizeProstateTerminology,
  parserCoerceValue,
  parserValidateValue,
  parserParseLabBatch,
  parserExtractDiagnosisTnmStage,
  parserPatchDiagnosisTnmStage,
  parserHasTreatmentEvidence,
  parserHasProgressionEvidence,
  parserPreserveInitialDiagnosisLine,
  parserShouldKeepHistoricalStage,
  parserApplyHistoricalStageGuard,
  // Treatment templates, lab data and validation
  TREATMENT_TEMPLATES,
  LAB_GROUPS,
  LAB_CHART_COLORS,
  getSuspiciousLabValues
};
