"use strict";

const normalizeReminderDateIso = (value, dv = globalThis.dv) => {
  if (!value) return "";
  const date = dv?.date ? dv.date(value) : null;
  if (date?.toFormat) return date.toFormat("yyyy-MM-dd");
  const raw = String(value).trim();
  const isoMatch = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoMatch) return isoMatch[1];
  const ruMatch = raw.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (ruMatch) return `${ruMatch[3]}-${ruMatch[2]}-${ruMatch[1]}`;
  return raw;
};

const normalizeReminderText = (value) => String(value ?? "").replace(/\s+/g, " ").trim();

const reminderKey = (reminder, dv = globalThis.dv) => {
  const datePart = normalizeReminderDateIso(reminder?.дата ?? reminder?.Дата, dv);
  const textPart = normalizeReminderText(reminder?.текст ?? reminder?.Текст);
  return `${datePart}||${textPart}`;
};

const isReminderDone = (reminder) => reminder?.выполнено === true || reminder?.Выполнено === true;

const isElnReminderText = (text) => String(text || "").includes("Написать ВК по ЭЛН");

const getReminderDateIso = (value, dv = globalThis.dv) => {
  const date = dv?.date ? dv.date(value) : null;
  return date?.toFormat ? date.toFormat("yyyy-MM-dd") : normalizeReminderDateIso(value, dv);
};

const getActiveReminders = (reminders, dv = globalThis.dv) =>
  (Array.isArray(reminders) ? reminders : [])
    .filter(r => r && (r.дата || r.Дата) && (r.текст || r.Текст) && !isReminderDone(r))
    .map(r => ({ ...r, дата: r.дата || r.Дата, текст: r.текст || r.Текст, iso: normalizeReminderDateIso(r.дата || r.Дата, dv) }));

const getElnPendingReminders = (reminders, dv = globalThis.dv) =>
  getActiveReminders(reminders, dv).filter(r => isElnReminderText(r.текст));

const buildElnReminderDraft = ({
  selectedDateStr,
  today,
  baseStart,
  holidays,
  dv = globalThis.dv
} = {}) => {
  if (!today || !baseStart) return null;

  let targetDate = null;
  const todayIsoLocal = today.toFormat("yyyy-MM-dd");

  if (selectedDateStr && selectedDateStr !== todayIsoLocal) {
    targetDate = dv?.date ? dv.date(selectedDateStr) : null;
    if (!targetDate) return null;
    targetDate = targetDate.startOf("day");
  } else {
    let baseDate;
    let daysToAdd;
    if (baseStart > today) {
      baseDate = baseStart;
      daysToAdd = 14;
    } else {
      const diffDays = today.diff(baseStart, "days").days;
      if (diffDays > 5) {
        baseDate = today;
        daysToAdd = 15;
      } else {
        baseDate = baseStart;
        daysToAdd = 14;
      }
    }
    targetDate = baseDate.plus({ days: daysToAdd });
  }

  let safety = 0;
  while (safety < 10) {
    const iso = targetDate.toISODate();
    if (targetDate.weekday > 5 || holidays?.has?.(iso)) {
      targetDate = targetDate.minus({ days: 1 });
      safety++;
    } else {
      break;
    }
  }

  const totalDaysVal = Math.floor(targetDate.diff(baseStart, "days").days) + 1;
  let daysPassedVal;
  let daysAddedVal;
  if (baseStart > today) {
    daysPassedVal = 0;
    daysAddedVal = totalDaysVal;
  } else {
    daysPassedVal = Math.floor(today.diff(baseStart, "days").days) + 1;
    daysAddedVal = Math.floor(targetDate.diff(today, "days").days);
  }

  const reminderText = `Написать ВК по ЭЛН (Прошло: ${daysPassedVal} + Доб: ${daysAddedVal} = Итог: ${totalDaysVal})`;
  const targetIso = targetDate.toFormat("yyyy-MM-dd");
  return {
    targetDate,
    targetIso,
    totalDaysVal,
    daysPassedVal,
    daysAddedVal,
    reminderText,
    newReminder: { дата: targetIso, текст: reminderText, выполнено: false }
  };
};

