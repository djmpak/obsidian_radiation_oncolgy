"use strict";

const normalizeDayPhrases = (value) => {
  if (Array.isArray(value)) {
    const map = {};
    value.forEach((phrase, idx) => {
      if (idx > 0 && phrase) map[idx] = phrase;
    });
    return map;
  }
  if (value && typeof value === "object") return value;
  return {};
};

const buildDesktopDischargeState = async ({
  app,
  dv,
  allModels,
  today,
  todayStart,
  todayStr,
  holidays,
  DB_DISCHARGE_PATH,
  DISCHARGED_FOLDER,
  _pfDesktopCore,
  _pfScheduleCore,
  _pfAsIso,
  minusWorkDays,
  safeDate
} = {}) => {
  if (!app?.vault) throw new Error("buildDesktopDischargeState: app.vault is required");
  if (!dv?.date || typeof dv.pages !== "function") throw new Error("buildDesktopDischargeState: dv is required");
  if (!Array.isArray(allModels)) throw new Error("buildDesktopDischargeState: allModels is required");
  if (!today) throw new Error("buildDesktopDischargeState: today is required");
  if (!todayStart) throw new Error("buildDesktopDischargeState: todayStart is required");
  if (!todayStr) throw new Error("buildDesktopDischargeState: todayStr is required");
  if (!Array.isArray(holidays)) throw new Error("buildDesktopDischargeState: holidays is required");
  if (!DB_DISCHARGE_PATH) throw new Error("buildDesktopDischargeState: DB_DISCHARGE_PATH is required");
  if (!DISCHARGED_FOLDER) throw new Error("buildDesktopDischargeState: DISCHARGED_FOLDER is required");
  if (!_pfDesktopCore) throw new Error("buildDesktopDischargeState: _pfDesktopCore is required");
  if (!_pfScheduleCore) throw new Error("buildDesktopDischargeState: _pfScheduleCore is required");
  if (typeof _pfAsIso !== "function") throw new Error("buildDesktopDischargeState: _pfAsIso is required");
  if (typeof minusWorkDays !== "function") throw new Error("buildDesktopDischargeState: minusWorkDays is required");
  if (typeof safeDate !== "function") throw new Error("buildDesktopDischargeState: safeDate is required");
  const dayPhrasesMap = normalizeDayPhrases(_pfDesktopCore.DAY_PHRASES || {});

  const copiedSet = new Set();
  try {
    const dbFile = app.vault.getAbstractFileByPath(DB_DISCHARGE_PATH);
    if (dbFile) {
      const content = await app.vault.read(dbFile);
      String(content || "").split("\n").forEach(line => {
        const value = String(line || "").trim();
        if (value) copiedSet.add(value);
      });
    }
  } catch (_) { }

  const limitDateIso = _pfScheduleCore.addWorkDaysFromIso(_pfAsIso(today), 6, holidays);
  const limitDate = limitDateIso ? dv.date(limitDateIso).startOf("day") : null;
  const dischargeData = allModels
    .filter(m => _pfDesktopCore.isPlannedDischarge({
      endIso: m.end?.toISODate?.() || "",
      todayIso: todayStr,
      limitIso: limitDate?.toISODate?.() || ""
    }))
    .sort((a, b) => (a.end?.toMillis?.() ?? 0) - (b.end?.toMillis?.() ?? 0));

  const recentDischargeStart = minusWorkDays(todayStart, 4);
  const dischargedFolders = Array.from(new Set([
    DISCHARGED_FOLDER,
    String(DISCHARGED_FOLDER || "").startsWith("Архив/") ? "" : `Архив/${DISCHARGED_FOLDER}`
  ].map(folder => String(folder || "").trim()).filter(Boolean)));
  const dischargedPages = [];
  const seenDischargedPaths = new Set();
  dischargedFolders.forEach(folder => {
    try {
      dv.pages(`"${folder}"`).where(p => p.ФИО).forEach(p => {
        const path = String(p?.file?.path || "");
        if (path && seenDischargedPaths.has(path)) return;
        if (path) seenDischargedPaths.add(path);
        dischargedPages.push(p);
      });
    } catch (_) { }
  });
  const recentDischargedData = dischargedPages
    .map(p => {
      const exportedDate = safeDate(p["db_exported_at"] ?? p.db_exported_at);
      const endDate = safeDate(p.Дата_окончания_лечения);
      const baseDate = (exportedDate && exportedDate.isValid)
        ? exportedDate
        : ((endDate && endDate.isValid) ? endDate : null);
      return { p, date: baseDate ? baseDate.startOf("day") : null };
    })
    .filter(x => _pfDesktopCore.isRecentDischarge({
      dateIso: x.date?.toISODate?.() || "",
      startIso: recentDischargeStart?.toISODate?.() || "",
      todayIso: todayStr
    }))
    .sort((a, b) => (b.date?.toMillis?.() ?? 0) - (a.date?.toMillis?.() ?? 0));

  return {
    copiedSet,
    limitDateIso,
    limitDate,
    dischargeData,
    recentDischargeStart,
    recentDischargedData
  };
};

