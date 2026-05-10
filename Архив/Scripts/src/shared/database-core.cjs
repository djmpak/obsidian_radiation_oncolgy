const DB_COLS = [
  "pt_id", "pt_initials", "sex", "birth_year", "age_dx", "ecog_start", "ecog_last",
  "icd10", "tumor_location", "histotype",
  "stage", "stage_num", "t_val", "n_val", "m_val", "grade_val",
  "mol_subtype", "er_val", "pr_val", "her2_val", "ki67_pct", "pdl1_expr",
  "egfr_mut", "alk_status", "ros1_status", "kras_mut", "nras_mut", "ras_mut", "braf_mut", "idh_mut", "brca_mut", "ret_status", "met_status", "ntrk_status",
  "mgmt_meth", "msi_status", "mmr_status", "gleason_score", "psa_initial", "other_biomarkers",
  "tx_goal", "date_dx", "date_start", "date_end",
  "surgery", "surgery_type", "prior_treatment", "chemo", "chemo_regimen",
  "rt", "rt_method", "rt_sod", "rt_fractions", "rt_rod", "rt_zone",
  "hormonal", "hormonal_drug", "targeted", "targeted_drug", "immunotherapy", "immunotherapy_drug",
  "tx_status", "progression", "date_prog", "prog_type",
  "vital_status", "date_death", "date_last_contact",
  "os_days", "lc_days", "dfs_days",
  "qlq_date", "qlq_n", "qlq_gl", "qlq_pf", "qlq_rf", "qlq_ef", "qlq_cf", "qlq_sf",
  "qlq_fa", "qlq_nv", "qlq_pa", "qlq_dy", "qlq_sl", "qlq_ap", "qlq_co", "qlq_di", "qlq_fi",
  "qlq_module", "qlq_spec_score", "date_record", "date_updated"
];

const DB_QLQ_PRESERVE = new Set([
  "qlq_date", "qlq_n", "qlq_gl", "qlq_pf", "qlq_rf", "qlq_ef", "qlq_cf", "qlq_sf",
  "qlq_fa", "qlq_nv", "qlq_pa", "qlq_dy", "qlq_sl", "qlq_ap", "qlq_co", "qlq_di", "qlq_fi", "qlq_spec_score"
]);

const DB_STAGE_TO_NUM = { I: 1, II: 2, IIA: 2, IIB: 2, III: 3, IIIA: 3, IIIB: 3, IIIC: 3, IV: 4 };

const DB_GOAL_MAP = {
  "Радикальный курс": 1,
  "Послеоперационный курс": 2,
  "Предоперационный курс": 3,
  "Паллиативный курс": 4,
  "Консолидирующий курс": 5,
  "Гемостатический курс": 6,
  "Сальважный курс": 7
};

const DB_TX_STATUS_MAP = { "Не начато": 1, "В процессе": 2, "Завершено": 3 };

const escapeCell = (value) => String(value ?? "").replace(/\|/g, "∣").replace(/\r?\n/g, " ").trim();

const getQlqModule = (icd10Raw) => {
  const code = String(icd10Raw || "").toUpperCase().replace(/\s/g, "");
  if (/^C50/u.test(code)) return "BR23";
  if (/^C3[34]/u.test(code)) return "LC13";
  if (/^C1[89]|^C20/u.test(code)) return "CR29";
  if (/^C61/u.test(code)) return "PR25";
  if (/^C15/u.test(code)) return "OES18";
  if (/^C0[0-9]|^C1[0-4]/u.test(code)) return "HN35";
  if (/^C7[12]/u.test(code)) return "BN20";
  if (/^C56/u.test(code)) return "OV28";
  if (/^C53/u.test(code)) return "CX24";
  return "";
};

const tableHeader = () => `| ${DB_COLS.join(" | ")} |`;

const tableSeparator = () => `| ${DB_COLS.map(() => "---").join(" | ")} |`;

const parseMarkdownRowWithColumns = (line, columns = DB_COLS) => {
  const cells = String(line || "").split("|").map((cell) => cell.trim());
  const row = {};
  columns.forEach((col, idx) => {
    row[col] = cells[idx + 1] ?? "";
  });
  return row;
};

