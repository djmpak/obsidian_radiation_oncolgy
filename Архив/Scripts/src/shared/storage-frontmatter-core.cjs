"use strict";

const clonePlain = (value) => {
  try {
    return JSON.parse(JSON.stringify(value ?? {}));
  } catch (_) {
    return value ?? {};
  }
};

const mergeFrontmatterShallow = (current = {}, patch = {}, { deleteNull = false } = {}) => {
  const result = clonePlain(current);
  const entries = patch && typeof patch === "object" ? Object.entries(patch) : [];
  for (const [key, value] of entries) {
    if (value === undefined) continue;
    if (deleteNull && value === null) {
      delete result[key];
      continue;
    }
    result[key] = value;
  }
  return result;
};

const applyFrontmatterPatch = (current = {}, patchOrMutator, options = {}) => {
  const draft = clonePlain(current);
  if (typeof patchOrMutator === "function") {
    const returned = patchOrMutator(draft);
    const next = (returned && typeof returned === "object" && !Array.isArray(returned))
      ? mergeFrontmatterShallow(draft, returned, options)
      : draft;
    return options?.deleteNull
      ? mergeFrontmatterShallow({}, next, { deleteNull: true })
      : next;
  }
  return mergeFrontmatterShallow(draft, patchOrMutator, options);
};

const replaceFrontmatterObject = (target, source) => {
  if (!target || typeof target !== "object") return;
  for (const key of Object.keys(target)) delete target[key];
  Object.assign(target, clonePlain(source));
};

const createStorageFrontmatterCore = ({
  adapter,
  timers = globalThis,
  debounceMs = 120
} = {}) => {
  if (!adapter?.readFreshFrontmatter) throw new Error("createStorageFrontmatterCore: adapter.readFreshFrontmatter is required");
  if (!adapter?.patchFrontmatter) throw new Error("createStorageFrontmatterCore: adapter.patchFrontmatter is required");

  const setTimer = typeof timers?.setTimeout === "function"
    ? timers.setTimeout.bind(timers)
    : setTimeout;
  const clearTimer = typeof timers?.clearTimeout === "function"
    ? timers.clearTimeout.bind(timers)
    : clearTimeout;

  const readFreshFrontmatter = async (targetFile) => clonePlain(await adapter.readFreshFrontmatter(targetFile));

  const patchFrontmatter = async (targetFile, patchOrMutator, options = {}) => adapter.patchFrontmatter(
    targetFile,
    (frontmatter) => {
      const next = applyFrontmatterPatch(frontmatter, patchOrMutator, { deleteNull: true });
      replaceFrontmatterObject(frontmatter, next);
    },
    options
  );

  const mergeFrontmatter = (current = {}, patch = {}, options = {}) =>
    mergeFrontmatterShallow(current, patch, options);

  const createDebouncedWriteQueue = (targetFile, {
    delayMs: queueDelayMs = debounceMs,
    refresh = null,
    reread = true,
    initialPatch = {}
  } = {}) => {
    if (!targetFile) throw new Error("createDebouncedWriteQueue: targetFile is required");

    let pendingPatch = clonePlain(initialPatch);
    let timerId = null;

    const clear = () => {
      if (timerId !== null) {
        clearTimer(timerId);
        timerId = null;
      }
    };

    const pending = () => clonePlain(pendingPatch);

    const flush = async () => {
      clear();
      if (!pendingPatch || Object.keys(pendingPatch).length === 0) {
        return { ok: true, skipped: true };
      }
      const patch = pendingPatch;
      pendingPatch = {};
      return patchFrontmatter(targetFile, patch, { refresh, reread });
    };

    const arm = () => {
      clear();
      const waitMs = Math.max(0, Number(queueDelayMs) || 0);
      timerId = setTimer(() => {
        timerId = null;
        void flush();
      }, waitMs);
    };

    const schedule = (patchOrMutator) => {
      pendingPatch = applyFrontmatterPatch(pendingPatch, patchOrMutator, { deleteNull: false });
      arm();
      return pending();
    };

    const cancel = () => {
      clear();
      pendingPatch = {};
      return { ok: true, cancelled: true };
    };

    return {
      schedule,
      flush,
      cancel,
      pending,
      hasPending: () => Object.keys(pendingPatch || {}).length > 0
    };
  };

  return {
    readFreshFrontmatter,
    mergeFrontmatterShallow: mergeFrontmatter,
    patchFrontmatter,
    createDebouncedWriteQueue
  };
};

module.exports = {
  clonePlain,
  mergeFrontmatterShallow,
  applyFrontmatterPatch,
  createStorageFrontmatterCore
};
