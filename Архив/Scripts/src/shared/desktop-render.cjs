/**
 * Shared Desktop Rendering Logic
 */
const buildDesktopRender = async (context) => {
    const {
        app, dv, _pfDesktopCore, _dbPatchFrontmatter, _dbMoveFileToFolder,
        tabContainers, getPatientBadges, getPatientFilterHints,
        _h, _subh, _spacer, todayStart, getWorkDays, fmt, calcPercentWaiting, _DOT,
        switchTab, _setActivePreset, todayStr, holidays,
        activeTab, applyCardFilter,
        admitting, waiting, active, discharging, listSearchOnly,
        allReminders, overdueConsultations, elnVkItems, overdueVkItems,
        overdueMarkupsArr, overdueReMarkups, contourPlan, reContours, overdueEnds,
        listMarkup, listReMarkup, listContour, listWaiting, listTreatment,
        treatmentWithFractionToday, treatmentBreakToday, treatmentOther,
        _HI_BELL, _HI_PHONE, _HI_LOGOUT, _HI_USRPLUS, _HI_ALERT, _HI_CALCHK, _HI_PEN, _HI_TARGET, _HI_CLOCK, _HI_PULSE,
        getReminderFilterHints, _dischargePatientFile, _dateh, buildPrescText, nextWorkDay, safeDate, minusWorkDays, calcPercentMarkup, calcPercentContour, dayPhrases, consultations, scheduledConsultations, ends, allAdmissions, markups, reMarkups,
        today
    } = context;

    const _desktopRenderNow = () => (typeof performance !== "undefined" && typeof performance.now === "function" ? performance.now() : Date.now());
    const _desktopRenderBootAt = _desktopRenderNow();
    const _desktopRenderLog = (message) => {
        try { console.info(`[desktop-render] ${message}`); } catch (_) { }
    };
    const _desktopRunApplyCardFilter = () => {
        if (typeof applyCardFilter === "function") {
            try { applyCardFilter(); } catch (error) { console.error("[desktop-render] applyCardFilter", error); }
        }
    };
    const _desktopSchedule = (task) => {
        if (typeof requestAnimationFrame === "function") {
            requestAnimationFrame(() => {
                try { task(); } catch (error) { console.error("[desktop-render] schedule", error); }
            });
            return;
        }
        setTimeout(() => {
            try { task(); } catch (error) { console.error("[desktop-render] schedule", error); }
        }, 0);
    };

// ────────────────────────────────────────────────────────────────
// 11. ТАБ "ОПЕРАТИВКА"
// ────────────────────────────────────────────────────────────────
const _renderOperativka = () => {
    const tab = tabContainers.operativka;

    // --- Статистика ---
    const statGrid = tab.createEl('div', { cls: 'rdt-stat-grid' });
    const _SI_ADMIT = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>`;
    const _SI_PLAN = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;
    const _SI_TREAT = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>`;
    const _SI_DISCHARGE = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`;
    [
        { icon: _SI_ADMIT, label: 'Госпитализация', sub: 'сегодня', value: admitting, color: '#4caf50', tab: 'operativka', preset: null },
        { icon: _SI_PLAN, label: 'Планирование', sub: 'в работе', value: waiting, color: '#9e9e9e', tab: 'planning', preset: null },
        { icon: _SI_TREAT, label: 'На лечении', sub: 'пациентов', value: active, color: '#2196f3', tab: 'treatment', preset: null },
        { icon: _SI_DISCHARGE, label: 'Выписки', sub: 'ближайшие', value: discharging, color: '#ff9800', tab: 'discharge', preset: null },
    ].forEach(item => {
        const cell = statGrid.createDiv();
        const isZero = item.value === 0;
        cell.style.cssText = `background:var(--background-primary-alt);border:1px solid var(--background-modifier-border);border-left:3px solid ${item.color};border-radius:6px;padding:6px 8px;display:flex;align-items:center;gap:8px;cursor:pointer;transition:box-shadow 0.15s,background 0.15s;`;
        cell.innerHTML = `<span style="color:${isZero ? 'var(--text-muted)' : item.color};flex-shrink:0;display:inline-flex;opacity:${isZero ? 0.38 : 1};">${item.icon}</span><div style="min-width:0;flex:1;"><div style="font-size:0.73em;color:var(--text-muted);line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${item.label}</div><div style="display:flex;align-items:baseline;gap:4px;"><span style="font-size:1.2em;font-weight:700;color:${isZero ? 'var(--text-muted)' : item.color};line-height:1.1;">${item.value}</span><span style="font-size:0.68em;color:var(--text-muted);opacity:0.65;white-space:nowrap;">${item.sub}</span></div></div>`;
        cell.onmouseenter = () => { cell.style.boxShadow = `0 2px 8px ${item.color}30`; cell.style.background = item.color + "0a"; };
        cell.onmouseleave = () => { cell.style.boxShadow = ""; cell.style.background = "var(--background-primary-alt)"; };
        cell.onclick = () => { switchTab(item.tab); _setActivePreset("all"); };
    });

    
    // --- Иконки (общие для всего блока) ---
    const _iconCheck = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
    const _iconCross = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
    const _iconMove = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>`;
    const _iconPresc = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`;
    const _iconCal = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line><line x1="12" y1="14" x2="12" y2="18"></line><line x1="10" y1="16" x2="14" y2="16"></line></svg>`;

    // --- Карточка оперативки (универсальная) ---
    const renderOpCard = (parent, name, path, title, subTitle, color, actionType, borderStyle = "solid", prescText = null, filterHints = "", cardOptions = {}) => {
        const container = parent.createEl("div");
        container.classList.add("rdt-task-card");
        container.dataset.filterHints = String(filterHints || "");
        container.dataset.path = String(path || "");
        if (cardOptions.consultFilterOnly) container.dataset.consultFilterOnly = "1";
        if (cardOptions.excludeConsultFilter) container.dataset.excludeConsultFilter = "1";
        if (cardOptions.vkFilterOnly) container.dataset.vkReminderCard = "1";
        container.style.cssText = `display:flex;justify-content:space-between;align-items:stretch;background:var(--background-primary-alt);border:1px solid var(--background-modifier-border);border-left:3px ${borderStyle} ${color};border-radius:6px;padding:0 0 0 9px;margin-bottom:3px;overflow:hidden;transition:opacity 0.5s ease,filter 0.5s ease;`;
        // Лёгкий цветовой фон для срочных и просроченных карточек
        if (color === "#ff5252") container.style.background = "rgba(255,82,82,0.05)";
        else if (color === "#ff9800") container.style.background = "rgba(255,152,0,0.04)";
        const textDiv = container.createDiv();
        textDiv.style.cssText = "flex-grow:1;min-width:0;margin-right:8px;align-self:center;padding:5px 0;";
        const overlay = `<span style='position:absolute;top:0;left:0;width:100%;height:100%;z-index:0;'></span>`;
        textDiv.innerHTML = `<div class='rdt-op-main' style='position:relative;font-size:1em;margin-bottom:2px;display:flex;align-items:center;min-width:0;'><a class='internal-link' href='${path}' style='text-decoration:none;color:var(--text-normal);font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0;'>${name}${overlay}</a></div><div class='rdt-op-meta' style='display:flex;justify-content:space-between;align-items:center;font-size:0.85em;color:var(--text-muted);'><div class='rdt-op-title' style='min-width:0;flex:1;margin-right:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;'>${title}</div><div class='rdt-op-sub' style='text-align:right;white-space:nowrap;'>${subTitle}</div></div>`;
        if (!actionType) return container;

        const btnDiv = container.createDiv();
        btnDiv.style.cssText = "flex-shrink:0;z-index:2;display:flex;align-items:stretch;";
        const _sep0 = btnDiv.createDiv(); _sep0.style.cssText = "width:1px;background:var(--background-modifier-border);flex-shrink:0;margin:4px 0;";

        const createBtn = (iconSvg, hoverColor, onClick) => {
            if (btnDiv.children.length > 1) { const sep = btnDiv.createDiv(); sep.style.cssText = "width:1px;background:var(--background-modifier-border);flex-shrink:0;margin:4px 0;"; }
            const btn = btnDiv.createEl("button");
            btn.style.cssText = `cursor:pointer;display:flex;align-items:center;justify-content:center;width:42px;height:100%;min-height:36px;background:transparent;border:none;color:var(--text-muted);padding:0;transition:all 0.2s ease;`;
            btn.innerHTML = iconSvg;
            btn.onmouseenter = () => { btn.style.background = hoverColor + "22"; btn.style.color = hoverColor; };
            btn.onmouseleave = () => { btn.style.background = "transparent"; btn.style.color = "var(--text-muted)"; };
            btn.onclick = async (e) => { e.stopPropagation(); e.preventDefault(); await onClick(btn); };
            return btn;
        };
        const hospitalizationSickAction = _pfDesktopCore.parseHospitalizationSickAction(actionType);
        const removeVkAction = _pfDesktopCore.parseRemoveVkAction(actionType);

        if (prescText) {
            createBtn(_iconPresc, "#2196f3", async (btn) => {
                await navigator.clipboard.writeText(prescText);
                new Notice("── Предписание скопировано!");
                btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2196f3" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
                setTimeout(() => { btn.innerHTML = _iconPresc; }, 1500);
            });
        }

        if (actionType === 'CONSULTATION') {
            const isConsultFolder = path.startsWith("Консультации/");
            const cleanConsultName = (name) => _pfDesktopCore.cleanConsultationFileName(name);

            createBtn(_iconCross, "#ff5252", async () => {
                container.style.opacity = "0.4"; container.style.filter = "grayscale(100%)";
                const tFile = app.vault.getAbstractFileByPath(path); if (!tFile) return;
                if (!app.vault.getAbstractFileByPath("Не начали")) await app.vault.createFolder("Не начали");
                await _dbPatchFrontmatter(tFile, fm => {
                    Object.assign(fm, _pfDesktopCore.getConsultationRejectPatch());
                }, { reread: false });
                await _dbMoveFileToFolder(tFile, "Не начали", { fileName: cleanConsultName(tFile.name) });
                new Notice(`Отказ по консультации: ${name}`);
                setTimeout(() => container.style.display = "none", 600);
            });

            createBtn(_iconCheck, "#4caf50", async () => {
                container.style.opacity = "0.4"; container.style.filter = "grayscale(100%)";
                const tFile = app.vault.getAbstractFileByPath(path); if (!tFile) return;

                if (isConsultFolder) {
                    if (!app.vault.getAbstractFileByPath("Пациенты")) await app.vault.createFolder("Пациенты");
                    await _dbPatchFrontmatter(tFile, fm => {
                        Object.assign(fm, _pfDesktopCore.getConsultationAcceptPatch(true));
                    }, { reread: false });
                    await _dbMoveFileToFolder(tFile, "Пациенты", { fileName: cleanConsultName(tFile.name) });
                } else {
                    // Файл уже в Пациенты/ — НЕ трогаем Дата_консультации,
                    // чтобы откат в карточке пациента знал что файл не нужно перемещать в Консультации/
                    await _dbPatchFrontmatter(tFile, fm => {
                        Object.assign(fm, _pfDesktopCore.getConsultationAcceptPatch(false));
                    }, { reread: false });
                }

                new Notice(`Принят на лечение: ${name}`);
                setTimeout(() => container.style.display = "none", 600);
            });
        } else if (hospitalizationSickAction.isHospitalizationSick) {
            if (hospitalizationSickAction.showVkBtn) {
                createBtn(_iconCal, "#ff9800", async (btn) => {
                    try {
                        const tFile = app.vault.getAbstractFileByPath(path); if (!tFile) return;
                        const admDate = dv.date(hospitalizationSickAction.admissionDateRaw); if (!admDate) return;
                        const payload = _pfDesktopCore.buildVkElnReminderPayload({
                            admissionIso: admDate.startOf("day").toISODate(),
                            selectedIso: todayStr,
                            todayIso: todayStr,
                            holidays: Array.from(holidays)
                        });
                        if (!payload) return;
                        const targetDate = dv.date(payload.targetIso);
                        await _dbPatchFrontmatter(tFile, fm => {
                            Object.assign(fm, _pfDesktopCore.getAddVkReminderPatch(fm.Напоминания, payload.targetIso, payload.reminderText));
                        }, { reread: false });
                        new Notice(`? Напоминание ВК на ${targetDate.toFormat("dd.MM.yyyy")}`);
                        btn.style.display = "none";
                    } catch (err) { console.error(err); new Notice("? Ошибка ВК"); }
                });
            }
            createBtn(_iconCheck, "#4caf50", async () => {
                container.style.opacity = "0.4"; container.style.filter = "grayscale(100%)";
                const tFile = app.vault.getAbstractFileByPath(path); if (!tFile) return;
                await _dbPatchFrontmatter(tFile, fm => { Object.assign(fm, _pfDesktopCore.getHospitalizationSickPatch()); }, { reread: false });
                setTimeout(() => container.style.display = "none", 600);
                new Notice(`Госпитализирован: ${name}`);
            });
        } else {
            const icon = _pfDesktopCore.getActionIconKey(actionType) === "move" ? _iconMove : _iconCheck;
            createBtn(icon, color, async () => {
                const tFile = app.vault.getAbstractFileByPath(path); if (!tFile) return;
                container.style.opacity = "0.4"; container.style.filter = "grayscale(100%)"; container.style.pointerEvents = "none";
                try {
                    if (actionType === 'MOVE') {
                        const _res = await _dischargePatientFile(tFile, { source: "desktop-task-card" });
                        if (!_res?.ok) throw (_res?.error || new Error("Не удалось выписать пациента"));
                        new Notice(`Выписан и записан в БД: ${name}`);
                    } else if (removeVkAction.isRemoveVk) {
                        await _dbPatchFrontmatter(tFile, fm => {
                            Object.assign(fm, _pfDesktopCore.getRemoveVkPatch(fm["Очередное_ВК"], removeVkAction.dateIso));
                        }, { reread: false });
                        new Notice(`ВК пройдено`);
                    } else if (actionType === "Переразметка") {
                        await _dbPatchFrontmatter(tFile, fm => { Object.assign(fm, _pfDesktopCore.getRemarkupDonePatch()); }, { reread: false });
                        new Notice(`Переразметка выполнена ? оконтуривание разблокировано: ${name}`);
                    } else {
                        await _dbPatchFrontmatter(tFile, fm => { Object.assign(fm, _pfDesktopCore.getSetFlagPatch(actionType)); }, { reread: false });
                        new Notice(`Выполнено: ${name}`);
                    }
                    setTimeout(() => container.style.display = "none", 600);
                } catch (err) {
                    console.error(err);
                    container.style.opacity = "1"; container.style.filter = "none"; container.style.pointerEvents = "auto";
                    new Notice("? Ошибка: " + (err?.message || err));
                }
            });
        }
        return container;
    };

    const renderDischargeCards = (parent, { includeHeader = false, includeEmpty = false } = {}) => {
        if (!(ends.length || overdueEnds.length)) {
            if (includeEmpty) {
                const emptyMsg = parent.createEl("div");
                emptyMsg.style.cssText = "text-align:center;color:var(--text-muted);padding:20px;font-size:0.9em;";
                emptyMsg.textContent = "Нет пациентов на выписке";
            }
            return false;
        }

        if (includeHeader) _h(parent, "Выписка", _HI_LOGOUT);
        let needsSpacer = false;

        overdueEnds.forEach(d => {
            const days = Math.abs(getWorkDays(d.end, todayStart));
            const meta = _pfDesktopCore.getDischargeCardMeta({
                tags: d.p.file.tags,
                isSick: d.isSick,
                vmpGroup: d.p["Группа ВМП"],
                overdue: true
            });
            if (needsSpacer) _spacer(parent);
            renderOpCard(parent, getPatientBadges(d.p) + d.p.file.name, d.p.file.path,
                `<span style='color:#ff5252;font-weight:bold;'>Выписка просрочена (${d.end.toFormat("dd.MM.yyyy")}) · ${days} раб.дн.</span>`,
                meta.sub, meta.color, "MOVE", meta.borderStyle, null, getPatientFilterHints(d.p));
            needsSpacer = true;
        });

        ends.forEach(d => {
            const meta = _pfDesktopCore.getDischargeCardMeta({
                tags: d.p.file.tags,
                isSick: d.isSick,
                vmpGroup: d.p["Группа ВМП"],
                overdue: false
            });
            if (needsSpacer) _spacer(parent);
            renderOpCard(parent, getPatientBadges(d.p) + d.p.file.name, d.p.file.path, meta.title, meta.sub, meta.color, "MOVE", meta.borderStyle, null, getPatientFilterHints(d.p));
            needsSpacer = true;
        });

        return true;
    };

    // --- Напоминания ---
    let hasOp = false;
    if (allReminders.length > 0) {
        _h(tab, "Напоминания", _HI_BELL);
        allReminders.forEach(item => {
            const reminderMeta = _pfDesktopCore.getReminderCardState({
                patientPath: item.patient?.file?.path,
                filterHints: getReminderFilterHints(item),
                reminderText: item.reminder.текст,
                dateIso: item.date.toISODate(),
                todayIso: todayStr,
                overdueWorkDays: item.date < todayStart ? Math.abs(getWorkDays(item.date, todayStart)) : 0
            });

            const container = tab.createEl("div");
            container.classList.add("rdt-task-card");
            container.dataset.filterHints = reminderMeta.dataset.filterHints;
            container.dataset.path = reminderMeta.dataset.path;
            container.dataset.vkReminderCard = reminderMeta.dataset.vkReminderCard;
            container.dataset.futureReminderCard = reminderMeta.dataset.futureReminderCard;
            if (reminderMeta.hidden) container.classList.add("rdt-hidden");
            container.style.cssText = `display:flex;justify-content:space-between;align-items:stretch;background:var(--background-primary-alt);border:1px solid var(--background-modifier-border);border-left:3px solid ${reminderMeta.color};border-radius:6px;padding:0 0 0 9px;margin-bottom:3px;overflow:hidden;`;
            let htmlContent = `<div style="flex-grow:1;min-width:0;margin-right:8px;align-self:center;padding:6px 0;"><div style="font-size:1em;margin-bottom:4px;line-height:1.2;display:flex;align-items:center;min-width:0;"><a class='internal-link' href='${item.patient.file.path}' style='text-decoration:none;color:var(--text-normal);font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0;'>${getPatientBadges(item.patient)}${item.patient.file.name}</a></div><div style="font-size:0.9em;color:var(--text-normal);margin-bottom:${reminderMeta.statusText ? '4px' : '0'};line-height:1.3;white-space:normal;overflow-wrap:anywhere;">${item.reminder.текст}</div>`;
            if (reminderMeta.isFuture) htmlContent += `<div style="font-size:0.8em;color:#1e88e5;font-weight:600;">Запланировано на ${item.date.toFormat("dd.MM.yyyy")}</div>`;

            let nextVkDateForBtn = null;
            let nextVkTargetIso = "";
            if (reminderMeta.isVkEln) {
                const admissionIso = item.patient.Дата_начала_лечения ? dv.date(item.patient.Дата_начала_лечения)?.startOf("day")?.toISODate() : "";
                const nextVkInfo = _pfDesktopCore.getNextVkElnReminderInfo({
                    admissionIso,
                    todayIso: todayStr,
                    holidays: Array.from(holidays)
                });
                nextVkTargetIso = nextVkInfo.targetIso;
                nextVkDateForBtn = nextVkTargetIso ? dv.date(nextVkTargetIso) : null;
                if (nextVkDateForBtn) htmlContent += `<div style="margin-top:4px;padding-top:4px;border-top:1px solid var(--background-modifier-border);font-size:0.8em;color:var(--text-muted);display:flex;gap:10px;"><span style="display:inline-flex;align-items:center;gap:3px;">${_HI_CLOCK} Дней: <b style="color:var(--text-normal)">${nextVkInfo.daysInHospLabel}</b></span><span style="display:inline-flex;align-items:center;gap:3px;">${_HI_CALCHK} След. ВК: <b style="color:#ff9800">${nextVkDateForBtn.toFormat("dd.MM.yyyy")}</b></span></div>`;
            }
            if (reminderMeta.statusText) htmlContent += `<div style="font-size:0.8em;color:${reminderMeta.color};font-weight:600;">${reminderMeta.statusText}</div>`;
            htmlContent += `</div>`;
            container.innerHTML = htmlContent;

            const btnDiv = container.createDiv();
            btnDiv.style.cssText = "flex-shrink:0;display:flex;align-items:stretch;";
            const _s1 = btnDiv.createDiv(); _s1.style.cssText = "width:1px;background:var(--background-modifier-border);flex-shrink:0;margin:4px 0;";

            const alreadyExists = reminderMeta.isVkEln && nextVkTargetIso
                ? _pfDesktopCore.hasVkReminderOnDate(item.patient.Напоминания, nextVkTargetIso, value => dv.date(value)?.toISODate() || "")
                : false;
            if (reminderMeta.isVkEln && nextVkDateForBtn && !alreadyExists) {
                const addNextBtn = btnDiv.createEl("button");
                addNextBtn.innerHTML = _iconCal;
                addNextBtn.style.cssText = `cursor:pointer;display:flex;align-items:center;justify-content:center;width:42px;height:100%;min-height:36px;background:transparent;border:none;color:var(--text-muted);padding:0;transition:all 0.2s ease;`;
                addNextBtn.onmouseenter = () => { addNextBtn.style.background = "#ff980022"; addNextBtn.style.color = "#ff9800"; };
                addNextBtn.onmouseleave = () => { addNextBtn.style.background = "transparent"; addNextBtn.style.color = "var(--text-muted)"; };
                addNextBtn.onclick = async (e) => {
                    e.stopPropagation();
                    try {
                        const tFile = app.vault.getAbstractFileByPath(item.patient.file.path);
                        await _dbPatchFrontmatter(tFile, fm => {
                            Object.assign(fm, _pfDesktopCore.getAddVkReminderPatch(fm.Напоминания, nextVkTargetIso));
                        }, { reread: false });
                        new Notice(`? Добавлено ВК на ${nextVkDateForBtn.toFormat("dd.MM.yyyy")}`);
                        addNextBtn.remove();
                    } catch (err) { console.error(err); }
                };
            }
            // ── Кнопка «+1 рабочий день» ──
            { const sep = btnDiv.createDiv(); sep.style.cssText = "width:1px;background:var(--background-modifier-border);flex-shrink:0;margin:4px 0;"; }
            const snoozeBtn = btnDiv.createEl("button");
            snoozeBtn.title = "Отложить на +1 рабочий день";
            snoozeBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/><line x1="17" y1="3" x2="21" y2="7"/><line x1="21" y1="3" x2="17" y2="7"/></svg>`;
            snoozeBtn.style.cssText = `cursor:pointer;display:flex;align-items:center;justify-content:center;width:42px;height:100%;min-height:36px;background:transparent;border:none;color:var(--text-muted);padding:0;transition:all 0.2s ease;`;
            snoozeBtn.onmouseenter = () => { snoozeBtn.style.background = "#9c27b022"; snoozeBtn.style.color = "#9c27b0"; };
            snoozeBtn.onmouseleave = () => { snoozeBtn.style.background = "transparent"; snoozeBtn.style.color = "var(--text-muted)"; };
            snoozeBtn.onclick = async (e) => {
                e.stopPropagation();
                try {
                    const tFile = app.vault.getAbstractFileByPath(item.patient.file.path);
                    const newDate = nextWorkDay(item.date);
                    await _dbPatchFrontmatter(tFile, fm => {
                        Object.assign(fm, _pfDesktopCore.getSnoozeReminderPatch(fm.Напоминания, item.index, newDate.toFormat("yyyy-MM-dd")));
                    }, { reread: false });
                    container.style.display = "none";
                    new Notice(`? Отложено до ${newDate.toFormat("dd.MM.yyyy")}`);
                } catch (err) { console.error(err); new Notice("? Ошибка"); }
            };
            // ── Кнопка «Готово» ──
            { const sep = btnDiv.createDiv(); sep.style.cssText = "width:1px;background:var(--background-modifier-border);flex-shrink:0;margin:4px 0;"; }
            const doneBtn = btnDiv.createEl("button");
            doneBtn.innerHTML = _iconCheck;
            doneBtn.style.cssText = `cursor:pointer;display:flex;align-items:center;justify-content:center;width:42px;height:100%;min-height:36px;background:transparent;border:none;color:var(--text-muted);padding:0;transition:all 0.2s ease;`;
            doneBtn.onmouseenter = () => { doneBtn.style.background = "#4caf5022"; doneBtn.style.color = "#4caf50"; };
            doneBtn.onmouseleave = () => { doneBtn.style.background = "transparent"; doneBtn.style.color = "var(--text-muted)"; };
            doneBtn.onclick = async (e) => {
                e.stopPropagation();
                try {
                    const tFile = app.vault.getAbstractFileByPath(item.patient.file.path);
                    await _dbPatchFrontmatter(tFile, fm => { Object.assign(fm, _pfDesktopCore.getCompleteReminderPatch(fm.Напоминания, item.index)); }, { reread: false });
                    container.style.display = "none";
                    new Notice("? Напоминание выполнено!");
                } catch (err) { console.error(err); }
            };
        });
        hasOp = true;
    }

    // --- Консультации ---
    if (consultations.length || overdueConsultations.length) {
        if (hasOp) _spacer(tab);
        _h(tab, "Консультации", _HI_PHONE);
        overdueConsultations.forEach(c => {
            const meta = _pfDesktopCore.getOverdueConsultationCardMeta({
                name: c.name,
                snils: c.snils,
                dateShortLabel: c.date.toFormat("dd.MM"),
                dateLabel: c.date.toFormat("dd.MM.yyyy"),
                overdueWorkDays: Math.abs(getWorkDays(c.date.startOf("day"), todayStart))
            });
            renderOpCard(tab, meta.name, c.file.path, meta.title, meta.sub, meta.color, meta.action, meta.borderStyle, null, meta.filterHints, meta.options);
        });
        consultations.forEach(c => {
            const displayTitle = c.displayName || `${c.mkb} ${c.fio}, ${c.age}`;
            const meta = _pfDesktopCore.getTodayConsultationCardMeta({
                displayTitle,
                time: c.time,
                snils: c.snils,
                hasConsultField: c.hasConsultField
            });
            renderOpCard(tab, meta.title, c.file.path, meta.sub, "", meta.color, meta.action, meta.borderStyle, null, meta.filterHints, meta.options);
        });
        hasOp = true;
    }

    if (scheduledConsultations.length) {
        if (hasOp) _spacer(tab);
        let currentDateIso = "";
        scheduledConsultations.forEach(item => {
            if (item.dateIso !== currentDateIso) {
                currentDateIso = item.dateIso;
                _dateh(tab, `Консультации на ${item.consultAt.toFormat("dd.MM.yyyy")}`);
            }
            const displayTitle = item.displayName || `${item.mkb} ${item.fio}, ${item.age}`;
            const meta = _pfDesktopCore.getScheduledConsultationCardMeta({
                displayTitle,
                dateIso: item.dateIso,
                todayIso: todayStr,
                dateLabel: item.consultAt.toFormat("dd.MM.yyyy"),
                dateTimeLabel: item.consultAt.toFormat("dd.MM.yyyy HH:mm"),
                time: item.time,
                snils: item.snils,
                source: item.source
            });
            renderOpCard(
                tab,
                meta.title,
                item.file.path,
                meta.heading,
                meta.sub,
                meta.color,
                meta.action,
                meta.borderStyle,
                null,
                meta.filterHints,
                meta.options
            );
        });
        hasOp = true;
    }

    // --- Выписка ---
    if (ends.length || overdueEnds.length) {
        if (hasOp) _spacer(tab);
        if (renderDischargeCards(tab, { includeHeader: true })) hasOp = true;
    }

    // --- Госпитализация (сегодняшние + просроченные в одной секции) ---
    if (allAdmissions.length) {
        if (hasOp) _spacer(tab);
        _h(tab, "Госпитализация", _HI_USRPLUS);
        allAdmissions.forEach(d => {
            const tags = (d.p.file.tags || []).map(t => t.toLowerCase());
            let borderStyle = tags.some(t => t.includes("кс")) ? "dashed" : "solid";
            const meta = _pfDesktopCore.getHospitalizationCardMeta({
                isOverdue: d.isOverdue === true,
                isSick: d.isSick === true,
                startIso: d.start?.toISODate?.() || "",
                startLabel: d.start?.toFormat?.("dd.MM.yyyy") || "—",
                overdueWorkDays: d.isOverdue ? Math.abs(getWorkDays(d.start, todayStart)) : 0,
                snils: d.p.СНИЛС,
                hasActiveVk: _pfDesktopCore.hasActiveVkReminder(d.p.Напоминания)
            });
            renderOpCard(tab, getPatientBadges(d.p) + d.p.file.name, d.p.file.path, meta.title, meta.sub, meta.color, meta.actionKey, borderStyle, null, getPatientFilterHints(d.p));
        });
        hasOp = true;
    }

    // --- ВК ---
    if (elnVkItems.length || overdueVkItems.length) {
        if (hasOp) _spacer(tab);
        _h(tab, "Очередное ВК", _HI_CALCHK);
        overdueVkItems.forEach(item => {
            const days = Math.abs(getWorkDays(item.date.startOf("day"), todayStart));
            const meta = _pfDesktopCore.getVkCardMeta({
                dateIso: item.date.toISODate(),
                dateLabel: item.date.toFormat("dd.MM"),
                isOverdue: true,
                overdueWorkDays: days
            });
            renderOpCard(tab, getPatientBadges(item.p) + item.p.file.name, item.p.file.path,
                meta.title, meta.sub,
                meta.color, meta.actionKey, "solid", null, `${getPatientFilterHints(item.p)} вк продление элн`, { vkFilterOnly: true });
        });
        elnVkItems.forEach(item => {
            const meta = _pfDesktopCore.getVkCardMeta({ dateIso: item.date.toISODate() });
            renderOpCard(tab, getPatientBadges(item.p) + item.p.file.name, item.p.file.path, meta.title, meta.sub, meta.color, meta.actionKey, "solid", null, `${getPatientFilterHints(item.p)} вк продление элн`, { vkFilterOnly: true });
        });
        hasOp = true;
    }

    // --- Оконтуривание ---
    if (contourPlan.length || reContours.length) {
        if (hasOp) _spacer(tab);
        _h(tab, "Оконтуривание", _HI_PEN);
        if (contourPlan.length > 0 && reContours.length > 0) _subh(tab, "Первичное");
        contourPlan.forEach(d => {
            const dl = d.contourDeadline;
            const wdLeft = getWorkDays(todayStart, dl);
            const meta = _pfDesktopCore.getContourCardMeta({
                dateLabel: dl ? dl.toFormat("dd.MM.yyyy") : "—",
                workDaysLeft: wdLeft
            });
            renderOpCard(tab, getPatientBadges(d.p) + d.p.file.name, d.p.file.path, meta.title, meta.sub, meta.color, meta.action, "solid", buildPrescText(d.p), getPatientFilterHints(d.p));
        });
        if (contourPlan.length > 0 && reContours.length > 0) _subh(tab, "Повторное");
        reContours.forEach(d => {
            const remarkDt = d.remarkDate;
            const dl = d.recontourDeadline;
            const wdLeft = dl ? getWorkDays(todayStart, dl) : null;
            const meta = _pfDesktopCore.getContourCardMeta({
                title: "Повторное оконтуривание",
                datePrefix: "Переразметка: ",
                dateLabel: remarkDt ? remarkDt.toFormat("dd.MM.yyyy") : "—",
                workDaysLeft: wdLeft,
                defaultColor: "#e65100"
            });
            renderOpCard(tab, getPatientBadges(d.p) + d.p.file.name, d.p.file.path, meta.title, meta.sub, meta.color, meta.action, "solid", buildPrescText(d.p), getPatientFilterHints(d.p));
        });
        hasOp = true;
    }

    // --- Разметка (включая переразметку) ---
    const activeMarkups = markups.filter(p => !p.Разметка);
    const allMarkupCards = [];

    // Просроченные первичные разметки (добавляем первыми — красный цвет)
    overdueMarkupsArr.forEach(p => {
        const mDate = dv.date(p.Дата_разметки);
        const days = mDate ? Math.abs(getWorkDays(mDate.startOf("day"), todayStart)) : 0;
        const meta = _pfDesktopCore.getInitialMarkupCardMeta({
            goal: p.Цель_лечения,
            isOverdue: true,
            overdueWorkDays: days,
            markLabel: mDate ? mDate.toFormat("dd.MM.yyyy") : "—"
        });
        allMarkupCards.push({
            p,
            ...meta,
            sortVal: mDate ? mDate.toMillis() : 0
        });
    });

    activeMarkups.forEach(p => {
        const mDate = dv.date(p.Дата_разметки);
        const meta = _pfDesktopCore.getInitialMarkupCardMeta({
            goal: p.Цель_лечения,
            isOverdue: false,
            markTime: mDate ? mDate.toFormat("HH:mm") : "—"
        });
        allMarkupCards.push({
            p,
            ...meta,
            sortVal: mDate ? mDate.toMillis() : Number.MAX_SAFE_INTEGER
        });
    });

    overdueReMarkups.forEach(p => {
        const rd = dv.date(p.Дата_переразметки);
        const da = rd ? Math.round((todayStart - rd.startOf("day")) / (1000 * 60 * 60 * 24)) : 0;
        const meta = _pfDesktopCore.getRemarkupCardMeta({
            isOverdue: true,
            overdueDays: da,
            dateTimeLabel: rd ? rd.toFormat("dd.MM.yyyy HH:mm") : ""
        });
        allMarkupCards.push({
            p,
            ...meta,
            sortVal: rd ? rd.toMillis() : Number.MAX_SAFE_INTEGER
        });
    });

    reMarkups.forEach(p => {
        const rd = dv.date(p.Дата_переразметки);
        const meta = _pfDesktopCore.getRemarkupCardMeta({
            isOverdue: false,
            timeLabel: rd ? rd.toFormat("HH:mm") : "—"
        });
        allMarkupCards.push({
            p,
            ...meta,
            sortVal: rd ? rd.toMillis() : Number.MAX_SAFE_INTEGER
        });
    });

    if (allMarkupCards.length) {
        if (hasOp) _spacer(tab);
        _h(tab, "Разметка", _HI_TARGET);
        const { initial: _initMkup, repeat: _reMkup } = _pfDesktopCore.splitMarkupCards(allMarkupCards);
        if (_initMkup.length > 0 && _reMkup.length > 0) _subh(tab, "Первичная");
        _initMkup.forEach(c => renderOpCard(tab, getPatientBadges(c.p) + c.p.file.name, c.p.file.path, c.title, c.sub, c.color, c.action, "solid", null, getPatientFilterHints(c.p)));
        if (_initMkup.length > 0 && _reMkup.length > 0) _subh(tab, "Переразметка");
        _reMkup.forEach(c => renderOpCard(tab, getPatientBadges(c.p) + c.p.file.name, c.p.file.path, c.title, c.sub, c.color, c.action, "solid", null, getPatientFilterHints(c.p)));
        hasOp = true;
    }

    if (!hasOp) { const emptyMsg = tab.createEl("div"); emptyMsg.style.cssText = "text-align:center;color:var(--text-muted);padding:20px;font-size:0.9em;"; emptyMsg.textContent = "На сегодня нет задач"; }

    if (listSearchOnly && listSearchOnly.length > 0) {
        listSearchOnly.forEach(c => {
            const meta = _pfDesktopCore.getSearchOnlyCardMeta({
                status: c.status,
                dischargeDateLabel: c.p.Дата_окончания_лечения ? (dv.date(c.p.Дата_окончания_лечения)?.toFormat("dd.MM.yyyy") || "—") : "",
                consultDateLabel: c.p.Дата_консультации ? (dv.date(c.p.Дата_консультации)?.toFormat("dd.MM.yyyy") || "—") : "",
                mkb10: c.p["МКБ 10"]
            });
            const card = renderOpCard(tab, getPatientBadges(c.p) + c.p.file.name, c.p.file.path, meta.title, meta.subTitle, meta.color, null, "dashed", null, getPatientFilterHints(c.p));
            card.classList.add("rdt-hidden");
            card.classList.add("rdt-search-only-card");
        });
    }

} // end tab operativka