const parseMarkdownRow = (line) => parseMarkdownRowWithColumns(line, DB_COLS);

const rowToMarkdown = (rowObj = {}) => `| ${DB_COLS.map((col) => escapeCell(rowObj[col] ?? "")).join(" | ")} |`;

const ensureDatabaseSchema = (content) => {
  const raw = String(content ?? "");
  if (!raw.trim()) return `${tableHeader()}\n${tableSeparator()}\n`;

  const lines = raw.split(/\r?\n/u);
  if (!lines[0]?.trim().startsWith("|")) return `${tableHeader()}\n${tableSeparator()}\n`;

  const currentCols = lines[0].split("|").map((cell) => cell.trim()).filter(Boolean);
  const dataLines = lines.slice(2).filter((line) => line.trim().startsWith("|"));
  const mappedRows = dataLines.map((line) => {
    const rowObj = parseMarkdownRowWithColumns(line, currentCols);
    return rowToMarkdown(rowObj);
  });

  return [tableHeader(), tableSeparator(), ...mappedRows].join("\n") + "\n";
};

const mergeDatabaseRow = (currentRow = {}, incomingRow = {}) => {
  const result = {};
  DB_COLS.forEach((col) => {
    const oldVal = currentRow[col] ?? "";
    const newVal = incomingRow[col] ?? "";
    if (DB_QLQ_PRESERVE.has(col) && oldVal !== "") {
      result[col] = oldVal;
      return;
    }
    if (col === "date_record" && oldVal !== "") {
      result[col] = oldVal;
      return;
    }
    result[col] = newVal !== "" ? newVal : oldVal;
  });
  return result;
};

const findDatabaseRowIndex = (lines = [], patientId = "") => {
  const dbId = String(patientId || "").trim();
  if (!dbId) return -1;
  return lines.findIndex((line, idx) => {
    if (idx < 2) return false;
    return parseMarkdownRow(line).pt_id === dbId;
  });
};

const findDatabaseRow = (content, patientId = "") => {
  const lines = ensureDatabaseSchema(content).split("\n");
  const lineIndex = findDatabaseRowIndex(lines, patientId);
  if (lineIndex < 0) return null;
  return {
    lineIndex,
    row: parseMarkdownRow(lines[lineIndex]),
    rawLine: lines[lineIndex]
  };
};

const finalizeDatabaseLines = (lines = []) => lines
  .filter((line, idx) => idx < 2 || String(line || "").trim() !== "")
  .join("\n") + "\n";

const removeDatabaseRow = (content, patientId = "") => {
  const lines = ensureDatabaseSchema(content).split("\n");
  const lineIndex = findDatabaseRowIndex(lines, patientId);
  if (lineIndex < 0) {
    return {
      removed: false,
      lineIndex: -1,
      content: finalizeDatabaseLines(lines)
    };
  }

  lines.splice(lineIndex, 1);
  return {
    removed: true,
    lineIndex,
    content: finalizeDatabaseLines(lines)
  };
};

const normalizeLinkedCaseNames = (raw) => {
  const arr = Array.isArray(raw) ? raw : (raw ? [raw] : []);
  return arr
    .map((value) => String(value ?? "").replace(/^\[\[|\]\]$/g, "").split("|")[0].trim())
    .filter(Boolean);
};

const defaultGeneratePatientId = () => `${100 + Math.floor(Math.random() * 900)}-${100 + Math.floor(Math.random() * 900)}`;

const resolvePatientId = ({
  existingId = "",
  fio = "",
  birthDate = "",
  linkedCases = [],
  existingIds = new Set(),
  findLinkedPatient = () => null,
  generateId = defaultGeneratePatientId,
  maxAttempts = 9999
} = {}) => {
  if (existingId) return { id: String(existingId), source: "existing" };
  if (!(fio && birthDate)) return { id: "", source: "missing_identity" };

  for (const item of normalizeLinkedCaseNames(linkedCases)) {
    const linkedPage = findLinkedPatient(item);
    if (linkedPage?.ID_пациента) return { id: String(linkedPage.ID_пациента), source: "linked" };
  }

  const allIds = existingIds instanceof Set
    ? existingIds
    : new Set(Array.isArray(existingIds) ? existingIds.map(String) : []);
  let nextId = "";
  let attempts = 0;
  do {
    nextId = String(generateId());
  } while (allIds.has(nextId) && ++attempts < maxAttempts);

  return { id: nextId, source: nextId ? "generated" : "missing_identity" };
};

