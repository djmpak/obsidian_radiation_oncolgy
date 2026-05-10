const assert = require("node:assert/strict");
const path = require("node:path");

const desktopCore = require(path.resolve(__dirname, "..", "src", "shared", "desktop-core.cjs"));

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

test("getPatientFilterHints builds searchable hints from tags and flags", () => {
  const hints = desktopCore.getPatientFilterHints({
    file: { tags: ["#ДС", "#КС"] },
    ХЛТ_препараты: [{ Препарат: "цисплатин" }],
    Больничный_лист: true,
    Госпитализация: true
  });

  assert.match(hints, /дс дневной стационар/u);
  assert.match(hints, /кс круглосуточный стационар/u);
  assert.match(hints, /хлт химиолучевая радиомодификация/u);
  assert.match(hints, /элн больничный лист/u);
  assert.match(hints, /госп госпитализация/u);
});

test("getPatientBadges renders chemo, sick leave, inpatient and remark markers", () => {
  const badges = desktopCore.getPatientBadges({
    file: { tags: ["#КС"] },
    Радиомодификация: "цисплатин",
    Больничный_лист: true,
    Переразметки: [{ Дата: "2026-04-01" }, { Дата: "2026-04-10" }]
  });

  assert.match(badges, /🧪/u);
  assert.match(badges, /🤕/u);
  assert.match(badges, /🏥/u);
  assert.match(badges, />2↺<\/span>/u);
  assert.equal(badges.endsWith(" "), true);
});

test("getPatientBadges supports legacy single remark date", () => {
  const badges = desktopCore.getPatientBadges({
    file: { tags: [] },
    Дата_переразметки: "2026-04-01"
  });

  assert.match(badges, />1↺<\/span>/u);
});

test("getPatientBadges renders transferred marker", () => {
  const badges = desktopCore.getPatientBadges({
    file: { tags: [] },
    Передан: "Потапов Д.В."
  });

  assert.match(badges, /📦/u);
});


test("reminderHasVk detects VK reminders without matching arbitrary words", () => {
  assert.equal(desktopCore.reminderHasVk("Написать ВК по ЭЛН"), true);
  assert.equal(desktopCore.reminderHasVk("продление ЭЛН"), true);
  assert.equal(desktopCore.reminderHasVk("эвакуация документов"), false);
});

test("getReminderFilterHints combines patient hints and reminder text", () => {
  const hints = desktopCore.getReminderFilterHints({
    patient: {
      file: { tags: ["#ДС"] },
      Больничный_лист: true
    },
    reminder: { текст: "Написать ВК по ЭЛН" }
  });

  assert.match(hints, /дс дневной стационар/u);
  assert.match(hints, /элн больничный лист/u);
  assert.match(hints, /напоминание/u);
  assert.match(hints, /написать вк по элн/u);
  assert.match(hints, /вк продление элн/u);
});

test("getPrescriptionFundingLabel normalizes known funding labels", () => {
  assert.equal(desktopCore.getPrescriptionFundingLabel("ОМС базовая"), "ОМС");
  assert.equal(desktopCore.getPrescriptionFundingLabel("МЭС 300"), "МЭС 300");
  assert.equal(desktopCore.getPrescriptionFundingLabel("Группа 25 (200)"), "ВМП 200 (Группа 25)");
  assert.equal(desktopCore.getPrescriptionFundingLabel("Группа 26 (200)"), "ВМП 200 (Группа 26)");
  assert.equal(desktopCore.getPrescriptionFundingLabel("ВМП 200 (Группа 26)"), "ВМП 200 (Группа 26)");
  assert.equal(desktopCore.getPrescriptionFundingLabel("custom"), "custom");
  assert.equal(desktopCore.getPrescriptionFundingLabel(""), "");
});

test("getFundingType normalizes discharge funding badges", () => {
  assert.equal(desktopCore.getFundingType({}), "ОМС");
  assert.equal(desktopCore.getFundingType({ "Группа ВМП": "пму" }), "ПМУ");
  assert.equal(desktopCore.getFundingType({ "Группа ВМП": "300 группа" }), "ВМП300");
  assert.equal(desktopCore.getFundingType({ "Группа ВМП": "200 группа" }), "ВМП200");
  assert.equal(desktopCore.getFundingType({ "Группа ВМП": "ВМП" }), "ВМП200");
});

test("sanitizeFileName removes forbidden characters and normalizes spaces", () => {
  assert.equal(desktopCore.sanitizeFileName(' A/B:*?"<>|   C '), "AB C");
});

test("yearsWord returns Russian age suffixes", () => {
  assert.equal(desktopCore.yearsWord(1), "год");
  assert.equal(desktopCore.yearsWord(2), "года");
  assert.equal(desktopCore.yearsWord(5), "лет");
  assert.equal(desktopCore.yearsWord(11), "лет");
  assert.equal(desktopCore.yearsWord(21), "год");
});

test("calcAgeFromDobIso calculates age against an explicit current date", () => {
  assert.equal(desktopCore.calcAgeFromDobIso("1980-05-01", "2026-04-25"), 45);
  assert.equal(desktopCore.calcAgeFromDobIso("1980-04-25", "2026-04-25"), 46);
  assert.equal(desktopCore.calcAgeFromDobIso("2030-01-01", "2026-04-25"), null);
  assert.equal(desktopCore.calcAgeFromDobIso("", "2026-04-25"), null);
});

test("fundMarkFromGroup and buildPatientFileBaseName preserve desktop naming rules", () => {
  assert.equal(desktopCore.fundMarkFromGroup("ОМС"), "О");
  assert.equal(desktopCore.fundMarkFromGroup("Группа ВМП"), "В");
  assert.equal(desktopCore.fundMarkFromGroup("ДМС"), "Д");
  assert.equal(desktopCore.fundMarkFromGroup("ПМУ"), "П");

  assert.equal(
    desktopCore.buildPatientFileBaseName({
      fio: "Иванов / Иван",
      dobIso: "1980-04-25",
      mkb10: " c 34.1 ",
      vmpGroup: "Группа ВМП",
      todayIso: "2026-04-25"
    }),
    "C34.1В Иванов Иван, 46 лет"
  );
  assert.equal(desktopCore.buildPatientFileBaseName({ fio: "", dobIso: "1980-01-01", mkb10: "C34", vmpGroup: "ОМС", todayIso: "2026-04-25" }), null);
});

const makeCard = ({ text = "", dataset = {}, classes = [], queryMap = {} } = {}) => ({
  textContent: text,
  dataset,
  classList: {
    contains: (name) => classes.includes(name)
  },
  querySelector: (selector) => queryMap[selector] || null
});

test("matchPreset detects all desktop filter presets", () => {
  assert.equal(desktopCore.matchPreset("дс дневной", "ds"), true);
  assert.equal(desktopCore.matchPreset("кс круглосуточный", "ks"), true);
  assert.equal(desktopCore.matchPreset("ЭЛН больничный", "eln"), true);
  assert.equal(desktopCore.matchPreset("Написать ВК", "vk"), true);
  assert.equal(desktopCore.matchPreset("Проср. 2 дня", "overdue"), true);
  assert.equal(desktopCore.matchPreset("Оконтурить", "contour"), true);
  assert.equal(desktopCore.matchPreset("Переразметка", "markup"), true);
  assert.equal(desktopCore.matchPreset("Консультация СНИЛС", "consult"), true);
  assert.equal(desktopCore.matchPreset("ХЛТ радиомодификация", "hlt"), true);
  assert.equal(desktopCore.matchPreset("Фракция сегодня", "fraction_today"), true);
});

test("cardMatchesFilter respects dataset-only filter restrictions", () => {
  assert.equal(desktopCore.cardMatchesFilter(makeCard({ text: "Консультация", dataset: { consultFilterOnly: "1" } }), "all", "", true), false);
  assert.equal(desktopCore.cardMatchesFilter(makeCard({ text: "Консультация", dataset: { consultFilterOnly: "1" } }), "consult", "", true), true);
  assert.equal(desktopCore.cardMatchesFilter(makeCard({ text: "ВК", dataset: { vkReminderCard: "0" } }), "vk", "", true), false);
  assert.equal(desktopCore.cardMatchesFilter(makeCard({ text: "ВК", dataset: { vkReminderCard: "1" } }), "vk", "", true), true);
  assert.equal(desktopCore.cardMatchesFilter(makeCard({ text: "Фракция сегодня", dataset: { todayFraction: "0" } }), "fraction_today", "", true), false);
  assert.equal(desktopCore.cardMatchesFilter(makeCard({ text: "Фракция сегодня", dataset: { todayFraction: "1" } }), "fraction_today", "", true), true);
});

test("cardMatchesFilter hides future and search-only cards when needed", () => {
  assert.equal(desktopCore.cardMatchesFilter(makeCard({ text: "Напоминание", dataset: { futureReminderCard: "1" } }), "all", "", false), false);
  assert.equal(desktopCore.cardMatchesFilter(makeCard({ text: "Пациент", classes: ["rdt-search-only-card"] }), "all", "", true), false);
  assert.equal(desktopCore.cardMatchesFilter(makeCard({ text: "Пациент", classes: ["rdt-search-only-card"] }), "all", "паци", true), true);
});

