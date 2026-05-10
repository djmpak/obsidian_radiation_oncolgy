const assert = require("node:assert/strict");
const path = require("node:path");

const diagnosisCorePath = path.resolve(__dirname, "..", "src", "shared", "diagnosis-core.cjs");
const {
  normalizeEcog,
  matchEcogInText,
  extractDiagnosisTnmStage,
  normalizeDiagnosisText,
  mergeDiagnosisText,
  normalizeHistoryText,
  getRiskLevel,
  getSourceTypeScore,
  hasExactQuoteSupport,
  compareSourceDates,
  extractTreatmentAwareStages,
  shouldKeepHistoricalStage
} = require(diagnosisCorePath);

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

test("ECOG normalization extracts valid values only", () => {
  assert.equal(normalizeEcog("ECOG 2"), "2");
  assert.equal(normalizeEcog("ЭКОГ-4"), "4");
  assert.equal(normalizeEcog(""), null);
});

test("ECOG text matcher finds structured fragments", () => {
  assert.equal(matchEcogInText("Функциональный статус ECOG: 3").value, "3");
  assert.equal(matchEcogInText("ЭКОГ статус удовлетворительный"), null);
});

test("TNM extraction uses the first diagnosis line", () => {
  const parsed = extractDiagnosisTnmStage([
    "Аденокарцинома легкого, cT2aN3M0, G2, IIIB стадия.",
    "05.2024 Прогрессирование, метастазы в печень."
  ].join("\n"));

  assert.equal(parsed.stage, "IIIB");
  assert.equal(parsed.tVal, "2a");
  assert.equal(parsed.nVal, "3");
  assert.equal(parsed.mVal, "0");
});

test("Diagnosis normalization keeps chronology in one line", () => {
  const normalized = normalizeDiagnosisText([
    "Аденокарцинома легкого, cT2aN3M0, G2, IIIB стадия.",
    "EGFR del19+, ALK отрицательный.",
    "05.2024 Прогрессирование, отдаленные метастазы в печень."
  ].join("\n"));

  assert.equal(normalized, "Аденокарцинома легкого, cT2aN3M0, G2, IIIB стадия. EGFR del19+, ALK отрицательный. 05.2024 Прогрессирование, отдаленные метастазы в печень.");
});

test("Diagnosis merge preserves chronological narrative", () => {
  const merged = mergeDiagnosisText(
    "Аденокарцинома легкого, cT2aN3M0, G2, IIIB стадия. С 03.2024 ХТ по схеме Этопозид + Карбоплатин.",
    "Аденокарцинома легкого, cT2aN3M0, G2, IIIB стадия.\nС 03.2024 ХТ по схеме Этопозид + Карбоплатин.\n05.2024 Прогрессирование, отдаленные метастазы в печень."
  );

  assert.equal(merged, "Аденокарцинома легкого, cT2aN3M0, G2, IIIB стадия. С 03.2024 ХТ по схеме Этопозид + Карбоплатин. 05.2024 Прогрессирование, отдаленные метастазы в печень.");
});

test("Chemo normalization keeps courses and canonical scheme spelling", () => {
  const normalized = normalizeHistoryText("С 12.02.2025 по 29.05.2025 проведено 4 курса ПХТ по схеме этопозид+карбоплатин", "chemo");
  assert.equal(normalized, "С 12.02.2025 по 29.05.2025 проведено 4 курса ХТ по схеме Этопозид + Карбоплатин");
});

test("Risk levels classify field types correctly", () => {
  assert.equal(getRiskLevel("ФИО"), "identity");
  assert.equal(getRiskLevel("Диагноз"), "mergeable_narrative");
  assert.equal(getRiskLevel("db_rt_method"), "safe_autofill");
  assert.equal(getRiskLevel("db_stage"), "critical_clinical");
});

test("Source ranking prefers diagnostic documents over weak heuristics", () => {
  assert.ok(getSourceTypeScore("Диагноз документа") > getSourceTypeScore("Шаблонный поиск"));
});

test("Exact quote support recognizes stage and vital status evidence", () => {
  assert.equal(hasExactQuoteSupport("db_stage", "IIIB", "Пациент: IIIB стадия опухоли"), true);
  assert.equal(hasExactQuoteSupport("db_vital_status", "1", "Пациент умер 14.01.2024."), true);
  assert.equal(hasExactQuoteSupport("db_vital_status", "0", "Пациент жив, на контроле."), true);
});

test("Source date comparison orders coarse and precise dates", () => {
  assert.equal(compareSourceDates("2024-03", "2024-05-01"), -1);
  assert.equal(compareSourceDates("2025-01-10", "2024-12"), 1);
});

test("Historical stage guard blocks post-treatment restaging after progression", () => {
  assert.equal(shouldKeepHistoricalStage({
    currentState: { t: "2a", n: "3", m: "0", stage: "IIIB" },
    proposedState: { t: "2a", n: "3", m: "1", stage: "IV" },
    currentDiagnosis: "Аденокарцинома легкого, cT2aN3M0, G2, IIIB стадия.\nС 03.2024 ПХТ.",
    proposedDiagnosis: "Аденокарцинома легкого, cT2aN3M1, G2, IV стадия.\n05.2024 Прогрессирование, отдаленные метастазы.",
    sourceText: "После ПХТ отмечено прогрессирование, отдаленные метастазы в печень."
  }), true);
});

test("Historical stage guard allows initial staging before treatment", () => {
  assert.equal(shouldKeepHistoricalStage({
    currentState: { t: "", n: "", m: "", stage: "" },
    proposedState: { t: "3", n: "1", m: "0", stage: "IIIB" },
    currentDiagnosis: "",
    proposedDiagnosis: "Аденокарцинома прямой кишки, cT3N1M0, G2, IIIB стадия.",
    sourceText: "Первичное обращение, стадирование до лечения."
  }), false);
});

test("Treatment-aware stage extraction keeps initial clinical and postoperative stages separate", () => {
  const text = `
До начала неоадъювантной химиотерапии стадия cT3N1M0, IIIB.
Проведена НПХТ 4 курса.
15.04.2026 выполнена радикальная операция. ПГИ: ypT1N0M0.
`;

  const result = extractTreatmentAwareStages(text);

  assert.equal(result.initialStage.tnm, "cT3N1M0");
  assert.equal(result.initialStage.stage, "IIIB");
  assert.equal(result.surgery[0].postoperativeStage, "ypT1N0M0");
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

console.log(`OK ${passed} shared diagnosis-core tests passed`);
