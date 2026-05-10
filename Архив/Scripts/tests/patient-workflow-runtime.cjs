const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..", "..", "..");
const corePath = path.join(root, "Архив", "Scripts", "src", "shared", "patient-workflow-core.cjs");
const runtimePath = path.join(root, "Архив", "Scripts", "modules", "patient-workflow-runtime.js");
const viewPath = path.join(root, "Архив", "Scripts", "views", "patient", "view.js");

const coreSource = fs.readFileSync(corePath, "utf8");
const runtimeSource = fs.readFileSync(runtimePath, "utf8");
const viewSource = fs.readFileSync(viewPath, "utf8");

(async () => {
  assert.equal(fs.existsSync(corePath), true, "patient-workflow-core.cjs does not exist");
  assert.equal(fs.existsSync(runtimePath), true, "patient-workflow-runtime.js does not exist");

  const core = require("../src/shared/patient-workflow-core.cjs");
  assert.equal(typeof core.getWorkflowSteps, "function");
  assert.equal(typeof core.applyAcceptPatch, "function");
  assert.equal(typeof core.applyUndoStepPatch, "function");

  assert.match(runtimeSource, /patient-workflow-core\.cjs/u);

  const loadCalls = [];
  const runtime = await (new Function("return " + runtimeSource))()({
    dv: {
      io: {
        load: async (sourcePath) => {
          loadCalls.push(sourcePath);
          if (sourcePath.endsWith("patient-workflow-core.cjs")) return coreSource;
          return null;
        }
      }
    }
  });

  assert.deepEqual(loadCalls, ["Архив/Scripts/src/shared/patient-workflow-core.cjs"]);
  assert.equal(typeof runtime.getWorkflowSteps, "function");
  assert.equal(typeof runtime.applyAcceptPatch, "function");
  assert.equal(typeof runtime.applyUndoStepPatch, "function");

  assert.doesNotMatch(viewSource, /Архив\/Scripts\/modules\/patient-workflow-runtime\.js/u);
  assert.match(viewSource, /UNIFIED WORKFLOW BLOCK/u);
  assert.match(viewSource, /const _getWorkflowSteps = \(\) =>/u);
  assert.match(viewSource, /const _runWorkflowAction = async \(fn\) =>/u);
  assert.match(viewSource, /const _rollbackDischargeIfNeeded = async/u);
  console.log("OK patient workflow runtime regression passed");
})().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exit(1);
});
