const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..", "..", "..");
const runtimeModulePath = path.join(root, "Архив", "Scripts", "modules", "database-runtime.js");
const corePath = path.join(root, "Архив", "Scripts", "src", "shared", "database-core.cjs");
const adapterPath = path.join(root, "Архив", "Scripts", "src", "platform", "obsidian-adapter.cjs");
const frontmatterCorePath = path.join(root, "Архив", "Scripts", "src", "shared", "storage-frontmatter-core.cjs");
const writeLayerCorePath = path.join(root, "Архив", "Scripts", "src", "shared", "write-layer-core.cjs");

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

const loadRuntime = async (frontmatter, { fileText = "", runtimeWindow = null } = {}) => {
  const runtimeSource = fs.readFileSync(runtimeModulePath, "utf8");
  const coreSource = fs.readFileSync(corePath, "utf8");
  const adapterSource = fs.readFileSync(adapterPath, "utf8");
  const frontmatterSource = fs.readFileSync(frontmatterCorePath, "utf8");
  const writeLayerSource = fs.readFileSync(writeLayerCorePath, "utf8");
  const runtimeFactory = eval(`(${runtimeSource})`);
  const existingPaths = new Set();
  const createdFolders = [];
  const renamedFiles = [];
  const processedFrontmatterFiles = [];
  const app = {
    vault: {
      getAbstractFileByPath: (targetPath) => existingPaths.has(targetPath) ? { path: targetPath } : null,
      createFolder: async (targetPath) => {
        existingPaths.add(targetPath);
        createdFolders.push(targetPath);
      },
      read: async () => fileText,
      create: async () => ({}),
      modify: async () => {}
    },
    fileManager: {
      processFrontMatter: async (targetFile, updater) => {
        processedFrontmatterFiles.push(targetFile.path);
        updater(frontmatter);
      },
      renameFile: async (targetFile, nextPath) => {
        renamedFiles.push({ from: targetFile.path, to: nextPath });
        targetFile.path = nextPath;
      }
    }
  };
  const dv = {
    io: {
      load: async (sourcePath) => {
        if (sourcePath === "Архив/Scripts/src/shared/database-core.cjs") return coreSource;
        if (sourcePath === "Архив/Scripts/src/platform/obsidian-adapter.cjs") return adapterSource;
        if (sourcePath === "Архив/Scripts/src/shared/storage-frontmatter-core.cjs") return frontmatterSource;
        if (sourcePath === "Архив/Scripts/src/shared/write-layer-core.cjs") return writeLayerSource;
        assert.fail(`Unexpected sourcePath: ${sourcePath}`);
      }
    }
  };
  app.metadataCache = {
    getFileCache: () => ({ frontmatter })
  };
  const parseYaml = (yamlText) => Object.fromEntries(
    String(yamlText || "")
      .split(/\r?\n/u)
      .map(line => line.match(/^([^:#]+):\s*(.*)$/u))
      .filter(Boolean)
      .map(match => [match[1].trim(), match[2].trim()])
  );
  const runtime = await runtimeFactory({ dv, app, parseYaml, window: runtimeWindow });
  return { runtime, app, existingPaths, createdFolders, renamedFiles, processedFrontmatterFiles };
};

test("patchFrontmatter applies a mutator, refreshes and returns fresh frontmatter", async () => {
  const frontmatter = { "ФИО": "old" };
  const { runtime } = await loadRuntime(frontmatter);
  let refreshCount = 0;

  const result = await runtime.patchFrontmatter({ path: "Пациенты/test.md" }, fm => {
    fm["ФИО"] = "new";
    fm["ID_пациента"] = "123-456";
  }, {
    refresh: async () => { refreshCount += 1; }
  });

  assert.equal(result.ok, true);
  assert.equal(frontmatter["ФИО"], "new");
  assert.equal(frontmatter["ID_пациента"], "123-456");
  assert.equal(result.frontmatter["ФИО"], "new");
  assert.notEqual(result.frontmatter, frontmatter);
  assert.equal(refreshCount, 1);
});

test("installFrontmatterPatch preserves scroll, runs refresh hooks and is idempotent", async () => {
  const frontmatter = {};
  const refreshCalls = [];
  const scrollTarget = { scrollTop: 42 };
  const runtimeWindow = {
    _pfmPatchedVersion: 0,
    _pfRunRefreshHooks: async (paths, context) => refreshCalls.push({ paths, context }),
    requestAnimationFrame: (callback) => callback(),
    scrollY: 99,
    scrollTo: () => {},
    document: {
      querySelector: () => null,
      scrollingElement: scrollTarget
    }
  };
  const { runtime, processedFrontmatterFiles } = await loadRuntime(frontmatter, { runtimeWindow });
  const firstInstall = runtime.installFrontmatterPatch();
  const secondInstall = runtime.installFrontmatterPatch();

  assert.deepEqual(firstInstall, { installed: true, version: 2 });
  assert.deepEqual(secondInstall, { installed: false, version: 2 });

  await runtime.patchFrontmatter({ path: "Пациенты/test.md" }, fm => {
    fm["ФИО"] = "patched";
  }, { reread: false });

  assert.deepEqual(processedFrontmatterFiles, ["Пациенты/test.md"]);
  assert.equal(frontmatter["ФИО"], "patched");
  assert.equal(scrollTarget.scrollTop, 42);
  assert.equal(refreshCalls.length, 1);
  assert.deepEqual(refreshCalls[0].paths, ["Пациенты/test.md"]);
  assert.equal(refreshCalls[0].context.type, "frontmatter");
});

test("installRenamePatch runs rename side effects and is idempotent", async () => {
  const frontmatter = {};
  const renameHookCalls = [];
  const retargetCalls = [];
  const refreshCalls = [];
  const oldRefreshHook = () => {};
  const oldRegisterHook = () => {};
  const runtimeWindow = {
    _pfRenamePatchedVersion: 0,
    _pfRenameHooks: {
      unit: async (payload) => renameHookCalls.push(payload)
    },
    _pfRefreshSubscribers: {
      "Пациенты/old.md": { a: 1 }
    },
    "_pfRefreshHook_Пациенты/old.md": oldRefreshHook,
    "_pfRegisterRefreshSubscriber_Пациенты/old.md": oldRegisterHook,
    _pfRetargetMarkdownLeaves: async (payload) => retargetCalls.push(payload),
    _pfRunRefreshHooks: async (paths, context) => refreshCalls.push({ paths, context })
  };
  const { runtime, renamedFiles } = await loadRuntime(frontmatter, { runtimeWindow });
  const firstInstall = runtime.installRenamePatch();
  const secondInstall = runtime.installRenamePatch();
  const file = { path: "Пациенты/old.md", name: "old.md" };

  assert.deepEqual(firstInstall, { installed: true, version: 3 });
  assert.deepEqual(secondInstall, { installed: false, version: 3 });

  await runtime.moveFileToFolder(file, "Архивные", { fileName: "new.md" });

  assert.deepEqual(renamedFiles, [{ from: "Пациенты/old.md", to: "Архивные/new.md" }]);
  assert.equal(file.path, "Архивные/new.md");
  assert.equal(renameHookCalls.length, 1);
  assert.equal(renameHookCalls[0].oldPath, "Пациенты/old.md");
  assert.equal(renameHookCalls[0].newPath, "Архивные/new.md");
  assert.equal(runtimeWindow["_pfRefreshHook_Архивные/new.md"], oldRefreshHook);
  assert.equal(runtimeWindow["_pfRegisterRefreshSubscriber_Архивные/new.md"], oldRegisterHook);
  assert.deepEqual(runtimeWindow._pfRefreshSubscribers["Архивные/new.md"], { a: 1 });
  assert.deepEqual(retargetCalls, [{ fromPaths: ["Пациенты/old.md", "Архивные/new.md"], toPath: "Архивные/new.md" }]);
  assert.equal(refreshCalls.length, 1);
  assert.deepEqual(refreshCalls[0].paths, ["Пациенты/old.md", "Архивные/new.md"]);
  assert.equal(refreshCalls[0].context.type, "rename");
});

test("markDatabaseExport writes configured export keys and refreshes", async () => {
  const frontmatter = {};
  const { runtime } = await loadRuntime(frontmatter);
  let refreshCount = 0;

  const result = await runtime.markDatabaseExport({ path: "Пациенты/test.md" }, {
    source: "unit-test",
    dateIso: "2026-04-24",
    atKey: "custom_exported_at",
    sourceKey: "custom_export_source",
    refresh: async () => { refreshCount += 1; }
  });

  assert.deepEqual(result, { ok: true, exportedAt: "2026-04-24", source: "unit-test" });
  assert.equal(frontmatter.custom_exported_at, "2026-04-24");
  assert.equal(frontmatter.custom_export_source, "unit-test");
  assert.equal(refreshCount, 1);
});

test("clearDatabaseExportMark removes configured export keys and refreshes", async () => {
  const frontmatter = {
    db_exported_at: "2026-04-24",
    db_export_source: "unit-test",
    keep: "value"
  };
  const { runtime } = await loadRuntime(frontmatter);
  let refreshCount = 0;

  const result = await runtime.clearDatabaseExportMark({ path: "Пациенты/test.md" }, {
    refresh: async () => { refreshCount += 1; }
  });

  assert.deepEqual(result, { ok: true });
  assert.equal(Object.prototype.hasOwnProperty.call(frontmatter, "db_exported_at"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(frontmatter, "db_export_source"), false);
  assert.equal(frontmatter.keep, "value");
  assert.equal(refreshCount, 1);
});

test("moveFileToFolder creates missing folders and renames only when path changes", async () => {
  const frontmatter = {};
  const { runtime, createdFolders, renamedFiles } = await loadRuntime(frontmatter);
  const file = { path: "Пациенты/test.md", name: "test.md" };

  const moved = await runtime.moveFileToFolder(file, "Выписаны");
  assert.equal(moved.ok, true);
  assert.equal(moved.oldPath, "Пациенты/test.md");
  assert.equal(moved.newPath, "Выписаны/test.md");
  assert.deepEqual(createdFolders, ["Выписаны"]);
  assert.deepEqual(renamedFiles, [{ from: "Пациенты/test.md", to: "Выписаны/test.md" }]);

  const alreadyThere = await runtime.moveFileToFolder(file, "Выписаны");
  assert.equal(alreadyThere.ok, true);
  assert.equal(alreadyThere.moved, false);
  assert.equal(renamedFiles.length, 1);
});

test("readFreshFrontmatter parses file YAML before falling back to metadata cache", async () => {
  const frontmatter = { "ФИО": "metadata", nested: { value: 1 } };
  const { runtime } = await loadRuntime(frontmatter, {
    fileText: "---\nФИО: file\nID_пациента: 123-456\n---\nbody"
  });

  const fromFile = await runtime.readFreshFrontmatter({ path: "Пациенты/test.md" });
  assert.equal(fromFile["ФИО"], "file");
  assert.equal(fromFile["ID_пациента"], "123-456");
  assert.notEqual(fromFile, frontmatter);

  const { runtime: fallbackRuntime } = await loadRuntime(frontmatter);
  const fromMetadata = await fallbackRuntime.readFreshFrontmatter({ path: "Пациенты/test.md" });
  assert.deepEqual(fromMetadata, frontmatter);
  assert.notEqual(fromMetadata, frontmatter);
});

(async () => {
  let passed = 0;
  for (const { name, fn } of tests) {
    try {
      await fn();
      passed += 1;
      console.log(`PASS ${name}`);
    } catch (error) {
      console.error(`FAIL ${name}`);
      console.error(error.stack || error.message || String(error));
      process.exit(1);
    }
  }
  console.log(`OK ${passed} shared database export mark runtime checks passed`);
})();