test("search input state resets active preset when query is typed", () => {
  assert.deepEqual(
    desktopCore.getSearchStateAfterInput({
      query: "иванов",
      activeFilterPreset: "treatment"
    }),
    {
      query: "иванов",
      activeFilterPreset: "all"
    }
  );
  assert.deepEqual(
    desktopCore.getSearchStateAfterInput({
      query: "",
      activeFilterPreset: "treatment"
    }),
    {
      query: "",
      activeFilterPreset: "treatment"
    }
  );
});

test("applyDateSelectionPatch merges and removes selected dates", () => {
  assert.deepEqual(
    desktopCore.applyDateSelectionPatch({
      existing: ["2026-05-01"],
      selected: ["2026-05-02", "2026-05-03"],
      mode: "add"
    }),
    ["2026-05-01", "2026-05-02", "2026-05-03"]
  );
  assert.deepEqual(
    desktopCore.applyDateSelectionPatch({
      existing: ["2026-05-01", "2026-05-02"],
      selected: ["2026-05-02"],
      mode: "remove"
    }),
    ["2026-05-01"]
  );
});

test("getCardDedupeKey follows path, href, name and text priority", () => {
  assert.equal(desktopCore.getCardDedupeKey(makeCard({ dataset: { path: "Пациенты/A.md" } })), "path:пациенты/a.md");
  assert.equal(desktopCore.getCardDedupeKey(makeCard({
    queryMap: {
      "a.internal-link": { getAttribute: () => "Пациенты/B.md" }
    }
  })), "href:пациенты/b.md");
  assert.equal(desktopCore.getCardDedupeKey(makeCard({
    queryMap: {
      ".rdt-card-name": { textContent: "  Иванов   И.И. " }
    }
  })), "name:иванов и.и.");
  assert.equal(desktopCore.getCardDedupeKey(makeCard({ text: "  Карточка   пациента  " })), "text:карточка пациента");
});

test("progress helpers preserve desktop percentage rules", () => {
  assert.equal(desktopCore.calcPercentMarkupByWorkDays(0), 100);
  assert.equal(desktopCore.calcPercentMarkupByWorkDays(5), 15);
  assert.equal(desktopCore.calcPercentMarkupByWorkDays(2), 60);

  assert.equal(desktopCore.calcPercentContourProgress({ isBeforeOrOnMark: true, totalWorkDays: 5, passedWorkDays: 2 }), 15);
  assert.equal(desktopCore.calcPercentContourProgress({ totalWorkDays: 0, passedWorkDays: 2 }), 100);
  assert.equal(desktopCore.calcPercentContourProgress({ totalWorkDays: 4, passedWorkDays: 2 }), 50);

  assert.equal(desktopCore.calcPercentWaitingProgress({ hasMark: true, totalWorkDays: 4, passedWorkDays: 0 }), 0);
  assert.equal(desktopCore.calcPercentWaitingProgress({ hasMark: true, totalWorkDays: 4, passedWorkDays: 2 }), 50);
  assert.equal(desktopCore.calcPercentWaitingProgress({ hasMark: false, workDaysToStart: 0 }), 100);
  assert.equal(desktopCore.calcPercentWaitingProgress({ hasMark: false, workDaysToStart: 2 }), 60);
});

test("isOnTreatmentDateIso checks inclusive treatment interval", () => {
  assert.equal(desktopCore.isOnTreatmentDateIso({ startIso: "2026-04-01", endIso: "2026-04-25", dayIso: "2026-04-25" }), true);
  assert.equal(desktopCore.isOnTreatmentDateIso({ startIso: "2026-04-01", endIso: "", dayIso: "2026-04-25" }), true);
  assert.equal(desktopCore.isOnTreatmentDateIso({ startIso: "2026-04-26", endIso: "", dayIso: "2026-04-25" }), false);
  assert.equal(desktopCore.isOnTreatmentDateIso({ startIso: "", endIso: "", dayIso: "2026-04-25" }), false);
});

test("buildPrescriptionText renders a simple prescription", () => {
  const text = desktopCore.buildPrescriptionText({
    file: { tags: ["дс"] },
    ФИО: "Иванов Иван",
    Дата_рождения: "1980-04-25",
    Диагноз: "C34\nрак легкого",
    Название_PTV: "PTV",
    Количество_фракций: 5,
    РОД: "2,5",
    Область_облучения: "легкое",
    Цель_лечения: "Радикальная",
    Ускоритель: "Varian Halcyon",
    Дата_начала_лечения: "2026-04-25",
    "Группа ВМП": "ОМС"
  }, {
    todayIso: "2026-04-25"
  });

  assert.match(text, /Иванов Иван, 46 лет, 25\.04\.1980/u);
  assert.match(text, /C34 рак легкого/u);
  assert.match(text, /Радикальная\. Объемы: легкое/u);
  assert.match(text, /Ускоритель: Varian Halcyon/u);
  assert.match(text, /PTV — 5 фр\. по 2,5 Гр \(СД 12,5 Гр\)\./u);
  assert.match(text, /Старт: 25\.04\.2026/u);
  assert.match(text, /Дневной стационар\./u);
  assert.match(text, /Финансирование: ОМС/u);
});

test("buildPrescriptionText renders multi-volume boost and chemo lines", () => {
  const text = desktopCore.buildPrescriptionText({
    file: { tags: ["кс"] },
    ФИО: "Петров Петр",
    Дата_рождения: "1970-01-01",
    Диагноз: "C50",
    Название_PTV: "PTV1",
    Количество_фракций: 10,
    РОД: "2",
    Ускоритель: "Varian TrueBeam",
    ХЛТ_препараты: [{ Препарат: "Цисплатин", Режим: "Еженедельно" }],
    Объёмы: [
      {
        Связь: "Последовательный буст",
        Название: "Boost",
        Количество_фракций: 5,
        РОД: "2",
        Область_облучения: "ложе"
      }
    ],
    Дата_начала_лечения: "2026-04-25",
    "Группа ВМП": "Группа 26 (200)"
  }, {
    todayIso: "2026-04-25",
    normalizeConn: (raw) => raw
  });

  assert.match(text, /PTV1 — 10 фр\. по 2,0 Гр \(СД 20,0 Гр\);/u);
  assert.match(text, /Ускоритель: Varian TrueBeam/u);
  assert.match(text, /Последовательный буст:/u);
  assert.match(text, /Boost — 5 фр\. по 2,0 Гр \(СД 30,0 Гр\)\./u);
  assert.match(text, /ХЛТ: Цисплатин еженедельно/u);
  assert.match(text, /Круглосуточный стационар\./u);
  assert.match(text, /Финансирование: ВМП 200/u);
});

test("treatment templates assign accelerator defaults", () => {
  const sbrt = desktopCore.getTreatmentTemplatePatch({
    name: "SBRT (5 фракций)",
    category: "SBRT",
    теги: ["SBRT"],
    ptv1: { Название: "PTV", РОД: 12, Количество_фракций: 5, Фракционирование: "Стандартный" },
    extra: []
  });
  assert.equal(sbrt.patch["Ускоритель"], "Varian TrueBeam");

  const standard = desktopCore.getTreatmentTemplatePatch({
    name: "Длинный курс",
    category: "Рак легкого",
    теги: ["НМРЛ"],
    ptv1: { Название: "PTV", РОД: 2, Количество_фракций: 30, Фракционирование: "Стандартный" },
    extra: [{ Название: "PTV N", Связь: "Параллельно" }]
  });
  assert.equal(standard.patch["Ускоритель"], "Varian Halcyon");
  assert.equal(standard.patch["Объёмы"][0]["Ускоритель"], "Varian Halcyon");
  assert.equal(desktopCore.createExtraVolume({ fractionation: "SRT" })["Ускоритель"], "Varian TrueBeam");
});

test("getModelStats counts active, waiting, admitting and discharging models", () => {
  assert.deepEqual(desktopCore.getModelStats([
    { startIso: "2026-04-01", endIso: "2026-04-30" },
    { startIso: "2026-04-25", endIso: "" },
    { startIso: "2026-04-26", endIso: "" },
    { startIso: "", endIso: "2026-04-25" }
  ], "2026-04-25"), {
    active: 2,
    waiting: 2,
    admitting: 1,
    discharging: 1
  });
});

test("desktop tab counts keep badge formulas in one place", () => {
  assert.deepEqual(desktopCore.getDesktopTabCounts({
    activeReminderCount: 2,
    consultations: [{}, {}],
    starts: [{ p: { Госпитализация: false } }, { p: { Госпитализация: true } }, { p: {} }],
    ends: [{}, {}],
    contourPlan: [{}],
    markups: [{ Разметка: false }, { Разметка: true }, {}],
    reMarkups: [{}],
    overdueReMarkups: [{}, {}],
    overdueAdmissions: [{}],
    elnVkItems: [{}],
    reContours: [{}, {}],
    listMarkup: [{}, {}],
    listReMarkup: [{}],
    listContour: [{}],
    listWaiting: [{}, {}, {}],
    listTreatment: [{}, {}, {}],
    dischargeData: [{}, {}]
  }), {
    operativka: 18,
    planning: 9,
    treatment: 3,
    discharge: 2
  });
});

