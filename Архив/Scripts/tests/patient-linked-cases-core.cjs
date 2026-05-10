const assert = require("assert");
const { createPatientLinkedCaseActions, parseLinkedCaseNames } = require("../src/shared/patient-linked-cases-core.cjs");

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

const makeApp = () => {
  const files = new Map();
  const created = [];
  return {
    vault: {
      getAbstractFileByPath(path) {
        return files.get(path) || null;
      },
      async create(path, content) {
        created.push({ path, content });
        const file = { path, name: path.split("/").pop(), content };
        files.set(path, file);
        return file;
      }
    },
    workspace: {
      async getLeaf() {
        return { openFile: async (file) => { this.opened = file.path; } };
      }
    },
    _files: files,
    _created: created
  };
};

(async () => {
  await test("parseLinkedCaseNames supports wikilinks and raw names", () => {
    assert.deepStrictEqual(parseLinkedCaseNames(["[[A]]", "[[B|label]]", "C"]), ["A", "B", "C"]);
  });

  await test("add/remove linked case update both files", async () => {
    const app = makeApp();
    const notices = [];
    const current = { basename: "Patient A", path: "Пациенты/Patient A.md", "Связанные_случаи": [] };
    const linked = { file: { name: "Patient B", path: "Пациенты/Patient B.md" }, Дата_начала_лечения: "2026-05-01", Количество_фракций: 10, Диагноз: "Diag" };
    app._files.set(linked.file.path, linked);
    const currentPatches = [];
    const linkedPatches = [];
    const actions = createPatientLinkedCaseActions({
      app,
      dv: {
        pages: () => ({
          find: (fn) => fn(linked) ? linked : null
        })
      },
      file: current,
      cur: current,
      patchFileFrontmatter: async (target, mutator) => {
        const fm = target["__fm"] || (target["__fm"] = {});
        mutator(fm);
        if (target === current) currentPatches.push(JSON.parse(JSON.stringify(fm)));
        else linkedPatches.push(JSON.parse(JSON.stringify(fm)));
      },
      platform: {
        openFileByPath: async () => ({ ok: true })
      },
      notice: (message) => notices.push(message)
    });

    await actions.addLinkedCase(linked);
    assert.deepStrictEqual(current["__fm"].Связанные_случаи, ["[[Patient B]]"]);
    assert.deepStrictEqual(linked["__fm"].Связанные_случаи, ["[[Patient A]]"]);

    await actions.removeLinkedCase("Patient B");
    assert.strictEqual(current["__fm"].Связанные_случаи, undefined);
    assert.strictEqual(linked["__fm"].Связанные_случаи, undefined);
    assert.ok(notices.some(msg => String(msg).includes("Связь с")));
    assert.ok(currentPatches.length >= 2);
    assert.ok(linkedPatches.length >= 2);
  });

  await test("createLinkedCase creates a new note with reciprocal link", async () => {
    const app = makeApp();
    const notices = [];
    const current = {
      basename: "Patient A",
      path: "Пациенты/Patient A.md",
      parent: { path: "Пациенты" },
      ФИО: "Иванов И.И.",
      Дата_рождения: { toFormat: () => "2026-05-01" },
      "МКБ 10": "C34",
      Диагноз: "Diag",
      СНИЛС: "123",
      "Группа ВМП": "ВМП",
      Номер_телефона: "555"
    };
    const actions = createPatientLinkedCaseActions({
      app,
      dv: { pages: () => ({ find: () => null }) },
      file: current,
      cur: current,
      patchFileFrontmatter: async () => {},
      platform: { openFileByPath: async (path) => { app.opened = path; return { ok: true }; } },
      notice: (message) => notices.push(message)
    });

    const result = await actions.createLinkedCase("Case B");
    assert.strictEqual(result.path, "Пациенты/Case B.md");
    assert.strictEqual(app._created[0].path, "Пациенты/Case B.md");
    assert.ok(app._created[0].content.includes('Связанные_случаи:'));
    assert.ok(app._created[0].content.includes('[[Patient A]]'));
    assert.strictEqual(app.opened, "Пациенты/Case B.md");
    assert.ok(notices.some(msg => String(msg).includes("Создан: Case B")));
  });

  await test("createLinkedCase keeps nested folder paths intact", async () => {
    const app = makeApp();
    const current = {
      basename: "Patient A",
      path: "Пациенты/Группа/Patient A.md",
      parent: { path: "Пациенты/Группа" },
      ФИО: "Иванов И.И.",
      Дата_рождения: { toFormat: () => "2026-05-01" },
      "МКБ 10": "C34",
      Диагноз: "Diag",
      СНИЛС: "123",
      "Группа ВМП": "ВМП",
      Номер_телефона: "555"
    };
    const actions = createPatientLinkedCaseActions({
      app,
      dv: { pages: () => ({ find: () => null }) },
      file: current,
      cur: current,
      patchFileFrontmatter: async (target, mutator) => {
        const fm = target["__fm"] || (target["__fm"] = {});
        mutator(fm);
      },
      platform: { openFileByPath: async (path) => { app.opened = path; return { ok: true }; } }
    });

    const result = await actions.createLinkedCase("Case C");
    assert.strictEqual(result.path, "Пациенты/Группа/Case C.md");
    assert.strictEqual(app._created[0].path, "Пациенты/Группа/Case C.md");
    assert.strictEqual(current["__fm"].Связанные_случаи[0], "[[Case C]]");
    assert.ok(app._created[0].content.includes('[[Patient A]]'));
  });

  if (!process.exitCode) console.log("OK patient linked cases core tests passed");
})();
