"use strict";

const normalizeIsoList = (value) => {
  const list = Array.isArray(value) ? value : (value ? [value] : []);
  return list.map(item => String(item ?? "").trim()).filter(Boolean);
};

const removeFrontmatterKey = (fm = {}, key = "") => {
  try {
    delete fm[key];
  } catch (_) {
    fm[key] = [];
  }
};

const createPatientDomainActions = ({
  patchCurrentFrontmatter,
  workflowCore,
  linkedCaseActions = null,
  notice = null
} = {}) => {
  if (typeof patchCurrentFrontmatter !== "function") {
    throw new Error("createPatientDomainActions: patchCurrentFrontmatter is required");
  }
  if (!workflowCore?.applyStepPatch || !workflowCore?.applyUndoStepPatch) {
    throw new Error("createPatientDomainActions: workflowCore is required");
  }

  const notify = typeof notice === "function" ? notice : null;

  const applyWorkflowTransition = async ({
    kind = "step",
    step = null,
    keys = [],
    dbExportAtKey = "",
    dbExportSourceKey = "",
    historyAt = ""
  } = {}) => {
    if (kind === "step") {
      if (!step?.key) throw new Error("applyWorkflowTransition: step is required");
      await patchCurrentFrontmatter(fm => workflowCore.applyStepPatch(fm, step, { historyAt }), { reread: false });
      return { ok: true, kind, step: step.key };
    }

    if (kind === "undoStep") {
      await patchCurrentFrontmatter(fm => workflowCore.applyUndoStepPatch(fm, {
        keys,
        dbExportAtKey,
        dbExportSourceKey,
        historyAt
      }), { reread: false });
      return { ok: true, kind, keys: Array.isArray(keys) ? [...keys] : [] };
    }

    throw new Error(`applyWorkflowTransition: unsupported kind "${kind}"`);
  };

  const applyReminderAction = async ({
    manualDates = [],
    skippedDates = [],
    successMessage = ""
  } = {}) => {
    const nextManual = normalizeIsoList(manualDates);
    const nextSkipped = normalizeIsoList(skippedDates);

    await patchCurrentFrontmatter(fm => {
      fm.ХЛТ_ручные_даты = nextManual;
      if (nextSkipped.length > 0) fm.Пропущенные_даты_ХЛТ = nextSkipped;
      else removeFrontmatterKey(fm, "Пропущенные_даты_ХЛТ");
    }, { reread: false });

    if (successMessage && notify) notify(successMessage);
    return { ok: true, manualDates: nextManual, skippedDates: nextSkipped };
  };

  const applyTreatmentScheduleAction = async ({
    kind = "saveRemarks",
    remarks = [],
    labs = [],
    hltBreaks = []
  } = {}) => {
    if (kind === "saveRemarks") {
      const nextRemarks = Array.isArray(remarks) ? remarks : [];
      await patchCurrentFrontmatter(fm => {
        fm.Переразметки = nextRemarks;
      }, { reread: false });
      return { ok: true, kind, count: nextRemarks.length };
    }

    if (kind === "saveLabs") {
      const nextLabs = Array.isArray(labs) ? labs : (labs ? [labs] : []);
      await patchCurrentFrontmatter(fm => {
        fm.Лабораторные = nextLabs.length ? nextLabs : null;
      }, { reread: false });
      return { ok: true, kind, count: nextLabs.length };
    }

    if (kind === "saveHltBreaks") {
      const nextBreaks = Array.isArray(hltBreaks) ? hltBreaks : (hltBreaks ? [hltBreaks] : []);
      await patchCurrentFrontmatter(fm => {
        fm.Перерыв_ХЛТ = nextBreaks.length ? nextBreaks : null;
      }, { reread: false });
      return { ok: true, kind, count: nextBreaks.length };
    }

    throw new Error(`applyTreatmentScheduleAction: unsupported kind "${kind}"`);
  };

  const applyLinkedCaseAction = async ({
    kind = "getLinkedNames",
    name = "",
    targetPage = null,
    newName = ""
  } = {}) => {
    if (!linkedCaseActions) {
      throw new Error("applyLinkedCaseAction: linkedCaseActions is required");
    }

    if (kind === "getLinkedNames" || kind === "list") {
      return linkedCaseActions.getLinkedNames();
    }

    if (kind === "remove") {
      if (!name) throw new Error("applyLinkedCaseAction: name is required");
      return linkedCaseActions.removeLinkedCase(name);
    }

    if (kind === "add") {
      if (!targetPage?.file?.name) throw new Error("applyLinkedCaseAction: targetPage is required");
      return linkedCaseActions.addLinkedCase(targetPage);
    }

    if (kind === "create") {
      if (!newName) throw new Error("applyLinkedCaseAction: newName is required");
      return linkedCaseActions.createLinkedCase(newName);
    }

    throw new Error(`applyLinkedCaseAction: unsupported kind "${kind}"`);
  };

  return {
    applyWorkflowTransition,
    applyReminderAction,
    applyTreatmentScheduleAction,
    applyLinkedCaseAction
  };
};

module.exports = {
  normalizeIsoList,
  createPatientDomainActions
};