// ────────────────────────────────────────────────────────────────
// 14. ТАБ "ВЫПИСКА"
// ────────────────────────────────────────────────────────────────
const _renderDischarge = () => {
    const tab = tabContainers.discharge;
    renderDischargeCards(tab, { includeHeader: true, includeEmpty: true });
};


// ────────────────────────────────────────────────────────────────
// 12. ТАБ "ПЛАНИРОВАНИЕ"
// ────────────────────────────────────────────────────────────────
const renderCard = (parent, x, type) => {
    let mainColor = "gray", statusLabel = "", dateInfo = "", barSegments = "";
    let btnKey = null, btnAction = null;

    const stageLabel = (meta, iconHtml) => _pfDesktopCore.getStageLabelHtml(meta, iconHtml);
    const segsFromMeta = (segments) => _pfDesktopCore.getProgressSegmentsHtml(segments);

    if (type === "markup") {
        const meta = _pfDesktopCore.getMarkupStageMeta({
            kind: "markup",
            dateIso: x.d.mark?.toISODate?.() || "",
            todayIso: todayStr,
            dateLabel: x.d.mark ? x.d.mark.toFormat("dd.MM.yyyy HH:mm") : "—",
            progressPct: calcPercentMarkup(x.d.mark)
        });
        mainColor = meta.mainColor;
        statusLabel = stageLabel(meta, _HI_TARGET);
        dateInfo = meta.isOverdue
            ? `<span style='color: ${meta.dateColor};display:inline-flex;align-items:center;gap:3px;'>${_DOT(meta.dotColor)}${meta.dateLabel}</span>`
            : `${_DOT(meta.dotColor)} ${meta.dateLabel}`;
        barSegments = segsFromMeta(meta.progressSegments);
        btnKey = meta.btnKey;
    }
    else if (type === "remarkup") {
        const rmDate = x.d.remarkDate || safeDate(x.p.Дата_переразметки);
        const meta = _pfDesktopCore.getMarkupStageMeta({
            kind: "remarkup",
            dateIso: rmDate?.toISODate?.() || "",
            todayIso: todayStr,
            dateLabel: rmDate ? rmDate.toFormat("dd.MM.yyyy HH:mm") : "—",
            progressPct: calcPercentMarkup(rmDate)
        });
        mainColor = meta.mainColor;
        statusLabel = stageLabel(meta, `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>`);
        dateInfo = meta.isOverdue
            ? `<span style='color: ${meta.dateColor};display:inline-flex;align-items:center;gap:3px;'>${_DOT(meta.dotColor)}${meta.dateLabel}</span>`
            : `${_DOT(meta.dotColor)} ${meta.dateLabel}`;
        barSegments = segsFromMeta(meta.progressSegments);
        btnKey = meta.btnKey;
    }
    else if (type === "contour") {
        const deadline = minusWorkDays(x.d.start, 3);
        const wdLeft = getWorkDays(todayStart, deadline);
        const meta = _pfDesktopCore.getContourStageMeta({
            kind: "contour",
            deadlineLabel: deadline ? deadline.toFormat("dd.MM.yyyy") : "—",
            workDaysLeft: wdLeft,
            progressPct: calcPercentContour(x.d.mark, deadline)
        });
        mainColor = meta.mainColor;
        statusLabel = stageLabel(meta, _HI_PEN);
        dateInfo = `${_DOT(meta.dotColor)} ${meta.deadlineLabel} <b style='color: ${meta.textColor}'>(${meta.textDays})</b>`;
        barSegments = segsFromMeta(meta.progressSegments);
        btnKey = meta.btnKey;
    }
    else if (type === "recontour") {
        const deadline = x.d.recontourDeadline;
        const reDate = x.d.remarkDate || safeDate(x.p.Дата_переразметки);
        const wdLeft = deadline ? getWorkDays(todayStart, deadline) : null;
        const meta = _pfDesktopCore.getContourStageMeta({
            kind: "recontour",
            deadlineLabel: deadline ? deadline.toFormat("dd.MM.yyyy") : "—",
            workDaysLeft: wdLeft,
            progressPct: deadline ? calcPercentContour(reDate, deadline) : 0
        });
        mainColor = meta.mainColor;
        statusLabel = stageLabel(meta, _HI_PEN);
        dateInfo = `${_DOT(meta.dotColor)} ${meta.deadlineLabel} <b style='color: ${meta.textColor}'>(${meta.textDays})</b>`;
        barSegments = segsFromMeta(meta.progressSegments);
        btnKey = meta.btnKey;
    }
    else if (type === "waiting") {
        const wdLeft = getWorkDays(todayStart, x.d.start);
        const meta = _pfDesktopCore.getWaitingStageMeta({
            startLabel: fmt(x.d.start),
            workDaysLeft: wdLeft,
            progressPct: calcPercentWaiting(x.d.mark, x.d.start)
        });
        mainColor = meta.mainColor;
        statusLabel = stageLabel(meta, _HI_CLOCK);
        dateInfo = `${_DOT(meta.dotColor)} ${meta.startLabel} <b style='color: ${meta.textColor}'>(${meta.textDays})</b>`;
        barSegments = segsFromMeta(meta.progressSegments);
        btnKey = meta.btnKey;
    }
    else if (type === "treatment") {
        const segs = x.d.segments || [{ frac: x.d.frac, currFrac: x.d.currFrac, color: "#4caf50" }];
        const treatmentMeta = _pfDesktopCore.getTreatmentStageMeta({
            frac: x.d.frac,
            currFrac: x.d.currFrac,
            totalFrac: x.d.totalFrac,
            totalCurrFrac: x.d.totalCurrFrac,
            endIso: x.d.end?.toISODate?.() || "",
            todayIso: todayStr,
            endWeekday: x.d.end?.weekday || 0,
            dayPhrases
        });
        mainColor = treatmentMeta.mainColor;
        const warningIcon = treatmentMeta.warningKind === "soon" ? _HI_LOGOUT : _HI_ALERT;
        const warning = treatmentMeta.warningKind
            ? `<span style='color: ${treatmentMeta.warningColor}; font-weight: bold; display:inline-flex;align-items:center;gap:3px;'>${warningIcon} ${treatmentMeta.warningText}</span>`
            : "";
        statusLabel = `<span style='display:inline-block;background:rgba(76,175,80,0.1);color:${mainColor};padding:1px 7px;border-radius:10px;font-size:0.85em;font-weight:600;'>${treatmentMeta.statusText}</span>`;
        dateInfo = warning ? warning : `${fmt(x.d.end)}`;
        barSegments = _pfDesktopCore.getTreatmentProgressSegmentsHtml(segs, mainColor);
        btnAction = treatmentMeta.btnAction;
    }

    const missingDateWarningText = _pfDesktopCore.getMissingDateWarningText({
        hasMarkupDate: !!safeDate(x.p?.Дата_разметки),
        hasTreatmentStartDate: !!safeDate(x.p?.Дата_начала_лечения)
    });
    if (missingDateWarningText) {
        const warnHtml = `<span style='display:inline-flex;align-items:center;gap:3px;color:#ef6c00;font-weight:700;'>${_HI_ALERT} ${missingDateWarningText}</span>`;
        dateInfo = dateInfo ? `${dateInfo} ${warnHtml}` : warnHtml;
    }

    const showReminderBtn = (type === "waiting" || type === "treatment");

    const container = parent.createEl("div");
    container.classList.add("rdt-task-card");
    container.dataset.filterHints = getPatientFilterHints(x.p);
    container.dataset.path = String(x.p?.file?.path || "");
    if (missingDateWarningText) {
        container.dataset.filterHints = `${container.dataset.filterHints || ""} ${missingDateWarningText}`.trim();
    }
    if (type === "treatment" && x.d?.hasFractionToday === true) {
        container.dataset.todayFraction = "1";
        container.dataset.filterHints = `${container.dataset.filterHints || ""} фракция сегодня`.trim();
    }
    container.style.cssText = `display:flex;flex-direction:column;background:var(--background-primary-alt);border:1px solid var(--background-modifier-border);border-left:3px solid ${mainColor};border-radius:6px;padding:0 0 0 9px;margin-bottom:4px;overflow:hidden;transition:opacity 0.5s ease, filter 0.5s ease;`;

    // --- ВЕРХНЯЯ СТРОКА КАРТОЧКИ ---
    const cardRow = container.createDiv();
    cardRow.style.cssText = "display:flex;justify-content:space-between;align-items:stretch;";

    const textDiv = cardRow.createDiv();
    textDiv.style.cssText = "flex-grow:1;min-width:0;margin-right:8px;align-self:center;padding:6px 0;";
    const overlay = `<span style='position:absolute;top:0;left:0;width:100%;height:100%;z-index:0;'></span>`;
    textDiv.innerHTML = `<div class='rdt-card-name' style='position:relative;font-size:1em;margin-bottom:2px;font-weight:600;display:flex;align-items:center;'><a class='internal-link' href='${x.p.file.path}' style='text-decoration:none;color:var(--text-normal);display:flex;align-items:center;min-width:0;width:100%;'>${getPatientBadges(x.p) ? `<span style="flex-shrink:0;white-space:nowrap;">${getPatientBadges(x.p)}</span>` : ""}<span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0;">${x.p.file.name}${overlay}</span></a></div><div style='display:flex;gap:4px;height:4px;width:100%;margin:4px 0;'>${barSegments}</div><div class='rdt-card-meta' style='display:flex;justify-content:space-between;align-items:center;font-size:0.85em;'><div class='rdt-card-meta-left' style='min-width:0;flex:1;margin-right:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;'>${statusLabel}</div><div class='rdt-card-meta-right' style='text-align:right;white-space:nowrap;'>${dateInfo}</div></div>`;

    // --- КНОПКИ ---
    const btnDiv = cardRow.createDiv();
    btnDiv.style.cssText = "flex-shrink:0;z-index:2;display:flex;align-items:stretch;"; const _sep2 = btnDiv.createDiv(); _sep2.style.cssText = "width:1px;background:var(--background-modifier-border);flex-shrink:0;margin:4px 0;";

    // Кнопка копирования предписания (только для оконтуривания)
    if (type === "contour" || type === "recontour") {
        const prescText = buildPrescText(x.p);
        const prescBtn = btnDiv.createEl("button");
        prescBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`;
        prescBtn.title = "Скопировать предписание";
        prescBtn.style.cssText = `cursor:pointer;display:flex;align-items:center;justify-content:center;width:38px;height:100%;min-height:36px;background:transparent;border:none;color:var(--text-muted);padding:0;transition:all 0.2s ease;`;
        prescBtn.onmouseenter = () => { prescBtn.style.background = "#2196f322"; prescBtn.style.color = "#2196f3"; };
        prescBtn.onmouseleave = () => { prescBtn.style.background = "transparent"; prescBtn.style.color = "var(--text-muted)"; };
        prescBtn.onclick = async (e) => {
            e.stopPropagation(); e.preventDefault();
            await navigator.clipboard.writeText(prescText);
            new Notice("── Предписание скопировано!");
            prescBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#2196f3" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
            setTimeout(() => { prescBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`; }, 1500);
        };
    }

    // Кнопка напоминания (только для планирования и лечения)
    let bellBtn = null;
    let bellColor = "var(--text-muted)";
    if (showReminderBtn) {
        bellColor = _pfDesktopCore.getReminderBellColor(x.p.Напоминания);

        bellBtn = btnDiv.createEl("button");
        bellBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>`;
        bellBtn.style.cssText = `cursor:pointer;display:flex;align-items:center;justify-content:center;width:38px;height:100%;min-height:36px;background:transparent;border:none;color:${bellColor};padding:0;transition:all 0.2s ease;`;
        bellBtn.onmouseenter = () => { bellBtn.style.background = "#ff980022"; bellBtn.style.color = "#ff9800"; };
        bellBtn.onmouseleave = () => {
            if (reminderForm.style.display === "none") {
                bellBtn.style.color = bellColor;
            }
            bellBtn.style.background = "transparent";
        };
    }

    // Основная кнопка действия
    if (btnKey || btnAction) {
        if (btnDiv.children.length > 1) {
            const sep = btnDiv.createDiv();
            sep.style.cssText = "width:1px;background:var(--background-modifier-border);flex-shrink:0;margin:4px 0;";
        }
        const btn = btnDiv.createEl("button");
        btn.style.cssText = `cursor:pointer;display:flex;align-items:center;justify-content:center;width:38px;height:100%;min-height:36px;background:transparent;border:none;color:var(--text-muted);padding:0;transition:all 0.2s ease;`;

        if (btnAction === "MOVE") btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>`;
        else btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;

        btn.onmouseenter = () => { btn.style.background = mainColor + "22"; btn.style.color = mainColor; };
        btn.onmouseleave = () => { btn.style.background = "transparent"; btn.style.color = "var(--text-muted)"; };

        btn.onclick = async (e) => {
            e.stopPropagation(); e.preventDefault();
            container.style.opacity = "0.4"; container.style.filter = "grayscale(100%)"; container.style.pointerEvents = "none";
            btn.style.background = "gray"; btn.style.borderColor = "gray"; btn.style.color = "white";
            try {
                const tFile = app.vault.getAbstractFileByPath(x.p.file.path);
                if (!tFile) return;
                if (btnAction === "MOVE") {
                    const _res = await _dischargePatientFile(tFile, { source: "desktop-stage-card" });
                    if (!_res?.ok) throw (_res?.error || new Error("Не удалось выписать пациента"));
                    new Notice(`Выписан и записан в БД: ${x.p.file.name}`);
                } else {
                    await _dbPatchFrontmatter(tFile, fm => { Object.assign(fm, _pfDesktopCore.getSetFlagPatch(btnKey)); }, { reread: false });
                    new Notice(`Этап завершен: ${x.p.file.name}`);
                }
                setTimeout(() => { container.style.display = "none"; }, 600);
            } catch (err) {
                console.error(err);
                container.style.opacity = "1"; container.style.filter = "none"; container.style.pointerEvents = "auto";
                new Notice("? Ошибка: " + (err?.message || err));
            }
        };
    }

    // --- ФОРМА НАПОМИНАНИЯ (скрыта по умолчанию) ---
    const reminderForm = container.createDiv();
    reminderForm.className = "rdt-rem-form";
    reminderForm.style.cssText = "display:none;flex-wrap:wrap;gap:6px;align-items:center;margin-top:8px;padding:8px 9px 6px 0;border-top:1px solid var(--background-modifier-border);";

    // Инжектируем стиль для корректного отображения date input
    if (!document.getElementById('rdt-date-style')) {
        const ds = document.createElement('style');
        ds.id = 'rdt-date-style';
        ds.textContent = `
            .rdt-date-input { height:40px; border-radius:6px; border:1px solid var(--background-modifier-border);
                background:var(--background-primary); color:var(--text-normal); padding:0 12px;
                font-size:14px; box-sizing:border-box; outline:none; transition:border-color 0.15s;
                -webkit-appearance:none; appearance:none; }
            .rdt-date-input:focus { border-color:var(--interactive-accent); }
            .rdt-date-input::-webkit-calendar-picker-indicator { margin-left:4px; opacity:0.6; cursor:pointer; }
            .rdt-date-input::-webkit-date-and-time-value { text-align:left; }
            @media(max-width:600px){
                .rdt-rem-form { flex-direction:column !important; gap:8px !important; }
                .rdt-rem-date { width:100% !important; flex:none !important; min-width:0 !important; }
                .rdt-rem-text { width:100% !important; flex:none !important; min-width:0 !important; }
                .rdt-rem-add  { width:100% !important; height:44px !important; font-size:15px !important; }
                .rdt-rem-vk   { width:100% !important; height:44px !important; }
                .rdt-rem-row  { padding:6px 0 !important; gap:8px !important; }
                .rdt-rem-row-done, .rdt-rem-row-del { width:32px !important; height:32px !important; }
                .rdt-rem-row-text { white-space:normal !important; }
            }
        `;
        document.head.appendChild(ds);
    }

    const reminderDateInput = reminderForm.createEl("input");
    reminderDateInput.type = "date";
    reminderDateInput.value = today.toFormat("yyyy-MM-dd");
    reminderDateInput.className = "rdt-date-input rdt-rem-date";
    reminderDateInput.style.cssText = `flex:1 1 130px; min-width:120px;`;

    const reminderTextInput = reminderForm.createEl("input");
    reminderTextInput.type = "text";
    reminderTextInput.placeholder = "Текст напоминания...";
    reminderTextInput.className = "rdt-rem-text";
    reminderTextInput.style.cssText = `height:40px;border-radius:6px;border:1px solid var(--background-modifier-border);background:var(--background-primary);color:var(--text-normal);padding:0 12px;font-size:14px;box-sizing:border-box;flex:5 1 160px;min-width:120px;outline:none;-webkit-appearance:none;appearance:none;transition:border-color 0.15s;`;
    reminderTextInput.onfocus = () => reminderTextInput.style.borderColor = "var(--interactive-accent)";
    reminderTextInput.onblur = () => reminderTextInput.style.borderColor = "var(--background-modifier-border)";

    const reminderAddBtn = reminderForm.createEl("button");
    reminderAddBtn.className = "rdt-rem-add";
    reminderAddBtn.innerHTML = "?";
    reminderAddBtn.title = "Добавить напоминание";
    reminderAddBtn.style.cssText = `height:40px;padding:0 14px;border-radius:6px;border:none;background:#2196f3;color:white;font-size:14px;font-weight:600;cursor:pointer;flex-shrink:0;transition:opacity 0.2s;`;
    reminderAddBtn.onmouseenter = () => reminderAddBtn.style.opacity = "0.85";
    reminderAddBtn.onmouseleave = () => reminderAddBtn.style.opacity = "1";
    reminderAddBtn.onclick = async (e) => {
        e.stopPropagation(); e.preventDefault();
        const dateVal = reminderDateInput.value;
        const textVal = reminderTextInput.value.trim();
        if (!dateVal || !textVal) { new Notice("? Заполните дату и текст!"); return; }
        try {
            const tFile = app.vault.getAbstractFileByPath(x.p.file.path);
            if (!tFile) { new Notice("? Файл не найден!"); return; }
            await _dbPatchFrontmatter(tFile, (fm) => {
                Object.assign(fm, _pfDesktopCore.getAddReminderPatch(fm.Напоминания, dateVal, textVal));
            }, { reread: false });
            reminderTextInput.value = "";
            reminderForm.style.display = "none";
            new Notice(`? Напоминание добавлено: ${x.p.file.name}`);
        } catch (err) { new Notice("? Ошибка"); console.error(err); }
    };

    // Кнопка ВК по ЭЛН
    const vkBtn = reminderForm.createEl("button");
    vkBtn.className = "rdt-rem-vk";
    vkBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line><line x1="12" y1="14" x2="12" y2="18"></line><line x1="10" y1="16" x2="14" y2="16"></line></svg>`;
    vkBtn.title = "ВК по ЭЛН";
    vkBtn.style.cssText = `height:40px;width:40px;padding:0;border-radius:6px;border:none;background:#ff9800;color:white;font-size:14px;font-weight:600;cursor:pointer;flex-shrink:0;transition:opacity 0.2s;display:flex;align-items:center;justify-content:center;`;
    vkBtn.onmouseenter = () => vkBtn.style.opacity = "0.85";
    vkBtn.onmouseleave = () => vkBtn.style.opacity = "1";
    vkBtn.onclick = async (e) => {
        e.stopPropagation(); e.preventDefault();
        const admissionDate = x.p.Дата_начала_лечения ? dv.date(x.p.Дата_начала_лечения) : null;
        if (!admissionDate) { new Notice("── Нет даты начала лечения!"); return; }
        const selectedDateStr = reminderDateInput.value;
        if (!dv.date(selectedDateStr)) { new Notice("? Некорректная дата!"); return; }
        const payload = _pfDesktopCore.buildVkElnReminderPayload({
            admissionIso: admissionDate.startOf("day").toISODate(),
            selectedIso: selectedDateStr,
            todayIso: todayStr,
            holidays: Array.from(holidays)
        });
        if (!payload) { new Notice("? Некорректная дата!"); return; }
        const targetDate = dv.date(payload.targetIso);

        try {
            const tFile = app.vault.getAbstractFileByPath(x.p.file.path);
            if (!tFile) { new Notice("? Файл не найден!"); return; }
            await _dbPatchFrontmatter(tFile, (fm) => {
                Object.assign(fm, _pfDesktopCore.getAddReminderPatch(fm.Напоминания, payload.targetIso, payload.reminderText));
            }, { reread: false });
            reminderForm.style.display = "none";
            new Notice(`? Добавлено ВК на ${targetDate.toFormat("dd.MM.yyyy")}`);
        } catch (err) { new Notice("? Ошибка"); console.error(err); }
    };

    // Enter в поле текста = сохранить
    reminderTextInput.onkeydown = (e) => { if (e.key === "Enter") reminderAddBtn.click(); };

    // Список существующих напоминаний (отображается вместе с формой)
    let remList = null;
    if (showReminderBtn) {
        const existingReminders = _pfDesktopCore.getSortedActiveReminders(x.p.Напоминания);
        if (existingReminders.length > 0) {
            remList = container.createDiv();
            remList.style.cssText = "display:none;flex-direction:column;gap:3px;margin-top:6px;padding:6px 9px 6px 0;border-top:1px dashed var(--background-modifier-border);";

            existingReminders.forEach((r, idx) => {
                const rd = dv.date(r.дата);
                const rowMeta = _pfDesktopCore.getReminderRowMeta({
                    dateIso: rd?.toISODate?.() || String(r.дата || ""),
                    todayIso: todayStr,
                    dateLabel: rd ? rd.toFormat("dd.MM.yyyy") : r.дата
                });
                const row = remList.createDiv();
                row.className = "rdt-rem-row";
                row.style.cssText = "display:flex;align-items:center;gap:5px;font-size:0.8em;line-height:1.3;padding:2px 0;";
                row.innerHTML = `<span style="color:${rowMeta.dateColor};white-space:nowrap;flex-shrink:0;">${rowMeta.dateLabel}</span><span class="rdt-rem-row-text" style="color:var(--text-normal);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${r.текст}">${r.текст}</span>`;
                const btnStyle = "cursor:pointer;display:flex;align-items:center;justify-content:center;width:22px;height:22px;flex-shrink:0;border-radius:4px;border:none;padding:0;transition:opacity 0.2s;";

                // Вспомогательная функция поиска индекса напоминания
                const findMatchIdx = (reminder) => _pfDesktopCore.findActiveReminderValueIndex(x.p.Напоминания, reminder);

                // Зелёная галочка — отметить выполненным
                const doneBtn = row.createEl("button");
                doneBtn.className = "rdt-rem-row-done";
                doneBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
                doneBtn.title = "Выполнено";
                doneBtn.style.cssText = btnStyle + "background:#4caf50;color:white;";
                doneBtn.onmouseenter = () => doneBtn.style.opacity = "0.8";
                doneBtn.onmouseleave = () => doneBtn.style.opacity = "1";
                doneBtn.onclick = async (e) => {
                    e.stopPropagation(); e.preventDefault();
                    try {
                        const tFile = app.vault.getAbstractFileByPath(x.p.file.path);
                        if (!tFile) return;
                        const matchIdx = findMatchIdx(r);
                        await _dbPatchFrontmatter(tFile, (fm) => {
                            if (matchIdx >= 0) Object.assign(fm, _pfDesktopCore.getCompleteReminderPatch(fm.Напоминания, matchIdx));
                        }, { reread: false });
                        row.style.opacity = "0";
                        setTimeout(() => row.remove(), 300);
                    } catch (err) { console.error(err); }
                };

                // Красный крестик — удалить напоминание
                const delBtn = row.createEl("button");
                delBtn.className = "rdt-rem-row-del";
                delBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
                delBtn.title = "Удалить напоминание";
                delBtn.style.cssText = btnStyle + "background:#f44336;color:white;";
                delBtn.onmouseenter = () => delBtn.style.opacity = "0.8";
                delBtn.onmouseleave = () => delBtn.style.opacity = "1";
                delBtn.onclick = async (e) => {
                    e.stopPropagation(); e.preventDefault();
                    try {
                        const tFile = app.vault.getAbstractFileByPath(x.p.file.path);
                        if (!tFile) return;
                        const matchIdx = findMatchIdx(r);
                        await _dbPatchFrontmatter(tFile, (fm) => {
                            if (matchIdx >= 0) Object.assign(fm, _pfDesktopCore.getDeleteReminderPatch(fm.Напоминания, matchIdx));
                        }, { reread: false });
                        row.style.opacity = "0";
                        setTimeout(() => row.remove(), 300);
                    } catch (err) { console.error(err); }
                };
            });
        }

        // Логика переключения: кнопка колокольчика управляет и формой, и списком
        if (bellBtn) {
            bellBtn.onclick = (e) => {
                e.stopPropagation(); e.preventDefault();
                const isOpen = reminderForm.style.display !== "none";
                if (isOpen) {
                    reminderForm.style.display = "none";
                    if (remList) remList.style.display = "none";
                    bellBtn.style.borderColor = bellColor; bellBtn.style.color = bellColor;
                } else {
                    reminderForm.style.display = "flex";
                    if (remList) remList.style.display = "flex";
                    bellBtn.style.borderColor = "#ff9800"; bellBtn.style.color = "#ff9800";
                    reminderTextInput.focus();
                }
            };
        }
    }
};

