"use strict";

const LARGE_CONN_LIST = ["Параллельно", "Последовательно"];
const BOOST_CONN_LIST = ["Последовательный буст", "Одновременно"];
const CONN_COLORS = {
  "Параллельно": "#ff9800",
  "Последовательно": "#ffc107",
  "Последовательный буст": "#9c27b0",
  "Одновременно": "#4caf50"
};
const LARGE_CONN_LABELS = { "Параллельно": "Параллельно", "Последовательно": "Последовательно" };
const FRAKTS_LIST = ["Стандартный", "Через день", "Два раза в день", "Стажированно (раз в 14 дней)"];

const buildTreatmentVolumeGroups = (volumes = [], normalizeConn = (raw) => String(raw || "")) => {
  const groups = [{ largeVol: null, largeIdx: null, conn: null, boosts: [] }];
  (Array.isArray(volumes) ? volumes : []).forEach((vol, idx) => {
    const conn = normalizeConn(vol?.Связь || "");
    if (conn === "Параллельно" || conn === "Последовательно") {
      groups.push({ largeVol: vol, largeIdx: idx, conn, boosts: [] });
    } else {
      groups[groups.length - 1].boosts.push({ vol, idx });
    }
  });
  return groups;
};

const getTreatmentVolumeDefaultName = (groupCount, index) => (groupCount > 1 ? `PTV${index}` : "PTV");

