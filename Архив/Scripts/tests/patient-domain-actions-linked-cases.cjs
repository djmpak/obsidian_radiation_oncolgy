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
  await test("applyLinkedCaseAction delegates linked-case operations", async () => {
    const calls = [];
    const actions = createPatientDomainActions({
      patchCurrentFrontmatter: async () => {},
      workflowCore: {
        applyStepPatch: () => ({}),
        applyUndoStepPatch: () => ({})
      },
      linkedCaseActions: {
        getLinkedNames: () => {
          calls.push(["getLinkedNames"]);
          return ["Patient B", "Patient C"];
        },
        removeLinkedCase: (name) => {
          calls.push(["removeLinkedCase", name]);
          return { ok: true, name };
        },
        addLinkedCase: (targetPage) => {
          calls.push(["addLinkedCase", targetPage?.file?.name]);
          return { ok: true, name: targetPage?.file?.name };
        },
        createLinkedCase: (newName) => {
          calls.push(["createLinkedCase", newName]);
          return { ok: true, path: `Пациенты/${newName}.md` };
        }
      }
    });

    assert.deepStrictEqual(await actions.applyLinkedCaseAction({ kind: "getLinkedNames" }), ["Patient B", "Patient C"]);
    assert.deepStrictEqual(await actions.applyLinkedCaseAction({ kind: "add", targetPage: { file: { name: "Patient D" } } }), { ok: true, name: "Patient D" });
    assert.deepStrictEqual(await actions.applyLinkedCaseAction({ kind: "remove", name: "Patient D" }), { ok: true, name: "Patient D" });
    assert.deepStrictEqual(await actions.applyLinkedCaseAction({ kind: "create", newName: "Patient E" }), { ok: true, path: "Пациенты/Patient E.md" });
    assert.deepStrictEqual(calls, [
      ["getLinkedNames"],
      ["addLinkedCase", "Patient D"],
      ["removeLinkedCase", "Patient D"],
      ["createLinkedCase", "Patient E"]
    ]);
  });

  await test("legacy patient view keeps linked-case handlers inline", () => {
    const source = fs.readFileSync(patientViewPath, "utf8");
    assert.match(source, /const _getLinkNames = \(\) =>/u);
    assert.match(source, /const _renderLinkedCases = \(\) =>/u);
    assert.match(source, /fm\.Связанные_случаи\.push\(lnk\)/u);
    assert.match(source, /fm\.Связанные_случаи = fm\.Связанные_случаи\.filter/u);
    assert.doesNotMatch(source, /return;\s*const currentFolder = file\.parent/u);
  });

  if (!process.exitCode) console.log("OK patient linked case domain action tests passed");
})();
