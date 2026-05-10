const assert = require("assert");
const {
  normalizeVaultPath,
  getParentFolderPath,
  getFileNameFromPath,
  createObsidianAdapter
} = require("../src/platform/obsidian-adapter.cjs");

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

const createStubApp = () => {
  const files = new Map();
  const folders = new Set();
  const app = {
    vault: {
      getAbstractFileByPath(path) {
        return files.get(path) || (folders.has(path) ? { path, name: path.split("/").pop(), folder: true } : null);
      },
      async createFolder(path) {
        folders.add(path);
        return { path, folder: true };
      },
      async read(file) {
        return file.content || "";
      }
    },
    metadataCache: {
      getFileCache(file) {
        return { frontmatter: file.frontmatter || {} };
      }
    },
    fileManager: {
      async processFrontMatter(file, mutator) {
        file.frontmatter = file.frontmatter || {};
        mutator(file.frontmatter);
      },
      async renameFile(file, nextPath) {
        files.delete(file.path);
        file.path = nextPath;
        file.name = nextPath.split("/").pop();
        files.set(nextPath, file);
      }
    },
    workspace: {
      getLeaf() {
        return { openFile: async (file) => { app.opened = file.path; } };
      }
    },
    _files: files,
    _folders: folders
  };
  return app;
};

(async () => {
  await test("path helpers normalize vault paths", () => {
    assert.strictEqual(normalizeVaultPath("\\Пациенты\\A.md/"), "Пациенты/A.md");
    assert.strictEqual(getParentFolderPath("Пациенты/A.md"), "Пациенты");
    assert.strictEqual(getFileNameFromPath("Пациенты/A.md"), "A.md");
  });

  await test("ensureFolderPath creates nested folders once", async () => {
    const app = createStubApp();
    const adapter = createObsidianAdapter({ app });
    await adapter.ensureFolderPath("Архив/Вложения/Пациент");
    await adapter.ensureFolderPath("Архив/Вложения/Пациент");
    assert.deepStrictEqual([...app._folders].sort(), ["Архив", "Архив/Вложения", "Архив/Вложения/Пациент"]);
  });

  await test("patchFrontmatter and moveFileToFolder use Obsidian APIs through adapter", async () => {
    const app = createStubApp();
    const file = { path: "Пациенты/A.md", name: "A.md", frontmatter: { ФИО: "A" }, content: "---\nФИО: A\n---\n" };
    app._files.set(file.path, file);
    const adapter = createObsidianAdapter({ app });

    const patch = await adapter.patchFrontmatter(file, fm => { fm.done = true; }, { reread: false });
    assert.strictEqual(patch.ok, true);
    assert.strictEqual(file.frontmatter.done, true);

    const move = await adapter.moveFileToFolder(file, "Выписаны");
    assert.deepStrictEqual(move, { ok: true, moved: true, oldPath: "Пациенты/A.md", newPath: "Выписаны/A.md", file });
    assert.ok(app._folders.has("Выписаны"));
  });

  await test("moveFileToFolder normalizes rename paths before renaming", async () => {
    const app = createStubApp();
    const file = { path: "Пациенты/A.md", name: "A.md", frontmatter: {}, content: "" };
    app._files.set(file.path, file);
    const renameCalls = [];
    app.fileManager.renameFile = async (targetFile, nextPath) => {
      renameCalls.push({ from: targetFile.path, to: nextPath });
      app._files.delete(targetFile.path);
      targetFile.path = nextPath;
      targetFile.name = nextPath.split("/").pop();
      app._files.set(nextPath, targetFile);
    };

    const adapter = createObsidianAdapter({ app });
    const move = await adapter.moveFileToFolder(file, "\\Выписаны\\", { fileName: "B.md" });

    assert.deepStrictEqual(renameCalls, [{ from: "Пациенты/A.md", to: "Выписаны/B.md" }]);
    assert.deepStrictEqual(move, { ok: true, moved: true, oldPath: "Пациенты/A.md", newPath: "Выписаны/B.md", file });
    assert.ok(app._folders.has("Выписаны"));
  });

  if (!process.exitCode) console.log("OK obsidian adapter tests passed");
})();