const _renderPlanning = () => {
    const tab = tabContainers.planning;

    const totalPlanning = listMarkup.length + listReMarkup.length + listContour.length + listWaiting.length + reContours.length;
    if (totalPlanning > 0) {
        _h(tab, `Планирование (${totalPlanning})`, _HI_CLOCK);

        listMarkup.forEach(x => renderCard(tab, x, "markup"));
        listReMarkup.forEach(x => renderCard(tab, x, "remarkup"));

        if ((listMarkup.length + listReMarkup.length) > 0 && (listContour.length + reContours.length) > 0) _spacer(tab);

        listContour.forEach(x => renderCard(tab, x, "contour"));
        reContours.forEach(x => renderCard(tab, x, "recontour"));

        if ((listMarkup.length + listReMarkup.length + listContour.length + reContours.length) > 0 && listWaiting.length > 0) _spacer(tab);
        listWaiting.forEach(x => renderCard(tab, x, "waiting"));
    } else {
        const emptyMsg = tab.createEl("div"); emptyMsg.style.cssText = "text-align:center;color:var(--text-muted);padding:20px;font-size:0.9em;"; emptyMsg.textContent = "Нет пациентов на планировании";
    }
}; // end tab planning


// ────────────────────────────────────────────────────────────────
// 13. ТАБ "ЛЕЧЕНИЕ"
// ────────────────────────────────────────────────────────────────
const _renderTreatment = () => {
    const tab = tabContainers.treatment;

    if (listTreatment.length) {
        _h(tab, `Лечение (${listTreatment.length})`, _HI_PULSE);
        if (treatmentWithFractionToday.length > 0) {
            _subh(tab, "Фракция сегодня", "#4caf50");
            treatmentWithFractionToday.forEach(x => renderCard(tab, x, "treatment"));
        }
        if (treatmentBreakToday.length > 0) {
            if (treatmentWithFractionToday.length > 0) _spacer(tab);
            _subh(tab, "Перерыв", "#9e9e9e");
            treatmentBreakToday.forEach(x => renderCard(tab, x, "treatment"));
        }
        if (treatmentOther.length > 0) {
            if (treatmentWithFractionToday.length > 0 || treatmentBreakToday.length > 0) _spacer(tab);
            _subh(tab, "Без фракции на выбранную дату", "var(--text-muted)");
            treatmentOther.forEach(x => renderCard(tab, x, "treatment"));
        }
    } else {
        const emptyMsg = tab.createEl("div"); emptyMsg.style.cssText = "text-align:center;color:var(--text-muted);padding:20px;font-size:0.9em;"; emptyMsg.textContent = "Нет пациентов на лечении";
    }

    // --- МАССОВЫЙ ПРОПУСК ФРАКЦИИ ---
    const onTreatment = treatmentWithFractionToday;
    if (onTreatment.length > 0) {
        const msWrap = tab.createEl("div", { cls: "rdt-mass-skip" });
        const msHeader = msWrap.createEl("div", { cls: "rdt-mass-skip-header" });
        msHeader.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="transition:transform 0.2s;"><polyline points="6 9 12 15 18 9"/></svg> Массовый пропуск фракции`;
        const msBody = msWrap.createEl("div", { cls: "rdt-mass-skip-body" });
        msHeader.onclick = () => {
            msWrap.classList.toggle("open");
            const arrow = msHeader.querySelector("svg");
            if (arrow) arrow.style.transform = msWrap.classList.contains("open") ? "rotate(180deg)" : "";
        };

        // Дата
        const dateRow = msBody.createEl("div");
        dateRow.style.cssText = "display:flex;gap:8px;align-items:center;margin-bottom:8px;flex-wrap:wrap;";
        const dateLabel = dateRow.createEl("span");
        dateLabel.textContent = "Дата пропуска:";
        dateLabel.style.cssText = "font-size:0.85em;color:var(--text-muted);font-weight:600;";
        const dateInput = dateRow.createEl("input");
        dateInput.type = "date";
        dateInput.value = todayStr;
        dateInput.className = "rdt-date-input";
        dateInput.style.cssText = "flex:1;min-width:130px;max-width:200px;";
        const addDateBtn = dateRow.createEl("button");
        addDateBtn.textContent = "+";
        addDateBtn.title = "Добавить дату в выбор";
        addDateBtn.style.cssText = "width:36px;height:36px;border-radius:6px;border:1px solid var(--background-modifier-border);background:var(--background-primary);color:var(--text-muted);font-weight:700;cursor:pointer;";
        let selectedSkipDates = [todayStr].filter(Boolean);
        const dateChips = msBody.createEl("div");
        dateChips.style.cssText = "display:flex;gap:6px;flex-wrap:wrap;margin:-2px 0 8px 0;";
        const renderDateChips = () => {
            dateChips.innerHTML = "";
            selectedSkipDates.forEach(iso => {
                const chip = dateChips.createEl("button", { cls: "rdt-ms-date-chip" });
                chip.type = "button";
                chip.textContent = `${iso} ×`;
                chip.title = "Убрать дату";
                chip.style.cssText = "height:26px;border-radius:999px;border:1px solid rgba(255,82,82,0.35);background:rgba(255,82,82,0.10);color:#ff5252;font-size:12px;font-weight:600;padding:0 9px;cursor:pointer;";
                chip.onclick = () => {
                    selectedSkipDates = _pfDesktopCore.applyDateSelectionPatch({
                        existing: selectedSkipDates,
                        selected: [iso],
                        mode: "remove"
                    });
                    renderDateChips();
                };
            });
        };
        const addSelectedDate = () => {
            if (!dateInput.value) return;
            selectedSkipDates = _pfDesktopCore.applyDateSelectionPatch({
                existing: selectedSkipDates,
                selected: [dateInput.value],
                mode: "add"
            });
            renderDateChips();
        };
        addDateBtn.onclick = addSelectedDate;
        dateInput.onchange = addSelectedDate;
        renderDateChips();

        // Фильтр
        const filterInput = msBody.createEl("input");
        filterInput.type = "text";
        filterInput.placeholder = "Поиск по ФИО...";
        filterInput.style.cssText = "width:100%;height:36px;border-radius:6px;border:1px solid var(--background-modifier-border);background:var(--background-primary);color:var(--text-normal);padding:0 10px;font-size:0.85em;box-sizing:border-box;margin-bottom:8px;outline:none;";
        filterInput.onfocus = () => filterInput.style.borderColor = "var(--interactive-accent)";
        filterInput.onblur = () => filterInput.style.borderColor = "var(--background-modifier-border)";

        // Список
        const listWrap = msBody.createEl("div");
        listWrap.style.cssText = "max-height:300px;overflow-y:auto;margin-bottom:8px;";
        const checkboxes = [];
        onTreatment.forEach(x => {
            const row = listWrap.createEl("div", { cls: "rdt-ms-row" });
            const cb = row.createEl("input", { cls: "rdt-ms-cb" });
            cb.type = "checkbox";
            const lbl = row.createEl("label");
            lbl.textContent = `${x.p.ФИО || x.p.file.name} (${x.d.totalCurrFrac}/${x.d.totalFrac})`;
            lbl.onclick = () => { cb.checked = !cb.checked; };
            checkboxes.push({ cb, path: x.p.file.path, name: x.p.file.name, row });
        });
        filterInput.oninput = () => {
            const q = filterInput.value.toLowerCase();
            checkboxes.forEach(c => { c.row.style.display = c.name.toLowerCase().includes(q) ? "flex" : "none"; });
        };

        // Кнопки выбора
        const selRow = msBody.createEl("div");
        selRow.style.cssText = "display:flex;gap:8px;margin-bottom:8px;";
        const selAll = selRow.createEl("button");
        selAll.textContent = "Выбрать всех";
        selAll.style.cssText = "padding:4px 10px;border-radius:6px;border:1px solid var(--background-modifier-border);background:var(--background-primary);color:var(--text-muted);font-size:0.8em;cursor:pointer;";
        selAll.onclick = () => checkboxes.forEach(c => { if (c.row.style.display !== "none") c.cb.checked = true; });
        const selNone = selRow.createEl("button");
        selNone.textContent = "Снять";
        selNone.style.cssText = selAll.style.cssText;
        selNone.onclick = () => checkboxes.forEach(c => c.cb.checked = false);

        // Применить
        const applyBtn = msBody.createEl("button");
        applyBtn.textContent = "Применить пропуск";
        applyBtn.style.cssText = "width:100%;height:40px;border-radius:8px;border:none;background:#ff5252;color:white;font-size:0.9em;font-weight:700;cursor:pointer;transition:opacity 0.15s;";
        applyBtn.onmouseenter = () => applyBtn.style.opacity = "0.85";
        applyBtn.onmouseleave = () => applyBtn.style.opacity = "1";
        applyBtn.onclick = async () => {
            if (selectedSkipDates.length === 0) { new Notice("── Выберите дату"); return; }
            const selected = checkboxes.filter(c => c.cb.checked);
            if (selected.length === 0) { new Notice("── Выберите пациентов"); return; }
            let count = 0;
            for (const s of selected) {
                try {
                    const tFile = app.vault.getAbstractFileByPath(s.path);
                    if (!tFile) continue;
                    await _dbPatchFrontmatter(tFile, fm => {
                        fm.Пропущенные_даты = _pfDesktopCore.applyDateSelectionPatch({
                            existing: fm.Пропущенные_даты,
                            selected: selectedSkipDates,
                            mode: "add"
                        });
                    }, { reread: false });
                    count++;
                    s.cb.checked = false;
                } catch (err) { console.error(err); }
            }
            new Notice(`? Пропуск на ${selectedSkipDates.join(", ")} добавлен для ${count} пациентов`);
        };
    }
};
// ────────────────────────────────────────────────────────────────
// 15. ИНИЦИАЛИЗАЦИЯ ТАБОВ
    const _desktopTabRenderers = [
        { id: "operativka", render: _renderOperativka },
        { id: "planning", render: _renderPlanning },
        { id: "treatment", render: _renderTreatment },
        { id: "discharge", render: _renderDischarge }
    ];
    const _desktopRenderTab = (item) => {
        try {
            item.render();
        } catch (error) {
            console.error(`[desktop-render] ${item.id}`, error);
        }
    };
    const _desktopRenderTabs = (items) => {
        for (const item of items) _desktopRenderTab(item);
    };
    const _desktopImmediateTab = _desktopTabRenderers.find(item => item.id === activeTab);
    const _desktopDeferredTabs = _desktopImmediateTab
        ? _desktopTabRenderers.filter(item => item !== _desktopImmediateTab)
        : _desktopTabRenderers;
    if (_desktopImmediateTab) _desktopRenderTab(_desktopImmediateTab);
    _desktopRunApplyCardFilter();
    if (_desktopDeferredTabs.length) {
        _desktopSchedule(() => {
            _desktopRenderTabs(_desktopDeferredTabs);
            _desktopRunApplyCardFilter();
            _desktopRenderLog(`boot in ${Math.round(_desktopRenderNow() - _desktopRenderBootAt)}ms`);
        });
    } else {
        _desktopRenderLog(`boot in ${Math.round(_desktopRenderNow() - _desktopRenderBootAt)}ms`);
    }

    return {
        renderOpCard: typeof renderOpCard !== "undefined" ? renderOpCard : null,
        renderCard: typeof renderCard !== "undefined" ? renderCard : null
    };
};

module.exports = { buildDesktopRender };
