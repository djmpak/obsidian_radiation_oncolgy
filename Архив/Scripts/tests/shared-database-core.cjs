const assert = require("node:assert/strict");
const path = require("node:path");

const databaseCorePath = path.resolve(__dirname, "..", "src", "shared", "database-core.cjs");
const {
  DB_COLS,
  DB_QLQ_PRESERVE,
  DB_STAGE_TO_NUM,
  DB_GOAL_MAP,
  DB_TX_STATUS_MAP,
  getQlqModule,
  ensureDatabaseSchema,
  rowToMarkdown,
  parseMarkdownRow,
  mergeDatabaseRow,
  findDatabaseRow,
  removeDatabaseRow,
  upsertDatabaseRow,
  buildDatabaseRow,
  normalizeLinkedCaseNames,
  resolvePatientId,
  getPatientIdPatch
} = require(databaseCorePath);

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

test("database constants expose the expected schema and mappings", () => {
  assert.equal(DB_COLS[0], "pt_id");
  assert.equal(DB_COLS.at(-1), "date_updated");
  assert.equal(DB_QLQ_PRESERVE.has("qlq_gl"), true);
  assert.equal(DB_STAGE_TO_NUM.IIIB, 3);
  assert.equal(DB_GOAL_MAP["Радикальный курс"], 1);
  assert.equal(DB_TX_STATUS_MAP["В процессе"], 2);
});

test("QLQ module mapping follows ICD-10 groups", () => {
  assert.equal(getQlqModule("C50.4"), "BR23");
  assert.equal(getQlqModule("C34"), "LC13");
  assert.equal(getQlqModule("C20"), "CR29");
  assert.equal(getQlqModule("C61"), "PR25");
  assert.equal(getQlqModule("D00"), "");
});

test("ensureDatabaseSchema creates a new markdown table", () => {
  const schema = ensureDatabaseSchema("");
  assert.match(schema, /^\| pt_id \| pt_initials \|/u);
  assert.match(schema, /\| --- \| --- \|/u);
});

test("ensureDatabaseSchema remaps legacy columns to the current schema", () => {
  const legacy = [
    "| pt_id | pt_initials | qlq_gl |",
    "| --- | --- | --- |",
    "| 101-202 | Иванов И.И. | 77 |"
  ].join("\n");

  const schema = ensureDatabaseSchema(legacy);
  const parsed = parseMarkdownRow(schema.split(/\r?\n/u)[2]);
  assert.equal(parsed.pt_id, "101-202");
  assert.equal(parsed.pt_initials, "Иванов И.И.");
  assert.equal(parsed.qlq_gl, "77");
  assert.equal(parsed.date_updated, "");
});

test("rowToMarkdown escapes pipes and new lines", () => {
  const line = rowToMarkdown({ pt_id: "123", pt_initials: "A|B\nC" });
  assert.match(line, /^\| 123 \| A∣B C \|/u);
});

test("mergeDatabaseRow preserves QLQ and date_record from an existing row", () => {
  const current = { pt_id: "123", qlq_gl: "88", date_record: "2026-01-01", date_updated: "2026-01-01" };
  const incoming = { pt_id: "123", qlq_gl: "", date_record: "", date_updated: "2026-04-24" };
  const merged = mergeDatabaseRow(current, incoming);
  assert.equal(merged.qlq_gl, "88");
  assert.equal(merged.date_record, "2026-01-01");
  assert.equal(merged.date_updated, "2026-04-24");
});

test("upsertDatabaseRow inserts a new patient row with a stable record date", () => {
  const result = upsertDatabaseRow("", {
    pt_id: "123",
    pt_initials: "Петров П.П.",
    qlq_module: "LC13",
    date_updated: "2026-04-24"
  }, "123", { recordDate: "2026-04-24" });

  const lines = result.content.trimEnd().split(/\r?\n/u);
  const parsed = parseMarkdownRow(lines[2]);
  assert.equal(result.action, "insert");
  assert.equal(result.lineIndex, 2);
  assert.equal(parsed.pt_id, "123");
  assert.equal(parsed.pt_initials, "Петров П.П.");
  assert.equal(parsed.qlq_module, "LC13");
  assert.equal(parsed.date_record, "2026-04-24");
});