const mountDesktopTreatmentVolumesSection = ({
  wrap,
  modal,
  msc,
  ls,
  getVal,
  getStoredVal = getVal,
  setPending,
  buildForm,
  _npProcessFrontMatter,
  _pfDesktopCore,
  _pfDesktopPlatform,
  _pfPatientAcceleratorCore = null,
  document = globalThis.document,
  normalizeConn = (raw) => String(raw || ""),
  SUGGEST = {},
  renderAC = () => {},
  positionAC = () => {},
  setAcInput = () => {},
  setAcList = () => {}
} = {}) => {
  if (!wrap) throw new Error("mountDesktopTreatmentVolumesSection: wrap is required");
  if (!modal) throw new Error("mountDesktopTreatmentVolumesSection: modal is required");
  if (!msc) throw new Error("mountDesktopTreatmentVolumesSection: msc is required");
  if (!ls) throw new Error("mountDesktopTreatmentVolumesSection: ls is required");
  if (typeof getVal !== "function") throw new Error("mountDesktopTreatmentVolumesSection: getVal is required");
  if (typeof setPending !== "function") throw new Error("mountDesktopTreatmentVolumesSection: setPending is required");
  if (typeof buildForm !== "function") throw new Error("mountDesktopTreatmentVolumesSection: buildForm is required");
  if (typeof _npProcessFrontMatter !== "function") throw new Error("mountDesktopTreatmentVolumesSection: _npProcessFrontMatter is required");
  if (!_pfDesktopCore) throw new Error("mountDesktopTreatmentVolumesSection: _pfDesktopCore is required");
  if (!_pfDesktopPlatform) throw new Error("mountDesktopTreatmentVolumesSection: _pfDesktopPlatform is required");
  if (!document) throw new Error("mountDesktopTreatmentVolumesSection: document is required");

  const acceleratorOptions = Array.isArray(_pfPatientAcceleratorCore?.ACCELERATORS)
    ? _pfPatientAcceleratorCore.ACCELERATORS
    : ["Varian Halcyon", "Varian TrueBeam"];
  const resolveAccelerator = (value, context = {}) => (
    _pfPatientAcceleratorCore && typeof _pfPatientAcceleratorCore.normalizeAccelerator === "function"
      ? _pfPatientAcceleratorCore.normalizeAccelerator(value, context)
      : (acceleratorOptions.includes(value) ? value : "Varian Halcyon")
  );

  const volSec = modal.ownerDocument.createElement("div");
  const volSecTitle = modal.ownerDocument.createElement("div");
  volSecTitle.textContent = "Объёмы (PTV)"; volSecTitle.className = `${msc}-sec-title`;
  volSecTitle.style.marginTop = "16px";
  volSec.appendChild(volSecTitle);
  wrap.appendChild(volSec);

  // ── ШАБЛОНЫ ───────────────────────────────────────────────────────────────
  const TEMPLATES = _pfDesktopCore.TREATMENT_TEMPLATES;

  // UI: строка выбора шаблона
  const tplRow = modal.ownerDocument.createElement("div");
  tplRow.style.cssText = "display: flex; gap: 8px; align-items: center; margin-bottom: 10px; flex-wrap: wrap;";

  const tplSel = modal.ownerDocument.createElement("select");
  tplSel.className = `${msc}-select`;
  tplSel.style.cssText += " flex: 1 1 200px; min-width: 0; min-height: 36px; height: 36px; font-size: 13px; margin-bottom: 0;";
  const defTplOpt = modal.ownerDocument.createElement("option");
  defTplOpt.textContent = "— выбрать шаблон —"; defTplOpt.value = "";
  tplSel.appendChild(defTplOpt);

  const catMap = new Map();
  TEMPLATES.forEach((tpl, i) => {
    const cat = tpl.category || "Прочее";
    if (!catMap.has(cat)) catMap.set(cat, []);
    catMap.get(cat).push({ tpl, i });
  });
  catMap.forEach((items, cat) => {
    if (items.length === 1 && !items[0].tpl.forceGroup) {
      const { tpl, i } = items[0];
      const opt = modal.ownerDocument.createElement("option");
      opt.textContent = tpl.name; opt.value = String(i);
      tplSel.appendChild(opt);
    } else {
      const grp = modal.ownerDocument.createElement("optgroup");
      grp.label = cat;
      items.forEach(({ tpl, i }) => {
        const opt = modal.ownerDocument.createElement("option");
        opt.textContent = tpl.name; opt.value = String(i);
        grp.appendChild(opt);
      });
      tplSel.appendChild(grp);
    }
  });
  tplRow.appendChild(tplSel);

  const tplApplyBtn = modal.ownerDocument.createElement("button");
  tplApplyBtn.textContent = "Применить";
  tplApplyBtn.style.cssText = `flex: 0 0 auto; height: 36px; padding: 0 16px; background: var(--interactive-accent);
  color: var(--text-on-accent); border: none; border-radius: 6px; font-size: 13px;
  font-weight: 600; cursor: pointer; opacity: 0.5; transition: opacity 0.2s; white-space: nowrap;`;
  tplApplyBtn.disabled = true;
  tplRow.appendChild(tplApplyBtn);
  volSec.appendChild(tplRow);

  tplSel.onchange = () => {
    const hasVal = tplSel.value !== "";
    tplApplyBtn.disabled = !hasVal;
    tplApplyBtn.style.opacity = hasVal ? "1" : "0.5";
  };

  tplApplyBtn.onclick = () => {
    const idx = Number(tplSel.value);
    if (isNaN(idx) || !TEMPLATES[idx]) return;
    const tpl = TEMPLATES[idx];

    // ── ШАГ 1: СИНХРОННО — пока cur ещё валиден ──────────────────────────
    // ls уже содержит актуальные значения полей (все save-хендлеры пишут туда).
    // Для полей, которые пользователь не трогал (нет в ls), берём из cur.
    const SNAP_KEYS = [
      "ФИО", "Дата_рождения", "МКБ 10", "Диагноз", "Дополнительная_информация",
      "СНИЛС", "Номер_телефона", "Группа ВМП", "Дата_консультации", "Дата_разметки", "Переразметки", "Дата_начала_лечения", "Открытый_ЭЛН", "Открытый_ЭЛН_активен",
      "Больничный_лист", "Диспансерный_учет", "Свойства_заполнены",
      "Разметка", "Оконтуривание", "Госпитализация"
    ];
    SNAP_KEYS.forEach(k => { if (!ls.hasOwnProperty(k)) ls[k] = getStoredVal(k); });

    const templateSpec = _pfDesktopCore.getTreatmentTemplatePatch(tpl, {
      currentTags: getStoredVal("tags"),
      treatmentStart: getStoredVal("Дата_начала_лечения") ?? null
    });

    // Записываем данные шаблона в ls
    Object.assign(ls, templateSpec.localStatePatch);

    // ── ШАГ 2: СИНХРОННО — перестраиваем форму ДО любого await ──────────
    // cur ещё валиден, ls заполнен — форма покажет правильные данные
    buildForm();

    // ── ШАГ 3: ФОНОМ — сохраняем в файл (fire and forget) ──────────────?
    // Не await! Иначе Dataview перерисует блок и cur в старом closure протухнет.
    _npProcessFrontMatter((fm) => {
      const fileSpec = _pfDesktopCore.getTreatmentTemplatePatch(tpl, {
        currentTags: fm.tags,
        treatmentStart: fm.Дата_начала_лечения ?? null
      });
      Object.assign(fm, fileSpec.patch);
      fileSpec.deleteKeys.forEach(key => { delete fm[key]; });
    });

    _pfDesktopPlatform.notice(`✅ Шаблон «${tpl.name}» применён`);
  };

  const ptv1Frac = getVal("Количество_фракций");
  const ptv1Mode = getVal("Фракционирование") || "Стандартный";

  // Инициализируем ls._volumes: если шаблон уже записал данные — используем их, иначе читаем из актуального frontmatter
  if (!ls.hasOwnProperty("_volumes")) {
    ls._volumes = (Array.isArray(getStoredVal("Объёмы")) ? getStoredVal("Объёмы") : [])
      .filter(v => v && typeof v === "object")
      .map(v => Object.assign({}, v));
  }
  const validVolumes = ls._volumes;

  const volGroups = buildTreatmentVolumeGroups(validVolumes, normalizeConn);
  const defaultPtvName = (n) => getTreatmentVolumeDefaultName(volGroups.length, n);

  const volListEl = modal.ownerDocument.createElement("div");

  const mkVolField = (parent, labelText, inputType, initValue, opts, onSave, disabled = false) => {
    const col = modal.ownerDocument.createElement("div");
    col.className = `${msc}-inline-field`;
    const lbl = modal.ownerDocument.createElement("label");
    lbl.textContent = labelText; lbl.className = `${msc}-inline-label`;
    col.appendChild(lbl);
    let el;
    if (inputType === "select") {
      el = modal.ownerDocument.createElement("select");
      el.className = `${msc}-inline-select`;
      (opts || []).forEach(o => {
        const opt = modal.ownerDocument.createElement("option");
        opt.textContent = o; opt.value = o;
        if ((initValue ?? "") === o) opt.selected = true;
        el.appendChild(opt);
      });
      el.onchange = async () => await onSave(el.value);
    } else {
      el = modal.ownerDocument.createElement("input");
      el.type = inputType; el.className = `${msc}-inline-input`;
      if (inputType === "number") { el.step = "any"; el.min = "0"; }
      el.value = (initValue != null && initValue !== "") ? initValue.toString() : "";
      el.onchange = async () => {
        const v = el.value.trim();
        await onSave(inputType === "number" ? (v ? Number(v) : null) : (v || null));
      };
    }
    if (disabled) {
      el.disabled = true;
      el.style.opacity = "0.45";
      el.style.cursor = "not-allowed";
      col.title = "Автоматически синхронизируется с PTV1 (SIB)";
    }
    col.appendChild(el);
    parent.appendChild(col);
    return el;
  };

  const renderBoostCard = (containerEl, boostVol, boostIdx) => {
    const conn = normalizeConn(boostVol.Связь || "");
    const isSIB = conn === "Одновременно";
    const boostColor = CONN_COLORS[conn] || "#2196f3";

    const card = modal.ownerDocument.createElement("div");
    card.className = `${msc}-vol-card`;
    card.style.cssText = `margin-left: 18px; border-left: 3px solid ${boostColor};`;

    const headRow = modal.ownerDocument.createElement("div");
    headRow.className = `${msc}-vol-header`;

    const nameIn = modal.ownerDocument.createElement("input");
    nameIn.className = `${msc}-ptv-name-input`;
    nameIn.placeholder = isSIB ? "SIB" : "Буст";
    nameIn.style.cssText = `flex: 1 1 80px; color: ${boostColor}; border-bottom-color: ${boostColor}80;`;
    nameIn.value = (boostVol.Название != null && boostVol.Название !== "") ? boostVol.Название.toString() : "";
    nameIn.title = "Название объёма (нажмите, чтобы изменить)";
    nameIn.onchange = () => {
      const v = nameIn.value.trim() || null;
      boostVol.Название = v; setPending("Объёмы", ls._volumes.slice());
    };
    headRow.appendChild(nameIn);

    const boostBadge = modal.ownerDocument.createElement("div");
    if (isSIB) {
      boostBadge.style.cssText = "display: flex; align-items: center; gap: 5px; font-size: 0.78em; color: #4caf50; white-space: nowrap;";
      boostBadge.textContent = "SIB";
    } else {
      boostBadge.style.cssText = "display: flex; align-items: center; gap: 5px; font-size: 0.78em; color: #9c27b0; white-space: nowrap;";
      boostBadge.textContent = "Буст";
    }
    headRow.appendChild(boostBadge);

    const delBtn = modal.ownerDocument.createElement("button");
    delBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
    delBtn.style.cssText = `background: transparent; border: 1px solid var(--background-modifier-border); color: var(--text-muted); border-radius: 6px; cursor: pointer; padding: 4px 8px; font-size: 12px; display: flex; align-items: center; gap: 4px; transition: all 0.15s; flex-shrink: 0; height: 28px; margin-left: auto;`;
    delBtn.onmouseenter = () => { delBtn.style.color = "#e53935"; delBtn.style.borderColor = "#e53935"; delBtn.style.background = "rgba(229,57,53,0.08)"; };
    delBtn.onmouseleave = () => { delBtn.style.color = "var(--text-muted)"; delBtn.style.borderColor = "var(--background-modifier-border)"; delBtn.style.background = "transparent"; };
    delBtn.onclick = () => {
      card.style.transition = "opacity 0.15s, max-height 0.2s, margin 0.2s";
      card.style.opacity = "0"; card.style.maxHeight = "0"; card.style.margin = "0"; card.style.padding = "0"; card.style.overflow = "hidden";
      setTimeout(() => card.remove(), 200);
      ls._volumes = _pfDesktopCore.removeExtraVolume(ls._volumes, boostVol);
      setPending("Объёмы", ls._volumes);
    };
    headRow.appendChild(delBtn);
    card.appendChild(headRow);

    if (isSIB) {
      const sibBadge = modal.ownerDocument.createElement("div");
      sibBadge.style.cssText = "display: flex; align-items: center; gap: 6px; padding: 6px 10px; background: rgba(76,175,80,0.08); border-radius: 6px; font-size: 0.82em; color: #4caf50; margin-bottom: 8px;";
      sibBadge.textContent = "Синхронный интегрированный буст (SIB)";
      card.appendChild(sibBadge);
    } else {
      const seqBadge = modal.ownerDocument.createElement("div");
      seqBadge.style.cssText = "display: flex; align-items: center; gap: 6px; padding: 6px 10px; background: rgba(156,39,176,0.08); border-radius: 6px; font-size: 0.82em; color: #9c27b0; margin-bottom: 8px;";
      seqBadge.textContent = "Последовательный буст";
      card.appendChild(seqBadge);
    }

    const areaFieldRow = modal.ownerDocument.createElement("div");
    areaFieldRow.style.cssText = "display: flex; flex-direction: column; gap: 4px; margin-bottom: 8px;";
    const areaLbl = modal.ownerDocument.createElement("label");
    areaLbl.textContent = "Область облучения"; areaLbl.className = `${msc}-inline-label`;
    const areaIn = modal.ownerDocument.createElement("input");
    areaIn.type = "text"; areaIn.className = `${msc}-inline-input`;
    areaIn.value = (boostVol.Область_облучения != null) ? boostVol.Область_облучения.toString() : "";
    areaIn.onfocus = () => { setAcInput(areaIn); setAcList(SUGGEST["Область_облучения"] ?? []); renderAC(areaIn.value); };
    areaIn.oninput = () => { setAcList(SUGGEST["Область_облучения"] ?? []); renderAC(areaIn.value); };
    areaIn.onblur = () => setTimeout(() => { if (document.activeElement !== _npAcEl) _npAcEl.style.display = "none"; }, 200);
    areaIn.onchange = () => { boostVol.Область_облучения = areaIn.value.trim() || null; setPending("Объёмы", ls._volumes.slice()); };
    areaFieldRow.appendChild(areaLbl); areaFieldRow.appendChild(areaIn);
    card.appendChild(areaFieldRow);

    const doseRow = modal.ownerDocument.createElement("div");
    doseRow.className = `${msc}-vol-dose-row`;
    if (!isSIB) {
      mkVolField(doseRow, "РОД (Гр)", "number", boostVol.РОД, null, v => { boostVol.РОД = v; setPending("Объёмы", ls._volumes.slice()); });
      mkVolField(doseRow, "Фракции", "number", boostVol.Количество_фракций, null, v => { boostVol.Количество_фракций = v; setPending("Объёмы", ls._volumes.slice()); });
      mkVolField(doseRow, "Режим", "select", boostVol.Фракционирование || "Стандартный", FRAKTS_LIST, v => { boostVol.Фракционирование = v; setPending("Объёмы", ls._volumes.slice()); });
      mkVolField(doseRow, "Ускоритель", "select", resolveAccelerator(boostVol.Ускоритель, {
        fractionation: boostVol.Фракционирование,
        mode: boostVol.Название
      }), acceleratorOptions, v => { boostVol.Ускоритель = v; setPending("Объёмы", ls._volumes.slice()); });
    } else {
      mkVolField(doseRow, "РОД (Гр) SIB", "number", boostVol.РОД, null, v => { boostVol.РОД = v; setPending("Объёмы", ls._volumes.slice()); });
      mkVolField(doseRow, "Фракции (авто)", "number", ptv1Frac, null, async () => { }, true);
      mkVolField(doseRow, "Режим (авто)", "select", ptv1Mode || "Стандартный", FRAKTS_LIST, async () => { }, true);
      mkVolField(doseRow, "Ускоритель", "select", resolveAccelerator(boostVol.Ускоритель, {
        fractionation: ptv1Mode,
        mode: boostVol.Название
      }), acceleratorOptions, v => { boostVol.Ускоритель = v; setPending("Объёмы", ls._volumes.slice()); });
    }
    card.appendChild(doseRow);
    containerEl.appendChild(card);
  };

  const renderAddBoostBtns = (cardEl, insertAtFn) => {
    const row = modal.ownerDocument.createElement("div");
    row.style.cssText = "display: flex; gap: 6px; margin-top: 10px; padding-top: 8px; border-top: 1px solid var(--background-modifier-border);";
    const makeBoostBtn = (label, color, connType, defaultName) => {
      const btn = modal.ownerDocument.createElement("button");
      btn.style.cssText = `flex: 1; padding: 7px 10px; background: var(--background-primary); border: 1px solid var(--background-modifier-border); border-radius: 6px; color: ${color}; cursor: pointer; font-size: 12px; font-weight: 600; transition: all 0.2s; text-align: center;`;
      btn.textContent = label;
      btn.onmouseenter = () => { btn.style.background = `${color}0f`; btn.style.borderColor = `${color}88`; btn.style.boxShadow = `0 0 0 3px ${color}12`; };
      btn.onmouseleave = () => { btn.style.background = "var(--background-primary)"; btn.style.borderColor = "var(--background-modifier-border)"; btn.style.boxShadow = "none"; };
      btn.onclick = () => {
        const insertAt = insertAtFn();
        const newBoost = _pfDesktopCore.createExtraVolume({ name: defaultName, connection: connType });
        ls._volumes = _pfDesktopCore.insertExtraVolumeAt(ls._volumes, insertAt, newBoost);
        setPending("Объёмы", ls._volumes);
        renderBoostCard(volListEl, newBoost, insertAt);
        const fullCard = volListEl.lastChild;
        fullCard.style.opacity = "0";
        fullCard.style.transition = "opacity 0.2s";
        const ref = cardEl.nextSibling === fullCard ? fullCard.nextSibling : cardEl.nextSibling;
        cardEl.parentNode.insertBefore(fullCard, ref);
        requestAnimationFrame(() => { fullCard.style.opacity = "1"; });
      };
      row.appendChild(btn);
    };
    makeBoostBtn("+ Буст", "#9c27b0", "Последовательный буст", "PTV Boost");
    makeBoostBtn("+ SIB", "#4caf50", "Одновременно", "PTV SIB");
    cardEl.appendChild(row);
  };

  // ── PTV1 карточка ──────────────────────────────────────────────────────────
  const card1 = modal.ownerDocument.createElement("div");
  card1.className = `${msc}-vol-card`;
  card1.style.borderLeft = "4px solid var(--interactive-accent)";

  const head1 = modal.ownerDocument.createElement("div");
  head1.className = `${msc}-vol-header`;
  head1.style.marginBottom = "12px";

  const nameIn1 = modal.ownerDocument.createElement("input");
  nameIn1.className = `${msc}-ptv-name-input`;
  nameIn1.placeholder = defaultPtvName(1);
  nameIn1.value = (getVal("Название_PTV") != null && getVal("Название_PTV") !== "") ? getVal("Название_PTV").toString() : "";
  nameIn1.style.flex = "1 1 100px";
  nameIn1.title = "Название объёма (нажмите, чтобы изменить)";
  nameIn1.onchange = () => { const v = nameIn1.value.trim() || null; setPending("Название_PTV", v); };
  head1.appendChild(nameIn1);

  const primaryBadge = modal.ownerDocument.createElement("span");
  primaryBadge.textContent = "Основной";
  primaryBadge.style.cssText = "font-size: 0.72em; color: var(--text-muted); background: var(--background-modifier-border); padding: 2px 8px; border-radius: 10px; white-space: nowrap; flex-shrink: 0;";
  head1.appendChild(primaryBadge);
  card1.appendChild(head1);

  const area1Row = modal.ownerDocument.createElement("div");
  area1Row.style.cssText = "display: flex; flex-direction: column; gap: 4px; margin-bottom: 8px;";
  const area1Lbl = modal.ownerDocument.createElement("label");
  area1Lbl.textContent = "Область облучения"; area1Lbl.className = `${msc}-inline-label`;
  const areaIn1 = modal.ownerDocument.createElement("input");
  areaIn1.type = "text"; areaIn1.className = `${msc}-inline-input`;
  areaIn1.value = (getVal("Область_облучения") != null) ? getVal("Область_облучения").toString() : "";
  areaIn1.onfocus = () => { setAcInput(areaIn1); setAcList(SUGGEST["Область_облучения"] ?? []); renderAC(areaIn1.value); };
  areaIn1.oninput = () => { setAcList(SUGGEST["Область_облучения"] ?? []); renderAC(areaIn1.value); };
  areaIn1.onblur = () => setTimeout(() => { if (document.activeElement !== _npAcEl) _npAcEl.style.display = "none"; }, 200);
  areaIn1.onchange = () => { setPending("Область_облучения", areaIn1.value.trim() || null); };
  area1Row.appendChild(area1Lbl); area1Row.appendChild(areaIn1);
  card1.appendChild(area1Row);

  const dose1Row = modal.ownerDocument.createElement("div");
  dose1Row.className = `${msc}-vol-dose-row`;
  mkVolField(dose1Row, "РОД (Гр)", "number", getVal("РОД"), null, v => { setPending("РОД", v); });
  mkVolField(dose1Row, "Фракции", "number", getVal("Количество_фракций"), null, v => { setPending("Количество_фракций", v); });
  mkVolField(dose1Row, "Режим", "select", getVal("Фракционирование") || "Стандартный", FRAKTS_LIST, v => { setPending("Фракционирование", v); });
  mkVolField(dose1Row, "Ускоритель", "select", resolveAccelerator(getVal("Ускоритель"), {
    fractionation: getVal("Фракционирование"),
    mode: getVal("Название_PTV")
  }), acceleratorOptions, v => { setPending("Ускоритель", v); });
  card1.appendChild(dose1Row);

  renderAddBoostBtns(card1, () => {
    const b = volGroups[0].boosts;
    if (b.length > 0) return b[b.length - 1].idx + 1;
    if (volGroups.length > 1) return volGroups[1].largeIdx;
    return validVolumes.length;
  });
  volListEl.appendChild(card1);
  volGroups[0].boosts.forEach(({ vol: bv, idx: bi }) => renderBoostCard(volListEl, bv, bi));

  // ── Дополнительные большие объёмы ─────────────────────────────────────────
  volGroups.slice(1).forEach((group, gIdx) => {
    const vol = group.largeVol;
    const conn = group.conn;
    const borderColor = CONN_COLORS[conn] || "#ff9800";
    const volNum = gIdx + 2;

    const card = modal.ownerDocument.createElement("div");
    card.className = `${msc}-vol-card`;
    card.style.borderLeft = `4px solid ${borderColor}`;

    const headRow = modal.ownerDocument.createElement("div");
    headRow.className = `${msc}-vol-header`;

    const nameIn = modal.ownerDocument.createElement("input");
    nameIn.className = `${msc}-ptv-name-input`;
    nameIn.placeholder = defaultPtvName(volNum);
    nameIn.value = (vol.Название != null && vol.Название !== "") ? vol.Название.toString() : "";
    nameIn.style.cssText = `flex: 1 1 80px; color: ${borderColor}; border-bottom-color: ${borderColor}80;`;
    nameIn.title = "Название объёма";
    nameIn.onchange = () => { vol.Название = nameIn.value.trim() || null; setPending("Объёмы", ls._volumes.slice()); };
    headRow.appendChild(nameIn);

    const connSel = modal.ownerDocument.createElement("select");
    connSel.className = `${msc}-inline-select`;
    connSel.style.cssText += " flex: 1 1 120px; min-width: 0; height: 32px; min-height: 32px; font-size: 13px;";
    LARGE_CONN_LIST.forEach(c => {
      const opt = modal.ownerDocument.createElement("option");
      opt.textContent = LARGE_CONN_LABELS[c] || c; opt.value = c;
      if (conn === c) opt.selected = true;
      connSel.appendChild(opt);
    });
    connSel.onchange = () => { vol.Связь = connSel.value; setPending("Объёмы", ls._volumes.slice()); };
    headRow.appendChild(connSel);

    const delBtn = modal.ownerDocument.createElement("button");
    delBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> Удалить`;
    delBtn.style.cssText = `background: transparent; border: 1px solid var(--background-modifier-border); color: var(--text-muted); border-radius: 6px; cursor: pointer; padding: 4px 10px; font-size: 12px; display: flex; align-items: center; gap: 4px; transition: all 0.15s; flex-shrink: 0; height: 32px; margin-left: auto;`;
    delBtn.onmouseenter = () => { delBtn.style.color = "#e53935"; delBtn.style.borderColor = "#e53935"; delBtn.style.background = "rgba(229,57,53,0.08)"; };
    delBtn.onmouseleave = () => { delBtn.style.color = "var(--text-muted)"; delBtn.style.borderColor = "var(--background-modifier-border)"; delBtn.style.background = "transparent"; };
    delBtn.onclick = () => {
      card.style.transition = "opacity 0.15s, max-height 0.2s, margin 0.2s";
      card.style.opacity = "0"; card.style.maxHeight = "0"; card.style.margin = "0"; card.style.padding = "0"; card.style.overflow = "hidden";
      setTimeout(() => card.remove(), 200);
      ls._volumes = _pfDesktopCore.removeExtraVolume(ls._volumes, vol);
      setPending("Объёмы", ls._volumes);
    };
    headRow.appendChild(delBtn);
    card.appendChild(headRow);

    const areaFieldRow = modal.ownerDocument.createElement("div");
    areaFieldRow.style.cssText = "display: flex; flex-direction: column; gap: 4px; margin-bottom: 8px;";
    const areaLbl2 = modal.ownerDocument.createElement("label");
    areaLbl2.textContent = "Область облучения"; areaLbl2.className = `${msc}-inline-label`;
    const areaIn2 = modal.ownerDocument.createElement("input");
    areaIn2.type = "text"; areaIn2.className = `${msc}-inline-input`;
    areaIn2.value = (vol.Область_облучения != null) ? vol.Область_облучения.toString() : "";
    areaIn2.onfocus = () => { setAcInput(areaIn2); setAcList(SUGGEST["Область_облучения"] ?? []); renderAC(areaIn2.value); };
    areaIn2.oninput = () => { setAcList(SUGGEST["Область_облучения"] ?? []); renderAC(areaIn2.value); };
    areaIn2.onblur = () => setTimeout(() => { if (document.activeElement !== _npAcEl) _npAcEl.style.display = "none"; }, 200);
    areaIn2.onchange = () => { vol.Область_облучения = areaIn2.value.trim() || null; setPending("Объёмы", ls._volumes.slice()); };
    areaFieldRow.appendChild(areaLbl2); areaFieldRow.appendChild(areaIn2);
    card.appendChild(areaFieldRow);

    const doseRow2 = modal.ownerDocument.createElement("div");
    doseRow2.className = `${msc}-vol-dose-row`;
    mkVolField(doseRow2, "РОД (Гр)", "number", vol.РОД, null, v => { vol.РОД = v; setPending("Объёмы", ls._volumes.slice()); });
    mkVolField(doseRow2, "Фракции", "number", vol.Количество_фракций, null, v => { vol.Количество_фракций = v; setPending("Объёмы", ls._volumes.slice()); });
    mkVolField(doseRow2, "Режим", "select", vol.Фракционирование || "Стандартный", FRAKTS_LIST, v => { vol.Фракционирование = v; setPending("Объёмы", ls._volumes.slice()); });
    mkVolField(doseRow2, "Ускоритель", "select", resolveAccelerator(vol.Ускоритель, {
      fractionation: vol.Фракционирование,
      mode: vol.Название
    }), acceleratorOptions, v => { vol.Ускоритель = v; setPending("Объёмы", ls._volumes.slice()); });
    card.appendChild(doseRow2);

    renderAddBoostBtns(card, () => {
      const gb = group.boosts;
      if (gb.length > 0) return gb[gb.length - 1].idx + 1;
      const nextGroup = volGroups[gIdx + 2];
      if (nextGroup) return nextGroup.largeIdx;
      return validVolumes.length;
    });
    volListEl.appendChild(card);
    group.boosts.forEach(({ vol: bv, idx: bi }) => renderBoostCard(volListEl, bv, bi));
  });

  volSec.appendChild(volListEl);

  // Кнопка "+ Добавить объём"
  const addVolBtn = modal.ownerDocument.createElement("button");
  addVolBtn.className = `${msc}-add-vol-btn`;
  let _volBtnNum = volGroups.length + 1;
  addVolBtn.textContent = `+ Добавить объём (PTV${_volBtnNum})`;
  addVolBtn.onclick = () => {
    const newVol = _pfDesktopCore.createExtraVolume();
    ls._volumes = _pfDesktopCore.appendExtraVolume(ls._volumes, newVol);
    setPending("Объёмы", ls._volumes);

    const newCard = modal.ownerDocument.createElement("div");
    newCard.className = `${msc}-vol-card`;
    newCard.style.cssText = "border-left: 4px solid #ff9800; opacity: 0; transition: opacity 0.2s;";
    const newHead = modal.ownerDocument.createElement("div");
    newHead.className = `${msc}-vol-header`;

    const newNameIn = modal.ownerDocument.createElement("input");
    newNameIn.className = `${msc}-ptv-name-input`;
    newNameIn.placeholder = `PTV${_volBtnNum}`;
    newNameIn.style.cssText = "flex: 1 1 80px; color: #ff9800; border-bottom-color: #ff980080;";
    newNameIn.onchange = () => { newVol.Название = newNameIn.value.trim() || null; setPending("Объёмы", ls._volumes.slice()); };
    newHead.appendChild(newNameIn);

    const newConnSel = modal.ownerDocument.createElement("select");
    newConnSel.className = `${msc}-inline-select`;
    newConnSel.style.cssText += " flex: 1 1 120px; min-width: 0; height: 32px; min-height: 32px; font-size: 13px;";
    LARGE_CONN_LIST.forEach(c => {
      const o = modal.ownerDocument.createElement("option");
      o.textContent = LARGE_CONN_LABELS[c] || c; o.value = c;
      if (c === "Параллельно") o.selected = true;
      newConnSel.appendChild(o);
    });
    newConnSel.onchange = () => { newVol.Связь = newConnSel.value; setPending("Объёмы", ls._volumes.slice()); };
    newHead.appendChild(newConnSel);

    const newDelBtn = modal.ownerDocument.createElement("button");
    newDelBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> Удалить`;
    newDelBtn.style.cssText = "background:transparent;border:1px solid var(--background-modifier-border);color:var(--text-muted);border-radius:6px;cursor:pointer;padding:4px 10px;font-size:12px;display:flex;align-items:center;gap:4px;transition:all 0.15s;flex-shrink:0;height:32px;margin-left:auto;";
    newDelBtn.onmouseenter = () => { newDelBtn.style.color = "#e53935"; newDelBtn.style.borderColor = "#e53935"; newDelBtn.style.background = "rgba(229,57,53,0.08)"; };
    newDelBtn.onmouseleave = () => { newDelBtn.style.color = "var(--text-muted)"; newDelBtn.style.borderColor = "var(--background-modifier-border)"; newDelBtn.style.background = "transparent"; };
    newDelBtn.onclick = () => {
      newCard.style.transition = "opacity 0.15s, max-height 0.2s, margin 0.2s";
      newCard.style.opacity = "0"; newCard.style.maxHeight = "0"; newCard.style.margin = "0"; newCard.style.overflow = "hidden";
      setTimeout(() => newCard.remove(), 200);
      ls._volumes = _pfDesktopCore.removeExtraVolume(ls._volumes, newVol);
      setPending("Объёмы", ls._volumes);
    };
    newHead.appendChild(newDelBtn);
    newCard.appendChild(newHead);

    const newAreaRow = modal.ownerDocument.createElement("div");
    newAreaRow.style.cssText = "display: flex; flex-direction: column; gap: 4px; margin-bottom: 8px;";
    const newAreaLbl = modal.ownerDocument.createElement("label");
    newAreaLbl.textContent = "Область облучения"; newAreaLbl.className = `${msc}-inline-label`;
    const newAreaIn = modal.ownerDocument.createElement("input");
    newAreaIn.type = "text"; newAreaIn.className = `${msc}-inline-input`;
    newAreaIn.onfocus = () => { setAcInput(newAreaIn); setAcList(SUGGEST["Область_облучения"] ?? []); renderAC(newAreaIn.value); };
    newAreaIn.oninput = () => { setAcList(SUGGEST["Область_облучения"] ?? []); renderAC(newAreaIn.value); };
    newAreaIn.onblur = () => setTimeout(() => { if (document.activeElement !== _npAcEl) _npAcEl.style.display = "none"; }, 200);
    newAreaIn.onchange = () => { newVol.Область_облучения = newAreaIn.value.trim() || null; setPending("Объёмы", ls._volumes.slice()); };
    newAreaRow.appendChild(newAreaLbl); newAreaRow.appendChild(newAreaIn);
    newCard.appendChild(newAreaRow);

    const newDoseRow = modal.ownerDocument.createElement("div");
    newDoseRow.className = `${msc}-vol-dose-row`;
    mkVolField(newDoseRow, "РОД (Гр)", "number", null, null, v => { newVol.РОД = v; setPending("Объёмы", ls._volumes.slice()); });
    mkVolField(newDoseRow, "Фракции", "number", null, null, v => { newVol.Количество_фракций = v; setPending("Объёмы", ls._volumes.slice()); });
    mkVolField(newDoseRow, "Режим", "select", "Стандартное", FRAKTS_LIST, v => { newVol.Фракционирование = v; setPending("Объёмы", ls._volumes.slice()); });
    mkVolField(newDoseRow, "Ускоритель", "select", resolveAccelerator(newVol.Ускоритель, {
      fractionation: newVol.Фракционирование,
      mode: newVol.Название
    }), acceleratorOptions, v => { newVol.Ускоритель = v; setPending("Объёмы", ls._volumes.slice()); });
    newCard.appendChild(newDoseRow);

    renderAddBoostBtns(newCard, () => {
      const ri = ls._volumes.indexOf(newVol);
      return ri !== -1 ? ri + 1 : ls._volumes.length;
    });

    volListEl.appendChild(newCard);
    requestAnimationFrame(() => { newCard.style.opacity = "1"; });
    _volBtnNum++;
    addVolBtn.textContent = `+ Добавить объём (PTV${_volBtnNum})`;
  };
  volSec.appendChild(addVolBtn);

  return volSec;
};

module.exports = {
  LARGE_CONN_LIST,
  BOOST_CONN_LIST,
  CONN_COLORS,
  LARGE_CONN_LABELS,
  FRAKTS_LIST,
  buildTreatmentVolumeGroups,
  getTreatmentVolumeDefaultName,
  mountDesktopTreatmentVolumesSection
};
