"use strict";

const DEFAULT_DOCTORS = Object.freeze([
  "Бардакова А.Ю.",
  "Басистый А.А.",
  "Иванова Е.Р.",
  "Калинин К.В.",
  "Мирзаханов Р.И.",
  "Осинин П.В.",
  "Потапов Д.В.",
  "Смирнова В.Н.",
  "Соков В.Н.",
  "Титова Л.М.",
  "Яркина А.В."
]);

const normalizeDoctorName = (value) => String(value ?? "")
  .replace(/\s+/gu, " ")
  .trim();

const parseDoctorsMarkdown = (source = "") => {
  const doctors = [];
  for (const line of String(source ?? "").split(/\r?\n/u)) {
    const match = line.match(/^\s*[-*]\s+(.+?)\s*$/u);
    if (!match) continue;
    const name = normalizeDoctorName(match[1]);
    if (name) doctors.push(name);
  }
  return doctors;
};

const sortDoctors = (doctors = []) => {
  const collator = new Intl.Collator("ru", { usage: "sort", sensitivity: "base" });
  return Array.from(
    new Set(
      (Array.isArray(doctors) ? doctors : [])
        .map(normalizeDoctorName)
        .filter(Boolean)
    )
  ).sort(collator.compare);
};

const ensureDoctor = (doctors = [], name = "") => {
  const normalized = normalizeDoctorName(name);
  const next = Array.isArray(doctors) ? doctors.slice() : [];
  if (normalized && !next.map(normalizeDoctorName).includes(normalized)) {
    next.push(normalized);
  }
  return sortDoctors(next);
};

const buildTransferredPatientPatch = ({
  transferredBy = "",
  todayIso = "",
  markupIso = "",
  treatmentStartIso = ""
} = {}) => {
  const doctor = normalizeDoctorName(transferredBy);
  if (!doctor) return {};

  const patch = {
    "Передан": doctor,
    "Консультация_решение": "принят",
    "Принят_на_лечение": true,
    "Статус_лечения": "Лечение"
  };

  const today = String(todayIso || "").trim();
  const markup = String(markupIso || "").trim();
  const treatmentStart = String(treatmentStartIso || "").trim();

  if (today && markup && markup <= today) patch["Разметка"] = true;
  if (today && treatmentStart && treatmentStart <= today) patch["Начало_лечения"] = true;

  return patch;
};

module.exports = {
  DEFAULT_DOCTORS,
  normalizeDoctorName,
  parseDoctorsMarkdown,
  sortDoctors,
  ensureDoctor,
  buildTransferredPatientPatch
};