test("getPlanningStatuses mirrors desktop planning bucket rules", () => {
  assert.deepEqual(desktopCore.getPlanningStatuses({ Госпитализация: true }, {}), ["treatment"]);
  assert.deepEqual(desktopCore.getPlanningStatuses({ Госпитализация: true, Переразметка: false }, { hasRemarkDate: true }), ["treatment", "remarkup"]);
  assert.deepEqual(desktopCore.getPlanningStatuses({ Госпитализация: false, Оконтуривание: true }, { hasMark: true }), ["waiting"]);
  assert.deepEqual(desktopCore.getPlanningStatuses({ Госпитализация: false, Разметка: true }, { hasMark: true }), ["contour"]);
  assert.deepEqual(desktopCore.getPlanningStatuses({ Госпитализация: false }, { hasMark: true }), ["markup"]);
  assert.deepEqual(desktopCore.getPlanningStatuses({ Госпитализация: false }, { hasMark: false }), []);
});

test("getTreatmentBucket groups treatment cards by date and fraction status", () => {
  assert.equal(desktopCore.getTreatmentBucket({ startIso: "2026-04-01", endIso: "2026-04-30", hasFractionToday: true }, "2026-04-25"), "fraction_today");
  assert.equal(desktopCore.getTreatmentBucket({ startIso: "2026-04-01", endIso: "2026-04-30", hasFractionToday: false }, "2026-04-25"), "break_today");
  assert.equal(desktopCore.getTreatmentBucket({ startIso: "2026-04-26", endIso: "", hasFractionToday: true }, "2026-04-25"), "other");
});

test("discharge predicates use inclusive configured ranges", () => {
  assert.equal(desktopCore.isPlannedDischarge({ endIso: "2026-04-26", todayIso: "2026-04-25", limitIso: "2026-05-05" }), true);
  assert.equal(desktopCore.isPlannedDischarge({ endIso: "2026-04-25", todayIso: "2026-04-25", limitIso: "2026-05-05" }), false);
  assert.equal(desktopCore.isPlannedDischarge({ endIso: "2026-05-06", todayIso: "2026-04-25", limitIso: "2026-05-05" }), false);

  assert.equal(desktopCore.isRecentDischarge({ dateIso: "2026-04-24", startIso: "2026-04-20", todayIso: "2026-04-25" }), true);
  assert.equal(desktopCore.isRecentDischarge({ dateIso: "2026-04-19", startIso: "2026-04-20", todayIso: "2026-04-25" }), false);
  assert.equal(desktopCore.isRecentDischarge({ dateIso: "2026-04-26", startIso: "2026-04-20", todayIso: "2026-04-25" }), false);
});

test("getSearchOnlyStatus derives status from archive folder path", () => {
  assert.equal(desktopCore.getSearchOnlyStatus("Выписаны/test.md"), "discharged");
  assert.equal(desktopCore.getSearchOnlyStatus("Не начали/test.md"), "not_started");
});

test("consultation helpers parse legacy order, age and sort time", () => {
  assert.equal(desktopCore.parseLegacyConsultOrder("25.2 Иванов", 25), 2);
  assert.equal(desktopCore.parseLegacyConsultOrder("24.2 Иванов", 25), null);
  assert.equal(desktopCore.parseLegacyConsultOrder("Иванов", 25), null);

  assert.equal(desktopCore.getAgeLabel("1980-04-26", "2026-04-25"), "45 лет");
  assert.equal(desktopCore.getAgeLabel("1980-04-25", "2026-04-25"), "46 лет");
  assert.equal(desktopCore.getAgeLabel("", "2026-04-25"), "");

  assert.deepEqual(desktopCore.getLegacyConsultTime(1), { sortMinutes: 540, time: "9:00" });
  assert.deepEqual(desktopCore.getLegacyConsultTime(3), { sortMinutes: 600, time: "10:00" });
  assert.deepEqual(desktopCore.getConsultSort({ hour: 8, minute: 5 }), { sortMinutes: 485, time: "08:05" });
  assert.deepEqual(desktopCore.getConsultSort({ legacyOrder: 2 }), { sortMinutes: 570, time: "9:30" });
  assert.equal(desktopCore.cleanConsultationFileName("25.2 # C50 Иванов"), "C50 Иванов");
  assert.equal(desktopCore.cleanConsultationFileName("Иванов"), "Иванов");
});

test("consultation display helpers preserve names and sort order", () => {
  assert.deepEqual(desktopCore.getConsultationIdentity({
    fio: "Иванов Иван",
    fileName: "25.1 Иванов",
    mkb10: "C50",
    ageLabel: "46 лет"
  }), {
    fio: "Иванов Иван",
    mkb: "C50",
    displayName: "C50 Иванов Иван, 46 лет"
  });
  assert.deepEqual(desktopCore.getConsultationIdentity({
    fio: "",
    fileName: "25.1 Без ФИО",
    mkb10: "",
    ageLabel: ""
  }), {
    fio: "25.1 Без ФИО",
    mkb: "—",
    displayName: "— 25.1 Без ФИО, "
  });

  const todayItems = [
    { fio: "Б", sortMinutes: 600, legacyOrder: 2 },
    { fio: "А", sortMinutes: 600, legacyOrder: 1 },
    { fio: "Я", sortMinutes: 540, legacyOrder: 999 }
  ].sort(desktopCore.compareTodayConsultations);
  assert.deepEqual(todayItems.map(item => item.fio), ["Я", "А", "Б"]);

  const scheduledItems = [
    { fio: "Б", sortMillis: 200 },
    { fio: "А", sortMillis: 200 },
    { fio: "Я", sortMillis: 100 }
  ].sort(desktopCore.compareScheduledConsultations);
  assert.deepEqual(scheduledItems.map(item => item.fio), ["Я", "А", "Б"]);
});

test("getContourPlan returns overdue, urgent and limited planned contour cards", () => {
  const plan = desktopCore.getContourPlan([
    { source: { id: "late" }, contourDeadlineIso: "2026-04-24", todayIso: "2026-04-25", workDaysToDeadline: -1 },
    { source: { id: "urgent" }, contourDeadlineIso: "2026-04-26", todayIso: "2026-04-25", workDaysToDeadline: 1 },
    { source: { id: "planned1" }, contourDeadlineIso: "2026-04-30", todayIso: "2026-04-25", workDaysToDeadline: 3 },
    { source: { id: "planned2" }, contourDeadlineIso: "", todayIso: "2026-04-25", workDaysToDeadline: 999 },
    { source: { id: "planned3" }, contourDeadlineIso: "2026-05-05", todayIso: "2026-04-25", workDaysToDeadline: 5 }
  ], { plannedLimit: 2 });

  assert.deepEqual(plan, [
    { id: "late", isOverdue: true },
    { id: "urgent", isOverdue: false },
    { id: "planned1", isOverdue: false },
    { id: "planned2", isOverdue: false }
  ]);
});

test("getAdmissionPlan returns overdue admissions before today's admissions", () => {
  const plan = desktopCore.getAdmissionPlan([
    { source: { id: "future" }, startIso: "2026-04-26", todayIso: "2026-04-25", contoured: true, hospitalized: false },
    { source: { id: "late" }, startIso: "2026-04-24", todayIso: "2026-04-25", contoured: true, hospitalized: false },
    { source: { id: "today" }, startIso: "2026-04-25", todayIso: "2026-04-25", contoured: true, hospitalized: false },
    { source: { id: "done" }, startIso: "2026-04-25", todayIso: "2026-04-25", contoured: true, hospitalized: true },
    { source: { id: "not-contoured" }, startIso: "2026-04-25", todayIso: "2026-04-25", contoured: false, hospitalized: false }
  ]);

  assert.deepEqual(plan, [
    { id: "late", isOverdue: true },
    { id: "today", isOverdue: false }
  ]);
});

test("splitVkItems separates today and overdue VK dates", () => {
  const split = desktopCore.splitVkItems([
    { p: { id: "a" }, dateIsos: ["2026-04-24", "2026-04-25", "2026-04-26"] },
    { p: { id: "b" }, dateIsos: [""] }
  ], "2026-04-25");

  assert.deepEqual(split.todayItems, [{ p: { id: "a" }, dateIso: "2026-04-25" }]);
  assert.deepEqual(split.overdueItems, [{ p: { id: "a" }, dateIso: "2026-04-24" }]);
});

