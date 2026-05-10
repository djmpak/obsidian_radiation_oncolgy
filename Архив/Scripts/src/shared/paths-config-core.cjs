"use strict";

const PATHS = Object.freeze({
  scriptsRoot: "Архив/Scripts",
  modulesRoot: "Архив/Scripts/modules",
  viewsRoot: "Архив/Scripts/views",
  patientViewPath: "Архив/Scripts/views/patient",
  desktopViewPath: "Архив/Scripts/views/desktop",
  databasePath: "Архив/БД/База_пациентов.md",
  holidaysPath: "Архив/БД/БД_Праздники.md",
  patientsFolder: "Пациенты",
  dischargedFolder: "Выписаны",
  rejectedFolder: "Не начали",
  consultationsFolder: "Консультации",
  attachmentsRoot: "Архив/Вложения"
});

const DB_EXPORT_KEYS = Object.freeze({
  at: "db_exported_at",
  source: "db_export_source"
});

const getPath = (key) => PATHS[key] || "";

const sanitizePathSegment = (value = "") => (
  String(value || "").replace(/[\\/:*?"<>|]/g, "_").trim() || "Без имени"
);

const getPatientAttachmentFolder = (patientName = "") => `${PATHS.attachmentsRoot}/${sanitizePathSegment(patientName)}`;

const getRuntimeModulePath = (name = "") => {
  const clean = String(name || "").replace(/^[\\/]+|[\\/]+$/g, "");
  return clean ? `${PATHS.modulesRoot}/${clean}` : "";
};

module.exports = {
  PATHS,
  DB_EXPORT_KEYS,
  getPath,
  sanitizePathSegment,
  getPatientAttachmentFolder,
  getRuntimeModulePath
};
