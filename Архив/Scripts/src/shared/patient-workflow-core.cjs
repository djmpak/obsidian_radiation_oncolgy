"use strict";

const DEFAULT_DISCHARGED_FOLDER = "Выписаны";
const DEFAULT_DB_EXPORT_AT_KEY = "db_exported_at";
const DEFAULT_DB_EXPORT_SOURCE_KEY = "db_export_source";

const BASE_STEPS = Object.freeze([
  { key: "Разметка", label: "Разметка", color: "#ab47bc", dlKey: "Разметка" },
  { key: "Оконтуривание", label: "Оконтуривание", color: "#42a5f5", dlKey: "Оконтуривание" },
  { key: "Госпитализация", label: "Госпитализация", color: "#4caf50", dlKey: "Госпитализация" }
]);

const DISCHARGE_STEP = Object.freeze({ key: "Выписка", label: "Выписка", color: "#ff9800", dlKey: "Выписка" });

const resolveDischargedFolder = (folder = "") => String(folder || "").trim() || DEFAULT_DISCHARGED_FOLDER;
const resolveDbExportAtKey = (key = "") => String(key || "").trim() || DEFAULT_DB_EXPORT_AT_KEY;
const resolveDbExportSourceKey = (key = "") => String(key || "").trim() || DEFAULT_DB_EXPORT_SOURCE_KEY;

const getTrackedKeys = ({
  dbExportAtKey = DEFAULT_DB_EXPORT_AT_KEY,
  dbExportSourceKey = DEFAULT_DB_EXPORT_SOURCE_KEY
} = {}) => [
  "Дата_консультации", "Консультация_завершена", "Консультация_решение",
  "Принят_на_лечение", "Отказ_от_лечения",
  "Разметка", "Оконтуривание", "Госпитализация",
  "Переразметки", "Дата_переразметки", "Переразметка", "Переоконтуривание",
  resolveDbExportAtKey(dbExportAtKey), resolveDbExportSourceKey(dbExportSourceKey)
];

const clonePlain = (value) => {
  try { return JSON.parse(JSON.stringify(value)); } catch (_) { return value; }
};

const assignWorkflowValue = (target, key, value) => {
  if (value === undefined || value === null || value === "") delete target[key];
  else target[key] = clonePlain(value);
};

const hydrateFrontmatter = ({ keys = [], getValue = () => null } = {}) => {
  const fm = {};
  (Array.isArray(keys) ? keys : []).forEach(key => assignWorkflowValue(fm, key, getValue(key)));
  return fm;
};

const applyLocalPatch = (fm = {}, updates = {}) => {
  Object.entries(updates || {}).forEach(([key, value]) => assignWorkflowValue(fm, key, value));
  return fm;
};

const getRemarksList = (getValue = () => null) => {
  const raw = getValue("Переразметки");
  if (Array.isArray(raw) && raw.length > 0) return raw.filter(Boolean);
  if (getValue("Дата_переразметки")) {
    return [{
      Дата: getValue("Дата_переразметки"),
      Переразметка: getValue("Переразметка") === true,
      Переоконтуривание: getValue("Переоконтуривание") === true,
      Старт_нового_плана: ""
    }];
  }
  return [];
};

const pathInFolder = (path = "", folder = "") => String(path || "").startsWith(String(folder || "") + "/");

const isDischarged = ({
  path = "",
  dischargedFolder = DEFAULT_DISCHARGED_FOLDER,
  getValue = () => null,
  dbExportAtKey = DEFAULT_DB_EXPORT_AT_KEY
} = {}) => pathInFolder(path, resolveDischargedFolder(dischargedFolder)) || !!getValue(resolveDbExportAtKey(dbExportAtKey));

const getWorkflowContext = ({
  path = "",
  dischargedFolder = DEFAULT_DISCHARGED_FOLDER,
  getValue = () => null
} = {}) => {
  const inConsult = pathInFolder(path, "Консультации");
  const inPatients = pathInFolder(path, "Пациенты");
  const inNachali = pathInFolder(path, "Не начали");
  const inDischarged = pathInFolder(path, resolveDischargedFolder(dischargedFolder));
  let consultState = null;
  if (inConsult) consultState = "pending";
  else if (inPatients && !!getValue("Дата_консультации") && getValue("Принят_на_лечение") !== true) consultState = "pending";
  else if ((inPatients || inDischarged) && getValue("Принят_на_лечение") === true) consultState = "accepted";
  else if (inNachali && getValue("Отказ_от_лечения") === true) consultState = "rejected";
  return { inConsult, inPatients, inNachali, inDischarged, consultState };
};

