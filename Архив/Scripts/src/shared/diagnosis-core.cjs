const IDENTITY_KEYS = new Set([
  "ФИО", "Дата_рождения", "СНИЛС", "Номер_телефона", "Email", "db_sex"
]);

const MERGEABLE_NARRATIVE_KEYS = new Set([
  "Диагноз", "Решение_консилиума", "Жалобы", "Анамнез_заболевания",
  "Анамнез_жизни", "Описания_исследований", "Сопутствующие_заболевания",
  "db_prior_treatment", "db_chemo_regimen", "db_other_biomarkers"
]);

const SAFE_AUTOFILL_KEYS = new Set([
  "db_surgery_type", "db_rt_method", "db_hormonal_drug", "db_targeted_drug", "db_immunotherapy_drug"
]);

const INTEGER_KEYS = new Set([
  "db_mol_subtype", "db_er", "db_pr", "db_her2", "db_ki67", "db_progression",
  "db_prog_type", "db_vital_status", "ECOG_статус", "db_ecog_last"
]);

const FLOAT_KEYS = new Set(["db_initial_psa"]);

const CHEMO_UPPERCASE_TOKENS = new Set([
  "AC", "EC", "TC", "DC", "PC", "CHOP", "R-CHOP", "RCHOP", "ABVD", "BEP", "EP", "VIP",
  "FOLFOX", "FOLFIRI", "FOLFIRINOX", "CAPOX", "XELOX", "FLOT", "DCF", "TPF", "MVAC", "M-VAC", "CMF", "CAF", "FAC"
]);

const STAGE_PHRASE_CAPTURE_RE = /(?:^|[^A-Za-zА-Яа-яЁё0-9])((?:I|II|III|IV)(?:A|B|C)?)\s+стадия(?:[^A-Za-zА-Яа-яЁё]|$)/i;

const normalizeCompareText = (value) => String(value || "")
  .toLowerCase()
  .replace(/ё/g, "е")
  .replace(/\u00a0/g, " ")
  .replace(/\s+/g, " ")
  .trim();

const escapeRegExp = (value) => String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const buildStagePhraseRegex = (value) => new RegExp(`(?:^|[^A-Za-zА-Яа-яЁё0-9])${escapeRegExp(value)}\\s+стадия(?:[^A-Za-zА-Яа-яЁё]|$)`, "i");

const buildTnmPartRegex = (key, value) => {
  const escapedValue = escapeRegExp(value);
  if (key === "db_t") return new RegExp(`[cpyr]?T${escapedValue}(?=N|[^A-Za-zА-Яа-яЁё0-9]|$)`, "i");
  if (key === "db_n") return new RegExp(`N${escapedValue}(?=M|[^A-Za-zА-Яа-яЁё0-9]|$)`, "i");
  return new RegExp(`M${escapedValue}(?=[^A-Za-zА-Яа-яЁё0-9]|$)`, "i");
};

const normalizeEcog = (raw) => {
  if (raw === null || raw === undefined) return null;
  const text = String(raw).trim();
  if (!text) return null;
  const match = text.match(/(?:ecog|эког)?\s*([0-4])/i) || text.match(/([0-4])/);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isInteger(value) && value >= 0 && value <= 4 ? String(value) : null;
};

const matchEcogInText = (text) => {
  const source = String(text || "").replace(/\u00a0/g, " ");
  const match = source.match(/(?:ECOG(?:\s*[-/–]?\s*PS)?|ЭКОГ|WHO\s*PS|функциональн(?:ый|ого)\s+статус(?:\s+по\s+шкале\s+ECOG)?|статус\s+по\s+шкале\s+ECOG)[^0-4]{0,24}(?:[:=]|[-–])?\s*([0-4])(?:\s*балл(?:а|ов)?)?/i);
  if (!match) return null;
  const value = normalizeEcog(match[1]);
  return value === null ? null : { value, fragment: String(match[0] || "").trim() };
};

