const assert = require("assert");
const workflowCore = require("../src/shared/patient-workflow-core.cjs");

const test = (name, fn) => {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    console.error(error);
    process.exitCode = 1;
  }
};

test("getWorkflowContext derives consultation states from path and flags", () => {
  assert.equal(workflowCore.getWorkflowContext({ path: "Консультации/a.md" }).consultState, "pending");
  assert.equal(workflowCore.getWorkflowContext({
    path: "Пациенты/a.md",
    getValue: key => ({ Дата_консультации: "2026-04-20" })[key]
  }).consultState, "pending");
  assert.equal(workflowCore.getWorkflowContext({
    path: "Пациенты/a.md",
    getValue: key => ({ Принят_на_лечение: true })[key]
  }).consultState, "accepted");
  assert.equal(workflowCore.getWorkflowContext({
    path: "Не начали/a.md",
    getValue: key => ({ Отказ_от_лечения: true })[key]
  }).consultState, "rejected");
});

test("syncWorkflowState maps frontmatter flags and discharge marker", () => {
  const state = {};
  const values = {
    Разметка: true,
    Оконтуривание: false,
    Госпитализация: true,
    db_exported_at: "2026-04-29",
    Переразметки: [{ Переразметка: true, Переоконтуривание: false }]
  };
  const result = workflowCore.syncWorkflowState({
    state,
    path: "Пациенты/a.md",
    getValue: key => values[key]
  });

  assert.equal(result.state["Разметка"], true);
  assert.equal(result.state["Оконтуривание"], false);
  assert.equal(result.state["Госпитализация"], true);
  assert.equal(result.state["Выписка"], true);
  assert.equal(result.state["Переразметка_0"], true);
  assert.equal(result.state["Переоконтуривание_0"], false);
});

test("getWorkflowSteps appends discharge only after hospitalization or discharge", () => {
  assert.deepEqual(workflowCore.getWorkflowSteps().map(step => step.key), ["Разметка", "Оконтуривание", "Госпитализация"]);
  assert.deepEqual(workflowCore.getWorkflowSteps({ hospitalized: true }).map(step => step.key), ["Разметка", "Оконтуривание", "Госпитализация", "Выписка"]);
  assert.deepEqual(workflowCore.getUndoKeys(workflowCore.getWorkflowSteps({ hospitalized: true }), 2), ["Госпитализация", "Выписка"]);
});

test("accept and reject patch builders mutate frontmatter with history", () => {
  const accepted = {};
  workflowCore.applyAcceptPatch(accepted, { historyAt: "2026-04-29T12:00" });
  assert.equal(accepted.Консультация_завершена, true);
  assert.equal(accepted.Консультация_решение, "принят");
  assert.equal(accepted.Принят_на_лечение, true);
  assert.equal(accepted.История_статусов[0].тип, "принято");

  const rejected = {};
  workflowCore.applyRejectPatch(rejected, { historyAt: "2026-04-29T12:01" });
  assert.equal(rejected.Консультация_решение, "отказ");
  assert.equal(rejected.Отказ_от_лечения, true);
  assert.equal(rejected.Принят_на_лечение, false);
});

test("accept treatment moves consultation file before patching frontmatter", () => {
  assert.deepEqual(
    workflowCore.getAcceptTreatmentOperationOrder({
      currentFolder: "Консультации",
      targetFolder: "Пациенты"
    }),
    ["moveFile", "patchFrontmatter"]
  );
  assert.deepEqual(
    workflowCore.getAcceptTreatmentOperationOrder({
      currentFolder: "Пациенты",
      targetFolder: "Пациенты"
    }),
    ["patchFrontmatter"]
  );
});

test("undo accept and step patches reset downstream workflow fields", () => {
  const fm = {
    Консультация_завершена: true,
    Принят_на_лечение: true,
    Разметка: true,
    Оконтуривание: true,
    Госпитализация: true,
    db_exported_at: "2026-04-29",
    db_export_source: "template-discharge",
    Переразметки: [{ Переразметка: true, Переоконтуривание: true }]
  };
  workflowCore.applyUndoAcceptPatch(fm, { historyAt: "2026-04-29T12:02" });
  assert.equal(fm.Принят_на_лечение, false);
  assert.equal(fm.Разметка, false);
  assert.equal(fm.Оконтуривание, false);
  assert.equal(fm.Госпитализация, false);
  assert.equal(Object.prototype.hasOwnProperty.call(fm, "db_exported_at"), false);
  assert.equal(fm.Переразметки[0].Переразметка, false);

  const stepFm = { Разметка: true, Оконтуривание: true, db_exported_at: "2026-04-29", db_export_source: "x" };
  workflowCore.applyUndoStepPatch(stepFm, { keys: ["Оконтуривание", "Выписка"], historyAt: "2026-04-29T12:03" });
  assert.equal(stepFm.Оконтуривание, false);
  assert.equal(Object.prototype.hasOwnProperty.call(stepFm, "db_exported_at"), false);
});

if (process.exitCode) process.exit(process.exitCode);
console.log("OK patient workflow core tests passed");