const getPatientIdPatch = (patientId) => {
  const id = String(patientId || "").trim();
  return id ? { "ID_пациента": id } : {};
};

const buildDatabaseRow = ({
  getVal,
  normalizeText = (value) => String(value ?? "").replace(/\s+/g, " ").trim(),
  joinText,
  normalizeHistoryText,
  normalizeDrugNames,
  extractSentenceEvents = () => "",
  isTreatmentEvent = () => false,
  isChemoEvent = () => false,
  inferPdl1 = () => "",
  inferBinaryMarker = () => "",
  inferMgmtMeth = () => "",
  inferMsiStatus = () => "",
  inferMmrStatus = () => "",
  inferGleason = () => "",
  inferInitialPsa = () => "",
  getQlqModule: resolveQlqModule = getQlqModule,
  todayIso
} = {}) => {
  if (typeof getVal !== "function") throw new Error("buildDatabaseRow: getVal is required");
  const normalizeHistory = typeof normalizeHistoryText === "function" ? normalizeHistoryText : (value) => normalizeText(value);
  const normalizeDrugs = typeof normalizeDrugNames === "function" ? normalizeDrugNames : (value) => normalizeText(value);
  const joinSourceText = typeof joinText === "function"
    ? joinText
    : (...values) => values.map(normalizeText).filter(Boolean).join("\n");
  const nowIso = typeof todayIso === "function"
    ? todayIso()
    : (todayIso || new Date().toISOString().slice(0, 10));
  const get = (key) => getVal(key);
  const hasValue = (value) => value !== null && value !== undefined && value !== "";
  const ov = (key, fallback) => {
    const value = get(key);
    return hasValue(value) ? value : fallback;
  };

  const fio = String(get("ФИО") || "");
  const parts = fio.trim().split(/\s+/u).filter(Boolean);
  const initials = parts.length
    ? parts[0] + (parts[1] ? ` ${parts[1][0]}.` : "") + (parts[2] ? `${parts[2][0]}.` : "")
    : fio;
  const dob = get("Дата_рождения") ? String(get("Дата_рождения")) : "";
  const birthYear = dob ? dob.slice(0, 4) : "";
  const dateStart = get("Дата_начала_лечения") ? String(get("Дата_начала_лечения")) : "";
  const dateEnd = get("Дата_окончания_лечения") ? String(get("Дата_окончания_лечения")) : "";
  const ageDx = (birthYear && dateStart) ? String(new Date(dateStart).getFullYear() - Number(birthYear)) : "";
  const diagnosis = String(get("Диагноз") || "");
  const fullText = joinSourceText(
    get("Диагноз"),
    get("Описания_исследований"),
    get("Анамнез_заболевания"),
    get("Решение_консилиума")
  );

  const stageMatch = diagnosis.match(/\b(I{1,3}V?|IV)\s*[A-C]?\s+стадия/iu);
  const stage = stageMatch ? stageMatch[0].replace(/\s+стадия/iu, "").trim() : "";
  const stageNum = DB_STAGE_TO_NUM[stage] || "";
  const tMatch = diagnosis.match(/[cpyr]?T([0-4Xisab]+)/iu);
  const nMatch = diagnosis.match(/\bN([0-3Xabc]+)/iu);
  const mMatch = diagnosis.match(/\bM([01Xabc]+)/iu);
  const gMatch = diagnosis.match(/,\s*G([1-4])/iu);

  const subtypeMap = {
    "Люминальный A": 1,
    "Люминальный B, HER2-отрицательный": 2,
    "Люминальный B HER2-отрицательный": 2,
    "Люминальный B, HER2-положительный": 3,
    "Люминальный B HER2-положительный": 3,
    "HER2-положительный": 4,
    "Тройной негативный": 5
  };
  const subtypeMatch = diagnosis.match(/(Люминальный\s+[AB][^.]*|Тройной негативный|HER2-положительный)/iu);
  const subtypeStr = subtypeMatch ? subtypeMatch[0].trim() : "";
  const subtypeNum = Object.entries(subtypeMap).find(([key]) => subtypeStr.toLowerCase().includes(key.toLowerCase()))?.[1] || "";
  const er = diagnosis.match(/ER\s+(\d+)/iu)?.[1] || "";
  const pr = diagnosis.match(/PR\s+(\d+)/iu)?.[1] || "";
  const her2 = diagnosis.match(/HER2\s+(\d)/iu)?.[1] || "";
  const ki67 = diagnosis.match(/Ki67\s+([\d]+)%/iu)?.[1] || "";

  const pdl1 = ov("db_pdl1", inferPdl1(fullText));
  const egfr = ov("db_egfr_mut", inferBinaryMarker(fullText, "EGFR", [/\bL858R\b/i, /\bT790M\b/i], []));
  const alk = ov("db_alk_status", inferBinaryMarker(fullText, "ALK", [], []));
  const ros1 = ov("db_ros1_status", inferBinaryMarker(fullText, "ROS1", [], []));
  const kras = ov("db_kras_mut", inferBinaryMarker(fullText, "KRAS", [], []));
  const nras = ov("db_nras_mut", inferBinaryMarker(fullText, "NRAS", [], []));
  const rasFallback = (kras === 1 || nras === 1) ? 1 : ((kras === 0 && nras === 0) ? 0 : inferBinaryMarker(fullText, "RAS", [], []));
  const ras = ov("db_ras_mut", rasFallback);
  const braf = ov("db_braf_mut", inferBinaryMarker(fullText, "BRAF", [], []));
  const idh = ov("db_idh_mut", inferBinaryMarker(fullText, "IDH(?:1|2)?", [], []));
  const brca = ov("db_brca_mut", inferBinaryMarker(fullText, "BRCA(?:1|2)?", [], []));
  const ret = ov("db_ret_status", inferBinaryMarker(fullText, "RET", [], []));
  const met = ov("db_met_status", inferBinaryMarker(fullText, "MET", [], []));
  const ntrk = ov("db_ntrk_status", inferBinaryMarker(fullText, "NTRK(?:1|2|3)?", [], []));
  const mgmt = normalizeText(ov("db_mgmt_meth", inferMgmtMeth(fullText)));
  const msi = normalizeText(ov("db_msi_status", inferMsiStatus(fullText)));
  const mmr = normalizeText(ov("db_mmr_status", inferMmrStatus(fullText)));
  const gleason = normalizeText(ov("db_gleason", inferGleason(fullText)));
  const psaInitial = normalizeText(ov("db_initial_psa", inferInitialPsa(fullText)));
  const otherBiomarkers = normalizeHistory(ov("db_other_biomarkers", ""), "generic");
  const priorFallback = extractSentenceEvents(diagnosis, isTreatmentEvent, "generic");
  const priorTreatment = normalizeHistory(ov("db_prior_treatment", priorFallback), "generic");
  const chemoFallback = extractSentenceEvents(diagnosis, isChemoEvent, "chemo");
  const chemoHistory = normalizeHistory(ov("db_chemo_regimen", chemoFallback), "chemo");
  const hormonalDrugs = normalizeDrugs(ov("db_hormonal_drug", ""));
  const targetedDrugs = normalizeDrugs(ov("db_targeted_drug", ""));
  const immunotherapyDrugs = normalizeDrugs(ov("db_immunotherapy_drug", ""));

  const txGoal = DB_GOAL_MAP[get("Цель_лечения")] || "";
  const surgeryFlag = /операц|резекц|простатэктом|лобэктом|биопси/iu.test(joinSourceText(diagnosis, get("db_surgery_type"), priorTreatment)) ? 1 : 0;
  const chemoFlag = chemoHistory ? 1 : (/ПХТ|МХТ|Темозоломид|Паклитаксел|Капецитабин|CHOP|FOLFOX|CAPOX|XELOX|CAR-T/iu.test(diagnosis) ? 1 : 0);
  const rtFlag = /ДЛТ|ХЛТ|радиохирургия|брахитерапия|СРХ|стереотаксич/iu.test(joinSourceText(diagnosis, priorTreatment)) ? 1 : 0;
  const hormonalFlag = hormonalDrugs ? 1 : (/Тамоксифен|Летрозол|Дегареликс|Энзалутамид|АДТ|гормонотерап/iu.test(diagnosis) ? 1 : 0);
  const targetedFlag = targetedDrugs ? 1 : (/Гефитиниб|Осимертиниб|Палбоциклиб|Бевацизумаб|таргетная/iu.test(diagnosis) ? 1 : 0);
  const immunotherapyFlag = immunotherapyDrugs ? 1 : (/Ниволумаб|Пембролизумаб|иммунотерап/iu.test(diagnosis) ? 1 : 0);
  const rawRod = get("РОД") ? Number(String(get("РОД")).replace(",", ".")) : "";
  const rawFracs = get("Количество_фракций") ? Number(get("Количество_фракций")) : "";
  const rod = get("db_rt_rod") !== null ? Number(String(get("db_rt_rod")).replace(",", ".")) : rawRod;
  const fracs = get("db_rt_fractions") !== null ? Number(get("db_rt_fractions")) : rawFracs;
  const sod = get("db_rt_sod") !== null
    ? Math.round(Number(String(get("db_rt_sod")).replace(",", ".")) * 10) / 10
    : ((rod && fracs) ? Math.round(Number(rod) * Number(fracs) * 10) / 10 : "");
  const zone = get("Область_облучения") || "";
  const txStatus = DB_TX_STATUS_MAP[get("Статус_лечения")] || "";
  const osDays = dateStart ? String(Math.round((new Date(dateEnd || nowIso) - new Date(dateStart)) / 86400000)) : "";
  const progFallback = /\bпрогресс/iu.test(fullText) ? 1 : "";
  const dbSex = get("db_sex");
  let sexNum = dbSex === "М" ? 1 : dbSex === "Ж" ? 2 : "";
  if (sexNum === "") {
    const patronymic = parts[2] || "";
    sexNum = /ович$|евич$|ич$/iu.test(patronymic) ? 1 : (/овна$|евна$|ична$|инична$/iu.test(patronymic) ? 2 : "");
  }
  const stageOverride = ov("db_stage", stage);

  return {
    pt_id: get("ID_пациента") || "",
    pt_initials: initials,
    sex: sexNum,
    birth_year: birthYear,
    age_dx: ageDx,
    ecog_start: get("ECOG_статус") ?? "",
    ecog_last: get("db_ecog_last") !== null ? String(get("db_ecog_last")) : "",
    icd10: get("МКБ 10") || "",
    tumor_location: normalizeText(get("db_tumor_location") || ""),
    histotype: normalizeText(get("db_histotype") || ""),
    stage: stageOverride,
    stage_num: stageOverride ? (DB_STAGE_TO_NUM[stageOverride] || stageNum) : stageNum,
    t_val: ov("db_t", tMatch?.[1] || ""),
    n_val: ov("db_n", nMatch?.[1] || ""),
    m_val: ov("db_m", mMatch?.[1] || ""),
    grade_val: ov("db_grade", gMatch?.[1] || ""),
    mol_subtype: ov("db_mol_subtype", subtypeNum),
    er_val: ov("db_er", er),
    pr_val: ov("db_pr", pr),
    her2_val: ov("db_her2", her2),
    ki67_pct: ov("db_ki67", ki67),
    pdl1_expr: pdl1,
    egfr_mut: egfr,
    alk_status: alk,
    ros1_status: ros1,
    kras_mut: kras,
    nras_mut: nras,
    ras_mut: ras,
    braf_mut: braf,
    idh_mut: idh,
    brca_mut: brca,
    ret_status: ret,
    met_status: met,
    ntrk_status: ntrk,
    mgmt_meth: mgmt,
    msi_status: msi,
    mmr_status: mmr,
    gleason_score: gleason,
    psa_initial: psaInitial,
    other_biomarkers: otherBiomarkers,
    tx_goal: txGoal,
    date_dx: get("db_date_dx") || "",
    date_start: dateStart,
    date_end: dateEnd,
    surgery: surgeryFlag,
    surgery_type: normalizeText(get("db_surgery_type") || ""),
    prior_treatment: priorTreatment,
    chemo: chemoFlag,
    chemo_regimen: chemoHistory,
    rt: rtFlag,
    rt_method: normalizeText(get("db_rt_method") || ""),
    rt_sod: sod,
    rt_fractions: fracs,
    rt_rod: rod,
    rt_zone: zone,
    hormonal: hormonalFlag,
    hormonal_drug: hormonalDrugs,
    targeted: targetedFlag,
    targeted_drug: targetedDrugs,
    immunotherapy: immunotherapyFlag,
    immunotherapy_drug: immunotherapyDrugs,
    tx_status: txStatus,
    progression: ov("db_progression", progFallback),
    date_prog: get("db_date_prog") || "",
    prog_type: get("db_prog_type") ?? "",
    vital_status: get("db_vital_status") ?? "",
    date_death: get("db_date_death") || "",
    date_last_contact: get("db_date_last_contact") || "",
    os_days: osDays,
    lc_days: get("db_lc_days") !== null ? String(get("db_lc_days")) : "",
    dfs_days: get("db_dfs_days") !== null ? String(get("db_dfs_days")) : "",
    qlq_date: "", qlq_n: "", qlq_gl: "", qlq_pf: "", qlq_rf: "", qlq_ef: "", qlq_cf: "", qlq_sf: "",
    qlq_fa: "", qlq_nv: "", qlq_pa: "", qlq_dy: "", qlq_sl: "", qlq_ap: "", qlq_co: "", qlq_di: "", qlq_fi: "",
    qlq_module: resolveQlqModule(get("МКБ 10")) || "",
    qlq_spec_score: "",
    date_record: "",
    date_updated: nowIso
  };
};

