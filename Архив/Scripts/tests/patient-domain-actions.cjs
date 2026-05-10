const assert = require("assert");
const {
  createPatientDomainActions,
  normalizeIsoList
} = require("../src/shared/patient-domain-actions.cjs");

const test = async (name, fn) => {
  try {
    await fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    console.error(error);
    process.exitCode = 1;
  }
};

(async () => {
  await test("normalizeIsoList trims and filters values", () => {
    assert.deepStrictEqual(normalizeIsoList([" 2026-05-01 ", "", null, "2026-05-02"]), ["2026-05-01", "2026-05-02"]);
  });

  await test("applyWorkflowTransition delegates step patches", async () => {
    const fm = {};
    const calls = [];
    const actions = createPatientDomainActions({
      patchCurrentFrontmatter: async (mutator) => {
        mutator(fm);
        calls.push(JSON.parse(JSON.stringify(fm)));
      },
      workflowCore: {
        applyStepPatch: (target, step, { historyAt }) => {
          target[step.key] = true;
          target.История_статусов = [{ действие: step.label, тип: "выполнено", дата: historyAt }];
          return target;
        },
        applyUndoStepPatch: (target) => target
      }
    });

    const result = await actions.applyWorkflowTransition({
      step: { key: "Оконтуривание", label: "Оконтуривание" },
      historyAt: "2026-05-02T09:00"
    });

    assert.deepStrictEqual(result, { ok: true, kind: "step", step: "Оконтуривание" });
    assert.equal(fm.Оконтуривание, true);
    assert.equal(fm.История_статусов[0].тип, "выполнено");
    assert.ok(calls.length >= 1);
  });

  await test("applyReminderAction rewrites HLT override lists", async () => {
    const fm = { ХЛТ_ручные_даты: ["2026-05-01"], Пропущенные_даты_ХЛТ: ["2026-04-30"] };
    const actions = createPatientDomainActions({
      patchCurrentFrontmatter: async (mutator) => { mutator(fm); },
      workflowCore: {
        applyStepPatch: () => ({}),
        applyUndoStepPatch: () => ({})
      }
    });

    const result = await actions.applyReminderAction({
      manualDates: [" 2026-05-02 ", "2026-05-03"],
      skippedDates: []
    });

    assert.deepStrictEqual(result.manualDates, ["2026-05-02", "2026-05-03"]);
    assert.deepStrictEqual(result.skippedDates, []);
    assert.deepStrictEqual(fm.ХЛТ_ручные_даты, ["2026-05-02", "2026-05-03"]);
    assert.equal(Object.prototype.hasOwnProperty.call(fm, "Пропущенные_даты_ХЛТ"), false);
  });

  if (!process.exitCode) console.log("OK patient domain actions core tests passed");
})();