test("calcPatient support helpers resolve start, manuals, totals and daily fraction", () => {
  assert.equal(desktopCore.resolveTreatmentStartIso({
    startIso: "2026-04-25",
    manualDateIsos: ["2026-04-20"]
  }), "2026-04-25");
  assert.equal(desktopCore.resolveTreatmentStartIso({
    startIso: "",
    manualDateIsos: ["2026-04-28", "2026-04-20"]
  }), "2026-04-20");

  assert.deepEqual(desktopCore.getScheduleManualDateIsos({
    startIso: "2026-04-25",
    manualDateIsos: ["2026-04-20", "2026-04-25", "2026-04-26"],
    fracCount: 2
  }), ["2026-04-25", "2026-04-26"]);
  assert.deepEqual(desktopCore.getScheduleManualDateIsos({
    startIso: "2026-04-25",
    manualDateIsos: ["2026-04-20", "2026-04-25"],
    fracCount: 3
  }), ["2026-04-20", "2026-04-25"]);

  assert.deepEqual(desktopCore.getSegmentTotals([
    { frac: 5, currFrac: 2 },
    { frac: "3", currFrac: "1" }
  ]), { totalFrac: 8, totalCurrFrac: 3 });
  assert.deepEqual(desktopCore.getBaseTreatmentSegment({ frac: "5", currFrac: "2" }), { frac: 5, currFrac: 2, color: "#4caf50" });
  assert.deepEqual(desktopCore.getVkDateSourceList("2026-04-25"), ["2026-04-25"]);
  assert.deepEqual(desktopCore.getVkDateSourceList(["2026-04-25", "2026-04-26"]), ["2026-04-25", "2026-04-26"]);
  assert.equal(desktopCore.hasFractionOnDate([["2026-04-24"], ["2026-04-25"]], "2026-04-25"), true);
  assert.equal(desktopCore.hasFractionOnDate([["2026-04-24"]], "2026-04-25"), false);
});

test("operational list predicates preserve date and flag filters", () => {
  assert.equal(desktopCore.isTodayModelStart({ startIso: "2026-04-25", todayIso: "2026-04-25" }), true);
  assert.equal(desktopCore.isTodayModelEnd({ endIso: "2026-04-25", todayIso: "2026-04-25" }), true);
  assert.equal(desktopCore.isTodayMarkup({ markIso: "2026-04-25", todayIso: "2026-04-25" }), true);
  assert.equal(desktopCore.isTodayMarkup({ markIso: "", todayIso: "2026-04-25" }), false);
  assert.equal(desktopCore.isTodayRemarkup({
    hospitalized: true,
    remarkIso: "2026-04-25",
    remarkupDone: false,
    todayIso: "2026-04-25"
  }), true);
  assert.equal(desktopCore.isTodayRemarkup({
    hospitalized: true,
    remarkIso: "2026-04-25",
    remarkupDone: true,
    todayIso: "2026-04-25"
  }), false);
  assert.equal(desktopCore.isOverdueRemarkup({
    hospitalized: true,
    remarkIso: "2026-04-24",
    remarkupDone: false,
    todayIso: "2026-04-25"
  }), true);
  assert.equal(desktopCore.isOverdueRemarkup({
    hospitalized: false,
    remarkIso: "2026-04-24",
    remarkupDone: false,
    todayIso: "2026-04-25"
  }), false);
});

test("extra volume helpers classify start source and sequential segments", () => {
  assert.deepEqual(desktopCore.getExtraVolumeItems([
    null,
    "bad",
    { Название: "PTV2" },
    42,
    { Название: "PTV3" }
  ]), [{ Название: "PTV2" }, { Название: "PTV3" }]);

  assert.deepEqual(desktopCore.getExtraVolumePlan({
    vol: { Количество_фракций: "5", Связь: "Последовательно", Фракционирование: "Через день" },
    baseFrac: 10,
    normalizeConn: (raw) => raw,
    parseMode: (raw) => `mode:${raw}`
  }), {
    vol: { Количество_фракций: "5", Связь: "Последовательно", Фракционирование: "Через день" },
    fracN: 5,
    conn: "Последовательно",
    modeN: "mode:Через день",
    isSimultaneous: false,
    hasInvalidFraction: false
  });
  assert.equal(desktopCore.getExtraVolumePlan({
    vol: { Количество_фракций: "", Связь: "Одновременно" },
    baseFrac: 10,
    normalizeConn: (raw) => raw,
    parseMode: (raw) => raw
  }).fracN, 10);
  assert.equal(desktopCore.getExtraVolumePlan({
    vol: { Количество_фракций: 0, Связь: "Параллельно" },
    normalizeConn: (raw) => raw,
    parseMode: (raw) => raw
  }).hasInvalidFraction, true);

  assert.equal(desktopCore.isSequentialConnection("Последовательный буст"), true);
  assert.equal(desktopCore.isSequentialConnection("Последовательно"), true);
  assert.equal(desktopCore.isSequentialConnection("Параллельно"), false);

  assert.equal(desktopCore.getSegmentColor("Последовательно"), "#ffc107");
  assert.equal(desktopCore.getSegmentColor("Последовательный буст"), "#9c27b0");
  assert.equal(desktopCore.getSegmentColor("Параллельно"), "#9c27b0");

  assert.equal(desktopCore.getExtraVolumeStartIso({
    conn: "Параллельно",
    startIso: "2026-04-25",
    prevEndIso: "2026-04-30",
    nextWorkDayAfterIso: () => "2026-05-04"
  }), "2026-04-25");
  assert.equal(desktopCore.getExtraVolumeStartIso({
    conn: "Последовательно",
    startIso: "2026-04-25",
    prevEndIso: "2026-04-30",
    nextWorkDayAfterIso: (iso) => `${iso}+next`
  }), "2026-04-30+next");
  assert.equal(desktopCore.getExtraVolumeStartIso({
    conn: "Последовательно",
    startIso: "2026-04-25",
    prevEndIso: ""
  }), "");

  assert.equal(desktopCore.shouldAppendSequentialSegment("Последовательно", "2026-05-01"), true);
  assert.equal(desktopCore.shouldAppendSequentialSegment("Параллельно", "2026-05-01"), false);
  assert.equal(desktopCore.shouldAppendSequentialSegment("Последовательно", ""), false);
  assert.equal(desktopCore.getLaterIso("2026-05-01", "2026-04-30"), "2026-05-01");
  assert.equal(desktopCore.getLaterIso("", "2026-04-30"), "2026-04-30");
  assert.deepEqual(desktopCore.getSequentialSegment({
    conn: "Последовательно",
    endIso: "2026-05-01",
    frac: 5,
    currFrac: 2
  }), { frac: 5, currFrac: 2, color: "#ffc107" });
  assert.equal(desktopCore.getSequentialSegment({
    conn: "Параллельно",
    endIso: "2026-05-01",
    frac: 5,
    currFrac: 2
  }), null);
});

test("overdue predicates isolate discharge and initial markup rules", () => {
  assert.equal(desktopCore.isOverdueTreatmentEnd({
    endIso: "2026-04-24",
    todayIso: "2026-04-25",
    hospitalized: true
  }), true);
  assert.equal(desktopCore.isOverdueTreatmentEnd({
    endIso: "2026-04-25",
    todayIso: "2026-04-25",
    hospitalized: true
  }), false);
  assert.equal(desktopCore.isOverdueTreatmentEnd({
    endIso: "2026-04-24",
    todayIso: "2026-04-25",
    hospitalized: false
  }), false);

  assert.equal(desktopCore.isOverdueInitialMarkup({
    markIso: "2026-04-24",
    todayIso: "2026-04-25",
    markupDone: false,
    hospitalized: false
  }), true);
  assert.equal(desktopCore.isOverdueInitialMarkup({
    markIso: "2026-04-24",
    todayIso: "2026-04-25",
    markupDone: true,
    hospitalized: false
  }), false);
  assert.equal(desktopCore.isOverdueInitialMarkup({
    markIso: "2026-04-24",
    todayIso: "2026-04-25",
    markupDone: false,
    hospitalized: true
  }), false);
});