const upsertDatabaseRow = (content, incomingRow = {}, patientId = "", { recordDate } = {}) => {
  const dbId = String(patientId || incomingRow.pt_id || "").trim();
  if (!dbId) throw new Error("upsertDatabaseRow: patientId is required");

  const lines = ensureDatabaseSchema(content).split("\n");
  const lineIndex = findDatabaseRowIndex(lines, dbId);
  const normalizedIncoming = { ...incomingRow, pt_id: incomingRow.pt_id || dbId };

  if (lineIndex >= 0) {
    const currentRow = parseMarkdownRow(lines[lineIndex]);
    const mergedRow = mergeDatabaseRow(currentRow, normalizedIncoming);
    lines[lineIndex] = rowToMarkdown(mergedRow);
    return {
      action: "update",
      lineIndex,
      row: mergedRow,
      content: finalizeDatabaseLines(lines)
    };
  }

  const insertRecordDate = recordDate || new Date().toISOString().slice(0, 10);
  const insertRow = { ...normalizedIncoming, date_record: insertRecordDate };
  const insertLineIndex = lines.findIndex((line, idx) => idx >= 2 && String(line || "").trim() === "");
  const lineIndexForInsert = insertLineIndex >= 0 ? insertLineIndex : lines.length;
  lines[lineIndexForInsert] = rowToMarkdown(insertRow);
  return {
    action: "insert",
    lineIndex: lineIndexForInsert,
    row: insertRow,
    content: finalizeDatabaseLines(lines)
  };
};


