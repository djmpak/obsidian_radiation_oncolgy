"use strict";

const parseLinkedCaseNames = (raw) => {
  const arr = Array.isArray(raw) ? raw : (raw ? [raw] : []);
  return arr.map(l => {
    if (!l) return null;
    const s = l.toString().trim();
    const m = s.match(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/);
    return (m ? m[1].trim() : s) || null;
  }).filter(Boolean);
};

const buildLinkedCaseContent = ({ file, cur, backLinkStr }) => `---
ФИО: ${cur.ФИО ?? ""}
Дата_рождения: ${cur.Дата_рождения ? (cur.Дата_рождения?.toFormat?.("yyyy-MM-dd") ?? "") : ""}
МКБ 10: ${cur["МКБ 10"] ?? ""}
Диагноз: >-
  ${(cur.Диагноз ?? "").toString().replace(/\n/g, "\n  ")}
Дополнительная_информация:
Дата_консультации:
Дата_разметки:
Дата_начала_лечения:
Цель_лечения:
Область_облучения:
РОД:
Количество_фракций:
Фракционирование:
ХЛТ_препараты: []
ХЛТ_ручные_даты: []
Пропущенные_даты_ХЛТ: []
ЛС_назначения: []
Лекарственные_препараты: []
Больничный_лист: false
Открытый_ЭЛН_активен: false
Открытый_ЭЛН:
СНИЛС: ${cur.СНИЛС ?? ""}
Группа ВМП: ${cur["Группа ВМП"] ?? ""}
Номер_телефона: ${cur.Номер_телефона ?? ""}
db_sex:
db_tumor_location:
db_histotype:
db_surgery_type:
db_prior_treatment:
db_chemo_regimen:
db_rt_method:
db_hormonal_drug:
db_targeted_drug:
db_immunotherapy_drug:
db_date_dx:
db_progression:
db_date_prog:
db_relapse:
db_date_relapse:
db_metastasis:
db_date_metastasis:
db_pdl1:
db_msi:
db_tmb:
db_mmr:
db_egfr:
db_braf:
db_alk:
db_ros1:
db_ntrk:
db_her2:
db_kras:
db_nras:
db_pik3ca:
db_nf1:
db_tp53:
db_kit:
db_met:
db_egfr_exon:
db_egfr_t790m:
db_egfr_c797s:
db_brca1:
db_brca2:
db_chek2:
db_atm:
db_palin:
db_radiotherapy:
db_surgery:
db_referral:
db_social:
tags:
  - Пациент
  - ДС
Разметка: false
Оконтуривание: false
Госпитализация: false
Переразметки: []
Свойства_заполнены: false
Объёмы: []
ХЛТ_дата_старта:
Диспансерный_учет: false
Решение_консилиума:
Жалобы:
Анамнез_заболевания:
Анамнез_жизни:
Описания_исследований:
Сопутствующие_заболевания:
Связанные_случаи:
  - "${backLinkStr}"
---`;

const createPatientLinkedCaseActions = ({
  app,
  dv,
  file,
  cur,
  platform = null,
  patchFileFrontmatter,
  notice = null
} = {}) => {
  if (!app?.vault) throw new Error("createPatientLinkedCaseActions: app.vault is required");
  if (!dv) throw new Error("createPatientLinkedCaseActions: dv is required");
  if (!file) throw new Error("createPatientLinkedCaseActions: file is required");
  if (!cur) throw new Error("createPatientLinkedCaseActions: cur is required");
  if (typeof patchFileFrontmatter !== "function") throw new Error("createPatientLinkedCaseActions: patchFileFrontmatter is required");

  const notify = (message) => {
    if (typeof notice === "function") return notice(message);
    return null;
  };

  const getLinkedNames = () => parseLinkedCaseNames(cur.Связанные_случаи);

  const removeLinkedCase = async (name) => {
    const linkedNames = getLinkedNames();
    const found = dv.pages().find(p => p.file?.name === name);
    await patchFileFrontmatter(file, fm => {
      if (!Array.isArray(fm.Связанные_случаи)) return;
      fm.Связанные_случаи = fm.Связанные_случаи.filter(l => l && !l.toString().includes(name));
      if (fm.Связанные_случаи.length === 0) delete fm.Связанные_случаи;
    }, { reread: false });
    if (found) {
      const linkedFile = app.vault.getAbstractFileByPath(found.file.path);
      if (linkedFile) {
        await patchFileFrontmatter(linkedFile, fm => {
          if (!Array.isArray(fm.Связанные_случаи)) return;
          const myName = file.basename;
          fm.Связанные_случаи = fm.Связанные_случаи.filter(l => l && !l.toString().includes(myName));
          if (fm.Связанные_случаи.length === 0) delete fm.Связанные_случаи;
        }, { reread: false });
      }
    }
    notify(`🔗 Связь с "${name}" удалена`);
    return { ok: true, name, linkedCount: linkedNames.length };
  };

  const addLinkedCase = async (targetPage) => {
    if (!targetPage?.file?.name) throw new Error("addLinkedCase: targetPage is required");
    await patchFileFrontmatter(file, fm => {
      if (!Array.isArray(fm.Связанные_случаи)) fm.Связанные_случаи = [];
      const lnk = `[[${targetPage.file.name}]]`;
      if (!fm.Связанные_случаи.some(l => l && l.toString().includes(targetPage.file.name))) {
        fm.Связанные_случаи.push(lnk);
      }
    }, { reread: false });
    const linkedFile2 = app.vault.getAbstractFileByPath(targetPage.file.path);
    if (linkedFile2) {
      await patchFileFrontmatter(linkedFile2, fm => {
        if (!Array.isArray(fm.Связанные_случаи)) fm.Связанные_случаи = [];
        const myLnk = `[[${file.basename}]]`;
        if (!fm.Связанные_случаи.some(l => l && l.toString().includes(file.basename))) {
          fm.Связанные_случаи.push(myLnk);
        }
      }, { reread: false });
    }
    notify(`🔗 "Связано с "${targetPage.file.name}"`);
    return { ok: true, name: targetPage.file.name };
  };

  const createLinkedCase = async (newName) => {
    const cleanName = String(newName || "").trim();
    if (!cleanName) throw new Error("createLinkedCase: newName is required");
    const currentFolder = file.parent ? file.parent.path : "";
    const newFilePath = currentFolder ? `${currentFolder}/${cleanName}.md` : `${cleanName}.md`;
    if (app.vault.getAbstractFileByPath(newFilePath)) {
      throw new Error(`Файл "${cleanName}.md" уже существует!`);
    }
    const backLinkStr = `[[${file.basename}]]`;
    const newFileContent = buildLinkedCaseContent({ file, cur, backLinkStr });
    await app.vault.create(newFilePath, newFileContent);
    await patchFileFrontmatter(file, fm => {
      if (!Array.isArray(fm.Связанные_случаи)) fm.Связанные_случаи = [];
      const lnk = `[[${cleanName}]]`;
      if (!fm.Связанные_случаи.some(l => l && l.toString().includes(cleanName))) fm.Связанные_случаи.push(lnk);
    }, { reread: false });
    notify(`✅ Создан: ${cleanName}`);
    if (platform?.openFileByPath) await platform.openFileByPath(newFilePath);
    return { ok: true, path: newFilePath, name: cleanName };
  };

  return {
    getLinkedNames,
    removeLinkedCase,
    addLinkedCase,
    createLinkedCase
  };
};

module.exports = {
  parseLinkedCaseNames,
  buildLinkedCaseContent,
  createPatientLinkedCaseActions
};
