const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..", "..", "..");
const corePath = path.join(root, "Архив", "Scripts", "src", "shared", "write-layer-core.cjs");

const {
  createWriteLayerCore
} = require("../src/shared/write-layer-core.cjs");

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

const clone = (value) => JSON.parse(JSON.stringify(value));

(async () => {
  await test("source exposes write-layer only helpers", async () => {
    assert.equal(fs.existsSync(corePath), true);
    const source = fs.readFileSync(corePath, "utf8");
    assert.match(source, /createWriteLayerCore/u);
    assert.match(source, /installFrontmatterPatch/u);
    assert.match(source, /installRenamePatch/u);
    assert.match(source, /restoreScrollAfterFrame/u);
    assert.doesNotMatch(source, /dv\.io\.load/u);
    assert.doesNotMatch(source, /new Function/u);
  });

  await test("patchFrontmatter delegates through frontmatter core", async () => {
    const state = { "note.md": { title: "old" } };
    let refreshCount = 0;
    const frontmatter = {
      readFreshFrontmatter: async (file) => clone(state[file.path] || {}),
      patchFrontmatter: async (file, mutator, options = {}) => {
        const fm = clone(state[file.path] || {});
        await mutator(fm);
        state[file.path] = clone(fm);
        if (typeof options.refresh === "function") await options.refresh();
        return { ok: true, file, frontmatter: clone(fm) };
      },
      createDebouncedWriteQueue: () => ({})
    };
    const layer = createWriteLayerCore({
      frontmatter,
      app: { fileManager: {} },
      window: null,
      console
    });

    const result = await layer.patchFrontmatter({ path: "note.md" }, fm => {
      fm.title = "new";
    }, {
      refresh: async () => { refreshCount += 1; }
    });

    assert.equal(result.ok, true);
    assert.deepEqual(state["note.md"], { title: "new" });
    assert.equal(refreshCount, 1);
  });

  await test("installFrontmatterPatch and installRenamePatch are idempotent", async () => {
    const state = {};
    const refreshCalls = [];
    const renameCalls = [];
    const retargetCalls = [];
    const renameHookCalls = [];
    const scrollTarget = { scrollTop: 7 };
    const runtimeWindow = {
      _pfmPatchedVersion: 0,
      _pfRenamePatchedVersion: 0,
      _pfRenameHooks: { unit: async (payload) => renameHookCalls.push(payload) },
      _pfRefreshSubscribers: { "old.md": { a: 1 } },
      "_pfRefreshHook_old.md": () => {},
      "_pfRegisterRefreshSubscriber_old.md": () => {},
      _pfRetargetMarkdownLeaves: async (payload) => retargetCalls.push(payload),
      _pfRunRefreshHooks: async (paths, meta) => refreshCalls.push({ paths, meta }),
      requestAnimationFrame: (cb) => cb(),
      scrollY: 88,
      scrollTo: () => {},
      document: { querySelector: () => null, scrollingElement: scrollTarget }
    };
    const app = {
      fileManager: {
        processFrontMatter: async (file, mutator) => {
          state[file.path] = state[file.path] || {};
          await mutator(state[file.path]);
          return { ok: true };
        },
        renameFile: async (file, nextPath) => {
          renameCalls.push({ from: file.path, to: nextPath });
          file.path = nextPath;
          return { ok: true };
        }
      }
    };
    const layer = createWriteLayerCore({
      frontmatter: {
        readFreshFrontmatter: async () => ({}),
        patchFrontmatter: async (file, mutator, options = {}) => {
          state[file.path] = state[file.path] || {};
          await mutator(state[file.path]);
          if (typeof options.refresh === "function") await options.refresh();
          return { ok: true };
        },
        createDebouncedWriteQueue: () => ({})
      },
      app,
      window: runtimeWindow,
      console
    });

    assert.deepEqual(layer.installFrontmatterPatch(), { installed: true, version: 2 });
    assert.deepEqual(layer.installFrontmatterPatch(), { installed: false, version: 2 });
    assert.deepEqual(layer.installRenamePatch(), { installed: true, version: 3 });
    assert.deepEqual(layer.installRenamePatch(), { installed: false, version: 3 });

    await app.fileManager.processFrontMatter({ path: "note.md" }, fm => {
      fm.title = "patched";
    });
    await app.fileManager.renameFile({ path: "old.md", name: "old.md" }, "new.md");

    assert.equal(state["note.md"].title, "patched");
    assert.equal(scrollTarget.scrollTop, 7);
    assert.equal(refreshCalls.length, 2);
    assert.deepEqual(refreshCalls[0].paths, ["note.md"]);
    assert.equal(refreshCalls[0].meta.type, "frontmatter");
    assert.deepEqual(renameCalls, [{ from: "old.md", to: "new.md" }]);
    assert.equal(renameHookCalls.length, 1);
    assert.equal(renameHookCalls[0].oldPath, "old.md");
    assert.equal(renameHookCalls[0].newPath, "new.md");
    assert.deepEqual(retargetCalls, [{ fromPaths: ["old.md", "new.md"], toPath: "new.md" }]);
    assert.equal(refreshCalls[1].meta.type, "rename");
  });

  if (!process.exitCode) console.log("OK write-layer core tests passed");
})();