const syncWorkflowState = ({
  state = {},
  path = "",
  getValue = () => null,
  dischargedFolder = DEFAULT_DISCHARGED_FOLDER,
  dbExportAtKey = DEFAULT_DB_EXPORT_AT_KEY
} = {}) => {
  state["Разметка"] = getValue("Разметка") === true;
  state["Оконтуривание"] = getValue("Оконтуривание") === true;
  state["Госпитализация"] = getValue("Госпитализация") === true;
  state["Выписка"] = isDischarged({ path, dischargedFolder, getValue, dbExportAtKey });
  const remarks = getRemarksList(getValue);
  remarks.forEach((remark, idx) => {
    state[`Переразметка_${idx}`] = remark?.Переразметка === true;
    state[`Переоконтуривание_${idx}`] = remark?.Переоконтуривание === true;
  });
  return { state, remarks };
};

const getWorkflowSteps = ({ hospitalized = false, discharged = false } = {}) => {
  const steps = BASE_STEPS.map(step => ({ ...step }));
  if (hospitalized || discharged) steps.push({ ...DISCHARGE_STEP });
  return steps;
};

const getAcceptTreatmentOperationOrder = ({
  currentFolder = "",
  targetFolder = "Пациенты"
} = {}) => (
  String(currentFolder || "") === String(targetFolder || "")
    ? ["patchFrontmatter"]
    : ["moveFile", "patchFrontmatter"]
);

const getUndoKeys = (steps = [], fromIndex = 0) => (
  (Array.isArray(steps) ? steps : []).slice(Number(fromIndex) || 0).map(step => step.key)
);

const appendHistory = (fm = {}, action = "", type = "", date = "") => {
  if (!Array.isArray(fm.История_статусов)) fm.История_статусов = [];
  fm.История_статусов.push({ дата: date, действие: action, тип: type });
  return fm;
};

const getAcceptPatch = () => ({
  Консультация_завершена: true,
  Консультация_решение: "принят",
  Принят_на_лечение: true,
  Отказ_от_лечения: false
});

const applyAcceptPatch = (fm = {}, { historyAt = "" } = {}) => {
  Object.assign(fm, getAcceptPatch());
  appendHistory(fm, "Принят на лечение", "принято", historyAt);
  return fm;
};

const getRejectPatch = () => ({
  Консультация_завершена: true,
  Консультация_решение: "отказ",
  Отказ_от_лечения: true,
  Принят_на_лечение: false
});

const applyRejectPatch = (fm = {}, { historyAt = "" } = {}) => {
  Object.assign(fm, getRejectPatch());
  appendHistory(fm, "Отказ от лечения", "отказ", historyAt);
  return fm;
};

const getRemarkStatePatch = (remarks = [], value = false) => {
  const patch = {};
  (Array.isArray(remarks) ? remarks : []).forEach((_, idx) => {
    patch[`Переразметка_${idx}`] = value;
    patch[`Переоконтуривание_${idx}`] = value;
  });
  return patch;
};

const resetRemarks = (remarks = []) => (
  Array.isArray(remarks) ? remarks.map(r => ({ ...r, Переразметка: false, Переоконтуривание: false })) : []
);

const getUndoAcceptPatch = ({
  remarks = [],
  dbExportAtKey = DEFAULT_DB_EXPORT_AT_KEY,
  dbExportSourceKey = DEFAULT_DB_EXPORT_SOURCE_KEY
} = {}) => ({
  Консультация_завершена: false,
  Консультация_решение: null,
  Принят_на_лечение: false,
  Отказ_от_лечения: false,
  Разметка: false,
  Оконтуривание: false,
  Госпитализация: false,
  Переразметки: resetRemarks(remarks),
  [resolveDbExportAtKey(dbExportAtKey)]: null,
  [resolveDbExportSourceKey(dbExportSourceKey)]: null
});

const deleteOrNull = (target = {}, key = "") => {
  try { delete target[key]; } catch (_) { target[key] = null; }
};

const resetFrontmatterRemarks = (fm = {}) => {
  if (Array.isArray(fm.Переразметки)) {
    fm.Переразметки = fm.Переразметки.map(r => ({ ...r, Переразметка: false, Переоконтуривание: false }));
  }
  return fm;
};

const applyUndoAcceptPatch = (fm = {}, {
  dbExportAtKey = DEFAULT_DB_EXPORT_AT_KEY,
  dbExportSourceKey = DEFAULT_DB_EXPORT_SOURCE_KEY,
  historyAt = ""
} = {}) => {
  Object.assign(fm, {
    Консультация_завершена: false,
    Консультация_решение: null,
    Принят_на_лечение: false,
    Отказ_от_лечения: false,
    Разметка: false,
    Оконтуривание: false,
    Госпитализация: false
  });
  deleteOrNull(fm, resolveDbExportAtKey(dbExportAtKey));
  deleteOrNull(fm, resolveDbExportSourceKey(dbExportSourceKey));
  resetFrontmatterRemarks(fm);
  appendHistory(fm, "Принятие на лечение", "откат", historyAt);
  return fm;
};