test("operational card metadata builders preserve discharge, hospitalization and VK rules", () => {
  assert.deepEqual(desktopCore.parseHospitalizationSickAction("HOSPITALIZATION_SICK|2026-04-25|SHOW_VK_BTN"), {
    isHospitalizationSick: true,
    admissionDateRaw: "2026-04-25",
    showVkBtn: true
  });
  assert.deepEqual(desktopCore.parseHospitalizationSickAction("Госпитализация"), {
    isHospitalizationSick: false,
    admissionDateRaw: "",
    showVkBtn: false
  });
  assert.deepEqual(desktopCore.parseRemoveVkAction("REMOVE_VK|2026-04-25"), {
    isRemoveVk: true,
    dateIso: "2026-04-25"
  });
  assert.deepEqual(desktopCore.parseRemoveVkAction("Госпитализация"), {
    isRemoveVk: false,
    dateIso: ""
  });
  assert.equal(desktopCore.getActionIconKey("MOVE"), "move");
  assert.equal(desktopCore.getActionIconKey("Разметка"), "check");
  assert.deepEqual(desktopCore.removeIsoFromDateList(["2026-04-24", "2026-04-25"], "2026-04-25"), ["2026-04-24"]);
  assert.equal(desktopCore.removeIsoFromDateList(["2026-04-25"], "2026-04-25"), null);
  assert.deepEqual(desktopCore.removeIsoFromDateList("2026-04-25T10:00:00", "2026-04-24", value => String(value).slice(0, 10)), ["2026-04-25T10:00:00"]);

  assert.equal(desktopCore.hasActiveVkReminder([
    { текст: "Очередное ВК", выполнено: true },
    { текст: "ВК продление", выполнено: false }
  ]), true);
  assert.equal(desktopCore.hasActiveVkReminder([{ текст: "контроль", выполнено: false }]), false);

  assert.deepEqual(desktopCore.getDischargeCardMeta({
    tags: ["#кс"],
    isSick: true,
    vmpGroup: "Группа 200",
    overdue: false
  }), {
    title: "Выписка из круглосуточного стационара",
    color: "#ff5252",
    borderStyle: "dashed",
    sub: "<b>ЭЛН:</b> Есть | <b>ВМП:</b> Группа 200"
  });
  assert.deepEqual(desktopCore.getDischargeCardMeta({
    tags: ["#дс"],
    isSick: false,
    vmpGroup: "",
    overdue: false
  }), {
    title: "Выписка из дневного стационара",
    color: "#ff5252",
    borderStyle: "solid",
    sub: ""
  });
  assert.equal(desktopCore.getDischargeCardMeta({ tags: ["#кс"], overdue: true }).borderStyle, "dashed");

  assert.deepEqual(desktopCore.getHospitalizationCardMeta({
    isOverdue: false,
    isSick: true,
    startIso: "2026-04-25",
    snils: "123",
    hasActiveVk: false
  }), {
    title: "<b>ЭЛН</b>",
    sub: "СНИЛС: 123",
    color: "#4caf50",
    actionKey: "HOSPITALIZATION_SICK|2026-04-25|SHOW_VK_BTN"
  });
  assert.equal(desktopCore.getHospitalizationCardMeta({
    isOverdue: true,
    isSick: true,
    startIso: "2026-04-20",
    startLabel: "20.04.2026",
    overdueWorkDays: 3,
    hasActiveVk: true
  }).actionKey, "HOSPITALIZATION_SICK|2026-04-20|NO_BTN");

  assert.deepEqual(desktopCore.getVkCardMeta({
    dateIso: "2026-04-24",
    dateLabel: "24.04",
    isOverdue: true,
    overdueWorkDays: 1
  }), {
    title: "Продление ЭЛН",
    sub: "<span style='color:#ff5252;font-weight:bold;'>Проср. 1 раб.дн. (24.04)</span>",
    color: "#ff5252",
    actionKey: "REMOVE_VK|2026-04-24"
  });
  assert.equal(desktopCore.getVkCardMeta({ dateIso: "2026-04-25" }).sub, "Требуется ВК");
});

test("markup card metadata builders preserve primary and repeated markup labels", () => {
  assert.deepEqual(desktopCore.getInitialMarkupCardMeta({
    goal: "Паллиативная",
    isOverdue: true,
    overdueWorkDays: 2,
    markLabel: "23.04.2026"
  }), {
    action: "Разметка",
    title: "Паллиативная",
    sub: "<span style='color:#ff5252;font-weight:bold;'>Проср. 2 раб.дн. (23.04.2026)</span>",
    color: "#ff5252"
  });
  assert.deepEqual(desktopCore.getInitialMarkupCardMeta({
    goal: "",
    isOverdue: false,
    markTime: "10:30"
  }), {
    action: "Разметка",
    title: "Разметка",
    sub: "10:30",
    color: "#ab47bc"
  });
  assert.deepEqual(desktopCore.getRemarkupCardMeta({
    isOverdue: true,
    overdueDays: 4,
    dateTimeLabel: "21.04.2026 09:00"
  }), {
    action: "Переразметка",
    title: "Переразметка",
    sub: "<span style='color:#ff5252;font-weight:bold;'>Просрочено 4 дн.</span> (21.04.2026 09:00)",
    color: "#ff5252"
  });
  assert.equal(desktopCore.getRemarkupCardMeta({ isOverdue: false, timeLabel: "" }).sub, "—");
  const split = desktopCore.splitMarkupCards([
    { action: "Переразметка", sortVal: 20, id: "r2" },
    { action: "Разметка", sortVal: 30, id: "m2" },
    { action: "Разметка", sortVal: 10, id: "m1" },
    { action: "Переразметка", sortVal: 5, id: "r1" },
    { action: "other", sortVal: 1, id: "x" }
  ]);
  assert.deepEqual(split.initial.map(item => item.id), ["m1", "m2"]);
  assert.deepEqual(split.repeat.map(item => item.id), ["r1", "r2"]);
});

test("contour and search-only card builders preserve display descriptors", () => {
  assert.deepEqual(desktopCore.getContourCardMeta({
    dateLabel: "25.04.2026",
    workDaysLeft: 0
  }), {
    title: "Оконтурить",
    sub: "25.04.2026 <b style='color:#e65100'>(Сегодня)</b>",
    color: "#e65100",
    action: "Оконтуривание"
  });
  assert.deepEqual(desktopCore.getContourCardMeta({
    title: "Повторное оконтуривание",
    datePrefix: "Переразметка: ",
    dateLabel: "24.04.2026",
    workDaysLeft: -2,
    defaultColor: "#e65100"
  }), {
    title: "Повторное оконтуривание",
    sub: "Переразметка: 24.04.2026 <b style='color:#ff5252'>(Проср. 2 дн.)</b>",
    color: "#ff5252",
    action: "Оконтуривание"
  });
  assert.equal(desktopCore.getContourCardMeta({
    dateLabel: "29.04.2026",
    workDaysLeft: 3,
    defaultColor: "#e65100"
  }).color, "#e65100");

  assert.deepEqual(desktopCore.getSearchOnlyCardMeta({
    status: "discharged",
    dischargeDateLabel: "20.04.2026"
  }), {
    title: "Выписан",
    subTitle: "20.04.2026",
    color: "#4caf50"
  });
  assert.deepEqual(desktopCore.getSearchOnlyCardMeta({
    status: "not_started",
    consultDateLabel: "26.04.2026",
    mkb10: "C50"
  }), {
    title: "Консультация (Не начал)",
    subTitle: "26.04.2026 (C50)",
    color: "#ff9800"
  });
});

test("reminder card builder preserves date status and VK flags", () => {
  assert.deepEqual(desktopCore.getReminderCardMeta({
    reminderText: "Написать ВК по ЭЛН",
    dateIso: "2026-04-24",
    todayIso: "2026-04-25",
    overdueWorkDays: 1
  }), {
    color: "#f44336",
    statusText: "Проср. 1 дн.",
    isPast: true,
    isToday: false,
    isFuture: false,
    isVkReminder: true,
    isVkEln: true
  });
  assert.equal(desktopCore.getReminderCardMeta({
    reminderText: "контроль",
    dateIso: "2026-04-25",
    todayIso: "2026-04-25"
  }).color, "#ff9800");
  assert.equal(desktopCore.getReminderCardMeta({
    reminderText: "контроль",
    dateIso: "2026-04-26",
    todayIso: "2026-04-25"
  }).isFuture, true);
  assert.deepEqual(desktopCore.getReminderCardState({
    patientPath: "Пациенты/test.md",
    filterHints: "иванов вк",
    reminderText: "Написать ВК по ЭЛН",
    dateIso: "2026-04-26",
    todayIso: "2026-04-25"
  }), {
    color: "#2196f3",
    statusText: "",
    isPast: false,
    isToday: false,
    isFuture: true,
    isVkReminder: true,
    isVkEln: true,
    hidden: true,
    dataset: {
      filterHints: "иванов вк",
      path: "Пациенты/test.md",
      vkReminderCard: "1",
      futureReminderCard: "1"
    }
  });
  assert.equal(desktopCore.getDueReminderCount([
    { dateIso: "2026-04-24" },
    { dateIso: "2026-04-25" },
    { dateIso: "2026-04-26" },
    { dateIso: "" }
  ], "2026-04-25"), 2);
  assert.equal(desktopCore.getDueReminderCount([
    { date: { toISODate: () => "2026-04-25" } },
    { date: { toISODate: () => "2026-04-27" } }
  ], "2026-04-25", item => item.date?.toISODate?.() || ""), 1);
});

