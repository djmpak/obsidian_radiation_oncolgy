const assert = require("assert");
const {
  clonePlain,
  mergeFrontmatterShallow,
  applyFrontmatterPatch,
  createStorageFrontmatterCore
} = require("../src/shared/storage-frontmatter-core.cjs");

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

test("mergeFrontmatterShallow applies shallow patch and can delete nulls", () => {
  const current = { a: 1, b: 2, nested: { keep: true } };
  const next = mergeFrontmatterShallow(current, { b: 3, c: null }, { deleteNull: true });
  assert.deepEqual(next, { a: 1, b: 3, nested: { keep: true } });
  assert.deepEqual(current, { a: 1, b: 2, nested: { keep: true } });
});

test("applyFrontmatterPatch supports mutator and patch object forms", () => {
  const fromMutator = applyFrontmatterPatch({ a: 1 }, fm => { fm.b = 2; });
  assert.deepEqual(fromMutator, { a: 1, b: 2 });

  const fromPatch = applyFrontmatterPatch({ a: 1 }, { a: 2, b: 3 });
  assert.deepEqual(fromPatch, { a: 2, b: 3 });
});

test("createStorageFrontmatterCore exposes read, patch and debounced write helpers", async () => {
  const patched = [];
  const fresh = { foo: "bar" };
  const fakeAdapter = {
    readFreshFrontmatter: async () => clonePlain(fresh),
    patchFrontmatter: async (targetFile, mutator) => {
      const fm = { ...fresh };
      mutator(fm);
      patched.push({ targetFile, fm });
      Object.assign(fresh, fm);
      return { ok: true, frontmatter: clonePlain(fm) };
    }
  };

  let scheduled = null;
  const fakeTimers = {
    setTimeout: (cb) => { scheduled = cb; return 1; },
    clearTimeout: () => { scheduled = null; }
  };

  const core = createStorageFrontmatterCore({ adapter: fakeAdapter, timers: fakeTimers, debounceMs: 1 });
  const file = { path: "Пациенты/000.md" };

  const read = await core.readFreshFrontmatter(file);
  assert.deepEqual(read, { foo: "bar" });

  const write = await core.patchFrontmatter(file, fm => {
    fm.foo = "baz";
    fm.remove = null;
  });
  assert.equal(write.ok, true);
  assert.deepEqual(write.frontmatter, { foo: "baz" });
  assert.deepEqual(patched[0].fm, { foo: "baz" });

  const queue = core.createDebouncedWriteQueue(file, { delayMs: 1 });
  queue.schedule({ a: 1 });
  queue.schedule(fm => { fm.b = 2; });
  assert.equal(queue.hasPending(), true);
  assert.deepEqual(queue.pending(), { a: 1, b: 2 });
  assert.equal(typeof scheduled, "function");

  await scheduled();
  assert.equal(queue.hasPending(), false);
  assert.deepEqual(fresh, { foo: "baz", a: 1, b: 2 });
});

if (!process.exitCode) console.log("OK storage/frontmatter core tests passed");