const getUndoRejectPatch = () => ({
  Консультация_завершена: false,
  Консультация_решение: null,
  Отказ_от_лечения: false
});

const applyUndoRejectPatch = (fm = {}, { historyAt = "" } = {}) => {
  Object.assign(fm, getUndoRejectPatch());
  appendHistory(fm, "Отказ от лечения", "откат", historyAt);
  return fm;
};

const getStepPatch = (step = {}) => ({ [step.key]: true });

const applyStepPatch = (fm = {}, step = {}, { historyAt = "" } = {}) => {
  if (!step?.key) return fm;
  fm[step.key] = true;
  appendHistory(fm, step.label || step.key, "выполнено", historyAt);
  return fm;
};

const getDischargePatch = ({
  dateIso = "",
  source = "template-discharge",
  dbExportAtKey = DEFAULT_DB_EXPORT_AT_KEY,
  dbExportSourceKey = DEFAULT_DB_EXPORT_SOURCE_KEY
} = {}) => ({
  [resolveDbExportAtKey(dbExportAtKey)]: dateIso,
  [resolveDbExportSourceKey(dbExportSourceKey)]: source
});

const getRollbackDischargePatch = ({
  dbExportAtKey = DEFAULT_DB_EXPORT_AT_KEY,
  dbExportSourceKey = DEFAULT_DB_EXPORT_SOURCE_KEY
} = {}) => ({
  [resolveDbExportAtKey(dbExportAtKey)]: null,
  [resolveDbExportSourceKey(dbExportSourceKey)]: null
});

const getUndoStepStatePatch = ({ keys = [], remarks = [] } = {}) => ({
  ...Object.fromEntries((Array.isArray(keys) ? keys : []).filter(k => k !== "Выписка").map(k => [k, false])),
  ...getRemarkStatePatch(remarks, false),
  ...(Array.isArray(keys) && keys.includes("Выписка") ? { Выписка: false } : {})
});

const getUndoStepPatch = ({
  keys = [],
  dbExportAtKey = DEFAULT_DB_EXPORT_AT_KEY,
  dbExportSourceKey = DEFAULT_DB_EXPORT_SOURCE_KEY
} = {}) => {
  const patch = {};
  (Array.isArray(keys) ? keys : []).forEach(key => {
    if (key === "Выписка") Object.assign(patch, getRollbackDischargePatch({ dbExportAtKey, dbExportSourceKey }));
    else patch[key] = false;
  });
  return patch;
};

const applyUndoStepPatch = (fm = {}, {
  keys = [],
  dbExportAtKey = DEFAULT_DB_EXPORT_AT_KEY,
  dbExportSourceKey = DEFAULT_DB_EXPORT_SOURCE_KEY,
  historyAt = ""
} = {}) => {
  (Array.isArray(keys) ? keys : []).forEach(key => {
    if (key === "Выписка") {
      deleteOrNull(fm, resolveDbExportAtKey(dbExportAtKey));
      deleteOrNull(fm, resolveDbExportSourceKey(dbExportSourceKey));
    } else {
      fm[key] = false;
    }
  });
  resetFrontmatterRemarks(fm);
  appendHistory(fm, (Array.isArray(keys) ? keys : []).join(", "), "откат", historyAt);
  return fm;
};

module.exports = {
  DEFAULT_DISCHARGED_FOLDER,
  DEFAULT_DB_EXPORT_AT_KEY,
  DEFAULT_DB_EXPORT_SOURCE_KEY,
  BASE_STEPS,
  DISCHARGE_STEP,
  resolveDischargedFolder,
  resolveDbExportAtKey,
  resolveDbExportSourceKey,
  getTrackedKeys,
  clonePlain,
  hydrateFrontmatter,
  applyLocalPatch,
  getRemarksList,
  pathInFolder,
  isDischarged,
  getWorkflowContext,
  syncWorkflowState,
  getWorkflowSteps,
  getAcceptTreatmentOperationOrder,
  getUndoKeys,
  appendHistory,
  getAcceptPatch,
  applyAcceptPatch,
  getRejectPatch,
  applyRejectPatch,
  getRemarkStatePatch,
  resetRemarks,
  getUndoAcceptPatch,
  applyUndoAcceptPatch,
  getUndoRejectPatch,
  applyUndoRejectPatch,
  getStepPatch,
  applyStepPatch,
  getDischargePatch,
  getRollbackDischargePatch,
  getUndoStepStatePatch,
  getUndoStepPatch,
  applyUndoStepPatch
};