test("consultation card builders preserve titles, filters and options", () => {
  assert.deepEqual(desktopCore.getOverdueConsultationCardMeta({
    name: "C50 Иванов, 46 лет",
    snils: "123",
    dateShortLabel: "24.04",
    dateLabel: "24.04.2026",
    overdueWorkDays: 1
  }), {
    name: "C50 Иванов, 46 лет",
    title: "<span style='color:#ff5252;font-weight:bold;'>Не проведена 24.04 · Проср. 1 раб.дн.</span>",
    sub: "СНИЛС: 123",
    color: "#ff5252",
    action: "CONSULTATION",
    borderStyle: "solid",
    filterHints: "consult консультация СНИЛС: 123 24.04.2026",
    options: { excludeConsultFilter: true }
  });
  assert.deepEqual(desktopCore.getTodayConsultationCardMeta({
    displayTitle: "C50 Иванов, 46 лет",
    time: "09:00",
    snils: "123",
    hasConsultField: true
  }), {
    title: "C50 Иванов, 46 лет",
    sub: "09:00 | СНИЛС: 123",
    color: "#9e9e9e",
    action: "CONSULTATION",
    borderStyle: "solid",
    filterHints: "consult консультация C50 Иванов, 46 лет 09:00  | СНИЛС: 123",
    options: { excludeConsultFilter: true }
  });
  assert.deepEqual(desktopCore.getScheduledConsultationCardMeta({
    displayTitle: "C50 Иванов, 46 лет",
    dateIso: "2026-04-26",
    todayIso: "2026-04-25",
    dateLabel: "26.04.2026",
    dateTimeLabel: "26.04.2026 09:00",
    time: "09:00",
    snils: "123",
    source: "patients_folder"
  }), {
    title: "C50 Иванов, 46 лет",
    heading: "Дата консультации: 26.04.2026",
    sub: "09:00 · СНИЛС: 123 · из Пациенты",
    color: "#9e9e9e",
    action: "CONSULTATION",
    borderStyle: "solid",
    filterHints: "consult консультация C50 Иванов, 46 лет 26.04.2026 09:00 09:00 · СНИЛС: 123 · из Пациенты",
    options: { consultFilterOnly: true }
  });
});

test("stage card reminder and missing date helpers preserve renderCard rules", () => {
  const reminders = [
    null,
    { дата: "2026-04-25", текст: "контроль", выполнено: true },
    { дата: "2026-04-26", текст: "ВК", выполнено: false },
    { дата: "", текст: "без даты", выполнено: false },
    { дата: "2026-04-27", текст: "", выполнено: false }
  ];
  assert.deepEqual(desktopCore.getActiveReminders(reminders), [
    { дата: "2026-04-26", текст: "ВК", выполнено: false }
  ]);
  assert.equal(desktopCore.getActiveReminderCount(reminders), 1);
  assert.equal(desktopCore.hasActiveReminders(reminders), true);
  assert.equal(desktopCore.getReminderBellColor(reminders), "#ff9800");
  assert.equal(desktopCore.getReminderBellColor([]), "var(--text-muted)");
  assert.equal(desktopCore.findActiveReminderIndex(reminders, 0), 2);
  assert.equal(desktopCore.findActiveReminderIndex(reminders, 1), -1);
  assert.equal(desktopCore.findActiveReminderValueIndex(reminders, {
    дата: "2026-04-26",
    текст: "ВК",
    выполнено: false
  }), 2);
  assert.equal(desktopCore.findActiveReminderValueIndex(reminders, {
    дата: "2026-04-26",
    текст: "другое",
    выполнено: false
  }), -1);

  assert.deepEqual(desktopCore.getMissingDateWarnings({
    hasMarkupDate: false,
    hasTreatmentStartDate: false
  }), ["нет даты разметки", "нет даты начала лечения"]);
  assert.equal(desktopCore.getMissingDateWarningText({
    hasMarkupDate: true,
    hasTreatmentStartDate: false
  }), "нет даты начала лечения");
});

test("treatment stage meta preserves fraction totals, warnings and move action", () => {
  assert.deepEqual(desktopCore.getTreatmentStageMeta({
    frac: 10,
    currFrac: 9,
    endIso: "2026-04-26",
    todayIso: "2026-04-25",
    endWeekday: 7,
    dayPhrases: { 7: "в воскресенье" }
  }), {
    mainColor: "#ff9800",
    totalFrac: 10,
    totalCurrFrac: 9,
    left: 1,
    statusText: "Фракции: 9/10",
    warningKind: "soon",
    warningText: "Выписка в воскресенье",
    warningColor: "#ff9800",
    btnAction: null
  });
  assert.equal(desktopCore.getTreatmentStageMeta({
    totalFrac: 10,
    totalCurrFrac: 10,
    endIso: "2026-04-25",
    todayIso: "2026-04-25"
  }).btnAction, "MOVE");
  assert.equal(desktopCore.getTreatmentStageMeta({
    totalFrac: 10,
    totalCurrFrac: 10,
    endIso: "2026-04-24",
    todayIso: "2026-04-25"
  }).warningKind, "delayed");
});

test("planning stage meta preserves markup, contour and waiting rules", () => {
  assert.deepEqual(desktopCore.getMarkupStageMeta({
    kind: "markup",
    dateIso: "2026-04-24",
    todayIso: "2026-04-25",
    dateLabel: "24.04.2026 09:00",
    progressPct: 100
  }), {
    mainColor: "#ab47bc",
    statusText: "Разметка",
    statusKind: "markup",
    dateLabel: "24.04.2026 09:00",
    dateColor: "#ff5252",
    dotColor: "#ff5252",
    isOverdue: true,
    progressSegments: [
      { pct: 100, color: "#ab47bc" },
      { pct: 0, color: "rgba(150,150,150,0.15)" },
      { pct: 0, color: "rgba(150,150,150,0.15)" }
    ],
    btnKey: "Разметка"
  });
  assert.equal(desktopCore.getMarkupStageMeta({
    kind: "remarkup",
    dateIso: "2026-04-26",
    todayIso: "2026-04-25",
    dateLabel: "26.04.2026 09:00",
    progressPct: 10
  }).btnKey, "Переразметка");

  assert.deepEqual(desktopCore.getContourStageMeta({
    kind: "contour",
    deadlineLabel: "24.04.2026",
    workDaysLeft: -1,
    progressPct: 80
  }), {
    mainColor: "#ff5252",
    statusText: "Оконтуривание",
    statusKind: "contour",
    deadlineLabel: "24.04.2026",
    textColor: "#ff5252",
    textDays: "Проср. 1 дн.",
    dotColor: "#9e9e9e",
    progressSegments: [
      { pct: 100, color: "#ab47bc" },
      { pct: 80, color: "#ff5252" },
      { pct: 0, color: "rgba(150,150,150,0.15)" }
    ],
    btnKey: "Оконтуривание"
  });
  assert.equal(desktopCore.getContourStageMeta({
    kind: "recontour",
    deadlineLabel: "25.04.2026",
    workDaysLeft: 0,
    progressPct: 50
  }).mainColor, "#ef6c00");

  assert.deepEqual(desktopCore.getWaitingStageMeta({
    startLabel: "25.04.2026",
    workDaysLeft: 0,
    progressPct: 30
  }), {
    mainColor: "#9e9e9e",
    statusText: "Ожидание",
    statusKind: "waiting",
    startLabel: "25.04.2026",
    textColor: "#4caf50",
    textDays: "Сегодня",
    dotColor: "#4caf50",
    progressSegments: [
      { pct: 100, color: "#ab47bc" },
      { pct: 100, color: "#42a5f5" },
      { pct: 30, color: "#4caf50" }
    ],
    btnKey: "Госпитализация"
  });
});

test("VK ELN reminder helper preserves target date and text math", () => {
  assert.deepEqual(desktopCore.buildVkElnReminderPayload({
    admissionIso: "2026-04-20",
    selectedIso: "2026-04-25",
    todayIso: "2026-04-25",
    holidays: ["2026-05-08"]
  }), {
    targetIso: "2026-05-04",
    reminderText: "Написать ВК по ЭЛН (Прошло: 6 + Доб: 9 = Итог: 15)",
    passedDays: 6,
    addedDays: 9,
    totalDays: 15
  });
  assert.deepEqual(desktopCore.buildVkElnReminderPayload({
    admissionIso: "2026-05-01",
    selectedIso: "2026-04-25",
    todayIso: "2026-04-25",
    holidays: []
  }), {
    targetIso: "2026-05-15",
    reminderText: "Написать ВК по ЭЛН (Прошло: 0 + Доб: 15 = Итог: 15)",
    passedDays: 0,
    addedDays: 15,
    totalDays: 15
  });
  assert.equal(desktopCore.buildVkElnReminderPayload({
    admissionIso: "2026-04-20",
    selectedIso: "2026-04-30",
    todayIso: "2026-04-25"
  }).targetIso, "2026-04-30");

  assert.deepEqual(desktopCore.getNextVkElnReminderInfo({
    admissionIso: "2026-04-20",
    todayIso: "2026-04-25",
    holidays: ["2026-05-08"]
  }), {
    daysInHospLabel: "6",
    targetIso: "2026-05-04"
  });
  assert.deepEqual(desktopCore.getNextVkElnReminderInfo({
    admissionIso: "",
    todayIso: "2026-04-25",
    holidays: []
  }), {
    daysInHospLabel: "?",
    targetIso: "2026-05-08"
  });
  assert.equal(desktopCore.hasVkReminderOnDate([
    { дата: "2026-05-04", текст: "Написать ВК по ЭЛН" },
    { дата: "2026-05-05", текст: "контроль" }
  ], "2026-05-04"), true);
  assert.equal(desktopCore.hasVkReminderOnDate([
    { дата: "2026-05-04", текст: "контроль" }
  ], "2026-05-04"), false);
});

