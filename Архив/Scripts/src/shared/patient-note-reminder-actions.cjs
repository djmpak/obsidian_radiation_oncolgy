"use strict";

const DISPANSERY_INTERVALS = [
  { months: 3, label: "3 мес." },
  { months: 6, label: "6 мес." },
  { months: 12, label: "1 год" },
  { months: 18, label: "1,5 года" },
  { months: 24, label: "2 года" },
  { months: 30, label: "2,5 года" },
  { months: 36, label: "3 года" },
  { months: 42, label: "3,5 года" },
  { months: 48, label: "4 года" },
  { months: 54, label: "4,5 года" },
  { months: 60, label: "5 лет" },
];

const LAG_DAYS = 14;
const DISPANSERY_MARKER = "диспансерный осмотр";

const isDateLike = (value) => !!value && typeof value === "object" && typeof value.plus === "function";

const toStartOfDay = (value, dv = globalThis.dv) => {
  if (!value) return null;
  if (isDateLike(value)) return value.startOf?.("day") || value;
  const parsed = dv?.date ? dv.date(value) : null;
  return parsed?.startOf ? parsed.startOf("day") : null;
};

const toIsoDate = (value, dv = globalThis.dv) => {
  if (!value) return "";
  if (typeof value === "string") return value.slice(0, 10);
  const day = toStartOfDay(value, dv);
  return day?.toISODate?.() || day?.toFormat?.("yyyy-MM-dd") || "";
};

const normalizeText = (value) => String(value ?? "").replace(/\s+/g, " ").trim();

const normalizeNoteTimestamp = (value, dv = globalThis.dv) => {
  if (!value) return "";
  if (typeof value === "string") return value.trim();
  const day = toStartOfDay(value, dv);
  return day?.toFormat?.("yyyy-MM-dd'T'HH:mm") || "";
};

const isDispanseryReminder = (reminder) =>
  String(reminder?.текст ?? reminder?.Текст ?? "").toLowerCase().includes(DISPANSERY_MARKER);

const filterOutDispanseryReminders = (reminders) =>
  (Array.isArray(reminders) ? reminders : []).filter((reminder) => !isDispanseryReminder(reminder));

const buildDispanseryReminders = (endDate, { nextWorkDay = null, dv = globalThis.dv } = {}) => {
  const base = toStartOfDay(endDate, dv);
  if (!base) return [];

  return DISPANSERY_INTERVALS.map(({ months, label }) => {
    const rawDate = base.plus({ months }).plus({ days: LAG_DAYS });
    const finalDate = typeof nextWorkDay === "function" ? nextWorkDay(rawDate) : rawDate;
    const dateText = finalDate?.toFormat?.("yyyy-MM-dd") || toIsoDate(finalDate, dv);
    return {
      дата: dateText,
      текст: `Диспансерный осмотр (${label})`,
      выполнено: false
    };
  });
};

const createPatientNoteReminderActions = ({
  patchCurrentFrontmatter,
  nextWorkDay = null,
  dv = globalThis.dv
} = {}) => {
  if (typeof patchCurrentFrontmatter !== "function") {
    throw new Error("createPatientNoteReminderActions requires patchCurrentFrontmatter");
  }

  const generateDispanseryReminders = (endDate) =>
    buildDispanseryReminders(endDate, { nextWorkDay, dv });

  const replaceDispanseryReminders = async (endDate, { activate = false } = {}) => {
    const newReminders = generateDispanseryReminders(endDate);
    await patchCurrentFrontmatter((fm) => {
      if (activate) fm.Диспансерный_учет = true;
      if (!Array.isArray(fm.Напоминания)) fm.Напоминания = [];
      fm.Напоминания = filterOutDispanseryReminders(fm.Напоминания);
      fm.Напоминания.push(...newReminders);
    }, { reread: false });
    return newReminders;
  };

  const activateDispanseryMonitoring = (endDate) => replaceDispanseryReminders(endDate, { activate: true });
  const refreshDispanseryMonitoring = (endDate) => replaceDispanseryReminders(endDate, { activate: false });

  const saveNote = async ({ text, timestamp } = {}) => {
    const noteText = normalizeText(text);
    if (!noteText) return null;
    const noteTimestamp = normalizeNoteTimestamp(timestamp, dv);
    const note = { Дата: noteTimestamp, Текст: noteText };
    await patchCurrentFrontmatter((fm) => {
      if (!Array.isArray(fm.Заметки)) fm.Заметки = [];
      fm.Заметки.push(note);
    }, { reread: false });
    return note;
  };

  const deleteNote = async ({ text, timestamp } = {}) => {
    const noteText = normalizeText(text);
    const noteTimestamp = normalizeNoteTimestamp(timestamp, dv);
    let removed = false;
    await patchCurrentFrontmatter((fm) => {
      if (!Array.isArray(fm.Заметки)) return;
      const idx = fm.Заметки.findIndex((note) => {
        if (!note || typeof note !== "object") return false;
        return String(note.Текст ?? "") === noteText && String(note.Дата ?? "") === noteTimestamp;
      });
      if (idx !== -1) {
        fm.Заметки.splice(idx, 1);
        removed = true;
      }
    }, { reread: false });
    return removed;
  };

  return {
    generateDispanseryReminders,
    activateDispanseryMonitoring,
    refreshDispanseryMonitoring,
    saveNote,
    deleteNote
  };
};

module.exports = {
  DISPANSERY_INTERVALS,
  LAG_DAYS,
  buildDispanseryReminders,
  createPatientNoteReminderActions,
  normalizeNoteTimestamp,
  normalizeText
};
