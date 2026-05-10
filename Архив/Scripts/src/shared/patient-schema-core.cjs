"use strict";

const PATIENT_SCHEMA_VERSION = 1;

const DEFAULT_FRONTMATTER = Object.freeze({
  schemaVersion: PATIENT_SCHEMA_VERSION,
  "ХЛТ_препараты": "",
  "ХЛТ_дата_старта": "",
  "ХЛТ_ручные_даты": [],
  "Пропущенные_даты_ХЛТ": [],
  "ХТ_режим": "",
  "ХТ_даты": [],
  "ХТ_ручные_смещения": [],
  "ХТ_напоминания": [],
  "Перерыв_ХЛТ": null,
  "Лабораторные": [],
  "Контроль_крови": [],
  "ЛС_назначения": [],
  "Лекарственные_препараты": [],
  "Больничный_лист": false,
  "Открытый_ЭЛН_активен": false,
  "Дата_консультации": "",
  "Открытый_ЭЛН": "",
  "Решение_консилиума": "",
  "Жалобы": "",
  "Анамнез_заболевания": "",
  "Анамнез_жизни": "",
  "Описания_исследований": "",
  "Сопутствующие_заболевания": "",
  "МКБ 10": "",
  "Диагноз": "",
  "ФИО": "",
  "Дата_рождения": "",
  "СНИЛС": "",
  "Номер_телефона": "",
  "Передан": "",
  "КС": "",
  "Палата": "",
  "Email": "",
  "ID_пациента": "",
  "Дата_окончания_лечения": "",
  "Статус_лечения": "",
  "ECOG_статус": "",
  "Ускоритель": "Varian Halcyon",
  db_sex: "",
  db_tumor_location: "",
  db_histotype: "",
  db_surgery_type: "",
  db_prior_treatment: "",
  db_chemo_regimen: "",
  db_rt_method: "",
  db_hormonal_drug: "",
  db_targeted_drug: "",
  db_immunotherapy_drug: "",
  db_date_dx: "",
  db_progression: "",
  db_date_prog: "",
  db_prog_type: "",
  db_vital_status: "",
  db_date_death: "",
  db_date_last_contact: "",
  db_stage: "",
  db_t: "",
  db_n: "",
  db_m: "",
  db_grade: "",
  db_mol_subtype: "",
  db_er: "",
  db_pr: "",
  db_her2: "",
  db_ki67: "",
  db_pdl1: "",
  db_egfr_mut: "",
  db_alk_status: "",
  db_ros1_status: "",
  db_kras_mut: "",
  db_nras_mut: "",
  db_ras_mut: "",
  db_braf_mut: "",
  db_idh_mut: "",
  db_brca_mut: "",
  db_ret_status: "",
  db_met_status: "",
  db_ntrk_status: "",
  db_mgmt_meth: "",
  db_msi_status: "",
  db_mmr_status: "",
  db_gleason: "",
  db_initial_psa: "",
  db_other_biomarkers: "",
  db_ecog_last: "",
  db_lc_days: "",
  db_dfs_days: "",
  db_exported_at: "",
  db_export_source: "",
  "AI_Парсер_модель": "",
  "AI_Парсер_версия_промпта": "",
  "AI_Парсер_дата": "",
  "AI_Парсер_источник": "",
  "AI_Парсер_service_tier": "",
  "AI_Парсер_system_fingerprint": "",
  "AI_Парсер_usage_json": "",
  "AI_Парсер_предупреждения": "",
  "AI_Парсер_ревью_json": "",
  tags: [],
  "Группа ВМП": ""
});

const TEMP_FRONTMATTER_KEYS = new Set([
  "_Открыть_редактор_сразу",
  "_auto_open_editor"
]);

const REQUIRED_ARRAY_FIELDS = Object.freeze([
  "ХЛТ_ручные_даты",
  "Пропущенные_даты_ХЛТ",
  "ХТ_даты",
  "ХТ_ручные_смещения",
  "ХТ_напоминания",
  "Лабораторные",
  "Контроль_крови",
  "ЛС_назначения",
  "Лекарственные_препараты",
  "tags"
]);

const REQUIRED_BOOLEAN_FIELDS = Object.freeze([
  "Больничный_лист",
  "Открытый_ЭЛН_активен"
]);

const cloneValue = (value) => {
  if (Array.isArray(value)) return value.map(cloneValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, cloneValue(item)]));
  }
  return value;
};

const getDefaultFrontmatter = () => (
  Object.fromEntries(Object.entries(DEFAULT_FRONTMATTER).map(([key, value]) => [key, cloneValue(value)]))
);

const ensureInitialFrontmatter = (draft = {}) => {
  const base = getDefaultFrontmatter();
  for (const [key, value] of Object.entries(draft || {})) {
    if (TEMP_FRONTMATTER_KEYS.has(key)) continue;
    base[key] = cloneValue(value);
  }
  return base;
};

const getSchemaVersionPatch = (version = PATIENT_SCHEMA_VERSION) => ({ schemaVersion: Number(version) || PATIENT_SCHEMA_VERSION });

const ensureSchemaVersion = (frontmatter = {}, version = PATIENT_SCHEMA_VERSION) => ({
  ...frontmatter,
  ...getSchemaVersionPatch(version)
});

module.exports = {
  PATIENT_SCHEMA_VERSION,
  DEFAULT_FRONTMATTER,
  TEMP_FRONTMATTER_KEYS,
  REQUIRED_ARRAY_FIELDS,
  REQUIRED_BOOLEAN_FIELDS,
  cloneValue,
  getDefaultFrontmatter,
  ensureInitialFrontmatter,
  getSchemaVersionPatch,
  ensureSchemaVersion
};
