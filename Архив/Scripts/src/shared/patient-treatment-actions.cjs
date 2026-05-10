"use strict";

const normalizeText = (value) => String(value ?? "").trim();

const toLsTerm = (uiVal) => {
  const v = normalizeText(uiVal);
  if (!v || /^весь/i.test(v)) return { Срок: "весь_курс", Дней: null };
  const m = v.match(/(\d+)/);
  const n = m ? Number(m[1]) : null;
  if (!n || n < 1) return { Срок: "весь_курс", Дней: null };
  return { Срок: `${n}_дней`, Дней: n };
};

const toLsUiDuration = (term, days) => {
  if (term === "весь_курс") return "Весь период лечения";
  const n = Number(days);
  if (Number.isFinite(n) && n > 0) return `${n} ${n === 1 ? "день" : (n >= 2 && n <= 4 ? "дня" : "дней")}`;
  const m = normalizeText(term).match(/^(\d+)_дней$/);
  if (m) {
    const k = Number(m[1]);
    if (k > 0) return `${k} ${k === 1 ? "день" : (k >= 2 && k <= 4 ? "дня" : "дней")}`;
  }
  return "Весь период лечения";
};

const normalizeLsAssignments = (pageObj) => {
  const rawNew = pageObj?.ЛС_назначения;
  if (Array.isArray(rawNew) && rawNew.length > 0) {
    return rawNew.filter(Boolean).map(e => ({
      Препарат: normalizeText(e.Препарат),
      Дозировка: normalizeText(e.Дозировка),
      Срок: normalizeText(e.Срок) || "весь_курс",
      Дней: Number(e.Дней) > 0 ? Number(e.Дней) : null,
      Дата_старта: e.Дата_старта ? (normalizeText(e.Дата_старта) || normalizeText(e.Дата_начала)) : normalizeText(e.Дата_начала)
    })).filter(e => e.Препарат);
  }

  const rawOld = pageObj?.Лекарственные_препараты;
  if (Array.isArray(rawOld) && rawOld.length > 0) {
    return rawOld.filter(Boolean).map(e => {
      const t = toLsTerm(e.Срок);
      return {
        Препарат: normalizeText(e.Препарат),
        Дозировка: normalizeText(e.Дозировка),
        Срок: t.Срок,
        Дней: t.Дней,
        Дата_старта: normalizeText(e.Дата_начала)
      };
    }).filter(e => e.Препарат);
  }

  return [];
};

const dedupLsAssignments = (arr) => {
  const m = new Map();
  (arr || []).forEach(e => {
    if (!e || !e.Препарат) return;
    const k = `${normalizeText(e.Препарат).toLowerCase()}|${normalizeText(e.Дозировка).toLowerCase()}|${normalizeText(e.Срок) || "весь_курс"}|${e.Дней || ""}|${normalizeText(e.Дата_старта) || ""}`;
    if (!m.has(k)) m.set(k, e);
  });
  return Array.from(m.values());
};

const cloneVolumeList = (volumes) => (
  Array.isArray(volumes) ? volumes.filter(v => v && typeof v === "object").map(v => ({ ...v })) : []
);

const normalizeHltDrugs = (raw, { fallbackDrug = "", fallbackMode = "" } = {}) => {
  const list = Array.isArray(raw) ? raw.filter(Boolean) : [];
  if (list.length > 0) {
    return list.map(d => ({
      Препарат: normalizeText(d.Препарат),
      Режим: normalizeText(d.Режим),
      Дата: normalizeText(d.Дата)
    })).filter(d => d.Препарат || d.Режим || d.Дата);
  }
  if (fallbackDrug) {
    return [{ Препарат: normalizeText(fallbackDrug), Режим: normalizeText(fallbackMode), Дата: "" }];
  }
  return [];
};

const normalizeHltBreaks = (raw) => (
  Array.isArray(raw) ? raw.filter(Boolean).map(item => ({
    Дата_начала: normalizeText(item.Дата_начала),
    Дата_окончания: normalizeText(item.Дата_окончания)
  })).filter(item => item.Дата_начала || item.Дата_окончания) : []
);