const upsertElnReminder = ({
  reminders,
  targetIso,
  newReminder,
  dv = globalThis.dv
} = {}) => {
  const source = Array.isArray(reminders) ? reminders : [];
  let updated = false;
  const next = source.map(r => {
    if (!r) return r;
    const txt = r.текст || r.Текст;
    if (!isElnReminderText(txt)) return r;
    if (isReminderDone(r)) return r;
    const iso = normalizeReminderDateIso(r.дата || r.Дата, dv);
    if (iso !== targetIso) return r;
    updated = true;
    return { ...r, дата: newReminder.дата, текст: newReminder.текст, выполнено: false };
  });
  if (!updated) next.push(newReminder);
  return { reminders: next, updated };
};

const mountPatientReminderPanels = ({
  window: runtimeWindow = globalThis.window,
  document: runtimeDocument = globalThis.document,
  bottomBar,
  card,
  prescKey,
  prescPanel,
  expandBtn,
  updateExpandBtn = null,
  hasSick,
  today,
  dv,
  holidays,
  cur,
  makeDatePicker,
  patchCurrentFrontmatter,
  getElnBaseStart,
  notice = null,
  P = "14px"
} = {}) => {
  if (!runtimeWindow) throw new Error("mountPatientReminderPanels: window is required");
  if (!runtimeDocument) throw new Error("mountPatientReminderPanels: document is required");
  if (!bottomBar) throw new Error("mountPatientReminderPanels: bottomBar is required");
  if (!card) throw new Error("mountPatientReminderPanels: card is required");
  if (!prescPanel) throw new Error("mountPatientReminderPanels: prescPanel is required");
  if (!expandBtn) throw new Error("mountPatientReminderPanels: expandBtn is required");
  if (typeof makeDatePicker !== "function") throw new Error("mountPatientReminderPanels: makeDatePicker is required");
  if (typeof patchCurrentFrontmatter !== "function") throw new Error("mountPatientReminderPanels: patchCurrentFrontmatter is required");
  if (typeof getElnBaseStart !== "function") throw new Error("mountPatientReminderPanels: getElnBaseStart is required");

  const notify = typeof notice === "function" ? notice : (message) => console.log(message);
  const REMFRAC_KEY = `remfrac_open_${cur?.file?.path || ""}`;
  const ELN_KEY = `eln_open_${cur?.file?.path || ""}`;
  if (!Object.prototype.hasOwnProperty.call(runtimeWindow, REMFRAC_KEY)) runtimeWindow[REMFRAC_KEY] = false;
  if (!Object.prototype.hasOwnProperty.call(runtimeWindow, ELN_KEY)) runtimeWindow[ELN_KEY] = false;

  const BTN_BASE = "display:flex;align-items:center;gap:5px;padding:6px 13px;border-radius:20px;font-size:12px;font-weight:600;cursor:pointer;transition:all 0.18s;line-height:1;border:none;font-family:var(--font-interface);";

  const hasActiveReminders = Array.isArray(cur?.Напоминания) &&
    cur.Напоминания.some(r => r && r.дата && r.текст && r.выполнено !== true);

  const remFracBtn = bottomBar.createEl("button");
  remFracBtn.classList.add("pf-bottom-tab-btn");
  const updateRemFracBtn = () => {
    const open = runtimeWindow[REMFRAC_KEY];
    remFracBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg> Напоминания`;
    if (open) {
      remFracBtn.style.cssText = BTN_BASE + "background:#e3f2fd;color:#1565c0;box-shadow:0 0 0 2px rgba(21,101,192,0.25);";
    } else if (hasActiveReminders) {
      remFracBtn.style.cssText = BTN_BASE + "background:rgba(21,101,192,0.1);color:#1565c0;";
    } else {
      remFracBtn.style.cssText = BTN_BASE + "background:var(--background-modifier-hover);color:var(--text-muted);";
    }
  };
  updateRemFracBtn();
  remFracBtn.onmouseenter = () => { if (!runtimeWindow[REMFRAC_KEY] && !hasActiveReminders) remFracBtn.style.background = "var(--background-modifier-border)"; };
  remFracBtn.onmouseleave = () => { updateRemFracBtn(); };

  const ELN_KEY_IS_AVAILABLE = !!hasSick;
  let elnBtn = null;
  const updateElnBtn = () => {
    if (!elnBtn) return;
    const open = runtimeWindow[ELN_KEY];
    elnBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> ЭЛН`;
    elnBtn.style.cssText = BTN_BASE + (open
      ? "background:#fff3e0;color:#e65100;box-shadow:0 0 0 2px rgba(230,81,0,0.2);"
      : "background:var(--background-modifier-hover);color:var(--text-muted);");
  };
  if (ELN_KEY_IS_AVAILABLE) {
    elnBtn = bottomBar.createEl("button");
    elnBtn.classList.add("pf-bottom-tab-btn");
    updateElnBtn();
    elnBtn.onmouseenter = () => { if (!runtimeWindow[ELN_KEY]) elnBtn.style.background = "var(--background-modifier-border)"; };
    elnBtn.onmouseleave = () => { if (!runtimeWindow[ELN_KEY]) elnBtn.style.background = "var(--background-modifier-hover)"; };
  }

  const remFracPanel = card.createEl("div");
  remFracPanel.style.cssText = `display:${runtimeWindow[REMFRAC_KEY] ? "block" : "none"};margin-top:10px;border-radius:10px;overflow:hidden;border:1px solid var(--background-modifier-border);`;

  const elnPanel = hasSick ? card.createEl("div") : null;
  if (elnPanel) {
    elnPanel.style.cssText = `display:${runtimeWindow[ELN_KEY] ? "block" : "none"};margin-top:10px;border-radius:10px;overflow:hidden;border:1px solid var(--background-modifier-border);`;
  }

  const syncBottomPanels = () => {
    if (prescPanel) prescPanel.style.display = runtimeWindow[prescKey] ? "block" : "none";
    remFracPanel.style.display = runtimeWindow[REMFRAC_KEY] ? "block" : "none";
    if (elnPanel) elnPanel.style.display = runtimeWindow[ELN_KEY] ? "block" : "none";
    if (typeof updateExpandBtn === "function") updateExpandBtn();
    updateRemFracBtn();
    updateElnBtn();
  };

  const openSingleBottomPanel = (which) => {
    runtimeWindow[prescKey] = which === "presc";
    runtimeWindow[REMFRAC_KEY] = which === "rem";
    runtimeWindow[ELN_KEY] = !!elnPanel && which === "eln";
    syncBottomPanels();
  };

  const toggleBottomPanel = (which) => {
    const isOpen = which === "presc"
      ? runtimeWindow[prescKey]
      : (which === "rem" ? runtimeWindow[REMFRAC_KEY] : runtimeWindow[ELN_KEY]);
    openSingleBottomPanel(isOpen ? null : which);
  };

  const initiallyOpen = runtimeWindow[REMFRAC_KEY]
    ? "rem"
    : (runtimeWindow[prescKey]
      ? "presc"
      : ((elnPanel && runtimeWindow[ELN_KEY]) ? "eln" : null));
  openSingleBottomPanel(initiallyOpen);

  expandBtn.onclick = () => toggleBottomPanel("presc");
  remFracBtn.onclick = () => toggleBottomPanel("rem");
  if (elnBtn && elnPanel) {
    elnBtn.onclick = () => toggleBottomPanel("eln");
  }

  const pnl = remFracPanel;
  const CHIP_BTN = "display:flex;align-items:center;justify-content:center;gap:5px;height:36px;padding:0 14px;border-radius:6px;border:none;font-size:13px;font-weight:600;cursor:pointer;font-family:var(--font-interface);transition:opacity 0.15s;white-space:nowrap;flex-shrink:0;";
  const ACT_BTN  = "width:30px;height:30px;padding:0;display:flex;align-items:center;justify-content:center;background:transparent;border:1px solid var(--background-modifier-border);border-radius:6px;color:var(--text-muted);cursor:pointer;transition:all 0.15s;flex-shrink:0;";

  const remStyleId = "pf-rem-style";
  const existingStyle = runtimeDocument.getElementById(remStyleId);
  if (existingStyle) existingStyle.remove();
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
        notify("✅ Выполнено");
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
      notify("🗑️ Удалено");
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
      notify("❌ Заполните дату и текст!");
      return;
    }
    const newReminder = { дата: date, текст: text, выполнено: false };
    renderReminderCard(newReminder, remListContainer.firstChild);
    remTextInput.value = "";
    notify("✅ Напоминание добавлено!");
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
      notify("⚠️ Нет даты открытия ЭЛН/госпитализации");
      return;
    }
    const draft = buildElnReminderDraft({
      selectedDateStr,
      today,
      baseStart,
      holidays,
      dv
    });
    if (!draft) {
      notify("❌ Некорректная дата");
      return;
    }
    const { targetDate, targetIso, newReminder } = draft;
    const existingIdx = elnPendingState.findIndex(r => normalizeReminderDateIso(r?.дата ?? r?.Дата, dv) === targetIso);
    patchCurrentFrontmatter(fm => {
      if (!Array.isArray(fm.Напоминания)) fm.Напоминания = [];
      const result = upsertElnReminder({
        reminders: fm.Напоминания,
        targetIso,
        newReminder,
        dv
      });
      fm.Напоминания = result.reminders;
    }, { reread: false });
    if (existingIdx >= 0) {
      elnPendingState[existingIdx] = { ...elnPendingState[existingIdx], ...newReminder };
      notify(`♻️ Обновлено ВК на ${targetDate.toFormat("dd.MM.yyyy")}`);
    } else {
      elnPendingState.push(newReminder);
      notify(`✅ Добавлено ВК на ${targetDate.toFormat("dd.MM.yyyy")}`);
    }
    renderElnList();
  };

  if (hasSick && elnPanel) {
    const elnWrap = elnPanel.createEl("div");
    elnWrap.style.cssText = `padding:12px ${P};background:var(--background-primary);`;

    const controlsRow = elnWrap.createEl("div");
    controlsRow.style.cssText = `display:grid;grid-template-columns:${openEnabled ? "1fr 1fr auto" : "1fr auto"};gap:8px;align-items:end;margin-bottom:8px;`;
    if (runtimeWindow.matchMedia && runtimeWindow.matchMedia("(max-width: 820px)").matches) {
      controlsRow.style.gridTemplateColumns = "1fr";
    }

    if (openEnabled) {
      const openCol = controlsRow.createEl("div");
      openCol.style.cssText = "display:flex;flex-direction:column;gap:4px;min-width:0;";

      const openLbl = openCol.createEl("span");
      openLbl.style.cssText = "font-size:12px;color:var(--text-muted);font-weight:600;";
      openLbl.textContent = "Открытый ЭЛН:";

      let openIso = "";
      if (cur.Открытый_ЭЛН) {
        const d = dv.date(cur.Открытый_ЭЛН);
        if (d) openIso = d.toFormat("yyyy-MM-dd");
      }
      const openPicker = makeDatePicker(openCol, openIso, "width:100%;min-width:170px;");
      openPicker.onchange = () => {
        patchCurrentFrontmatter(fm => { fm.Открытый_ЭЛН = openPicker.value || null; }, { reread: false });
      };
    }

    const planCol = controlsRow.createEl("div");
    planCol.style.cssText = "display:flex;flex-direction:column;gap:4px;min-width:0;";

    const planLbl = planCol.createEl("span");
    planLbl.style.cssText = "font-size:12px;color:var(--text-muted);font-weight:600;";
    planLbl.textContent = "Запланировать ВК:";

    const elnDatePicker = makeDatePicker(planCol, today.toFormat("yyyy-MM-dd"), "width:100%;min-width:170px;");

    const addVkBtn = controlsRow.createEl("button");
    addVkBtn.textContent = "ВК по ЭЛН";
    addVkBtn.style.cssText = CHIP_BTN + "background:#e65100;color:white;align-self:end;height:40px;";
    if (runtimeWindow.matchMedia && runtimeWindow.matchMedia("(max-width: 820px)").matches) {
      addVkBtn.style.width = "100%";
    }
    addVkBtn.onmouseenter = () => addVkBtn.style.opacity = "0.82";
    addVkBtn.onmouseleave = () => addVkBtn.style.opacity = "1";
    addVkBtn.onclick = () => addVkReminderFromEln(elnDatePicker.value);

    elnPendingState = getElnPendingReminders(cur.Напоминания, dv);

    const pendingInfo = elnWrap.createEl("div");
    pendingInfo.style.cssText = "font-size:12px;color:var(--text-muted);margin-top:8px;";

    const elnList = elnWrap.createEl("div");
    elnList.style.cssText = "display:flex;flex-direction:column;gap:4px;margin-top:6px;";

    renderElnList = () => {
      elnPendingState.sort((a, b) => (dv.date(a.дата) || 0) - (dv.date(b.дата) || 0));
      pendingInfo.textContent = elnPendingState.length ? `Активные ВК: ${elnPendingState.length}` : "Активные ВК: нет";
      elnList.innerHTML = "";
      if (!elnPendingState.length) return;

      elnPendingState.forEach(r => {
        const row = elnList.createEl("div");
        row.style.cssText = "display:flex;align-items:center;gap:8px;padding:6px 8px;border:1px solid var(--background-modifier-border);border-radius:6px;background:var(--background-primary-alt);";

        const info = row.createEl("div");
        info.style.cssText = "flex:1;min-width:0;font-size:12px;color:var(--text-normal);";
        const d = dv.date(r.дата);
        info.textContent = `${d ? d.toFormat("dd.MM.yyyy") : r.дата} · ${r.текст}`;

        const doneBtn = row.createEl("button");
        doneBtn.textContent = "✓";
        doneBtn.style.cssText = "width:26px;height:26px;border-radius:6px;border:1px solid var(--background-modifier-border);background:transparent;color:#4caf50;cursor:pointer;font-weight:700;";
        doneBtn.onclick = async () => {
          const key = reminderKey(r, dv);
          await patchCurrentFrontmatter(fm => {
            if (!Array.isArray(fm.Напоминания)) return;
            fm.Напоминания.forEach(x => {
              if (reminderKey(x, dv) === key) {
                x.выполнено = true;
                x.Выполнено = true;
              }
            });
          }, { reread: false });
          elnPendingState = elnPendingState.filter(x => reminderKey(x, dv) !== key);
          renderElnList();
          notify("✅ ВК отмечено как выполненное");
        };

        const delBtn = row.createEl("button");
        delBtn.textContent = "×";
        delBtn.style.cssText = "width:26px;height:26px;border-radius:6px;border:1px solid var(--background-modifier-border);background:transparent;color:#e53935;cursor:pointer;font-weight:700;";
        delBtn.onclick = async () => {
          const key = reminderKey(r, dv);
          await patchCurrentFrontmatter(fm => {
            if (!Array.isArray(fm.Напоминания)) return;
            fm.Напоминания = fm.Напоминания.filter(x => reminderKey(x, dv) !== key);
          }, { reread: false });
          elnPendingState = elnPendingState.filter(x => reminderKey(x, dv) !== key);
          renderElnList();
          notify("🗑️ ВК удалено");
        };
        row.appendChild(info);
        row.appendChild(doneBtn);
        row.appendChild(delBtn);
        elnList.appendChild(row);
      });
    };

    renderElnList();
  }

  const activeReminders = getActiveReminders(cur?.Напоминания, dv).filter(r => !isElnReminderText(r.текст));
  if (activeReminders.length > 0) {
    activeReminders.sort((a, b) => {
      if (a.выполнено !== b.выполнено) return a.выполнено ? 1 : -1;
      return (dv.date(a.дата) || 0) - (dv.date(b.дата) || 0);
    });
    activeReminders.forEach(r => renderReminderCard(r));
  }

  return {
    remFracPanel,
    elnPanel,
    remFracBtn,
    elnBtn,
    syncBottomPanels,
    openSingleBottomPanel,
    toggleBottomPanel,
    updateRemFracBtn,
    updateElnBtn,
    getActiveReminders,
    getElnPendingReminders,
    normalizeReminderDateIso,
    normalizeReminderText,
    reminderKey,
    isReminderDone,
    isElnReminderText,
    buildElnReminderDraft,
    upsertElnReminder
  };
};

module.exports = {
  normalizeReminderDateIso,
  normalizeReminderText,
  reminderKey,
  isReminderDone,
  isElnReminderText,
  getReminderDateIso,
  getActiveReminders,
  getElnPendingReminders,
  buildElnReminderDraft,
  upsertElnReminder,
  mountPatientReminderPanels
};