const extractDiagnosisTnmStage = (diagnosisText) => {
  const text = String(diagnosisText || "").trim();
  const firstLine = text.split("\n").map((line) => line.trim()).find(Boolean) || text;
  const compactTnm = firstLine.match(/([cpyr]?T(?:is|[0-4X][a-c]?))\s*N([0-3X][a-c]?)\s*M([01X][a-c]?)/i);
  const tFull = compactTnm?.[1] || firstLine.match(/([cpyr]?T(?:is|[0-4X][a-c]?))(?=N|[^A-Za-zА-Яа-яЁё0-9]|$)/i)?.[1] || "";
  const tPrefix = tFull.match(/^([cpyr]?)/i)?.[1] || "";
  const tVal = tFull ? tFull.replace(/^[cpyr]?T/i, "") : "";
  const nVal = compactTnm?.[2] || firstLine.match(/N([0-3X][a-c]?)(?=M|[^A-Za-zА-Яа-яЁё0-9]|$)/i)?.[1] || "";
  const mVal = compactTnm?.[3] || firstLine.match(/M([01X][a-c]?)(?=[^A-Za-zА-Яа-яЁё0-9]|$)/i)?.[1] || "";
  const stage = firstLine.match(STAGE_PHRASE_CAPTURE_RE)?.[1] || "";
  return { firstLine, tPrefix, tVal, nVal, mVal, stage };
};

const getCourseWord = (count) => {
  const abs = Math.abs(Number(count)) % 100;
  const last = abs % 10;
  if (abs >= 11 && abs <= 14) return "курсов";
  if (last === 1) return "курс";
  if (last >= 2 && last <= 4) return "курса";
  return "курсов";
};

const normalizeInlineText = (value) => String(value ?? "")
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

const splitDiagnosisSentences = (value) => normalizeInlineText(value)
  .split(/\.\s+(?=[А-ЯA-Z0-9С])/u)
  .map((part) => part.trim().replace(/\.$/, ""))
  .filter(Boolean);