test("planned discharge card meta preserves timing labels, tags and copy string", () => {
  assert.deepEqual(desktopCore.getPlannedDischargeTimingMeta({
    workDaysLeft: 1,
    endWeekday: 1,
    dayPhrases: { 1: "в понедельник" }
  }), {
    daysText: "Выписка в понедельник",
    color: "#ff9800"
  });
  assert.deepEqual(desktopCore.getPlannedDischargeTimingMeta({ workDaysLeft: 3 }), {
    daysText: "через 3 раб. дн.",
    color: "#4caf50"
  });

  const meta = desktopCore.getPlannedDischargeCardMeta({
    title: "C50 Иванов",
    fundingType: "ВМП200",
    tags: ["#кс", "#sbrt"],
    currFrac: 8,
    frac: 10,
    doctor: "Глибичук Д.А.",
    dateLabel: "30.04.2026",
    copied: true,
    workDaysLeft: 1,
    endWeekday: 4,
    dayPhrases: { 4: "в четверг" }
  });
  assert.deepEqual(meta, {
    title: "C50 Иванов",
    dateLabel: "30.04.2026",
    daysText: "Выписка в четверг",
    color: "#ff9800",
    fractionsLeft: 2,
    infos: ["ВМП200", "SBRT", "КС"],
    methodShort: "SBRT",
    inpatientShort: "КС",
    copyString: "C50 Иванов\t\tВМП200\tSBRT\tКС\tГлибичук Д.А.",
    opacity: "0.8",
    bgFilter: "grayscale(0.3)"
  });

  assert.deepEqual(desktopCore.getRecentDischargeCardMeta({
    title: "C50 Петров",
    fundingType: "ОМС",
    tags: ["#дс", "#бфрт"],
    dateLabel: "24.04.2026",
    workDaysAgo: 2
  }), {
    title: "C50 Петров",
    dateLabel: "24.04.2026",
    agoText: "2 раб. дн. назад",
    infos: ["ОМС", "БФРТ", "ДС"],
    methodShort: "БФРТ",
    inpatientShort: "ДС",
    color: "#607d8b"
  });
  assert.equal(desktopCore.getRecentDischargeCardMeta({
    workDaysAgo: 0
  }).agoText, "сегодня");
  assert.equal(desktopCore.getRecentDischargeCardMeta({
    workDaysAgo: 1
  }).agoText, "1 раб. дн. назад");
});

test("reminder row helpers sort and color active reminders", () => {
  const reminders = [
    { дата: "2026-04-27", текст: "b", выполнено: false },
    { дата: "2026-04-25", текст: "a", выполнено: false },
    { дата: "2026-04-24", текст: "done", выполнено: true }
  ];
  assert.deepEqual(desktopCore.getSortedActiveReminders(reminders).map(item => item.текст), ["a", "b"]);
  assert.deepEqual(desktopCore.getReminderRowMeta({
    dateIso: "2026-04-24",
    todayIso: "2026-04-25",
    dateLabel: "24.04.2026"
  }), {
    dateColor: "#f44336",
    dateLabel: "24.04.2026"
  });
  assert.equal(desktopCore.getReminderRowMeta({
    dateIso: "2026-04-25",
    todayIso: "2026-04-25"
  }).dateColor, "#ff9800");
  assert.equal(desktopCore.getReminderRowMeta({
    dateIso: "2026-04-26",
    todayIso: "2026-04-25"
  }).dateColor, "var(--text-muted)");
});

test("stage render html helpers preserve label backgrounds and progress segments", () => {
  assert.equal(
    desktopCore.getStageLabelHtml({ statusKind: "waiting", mainColor: "#9e9e9e", statusText: "Ожидание" }, "ICON"),
    "<span style='display:inline-flex;align-items:center;gap:4px;background:rgba(158,158,158,0.13);color:var(--text-muted);padding:1px 7px;border-radius:10px;font-size:0.85em;font-weight:600;'>ICON Ожидание</span>"
  );
  assert.equal(
    desktopCore.getStageLabelHtml({ statusKind: "remarkup", mainColor: "#ef6c00", statusText: "Переразметка" }, "ICON"),
    "<span style='display:inline-flex;align-items:center;gap:4px;background:rgba(239,108,0,0.13);color:#ef6c00;padding:1px 7px;border-radius:10px;font-size:0.85em;font-weight:600;'>ICON Переразметка</span>"
  );
  assert.equal(
    desktopCore.getProgressSegmentsHtml([{ pct: 25, color: "#fff" }]),
    "<div style='flex: 1; height: 100%; background: rgba(150,150,150,0.15); border-radius: 2px;'><div style='width: 25%; height: 100%; background: #fff; border-radius: 2px;'></div></div>"
  );
  assert.equal(
    desktopCore.getTreatmentProgressSegmentsHtml([{ frac: 5, currFrac: 2, color: "#4caf50" }, { frac: 3, currFrac: 1, color: "#ffc107" }], "#ff5252"),
    "<div style='flex:5;height:100%;background:rgba(150,150,150,0.15);border-radius:2px;'><div style='width:40%;height:100%;background:#ff5252;border-radius:2px;'></div></div><div style='flex:3;height:100%;background:rgba(150,150,150,0.15);border-radius:2px;margin-left:2px;'><div style='width:33%;height:100%;background:#ffc107;border-radius:2px;'></div></div>"
  );
});

test("mergeTimelineText deduplicates and sorts by DD.MM.YYYY stamps", () => {
  // empty + non-empty
  assert.equal(desktopCore.mergeTimelineText("", "01.01.2026 Первый приём"), "01.01.2026 Первый приём");
  assert.equal(desktopCore.mergeTimelineText("01.01.2026 Первый приём", ""), "01.01.2026 Первый приём");
  // both empty
  assert.equal(desktopCore.mergeTimelineText("", ""), "");
  // deduplication (case-insensitive, whitespace-normalized)
  assert.equal(
    desktopCore.mergeTimelineText("01.01.2026 Первый приём", "01.01.2026  первый  Приём"),
    "01.01.2026 Первый приём"
  );
  // sorts by date stamp
  assert.equal(
    desktopCore.mergeTimelineText("15.03.2026 Контроль", "01.02.2026 Осмотр"),
    "01.02.2026 Осмотр\n15.03.2026 Контроль"
  );
  // non-dated lines preserved (stamp 0)
  assert.equal(
    desktopCore.mergeTimelineText("15.03.2026 Контроль", "Без даты запись"),
    "Без даты запись\n15.03.2026 Контроль"
  );
});

test("mergeDistinctParagraphText deduplicates by normalized paragraph content", () => {
  // empty + non-empty
  assert.equal(desktopCore.mergeDistinctParagraphText("", "Текст"), "Текст");
  assert.equal(desktopCore.mergeDistinctParagraphText("Текст", ""), "Текст");
  // identical normalized → returns existing
  assert.equal(
    desktopCore.mergeDistinctParagraphText("Некий  текст", "Некий текст"),
    "Некий  текст"
  );
  // incoming contains existing → returns incoming
  assert.equal(
    desktopCore.mergeDistinctParagraphText("Короткий", "Короткий текст побольше"),
    "Короткий текст побольше"
  );
  // existing contains incoming → returns existing
  assert.equal(
    desktopCore.mergeDistinctParagraphText("Длинный развёрнутый текст", "Длинный"),
    "Длинный развёрнутый текст"
  );
  // distinct paragraphs → appended
  assert.equal(
    desktopCore.mergeDistinctParagraphText("Параграф один", "Параграф два"),
    "Параграф один\nПараграф два"
  );
});

test("mergeDistinctListText deduplicates list items split by newline, semicolon and bullet", () => {
  // empty + non-empty
  assert.equal(desktopCore.mergeDistinctListText("", "ИБС"), "ИБС");
  assert.equal(desktopCore.mergeDistinctListText("ИБС", ""), "ИБС");
  // deduplication (normalized)
  assert.equal(desktopCore.mergeDistinctListText("ИБС\nГБ", "ибс;  Гб"), "ИБС\nГБ");
  // merges new items
  assert.equal(desktopCore.mergeDistinctListText("ИБС", "ГБ;СД"), "ИБС\nГБ\nСД");
  // bullet separator
  assert.equal(desktopCore.mergeDistinctListText("ИБС", "●ГБ●СД"), "ИБС\nГБ\nСД");
  // substring containment
  assert.equal(desktopCore.mergeDistinctListText("ИБС. Стенокардия", "ИБС"), "ИБС. Стенокардия");
});

