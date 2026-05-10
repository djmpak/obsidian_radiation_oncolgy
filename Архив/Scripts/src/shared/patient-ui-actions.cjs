"use strict";

const cloneTemplateVolumes = (tpl = {}) => (
  Array.isArray(tpl.extra)
    ? tpl.extra.map(v => ({
        Название: v.Название ?? null,
        Область_облучения: v.Область_облучения ?? null,
        РОД: v.РОД ?? null,
        Количество_фракций: v.Количество_фракций ?? null,
        Фракционирование: v.Фракционирование ?? "Стандартный",
        Связь: v.Связь ?? "Параллельно"
      }))
    : []
);

const createPatientUiActions = ({
  patchCurrentFrontmatter
} = {}) => {
  if (typeof patchCurrentFrontmatter !== "function") {
    throw new Error("createPatientUiActions: patchCurrentFrontmatter is required");
  }

  const applyTemplateFrontmatter = async (tpl, newTags = [], { refresh = null, reread = false } = {}) => {
    if (!tpl?.ptv1) throw new Error("applyTemplateFrontmatter: tpl.ptv1 is required");

    const nextTags = Array.isArray(newTags) ? [...newTags] : [];
    await patchCurrentFrontmatter(fm => {
      fm.Название_PTV = tpl.ptv1.Название;
      fm.Область_облучения = tpl.ptv1.Область_облучения ?? null;
      fm.РОД = tpl.ptv1.РОД;
      fm.Количество_фракций = tpl.ptv1.Количество_фракций;
      fm.Фракционирование = tpl.ptv1.Фракционирование;
      if (tpl.цель) fm.Цель_лечения = tpl.цель;
      fm.Объёмы = cloneTemplateVolumes(tpl);
      if (tpl.hlt) {
        fm.ХЛТ_препараты = tpl.hlt.препараты ?? [];
        fm.ХЛТ_дата_старта = fm.Дата_начала_лечения ?? null;
      } else {
        fm.ХЛТ_препараты = [];
        fm.ХЛТ_дата_старта = null;
      }
      delete fm.Радиомодификация;
      delete fm.ХЛТ_режим;
      fm.tags = nextTags;
    }, { refresh, reread });

    return { ok: true, tags: nextTags };
  };

  const removeAttachmentAtIndex = async (idx, { reread = false } = {}) => {
    if (!Number.isInteger(idx) || idx < 0) {
      throw new Error("removeAttachmentAtIndex: idx must be a non-negative integer");
    }

    await patchCurrentFrontmatter(fm => {
      if (Array.isArray(fm.Вложения)) fm.Вложения.splice(idx, 1);
    }, { reread });

    return { ok: true, index: idx };
  };

  return {
    applyTemplateFrontmatter,
    removeAttachmentAtIndex
  };
};

module.exports = {
  cloneTemplateVolumes,
  createPatientUiActions
};
