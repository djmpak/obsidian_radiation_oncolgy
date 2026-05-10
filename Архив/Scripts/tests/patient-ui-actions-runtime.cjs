const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..", "..", "..");
const runtimePath = path.join(root, "Архив", "Scripts", "modules", "patient-ui-actions-runtime.js");
const corePath = "Архив/Scripts/src/shared/patient-ui-actions.cjs";

const readUtf8 = (filePath) => fs.readFileSync(filePath, "utf8");

async function loadRuntime() {
  const runtimeSource = readUtf8(runtimePath);
  const runtimeLoader = new Function(`return (${runtimeSource});`)();
  const coreSource = readUtf8(path.join(root, corePath));
  const requestedPaths = [];
  const fm = {};
  const patchCalls = [];

  const dv = {
    io: {
      load: async (requestedPath) => {
        requestedPaths.push(requestedPath);
        assert.equal(requestedPath, corePath, "patient-ui runtime loaded the wrong shared core");
        return coreSource;
      }
    }
  };

  const exports = await runtimeLoader({
    dv,
    patchCurrentFrontmatter: async (mutator, opts) => {
      patchCalls.push(opts);
      mutator(fm);
    }
  });

  return { exports, requestedPaths, fm, patchCalls, runtimeSource };
}

(async () => {
  assert.equal(fs.existsSync(runtimePath), true, "patient-ui-actions-runtime.js does not exist");

  const { exports, requestedPaths, fm, patchCalls, runtimeSource } = await loadRuntime();
  assert.match(runtimeSource, /createPatientUiActions/u);
  assert.equal(requestedPaths.length, 1);
  assert.equal(typeof exports.actions.applyTemplateFrontmatter, "function");
  assert.equal(typeof exports.actions.removeAttachmentAtIndex, "function");

  await exports.actions.applyTemplateFrontmatter({
    name: "tpl",
    ptv1: {
      Название: "PTV1",
      Область_облучения: "Зона",
      РОД: 200,
      Количество_фракций: 25,
      Фракционирование: "Стандартный"
    },
    цель: "Куративная",
    hlt: { препараты: ["A"] },
    extra: [{ Название: "Boost" }]
  }, ["Пациент", "ХЛТ"], { refresh: () => {}, reread: false });

  assert.deepEqual(fm.Название_PTV, "PTV1");
  assert.deepEqual(fm.Область_облучения, "Зона");
  assert.deepEqual(fm.РОД, 200);
  assert.deepEqual(fm.Количество_фракций, 25);
  assert.deepEqual(fm.Фракционирование, "Стандартный");
  assert.deepEqual(fm.Цель_лечения, "Куративная");
  assert.deepEqual(fm.ХЛТ_препараты, ["A"]);
  assert.deepEqual(fm.ХЛТ_дата_старта, null);
  assert.deepEqual(fm.Объёмы, [{
    Название: "Boost",
    Область_облучения: null,
    РОД: null,
    Количество_фракций: null,
    Фракционирование: "Стандартный",
    Связь: "Параллельно"
  }]);
  assert.deepEqual(fm.tags, ["Пациент", "ХЛТ"]);
  assert.equal(patchCalls[0].reread, false);

  fm.Вложения = [{ Имя: "one" }, { Имя: "two" }];
  await exports.actions.removeAttachmentAtIndex(0);
  assert.deepEqual(fm.Вложения, [{ Имя: "two" }]);

  console.log("OK patient ui actions runtime smoke test passed");
})().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exit(1);
});