const diagnosisEventStamp = (part) => {
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

const splitDiagnosisHeadAndEvents = (parts) => {
  const list = Array.isArray(parts) ? parts.filter(Boolean) : [];
  const eventIdx = list.findIndex((part) => diagnosisEventStamp(part) !== null);
  if (eventIdx < 0) return { head: list, events: [] };
  return { head: list.slice(0, eventIdx), events: list.slice(eventIdx) };
};

const mergeDistinctSegments = (baseParts, nextParts) => {
  const normalize = (text) => normalizeCompareText(text);
  const result = Array.isArray(baseParts) ? [...baseParts] : [];
  const norms = result.map(normalize);
  for (const part of Array.isArray(nextParts) ? nextParts : []) {
    const norm = normalize(part);
    if (!norm) continue;
    const idx = norms.findIndex((existing) => existing === norm || existing.includes(norm) || norm.includes(existing));
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

const buildDiagnosisText = (parts) => {
  const list = (Array.isArray(parts) ? parts : [])
    .map((part) => normalizeInlineText(part).replace(/\.$/, ""))
    .filter(Boolean);
  return list.length ? `${list.join(". ")}.` : "";
};

const normalizeDiagnosisText = (value) => buildDiagnosisText(splitDiagnosisSentences(value));

const mergeDiagnosisText = (existingText, nextText) => {
  const currentParts = splitDiagnosisSentences(existingText);
  const incomingParts = splitDiagnosisSentences(nextText);
  if (!incomingParts.length) return buildDiagnosisText(currentParts);
  if (!currentParts.length) return buildDiagnosisText(incomingParts);
  const currentSplit = splitDiagnosisHeadAndEvents(currentParts);
  const incomingSplit = splitDiagnosisHeadAndEvents(incomingParts);
  const head = mergeDistinctSegments(currentSplit.head, incomingSplit.head);
  const mergedEvents = mergeDistinctSegments(currentSplit.events, incomingSplit.events)
    .map((part, index) => ({ part, index, stamp: diagnosisEventStamp(part) ?? Number.MAX_SAFE_INTEGER }))
    .sort((left, right) => left.stamp === right.stamp ? left.index - right.index : left.stamp - right.stamp)
    .map((item) => item.part);
  return buildDiagnosisText([...head, ...mergedEvents]);
};

const normalizeChemoSchemeToken = (token) => {
  const text = normalizeInlineText(token);
  if (!text) return "";
  const upper = text.toUpperCase();
  if (CHEMO_UPPERCASE_TOKENS.has(upper)) return upper;
  return text.replace(/(^|[\s/()-])([A-Za-zА-Яа-яЁё])/gu, (_, prefix, letter) => `${prefix}${letter.toUpperCase()}`);
};

const normalizeChemoSchemeText = (text) => String(text || "")
  .split(/\s*→\s*/u)
  .map((step) => step.split(/\s*\+\s*/u).map(normalizeChemoSchemeToken).filter(Boolean).join(" + "))
  .filter(Boolean)
  .join(" → ");

const normalizeChemoEntry = (value) => {
  let text = normalizeInlineText(value)
    .replace(/\b\d+(?:[.,]\d+)?\s*(?:мг\/м2|мг|г|мкг|мл|ЕД|IU)\b/giu, "")
    .replace(/\s*[xх×]\s*(\d+)\b/gu, (_, count) => ` ${count} ${getCourseWord(count)}`)
    .replace(/\b(\d+)\s*курс(?:ы|а|ов)?\b/giu, (_, count) => `${count} ${getCourseWord(count)}`)
    .replace(/(^|[^A-Za-zА-Яа-яЁё])(?:ПХТ|МХТ|ХЛТ|ХТ)(?=[^A-Za-zА-Яа-яЁё]|$)/giu, (_, prefix) => `${prefix}ХТ`)
    .replace(/\s*\+\s*/g, " + ")
    .replace(/\s*→\s*/g, " → ")
    .replace(/\s{2,}/g, " ")
    .replace(/^с\b/iu, "С")
    .trim();

  const explicitScheme = text.match(/^(.*?)\s+по\s+схеме\s+(.+)$/iu);
  if (explicitScheme) {
    const prefixBase = normalizeInlineText(explicitScheme[1])
      .replace(/(^|[^A-Za-zА-Яа-яЁё])(?:ПХТ|МХТ|ХЛТ|ХТ)(?=[^A-Za-zА-Яа-яЁё]|$)/giu, (_, prefix) => `${prefix}ХТ`);
    const prefix = /(?:^|[^A-Za-zА-Яа-яЁё])ХТ(?=[^A-Za-zА-Яа-яЁё]|$)/u.test(prefixBase) ? prefixBase : `${prefixBase} ХТ`;
    const scheme = normalizeChemoSchemeText(explicitScheme[2].replace(/\.*$/, ""));
    return normalizeInlineText(`${prefix} по схеме ${scheme}`);
  }

  const afterHt = text.match(/^(.*?(?:^|\s)ХТ)\s+(.+)$/iu);
  if (afterHt) {
    const prefix = normalizeInlineText(afterHt[1]);
    const scheme = normalizeChemoSchemeText(afterHt[2].replace(/\.*$/, ""));
    return normalizeInlineText(`${prefix} по схеме ${scheme}`);
  }

  return text;
};

const normalizeHistoryText = (value, mode = "generic") => {
  let text = String(value ?? "")
    .replace(/\r?\n+/g, "; ")
    .replace(/[•●]/g, "; ")
    .replace(/\*\*/g, "")
    .trim();
  if (!text) return "";
  text = text.replace(/\s*;\s*/g, "; ").replace(/\s{2,}/g, " ");
  if (mode === "chemo") {
    return text
      .split(/\s*;\s*/u)
      .map(normalizeChemoEntry)
      .filter(Boolean)
      .join("; ");
  }
  return text.replace(/^[;,\s]+|[;,\s]+$/g, "");
};

const getRiskLevel = (key) => {
  if (IDENTITY_KEYS.has(key)) return "identity";
  if (MERGEABLE_NARRATIVE_KEYS.has(key)) return "mergeable_narrative";
  if (SAFE_AUTOFILL_KEYS.has(key)) return "safe_autofill";
  return "critical_clinical";
};

const getSourceTypeScore = (label) => {
  const text = String(label || "").trim().toLowerCase();
  if (!text) return 0.65;
  if (/ручн|ревью|review/u.test(text)) return 1;
  if (/диагноз документа|лаборатор|морфолог|игх|мги/u.test(text)) return 0.95;
  if (/вставлен|документ|эпикриз|выписк|протокол|заключен/u.test(text)) return 0.85;
  if (/пересч[её]т tnm9|tnm9/u.test(text)) return 0.55;
  if (/шаблонн|regex|fallback/u.test(text)) return 0.4;
  return 0.7;
};

const hasExactQuoteSupport = (key, value, fragment) => {
  const text = String(fragment || "").trim();
  if (!text) return false;
  const valueText = value === null || value === undefined ? "" : String(value);
  if (!valueText) return false;
  const normalizedText = normalizeCompareText(text);
  const normalizedValue = normalizeCompareText(valueText);
  if (!normalizedText || !normalizedValue) return false;
  if (key === "ECOG_статус" || key === "db_ecog_last") {
    return new RegExp(`(?:ECOG(?:\\s*[-/–]?\\s*PS)?|ЭКОГ|WHO\\s*PS)[^0-4]{0,24}${escapeRegExp(valueText)}`, "i").test(text);
  }
  if (key === "db_stage") {
    return buildStagePhraseRegex(valueText).test(text) || normalizedText.includes(normalizedValue);
  }
  if (key === "db_vital_status") {
    if (valueText === "1") return /умер|умерла|умерло|скончал(?:ся|ась)|летальн|deceased|died|dead/i.test(text);
    if (valueText === "0") return /(?:^|[^A-Za-zА-Яа-яЁё])жив(?:а|ой)?(?:[^A-Za-zА-Яа-яЁё]|$)|alive|цензур|под наблюдением|на контроле/i.test(text);
  }
  if (key === "db_t" || key === "db_n" || key === "db_m") {
    return buildTnmPartRegex(key, valueText).test(text);
  }
  if (INTEGER_KEYS.has(key) || FLOAT_KEYS.has(key)) {
    return new RegExp(`(^|[^\\d])${escapeRegExp(valueText)}([^\\d]|$)`, "i").test(text) || normalizedText.includes(normalizedValue);
  }
  return normalizedText.includes(normalizedValue);
};

const normalizeSourceDate = (raw) => {
  const value = String(raw || "").trim();
  if (!value) return "";
  const match = value.match(/^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?$/);
  if (!match) return "";
  return `${match[1]}-${String(Number(match[2] || 0)).padStart(2, "0")}-${String(Number(match[3] || 0)).padStart(2, "0")}`;
};

const compareSourceDates = (left, right) => {
  const a = normalizeSourceDate(left);
  const b = normalizeSourceDate(right);
  if (!a || !b) return null;
  if (a === b) return 0;
  return a > b ? 1 : -1;
};

const hasTreatmentEvidence = (text) => /(?:^|[^A-Za-zА-Яа-яЁё])(?:ПХТ|МХТ|ХТ|ЛТ|ДЛТ|ХЛТ|АДТ)(?:[^A-Za-zА-Яа-яЁё]|$)|лучев[а-я\s-]*терап|брахитерап|стереотакс|операц|резекц|лобэктом|лимфодиссекц|мастэктом|биопси|гормонотерап|таргетн|иммунотерап|дегареликс|гозерелин|тамоксифен|летрозол|палбоциклиб|осимертиниб|гефитиниб|капецитабин|цисплатин|карбоплатин|паклитаксел|folfox|folfiri|folfirinox/i.test(String(text || ""));

const hasProgressionEvidence = (text) => /(?:прогрессир|прогрессия|прогрессирование|отдал[её]нн[а-я\s-]*метаст|метастаз[а-я\s-]*в|множественн[а-я\s-]*метаст|новые\s+метаст|дистанционн[а-я\s-]*метаст)/i.test(String(text || ""));

const TNM_FULL_RE = /([cpyr]{0,2}T(?:is|[0-4X][a-c]?)[ ]*N[0-3X][a-c]?[ ]*M[01X][a-c]?)/i;

const normalizeTnm = (value) => String(value || "").replace(/\s+/g, "");

const extractStageNear = (text, index = 0) => {
  const source = String(text || "");
  const window = source.slice(Math.max(0, index - 80), index + 160);
  const direct = window.match(/(?:^|[^A-Za-zА-Яа-яЁё0-9])((?:I|II|III|IV)(?:A|B|C)?)(?:\s+стадия|[,.])/i)?.[1] || "";
  return direct.toUpperCase();
};

const findInitialPreNeoadjuvantStage = (text = "") => {
  const source = normalizeInlineText(text);
  const treatmentMarker = source.search(/неоадъювант|НПХТ|предоперац/i);
  const searchText = treatmentMarker >= 0 ? source.slice(0, treatmentMarker + 140) : source;
  const match = searchText.match(/cT(?:is|[0-4X][a-c]?)[ ]*N[0-3X][a-c]?[ ]*M[01X][a-c]?/i);
  if (!match) return null;
  return {
    tnm: normalizeTnm(match[0]),
    stage: extractStageNear(searchText, match.index || 0)
  };
};

const findSurgeryWithPostoperativeStage = (text = "") => {
  const source = normalizeInlineText(text);
  const results = [];
  const surgeryRe = /(?:операц|резекц|лобэктом|мастэктом|радикальн|ПГИ)/ig;
  let surgeryMatch;
  while ((surgeryMatch = surgeryRe.exec(source)) !== null) {
    const start = Math.max(0, surgeryMatch.index - 120);
    const end = Math.min(source.length, surgeryMatch.index + 220);
    const fragment = source.slice(start, end);
    const stageMatch = fragment.match(/\b(?:yp|p)T(?:is|[0-4X][a-c]?)[ ]*N[0-3X][a-c]?[ ]*M[01X][a-c]?\b/i);
    if (!stageMatch) continue;
    results.push({
      fragment: normalizeInlineText(fragment),
      postoperativeStage: normalizeTnm(stageMatch[0])
    });
  }
  return results;
};

const extractTreatmentAwareStages = (text = "") => {
  const normalized = normalizeDiagnosisText(text);
  return {
    initialStage: findInitialPreNeoadjuvantStage(normalized),
    surgery: findSurgeryWithPostoperativeStage(normalized)
  };
};

const shouldKeepHistoricalStage = ({ currentState, proposedState, currentDiagnosis, proposedDiagnosis, sourceText }) => {
  const hasCurrentStage = !!String(currentState?.stage || currentState?.t || currentState?.n || currentState?.m || "").trim();
  if (!hasCurrentStage) return false;
  const changed = ["t", "n", "m", "stage"].some((key) => String(proposedState?.[key] || "") !== String(currentState?.[key] || ""));
  if (!changed) return false;
  const treatmentStarted = hasTreatmentEvidence(currentDiagnosis) || hasTreatmentEvidence(proposedDiagnosis) || hasTreatmentEvidence(sourceText);
  const progressionMentioned = hasProgressionEvidence(sourceText) || hasProgressionEvidence(proposedDiagnosis) || hasProgressionEvidence(currentDiagnosis);
  return treatmentStarted && progressionMentioned;
};

module.exports = {
  constants: {
    IDENTITY_KEYS,
    MERGEABLE_NARRATIVE_KEYS,
    SAFE_AUTOFILL_KEYS,
    INTEGER_KEYS,
    FLOAT_KEYS,
    CHEMO_UPPERCASE_TOKENS,
    STAGE_PHRASE_CAPTURE_RE
  },
  normalizeEcog,
  matchEcogInText,
  extractDiagnosisTnmStage,
  getCourseWord,
  normalizeInlineText,
  splitDiagnosisSentences,
  diagnosisEventStamp,
  splitDiagnosisHeadAndEvents,
  mergeDistinctSegments,
  buildDiagnosisText,
  normalizeDiagnosisText,
  mergeDiagnosisText,
  normalizeChemoSchemeToken,
  normalizeChemoSchemeText,
  normalizeChemoEntry,
  normalizeHistoryText,
  getRiskLevel,
  getSourceTypeScore,
  escapeRegExp,
  normalizeCompareText,
  buildStagePhraseRegex,
  buildTnmPartRegex,
  hasExactQuoteSupport,
  normalizeSourceDate,
  compareSourceDates,
  hasTreatmentEvidence,
  hasProgressionEvidence,
  findInitialPreNeoadjuvantStage,
  findSurgeryWithPostoperativeStage,
  extractTreatmentAwareStages,
  shouldKeepHistoricalStage
};