test("upsertDatabaseRow updates an existing row while preserving manual QLQ and date_record values", () => {
  const existing = ensureDatabaseSchema([
    "| pt_id | pt_initials | qlq_gl | qlq_module | date_record | date_updated |",
    "| --- | --- | --- | --- | --- | --- |",
    "| 123 | Старое И.И. | 91 | BR23 | 2026-01-01 | 2026-01-10 |"
  ].join("\n"));

  const result = upsertDatabaseRow(existing, {
    pt_id: "123",
    pt_initials: "Новое Н.Н.",
    qlq_gl: "",
    qlq_module: "LC13",
    date_record: "",
    date_updated: "2026-04-24"
  }, "123", { recordDate: "2026-04-24" });

  const parsed = parseMarkdownRow(result.content.trimEnd().split(/\r?\n/u)[2]);
  assert.equal(result.action, "update");
  assert.equal(result.lineIndex, 2);
  assert.equal(parsed.pt_initials, "Новое Н.Н.");
  assert.equal(parsed.qlq_gl, "91");
  assert.equal(parsed.qlq_module, "LC13");
  assert.equal(parsed.date_record, "2026-01-01");
  assert.equal(parsed.date_updated, "2026-04-24");
});

test("findDatabaseRow returns the parsed row and raw line for a patient id", () => {
  const content = ensureDatabaseSchema([
    "| pt_id | pt_initials | qlq_gl |",
    "| --- | --- | --- |",
    "| 111 | Первый П.П. | 10 |",
    "| 222 | Второй В.В. | 20 |"
  ].join("\n"));

  const found = findDatabaseRow(content, "222");
  assert.equal(found.lineIndex, 3);
  assert.equal(found.row.pt_id, "222");
  assert.equal(found.row.pt_initials, "Второй В.В.");
  assert.match(found.rawLine, /^\| 222 \|/u);
  assert.equal(findDatabaseRow(content, "333"), null);
});

test("removeDatabaseRow removes only the requested patient row", () => {
  const content = ensureDatabaseSchema([
    "| pt_id | pt_initials |",
    "| --- | --- |",
    "| 111 | Первый П.П. |",
    "| 222 | Второй В.В. |"
  ].join("\n"));

  const result = removeDatabaseRow(content, "111");
  const lines = result.content.trimEnd().split(/\r?\n/u);
  assert.equal(result.removed, true);
  assert.equal(result.lineIndex, 2);
  assert.equal(lines.length, 3);
  assert.equal(parseMarkdownRow(lines[2]).pt_id, "222");

  const unchanged = removeDatabaseRow(result.content, "999");
  assert.equal(unchanged.removed, false);
  assert.equal(unchanged.content, result.content);
});

test("buildDatabaseRow creates a normalized database row from frontmatter accessors", () => {
  const values = {
    "ID_пациента": "321-654",
    "ФИО": "Иванов Иван Иванович",
    "Дата_рождения": "1970-02-03",
    "Дата_начала_лечения": "2026-04-01",
    "Дата_окончания_лечения": "2026-04-10",
    "Диагноз": "Рак молочной железы IIIB стадия cT2 N1 M0, G2. ER 80 PR 60 HER2 1 Ki67 35%",
    "МКБ 10": "C50.4",
    "Цель_лечения": "Радикальный курс",
    "Статус_лечения": "Завершено",
    "ECOG_статус": "1",
    "РОД": "2",
    "Количество_фракций": "5",
    "Область_облучения": "Молочная железа"
  };
  const getVal = (key) => Object.prototype.hasOwnProperty.call(values, key) ? values[key] : null;
  const normalizeText = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
  const row = buildDatabaseRow({
    getVal,
    normalizeText,
    joinText: (...items) => items.map(normalizeText).filter(Boolean).join("\n"),
    normalizeHistoryText: (value) => normalizeText(value),
    normalizeDrugNames: (value) => normalizeText(value),
    extractSentenceEvents: () => "",
    isTreatmentEvent: () => false,
    isChemoEvent: () => false,
    inferPdl1: () => "",
    inferBinaryMarker: () => "",
    inferMgmtMeth: () => "",
    inferMsiStatus: () => "",
    inferMmrStatus: () => "",
    inferGleason: () => "",
    inferInitialPsa: () => "",
    getQlqModule,
    todayIso: "2026-04-24"
  });

  assert.equal(row.pt_id, "321-654");
  assert.equal(row.pt_initials, "Иванов И.И.");
  assert.equal(row.sex, 1);
  assert.equal(row.birth_year, "1970");
  assert.equal(row.age_dx, "56");
  assert.equal(row.stage, "IIIB");
  assert.equal(row.stage_num, 3);
  assert.equal(row.t_val, "2");
  assert.equal(row.n_val, "1");
  assert.equal(row.m_val, "0");
  assert.equal(row.grade_val, "2");
  assert.equal(row.er_val, "80");
  assert.equal(row.pr_val, "60");
  assert.equal(row.her2_val, "1");
  assert.equal(row.ki67_pct, "35");
  assert.equal(row.tx_goal, 1);
  assert.equal(row.tx_status, 3);
  assert.equal(row.rt_sod, 10);
  assert.equal(row.qlq_module, "BR23");
  assert.equal(row.date_updated, "2026-04-24");
});

