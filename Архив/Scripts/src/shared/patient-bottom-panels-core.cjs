"use strict";

const buildDispanseryReminders = (endDate, scheduleCore, dv = globalThis.dv) => {
  if (!endDate || !scheduleCore?.nextWorkDay) return [];
  const intervals = [
    { months: 3, label: "3 мес." },
    { months: 6, label: "6 мес." },
    { months: 12, label: "1 год" },
    { months: 18, label: "1,5 года" },
    { months: 24, label: "2 года" },
    { months: 30, label: "2,5 года" },
    { months: 36, label: "3 года" },
    { months: 42, label: "3,5 года" },
    { months: 48, label: "4 года" },
    { months: 54, label: "4,5 года" },
    { months: 60, label: "5 лет" }
  ];

  return intervals.map(({ months, label }) => {
    const rawDate = endDate.plus({ months }).plus({ days: 14 });
    const finalDate = scheduleCore.nextWorkDay(rawDate.toISODate ? rawDate.toISODate() : rawDate, []);
    const dateIso = finalDate || (rawDate.toISODate ? rawDate.toISODate() : String(rawDate).slice(0, 10));
    return {
      дата: dateIso,
      текст: `Диспансерный осмотр (${label})`,
      выполнено: false
    };
  });
};

const mountPatientBottomPanels = (ctx = {}) => {
  const runtimeWindow = ctx.window || globalThis.window;
  const runtimeDocument = ctx.document || globalThis.document;
  const dv = ctx.dv || globalThis.dv;
  const card = ctx.card;
  const cur = ctx.cur || {};
  const file = ctx.file || cur.file || {};
  const today = ctx.today;
  const holidays = ctx.holidays instanceof Set ? ctx.holidays : new Set();
  const patchCurrentFrontmatter = ctx.patchCurrentFrontmatter;
  const makeDatePicker = ctx.makeDatePicker;
  const getElnBaseStart = ctx.getElnBaseStart;
  const notice = typeof ctx.notice === "function" ? ctx.notice : (message) => console.log(message);
  const reminderCore = ctx.reminderCore;
  const scheduleCore = ctx.scheduleCore;
  const P = ctx.P || "14px";
  const presc = ctx.presc || {};
  const treatment = ctx.treatment || {};

  if (!runtimeWindow) throw new Error("mountPatientBottomPanels: window is required");
  if (!runtimeDocument) throw new Error("mountPatientBottomPanels: document is required");
  if (!dv) throw new Error("mountPatientBottomPanels: dv is required");
  if (!card) throw new Error("mountPatientBottomPanels: card is required");
  if (!today) throw new Error("mountPatientBottomPanels: today is required");
  if (typeof patchCurrentFrontmatter !== "function") throw new Error("mountPatientBottomPanels: patchCurrentFrontmatter is required");
  if (typeof makeDatePicker !== "function") throw new Error("mountPatientBottomPanels: makeDatePicker is required");
  if (typeof getElnBaseStart !== "function") throw new Error("mountPatientBottomPanels: getElnBaseStart is required");
  if (!reminderCore?.mountPatientReminderPanels) throw new Error("mountPatientBottomPanels: reminderCore is required");
  if (!scheduleCore?.buildSchedule) throw new Error("mountPatientBottomPanels: scheduleCore is required");

  const {
    fio = "",
    age = "",
    dobStr = "—",
    diag = "",
    thirdLine = "",
    hltLine = "",
    doseOutput = [],
    lineItems = [],
    startStr = "—",
    statusLine = "",
    fundingLine = "",
    copyText = "",
    highlight = false,
    hasSick = false
  } = presc;

  const {
    schedule1 = [],
    end1 = null,
    extraVolumes = [],
    manuals = [],
    skipsSet = new Set(),
    start1 = null,
    frac1 = 0,
    normalizeConn = scheduleCore.normalizeConn,
    normalizeLsAssignments = null,
    resolveHltIsoDates = null,
    normalizeHltIsoList = null,
    hltComputedDates = [],
    hltSkippedDates = new Set(),
    isHltBreakIso = null,
    hltBreakRanges = [],
    overallEnd = null
  } = treatment;

  const buildSchedule = (fracCount, startDate, modeStr, manualDates, skipDates) => scheduleCore.buildSchedule({
    fracCount,
    startDate,
    modeStr,
    manualDates,
    skipDates,
    holidays
  });

  const PRESC_KEY = `presc_open_${file.path || cur.file?.path || ""}`;
  if (!Object.prototype.hasOwnProperty.call(runtimeWindow, PRESC_KEY)) runtimeWindow[PRESC_KEY] = false;

  const bottomBar = card.createEl("div");
  bottomBar.className = "pf-bottom-tabs";
  bottomBar.dataset.hasEln = hasSick ? "1" : "0";
  bottomBar.style.cssText = "display:flex;align-items:center;justify-content:center;gap:6px;margin-top:14px;padding-top:10px;border-top:1px solid var(--background-modifier-border);position:relative;";

  const existingStyle = runtimeDocument.getElementById("pf-bottom-tabs-style");
  if (existingStyle) existingStyle.remove();
  const styleEl = runtimeDocument.createElement("style");
  styleEl.id = "pf-bottom-tabs-style";
  styleEl.textContent = `
    @media (max-width: 820px) {
      .pf-bottom-tabs {
        display: grid !important;
        align-items: stretch !important;
        justify-content: stretch !important;
        gap: 6px !important;
        padding-right: 0 !important;
      }
      .pf-bottom-tabs[data-has-eln="1"] { grid-template-columns: repeat(3, minmax(0, 1fr)); }
      .pf-bottom-tabs[data-has-eln="0"] { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .pf-bottom-tab-btn {
        width: 100% !important;
        min-width: 0 !important;
        justify-content: center !important;
        padding: 6px 8px !important;
        font-size: 11px !important;
        gap: 4px !important;
      }
      .pf-bottom-tab-btn svg { width: 12px !important; height: 12px !important; }
    }
  `;
  runtimeDocument.head.appendChild(styleEl);

  const prescPanel = card.createEl("div");
  prescPanel.style.cssText = `margin-top: 10px; padding: 14px 44px 14px 16px; background: var(--background-primary); border: 1px solid var(--background-modifier-border); border-radius: 7px; font-size: 0.9em; line-height: 1.6; display: ${runtimeWindow[PRESC_KEY] ? "block" : "none"}; position:relative;`;
  prescPanel.innerHTML = [
    `<div style="font-weight: 700; margin-bottom: 6px;">${fio}, ${age} лет, ${dobStr}</div>`,
    `<div style="margin-bottom: 6px;">${diag}</div>`,
    thirdLine ? `<div style="margin-bottom: 6px; font-weight: 500;">${thirdLine}</div>` : "",
    hltLine ? `<div style="margin-bottom: 6px; color: var(--text-muted);">${hltLine}</div>` : "",
    `<div style="margin-bottom: 6px;">${doseOutput.map(item => {
      if (item.type === "header") {
        return `<div style="font-size: 0.78em; font-weight: 700; text-transform: uppercase; color: ${item.color || "var(--text-accent)"}; margin-top: 6px; margin-bottom: 2px;">${item.text}:</div>`;
      }
      const isLast = lineItems.indexOf(item) === lineItems.length - 1;
      return `<div style="font-weight: 600;">${item.text}${isLast ? "." : ";"}</div>`;
    }).join("")}</div>`,
    `<div style="color: var(--text-muted);">Старт: ${startStr}</div>`,
    statusLine ? `<div style="color: var(--text-muted); font-style: italic;">${statusLine}</div>` : "",
    fundingLine ? `<div style="color: var(--text-muted); font-style: italic;">${fundingLine}</div>` : ""
  ].filter(Boolean).join("");

  const copyPrescBtn = prescPanel.createEl("button");
  copyPrescBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect width="8" height="4" x="8" y="2" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/></svg>`;
  copyPrescBtn.title = "Копировать предписание";
  copyPrescBtn.style.cssText = "position:absolute;top:8px;right:8px;background:transparent;border:none;color:var(--text-muted);cursor:pointer;padding:6px;border-radius:6px;transition:all 0.2s;display:flex;align-items:center;";
  copyPrescBtn.onmouseenter = () => { copyPrescBtn.style.color = "var(--text-normal)"; copyPrescBtn.style.background = "var(--background-modifier-hover)"; };
  copyPrescBtn.onmouseleave = () => { copyPrescBtn.style.color = "var(--text-muted)"; copyPrescBtn.style.background = "transparent"; };
  copyPrescBtn.onclick = () => runtimeWindow.navigator.clipboard.writeText(copyText).then(() => notice("📋 Предписание скопировано!"));

  const reminderUi = reminderCore.mountPatientReminderPanels({
    window: runtimeWindow,
    document: runtimeDocument,
    bottomBar,
    card,
    prescKey: PRESC_KEY,
    prescPanel,
    expandBtn: null,
    updateExpandBtn: null,
    hasSick,
    today,
    dv,
    holidays,
    cur,
    makeDatePicker,
    patchCurrentFrontmatter,
    getElnBaseStart,
    notice,
    P
  });

  const { remFracPanel, elnPanel } = reminderUi;
  const pnl = remFracPanel;

  const CHIP_BTN = "display:flex;align-items:center;justify-content:center;gap:5px;height:36px;padding:0 14px;border-radius:6px;border:none;font-size:13px;font-weight:600;cursor:pointer;font-family:var(--font-interface);transition:opacity 0.15s;white-space:nowrap;flex-shrink:0;";
  const ACT_BTN = "width:30px;height:30px;padding:0;display:flex;align-items:center;justify-content:center;background:transparent;border:1px solid var(--background-modifier-border);border-radius:6px;color:var(--text-muted);cursor:pointer;transition:all 0.15s;flex-shrink:0;";

  const remStyleId = "pf-rem-style";
  const remExistingStyle = runtimeDocument.getElementById(remStyleId);
  if (remExistingStyle) remExistingStyle.remove();
  const remStyle = runtimeDocument.createElement("style");
  remStyle.id = remStyleId;
  remStyle.textContent = `
    @media (max-width: 600px) {
      .pf-rem-row1 { flex-wrap: wrap !important; }
      .pf-rem-row1 > *:first-child { width: 100% !important; flex: none !important; min-width: 0 !important; }
      .pf-rem-row1 > button { flex: 1 1 0 !important; min-width: 0 !important; }
      .pf-rem-row2 { flex-wrap: wrap !important; }
      .pf-rem-row2 > input { width: 100% !important; flex: none !important; }
      .pf-rem-row2 > button { flex: 1 1 0 !important; min-width: 0 !important; }
    }
  `;
  runtimeDocument.head.appendChild(remStyle);

  const row1 = pnl.createEl("div");
  row1.className = "pf-rem-row1";
  row1.style.cssText = `display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:12px ${P} 8px;`;
  const sharedDatePicker = makeDatePicker(row1, today.toFormat("yyyy-MM-dd"), "width:150px;flex-shrink:0;");

  const skipBtn = row1.createEl("button");
  skipBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg> Пропуск`;
  skipBtn.style.cssText = CHIP_BTN + "background:#e53935;color:white;flex:1;";
  skipBtn.onmouseenter = () => skipBtn.style.opacity = "0.82";
  skipBtn.onmouseleave = () => skipBtn.style.opacity = "1";

  const fracBtn = row1.createEl("button");
  fracBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> Фракция`;
  fracBtn.style.cssText = CHIP_BTN + "background:#2e7d32;color:white;flex:1;";
  fracBtn.onmouseenter = () => fracBtn.style.opacity = "0.82";
  fracBtn.onmouseleave = () => fracBtn.style.opacity = "1";

  const row2 = pnl.createEl("div");
  row2.className = "pf-rem-row2";
  row2.style.cssText = `display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:0 ${P} 12px;`;

  const remTextInput = row2.createEl("input");
  remTextInput.type = "text";
  remTextInput.placeholder = "Текст напоминания…";
  remTextInput.style.cssText = "flex:1;min-width:0;height:36px;border-radius:6px;border:1px solid var(--background-modifier-border);background:var(--background-primary);color:var(--text-normal);padding:0 10px;font-size:13px;font-family:var(--font-interface);outline:none;transition:border-color 0.15s;";
  remTextInput.onfocus = () => remTextInput.style.borderColor = "var(--interactive-accent)";
  remTextInput.onblur = () => remTextInput.style.borderColor = "var(--background-modifier-border)";

  const remAddBtn = row2.createEl("button");
  remAddBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg> Напомнить`;
  remAddBtn.style.cssText = CHIP_BTN + "background:#1976d2;color:white;";
  remAddBtn.onmouseenter = () => remAddBtn.style.opacity = "0.82";
  remAddBtn.onmouseleave = () => remAddBtn.style.opacity = "1";

  const remListContainer = pnl.createEl("div");
  remListContainer.className = "pf-rem-list";
  remListContainer.style.cssText = `padding:0 ${P};`;

  const renderReminderCard = (reminder, insertBefore = null) => {
    const rDate = dv.date(reminder.дата);
    if (!rDate) return null;
    const isDone = reminder.выполнено === true;
    const isPast = rDate < today;
    const isToday = rDate.toISODate() === today.toISODate();
    let color = "#1976d2";
    if (isDone) color = "var(--text-muted)";
    else if (isPast) color = "#e53935";
    else if (isToday) color = "#f57c00";
    const card2 = runtimeDocument.createElement("div");
    card2.style.cssText = `display:flex;align-items:center;gap:10px;padding:7px 10px;margin-bottom:5px;background:var(--background-primary);border:1px solid var(--background-modifier-border);border-left:3px solid ${color};border-radius:7px;opacity:${isDone ? "0.45" : "1"};transition:all 0.18s;`;
    const infoDiv = runtimeDocument.createElement("div");
    infoDiv.style.cssText = "flex:1;min-width:0;";
    const dateClass = isDone ? "text-decoration:line-through;" : "";
    infoDiv.innerHTML = `<span style="font-size:0.75em;color:var(--text-muted);margin-right:6px;">${rDate.toFormat("dd.MM.yyyy")}</span><span style="font-size:0.9em;font-weight:500;color:var(--text-normal);${dateClass}">${reminder.текст}</span>`;
    card2.appendChild(infoDiv);
    const btnDiv = runtimeDocument.createElement("div");
    btnDiv.style.cssText = "display:flex;gap:5px;flex-shrink:0;";
    card2.appendChild(btnDiv);
    const searchDate = rDate.toISODate();
    const searchText = reminder.текст;
    if (!isDone) {
      const checkBtn = runtimeDocument.createElement("button");
      checkBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8"><polyline points="20 6 9 17 4 12"/></svg>`;
      checkBtn.style.cssText = ACT_BTN;
      checkBtn.onmouseenter = () => { checkBtn.style.color = "#4caf50"; checkBtn.style.borderColor = "#4caf50"; checkBtn.style.background = "rgba(76,175,80,0.08)"; };
      checkBtn.onmouseleave = () => { checkBtn.style.color = "var(--text-muted)"; checkBtn.style.borderColor = "var(--background-modifier-border)"; checkBtn.style.background = "transparent"; };
      checkBtn.onclick = () => {
        card2.style.opacity = "0.45";
        card2.style.borderLeftColor = "var(--text-muted)";
        infoDiv.querySelector("span:last-child").style.textDecoration = "line-through";
        checkBtn.remove();
        notice("✅ Выполнено");
        patchCurrentFrontmatter(fm => {
          if (!fm.Напоминания) return;
          const idx = fm.Напоминания.findIndex(r => {
            const fd = dv.date(r.дата);
            return fd && fd.toISODate() === searchDate && r.текст === searchText;
          });
          if (idx !== -1) fm.Напоминания[idx].выполнено = true;
        }, { reread: false });
      };
      btnDiv.appendChild(checkBtn);
    }
    const delBtn = runtimeDocument.createElement("button");
    delBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
    delBtn.style.cssText = ACT_BTN;
    delBtn.onmouseenter = () => { delBtn.style.color = "#e53935"; delBtn.style.borderColor = "#e53935"; delBtn.style.background = "rgba(229,57,53,0.08)"; };
    delBtn.onmouseleave = () => { delBtn.style.color = "var(--text-muted)"; delBtn.style.borderColor = "var(--background-modifier-border)"; delBtn.style.background = "transparent"; };
    delBtn.onclick = () => {
      card2.style.opacity = "0";
      card2.style.maxHeight = "0";
      card2.style.margin = "0";
      card2.style.padding = "0";
      setTimeout(() => card2.remove(), 180);
      notice("🗑️ Удалено");
      patchCurrentFrontmatter(fm => {
        if (!fm.Напоминания) return;
        const idx = fm.Напоминания.findIndex(r => {
          const fd = dv.date(r.дата);
          return fd && fd.toISODate() === searchDate && r.текст === searchText;
        });
        if (idx !== -1) fm.Напоминания.splice(idx, 1);
      }, { reread: false });
    };
    btnDiv.appendChild(delBtn);
    if (insertBefore) remListContainer.insertBefore(card2, insertBefore);
    else remListContainer.appendChild(card2);
    return card2;
  };

  remAddBtn.onclick = () => {
    const date = sharedDatePicker.value;
    const text = remTextInput.value.trim();
    if (!date || !text) {
      notice("❌ Заполните дату и текст!");
      return;
    }
    const newReminder = { дата: date, текст: text, выполнено: false };
    renderReminderCard(newReminder, remListContainer.firstChild);
    remTextInput.value = "";
    notice("✅ Напоминание добавлено!");
    patchCurrentFrontmatter(fm => {
      if (!fm.Напоминания) fm.Напоминания = [];
      fm.Напоминания.push(newReminder);
    }, { reread: false });
  };

  const openEnabled = cur?.Открытый_ЭЛН_активен === true;
  let elnPendingState = [];
  let renderElnList = () => {};
  const addVkReminderFromEln = (selectedDateStr) => {
    const baseStart = getElnBaseStart();
    if (!baseStart) {
      notice("⚠️ Нет даты открытия ЭЛН/госпитализации");
      return;
    }
    const draft = reminderCore.buildElnReminderDraft({
      selectedDateStr,
      today,
      baseStart,
      holidays,
      dv
    });
    if (!draft) {
      notice("❌ Некорректная дата");
      return;
    }
    const { targetDate, targetIso, newReminder } = draft;
    const result = reminderCore.upsertElnReminder({
      reminders: cur.Напоминания,
      targetIso,
      newReminder,
      dv
    });
    patchCurrentFrontmatter(fm => {
      fm.Напоминания = result.reminders;
    }, { reread: false }).then(() => {
      notice(`✅ Добавлено напоминание на ${targetDate.toFormat("dd.MM.yyyy")}`);
    }).catch(error => {
      notice(`❌ Ошибка: ${error?.message || error}`);
    });
  };

  if (openEnabled) {
    const elnRow = row2.createEl("div");
    elnRow.style.cssText = "display:flex;gap:8px;flex-wrap:wrap;width:100%;";
    const elnDateInput = makeDatePicker(elnRow, today.toFormat("yyyy-MM-dd"), "width:150px;flex-shrink:0;");
    const elnAddBtn = elnRow.createEl("button");
    elnAddBtn.textContent = "Напомнить ВК по ЭЛН";
    elnAddBtn.style.cssText = CHIP_BTN + "background:#e65100;color:white;";
    elnAddBtn.onclick = () => addVkReminderFromEln(elnDateInput.value);
    elnRow.appendChild(elnAddBtn);
  }

  const openSingleBottomPanel = (which) => {
    runtimeWindow[PRESC_KEY] = which === "presc";
    reminderUi.openBottomPanel(which === "rem" ? "rem" : which === "eln" ? "eln" : null);
  };

  const syncExtraRemPanel = () => {
    if (remFracPanel) {
      remFracPanel.style.display = runtimeWindow[`remfrac_open_${file.path || cur.file?.path || ""}`] ? "block" : "none";
    }
    if (elnPanel) {
      elnPanel.style.display = runtimeWindow[`eln_open_${file.path || cur.file?.path || ""}`] ? "block" : "none";
    }
  };

  const extraScheduleData = [];
  let prevEnd = end1;

  extraVolumes.forEach((vol, idx) => {
    const fracN = Number(vol.Количество_фракций);
    const modeN = (vol.Фракционирование ?? "Стандартный").toString().toLowerCase();
    const conn = normalizeConn(vol.Связь);
    const CONN_COLORS_B3 = { "Параллельно": "#ff9800", "Последовательно": "#ffc107", "Последовательный буст": "#9c27b0", "Одновременно": "#4caf50" };
    const color = CONN_COLORS_B3[conn] || ["#9c27b0", "#ff5722", "#00bcd4", "#8bc34a", "#e91e63"][idx % 5];
    const volName = vol.Название ? vol.Название.toString() : `PTV${idx + 2}`;

    if (!fracN || fracN <= 0) {
      extraScheduleData.push({ schedule: [], conn, color, name: volName });
      return;
    }

    let startN = null;
    if (conn === "Последовательный буст" || conn === "Последовательно") {
      if (prevEnd) {
        let d = prevEnd.plus({ days: 1 });
        let safety = 0;
        while (safety < 30) {
          if (d.weekday <= 5 && !holidays.has(d.toISODate())) {
            startN = d;
            break;
          }
          d = d.plus({ days: 1 });
          safety++;
        }
      }
    } else {
      startN = start1;
    }

    const schedule = startN ? buildSchedule(fracN, startN, modeN, manuals, skipsSet) : [];
    const endN = schedule.length ? schedule[schedule.length - 1] : null;
    if ((conn === "Последовательный буст" || conn === "Последовательно") && endN) prevEnd = endN;

    extraScheduleData.push({ schedule, conn, color, name: volName });
  });

  const dayInfoMap = new Map();
  const ensureDay = (iso) => {
    if (!dayInfoMap.has(iso)) {
      dayInfoMap.set(iso, {
        ptv1: false,
        extras: [],
        hlt: false,
        hltDrugs: [],
        reminders: [],
        consult: false,
        razmetka: false,
        remark: false,
        contourWin: false,
        recontourWin: false,
        planningWin: false,
        newPlanStart: false,
        newPlanningWin: false,
        meds: [],
        hltBreak: false,
        bloodControlNeeded: false,
        bloodControlDone: false
      });
    }
    return dayInfoMap.get(iso);
  };

  const toISO = (d) => (d && d.toISODate ? d.toISODate() : null);
  schedule1.forEach(d => { ensureDay(toISO(d)).ptv1 = true; });

  const calConsult = cur.Дата_консультации && typeof cur.Дата_консультации !== "boolean" ? dv.date(cur.Дата_консультации) : null;
  if (calConsult) {
    ensureDay(calConsult.startOf("day").toISODate()).consult = true;
  }

  extraScheduleData.forEach(({ schedule, conn, color, name }) => {
    schedule.forEach(d => {
      const info = ensureDay(toISO(d));
      if (!info.extras.some(e => e.color === color)) {
        info.extras.push({ color, conn, name });
      }
    });
  });

  const hltDrugsB3 = (() => {
    const raw = cur.ХЛТ_препараты;
    if (Array.isArray(raw) && raw.length > 0) return raw.filter(Boolean);
    if (cur.ХЛТ_режим) return [{ Препарат: cur.Радиомодификация || "", Режим: cur.ХЛТ_режим }];
    return [];
  })();

  const hltStartRaw = cur.ХЛТ_дата_старта ? dv.date(cur.ХЛТ_дата_старта) : start1;
  const allScheduleEnds = [end1, ...extraScheduleData.map(s => s.schedule.length ? s.schedule[s.schedule.length - 1] : null)].filter(Boolean);
  allScheduleEnds.sort((a, b) => a - b);
  const treatmentEndForHlt = allScheduleEnds.length ? allScheduleEnds[allScheduleEnds.length - 1] : null;

  const allRadDatesSet = new Set();
  schedule1.forEach(d => allRadDatesSet.add(d.toISODate()));
  extraScheduleData.forEach(s => s.schedule.forEach(d => allRadDatesSet.add(d.toISODate())));

  if (hltDrugsB3.length > 0 && hltStartRaw && treatmentEndForHlt && typeof resolveHltIsoDates === "function") {
    const markDrugDay = (isoStr, drugInfo) => {
      const dayData = ensureDay(isoStr);
      if (!Array.isArray(dayData.hltDrugs)) dayData.hltDrugs = [];
      if (!dayData.hltDrugs.some(d => d.препарат === drugInfo.препарат)) {
        dayData.hltDrugs.push(drugInfo);
      }
      dayData.hlt = true;
    };
    const markDatesForDrug = (drugInfo, isoDates) => {
      isoDates.forEach(iso => markDrugDay(iso, drugInfo));
    };

    hltDrugsB3.forEach(drug => {
      const r = (drug.Режим || "").toLowerCase();
      const drugInfo = { препарат: drug.Препарат || "", режим: drug.Режим || "" };
      const resolvedDates = resolveHltIsoDates(
        drug,
        hltStartRaw.startOf("day"),
        treatmentEndForHlt.startOf("day"),
        Array.from(allRadDatesSet)
      );
      const activeDates = resolvedDates.filter(iso => !hltSkippedDates.has(iso) && !(typeof isHltBreakIso === "function" && isHltBreakIso(iso)));
      if (r === "в дни лучевой терапии" || activeDates.length > 0) {
        markDatesForDrug(drugInfo, activeDates);
      }
    });
  }

  if (Array.isArray(hltBreakRanges)) {
    hltBreakRanges.forEach(r => {
      let _bc = dv.date(r.start), _end = dv.date(r.end), _bs = 0;
      while (_bc <= _end && _bs < 365) {
        ensureDay(_bc.toISODate()).hltBreak = true;
        _bc = _bc.plus({ days: 1 });
        _bs++;
      }
    });
  }

  if (hltDrugsB3.length > 0 && hltStartRaw && treatmentEndForHlt && typeof resolveHltIsoDates === "function") {
    const controlNeeded = new Set();
    hltDrugsB3.forEach(drug => {
      const r = (drug.Режим || "").toLowerCase();
      const dates = (r === "ежедневно" || r === "в дни лучевой терапии")
        ? null
        : resolveHltIsoDates(
          drug,
          hltStartRaw.startOf("day"),
          treatmentEndForHlt.startOf("day"),
          Array.from(allRadDatesSet)
        ).map(iso => dv.date(iso)).filter(Boolean);
      if (dates) {
        dates.forEach(d => {
          const cd = d.minus({ days: 1 });
          if (cd.weekday <= 5 || true) controlNeeded.add(cd.toISODate());
        });
      }
    });
    const doneControls = Array.isArray(cur.Контроль_крови) ? cur.Контроль_крови.map(String) : [];
    controlNeeded.forEach(iso => {
      const dd = ensureDay(iso);
      dd.bloodControlNeeded = true;
      dd.bloodControlDone = doneControls.includes(iso);
    });
  }

  const medsB3 = typeof normalizeLsAssignments === "function" ? normalizeLsAssignments(cur) : [];
  if (medsB3.length > 0) {
    medsB3.forEach(med => {
      const prep = (med.Препарат ?? "").toString().trim();
      if (!prep) return;
      const termCode = (med.Срок ?? "весь_курс").toString();
      const startD = med.Дата_старта ? dv.date(med.Дата_старта) : (start1 || null);
      if (!startD) return;

      let days = [];
      if (termCode === "весь_курс") {
        const endD = end1 || treatmentEndForHlt;
        if (!endD) return;
        let d = startD.startOf("day"), limit = 0;
        while (d.toISODate() <= endD.toISODate() && limit < 400) {
          days.push(d.toISODate());
          d = d.plus({ days: 1 });
          limit++;
        }
      } else {
        const parsed = Number(med.Дней) > 0
          ? Number(med.Дней)
          : Number((((termCode || "").match(/^(\d+)_дней$/)) || [])[1] || 0);
        const n = parsed > 0 ? parsed : 1;
        let d = startD.startOf("day");
        for (let i = 0; i < n; i++) {
          days.push(d.toISODate());
          d = d.plus({ days: 1 });
        }
      }
      days.forEach(iso => {
        const di = ensureDay(iso);
        if (!di.meds.includes(prep)) di.meds.push(prep);
      });
    });
  }

  const remindersRaw = Array.isArray(cur.Напоминания) ? cur.Напоминания : [];
  remindersRaw.forEach(r => {
    if (!r || typeof r !== "object") return;
    const dateStr = r.Дата || r.дата;
    const text = r.Текст || r.текст || "";
    if (!dateStr || !text) return;
    try {
      const d = dv.date(dateStr);
      if (!d) return;
      const iso = d.startOf("day").toISODate();
      ensureDay(iso).reminders.push(text);
    } catch (e) {}
  });

  const NEW_PLAN_COLOR = "#00897b";
  const calRazm = cur.Дата_разметки && typeof cur.Дата_разметки !== "boolean" ? dv.date(cur.Дата_разметки) : null;
  if (calRazm) {
    ensureDay(calRazm.startOf("day").toISODate()).razmetka = true;
    if (start1) {
      const contDl = scheduleCore.minusWorkDays(start1.toISODate(), 3, holidays);
      if (contDl && contDl >= calRazm.startOf("day").toISODate()) {
        let wc = calRazm.startOf("day"), ws = 0;
        while (wc <= dv.date(contDl) && ws < 60) {
          if (wc.weekday <= 5 && !holidays.has(wc.toISODate())) ensureDay(wc.toISODate()).contourWin = true;
          wc = wc.plus({ days: 1 });
          ws++;
        }
      }
      const contDl2 = scheduleCore.minusWorkDays(start1.toISODate(), 3, holidays);
      if (contDl2) {
        let pw = dv.date(contDl2).plus({ days: 1 }), ps = 0;
        while (pw < start1 && ps < 30) {
          if (pw.weekday <= 5 && !holidays.has(pw.toISODate())) ensureDay(pw.toISODate()).planningWin = true;
          pw = pw.plus({ days: 1 });
          ps++;
        }
      }
    }
  }

  const calRmkList = (() => {
    const r = cur.Переразметки;
    if (Array.isArray(r) && r.length > 0) return r.filter(Boolean);
    if (cur.Дата_переразметки) return [{
      Дата: cur.Дата_переразметки,
      Переразметка: cur.Переразметка === true,
      Переоконтуривание: cur.Переоконтуривание === true,
      Старт_нового_плана: ""
    }];
    return [];
  })();
  const calHasRemark = calRmkList.length > 0;

  calRmkList.forEach((rmk) => {
    const rmkD = rmk.Дата && typeof rmk.Дата !== "boolean" ? dv.date(rmk.Дата) : null;
    if (!rmkD) return;
    const rmkDay = rmkD.startOf("day");
    ensureDay(rmkDay.toISODate()).remark = true;

    let rwd = rmkDay;
    while (rwd.weekday > 5 || holidays.has(rwd.toISODate())) rwd = rwd.plus({ days: 1 });
    let remDl = rwd, remRem = 1;
    while (remRem > 0) {
      remDl = remDl.plus({ days: 1 });
      if (remDl.weekday <= 5 && !holidays.has(remDl.toISODate())) remRem--;
    }
    let rwc = rwd, rws = 0;
    while (rwc.toISODate() <= remDl.toISODate() && rws < 14) {
      if (rwc.weekday <= 5 && !holidays.has(rwc.toISODate())) ensureDay(rwc.toISODate()).recontourWin = true;
      rwc = rwc.plus({ days: 1 });
      rws++;
    }

    if (rmk.Старт_нового_плана) {
      const ns = dv.date(rmk.Старт_нового_плана);
      if (ns) {
        ensureDay(ns.startOf("day").toISODate()).newPlanStart = true;
        let npw = remDl.plus({ days: 1 }), nps = 0;
        while (npw < ns.startOf("day") && nps < 30) {
          if (npw.weekday <= 5 && !holidays.has(npw.toISODate())) ensureDay(npw.toISODate()).newPlanningWin = true;
          npw = npw.plus({ days: 1 });
          nps++;
        }
      }
    }
  });

  const calMonthSet = new Set();
  for (const iso of dayInfoMap.keys()) {
    const md = dv.date(iso);
    if (md) calMonthSet.add(md.startOf("month").toISODate());
  }
  const sortedCalMonths = [...calMonthSet].sort().map(miso => dv.date(miso));

  const legendEl = dv.el("div", "");
  legendEl.style.cssText = "display: flex; flex-wrap: wrap; gap: 8px; margin-top: 16px; margin-bottom: 4px; font-size: 0.8em;";
  const mkDot = (color, label) => {
    const item = legendEl.createEl("span");
    item.style.cssText = "display: inline-flex; align-items: center; gap: 4px; color: var(--text-muted);";
    const dot = item.createEl("span");
    dot.style.cssText = `display: inline-block; width: 10px; height: 10px; background: ${color}; border-radius: 50%;`;
    item.createEl("span", { text: label });
  };

  mkDot("#4caf50", "Пройдено");
  mkDot("#2196f3", cur.Название_PTV || "PTV1");
  extraScheduleData.forEach(({ conn, color, name }) => {
    const connShort = conn === "Последовательный буст" ? "↑Буст" : conn === "Одновременно" ? "SIB" : conn === "Последовательно" ? "→Посл." : "◎Парал.";
    mkDot(color, `${name} (${connShort})`);
  });
  if (hltDrugsB3.length > 0) {
    const hltLabel = hltDrugsB3.map(d => d.Препарат || "ХЛТ").join(" + ");
    mkDot("#ff9800", `ХЛТ (${hltLabel})`);
  }
  if (medsB3.length > 0) mkDot("#7b61ff", "Лекарственные препараты");
  if (calRazm) mkDot("#7b1fa2", "Разметка");
  if (calConsult) mkDot("#00897b", "Консультация");
  if (calRazm && start1) mkDot("rgba(123,31,162,0.55)", "Оконтуривание");
  if (calRazm && start1) mkDot("#ff9800", "Планирование");
  if (calHasRemark) mkDot("#3f51b5", "Переразметка");
  if (calHasRemark) mkDot("rgba(63,81,181,0.55)", "Переоконтуривание");
  if (calRmkList.some(r => r.Старт_нового_плана)) mkDot(NEW_PLAN_COLOR, "Новый план");
  if (remindersRaw.length > 0) mkDot("#ff5722", "Напоминания");
  if (Array.isArray(hltBreakRanges) && hltBreakRanges.length > 0) mkDot("#9e9e9e", "Перерыв ХЛТ");
  if (hltDrugsB3.length > 0) mkDot("#2196f3", "Контроль крови");

  const outerWrapper = dv.el("div", "");
  outerWrapper.style.cssText = "width: 100%; box-sizing: border-box; overflow-x: clip;";

  const wrapper = outerWrapper.createEl("div");
  wrapper.style.cssText = "display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 20px; margin-top: 12px; width: 100%;";
  const ruMonths = ["", "ЯНВАРЬ", "ФЕВРАЛЬ", "МАРТ", "АПРЕЛЬ", "МАЙ", "ИЮНЬ", "ИЮЛЬ", "АВГУСТ", "СЕНТЯБРЬ", "ОКТЯБРЬ", "НОЯБРЬ", "ДЕКАБРЬ"];
  const ruDays = ["ПН", "ВТ", "СР", "ЧТ", "ПТ", "СБ", "ВС"];
  const ruMonthsG = ["", "января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
  const ruDayNames = ["", "понедельник", "вторник", "среда", "четверг", "пятница", "суббота", "воскресенье"];
  const ptv1Name = cur.Название_PTV || "PTV1";

  let activePopup = null;
  const closePopup = () => { if (activePopup) { activePopup.remove(); activePopup = null; } };
  runtimeDocument.addEventListener("click", closePopup);

  const showDayPopup = (dayDate, info, clickEvent) => {
    closePopup();
    const popup = runtimeDocument.createElement("div");
    popup.style.cssText = `
      position: fixed;
      z-index: 99999;
      background: var(--background-primary);
      border: 1px solid var(--background-modifier-border);
      border-radius: 8px;
      padding: 12px 14px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.3);
      font-size: 13px;
      min-width: 200px;
      max-width: 85vw;
      font-family: var(--font-interface);
      line-height: 1.5;
      opacity: 0;
    `;
    popup.onclick = e => e.stopPropagation();

    const hdr = runtimeDocument.createElement("div");
    hdr.style.cssText = "font-weight:700;font-size:0.88em;color:var(--text-accent);margin-bottom:8px;padding-bottom:6px;border-bottom:1px solid var(--background-modifier-border);";
    hdr.textContent = `${dayDate.day} ${ruMonthsG[dayDate.month]} ${dayDate.year}, ${ruDayNames[dayDate.weekday]}`;
    popup.appendChild(hdr);

    const addRow = (color, text) => {
      const row = runtimeDocument.createElement("div");
      row.style.cssText = "display:flex;align-items:flex-start;gap:8px;margin-bottom:5px;";
      const dot = runtimeDocument.createElement("span");
      dot.style.cssText = `flex-shrink:0;margin-top:4px;display:inline-block;width:8px;height:8px;border-radius:50%;background:${color};`;
      const txt = runtimeDocument.createElement("span");
      txt.style.cssText = "color:var(--text-normal);font-size:0.88em;";
      txt.textContent = text;
      row.appendChild(dot);
      row.appendChild(txt);
      popup.appendChild(row);
    };

    const iso = dayDate.toISODate();
    if (info.ptv1) {
      const fracNum = schedule1.findIndex(d => d.toISODate() === iso) + 1;
      addRow("#2196f3", `${ptv1Name}${fracNum > 0 ? ` — фр. ${fracNum} из ${frac1}` : ""}`);
    }
    info.extras.forEach(({ color, name, conn }) => {
      const connLabel = conn === "Одновременно" ? " (SIB)" : conn === "Последовательный буст" ? " (Буст)" : conn === "Последовательно" ? " (Посл.)" : " (Парал.)";
      const eData = extraScheduleData.find(s => s.name === name && s.color === color);
      let fracInfo = "";
      if (eData) {
        const fn = eData.schedule.findIndex(d => d.toISODate() === iso) + 1;
        if (fn > 0) fracInfo = ` — фр. ${fn} из ${eData.schedule.length}`;
      }
      addRow(color, `${name}${connLabel}${fracInfo}`);
    });
    if (info.hlt) {
      const drugLabels = Array.isArray(info.hltDrugs) && info.hltDrugs.length > 0
        ? info.hltDrugs.map(d => `${d.препарат} (${d.режим})`).join(", ")
        : "ХЛТ";
      addRow("#ff9800", drugLabels);
    }
    if (info.reminders?.length > 0) info.reminders.forEach(r => addRow("#ff5722", `📌 ${r}`));
    if (info.meds?.length > 0) info.meds.forEach(m => addRow("#7b61ff", `💊 ${m}`));
    if (info.hltBreak) addRow("#9e9e9e", "⏸ Перерыв в ХЛТ");
    if (info.bloodControlNeeded) {
      const ctrlText = info.bloodControlDone ? "✅ Контроль крови (выполнен)" : "🔔 Контроль крови (нужен)";
      addRow(info.bloodControlDone ? "#4caf50" : "#2196f3", ctrlText);
    }
    if (info.consult) addRow("#00897b", "Консультация");
    if (info.razmetka) addRow("#7b1fa2", "🟣 Разметка КТ/МРТ");
    if (info.remark) addRow("#3f51b5", "🔁 Переразметка КТ/МРТ");
    if (info.contourWin && !info.razmetka) addRow("#7b1fa2", "✏️ Оконтуривание");
    if (info.recontourWin && !info.remark) addRow("#3f51b5", "✏️ Переоконтуривание");
    if (info.planningWin) addRow("#ff9800", "📋 Планирование");
    if (info.newPlanStart) addRow(NEW_PLAN_COLOR, "🔷 Старт нового плана");
    if (info.newPlanningWin && !info.newPlanStart) addRow(NEW_PLAN_COLOR, "📋 Планирование нового плана");

    if (!info.ptv1 && !info.extras.length && !info.hlt && !info.reminders?.length && !info.hltBreak && !info.bloodControlNeeded && !info.consult && !info.razmetka && !info.remark && !info.contourWin && !info.recontourWin && !info.planningWin && !info.newPlanStart && !info.newPlanningWin && !info.meds?.length) {
      const em = runtimeDocument.createElement("div");
      em.style.cssText = "color:var(--text-muted);font-size:0.85em;";
      em.textContent = "Нет событий";
      popup.appendChild(em);
    }

    runtimeDocument.body.appendChild(popup);
    activePopup = popup;

    runtimeWindow.requestAnimationFrame(() => {
      if (!activePopup) return;
      const rect = activePopup.getBoundingClientRect();
      const margin = 12;
      let left = clickEvent.clientX + margin;
      let top = clickEvent.clientY + margin;
      if (left + rect.width > runtimeWindow.innerWidth) left = runtimeWindow.innerWidth - rect.width - margin;
      if (left < margin) left = margin;
      if (top + rect.height > runtimeWindow.innerHeight) top = clickEvent.clientY - rect.height - margin;
      if (top < margin) top = margin;
      activePopup.style.left = `${left}px`;
      activePopup.style.top = `${top}px`;
      activePopup.style.opacity = "1";
    });
  };

  let _dragData = null;
  const applyDragMove = (eventData, newDate) => {
    if (eventData.type === "hlt") {
      const baseDates = normalizeHltIsoList
        ? normalizeHltIsoList(
          (Array.isArray(cur.ХЛТ_ручные_даты) && cur.ХЛТ_ручные_даты.length > 0)
            ? cur.ХЛТ_ручные_даты
            : (Array.isArray(hltComputedDates) ? hltComputedDates.flat() : [])
        )
        : [];
      const overrides = normalizeHltIsoList ? normalizeHltIsoList([...baseDates.filter(d => d !== eventData.originalDate), newDate]) : [newDate];
      const skipped = normalizeHltIsoList ? normalizeHltIsoList((cur.Пропущенные_даты_ХЛТ || []).filter(d => d !== eventData.originalDate && d !== newDate)) : [];
      patchCurrentFrontmatter(fm => {
        fm.ХЛТ_ручные_даты = overrides;
        if (skipped.length) fm.Пропущенные_даты_ХЛТ = skipped;
        else {
          try { delete fm.Пропущенные_даты_ХЛТ; } catch (e) { fm.Пропущенные_даты_ХЛТ = []; }
        }
      }, { reread: false })
        .then(() => { notice("✅ ХЛТ перенесена"); })
        .catch(e => { notice("❌ Ошибка: " + (e?.message || e)); });
    } else if (eventData.type === "reminder") {
      patchCurrentFrontmatter(fm => {
        if (Array.isArray(fm.Напоминания) && fm.Напоминания[eventData.index]) {
          fm.Напоминания[eventData.index].дата = newDate;
        }
      }, { reread: false }).then(() => { notice("✅ Напоминание перенесено"); })
        .catch(e => { notice("❌ Ошибка: " + (e?.message || e)); });
    }
  };

  sortedCalMonths.forEach(viewCursor => {
    const mStart = viewCursor.startOf("month");
    const mEnd = viewCursor.endOf("month");
    let hasEvent = false;
    for (const [eiso] of dayInfoMap) {
      const ed = dv.date(eiso);
      if (ed && ed >= mStart && ed <= mEnd) { hasEvent = true; break; }
    }
    if (!hasEvent) return;
    const monthContainer = wrapper.createEl("div");
    monthContainer.style.cssText = "width: 100%; margin: 0; padding: 0;";

    const mName = ruMonths[viewCursor.month];
    const monthHeader = monthContainer.createEl("div");
    monthHeader.style.cssText = "text-align:center; font-weight:bold; margin-bottom:12px; color:var(--text-normal); border-bottom: 2px solid var(--interactive-accent); padding-bottom:6px;";
    monthHeader.textContent = `${mName} ${viewCursor.year}`;

    const grid = monthContainer.createEl("div");
    grid.style.cssText = "display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; justify-items: center; width: 100%;";

    ruDays.forEach(d => {
      const el = grid.createEl("div");
      el.textContent = d;
      el.style.cssText = "text-align:center; font-size:0.75em; color:var(--text-muted); padding-bottom: 4px; width: 100%;";
    });

    const offset = viewCursor.weekday - 1;
    for (let i = 0; i < offset; i++) grid.createEl("div");

    const daysInMonth = viewCursor.daysInMonth;
    for (let i = 1; i <= daysInMonth; i++) {
      const dayDate = viewCursor.set({ day: i });
      const iso = toISO(dayDate);
      const dayInfo = dayInfoMap.get(iso);

      const cell = grid.createEl("div");
      cell.style.cssText = "aspect-ratio: 1; width: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; border-radius: 50%; font-size: 0.9em; cursor: default; position: relative; padding: 0;";

      const isPast = dayDate < today;
      const isToday = iso === toISO(today);
      const isWeekendOrHoliday = dayDate.weekday > 5 || holidays.has(iso);

      let mainBg = "transparent";
      let mainTextColor = isWeekendOrHoliday ? "var(--text-muted)" : "var(--text-normal)";
      let mainOpacity = isWeekendOrHoliday ? "0.4" : "1";
      let mainBorder = "none";
      let mainFontWeight = "normal";
      const isTouchDevice = ("ontouchstart" in runtimeWindow) || (runtimeWindow.navigator?.maxTouchPoints > 0) || (runtimeWindow.innerWidth <= 600);

      if (dayInfo) {
        if (dayInfo.ptv1) {
          mainFontWeight = "bold";
          mainTextColor = "white";
          if (isToday) mainBg = "#ff9800";
          else if (isPast) mainBg = "#4caf50";
          else mainBg = "#2196f3";
          mainOpacity = "1";
        } else if (dayInfo.razmetka) {
          mainFontWeight = "bold"; mainTextColor = "white";
          mainBg = "#7b1fa2"; mainOpacity = "1";
        } else if (dayInfo.remark) {
          mainFontWeight = "bold"; mainTextColor = "white";
          mainBg = "#3f51b5"; mainOpacity = "1";
        } else if (dayInfo.contourWin) {
          mainBorder = "1.5px solid #7b1fa2";
          mainTextColor = "#7b1fa2"; mainFontWeight = "600"; mainOpacity = "1";
        } else if (dayInfo.recontourWin) {
          mainBorder = "1.5px solid #3f51b5";
          mainTextColor = "#3f51b5"; mainFontWeight = "600"; mainOpacity = "1";
        } else if (dayInfo.planningWin) {
          mainBorder = "1px dashed #ff9800";
          mainTextColor = "#e65100"; mainOpacity = "0.85";
        } else if (dayInfo.newPlanStart) {
          mainFontWeight = "bold"; mainTextColor = "white";
          mainBg = NEW_PLAN_COLOR; mainOpacity = "1";
        } else if (dayInfo.newPlanningWin) {
          mainBorder = `1px dashed ${NEW_PLAN_COLOR}`;
          mainTextColor = NEW_PLAN_COLOR; mainOpacity = "0.85";
        } else if (dayInfo.extras.length > 0) {
          const firstExtra = dayInfo.extras[0];
          mainFontWeight = "bold";
          mainTextColor = "white";
          if (isToday) mainBg = "#ff9800";
          else if (isPast) mainBg = firstExtra.color + "bb";
          else mainBg = firstExtra.color;
          mainOpacity = "1";
        } else if (dayInfo.reminders?.length > 0) {
          mainBorder = "1.5px solid #ff5722";
          mainTextColor = "#ff5722";
          mainFontWeight = "600";
          mainOpacity = "1";
        } else if (dayInfo.consult) {
          mainBorder = "1.5px solid #00897b";
          mainTextColor = "#00897b";
          mainFontWeight = "600";
          mainOpacity = "1";
        } else if (isToday) {
          mainBorder = "2px solid var(--text-accent)";
        }
        cell.style.cursor = "pointer";
        cell.onclick = e => { e.stopPropagation(); showDayPopup(dayDate, dayInfo, e); };

        if (!isTouchDevice && (dayInfo.hlt || (dayInfo.reminders?.length > 0))) {
          cell.draggable = true;
          cell.ondragstart = (e) => {
            if (dayInfo.hlt) {
              _dragData = { type: "hlt", originalDate: iso };
              e.dataTransfer.setData("text/plain", "hlt:" + iso);
            } else if (dayInfo.reminders?.length > 0) {
              const reminders = Array.isArray(cur.Напоминания) ? cur.Напоминания : [];
              const rIdx = reminders.findIndex(r => {
                const rd = r?.дата ? dv.date(r.дата) : null;
                return rd && rd.toISODate() === iso;
              });
              _dragData = { type: "reminder", index: rIdx, originalDate: iso };
              e.dataTransfer.setData("text/plain", "reminder:" + iso);
            }
            cell.style.opacity = "0.4";
          };
          cell.ondragend = () => { cell.style.opacity = ""; _dragData = null; };
        }
      } else if (isToday) {
        mainBorder = "2px solid var(--text-accent)";
      }

      if (!isTouchDevice) {
        cell.ondragover = (e) => {
          if (_dragData) { e.preventDefault(); e.stopPropagation(); cell.style.outline = "2px solid var(--interactive-accent)"; }
        };
        cell.ondragleave = () => { cell.style.outline = ""; };
        cell.ondrop = (e) => {
          e.preventDefault(); e.stopPropagation();
          cell.style.outline = "";
          if (_dragData) {
            applyDragMove(_dragData, iso);
            _dragData = null;
          }
        };
      }

      cell.style.backgroundColor = mainBg;
      cell.style.color = mainTextColor;
      cell.style.opacity = mainOpacity;
      cell.style.fontWeight = mainFontWeight;
      cell.style.border = mainBorder;

      if (dayInfo?.hltBreak) {
        cell.style.background = `repeating-linear-gradient(45deg, ${mainBg === "transparent" ? "var(--background-modifier-hover)" : mainBg}, ${mainBg === "transparent" ? "var(--background-modifier-hover)" : mainBg} 3px, transparent 3px, transparent 6px)`;
        cell.style.border = "1px dashed #9e9e9e";
        cell.style.opacity = "0.6";
      }

      const numEl = cell.createEl("span");
      numEl.textContent = String(i);
      numEl.style.cssText = "line-height: 1; display: block;";

      if (dayInfo) {
        const indicators = [];
        if (dayInfo.ptv1 && dayInfo.extras.length > 0) dayInfo.extras.forEach(e => indicators.push(e.color));
        if (!dayInfo.ptv1 && dayInfo.extras.length > 1) dayInfo.extras.slice(1).forEach(e => indicators.push(e.color));
        if (dayInfo.hlt) indicators.push("#ff9800");
        if (dayInfo.meds?.length > 0) indicators.push("#7b61ff");
        if (dayInfo.bloodControlNeeded) indicators.push(dayInfo.bloodControlDone ? "#4caf50" : "#2196f3");
        if (dayInfo.consult && (dayInfo.ptv1 || dayInfo.extras.length > 0 || dayInfo.razmetka || dayInfo.remark)) indicators.push("#00897b");
        if (dayInfo.newPlanStart && (dayInfo.ptv1 || dayInfo.extras.length > 0)) indicators.push(NEW_PLAN_COLOR);
        if (dayInfo.remark && (dayInfo.ptv1 || dayInfo.extras.length > 0)) indicators.push("#3f51b5");
        if (dayInfo.reminders?.length > 0 && (dayInfo.ptv1 || dayInfo.extras.length > 0)) indicators.push("#ff5722");

        if (indicators.length > 0) {
          const dotsRow = cell.createEl("div");
          dotsRow.style.cssText = "display: flex; gap: 3px; justify-content: center; margin-top: 3px; height: 6px;";
          indicators.forEach(dotColor => {
            const dot = dotsRow.createEl("span");
            dot.style.cssText = `display: inline-block; width: 6px; height: 6px; background: ${dotColor}; border-radius: 50%; flex-shrink: 0; box-shadow: 0 1px 3px rgba(0,0,0,0.35);`;
          });
        }
        const extraMarkers = [];
        if (dayInfo.razmetka && (dayInfo.ptv1 || dayInfo.extras.length > 0)) extraMarkers.push("#7b1fa2");
        if (dayInfo.remark && (dayInfo.ptv1 || dayInfo.extras.length > 0)) extraMarkers.push("#3f51b5");
        if (extraMarkers.length > 0) {
          let mRow = cell.querySelector(".cal-extra-markers");
          if (!mRow) {
            mRow = cell.createEl("div");
            mRow.className = "cal-extra-markers";
            mRow.style.cssText = "display:flex;gap:2px;justify-content:center;margin-top:1px;";
          }
          extraMarkers.forEach(mc => {
            const ms = mRow.createEl("span");
            ms.style.cssText = `display:inline-block;width:4px;height:4px;background:${mc};border-radius:50%;`;
          });
        }
      }
    }
  });

  return {
    reminderUi,
    bottomBar,
    prescPanel,
    remFracPanel,
    elnPanel,
    outerWrapper,
    dayInfoMap,
    extraScheduleData
  };
};

module.exports = {
  buildDispanseryReminders,
  mountPatientBottomPanels
};
