"use strict";

const createPatientDatabaseActions = ({
  saveNow,
  resolveCurrentPatientId,
  buildDatabaseRowFromCurrent,
  upsertDatabaseRowFile,
  removeDatabaseRowFile,
  waitForPatientInDatabase,
  markDatabaseExportForCurrent,
  clearDatabaseExportMarkForCurrent,
  moveCurrentFileToFolder,
  isDischargedFilePath = () => false,
  getCurrentFilePath = () => "",
  getCurrentFileName = () => "",
  dischargeFolder = "Выписаны",
  notify = null
} = {}) => {
  if (typeof saveNow !== "function") throw new Error("createPatientDatabaseActions: saveNow is required");
  if (typeof resolveCurrentPatientId !== "function") throw new Error("createPatientDatabaseActions: resolveCurrentPatientId is required");
  if (typeof buildDatabaseRowFromCurrent !== "function") throw new Error("createPatientDatabaseActions: buildDatabaseRowFromCurrent is required");
  if (typeof upsertDatabaseRowFile !== "function") throw new Error("createPatientDatabaseActions: upsertDatabaseRowFile is required");
  if (typeof removeDatabaseRowFile !== "function") throw new Error("createPatientDatabaseActions: removeDatabaseRowFile is required");
  if (typeof waitForPatientInDatabase !== "function") throw new Error("createPatientDatabaseActions: waitForPatientInDatabase is required");
  if (typeof markDatabaseExportForCurrent !== "function") throw new Error("createPatientDatabaseActions: markDatabaseExportForCurrent is required");
  if (typeof clearDatabaseExportMarkForCurrent !== "function") throw new Error("createPatientDatabaseActions: clearDatabaseExportMarkForCurrent is required");
  if (typeof moveCurrentFileToFolder !== "function") throw new Error("createPatientDatabaseActions: moveCurrentFileToFolder is required");

  const reportError = (prefix, error, message) => {
    console.error(prefix, error);
    if (typeof notify === "function") {
      notify(message + (error?.message ? `: ${error.message}` : ""));
    }
  };

  const savePatientIdentity = async ({ patientId, source = "template" } = {}) => {
    const id = String(patientId || "").trim();
    if (!id) return { ok: false, reason: "missing_id" };
    try {
      await saveNow({ ID_пациента: id });
      return { ok: true, id, source };
    } catch (error) {
      reportError("savePatientIdentity:", error, "❌ Ошибка сохранения ID пациента");
      return { ok: false, reason: "write_failed", error };
    }
  };

  const ensureCurrentPatientId = async () => {
    const resolved = resolveCurrentPatientId();
    if (resolved?.source === "existing") return resolved.id;
    if (!resolved?.id) return "";
    const saved = await savePatientIdentity({ patientId: resolved.id, source: resolved.source || "generated" });
    return saved?.ok ? saved.id : "";
  };

  const syncPatientToDatabase = async ({ markExport = false, source = "template" } = {}) => {
    const dbId = await ensureCurrentPatientId();
    if (!dbId) return { ok: false, reason: "missing_id" };
    const row = buildDatabaseRowFromCurrent();
    try {
      await upsertDatabaseRowFile(row, dbId, new Date().toISOString().slice(0, 10));
      const verifyRes = await waitForPatientInDatabase(dbId, { exists: true });
      if (!verifyRes) {
        throw new Error("Не удалось подтвердить запись пациента в БД после сохранения");
      }
      if (markExport) {
        const markRes = await markDatabaseExportForCurrent(source);
        if (!markRes?.ok) throw (markRes?.error || new Error("Не удалось отметить выгрузку в БД"));
      }
      return { ok: true, id: dbId };
    } catch (error) {
      reportError("syncPatientToDatabase:", error, "❌ Ошибка обновления БД");
      return { ok: false, reason: "write_failed", error };
    }
  };

  const removePatientFromDatabase = async ({ clearExportMark = true } = {}) => {
    const dbId = await ensureCurrentPatientId();
    if (!dbId) return { ok: false, reason: "missing_id" };
    try {
      await removeDatabaseRowFile(dbId);
      const verifyRes = await waitForPatientInDatabase(dbId, { exists: false });
      if (verifyRes) throw new Error("Не удалось подтвердить удаление пациента из БД");
      if (clearExportMark) {
        await clearDatabaseExportMarkForCurrent();
      }
      return { ok: true, id: dbId };
    } catch (error) {
      reportError("removePatientFromDatabase:", error, "❌ Ошибка удаления из БД");
      return { ok: false, reason: "delete_failed", error };
    }
  };

  const dischargeCurrentPatient = async ({ source = "template-discharge", targetFolder = dischargeFolder } = {}) => {
    const dbId = await ensureCurrentPatientId();
    if (!dbId) return { ok: false, reason: "missing_id" };
    const originalPath = String(getCurrentFilePath() || "");
    const wasAlreadyDischarged = isDischargedFilePath(originalPath);
    const syncRes = await syncPatientToDatabase({ markExport: false, source });
    if (!syncRes?.ok) {
      try { await removePatientFromDatabase({ clearExportMark: false }); } catch (_) {}
      return syncRes;
    }
    const verifyRes = await waitForPatientInDatabase(dbId, { exists: true });
    if (!verifyRes) {
      await removePatientFromDatabase({ clearExportMark: false });
      return {
        ok: false,
        reason: "verify_failed",
        error: new Error("Не удалось подтвердить запись пациента в БД")
      };
    }
    try {
      if (!wasAlreadyDischarged) {
        await moveCurrentFileToFolder(targetFolder);
      }
      const markRes = await markDatabaseExportForCurrent(source);
      if (!markRes?.ok) throw (markRes?.error || new Error("Не удалось отметить факт выписки"));
      const finalVerify = await waitForPatientInDatabase(dbId, { exists: true });
      if (!finalVerify) throw new Error("После выписки запись в БД не найдена");
      return { ok: true, id: dbId };
    } catch (error) {
      console.error("dischargeCurrentPatient:", error);
      try {
        if (!wasAlreadyDischarged && isDischargedFilePath(String(getCurrentFilePath() || ""))) {
          const rollbackPath = originalPath || `${dischargeFolder}/${String(getCurrentFileName() || "")}`;
          if (rollbackPath && String(getCurrentFilePath() || "") !== rollbackPath) {
            const rollbackFolder = rollbackPath.split("/").slice(0, -1).join("/");
            if (rollbackFolder) await moveCurrentFileToFolder(rollbackFolder);
          }
        }
      } catch (moveErr) {
        console.error("dischargeCurrentPatient rollback move:", moveErr);
      }
      const rmRes = await removePatientFromDatabase({ clearExportMark: true });
      if (!rmRes?.ok) console.error("dischargeCurrentPatient rollback db:", rmRes?.error || rmRes);
      return { ok: false, reason: "discharge_failed", error };
    }
  };

  return {
    savePatientIdentity,
    ensureCurrentPatientId,
    syncPatientToDatabase,
    removePatientFromDatabase,
    dischargeCurrentPatient
  };
};

module.exports = {
  createPatientDatabaseActions
};