test("buildDatabaseRow uses discharge snapshot overrides for delivered RT dose and fractions", () => {
  const values = {
    "ID_пациента": "321-654",
    "ФИО": "Иванов Иван Иванович",
    "Дата_рождения": "1970-02-03",
    "Дата_начала_лечения": "2026-04-01",
    "Дата_окончания_лечения": "2026-04-02",
    "Статус_лечения": "Завершено",
    "РОД": "1.5",
    "Количество_фракций": "30",
    "db_rt_sod": "6",
    "db_rt_fractions": "4",
    "db_rt_rod": "1.5"
  };
  const getVal = (key) => Object.prototype.hasOwnProperty.call(values, key) ? values[key] : null;
  const normalizeText = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
  const row = buildDatabaseRow({
    getVal,
    normalizeText,
    joinText: (...items) => items.map(normalizeText).filter(Boolean).join("\n"),
    normalizeHistoryText: (value) => normalizeText(value),
    normalizeDrugNames: (value) => normalizeText(value),
    extractSentenceEvents: () => "",
    isTreatmentEvent: () => false,
    isChemoEvent: () => false,
    inferPdl1: () => "",
    inferBinaryMarker: () => "",
    inferMgmtMeth: () => "",
    inferMsiStatus: () => "",
    inferMmrStatus: () => "",
    inferGleason: () => "",
    inferInitialPsa: () => "",
    getQlqModule,
    todayIso: "2026-04-02"
  });

  assert.equal(row.date_end, "2026-04-02");
  assert.equal(row.rt_sod, 6);
  assert.equal(row.rt_fractions, 4);
  assert.equal(row.rt_rod, 1.5);
});

test("normalizeLinkedCaseNames supports wikilinks, aliases, strings and arrays", () => {
  assert.deepEqual(
    normalizeLinkedCaseNames(["[[Пациент A|карта]]", "Пациент B", "", null]),
    ["Пациент A", "Пациент B"]
  );
  assert.deepEqual(normalizeLinkedCaseNames("[[Пациент C]]"), ["Пациент C"]);
});

test("resolvePatientId reuses existing or linked IDs before generating a new one", () => {
  const linkedPages = [
    { file: { basename: "Связанный", path: "Пациенты/Связанный.md" }, "ID_пациента": "222-333" }
  ];
  const findLinkedPatient = (name) => linkedPages.find((page) => page.file.basename === name || page.file.path === name);

  assert.deepEqual(resolvePatientId({ existingId: "111-222", findLinkedPatient }), {
    id: "111-222",
    source: "existing"
  });

  assert.deepEqual(resolvePatientId({
    fio: "Пациент Петров",
    birthDate: "1980-01-01",
    linkedCases: ["[[Связанный]]"],
    findLinkedPatient
  }), {
    id: "222-333",
    source: "linked"
  });

  let generated = 0;
  const generatedResult = resolvePatientId({
    fio: "Новый Пациент",
    birthDate: "1990-01-01",
    existingIds: new Set(["123-456"]),
    generateId: () => (++generated === 1 ? "123-456" : "999-000"),
    findLinkedPatient
  });
  assert.deepEqual(generatedResult, {
    id: "999-000",
    source: "generated"
  });
});

test("resolvePatientId follows aliased linked case wikilinks when reusing an ID", () => {
  const linkedPages = [
    { file: { basename: "Связанный", path: "Пациенты/Связанный.md" }, "ID_пациента": "222-333" }
  ];
  const findLinkedPatient = (name) => linkedPages.find((page) => page.file.basename === name || page.file.path === name);

  assert.deepEqual(resolvePatientId({
    fio: "Пациент Петров",
    birthDate: "1980-01-01",
    linkedCases: ["[[Связанный|карта]]"],
    findLinkedPatient
  }), {
    id: "222-333",
    source: "linked"
  });
});

test("resolvePatientId returns an empty result when required identity fields are missing", () => {
  assert.deepEqual(resolvePatientId({ fio: "", birthDate: "1990-01-01" }), {
    id: "",
    source: "missing_identity"
  });
});

test("getPatientIdPatch returns a focused patient ID frontmatter patch", () => {
  assert.deepEqual(getPatientIdPatch("123-456"), { "ID_пациента": "123-456" });
  assert.deepEqual(getPatientIdPatch(" 123-456 "), { "ID_пациента": "123-456" });
  assert.deepEqual(getPatientIdPatch(""), {});
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

console.log(`OK ${passed} shared database-core tests passed`);
