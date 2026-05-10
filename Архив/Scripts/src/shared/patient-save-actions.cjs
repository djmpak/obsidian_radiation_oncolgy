"use strict";

const DEFAULT_AUTO_OPEN_FLAG_KEYS = [
  "_Открыть_редактор_сразу",
  "_auto_open_editor"
];

const createPatientSaveActions = ({
  patchCurrentFrontmatter,
  mergeIntoStoredFrontmatter,
  refreshStoredFrontmatter,
  ls,
  notify = null,
  markPhase = null,
  showSaveFlash = null,
  autoOpenFlagKeys = DEFAULT_AUTO_OPEN_FLAG_KEYS,
  saveLaterDelayMs = 400
} = {}) => {
  if (typeof patchCurrentFrontmatter !== "function") {
    throw new Error("createPatientSaveActions: patchCurrentFrontmatter is required");
  }
  if (typeof mergeIntoStoredFrontmatter !== "function") {
    throw new Error("createPatientSaveActions: mergeIntoStoredFrontmatter is required");
  }
  if (typeof refreshStoredFrontmatter !== "function") {
    throw new Error("createPatientSaveActions: refreshStoredFrontmatter is required");
  }
  if (!ls || typeof ls !== "object") {
    throw new Error("createPatientSaveActions: ls is required");
  }

  const showFlash = typeof showSaveFlash === "function" ? showSaveFlash : null;
  const reportError = (prefix, error, message) => {
    console.error(prefix, error);
    if (typeof notify === "function") {
      notify(message + (error?.message ? `: ${error.message}` : ""));
    }
  };

  const clearAutoOpenEditorFlags = () => patchCurrentFrontmatter(fm => {
    for (const key of Array.isArray(autoOpenFlagKeys) ? autoOpenFlagKeys : DEFAULT_AUTO_OPEN_FLAG_KEYS) {
      try {
        delete fm[key];
      } catch (error) {
        fm[key] = null;
      }
    }
  }, {
    refresh: refreshStoredFrontmatter,
    reread: false
  });

  const saveNow = (updates = {}) => {
    Object.assign(ls, updates);
    mergeIntoStoredFrontmatter(updates);
    if (typeof markPhase === "function") markPhase("write");
    return patchCurrentFrontmatter(fm => Object.assign(fm, updates), {
      refresh: refreshStoredFrontmatter,
      reread: false
    })
      .then(() => { showFlash?.(); })
      .catch(error => {
        reportError("saveNow:", error, "❌ Ошибка сохранения");
      });
  };

  const _debTimers = {};
  const saveLater = (key, val) => {
    ls[key] = val;
    mergeIntoStoredFrontmatter({ [key]: val });
    if (_debTimers[key]) clearTimeout(_debTimers[key]);
    _debTimers[key] = setTimeout(() => {
      delete _debTimers[key];
      patchCurrentFrontmatter(fm => { fm[key] = val; }, {
        refresh: refreshStoredFrontmatter,
        reread: false
      })
        .then(() => { showFlash?.(); })
        .catch(error => {
          reportError("saveLater:", error, "❌ Ошибка сохранения");
        });
    }, saveLaterDelayMs);
  };

  return {
    clearAutoOpenEditorFlags,
    saveNow,
    saveLater
  };
};

module.exports = {
  DEFAULT_AUTO_OPEN_FLAG_KEYS,
  createPatientSaveActions
};