const createPatientTreatmentActions = ({
  saveNow,
  ls = {}
} = {}) => {
  if (typeof saveNow !== "function") throw new Error("createPatientTreatmentActions: saveNow is required");

  const ensureVolumes = () => {
    if (!Array.isArray(ls._volumes)) ls._volumes = [];
    return ls._volumes;
  };

  const persistVolumes = () => saveNow({ Объёмы: cloneVolumeList(ensureVolumes()) });

  const persistPrimaryField = (key, value) => saveNow({ [key]: value });

  const setVolumeField = (volume, key, value) => {
    if (!volume) return null;
    volume[key] = value;
    persistVolumes();
    return volume;
  };

  const insertBoostAt = (index, { connection = "Последовательный буст", name = "PTV Boost" } = {}) => {
    const boost = {
      Название: normalizeText(name) || null,
      Область_облучения: null,
      РОД: null,
      Количество_фракций: null,
      Фракционирование: "Стандартный",
      Связь: connection
    };
    ensureVolumes().splice(Math.max(0, Number(index) || 0), 0, boost);
    persistVolumes();
    return boost;
  };

  const removeVolume = (volume) => {
    const list = ensureVolumes();
    const idx = list.indexOf(volume);
    if (idx !== -1) {
      list.splice(idx, 1);
      persistVolumes();
    }
    return idx;
  };

  const addVolume = (volume = {}) => {
    const item = {
      Название: volume.Название ?? null,
      Область_облучения: volume.Область_облучения ?? null,
      РОД: volume.РОД ?? null,
      Количество_фракций: volume.Количество_фракций ?? null,
      Фракционирование: volume.Фракционирование ?? "Стандартный",
      Связь: volume.Связь ?? "Параллельно"
    };
    ensureVolumes().push(item);
    persistVolumes();
    return item;
  };

  const setPrimaryName = (value) => persistPrimaryField("Название_PTV", normalizeText(value) || null);
  const setPrimaryArea = (value) => persistPrimaryField("Область_облучения", normalizeText(value) || null);
  const setPrimaryDose = (value) => persistPrimaryField("РОД", value);
  const setPrimaryFractions = (value) => persistPrimaryField("Количество_фракций", value);
  const setPrimaryMode = (value) => persistPrimaryField("Фракционирование", value);

  return {
    eln: {
      setHospitalizedOff: () => saveNow({ Открытый_ЭЛН: null, Открытый_ЭЛН_активен: false }),
      setOpenActiveOff: () => saveNow({ Открытый_ЭЛН: null }),
      clearOpen: () => saveNow({ Открытый_ЭЛН: null, Открытый_ЭЛН_активен: false })
    },
    hlt: {
      saveDrugs: (drugs) => saveNow({ ХЛТ_препараты: normalizeHltDrugs(drugs) }),
      saveBreaks: (breaks) => saveNow({ Перерыв_ХЛТ: normalizeHltBreaks(breaks) }),
      clear: () => saveNow({
        ХЛТ_препараты: null,
        ХЛТ_дата_старта: null,
        Перерыв_ХЛТ: null,
        ХЛТ_ручные_даты: null,
        Пропущенные_даты_ХЛТ: null
      })
    },
    meds: {
      saveAssignments: (items) => {
        const normalized = dedupLsAssignments((Array.isArray(items) ? items : []).filter(Boolean).map(item => {
          const term = toLsTerm(item.Срок);
          const startIso = normalizeText(item.Дата_старта || item.Дата_начала);
          return {
            Препарат: normalizeText(item.Препарат),
            Дозировка: normalizeText(item.Дозировка),
            Срок: term.Срок,
            Дней: term.Дней,
            Дата_старта: startIso
          };
        }).filter(item => item.Препарат));

        saveNow({
          ЛС_назначения: normalized,
          Лекарственные_препараты: normalized.map(item => ({
            Препарат: item.Препарат,
            Дозировка: item.Дозировка,
            Срок: toLsUiDuration(item.Срок, item.Дней),
            Дата_начала: item.Дата_старта || ""
          }))
        });
      }
    },
    volumes: {
      persist: persistVolumes,
      setPrimaryName,
      setPrimaryArea,
      setPrimaryDose,
      setPrimaryFractions,
      setPrimaryMode,
      setVolumeName: (volume, value) => setVolumeField(volume, "Название", normalizeText(value) || null),
      setVolumeArea: (volume, value) => setVolumeField(volume, "Область_облучения", normalizeText(value) || null),
      setVolumeConnection: (volume, value) => setVolumeField(volume, "Связь", value),
      setVolumeDose: (volume, value) => setVolumeField(volume, "РОД", value),
      setVolumeFractions: (volume, value) => setVolumeField(volume, "Количество_фракций", value),
      setVolumeMode: (volume, value) => setVolumeField(volume, "Фракционирование", value),
      addVolume,
      removeVolume,
      insertBoostAt
    }
  };
};

module.exports = {
  normalizeText,
  toLsTerm,
  toLsUiDuration,
  normalizeLsAssignments,
  dedupLsAssignments,
  cloneVolumeList,
  normalizeHltDrugs,
  normalizeHltBreaks,
  createPatientTreatmentActions
};