/**
 * Orchestrates the full patient discharge workflow with rollback on failure.
 *
 * @param {object} deps — dependency injection, all required:
 *   - readFreshFrontmatter(targetFile) → Promise<fm>
 *   - resolvePatientId(fm) → { id, source }
 *   - patchFrontmatter(targetFile, mutator, opts) → Promise
 *   - upsertRowFile(row, patientId, recordDate) → Promise
 *   - buildRowFromFm(fm) → rowObj
 *   - waitForRowFile(patientId, opts) → Promise<found>
 *   - moveFileToFolder(targetFile, folder) → Promise
 *   - markExport(targetFile, source) → Promise
 *   - clearExportMark(targetFile) → Promise
 *   - removeRowFile(patientId) → Promise
 *   - todayIso() → string  (ISO date, e.g. "2026-04-25")
 * @param {object} targetFile — Obsidian TFile
 * @param {object} [opts]
 *   - source {string}      — export source label (default "desktop-discharge")
 *   - dischargedFolder {string} — destination folder (default "Выписаны")
 */
const dischargePatient = async (deps, targetFile, opts = {}) => {
  const {
    readFreshFrontmatter,
    resolvePatientId: resolveId,
    patchFrontmatter,
    upsertRowFile,
    buildRowFromFm,
    waitForRowFile,
    moveFileToFolder,
    markExport,
    clearExportMark,
    removeRowFile,
    todayIso
  } = deps;
  const source = opts.source || "desktop-discharge";
  const dischargedFolder = opts.dischargedFolder || "Выписаны";

  let originalPath = "";
  try {
    if (!targetFile) return { ok: false, reason: "missing_file" };
    originalPath = String(targetFile.path || "");

    // 1. Read frontmatter and resolve/ensure patient ID
    let fm = await readFreshFrontmatter(targetFile);
    const { id: resolvedId, source: idSource } = resolveId(fm);
    if (idSource !== "existing" && resolvedId) {
      await patchFrontmatter(targetFile, (data) => { Object.assign(data, getPatientIdPatch(resolvedId)); }, { reread: false });
      fm = await readFreshFrontmatter(targetFile);
    }
    const dbId = resolvedId || String((fm || {}).ID_пациента || "");
    if (!dbId) return { ok: false, reason: "missing_id" };

    // 2. Sync to database
    const row = buildRowFromFm(fm);
    await upsertRowFile(row, dbId, todayIso());
    const verified = await waitForRowFile(dbId, { exists: true });
    if (!verified) throw new Error("Не удалось подтвердить запись пациента в БД");

    // 3. Move to discharged folder
    await moveFileToFolder(targetFile, dischargedFolder);

    // 4. Mark export
    await markExport(targetFile, source);

    // 5. Final verification
    const finalVerified = await waitForRowFile(dbId, { exists: true });
    if (!finalVerified) throw new Error("После выписки запись пациента в БД не найдена");

    return { ok: true, id: dbId };
  } catch (e) {
    // Rollback: move back if already moved
    try {
      const currentPath = String(targetFile?.path || "");
      if (targetFile && currentPath.startsWith(dischargedFolder + "/")) {
        const rollbackPath = originalPath || `Пациенты/${targetFile.name}`;
        const rollbackFolder = rollbackPath.split("/").slice(0, -1).join("/");
        if (rollbackFolder) await moveFileToFolder(targetFile, rollbackFolder);
      }
    } catch (_) { }
    // Rollback: remove from DB if wrote
    try {
      if (targetFile) {
        const fm2 = await readFreshFrontmatter(targetFile);
        const dbId2 = String((fm2 || {}).ID_пациента || "");
        if (dbId2) {
          await removeRowFile(dbId2);
          await clearExportMark(targetFile);
        }
      }
    } catch (_) { }
    return { ok: false, reason: "discharge_failed", error: e };
  }
};

module.exports = {
  DB_COLS,
  DB_QLQ_PRESERVE,
  DB_STAGE_TO_NUM,
  DB_GOAL_MAP,
  DB_TX_STATUS_MAP,
  escapeCell,
  getQlqModule,
  tableHeader,
  tableSeparator,
  parseMarkdownRowWithColumns,
  parseMarkdownRow,
  rowToMarkdown,
  ensureDatabaseSchema,
  mergeDatabaseRow,
  findDatabaseRowIndex,
  findDatabaseRow,
  removeDatabaseRow,
  normalizeLinkedCaseNames,
  resolvePatientId,
  getPatientIdPatch,
  buildDatabaseRow,
  upsertDatabaseRow,
  dischargePatient
};