test("mergePhoneText deduplicates by digit-only normalization", () => {
  // empty + non-empty
  assert.equal(desktopCore.mergePhoneText("", "+7 999 123 45 67"), "+7 999 123 45 67");
  assert.equal(desktopCore.mergePhoneText("+7 999 123 45 67", ""), "+7 999 123 45 67");
  // deduplication by digits (same digits, different formatting)
  assert.equal(
    desktopCore.mergePhoneText("+7 999 123 45 67", "+7(999)123-45-67"),
    "+7 999 123 45 67"
  );
  // different numbers are kept
  assert.equal(
    desktopCore.mergePhoneText("+7 999 123 45 67", "89991234567"),
    "+7 999 123 45 67 / 89991234567"
  );
  // merges unique phones
  assert.equal(
    desktopCore.mergePhoneText("+7 999 123 45 67", "+7 888 765 43 21"),
    "+7 999 123 45 67 / +7 888 765 43 21"
  );
  // multiple separators in incoming
  assert.equal(
    desktopCore.mergePhoneText("+7 999 123 45 67", "+7 888 765 43 21,+7 777 111 22 33"),
    "+7 999 123 45 67 / +7 888 765 43 21 / +7 777 111 22 33"
  );
});

test("DAY_PHRASES contains all 7 weekdays with Russian phrases", () => {
  const dp = desktopCore.DAY_PHRASES;
  assert.equal(typeof dp, "object");
  assert.equal(Object.keys(dp).length, 7);
  assert.equal(dp[1], "в понедельник");
  assert.equal(dp[2], "во вторник");
  assert.equal(dp[3], "в среду");
  assert.equal(dp[4], "в четверг");
  assert.equal(dp[5], "в пятницу");
  assert.equal(dp[6], "в субботу");
  assert.equal(dp[7], "в воскресенье");
});


test("buildVkElnReminderPayload with explicit future selectedIso returns it unchanged", () => {
  const payload = desktopCore.buildVkElnReminderPayload({
    admissionIso: "2026-04-20",
    selectedIso: "2026-04-30",
    todayIso: "2026-04-25",
    holidays: []
  });
  // selectedIso != todayIso → no auto-calculation, target = selectedIso
  assert.ok(payload !== null);
  assert.equal(payload.targetIso, "2026-04-30");
  assert.match(payload.reminderText, /Написать ВК по ЭЛН/u);
  assert.ok(typeof payload.totalDays === "number" && payload.totalDays > 0);
});

test("buildVkElnReminderPayload auto-calculates when selectedIso equals todayIso", () => {
  // When selected = today, calculates admission+14 days (or today+15 if >5 days in hosp)
  const recentAdmission = desktopCore.buildVkElnReminderPayload({
    admissionIso: "2026-04-24", // 1 day ago → ≤5 days → use admissionIso+14
    selectedIso: "2026-04-25",
    todayIso: "2026-04-25",
    holidays: []
  });
  assert.ok(recentAdmission !== null);
  // 2026-04-24 + 14 = 2026-05-08 (Thursday — workday, no shift needed)
  assert.equal(recentAdmission.targetIso, "2026-05-08");

  const oldAdmission = desktopCore.buildVkElnReminderPayload({
    admissionIso: "2026-04-01", // >5 days ago → use today+15
    selectedIso: "2026-04-25",
    todayIso: "2026-04-25",
    holidays: []
  });
  assert.ok(oldAdmission !== null);
  // 2026-04-25 + 15 = 2026-05-10 (Sunday) → shiftBack → 2026-05-08 (Friday)
  assert.equal(oldAdmission.targetIso, "2026-05-08");
  assert.match(oldAdmission.reminderText, /Написать ВК по ЭЛН/u);
});

test("buildVkElnReminderPayload returns null when inputs are missing", () => {
  assert.equal(desktopCore.buildVkElnReminderPayload({ admissionIso: "", selectedIso: "2026-04-25", todayIso: "2026-04-25" }), null);
  assert.equal(desktopCore.buildVkElnReminderPayload({ admissionIso: "2026-04-20", selectedIso: "", todayIso: "2026-04-25" }), null);
  assert.equal(desktopCore.buildVkElnReminderPayload({}), null);
});

test("getNextVkElnReminderInfo returns daysInHospLabel and targetIso", () => {
  const info = desktopCore.getNextVkElnReminderInfo({
    admissionIso: "2026-04-20",
    todayIso: "2026-04-25",
    holidays: []
  });
  assert.equal(info.daysInHospLabel, "6"); // Apr 20 to Apr 25 inclusive = 6 days
  assert.ok(typeof info.targetIso === "string" && info.targetIso.length === 10);

  // Without admissionIso → today+15
  const noAdmission = desktopCore.getNextVkElnReminderInfo({
    admissionIso: "",
    todayIso: "2026-04-25",
    holidays: []
  });
  assert.equal(noAdmission.daysInHospLabel, "?");
  assert.ok(noAdmission.targetIso.length === 10);
});

test("hasVkReminderOnDate deduplicates VK reminders by date and text", () => {
  const reminders = [
    { дата: "2026-05-10", текст: "Написать ВК по ЭЛН", выполнено: false },
    { дата: "2026-05-20", текст: "контроль", выполнено: false }
  ];
  assert.equal(desktopCore.hasVkReminderOnDate(reminders, "2026-05-10"), true);
  assert.equal(desktopCore.hasVkReminderOnDate(reminders, "2026-05-20"), false); // no ВК in text
  assert.equal(desktopCore.hasVkReminderOnDate(reminders, "2026-05-11"), false);
  assert.equal(desktopCore.hasVkReminderOnDate([], "2026-05-10"), false);

  // Custom toIso normalizer
  const isoReminders = [{ дата: "2026-05-10T09:00:00", текст: "ВК", выполнено: false }];
  assert.equal(
    desktopCore.hasVkReminderOnDate(isoReminders, "2026-05-10", v => String(v || "").slice(0, 10)),
    true
  );
});

test("buildPatientModel parses basic schedules and properties", () => {
  const p = {
    "Количество_фракций": 5,
    "Дата_начала_лечения": "2026-04-20",
    "Фракционирование": "ежедневно",
    "Больничный_лист": true
  };
  const mockScheduleCore = {
    utils: { detectMode: () => "ежедневно" },
    buildSchedule: () => ["2026-04-20", "2026-04-21", "2026-04-22", "2026-04-23", "2026-04-24"]
  };
  const model = desktopCore.buildPatientModel(p, { scheduleCore: mockScheduleCore, todayIso: "2026-04-22" });
  assert.equal(model.isSick, true);
  assert.equal(model.scheduleIsos.length, 5);
  assert.equal(model.currFrac, 3);
  assert.equal(model.endIso, "2026-04-24");
});

test("buildPatientModel counts both BID fractions delivered on the same date", () => {
  const scheduleCore = require(path.resolve(__dirname, "..", "src", "shared", "schedule-core.cjs"));
  const model = desktopCore.buildPatientModel({
    "Количество_фракций": 4,
    "Дата_начала_лечения": "2026-04-20",
    "Фракционирование": "2 раза в день"
  }, {
    scheduleCore,
    todayIso: "2026-04-20"
  });

  assert.deepEqual(model.scheduleIsos, [
    "2026-04-20",
    "2026-04-20",
    "2026-04-21",
    "2026-04-21"
  ]);
  assert.equal(model.currFrac, 2);
  assert.equal(model.totalCurrFrac, 2);
});

test("action patch generators return correct mutations", () => {
  assert.deepEqual(desktopCore.getConsultationRejectPatch(), {
    "Консультация_завершена": true,
    "Консультация_решение": "отказ",
    "Отказ_от_лечения": true,
    "Принят_на_лечение": false
  });

  assert.deepEqual(desktopCore.getConsultationAcceptPatch(true), {
    "Консультация_завершена": true,
    "Консультация_решение": "принят",
    "Принят_на_лечение": true,
    "Отказ_от_лечения": false,
    "Дата_консультации": null
  });

  assert.deepEqual(desktopCore.getHospitalizationSickPatch(), {
    "Госпитализация": true
  });

  assert.deepEqual(desktopCore.getRemarkupDonePatch(), {
    "Переразметка": true,
    "Оконтуривание": false
  });
});

test("reminder patch generators mutate arrays immutably", () => {
  const initial = [{ дата: "2026-04-20", текст: "Test", выполнено: false }];
  
  const snooze = desktopCore.getSnoozeReminderPatch(initial, 0, "2026-04-21");
  assert.equal(snooze["Напоминания"][0].дата, "2026-04-21");
  assert.equal(initial[0].дата, "2026-04-20"); // immutable
  
  const complete = desktopCore.getCompleteReminderPatch(initial, 0);
  assert.equal(complete["Напоминания"][0].выполнено, true);
  
  const add = desktopCore.getAddVkReminderPatch(initial, "2026-04-25", "ВК по ЭЛН");
  assert.equal(add["Напоминания"].length, 2);
  assert.equal(add["Напоминания"][1].дата, "2026-04-25");
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

console.log(`OK ${passed} shared desktop-core tests passed`);
