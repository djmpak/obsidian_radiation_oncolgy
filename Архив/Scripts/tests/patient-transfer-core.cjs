const assert = require("assert");
const {
  DEFAULT_DOCTORS,
  buildTransferredPatientPatch,
  ensureDoctor,
  parseDoctorsMarkdown,
  sortDoctors
} = require("../src/shared/patient-transfer-core.cjs");

const source = `
# Врачи
- Потапов Д.В.
- Мирзаханов Р.И.
- Осинин П.В.
- Иванова Е.Р.
- Яркина А.В.
- Титова Л.М.
- Бардакова А.Ю.
- Калинин К.В.
- Смирнова В.Н.
- Соков В.Н.
- Басистый А.А.
`;

const expected = [
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
];

assert.deepEqual(DEFAULT_DOCTORS, expected);

assert.deepEqual(sortDoctors(parseDoctorsMarkdown(source)), expected);

assert.deepEqual(
  ensureDoctor(["Иванова Е.Р.", "Бардакова А.Ю."], "Иванова Е.Р."),
  ["Бардакова А.Ю.", "Иванова Е.Р."]
);

assert.deepEqual(
  ensureDoctor(["Иванова Е.Р.", "Бардакова А.Ю."], "Потапов Д.В."),
  ["Бардакова А.Ю.", "Иванова Е.Р.", "Потапов Д.В."]
);

assert.deepEqual(
  buildTransferredPatientPatch({
    transferredBy: "Потапов Д.В.",
    todayIso: "2026-05-03",
    markupIso: "2026-05-01",
    treatmentStartIso: "2026-05-04"
  }),
  {
    "Передан": "Потапов Д.В.",
    "Консультация_решение": "принят",
    "Принят_на_лечение": true,
    "Разметка": true,
    "Статус_лечения": "Лечение"
  }
);

assert.deepEqual(
  buildTransferredPatientPatch({
    transferredBy: "Потапов Д.В.",
    todayIso: "2026-05-03",
    markupIso: "2026-05-01",
    treatmentStartIso: "2026-05-02"
  }),
  {
    "Передан": "Потапов Д.В.",
    "Консультация_решение": "принят",
    "Принят_на_лечение": true,
    "Разметка": true,
    "Начало_лечения": true,
    "Статус_лечения": "Лечение"
  }
);

console.log("OK patient transfer doctors parse/sort");