const renderDesktopDischargeTab = ({
  tab,
  state,
  app,
  todayStart,
  todayStr,
  getWorkDays,
  getPatientBadges,
  getPatientFilterHints,
  getFundingType,
  dayPhrases,
  DB_DISCHARGE_PATH,
  _pfDesktopCore,
  _h,
  _spacer,
  _HI_LOGOUT,
  notice = null,
  Notice = null
} = {}) => {
  if (!tab) throw new Error("renderDesktopDischargeTab: tab is required");
  if (!state) throw new Error("renderDesktopDischargeTab: state is required");
  if (!app?.vault) throw new Error("renderDesktopDischargeTab: app.vault is required");
  if (!todayStart) throw new Error("renderDesktopDischargeTab: todayStart is required");
  if (!todayStr) throw new Error("renderDesktopDischargeTab: todayStr is required");
  if (typeof getWorkDays !== "function") throw new Error("renderDesktopDischargeTab: getWorkDays is required");
  if (typeof getPatientBadges !== "function") throw new Error("renderDesktopDischargeTab: getPatientBadges is required");
  if (typeof getPatientFilterHints !== "function") throw new Error("renderDesktopDischargeTab: getPatientFilterHints is required");
  if (typeof getFundingType !== "function") throw new Error("renderDesktopDischargeTab: getFundingType is required");
  const dayPhrasesMap = normalizeDayPhrases(dayPhrases);
  if (!Object.keys(dayPhrasesMap).length) throw new Error("renderDesktopDischargeTab: dayPhrases is required");
  if (!DB_DISCHARGE_PATH) throw new Error("renderDesktopDischargeTab: DB_DISCHARGE_PATH is required");
  if (!_pfDesktopCore) throw new Error("renderDesktopDischargeTab: _pfDesktopCore is required");
  if (typeof _h !== "function") throw new Error("renderDesktopDischargeTab: _h is required");
  if (typeof _spacer !== "function") throw new Error("renderDesktopDischargeTab: _spacer is required");

  const notify = typeof notice === "function"
    ? notice
    : (typeof Notice === "function" ? (message) => new Notice(message) : (message) => console.log(message));

  const { copiedSet, dischargeData, recentDischargedData } = state;

  if (dischargeData.length === 0) {
    const emptyMsg = tab.createEl("div");
    emptyMsg.style.cssText = "text-align:center;color:var(--text-muted);padding:20px;font-size:0.9em;";
    emptyMsg.textContent = "Нет запланированных выписок на ближайшие 6 рабочих дней.";
  } else {
    _h(tab, `Планируемые выписки (${dischargeData.length})`, _HI_LOGOUT);

    dischargeData.forEach(x => {
      const daysLeft = getWorkDays(todayStart, x.end);
      const dateStr = x.end.toFormat("dd.MM.yyyy");
      const patBadges = getPatientBadges(x.p);
      const title = patBadges + (x.p.ФИО || x.p.file?.name || "");
      const uniqueKey = `${dateStr}_${title}`;
      const isCopied = copiedSet.has(uniqueKey);
      const meta = _pfDesktopCore.getPlannedDischargeCardMeta({
        title,
        fundingType: getFundingType(x.p),
        tags: x.p.file?.tags || [],
        currFrac: x.currFrac,
        frac: x.frac,
        dateLabel: dateStr,
        copied: isCopied,
        workDaysLeft: daysLeft,
        endWeekday: x.end.weekday,
        dayPhrases: dayPhrasesMap
      });

      const badgeHtml = meta.infos.map(i => `<span style="display:inline-block;font-size:0.78em;padding:1px 5px;background:rgba(100,100,100,0.1);border-radius:10px;margin-right:3px;color:var(--text-muted);font-weight:600;line-height:1.5;">${i}</span>`).join("");

      const container = tab.createEl("div");
      container.classList.add("rdt-task-card");
      container.dataset.filterHints = getPatientFilterHints(x.p);
      container.dataset.path = String(x.p?.file?.path || "");
      container.style.cssText = `position:relative;display:flex;align-items:stretch;background:var(--background-primary-alt);border:1px solid var(--background-modifier-border);border-left:3px solid ${meta.color};border-radius:6px;margin-bottom:3px;overflow:hidden;transition:all 0.2s ease;opacity:${meta.opacity};filter:${meta.bgFilter};`;

      const checkIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:100%;height:100%;"><polyline points="20 6 9 17 4 12"/></svg>`;
      const copyIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:100%;height:100%;"><rect width="13" height="13" x="9" y="9" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;

      const textDiv = container.createDiv();
      textDiv.style.cssText = "flex-grow:1;min-width:0;padding:5px 10px 5px 9px;cursor:pointer;transition:background 0.15s ease;";
      textDiv.innerHTML = `<div class='rdt-card-name' style='font-size:1em;font-weight:500;color:var(--text-normal);margin-bottom:2px;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;'>${title}</div><div style='margin-bottom:1px;line-height:1.3;'>${badgeHtml}</div><div style='font-size:0.85em;color:var(--text-muted);line-height:1.2;'>Фр. <b>${x.currFrac}/${x.frac}</b> · ост. <b>${meta.fractionsLeft}</b></div>`;
      textDiv.onmouseenter = () => { textDiv.style.background = "var(--background-modifier-hover)"; };
      textDiv.onmouseleave = () => { textDiv.style.background = ""; };
      textDiv.onclick = (e) => {
        e.stopPropagation();
        const f = app.vault.getAbstractFileByPath(x.p.file?.path || "");
        if (f) app.workspace.getLeaf(false).openFile(f);
      };

      const divider = container.createDiv();
      divider.style.cssText = `width:1px;background:var(--background-modifier-border);opacity:0.6;flex-shrink:0;`;

      const dateDiv = container.createDiv();
      dateDiv.style.cssText = `position:relative;text-align:center;flex-shrink:0;width:110px;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:5px 10px;cursor:pointer;overflow:hidden;transition:background 0.15s ease;`;
      dateDiv.innerHTML = `<div style="font-size:1em;font-weight:700;color:var(--text-normal);margin-bottom:1px;line-height:1.2;">${dateStr}</div><div style="font-size:0.78em;color:${meta.color};font-weight:600;line-height:1.2;">${meta.daysText}</div>`;

      const bgIcon = dateDiv.createDiv({ cls: "bg-icon" });
      bgIcon.innerHTML = isCopied ? checkIcon : copyIcon;
      bgIcon.style.cssText = `position:absolute;inset:0;display:flex;align-items:center;justify-content:center;opacity:${isCopied ? "0.12" : "0.08"};color:var(--text-normal);pointer-events:none;z-index:0;transition:all 0.3s ease;`;

      dateDiv.onmouseenter = () => { dateDiv.style.background = "var(--background-modifier-hover)"; bgIcon.style.opacity = isCopied ? "0.2" : "0.15"; };
      dateDiv.onmouseleave = () => { dateDiv.style.background = ""; bgIcon.style.opacity = isCopied ? "0.12" : "0.08"; };
      dateDiv.onclick = async (e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(meta.copyString).then(() => {
          notify(`Скопировано:\n${title}`);
          dateDiv.style.transform = "scale(0.95)";
          setTimeout(() => dateDiv.style.transform = "scale(1)", 100);
        });
        if (!isCopied) {
          try {
            let file = app.vault.getAbstractFileByPath(DB_DISCHARGE_PATH);
            if (!file) await app.vault.create(DB_DISCHARGE_PATH, uniqueKey);
            else await app.vault.append(file, "\n" + uniqueKey);
            container.style.opacity = "0.8";
            container.style.filter = "grayscale(0.3)";
            bgIcon.innerHTML = checkIcon;
            bgIcon.style.opacity = "0.2";
          } catch (err) { console.error("DB Error", err); }
        }
      };
    });
  }

  if (recentDischargedData.length > 0) {
    if (dischargeData.length > 0) _spacer(tab);
    _h(tab, `Последние выписанные (5 раб. дней) (${recentDischargedData.length})`, _HI_LOGOUT);

    recentDischargedData.forEach(x => {
      const dateStr = x.date ? x.date.toFormat("dd.MM.yyyy") : "—";
      const wdAgo = x.date ? Math.max(0, getWorkDays(x.date, todayStart)) : 0;
      const title = getPatientBadges(x.p) + (x.p.ФИО || x.p.file?.name || "");
      const meta = _pfDesktopCore.getRecentDischargeCardMeta({
        title,
        fundingType: getFundingType(x.p),
        tags: x.p.file?.tags || [],
        dateLabel: dateStr,
        workDaysAgo: wdAgo
      });
      const badgeHtml = meta.infos.map(i => `<span style="display:inline-block;font-size:0.78em;padding:1px 5px;background:rgba(100,100,100,0.1);border-radius:10px;margin-right:3px;color:var(--text-muted);font-weight:600;line-height:1.5;">${i}</span>`).join("");

      const container = tab.createEl("div");
      container.classList.add("rdt-task-card");
      container.dataset.filterHints = getPatientFilterHints(x.p);
      container.dataset.path = String(x.p?.file?.path || "");
      container.style.cssText = `display:flex;align-items:stretch;background:var(--background-primary-alt);border:1px solid var(--background-modifier-border);border-left:3px solid ${meta.color};border-radius:6px;margin-bottom:3px;overflow:hidden;transition:all 0.2s ease;`;

      const textDiv = container.createDiv();
      textDiv.style.cssText = "flex-grow:1;min-width:0;padding:5px 10px 5px 9px;cursor:pointer;transition:background 0.15s ease;";
      textDiv.innerHTML = `<div class='rdt-card-name' style='font-size:1em;font-weight:500;color:var(--text-normal);margin-bottom:2px;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;'>${meta.title}</div><div style='margin-bottom:1px;line-height:1.3;'>${badgeHtml}</div><div style='font-size:0.85em;color:var(--text-muted);line-height:1.2;'>Выписка: <b>${meta.dateLabel}</b> · ${meta.agoText}</div>`;
      textDiv.onmouseenter = () => { textDiv.style.background = "var(--background-modifier-hover)"; };
      textDiv.onmouseleave = () => { textDiv.style.background = ""; };
      textDiv.onclick = (e) => {
        e.stopPropagation();
        const f = app.vault.getAbstractFileByPath(x.p.file?.path || "");
        if (f) app.workspace.getLeaf(false).openFile(f);
      };
    });
  }
};

module.exports = {
  buildDesktopDischargeState,
  renderDesktopDischargeTab
};
