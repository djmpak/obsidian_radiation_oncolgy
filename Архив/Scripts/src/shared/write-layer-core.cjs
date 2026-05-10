"use strict";

const getScrollTarget = (windowRef) => {
  const doc = windowRef?.document || (typeof document !== "undefined" ? document : null);
  return doc?.querySelector?.(".cm-scroller")
    || doc?.querySelector?.(".markdown-preview-view")
    || doc?.scrollingElement
    || null;
};

const getScrollTop = (windowRef, scrollTarget) => (
  scrollTarget ? scrollTarget.scrollTop : Number(windowRef?.scrollY || 0)
);

const restoreScrollAfterFrame = (windowRef, scrollTarget, top) => {
  const raf = typeof windowRef?.requestAnimationFrame === "function"
    ? windowRef.requestAnimationFrame.bind(windowRef)
    : (callback) => setTimeout(callback, 0);
  raf(() => raf(() => {
    if (scrollTarget) scrollTarget.scrollTop = top;
    else windowRef?.scrollTo?.(0, top);
  }));
};

const createWriteLayerCore = ({
  frontmatter,
  app,
  window = null,
  console: logger = globalThis.console
} = {}) => {
  if (!frontmatter?.readFreshFrontmatter) throw new Error("createWriteLayerCore: frontmatter.readFreshFrontmatter is required");
  if (!frontmatter?.patchFrontmatter) throw new Error("createWriteLayerCore: frontmatter.patchFrontmatter is required");

  const runRefreshHooks = async (paths, meta = {}) => {
    try {
      await window?._pfRunRefreshHooks?.(paths, meta);
    } catch (error) {
      logger?.error?.("runRefreshHooks:", error);
    }
  };

  const patchFrontmatter = async (targetFile, mutator, options = {}) =>
    frontmatter.patchFrontmatter(targetFile, mutator, options);

  const installFrontmatterPatch = ({ version = 2 } = {}) => {
    if (!window || !app?.fileManager?.processFrontMatter) return { installed: false, reason: "missing-runtime" };
    if ((window._pfmPatchedVersion || 0) >= version) return { installed: false, version: window._pfmPatchedVersion || 0 };

    window._pfmPatched = true;
    window._pfmPatchedVersion = version;
    const originalProcessFrontMatter = app.fileManager.processFrontMatter.bind(app.fileManager);
    app.fileManager.processFrontMatter = async (targetFile, mutator) => {
      const scrollTarget = getScrollTarget(window);
      const top = getScrollTop(window, scrollTarget);
      const result = await originalProcessFrontMatter(targetFile, mutator);
      await runRefreshHooks([String(targetFile?.path || "")], {
        type: "frontmatter",
        file: targetFile
      });
      restoreScrollAfterFrame(window, scrollTarget, top);
      return result;
    };
    return { installed: true, version };
  };

  const installRenamePatch = ({ version = 3 } = {}) => {
    if (!window || !app?.fileManager?.renameFile) return { installed: false, reason: "missing-runtime" };
    if ((window._pfRenamePatchedVersion || 0) >= version) return { installed: false, version: window._pfRenamePatchedVersion || 0 };

    window._pfRenamePatched = true;
    window._pfRenamePatchedVersion = version;
    if (!window._pfRenameHooks) window._pfRenameHooks = {};
    const originalRenameFile = app.fileManager.renameFile.bind(app.fileManager);
    app.fileManager.renameFile = async (targetFile, newPath) => {
      const oldPath = String(targetFile?.path || "");
      const nextPath = String(newPath || "");
      const result = await originalRenameFile(targetFile, newPath);
      try {
        const hooks = Object.values(window._pfRenameHooks || {});
        for (const hook of hooks) {
          if (typeof hook === "function") {
            try { await hook({ file: targetFile, oldPath, newPath: nextPath }); } catch (_) {}
          }
        }
      } catch (_) {}
      try {
        const oldRefreshHook = window[`_pfRefreshHook_${oldPath}`];
        if (oldRefreshHook && nextPath && !window[`_pfRefreshHook_${nextPath}`]) {
          window[`_pfRefreshHook_${nextPath}`] = oldRefreshHook;
        }
        const oldRegisterHook = window[`_pfRegisterRefreshSubscriber_${oldPath}`];
        if (oldRegisterHook && nextPath && !window[`_pfRegisterRefreshSubscriber_${nextPath}`]) {
          window[`_pfRegisterRefreshSubscriber_${nextPath}`] = oldRegisterHook;
        }
        if (window._pfRefreshSubscribers?.[oldPath] && nextPath) {
          window._pfRefreshSubscribers[nextPath] = Object.assign(
            {},
            window._pfRefreshSubscribers[oldPath],
            window._pfRefreshSubscribers[nextPath] || {}
          );
        }
        await window._pfRetargetMarkdownLeaves?.({ fromPaths: [oldPath, nextPath], toPath: nextPath });
        await runRefreshHooks([oldPath, nextPath], {
          type: "rename",
          file: targetFile,
          oldPath,
          newPath: nextPath
        });
      } catch (_) {}
      return result;
    };
    return { installed: true, version };
  };

  return {
    ...frontmatter,
    readFreshFrontmatter: frontmatter.readFreshFrontmatter,
    patchFrontmatter,
    installFrontmatterPatch,
    installRenamePatch
  };
};

module.exports = {
  getScrollTarget,
  getScrollTop,
  restoreScrollAfterFrame,
  createWriteLayerCore
};
