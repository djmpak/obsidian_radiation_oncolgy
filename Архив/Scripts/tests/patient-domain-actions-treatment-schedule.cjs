const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { createPatientDomainActions } = require("../src/shared/patient-domain-actions.cjs");

const root = path.resolve(__dirname, "..", "..", "..");
const patientViewPath = path.join(root, "Архив", "Scripts", "views", "patient", "view.js");

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
  await test("applyTreatmentScheduleAction normalizes remarks, labs, and HLT breaks", async () => {
    const makeActions = (fm) => createPatientDomainActions({
      patchCurrentFrontmatter: async (mutator) => {
        mutator(fm);
      },
      workflowCore: {
        applyStepPatch: () => ({}),
        applyUndoStepPatch: () => ({})
      }
    });

    const remarksFm = {};
    await makeActions(remarksFm).applyTreatmentScheduleAction({
      kind: "saveRemarks",
      remarks: []
    });
    assert.deepStrictEqual(remarksFm.Переразметки, []);

    const populatedRemarks = [
      { Дата: "2026-05-01", Переразметка: true, Переоконтуривание: false, Старт_нового_плана: "" }
    ];
    const remarksWithDataFm = {};
    await makeActions(remarksWithDataFm).applyTreatmentScheduleAction({
      kind: "saveRemarks",
      remarks: populatedRemarks
    });
    assert.deepStrictEqual(remarksWithDataFm.Переразметки, populatedRemarks);

    const labsFm = {};
    await makeActions(labsFm).applyTreatmentScheduleAction({
      kind: "saveLabs",
      labs: []
    });
    assert.equal(labsFm.Лабораторные, null);

    const populatedLabs = [
      { Дата: "2026-05-01", Лейкоциты: 5.1, Гемоглобин: 132 }
    ];
    const labsWithDataFm = {};
    await makeActions(labsWithDataFm).applyTreatmentScheduleAction({
      kind: "saveLabs",
      labs: populatedLabs
    });
    assert.deepStrictEqual(labsWithDataFm.Лабораторные, populatedLabs);

    const breaksFm = {};
    await makeActions(breaksFm).applyTreatmentScheduleAction({
      kind: "saveHltBreaks",
      hltBreaks: []
    });
    assert.equal(breaksFm.Перерыв_ХЛТ, null);

    const populatedBreaks = [
      { Дата_начала: "2026-05-02", Дата_окончания: "2026-05-03" }
    ];
    const breaksWithDataFm = {};
    await makeActions(breaksWithDataFm).applyTreatmentScheduleAction({
      kind: "saveHltBreaks",
      hltBreaks: populatedBreaks
    });
    assert.deepStrictEqual(breaksWithDataFm.Перерыв_ХЛТ, populatedBreaks);
  });

  await test("legacy patient view keeps treatment schedule save points inline", () => {
    const source = fs.readFileSync(patientViewPath, "utf8");

    assert.match(source, /const saveRemarks = \(\) =>/u);
    assert.match(source, /saveNow\(\{\s*Переразметки:\s*entries\.length \? entries : \[\]\s*\}\)/u);
    assert.match(source, /saveNow\(\{\s*"Лабораторные":\s*labData/u);
    assert.match(source, /saveNow\(\{\s*"Перерыв_ХЛТ":\s*newList/u);
    assert.doesNotMatch(source, /_pfDomainActions\.applyTreatmentScheduleAction/u);
  });

  if (!process.exitCode) console.log("OK patient treatment schedule domain action tests passed");
})();
