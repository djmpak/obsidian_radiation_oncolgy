// ============================================================
// ЕДИНЫЙ БЛОК ПАЦИЕНТА — ver 27.02.2026
// Все 9 блоков объединены в один dataviewjs.
// Общие утилиты выполняются один раз.
// ============================================================

const cur  = dv.current();
if (!cur || !cur.file || !cur.file.path) {
    dv.el("div", "🔄 Файл был перемещён — закройте и откройте его заново", { attr: { style: "color:var(--text-muted);padding:30px;text-align:center;font-size:0.9em;" } });
    return;
}
const file = app.vault.getAbstractFileByPath(cur.file.path);
if (!file) {
    dv.el("div", "🔄 Файл был перемещён — закройте и откройте его заново", { attr: { style: "color:var(--text-muted);padding:30px;text-align:center;font-size:0.9em;" } });
    return;
}

// ВАЖНО: Dataview при обновлении передает старую закэшированную версию `cur`.
// Мы жестко накатываем свежий кэш Obsidian поверх `cur` до начала любых вычислений.
const _liveCbFm = app.metadataCache.getFileCache(file)?.frontmatter;
if (_liveCbFm) {
    for (const k in _liveCbFm) {
        if (k !== "tags" && k !== "position") {
            const v = _liveCbFm[k];
            if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v)) {
                const parsed = dv.date(v);
                cur[k] = parsed ? parsed : v;
            } else {
                cur[k] = v;
            }
        }
    }
}

const today = dv.date("now").startOf("day");

// Принудительный триггер обновления Dataview (решает проблему игнорирования редактора свойств)
// Мы используем встроенный API самого Obsidian для перерисовки вкладки, если Dataview не реагирует.
const OBS_KEY = "pf_dv_autorefresh_" + file.path;
if (typeof window !== "undefined" && !window[OBS_KEY]) {
    window[OBS_KEY] = app.metadataCache.on("changed", (changedFile) => {
        if (changedFile.path === file.path) {
            if (window['_pfDvRefreshTimeout']) clearTimeout(window['_pfDvRefreshTimeout']);
            window['_pfDvRefreshTimeout'] = setTimeout(() => {
                app.workspace.iterateAllLeaves(leaf => {
                    if (leaf?.view?.file?.path === file.path && leaf.view.previewMode && typeof leaf.view.previewMode.rerender === "function") {
                        leaf.view.previewMode.rerender(true);
                    }
                });
            }, 800); // 800мс пауза после ввода, чтобы не моргало на каждую букву
        }
    });
}

const holidayPath = "Архив/БД/БД_Праздники.md";
const fmt     = d => d ? d.toFormat("dd.MM.yyyy") : "—";
const fmtFull = d => d ? d.toFormat("dd.MM.yyyy HH:mm") : "—";

// ── Загрузка праздников (один раз) ───────────────────────────────────────────
let holidays = new Set();
try {
    const holidayContent = await dv.io.load(holidayPath);
    if (holidayContent) {
        holidayContent.split(/\r?\n/).forEach(line => {
            const trimmed = line.trim();
            if (trimmed && /^\d{4}-\d{2}-\d{2}$/.test(trimmed)) holidays.add(trimmed);
        });
    }
} catch (e) { console.error("Ошибка загрузки праздников:", e); }
const _pfPatientChemoReminders = await (async () => {
    try {
        const source = await dv.io.load("Архив/Scripts/modules/patient-chemo-reminders-runtime.js");
        if (!source) return null;
        const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
        const factory = await new AsyncFunction(`"use strict"; return (${source});`)();
        return typeof factory === "function" ? await factory({ dv }) : null;
    } catch (e) {
        console.error("Ошибка загрузки patient-chemo-reminders-runtime:", e);
        return null;
    }
})();
// ── Плавающая пилюля-ссылка «Рабочий стол» (мобильная) ─────────────────────
const PF_DESK_PILL_STYLE_ID = "pf-desktop-link-style";
const PF_DESK_DOCK_CLASS = "pf-desktop-link-dock";
const PF_DESK_PILL_CLASS = "pf-desktop-link-pill";
const PF_DESK_PILL_OFFSET = 56; // тот же отступ, что у вкладок на рабочем столе
const PF_DESK_DOCK_KEY = "pf_mobile_dock_" + String(cur.file.path || "");

const _pfGetMobileDock = () => window[PF_DESK_DOCK_KEY] || document.querySelector(`.${PF_DESK_DOCK_CLASS}`);
const _pfSetMobileDockButton = (id, title, iconHtml, onClick, beforeId = null) => {
    const dock = _pfGetMobileDock();
    if (!dock) return null;
    let btn = dock.querySelector(`[data-pf-dock-action="${id}"]`);
    if (!btn) {
        btn = document.createElement("button");
        btn.type = "button";
        btn.className = PF_DESK_PILL_CLASS;
        btn.setAttribute("data-pf-dock-action", id);
        const before = beforeId ? dock.querySelector(`[data-pf-dock-action="${beforeId}"]`) : null;
        dock.insertBefore(btn, before);
    }
    btn.title = title;
    btn.setAttribute("aria-label", title);
    btn.innerHTML = `<span class="pf-desk-pill-icon">${iconHtml}</span><span class="pf-desk-pill-label">${title}</span>`;
    btn.onclick = onClick;
    return btn;
};

{
    const _oldStyle = document.getElementById(PF_DESK_PILL_STYLE_ID);
    if (_oldStyle) _oldStyle.remove();

    const _oldDock = document.querySelector(`.${PF_DESK_DOCK_CLASS}`);
    if (_oldDock) _oldDock.remove();

    const _style = document.createElement("style");
    _style.id = PF_DESK_PILL_STYLE_ID;
    _style.textContent = `
        .${PF_DESK_DOCK_CLASS}{
            position:fixed;
            bottom:calc(env(safe-area-inset-bottom,0px) + ${PF_DESK_PILL_OFFSET}px);
            left:50%;
            transform:translateX(-50%);
            z-index:999;
            background:rgba(26,26,28,0.88);
            -webkit-backdrop-filter:blur(18px);
            backdrop-filter:blur(18px);
            border-radius:30px;
            padding:5px 6px;
            margin:0;
            gap:2px;
            flex-wrap:nowrap;
            box-shadow:0 6px 28px rgba(0,0,0,0.45),0 1px 0 rgba(255,255,255,0.06) inset;
            border:none;
            width:auto;
            display:flex;
            align-items:center;
            will-change:transform;
        }
        .${PF_DESK_PILL_CLASS}{
            -webkit-appearance:none;
            appearance:none;
            height:42px;
            width:84px;
            padding:0;
            border-radius:22px;
            font-size:12px;
            font-weight:700;
            line-height:1;
            flex:0 0 auto;
            min-width:0;
            border:none;
            background:transparent !important;
            display:flex;
            align-items:center;
            justify-content:center;
            gap:0;
            position:relative;
            color:rgba(255,255,255,0.95) !important;
            transition:color 0.25s ease, opacity .2s ease;
            z-index:1;
            white-space:nowrap;
            text-decoration:none !important;
            font-family:var(--font-interface);
            cursor:pointer;
        }
        .${PF_DESK_PILL_CLASS}:hover{opacity:.9;}
        .${PF_DESK_PILL_CLASS} .pf-desk-pill-icon{display:inline-flex;width:20px;height:20px;align-items:center;justify-content:center;}
        .${PF_DESK_PILL_CLASS} .pf-desk-pill-icon svg{display:block;width:18px;height:18px;}
        .${PF_DESK_PILL_CLASS} .pf-desk-pill-label{
            position:absolute;
            width:1px;
            height:1px;
            padding:0;
            margin:-1px;
            overflow:hidden;
            clip:rect(0,0,0,0);
            white-space:nowrap;
            border:0;
        }
        @media(max-width:600px) and (prefers-color-scheme:light){
            .${PF_DESK_DOCK_CLASS}{
                background:rgba(242,242,247,0.92);
                box-shadow:0 4px 24px rgba(0,0,0,0.14),0 0.5px 0 rgba(0,0,0,0.08) inset;
            }
            .${PF_DESK_PILL_CLASS}{color:rgba(60,60,67,0.9) !important;}
        }
        @media(min-width:601px){
            .${PF_DESK_DOCK_CLASS}{display:none !important;}
        }
    `;
    document.head.appendChild(_style);

    const _dock = dv.container.createEl("div", { cls: PF_DESK_DOCK_CLASS });
    window[PF_DESK_DOCK_KEY] = _dock;
    _pfSetMobileDockButton(
        "desktop",
        "Открыть рабочий стол",
        `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/></svg>`,
        async (e) => {
            e.preventDefault();
            const deskFile = app.vault.getAbstractFileByPath("Рабочий стол.md");
            if (deskFile) await app.workspace.getLeaf(false).openFile(deskFile);
            else new Notice("Не найден файл: Рабочий стол.md");
        }
    );

    // Синхронизация с мобильной навигацией Obsidian (is-hidden-nav + transition)
    if (typeof window.__pfDeskDockSyncCleanup === "function") {
        try { window.__pfDeskDockSyncCleanup(); } catch (e) {}
    }

    if (window.innerWidth <= 600) {
        const _obsBar = document.querySelector('.mobile-toolbar')
                     || document.querySelector('.mobile-navbar')
                     || document.querySelector('[class*="mobile-toolbar"]')
                     || document.querySelector('[class*="mobile-navbar"]');

        if (_obsBar) {
            const _safeDiv = document.createElement('div');
            _safeDiv.style.cssText = 'position:fixed;bottom:env(safe-area-inset-bottom,0px);height:0;pointer-events:none;';
            document.body.appendChild(_safeDiv);
            const _safeBottom = window.innerHeight - _safeDiv.getBoundingClientRect().top;
            document.body.removeChild(_safeDiv);

            const _tbH = _obsBar.getBoundingClientRect().height || 48;
            const _hideY = _tbH + _safeBottom + PF_DESK_PILL_OFFSET + 20;
            const _kbdHideY = _hideY + Math.max(180, Math.round(_tbH * 2.4));
            const _host = app.workspace?.containerEl || document.body;
            const _vv = window.visualViewport || null;
            let _vvBaseH = (_vv && Number.isFinite(_vv.height)) ? _vv.height : window.innerHeight;

            const _parseTimesMs = (val) => {
                if (!val) return 0;
                return Math.max(...val.split(',').map(v => {
                    const t = v.trim();
                    if (t.endsWith('ms')) return parseFloat(t) || 0;
                    if (t.endsWith('s')) return (parseFloat(t) || 0) * 1000;
                    return 0;
                }));
            };

            const _navTransitionMs = () => {
                const cs = getComputedStyle(_obsBar);
                return _parseTimesMs(cs.transitionDuration) + _parseTimesMs(cs.transitionDelay);
            };

            const _syncTransitionStyle = () => {
                const cs = getComputedStyle(_obsBar);
                const dur = (cs.transitionDuration && cs.transitionDuration !== '0s') ? cs.transitionDuration : '220ms';
                const fn = cs.transitionTimingFunction || 'cubic-bezier(0.4,0,0.2,1)';
                const del = cs.transitionDelay || '0ms';
                _dock.style.transition = `transform ${dur} ${fn} ${del}, opacity ${dur} ${fn} ${del}`;
            };

            const _isEditableEl = (el) => {
                if (!el || !(el instanceof HTMLElement)) return false;
                if (el.isContentEditable) return true;
                const tag = String(el.tagName || "").toLowerCase();
                if (tag === "textarea") return true;
                if (tag !== "input") return false;
                const t = String(el.type || "text").toLowerCase();
                return !["button","submit","reset","checkbox","radio","range","color","file","image","hidden"].includes(t);
            };

            const _isKeyboardOpen = () => {
                const vvH = (_vv && Number.isFinite(_vv.height)) ? _vv.height : window.innerHeight;
                if (!Number.isFinite(_vvBaseH) || _vvBaseH < 100) _vvBaseH = vvH;
                if (vvH > _vvBaseH) _vvBaseH = vvH;
                const delta = _vvBaseH - vvH;
                const activeEditable = _isEditableEl(document.activeElement);
                const forcedByViewport = delta > Math.max(160, Math.round(_tbH * 2.2));
                return forcedByViewport || (activeEditable && delta > 90);
            };

            const _calcTy = () => {
                if (_isKeyboardOpen()) return _kbdHideY;
                const hiddenByClass = _host.classList.contains('is-hidden-nav')
                    || document.body.classList.contains('is-hidden-nav')
                    || document.documentElement.classList.contains('is-hidden-nav');
                if (hiddenByClass) return _hideY;

                const r = _obsBar.getBoundingClientRect();
                const isGone = r.width === 0 && r.height === 0;
                const vis = isGone ? 0 : Math.max(0, Math.min(1, (window.innerHeight - r.top) / _tbH));
                return (1 - vis) * _hideY;
            };

            const _applyNow = () => {
                const keyboardOpen = _isKeyboardOpen();
                const ty = _calcTy();
                _dock.style.transform = `translate3d(-50%, ${ty.toFixed(2)}px, 0)`;
                _dock.style.opacity = keyboardOpen ? "0" : "1";
                _dock.style.pointerEvents = keyboardOpen ? "none" : "auto";
            };

            let _raf = 0;
            let _until = 0;
            const _tick = () => {
                _applyNow();
                if (performance.now() < _until) _raf = requestAnimationFrame(_tick);
                else _raf = 0;
            };
            const _kick = (ms = 0) => {
                _until = Math.max(_until, performance.now() + ms);
                if (!_raf) _raf = requestAnimationFrame(_tick);
            };

            _syncTransitionStyle();
            _applyNow();

            const _onNavTransition = () => {
                _syncTransitionStyle();
                _kick(_navTransitionMs() + 34);
            };
            const _onWindow = () => _kick(0);

            _obsBar.addEventListener('transitionrun', _onNavTransition, { passive: true });
            _obsBar.addEventListener('transitionstart', _onNavTransition, { passive: true });
            _obsBar.addEventListener('transitionend', _onWindow, { passive: true });
            _obsBar.addEventListener('transitioncancel', _onWindow, { passive: true });

            window.addEventListener('resize', _onWindow, { passive: true });
            window.addEventListener('orientationchange', _onNavTransition, { passive: true });
            const _onFocusIn = () => _kick(_navTransitionMs() + 80);
            const _onFocusOut = () => _kick(_navTransitionMs() + 120);
            document.addEventListener('focusin', _onFocusIn, true);
            document.addEventListener('focusout', _onFocusOut, true);
            if (_vv) {
                _vv.addEventListener('resize', _onWindow, { passive: true });
                _vv.addEventListener('scroll', _onWindow, { passive: true });
            }

            const _scroller = document.querySelector('.cm-scroller')
                           || document.querySelector('.markdown-preview-view')
                           || document.scrollingElement;
            if (_scroller && _scroller.addEventListener) {
                _scroller.addEventListener('scroll', _onWindow, { passive: true });
            }

            const _mo = new MutationObserver(() => _kick(_navTransitionMs() + 34));
            _mo.observe(_host, { attributes: true, attributeFilter: ['class'] });

            window.__pfDeskDockSyncCleanup = () => {
                try { _obsBar.removeEventListener('transitionrun', _onNavTransition); } catch (e) {}
                try { _obsBar.removeEventListener('transitionstart', _onNavTransition); } catch (e) {}
                try { _obsBar.removeEventListener('transitionend', _onWindow); } catch (e) {}
                try { _obsBar.removeEventListener('transitioncancel', _onWindow); } catch (e) {}
                try { window.removeEventListener('resize', _onWindow); } catch (e) {}
                try { window.removeEventListener('orientationchange', _onNavTransition); } catch (e) {}
                try { document.removeEventListener('focusin', _onFocusIn, true); } catch (e) {}
                try { document.removeEventListener('focusout', _onFocusOut, true); } catch (e) {}
                try { if (_vv) _vv.removeEventListener('resize', _onWindow); } catch (e) {}
                try { if (_vv) _vv.removeEventListener('scroll', _onWindow); } catch (e) {}
                try { if (_scroller && _scroller.removeEventListener) _scroller.removeEventListener('scroll', _onWindow); } catch (e) {}
                try { _mo.disconnect(); } catch (e) {}
                try { if (_raf) cancelAnimationFrame(_raf); } catch (e) {}
            };
        }
    }
}

// ── Утилиты расписания ───────────────────────────────────────────────────────
const parseDates = (arr) => (Array.isArray(arr) ? arr : (arr ? [arr] : [])).map(d => dv.date(d)).filter(Boolean).map(d => d.startOf("day"));
const toISO = d => d.toISODate();

const buildSchedule = (fracCount, startDate, modeStr, manualDates, skipsSet) => {
    if (!fracCount || fracCount <= 0 || !startDate) return [];
    let mode = "standard";
    const ms = (modeStr || "").toString().toLowerCase();
    if (/2\s*раза|два\s*раза|bid/.test(ms)) mode = "bid";
    else if (/через\s*день|qod/.test(ms)) mode = "qod";
    const activeManuals = manualDates.filter(d => d >= startDate);
    let autoSchedule = [];
    if (activeManuals.length < fracCount) {
        let curr = startDate.startOf("day"), loops = 0;
        const needed = fracCount - activeManuals.length;
        const safeLimit = fracCount + 60;
        while (autoSchedule.length < needed && autoSchedule.length < safeLimit && loops < 2000) {
            loops++;
            const iso = curr.toISODate();
            const isWork = curr.weekday <= 5 && !skipsSet.has(iso) && !holidays.has(iso);
            if (mode === "bid") {
                if (isWork) { autoSchedule.push(curr); if (autoSchedule.length < needed) autoSchedule.push(curr); }
                curr = curr.plus({ days: 1 });
            } else if (mode === "qod") {
                if (isWork) { autoSchedule.push(curr); curr = curr.plus({ days: 2 }); }
                else { curr = curr.plus({ days: 1 }); }
            } else {
                if (isWork) autoSchedule.push(curr);
                curr = curr.plus({ days: 1 });
            }
        }
    }
    return [...autoSchedule, ...activeManuals]
        .sort((a, b) => a - b)
        .slice(0, fracCount);
};

const nextWorkDayAfter = (dateObj) => {
    let d = dateObj.plus({ days: 1 });
    let safety = 0;
    while (safety < 30) {
        if (d.weekday <= 5 && !holidays.has(d.toISODate())) return d;
        d = d.plus({ days: 1 });
        safety++;
    }
    return dateObj.plus({ days: 1 });
};

const nextWorkDay = (dateObj) => {
    let d = dateObj.startOf("day");
    let safety = 0;
    while (safety < 14) {
        if (d.weekday <= 5 && !holidays.has(d.toISODate())) return d;
        d = d.plus({ days: 1 });
        safety++;
    }
    return dateObj;
};

const getWorkDays = (startRaw, endRaw) => {
    if (!startRaw || !endRaw) return 0;
    const d1 = startRaw.startOf("day"), d2 = endRaw.startOf("day");
    if (d2 < d1) {
        let c = 0, cur = d2.plus({days:1});
        while (cur <= d1) { if (cur.weekday <= 5 && !holidays.has(cur.toISODate())) c++; cur = cur.plus({days:1}); }
        return -c;
    }
    let c = 0, cur = d1.plus({days:1});
    while (cur <= d2) { if (cur.weekday <= 5 && !holidays.has(cur.toISODate())) c++; cur = cur.plus({days:1}); }
    return c;
};

const minusWorkDays = (dateObj, n) => {
    if (!dateObj) return null;
    let cur = dateObj.startOf("day"), needed = n;
    while (needed > 0) { cur = cur.minus({days:1}); if (cur.weekday <= 5 && !holidays.has(cur.toISODate())) needed--; }
    return cur;
};

const normalizeConn = (raw) => {
    const c = (raw || "").toString().trim();
    if (c === "Изолированно (параллельно)") return "Параллельно";
    if (c === "Изолированно (последовательно)") return "Последовательно";
    return c || "Параллельно";
};

// ── Л/С: нормализация (новая структура + backward compatibility) ────────────
const toLsUiDuration = (term, days) => {
    if (term === "весь_курс") return "Весь период лечения";
    const n = Number(days);
    if (Number.isFinite(n) && n > 0) return `${n} ${n === 1 ? "день" : (n >= 2 && n <= 4 ? "дня" : "дней")}`;
    const m = (term || "").toString().match(/^(\d+)_дней$/);
    if (m) {
        const k = Number(m[1]);
        return `${k} ${k === 1 ? "день" : (k >= 2 && k <= 4 ? "дня" : "дней")}`;
    }
    return "Весь период лечения";
};

const toLsTerm = (uiVal) => {
    const v = (uiVal || "").toString().trim();
    if (!v || /^весь/i.test(v)) return { Срок: "весь_курс", Дней: null };
    const m = v.match(/(\d+)/);
    const n = m ? Number(m[1]) : null;
    if (!n || n < 1) return { Срок: "весь_курс", Дней: null };
    return { Срок: `${n}_дней`, Дней: n };
};

const normalizeLsAssignments = (pageObj) => {
    const rawNew = pageObj?.ЛС_назначения;
    if (Array.isArray(rawNew) && rawNew.length > 0) {
        return rawNew.filter(Boolean).map(e => ({
            Препарат: (e.Препарат ?? "").toString().trim(),
            Дозировка: (e.Дозировка ?? "").toString().trim(),
            Срок: (e.Срок ?? "весь_курс").toString(),
            Дней: Number(e.Дней) > 0 ? Number(e.Дней) : null,
            Дата_старта: e.Дата_старта ? dv.date(e.Дата_старта)?.toFormat("yyyy-MM-dd") || "" : ""
        })).filter(e => e.Препарат);
    }
    const rawOld = pageObj?.Лекарственные_препараты;
    if (Array.isArray(rawOld) && rawOld.length > 0) {
        return rawOld.filter(Boolean).map(e => {
            const t = toLsTerm(e.Срок);
            return {
                Препарат: (e.Препарат ?? "").toString().trim(),
                Дозировка: (e.Дозировка ?? "").toString().trim(),
                Срок: t.Срок,
                Дней: t.Дней,
                Дата_старта: e.Дата_начала ? dv.date(e.Дата_начала)?.toFormat("yyyy-MM-dd") || "" : ""
            };
        }).filter(e => e.Препарат);
    }
    return [];
};

const dedupLsAssignments = (arr) => {
    const m = new Map();
    (arr || []).forEach(e => {
        if (!e || !e.Препарат) return;
        const k = `${(e.Препарат || "").trim().toLowerCase()}|${(e.Дозировка || "").trim().toLowerCase()}|${e.Срок || "весь_курс"}|${e.Дней || ""}|${e.Дата_старта || ""}`;
        if (!m.has(k)) m.set(k, e);
    });
    return Array.from(m.values());
};

const addWorkdaysIncl = (startRaw, days, holidaySet = holidays) => {
    if (!startRaw || !days || days <= 0) return null;
    let d = dv.date(startRaw)?.startOf("day");
    if (!d) return null;
    while (d.weekday > 5 || holidaySet.has(d.toISODate())) d = d.plus({ days: 1 });
    let rem = days - 1;
    while (rem > 0) {
        d = d.plus({ days: 1 });
        if (d.weekday <= 5 && !holidaySet.has(d.toISODate())) rem--;
    }
    return d;
};

const normalizeRemarksForModel = (pageObj) => {
    const raw = pageObj?.Переразметки;
    if (Array.isArray(raw) && raw.length > 0) {
        return raw.filter(Boolean).map(r => ({
            Дата: r?.Дата ? dv.date(r.Дата)?.startOf("day") || null : null,
            Переразметка: r?.Переразметка === true,
            Переоконтуривание: r?.Переоконтуривание === true,
            Старт_нового_плана: r?.Старт_нового_плана ? dv.date(r.Старт_нового_плана)?.startOf("day") || null : null
        })).filter(r => r.Дата);
    }
    if (pageObj?.Дата_переразметки) {
        const d = dv.date(pageObj.Дата_переразметки)?.startOf("day") || null;
        if (d) return [{ Дата: d, Переразметка: pageObj.Переразметка === true, Переоконтуривание: pageObj.Переоконтуривание === true, Старт_нового_плана: null }];
    }
    return [];
};

// Единый patientModel: только слой чтения/упаковки данных (без записи YAML)
const buildPatientModel = (page, ctx, precalc = {}) => {
    const todayCtx = (ctx?.today ? dv.date(ctx.today) : dv.date("now"))?.startOf("day") || dv.date("now").startOf("day");
    const holidaysCtx = ctx?.holidays || holidays;
    const consultAt = page?.Дата_консультации ? dv.date(page.Дата_консультации) : null;
    const simAt = page?.Дата_разметки ? dv.date(page.Дата_разметки) : null;

    const startTx = precalc.startTx ? dv.date(precalc.startTx)?.startOf("day") : (page?.Дата_начала_лечения ? dv.date(page.Дата_начала_лечения)?.startOf("day") : null);
    const endTx = precalc.endTx ? dv.date(precalc.endTx)?.startOf("day") : null;

    const remarks = normalizeRemarksForModel(page);
    const pendingRemark = remarks.find(r => r.Дата && r.Переразметка !== true && !(r.Старт_нового_плана && r.Старт_нового_плана <= todayCtx));
    const pendingRecontour = remarks.find(r => r.Дата && r.Переразметка === true && r.Переоконтуривание !== true && !(r.Старт_нового_плана && r.Старт_нового_плана <= todayCtx));

    const contourBy = startTx ? minusWorkDays(startTx, 3) : null;
    const recontourBy = pendingRecontour?.Дата ? addWorkdaysIncl(pendingRecontour.Дата, 2, holidaysCtx) : null;

    const doneFractions = Number(precalc.doneFractions ?? 0);
    const totalFractions = Number(precalc.totalFractions ?? 0);
    const percent = Number(precalc.percent ?? (totalFractions > 0 ? Math.round((doneFractions / totalFractions) * 100) : 0));

    return {
        pageRef: { path: page?.file?.path || "", name: page?.file?.name || "" },
        fm: Object.freeze({ ...(page || {}) }),
        dates: {
            consultAt: consultAt ? consultAt.toISODate() : null,
            simAt: simAt ? simAt.toISODate() : null,
            resimAt: pendingRemark?.Дата ? pendingRemark.Дата.toISODate() : null,
            startTx: startTx ? startTx.toISODate() : null,
            endTx: endTx ? endTx.toISODate() : null,
            dischargeAt: endTx ? endTx.toISODate() : null
        },
        flags: {
            inConsultToday: !!(consultAt && consultAt.startOf("day").toISODate() === todayCtx.toISODate()),
            inPlanning: page?.Госпитализация !== true,
            inTreatment: !!(startTx && (!endTx || endTx >= todayCtx) && startTx <= todayCtx),
            inDischarge: !!(endTx && endTx.hasSame(todayCtx, "day"))
        },
        deadlines: {
            contourBy: contourBy ? contourBy.toISODate() : null,
            recontourBy: recontourBy ? recontourBy.toISODate() : null,
            contourWindow: (simAt && contourBy) ? [simAt.startOf("day").toISODate(), contourBy.toISODate()] : [],
            recontourWindow: (pendingRecontour?.Дата && recontourBy) ? [pendingRecontour.Дата.toISODate(), recontourBy.toISODate()] : []
        },
        schedule: {
            fractions: Array.isArray(precalc.fractions) ? precalc.fractions : [],
            skipped: Array.isArray(precalc.skipped) ? precalc.skipped : [],
            extra: Array.isArray(precalc.extra) ? precalc.extra : []
        },
        progress: {
            doneFractions,
            totalFractions,
            percent,
            doneGy: Number(precalc.doneGy ?? 0)
        },
        dose: {
            deliveredGy: Number(precalc.deliveredGy ?? 0),
            displayDoseLine: String(precalc.displayDoseLine || ""),
            bed10: Number(precalc.bed10 ?? 0),
            eqd2_10: Number(precalc.eqd2_10 ?? 0),
            bed3: Number(precalc.bed3 ?? 0),
            eqd2_3: Number(precalc.eqd2_3 ?? 0),
            segments: Array.isArray(precalc.segments) ? precalc.segments : []
        },
        ui: {
            statusPillsData: [],
            warnings: [],
            remarks
        }
    };
};


// ── Расчёт расписания для всех объёмов ──────────────────────────────────────
const frac1 = Number(cur.Количество_фракций);
const rod1  = Number((cur.РОД ?? "").toString().replace(",", "."));
const startRaw  = dv.date(cur.Дата_начала_лечения);
const modeStr1  = (cur.Фракционирование ?? "").toString();
const manuals   = parseDates(cur.Внеплановые_фракции);
const skipDates = parseDates(cur.Пропущенные_даты);
const skipsSet  = new Set(skipDates.map(toISO));

let start1 = null;
if (startRaw) {
    start1 = startRaw.startOf("day");
} else {
    const sorted = manuals.slice().sort((a, b) => a - b);
    if (sorted.length) start1 = sorted[0];
}

const activeManuals1 = start1 ? manuals.filter(d => d >= start1) : manuals;
const schedule1  = buildSchedule(frac1, start1, modeStr1, activeManuals1, skipsSet);
const end1       = schedule1.length ? schedule1[schedule1.length - 1] : null;
const delivered1 = schedule1.filter(d => d <= today).length;

const extraVolumes = Array.isArray(cur.Объёмы) ? cur.Объёмы.filter(v => v && typeof v === 'object') : [];

const extraSchedules = [];
let prevChainEnd = end1;

extraVolumes.forEach((vol) => {
    const fracN = Number(vol.Количество_фракций);
    const rodN  = Number((vol.РОД ?? "").toString().replace(",", "."));
    const modeN = (vol.Фракционирование ?? "Стандартный").toString();
    const conn  = normalizeConn(vol.Связь);
    if (conn === "Одновременно") {
        extraSchedules.push({ vol, fracN: frac1, rodN, conn, schedule: schedule1, startN: start1, endN: end1 });
        return;
    }
    if (!fracN || fracN <= 0) {
        extraSchedules.push({ vol, fracN, rodN, conn, schedule: [], startN: null, endN: null });
        return;
    }
    let startN = null;
    if (conn === "Последовательный буст" || conn === "Последовательно") {
        if (prevChainEnd) startN = nextWorkDayAfter(prevChainEnd);
    } else if (conn === "Параллельно") {
        startN = start1;
    }
    if (!startN) {
        extraSchedules.push({ vol, fracN, rodN, conn, schedule: [], startN: null, endN: null });
        return;
    }
    const schedule = buildSchedule(fracN, startN, modeN, manuals, skipsSet);
    const endN = schedule.length ? schedule[schedule.length - 1] : null;
    extraSchedules.push({ vol, fracN, rodN, conn, schedule, startN, endN });
    if ((conn === "Последовательный буст" || conn === "Последовательно") && endN) {
        if (!prevChainEnd || endN > prevChainEnd) prevChainEnd = endN;
    }
});

const allEnds = [end1, ...extraSchedules.map(s => s.endN)].filter(Boolean);
allEnds.sort((a, b) => a - b);
const overallEnd = allEnds.length ? allEnds[allEnds.length - 1] : null;

// ── Прогресс ─────────────────────────────────────────────────────────────────
const SEG_COLORS = { "Последовательный буст": "#9c27b0", "Последовательно": "#ffc107" };
const barSegsList = [{ frac: frac1, delivered: delivered1, color: "#2196f3" }];
extraSchedules.forEach(s => {
    if (s.conn === "Последовательный буст" && s.fracN > 0) {
        barSegsList.push({ frac: s.fracN, delivered: s.schedule.filter(d => d <= today).length, color: SEG_COLORS[s.conn] });
    }
});
const totalFrac      = barSegsList.reduce((sum, sg) => sum + sg.frac, 0);
const totalDelivered = barSegsList.reduce((sum, sg) => sum + sg.delivered, 0);
const percent = totalFrac > 0 ? Math.min(100, Math.round((totalDelivered / totalFrac) * 100)) : 0;
let treatmentStatus = "Не начато";
if (delivered1 >= frac1 && frac1 > 0) {
    treatmentStatus = (overallEnd && overallEnd <= today) ? "Завершено" : "В процессе";
} else if (delivered1 > 0) {
    treatmentStatus = "В процессе";
}

// ── Дозиметрия ───────────────────────────────────────────────────────────────
const calcBED  = (n, d, ab) => (n && d && ab) ? n * d * (1 + d / ab) : null;
const calcEQD2 = (total, d, ab) => (total && d && ab) ? total * (d + ab) / (2 + ab) : null;
const formatDose = (val) => val != null ? Number(val.toFixed(2)) : "—";
const comma      = (x) => typeof x === "number" ? x.toString().replace(".", ",") : String(x);
const decimalsOf = (val) => { const s = (val ?? "").toString().replace(",", "."); const m = s.match(/\.(\d+)/); return m ? m[1].length : 0; };
const fmtDose    = (val, dec = 1) => comma(Number(val).toFixed(dec));

// ── Имена PTV ─────────────────────────────────────────────────────────────────
const sd1 = (frac1 && rod1) ? frac1 * rod1 : 0;
const isMultiPTV = extraVolumes.length > 0;
const ptv1DisplayName = (() => {
    if (cur.Название_PTV) return cur.Название_PTV.toString();
    if (!frac1 || !rod1) return isMultiPTV ? "PTV1" : "PTV";
    return isMultiPTV ? `PTV1 · ${Math.round(sd1 * 10) / 10} Гр` : `PTV · ${Math.round(sd1 * 10) / 10} Гр`;
})();
let cumulativeDose = sd1;
const extraDisplayNames = extraSchedules.map((s, idx) => {
    const { fracN, rodN, conn, vol } = s;
    if (vol.Название) return vol.Название.toString();
    const sdN = (fracN && rodN) ? fracN * rodN : 0;
    const volNum = idx + 2;
    if (!rodN || !fracN) return `PTV${volNum}`;
    if (conn === "Последовательный буст") {
        const cumTotal = cumulativeDose + sdN;
        cumulativeDose = cumTotal;
        return `PTV${volNum} · ${Math.round(cumTotal * 10) / 10} Гр`;
    }
    return `PTV${volNum} · ${Math.round(sdN * 10) / 10} Гр`;
});

// ── Патч скролла (один раз на страницу) ─────────────────────────────────────
// ── ГЛОБАЛЬНЫЙ ПАТЧ СКРОЛЛА (один раз на всю страницу) ───────────────────────
if (!window._pfRefreshSubscribers) window._pfRefreshSubscribers = {};
if (!window._pfRunRefreshHooks) {
    window._pfRunRefreshHooks = async (paths, payload = {}) => {
        const _paths = Array.from(new Set(
            (Array.isArray(paths) ? paths : [paths])
                .map(p => String(p || "").trim())
                .filter(Boolean)
        ));
        const _seen = new Set();
        for (const _path of _paths) {
            const _hook = window['_pfRefreshHook_' + _path];
            if (typeof _hook === "function" && !_seen.has(_hook)) {
                _seen.add(_hook);
                try { await _hook(payload); } catch (e) { console.error("_pfRefreshHook:", e); }
            }
            const _subs = window._pfRefreshSubscribers?.[_path] || {};
            for (const _cb of Object.values(_subs)) {
                if (typeof _cb === "function" && !_seen.has(_cb)) {
                    _seen.add(_cb);
                    try { await _cb(payload); } catch (e) { console.error("_pfRefreshSubscriber:", e); }
                }
            }
        }
    };
}
if (!window._pfRetargetMarkdownLeaves) {
    window._pfRetargetMarkdownLeaves = async ({ fromPaths = [], toPath = "" } = {}) => {
        const _targetPath = String(toPath || "").trim();
        const _paths = Array.from(new Set(
            [...(Array.isArray(fromPaths) ? fromPaths : [fromPaths]), _targetPath]
                .map(p => String(p || "").trim())
                .filter(Boolean)
        ));
        if (_paths.length === 0) return;
        try {
            const _leaves = app.workspace?.getLeavesOfType?.("markdown") || [];
            for (const _leaf of _leaves) {
                const _view = _leaf?.view;
                const _state = _leaf?.getViewState?.() || null;
                const _stateFile = String(_state?.state?.file || "");
                const _viewFile = String(_view?.file?.path || "");
                const _matches = _paths.includes(_stateFile) || _paths.includes(_viewFile);
                if (!_matches) continue;
                let _retargeted = false;
                if (_targetPath && _state?.type === "markdown" && _stateFile !== _targetPath) {
                    try {
                        const _nextState = JSON.parse(JSON.stringify(_state));
                        if (!_nextState.state) _nextState.state = {};
                        _nextState.state.file = _targetPath;
                        await _leaf.setViewState?.(_nextState, { focus: false, history: false });
                        _retargeted = true;
                    } catch (_) {}
                }
                if (!_retargeted) {
                    try { _view?.previewMode?.rerender?.(true); } catch (_) {}
                    try { _view?.currentMode?.rerender?.(true); } catch (_) {}
                    try { _view?.editor?.refresh?.(); } catch (_) {}
                }
            }
            try { app.workspace?.trigger?.("layout-change"); } catch (_) {}
        } catch (e) {
            console.error("_pfRetargetMarkdownLeaves:", e);
        }
    };
}
if ((window._pfmPatchedVersion || 0) < 2) {
    window._pfmPatched = true;
    window._pfmPatchedVersion = 2;
    const _origPFM = app.fileManager.processFrontMatter.bind(app.fileManager);
    app.fileManager.processFrontMatter = async (f, fn) => {
        const sc = document.querySelector('.cm-scroller')
                || document.querySelector('.markdown-preview-view')
                || document.scrollingElement;
        const top = sc ? sc.scrollTop : window.scrollY;
        const res = await _origPFM(f, fn);
        try { await window._pfRunRefreshHooks?.([String(f?.path || "")], { type: "frontmatter", file: f }); } catch (_) {}
        requestAnimationFrame(() => requestAnimationFrame(() => {
            if (sc) sc.scrollTop = top; else window.scrollTo(0, top);
        }));
        return res;
    };
}
if ((window._pfRenamePatchedVersion || 0) < 3) {
    window._pfRenamePatched = true;
    window._pfRenamePatchedVersion = 3;
    if (!window._pfRenameHooks) window._pfRenameHooks = {};
    const _origRename = app.fileManager.renameFile.bind(app.fileManager);
    app.fileManager.renameFile = async (f, newPath) => {
        const _oldPath = String(f?.path || "");
        const _newPath = String(newPath || "");
        const _res = await _origRename(f, newPath);
        try {
            const _hooks = Object.values(window._pfRenameHooks || {});
            for (const _hook of _hooks) {
                if (typeof _hook === "function") {
                    try { await _hook({ file: f, oldPath: _oldPath, newPath: _newPath }); } catch (_) {}
                }
            }
        } catch (_) {}
        try {
            const _oldRefreshHook = window['_pfRefreshHook_' + _oldPath];
            if (_oldRefreshHook && _newPath && !window['_pfRefreshHook_' + _newPath]) {
                window['_pfRefreshHook_' + _newPath] = _oldRefreshHook;
            }
            const _oldReg = window['_pfRegisterRefreshSubscriber_' + _oldPath];
            if (_oldReg && _newPath && !window['_pfRegisterRefreshSubscriber_' + _newPath]) {
                window['_pfRegisterRefreshSubscriber_' + _newPath] = _oldReg;
            }
            if (window._pfRefreshSubscribers?.[_oldPath] && _newPath) {
                window._pfRefreshSubscribers[_newPath] = Object.assign(
                    {},
                    window._pfRefreshSubscribers[_oldPath],
                    window._pfRefreshSubscribers[_newPath] || {}
                );
            }
            await window._pfRetargetMarkdownLeaves?.({ fromPaths: [_oldPath, _newPath], toPath: _newPath });
            await window._pfRunRefreshHooks?.([_oldPath, _newPath], { type: "rename", file: f, oldPath: _oldPath, newPath: _newPath });
        } catch (_) {}
        return _res;
    };
}

// ── Глобальный CSS для полей дат (мобильная фиксация) ───────────────────────
if (!document.getElementById('pf-global-date-style')) {
    const _gs = document.createElement('style');
    _gs.id = 'pf-global-date-style';
    _gs.textContent = `
        input[type="date"].pf-date-field,
        input[type="datetime-local"].pf-date-field {
            display: flex !important;
            align-items: center !important;
            -webkit-appearance: none !important;
            appearance: none !important;
            padding: 0 12px !important;
            height: 40px !important;
        }
        input[type="date"].pf-date-field::-webkit-date-and-time-value,
        input[type="datetime-local"].pf-date-field::-webkit-date-and-time-value {
            text-align: left !important;
            margin: 0 !important;
        }
        input[type="date"].pf-date-field:focus,
        input[type="datetime-local"].pf-date-field:focus {
            border-color: var(--interactive-accent) !important;
            outline: none !important;
        }
    `;
    document.head.appendChild(_gs);
}

// ── Универсальный date-picker: текст dd.mm.yyyy + нативный пикер ─────────────
// Решает проблему локализованного формата на iOS (27 февр. 2026 г.)
const makeDatePicker = (parent, initialISOValue, extraStyle = "", isDateTime = false, timeOpts = {}) => {
    const BASE = `height:40px;border-radius:6px;border:1px solid var(--background-modifier-border);font-family:var(--font-interface);font-size:14px;box-sizing:border-box;background:var(--background-primary);color:var(--text-normal);outline:none;transition:border-color 0.15s;`;

    const _dpId = "dp-" + Math.random().toString(36).slice(2, 9);
    const wrapper = parent.createEl("div");
    wrapper.style.cssText = `position:relative;display:flex;align-items:center;${extraStyle}`;

    const hidden = wrapper.createEl("input");
    hidden.type = "date"; hidden.id = _dpId;
    hidden.style.cssText = "position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);border:0;outline:none;pointer-events:none;background:transparent;";

    const txt = wrapper.createEl("input");
    txt.type = "text"; txt.inputMode = "numeric";
    txt.placeholder = "дд.мм.гггг";
    txt.autocomplete = "off";
    txt.style.cssText = isDateTime
        ? BASE + `flex:1;min-width:0;padding:0 12px;border-radius:6px 0 0 6px;border-right:none;`
        : BASE + `flex:1;min-width:0;padding:0 40px 0 12px;`;

    let timeSel = null;
    const _tsListeners = [];
    const tsStep = (timeOpts && timeOpts.step) || 30;
    const tsMin  = (timeOpts && timeOpts.minTime) || "00:00";
    const tsMax  = (timeOpts && timeOpts.maxTime) || "23:30";

    const ico = wrapper.createEl("label");
    ico.setAttribute("for", _dpId);
    ico.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`;

    if (isDateTime) {
        ico.style.cssText = `flex-shrink:0;width:36px;height:40px;box-sizing:border-box;border:1px solid var(--background-modifier-border);border-right:none;background:var(--background-secondary);display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--text-muted);transition:border-color 0.15s;`;
        const [minH, minM] = tsMin.split(':').map(Number);
        const [maxH, maxM] = tsMax.split(':').map(Number);
        const minTotal = minH * 60 + minM, maxTotal = maxH * 60 + maxM;
        timeSel = wrapper.createEl("select");
        timeSel.style.cssText = `flex-shrink:0;width:70px;height:40px;box-sizing:border-box;padding:0 2px;border:1px solid var(--background-modifier-border);border-radius:0 6px 6px 0;background:var(--background-secondary);color:var(--text-normal);font-size:13px;cursor:pointer;outline:none;transition:border-color 0.15s;text-align:center;text-align-last:center;`;
        for (let tot = minTotal; tot <= maxTotal; tot += tsStep) {
            const _o = timeSel.createEl("option");
            const _v = `${String(Math.floor(tot/60)).padStart(2,"0")}:${String(tot%60).padStart(2,"0")}`;
            _o.value = _v; _o.textContent = _v;
        }
        timeSel.value = tsMin;
    } else {
        ico.style.cssText = `position:absolute;right:0;top:0;bottom:0;width:40px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--text-muted);flex-shrink:0;`;
    }

    const _snapTime = (d) => {
        const [minH2, minM2] = tsMin.split(':').map(Number);
        const [maxH2, maxM2] = tsMax.split(':').map(Number);
        let tot = d.hour * 60 + d.minute;
        tot = Math.round(tot / tsStep) * tsStep;
        tot = Math.max(minH2*60+minM2, Math.min(maxH2*60+maxM2, tot));
        return d.set({ hour: Math.floor(tot/60), minute: tot%60, second: 0 });
    };
    const _getISO = () => isDateTime ? (hidden.value ? `${hidden.value}T${timeSel.value}` : "") : hidden.value;
    const _setISO = (iso) => {
        if (!iso) { hidden.value = ""; txt.value = ""; return; }
        const d = dv.date(iso);
        if (!d || !d.isValid) { hidden.value = ""; txt.value = ""; return; }
        hidden.value = d.toFormat("yyyy-MM-dd");
        txt.value = d.toFormat("dd.MM.yyyy");
        if (isDateTime) { const ds = _snapTime(d); timeSel.value = ds.toFormat("HH:mm"); }
    };

    if (initialISOValue) _setISO(initialISOValue);

    txt.addEventListener("input", () => {
        let raw = txt.value.replace(/[^\d]/g, "").slice(0, 8), out = raw;
        if (raw.length > 4) out = raw.slice(0,2)+"."+raw.slice(2,4)+"."+raw.slice(4);
        else if (raw.length > 2) out = raw.slice(0,2)+"."+raw.slice(2);
        txt.value = out;
        const m2 = out.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
        if (m2) { const iso = `${m2[3]}-${m2[2]}-${m2[1]}`; if (dv.date(iso)) { hidden.value = iso; hidden.dispatchEvent(new Event("change")); } }
        else if (!raw) { hidden.value = ""; hidden.dispatchEvent(new Event("change")); }
    });

    ico.addEventListener("click", () => { try { hidden.showPicker(); } catch(_) {} });

    hidden.addEventListener("change", () => {
        const d = dv.date(hidden.value);
        if (d) txt.value = d.toFormat("dd.MM.yyyy");
        if (!document.body.classList.contains("is-mobile")) txt.focus();
    });

    if (isDateTime) {
        timeSel.addEventListener("change", () => {
            _tsListeners.forEach(fn => { try { fn(); } catch(e) {} });
        });
    }

    const _setBorder = (c) => {
        txt.style.borderColor = c;
        if (isDateTime) { ico.style.borderColor = c; if (timeSel) timeSel.style.borderColor = c; }
    };
    txt.onfocus = () => _setBorder("var(--interactive-accent)");
    txt.onblur  = () => _setBorder("var(--background-modifier-border)");
    if (isDateTime && timeSel) {
        timeSel.onfocus = () => _setBorder("var(--interactive-accent)");
        timeSel.onblur  = () => _setBorder("var(--background-modifier-border)");
    }

    return {
        get value() { return _getISO(); },
        set value(iso) { _setISO(iso); },
        set onchange(fn) { hidden.addEventListener("change", fn); if (isDateTime) _tsListeners.push(fn); },
        hidden,
        el: wrapper,
        focus() { txt.focus(); }
    };
};

const ANAM_FIELDS = [
    ["Решение консилиума",        "Решение_консилиума"],
    ["Жалобы",                    "Жалобы"],
    ["Анамнез заболевания",       "Анамнез_заболевания"],
    ["Анамнез жизни",             "Анамнез_жизни"],
    ["Описания исследований",     "Описания_исследований"],
    ["Сопутствующие заболевания", "Сопутствующие_заболевания"],
];

const escapeHtml = (s) => String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");

const normalizeEcog = (raw) => {
    if (raw === null || raw === undefined) return null;
    const s = String(raw).trim();
    if (!s) return null;
    const m = s.match(/(?:ecog|эког)?\s*([0-4])/i) || s.match(/([0-4])/);
    if (!m) return null;
    const n = Number(m[1]);
    return Number.isInteger(n) && n >= 0 && n <= 4 ? String(n) : null;
};

const matchEcogInText = (text) => {
    const s = String(text || "").replace(/\u00a0/g, " ");
    const m = s.match(/(?:ECOG(?:\s*[-/–]?\s*PS)?|ЭКОГ|WHO\s*PS|функциональн(?:ый|ого)\s+статус(?:\s+по\s+шкале\s+ECOG)?|статус\s+по\s+шкале\s+ECOG)[^0-4]{0,24}(?:[:=]|[-–])?\s*([0-4])(?:\s*балл(?:а|ов)?)?/i);
    if (!m) return null;
    const value = normalizeEcog(m[1]);
    return value === null ? null : { value, fragment: String(m[0] || "").trim() };
};

const extractEcogFromText = (text) => {
    return matchEcogInText(text)?.value ?? null;
};

const normalizeLabDateKey = (raw) => {
    if (raw === null || raw === undefined || raw === "") return "";
    try {
        if (typeof dv !== "undefined" && dv?.date) {
            const d = dv.date(raw);
            if (d?.toFormat) return d.toFormat("yyyy-MM-dd");
            if (d?.toISODate) return d.toISODate();
        }
    } catch (e) {}
    try { if (raw?.toISODate) return raw.toISODate(); } catch (e) {}
    try { if (raw?.toFormat) return raw.toFormat("yyyy-MM-dd"); } catch (e) {}
    const s = String(raw);
    const m = s.match(/\d{4}-\d{2}-\d{2}/);
    return m ? m[0] : s;
};

// ── EORTC QLQ: определение модуля по МКБ-10 (внешняя область видимости) ──────
const getQLQModule = (mkb) => {
    if (!mkb) return null;
    const c = String(mkb).toUpperCase().replace(/\s/g,'');
    if (/^C50/.test(c))               return 'BR23';
    if (/^C3[34]/.test(c))            return 'LC13';
    if (/^C1[89]|^C20/.test(c))       return 'CR29';
    if (/^C61/.test(c))               return 'PR25';
    if (/^C15/.test(c))               return 'OES18';
    if (/^C0[0-9]|^C1[0-4]/.test(c)) return 'HN35';
    if (/^C7[12]/.test(c))            return 'BN20';
    if (/^C56/.test(c))               return 'OV28';
    if (/^C53/.test(c))               return 'CX24';
    return null;
};

// ============================================================
// БЛОК 0: КАРТОЧКА ПАЦИЕНТА (МОДАЛЬНЫЙ РЕДАКТОР)
// ============================================================
{
const STATE_KEY = 'pf0_' + cur.file.path;
if (!window[STATE_KEY]) window[STATE_KEY] = {};
const ls = window[STATE_KEY];
const LIVE_FM_KEY = 'pf0_livefm_' + cur.file.path;
if (!window[LIVE_FM_KEY]) window[LIVE_FM_KEY] = {};
let _liveFm = window[LIVE_FM_KEY];
const _clonePlain = (obj) => {
    try { return JSON.parse(JSON.stringify(obj ?? {})); }
    catch (_) { return Object.assign({}, obj ?? {}); }
};
const _parseYamlSafe = (src) => {
    const fn = (typeof parseYaml === "function")
        ? parseYaml
        : ((typeof window !== "undefined" && typeof window.parseYaml === "function") ? window.parseYaml : null);
    if (!fn) return null;
    try {
        const parsed = fn(src);
        return parsed && typeof parsed === "object" ? parsed : {};
    } catch (_) {
        return null;
    }
};
const refreshStoredFrontmatter = async () => {
    // Чтение с диска (app.vault.read) выдает устаревшую версию до сохранения буфера Obsidian.
    // Используем только мгновенный кэш Obsidian для живой реактивности.
    const fm = app.metadataCache.getFileCache(file)?.frontmatter || {};
    window[LIVE_FM_KEY] = _clonePlain(fm);
    _liveFm = window[LIVE_FM_KEY];
    return _liveFm;
};
const mergeIntoStoredFrontmatter = (updates) => {
    if (!_liveFm || typeof _liveFm !== "object") _liveFm = {};
    Object.entries(updates || {}).forEach(([key, value]) => {
        if (value === undefined) delete _liveFm[key];
        else _liveFm[key] = value;
    });
    window[LIVE_FM_KEY] = _liveFm;
};
const _registerRefreshSubscriber = (id, cb) => {
    if (!id || typeof cb !== "function") return () => {};
    if (!window._pfRefreshSubscribers) window._pfRefreshSubscribers = {};
    const _paths = Array.from(new Set([String(cur.file.path || ""), String(file?.path || "")].filter(Boolean)));
    _paths.forEach(_path => {
        if (!window._pfRefreshSubscribers[_path]) window._pfRefreshSubscribers[_path] = {};
        window._pfRefreshSubscribers[_path][id] = cb;
    });
    return () => {
        _paths.forEach(_path => {
            if (window._pfRefreshSubscribers?.[_path]) delete window._pfRefreshSubscribers[_path][id];
        });
    };
};
const _pfRefreshHook = async () => { await refreshStoredFrontmatter(); };
window['_pfRefreshHook_' + cur.file.path] = _pfRefreshHook;
window['_pfRegisterRefreshSubscriber_' + cur.file.path] = _registerRefreshSubscriber;
if (String(file?.path || "") && String(file?.path || "") !== String(cur.file.path || "")) {
    window['_pfRefreshHook_' + String(file.path || "")] = _pfRefreshHook;
    window['_pfRegisterRefreshSubscriber_' + String(file.path || "")] = _registerRefreshSubscriber;
}
await refreshStoredFrontmatter();

// getVal — читает сначала из ls (изменения в форме), потом из актуального frontmatter файла,
// и только в крайнем случае из dataview-снимка cur
const getStoredVal = (key) => {
    const fm = (_liveFm && Object.keys(_liveFm).length)
        ? _liveFm
        : (app.metadataCache.getFileCache(file)?.frontmatter || {});
    return Object.prototype.hasOwnProperty.call(fm, key) ? (fm[key] ?? null) : (cur[key] ?? null);
};
const getVal = (key) => ls.hasOwnProperty(key) ? ls[key] : getStoredVal(key);

const scope = "pf-" + Math.random().toString(36).substring(2, 8);
const root = dv.el("div", "", { cls: scope });

// ── Утилиты сохранения (без таймеров!) ───────────────────────────────────────
let saveNow = (updates) => {
    Object.assign(ls, updates);
    mergeIntoStoredFrontmatter(updates);
    return app.fileManager.processFrontMatter(file, fm => Object.assign(fm, updates))
        .then(async () => { await refreshStoredFrontmatter(); _showSaveFlash(); })
        .catch(e => { console.error("saveNow:", e); new Notice("❌ Ошибка сохранения: " + (e?.message || e)); });
};

// ── Авто-сохранение вычисляемых дат в frontmatter ────────────────────────────
{
    const _cEnd  = (typeof overallEnd !== 'undefined' && overallEnd) ? overallEnd.toISODate() : null;
    // Нормализуем: DataviewJS может вернуть Luxon DateTime вместо строки
    const _rawEnd = getStoredVal("Дата_окончания_лечения");
    const _sEnd  = _rawEnd
        ? (_rawEnd?.toISODate?.() ?? String(_rawEnd).slice(0, 10))
        : null;
    const _cStat = (typeof frac1 !== 'undefined' && frac1 > 0) ? treatmentStatus : null;
    const _storedStat = getStoredVal("Статус_лечения");
    const _sStat = _storedStat ? String(_storedStat) : null;
    const _au = {};
    if (_cEnd !== _sEnd)             _au.Дата_окончания_лечения = _cEnd;
    if (_cStat && _cStat !== _sStat) _au.Статус_лечения = _cStat;
    if (Object.keys(_au).length > 0) saveNow(_au);
}

// ── БАЗА ДАННЫХ ПАЦИЕНТОВ ─────────────────────────────────────────────────────
const DB_PATH = "Архив/База данных.md";
const DB_COLS = [
    "pt_id","pt_initials","sex","birth_year","age_dx","ecog_start","ecog_last",
    "icd10","tumor_location","histotype",
    "stage","stage_num","t_val","n_val","m_val","grade_val",
    "mol_subtype","er_val","pr_val","her2_val","ki67_pct","pdl1_expr",
    "egfr_mut","alk_status","ros1_status","kras_mut","nras_mut","ras_mut","braf_mut","idh_mut","brca_mut","ret_status","met_status","ntrk_status",
    "mgmt_meth","msi_status","mmr_status","gleason_score","psa_initial","other_biomarkers",
    "tx_goal","date_dx","date_start","date_end",
    "surgery","surgery_type","prior_treatment","chemo","chemo_regimen",
    "rt","rt_method","rt_sod","rt_fractions","rt_rod","rt_zone",
    "hormonal","hormonal_drug","targeted","targeted_drug","immunotherapy","immunotherapy_drug",
    "tx_status","progression","date_prog","prog_type",
    "vital_status","date_death","date_last_contact",
    "os_days","lc_days","dfs_days",
    "qlq_date","qlq_n","qlq_gl","qlq_pf","qlq_rf","qlq_ef","qlq_cf","qlq_sf",
    "qlq_fa","qlq_nv","qlq_pa","qlq_dy","qlq_sl","qlq_ap","qlq_co","qlq_di","qlq_fi",
    "qlq_module","qlq_spec_score","date_record","date_updated"
];
const DB_QLQ_PRESERVE = new Set([
    "qlq_date","qlq_n","qlq_gl","qlq_pf","qlq_rf","qlq_ef","qlq_cf","qlq_sf",
    "qlq_fa","qlq_nv","qlq_pa","qlq_dy","qlq_sl","qlq_ap","qlq_co","qlq_di","qlq_fi","qlq_spec_score"
]);
const DB_STAGE_TO_NUM = { "I":1,"II":2,"IIA":2,"IIB":2,"III":3,"IIIA":3,"IIIB":3,"IIIC":3,"IV":4 };
const DB_GOAL_MAP = {
    "Радикальный курс": 1,
    "Послеоперационный курс": 2,
    "Предоперационный курс": 3,
    "Паллиативный курс": 4,
    "Консолидирующий курс": 5,
    "Гемостатический курс": 6,
    "Сальважный курс": 7
};
const DB_TX_STATUS_MAP = { "Не начато":1, "В процессе":2, "Завершено":3 };
const DB_EXPORT_AT_KEY = "db_exported_at";
const DB_EXPORT_SOURCE_KEY = "db_export_source";
const DISCHARGED_FOLDER = "Выписаны";

const normalizeDbText = (value) => String(value ?? "").replace(/\r?\n+/g, " ").replace(/\s+/g, " ").trim();
const joinDbSourceText = (...values) => values.map(normalizeDbText).filter(Boolean).join("\n");
const dedupeSemicolonList = (value) => {
    const items = String(value ?? "")
        .split(/\s*;\s*/g)
        .map(v => normalizeDbText(v))
        .filter(Boolean);
    return Array.from(new Set(items)).join("; ");
};
const normalizeDrugNames = (value) => dedupeSemicolonList(
    normalizeDbText(value)
        .replace(/\b\d+(?:[.,]\d+)?\s*(?:мг\/м2|мг|г|мкг|мл|ЕД|IU)\b/gi, "")
        .replace(/\s*[xх×]\s*\d+\b/gi, "")
        .replace(/\s*,\s*/g, "; ")
);
const CHEMO_UPPERCASE_TOKENS = new Set([
    "AC","EC","TC","DC","PC","CHOP","R-CHOP","RCHOP","ABVD","BEP","EP","VIP",
    "FOLFOX","FOLFIRI","FOLFIRINOX","CAPOX","XELOX","FLOT","DCF","TPF","MVAC","M-VAC","CMF","CAF","FAC"
]);
const getCourseWord = (count) => {
    const abs = Math.abs(Number(count)) % 100;
    const last = abs % 10;
    if (abs >= 11 && abs <= 14) return "курсов";
    if (last === 1) return "курс";
    if (last >= 2 && last <= 4) return "курса";
    return "курсов";
};
const normalizeInlineText = (value) => String(value ?? "")
    .replace(/\r?\n+/g, " ")
    .replace(/[•●]/g, " ")
    .replace(/\*\*/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.;:])/g, "$1")
    .replace(/([,.;:])(?=\S)/g, (match, punct, offset, source) => {
        const prev = source[offset - 1] || "";
        const next = source[offset + 1] || "";
        if (punct === "." && /\d/.test(prev) && /\d/.test(next)) return ".";
        return `${punct} `;
    })
    .trim();
const splitDiagnosisSentences = (value) => normalizeInlineText(value)
    .split(/\.\s+(?=[А-ЯA-Z0-9С])/u)
    .map(part => part.trim().replace(/\.$/, ""))
    .filter(Boolean);
const diagnosisEventStamp = (part) => {
    const text = String(part || "").trim();
    let match = text.match(/^(\d{2})\.(\d{2})\.(\d{4})/);
    if (match) return Number(`${match[3]}${match[2]}${match[1]}`);
    match = text.match(/^С\s+(\d{2})\.(\d{2})\.(\d{4})/i);
    if (match) return Number(`${match[3]}${match[2]}${match[1]}`);
    match = text.match(/^(\d{2})\.(\d{4})/);
    if (match) return Number(`${match[2]}${match[1]}00`);
    match = text.match(/^С\s+(\d{2})\.(\d{4})/i);
    if (match) return Number(`${match[2]}${match[1]}00`);
    match = text.match(/^(\d{4})/);
    if (match) return Number(`${match[1]}0000`);
    match = text.match(/^С\s+(\d{4})/i);
    if (match) return Number(`${match[1]}0000`);
    return null;
};
const splitDiagnosisHeadAndEvents = (parts) => {
    const list = Array.isArray(parts) ? parts.filter(Boolean) : [];
    const eventIdx = list.findIndex(part => diagnosisEventStamp(part) !== null);
    if (eventIdx < 0) return { head: list, events: [] };
    return { head: list.slice(0, eventIdx), events: list.slice(eventIdx) };
};
const mergeDistinctSegments = (baseParts, nextParts) => {
    const normalize = (text) => String(text || "").replace(/\s+/g, " ").trim().toLowerCase();
    const result = Array.isArray(baseParts) ? [...baseParts] : [];
    const norms = result.map(normalize);
    for (const part of Array.isArray(nextParts) ? nextParts : []) {
        const norm = normalize(part);
        if (!norm) continue;
        const idx = norms.findIndex(existing => existing === norm || existing.includes(norm) || norm.includes(existing));
        if (idx < 0) {
            result.push(part);
            norms.push(norm);
            continue;
        }
        if (norm.length > norms[idx].length) {
            result[idx] = part;
            norms[idx] = norm;
        }
    }
    return result;
};
const buildDiagnosisText = (parts) => {
    const list = (Array.isArray(parts) ? parts : [])
        .map(part => normalizeInlineText(part).replace(/\.$/, ""))
        .filter(Boolean);
    return list.length ? `${list.join(". ")}.` : "";
};
const normalizeDiagnosisText = (value) => buildDiagnosisText(splitDiagnosisSentences(value));
const mergeDiagnosisText = (existingText, nextText) => {
    const currentParts = splitDiagnosisSentences(existingText);
    const incomingParts = splitDiagnosisSentences(nextText);
    if (!incomingParts.length) return buildDiagnosisText(currentParts);
    if (!currentParts.length) return buildDiagnosisText(incomingParts);
    const currentSplit = splitDiagnosisHeadAndEvents(currentParts);
    const incomingSplit = splitDiagnosisHeadAndEvents(incomingParts);
    const head = mergeDistinctSegments(currentSplit.head, incomingSplit.head);
    const mergedEvents = mergeDistinctSegments(currentSplit.events, incomingSplit.events)
        .map((part, index) => ({ part, index, stamp: diagnosisEventStamp(part) ?? Number.MAX_SAFE_INTEGER }))
        .sort((left, right) => left.stamp === right.stamp ? left.index - right.index : left.stamp - right.stamp)
        .map(item => item.part);
    return buildDiagnosisText([...head, ...mergedEvents]);
};
const normalizeChemoSchemeToken = (token) => {
    const text = normalizeInlineText(token);
    if (!text) return "";
    const upper = text.toUpperCase();
    if (CHEMO_UPPERCASE_TOKENS.has(upper)) return upper;
    return text.replace(/(^|[\s/()-])([A-Za-zА-Яа-яЁё])/gu, (_, prefix, letter) => `${prefix}${letter.toUpperCase()}`);
};
const normalizeChemoSchemeText = (text) => String(text || "")
    .split(/\s*→\s*/u)
    .map(step => step.split(/\s*\+\s*/u).map(normalizeChemoSchemeToken).filter(Boolean).join(" + "))
    .filter(Boolean)
    .join(" → ");
const normalizeChemoEntry = (value) => {
    let text = normalizeInlineText(value)
        .replace(/\b\d+(?:[.,]\d+)?\s*(?:мг\/м2|мг|г|мкг|мл|ЕД|IU)\b/giu, "")
        .replace(/\s*[xх×]\s*(\d+)\b/gu, (_, count) => ` ${count} ${getCourseWord(count)}`)
        .replace(/\b(\d+)\s*курс(?:ы|а|ов)?\b/giu, (_, count) => `${count} ${getCourseWord(count)}`)
        .replace(/(^|[^A-Za-zА-Яа-яЁё])(?:ПХТ|МХТ|ХЛТ|ХТ)(?=[^A-Za-zА-Яа-яЁё]|$)/giu, (_, prefix) => `${prefix}ХТ`)
        .replace(/\s*\+\s*/g, " + ")
        .replace(/\s*→\s*/g, " → ")
        .replace(/\s{2,}/g, " ")
        .replace(/^с\b/iu, "С")
        .trim();
    const explicitScheme = text.match(/^(.*?)\s+по\s+схеме\s+(.+)$/iu);
    if (explicitScheme) {
        const prefixBase = normalizeInlineText(explicitScheme[1])
            .replace(/(^|[^A-Za-zА-Яа-яЁё])(?:ПХТ|МХТ|ХЛТ|ХТ)(?=[^A-Za-zА-Яа-яЁё]|$)/giu, (_, prefix) => `${prefix}ХТ`);
        const prefix = /(?:^|[^A-Za-zА-Яа-яЁё])ХТ(?=[^A-Za-zА-Яа-яЁё]|$)/u.test(prefixBase) ? prefixBase : `${prefixBase} ХТ`;
        const scheme = normalizeChemoSchemeText(explicitScheme[2].replace(/\.*$/, ""));
        return normalizeInlineText(`${prefix} по схеме ${scheme}`);
    }
    const afterHt = text.match(/^(.*?(?:^|\s)ХТ)\s+(.+)$/iu);
    if (afterHt) {
        const prefix = normalizeInlineText(afterHt[1]);
        const scheme = normalizeChemoSchemeText(afterHt[2].replace(/\.*$/, ""));
        return normalizeInlineText(`${prefix} по схеме ${scheme}`);
    }
    return text;
};
const normalizeHistoryText = (value, mode = "generic") => {
    let text = String(value ?? "")
        .replace(/\r?\n+/g, "; ")
        .replace(/[•●]/g, "; ")
        .replace(/\*\*/g, "")
        .trim();
    if (!text) return "";
    text = text.replace(/\s*;\s*/g, "; ").replace(/\s{2,}/g, " ");
    if (mode === "chemo") {
        text = text
            .split(/\s*;\s*/u)
            .map(normalizeChemoEntry)
            .filter(Boolean)
            .join("; ");
    }
    return dedupeSemicolonList(text.replace(/^[;,\s]+|[;,\s]+$/g, ""));
};
const extractSentenceEvents = (value, predicate, mode = "generic") => {
    const text = String(value ?? "").replace(/\r?\n+/g, " ").trim();
    if (!text) return "";
    const items = text
        .split(/\.\s+(?=[А-ЯA-Z0-9С])/u)
        .map(v => v.trim().replace(/\.$/, ""))
        .filter(Boolean)
        .filter(predicate)
        .map(v => normalizeHistoryText(v, mode))
        .filter(Boolean);
    return Array.from(new Set(items)).join("; ");
};
const inferBinaryMarker = (sourceText, markerPattern, positivePatterns = [], negativePatterns = []) => {
    if (!sourceText) return "";
    const chunks = sourceText.match(new RegExp(`${markerPattern}[^\\n.;]{0,100}`, "ig")) || [];
    const positives = [
        /\bмутац/i, /\bполож/i, /\bpositive/i, /\bперестрой/i, /\bfusion/i,
        /\brearrang/i, /\bделец/i, /\bdel(?:19)?\b/i, /\bins\b/i, /\bампли/i, /\bamp(?:l|lif)?/i, /\bexon\b/i
    ].concat(positivePatterns);
    const negatives = [
        /\bдик(?:ий|ого)\s+тип/i, /\bwild\s*type/i, /\bwt\b/i, /\bотриц/i,
        /\bnegative/i, /\bне\s+выяв/i, /\bне\s+обнаруж/i, /\bбез\s+мутац/i
    ].concat(negativePatterns);
    for (const chunk of chunks) {
        if (negatives.some(re => re.test(chunk))) return 0;
        if (positives.some(re => re.test(chunk))) return 1;
    }
    return "";
};
const inferPdl1 = (sourceText) => {
    if (!sourceText) return "";
    const match = sourceText.match(/PD-?L1[^\n.;]{0,80}?(TPS\s*\d+(?:[.,]\d+)?%|CPS\s*\d+(?:[.,]\d+)?|\d+(?:[.,]\d+)?%|отриц[^.;\n]*|negative|не выявлен)/i);
    if (!match) return "";
    const raw = normalizeDbText(match[1] || match[0].replace(/PD-?L1/i, ""));
    return /отриц|negative|не выяв/i.test(raw) ? "0%" : raw;
};
const inferMsiStatus = (sourceText) => {
    if (!sourceText) return "";
    if (/\bMSI-H\b/i.test(sourceText)) return "MSI-H";
    if (/\bMSI-L\b/i.test(sourceText)) return "MSI-L";
    if (/\bMSS\b/i.test(sourceText) || /микросателлит[а-я\s-]*стабил/i.test(sourceText)) return "MSS";
    if (/\bMSI\b/i.test(sourceText) || /микросателлит[а-я\s-]*нестабил/i.test(sourceText)) return "MSI";
    return "";
};
const inferMmrStatus = (sourceText) => {
    if (!sourceText) return "";
    if (/\bdMMR\b/i.test(sourceText) || /дефицит[а-я\s-]*MMR/i.test(sourceText) || /утрат[а-я\s-]*экспрес[а-я\s-]*MMR/i.test(sourceText)) return "dMMR";
    if (/\bpMMR\b/i.test(sourceText) || /сохранн[а-я\s-]*экспрес[а-я\s-]*MMR/i.test(sourceText) || /MMR intact/i.test(sourceText)) return "pMMR";
    return "";
};
const inferMgmtMeth = (sourceText) => {
    if (!sourceText) return "";
    if (/MGMT[^\n.;]{0,80}(?:неметилир|unmethyl)/i.test(sourceText)) return "неметилирован";
    if (/MGMT[^\n.;]{0,80}(?:метилир|methyl)/i.test(sourceText)) return "метилирован";
    return "";
};
const inferGleason = (sourceText) => {
    if (!sourceText) return "";
    const match = sourceText.match(/Gleason[^\d]{0,20}(\d\s*\+\s*\d(?:\s*=\s*\d+)?)|Глисон[^\d]{0,20}(\d\s*\+\s*\d(?:\s*=\s*\d+)?)|сумма\s+Gleason[^\d]{0,20}(\d+)/i);
    return normalizeDbText(match?.[1] || match?.[2] || match?.[3] || "");
};
const inferInitialPsa = (sourceText) => {
    if (!sourceText) return "";
    const match = sourceText.match(/(?:исходн(?:ый|ая)|первичн(?:ый|ая)|initial)\s*(?:PSA|ПСА)[^\d]{0,20}(\d+(?:[.,]\d+)?)/i)
        || sourceText.match(/(?:PSA|ПСА)[^\d]{0,20}(\d+(?:[.,]\d+)?)[^.;\n]{0,30}(?:исходн|первичн|initial)/i);
    return match?.[1] ? match[1].replace(",", ".") : "";
};
const isTreatmentEvent = (line) => /операц|резекц|лобэктом|пневмонэктом|мастэктом|лампэктом|простатэктом|нефрэктом|гистерэктом|лимфодиссекц|биопси|ПХТ|МХТ|\bХТ\b|ХЛТ|ДЛТ|лучев|радиохирург|брахитерап|стереотакс|гормонотерап|таргет|иммунотерап|ниволумаб|пембролизумаб|осимертиниб|гефитиниб|бевацизумаб|трастузумаб|тамоксифен|летрозол|анастрозол|дегареликс|энзалутамид/i.test(line);
const isChemoEvent = (line) => /ПХТ|МХТ|\bХТ\b|ХЛТ|FOLFOX|FOLFIRI|FOLFIRINOX|R-CHOP|CHOP|CAPOX|XELOX|AC\b|EC\b|этопозид|цисплатин|карбоплатин|капецитабин|паклитаксел|доцетаксел|иринотекан|оксалиплатин|гемцитабин|темозоломид/i.test(line);
const ensureDatabaseSchema = (content) => {
    const header = "| " + DB_COLS.join(" | ") + " |";
    const sep = "| " + DB_COLS.map(() => "---").join(" | ") + " |";
    const raw = String(content ?? "");
    if (!raw.trim()) return header + "\n" + sep + "\n";
    const lines = raw.split(/\r?\n/);
    if (!lines[0]?.trim().startsWith("|")) return header + "\n" + sep + "\n";
    const currentCols = lines[0].split("|").map(c => c.trim()).filter(Boolean);
    const dataLines = lines.slice(2).filter(l => l.trim().startsWith("|"));
    const mappedRows = dataLines.map(line => {
        const cells = line.split("|").map(c => c.trim());
        const rowObj = {};
        currentCols.forEach((col, idx) => { rowObj[col] = cells[idx + 1] ?? ""; });
        return "| " + DB_COLS.map(col => rowObj[col] ?? "").join(" | ") + " |";
    });
    return [header, sep, ...mappedRows].join("\n") + "\n";
};

// buildDbRow: использует getVal — вызывается только после его определения
const buildDbRow = () => {
    const _fio = String(getVal("ФИО") || "");
    const _pp = _fio.trim().split(/\s+/);
    const _ini = _pp.length ? _pp[0] + (_pp[1] ? ' ' + _pp[1][0] + '.' : '') + (_pp[2] ? _pp[2][0] + '.' : '') : _fio;
    const _dob = getVal("Дата_рождения") ? String(getVal("Дата_рождения")) : "";
    const _yr = _dob ? _dob.slice(0, 4) : "";
    const _ds = getVal("Дата_начала_лечения") ? String(getVal("Дата_начала_лечения")) : "";
    const _de = getVal("Дата_окончания_лечения") ? String(getVal("Дата_окончания_лечения")) : "";
    const _age = (_yr && _ds) ? String(new Date(_ds).getFullYear() - Number(_yr)) : "";
    const _diag = String(getVal("Диагноз") || "");
    const _fullText = joinDbSourceText(
        getVal("Диагноз"),
        getVal("Описания_исследований"),
        getVal("Анамнез_заболевания"),
        getVal("Решение_консилиума")
    );
    const _stM = _diag.match(/\b(I{1,3}V?|IV)\s*[A-C]?\s+стадия/i);
    const _st = _stM ? _stM[0].replace(/\s+стадия/i, "").trim() : "";
    const _stN = DB_STAGE_TO_NUM[_st] || "";
    const _tM = _diag.match(/[cpyr]?T([0-4Xisab]+)/i);
    const _nM = _diag.match(/\bN([0-3Xabc]+)/i);
    const _mM = _diag.match(/\bM([01Xabc]+)/i);
    const _gM = _diag.match(/,\s*G([1-4])/i);
    const _subMap = {
        "Люминальный A": 1,
        "Люминальный B, HER2-отрицательный": 2,
        "Люминальный B HER2-отрицательный": 2,
        "Люминальный B, HER2-положительный": 3,
        "Люминальный B HER2-положительный": 3,
        "HER2-положительный": 4,
        "Тройной негативный": 5
    };
    const _subM = _diag.match(/(Люминальный\s+[AB][^.]*|Тройной негативный|HER2-положительный)/i);
    const _subStr = _subM ? _subM[0].trim() : "";
    const _subN = Object.entries(_subMap).find(([k]) => _subStr.toLowerCase().includes(k.toLowerCase()))?.[1] || "";
    const _er = _diag.match(/ER\s+(\d+)/i)?.[1] || "";
    const _pr = _diag.match(/PR\s+(\d+)/i)?.[1] || "";
    const _h2 = _diag.match(/HER2\s+(\d)/i)?.[1] || "";
    const _ki = _diag.match(/Ki67\s+([\d]+)%/i)?.[1] || "";
    const _ov = (key, fallback) => {
        const value = getVal(key);
        return (value !== null && value !== "") ? value : fallback;
    };

    const _pdl1 = _ov("db_pdl1", inferPdl1(_fullText));
    const _egfr = _ov("db_egfr_mut", inferBinaryMarker(_fullText, "EGFR", [/\bL858R\b/i, /\bT790M\b/i], []));
    const _alk = _ov("db_alk_status", inferBinaryMarker(_fullText, "ALK", [], []));
    const _ros1 = _ov("db_ros1_status", inferBinaryMarker(_fullText, "ROS1", [], []));
    const _kras = _ov("db_kras_mut", inferBinaryMarker(_fullText, "KRAS", [], []));
    const _nras = _ov("db_nras_mut", inferBinaryMarker(_fullText, "NRAS", [], []));
    const _rasFallback = (_kras === 1 || _nras === 1) ? 1 : ((_kras === 0 && _nras === 0) ? 0 : inferBinaryMarker(_fullText, "RAS", [], []));
    const _ras = _ov("db_ras_mut", _rasFallback);
    const _braf = _ov("db_braf_mut", inferBinaryMarker(_fullText, "BRAF", [], []));
    const _idh = _ov("db_idh_mut", inferBinaryMarker(_fullText, "IDH(?:1|2)?", [], []));
    const _brca = _ov("db_brca_mut", inferBinaryMarker(_fullText, "BRCA(?:1|2)?", [], []));
    const _ret = _ov("db_ret_status", inferBinaryMarker(_fullText, "RET", [], []));
    const _met = _ov("db_met_status", inferBinaryMarker(_fullText, "MET", [], []));
    const _ntrk = _ov("db_ntrk_status", inferBinaryMarker(_fullText, "NTRK(?:1|2|3)?", [], []));
    const _mgmt = normalizeDbText(_ov("db_mgmt_meth", inferMgmtMeth(_fullText)));
    const _msi = normalizeDbText(_ov("db_msi_status", inferMsiStatus(_fullText)));
    const _mmr = normalizeDbText(_ov("db_mmr_status", inferMmrStatus(_fullText)));
    const _gleason = normalizeDbText(_ov("db_gleason", inferGleason(_fullText)));
    const _psaInitial = normalizeDbText(_ov("db_initial_psa", inferInitialPsa(_fullText)));
    const _otherBiomarkers = normalizeHistoryText(_ov("db_other_biomarkers", ""), "generic");

    const _priorFallback = extractSentenceEvents(_diag, isTreatmentEvent, "generic");
    const _priorTreatment = normalizeHistoryText(_ov("db_prior_treatment", _priorFallback), "generic");
    const _chemoFallback = extractSentenceEvents(_diag, isChemoEvent, "chemo");
    const _chemoHistory = normalizeHistoryText(_ov("db_chemo_regimen", _chemoFallback), "chemo");
    const _hormDrugs = normalizeDrugNames(_ov("db_hormonal_drug", ""));
    const _targetDrugs = normalizeDrugNames(_ov("db_targeted_drug", ""));
    const _immunoDrugs = normalizeDrugNames(_ov("db_immunotherapy_drug", ""));

    const _goalN = DB_GOAL_MAP[getVal("Цель_лечения")] || "";
    const _surF = /операц|резекц|простатэктом|лобэктом|биопси/i.test(joinDbSourceText(_diag, getVal("db_surgery_type"), _priorTreatment)) ? 1 : 0;
    const _chtF = _chemoHistory ? 1 : (/ПХТ|МХТ|Темозоломид|Паклитаксел|Капецитабин|CHOP|FOLFOX|CAPOX|XELOX|CAR-T/i.test(_diag) ? 1 : 0);
    const _rtF = /ДЛТ|ХЛТ|радиохирургия|брахитерапия|СРХ|стереотаксич/i.test(joinDbSourceText(_diag, _priorTreatment)) ? 1 : 0;
    const _horF = _hormDrugs ? 1 : (/Тамоксифен|Летрозол|Дегареликс|Энзалутамид|АДТ|гормонотерап/i.test(_diag) ? 1 : 0);
    const _tarF = _targetDrugs ? 1 : (/Гефитиниб|Осимертиниб|Палбоциклиб|Бевацизумаб|таргетная/i.test(_diag) ? 1 : 0);
    const _immF = _immunoDrugs ? 1 : (/Ниволумаб|Пембролизумаб|иммунотерап/i.test(_diag) ? 1 : 0);
    const _rawRod = getVal("РОД") ? Number(String(getVal("РОД")).replace(",", ".")) : "";
    const _rawFracs = getVal("Количество_фракций") ? Number(getVal("Количество_фракций")) : "";
    const _rod = getVal("db_rt_rod") !== null ? Number(String(getVal("db_rt_rod")).replace(",", ".")) : _rawRod;
    const _fracs = getVal("db_rt_fractions") !== null ? Number(getVal("db_rt_fractions")) : _rawFracs;
    const _sod = getVal("db_rt_sod") !== null
        ? Math.round(Number(String(getVal("db_rt_sod")).replace(",", ".")) * 10) / 10
        : ((_rod && _fracs) ? Math.round(Number(_rod) * Number(_fracs) * 10) / 10 : "");
    const _zone = getVal("Область_облучения") || "";
    const _stTxN = DB_TX_STATUS_MAP[getVal("Статус_лечения")] || "";
    const _today = new Date().toISOString().slice(0, 10);
    const _osD = _ds ? String(Math.round((new Date(_de || _today) - new Date(_ds)) / 86400000)) : "";
    const _progFallback = /\bпрогресс/i.test(_fullText) ? 1 : "";

    const _dbSex = getVal("db_sex");
    let _sexN = _dbSex === "М" ? 1 : _dbSex === "Ж" ? 2 : "";
    if (_sexN === "") {
        const _pat = _pp[2] || "";
        _sexN = /ович$|евич$|ич$/i.test(_pat) ? 1 : (/овна$|евна$|ична$|инична$/i.test(_pat) ? 2 : "");
    }

    return {
        pt_id: getVal("ID_пациента") || "",
        pt_initials: _ini,
        sex: _sexN,
        birth_year: _yr,
        age_dx: _age,
        ecog_start: getVal("ECOG_статус") ?? "",
        ecog_last: getVal("db_ecog_last") !== null ? String(getVal("db_ecog_last")) : "",
        icd10: getVal("МКБ 10") || "",
        tumor_location: normalizeDbText(getVal("db_tumor_location") || ""),
        histotype: normalizeDbText(getVal("db_histotype") || ""),
        stage: _ov("db_stage", _st),
        stage_num: _ov("db_stage", _st) ? (DB_STAGE_TO_NUM[_ov("db_stage", _st)] || _stN) : _stN,
        t_val: _ov("db_t", _tM?.[1] || ""),
        n_val: _ov("db_n", _nM?.[1] || ""),
        m_val: _ov("db_m", _mM?.[1] || ""),
        grade_val: _ov("db_grade", _gM?.[1] || ""),
        mol_subtype: _ov("db_mol_subtype", _subN),
        er_val: _ov("db_er", _er),
        pr_val: _ov("db_pr", _pr),
        her2_val: _ov("db_her2", _h2),
        ki67_pct: _ov("db_ki67", _ki),
        pdl1_expr: _pdl1,
        egfr_mut: _egfr,
        alk_status: _alk,
        ros1_status: _ros1,
        kras_mut: _kras,
        nras_mut: _nras,
        ras_mut: _ras,
        braf_mut: _braf,
        idh_mut: _idh,
        brca_mut: _brca,
        ret_status: _ret,
        met_status: _met,
        ntrk_status: _ntrk,
        mgmt_meth: _mgmt,
        msi_status: _msi,
        mmr_status: _mmr,
        gleason_score: _gleason,
        psa_initial: _psaInitial,
        other_biomarkers: _otherBiomarkers,
        tx_goal: _goalN,
        date_dx: getVal("db_date_dx") || "",
        date_start: _ds,
        date_end: _de,
        surgery: _surF,
        surgery_type: normalizeDbText(getVal("db_surgery_type") || ""),
        prior_treatment: _priorTreatment,
        chemo: _chtF,
        chemo_regimen: _chemoHistory,
        rt: _rtF,
        rt_method: normalizeDbText(getVal("db_rt_method") || ""),
        rt_sod: _sod,
        rt_fractions: _fracs,
        rt_rod: _rod,
        rt_zone: _zone,
        hormonal: _horF,
        hormonal_drug: _hormDrugs,
        targeted: _tarF,
        targeted_drug: _targetDrugs,
        immunotherapy: _immF,
        immunotherapy_drug: _immunoDrugs,
        tx_status: _stTxN,
        progression: _ov("db_progression", _progFallback),
        date_prog: getVal("db_date_prog") || "",
        prog_type: getVal("db_prog_type") ?? "",
        vital_status: getVal("db_vital_status") ?? "",
        date_death: getVal("db_date_death") || "",
        date_last_contact: getVal("db_date_last_contact") || "",
        os_days: _osD,
        lc_days: getVal("db_lc_days") !== null ? String(getVal("db_lc_days")) : "",
        dfs_days: getVal("db_dfs_days") !== null ? String(getVal("db_dfs_days")) : "",
        qlq_date: "", qlq_n: "", qlq_gl: "", qlq_pf: "", qlq_rf: "", qlq_ef: "", qlq_cf: "", qlq_sf: "",
        qlq_fa: "", qlq_nv: "", qlq_pa: "", qlq_dy: "", qlq_sl: "", qlq_ap: "", qlq_co: "", qlq_di: "", qlq_fi: "",
        qlq_module: getQLQModule(getVal("МКБ 10")) || "", qlq_spec_score: "",
        date_record: "", date_updated: _today
    };
};

const _dbDischargedFolder = (typeof DISCHARGED_FOLDER === "string" && DISCHARGED_FOLDER.trim()) ? DISCHARGED_FOLDER.trim() : "Выписаны";
const isDischargedFilePath = (pathLike) => String(pathLike || "").startsWith(_dbDischargedFolder + "/");
const shouldSyncDatabaseOnSave = () => isDischargedFilePath(String(file?.path || cur.file.path || "")) || !!getStoredVal(DB_EXPORT_AT_KEY);
if (!window._pfRenameHooks) window._pfRenameHooks = {};
const TEMPLATE_RENAME_HOOK_KEY = 'pf-rename-hook-' + cur.file.path;
window._pfRenameHooks[TEMPLATE_RENAME_HOOK_KEY] = async () => {};
const ensureCurrentPatientId = async () => {
    let _dbId = getVal("ID_пациента");
    if (_dbId) return String(_dbId);
    if (!(getVal("ФИО") && getVal("Дата_рождения"))) return "";
    const _allIds = new Set(
        dv.pages().filter(p => p.ID_пациента).map(p => String(p.ID_пациента)).array()
    );
    const _svRaw = getVal("Связанные_случаи");
    const _svArr = _svRaw ? (Array.isArray(_svRaw) ? _svRaw : [_svRaw]) : [];
    let _inheritId = null;
    for (const _sv of _svArr) {
        const _fn = String(_sv).replace(/^\[\[|\]\]$/g,'').split("|")[0].trim();
        const _lp = dv.pages().find(p => p.file.basename === _fn || p.file.path === _fn);
        if (_lp?.ID_пациента) { _inheritId = String(_lp.ID_пациента); break; }
    }
    if (_inheritId) {
        await saveNow({ ID_пациента: _inheritId });
        return _inheritId;
    }
    let _nid = "", _att = 0;
    do {
        _nid = `${100 + Math.floor(Math.random()*900)}-${100 + Math.floor(Math.random()*900)}`;
    } while (_allIds.has(_nid) && ++_att < 9999);
    if (_nid) await saveNow({ ID_пациента: _nid });
    return _nid;
};

const findPatientInDatabase = async (patientId) => {
    const _dbId = String(patientId || "").trim();
    if (!_dbId) return null;
    const _dbFile = app.vault.getAbstractFileByPath(DB_PATH);
    if (!_dbFile) return null;
    const _content = ensureDatabaseSchema(await app.vault.read(_dbFile));
    const _lines = _content.split("\n");
    const _idxData = _lines.findIndex((line, i) => {
        if (i < 2) return false;
        const _cells = line.split("|").map(c => c.trim());
        return _cells[1] === _dbId;
    });
    if (_idxData < 0) return null;
    const _cells = _lines[_idxData].split("|").map(c => c.trim());
    const _row = {};
    DB_COLS.forEach((col, idx) => { _row[col] = _cells[idx + 1] ?? ""; });
    return { lineIndex: _idxData, row: _row, rawLine: _lines[_idxData] };
};

const verifyPatientInDatabase = async (patientId) => {
    try {
        const _found = await findPatientInDatabase(patientId);
        return { ok: !!_found, row: _found?.row || null };
    } catch (e) {
        console.error("verifyPatientInDatabase:", e);
        return { ok: false, error: e };
    }
};
const waitForPatientInDatabase = async (patientId, { exists = true, attempts = 7, delayMs = 180 } = {}) => {
    const _dbId = String(patientId || "").trim();
    if (!_dbId) return null;
    let _lastFound = null;
    for (let _attempt = 0; _attempt < attempts; _attempt++) {
        const _found = await findPatientInDatabase(_dbId);
        _lastFound = _found;
        if (exists ? !!_found : !_found) return _found;
        if (_attempt < attempts - 1) await new Promise(resolve => setTimeout(resolve, delayMs));
    }
    return _lastFound;
};

const setCurrentPatientExportMark = async (source = "template") => {
    try {
        await app.fileManager.processFrontMatter(file, fm => {
            fm[DB_EXPORT_AT_KEY] = new Date().toISOString().slice(0, 10);
            fm[DB_EXPORT_SOURCE_KEY] = source;
        });
        await refreshStoredFrontmatter();
        return { ok: true };
    } catch (e) {
        console.error("setCurrentPatientExportMark:", e);
        return { ok: false, reason: "mark_failed", error: e };
    }
};

const syncPatientToDatabase = async ({ markExport = false, source = "template" } = {}) => {
    const _dbId = await ensureCurrentPatientId();
    if (!_dbId) return { ok: false, reason: "missing_id" };
    const _row = buildDbRow();
    const _esc = v => String(v ?? "").replace(/\|/g, "∣").replace(/\r?\n/g, " ").trim();
    try {
        let _dbFile = app.vault.getAbstractFileByPath(DB_PATH);
        let _content = "";
        if (_dbFile) {
            _content = ensureDatabaseSchema(await app.vault.read(_dbFile));
        } else {
            if (!app.vault.getAbstractFileByPath("Архив")) await app.vault.createFolder("Архив");
            _content = ensureDatabaseSchema("");
            _dbFile = await app.vault.create(DB_PATH, _content);
        }
        const _lines = _content.split("\n");
        const _newRowStr = "| " + DB_COLS.map(c => _esc(_row[c] ?? "")).join(" | ") + " |";
        const _idxData = _lines.findIndex((line, i) => {
            if (i < 2) return false;
            const _cells = line.split("|").map(c => c.trim());
            return _cells[1] === _dbId;
        });
        if (_idxData >= 0) {
            const _oldCells = _lines[_idxData].split("|").map(c => c.trim());
            const _newCells = _newRowStr.split("|").map(c => c.trim());
            const _merged = DB_COLS.map((col, i) => {
                const _cellIndex = i + 1;
                const _oldVal = _oldCells[_cellIndex] || "";
                const _newVal = _newCells[_cellIndex] || "";
                if (DB_QLQ_PRESERVE.has(col) && _oldVal !== "") return _oldVal;
                if (col === "date_record" && _oldVal !== "") return _oldVal;
                return _newVal !== "" ? _newVal : _oldVal;
            });
            _lines[_idxData] = "| " + _merged.join(" | ") + " |";
        } else {
            const _today2 = new Date().toISOString().slice(0, 10);
            const _newInsertRow = Object.assign({}, _row, { date_record: _today2 });
            _lines.push("| " + DB_COLS.map(c => _esc(_newInsertRow[c] ?? "")).join(" | ") + " |");
        }
        const _finalContent = _lines.filter((line, i) => i < 2 || line.trim() !== "").join("\n") + "\n";
        await app.vault.modify(_dbFile, _finalContent);
        const _verifyRes = await waitForPatientInDatabase(_dbId, { exists: true });
        if (!_verifyRes) {
            throw new Error("Не удалось подтвердить запись пациента в БД после сохранения");
        }
        if (markExport) {
            const _markRes = await setCurrentPatientExportMark(source);
            if (!_markRes?.ok) throw (_markRes?.error || new Error("Не удалось отметить выгрузку в БД"));
        }
        return { ok: true };
    } catch (e) {
        console.error("DB update error:", e);
        new Notice("❌ Ошибка обновления БД: " + (e?.message || String(e)));
        return { ok: false, reason: "write_failed", error: e };
    }
};

const removePatientFromDatabase = async ({ clearExportMark = true } = {}) => {
    const _dbId = await ensureCurrentPatientId();
    if (!_dbId) return { ok: false, reason: "missing_id" };
    try {
        const _dbFile = app.vault.getAbstractFileByPath(DB_PATH);
        if (_dbFile) {
            const _content = ensureDatabaseSchema(await app.vault.read(_dbFile));
            const _lines = _content.split("\n");
            const _idxData = _lines.findIndex((line, i) => {
                if (i < 2) return false;
                const _cells = line.split("|").map(c => c.trim());
                return _cells[1] === _dbId;
            });
            if (_idxData >= 0) {
                _lines.splice(_idxData, 1);
                const _finalContent = _lines.filter((line, i) => i < 2 || line.trim() !== "").join("\n") + "\n";
                await app.vault.modify(_dbFile, _finalContent);
            }
        }
        const _verifyRes = await waitForPatientInDatabase(_dbId, { exists: false });
        if (_verifyRes) throw new Error("Не удалось подтвердить удаление пациента из БД");
        if (clearExportMark) {
            await app.fileManager.processFrontMatter(file, fm => {
                try { delete fm[DB_EXPORT_AT_KEY]; } catch (_) { fm[DB_EXPORT_AT_KEY] = null; }
                try { delete fm[DB_EXPORT_SOURCE_KEY]; } catch (_) { fm[DB_EXPORT_SOURCE_KEY] = null; }
            });
            await refreshStoredFrontmatter();
        }
        return { ok: true };
    } catch (e) {
        console.error("DB remove error:", e);
        new Notice("❌ Ошибка удаления из БД: " + (e?.message || String(e)));
        return { ok: false, reason: "delete_failed", error: e };
    }
};

const dischargeCurrentPatient = async ({ source = "template-discharge", targetFolder = _dbDischargedFolder } = {}) => {
    const _dbId = await ensureCurrentPatientId();
    if (!_dbId) return { ok: false, reason: "missing_id" };
    const _originalPath = String(file?.path || cur.file.path || "");
    const _wasAlreadyDischarged = isDischargedFilePath(_originalPath);
    const _dischargeIso = (typeof today !== "undefined" && today?.toISODate) ? today.toISODate() : new Date().toISOString().slice(0, 10);
    const _snapshot = {
        "Дата_окончания_лечения": _dischargeIso,
        "Статус_лечения": "Завершено"
    };
    if (typeof deliveredGyTotal !== "undefined" && Number.isFinite(Number(deliveredGyTotal))) {
        _snapshot.db_rt_sod = Math.round(Number(deliveredGyTotal) * 10) / 10;
    }
    if (typeof totalDelivered !== "undefined" && Number.isFinite(Number(totalDelivered))) {
        _snapshot.db_rt_fractions = Number(totalDelivered) || 0;
    }
    if (typeof rod1 !== "undefined" && Number.isFinite(Number(rod1)) && Number(rod1) > 0) {
        _snapshot.db_rt_rod = Number(rod1);
    }
    const _chemoSnapshot = (typeof buildDischargeChemoSnapshot === "function") ? buildDischargeChemoSnapshot(_dischargeIso) : "";
    if (_chemoSnapshot) {
        _snapshot.db_chemo_regimen = _chemoSnapshot;
    }
    await saveNow(_snapshot);
    const _syncRes = await syncPatientToDatabase({ markExport: false, source });
    if (!_syncRes?.ok) {
        try { await removePatientFromDatabase({ clearExportMark: false }); } catch (_) {}
        return _syncRes;
    }
    const _verifyRes = await waitForPatientInDatabase(_dbId, { exists: true });
    if (!_verifyRes) {
        await removePatientFromDatabase({ clearExportMark: false });
        return {
            ok: false,
            reason: "verify_failed",
            error: new Error("Не удалось подтвердить запись пациента в БД")
        };
    }
    try {
        if (!_wasAlreadyDischarged) {
            if (!app.vault.getAbstractFileByPath(targetFolder)) await app.vault.createFolder(targetFolder);
            const _fileName = String(file?.name || _originalPath.split("/").pop() || "");
            const _newPath = `${targetFolder}/${_fileName}`;
            if (String(file?.path || "") !== _newPath) await app.fileManager.renameFile(file, _newPath);
        }
        const _markRes = await setCurrentPatientExportMark(source);
        if (!_markRes?.ok) throw (_markRes?.error || new Error("Не удалось отметить факт выписки"));
        const _finalVerify = await waitForPatientInDatabase(_dbId, { exists: true });
        if (!_finalVerify) throw new Error("После выписки запись в БД не найдена");
        return { ok: true, id: _dbId };
    } catch (e) {
        console.error("dischargeCurrentPatient:", e);
        try {
            if (!_wasAlreadyDischarged && isDischargedFilePath(String(file?.path || ""))) {
                const _rollbackPath = _originalPath || `Пациенты/${String(file?.name || "")}`;
                if (_rollbackPath && String(file?.path || "") !== _rollbackPath) {
                    const _rollbackFolder = _rollbackPath.split("/").slice(0, -1).join("/");
                    if (_rollbackFolder && !app.vault.getAbstractFileByPath(_rollbackFolder)) await app.vault.createFolder(_rollbackFolder);
                    await app.fileManager.renameFile(file, _rollbackPath);
                }
            }
        } catch (moveErr) {
            console.error("dischargeCurrentPatient rollback move:", moveErr);
        }
        const _rmRes = await removePatientFromDatabase({ clearExportMark: true });
        if (!_rmRes?.ok) console.error("dischargeCurrentPatient rollback db:", _rmRes?.error || _rmRes);
        return { ok: false, reason: "discharge_failed", error: e };
    }
};

// ── Обёртка saveNow — БД обновляется только после выписки ────────────────────
{
    const _origSN = saveNow;
    saveNow = (updates) => {
        const _res = _origSN(updates);
        if (shouldSyncDatabaseOnSave()) {
            clearTimeout(window._ptDbTimer_);
            window._ptDbTimer_ = setTimeout(() => syncPatientToDatabase({ markExport: false, source: "template-after-discharge" }), 2500);
        }
        return _res;
    };
}

// ── Экспорт утилит для дочерних блоков (редактор БД, блок 1) ─────────────────
window['_pfUtils_' + cur.file.path] = {
    saveNow: (...a) => saveNow(...a),
    getVal:  (k)    => getVal(k),
    getStoredVal: (k) => getStoredVal(k),
    refreshStoredFrontmatter: () => refreshStoredFrontmatter(),
    syncPatientToDatabase: (opts) => syncPatientToDatabase(opts),
    removePatientFromDatabase: (opts) => removePatientFromDatabase(opts),
    verifyPatientInDatabase: (patientId) => verifyPatientInDatabase(patientId),
    dischargeCurrentPatient: (opts) => dischargeCurrentPatient(opts)
};

const _debTimers = {};
const saveLater = (key, val) => {
    ls[key] = val;   // обновляем кэш сразу, debounce только для записи в файл
    mergeIntoStoredFrontmatter({ [key]: val });
    if (_debTimers[key]) clearTimeout(_debTimers[key]);
    _debTimers[key] = setTimeout(() => {
        delete _debTimers[key];
        app.fileManager.processFrontMatter(file, fm => { fm[key] = val; })
            .then(async () => { await refreshStoredFrontmatter(); _showSaveFlash(); })
            .catch(e => { console.error("saveLater:", e); new Notice("❌ Ошибка сохранения: " + (e?.message || e)); });
    }, 400);
};

// ── Save-flash индикатор ─────────────────────────────────────────────────────
const _showSaveFlash = (() => {
    let _el = null, _timeout1 = null, _timeout2 = null;
    return () => {
        if (_el) { clearTimeout(_timeout1); clearTimeout(_timeout2); _el.remove(); _el = null; }
        const titleEl = document.querySelector('.pf0-modal-title');
        if (!titleEl) return;
        _el = document.createElement('span');
        _el.textContent = ' ✓';
        _el.style.cssText = 'color:#4caf50;font-size:13px;font-weight:700;opacity:1;transition:opacity .4s;';
        titleEl.appendChild(_el);
        _timeout1 = setTimeout(() => { if (_el) _el.style.opacity = '0'; }, 900);
        _timeout2 = setTimeout(() => { if (_el) { _el.remove(); _el = null; } }, 1400);
    };
})();

// setPending — для совместимости с кодом объёмов/тегов: мгновенно пишет в файл
const setPending = (key, val) => {
    saveNow({ [key]: val });
};

const NEW_PATIENT_FLOW_KEY = "rdt_new_patient_flow";
let _newPatientFlow = null;
try {
    localStorage.removeItem(NEW_PATIENT_FLOW_KEY);
} catch (e) {}
const _autoOpenByFm = false;
if (getStoredVal("_Открыть_редактор_сразу") === true || getStoredVal("_auto_open_editor") === true) {
    try {
        await app.fileManager.processFrontMatter(file, fm => {
            try { delete fm._Открыть_редактор_сразу; } catch (e) { fm._Открыть_редактор_сразу = null; }
            try { delete fm._auto_open_editor; } catch (e) { fm._auto_open_editor = null; }
        });
    } catch (e) {}
}

const _normSpaces = (v) => String(v ?? "").replace(/\s+/g, " ").trim();
const _sanitizeBaseName = (v) => {
    let s = _normSpaces(v).replace(/[\\/:*?"<>|]/g, "").replace(/[. ]+$/g, "");
    if (s.length > 170) s = s.slice(0, 170).trim();
    return s;
};
const _yearsWord = (n) => {
    const a = Math.abs(Number(n) || 0) % 100;
    const b = a % 10;
    if (a > 10 && a < 20) return "лет";
    if (b > 1 && b < 5) return "года";
    if (b === 1) return "год";
    return "лет";
};
const _calcAgeYears = (dobRaw) => {
    const dob = dobRaw ? dv.date(dobRaw) : null;
    const now = dv.date("today");
    if (!dob || !now) return null;
    let years = now.year - dob.year;
    if (now.month < dob.month || (now.month === dob.month && now.day < dob.day)) years--;
    return years >= 0 ? years : null;
};
const _fundMark = (fundRaw) => {
    const f = _normSpaces(fundRaw).toLowerCase();
    if (!f) return "";
    if (f.includes("мэс")) return "М";
    if (f.includes("омс")) return "О";
    if (f.includes("вмп") || f.includes("группа")) return "В";
    if (f.includes("дмс")) return "Д";
    if (f.includes("пму")) return "П";
    const m = f.match(/[a-zа-яё]/i);
    return m ? m[0].toUpperCase() : "";
};
const _fundingLabelFromGroup = (fundRaw) => {
    const compact = _normSpaces(fundRaw);
    const f = compact.toLowerCase();
    if (!f) return "";
    if (f.includes("омс")) return "ОМС";
    if (f.includes("пму")) return "ПМУ";
    if (f.includes("дмс")) return "ДМС";
    if (f.includes("мэс")) {
        const match = compact.match(/(?:мэс\D*)(\d+)/iu) || compact.match(/(\d+)\D*мэс/iu);
        return match ? `МЭС ${match[1]}` : "МЭС";
    }
    if (f.includes("вмп") || f.includes("группа")) {
        const tariff = (compact.match(/(?:вмп\D*)(\d+)/iu) || compact.match(/\((\d+)\)/u) || compact.match(/\b(200|300)\b/u))?.[1] || "";
        const group = (compact.match(/группа\s*(\d+)/iu) || compact.match(/групп[аы]\s*(\d+)/iu))?.[1] || "";
        if (tariff && group) return `ВМП ${tariff} (Группа ${group})`;
        if (tariff) return `ВМП ${tariff}`;
        if (group) return `ВМП (Группа ${group})`;
        return "ВМП";
    }
    return compact;
};
const _pickFmVal = (key) => {
    const fromLs = ls[key];
    if (fromLs !== undefined && fromLs !== null && _normSpaces(fromLs) !== "") return fromLs;
    return getStoredVal(key);
};
const _buildCanonicalPatientBaseName = () => {
    const fio = _normSpaces(_pickFmVal("ФИО"));
    const mkb = _normSpaces(_pickFmVal("МКБ 10")).toUpperCase().replace(/\s+/g, "").replace(/[^A-ZА-Я0-9.\-]/g, "");
    const fund = _normSpaces(_pickFmVal("Группа ВМП"));
    const ageYears = _calcAgeYears(_pickFmVal("Дата_рождения"));
    if (!fio || !mkb || !fund || ageYears === null) return null;
    const mark = _fundMark(fund);
    const prefix = `${mkb}${mark}`;
    const ageText = `${ageYears} ${_yearsWord(ageYears)}`;
    return _sanitizeBaseName(`${prefix} ${fio}, ${ageText}`);
};
const _autoRenamePatientFileIfNeeded = async () => {
    if (!(_newPatientFlow?.autoRename || _autoOpenByFm)) return;
    if (!String(file?.path || "").startsWith("Пациенты/")) return;

    const baseName = _buildCanonicalPatientBaseName();
    if (!baseName) {
        new Notice("⚠️ Для имени файла заполните: ФИО, Дата рождения, МКБ-10, Группа ВМП");
        return;
    }

    let nextPath = `Пациенты/${baseName}.md`;
    if (String(file.path || "") === nextPath) return;

    let idx = 2;
    while (app.vault.getAbstractFileByPath(nextPath)) {
        if (nextPath === String(file.path || "")) return;
        nextPath = `Пациенты/${baseName} (${idx}).md`;
        idx++;
    }

    await app.fileManager.renameFile(file, nextPath);
};

requestAnimationFrame(() => {
    let el = root.parentElement;
    while (el && !el.classList?.contains("markdown-preview-section") && !el.classList?.contains("cm-content")) {
        el.style.setProperty("margin-left", "0", "important");
        el.style.setProperty("padding-left", "0", "important");
        el = el.parentElement;
    }
});

// ── CSS для кнопки и Read-Only сводки ─────────────────────────────────────────
const btnStyle = document.createElement("style");
btnStyle.innerHTML = `
    .${scope} { width: 100%; box-sizing: border-box; margin-bottom: 14px; font-family: var(--font-interface); }
    .${scope}-btn-row { display: flex; gap: 12px; width: 100%; box-sizing: border-box; flex-wrap: wrap; }
    .${scope}-edit-btn {
        display: flex; align-items: center; gap: 12px; flex: 1 1 0; min-width: 0;
        background: var(--background-primary-alt);
        border: 1px solid var(--background-modifier-border);
        border-radius: 12px; padding: 0 18px; height: 52px;
        cursor: pointer; transition: all 0.2s;
        font-family: var(--font-interface); color: var(--text-normal);
        box-sizing: border-box; line-height: 1;
    }
    .${scope}-desktop-btn {
        order: 99; display: flex; align-items: center; gap: 12px;
        flex: 0 0 174px; min-width: 150px; height: 52px;
        background: var(--background-primary-alt);
        border: 1px solid var(--background-modifier-border);
        border-radius: 12px; padding: 0 18px;
        cursor: pointer; transition: all 0.2s;
        font-family: var(--font-interface); color: var(--text-normal);
        box-sizing: border-box; line-height: 1; text-decoration: none !important;
    }
    .${scope}-desktop-btn:hover {
        border-color: var(--interactive-accent);
        background: var(--background-modifier-hover);
        box-shadow: 0 0 0 3px color-mix(in srgb, var(--interactive-accent) 12%, transparent);
        color: var(--text-normal);
        text-decoration: none;
    }
    .${scope}-desktop-icon {
        flex-shrink: 0; display: flex; align-items: center; justify-content: center;
        width: 34px; height: 34px; border-radius: 8px;
        background: color-mix(in srgb, var(--interactive-accent) 12%, transparent);
        color: #00897b;
    }
    .${scope}-desktop-label {
        font-size: 14px; font-weight: 600; flex: 1; text-align: left;
        color: var(--text-normal); line-height: 1; white-space: nowrap;
    }
    .${scope}-edit-btn:hover {
        border-color: var(--interactive-accent);
        background: var(--background-modifier-hover);
        box-shadow: 0 0 0 3px color-mix(in srgb, var(--interactive-accent) 12%, transparent);
    }
    .${scope}-edit-icon {
        font-size: 18px; flex-shrink: 0;
        display: flex; align-items: center; justify-content: center;
        width: 34px; height: 34px; border-radius: 8px;
        background: color-mix(in srgb, var(--interactive-accent) 12%, transparent);
        line-height: 1;
    }
    .${scope}-edit-label {
        font-size: 14px; font-weight: 600; flex: 1; text-align: left;
        color: var(--text-normal); line-height: 1;
    }
    .${scope}-edit-arrow {
        color: var(--text-muted); font-size: 15px; flex-shrink: 0;
        transition: transform 0.2s; display: flex; align-items: center;
        line-height: 1;
    }
    .${scope}-edit-btn:hover .${scope}-edit-arrow { transform: translateX(4px); color: var(--interactive-accent); }
    @media (max-width: 600px) {
        .${scope}-btn-row { display: none; }
    }
    @media (max-width: 480px) {
        .${scope}-btn-row { flex-direction: column; gap: 8px; }
        .${scope}-edit-btn { flex: none; width: 100%; }
        .${scope}-desktop-btn { display: none; }
    }
`;
document.head.appendChild(btnStyle);

// ── Кнопка открытия модального окна ──────────────────────────────────────────
const btnRow = root.createEl("div", { cls: `${scope}-btn-row` });
window['_pfBtnRow_' + cur.file.path] = btnRow;
const editBtn = btnRow.createEl("button", { cls: `${scope}-edit-btn` });
const editIcon = editBtn.createEl("span", { cls: `${scope}-edit-icon` });
editIcon.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
editBtn.createEl("span", { text: "Редактировать карту", cls: `${scope}-edit-label` });
const editArrow = editBtn.createEl("span", { cls: `${scope}-edit-arrow` });
editArrow.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>`;

const desktopBtn = btnRow.createEl("button", { cls: `${scope}-desktop-btn` });
desktopBtn.type = "button";
desktopBtn.title = "Открыть рабочий стол";
desktopBtn.createEl("span", { cls: `${scope}-desktop-icon` }).innerHTML = `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/></svg>`;
desktopBtn.createEl("span", { text: "Рабочий стол", cls: `${scope}-desktop-label` });
desktopBtn.onclick = async (e) => {
    e.preventDefault();
    const deskFile = app.vault.getAbstractFileByPath("Рабочий стол.md");
    if (deskFile) await app.workspace.getLeaf(false).openFile(deskFile);
    else new Notice("Не найден файл: Рабочий стол.md");
};

// ── CSS для модального окна ───────────────────────────────────────────────────
const MODAL_ID = 'pf0-modal-' + String(cur.file.path || cur.file.name || "")
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .toLowerCase();

// Всегда пересоздаём стиль (иначе старый CSS остаётся после перезагрузки)
{ const _old = document.getElementById('pf0-modal-global-style'); if (_old) _old.remove(); }
const ms = document.createElement('style');
ms.id = 'pf0-modal-global-style';
ms.textContent = `
    .pf0-overlay {
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.55); z-index: 99998;
        display: flex; flex-direction: column;
        box-sizing: border-box;
        /* Отступ сверху = высота статус-бара + вырез камеры */
        padding-top: env(safe-area-inset-top, 0px);
    }
    .pf0-modal {
        background: var(--background-primary-alt);
        border: 1px solid var(--background-modifier-border);
        border-radius: 16px 16px 0 0;
        box-shadow: 0 -4px 40px rgba(0,0,0,0.3);
        width: 100%; box-sizing: border-box; font-family: var(--font-interface);
        display: flex; flex-direction: column;
        flex: 1; min-height: 0; /* занимает всё пространство ниже safe area */
        overflow: hidden; /* нужно чтобы body внутри мог скроллиться */
    }
    @media (min-width: 700px) {
        .pf0-overlay {
            align-items: center; justify-content: center;
            padding: 20px 12px;
        }
        .pf0-modal {
            border-radius: 14px; flex: none;
            width: 90%; max-width: 720px;
            max-height: calc(100dvh - 40px);
        }
    }
    .pf0-modal-header {
        display: flex; align-items: center; justify-content: space-between;
        padding: 16px 20px 14px; flex-shrink: 0;
        border-bottom: 1px solid var(--background-modifier-border);
        background: var(--background-primary-alt);
    }
    .pf0-modal-body {
        overflow-y: auto; flex: 1; min-height: 0;
        padding: 16px 20px;
        -webkit-overflow-scrolling: touch;
        padding-bottom: max(80px, calc(60px + env(safe-area-inset-bottom, 24px)));
    }
    @media (min-width: 700px) {
        .pf0-modal-body {
            padding-bottom: 20px;
        }
    }
    .pf0-modal-title { font-size: 16px; font-weight: 700; color: var(--text-normal); }
    .pf0-modal-close {
        display: flex; align-items: center; justify-content: center;
        width: 30px; height: 30px; flex-shrink: 0;
        background: var(--background-modifier-border); border: none; cursor: pointer;
        color: var(--text-muted); border-radius: 50%; transition: all 0.2s;
    }
    .pf0-modal-close:hover { background: rgba(229,57,53,0.18); color: #e53935; }
    .pf0-modal-close svg { display: block; }
`;
document.head.appendChild(ms);

// ── Функция открытия модального окна ─────────────────────────────────────────
const openPatientCardEditorModal = () => {
    // Если модалка уже открыта — не открываем повторно
    if (document.getElementById(MODAL_ID)) return;

    const overlay = document.createElement('div');
    overlay.id = MODAL_ID;
    overlay.className = 'pf0-overlay';
    const _stablePlain = (value) => {
        if (Array.isArray(value)) return value.map(_stablePlain);
        if (value && typeof value === "object") {
            return Object.keys(value).sort().reduce((acc, key) => {
                acc[key] = _stablePlain(value[key]);
                return acc;
            }, {});
        }
        return value;
    };
    const buildEditorCloseSnapshot = () => {
        const baseFm = _clonePlain((_liveFm && Object.keys(_liveFm).length)
            ? _liveFm
            : (app.metadataCache.getFileCache(file)?.frontmatter || {}));
        Object.entries(ls || {}).forEach(([key, value]) => {
            if (value === undefined) delete baseFm[key];
            else baseFm[key] = _clonePlain(value);
        });
        return JSON.stringify(_stablePlain(baseFm));
    };
    const initialEditorSnapshot = buildEditorCloseSnapshot();

    let _isClosing = false;
    const confirmEditorCloseIfDirty = () => new Promise(resolve => {
        if (buildEditorCloseSnapshot() === initialEditorSnapshot) { resolve(true); return; }
        const _ov = document.createElement('div');
        _ov.style.cssText = 'position:absolute;inset:0;background:rgba(0,0,0,0.58);z-index:140;display:flex;align-items:center;justify-content:center;border-radius:inherit;';
        const _box = document.createElement('div');
        _box.style.cssText = 'background:var(--background-primary);border:1px solid var(--background-modifier-border);border-radius:12px;padding:18px;box-shadow:0 12px 40px rgba(0,0,0,0.35);width:min(460px,92%);display:flex;flex-direction:column;gap:12px;';
        const _title = document.createElement('div');
        _title.style.cssText = 'font-size:16px;font-weight:700;color:var(--text-normal);';
        _title.textContent = 'Закрыть редактор?';
        const _desc = document.createElement('div');
        _desc.style.cssText = 'font-size:12px;color:var(--text-muted);line-height:1.5;';
        _desc.textContent = 'В этом сеансе уже были внесены изменения. Чтобы редактор не закрывался случайно, подтвердите закрытие.';
        const _btns = document.createElement('div');
        _btns.style.cssText = 'display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;';
        const _stayBtn = document.createElement('button');
        _stayBtn.textContent = 'Остаться';
        _stayBtn.style.cssText = 'padding:8px 16px;border:1px solid var(--background-modifier-border);border-radius:6px;background:none;color:var(--text-normal);cursor:pointer;font-size:13px;';
        const _closeBtn = document.createElement('button');
        _closeBtn.textContent = 'Закрыть';
        _closeBtn.style.cssText = 'padding:8px 16px;border:none;border-radius:6px;background:#e53935;color:#fff;cursor:pointer;font-size:13px;font-weight:600;';
        _stayBtn.onclick = () => { _ov.remove(); resolve(false); };
        _closeBtn.onclick = () => { _ov.remove(); resolve(true); };
        _btns.appendChild(_stayBtn);
        _btns.appendChild(_closeBtn);
        _box.appendChild(_title);
        _box.appendChild(_desc);
        _box.appendChild(_btns);
        _ov.appendChild(_box);
        modal.appendChild(_ov);
    });
    const doClose = async () => {
        if (_isClosing) return;
        const allowed = await confirmEditorCloseIfDirty();
        if (!allowed) return;
        _isClosing = true;
        try {
            await _autoRenamePatientFileIfNeeded();
            if (_autoOpenByFm) {
                await app.fileManager.processFrontMatter(file, fm => {
                    try { delete fm._Открыть_редактор_сразу; } catch (e) { fm._Открыть_редактор_сразу = null; }
                    try { delete fm._auto_open_editor; } catch (e) { fm._auto_open_editor = null; }
                });
            }
        } catch (e) {
            console.error(e);
            new Notice(`❌ Ошибка закрытия/переименования: ${e?.message || e}`);
        }
        overlay.remove();
        document.removeEventListener('keydown', onKeyDown);
        _newPatientFlow = null;
    };

    overlay.addEventListener('click', (e) => { if (e.target === overlay) doClose(); });

    // ESC закрывает
    const onKeyDown = (e) => { if (e.key === 'Escape') { e.preventDefault(); doClose(); } };
    document.addEventListener('keydown', onKeyDown);
    overlay.addEventListener('remove', () => document.removeEventListener('keydown', onKeyDown));

    const modal = document.createElement('div');
    modal.className = 'pf0-modal';

    // Заголовок + крестик (весь заголовок — активная зона закрытия)
    const header = document.createElement('div');
    header.className = 'pf0-modal-header';
    header.style.cssText = 'cursor: pointer;';
    const title = document.createElement('div');
    title.className = 'pf0-modal-title';
    title.textContent = '⚙️ Карта пациента';
    const closeBtn = document.createElement('button');
    closeBtn.className = 'pf0-modal-close';
    closeBtn.innerHTML = '<svg width="13" height="13" viewBox="0 0 13 13" fill="none" xmlns="http://www.w3.org/2000/svg"><line x1="1.35" y1="1.35" x2="11.65" y2="11.65" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="11.65" y1="1.35" x2="1.35" y2="11.65" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
    closeBtn.title = 'Закрыть (Esc)';
    closeBtn.onclick = (e) => { e.stopPropagation(); doClose(); };
    // Весь заголовок закрывает, подсветка крестика при наведении
    header.onclick = doClose;
    header.addEventListener('mouseenter', () => { closeBtn.style.background = 'rgba(229,57,53,0.18)'; closeBtn.style.color = '#e53935'; });
    header.addEventListener('mouseleave', () => { closeBtn.style.background = ''; closeBtn.style.color = ''; });
    header.appendChild(title);
    header.appendChild(closeBtn);
    modal.appendChild(header);

    // Scrollable body wrapper (fixes iOS sticky header)
    const modalBody = document.createElement('div');
    modalBody.className = 'pf0-modal-body';
    modal.appendChild(modalBody);

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // ── Содержимое модального окна ────────────────────────────────────────────
    // Для удобства работы с Obsidian-стилем используем функцию-обёртку:
    const msc = scope + "m";
    // Добавляем внутренние стили формы (удаляем старый чтобы не накапливались)
    const _oldInnerStyle = document.getElementById('pf0-inner-style-' + msc);
    if (_oldInnerStyle) _oldInnerStyle.remove();
    const innerStyle = document.createElement('style');
    innerStyle.id = 'pf0-inner-style-' + msc;
    innerStyle.textContent = `
        .${msc} { width: 100%; max-width: 100%; box-sizing: border-box; font-family: var(--font-interface); }
        .${msc} * { box-sizing: border-box; }

        .${msc}-grid {
            display: grid; grid-template-columns: 1fr;
            gap: 16px 24px; width: 100%; align-items: start;
        }
        @media (min-width: 500px) {
            .${msc}-grid { grid-template-columns: minmax(0, 2fr) minmax(0, 1fr); }
        }
        .${msc}-grid > * { min-width: 0; }

        .${msc}-sec-title {
            font-size: 0.75em; font-weight: 700; text-transform: uppercase;
            color: var(--text-accent); margin-bottom: 12px; letter-spacing: 0.05em;
            border-bottom: 1px solid var(--background-modifier-border); padding-bottom: 6px;
        }
        .${msc}-sub-title {
            font-size: 0.75em; font-weight: 700; text-transform: uppercase;
            color: var(--text-accent); margin-bottom: 8px; margin-top: 4px; letter-spacing: 0.05em;
            border-bottom: 1px solid var(--background-modifier-border); padding-bottom: 4px;
        }
        .${msc}-field-row { display: flex; flex-direction: column; gap: 6px; margin-bottom: 12px; min-width: 0; max-width: 100%; }
        .${msc}-label { font-size: 0.8em; color: var(--text-muted); font-weight: 600; }
        .${msc}-input, .${msc}-textarea {
            width: 100%; max-width: 100%; min-width: 0; min-height: 40px; background: var(--background-primary);
            color: var(--text-normal); border: 1px solid var(--background-modifier-border);
            border-radius: 6px; padding: 8px 12px; font-size: 14px; outline: none; transition: border-color 0.15s;
            -webkit-appearance: none; appearance: none;
        }
        .${msc}-select {
            width: 100%; max-width: 100%; min-width: 0; height: 40px;
            background: var(--background-primary); color: var(--text-normal);
            border: 1px solid var(--background-modifier-border);
            border-radius: 6px; padding: 0 12px; font-size: 14px; outline: none; transition: border-color 0.15s;
            -webkit-appearance: none; appearance: none;
        }
        .${msc}-input:focus, .${msc}-select:focus, .${msc}-textarea:focus { border-color: var(--interactive-accent); }
        .${msc}-textarea { resize: none; overflow-y: hidden; line-height: 1.45; field-sizing: content; }

        .${msc}-toggle-btn {
            display: flex; align-items: center; justify-content: space-between;
            width: 100%; height: 40px; min-height: 40px;
            background: var(--background-primary);
            border: 1px solid var(--background-modifier-border); border-radius: 6px;
            padding: 0 12px; cursor: pointer; transition: border-color 0.2s;
        }
        .${msc}-toggle-btn:hover { border-color: var(--interactive-accent); }
        .${msc}-toggle-text { font-size: 14px; color: var(--text-normal); font-weight: 500; }
        .${msc}-toggle-switch {
            width: 38px; height: 22px; background: var(--background-modifier-border);
            border-radius: 20px; position: relative; transition: background 0.3s; flex-shrink: 0;
        }
        .${msc}-toggle-switch::after {
            content: ""; position: absolute; top: 3px; left: 3px; width: 16px; height: 16px;
            background: var(--background-primary); border-radius: 50%;
            transition: transform 0.3s cubic-bezier(0.4, 0.0, 0.2, 1);
            box-shadow: 0 1px 3px rgba(0,0,0,0.3);
        }
        .${msc}-toggle-btn.active .${msc}-toggle-switch { background: #2196f3; }
        .${msc}-toggle-btn.active .${msc}-toggle-switch::after { transform: translateX(16px); }

        .${msc}-tags-container { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; align-items: center; }
        .${msc}-tag {
            display: inline-flex; align-items: stretch; height: 32px;
            border-radius: 16px; font-size: 13px; font-family: var(--font-interface);
            border: 1px solid var(--background-modifier-border);
            background: var(--background-primary); box-sizing: border-box; overflow: hidden;
            transition: all 0.15s ease;
        }
        .${msc}-tag-preset {
            padding: 0 14px; cursor: pointer; align-items: center; justify-content: center;
            color: var(--text-muted);
        }
        .${msc}-tag-preset:hover { border-color: var(--text-muted); color: var(--text-normal); }
        .${msc}-tag-preset.active { background: #2196f3; border-color: #2196f3; color: white; }
        .${msc}-tag-custom { color: var(--text-normal); }
        .${msc}-tag-custom span { display: flex; align-items: center; padding: 0 6px 0 12px; }
        .${msc}-tag-custom-del {
            display: flex; align-items: center; justify-content: center; padding: 0 10px 0 6px;
            background: transparent; border: none; color: var(--text-muted); cursor: pointer;
            transition: all 0.15s ease; outline: none; margin: 0;
        }
        .${msc}-tag-custom-del:hover { color: #e53935; background: rgba(229, 57, 53, 0.12); }
        .${msc}-tag-custom-del svg { width: 14px; height: 14px; }
        .${msc}-add-tag-row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-top: 4px; max-width: 100%; }
        .${msc}-add-tag-input { flex: 1 1 150px; min-width: 0; max-width: 100%; }
        .${msc}-add-tag-btn {
            flex: 0 0 auto; min-height: 40px; padding: 0 16px; background: var(--background-primary);
            color: var(--text-muted); border: 1px solid var(--background-modifier-border); border-radius: 6px;
            cursor: pointer; font-size: 0.85em; font-weight: 600; transition: all 0.15s; white-space: nowrap;
        }
        .${msc}-add-tag-btn:hover { color: var(--text-accent); border-color: var(--interactive-accent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--interactive-accent) 10%, transparent); }
        .${msc}-submit {
            display: none; /* скрыта — заменена плавающей кнопкой */
        }
        .pf0-float-close {
            position: fixed;
            bottom: env(safe-area-inset-bottom, 8px);
            left: 50%; transform: translateX(-50%);
            z-index: 99999; pointer-events: none;
            display: flex; justify-content: center;
        }
        @media (min-width: 700px) {
            .pf0-float-close {
                position: static;
                transform: none;
                padding: 16px 0 4px;
                pointer-events: auto;
            }
        }
        .pf0-float-close-btn {
            pointer-events: all;
            display: inline-flex; align-items: center; gap: 8px;
            padding: 14px 36px; border: none; border-radius: 999px; cursor: pointer;
            font-size: 15px; font-weight: 700; letter-spacing: 0.02em;
            color: #fff;
            background: #e53935;
            box-shadow: 0 4px 18px rgba(229,57,53,0.35), 0 1px 4px rgba(0,0,0,0.15);
            transition: transform 0.15s, box-shadow 0.15s, background 0.2s;
            -webkit-tap-highlight-color: transparent;
        }
        .pf0-float-close-btn:hover {
            background: #ef5350;
            box-shadow: 0 6px 24px rgba(229,57,53,0.45), 0 2px 6px rgba(0,0,0,0.2);
            transform: translateY(-2px);
        }
        .pf0-float-close-btn:active {
            transform: translateY(0px) scale(0.97);
            box-shadow: 0 2px 10px rgba(229,57,53,0.3);
        }
        @media (min-width: 700px) {
            .pf0-float-close-btn {
                width: 100%;
                justify-content: center;
                border-radius: 10px;
                padding: 12px 24px;
            }
        }
        #acEl-${msc} {
            position: fixed; z-index: 999999; background: var(--background-primary); border: 1px solid var(--interactive-accent);
            border-radius: 6px; box-shadow: 0 6px 20px rgba(0,0,0,0.25); max-height: 240px; overflow-y: auto; display: none; font-size: 13px;
        }
        #acEl-${msc} div { padding: 10px 14px; cursor: pointer; border-bottom: 1px solid var(--background-modifier-border); color: var(--text-normal); }
        #acEl-${msc} div:hover { background: var(--background-modifier-hover); }
        .${msc}-vol-card {
            background: var(--background-primary); border: 1px solid var(--background-modifier-border);
            border-radius: 8px; padding: 12px; margin-bottom: 8px; transition: opacity 0.3s ease;
        }
        .${msc}-vol-header { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; flex-wrap: wrap; }
        .${msc}-vol-dose-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(80px, 1fr)); gap: 8px; margin-top: 8px; }
        .${msc}-inline-field { display: flex; flex-direction: column; gap: 4px; }
        .${msc}-inline-label { font-size: 0.8em; color: var(--text-muted); font-weight: 600; }
        .${msc}-inline-input, .${msc}-inline-select {
            width: 100%; min-height: 40px; height: 40px; background: var(--background-primary);
            color: var(--text-normal); border: 1px solid var(--background-modifier-border);
            border-radius: 6px; font-size: 14px; -webkit-appearance: none; appearance: none; outline: none; transition: border-color 0.15s;
        }
        .${msc}-inline-input { padding: 0 12px; }
        .${msc}-inline-select { padding: 0 8px; cursor: pointer; }
        .${msc}-inline-input:focus, .${msc}-inline-select:focus { border-color: var(--interactive-accent); }
        .${msc}-ptv-name-input {
            width: 100%; min-height: 36px; height: 36px;
            background: transparent; color: var(--text-normal); border: none;
            border-bottom: 2px solid var(--background-modifier-border);
            border-radius: 0; font-size: 15px; font-weight: 700;
            box-sizing: border-box; outline: none; padding: 0 4px; transition: border-color 0.15s;
        }
        .${msc}-ptv-name-input:focus { border-bottom-color: var(--interactive-accent); }
        .${msc}-ptv-name-input::placeholder { color: var(--text-faint); font-weight: 400; }
        .${msc}-add-vol-btn {
            width: 100%; padding: 9px 14px; background: var(--background-primary);
            border: 1px solid var(--background-modifier-border); border-radius: 8px; color: var(--text-muted);
            cursor: pointer; font-size: 13px; font-weight: 600; transition: all 0.2s;
            box-sizing: border-box; margin-top: 6px; text-align: center;
        }
        .${msc}-add-vol-btn:hover { border-color: #ff9800; color: #ff9800; background: rgba(255,152,0,0.06); box-shadow: 0 0 0 3px rgba(255,152,0,0.08); }

        .pf-sec-input {
            width: 100%; height: 32px; border-radius: 6px;
            border: 1px solid var(--background-modifier-border);
            background: var(--background-primary); color: var(--text-normal);
            padding: 0 8px; font-size: 13px; outline: none;
            transition: border-color 0.15s; box-sizing: border-box;
        }
        .pf-sec-input:focus { border-color: var(--interactive-accent); }
        .pf-sec-label {
            font-size: 11px; color: var(--text-muted);
            font-weight: 600; margin-bottom: 2px; display: block;
        }
        .pf-sec-card {
            padding: 10px; background: var(--background-primary);
            border: 1px solid var(--background-modifier-border);
            border-radius: 8px; display: flex; flex-direction: column; gap: 8px;
        }
        .pf-sec-add-btn {
            width: 100%; padding: 9px 14px; background: var(--background-primary);
            border: 1px solid var(--background-modifier-border);
            border-radius: 8px; color: var(--text-muted); cursor: pointer;
            font-size: 13px; font-weight: 600; transition: all 0.2s;
            box-sizing: border-box; margin-bottom: 8px; text-align: left;
        }
        .pf-sec-inline-btn {
            width: 100%; padding: 7px 14px; background: var(--background-primary);
            border: 1px solid var(--background-modifier-border);
            border-radius: 8px; color: var(--text-muted); cursor: pointer;
            font-size: 12px; font-weight: 600; transition: all 0.2s;
            box-sizing: border-box; margin-bottom: 4px; text-align: left;
        }
        .pf-sec-del-btn {
            width: 20px; height: 20px; background: transparent;
            border: none; color: var(--text-faint); cursor: pointer;
            display: flex; align-items: center; justify-content: center;
            transition: color 0.15s; flex-shrink: 0; padding: 0;
        }
        .pf-sec-del-btn:hover { color: #e53935; }
    `;
    document.head.appendChild(innerStyle);

    // ── QLQ-модуль для текущего пациента ─────────────────────────────────────
    const _qlqModule = getQLQModule(getVal("МКБ 10"));

    // ── Генерация уникального ID пациента (XXX-XXX) — отложенная, не блокирует открытие модала
    setTimeout(() => {
        if (!getVal("ID_пациента") && getVal("ФИО") && getVal("Дата_рождения")) {
            const _allIds = new Set(
                dv.pages().filter(p => p.ID_пациента).map(p => String(p.ID_пациента)).array()
            );
            const _svRaw = getVal("Связанные_случаи");
            const _svArr = _svRaw ? (Array.isArray(_svRaw) ? _svRaw : [_svRaw]) : [];
            let _inheritId = null;
            for (const _sv of _svArr) {
                const _fn = String(_sv).replace(/^\[\[|\]\]$/g,'').trim();
                const _lp = dv.pages().find(p => p.file.basename === _fn);
                if (_lp?.ID_пациента) { _inheritId = String(_lp.ID_пациента); break; }
            }
            if (_inheritId) {
                saveNow({ ID_пациента: _inheritId });
            } else {
                let _nid, _att = 0;
                do {
                    _nid = `${100 + Math.floor(Math.random()*900)}-${100 + Math.floor(Math.random()*900)}`;
                } while (_allIds.has(_nid) && ++_att < 9999);
                saveNow({ ID_пациента: _nid });
            }
        }
    }, 50);

    const FOLDERS = ["Выписаны", "Пациенты", "Не начали", "Консультации"];
    const allPts = dv.pages().where(p => {
        if (!p.file || !p.file.path || p.file.path === cur.file.path) return false;
        return FOLDERS.some(f => p.file.path.startsWith(f + "/") || p.file.path.includes("/" + f + "/"));
    });

    function uniq(fieldName) {
        const vals = [];
        allPts.forEach(p => {
            const v = p[fieldName];
            if (v && typeof v === "string" && v.trim()) vals.push(v.trim());
        });
        return [...new Set(vals)].sort();
    }

    function getAllTags() {
        const tags = new Set();
        allPts.forEach(p => {
            const arr = (p.file?.tags || []).concat(p.tags || []);
            arr.forEach(t => {
                if (t && typeof t === "string") {
                    const clean = t.replace(/^#/, "").trim();
                    if (clean) tags.add(clean);
                }
            });
        });
        return [...tags].sort();
    }

    const SUGGEST = {
        "МКБ 10": uniq("МКБ 10"),
        "Область_облучения": uniq("Область_облучения"),
        "Теги": getAllTags()
    };

    // Автокомплит (position: fixed — работает поверх модалки)
    let acEl = document.getElementById(`acEl-${msc}`);
    if (!acEl) {
        acEl = document.createElement("div");
        acEl.id = `acEl-${msc}`;
        document.body.appendChild(acEl);
    }
    // Убираем acEl при закрытии модалки
    overlay.addEventListener('remove', () => acEl.remove(), { once: true });

    let acInput = null, acList = [];
    let externalAddTagFunc = null;
    let buildForm, initTagsMap_fn;

    initTagsMap_fn = () => {
        ls._tagsMap = new Map();
        const base = ls.hasOwnProperty('tags') ? ls.tags : (getStoredVal('tags') ?? []);
        base.forEach(t => { const s = String(t); ls._tagsMap.set(s.toLowerCase(), s); });
    };

    function positionAC() {
        if (!acInput) return;
        const r = acInput.getBoundingClientRect();
        acEl.style.width = r.width + "px";
        acEl.style.left = r.left + "px";
        const spaceBelow = window.innerHeight - r.bottom;
        if (spaceBelow < 250 && r.top > 250) {
            acEl.style.top = ""; acEl.style.bottom = (window.innerHeight - r.top) + "px";
        } else {
            acEl.style.bottom = ""; acEl.style.top = (r.bottom + 4) + "px";
        }
    }

    function renderAC(q) {
        const filtered = q.trim() ? acList.filter(v => v.toLowerCase().includes(q.toLowerCase())) : acList;
        if (!filtered.length) { acEl.style.display = "none"; return; }
        acEl.innerHTML = "";
        filtered.forEach(val => {
            const item = document.createElement("div");
            if (q.trim()) {
                const i = val.toLowerCase().indexOf(q.toLowerCase());
                item.innerHTML = i >= 0
                    ? val.slice(0, i) + `<b style="color:var(--text-accent)">${val.slice(i, i + q.length)}</b>` + val.slice(i + q.length)
                    : val;
            } else { item.textContent = val; }
            item.onmousedown = (e) => {
                e.preventDefault();
                acInput.value = val;
                if (acInput.dataset.isTagInput === "true" && externalAddTagFunc) externalAddTagFunc();
                else acInput.dispatchEvent(new Event("change"));
                acEl.style.display = "none"; acInput = null;
            };
            acEl.appendChild(item);
        });
        acEl.style.display = "block";
        positionAC();
    }

    const closeAC = (e) => {
        if (acInput && !acEl.contains(e.target) && e.target !== acInput) {
            acEl.style.display = "none"; acInput = null;
        }
    };
    document.addEventListener("mousedown", closeAC);
    overlay.addEventListener('remove', () => document.removeEventListener("mousedown", closeAC), { once: true });

    function autoGrow(el) {
        el.style.height = "auto";
        el.style.height = (el.scrollHeight || 36) + "px";
    }

    // ── Функция создания поля ─────────────────────────────────────────────────
    // opts: { acKey, opts, defaultVal, onChange }
    function field(container, label, fieldKey, type = "text", { acKey, opts, defaultVal, onChange, dpOpts } = {}) {
        if (type === "toggle") {
            const row = modal.ownerDocument.createElement("div");
            row.className = `${msc}-field-row`;
            const lbl = modal.ownerDocument.createElement("label");
            lbl.innerHTML = "&nbsp;"; lbl.className = `${msc}-label`; lbl.style.display = "block";
            row.appendChild(lbl);
            const btn = modal.ownerDocument.createElement("div");
            btn.className = `${msc}-toggle-btn`;
            if (getVal(fieldKey) === true) btn.classList.add("active");
            const btnText = modal.ownerDocument.createElement("span");
            btnText.textContent = label; btnText.className = `${msc}-toggle-text`;
            const btnSwitch = modal.ownerDocument.createElement("div");
            btnSwitch.className = `${msc}-toggle-switch`;
            btn.appendChild(btnText); btn.appendChild(btnSwitch);
            btn.onclick = () => {
                const isNowActive = !btn.classList.contains("active");
                if (isNowActive) btn.classList.add("active"); else btn.classList.remove("active");
                saveNow({ [fieldKey]: isNowActive });
                if (onChange) onChange(isNowActive);
            };
            row.appendChild(btn);
            container.appendChild(row);
            return;
        }

        const row = modal.ownerDocument.createElement("div");
        row.className = `${msc}-field-row`;
        const lbl = modal.ownerDocument.createElement("label");
        lbl.textContent = label; lbl.className = `${msc}-label`;
        row.appendChild(lbl);
        container.appendChild(row);

        let el;
        if (type === "select") {
            el = modal.ownerDocument.createElement("select");
            el.className = `${msc}-select`;
            const defOpt = modal.ownerDocument.createElement("option");
            defOpt.textContent = "— выбрать —"; defOpt.value = "";
            el.appendChild(defOpt);
            const curVal = getVal(fieldKey);
            (opts || []).forEach(o => {
                const opt = modal.ownerDocument.createElement("option");
                opt.textContent = o; opt.value = o;
                if (curVal === o) opt.selected = true;
                el.appendChild(opt);
            });
        } else if (type === "textarea") {
            el = modal.ownerDocument.createElement("textarea");
            el.className = `${msc}-textarea`;
            el.rows = 1;
            el.value = getVal(fieldKey) ?? "";
            requestAnimationFrame(() => autoGrow(el));
            el.oninput = () => autoGrow(el);
        } else if (type === "date" || type === "datetime") {
            const rawVal = getVal(fieldKey);
            const rawToUse = rawVal || defaultVal || null;
            const isDefault = !rawVal && !!defaultVal;
            let initISO = "";
            if (rawToUse) {
                try {
                    const d = dv.date(rawToUse);
                    if (d) initISO = type === "date" ? d.toFormat("yyyy-MM-dd") : d.toFormat("yyyy-MM-dd'T'HH:mm");
                } catch {}
            }
            const _picker = makeDatePicker(row, initISO, `width:100%;max-width:100%;`, type === "datetime", dpOpts || {});
            if (isDefault) _picker.hidden.style.opacity = "0.5";
            _picker.onchange = () => {
                const val = _picker.value;
                ls[fieldKey] = val || null;
                saveNow({ [fieldKey]: val || null });
                if (onChange) onChange(val);
                _picker.hidden.style.opacity = "";
            };
            return;
        } else {
            el = modal.ownerDocument.createElement("input");
            el.type = type === "number" ? "number" : "text";
            el.className = `${msc}-input`;
            if (type === "number") el.step = "any";
            el.value = getVal(fieldKey) ?? "";
        }

        // Сохранение: select — мгновенно, текст — с debounce
        if (type === "select") {
            el.onchange = () => {
                let val = el.value.trim() || null;
                ls[fieldKey] = val;
                saveNow({ [fieldKey]: val });
                if (onChange) onChange(val);
            };
        } else {
            el.onchange = () => {
                let val = el.value.trim();
                if (type === "number") val = val ? Number(val) : null; else val = val || null;
                ls[fieldKey] = val;
                saveLater(fieldKey, val);
                if (onChange) onChange(val);
            };
            if (type !== "number") {
                el.oninput = () => {
                    const val = el.value;
                    ls[fieldKey] = val.trim() || null;
                    saveLater(fieldKey, val.trim() || null);
                    if (acKey) { acList = SUGGEST[acKey] ?? []; renderAC(val); }
                    if (type === "textarea") autoGrow(el);
                };
            }
        }

        if (acKey && (type === "text" || !type)) {
            el.onfocus = () => { acInput = el; acList = SUGGEST[acKey] ?? []; renderAC(el.value); };
            el.onblur = () => setTimeout(() => { if (document.activeElement !== acEl) acEl.style.display = "none"; }, 200);
        }

        row.appendChild(el);
    }

    buildForm = () => {
    // Сбрасываем состояние перед перестройкой
    externalAddTagFunc = null;
    while (modalBody.firstChild) modalBody.removeChild(modalBody.firstChild);

    // ── Основная обёртка ──────────────────────────────────────────────────────
    const wrap = modal.ownerDocument.createElement("div");
    wrap.className = msc;

    // ── AI-ПАРСЕР ─────────────────────────────────────────────────────────────
    const AI_COLOR = "#6200ea";
    const AI_KEY_LS = "or_api_key";
    const LITELLM_KEY_LS = "litellm_api_key";
    const PROVIDER_LS = "ai_provider";
    const MODEL_LS = "or_model";
    const MODELS = [
        { id: "google/gemini-3-flash-preview", label: "Gemini 3 Flash" },
        { id: "deepseek/deepseek-v4-pro", label: "DeepSeek V4 Pro" },
        { id: "deepseek/deepseek-v4-flash", label: "DeepSeek V4 Flash" },
        { id: "qwen/qwen3.6-plus", label: "Qwen 3.6 Plus" },
        { id: "moonshotai/kimi-k2.5", label: "Kimi K2.5" },
    ];
    const AI_PROVIDERS = [
        { id: "openrouter", label: "OpenRouter", endpoint: "https://openrouter.ai/api/v1/chat/completions", keyStorage: AI_KEY_LS },
        { id: "litellm", label: "LiteLLM", endpoint: "http://212.86.115.215:4000/v1/chat/completions", keyStorage: LITELLM_KEY_LS }
    ];
    const DEFAULT_MODEL = "google/gemini-3-flash-preview";
    const PARSER_FALLBACK_MODEL = "deepseek/deepseek-v4-flash";
    const _getAiProvider = () => localStorage.getItem(PROVIDER_LS) || "openrouter";
    const _getProviderInfo = (providerId = _getAiProvider()) => AI_PROVIDERS.find(item => item.id === providerId) || AI_PROVIDERS[0];
    const _getProviderKey = (providerId = _getAiProvider()) => localStorage.getItem(_getProviderInfo(providerId).keyStorage) || "";
    const _getProviderModelId = (model, providerId = _getAiProvider()) => {
        const cleanModel = String(model || DEFAULT_MODEL).replace(/^openrouter\//, "");
        return providerId === "litellm" ? `openrouter/${cleanModel}` : cleanModel;
    };
    const _getProviderRequestConfig = (model, providerId = _getAiProvider()) => {
        const provider = _getProviderInfo(providerId);
        return {
            providerId: provider.id,
            endpoint: provider.endpoint,
            key: _getProviderKey(provider.id),
            modelId: _getProviderModelId(model, provider.id)
        };
    };
    const _getOrKey = () => localStorage.getItem(AI_KEY_LS) || "";

    const PARSER_PROMPT = `Ты — медицинский ассистент. Из предоставленного текста извлеки данные и верни ТОЛЬКО JSON-объект без пояснений.
Поля для извлечения:
- "ФИО": полное имя пациента (Фамилия Имя Отчество)
- "Дата_рождения": дата рождения в формате yyyy-MM-dd
- "СНИЛС": номер СНИЛС (формат XXX-XXX-XXX XX)
- "Номер_телефона": номер телефона
- "Email": электронная почта пациента (формат name@domain.com)
- "db_sex": пол пациента: "М" или "Ж"
- "db_tumor_location": точная анатомическая локализация опухоли (например "нижняя доля правого лёгкого", "левая молочная железа")
- "db_histotype": гистологический тип опухоли (например "аденокарцинома", "инфильтрирующий протоковый рак", "глиобластома"). Для рака предстательной железы возвращай просто "аденокарцинома" без слов "ацинарная"/"ацинозная".
- "db_date_dx": дата первичного выявления диагноза в формате yyyy-MM (или yyyy если месяц неизвестен)
- "db_surgery_type": тип выполненной операции (например "нижняя лобэктомия справа с медиастинальной лимфодиссекцией")
- "db_prior_treatment": предшествующее противоопухолевое лечение в хронологическом порядке. Строка через "; ". Формат каждой записи: "дд.мм.гггг событие" или "С мм.гггг по мм.гггг событие" или "С мм.гггг событие". Включай операции, лучевую терапию, химиотерапию, гормонотерапию, таргетную терапию и иммунотерапию. Без дозировок.
- "db_chemo_regimen": химиотерапия в хронологическом порядке. Строка через "; ". Для каждой записи указывай даты, число проведённых курсов и формулировку "ХТ по схеме ...". Без дозировок и без линий терапии. Названия препаратов и схем пиши с Заглавной Буквы. Комбинации оформляй через " + " (например "Этопозид + Карбоплатин"), последовательные схемы в одном интервале — через "→" (например "AC → Паклитаксел").
- "db_rt_method": метод лучевой терапии (например "IMRT", "VMAT", "SBRT", "3D-CRT", "брахитерапия")
- "db_hormonal_drug": препараты гормонотерапии, без дозировок, через "; " если несколько
- "db_targeted_drug": таргетные препараты, без дозировок, через "; " если несколько
- "db_immunotherapy_drug": препараты иммунотерапии, без дозировок, через "; " если несколько
- "db_stage": клиническая стадия (только цифра-буква, например "IIA", "IIIB", "IV"). Заполняй ТОЛЬКО исходную стадию на момент первичного стадирования. Если в тексте описано лечение, а затем прогрессирование/метастазы, НЕ рестадируй заболевание в IV стадию задним числом: оставь исходную стадию, а прогрессирование отрази отдельно.
- "db_t": значение T из TNM (например "2a", "3", "4b", "is") — только цифра/буква после T, без префикса c/p/y/r
- "db_n": значение N из TNM (например "0", "1", "2a", "3") — только цифра/буква после N
- "db_m": значение M из TNM (например "0", "1") — только цифра после M
- "db_grade": степень дифференцировки G (например "1", "2", "3") — только цифра
- "db_mol_subtype": молекулярный подтип — число: 1=Люминальный A, 2=Люминальный B HER2-, 3=Люминальный B HER2+, 4=HER2-позитивный, 5=Тройной негативный (только для РМЖ)
- "db_er": значение ER в баллах (число 0–8, например 7)
- "db_pr": значение PR в баллах (число 0–8, например 5)
- "db_her2": значение HER2 (0, 1, 2, 3 — только цифра)
- "db_ki67": Ki67 процент (число, например 35)
- "db_pdl1": экспрессия PD-L1 — строка (например "TPS 60%", "CPS 15", "0%")
- "db_egfr_mut": статус EGFR — 0=дикий тип/отрицательно, 1=мутация/положительно
- "db_alk_status": статус ALK — 0=отрицательно, 1=положительно
- "db_ros1_status": статус ROS1 — 0=отрицательно, 1=положительно
- "db_kras_mut": статус KRAS — 0=дикий тип/отрицательно, 1=мутация/положительно
- "db_nras_mut": статус NRAS — 0=дикий тип/отрицательно, 1=мутация/положительно
- "db_ras_mut": общий статус RAS — 0=дикий тип/отрицательно, 1=мутация/положительно
- "db_braf_mut": статус BRAF — 0=дикий тип/отрицательно, 1=мутация/положительно
- "db_idh_mut": статус IDH1/IDH2 — 0=дикий тип/отрицательно, 1=мутация/положительно
- "db_brca_mut": статус BRCA1/BRCA2 — 0=дикий тип/отрицательно, 1=мутация/положительно
- "db_ret_status": статус RET — 0=отрицательно, 1=положительно
- "db_met_status": статус MET — 0=отрицательно, 1=положительно
- "db_ntrk_status": статус NTRK — 0=отрицательно, 1=положительно
- "db_mgmt_meth": метилирование MGMT — строка "метилирован" или "неметилирован"
- "db_msi_status": микросателлитный статус — строка "MSS", "MSI-H", "MSI-L" или "MSI"
- "db_mmr_status": статус MMR — строка "pMMR" или "dMMR"
- "db_gleason": шкала Глисона (например "4+5=9")
- "db_initial_psa": исходный ПСА / PSA (число, например 47.6)
- "db_other_biomarkers": прочие релевантные биомаркеры, не вошедшие в отдельные поля (например "ATRX loss; 1p/19q codeletion; TERT mutation")
- "db_progression": 1 если в документе упомянуто прогрессирование заболевания, 0 если явно указано отсутствие прогрессирования
- "db_date_prog": дата прогрессирования в формате yyyy-MM (только если явно указана)
- "db_prog_type": тип прогрессирования — число: 1=локальное, 2=регионарное, 3=отдалённые метастазы, 4=смешанное
- "МКБ 10": код МКБ-10 (например C50.1)
- "Диагноз": структурированный текст. При нескольких онкологических диагнозах — нумеруй 1) ... 2) ... каждый с новой строки. СТРУКТУРА ОДНОГО ДИАГНОЗА (всё в одну строку, элементы разделены точкой с пробелом): Строка 1: [Гистологический тип] [локализация], [TNM с префиксом c/p/y/r], G[степень], [стадия]. Строка 2 (если есть ИГХ/молекулярные маркеры): маркеры на английском (ER Xб, PR Xб, HER2 X+, Ki67 X%, PD-L1 TPS X%, EGFR, ALK, KRAS, IDH, MSS и т.д.) + подтип СТРОГО НА РУССКОМ (Люминальный A / Люминальный B HER2-отрицательный / Люминальный B HER2-положительный / HER2-положительный / Тройной негативный). Строки лечения: разовое — "дд.мм.гггг Событие." (без тире); диапазон — "С мм.гггг по мм.гггг Событие."; начато и продолжается — "С мм.гггг Событие.". ПРАВИЛА ЛЕЧЕНИЯ: НЕ писать "Состояние после". НЕ упоминать номера линий терапии. Лучевую терапию (ДЛТ, ХЛТ, брахитерапия, стереотаксис) — **жирным**, без дозировки СОД. Стереотаксическую радиохирургию писать как **Стереотаксическая радиохирургия**. ХТ: только название схемы/комбинации без дозировок, без линий, без числа курсов; комбинации оформляй через "+", последовательные режимы — через "→". Гормонотерапию, таргетную терапию и иммунотерапию — только название препарата, без дозировок. Прогрессирование — отдельной записью: "мм.гггг Прогрессирование, [описание].". СТАДИЯ И TNM В ДИАГНОЗЕ ФИКСИРУЮТСЯ ТОЛЬКО ОДИН РАЗ — на момент первичного стадирования. После начала противоопухолевого лечения НЕ переписывай первую строку диагноза в IV стадию по факту прогрессирования или появления отдалённых метастазов; такие события указывай только отдельными строками прогрессирования. СТРОЖАЙШИЙ ФИЛЬТР: в Диагноз включать ИСКЛЮЧИТЕЛЬНО онкологическое лечение (операции на опухоли, ХТ, ЛТ, гормонотерапия, таргетная терапия, иммунотерапия). Если данные не верифицированы — пиши "предположительно" или "клинически". КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО включать в Диагноз запланированное/рекомендованное лечение из протоколов консилиумов, решений ОК или назначений врача — только ФАКТИЧЕСКИ ПРОВЕДЁННОЕ лечение с реальными датами начала/окончания. Решения консилиума, рекомендации и планируемые курсы → поле "Решение_консилиума", НЕ в "Диагноз". Для рака предстательной железы не используй формулировку "ацинарная/ацинозная аденокарцинома" — пиши просто "Аденокарцинома". ПРИМЕРЫ: "Инфильтрирующий протоковый рак левой молочной железы, pT2N3cM0, G2, IIIC стадия. ER 7б, PR 5б, HER2 0+, Ki67 35%. Люминальный B, HER2-отрицательный. 15.01.2021 Органосохраняющая операция слева с лимфодиссекцией. С 03.2021 по 07.2021 ПХТ AC → Паклитаксел. С 08.2021 по 10.2021 **ДЛТ на молочную железу и зоны регионарного метастазирования**. С 11.2021 Гормонотерапия Тамоксифен. 05.2023 Прогрессирование, метастазы в кости (L2–L4, таз). С 06.2023 по 11.2023 МХТ Капецитабин. 12.2023 Прогрессирование. С 12.2023 Палбоциклиб + Летрозол." | "Аденокарцинома нижней доли правого лёгкого, cT2aN2M0, G2, IIIA стадия. EGFR del19+, ALK отрицательный, PD-L1 TPS 60%. 15.03.2022 Нижняя лобэктомия справа с медиастинальной лимфодиссекцией. С 05.2022 Гефитиниб. 11.2023 Прогрессирование, метастазы в головной мозг. 12.2023 **Стереотаксическая радиохирургия**. С 01.2024 Осимертиниб." | "Аденокарцинома прямой кишки, cT3N1bM0, G2, IIIB стадия. KRAS дикий тип, BRAF дикий тип, MSS. С 01.2024 по 03.2024 **ХЛТ (Капецитабин + ДЛТ)**. 15.04.2024 Низкая передняя резекция прямой кишки. С 06.2024 по 10.2024 ПХТ FOLFOX." | "Аденокарцинома предстательной железы, cT3aN0M0, G3, IIIB стадия. Gleason 4+5=9. Initial PSA 47.6. 20.02.2024 Биопсия простаты. С 03.2024 АДТ Дегареликс. С 04.2024 по 05.2024 **ДЛТ на простату и регионарные лимфоузлы**."
- "Решение_консилиума": решение консилиума, рекомендуемая тактика. Обязательно указывай учреждение, дату и номер консилиума/ОК, если номер есть в документе.
- "Жалобы": жалобы пациента
- "Анамнез_заболевания": история болезни в формате хронологического тайм-лайна. Каждое событие — отдельная строка: "дд.мм.гггг Описание события;" Включай: первичные обращения, выставление диагноза, операции, курсы ХТ/ЛТ, консилиумы, госпитализации, ключевые изменения состояния, прогрессирование. Для консилиумов обязательно указывай номер консилиума/ОК, если он есть в документе: "дд.мм.гггг Онкоконсилиум №XXXX, [учреждение]: [краткое решение];". Гистологические исследования включай в краткой форме: "дд.мм.гггг ПГИ №XXXXXX: [краткое заключение];" и "дд.мм.гггг ИГХ №XXXXXX: [ключевые маркеры];" и "дд.мм.гггг МГИ №XXXXXX: [молекулярный результат];" Из лабораторных данных включай ТОЛЬКО значения онкомаркеров (ПСА, РЭА, СА 19-9, СА 125, АФП, СА 15-3) с датой. НЕ включай ОАК, биохимию, коагулограмму, анализ мочи — они идут в "Лабораторные". Если дата неизвестна — указывай год или мм.гггг.
- "Анамнез_жизни": анамнез жизни: сопутствующие заболевания, наследственность, аллергии. Если в документе явно упомянуты препараты постоянного приёма по сопутствующим заболеваниям — добавь в конце отдельным блоком: "● [Название препарата], [дозировка], [режим]." для каждого препарата. ВАЖНО: вноси ТОЛЬКО препараты, прямо указанные в документе, ничего не додумывать.
- "Описания_исследований": результаты всех исследований в хронологическом порядке. Каждое исследование — отдельная строка с датой и номером протокола (если есть): "дд.мм.гггг ПГИ №XXXXXXX: [полное морфологическое описание без сокращений]." "дд.мм.гггг ИГХ №XXXXXXX: [все маркеры с результатами]." "дд.мм.гггг МГИ №XXXXXXX: [молекулярно-генетические данные]." "дд.мм.гггг УЗИ [область]: [описание]." "дд.мм.гггг КТ [область]: [описание]." "дд.мм.гггг МРТ [область]: [описание]." Сохраняй ВСЕ показатели подробно (ER/PR, Ki67, грейд G, размеры, метастазы). При отсутствии номера протокола — только дата и тип исследования.
- "Сопутствующие_заболевания": сопутствующие диагнозы
- "ECOG_статус": функциональный статус ECOG (целое число 0-4)
- "Лабораторные": массив объектов. Каждый объект — анализы за одну дату взятия биоматериала. Формат: {"Дата":"yyyy-MM-dd","Лейкоциты":число,"Нейтрофилы":число,"Лимфоциты":число,"Моноциты":число,"Эозинофилы":число,"Базофилы":число,"Эритроциты":число,"Гемоглобин":число,"Гематокрит":число,"Тромбоциты":число,"СОЭ":число,"АЛТ":число,"АСТ":число,"ЩФ":число,"ГГТ":число,"Билирубин":число,"Бил_прям":число,"Общий_белок":число,"Мочевина":число,"Креатинин":число,"Глюкоза":число,"Натрий":число,"Калий":число,"МНО":число,"АЧТВ":число,"ТВ":число,"ПТВ":число,"Д_димер":число,"ПСА":число,"РЭА":число,"СА_19_9":число,"СА_125":число,"АФП":число,"СА_15_3":число,"Уробилиноген_м":число,"Удельный_вес_м":число,"pH_мочи":число,"Лейкоциты_мочи":число,"Белок_мочи":число,"Билирубин_мочи":"строка","Глюкоза_мочи":"строка","Кровь_мочи":"строка","Кетоны_мочи":"строка","Нитриты_мочи":"строка"}. МАППИНГ РУССКИХ НАЗВАНИЙ: "Щелочная фосфатаза"→"ЩФ", "гамма-ГТ"/"ГГТ"→"ГГТ", "Билирубин прямой"/"Билирубин конъюгированный"→"Бил_прям", "Общий белок"→"Общий_белок", "D-димер"/"Д-димер"→"Д_димер", "Тромбиновое время"→"ТВ", "Протромбиновое время (с)"→"ПТВ", "CA 19-9"/"СА 19-9"→"СА_19_9", "CA 125"→"СА_125", "CA 15-3"→"СА_15_3", "РЭА"/"CEA"→"РЭА", "АФП"→"АФП", "СКО"/"Гематокрит"→"Гематокрит". АНАЛИЗ МОЧИ: "Уробилиноген" (моча)→"Уробилиноген_м" (число), "Удельный вес" (моча)→"Удельный_вес_м" (число, напр. 1.020), "pH" (моча)→"pH_мочи" (число), "Лейкоциты" (моча, полуколичественно)→"Лейкоциты_мочи" (число), "Белок" (моча)→"Белок_мочи" (число, если есть числовое значение), "Билирубин" (моча, кач.)→"Билирубин_мочи" (строка: "не обнаружен" или числовое значение как строка), "Глюкоза" (моча, кач.)→"Глюкоза_мочи" (строка), "Кровь" (моча)→"Кровь_мочи" (строка), "Кетоновые тела"→"Кетоны_мочи" (строка), "Нитриты"→"Нитриты_мочи" (строка). ВАЖНО: Не путай показатели МОЧИ с показателями КРОВИ — Лейкоциты в крови→"Лейкоциты" (число), Лейкоциты в моче→"Лейкоциты_мочи". Для клеток крови (лейкоциты, нейтрофилы, лимфоциты, эозинофилы, базофилы, моноциты, эритроциты, тромбоциты) ИЩИ И ИЗВЛЕКАЙ ТОЛЬКО АБСОЛЮТНЫЕ ЗНАЧЕНИЯ (например: "Абсолютное количество нейтрофилов 6,12" → 6.12). СТРОГО ИГНОРИРУЙ относительные значения в процентах (%). Бери цифру ТОЛЬКО из колонки "Результат", строго игнорируя колонку "Норма". Если в одном документе несколько дат (разные биоматериалы или разные исследования) — создавай отдельный объект для каждой уникальной даты и объединяй все показатели за эту дату в один объект.

ВАЖНЫЕ ПРАВИЛА:
1. ИСПРАВЛЯЙ опечатки во всех полях, переноси данные структурировано. Не ставь null. Если данных нет или они не упомянуты — не включай поле в JSON.
2. КОНФЛИКТЫ: Если в текстах встречаются противоречивые данные для поля, верни массив строк со всеми вариантами: ["вариант 1", "вариант 2"]. Если данные совпадают — верни строку.
3. ЛУЧЕВАЯ ТЕРАПИЯ: Жирным текстом (с помощью **маркдаун-звёздочек**) выделяй ЛЮБОЕ упоминание проведения ЛУЧЕВОЙ ТЕРАПИИ (ДЛТ, СЛТ, ХЛТ, брахитерапия) в полях "Диагноз", "Анамнез_заболевания" и "Анамнез_жизни".
4. ПОРЯДОК В ДИАГНОЗЕ: строго соблюдай последовательность — [гистотип + локализация] → [TNM] → [G] → [стадия] → [маркеры ER/PR/HER2/Ki67/мутации] → [подтип по-русски] → [лечение хронологически]. Не добавляй заголовки разделов.
5. МОЛЕКУЛЯРНЫЕ ПОДТИПЫ — ТОЛЬКО НА РУССКОМ. Маркеры (ER, PR, HER2, Ki67, EGFR, ALK, KRAS, NRAS, BRAF, IDH, BRCA, MET, RET, NTRK, MGMT, PD-L1, MSS/MSI и т.д.) — на английском. Подтип описывать по-русски: Люминальный A / Люминальный B HER2-отрицательный / Люминальный B HER2-положительный / HER2-положительный / Тройной негативный.
6. БИОМАРКЕРЫ: каждый маркер извлекай НЕЗАВИСИМО. У одного пациента могут одновременно быть положительными несколько маркеров или альтераций (например EGFR и ALK). Для бинарных полей используй: 1 = положительно / мутация / перестройка / амплификация, 0 = отрицательно / дикий тип. Если маркер не исследовался или нет явного результата — НЕ включай поле в JSON.
7. ХИМИОТЕРАПИЯ ДЛЯ БД: поле "db_chemo_regimen" заполняй в хронологическом порядке с датами, числом проведённых курсов и схемой. Форматируй как "С дд.мм.гггг по дд.мм.гггг проведено N курсов ХТ по схеме Название + Название" или "С мм.гггг проведено N курсов ХТ по схеме Название + Название", если известен только месяц. Не включай дозировки, мг/м2 и номера линий терапии.
8. ПРЕДШЕСТВУЮЩЕЕ ЛЕЧЕНИЕ ДЛЯ БД: поле "db_prior_treatment" заполняй по всей фактически проведённой противоопухолевой терапии в хронологии. Включай операции, ЛТ, ХТ, гормонотерапию, таргетную терапию, иммунотерапию. Не включай рекомендации и планы.
9. ДОПОЛНЕНИЕ ДАННЫХ: Если в сообщении есть раздел "=== ТЕКУЩИЕ ДАННЫЕ КАРТЫ ===" — произведи итоговую объединённую версию каждого поля. Не дублируй уже имеющиеся события, препараты или диагнозы. Для "Диагноз" — добавь новые события лечения хронологически к существующим. Для "Анамнез_жизни" — дополни список препаратов, не повторяй уже указанные. Для "Сопутствующие_заболевания" — объедини оба перечня без дублирования. Нельзя терять уже подтверждённые данные карты, если новый документ их не опровергает.
10. TNM И СТАДИЯ: если в документе явно указаны T, N, M или их можно надёжно извлечь из сформированного диагноза, обязательно заполни db_t, db_n, db_m и db_stage. Для рака предстательной железы при наличии T/N/M и данных Gleason и/или PSA постарайся определить стадию максимально точно.
11. ❌ ЗАПРЕЩЕНО ВКЛЮЧАТЬ В "Диагноз" — любое НЕ-онкологическое лечение и события: кардиология (стентирование, АКШ, кардиостимулятор, антикоагулянты), неврология (инсульт, ОНМК), сосудистая хирургия (ТЭЛА, тромбэктомия, имплантация кава-фильтра), ортопедия (эндопротезирование, остеосинтез), офтальмология, стоматология, дерматология, эндокринология (инсулинотерапия, тиреоидэктомия по поводу узлового зоба), гастроэнтерология (холецистэктомия по поводу ЖКБ), урология (ТУР аденомы простаты — НЕ онко; ТУР опухоли мочевого пузыря — ДА, это онко) и т.д. Все перечисленное → "Анамнез_заболевания" или "Анамнез_жизни", НИКОГДА в "Диагноз". В "Диагноз" идут ТОЛЬКО: резекции/удаление опухоли и лимфодиссекции, ПХТ/МХТ, ДЛТ/ХЛТ/брахитерапия/СРХ, гормонотерапия опухоли, таргетная терапия, иммунотерапия, прогрессирование.
12. ❌ ЗАПРЕЩЕНО ВКЛЮЧАТЬ В "Диагноз" запланированное лечение: решения консилиумов, рекомендации врачей, назначения, которые ещё НЕ начаты. Только ФАКТИЧЕСКИ проведённое лечение с датами. План лечения → "Решение_консилиума".
13. ФОРМАТ ДИАГНОЗА: для одного онкологического диагноза ВСЕ части и ВСЕ события пиши в ОДНУ непрерывную строку без переводов строк. Гистология, локализация, TNM, стадия, маркеры и далее все события лечения/прогрессирования должны идти последовательно по хронологии и разделяться точкой с пробелом.
14. ФОРМАТ ХТ В ДИАГНОЗЕ: химиотерапию оформляй как отдельное предложение в той же строке диагноза. Обязательно указывай период лечения, число курсов и формулировку "ХТ по схеме ...". Названия препаратов и схем пиши с Заглавной Буквы. Пример: "С 12.02.2025 по 29.05.2025 проведено 4 курса ХТ по схеме Этопозид + Карбоплатин."
15. СТАДИИ ДО/ПОСЛЕ ЛЕЧЕНИЯ: Если до неоадъювантного лечения указана стадия cTNM/stage, сохраняй её как инициальную стадию. Если после радикальной операции указана ypTNM/pTNM, указывай п/о стадию рядом с записью о хирургическом лечении.`; 

    const PARSER_PROMPT_VERSION = "2026-04-21-stage-immutability-v1";
    const PARSER_REVIEW_THRESHOLD = 0.82;
    const PARSER_ALLOWED_KEYS = [
        "ФИО","Дата_рождения","СНИЛС","Номер_телефона","Email",
        "db_sex","db_tumor_location","db_histotype","db_date_dx","db_surgery_type",
        "db_prior_treatment","db_chemo_regimen","db_rt_method","db_hormonal_drug",
        "db_targeted_drug","db_immunotherapy_drug","db_stage","db_t","db_n","db_m",
        "db_grade","db_mol_subtype","db_er","db_pr","db_her2","db_ki67","db_pdl1",
        "db_egfr_mut","db_alk_status","db_ros1_status","db_kras_mut","db_nras_mut",
        "db_ras_mut","db_braf_mut","db_idh_mut","db_brca_mut","db_ret_status",
        "db_met_status","db_ntrk_status","db_mgmt_meth","db_msi_status","db_mmr_status",
        "db_gleason","db_initial_psa","db_other_biomarkers","db_progression",
        "db_date_prog","db_prog_type","db_vital_status","db_date_death",
        "db_date_last_contact","db_ecog_last","МКБ 10","Диагноз","Решение_консилиума",
        "Жалобы","Анамнез_заболевания","Анамнез_жизни","Описания_исследований",
        "Сопутствующие_заболевания","ECOG_статус"
    ];
    const PARSER_LABELS = {
        "db_sex": "Пол",
        "db_tumor_location": "Локализация опухоли",
        "db_histotype": "Гистотип",
        "db_date_dx": "Дата диагноза",
        "db_surgery_type": "Тип операции",
        "db_prior_treatment": "Предшествующее лечение",
        "db_chemo_regimen": "Химиотерапия",
        "db_rt_method": "Метод ЛТ",
        "db_hormonal_drug": "Гормонотерапия",
        "db_targeted_drug": "Таргетная терапия",
        "db_immunotherapy_drug": "Иммунотерапия",
        "db_stage": "Стадия",
        "db_t": "T",
        "db_n": "N",
        "db_m": "M",
        "db_grade": "Grade",
        "db_mol_subtype": "Молекулярный подтип",
        "db_er": "ER",
        "db_pr": "PR",
        "db_her2": "HER2",
        "db_ki67": "Ki67",
        "db_pdl1": "PD-L1",
        "db_egfr_mut": "EGFR",
        "db_alk_status": "ALK",
        "db_ros1_status": "ROS1",
        "db_kras_mut": "KRAS",
        "db_nras_mut": "NRAS",
        "db_ras_mut": "RAS",
        "db_braf_mut": "BRAF",
        "db_idh_mut": "IDH",
        "db_brca_mut": "BRCA",
        "db_ret_status": "RET",
        "db_met_status": "MET",
        "db_ntrk_status": "NTRK",
        "db_mgmt_meth": "MGMT",
        "db_msi_status": "MSI/MSS",
        "db_mmr_status": "MMR",
        "db_gleason": "Gleason",
        "db_initial_psa": "Initial PSA",
        "db_other_biomarkers": "Прочие биомаркеры",
        "db_progression": "Прогрессирование",
        "db_date_prog": "Дата прогрессирования",
        "db_prog_type": "Тип прогрессирования",
        "db_vital_status": "Витальный статус",
        "db_date_death": "Дата смерти",
        "db_date_last_contact": "Последний контакт",
        "db_ecog_last": "ECOG последний",
        "ECOG_статус": "ECOG",
        "МКБ 10": "МКБ-10"
    };
    const PARSER_TEXTAREA_KEYS = new Set([
        "Диагноз","Решение_консилиума","Жалобы","Анамнез_заболевания","Анамнез_жизни",
        "Описания_исследований","Сопутствующие_заболевания","db_prior_treatment",
        "db_chemo_regimen","db_other_biomarkers"
    ]);
    const PARSER_INTEGER_KEYS = new Set([
        "db_mol_subtype","db_er","db_pr","db_her2","db_ki67","db_egfr_mut","db_alk_status",
        "db_ros1_status","db_kras_mut","db_nras_mut","db_ras_mut","db_braf_mut",
        "db_idh_mut","db_brca_mut","db_ret_status","db_met_status","db_ntrk_status",
        "db_progression","db_prog_type","db_vital_status","ECOG_статус","db_ecog_last"
    ]);
    const PARSER_FLOAT_KEYS = new Set(["db_initial_psa"]);
    const PARSER_BINARY_KEYS = new Set([
        "db_egfr_mut","db_alk_status","db_ros1_status","db_kras_mut","db_nras_mut",
        "db_ras_mut","db_braf_mut","db_idh_mut","db_brca_mut","db_ret_status",
        "db_met_status","db_ntrk_status","db_progression","db_vital_status"
    ]);
    const PARSER_SELECT_OPTIONS = {
        "db_sex": ["", "М", "Ж"],
        "db_mol_subtype": ["", "1", "2", "3", "4", "5"],
        "db_progression": ["", "0", "1"],
        "db_prog_type": ["", "1", "2", "3", "4"],
        "db_vital_status": ["", "0", "1"],
        "ECOG_статус": ["", "0", "1", "2", "3", "4"],
        "db_ecog_last": ["", "0", "1", "2", "3", "4"],
        "db_msi_status": ["", "MSS", "MSI-H", "MSI-L", "MSI"],
        "db_mmr_status": ["", "pMMR", "dMMR"],
        "db_mgmt_meth": ["", "метилирован", "неметилирован"]
    };
    const PARSER_SLOT_META_KEY = "AI_Парсер_слоты_meta_json";
    const PARSER_IDENTITY_KEYS = new Set([
        "ФИО","Дата_рождения","СНИЛС","Номер_телефона","Email","db_sex"
    ]);
    const PARSER_MERGEABLE_NARRATIVE_KEYS = new Set([
        "Диагноз","Решение_консилиума","Жалобы","Анамнез_заболевания",
        "Анамнез_жизни","Описания_исследований","Сопутствующие_заболевания",
        "db_prior_treatment","db_chemo_regimen","db_other_biomarkers"
    ]);
    const PARSER_SAFE_AUTOFILL_KEYS = new Set([
        "db_surgery_type","db_rt_method","db_hormonal_drug","db_targeted_drug",
        "db_immunotherapy_drug"
    ]);
    const parserGetRiskLevel = (key) => {
        if (PARSER_IDENTITY_KEYS.has(key)) return "identity";
        if (PARSER_MERGEABLE_NARRATIVE_KEYS.has(key)) return "mergeable_narrative";
        if (PARSER_SAFE_AUTOFILL_KEYS.has(key)) return "safe_autofill";
        return "critical_clinical";
    };
    const parserGetRiskLabel = (riskLevel) => ({
        identity: "identity",
        critical_clinical: "critical clinical",
        mergeable_narrative: "mergeable narrative",
        safe_autofill: "safe autofill"
    }[riskLevel] || riskLevel || "unknown");
    const parserRequiresManualReview = (key) => parserGetRiskLevel(key) !== "safe_autofill";
    const parserGetSourceTypeScore = (label) => {
        const text = String(label || "").trim().toLowerCase();
        if (!text) return 0.65;
        if (/ручн|ревью|review/.test(text)) return 1;
        if (/диагноз документа|лаборатор|морфолог|игх|мги/.test(text)) return 0.95;
        if (/вставлен|документ|эпикриз|выписк|протокол|заключен/.test(text)) return 0.85;
        if (/пересч[её]т tnm9|tnm9/.test(text)) return 0.55;
        if (/шаблонн|regex|fallback/.test(text)) return 0.4;
        return 0.7;
    };
    const parserEscapeRegExp = (value) => String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const parserNormalizeCompareText = (value) => String(value || "")
        .toLowerCase()
        .replace(/ё/g, "е")
        .replace(/\u00a0/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    const parserBuildStagePhraseRegex = (value) => new RegExp(`(?:^|[^A-Za-zА-Яа-яЁё0-9])${parserEscapeRegExp(value)}\\s+стадия(?:[^A-Za-zА-Яа-яЁё]|$)`, "i");
    const parserBuildTnmPartRegex = (key, value) => {
        const escapedValue = parserEscapeRegExp(value);
        if (key === "db_t") return new RegExp(`[cpyr]?T${escapedValue}(?=N|[^A-Za-zА-Яа-яЁё0-9]|$)`, "i");
        if (key === "db_n") return new RegExp(`N${escapedValue}(?=M|[^A-Za-zА-Яа-яЁё0-9]|$)`, "i");
        return new RegExp(`M${escapedValue}(?=[^A-Za-zА-Яа-яЁё0-9]|$)`, "i");
    };
    const PARSER_STAGE_PHRASE_CAPTURE_RE = /(?:^|[^A-Za-zА-Яа-яЁё0-9])((?:I|II|III|IV)(?:A|B|C)?)\s+стадия(?:[^A-Za-zА-Яа-яЁё]|$)/i;
    const PARSER_STAGE_PHRASE_RE = /(?:^|[^A-Za-zА-Яа-яЁё0-9])(?:I|II|III|IV)(?:A|B|C)?\s+стадия(?:[^A-Za-zА-Яа-яЁё]|$)/i;
    const parserHasExactQuoteSupport = (key, value, fragment) => {
        const text = String(fragment || "").trim();
        if (!text) return false;
        const valueText = parserValueToString(value);
        if (!valueText) return false;
        const normalizedText = parserNormalizeCompareText(text);
        const normalizedValue = parserNormalizeCompareText(valueText);
        if (!normalizedText || !normalizedValue) return false;
        if (key === "ECOG_статус" || key === "db_ecog_last") {
            return new RegExp(`(?:ECOG(?:\\s*[-/–]?\\s*PS)?|ЭКОГ|WHO\\s*PS)[^0-4]{0,24}${parserEscapeRegExp(valueText)}`, "i").test(text);
        }
        if (key === "db_stage") {
            return parserBuildStagePhraseRegex(valueText).test(text) || normalizedText.includes(normalizedValue);
        }
        if (key === "db_vital_status") {
            if (valueText === "1") return /умер|умерла|умерло|скончал(?:ся|ась)|летальн|deceased|died|dead/i.test(text);
            if (valueText === "0") return /(?:^|[^A-Za-zА-Яа-яЁё])жив(?:а|ой)?(?:[^A-Za-zА-Яа-яЁё]|$)|alive|цензур|под наблюдением|на контроле/i.test(text);
        }
        if (key === "db_t" || key === "db_n" || key === "db_m") {
            return parserBuildTnmPartRegex(key, valueText).test(text);
        }
        if (key === "Дата_рождения" || key === "db_date_dx" || key === "db_date_prog" || key === "db_date_death" || key === "db_date_last_contact") {
            return normalizedText.includes(normalizedValue);
        }
        if (PARSER_INTEGER_KEYS.has(key) || PARSER_FLOAT_KEYS.has(key) || PARSER_SELECT_OPTIONS[key]) {
            return new RegExp(`(^|[^\\d])${parserEscapeRegExp(valueText)}([^\\d]|$)`, "i").test(text) || normalizedText.includes(normalizedValue);
        }
        return normalizedText.includes(normalizedValue);
    };
    const parserNormalizeSourceDate = (raw) => {
        const value = String(raw || "").trim();
        if (!value) return "";
        const m = value.match(/^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?$/);
        if (!m) return "";
        const year = Number(m[1]);
        const month = m[2] ? Number(m[2]) : 0;
        const day = m[3] ? Number(m[3]) : 0;
        if (!year) return "";
        return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    };
    const parserCompareSourceDates = (left, right) => {
        const a = parserNormalizeSourceDate(left);
        const b = parserNormalizeSourceDate(right);
        if (!a || !b) return null;
        if (a === b) return 0;
        return a > b ? 1 : -1;
    };
    const parserParseJsonSafe = (raw, fallback = {}) => {
        if (!raw) return fallback;
        try {
            const parsed = JSON.parse(String(raw));
            return parsed && typeof parsed === "object" ? parsed : fallback;
        } catch (_) {
            return fallback;
        }
    };
    const parserGetSlotMetaMap = (getter) => parserParseJsonSafe(getter ? getter(PARSER_SLOT_META_KEY) : "", {});
    const parserGetFreshnessAssessment = ({ key, sourceDate, slotMetaMap }) => {
        const currentMeta = slotMetaMap?.[`field:${key}`] || slotMetaMap?.[key] || null;
        const currentSourceDate = currentMeta?.source_date || "";
        const cmp = parserCompareSourceDates(sourceDate, currentSourceDate);
        if (cmp === null) return { status: "unknown", note: "" };
        if (cmp < 0) return { status: "older", note: `Источник старше текущего значения (${sourceDate || "без даты"} < ${currentSourceDate || "без даты"})` };
        if (cmp > 0) return { status: "newer", note: `Источник новее текущего значения (${sourceDate || "без даты"} > ${currentSourceDate || "без даты"})` };
        return { status: "same", note: currentSourceDate ? `Источник той же даты (${currentSourceDate})` : "" };
    };
    const parserComputeAutoApproveScore = ({
        extractConfidence = 0,
        mergeConfidence = 0,
        sourceTypeScore = 0,
        exactQuoteSupport = false,
        noConflict = true
    }) => (
        (((parserClampConfidence(extractConfidence) + parserClampConfidence(mergeConfidence)) / 2) * 0.55)
        + (Math.max(0, Math.min(1, Number(sourceTypeScore) || 0)) * 0.25)
        + ((exactQuoteSupport ? 1 : 0) * 0.15)
        + ((noConflict ? 1 : 0) * 0.05)
    );
    const parserCanAutoApplyField = ({
        key,
        riskLevel = parserGetRiskLevel(key),
        hasCurrent = false,
        sameAsCurrent = false,
        reviewRequired = false,
        warnings = [],
        freshnessStatus = "unknown",
        extractConfidence = 0,
        mergeConfidence = 0,
        sourceTypeScore = 0,
        exactQuoteSupport = false
    }) => {
        if (!key || hasCurrent || sameAsCurrent) return false;
        if (reviewRequired || (warnings || []).length) return false;
        if (freshnessStatus === "older") return false;
        if (riskLevel !== "safe_autofill") return false;
        if (extractConfidence < PARSER_REVIEW_THRESHOLD || mergeConfidence < PARSER_REVIEW_THRESHOLD) return false;
        if (sourceTypeScore < 0.75) return false;
        return parserComputeAutoApproveScore({
            extractConfidence,
            mergeConfidence,
            sourceTypeScore,
            exactQuoteSupport,
            noConflict: !hasCurrent && !sameAsCurrent
        }) >= 0.9;
    };
    const parserCanAutoApplyLab = ({
        sameDateExists = false,
        reviewRequired = false,
        warnings = [],
        extractConfidence = 0,
        mergeConfidence = 0,
        sourceTypeScore = 0,
        exactQuoteSupport = false
    }) => {
        if (sameDateExists || reviewRequired || (warnings || []).length) return false;
        if (extractConfidence < PARSER_REVIEW_THRESHOLD || mergeConfidence < PARSER_REVIEW_THRESHOLD) return false;
        if (sourceTypeScore < 0.8) return false;
        return parserComputeAutoApproveScore({
            extractConfidence,
            mergeConfidence,
            sourceTypeScore,
            exactQuoteSupport,
            noConflict: true
        }) >= 0.88;
    };
    const PARSER_RESPONSE_SCHEMA = {
        type: "object",
        additionalProperties: false,
        properties: {
            fields: {
                type: "array",
                items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                        key: { type: "string", enum: PARSER_ALLOWED_KEYS },
                        string_value: { type: ["string", "null"] },
                        number_value: { type: ["number", "null"] },
                        extract_confidence: { type: "number", minimum: 0, maximum: 1 },
                        merge_confidence: { type: "number", minimum: 0, maximum: 1 },
                        evidence: { type: "string" },
                        source_label: { type: "string" },
                        source_fragment: { type: "string" },
                        source_date: { type: ["string", "null"] },
                        note: { type: ["string", "null"] },
                        review_required: { type: "boolean" }
                    },
                    required: ["key", "string_value", "number_value", "extract_confidence", "merge_confidence", "evidence", "source_label", "source_fragment", "source_date", "note", "review_required"]
                }
            },
            conflicts: {
                type: "array",
                items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                        key: { type: "string", enum: PARSER_ALLOWED_KEYS },
                        reason: { type: "string" },
                        suggested_index: { type: "integer", minimum: 0 },
                        options: {
                            type: "array",
                            minItems: 2,
                            items: {
                                type: "object",
                                additionalProperties: false,
                                properties: {
                                    string_value: { type: ["string", "null"] },
                                    number_value: { type: ["number", "null"] },
                                    extract_confidence: { type: "number", minimum: 0, maximum: 1 },
                                    merge_confidence: { type: "number", minimum: 0, maximum: 1 },
                                    evidence: { type: "string" },
                                    source_label: { type: "string" },
                                    source_fragment: { type: "string" },
                                    source_date: { type: ["string", "null"] },
                                    note: { type: ["string", "null"] }
                                },
                                required: ["string_value", "number_value", "extract_confidence", "merge_confidence", "evidence", "source_label", "source_fragment", "source_date", "note"]
                            }
                        }
                    },
                    required: ["key", "reason", "suggested_index", "options"]
                }
            },
            lab_batches: {
                type: "array",
                items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                        date: { type: "string" },
                        json_payload: { type: "string" },
                        extract_confidence: { type: "number", minimum: 0, maximum: 1 },
                        merge_confidence: { type: "number", minimum: 0, maximum: 1 },
                        evidence: { type: "string" },
                        source_label: { type: "string" },
                        source_fragment: { type: "string" },
                        source_date: { type: ["string", "null"] },
                        note: { type: ["string", "null"] },
                        review_required: { type: "boolean" }
                    },
                    required: ["date", "json_payload", "extract_confidence", "merge_confidence", "evidence", "source_label", "source_fragment", "source_date", "note", "review_required"]
                }
            },
            warnings: {
                type: "array",
                items: { type: "string" }
            }
        },
        required: ["fields", "conflicts", "lab_batches", "warnings"]
    };
    const TNM_STAGE_REVIEW_SCHEMA = {
        type: "object",
        additionalProperties: false,
        properties: {
            suggested_stage: { type: ["string", "null"] },
            updated_diagnosis: { type: ["string", "null"] },
            reason: { type: "string" },
            confidence: { type: "number", minimum: 0, maximum: 1 },
            review_required: { type: "boolean" }
        },
        required: ["suggested_stage", "updated_diagnosis", "reason", "confidence", "review_required"]
    };
    const PARSER_REVIEW_APPENDIX = `

    ФОРМАТ ОТВЕТА:
    1. Верни объект строго по JSON Schema.
    2. Поле fields: только извлечённые и реально найденные поля. Не добавляй поле, если оно не определялось.
    3. Для каждого элемента fields:
    - key: имя поля
    - string_value: строковое значение, если поле строковое/текстовое/дата
    - number_value: числовое значение, если поле числовое
    - extract_confidence: число от 0 до 1, насколько точно значение извлечено из документа
    - merge_confidence: число от 0 до 1, насколько безопасно объединять/записывать это значение в текущую карту
    - evidence: короткое пояснение, почему выбрано именно это значение
    - source_label: кратко укажи источник, например "вставленный документ", "диагноз документа", "лабораторный блок"
    - source_fragment: короткая дословная цитата из текста документа, на которой основан вывод
    - source_date: дата документа/события/исследования, если её можно понять
    - note: краткое пояснение или null
    - review_required: true, если есть сомнение, конфликт контекста, неполная дата или двусмысленность
    4. Поле conflicts: только реальные противоречия, которые нельзя безопасно разрешить.
    5. Поле lab_batches: по одной записи на каждую дату лабораторных данных. json_payload должен быть строкой с JSON-объектом анализов за эту дату.
    6. Если уверенность низкая, но значение всё же вероятно, верни его в fields с review_required=true.
7. Для дат соблюдай форматы:
- yyyy-MM-dd для полной даты
- yyyy-MM или yyyy для db_date_dx и db_date_prog
8. Не возвращай лишних полей.`;
    const PARSER_SYSTEM_PROMPT = `${PARSER_PROMPT}\n${PARSER_REVIEW_APPENDIX}`;
    const getParserFieldLabel = (key) => PARSER_LABELS[key] || key;
    const parseOpenRouterJsonContent = (messageContent) => {
        if (typeof messageContent === "string") return JSON.parse(messageContent);
        if (Array.isArray(messageContent)) {
            const text = messageContent.map(part => typeof part === "string" ? part : (part?.text || "")).join("").trim();
            return JSON.parse(text);
        }
        if (messageContent && typeof messageContent === "object") return messageContent;
        throw new Error("Пустой ответ модели");
    };
    const parserValueToString = (value) => {
        if (value === null || value === undefined) return "";
        if (typeof value === "string") return value;
        if (typeof value === "number" || typeof value === "boolean") return String(value);
        return JSON.stringify(value, null, 2);
    };
    const parserNormalizeKey = (key) => {
        if (key === "ECOG" || key === "ecog" || key === "ECOG статус" || key === "ECOG_status") return "ECOG_статус";
        return key;
    };
    const parserValueEquals = (a, b) => {
        const sa = parserValueToString(a).replace(/\s+/g, " ").trim();
        const sb = parserValueToString(b).replace(/\s+/g, " ").trim();
        return sa === sb;
    };
    const parserClampConfidence = (value, fallback = 0) => {
        const n = Number(value);
        if (!Number.isFinite(n)) return fallback;
        return Math.max(0, Math.min(1, n));
    };
    const parserGetExtractConfidence = (item, fallback = 0) => {
        const legacy = parserClampConfidence(item?.confidence, fallback);
        return parserClampConfidence(item?.extract_confidence, legacy);
    };
    const parserGetMergeConfidence = (item, fallback = 0) => {
        const extract = parserGetExtractConfidence(item, fallback);
        return parserClampConfidence(item?.merge_confidence, extract);
    };
    const parserNormalizeSourceLabel = (value) => {
        const text = String(value || "").trim();
        return text || "Вставленный документ";
    };
    const parserNormalizeSourceFragment = (fragment, evidence = "") => {
        const text = String(fragment || "").trim();
        if (text) return text;
        return String(evidence || "").trim();
    };
    const parserMetaFromRaw = (rawItem) => {
        const extractConfidence = parserGetExtractConfidence(rawItem, 0);
        const mergeConfidence = parserGetMergeConfidence(rawItem, extractConfidence);
        return {
            extract_confidence: extractConfidence,
            merge_confidence: mergeConfidence,
            confidence: extractConfidence,
            evidence: String(rawItem?.evidence || "").trim(),
            source_label: parserNormalizeSourceLabel(rawItem?.source_label),
            source_fragment: parserNormalizeSourceFragment(rawItem?.source_fragment, rawItem?.evidence),
            source_date: rawItem?.source_date ? String(rawItem.source_date).trim() : "",
            note: rawItem?.note ? String(rawItem.note).trim() : "",
            review_required: !!rawItem?.review_required
        };
    };
    const parserNormalizeProstateTerminology = (value) => String(value || "")
        .replace(/\bАцинарная\s+аденокарцинома\b/gi, "Аденокарцинома")
        .replace(/\bАцинозная\s+аденокарцинома\b/gi, "Аденокарцинома");
    const parserCoerceValue = (key, rawValue) => {
        if (rawValue === null || rawValue === undefined || rawValue === "") return null;
        let value = rawValue;
        if (typeof value === "string") value = value.trim();
        if (key === "ECOG_статус" || key === "db_ecog_last") return normalizeEcog(value);
        if (PARSER_INTEGER_KEYS.has(key)) {
            const n = Number(String(value).replace(",", "."));
            return Number.isFinite(n) ? Math.round(n) : value;
        }
        if (PARSER_FLOAT_KEYS.has(key)) {
            const n = Number(String(value).replace(",", "."));
            return Number.isFinite(n) ? n : value;
        }
        if (key === "db_chemo_regimen") return normalizeHistoryText(value, "chemo");
        if (key === "db_prior_treatment") return normalizeHistoryText(value, "generic");
        if (key === "db_hormonal_drug" || key === "db_targeted_drug" || key === "db_immunotherapy_drug") return normalizeDrugNames(value);
        if (key === "db_other_biomarkers") return normalizeHistoryText(value, "generic");
        if (key === "db_histotype") return parserNormalizeProstateTerminology(value);
        if (key === "Диагноз") return normalizeDiagnosisText(parserNormalizeProstateTerminology(value));
        return value;
    };
    const parserValidateValue = (key, value) => {
        const warnings = [];
        let next = value;
        if (next === null || next === undefined || next === "") return { value: null, warnings };
        const s = String(next);
        const num = Number(String(next).replace(",", "."));
        const pushWarn = (msg) => warnings.push(msg);
        if (key === "Дата_рождения" || key === "db_date_death" || key === "db_date_last_contact") {
            if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) pushWarn("Ожидался формат yyyy-MM-dd");
        }
        if (key === "db_date_dx" || key === "db_date_prog") {
            if (!/^\d{4}(?:-\d{2})?$/.test(s)) pushWarn("Ожидался формат yyyy-MM или yyyy");
        }
        if (key === "db_stage" && !/^(?:I|II|III|IV)(?:A|B|C)?$/i.test(s)) pushWarn("Необычный формат стадии");
        if (key === "db_t" && !/^(?:is|x|[0-4][a-c]?)$/i.test(s)) pushWarn("Необычный формат T");
        if (key === "db_n" && !/^(?:x|[0-3][a-c]?)$/i.test(s)) pushWarn("Необычный формат N");
        if (key === "db_m" && !/^(?:x|[01][a-c]?)$/i.test(s)) pushWarn("Необычный формат M");
        if (key === "db_er" || key === "db_pr") {
            if (!Number.isFinite(num) || num < 0 || num > 8) pushWarn("ER/PR должны быть в диапазоне 0–8");
        }
        if (key === "db_her2") {
            if (!Number.isFinite(num) || num < 0 || num > 3) pushWarn("HER2 должен быть 0–3");
        }
        if (key === "db_ki67") {
            if (!Number.isFinite(num) || num < 0 || num > 100) pushWarn("Ki67 должен быть в диапазоне 0–100");
        }
        if (key === "ECOG_статус" || key === "db_ecog_last") {
            if (!Number.isFinite(num) || num < 0 || num > 4) pushWarn("ECOG должен быть в диапазоне 0–4");
        }
        if (PARSER_BINARY_KEYS.has(key)) {
            if (!Number.isFinite(num) || ![0, 1].includes(Math.round(num))) pushWarn("Ожидалось значение 0 или 1");
            else next = Math.round(num);
        }
        if (key === "db_prog_type") {
            if (!Number.isFinite(num) || num < 1 || num > 4) pushWarn("Тип прогрессирования должен быть 1–4");
        }
        if (key === "db_mol_subtype") {
            if (!Number.isFinite(num) || num < 1 || num > 5) pushWarn("Подтип должен быть 1–5");
        }
        if (key === "db_chemo_regimen" || key === "db_prior_treatment") {
            if (/\b\d+(?:[.,]\d+)?\s*(?:мг\/м2|мг|г|мкг|мл)\b/i.test(s)) pushWarn("Обнаружены дозировки — проверьте нормализацию");
        }
        return { value: next, warnings };
    };
    const parserParseLabBatch = (batch) => {
        const raw = String(batch?.json_payload || "").trim();
        if (!raw) throw new Error("Пустой JSON лабораторных");
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Лабораторные должны быть JSON-объектом");
        const clean = {};
        Object.entries(parsed).forEach(([k, v]) => {
            if (v === null || v === "") return;
            clean[k] = v;
        });
        const date = normalizeLabDateKey(batch?.date || clean.Дата);
        if (!date) throw new Error("Не удалось определить дату лабораторных");
        clean.Дата = date;
        return clean;
    };
    const runStructuredParserRequest = async ({ model, messages, schemaName, schema }) => {
        const providerCfg = _getProviderRequestConfig(model);
        const headers = { "Authorization": `Bearer ${providerCfg.key}`, "Content-Type": "application/json" };
        const basePayload = {
            model: providerCfg.modelId,
            temperature: 0,
            messages,
            provider: {
                require_parameters: true,
                data_collection: "deny"
            },
            plugins: [{ id: "response-healing" }]
        };
        const toResult = (json, responseMode, strictError = "") => {
            const content = json?.choices?.[0]?.message?.content;
            return {
                data: parseOpenRouterJsonContent(content),
                meta: {
                    model: json?.model || model,
                    parsed_at: new Date().toISOString(),
                    system_fingerprint: json?.system_fingerprint || "",
                    service_tier: json?.service_tier || "",
                    usage: json?.usage || null,
                    response_mode: responseMode,
                    strict_error: strictError,
                    source: providerCfg.providerId
                }
            };
        };

        const strictResp = await fetch(providerCfg.endpoint, {
            method: "POST",
            headers,
            body: JSON.stringify({
                ...basePayload,
                response_format: {
                    type: "json_schema",
                    json_schema: {
                        name: schemaName,
                        strict: true,
                        schema
                    }
                }
            })
        });
        if (strictResp.ok) {
            const json = await strictResp.json();
            return toResult(json, "json_schema");
        }

        const strictErrTxt = await strictResp.text();
        const canFallback = strictResp.status >= 400 && /json_schema|response_format|schema|structured/i.test(strictErrTxt);
        if (!canFallback) throw new Error(`HTTP ${strictResp.status}: ${strictErrTxt.slice(0, 300)}`);

        const fallbackResp = await fetch(providerCfg.endpoint, {
            method: "POST",
            headers,
            body: JSON.stringify({
                ...basePayload,
                response_format: { type: "json_object" }
            })
        });
        if (!fallbackResp.ok) {
            const fallbackErrTxt = await fallbackResp.text();
            throw new Error(`HTTP ${fallbackResp.status}: ${fallbackErrTxt.slice(0, 300)}`);
        }
        const fallbackJson = await fallbackResp.json();
        return toResult(fallbackJson, "json_object_fallback", strictErrTxt.slice(0, 300));
    };
    const AI_PANEL_KEY = 'pf-ai-open-' + cur.file.path;
    const aiWrap = modal.ownerDocument.createElement("div");
    aiWrap.style.cssText = "margin-bottom:8px; border-radius:8px; transition:box-shadow .2s ease;";

    const renderAiPanel = () => {
        aiWrap.innerHTML = "";
        const isOpen = !!window[AI_PANEL_KEY];

        // Заголовок-кнопка
        const hdr = modal.ownerDocument.createElement("button");
        hdr.style.cssText = `width:100%;box-sizing:border-box;display:flex;align-items:center;justify-content:space-between;padding:12px 14px;background:var(--background-primary);border:1px solid var(--background-modifier-border);border-radius:${isOpen ? "8px 8px 0 0" : "8px"};color:var(--text-normal);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;cursor:pointer;touch-action:manipulation;transition:all .2s ease;`;
        hdr.innerHTML = `<span style="display:flex;align-items:center;gap:8px;"><span style="font-size:15px;line-height:1;">🤖</span> <span style="background:linear-gradient(90deg, ${AI_COLOR}, #b388ff);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">AI-ПАРСЕР</span></span><span style="font-size:11px;opacity:.7;transition:transform .2s ease;transform:${isOpen ? 'rotate(180deg)' : 'none'}">▼</span>`;
        hdr.onmouseenter = () => { hdr.style.background = "var(--background-modifier-hover)"; aiWrap.style.boxShadow = `0 0 0 1px var(--interactive-accent)`; };
        hdr.onmouseleave = () => { hdr.style.background = "var(--background-primary)"; aiWrap.style.boxShadow = "none"; };
        hdr.onclick = () => { window[AI_PANEL_KEY] = !isOpen; renderAiPanel(); };
        aiWrap.appendChild(hdr);

        if (!isOpen) return;

        // Тело панели
        const body = modal.ownerDocument.createElement("div");
        body.style.cssText = `border:1px solid var(--background-modifier-border);border-top:none;border-radius:0 0 8px 8px;padding:12px;display:flex;flex-direction:column;gap:10px;background:var(--background-primary);box-sizing:border-box;box-shadow:inset 0 2px 4px rgba(0,0,0,0.02);`;

        const hint = modal.ownerDocument.createElement("div");
        hint.style.cssText = "font-size:11px;color:var(--text-muted);line-height:1.4;";
        hint.textContent = "Вставьте неструктурированный текст — ИИ извлечёт данные, а затем откроет окно ревью перед сохранением.";
        body.appendChild(hint);

        const ta = modal.ownerDocument.createElement("textarea");
        ta.placeholder = "Вставьте выписку, направление или любой медицинский текст…";
        ta.style.cssText = "width:100%;box-sizing:border-box;min-height:100px;resize:vertical;border-radius:6px;border:1px solid var(--background-modifier-border);background:var(--background-primary);color:var(--text-normal);padding:8px 10px;font-size:16px;font-family:var(--font-interface);outline:none;transition:border-color .15s;line-height:1.4;";
        ta.onfocus = () => ta.style.borderColor = AI_COLOR;
        ta.onblur  = () => ta.style.borderColor = "var(--background-modifier-border)";
        body.appendChild(ta);

        const status = modal.ownerDocument.createElement("div");
        status.style.cssText = "font-size:12px;min-height:18px;display:none;";
        const showStatus = (msg, color) => {
            status.textContent = msg;
            status.style.color = color || "var(--text-normal)";
            status.style.display = "block";
        };
        const getDraftValue = (key) => Object.prototype.hasOwnProperty.call(ls, key) ? ls[key] : getVal(key);
        const getSuspiciousLabValues = (entries) => {
            const labRefCheck = {
                Лейкоциты: 9, Нейтрофилы: 7.7, Лимфоциты: 4.5, Эозинофилы: 0.54, Базофилы: 0.08,
                Эритроциты: 5.5, Гемоглобин: 160, Тромбоциты: 400, МНО: 1.07, АЧТВ: 36,
                ТВ: 16.6, ПТВ: 12.2, АЛТ: 40, АСТ: 40, ЩФ: 120, ГГТ: 61, Билирубин: 20.5,
                Креатинин: 115, Мочевина: 7.2, Глюкоза: 6.1
            };
            const suspicious = [];
            (entries || []).forEach(entry => {
                Object.entries(entry || {}).forEach(([k, v]) => {
                    if (k === "Дата" || typeof v !== "number") return;
                    const maxRef = labRefCheck[k];
                    if (maxRef && v > maxRef * 8) suspicious.push(`${k}=${v}`);
                });
            });
            return suspicious;
        };
        const createReviewInput = (key, initialValue, opts = {}) => {
            const doc = modal.ownerDocument;
            const textValue = parserValueToString(initialValue);
            const selectOptions = opts.forceText ? null : PARSER_SELECT_OPTIONS[key];
            let control;

            if (selectOptions) {
                control = doc.createElement("select");
                control.style.cssText = "width:100%;box-sizing:border-box;min-height:34px;border-radius:6px;border:1px solid var(--background-modifier-border);background:var(--background-primary);color:var(--text-normal);padding:6px 8px;font-size:13px;outline:none;";
                if (textValue && !selectOptions.includes(textValue)) {
                    const customOpt = doc.createElement("option");
                    customOpt.value = textValue;
                    customOpt.textContent = `${textValue} (введено)`;
                    control.appendChild(customOpt);
                }
                selectOptions.forEach(optValue => {
                    const opt = doc.createElement("option");
                    opt.value = optValue;
                    opt.textContent = optValue || "—";
                    control.appendChild(opt);
                });
                control.value = textValue;
            } else if (PARSER_TEXTAREA_KEYS.has(key) || opts.multiline) {
                control = doc.createElement("textarea");
                control.value = textValue;
                control.rows = opts.rows || 4;
                control.style.cssText = "width:100%;box-sizing:border-box;min-height:86px;resize:vertical;border-radius:6px;border:1px solid var(--background-modifier-border);background:var(--background-primary);color:var(--text-normal);padding:8px 10px;font-size:13px;line-height:1.45;outline:none;";
                if (typeof autoGrow === "function") autoGrow(control);
            } else {
                control = doc.createElement("input");
                control.type = "text";
                control.value = textValue;
                control.style.cssText = "width:100%;box-sizing:border-box;height:34px;border-radius:6px;border:1px solid var(--background-modifier-border);background:var(--background-primary);color:var(--text-normal);padding:0 8px;font-size:13px;outline:none;";
            }
            control.placeholder = opts.placeholder || "";
            control.onfocus = () => { control.style.borderColor = AI_COLOR; };
            control.onblur = () => { control.style.borderColor = "var(--background-modifier-border)"; };

            return {
                el: control,
                setValue: (value) => {
                    control.value = parserValueToString(value);
                    if (control.tagName === "TEXTAREA" && typeof autoGrow === "function") autoGrow(control);
                },
                getValue: () => {
                    const raw = typeof control.value === "string" ? control.value.trim() : control.value;
                    if (opts.raw) return raw;
                    return parserCoerceValue(key, raw);
                }
            };
        };
        const askFioMismatchApproval = (docFio) => new Promise(resolve => {
            const _ov = modal.ownerDocument.createElement("div");
            _ov.style.cssText = "position:absolute;inset:0;background:rgba(0,0,0,0.55);z-index:100;display:flex;align-items:center;justify-content:center;border-radius:inherit;";
            const _box = modal.ownerDocument.createElement("div");
            _box.style.cssText = "background:var(--background-primary);border:2px solid #e53935;border-radius:12px;padding:20px 24px;box-shadow:0 10px 40px rgba(0,0,0,0.4);max-width:480px;width:90%;display:flex;flex-direction:column;gap:14px;";
            const _hdr = modal.ownerDocument.createElement("div");
            _hdr.style.cssText = "display:flex;align-items:flex-start;gap:10px;";
            _hdr.innerHTML = `<span style="font-size:28px;line-height:1;flex-shrink:0;">⚠️</span><div><div style="font-weight:700;font-size:15px;color:#e53935;">ФИО не совпадает!</div><div style="font-size:12px;color:var(--text-muted);margin-top:3px;">Возможно, документ относится к другому пациенту</div></div>`;
            const _info = modal.ownerDocument.createElement("div");
            _info.style.cssText = "background:var(--background-secondary);border-radius:8px;padding:12px 14px;display:flex;flex-direction:column;gap:6px;font-size:13px;";
            _info.innerHTML = `<div><span style="color:var(--text-muted);">В карте:</span> <strong style="color:var(--text-normal);">${escapeHtml(String(getStoredVal("ФИО") || ""))}</strong></div><div><span style="color:var(--text-muted);">В документе:</span> <strong style="color:#e53935;">${escapeHtml(String(docFio || ""))}</strong></div>`;
            const _btns = modal.ownerDocument.createElement("div");
            _btns.style.cssText = "display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;";
            const _cancelBtn = modal.ownerDocument.createElement("button");
            _cancelBtn.textContent = "Отмена";
            _cancelBtn.style.cssText = "padding:8px 16px;border:1px solid var(--background-modifier-border);border-radius:6px;background:none;color:var(--text-normal);cursor:pointer;font-size:13px;";
            const _applyBtn = modal.ownerDocument.createElement("button");
            _applyBtn.textContent = "Продолжить с ревью";
            _applyBtn.style.cssText = "padding:8px 16px;border:none;border-radius:6px;background:#e53935;color:#fff;cursor:pointer;font-size:13px;font-weight:600;";
            _cancelBtn.onclick = () => { _ov.remove(); resolve(false); };
            _applyBtn.onclick = () => { _ov.remove(); resolve(true); };
            _btns.appendChild(_cancelBtn);
            _btns.appendChild(_applyBtn);
            _box.appendChild(_hdr);
            _box.appendChild(_info);
            _box.appendChild(_btns);
            _ov.appendChild(_box);
            modal.appendChild(_ov);
        });
        const askParserRetryOrFallback = ({ primaryModel, fallbackModel, errorText, isEmptyResult = false }) => new Promise(resolve => {
            const _ov = modal.ownerDocument.createElement("div");
            _ov.style.cssText = "position:absolute;inset:0;background:rgba(0,0,0,0.56);z-index:105;display:flex;align-items:center;justify-content:center;border-radius:inherit;";
            const _box = modal.ownerDocument.createElement("div");
            _box.style.cssText = "background:var(--background-primary);border:1px solid var(--background-modifier-border);border-radius:12px;padding:18px;box-shadow:0 12px 40px rgba(0,0,0,0.35);max-width:680px;width:94%;display:flex;flex-direction:column;gap:12px;";

            const _title = modal.ownerDocument.createElement("div");
            _title.style.cssText = "font-weight:700;font-size:15px;color:#ef6c00;";
            _title.textContent = isEmptyResult
                ? `Ответ от ${primaryModel} получился неполным`
                : `Ошибка запроса к ${primaryModel}`;

            const _desc = modal.ownerDocument.createElement("div");
            _desc.style.cssText = "font-size:12px;color:var(--text-muted);line-height:1.5;";
            _desc.textContent = isEmptyResult
                ? "Модель вернула почти пустой структурированный результат. Выберите, что сделать дальше."
                : "Похоже, большой запрос не прошёл. Можно повторить этот же запрос или перейти на резервную модель.";

            const _err = modal.ownerDocument.createElement("div");
            _err.style.cssText = "max-height:180px;overflow:auto;background:var(--background-secondary);border:1px solid var(--background-modifier-border);border-radius:8px;padding:10px 12px;font-size:12px;line-height:1.45;color:var(--text-normal);white-space:pre-wrap;word-break:break-word;";
            _err.textContent = String(errorText || "Подробности не получены").slice(0, 2500);

            const _btns = modal.ownerDocument.createElement("div");
            _btns.style.cssText = "display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;";

            const _cancelBtn = modal.ownerDocument.createElement("button");
            _cancelBtn.textContent = "Отмена";
            _cancelBtn.style.cssText = "padding:8px 14px;border:1px solid var(--background-modifier-border);border-radius:6px;background:none;color:var(--text-normal);cursor:pointer;font-size:13px;";
            _cancelBtn.onclick = () => { _ov.remove(); resolve("cancel"); };

            const _retryBtn = modal.ownerDocument.createElement("button");
            _retryBtn.textContent = "Попробовать ещё раз";
            _retryBtn.style.cssText = "padding:8px 14px;border:1px solid var(--interactive-accent);border-radius:6px;background:var(--background-primary);color:var(--text-normal);cursor:pointer;font-size:13px;";
            _retryBtn.onclick = () => { _ov.remove(); resolve("retry"); };

            const _fallbackBtn = modal.ownerDocument.createElement("button");
            _fallbackBtn.textContent = `Использовать ${fallbackModel}`;
            _fallbackBtn.style.cssText = "padding:8px 14px;border:none;border-radius:6px;background:#ef6c00;color:#fff;cursor:pointer;font-size:13px;font-weight:600;";
            _fallbackBtn.onclick = () => { _ov.remove(); resolve("fallback"); };

            _btns.appendChild(_cancelBtn);
            _btns.appendChild(_retryBtn);
            _btns.appendChild(_fallbackBtn);
            _box.appendChild(_title);
            _box.appendChild(_desc);
            _box.appendChild(_err);
            _box.appendChild(_btns);
            _ov.appendChild(_box);
            modal.appendChild(_ov);
        });
        const prepareParserReviewPayload = (payload, sourceText, meta) => {
            let warnings = Array.isArray(payload?.warnings) ? payload.warnings.filter(Boolean).map(v => String(v).trim()).filter(Boolean) : [];
            if (meta?.response_mode === "json_object_fallback") warnings.unshift("Строгая JSON Schema недоступна у текущего роутинга, использован резервный режим json_object.");
            if (meta?.strict_error) warnings.push(`Причина резервного режима: ${meta.strict_error}`);
            const slotMetaMap = parserGetSlotMetaMap(getDraftValue);

            const groupedFields = new Map();
            let fields = [];
            let conflicts = [];
            const labs = [];
            let policyTrace = [];
            const scoreSlot = (item) => (parserGetExtractConfidence(item) * 0.7) + (parserGetMergeConfidence(item) * 0.3);
            const pushField = (rawItem) => {
                const key = parserNormalizeKey(rawItem?.key || "");
                if (!PARSER_ALLOWED_KEYS.includes(key)) return;
                const candidate = rawItem?.string_value !== null && rawItem?.string_value !== undefined && rawItem?.string_value !== "" ? rawItem.string_value : rawItem?.number_value;
                const validated = parserValidateValue(key, parserCoerceValue(key, candidate));
                if (validated.value === null || validated.value === undefined || validated.value === "") return;
                if (!groupedFields.has(key)) groupedFields.set(key, []);
                groupedFields.get(key).push({
                    key,
                    value: validated.value,
                    ...parserMetaFromRaw(rawItem),
                    warnings: validated.warnings
                });
            };
            (payload?.fields || []).forEach(pushField);

            groupedFields.forEach((items, key) => {
                const currentValue = getDraftValue(key);
                const hasCurrent = !(currentValue === null || currentValue === undefined || currentValue === "");
                if (items.length === 1 || items.every(item => parserValueEquals(items[0].value, item.value))) {
                    const best = items.reduce((acc, item) => scoreSlot(item) > scoreSlot(acc) ? item : acc, items[0]);
                    const sameAsCurrent = hasCurrent && parserValueEquals(currentValue, best.value);
                    const riskLevel = parserGetRiskLevel(key);
                    const freshness = parserGetFreshnessAssessment({ key, sourceDate: best.source_date, slotMetaMap });
                    const sourceTypeScore = parserGetSourceTypeScore(best.source_label);
                    const exactQuoteSupport = parserHasExactQuoteSupport(key, best.value, best.source_fragment);
                    const itemWarnings = [...new Set(items.flatMap(item => item.warnings))];
                    if (hasCurrent && !sameAsCurrent) itemWarnings.unshift("В карте уже есть другое значение");
                    if (freshness.status === "older" && freshness.note) itemWarnings.unshift(freshness.note);
                    const reviewRequired = !!best.review_required || parserRequiresManualReview(key) || freshness.status === "older";
                    const autoApplyScore = parserComputeAutoApproveScore({
                        extractConfidence: best.extract_confidence,
                        mergeConfidence: best.merge_confidence,
                        sourceTypeScore,
                        exactQuoteSupport,
                        noConflict: !hasCurrent && !sameAsCurrent
                    });
                    fields.push({
                        ...best,
                        risk_level: riskLevel,
                        source_type_score: sourceTypeScore,
                        exact_quote_support: exactQuoteSupport,
                        freshness_status: freshness.status,
                        freshness_note: freshness.note || "",
                        auto_apply_score: autoApplyScore,
                        review_required: reviewRequired,
                        current_value: hasCurrent ? currentValue : null,
                        same_as_current: sameAsCurrent,
                        warnings: [...new Set(itemWarnings)],
                        auto_apply: parserCanAutoApplyField({
                            key,
                            riskLevel,
                            hasCurrent,
                            sameAsCurrent,
                            reviewRequired,
                            warnings: itemWarnings,
                            freshnessStatus: freshness.status,
                            extractConfidence: best.extract_confidence,
                            mergeConfidence: best.merge_confidence,
                            sourceTypeScore,
                            exactQuoteSupport
                        })
                    });
                    return;
                }
                const suggestedIndex = items.reduce((bestIdx, item, idx, arr) => scoreSlot(item) > scoreSlot(arr[bestIdx]) ? idx : bestIdx, 0);
                conflicts.push({
                    key,
                    risk_level: parserGetRiskLevel(key),
                    reason: "Модель вернула несколько разных значений для одного поля",
                    suggested_index: suggestedIndex,
                    current_value: hasCurrent ? currentValue : null,
                    options: items.map(item => ({
                        value: item.value,
                        extract_confidence: item.extract_confidence,
                        merge_confidence: item.merge_confidence,
                        confidence: item.extract_confidence,
                        evidence: item.evidence,
                        source_label: item.source_label,
                        source_fragment: item.source_fragment,
                        source_date: item.source_date,
                        note: item.note,
                        warnings: item.warnings,
                        risk_level: parserGetRiskLevel(key),
                        source_type_score: parserGetSourceTypeScore(item.source_label),
                        exact_quote_support: parserHasExactQuoteSupport(key, item.value, item.source_fragment)
                    }))
                });
            });

            (payload?.conflicts || []).forEach(conflict => {
                const key = parserNormalizeKey(conflict?.key || "");
                if (!PARSER_ALLOWED_KEYS.includes(key)) return;
                const options = (conflict?.options || []).map(opt => {
                    const candidate = opt?.string_value !== null && opt?.string_value !== undefined && opt?.string_value !== "" ? opt.string_value : opt?.number_value;
                    const validated = parserValidateValue(key, parserCoerceValue(key, candidate));
                    const freshness = parserGetFreshnessAssessment({ key, sourceDate: opt?.source_date, slotMetaMap });
                    return {
                        value: validated.value,
                        ...parserMetaFromRaw(opt),
                        warnings: [...new Set([...(validated.warnings || []), ...(freshness.status === "older" && freshness.note ? [freshness.note] : [])])],
                        freshness_status: freshness.status,
                        freshness_note: freshness.note || "",
                        risk_level: parserGetRiskLevel(key),
                        source_type_score: parserGetSourceTypeScore(opt?.source_label),
                        exact_quote_support: parserHasExactQuoteSupport(key, validated.value, opt?.source_fragment)
                    };
                }).filter(opt => opt.value !== null && opt.value !== undefined && opt.value !== "");
                if (options.length < 2) return;
                conflicts.push({
                    key,
                    risk_level: parserGetRiskLevel(key),
                    reason: String(conflict?.reason || "Найдены разные значения").trim(),
                    suggested_index: Number.isFinite(Number(conflict?.suggested_index)) ? Math.min(Math.max(Number(conflict.suggested_index), 0), options.length - 1) : 0,
                    current_value: (() => {
                        const currentValue = getDraftValue(key);
                        return currentValue === null || currentValue === undefined || currentValue === "" ? null : currentValue;
                    })(),
                    options
                });
            });

            (payload?.lab_batches || []).forEach((batch, idx) => {
                const date = normalizeLabDateKey(batch?.date);
                const itemWarnings = [];
                try {
                    const parsed = parserParseLabBatch(batch);
                    itemWarnings.push(...getSuspiciousLabValues([parsed]).map(msg => `Подозрительное значение: ${msg}`));
                } catch (err) {
                    itemWarnings.push(err.message);
                }
                const existingLabs = Array.isArray(getDraftValue("Лабораторные")) ? getDraftValue("Лабораторные") : [];
                const sameDateExists = !!date && existingLabs.some(entry => normalizeLabDateKey(entry?.Дата) === date);
                const batchMeta = parserMetaFromRaw(batch);
                const sourceTypeScore = parserGetSourceTypeScore(batchMeta.source_label);
                const exactQuoteSupport = !!String(batchMeta.source_fragment || batchMeta.evidence || "").trim();
                const autoApplyScore = parserComputeAutoApproveScore({
                    extractConfidence: batchMeta.extract_confidence,
                    mergeConfidence: batchMeta.merge_confidence,
                    sourceTypeScore,
                    exactQuoteSupport,
                    noConflict: !sameDateExists
                });
                labs.push({
                    key: `lab_${idx}`,
                    date: date || String(batch?.date || ""),
                    json_payload: String(batch?.json_payload || "").trim(),
                    ...batchMeta,
                    risk_level: "critical_clinical",
                    source_type_score: sourceTypeScore,
                    exact_quote_support: exactQuoteSupport,
                    auto_apply_score: autoApplyScore,
                    review_required: !!batchMeta.review_required,
                    warnings: [...new Set(itemWarnings)],
                    same_date_exists: sameDateExists,
                    auto_apply: parserCanAutoApplyLab({
                        sameDateExists,
                        reviewRequired: !!batchMeta.review_required,
                        warnings: itemWarnings,
                        extractConfidence: batchMeta.extract_confidence,
                        mergeConfidence: batchMeta.merge_confidence,
                        sourceTypeScore,
                        exactQuoteSupport
                    })
                });
            });

            const hasFieldKey = (key) => fields.some(item => item.key === key) || conflicts.some(item => item.key === key);
            const diagnosisCandidate = (() => {
                const direct = fields.find(item => item.key === "Диагноз" && !item.same_as_current)?.value
                    || fields.find(item => item.key === "Диагноз")?.value;
                if (direct) return String(direct);
                const conflict = conflicts.find(item => item.key === "Диагноз");
                return conflict ? String(conflict.options[Math.min(Math.max(Number(conflict.suggested_index) || 0, 0), conflict.options.length - 1)]?.value || "") : "";
            })();
            const diagnosisSummary = extractDiagnosisTnmStage(diagnosisCandidate);
            [
                ["db_t", diagnosisSummary.tVal],
                ["db_n", diagnosisSummary.nVal],
                ["db_m", diagnosisSummary.mVal],
                ["db_stage", diagnosisSummary.stage]
            ].forEach(([key, value]) => {
                if (!value || hasFieldKey(key)) return;
                const currentValue = getDraftValue(key);
                const hasCurrent = !(currentValue === null || currentValue === undefined || currentValue === "");
                const sameAsCurrent = hasCurrent && parserValueEquals(currentValue, value);
                const itemWarnings = [];
                if (hasCurrent && !sameAsCurrent) itemWarnings.push("В карте уже есть другое значение");
                const riskLevel = parserGetRiskLevel(key);
                const sourceTypeScore = parserGetSourceTypeScore("Диагноз документа");
                const exactQuoteSupport = parserHasExactQuoteSupport(key, value, diagnosisSummary.firstLine || diagnosisCandidate);
                fields.push({
                    key,
                    value,
                    extract_confidence: 0.995,
                    merge_confidence: hasCurrent && !sameAsCurrent ? 0.25 : 0.995,
                    confidence: 0.995,
                    evidence: "Извлечено из первой строки структурированного диагноза",
                    source_label: "Диагноз документа",
                    source_fragment: diagnosisSummary.firstLine || diagnosisCandidate,
                    source_date: "",
                    note: "Автодополнение полей TNM/стадии по сформированному диагнозу",
                    review_required: parserRequiresManualReview(key),
                    risk_level: riskLevel,
                    source_type_score: sourceTypeScore,
                    exact_quote_support: exactQuoteSupport,
                    freshness_status: "unknown",
                    freshness_note: "",
                    auto_apply_score: parserComputeAutoApproveScore({
                        extractConfidence: 0.995,
                        mergeConfidence: hasCurrent && !sameAsCurrent ? 0.25 : 0.995,
                        sourceTypeScore,
                        exactQuoteSupport,
                        noConflict: !hasCurrent && !sameAsCurrent
                    }),
                    current_value: hasCurrent ? currentValue : null,
                    same_as_current: sameAsCurrent,
                    warnings: itemWarnings,
                    auto_apply: parserCanAutoApplyField({
                        key,
                        riskLevel,
                        hasCurrent,
                        sameAsCurrent,
                        reviewRequired: parserRequiresManualReview(key),
                        warnings: itemWarnings,
                        freshnessStatus: "unknown",
                        extractConfidence: 0.995,
                        mergeConfidence: hasCurrent && !sameAsCurrent ? 0.25 : 0.995,
                        sourceTypeScore,
                        exactQuoteSupport
                    })
                });
            });

            const hasEcog = fields.some(item => item.key === "ECOG_статус") || conflicts.some(item => item.key === "ECOG_статус");
            if (!hasEcog) {
                const currentEcog = getDraftValue("ECOG_статус");
                if (currentEcog === null || currentEcog === undefined || currentEcog === "") {
                    const ecogMatch = matchEcogInText(sourceText);
                    if (ecogMatch && ecogMatch.value !== null) {
                        fields.push({
                            key: "ECOG_статус",
                            value: ecogMatch.value,
                            extract_confidence: 0.55,
                            merge_confidence: 0.55,
                            confidence: 0.55,
                            evidence: ecogMatch.fragment || "ECOG извлечён шаблонным поиском",
                            source_label: "Шаблонный поиск",
                            source_fragment: ecogMatch.fragment || "",
                            source_date: "",
                            note: "Добавлено резервным шаблонным поиском",
                            review_required: true,
                            risk_level: parserGetRiskLevel("ECOG_статус"),
                            source_type_score: parserGetSourceTypeScore("Шаблонный поиск"),
                            exact_quote_support: true,
                            freshness_status: "unknown",
                            freshness_note: "",
                            auto_apply_score: parserComputeAutoApproveScore({
                                extractConfidence: 0.55,
                                mergeConfidence: 0.55,
                                sourceTypeScore: parserGetSourceTypeScore("Шаблонный поиск"),
                                exactQuoteSupport: true,
                                noConflict: true
                            }),
                            current_value: null,
                            same_as_current: false,
                            warnings: ["Проверьте вручную: значение получено шаблонным поиском"],
                            auto_apply: false
                        });
                    }
                }
            }

            const getResolvedValue = (key) => {
                const direct = fields.find(item => item.key === key && !item.same_as_current)?.value
                    ?? fields.find(item => item.key === key)?.value;
                if (direct !== null && direct !== undefined && direct !== "") return direct;
                const conflict = conflicts.find(item => item.key === key);
                if (conflict?.options?.length) {
                    const idx = Math.min(Math.max(Number(conflict.suggested_index) || 0, 0), conflict.options.length - 1);
                    const conflictValue = conflict.options[idx]?.value;
                    if (conflictValue !== null && conflictValue !== undefined && conflictValue !== "") return conflictValue;
                }
                const currentValue = getDraftValue(key);
                return currentValue ?? "";
            };
            const prostateContext = [
                sourceText,
                parserValueToString(getResolvedValue("Диагноз")),
                parserValueToString(getResolvedValue("db_tumor_location")),
                parserValueToString(getResolvedValue("db_histotype"))
            ].join("\n");
            if (/предстат|простаты|prostate/i.test(prostateContext)) {
                const resolvedT = String(getResolvedValue("db_t") || "").trim();
                const resolvedN = String(getResolvedValue("db_n") || "").trim();
                const resolvedM = String(getResolvedValue("db_m") || "").trim();
                const resolvedStage = String(getResolvedValue("db_stage") || "").trim();
                const resolvedGleason = String(getResolvedValue("db_gleason") || "").trim();
                const resolvedPsa = String(getResolvedValue("db_initial_psa") || "").trim();
                const resolvedDiagnosis = String(getResolvedValue("Диагноз") || "").trim();
                const firstDiagLine = resolvedDiagnosis.split("\n").map(line => line.trim()).find(Boolean) || resolvedDiagnosis;
                const hasPrefixedTnm = /\b[cpyr]T(?:is|[0-4X][a-c]?)[^.\n,;]*N(?:[0-3X][a-c]?)[^.\n,;]*M(?:[01X][a-c]?)\b/i.test(firstDiagLine);
                const hasGleasonMention = /gleason|глисон/i.test(String(sourceText || ""));
                const hasPsaMention = /(?:^|[^a-zа-яё])(psa|пса)(?:[^a-zа-яё]|$)/i.test(String(sourceText || ""));
                if (!(resolvedT && resolvedN && resolvedM)) warnings.push("Простата: обязательны T, N и M. Проверьте, что все три поля заполнены.");
                if ((resolvedT || resolvedN || resolvedM) && !resolvedStage) warnings.push("Простата: при наличии TNM проверьте и явно укажите стадию.");
                if (resolvedT && !hasPrefixedTnm) warnings.push("Простата: в диагнозе проверьте префикс стадирования c/p/y/r перед T.");
                if (hasGleasonMention && !resolvedGleason) warnings.push("Простата: в тексте упомянут Gleason, но поле db_gleason не заполнено.");
                if (hasPsaMention && !resolvedPsa) warnings.push("Простата: в тексте упомянут PSA, но поле db_initial_psa не заполнено.");
            }

            const historicalGuard = parserApplyHistoricalStageGuard({
                fields,
                conflicts,
                warnings,
                sourceText,
                getCurrentValue: getDraftValue
            });
            fields = historicalGuard.fields;
            conflicts = historicalGuard.conflicts;
            warnings = [...new Set(historicalGuard.warnings || warnings)];
            policyTrace = [...(historicalGuard.policy_trace || [])];

            return { warnings: [...new Set(warnings)], fields, conflicts, labs, policy_trace: policyTrace };
        };
        const upsertSelectedField = (items, key, value, extra = {}) => {
            const next = Array.isArray(items) ? [...items] : [];
            const idx = next.findIndex(item => item?.key === key);
            if (value === null || value === undefined || value === "") {
                if (idx >= 0) next.splice(idx, 1);
                return next;
            }
            if (idx >= 0) next[idx] = { ...next[idx], key, value, ...extra };
            else next.push({ key, value, ...extra });
            return next;
        };
        const extractDiagnosisTnmStage = (diagnosisText) => {
            const text = String(diagnosisText || "").trim();
            const firstLine = text.split("\n").map(line => line.trim()).find(Boolean) || text;
            const compactTnm = firstLine.match(/([cpyr]?T(?:is|[0-4X][a-c]?))\s*N([0-3X][a-c]?)\s*M([01X][a-c]?)/i);
            const tFull = compactTnm?.[1] || firstLine.match(/([cpyr]?T(?:is|[0-4X][a-c]?))(?=N|[^A-Za-zА-Яа-яЁё0-9]|$)/i)?.[1] || "";
            const tPrefix = tFull.match(/^([cpyr]?)/i)?.[1] || "";
            const tVal = tFull ? tFull.replace(/^[cpyr]?T/i, "") : "";
            const nVal = compactTnm?.[2] || firstLine.match(/N([0-3X][a-c]?)(?=M|[^A-Za-zА-Яа-яЁё0-9]|$)/i)?.[1] || "";
            const mVal = compactTnm?.[3] || firstLine.match(/M([01X][a-c]?)(?=[^A-Za-zА-Яа-яЁё0-9]|$)/i)?.[1] || "";
            const stage = firstLine.match(PARSER_STAGE_PHRASE_CAPTURE_RE)?.[1] || "";
            return { firstLine, tPrefix, tVal, nVal, mVal, stage };
        };
        const patchDiagnosisTnmStage = (diagnosisText, nextState) => {
            const text = String(diagnosisText || "").trim();
            if (!text) return "";
            const lines = text.split("\n");
            const firstIdx = lines.findIndex(line => String(line).trim());
            if (firstIdx < 0) return text;
            let firstLine = String(lines[firstIdx] || "").trim();
            const prefix = nextState?.prefix ?? extractDiagnosisTnmStage(firstLine).tPrefix ?? "c";
            const tnmParts = [];
            if (nextState?.t) tnmParts.push(`${prefix}T${nextState.t}`);
            if (nextState?.n) tnmParts.push(`N${nextState.n}`);
            if (nextState?.m) tnmParts.push(`M${nextState.m}`);
            const nextTnm = tnmParts.join("");
            if (nextTnm) {
                if (/\b[cpyr]?T(?:is|[0-4X][a-c]?)[^.\n,;]*N(?:[0-3X][a-c]?)[^.\n,;]*M(?:[01X][a-c]?)\b/i.test(firstLine)) {
                    firstLine = firstLine.replace(/\b[cpyr]?T(?:is|[0-4X][a-c]?)[^.\n,;]*N(?:[0-3X][a-c]?)[^.\n,;]*M(?:[01X][a-c]?)\b/i, nextTnm);
                } else if (/,?\s*G[1-4]\b/i.test(firstLine)) {
                    firstLine = firstLine.replace(/,?\s*G[1-4]\b/i, `, ${nextTnm}, $&`.replace(", ,", ","));
                } else {
                    firstLine = `${firstLine.replace(/\.+$/, "")}, ${nextTnm}`;
                }
            }
            if (nextState?.stage) {
                if (PARSER_STAGE_PHRASE_RE.test(firstLine)) {
                    firstLine = firstLine.replace(PARSER_STAGE_PHRASE_RE, match => match.replace(/(?:I|II|III|IV)(?:A|B|C)?/i, `${nextState.stage}`));
                } else {
                    firstLine = `${firstLine.replace(/\.+$/, "")}, ${nextState.stage} стадия`;
                }
            }
            lines[firstIdx] = firstLine;
            return lines.join("\n");
        };
        const parserHasTreatmentEvidence = (text) => /(?:^|[^A-Za-zА-Яа-яЁё])(?:ПХТ|МХТ|ХТ|ЛТ|ДЛТ|ХЛТ|АДТ)(?:[^A-Za-zА-Яа-яЁё]|$)|лучев[а-я\s-]*терап|брахитерап|стереотакс|операц|резекц|лобэктом|лимфодиссекц|мастэктом|биопси|гормонотерап|таргетн|иммунотерап|дегареликс|гозерелин|тамоксифен|летрозол|палбоциклиб|осимертиниб|гефитиниб|капецитабин|цисплатин|карбоплатин|паклитаксел|folfox|folfiri|folfirinox/i.test(String(text || ""));
        const parserHasProgressionEvidence = (text) => /(?:прогрессир|прогрессия|прогрессирование|отдал[её]нн[а-я\s-]*метаст|метастаз[а-я\s-]*в|множественн[а-я\s-]*метаст|новые\s+метаст|дистанционн[а-я\s-]*метаст)/i.test(String(text || ""));
        const parserPreserveInitialDiagnosisLine = (currentDiagnosis, incomingDiagnosis) => {
            const currentParts = splitDiagnosisSentences(currentDiagnosis);
            const incomingParts = splitDiagnosisSentences(incomingDiagnosis);
            if (!currentParts.length) return buildDiagnosisText(incomingParts);
            if (!incomingParts.length) return buildDiagnosisText(currentParts);
            const currentSplit = splitDiagnosisHeadAndEvents(currentParts);
            const incomingSplit = splitDiagnosisHeadAndEvents(incomingParts);
            const header = currentSplit.head.length ? currentSplit.head : currentParts.slice(0, 1);
            const mergedEvents = mergeDistinctSegments(currentSplit.events, incomingSplit.events)
                .map((part, index) => ({ part, index, stamp: diagnosisEventStamp(part) ?? Number.MAX_SAFE_INTEGER }))
                .sort((left, right) => left.stamp === right.stamp ? left.index - right.index : left.stamp - right.stamp)
                .map(item => item.part);
            return buildDiagnosisText([...header, ...mergedEvents]);
        };
        const parserShouldKeepHistoricalStage = ({ currentState, proposedState, currentDiagnosis, proposedDiagnosis, sourceText }) => {
            const hasCurrentStage = !!String(currentState?.stage || currentState?.t || currentState?.n || currentState?.m || "").trim();
            if (!hasCurrentStage) return false;
            const changed = ["t", "n", "m", "stage"].some(key => !parserValueEquals(proposedState?.[key], currentState?.[key]));
            if (!changed) return false;
            const treatmentStarted = !!String(getStoredVal("Дата_начала_лечения") || "").trim()
                || parserHasTreatmentEvidence(currentDiagnosis)
                || parserHasTreatmentEvidence(proposedDiagnosis)
                || parserHasTreatmentEvidence(sourceText)
                || !!String(getStoredVal("db_prior_treatment") || "").trim()
                || !!String(getStoredVal("db_chemo_regimen") || "").trim();
            const progressionMentioned = parserHasProgressionEvidence(sourceText)
                || parserHasProgressionEvidence(proposedDiagnosis)
                || parserHasProgressionEvidence(currentDiagnosis)
                || Number(getStoredVal("db_progression")) === 1;
            return treatmentStarted && progressionMentioned;
        };
        const parserApplyHistoricalStageGuard = ({ fields, conflicts, warnings, sourceText, getCurrentValue }) => {
            const currentDiagnosis = String(getCurrentValue("Диагноз") || "");
            const currentState = {
                t: String(getCurrentValue("db_t") || extractDiagnosisTnmStage(currentDiagnosis).tVal || ""),
                n: String(getCurrentValue("db_n") || extractDiagnosisTnmStage(currentDiagnosis).nVal || ""),
                m: String(getCurrentValue("db_m") || extractDiagnosisTnmStage(currentDiagnosis).mVal || ""),
                stage: String(getCurrentValue("db_stage") || extractDiagnosisTnmStage(currentDiagnosis).stage || "")
            };
            const diagnosisField = fields.find(item => item.key === "Диагноз");
            const proposedDiagnosis = String(diagnosisField?.value || "");
            const proposedState = {
                t: String(fields.find(item => item.key === "db_t")?.value || currentState.t || ""),
                n: String(fields.find(item => item.key === "db_n")?.value || currentState.n || ""),
                m: String(fields.find(item => item.key === "db_m")?.value || currentState.m || ""),
                stage: String(fields.find(item => item.key === "db_stage")?.value || currentState.stage || "")
            };
            if (!parserShouldKeepHistoricalStage({ currentState, proposedState, currentDiagnosis, proposedDiagnosis, sourceText })) {
                return { fields, conflicts, warnings, policy_trace: [] };
            }
            const stageKeys = new Set(["db_t", "db_n", "db_m", "db_stage"]);
            const nextWarnings = [...new Set([...(warnings || []), "Историческое стадирование сохранено: после начала лечения и прогрессирования парсер не рестадирует диагноз, а оставляет исходные TNM/стадию."])];
            const nextFields = (fields || []).map(item => {
                if (!item?.key) return item;
                if (stageKeys.has(item.key)) {
                    const currentValue = currentState[item.key === "db_stage" ? "stage" : item.key.replace("db_", "")];
                    if (currentValue && !parserValueEquals(item.value, currentValue)) return null;
                    return item;
                }
                if (item.key === "Диагноз" && currentDiagnosis) {
                    return {
                        ...item,
                        value: parserPreserveInitialDiagnosisLine(currentDiagnosis, item.value),
                        note: [item.note, "Историческая преамбула диагноза сохранена из исходного стадирования."].filter(Boolean).join(" "),
                        warnings: [...new Set([...(item.warnings || []), "Историческая преамбула диагноза сохранена без рестадирования"])]
                    };
                }
                return item;
            }).filter(Boolean);
            const nextConflicts = (conflicts || []).map(conflict => {
                if (!conflict?.key) return conflict;
                if (stageKeys.has(conflict.key)) return null;
                if (conflict.key === "Диагноз" && currentDiagnosis) {
                    return {
                        ...conflict,
                        options: (conflict.options || []).map(opt => ({
                            ...opt,
                            value: parserPreserveInitialDiagnosisLine(currentDiagnosis, opt.value),
                            warnings: [...new Set([...(opt.warnings || []), "Историческая преамбула диагноза сохранена без рестадирования"])]
                        }))
                    };
                }
                return conflict;
            }).filter(Boolean);
            return {
                fields: nextFields,
                conflicts: nextConflicts,
                warnings: nextWarnings,
                policy_trace: [{
                    type: "historical_stage_guard",
                    action: "preserve_initial_stage",
                    reason: "После начала лечения и прогрессирования стадия/TNM остаются историческими, прогрессирование отражается отдельно.",
                    current_state: currentState,
                    blocked_keys: ["db_t", "db_n", "db_m", "db_stage"]
                }]
            };
        };
        const runTnmStageSuggestion = async ({ model, payload }) => {
            const prompt = [
                "Ты медицинский ассистент по онкологическому стадированию.",
                "Нужно после подтверждённого изменения T/N/M предложить обновление стадии по TNM9 и текста поля \"Диагноз\".",
                "Правила:",
                "- Используй только данные из переданного JSON.",
                "- Не придумывай лечение, даты, исследования и маркеры.",
                "- Онкологическая стадия и TNM фиксируются только на момент первичного стадирования. Если после лечения описано прогрессирование или появление отдалённых метастазов, не рестадируй диагноз в IV стадию задним числом.",
                "- Если меняешь \"Диагноз\", максимально сохрани существующий текст лечения, меняй только фрагменты TNM/стадии и связанные с этим формулировки.",
                "- suggested_stage должен содержать только значение стадии, например IIIA или IV.",
                "- Если стадия по TNM9 не определяется надёжно, верни suggested_stage=null и review_required=true.",
                "- updated_diagnosis верни только если можешь уверенно обновить диагноз без потери клинической информации.",
                "- Для опухолей простаты учитывай Gleason и PSA, если они даны.",
                "- Ничего не выдумывай."
            ].join("\n");
            return runStructuredParserRequest({
                model,
                schemaName: "tnm_stage_review",
                schema: TNM_STAGE_REVIEW_SCHEMA,
                messages: [
                    { role: "system", content: prompt },
                    { role: "user", content: JSON.stringify(payload, null, 2) }
                ]
            });
        };
        const applyInlineTnmStageSuggestion = async ({ reviewPayload, rawText, model }) => {
            const selectedMap = Object.fromEntries((reviewPayload?.fields || []).map(item => [item.key, item.value]));
            const changedKeys = ["db_t", "db_n", "db_m", "db_stage"].filter(key => Object.prototype.hasOwnProperty.call(selectedMap, key) && !parserValueEquals(selectedMap[key], getStoredVal(key)));
            if (!changedKeys.length) return reviewPayload;

            const currentDiagnosis = String(getStoredVal("Диагноз") || "");
            const selectedDiagnosis = String(selectedMap["Диагноз"] ?? currentDiagnosis);
            const diagSummary = extractDiagnosisTnmStage(currentDiagnosis);
            const selectedDiagSummary = extractDiagnosisTnmStage(selectedDiagnosis);
            const currentState = {
                t: String(getStoredVal("db_t") || diagSummary.tVal || ""),
                n: String(getStoredVal("db_n") || diagSummary.nVal || ""),
                m: String(getStoredVal("db_m") || diagSummary.mVal || ""),
                stage: String(getStoredVal("db_stage") || diagSummary.stage || ""),
                prefix: String(diagSummary.tPrefix || "c"),
                diagnosis: currentDiagnosis
            };
            const proposedState = {
                t: String(selectedMap["db_t"] ?? currentState.t ?? selectedDiagSummary.tVal ?? ""),
                n: String(selectedMap["db_n"] ?? currentState.n ?? selectedDiagSummary.nVal ?? ""),
                m: String(selectedMap["db_m"] ?? currentState.m ?? selectedDiagSummary.mVal ?? ""),
                stage: String(selectedMap["db_stage"] ?? currentState.stage ?? selectedDiagSummary.stage ?? ""),
                prefix: String(selectedDiagSummary.tPrefix || currentState.prefix || "c"),
                diagnosis: selectedDiagnosis
            };

            let suggestion = { suggested_stage: proposedState.stage || null, updated_diagnosis: proposedState.diagnosis || null, reason: "Изменены значения TNM/стадии.", confidence: 0, review_required: true };
            const suggestionPayload = {
                tumor_location: selectedMap["db_tumor_location"] ?? getStoredVal("db_tumor_location") ?? "",
                histotype: selectedMap["db_histotype"] ?? getStoredVal("db_histotype") ?? "",
                icd10: selectedMap["МКБ 10"] ?? getStoredVal("МКБ 10") ?? "",
                sex: selectedMap["db_sex"] ?? getStoredVal("db_sex") ?? "",
                grade: selectedMap["db_grade"] ?? getStoredVal("db_grade") ?? "",
                gleason: selectedMap["db_gleason"] ?? getStoredVal("db_gleason") ?? "",
                initial_psa: selectedMap["db_initial_psa"] ?? getStoredVal("db_initial_psa") ?? "",
                markers: {
                    er: selectedMap["db_er"] ?? getStoredVal("db_er") ?? "",
                    pr: selectedMap["db_pr"] ?? getStoredVal("db_pr") ?? "",
                    her2: selectedMap["db_her2"] ?? getStoredVal("db_her2") ?? "",
                    ki67: selectedMap["db_ki67"] ?? getStoredVal("db_ki67") ?? "",
                    pdl1: selectedMap["db_pdl1"] ?? getStoredVal("db_pdl1") ?? "",
                    msi: selectedMap["db_msi_status"] ?? getStoredVal("db_msi_status") ?? ""
                },
                current_state: currentState,
                proposed_state: proposedState,
                source_excerpt: String(rawText || "").slice(0, 12000)
            };
            try {
                const tnmResp = await runTnmStageSuggestion({ model, payload: suggestionPayload });
                suggestion = tnmResp?.data || suggestion;
            } catch (err) {
                return {
                    ...reviewPayload,
                    warnings: [...new Set([...(reviewPayload.warnings || []), `Не удалось автоматически подготовить пересчёт TNM9: ${err.message}`])]
                };
            }

            const fallbackDiagnosis = patchDiagnosisTnmStage(proposedState.diagnosis || currentState.diagnosis, {
                t: proposedState.t,
                n: proposedState.n,
                m: proposedState.m,
                stage: suggestion?.suggested_stage || proposedState.stage || currentState.stage || "",
                prefix: proposedState.prefix || currentState.prefix || "c"
            });
            const confidence = parserClampConfidence(suggestion?.confidence, suggestion?.review_required ? 0.75 : 0.9);
            const commonMeta = {
                evidence: suggestion?.reason || "Пересчёт TNM9 после изменения T/N/M/стадии",
                source_label: "Пересчёт TNM9",
                source_fragment: suggestion?.updated_diagnosis || fallbackDiagnosis || proposedState.diagnosis || "",
                source_date: "",
                extract_confidence: confidence,
                merge_confidence: confidence,
                confidence,
                auto_apply: confidence >= 0.999 && !suggestion?.review_required,
                review_required: !!suggestion?.review_required,
                warnings: suggestion?.review_required ? ["Проверьте пересчёт TNM9 перед сохранением"] : []
            };
            const nextFields = upsertSelectedField(
                upsertSelectedField(reviewPayload.fields, "db_stage", suggestion?.suggested_stage || proposedState.stage || currentState.stage || "", {
                    ...commonMeta,
                    note: "Строка добавлена в общее ревью после пересчёта TNM9"
                }),
                "Диагноз",
                suggestion?.updated_diagnosis || fallbackDiagnosis || proposedState.diagnosis || currentState.diagnosis || "",
                {
                    ...commonMeta,
                    note: "Диагноз синхронизирован с выбранными T/N/M/стадией в общем ревью"
                }
            );
            return {
                ...reviewPayload,
                fields: nextFields,
                warnings: [...new Set([...(reviewPayload.warnings || []), "Пересчёт TNM9 добавлен в основное окно ревью одной из строк."])],
                tnm_stage_trace: {
                    action: "inline_tnm9_recalculation",
                    reason: suggestion?.reason || "Стадия и диагноз пересчитаны перед общим ревью.",
                    current_state: currentState,
                    proposed_state: proposedState,
                    suggested_stage: suggestion?.suggested_stage || "",
                    suggested_diagnosis: suggestion?.updated_diagnosis || fallbackDiagnosis || ""
                }
            };
        };
        const showParserReviewModal = ({ warnings, fields, conflicts, labs, meta }) => new Promise(resolve => {
            const doc = modal.ownerDocument;
            const overlay = doc.createElement("div");
            overlay.style.cssText = "position:absolute;inset:0;background:rgba(0,0,0,0.56);z-index:110;display:flex;align-items:center;justify-content:center;border-radius:inherit;";
            const box = doc.createElement("div");
            box.style.cssText = "background:var(--background-primary);border:1px solid var(--background-modifier-border);border-radius:14px;padding:18px;box-shadow:0 12px 40px rgba(0,0,0,0.35);width:min(980px,96%);max-height:90%;display:flex;flex-direction:column;gap:12px;";
            const mk = (tag, css, text) => { const el = doc.createElement(tag); if (css) el.style.cssText = css; if (text !== undefined) el.textContent = text; return el; };
            const addLine = (parent, text, color = "var(--text-muted)") => { if (!text) return; const el = mk("div", `font-size:11px;color:${color};line-height:1.45;white-space:pre-wrap;word-break:break-word;`, text); parent.appendChild(el); };
            const addBlock = (parent, title, value, muted = false) => {
                if (value === null || value === undefined || value === "") return;
                const wrap = mk("div", `width:100%;box-sizing:border-box;border:1px solid var(--background-modifier-border);border-radius:8px;padding:8px 10px;background:${muted ? "var(--background-secondary)" : "var(--background-primary)"};`);
                wrap.appendChild(mk("div", "font-size:11px;color:var(--text-muted);margin-bottom:4px;", title));
                wrap.appendChild(mk("div", "font-size:12px;color:var(--text-normal);white-space:pre-wrap;word-break:break-word;line-height:1.45;", value));
                parent.appendChild(wrap);
            };
            const badge = (text, bg, color) => { const el = mk("span", `display:inline-flex;align-items:center;padding:2px 8px;border-radius:999px;background:${bg};color:${color};font-size:11px;font-weight:700;white-space:nowrap;`, text); return el; };
            const fmtPct = (value) => `${Math.round(parserClampConfidence(value) * 100)}%`;
            const confidenceTone = (value) => parserClampConfidence(value) >= PARSER_REVIEW_THRESHOLD
                ? { bg: "#e3f2fd", color: "#1565c0" }
                : { bg: "#fff3e0", color: "#ef6c00" };
            const appendConfidenceBadges = (parent, item) => {
                const extractTone = confidenceTone(item?.extract_confidence);
                const mergeTone = confidenceTone(item?.merge_confidence);
                parent.appendChild(badge(`извлечение ${fmtPct(item?.extract_confidence)}`, extractTone.bg, extractTone.color));
                parent.appendChild(badge(`слияние ${fmtPct(item?.merge_confidence)}`, mergeTone.bg, mergeTone.color));
            };
            const appendSourceBlocks = (parent, item) => {
                addLine(parent, item?.source_label ? `Источник: ${item.source_label}` : "");
                addLine(parent, item?.source_date ? `Дата документа/источника: ${item.source_date}` : "");
                addBlock(parent, "Фрагмент текста", item?.source_fragment || "", true);
                addLine(parent, item?.evidence ? `Обоснование: ${item.evidence}` : "");
            };
            const buildManualSelection = (key, value, currentValue, noteText) => ({
                key,
                value,
                current_value: currentValue ?? null,
                extract_confidence: 1,
                merge_confidence: 1,
                confidence: 1,
                evidence: "Значение изменено вручную в окне ревью",
                source_label: "Ручная корректировка в ревью",
                source_fragment: "",
                source_date: "",
                note: noteText || "Значение введено вручную пользователем",
                review_required: false,
                warnings: []
            });
            const parserMergeValue = (key, currentValue, nextValue) => {
                const currentText = parserValueToString(currentValue).trim();
                const nextText = parserValueToString(nextValue).trim();
                if (!currentText) return nextText;
                if (!nextText || parserValueEquals(currentText, nextText)) return currentText;
                const parts = `${currentText}\n${nextText}`
                    .split(/\n+/g)
                    .map(part => part.trim())
                    .filter(Boolean);
                return Array.from(new Set(parts)).join("\n");
            };
            const parserReviewGroupOrder = [
                { id: "identity", title: "Идентификация", test: key => ["ФИО", "Дата_рождения", "db_sex", "Номер_телефона", "СНИЛС"].includes(key) },
                { id: "diagnosis", title: "Диагноз/TNM", test: key => key === "Диагноз" || key === "МКБ 10" || /^db_(?:t|n|m|stage|tumor_location|histotype|grade|gleason|initial_psa|er|pr|her2|ki67|pdl1|msi_status|other_biomarkers)/.test(key) },
                { id: "treatment", title: "Лечение", test: key => key === "Решение_консилиума" || /^db_(?:chemo|rt|surgery|prior_treatment|progression|date_dx|date_last_contact)/.test(key) },
                { id: "labs", title: "Анализы", test: key => key === "__lab__" },
                { id: "admin", title: "Административное", test: () => true }
            ];
            const getParserReviewGroup = (key) => parserReviewGroupOrder.find(group => group.test(key)) || parserReviewGroupOrder[parserReviewGroupOrder.length - 1];
            const appendReviewGroup = (parent, title, nodes) => {
                if (!nodes.length) return;
                parent.appendChild(mk("div", "font-size:12px;font-weight:800;color:var(--text-muted);text-transform:uppercase;letter-spacing:0;margin:8px 0 -4px;", title));
                nodes.forEach(node => parent.appendChild(node));
            };
            const appendGroupedReviewNodes = (parent, entries) => {
                parserReviewGroupOrder.forEach(group => appendReviewGroup(
                    parent,
                    group.title,
                    entries.filter(entry => entry.groupId === group.id).map(entry => entry.node)
                ));
            };

            const header = mk("div", "display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap;");
            const titleWrap = mk("div");
            titleWrap.appendChild(mk("div", "font-size:18px;font-weight:700;color:var(--text-normal);", "Ревью парсинга"));
            titleWrap.appendChild(mk("div", "font-size:12px;color:var(--text-muted);margin-top:3px;line-height:1.45;", `Модель: ${meta?.model || DEFAULT_MODEL} · полей: ${fields.length} · конфликтов: ${conflicts.length} · лабораторий: ${labs.length}`));
            header.appendChild(titleWrap);
            const hdrBadges = mk("div", "display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end;");
            if (warnings.length) hdrBadges.appendChild(badge(`предупреждения: ${warnings.length}`, "#fff3e0", "#ef6c00"));
            if (conflicts.length) hdrBadges.appendChild(badge(`конфликты: ${conflicts.length}`, "#ffebee", "#c62828"));
            hdrBadges.appendChild(badge("финальная запись", "#e3f2fd", "#1565c0"));
            header.appendChild(hdrBadges);
            box.appendChild(header);

            if (warnings.length) {
                const warnBox = mk("div", "border:1px solid #ffcc80;background:#fff8e1;border-radius:10px;padding:10px 12px;display:flex;flex-direction:column;gap:6px;");
                warnBox.appendChild(mk("div", "font-size:12px;font-weight:700;color:#ef6c00;", "Предупреждения парсера"));
                warnings.forEach(msg => addLine(warnBox, `• ${msg}`, "#8d6e63"));
                box.appendChild(warnBox);
            }

            const errorBox = mk("div", "display:none;border:1px solid #ef9a9a;background:#ffebee;color:#c62828;border-radius:8px;padding:9px 12px;font-size:12px;line-height:1.45;");
            box.appendChild(errorBox);

            const scroll = mk("div", "overflow-y:auto;display:flex;flex-direction:column;gap:12px;padding-right:4px;");
            const fieldCtrls = [];
            const conflictCtrls = [];
            const labCtrls = [];
            const applyBoxes = [];
            const decisionTrace = { fields: [], conflicts: [], labs: [] };
            const isFullConfidenceAutoField = (item) => parserClampConfidence(item?.extract_confidence) >= 0.999
                && parserClampConfidence(item?.merge_confidence) >= 0.999;
            const isFullConfidenceAutoLab = (item) => parserClampConfidence(item?.extract_confidence) >= 0.999
                && parserClampConfidence(item?.merge_confidence) >= 0.999;
            const isHiddenAutoField = (item) => isFullConfidenceAutoField(item);
            const isHiddenAutoLab = (item) => isFullConfidenceAutoLab(item);
            const renderFieldCard = (item) => {
                const card = mk("div", "border:1px solid var(--background-modifier-border);border-radius:10px;padding:12px;background:var(--background-secondary);display:flex;flex-direction:column;gap:10px;");
                const top = mk("div", "display:flex;justify-content:space-between;gap:8px;align-items:flex-start;flex-wrap:wrap;");
                top.appendChild(mk("div", "font-size:14px;font-weight:700;color:var(--text-normal);", getParserFieldLabel(item.key)));
                const badges = mk("div", "display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end;");
                appendConfidenceBadges(badges, item);
                badges.appendChild(badge(parserGetRiskLabel(item.risk_level), "#ede7f6", "#6a1b9a"));
                if (item.review_required || item.warnings.length) badges.appendChild(badge("проверить", "#fff3e0", "#ef6c00"));
                if (parserRequiresManualReview(item.key)) badges.appendChild(badge("ручной апрув", "#f3e5f5", "#8e24aa"));
                if (item.same_as_current) badges.appendChild(badge("уже в карте", "#eceff1", "#546e7a"));
                if (isHiddenAutoField(item)) badges.appendChild(badge("100% автоподтверждение", "#e8f5e9", "#2e7d32"));
                top.appendChild(badges);
                card.appendChild(top);
                const input = createReviewInput(item.key, item.value);
                const preview = mk("div", "display:grid;grid-template-columns:1fr;gap:8px;width:100%;");
                addBlock(preview, "Было", parserValueToString(item.current_value), true);
                addBlock(preview, "Станет", parserValueToString(item.value), false);
                card.appendChild(preview);
                const inputWrap = mk("div", "display:flex;flex-direction:column;gap:6px;");
                inputWrap.appendChild(mk("div", "font-size:11px;color:var(--text-muted);", "Новое значение"));
                inputWrap.appendChild(input.el);
                card.appendChild(inputWrap);
                const actionRow = mk("div", "display:flex;gap:6px;flex-wrap:wrap;");
                const mkAction = (text, onClick) => {
                    const btn = mk("button", "padding:5px 9px;border:1px solid var(--background-modifier-border);border-radius:6px;background:var(--background-primary);color:var(--text-normal);cursor:pointer;font-size:12px;", text);
                    btn.onclick = onClick;
                    actionRow.appendChild(btn);
                };
                appendSourceBlocks(card, item);
                addLine(card, item.freshness_note ? `Свежесть источника: ${item.freshness_note}` : "");
                addLine(card, item.exact_quote_support ? "Точная цитата подтверждает значение." : "Точная цитата не подтверждена.");
                addLine(card, item.note ? `Пояснение: ${item.note}` : "");
                item.warnings.forEach(msg => addLine(card, `Предупреждение: ${msg}`, "#ef6c00"));
                const applyRow = mk("label", "display:flex;align-items:center;gap:8px;font-size:12px;color:var(--text-normal);cursor:pointer;");
                const applyBox = mk("input"); applyBox.type = "checkbox"; applyBox.checked = !!(item.auto_apply || isFullConfidenceAutoField(item));
                applyBoxes.push(applyBox);
                mkAction("Оставить старое", () => { applyBox.checked = false; input.setValue?.(item.current_value ?? ""); });
                mkAction("Принять новое", () => { applyBox.checked = true; input.setValue?.(item.value ?? ""); });
                if (PARSER_TEXTAREA_KEYS.has(item.key)) {
                    mkAction("Объединить", () => {
                        applyBox.checked = true;
                        input.setValue?.(parserMergeValue(item.key, item.current_value, item.value));
                    });
                }
                card.appendChild(actionRow);
                applyRow.appendChild(applyBox);
                applyRow.appendChild(mk("span", "", item.auto_apply ? "Применить автоматически" : "Применить это значение"));
                card.appendChild(applyRow);
                fieldCtrls.push({
                    key: item.key,
                    item,
                    apply: () => applyBox.checked,
                    getSelection: () => ({ ...item, value: input.getValue() })
                });
                return card;
            };
            const hiddenAutoFields = fields.filter(isHiddenAutoField);
            const visibleFields = fields.filter(item => !isHiddenAutoField(item));
            const hiddenAutoLabs = labs.filter(isHiddenAutoLab);
            const visibleLabs = labs.filter(item => !isHiddenAutoLab(item));
            const hiddenAutoTotal = hiddenAutoFields.length + hiddenAutoLabs.length;
            if (hiddenAutoTotal) hdrBadges.appendChild(badge(`автоподтверждено: ${hiddenAutoTotal}`, "#e8f5e9", "#2e7d32"));

            const conflictNodes = [];
            conflicts.forEach((item, idx) => {
                const card = mk("div", "border:1px solid var(--background-modifier-border);border-radius:10px;padding:12px;background:var(--background-secondary);display:flex;flex-direction:column;gap:10px;");
                const top = mk("div", "display:flex;justify-content:space-between;gap:8px;align-items:flex-start;flex-wrap:wrap;");
                top.appendChild(mk("div", "font-size:14px;font-weight:700;color:var(--text-normal);", `${getParserFieldLabel(item.key)}: конфликт`));
                const badges = mk("div", "display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end;");
                badges.appendChild(badge(parserGetRiskLabel(item.risk_level), "#ede7f6", "#6a1b9a"));
                badges.appendChild(badge(`${item.options.length} варианта`, "#ffebee", "#c62828"));
                badges.appendChild(badge("нужен выбор", "#fff3e0", "#ef6c00"));
                top.appendChild(badges);
                card.appendChild(top);
                addLine(card, item.reason || "Найдены разные значения", "#ef6c00");
                addBlock(card, "Текущее значение в карте", parserValueToString(item.current_value), true);
                let selectedIndex = Math.min(Math.max(Number(item.suggested_index) || 0, 0), item.options.length - 1);
                item.options.forEach((opt, optIdx) => {
                    const label = mk("label", "display:flex;align-items:flex-start;gap:8px;padding:8px;border-radius:8px;border:1px solid var(--background-modifier-border);background:var(--background-primary);cursor:pointer;");
                    const radio = mk("input"); radio.type = "radio"; radio.name = `parser_conflict_${idx}`; radio.checked = optIdx === selectedIndex; radio.style.marginTop = "2px"; radio.onchange = () => { selectedIndex = optIdx; };
                    const bodyWrap = mk("div", "display:flex;flex-direction:column;gap:4px;min-width:0;");
                    bodyWrap.appendChild(mk("div", "font-size:13px;color:var(--text-normal);white-space:pre-wrap;word-break:break-word;", parserValueToString(opt.value)));
                    addLine(bodyWrap, `Извлечение: ${fmtPct(opt.extract_confidence)} · Слияние: ${fmtPct(opt.merge_confidence)}`);
                    appendSourceBlocks(bodyWrap, opt);
                    addLine(bodyWrap, opt.note ? `Пояснение: ${opt.note}` : "");
                    opt.warnings.forEach(msg => addLine(bodyWrap, `Предупреждение: ${msg}`, "#ef6c00"));
                    label.appendChild(radio); label.appendChild(bodyWrap); card.appendChild(label);
                });
                const custom = createReviewInput(item.key, "", { multiline: PARSER_TEXTAREA_KEYS.has(item.key) });
                const customWrap = mk("div", "display:flex;flex-direction:column;gap:6px;");
                customWrap.appendChild(mk("div", "font-size:11px;color:var(--text-muted);", "Или ввести своё значение"));
                customWrap.appendChild(custom.el);
                card.appendChild(customWrap);
                const applyRow = mk("label", "display:flex;align-items:center;gap:8px;font-size:12px;color:var(--text-normal);cursor:pointer;");
                const applyBox = mk("input"); applyBox.type = "checkbox"; applyBox.checked = false;
                applyBoxes.push(applyBox);
                const actionRow = mk("div", "display:flex;gap:6px;flex-wrap:wrap;");
                const keepOldBtn = mk("button", "padding:5px 9px;border:1px solid var(--background-modifier-border);border-radius:6px;background:var(--background-primary);color:var(--text-normal);cursor:pointer;font-size:12px;", "Оставить старое");
                keepOldBtn.onclick = () => { applyBox.checked = false; custom.setValue?.(item.current_value ?? ""); };
                const acceptNewBtn = mk("button", "padding:5px 9px;border:1px solid var(--background-modifier-border);border-radius:6px;background:var(--background-primary);color:var(--text-normal);cursor:pointer;font-size:12px;", "Принять новое");
                acceptNewBtn.onclick = () => { applyBox.checked = true; custom.setValue?.(""); };
                actionRow.appendChild(keepOldBtn);
                actionRow.appendChild(acceptNewBtn);
                if (PARSER_TEXTAREA_KEYS.has(item.key)) {
                    const mergeBtn = mk("button", "padding:5px 9px;border:1px solid var(--background-modifier-border);border-radius:6px;background:var(--background-primary);color:var(--text-normal);cursor:pointer;font-size:12px;", "Объединить");
                    mergeBtn.onclick = () => {
                        const selected = item.options[selectedIndex] || {};
                        applyBox.checked = true;
                        custom.setValue?.(parserMergeValue(item.key, item.current_value, selected.value));
                    };
                    actionRow.appendChild(mergeBtn);
                }
                card.appendChild(actionRow);
                applyRow.appendChild(applyBox); applyRow.appendChild(mk("span", "", "Применить выбранный вариант")); card.appendChild(applyRow);
                conflictCtrls.push({
                    key: item.key,
                    item,
                    apply: () => applyBox.checked,
                    getSelection: () => {
                        const customValue = custom.getValue();
                        if (customValue !== null && customValue !== undefined && customValue !== "") {
                            return {
                                ...buildManualSelection(item.key, customValue, item.current_value, "Пользователь вручную скорректировал конфликтное значение"),
                                selection_type: "manual",
                                rejected_candidates: (item.options || []).map((opt, optIdx) => ({
                                    index: optIdx,
                                    value: opt.value,
                                    reason: "Отклонено в ревью: пользователь ввёл своё значение"
                                }))
                            };
                        }
                        const selected = item.options[selectedIndex] || null;
                        return selected ? {
                            key: item.key,
                            current_value: item.current_value,
                            ...selected,
                            selection_type: "option",
                            selected_index: selectedIndex,
                            rejected_candidates: (item.options || []).map((opt, optIdx) => optIdx === selectedIndex ? null : ({
                                index: optIdx,
                                value: opt.value,
                                reason: `Отклонено в ревью: выбран вариант ${selectedIndex + 1}`
                            })).filter(Boolean)
                        } : null;
                    }
                });
                conflictNodes.push(card);
            });
            if (conflictNodes.length) {
                scroll.appendChild(mk("div", "font-size:12px;font-weight:800;color:#c62828;text-transform:uppercase;letter-spacing:0;margin:8px 0 -4px;", "Конфликты требуют решения"));
                conflictNodes.forEach(node => scroll.appendChild(node));
            }

            appendGroupedReviewNodes(scroll, visibleFields.map(item => ({
                groupId: getParserReviewGroup(item.key).id,
                node: renderFieldCard(item)
            })));

            const renderLabCard = (item, idx) => {
                const card = mk("div", "border:1px solid var(--background-modifier-border);border-radius:10px;padding:12px;background:var(--background-secondary);display:flex;flex-direction:column;gap:10px;");
                const top = mk("div", "display:flex;justify-content:space-between;gap:8px;align-items:flex-start;flex-wrap:wrap;");
                top.appendChild(mk("div", "font-size:14px;font-weight:700;color:var(--text-normal);", `Лабораторные: ${item.date || `блок ${idx + 1}`}`));
                const badges = mk("div", "display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end;");
                appendConfidenceBadges(badges, item);
                badges.appendChild(badge(parserGetRiskLabel(item.risk_level), "#ede7f6", "#6a1b9a"));
                if (item.review_required || item.warnings.length) badges.appendChild(badge("проверить", "#fff3e0", "#ef6c00"));
                if (item.same_date_exists) badges.appendChild(badge("дата уже есть", "#eceff1", "#546e7a"));
                if (isHiddenAutoLab(item)) badges.appendChild(badge("100% автоподтверждение", "#e8f5e9", "#2e7d32"));
                top.appendChild(badges); card.appendChild(top);
                const dateInput = createReviewInput("db_date_death", item.date || "", { forceText: true, placeholder: "yyyy-MM-dd" });
                appendSourceBlocks(card, item);
                addLine(card, item.exact_quote_support ? "Есть привязка к исходному фрагменту." : "Без явной цитаты источника.");
                const dateWrap = mk("div", "display:flex;flex-direction:column;gap:6px;"); dateWrap.appendChild(mk("div", "font-size:11px;color:var(--text-muted);", "Дата блока")); dateWrap.appendChild(dateInput.el); card.appendChild(dateWrap);
                const jsonInput = createReviewInput("db_other_biomarkers", item.json_payload, { multiline: true, rows: 8, raw: true, placeholder: "{\"Дата\":\"2026-01-01\",\"Гемоглобин\":120}" });
                const jsonWrap = mk("div", "display:flex;flex-direction:column;gap:6px;"); jsonWrap.appendChild(mk("div", "font-size:11px;color:var(--text-muted);", "JSON анализов за дату")); jsonWrap.appendChild(jsonInput.el); card.appendChild(jsonWrap);
                addLine(card, item.note ? `Пояснение: ${item.note}` : "");
                item.warnings.forEach(msg => addLine(card, `Предупреждение: ${msg}`, "#ef6c00"));
                const applyRow = mk("label", "display:flex;align-items:center;gap:8px;font-size:12px;color:var(--text-normal);cursor:pointer;");
                const applyBox = mk("input"); applyBox.type = "checkbox"; applyBox.checked = !!(item.auto_apply || isFullConfidenceAutoLab(item));
                applyBoxes.push(applyBox);
                applyRow.appendChild(applyBox); applyRow.appendChild(mk("span", "", item.auto_apply ? "Применить автоматически" : "Применить этот блок")); card.appendChild(applyRow);
                labCtrls.push({
                    item,
                    apply: () => applyBox.checked,
                    getSelection: () => ({
                        ...item,
                        batch: {
                            date: String(dateInput.getValue() || "").trim(),
                            json_payload: String(jsonInput.getValue() || "").trim()
                        }
                    })
                });
                return card;
            };

            appendGroupedReviewNodes(scroll, visibleLabs.map((item, idx) => ({
                groupId: "labs",
                node: renderLabCard(item, idx)
            })));

            if (hiddenAutoTotal) {
                const details = mk("details", "border:1px solid var(--background-modifier-border);border-radius:10px;background:var(--background-secondary);overflow:hidden;");
                const summary = mk("summary", "cursor:pointer;list-style:none;padding:12px 14px;font-size:13px;font-weight:700;color:var(--text-normal);display:flex;align-items:center;justify-content:space-between;gap:10px;");
                summary.appendChild(mk("span", "", `Автоподтверждённые слоты (${hiddenAutoTotal})`));
                summary.appendChild(badge("скрыто по умолчанию", "#e8f5e9", "#2e7d32"));
                details.appendChild(summary);
                const hiddenBody = mk("div", "padding:0 12px 12px;display:flex;flex-direction:column;gap:10px;");
                hiddenAutoFields.forEach(item => hiddenBody.appendChild(renderFieldCard(item)));
                hiddenAutoLabs.forEach((item, idx) => hiddenBody.appendChild(renderLabCard(item, idx)));
                details.appendChild(hiddenBody);
                details.addEventListener("toggle", () => {
                    if (!details.open) return;
                    requestAnimationFrame(() => requestAnimationFrame(() => {
                        const scrollRect = scroll.getBoundingClientRect();
                        const bodyRect = hiddenBody.getBoundingClientRect();
                        if (bodyRect.bottom > scrollRect.bottom) {
                            scroll.scrollTo({
                                top: scroll.scrollTop + (bodyRect.bottom - scrollRect.bottom) + 12,
                                behavior: "smooth"
                            });
                        } else if (bodyRect.top < scrollRect.top) {
                            scroll.scrollTo({
                                top: Math.max(0, scroll.scrollTop - (scrollRect.top - bodyRect.top) - 12),
                                behavior: "smooth"
                            });
                        }
                    }));
                });
                scroll.appendChild(details);
            }

            if (!fields.length && !conflicts.length && !labs.length) scroll.appendChild(mk("div", "border:1px dashed var(--background-modifier-border);border-radius:10px;padding:18px;text-align:center;color:var(--text-muted);font-size:13px;", "Модель не вернула структурированных данных. Можно закрыть окно и уточнить текст документа."));
            box.appendChild(scroll);

            const footer = mk("div", "display:flex;justify-content:space-between;gap:8px;align-items:center;flex-wrap:wrap;");
            footer.appendChild(mk("div", "font-size:11px;color:var(--text-muted);line-height:1.45;", hiddenAutoTotal ? "100% автоподтверждённые слоты уже скрыты под спойлером. Это финальный экран перед записью." : "Это финальный экран перед записью в карту."));
            const btnWrap = mk("div", "display:flex;gap:8px;flex-wrap:wrap;");
            const applyAllBtn = mk("button", "padding:8px 16px;border:1px solid var(--background-modifier-border);border-radius:6px;background:var(--background-primary);color:var(--text-normal);cursor:pointer;font-size:13px;", "Применить все");
            const cancelBtn = mk("button", "padding:8px 16px;border:1px solid var(--background-modifier-border);border-radius:6px;background:none;color:var(--text-normal);cursor:pointer;font-size:13px;", "Отмена");
            const applyBtn = mk("button", `padding:8px 16px;border:none;border-radius:6px;background:${AI_COLOR};color:#fff;cursor:pointer;font-size:13px;font-weight:600;`, "Записать выбранное");
            applyAllBtn.onclick = () => { applyBoxes.forEach(box => { box.checked = true; }); };
            btnWrap.appendChild(applyAllBtn); btnWrap.appendChild(cancelBtn); btnWrap.appendChild(applyBtn); footer.appendChild(btnWrap); box.appendChild(footer);

            applyBtn.onclick = () => {
                const errors = [];
                const selectedFields = [];
                const selectedLabs = [];
                const selectedWarnings = [];
                fieldCtrls.forEach(ctrl => {
                    const selected = ctrl.getSelection();
                    if (!ctrl.apply()) {
                        decisionTrace.fields.push({
                            key: ctrl.key,
                            risk_level: ctrl.item?.risk_level || parserGetRiskLevel(ctrl.key),
                            action: "skipped",
                            reason: "Поле не отмечено для применения",
                            candidate_value: ctrl.item?.value ?? null
                        });
                        return;
                    }
                    const validated = parserValidateValue(ctrl.key, selected?.value);
                    if (validated.value === null || validated.value === undefined || validated.value === "") {
                        errors.push(`Поле "${getParserFieldLabel(ctrl.key)}" отмечено, но осталось пустым.`);
                        decisionTrace.fields.push({
                            key: ctrl.key,
                            risk_level: ctrl.item?.risk_level || parserGetRiskLevel(ctrl.key),
                            action: "error",
                            reason: "После ревью поле осталось пустым"
                        });
                        return;
                    }
                    selectedFields.push({
                        ...selected,
                        value: validated.value,
                        warnings: [...new Set([...(selected?.warnings || []), ...validated.warnings])]
                    });
                    decisionTrace.fields.push({
                        key: ctrl.key,
                        risk_level: selected?.risk_level || ctrl.item?.risk_level || parserGetRiskLevel(ctrl.key),
                        action: "applied",
                        reason: ctrl.item?.auto_apply ? "Подтверждено из предвыбранного значения" : "Пользователь вручную подтвердил применение",
                        selected_value: validated.value
                    });
                    validated.warnings.forEach(msg => selectedWarnings.push(`${getParserFieldLabel(ctrl.key)}: ${msg}`));
                });
                conflictCtrls.forEach(ctrl => {
                    const selected = ctrl.getSelection();
                    if (!ctrl.apply()) {
                        decisionTrace.conflicts.push({
                            key: ctrl.key,
                            risk_level: ctrl.item?.risk_level || parserGetRiskLevel(ctrl.key),
                            action: "skipped",
                            reason: "Конфликт не отмечен для применения",
                            rejected_candidates: (ctrl.item?.options || []).map((opt, optIdx) => ({
                                index: optIdx,
                                value: opt.value,
                                reason: "Конфликт оставлен без применения"
                            }))
                        });
                        return;
                    }
                    if (!selected) {
                        errors.push(`Для "${getParserFieldLabel(ctrl.key)}" не выбран вариант.`);
                        decisionTrace.conflicts.push({
                            key: ctrl.key,
                            risk_level: ctrl.item?.risk_level || parserGetRiskLevel(ctrl.key),
                            action: "error",
                            reason: "Для конфликтного поля не выбран вариант"
                        });
                        return;
                    }
                    const validated = parserValidateValue(ctrl.key, selected.value);
                    if (validated.value === null || validated.value === undefined || validated.value === "") {
                        errors.push(`Для "${getParserFieldLabel(ctrl.key)}" не выбран вариант.`);
                        decisionTrace.conflicts.push({
                            key: ctrl.key,
                            risk_level: selected?.risk_level || ctrl.item?.risk_level || parserGetRiskLevel(ctrl.key),
                            action: "error",
                            reason: "После валидации конфликтное значение оказалось пустым"
                        });
                        return;
                    }
                    selectedFields.push({
                        ...selected,
                        value: validated.value,
                        warnings: [...new Set([...(selected?.warnings || []), ...validated.warnings])]
                    });
                    decisionTrace.conflicts.push({
                        key: ctrl.key,
                        risk_level: selected?.risk_level || ctrl.item?.risk_level || parserGetRiskLevel(ctrl.key),
                        action: "applied",
                        reason: selected?.selection_type === "manual" ? "Пользователь ввёл своё значение" : `Выбран вариант ${Number(selected?.selected_index ?? 0) + 1}`,
                        selected_value: validated.value,
                        rejected_candidates: selected?.rejected_candidates || []
                    });
                    validated.warnings.forEach(msg => selectedWarnings.push(`${getParserFieldLabel(ctrl.key)}: ${msg}`));
                });
                labCtrls.forEach((ctrl, idx) => {
                    if (!ctrl.apply()) {
                        decisionTrace.labs.push({
                            key: ctrl.item?.key || `lab_${idx}`,
                            risk_level: ctrl.item?.risk_level || "critical_clinical",
                            action: "skipped",
                            reason: "Лабораторный блок не отмечен для применения",
                            date: ctrl.item?.date || ""
                        });
                        return;
                    }
                    try {
                        const selected = ctrl.getSelection();
                        const parsed = parserParseLabBatch(selected.batch);
                        const suspicious = getSuspiciousLabValues([parsed]).map(msg => `Подозрительное значение: ${msg}`);
                        selectedLabs.push({
                            ...selected,
                            date: parsed.Дата,
                            json_payload: String(selected?.batch?.json_payload || "").trim(),
                            parsed_entry: parsed,
                            warnings: [...new Set([...(selected?.warnings || []), ...suspicious])]
                        });
                        decisionTrace.labs.push({
                            key: selected?.key || `lab_${idx}`,
                            risk_level: selected?.risk_level || "critical_clinical",
                            action: "applied",
                            reason: selected?.auto_apply ? "Подтверждено из предвыбранного лабораторного блока" : "Пользователь подтвердил лабораторный блок",
                            date: parsed.Дата
                        });
                        getSuspiciousLabValues([parsed]).forEach(msg => selectedWarnings.push(`Лабораторные ${parsed.Дата}: ${msg}`));
                    } catch (err) {
                        errors.push(`Лабораторный блок ${idx + 1}: ${err.message}`);
                        decisionTrace.labs.push({
                            key: ctrl.item?.key || `lab_${idx}`,
                            risk_level: ctrl.item?.risk_level || "critical_clinical",
                            action: "error",
                            reason: err.message,
                            date: ctrl.item?.date || ""
                        });
                    }
                });
                if (errors.length) {
                    errorBox.style.display = "block";
                    errorBox.textContent = errors.join(" ");
                    return;
                }
                overlay.remove();
                resolve({
                    fields: selectedFields,
                    labs: selectedLabs,
                    warnings: [...new Set([...(warnings || []), ...selectedWarnings])],
                    decision_trace: decisionTrace
                });
            };
            cancelBtn.onclick = () => { overlay.remove(); resolve(null); };
            overlay.appendChild(box);
            modal.appendChild(overlay);
        });
        const mergeTimelineText = (existingText, nextText) => {
            const currentText = String(existingText || "").trim();
            const incomingText = String(nextText || "").trim();
            if (!incomingText) return currentText;
            if (!currentText) return incomingText;
            const toLines = text => String(text).split("\n").map(line => line.trim()).filter(Boolean);
            const toStamp = line => {
                const match = line.match(/^(\d{2})\.(\d{2})\.(\d{4})/);
                return match ? parseInt(`${match[3]}${match[2]}${match[1]}`, 10) : 0;
            };
            const existingLines = toLines(currentText);
            const normalized = new Set(existingLines.map(line => line.replace(/\s+/g, " ").toLowerCase()));
            const toAdd = toLines(incomingText).filter(line => !normalized.has(line.replace(/\s+/g, " ").toLowerCase()));
            return toAdd.length ? [...existingLines, ...toAdd].sort((a, b) => toStamp(a) - toStamp(b)).join("\n") : currentText;
        };
        const mergeDistinctParagraphText = (existingText, nextText) => {
            const currentText = String(existingText || "").trim();
            const incomingText = String(nextText || "").trim();
            if (!incomingText) return currentText;
            if (!currentText) return incomingText;
            const normalize = (text) => String(text || "").replace(/\s+/g, " ").trim().toLowerCase();
            const currentNorm = normalize(currentText);
            const incomingNorm = normalize(incomingText);
            if (!currentNorm) return incomingText;
            if (!incomingNorm) return currentText;
            if (currentNorm === incomingNorm || currentNorm.includes(incomingNorm)) return currentText;
            if (incomingNorm.includes(currentNorm)) return incomingText;
            const splitBlocks = (text) => String(text).split(/\n{2,}|\n/).map(part => part.trim()).filter(Boolean);
            const existingBlocks = splitBlocks(currentText);
            const existingNorms = existingBlocks.map(normalize);
            const toAdd = splitBlocks(incomingText).filter(block => {
                const norm = normalize(block);
                if (!norm) return false;
                return !existingNorms.some(existingNorm => existingNorm === norm || existingNorm.includes(norm) || norm.includes(existingNorm));
            });
            return toAdd.length ? [...existingBlocks, ...toAdd].join("\n") : (incomingNorm.length > currentNorm.length ? incomingText : currentText);
        };
        const mergeDistinctListText = (existingText, nextText) => {
            const currentText = String(existingText || "").trim();
            const incomingText = String(nextText || "").trim();
            if (!incomingText) return currentText;
            if (!currentText) return incomingText;
            const splitItems = (text) => String(text)
                .split(/\n|;|●/g)
                .map(item => item.trim())
                .filter(Boolean);
            const normalize = (text) => String(text || "").replace(/\s+/g, " ").trim().toLowerCase();
            const existingItems = splitItems(currentText);
            const existingNorms = existingItems.map(normalize);
            const toAdd = splitItems(incomingText).filter(item => {
                const norm = normalize(item);
                if (!norm) return false;
                return !existingNorms.some(existingNorm => existingNorm === norm || existingNorm.includes(norm) || norm.includes(existingNorm));
            });
            return toAdd.length ? [...existingItems, ...toAdd].join("\n") : currentText;
        };
        const mergePhoneText = (existingText, nextText) => {
            const currentText = String(existingText || "").trim();
            const incomingText = String(nextText || "").trim();
            if (!incomingText) return currentText;
            if (!currentText) return incomingText;
            const normalizePhone = value => String(value || "").replace(/\D/g, "");
            const existingPhones = currentText.split(" / ").map(part => part.trim()).filter(Boolean);
            const existingNorms = new Set(existingPhones.map(normalizePhone));
            const incomingPhones = incomingText.split(/[,;]|\s+\/\s+|\//).map(part => part.trim()).filter(Boolean);
            const toAdd = incomingPhones.filter(phone => phone && !existingNorms.has(normalizePhone(phone)));
            return toAdd.length ? [...existingPhones, ...toAdd].join(" / ") : currentText;
        };
            const mergeLabEntries = (incomingEntries) => {
                const existing = Array.isArray(getDraftValue("Лабораторные")) ? [...getDraftValue("Лабораторные")] : [];
                const newDates = [];
                const mergedDates = [];
                const suspicious = [];
                incomingEntries.forEach(entry => {
                    const sourceEntry = entry?.parsed_entry ? entry.parsed_entry : entry;
                    const nextDate = normalizeLabDateKey(sourceEntry?.Дата);
                    if (!nextDate) return;
                    const cleanEntry = { ...sourceEntry, Дата: nextDate };
                    suspicious.push(...getSuspiciousLabValues([cleanEntry]));
                    const idx = existing.findIndex(item => normalizeLabDateKey(item?.Дата) === nextDate);
                    if (idx >= 0) {
                        existing[idx] = { ...existing[idx], ...cleanEntry };
                        mergedDates.push(nextDate);
                    } else {
                        existing.push(cleanEntry);
                        newDates.push(nextDate);
                    }
                });
            const normalizedEntries = existing
                .map(entry => ({ ...entry, Дата: normalizeLabDateKey(entry?.Дата) }))
                .sort((a, b) => normalizeLabDateKey(b?.Дата).localeCompare(normalizeLabDateKey(a?.Дата)));
            return {
                entries: normalizedEntries,
                summary: { newDates, mergedDates },
                warning: suspicious.length ? `Подозрительные значения лабораторных: ${[...new Set(suspicious)].join(", ")}` : ""
            };
        };
        const buildParserSavePlan = ({ fields, labs }) => {
            const updates = {};
            const changeEntries = [];
            const slotTrace = [];
            const planField = (item) => {
                const key = item?.key;
                const value = item?.value;
                if (!key || value === null || value === undefined || value === "") return;
                const currentValue = getDraftValue(key);
                let finalValue = value;
                let changeType = "replace";
                if (key === "Анамнез_заболевания" || key === "Описания_исследований") {
                    finalValue = mergeTimelineText(currentValue, value);
                    changeType = currentValue ? (parserValueEquals(finalValue, currentValue) ? "same" : "merge") : "add";
                } else if (key === "Диагноз") {
                    finalValue = mergeDiagnosisText(currentValue, value);
                    changeType = currentValue ? (parserValueEquals(finalValue, currentValue) ? "same" : "merge") : "add";
                } else if (key === "Решение_консилиума" || key === "Анамнез_жизни") {
                    finalValue = mergeDistinctParagraphText(currentValue, value);
                    changeType = currentValue ? (parserValueEquals(finalValue, currentValue) ? "same" : "merge") : "add";
                } else if (key === "Сопутствующие_заболевания") {
                    finalValue = mergeDistinctListText(currentValue, value);
                    changeType = currentValue ? (parserValueEquals(finalValue, currentValue) ? "same" : "merge") : "add";
                } else if (key === "Номер_телефона") {
                    finalValue = mergePhoneText(currentValue, value);
                    changeType = currentValue ? (parserValueEquals(finalValue, currentValue) ? "same" : "merge") : "add";
                } else {
                    if (currentValue === null || currentValue === undefined || currentValue === "") changeType = "add";
                    else if (parserValueEquals(currentValue, value)) changeType = "same";
                    else changeType = "replace";
                }
                slotTrace.push({
                    kind: "field",
                    ...item,
                    current_value: currentValue ?? null,
                    final_value: finalValue,
                    change_type: changeType
                });
                if (changeType !== "same" && !parserValueEquals(currentValue, finalValue)) {
                    updates[key] = finalValue;
                    changeEntries.push({
                        kind: "field",
                        key,
                        label: getParserFieldLabel(key),
                        risk_level: item?.risk_level || parserGetRiskLevel(key),
                        current_value: currentValue ?? null,
                        incoming_value: value,
                        final_value: finalValue,
                        change_type: changeType,
                        source_label: item?.source_label || "",
                        source_fragment: item?.source_fragment || "",
                        source_date: item?.source_date || "",
                        freshness_status: item?.freshness_status || "",
                        exact_quote_support: !!item?.exact_quote_support,
                        warnings: item?.warnings || []
                    });
                }
            };
            (fields || []).forEach(planField);

            if ((labs || []).length) {
                const existingLabs = Array.isArray(getDraftValue("Лабораторные")) ? getDraftValue("Лабораторные") : [];
                const labResult = mergeLabEntries(labs);
                updates["Лабораторные"] = labResult.entries;
                updates._labSummary = labResult.summary;
                if (labResult.warning) updates._labWarning = labResult.warning;
                (labs || []).forEach(item => {
                    const parsedEntry = item?.parsed_entry ? item.parsed_entry : null;
                    const date = normalizeLabDateKey(item?.date || parsedEntry?.Дата);
                    const currentEntry = date ? existingLabs.find(entry => normalizeLabDateKey(entry?.Дата) === date) || null : null;
                    const changeType = currentEntry ? "lab_merge" : "lab_add";
                    slotTrace.push({
                        kind: "lab",
                        ...item,
                        current_value: currentEntry,
                        final_value: parsedEntry,
                        change_type: changeType
                    });
                    changeEntries.push({
                        kind: "lab",
                        key: "Лабораторные",
                        label: `Лабораторные: ${date || item?.date || "без даты"}`,
                        risk_level: item?.risk_level || "critical_clinical",
                        current_value: currentEntry,
                        incoming_value: parsedEntry,
                        final_value: parsedEntry,
                        change_type: changeType,
                        source_label: item?.source_label || "",
                        source_fragment: item?.source_fragment || "",
                        source_date: item?.source_date || date || "",
                        freshness_status: item?.freshness_status || "",
                        exact_quote_support: !!item?.exact_quote_support,
                        warnings: item?.warnings || []
                    });
                });
            }

            return {
                updates,
                clinicalKeys: Object.keys(updates).filter(key => !key.startsWith("_")),
                changeEntries,
                slotTrace
            };
        };
        const finalizeParserSave = async ({ fields, labs, warnings, meta, review_trace, savePlan }) => {
            const planned = savePlan || buildParserSavePlan({ fields, labs });
            const updates = { ...(planned?.updates || {}) };
            const assignValue = (key, value) => {
                ls[key] = value;
                updates[key] = value;
            };
            Object.entries(updates).forEach(([key, value]) => {
                if (!String(key).startsWith("_")) ls[key] = value;
            });

            const clinicalKeys = Array.isArray(planned?.clinicalKeys)
                ? planned.clinicalKeys
                : Object.keys(updates).filter(key => !key.startsWith("_"));
            if (!clinicalKeys.length) {
                showStatus("ℹ️ Вы ничего не выбрали для сохранения", "#1565c0");
                return;
            }

            const parserWarnings = [...new Set([...(warnings || []), updates._labWarning].filter(Boolean))];
            const nextSlotMeta = { ...parserGetSlotMetaMap(getVal) };
            (planned?.slotTrace || []).forEach(slot => {
                if (slot?.kind === "field" && slot?.key && slot.change_type !== "same" && !String(slot.key).startsWith("AI_")) {
                    nextSlotMeta[`field:${slot.key}`] = {
                        kind: "field",
                        key: slot.key,
                        source_date: slot.source_date || "",
                        parsed_at: meta?.parsed_at || "",
                        risk_level: slot.risk_level || parserGetRiskLevel(slot.key),
                        source_label: slot.source_label || "",
                        final_value: parserValueToString(slot.final_value),
                        freshness_status: slot.freshness_status || "",
                        exact_quote_support: !!slot.exact_quote_support
                    };
                }
                if (slot?.kind === "lab") {
                    const labDate = normalizeLabDateKey(slot?.final_value?.Дата || slot?.date);
                    if (!labDate) return;
                    nextSlotMeta[`lab:${labDate}`] = {
                        kind: "lab",
                        date: labDate,
                        source_date: slot.source_date || labDate,
                        parsed_at: meta?.parsed_at || "",
                        source_label: slot.source_label || "",
                        risk_level: slot.risk_level || "critical_clinical"
                    };
                }
            });
            const parserMeta = {
                "AI_Парсер_модель": meta?.model || (localStorage.getItem(MODEL_LS) || DEFAULT_MODEL),
                "AI_Парсер_версия_промпта": PARSER_PROMPT_VERSION,
                "AI_Парсер_дата": meta?.parsed_at || new Date().toISOString(),
                "AI_Парсер_источник": meta?.source || "openrouter",
                "AI_Парсер_service_tier": meta?.service_tier || "",
                "AI_Парсер_system_fingerprint": meta?.system_fingerprint || "",
                "AI_Парсер_usage_json": meta?.usage ? JSON.stringify(meta.usage) : "",
                "AI_Парсер_предупреждения": parserWarnings.join(" | "),
                "AI_Парсер_ревью_json": review_trace ? JSON.stringify(review_trace) : "",
                "AI_Парсер_слоты_json": planned?.slotTrace ? JSON.stringify(planned.slotTrace) : "",
                "AI_Парсер_diff_json": planned?.changeEntries ? JSON.stringify(planned.changeEntries) : "",
                [PARSER_SLOT_META_KEY]: JSON.stringify(nextSlotMeta)
            };
            Object.entries(parserMeta).forEach(([key, value]) => assignValue(key, value));

            await saveNow(Object.fromEntries(Object.entries(updates).filter(([key]) => !key.startsWith("_"))));

            if (!getVal("ID_пациента") && getVal("ФИО") && getVal("Дата_рождения")) {
                const _allIds = new Set(
                    dv.pages().filter(p => p.ID_пациента).map(p => String(p.ID_пациента)).array()
                );
                const _svRaw = getVal("Связанные_случаи");
                const _svArr = _svRaw ? (Array.isArray(_svRaw) ? _svRaw : [_svRaw]) : [];
                let _inheritId = null;
                for (const _sv of _svArr) {
                    const _fn = String(_sv).replace(/^\[\[|\]\]$/g, "").trim();
                    const _lp = dv.pages().find(p => p.file.basename === _fn);
                    if (_lp?.ID_пациента) { _inheritId = String(_lp.ID_пациента); break; }
                }
                if (_inheritId) {
                    await saveNow({ ID_пациента: _inheritId });
                } else {
                    let _nid, _att = 0;
                    do {
                        _nid = `${100 + Math.floor(Math.random() * 900)}-${100 + Math.floor(Math.random() * 900)}`;
                    } while (_allIds.has(_nid) && ++_att < 9999);
                    await saveNow({ ID_пациента: _nid });
                }
            }

            const savedClinicalKeys = clinicalKeys.filter(key => !String(key).startsWith("AI_Парсер_"));
            let message = `✅ Сохранено ${savedClinicalKeys.length} ${savedClinicalKeys.length === 1 ? "поле" : savedClinicalKeys.length < 5 ? "поля" : "полей"}`;
            if (getVal("ID_пациента")) message += ` · ID: ${getVal("ID_пациента")}`;
            if (updates._labSummary) {
                if (updates._labSummary.newDates.length) message += ` · новые анализы: ${updates._labSummary.newDates.join(", ")}`;
                if (updates._labSummary.mergedDates.length) message += ` · объединены даты: ${updates._labSummary.mergedDates.join(", ")}`;
            }
            if (parserWarnings.length) message += ` · предупреждений: ${parserWarnings.length}`;
            showStatus(message, parserWarnings.length ? "#f57c00" : "#2e7d32");
            setTimeout(() => { buildForm(); }, 300);
        };

        const showConflictsModal = (conflicts, onComplete) => {
            const _cov = modal.ownerDocument.createElement('div');
            _cov.style.cssText = 'position:absolute;inset:0;background:rgba(0,0,0,0.5);z-index:90;display:flex;align-items:center;justify-content:center;border-radius:inherit;';
            const _cbox = modal.ownerDocument.createElement('div');
            _cbox.style.cssText = 'background:var(--background-primary);border:1px solid var(--background-modifier-border);border-radius:12px;padding:20px;box-shadow:0 10px 30px rgba(0,0,0,0.3);max-width:600px;width:92%;max-height:85%;display:flex;flex-direction:column;gap:12px;';
            
            const _chdr = modal.ownerDocument.createElement('div');
            _chdr.style.cssText = 'font-weight:700;font-size:16px;color:var(--text-normal);margin-bottom:8px;';
            _chdr.textContent = '⚠️ Найдены конфликты в данных';
            
            const _desc = modal.ownerDocument.createElement('div');
            _desc.style.cssText = 'font-size:12px;color:var(--text-muted);margin-bottom:4px;';
            _desc.textContent = 'Для некоторых полей найдены разные данные в тексте. Выберите правильный вариант:';
            
            const _scroll = modal.ownerDocument.createElement('div');
            _scroll.style.cssText = 'overflow-y:auto;flex:1;display:flex;flex-direction:column;gap:16px;padding-right:8px;';
            
            const results = {};
            conflicts.forEach(c => {
                const _cw = modal.ownerDocument.createElement('div');
                _cw.style.cssText = 'border:1px solid var(--background-modifier-border);border-radius:8px;padding:10px;background:var(--background-secondary);';
                const _ctitle = modal.ownerDocument.createElement('div');
                _ctitle.style.cssText = 'font-weight:700;font-size:13px;color:var(--text-accent);margin-bottom:8px;';
                _ctitle.textContent = c.key;
                _cw.appendChild(_ctitle);
                
                let selIdx = 0;
                c.options.forEach((opt, i) => {
                    const _lbl = modal.ownerDocument.createElement('label');
                    _lbl.style.cssText = 'display:flex;align-items:flex-start;gap:8px;margin-bottom:8px;cursor:pointer;font-size:13px;color:var(--text-normal);background:var(--background-primary);border:1px solid var(--background-modifier-border);padding:8px;border-radius:6px;transition:border-color 0.2s;';
                    _lbl.onmouseenter = () => _lbl.style.borderColor = 'var(--interactive-accent)';
                    _lbl.onmouseleave = () => { if (selIdx !== i) _lbl.style.borderColor = 'var(--background-modifier-border)'; };
                    
                    const _rad = modal.ownerDocument.createElement('input');
                    _rad.type = 'radio';
                    _rad.name = 'conf_' + c.key;
                    _rad.value = i;
                    _rad.style.marginTop = '2px';
                    if (i === 0) { _rad.checked = true; _lbl.style.borderColor = 'var(--interactive-accent)'; }
                    _rad.onchange = () => { 
                        selIdx = i;
                        Array.from(_cw.querySelectorAll('label')).forEach(l => l.style.borderColor = 'var(--background-modifier-border)');
                        _lbl.style.borderColor = 'var(--interactive-accent)';
                    };
                    
                    const _txt = modal.ownerDocument.createElement('div');
                    _txt.style.cssText = 'word-break:break-word;line-height:1.45;white-space:pre-wrap;';
                    _txt.textContent = opt;
                    
                    _lbl.appendChild(_rad); _lbl.appendChild(_txt);
                    _cw.appendChild(_lbl);
                });
                
                results[c.key] = () => c.options[selIdx];
                _scroll.appendChild(_cw);
            });
            
            const _btnRow = modal.ownerDocument.createElement('div');
            _btnRow.style.cssText = 'display:flex;justify-content:flex-end;margin-top:8px;';
            const _saveBtn = modal.ownerDocument.createElement('button');
            _saveBtn.textContent = 'Сохранить выбранное';
            _saveBtn.style.cssText = `padding:8px 16px;background:${AI_COLOR};color:#fff;border:none;border-radius:6px;font-size:13px;font-weight:600;cursor:pointer;transition:opacity 0.15s;`;
            _saveBtn.onmouseenter = () => _saveBtn.style.opacity = '0.85';
            _saveBtn.onmouseleave = () => _saveBtn.style.opacity = '1';
            _saveBtn.onclick = () => {
                const finalRes = {};
                for (const k in results) finalRes[k] = results[k]();
                _cov.remove();
                onComplete(finalRes);
            };
            
            _btnRow.appendChild(_saveBtn);
            _cbox.appendChild(_chdr); _cbox.appendChild(_desc); _cbox.appendChild(_scroll); _cbox.appendChild(_btnRow);
            _cov.appendChild(_cbox);
            modal.appendChild(_cov);
        };

        const btnRow = modal.ownerDocument.createElement("div");
        btnRow.style.cssText = "display:flex;flex-wrap:wrap;gap:8px;align-items:center;";

        const providerSel = modal.ownerDocument.createElement("select");
        providerSel.title = "Провайдер ИИ";
        providerSel.style.cssText = "flex:0 0 auto;height:34px;padding:0 8px;border-radius:6px;border:1px solid var(--background-modifier-border);background:var(--background-primary);color:var(--text-normal);font-size:12px;cursor:pointer;";
        AI_PROVIDERS.forEach(provider => {
            const opt = modal.ownerDocument.createElement("option");
            opt.value = provider.id;
            opt.textContent = provider.label;
            if (_getAiProvider() === provider.id) opt.selected = true;
            providerSel.appendChild(opt);
        });
        providerSel.onchange = () => localStorage.setItem(PROVIDER_LS, providerSel.value);

        const parseBtn = modal.ownerDocument.createElement("button");
        parseBtn.textContent = "Распознать";
        parseBtn.style.cssText = `flex:1 1 auto;min-height:36px;padding:0 16px;background:${AI_COLOR};color:#fff;border:none;border-radius:6px;font-size:13px;font-weight:600;cursor:pointer;touch-action:manipulation;transition:opacity .15s;`;
        parseBtn.onmouseenter = () => parseBtn.style.opacity = ".85";
        parseBtn.onmouseleave = () => parseBtn.style.opacity = "1";

        const changeKeyBtn = modal.ownerDocument.createElement("button");
        changeKeyBtn.textContent = "Изменить ключ";
        changeKeyBtn.style.cssText = "flex:0 0 auto;min-height:36px;padding:0 12px;background:var(--background-primary);border:1px solid var(--background-modifier-border);border-radius:6px;font-size:12px;color:var(--text-muted);cursor:pointer;touch-action:manipulation;";
        changeKeyBtn.onclick = () => {
            const existing = body.querySelector(".ai-key-editor");
            if (existing) { existing.remove(); return; }
            const keyRow = modal.ownerDocument.createElement("div");
            keyRow.className = "ai-key-editor";
            keyRow.style.cssText = "display:flex;gap:6px;align-items:center;flex-wrap:wrap;";
            const keyInput = modal.ownerDocument.createElement("input");
            keyInput.type = "text"; keyInput.value = _getProviderKey(providerSel.value); keyInput.placeholder = providerSel.value === "litellm" ? "LiteLLM API key…" : "sk-or-v1-…";
            keyInput.style.cssText = "flex:1 1 120px;min-width:0;height:34px;border-radius:6px;border:1px solid var(--background-modifier-border);background:var(--background-primary);color:var(--text-normal);padding:0 8px;font-size:13px;font-family:monospace;outline:none;box-sizing:border-box;";
            const saveKeyBtn = modal.ownerDocument.createElement("button");
            saveKeyBtn.textContent = "Сохранить";
            saveKeyBtn.style.cssText = `flex:0 0 auto;height:34px;padding:0 12px;background:${AI_COLOR};color:#fff;border:none;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;`;
            saveKeyBtn.onclick = () => { const v = keyInput.value.trim(); if (v) { localStorage.setItem(_getProviderInfo(providerSel.value).keyStorage, v); showStatus("✅ Ключ сохранён", "#2e7d32"); } keyRow.remove(); };
            keyRow.appendChild(keyInput); keyRow.appendChild(saveKeyBtn);
            btnRow.parentNode.insertBefore(keyRow, btnRow.nextSibling);
            keyInput.focus(); keyInput.select();
        };

        parseBtn.onclick = async () => {
            const _typedText = ta.value.trim();
            const _ONKO_SOURCE_FIELDS = [
                ["Описания_исследований", "Онко"],
                ["Анамнез_заболевания", "Анамнез заболевания"],
                ["Решение_консилиума", "Решение консилиума"],
            ];
            const _fallbackParts = _ONKO_SOURCE_FIELDS
                .map(([key, label]) => {
                    const v = getVal(key);
                    return (v && String(v).trim()) ? `${label}:\n${String(v).trim()}` : null;
                })
                .filter(Boolean);
            const rawText = _typedText || _fallbackParts.join("\n\n");
            if (!rawText) { showStatus("⚠️ Вставьте текст для распознавания или заполните раздел онко", "#f57c00"); return; }
            const key = _getProviderKey();
            if (!key) { showStatus("⚠️ API-ключ не задан", "#f57c00"); return; }

            // Инъекция существующих данных карты для комбинирования
            const _COMB_FIELDS = [
                "Диагноз",
                "Анамнез_заболевания",
                "Анамнез_жизни",
                "Описания_исследований",
                "Решение_консилиума",
                "Сопутствующие_заболевания",
                "Номер_телефона"
            ];
            const _existCtxLines = _COMB_FIELDS
                .map(f => { const v = getVal(f); return (v && String(v).trim()) ? `${f}: ${String(v).trim()}` : null; })
                .filter(Boolean);
            const userContent = _existCtxLines.length > 0
                ? `${rawText}\n\n=== ТЕКУЩИЕ ДАННЫЕ КАРТЫ ===\nИспользуй эти данные как уже подтверждённую базу: дополняй, комбинируй и расширяй без потери существующей информации.\n\n${_existCtxLines.join('\n\n')}`
                : rawText;

            parseBtn.disabled = true;
            parseBtn.textContent = "Обработка…";
            showStatus("🔍 Структурированный разбор документа и подготовка окна ревью…", "#2196f3");
            try {
                await refreshStoredFrontmatter();
                const model = localStorage.getItem(MODEL_LS) || DEFAULT_MODEL;
                const buildParserMessages = (modelId) => modelId.startsWith("google/")
                    ? [
                        {
                            role: "system",
                            content: [{ type: "text", text: PARSER_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }]
                        },
                        { role: "user", content: userContent }
                    ]
                    : [
                        { role: "system", content: PARSER_SYSTEM_PROMPT },
                        { role: "user", content: userContent }
                    ];
                const runParserPass = async (modelId) => runStructuredParserRequest({
                    model: modelId,
                    schemaName: "oncology_patient_parser",
                    schema: PARSER_RESPONSE_SCHEMA,
                    messages: buildParserMessages(modelId)
                });
                let parsed;
                let reviewPayload;
                const runFallbackPass = async (reasonMsg, reasonCode = "primary_error") => {
                    showStatus(`↪ Переключаюсь на резервную модель ${PARSER_FALLBACK_MODEL}…`, "#f57c00");
                    const fallbackParsed = await runParserPass(PARSER_FALLBACK_MODEL);
                    const fallbackPayload = prepareParserReviewPayload(fallbackParsed.data, rawText, fallbackParsed.meta);
                    const reasonText = String(reasonMsg || "").trim() || "причина не уточнена";
                    fallbackParsed.meta = {
                        ...fallbackParsed.meta,
                        primary_model: model,
                        fallback_reason: reasonCode,
                        fallback_reason_detail: reasonText
                    };
                    fallbackPayload.warnings = [...new Set([...(fallbackPayload.warnings || []), `Резервный проход ${PARSER_FALLBACK_MODEL}: ${reasonText}`])];
                    return { parsed: fallbackParsed, reviewPayload: fallbackPayload };
                };

                if (model === PARSER_FALLBACK_MODEL) {
                    parsed = await runParserPass(model);
                    reviewPayload = prepareParserReviewPayload(parsed.data, rawText, parsed.meta);
                } else {
                    while (true) {
                        try {
                            parsed = await runParserPass(model);
                            reviewPayload = prepareParserReviewPayload(parsed.data, rawText, parsed.meta);
                        } catch (primaryErr) {
                            const primaryMsg = String(primaryErr?.message || primaryErr || "Неизвестная ошибка");
                            const action = await askParserRetryOrFallback({
                                primaryModel: model,
                                fallbackModel: PARSER_FALLBACK_MODEL,
                                errorText: primaryMsg,
                                isEmptyResult: false
                            });
                            if (action === "retry") {
                                showStatus(`🔁 Повторяю запрос к ${model}…`, "#1565c0");
                                continue;
                            }
                            if (action === "fallback") {
                                const fallbackRes = await runFallbackPass(`Ошибка ${model}: ${primaryMsg}`, "primary_error");
                                parsed = fallbackRes.parsed;
                                reviewPayload = fallbackRes.reviewPayload;
                                break;
                            }
                            showStatus("ℹ️ Парсинг отменён пользователем", "#1565c0");
                            return;
                        }

                        if ((reviewPayload?.fields?.length || 0) > 0 || (reviewPayload?.labs?.length || 0) > 0) break;

                        const emptyReason = `${model} вернул почти пустой структурированный результат (без полей и лабораторных блоков).`;
                        const action = await askParserRetryOrFallback({
                            primaryModel: model,
                            fallbackModel: PARSER_FALLBACK_MODEL,
                            errorText: emptyReason,
                            isEmptyResult: true
                        });
                        if (action === "retry") {
                            showStatus(`🔁 Повторяю запрос к ${model}…`, "#1565c0");
                            continue;
                        }
                        if (action === "fallback") {
                            const fallbackRes = await runFallbackPass(emptyReason, "empty_primary_result");
                            parsed = fallbackRes.parsed;
                            reviewPayload = fallbackRes.reviewPayload;
                            break;
                        }
                        showStatus("ℹ️ Парсинг отменён пользователем", "#1565c0");
                        return;
                    }
                }
                const _normFIO = (s) => String(s || "").toLowerCase().trim().replace(/\s+/g, " ");
                const parsedFio = (() => {
                    const direct = reviewPayload.fields.find(item => item.key === "ФИО");
                    if (direct) return direct.value;
                    const conflict = reviewPayload.conflicts.find(item => item.key === "ФИО");
                    return conflict ? conflict.options[Math.min(Math.max(Number(conflict.suggested_index) || 0, 0), conflict.options.length - 1)]?.value : null;
                })();
                const storedFio = getStoredVal("ФИО");
                if (parsedFio && storedFio && _normFIO(parsedFio) !== _normFIO(storedFio)) {
                    const fioApproved = await askFioMismatchApproval(parsedFio);
                    if (!fioApproved) {
                        showStatus("ℹ️ Парсинг отменён: ФИО в документе не совпадает с картой", "#f57c00");
                        return;
                    }
                }

                showStatus("📝 Разбор завершён. Проверьте окно ревью перед записью в карту.", "#1565c0");
                reviewPayload = await applyInlineTnmStageSuggestion({
                    reviewPayload,
                    rawText,
                    model: parsed.meta?.primary_model || parsed.meta?.model || model
                });
                const reviewResult = await showParserReviewModal({ ...reviewPayload, meta: parsed.meta });
                if (!reviewResult) {
                    showStatus("ℹ️ Ревью закрыто без сохранения", "#1565c0");
                    return;
                }
                reviewResult.policy_trace = Array.isArray(reviewPayload?.policy_trace) ? reviewPayload.policy_trace : [];
                reviewResult.tnm_stage_trace = reviewPayload.tnm_stage_trace || null;
                const savePlan = buildParserSavePlan({ fields: reviewResult.fields, labs: reviewResult.labs });
                await finalizeParserSave({
                    ...reviewResult,
                    meta: parsed.meta,
                    savePlan,
                    review_trace: {
                        source_document: "manual_input",
                        suggested: reviewPayload,
                        policy_trace: reviewResult.policy_trace || [],
                        review_decisions: reviewResult.decision_trace || null,
                        tnm_stage_trace: reviewResult.tnm_stage_trace || null,
                        selected_fields: reviewResult.fields,
                        selected_labs: reviewResult.labs,
                        planned_changes: savePlan.changeEntries,
                        slot_trace: savePlan.slotTrace,
                        final_warnings: reviewResult.warnings
                    }
                });
            } catch(e) {
                showStatus(`❌ Ошибка: ${e.message}`, "#c62828");
            } finally {
                parseBtn.disabled = false;
                parseBtn.textContent = "Распознать";
            }
        };

        const modelSel = modal.ownerDocument.createElement("select");
        modelSel.style.cssText = "flex:0 0 auto;height:34px;padding:0 8px;border-radius:6px;border:1px solid var(--background-modifier-border);background:var(--background-primary);color:var(--text-normal);font-size:12px;cursor:pointer;";
        MODELS.forEach(m => {
            const opt = modal.ownerDocument.createElement("option");
            opt.value = m.id; opt.textContent = m.label;
            if ((localStorage.getItem(MODEL_LS) || DEFAULT_MODEL) === m.id) opt.selected = true;
            modelSel.appendChild(opt);
        });
        modelSel.onchange = () => localStorage.setItem(MODEL_LS, modelSel.value);
        btnRow.appendChild(providerSel);
        btnRow.appendChild(parseBtn);
        btnRow.appendChild(changeKeyBtn);
        btnRow.appendChild(modelSel);
        body.appendChild(btnRow);
        body.appendChild(status);
        aiWrap.appendChild(body);
    };

    renderAiPanel();
    wrap.appendChild(aiWrap);

    // ── УМНЫЙ ЧАТ ─────────────────────────────────────────────────────────────
    const chatWrap = modal.ownerDocument.createElement("div");
    chatWrap.style.cssText = "margin-bottom:8px; border-radius:8px; transition:box-shadow .2s ease;";
    const CHAT_PANEL_KEY = 'pf-chat-open-' + cur.file.path;
    let _chatIsOpen = localStorage.getItem(CHAT_PANEL_KEY) === '1';

    const renderChatPanel = () => {
        chatWrap.innerHTML = "";
        const hdr = modal.ownerDocument.createElement("div");
        hdr.style.cssText = "padding:10px 12px; background:var(--background-primary); border:1px solid var(--background-modifier-border); border-radius:" + (_chatIsOpen ? "8px 8px 0 0" : "8px") + "; display:flex; align-items:center; justify-content:space-between; cursor:pointer; user-select:none; transition:background .15s;";
        const title = modal.ownerDocument.createElement("div");
        title.innerHTML = `<span style="display:inline-block;width:24px;text-align:center;color:${AI_COLOR};">💬</span> <span style="font-weight:700;font-size:13px;color:var(--text-normal);">Умный чат с ИИ</span>`;
        hdr.appendChild(title);
        const icon = modal.ownerDocument.createElement("div");
        icon.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--text-muted); transition:transform 0.2s;"><path d="M6 9l6 6 6-6"/></svg>`;
        if (_chatIsOpen) icon.querySelector("svg").style.transform = "rotate(180deg)";
        hdr.appendChild(icon);
        hdr.onclick = () => {
            _chatIsOpen = !_chatIsOpen;
            localStorage.setItem(CHAT_PANEL_KEY, _chatIsOpen ? '1' : '0');
            renderChatPanel();
        };
        hdr.onmouseenter = () => { hdr.style.background = "var(--background-modifier-hover)"; chatWrap.style.boxShadow = `0 0 0 1px var(--interactive-accent)`; };
        hdr.onmouseleave = () => { hdr.style.background = "var(--background-primary)"; chatWrap.style.boxShadow = "none"; };
        chatWrap.appendChild(hdr);
        if (!_chatIsOpen) return;

        const body = modal.ownerDocument.createElement("div");
        body.style.cssText = "border:1px solid var(--background-modifier-border); border-top:none; border-radius:0 0 8px 8px; padding:12px; background:var(--background-primary); display:flex; flex-direction:column; gap:10px;";
        
        const historyWrap = modal.ownerDocument.createElement("div");
        historyWrap.style.cssText = "max-height:300px;overflow-y:auto;display:flex;flex-direction:column;gap:8px;padding-right:4px;font-size:13px;";
        
        let chatHistory = Array.isArray(getStoredVal("Чат_история")) ? [...getStoredVal("Чат_история")] : [];
        const renderHistory = () => {
            historyWrap.innerHTML = "";
            if(chatHistory.length === 0) {
                historyWrap.innerHTML = "<div style='color:var(--text-muted);font-size:11px;text-align:center;'>Задайте вопрос по всем медицинским документам пациента. ИИ проанализирует карточку и мгновенно ответит.</div>";
            }
            chatHistory.forEach(msg => {
                const b = modal.ownerDocument.createElement("div");
                const isUser = msg.role === 'user';
                b.style.cssText = `background:${isUser ? 'var(--interactive-accent)' : 'var(--background-secondary)'};color:${isUser ? '#fff' : 'var(--text-normal)'};padding:8px 10px;border-radius:6px;align-self:${isUser ? 'flex-end' : 'flex-start'};max-width:90%;white-space:pre-wrap;word-break:break-word;`;
                b.textContent = msg.content;
                historyWrap.appendChild(b);
            });
            setTimeout(() => { historyWrap.scrollTop = historyWrap.scrollHeight; }, 10);
        };
        renderHistory();
        body.appendChild(historyWrap);

        const inputRow = modal.ownerDocument.createElement("div");
        inputRow.style.cssText = "display:flex;gap:6px;";
        const inp = modal.ownerDocument.createElement("input");
        inp.type = "text"; 
        inp.placeholder = "Спросить про пациента...";
        inp.style.cssText = "flex:1;height:34px;border-radius:6px;border:1px solid var(--background-modifier-border);background:var(--background-primary);color:var(--text-normal);padding:0 8px;font-size:13px;outline:none;";
        inp.onfocus = () => { inp.style.borderColor = "var(--interactive-accent)"; };
        inp.onblur = () => { inp.style.borderColor = "var(--background-modifier-border)"; };
        const sendBtn = modal.ownerDocument.createElement("button");
        sendBtn.innerHTML = "➤";
        sendBtn.style.cssText = `height:34px;width:34px;padding:0;background:${AI_COLOR};color:#fff;border:none;border-radius:6px;cursor:pointer;display:flex;align-items:center;justify-content:center;`;
        
        const showChatStatus = (msg, clr) => {
            const st = modal.ownerDocument.createElement("div");
            st.style.cssText = `font-size:11px;color:${clr};text-align:center;margin-top:-4px;`;
            st.textContent = msg;
            body.appendChild(st);
            setTimeout(() => st.remove(), 4000);
        };

        const doSend = async () => {
            const q = inp.value.trim();
            if(!q) return;
            const key = _getProviderKey();
            if(!key) { showChatStatus("⚠️ Откройте AI-Ассистент и сохраните API-ключ", "#f57c00"); return; }
            inp.value = "";
            inp.disabled = true; sendBtn.disabled = true; sendBtn.style.opacity = "0.5";
            chatHistory.push({ role: "user", content: q });
            renderHistory();
            
            try {
                await refreshStoredFrontmatter();
                const ctxParts = [];
                if(getVal("ФИО")) ctxParts.push(`Пациент: ${getVal("ФИО")}`);
                if(getVal("Дата_рождения")) ctxParts.push(`Дата рождения: ${getVal("Дата_рождения")}`);
                if(getVal("МКБ 10")) ctxParts.push(`МКБ: ${getVal("МКБ 10")}`);
                if(getVal("Диагноз")) ctxParts.push(`Диагноз: ${getVal("Диагноз")}`);
                if(getVal("Анамнез_заболевания")) ctxParts.push(`Анамнез заб: ${getVal("Анамнез_заболевания")}`);
                if(getVal("Описания_исследований")) ctxParts.push(`Описания исследований: ${getVal("Описания_исследований")}`);
                if(getVal("Решение_консилиума")) ctxParts.push(`Консилиумы: ${getVal("Решение_консилиума")}`);
                
                const ctx = ctxParts.join("\\n");
                const model = localStorage.getItem(MODEL_LS) || DEFAULT_MODEL;
                const providerCfg = _getProviderRequestConfig(model);
                
                const resp = await fetch(providerCfg.endpoint, {
                    method: "POST",
                    headers: { "Authorization": `Bearer ${providerCfg.key}`, "Content-Type": "application/json" },
                    body: JSON.stringify({
                        model: providerCfg.modelId,
                        messages: [
                            { role: "system", content: "Ты — мед. ассистент врача-онколога. Отвечай кратко, по делу, опираясь ТОЛЬКО на предоставленный контекст карты пациента. Дай четкий ответ на вопрос врача.\\n\\nКОНТЕКСТ:\\n" + ctx },
                            ...chatHistory.slice(-15)
                        ]
                    })
                });
                if(!resp.ok) { const et = await resp.text(); throw new Error(`HTTP ${resp.status}: ${et.slice(0,100)}`); }
                const rjson = await resp.json();
                const aiMsg = rjson?.choices?.[0]?.message?.content || "";
                chatHistory.push({ role: "assistant", content: aiMsg });
                await saveNow({ "Чат_история": chatHistory });
                renderHistory();
            } catch(e) {
                chatHistory.push({ role: "assistant", content: "❌ Ошибка: " + e.message });
                renderHistory();
            }
            inp.disabled = false; sendBtn.disabled = false; sendBtn.style.opacity = "1";
            inp.focus();
        };
        sendBtn.onclick = doSend;
        inp.onkeydown = e => { if(e.key === "Enter") doSend(); };
        inputRow.appendChild(inp); inputRow.appendChild(sendBtn);
        body.appendChild(inputRow);
        chatWrap.appendChild(body);
    };
    renderChatPanel();
    // ЧАТ ПЕРЕНЕСЁН НИЖЕ РЕДАКТОРА — не добавляем его в wrap

    // ── ОСНОВНАЯ СЕТКА ────────────────────────────────────────────────────────
    const grid = modal.ownerDocument.createElement("div");
    grid.className = `${msc}-grid`;
    wrap.appendChild(grid);

    const c1 = modal.ownerDocument.createElement("div");
    const c1title = modal.ownerDocument.createElement("div");
    c1title.textContent = "Пациент"; c1title.className = `${msc}-sec-title`; c1title.id = "pf0-sec-patient";
    c1.appendChild(c1title);
    field(c1, "ФИО", "ФИО");

    if (!modal.ownerDocument.getElementById("pf-dob-row-style")) {
        const _rs = modal.ownerDocument.createElement("style"); _rs.id = "pf-dob-row-style";
        _rs.textContent = `.pf-dob-mkb-ecog{display:grid;grid-template-columns:1fr 1fr 1fr;gap:0 16px;}@media(max-width:560px){.pf-dob-mkb-ecog{grid-template-columns:1fr;}}`;
        modal.ownerDocument.head.appendChild(_rs);
    }
    const dobMkbEcogRow = modal.ownerDocument.createElement("div");
    dobMkbEcogRow.className = "pf-dob-mkb-ecog";
    field(dobMkbEcogRow, "Дата рождения", "Дата_рождения", "date");
    field(dobMkbEcogRow, "МКБ-10", "МКБ 10", "text", { acKey: "МКБ 10" });
    field(dobMkbEcogRow, "ECOG", "ECOG_статус", "select", { opts: ["0", "1", "2", "3", "4"] });
    c1.appendChild(dobMkbEcogRow);

    field(c1, "Диагноз", "Диагноз", "textarea");
    field(c1, "Доп. информация", "Дополнительная_информация", "textarea");

    const snilsPhoneRow = modal.ownerDocument.createElement("div");
    snilsPhoneRow.style.cssText = "display:grid;grid-template-columns:1fr 1fr;gap:0 16px;";
    field(snilsPhoneRow, "СНИЛС", "СНИЛС");
    field(snilsPhoneRow, "Телефон", "Номер_телефона");
    c1.appendChild(snilsPhoneRow);
    const emailRow = modal.ownerDocument.createElement("div");
    field(emailRow, "Email", "Email", "text");
    c1.appendChild(emailRow);

    const TRANSFER_ADD_DOCTOR_VALUE = "__pf_add_transfer_doctor__";
    const transferDoctors = [
        "Бардакова А.Ю.",
        "Басистый А.А.",
        "Иванова Е.Р.",
        "Калинин К.В.",
        "Мирзаханов Р.И.",
        "Осинин П.В.",
        "Потапов Д.В.",
        "Смирнова В.Н.",
        "Соков В.Н.",
        "Титова Л.М.",
        "Яркина А.В."
    ];
    const normalizeTransferDoctor = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
    const sortTransferDoctors = (doctors) => {
        const collator = new Intl.Collator("ru", { usage: "sort", sensitivity: "base" });
        return Array.from(new Set((Array.isArray(doctors) ? doctors : []).map(normalizeTransferDoctor).filter(Boolean))).sort(collator.compare);
    };
    const ensureTransferDoctor = (name) => {
        const doctor = normalizeTransferDoctor(name);
        if (!doctor) return null;
        if (!transferDoctors.map(normalizeTransferDoctor).includes(doctor)) transferDoctors.push(doctor);
        return doctor;
    };
    const renderTransferDoctorField = (container) => {
        const row = modal.ownerDocument.createElement("div");
        row.className = `${msc}-field-row`;
        const lbl = modal.ownerDocument.createElement("label");
        lbl.textContent = "Передан";
        lbl.className = `${msc}-label`;
        row.appendChild(lbl);
        container.appendChild(row);

        const clearTransferControl = () => row.querySelectorAll("[data-pf-transfer-doctor], [data-pf-transfer-add-doctor]").forEach(node => node.remove());
        const renderSelect = () => {
            clearTransferControl();
            const sel = modal.ownerDocument.createElement("select");
            sel.className = `${msc}-select`;
            sel.setAttribute("data-pf-transfer-doctor", "1");
            const curVal = normalizeTransferDoctor(getVal("Передан"));
            const defOpt = modal.ownerDocument.createElement("option");
            defOpt.textContent = "— не передан —";
            defOpt.value = "";
            sel.appendChild(defOpt);
            sortTransferDoctors(curVal ? [...transferDoctors, curVal] : transferDoctors).forEach(name => {
                const opt = modal.ownerDocument.createElement("option");
                opt.textContent = name;
                opt.value = name;
                if (curVal === name) opt.selected = true;
                sel.appendChild(opt);
            });
            const addOpt = modal.ownerDocument.createElement("option");
            addOpt.textContent = "+ Добавить врача";
            addOpt.value = TRANSFER_ADD_DOCTOR_VALUE;
            sel.appendChild(addOpt);
            sel.onchange = async () => {
                if (sel.value === TRANSFER_ADD_DOCTOR_VALUE) {
                    renderInput();
                    return;
                }
                const doctor = normalizeTransferDoctor(sel.value);
                setPending("Передан", doctor || null);
                await saveNow({ "Передан": doctor || null });
            };
            row.appendChild(sel);
        };
        const renderInput = () => {
            clearTransferControl();
            const input = modal.ownerDocument.createElement("input");
            input.type = "text";
            input.className = `${msc}-input`;
            input.placeholder = "Фамилия И.О.";
            input.setAttribute("data-pf-transfer-add-doctor", "1");
            const commit = async () => {
                const doctor = ensureTransferDoctor(input.value);
                setPending("Передан", doctor || null);
                await saveNow({ "Передан": doctor || null });
                renderSelect();
            };
            input.onchange = commit;
            input.onkeydown = (event) => {
                if (event.key === "Enter") { event.preventDefault(); void commit(); }
                if (event.key === "Escape") renderSelect();
            };
            row.appendChild(input);
            input.focus();
        };
        renderSelect();
    };
    renderTransferDoctorField(c1);

    const rerenderForm = () => setTimeout(() => buildForm(), 0);

    const _admSId = 'pf-adm-row-style';
    let _st = modal.ownerDocument.getElementById(_admSId);
    if (!_st) { _st = modal.ownerDocument.createElement('style'); _st.id = _admSId; modal.ownerDocument.head.appendChild(_st); }
    _st.textContent = `
        .pf-adm-row{display:flex;gap:16px;align-items:stretch;margin-bottom:8px;}
        .pf-adm-row [class$="-field-row"]{margin-bottom:0 !important;}
        .pf-field-vmp{flex:2.5;min-width:0;box-sizing:border-box;}
        .pf-field-vmp [class$="-select"]{font-size:12px;padding:0 6px;}
        .pf-seg-wrap{flex:3.5;min-width:0;box-sizing:border-box;}
        .pf-seg{display:flex;width:100%;}
        .pf-seg-btn{flex:1;border:1px solid var(--background-modifier-border);background:var(--background-primary);height:40px;font-size:13px;font-weight:700;padding:0 12px;cursor:pointer;transition:all .2s ease;color:var(--text-muted);white-space:nowrap;display:flex;align-items:center;justify-content:center;gap:6px;}
        .pf-seg-btn:first-child{border-radius:8px 0 0 8px;border-right:none;}
        .pf-seg-btn:last-child{border-radius:0 8px 8px 0;border-left:none;}
        .pf-seg-btn:hover{background:var(--background-modifier-hover);}
        .pf-seg-btn.ds-on{background:rgba(76,175,80,0.13);color:#4caf50;border-color:#4caf5060;}
        .pf-seg-btn.ks-on{background:rgba(244,67,54,0.13);color:#f44336;border-color:#f4433660;}
        .pf-seg-btn svg{width:16px;height:16px;flex-shrink:0;}
        .pf-seg-btn span{line-height:1;}
        .pf-field-toggle-inline{min-width:0;box-sizing:border-box;}
        .pf-adm-row .pf-field-toggle-inline{flex:4;}
        .pf-field-toggle-inline [class$="-field-row"]{margin-bottom:0 !important;}
        .pf-adm-sub{display:flex;gap:16px;margin-bottom:12px;}
        .pf-adm-sub [class$="-field-row"]{margin-bottom:0 !important;}
        .pf-adm-sub .pf-field-toggle-inline{flex:1;}
        .pf-eln-date-inline{flex:1;min-width:0;box-sizing:border-box;}
        .pf-eln-date-inline [class$="-field-row"]{margin-bottom:0 !important;}
    `;

    const topAdminRow = modal.ownerDocument.createElement("div");
    topAdminRow.className = "pf-adm-row";

    // Группа ВМП (компактная)
    const vmpWrap = modal.ownerDocument.createElement("div"); vmpWrap.className = "pf-field-vmp";
    field(vmpWrap, "Группа ВМП", "Группа ВМП", "select", { opts: ["Группа 25 (200)", "Группа 26 (200)", "Группа 27 (200)", "МЭС 300", "ОМС", "ПМУ", "ДМС"] });
    topAdminRow.appendChild(vmpWrap);

    // Сегментированный контрол ДС / КС
    const hasDs = ls._tagsMap?.has('дс') || false;
    const hasKs = ls._tagsMap?.has('кс') || false;
    const statState = hasDs ? 'ДС' : (hasKs ? 'КС' : null);
    const segOuter = modal.ownerDocument.createElement('div'); segOuter.className = "pf-seg-wrap";
    const segFieldRow = modal.ownerDocument.createElement('div'); segFieldRow.className = `${msc}-field-row`;
    const segLbl = modal.ownerDocument.createElement('label'); segLbl.innerHTML = "&nbsp;"; segLbl.className = `${msc}-label`;
    segFieldRow.appendChild(segLbl);
    const sWrap = modal.ownerDocument.createElement('div'); sWrap.className = "pf-seg";
    const bDs = modal.ownerDocument.createElement('button'); bDs.title = "Дневной стационар";
    bDs.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg><span>ДС</span>`;
    bDs.className = "pf-seg-btn" + (statState==='ДС' ? " ds-on" : "");
    const bKs = modal.ownerDocument.createElement('button'); bKs.title = "Круглосуточный стационар";
    bKs.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg><span>КС</span>`;
    bKs.className = "pf-seg-btn" + (statState==='КС' ? " ks-on" : "");
    bDs.onclick = () => {
        if (ls._tagsMap) {
            ls._tagsMap.delete('дс');
            ls._tagsMap.delete('кс');
            if (statState !== 'ДС') ls._tagsMap.set('дс', 'ДС');
            const nextStationState = statState !== 'ДС' ? 'ДС' : null;
            setPending("tags", [...ls._tagsMap.values()]);
            setPending("КС", statState!=='ДС' ? 'ДС' : null);
            if (nextStationState !== "КС") setPending("Палата", null);
            rerenderForm();
        }
    };
    bKs.onclick = () => {
        if (ls._tagsMap) {
            ls._tagsMap.delete('дс');
            ls._tagsMap.delete('кс');
            if (statState !== 'КС') ls._tagsMap.set('кс', 'КС');
            const nextStationState = statState !== 'КС' ? 'КС' : null;
            setPending("tags", [...ls._tagsMap.values()]);
            setPending("КС", statState!=='КС' ? 'КС' : null);
            if (nextStationState !== "КС") setPending("Палата", null);
            rerenderForm();
        }
    };
    sWrap.appendChild(bDs); sWrap.appendChild(bKs);
    segFieldRow.appendChild(sWrap);
    segOuter.appendChild(segFieldRow);
    topAdminRow.appendChild(segOuter);

    // Больничный (на той же строке)
    const elnWrap = modal.ownerDocument.createElement("div"); elnWrap.className = "pf-field-toggle-inline";
    field(elnWrap, "Больничный", "Больничный_лист", "toggle", { 
        onChange: (isOn) => { if(!isOn) saveNow({ "Открытый_ЭЛН": null, "Открытый_ЭЛН_активен": false }); rerenderForm(); } 
    });
    topAdminRow.appendChild(elnWrap);
    c1.appendChild(topAdminRow);

    if (statState === 'КС') {
        const roomSubRow = modal.ownerDocument.createElement("div");
        roomSubRow.className = "pf-adm-sub";
        const roomWrap = modal.ownerDocument.createElement("div");
        roomWrap.className = "pf-field-toggle-inline";
        field(roomWrap, "Палата", "Палата", "text");
        roomWrap.querySelector("input")?.setAttribute("data-pf-inpatient-room", "1");
        roomSubRow.appendChild(roomWrap);
        c1.appendChild(roomSubRow);
    }

    // ЭЛН — подстрока (только если Больничный включён)
    if (getVal("Больничный_лист") === true) {
        const elnSubRow = modal.ownerDocument.createElement("div");
        elnSubRow.className = "pf-adm-sub";

        const openedElnWrap = modal.ownerDocument.createElement("div"); openedElnWrap.className = "pf-field-toggle-inline";
        field(openedElnWrap, "ЭЛН открыт", "Открытый_ЭЛН_активен", "toggle", {
            onChange: (isOn) => { if(!isOn) saveNow({"Открытый_ЭЛН": null}); rerenderForm(); }
        });
        elnSubRow.appendChild(openedElnWrap);
        
        if (getVal("Открытый_ЭЛН_активен") === true) {
            const dateWrap = modal.ownerDocument.createElement("div"); dateWrap.className = "pf-eln-date-inline";
            field(dateWrap, "Дата ЭЛН", "Открытый_ЭЛН", "date");
            elnSubRow.appendChild(dateWrap);
        }
        c1.appendChild(elnSubRow);
    }

    const c2 = modal.ownerDocument.createElement("div");
    const c2title = modal.ownerDocument.createElement("div");
    c2title.textContent = "Лечение"; c2title.className = `${msc}-sec-title`; c2title.id = "pf0-sec-treatment";
    c2.appendChild(c2title);
    // Дата начала лечения
    field(c2, "Дата консультации", "Дата_консультации", "datetime", { dpOpts: { step: 30, minTime: "08:00", maxTime: "16:00" } });
    field(c2, "Дата разметки", "Дата_разметки", "datetime", { dpOpts: { step: 15, minTime: "08:00", maxTime: "20:00" } });
    field(c2, "Дата начала лечения", "Дата_начала_лечения", "date");
    field(c2, "Цель лечения", "Цель_лечения", "select", { opts: ["Радикальный курс", "Послеоперационный курс", "Предоперационный курс", "Паллиативный курс", "Консолидирующий курс", "Гемостатический курс", "Сальважный курс"] });

    // ── ОБЩИЕ СТИЛИ для карточек разделов (переразметка / ХЛТ / препараты) ──────
    const _SEC_INP = "width:100%;height:32px;border-radius:6px;border:1px solid var(--background-modifier-border);background:var(--background-primary);color:var(--text-normal);padding:0 8px;font-size:13px;outline:none;transition:border-color 0.15s;box-sizing:border-box;";
    const _SEC_LBL = "font-size:11px;color:var(--text-muted);font-weight:600;margin-bottom:2px;display:block;";
    const _SEC_DEL = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;

    // Хелпер: кнопка "+ Название" (добавляет себя в DOM, удаляет себя при клике)
    const _mkAddBtn = (text, color, renderFn) => {
        const btn = modal.ownerDocument.createElement("button");
        btn.textContent = text;
        btn.style.cssText = `width:100%;padding:9px 14px;background:var(--background-primary);border:1px solid var(--background-modifier-border);border-radius:8px;color:var(--text-muted);cursor:pointer;font-size:13px;font-weight:600;transition:all 0.2s;box-sizing:border-box;margin-bottom:8px;text-align:left;`;
        btn.onmouseenter = () => { btn.style.borderColor=color; btn.style.color=color; btn.style.background=`${color}0f`; btn.style.boxShadow=`0 0 0 3px ${color}14`; };
        btn.onmouseleave = () => { btn.style.borderColor="var(--background-modifier-border)"; btn.style.color="var(--text-muted)"; btn.style.background="var(--background-primary)"; btn.style.boxShadow="none"; };
        btn.onclick = () => { btn.remove(); renderFn(); };
        return btn;
    };

    // Хелпер: карточка-запись с цветной полоской
    const _mkEntryCard = (accentColor) => {
        const card = modal.ownerDocument.createElement("div");
        card.style.cssText = `padding:10px;background:var(--background-primary);border:1px solid var(--background-modifier-border);border-left:3px solid ${accentColor};border-radius:8px;display:flex;flex-direction:column;gap:8px;`;
        return card;
    };

    // Хелпер: поле с подписью сверху. onDelete — опционально, добавляет × справа от подписи
    const _mkField = (labelText, el, onDelete) => {
        const wrap = modal.ownerDocument.createElement("div");
        if (onDelete) {
            const header = modal.ownerDocument.createElement("div");
            header.style.cssText = "display:flex;align-items:center;justify-content:space-between;margin-bottom:2px;";
            const lbl = modal.ownerDocument.createElement("span");
            lbl.textContent = labelText; lbl.style.cssText = _SEC_LBL + "margin-bottom:0;";
            const delBtn = modal.ownerDocument.createElement("button");
            delBtn.innerHTML = _SEC_DEL;
            delBtn.style.cssText = "width:20px;height:20px;background:transparent;border:none;color:var(--text-faint);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:color 0.15s;flex-shrink:0;padding:0;";
            delBtn.onmouseenter = () => delBtn.style.color = "#e53935";
            delBtn.onmouseleave = () => delBtn.style.color = "var(--text-faint)";
            delBtn.onclick = onDelete;
            header.appendChild(lbl); header.appendChild(delBtn);
            wrap.appendChild(header);
        } else {
            const lbl = modal.ownerDocument.createElement("span");
            lbl.textContent = labelText; lbl.style.cssText = _SEC_LBL;
            wrap.appendChild(lbl);
        }
        wrap.appendChild(el);
        return wrap;
    };

    // Хелпер: строка заголовка секции (удаление через × в карточке)
    const _mkSecHeader = (titleText, color) => {
        const row = modal.ownerDocument.createElement("div");
        row.style.cssText = `display:flex;align-items:center;margin-bottom:6px;margin-top:4px;padding-bottom:6px;border-bottom:2px solid ${color}30;`;
        const span = modal.ownerDocument.createElement("span");
        span.textContent = titleText;
        span.style.cssText = `font-size:13px;font-weight:700;color:${color};`;
        row.appendChild(span);
        return row;
    };

    // Хелпер: поле даты/datetime в едином стиле с остальными полями редактора
    const _mkDateField = (container, labelText, initISO, isDateTime, onChangeFn) => {
        const row = modal.ownerDocument.createElement("div");
        row.className = `${msc}-field-row`;
        const lbl = modal.ownerDocument.createElement("label");
        lbl.textContent = labelText; lbl.className = `${msc}-label`;
        row.appendChild(lbl);
        container.appendChild(row);
        const _picker = makeDatePicker(row, initISO, "width:100%;max-width:100%;", isDateTime);
        _picker.onchange = () => { onChangeFn(_picker.value || null); };
    };
    const _isHospitalized = getVal("Госпитализация") === true
        || getStoredVal("Госпитализация") === true
        || (window['pf_status_' + cur.file.path] || {}).Госпитализация === true;
    if (_isHospitalized) {
        const _rmkRaw = (() => {
            const r = getVal("Переразметки");
            if (Array.isArray(r) && r.length > 0) return r.filter(Boolean);
            const od = getVal("Дата_переразметки");
            if (od) return [{ Дата: od, Переразметка: getVal("Переразметка") === true, Переоконтуривание: getVal("Переоконтуривание") === true, Старт_нового_плана: "" }];
            return [];
        })();

        const saveRemarks = () => {
            const entries = Array.from(rmkList.querySelectorAll(".rmk-entry")).map(card => ({
                Дата: card.dataset.rmkDate || "",
                Переразметка: card.dataset.replan === "true",
                Переоконтуривание: card.dataset.recontour === "true",
                Старт_нового_плана: card.dataset.rmkStart || ""
            })).filter(e => e.Дата);
            saveNow({ Переразметки: entries.length ? entries : [] });
        };

        // Якорь — кнопка «+ Переразметка» или секция с карточками
        const _rmkAnchor = modal.ownerDocument.createElement("div");
        c2.appendChild(_rmkAnchor);

        const rmkList = modal.ownerDocument.createElement("div");
        rmkList.style.cssText = "display:flex;flex-direction:column;gap:8px;margin-bottom:8px;";

        const collapseRmk = () => {
            rmkList.innerHTML = "";
            _rmkAnchor.innerHTML = "";
            _rmkAnchor.appendChild(_mkAddBtn("+ Переразметка", "#3f51b5", () => { expandRmk({}); }));
        };

        const expandRmk = (firstEntry) => {
            _rmkAnchor.innerHTML = "";
            const rmkSection = modal.ownerDocument.createElement("div");
            rmkSection.className = "rmk-section";
            rmkSection.appendChild(_mkSecHeader("🔁 Переразметка", "#3f51b5"));
            rmkSection.appendChild(rmkList);
            rmkSection.appendChild(_mkAddBtn("+ Добавить переразметку", "#3f51b5", () => addRemarkEntry({})));
            _rmkAnchor.appendChild(rmkSection);
            if (firstEntry !== null) addRemarkEntry(firstEntry);
        };

        const addRemarkEntry = (entry = {}) => {
            const card = _mkEntryCard("#3f51b5");
            card.className = "rmk-entry";
            card.dataset.replan = String(entry.Переразметка === true);
            card.dataset.recontour = String(entry.Переоконтуривание === true);

            const cardHdr = modal.ownerDocument.createElement("div");
            cardHdr.style.cssText = "display:flex;align-items:center;justify-content:space-between;margin-bottom:2px;";
            const cardLbl = modal.ownerDocument.createElement("span");
            cardLbl.textContent = "Дата переразметки";
            cardLbl.style.cssText = _SEC_LBL + "margin-bottom:0;";
            const delCardBtn = modal.ownerDocument.createElement("button");
            delCardBtn.innerHTML = _SEC_DEL;
            delCardBtn.style.cssText = "width:20px;height:20px;background:transparent;border:none;color:var(--text-faint);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:color 0.15s;flex-shrink:0;padding:0;";
            delCardBtn.onmouseenter = () => { delCardBtn.style.color = "#e53935"; };
            delCardBtn.onmouseleave = () => { delCardBtn.style.color = "var(--text-faint)"; };
            delCardBtn.onclick = () => {
                card.remove();
                saveRemarks();
                if (rmkList.querySelectorAll(".rmk-entry").length === 0) collapseRmk();
            };
            cardHdr.appendChild(cardLbl);
            cardHdr.appendChild(delCardBtn);
            card.appendChild(cardHdr);

            let _dateISO = "";
            if (entry.Дата) { try { const d = dv.date(entry.Дата); if (d) _dateISO = d.toFormat("yyyy-MM-dd'T'HH:mm"); } catch(e) {} }
            const _dateRow = modal.ownerDocument.createElement("div");
            _dateRow.className = `${msc}-field-row`;
            card.appendChild(_dateRow);
            const _datePicker = makeDatePicker(_dateRow, _dateISO, "width:100%;max-width:100%;", true);
            _datePicker.onchange = () => { card.dataset.rmkDate = _datePicker.value || ""; saveRemarks(); };
            card.dataset.rmkDate = _dateISO;

            let _startISO = "";
            if (entry.Старт_нового_плана) { try { const d = dv.date(entry.Старт_нового_плана); if (d) _startISO = d.toFormat("yyyy-MM-dd"); } catch(e) {} }
            _mkDateField(card, "Старт нового плана", _startISO, false, (val) => {
                card.dataset.rmkStart = val || "";
                saveRemarks();
            });
            card.dataset.rmkStart = _startISO;

            rmkList.appendChild(card);
        };

        if (_rmkRaw.length > 0) {
            // Есть существующие записи — сразу открываем секцию
            expandRmk(null);
            _rmkRaw.forEach(e => addRemarkEntry(e));
        } else {
            // Нет записей — показываем только кнопку
            collapseRmk();
        }
    }

    // ── ЯКОРЯ для фиксации порядка (ХЛТ всегда перед назначениями Л/С) ─────────
    const MEDS_SECTION_LABEL = "Лекарственные препараты";
    const medsSectionTitle = modal.ownerDocument.createElement("div");
    medsSectionTitle.style.cssText = "margin:10px 0 6px 0;font-size:13px;font-weight:700;color:var(--text-normal);";
    medsSectionTitle.textContent = `💊 ${MEDS_SECTION_LABEL}`;
    c2.appendChild(medsSectionTitle);

    const _hltAnchor = modal.ownerDocument.createElement("div");
    const _medsAnchor = modal.ownerDocument.createElement("div");
    c2.appendChild(_hltAnchor);
    c2.appendChild(_medsAnchor);

    // Кнопка внутри секции — НЕ удаляет себя при клике
    const _mkInlineBtn = (text, color, onClick) => {
        const btn = modal.ownerDocument.createElement("button");
        btn.textContent = text;
        btn.style.cssText = `width:100%;padding:7px 14px;background:var(--background-primary);border:1px solid var(--background-modifier-border);border-radius:8px;color:var(--text-muted);cursor:pointer;font-size:12px;font-weight:600;transition:all 0.2s;box-sizing:border-box;margin-bottom:4px;text-align:left;`;
        btn.onmouseenter = () => { btn.style.borderColor=color; btn.style.color=color; btn.style.background=`${color}0f`; };
        btn.onmouseleave = () => { btn.style.borderColor="var(--background-modifier-border)"; btn.style.color="var(--text-muted)"; btn.style.background="var(--background-primary)"; };
        btn.onclick = onClick;
        return btn;
    };

    // ── ХЛТ ───────────────────────────────────────────────────────────────────
    const HLT_REGIMES = ["Однократно", "Ежедневно", "Еженедельно", "Раз в 14 дней", "Раз в 21 день", "В дни лучевой терапии"];
    const hltDrugs = (() => {
        const raw = getVal("ХЛТ_препараты");
        return Array.isArray(raw) ? raw.filter(Boolean) : [];
    })();
    const hltHasData = hltDrugs.length > 0;

    // Дефолтная дата = дата начала лечения
    const _defaultHltDateISO = (() => {
        const raw = getVal("ХЛТ_дата_старта") || getVal("Дата_начала_лечения");
        if (!raw) return "";
        try { const d = dv.date(raw); return d ? d.toFormat("yyyy-MM-dd") : ""; } catch(e) { return ""; }
    })();

    if (!hltHasData) {
        _hltAnchor.appendChild(_mkAddBtn("+ Химиотерапия", "#00bcd4", () => renderHltSection([{Препарат: "", Режим: HLT_REGIMES[0], Дата: ""}])));
    } else {
        renderHltSection(hltDrugs);
    }

    function renderHltSection(initialDrugs) {
        _hltAnchor.innerHTML = "";
        const hltWrap = modal.ownerDocument.createElement("div");
        hltWrap.className = "hlt-section";
        _hltAnchor.appendChild(hltWrap);

        const collapseHlt = async () => {
            await saveNow({ "ХЛТ_препараты": null, "ХЛТ_дата_старта": null, "Перерыв_ХЛТ": null, "ХЛТ_ручные_даты": null, "Пропущенные_даты_ХЛТ": null });
            _hltAnchor.innerHTML = "";
            _hltAnchor.appendChild(_mkAddBtn("+ Химиотерапия", "#00bcd4", () => renderHltSection([{Препарат: "", Режим: HLT_REGIMES[0], Дата: ""}])));
        };

        const hltHeader = _mkSecHeader("💉 Химиотерапия", "#00bcd4");
        hltWrap.appendChild(hltHeader);

        const drugList = modal.ownerDocument.createElement("div");
        drugList.style.cssText = "display:flex;flex-direction:column;gap:8px;margin-bottom:8px;";

        const getDrugsFromDOM = () =>
            Array.from(drugList.querySelectorAll(".hlt-drug-row")).map(card => ({
                Препарат: card.querySelector(".hlt-drug-name")?.value?.trim() ?? "",
                Режим:    card.querySelector(".hlt-drug-regime")?.value ?? "",
                Дата:     card.dataset.hltDate || ""
            })).filter(d => d.Препарат || d.Режим);

        const saveDrugs = () => saveNow({ "ХЛТ_препараты": getDrugsFromDOM() });

        const addDrugBtn = _mkInlineBtn("+ Добавить препарат", "#00bcd4", () => {
            if (drugList.querySelectorAll(".hlt-drug-row").length >= 2) return;
            addDrugRow("", HLT_REGIMES[0], "");
            addDrugBtn.style.display = drugList.querySelectorAll(".hlt-drug-row").length >= 2 ? "none" : "";
        });

        const addDrugRow = (препарат = "", режим = "", датаStr = "") => {
            if (drugList.querySelectorAll(".hlt-drug-row").length >= 2) return;
            const card = _mkEntryCard("#00bcd4");
            card.className = "hlt-drug-row";

            const nameInp = modal.ownerDocument.createElement("input");
            nameInp.type = "text";
            nameInp.value = препарат; nameInp.placeholder = "Наименование препарата";
            nameInp.className = "hlt-drug-name";
            nameInp.style.cssText = _SEC_INP;
            nameInp.onfocus = () => nameInp.style.borderColor = "var(--interactive-accent)";
            nameInp.onblur  = () => { nameInp.style.borderColor = "var(--background-modifier-border)"; saveDrugs(); };
            nameInp.oninput = () => saveDrugs();
            card.appendChild(_mkField("Препарат", nameInp, () => {
                card.remove(); saveDrugs();
                addDrugBtn.style.display = "";
                if (drugList.querySelectorAll(".hlt-drug-row").length === 0) collapseHlt();
            }));

            const regSel = modal.ownerDocument.createElement("select");
            regSel.className = "hlt-drug-regime";
            regSel.style.cssText = _SEC_INP + "height:34px;cursor:pointer;";
            regSel.onfocus = () => regSel.style.borderColor = "var(--interactive-accent)";
            regSel.onblur  = () => regSel.style.borderColor = "var(--background-modifier-border)";
            HLT_REGIMES.forEach(r => {
                const opt = modal.ownerDocument.createElement("option");
                opt.textContent = r; opt.value = r;
                if (r === режим) opt.selected = true;
                regSel.appendChild(opt);
            });
            regSel.onchange = saveDrugs;
            card.appendChild(_mkField("Режим", regSel));

            // Дата начала — внутри карточки под режимом; дефолт = дата начала лечения
            const initISO = (() => {
                if (датаStr) { try { const d = dv.date(датаStr); if (d) return d.toFormat("yyyy-MM-dd"); } catch(e) {} }
                return _defaultHltDateISO;
            })();
            card.dataset.hltDate = initISO;
            _mkDateField(card, "Дата начала", initISO, false, (val) => {
                card.dataset.hltDate = val || "";
                saveDrugs();
            });

            drugList.appendChild(card);
            addDrugBtn.style.display = drugList.querySelectorAll(".hlt-drug-row").length >= 2 ? "none" : "";
        };

        initialDrugs.forEach(d => addDrugRow(d.Препарат ?? "", d.Режим ?? "", d.Дата ?? ""));
        hltWrap.appendChild(drugList);

        // ── Перерывы в ХЛТ ─────────────────────────────────────────────────
        const _brkWrap = modal.ownerDocument.createElement("div");
        _brkWrap.style.cssText = "margin-bottom:8px; display:flex; flex-direction:column; gap:6px;";
        const _renderBreak = () => {
            _brkWrap.innerHTML = "";
            const raw = getVal("Перерыв_ХЛТ");
            const _brkList = Array.isArray(raw) ? raw : (raw ? [raw] : []);

            const saveBreaks = (newList) => {
                saveNow({ "Перерыв_ХЛТ": newList.length ? newList : null });
                _renderBreak();
            };

            _brkList.forEach((brk, idx) => {
                const _brkCard = _mkEntryCard("#00bcd4");
                _brkCard.style.borderLeft = "3px solid #9e9e9e";
                const _brkHdr = modal.ownerDocument.createElement("div");
                _brkHdr.style.cssText = "display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;";
                const _brkLbl = modal.ownerDocument.createElement("span");
                _brkLbl.textContent = `⏸ Перерыв ${idx + 1}`;
                _brkLbl.style.cssText = "font-size:11px;color:var(--text-muted);font-weight:600;";
                const _brkDel = modal.ownerDocument.createElement("button");
                _brkDel.textContent = "× Удалить";
                _brkDel.style.cssText = "font-size:11px;color:#e53935;background:none;border:none;cursor:pointer;font-weight:600;padding:2px 6px;border-radius:4px;";
                _brkDel.onmouseenter = () => _brkDel.style.background = "rgba(229,57,53,0.1)";
                _brkDel.onmouseleave = () => _brkDel.style.background = "none";
                _brkDel.onclick = () => {
                    const newList = [..._brkList];
                    newList.splice(idx, 1);
                    saveBreaks(newList);
                };
                _brkHdr.appendChild(_brkLbl); _brkHdr.appendChild(_brkDel);
                _brkCard.appendChild(_brkHdr);

                let _bkStartISO = "";
                try { const d = dv.date(brk.Дата_начала); if (d) _bkStartISO = d.toFormat("yyyy-MM-dd"); } catch(e) {}
                _mkDateField(_brkCard, "Начало", _bkStartISO, false, (val) => {
                    const newList = [..._brkList];
                    newList[idx] = { ...newList[idx], Дата_начала: val || "" };
                    saveNow({ "Перерыв_ХЛТ": newList });
                });

                let _bkEndISO = "";
                try { const d = dv.date(brk.Дата_окончания); if (d) _bkEndISO = d.toFormat("yyyy-MM-dd"); } catch(e) {}
                _mkDateField(_brkCard, "Окончание", _bkEndISO, false, (val) => {
                    const newList = [..._brkList];
                    newList[idx] = { ...newList[idx], Дата_окончания: val || "" };
                    saveNow({ "Перерыв_ХЛТ": newList });
                });

                _brkWrap.appendChild(_brkCard);
            });

            _brkWrap.appendChild(_mkInlineBtn("+ Перерыв", "#9e9e9e", () => {
                saveBreaks([..._brkList, { Дата_начала: "", Дата_окончания: "" }]);
            }));
        };
        _renderBreak();
        hltWrap.appendChild(_brkWrap);

        hltWrap.appendChild(addDrugBtn);
        if (initialDrugs.length >= 2) addDrugBtn.style.display = "none";
    }

    // ── НАЗНАЧЕНИЕ Л/С ─────────────────────────────────────────────────────────
    const LS_COLOR = "#7b61ff";
    const LS_DURATIONS = ["Весь период лечения", "1 день", "2 дня", "3 дня", "4 дня", "5 дней", "6 дней", "7 дней", "10 дней", "14 дней", "21 день", "28 дней", "30 дней", "60 дней", "90 дней"];
    const lsRaw = (() => {
        const tmp = {
            ЛС_назначения: getVal("ЛС_назначения"),
            Лекарственные_препараты: getVal("Лекарственные_препараты")
        };
        return normalizeLsAssignments(tmp);
    })();

    if (lsRaw.length === 0) {
        _medsAnchor.appendChild(_mkAddBtn("+ Назначение Л/С", LS_COLOR, () => renderLsSection([{ Препарат: "", Дозировка: "", Срок: "весь_курс", Дней: null, Дата_старта: "" }])));
    } else {
        renderLsSection(lsRaw);
    }

    function renderLsSection(initialLs) {
        _medsAnchor.innerHTML = "";
        const medsWrap = modal.ownerDocument.createElement("div");
        medsWrap.className = "meds-section";
        _medsAnchor.appendChild(medsWrap);

        const collapseLs = async () => {
            await saveNow({ "ЛС_назначения": [], "Лекарственные_препараты": [] });
            _medsAnchor.innerHTML = "";
            _medsAnchor.appendChild(_mkAddBtn("+ Назначение Л/С", LS_COLOR, () => renderLsSection([{ Препарат: "", Дозировка: "", Срок: "весь_курс", Дней: null, Дата_старта: "" }])));
        };

        const medsHeader = _mkSecHeader("💊 Назначение Л/С", LS_COLOR);
        medsWrap.appendChild(medsHeader);

        const medList = modal.ownerDocument.createElement("div");
        medList.style.cssText = "display:flex;flex-direction:column;gap:8px;margin-bottom:8px;";

        const toLegacyLs = (items) => (items || []).map(e => ({
            Препарат: e.Препарат || "",
            Дозировка: e.Дозировка || "",
            Срок: toLsUiDuration(e.Срок, e.Дней),
            Дата_начала: e.Дата_старта || ""
        }));

        const getLsFromDOM = () =>
            dedupLsAssignments(Array.from(medList.querySelectorAll(".med-entry")).map(card => {
                const prep = card.querySelector(".med-name")?.value?.trim() ?? "";
                const dose = card.querySelector(".med-dose")?.value?.trim() ?? "";
                const durUi = card.querySelector(".med-duration")?.value ?? LS_DURATIONS[0];
                const t = toLsTerm(durUi);
                return {
                    Препарат: prep,
                    Дозировка: dose,
                    Срок: t.Срок,
                    Дней: t.Дней,
                    Дата_старта: card.dataset.medDate || ""
                };
            }).filter(e => e.Препарат));

        const saveLs = () => {
            const lsItems = getLsFromDOM();
            return saveNow({ "ЛС_назначения": lsItems, "Лекарственные_препараты": toLegacyLs(lsItems) });
        };

        const addMedBtn = _mkInlineBtn("+ Добавить назначение", LS_COLOR, () => addMedRow({}));

        const addMedRow = (entry = {}) => {
            const card = _mkEntryCard(LS_COLOR);
            card.className = "med-entry";
            
            // Заголовок карточки
            const hdr = modal.ownerDocument.createElement("div");
            hdr.style.cssText = "display:flex; justify-content:space-between; margin-bottom:6px;";
            const lbl = modal.ownerDocument.createElement("span");
            lbl.textContent = "Назначение"; lbl.style.cssText = "font-size:11px;color:var(--text-muted);font-weight:600;";
            const delBtn = modal.ownerDocument.createElement("button");
            delBtn.textContent = "× Удалить";
            delBtn.style.cssText = "font-size:11px;color:#e53935;background:none;border:none;cursor:pointer;font-weight:600;padding:2px 6px;border-radius:4px;";
            delBtn.onmouseenter = () => delBtn.style.background = "rgba(229,57,53,0.1)";
            delBtn.onmouseleave = () => delBtn.style.background = "none";
            delBtn.onclick = () => { card.remove(); saveLs(); if (medList.querySelectorAll(".med-entry").length === 0) collapseLs(); };
            hdr.appendChild(lbl); hdr.appendChild(delBtn);
            card.appendChild(hdr);

            // Сетка инпутов
            const grid = modal.ownerDocument.createElement("div");
            grid.style.cssText = "display:grid; grid-template-columns: 1fr 1fr; gap:6px;";

            const createCol = (comp) => { const div = modal.ownerDocument.createElement("div"); div.appendChild(comp); return div; };

            const nameInp = modal.ownerDocument.createElement("input");
            nameInp.type = "text"; nameInp.className = "med-name";
            nameInp.value = entry.Препарат ?? ""; nameInp.placeholder = "Препарат";
            nameInp.style.cssText = _SEC_INP + "margin-top:0;height:34px;";
            nameInp.onfocus = () => nameInp.style.borderColor = "var(--interactive-accent)";
            nameInp.onblur  = () => { nameInp.style.borderColor = "var(--background-modifier-border)"; saveLs(); };
            nameInp.oninput = () => saveLs();
            grid.appendChild(createCol(nameInp));

            const doseInp = modal.ownerDocument.createElement("input");
            doseInp.type = "text"; doseInp.className = "med-dose";
            doseInp.value = entry.Дозировка ?? ""; doseInp.placeholder = "Дозировка";
            doseInp.style.cssText = _SEC_INP + "margin-top:0;height:34px;";
            doseInp.onfocus = () => doseInp.style.borderColor = "var(--interactive-accent)";
            doseInp.onblur  = () => { doseInp.style.borderColor = "var(--background-modifier-border)"; saveLs(); };
            doseInp.oninput = () => saveLs();
            grid.appendChild(createCol(doseInp));

            const durSel = modal.ownerDocument.createElement("select");
            durSel.className = "med-duration";
            durSel.style.cssText = _SEC_INP + "height:34px;cursor:pointer;margin-top:0;";
            durSel.onfocus = () => durSel.style.borderColor = "var(--interactive-accent)";
            durSel.onblur  = () => durSel.style.borderColor = "var(--background-modifier-border)";
            const selectedDur = toLsUiDuration(entry.Срок, entry.Дней);
            LS_DURATIONS.forEach(v => {
                const opt = modal.ownerDocument.createElement("option");
                opt.textContent = v; opt.value = v;
                if (v === selectedDur) opt.selected = true;
                durSel.appendChild(opt);
            });
            durSel.onchange = saveLs;
            grid.appendChild(createCol(durSel));

            let _medDateISO = "";
            if (entry.Дата_старта) { try { const d = dv.date(entry.Дата_старта); if (d) _medDateISO = d.toFormat("yyyy-MM-dd"); } catch(e) {} }
            card.dataset.medDate = _medDateISO;
            const dateInp = modal.ownerDocument.createElement("input");
            dateInp.type = "date";
            dateInp.value = _medDateISO;
            dateInp.style.cssText = _SEC_INP + "height:34px;cursor:pointer;margin-top:0;";
            if (!_medDateISO) dateInp.style.color = "var(--text-faint)";
            dateInp.onchange = () => { dateInp.style.color = dateInp.value ? "var(--text-normal)" : "var(--text-faint)"; card.dataset.medDate = dateInp.value || ""; saveLs(); };
            dateInp.onfocus = () => dateInp.style.borderColor = "var(--interactive-accent)";
            dateInp.onblur  = () => dateInp.style.borderColor = "var(--background-modifier-border)";
            grid.appendChild(createCol(dateInp));

            card.appendChild(grid);
            medList.appendChild(card);
        };

        initialLs.forEach(e => addMedRow(e));
        medsWrap.appendChild(medList);
        medsWrap.appendChild(addMedBtn);
    }

    grid.appendChild(c1);
    grid.appendChild(c2);

    // (Анамнез и Лабораторные перенесены под Теги в объединенную панель)

    // ── СЕКЦИЯ: ОБЪЁМЫ (PTV) ──────────────────────────────────────────────────
    const volSec = modal.ownerDocument.createElement("div");
    const volSecTitle = modal.ownerDocument.createElement("div");
    volSecTitle.textContent = "Объёмы (PTV)"; volSecTitle.className = `${msc}-sec-title`;
    volSecTitle.style.marginTop = "16px";
    volSec.appendChild(volSecTitle);
    wrap.appendChild(volSec);

    // ── ШАБЛОНЫ ───────────────────────────────────────────────────────────────
    const TEMPLATES = [
        // ── Рак молочной железы ────────────────────────────────────────────────
        { category: "Рак молочной железы", name: "Рак левой молочной железы", цель: "Послеоперационный курс", теги: ["РМЖ", "Длинный_курс", "ДС"],
          ptv1: { Название: "PTV L", Область_облучения: "Левая молочная железа", РОД: 2.67, Количество_фракций: 15, Фракционирование: "Стандартный" }, extra: [] },
        { category: "Рак молочной железы", name: "Рак правой молочной железы", цель: "Послеоперационный курс", теги: ["РМЖ", "Длинный_курс", "ДС"],
          ptv1: { Название: "PTV R", Область_облучения: "Правая молочная железа", РОД: 2.67, Количество_фракций: 15, Фракционирование: "Стандартный" }, extra: [] },
        { category: "Рак молочной железы", name: "Рак левой молочной железы (Fast forward)", цель: "Послеоперационный курс", теги: ["РМЖ", "Fast_forward", "ДС"],
          ptv1: { Название: "PTV L", Область_облучения: "Левая молочная железа", РОД: 5.2, Количество_фракций: 5, Фракционирование: "Стандартный" }, extra: [] },
        { category: "Рак молочной железы", name: "Рак правой молочной железы (Fast forward)", цель: "Послеоперационный курс", теги: ["РМЖ", "Fast_forward", "ДС"],
          ptv1: { Название: "PTV R", Область_облучения: "Правая молочная железа", РОД: 5.2, Количество_фракций: 5, Фракционирование: "Стандартный" }, extra: [] },
        { category: "Рак молочной железы", name: "Рак левой молочной железы + Л/У", цель: "Послеоперационный курс", теги: ["РМЖ", "Длинный_курс", "ДС"],
          ptv1: { Название: "PTV L", Область_облучения: "Левая молочная железа", РОД: 2.67, Количество_фракций: 15, Фракционирование: "Стандартный" },
          extra: [{ Название: "PTV N", Область_облучения: "Зоны регионарного лимфооттока (аксиллярные, подключичные, надключичные лимфатические узлы)", РОД: 2.67, Количество_фракций: 15, Фракционирование: "Стандартный", Связь: "Параллельно" }] },
        { category: "Рак молочной железы", name: "Рак правой молочной железы + Л/У", цель: "Послеоперационный курс", теги: ["РМЖ", "Длинный_курс", "ДС"],
          ptv1: { Название: "PTV R", Область_облучения: "Правая молочная железа", РОД: 2.67, Количество_фракций: 15, Фракционирование: "Стандартный" },
          extra: [{ Название: "PTV N", Область_облучения: "Зоны регионарного лимфооттока (аксиллярные, подключичные, надключичные лимфатические узлы)", РОД: 2.67, Количество_фракций: 15, Фракционирование: "Стандартный", Связь: "Параллельно" }] },

        // ── Рак предстательной железы ──────────────────────────────────────────
        { category: "Рак предстательной железы", name: "Рак предстательной железы (Длинный курс)", цель: "Радикальный курс", теги: ["РПЖ", "Длинный_курс", "ДС"],
          ptv1: { Название: "PTV 70", Область_облучения: "Предстательная железа, семенные пузырьки", РОД: 2.5, Количество_фракций: 28, Фракционирование: "Стандартный" }, extra: [] },
        { category: "Рак предстательной железы", name: "Рак предстательной железы + Л/У (Длинный курс)", цель: "Радикальный курс", теги: ["РПЖ", "Длинный_курс", "ДС"],
          ptv1: { Название: "PTV 70", Область_облучения: "Предстательная железа, семенные пузырьки", РОД: 2.5, Количество_фракций: 28, Фракционирование: "Стандартный" },
          extra: [{ Название: "PTV 50.4", Область_облучения: "Зоны регионарного лимфооттока (общие, наружные, внутренние подвздошные и запирательные лимфатические узлы)", РОД: 1.8, Количество_фракций: 28, Фракционирование: "Стандартный", Связь: "Параллельно" }] },
        { category: "Рак предстательной железы", name: "Рак предстательной железы (SBRT 4 фракции)", цель: "Радикальный курс", теги: ["РПЖ", "SBRT", "ДС"],
          ptv1: { Название: "PTV", Область_облучения: "Предстательная железа, семенные пузырьки", РОД: 9.0, Количество_фракций: 4, Фракционирование: "Через день" }, extra: [] },
        { category: "Рак предстательной железы", name: "Рак предстательной железы (SBRT 5 фракций)", цель: "Радикальный курс", теги: ["РПЖ", "SBRT", "ДС"],
          ptv1: { Название: "PTV", Область_облучения: "Предстательная железа, семенные пузырьки", РОД: 7.25, Количество_фракций: 5, Фракционирование: "Через день" }, extra: [] },
        { category: "Рак предстательной железы", name: "Рак предстательной железы (SBRT 7 фракций)", цель: "Радикальный курс", теги: ["РПЖ", "SBRT", "ДС"],
          ptv1: { Название: "PTV", Область_облучения: "Предстательная железа, семенные пузырьки", РОД: 6.1, Количество_фракций: 7, Фракционирование: "Через день" }, extra: [] },

        { category: "Рак предстательной железы", name: "Рак предстательной железы, ложе + Л/У (Длинный курс)", цель: "Сальважный курс", теги: ["РПЖ", "Длинный_курс", "ДС"],
          ptv1: { Название: "PTV 64.4", Область_облучения: "Ложе предстательной железы", РОД: 2.3, Количество_фракций: 28, Фракционирование: "Стандартный" },
          extra: [
            { Название: "PTV 70", Область_облучения: "Очаг в ложе предстательной железы", РОД: 2.5, Количество_фракций: 28, Фракционирование: "Стандартный", Связь: "Одновременно" },
            { Название: "PTV 50.4", Область_облучения: "Зоны регионарного лимфооттока (общие, наружные, внутренние подвздошные и запирательные лимфатические узлы)", РОД: 1.8, Количество_фракций: 28, Фракционирование: "Стандартный", Связь: "Параллельно" },
          ] },

        // ── Рак прямой кишки ───────────────────────────────────────────────────
        { category: "Рак прямой кишки", name: "Рак прямой кишки (Короткий курс)", цель: "Предоперационный курс", теги: ["РПК", "ДС"],
          ptv1: { Название: "PTV 25", Область_облучения: "Прямая кишка, мезоректальная клетчатка и зоны регионарного лимфооттока (мезоректальные, пресакральные, внутренние подвздошные лимфатические узлы)", РОД: 5.0, Количество_фракций: 5, Фракционирование: "Стандартный" }, extra: [] },
        { category: "Рак прямой кишки", name: "Рак прямой кишки (Длинный курс, ХЛТ)", цель: "Предоперационный курс", теги: ["РПК", "Длинный_курс", "ХЛТ", "ДС"],
          ptv1: { Название: "PTV 50", Область_облучения: "Прямая кишка, мезоректальная клетчатка", РОД: 2.0, Количество_фракций: 25, Фракционирование: "Стандартный" },
          extra: [{ Название: "PTV 45", Область_облучения: "Зоны регионарного лимфооттока (мезоректальные, пресакральные, внутренние подвздошные лимфатические узлы)", РОД: 1.8, Количество_фракций: 25, Фракционирование: "Стандартный", Связь: "Параллельно" }],
          hlt: { препараты: [{ Препарат: "Капецитабин", Режим: "В дни лучевой терапии" }] } },

        // ── Рак легкого ────────────────────────────────────────────────────────
        { category: "Рак легкого", name: "Рак лёгкого (Длинный курс)", цель: "Радикальный курс", теги: ["НМРЛ", "Длинный_курс", "ХЛТ", "ДС"],
          ptv1: { Название: "PTV", Область_облучения: "Опухоль лёгкого и поражённые лимфатические узлы с субклиническим отступом", РОД: 2.0, Количество_фракций: 30, Фракционирование: "Стандартный" }, extra: [],
          hlt: { препараты: [{ Препарат: "Паклитаксел + Карбоплатин", Режим: "Еженедельно" }] } },
        { category: "Рак легкого", name: "Рак лёгкого (Гипофракционирование)", цель: "Радикальный курс", теги: ["НМРЛ", "Гипофракционирование", "ДС"],
          ptv1: { Название: "PTV", Область_облучения: "Опухоль лёгкого и поражённые лимфатические узлы с субклиническим отступом", РОД: 3.0, Количество_фракций: 18, Фракционирование: "Стандартный" }, extra: [] },

        // ── Рак пищевода ───────────────────────────────────────────────────────
        { category: "Рак пищевода", name: "Рак пищевода (Предоперационный)", цель: "Предоперационный курс", теги: ["Рак_пищевода", "ХЛТ", "ДС"],
          ptv1: { Название: "PTV", Область_облучения: "Пищевод", РОД: 1.8, Количество_фракций: 23, Фракционирование: "Стандартный" }, extra: [],
          hlt: { препараты: [{ Препарат: "Паклитаксел + Карбоплатин", Режим: "Еженедельно" }] } },
        { category: "Рак пищевода", name: "Рак пищевода (Самостоятельный, КС)", цель: "Радикальный курс", теги: ["Рак_пищевода", "ХЛТ", "КС"],
          ptv1: { Название: "PTV", Область_облучения: "Пищевод", РОД: 2.0, Количество_фракций: 25, Фракционирование: "Стандартный" }, extra: [],
          setTag: "КС",
          hlt: { препараты: [{ Препарат: "Паклитаксел + Карбоплатин", Режим: "Еженедельно" }] } },
        { category: "Рак пищевода", name: "Рак пищевода (Самостоятельный, ДС)", цель: "Радикальный курс", теги: ["Рак_пищевода", "ХЛТ", "ДС"],
          ptv1: { Название: "PTV", Область_облучения: "Пищевод", РОД: 1.8, Количество_фракций: 28, Фракционирование: "Стандартный" }, extra: [],
          setTag: "ДС",
          hlt: { препараты: [{ Препарат: "Паклитаксел + Карбоплатин", Режим: "Еженедельно" }] } },

        // ── SBRT ───────────────────────────────────────────────────────────────
        { category: "SBRT", name: "SBRT (3 фракции)", цель: "Радикальный курс", теги: ["SBRT", "ДС"],
          ptv1: { Название: "PTV", Область_облучения: null, РОД: 20.0, Количество_фракций: 3, Фракционирование: "Стандартный" }, extra: [] },
        { category: "SBRT", name: "SBRT (5 фракций)", цель: "Радикальный курс", теги: ["SBRT", "ДС"],
          ptv1: { Название: "PTV", Область_облучения: null, РОД: 12.0, Количество_фракций: 5, Фракционирование: "Стандартный" }, extra: [] },
        { category: "SBRT", name: "SBRT (8 фракций)", цель: "Радикальный курс", теги: ["SBRT", "ДС"],
          ptv1: { Название: "PTV", Область_облучения: null, РОД: 7.5, Количество_фракций: 8, Фракционирование: "Стандартный" }, extra: [] },

        // ── Паллиатив ──────────────────────────────────────────────────────────
        { category: "Паллиатив", name: "Паллиативный (1 фракция)", цель: "Паллиативный курс", теги: ["Паллиатив", "ДС"],
          ptv1: { Название: "PTV", Область_облучения: null, РОД: 12.0, Количество_фракций: 1, Фракционирование: "Стандартный" }, extra: [] },
        { category: "Паллиатив", name: "Паллиативный (3 фракции)", цель: "Паллиативный курс", теги: ["Паллиатив", "ДС"],
          ptv1: { Название: "PTV", Область_облучения: null, РОД: 8.0, Количество_фракций: 3, Фракционирование: "Стандартный" }, extra: [] },
        { category: "Паллиатив", name: "Паллиативный (5 фракций)", цель: "Паллиативный курс", теги: ["Паллиатив", "ДС"],
          ptv1: { Название: "PTV", Область_облучения: null, РОД: 5.0, Количество_фракций: 5, Фракционирование: "Стандартный" }, extra: [] },

        // ── Одиночные шаблоны ─────────────────────────────────────────────────
        { category: "Рак анального канала", name: "Рак анального канала (ХЛТ)", цель: "Радикальный курс", теги: ["РАК", "ХЛТ", "ДС"], forceGroup: true,
          ptv1: { Название: "PTV 46", Область_облучения: "Опухоль анального канала, прямая кишка, мезоректальная клетчатка и зоны регионарного лимфооттока (мезоректальные, пресакральные, внутренние и наружные подвздошные, запирательные, поверхностные и глубокие паховые лимфатические узлы)", РОД: 2.0, Количество_фракций: 23, Фракционирование: "Стандартный" },
          extra: [
            { Название: "PTV 50", Область_облучения: null, РОД: 2.0, Количество_фракций: 2, Фракционирование: "Стандартный", Связь: "Последовательный буст" },
            { Название: "PTV 54", Область_облучения: null, РОД: 2.0, Количество_фракций: 2, Фракционирование: "Стандартный", Связь: "Последовательный буст" },
            { Название: "PTV 58", Область_облучения: null, РОД: 2.0, Количество_фракций: 2, Фракционирование: "Стандартный", Связь: "Последовательный буст" },
          ],
          hlt: { препараты: [{ Препарат: "Митомицин С", Режим: "Однократно" }, { Препарат: "Капецитабин", Режим: "В дни лучевой терапии" }] } },
        { category: "ОВГМ", name: "ОВГМ (10 фракций)", цель: "Паллиативный курс", теги: ["ОВГМ", "Паллиатив", "ДС"],
          ptv1: { Название: "PTV ", Область_облучения: "Весь объем головного мозга", РОД: 3.0, Количество_фракций: 10, Фракционирование: "Стандартный" }, extra: [] },
        { category: "ОВГМ", name: "ОВГМ (5 фракций)", цель: "Паллиативный курс", теги: ["ОВГМ", "Паллиатив", "ДС"],
          ptv1: { Название: "PTV ", Область_облучения: "Весь объем головного мозга", РОД: 4.0, Количество_фракций: 5, Фракционирование: "Стандартный" }, extra: [] },
    ];

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

        // Вычисляем теги из актуального frontmatter/локального state
        const SYSTEM_TAGS = ["Пациент"];
        const KNOWN_LOC_TAGS = ["РМЖ","Длинный_курс","Fast_forward","SBRT","КС","ДС","РПЖ","РПК","НМРЛ","Рак_пищевода","ОВГМ","РАК","Паллиатив","ХЛТ","Гипофракционирование"];
        let newTags = Array.isArray(getStoredVal("tags")) ? [...getStoredVal("tags")] : [];
        newTags = newTags.filter(t => SYSTEM_TAGS.includes(t) || !KNOWN_LOC_TAGS.includes(t));
        if (Array.isArray(tpl.теги)) {
            tpl.теги.forEach(tag => { if (!newTags.includes(tag)) newTags.push(tag); });
        }
        if (tpl.setTag) {
            const conflictTag = tpl.setTag === "КС" ? "ДС" : "КС";
            newTags = newTags.filter(t => t !== conflictTag);
            if (!newTags.includes(tpl.setTag)) newTags.push(tpl.setTag);
        }

        // Записываем данные шаблона в ls
        ls.Название_PTV       = tpl.ptv1.Название;
        ls.Область_облучения  = tpl.ptv1.Область_облучения ?? null;
        ls.РОД                = tpl.ptv1.РОД;
        ls.Количество_фракций = tpl.ptv1.Количество_фракций;
        ls.Фракционирование   = tpl.ptv1.Фракционирование;
        if (tpl.цель) ls.Цель_лечения = tpl.цель;
        ls.ХЛТ_препараты   = tpl.hlt ? (tpl.hlt.препараты ?? []) : [];
        ls.ХЛТ_дата_старта = tpl.hlt ? (getStoredVal("Дата_начала_лечения") ?? null) : null;
        ls._volumes = tpl.extra.map(v => ({
            Название: v.Название ?? null, Область_облучения: v.Область_облучения ?? null,
            РОД: v.РОД ?? null, Количество_фракций: v.Количество_фракций ?? null,
            Фракционирование: v.Фракционирование ?? "Стандартный", Связь: v.Связь ?? "Параллельно",
        }));
        ls.tags = newTags;

        // ── ШАГ 2: СИНХРОННО — перестраиваем форму ДО любого await ──────────
        // cur ещё валиден, ls заполнен — форма покажет правильные данные
        initTagsMap_fn();
        buildForm();

        // ── ШАГ 3: ФОНОМ — сохраняем в файл (fire and forget) ───────────────
        // Не await! Иначе Dataview перерисует блок и cur в старом closure протухнет.
        app.fileManager.processFrontMatter(file, fm => {
            fm.Название_PTV         = tpl.ptv1.Название;
            fm.Область_облучения    = tpl.ptv1.Область_облучения ?? null;
            fm.РОД                  = tpl.ptv1.РОД;
            fm.Количество_фракций   = tpl.ptv1.Количество_фракций;
            fm.Фракционирование     = tpl.ptv1.Фракционирование;
            if (tpl.цель) fm.Цель_лечения = tpl.цель;
            fm.Объёмы = tpl.extra.map(v => ({
                Название:           v.Название           ?? null,
                Область_облучения:  v.Область_облучения  ?? null,
                РОД:                v.РОД                ?? null,
                Количество_фракций: v.Количество_фракций ?? null,
                Фракционирование:   v.Фракционирование   ?? "Стандартный",
                Связь:              v.Связь              ?? "Параллельно",
            }));
            if (tpl.hlt) {
                fm.ХЛТ_препараты   = tpl.hlt.препараты ?? [];
                fm.ХЛТ_дата_старта = fm.Дата_начала_лечения ?? null;
            } else {
                fm.ХЛТ_препараты   = [];
                fm.ХЛТ_дата_старта = null;
            }
            delete fm.Радиомодификация;
            delete fm.ХЛТ_режим;
            fm.tags = newTags;
        });

        new Notice(`✅ Шаблон «${tpl.name}» применён`);
    };

    const LARGE_CONN_LIST = ["Параллельно", "Последовательно"];
    const BOOST_CONN_LIST = ["Последовательный буст", "Одновременно"];
    const CONN_COLORS = {
        "Параллельно":           "#ff9800",
        "Последовательно":       "#ffc107",
        "Последовательный буст": "#9c27b0",
        "Одновременно":          "#4caf50"
    };
    const LARGE_CONN_LABELS = { "Параллельно": "Параллельно", "Последовательно": "Последовательно" };
    const FRAKTS_LIST = ["Стандартный", "Через день", "Два раза в день", "Стажированно (раз в 14 дней)"];

    const ptv1Frac = getVal("Количество_фракций");
    const ptv1Mode = getVal("Фракционирование") || "Стандартный";

    // Инициализируем ls._volumes: если шаблон уже записал данные — используем их, иначе читаем из актуального frontmatter
    if (!ls.hasOwnProperty('_volumes')) {
        ls._volumes = (Array.isArray(getStoredVal("Объёмы")) ? getStoredVal("Объёмы") : [])
            .filter(v => v && typeof v === 'object')
            .map(v => Object.assign({}, v));
    }
    const validVolumes = ls._volumes;

    const volGroups = [{ largeVol: null, largeIdx: null, conn: null, boosts: [] }];
    validVolumes.forEach((vol, idx) => {
        const conn = normalizeConn(vol.Связь || "");
        if (conn === "Параллельно" || conn === "Последовательно") {
            volGroups.push({ largeVol: vol, largeIdx: idx, conn, boosts: [] });
        } else {
            volGroups[volGroups.length - 1].boosts.push({ vol, idx });
        }
    });

    const defaultPtvName = (n) => volGroups.length > 1 ? `PTV${n}` : "PTV";

    const volListEl = modal.ownerDocument.createElement("div");

    const acceleratorOptions = ["Varian Halcyon", "Varian TrueBeam"];
    const isStereotaxisAcceleratorContext = (context = {}) => {
        const text = [context.mode, context.method, context.fractionation].map(v => String(v || "")).join(" ");
        return /\b(SBRT|SRS|SRT)\b|стереотакс|stereotax/iu.test(text);
    };
    const resolveAccelerator = (value, context = {}) => {
        const text = String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
        if (text === "varian halcyon" || text === "halcyon") return "Varian Halcyon";
        if (text === "varian truebeam" || text === "truebeam" || text === "true beam") return "Varian TrueBeam";
        return isStereotaxisAcceleratorContext(context) ? "Varian TrueBeam" : "Varian Halcyon";
    };
    const getPrimaryAccelerator = () => resolveAccelerator(getVal("Ускоритель"), {
        fractionation: getVal("Фракционирование"),
        mode: getVal("Название_PTV")
    });

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
            const _bi = ls._volumes.indexOf(boostVol);
            if (_bi !== -1) ls._volumes.splice(_bi, 1);
            setPending("Объёмы", ls._volumes.slice());
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
        areaIn.onfocus = () => { acInput = areaIn; acList = SUGGEST["Область_облучения"] ?? []; renderAC(areaIn.value); };
        areaIn.oninput = () => { acList = SUGGEST["Область_облучения"] ?? []; renderAC(areaIn.value); };
        areaIn.onblur = () => setTimeout(() => { if (document.activeElement !== acEl) acEl.style.display = "none"; }, 200);
        areaIn.onchange = () => { boostVol.Область_облучения = areaIn.value.trim() || null; setPending("Объёмы", ls._volumes.slice()); };
        areaFieldRow.appendChild(areaLbl); areaFieldRow.appendChild(areaIn);
        card.appendChild(areaFieldRow);

        const doseRow = modal.ownerDocument.createElement("div");
        doseRow.className = `${msc}-vol-dose-row`;
        if (!isSIB) {
            mkVolField(doseRow, "РОД (Гр)", "number", boostVol.РОД, null, v => { boostVol.РОД = v; setPending("Объёмы", ls._volumes.slice()); });
            mkVolField(doseRow, "Фракции", "number", boostVol.Количество_фракций, null, v => { boostVol.Количество_фракций = v; setPending("Объёмы", ls._volumes.slice()); });
            mkVolField(doseRow, "Режим", "select", boostVol.Фракционирование || "Стандартный", FRAKTS_LIST, v => { boostVol.Фракционирование = v; setPending("Объёмы", ls._volumes.slice()); });
        } else {
            mkVolField(doseRow, "РОД (Гр) SIB", "number", boostVol.РОД, null, v => { boostVol.РОД = v; setPending("Объёмы", ls._volumes.slice()); });
            mkVolField(doseRow, "Фракции (авто)", "number", ptv1Frac, null, async () => {}, true);
            mkVolField(doseRow, "Режим (авто)", "select", ptv1Mode || "Стандартный", FRAKTS_LIST, async () => {}, true);
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
                const newBoost = { Название: defaultName, Область_облучения: null, РОД: null,
                    Количество_фракций: null, Фракционирование: "Стандартный", Связь: connType };
                ls._volumes.splice(insertAt, 0, newBoost);
                setPending("Объёмы", ls._volumes.slice());
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
    areaIn1.onfocus = () => { acInput = areaIn1; acList = SUGGEST["Область_облучения"] ?? []; renderAC(areaIn1.value); };
    areaIn1.oninput = () => { acList = SUGGEST["Область_облучения"] ?? []; renderAC(areaIn1.value); };
    areaIn1.onblur = () => setTimeout(() => { if (document.activeElement !== acEl) acEl.style.display = "none"; }, 200);
    areaIn1.onchange = () => { setPending("Область_облучения", areaIn1.value.trim() || null); };
    area1Row.appendChild(area1Lbl); area1Row.appendChild(areaIn1);
    card1.appendChild(area1Row);

    const dose1Row = modal.ownerDocument.createElement("div");
    dose1Row.className = `${msc}-vol-dose-row`;
    mkVolField(dose1Row, "РОД (Гр)", "number", getVal("РОД"), null, v => { setPending("РОД", v); });
    mkVolField(dose1Row, "Фракции", "number", getVal("Количество_фракций"), null, v => { setPending("Количество_фракций", v); });
    mkVolField(dose1Row, "Режим", "select", getVal("Фракционирование") || "Стандартный", FRAKTS_LIST, v => { setPending("Фракционирование", v); });
    mkVolField(dose1Row, "Ускоритель", "select", resolveAccelerator(getVal("Ускоритель"), { fractionation: getVal("Фракционирование"), mode: getVal("Название_PTV") }), acceleratorOptions, v => { setPending("Ускоритель", v); });
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
            const _vi = ls._volumes.indexOf(vol);
            if (_vi !== -1) ls._volumes.splice(_vi, 1);
            setPending("Объёмы", ls._volumes.slice());
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
        areaIn2.onfocus = () => { acInput = areaIn2; acList = SUGGEST["Область_облучения"] ?? []; renderAC(areaIn2.value); };
        areaIn2.oninput = () => { acList = SUGGEST["Область_облучения"] ?? []; renderAC(areaIn2.value); };
        areaIn2.onblur = () => setTimeout(() => { if (document.activeElement !== acEl) acEl.style.display = "none"; }, 200);
        areaIn2.onchange = () => { vol.Область_облучения = areaIn2.value.trim() || null; setPending("Объёмы", ls._volumes.slice()); };
        areaFieldRow.appendChild(areaLbl2); areaFieldRow.appendChild(areaIn2);
        card.appendChild(areaFieldRow);

        const doseRow2 = modal.ownerDocument.createElement("div");
        doseRow2.className = `${msc}-vol-dose-row`;
        mkVolField(doseRow2, "РОД (Гр)", "number", vol.РОД, null, v => { vol.РОД = v; setPending("Объёмы", ls._volumes.slice()); });
        mkVolField(doseRow2, "Фракции", "number", vol.Количество_фракций, null, v => { vol.Количество_фракций = v; setPending("Объёмы", ls._volumes.slice()); });
        mkVolField(doseRow2, "Режим", "select", vol.Фракционирование || "Стандартный", FRAKTS_LIST, v => { vol.Фракционирование = v; setPending("Объёмы", ls._volumes.slice()); });
        mkVolField(doseRow2, "Ускоритель", "select", vol.Ускоритель || getPrimaryAccelerator(), acceleratorOptions, v => { vol.Ускоритель = v; setPending("Объёмы", ls._volumes.slice()); });
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
        const newVol = { Название: null, Область_облучения: null, РОД: null,
            Количество_фракций: null, Фракционирование: "Стандартный", Связь: "Параллельно" };
        ls._volumes.push(newVol);
        setPending("Объёмы", ls._volumes.slice());

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
            const ri = ls._volumes.indexOf(newVol);
            if (ri !== -1) { ls._volumes.splice(ri, 1); setPending("Объёмы", ls._volumes.slice()); }
        };
        newHead.appendChild(newDelBtn);
        newCard.appendChild(newHead);

        const newAreaRow = modal.ownerDocument.createElement("div");
        newAreaRow.style.cssText = "display: flex; flex-direction: column; gap: 4px; margin-bottom: 8px;";
        const newAreaLbl = modal.ownerDocument.createElement("label");
        newAreaLbl.textContent = "Область облучения"; newAreaLbl.className = `${msc}-inline-label`;
        const newAreaIn = modal.ownerDocument.createElement("input");
        newAreaIn.type = "text"; newAreaIn.className = `${msc}-inline-input`;
        newAreaIn.onfocus = () => { acInput = newAreaIn; acList = SUGGEST["Область_облучения"] ?? []; renderAC(newAreaIn.value); };
        newAreaIn.oninput = () => { acList = SUGGEST["Область_облучения"] ?? []; renderAC(newAreaIn.value); };
        newAreaIn.onblur = () => setTimeout(() => { if (document.activeElement !== acEl) acEl.style.display = "none"; }, 200);
        newAreaIn.onchange = () => { newVol.Область_облучения = newAreaIn.value.trim() || null; setPending("Объёмы", ls._volumes.slice()); };
        newAreaRow.appendChild(newAreaLbl); newAreaRow.appendChild(newAreaIn);
        newCard.appendChild(newAreaRow);

        const newDoseRow = modal.ownerDocument.createElement("div");
        newDoseRow.className = `${msc}-vol-dose-row`;
        mkVolField(newDoseRow, "РОД (Гр)", "number", null, null, v => { newVol.РОД = v; setPending("Объёмы", ls._volumes.slice()); });
        mkVolField(newDoseRow, "Фракции", "number", null, null, v => { newVol.Количество_фракций = v; setPending("Объёмы", ls._volumes.slice()); });
        mkVolField(newDoseRow, "Режим", "select", "Стандартное", FRAKTS_LIST, v => { newVol.Фракционирование = v; setPending("Объёмы", ls._volumes.slice()); });
        mkVolField(newDoseRow, "Ускоритель", "select", getPrimaryAccelerator(), acceleratorOptions, v => { newVol.Ускоритель = v; setPending("Объёмы", ls._volumes.slice()); });
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

    // ── ТЕГИ ──────────────────────────────────────────────────────────────────
    const tagSec = modal.ownerDocument.createElement("div");
    const tagSecTitle = modal.ownerDocument.createElement("div");
    tagSecTitle.textContent = "Теги"; tagSecTitle.className = `${msc}-sec-title`;
    tagSecTitle.style.marginTop = "16px";
    tagSec.appendChild(tagSecTitle);
    wrap.appendChild(tagSec);

    const PRESETS = [
        { key: "ДС", label: "🏥 ДС" }, { key: "КС", label: "🏨 КС" },
        { key: "SBRT", label: "SBRT" }, { key: "SRT", label: "SRT" },
        { key: "SRS", label: "SRS" }, { key: "ХЛТ", label: "ХЛТ" },
        { key: "длинный_курс", label: "Длинный курс" }
    ];
    const presetKeys = new Set(PRESETS.map(p => p.key.toLowerCase()));

    // Инициализируем tagsMap от cur при каждом открытии
    // ls._tagsMap инициализирован через initTagsMap_fn() перед вызовом buildForm()

    const flushTags = () => setPending("tags", [...ls._tagsMap.values()]);

    const chipRow = modal.ownerDocument.createElement("div");
    chipRow.className = `${msc}-tags-container`;

    PRESETS.forEach(({ key, label }) => {
        const isOn = ls._tagsMap.has(key.toLowerCase());
        const btn = modal.ownerDocument.createElement("button");
        btn.textContent = label;
        btn.className = `${msc}-tag ${msc}-tag-preset${isOn ? ' active' : ''}`;
        btn.onclick = () => {
            if (btn.classList.contains("active")) {
                btn.classList.remove("active");
                ls._tagsMap.delete(key.toLowerCase());
            } else {
                btn.classList.add("active");
                ls._tagsMap.set(key.toLowerCase(), key);
            }
            flushTags();
        };
        chipRow.appendChild(btn);
    });

    const renderCustomChip = (originalTag) => {
        const lk = originalTag.toLowerCase();
        const chip = modal.ownerDocument.createElement("div");
        chip.className = `${msc}-tag ${msc}-tag-custom`;
        const chipSpan = modal.ownerDocument.createElement("span");
        chipSpan.textContent = "#" + originalTag;
        chip.appendChild(chipSpan);
        const delBtn = modal.ownerDocument.createElement("button");
        delBtn.className = `${msc}-tag-custom-del`;
        delBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
        delBtn.onclick = () => {
            chip.remove();
            ls._tagsMap.delete(lk);
            flushTags();
            new Notice(`🗑️ Тег «${originalTag}» удалён`);
        };
        chip.appendChild(delBtn);
        chipRow.appendChild(chip);
    };

    [...ls._tagsMap.entries()]
        .filter(([lk]) => !presetKeys.has(lk) && lk !== "пациент")
        .forEach(([_, orig]) => renderCustomChip(orig));

    tagSec.appendChild(chipRow);

    const addTagRow = modal.ownerDocument.createElement("div");
    addTagRow.className = `${msc}-add-tag-row`;
    const tagInput = modal.ownerDocument.createElement("input");
    tagInput.type = "text"; tagInput.placeholder = "Начните вводить тег...";
    tagInput.className = `${msc}-input ${msc}-add-tag-input`;
    tagInput.dataset.isTagInput = "true";
    const addTagBtn = modal.ownerDocument.createElement("button");
    addTagBtn.textContent = "+ Добавить"; addTagBtn.className = `${msc}-add-tag-btn`;
    addTagRow.appendChild(tagInput); addTagRow.appendChild(addTagBtn);
    tagSec.appendChild(addTagRow);

    externalAddTagFunc = () => {
        const val = tagInput.value.trim().replace(/^#+/, "");
        if (!val) return;
        if (!ls._tagsMap.has(val.toLowerCase())) {
            ls._tagsMap.set(val.toLowerCase(), val);
            renderCustomChip(val);
            flushTags();
            new Notice(`🏷️ Тег «${val}» добавлен`);
        }
        tagInput.value = "";
    };

    addTagBtn.onclick = externalAddTagFunc;
    tagInput.onfocus = () => { acInput = tagInput; acList = SUGGEST["Теги"] || []; renderAC(tagInput.value); };
    tagInput.oninput = () => { acList = SUGGEST["Теги"] || []; renderAC(tagInput.value); };
    tagInput.onblur = () => setTimeout(() => { if (document.activeElement !== acEl) acEl.style.display = "none"; }, 200);
    tagInput.onkeydown = e => { if (e.key === "Enter") { e.preventDefault(); externalAddTagFunc(); acEl.style.display = "none"; } };

    // ── СЕКЦИЯ: КЛИНИЧЕСКИЕ ДАННЫЕ (АНАМНЕЗ И ЛАБОРАТОРНЫЕ) ───────────────────
    const CLIN_OPEN_KEY = 'pf-clin-open-' + cur.file.path;
    const clinWrap = modal.ownerDocument.createElement("div");
    clinWrap.style.cssText = "margin-top:16px;margin-bottom:8px; border-radius:8px; transition:box-shadow .15s;";

    const renderClin = () => {
        clinWrap.innerHTML = "";
        const hasAnam = ANAM_FIELDS.some(([, k]) => getVal(k));
        const hasLabs = Array.isArray(getVal("Лабораторные")) && getVal("Лабораторные").length > 0;
        const isOpen = window[CLIN_OPEN_KEY] !== undefined ? window[CLIN_OPEN_KEY] : (hasAnam || hasLabs);

        const clinHdr = modal.ownerDocument.createElement("button");
        clinHdr.style.cssText = `width:100%;box-sizing:border-box;display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:var(--background-primary);border:1px solid var(--background-modifier-border);border-radius:${isOpen ? "8px 8px 0 0" : "8px"};color:var(--text-accent);font-size:0.75em;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;cursor:pointer;touch-action:manipulation;transition:background .15s,box-shadow .15s;`;
        clinHdr.innerHTML = `<span style="display:flex;align-items:center;gap:8px;">🩺 Анамнез и Анализы</span><span style="font-size:11px;opacity:.7;">${isOpen ? "▲" : "▼"}</span>`;
        clinHdr.onmouseenter = () => { clinHdr.style.background = "var(--background-modifier-hover)"; clinWrap.style.boxShadow = "0 0 0 3px var(--background-modifier-border)"; };
        clinHdr.onmouseleave = () => { clinHdr.style.background = "var(--background-primary)"; clinWrap.style.boxShadow = "none"; };
        clinHdr.onclick = () => { window[CLIN_OPEN_KEY] = !isOpen; renderClin(); };
        clinWrap.appendChild(clinHdr);

        if (isOpen) {
            const clinBody = modal.ownerDocument.createElement("div");
            clinBody.style.cssText = `border:1px solid var(--background-modifier-border);border-top:none;border-radius:0 0 8px 8px;padding:16px 12px;display:flex;flex-direction:column;gap:20px;background:var(--background-primary);box-sizing:border-box;`;

            // 1. Анамнез
            const anamBlock = modal.ownerDocument.createElement("div");
            anamBlock.style.cssText = "display:flex;flex-direction:column;gap:0;";
            ANAM_FIELDS.forEach(([label, key]) => field(anamBlock, label, key, "textarea"));
            clinBody.appendChild(anamBlock);

            // 2. Лабораторные
            const LAB_GROUPS = [
                { name: "🩸 Клинический анализ крови", color: "#1565c0", params: {
                    Лейкоциты:   { min: 4.0,  max: 9.0,   unit: "×10⁹/л" },
                    Нейтрофилы:  { min: 1.8,  max: 7.7,   unit: "×10⁹/л" },
                    Лимфоциты:   { min: 1.0,  max: 4.5,   unit: "×10⁹/л" },
                    Моноциты:    { min: 0.12, max: 0.99,  unit: "×10⁹/л" },
                    Эозинофилы:  { min: 0.04, max: 0.54,  unit: "×10⁹/л" },
                    Базофилы:    { min: 0.01, max: 0.08,  unit: "×10⁹/л" },
                    Эритроциты:  { min: 3.8,  max: 5.5,   unit: "×10¹²/л" },
                    Гемоглобин:  { min: 120,  max: 160,   unit: "г/л" },
                    Гематокрит:  { min: 37,   max: 51,    unit: "%" },
                    Тромбоциты:  { min: 150,  max: 400,   unit: "×10⁹/л" },
                    СОЭ:         { min: 2,    max: 30,    unit: "мм/ч" },
                }},
                { name: "🧪 Биохимия", color: "#6a1b9a", params: {
                    АЛТ:         { min: 5,    max: 40,    unit: "Ед/л" },
                    АСТ:         { min: 5,    max: 40,    unit: "Ед/л" },
                    ЩФ:          { min: 30,   max: 120,   unit: "Ед/л" },
                    ГГТ:         { min: 8,    max: 61,    unit: "Ед/л" },
                    Билирубин:   { min: 3.4,  max: 20.5,  unit: "мкмоль/л" },
                    Бил_прям:    { min: 0.5,  max: 5.1,   unit: "мкмоль/л" },
                    Общий_белок: { min: 64,   max: 83,    unit: "г/л" },
                    Мочевина:    { min: 2.8,  max: 7.2,   unit: "мМоль/л" },
                    Креатинин:   { min: 44,   max: 115,   unit: "мкмоль/л" },
                    Глюкоза:     { min: 3.9,  max: 6.1,   unit: "мМоль/л" },
                    Натрий:      { min: 136,  max: 145,   unit: "мМоль/л" },
                    Калий:       { min: 3.5,  max: 5.1,   unit: "мМоль/л" },
                }},
                { name: "🔴 Коагулограмма", color: "#b71c1c", params: {
                    МНО:         { min: 0.81, max: 1.07,  unit: "" },
                    АЧТВ:        { min: 24,   max: 36,    unit: "с" },
                    ТВ:          { min: 10.3, max: 16.6,  unit: "с" },
                    ПТВ:         { min: 9.2,  max: 12.2,  unit: "с" },
                    Д_димер:     { min: 109,  max: 560,   unit: "нг/мл" },
                }},
                { name: "🎯 Онкомаркеры", color: "#e65100", params: {
                    ПСА:         { min: 0,    max: 4,     unit: "нг/мл" },
                    РЭА:         { min: 0,    max: 5,     unit: "нг/мл" },
                    СА_19_9:     { min: 0,    max: 30,    unit: "Ед/мл" },
                    СА_125:      { min: 0,    max: 35,    unit: "Ед/мл" },
                    АФП:         { min: 0,    max: 8.1,   unit: "МЕ/мл" },
                    СА_15_3:     { min: 0,    max: 26.9,  unit: "Ед/мл" },
                }},
                { name: "💛 Анализ мочи", color: "#f9a825", params: {
                    Уробилиноген_м: { min: 0,     max: 34,    unit: "мкмоль/л" },
                    Удельный_вес_м: { min: 1.003, max: 1.030, unit: "" },
                    pH_мочи:        { min: 5.0,   max: 7.5,   unit: "" },
                    Лейкоциты_мочи: { min: 0,     max: 25,    unit: "/мкл" },
                    Белок_мочи:     { min: 0,     max: 0.15,  unit: "г/л" },
                    Билирубин_мочи: { qualitative: true, unit: "" },
                    Глюкоза_мочи:   { qualitative: true, unit: "" },
                    Кровь_мочи:     { qualitative: true, unit: "" },
                    Кетоны_мочи:    { qualitative: true, unit: "" },
                    Нитриты_мочи:   { qualitative: true, unit: "" },
                }},
            ];
            const LAB_CHART_COLORS = ["#1e88e5","#43a047","#e53935","#fb8c00","#8e24aa","#00897b","#f4511e","#3949ab","#d81b60","#00acc1","#c0ca33","#6d4c41"];

            const labSec = modal.ownerDocument.createElement("div");
            const labSecHdr = modal.ownerDocument.createElement("div");
            labSecHdr.style.cssText = "display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;";

            const labSecTitle = modal.ownerDocument.createElement("div");
            labSecTitle.textContent = "🔬 Лабораторные данные";
            labSecTitle.className = `${msc}-sec-title`;
            labSecTitle.style.marginTop = "0";
            labSecHdr.appendChild(labSecTitle);

            const addLabBtn = modal.ownerDocument.createElement("button");
            addLabBtn.textContent = "+ Добавить анализы";
            addLabBtn.style.cssText = "font-size:11px;color:var(--text-accent);background:none;border:1px solid var(--text-accent);border-radius:4px;padding:3px 8px;cursor:pointer;";
            labSecHdr.appendChild(addLabBtn);
            labSec.appendChild(labSecHdr);

            // ── График ───────────────────────────────────────────────────────────
            const CHART_GRP_KEY = "lab_chart_grp_" + cur.file.path;
            const chartArea = modal.ownerDocument.createElement("div");
            chartArea.style.cssText = "display:none;border:1px solid var(--background-modifier-border);border-radius:8px;padding:10px 12px;margin-bottom:8px;background:var(--background-secondary);";

            const CHEMO_KEY_PARAMS = ['Гемоглобин','Лейкоциты','Нейтрофилы','Тромбоциты','АЛТ','АСТ','Креатинин','Билирубин','ПСА'];
            const groupBtnsRow = modal.ownerDocument.createElement("div");
            groupBtnsRow.style.cssText = "display:flex;gap:5px;flex-wrap:wrap;margin-bottom:8px;";
            const mainBtn = modal.ownerDocument.createElement("button");
            mainBtn.textContent = "🔑 Основное";
            mainBtn.style.cssText = `font-size:10px;padding:3px 10px;border:1px solid #00897b;border-radius:12px;cursor:pointer;transition:all 0.15s;background:#00897b;color:#fff;font-weight:700;white-space:nowrap;`;
            groupBtnsRow.appendChild(mainBtn);
            const groupBtns = LAB_GROUPS.map((group) => {
                const btn = modal.ownerDocument.createElement("button");
                btn.textContent = group.name;
                btn.style.cssText = `font-size:10px;padding:3px 10px;border:1px solid ${group.color};border-radius:12px;cursor:pointer;transition:all 0.15s;background:none;color:${group.color};white-space:nowrap;`;
                groupBtnsRow.appendChild(btn);
                return btn;
            });
            chartArea.appendChild(groupBtnsRow);

            const chartWrap = modal.ownerDocument.createElement("div");
            chartWrap.style.cssText = "width:100%;height:230px;position:relative;";
            const chartCanvas = modal.ownerDocument.createElement("canvas");
            chartWrap.appendChild(chartCanvas);
            chartArea.appendChild(chartWrap);
            labSec.appendChild(chartArea);

            const tableWrap = modal.ownerDocument.createElement("div");
            tableWrap.style.cssText = "overflow-x:auto;-webkit-overflow-scrolling:touch;border:1px solid var(--background-modifier-border);border-radius:6px;";
            labSec.appendChild(tableWrap);

            const renderLabEditor = () => {
                tableWrap.innerHTML = "";
                const rawLabs = getVal("Лабораторные");
                let labData = Array.isArray(rawLabs) ? [...rawLabs] : [];
                labData.sort((a, b) => normalizeLabDateKey(b.Дата).localeCompare(normalizeLabDateKey(a.Дата)));

                // ── График ───────────────────────────────────────────────────────
                if (labData.length > 1) {
                    chartArea.style.display = "block";
                    const activeGrp = window[CHART_GRP_KEY] ?? -1;

                    const drawGroupChart = (gIdx) => {
                        window[CHART_GRP_KEY] = gIdx;
                        mainBtn.style.background = gIdx === -1 ? '#00897b' : 'none';
                        mainBtn.style.color = gIdx === -1 ? '#fff' : '#00897b';
                        mainBtn.style.fontWeight = gIdx === -1 ? '700' : '400';
                        groupBtns.forEach((btn, j) => {
                            const isActive = j === gIdx;
                            btn.style.background = isActive ? LAB_GROUPS[j].color : "none";
                            btn.style.color      = isActive ? "#fff" : LAB_GROUPS[j].color;
                            btn.style.fontWeight  = isActive ? "700" : "400";
                        });
                        const paramsToChart = gIdx === -1
                            ? CHEMO_KEY_PARAMS.flatMap(p => { for (const g of LAB_GROUPS) { if (g.params[p] && !g.params[p].qualitative) return [[p, g.params[p]]]; } return []; })
                            : Object.entries(LAB_GROUPS[gIdx].params).filter(([, ref]) => !ref.qualitative);
                        const labels = [...labData].reverse().map(e => {
                            try { const d = dv.date(e.Дата); return d ? d.toFormat("dd.MM.yy") : (e.Дата || ""); } catch(_) { return e.Дата || ""; }
                        });
                        let colorIdx = 0;
                        const paramDatasets = [];
                        paramsToChart.forEach(([param, ref]) => {
                            const range = ref.max - ref.min;
                            const chartEntries = [...labData].reverse();
                            const absVals = chartEntries.map(e => {
                                const v = e[param];
                                if (v === undefined || v === null || v === "") return null;
                                const n = Number(String(v).replace(',', '.'));
                                return Number.isFinite(n) ? n : null;
                            });
                            const vals = chartEntries.map(e => {
                                const v = e[param];
                                if (v === undefined || v === null || v === "") return null;
                                const n = Number(String(v).replace(',', '.'));
                                if (!Number.isFinite(n)) return null;
                                return range > 0 ? Math.round(((n - ref.min) / range) * 1000) / 10 : n;
                            });
                            if (vals.filter(v => v !== null).length >= 2) {
                                const c = LAB_CHART_COLORS[colorIdx++ % LAB_CHART_COLORS.length];
                                paramDatasets.push({ label: param, data: vals, absData: absVals, unit: ref.unit || "", borderColor: c, backgroundColor: c + "22", tension: 0.3, pointRadius: 3, pointHoverRadius: 5, borderWidth: 2, spanGaps: true });
                            }
                        });

                        const renderChart = () => {
                            if (chartWrap._chart) { chartWrap._chart.destroy(); chartWrap._chart = null; }
                            const noDataMsg = chartWrap.querySelector(".lab-no-chart");
                            if (paramDatasets.length === 0) {
                                if (!noDataMsg) { const m = modal.ownerDocument.createElement("div"); m.className = "lab-no-chart"; m.textContent = "Нет данных для графика (нужно ≥ 2 записей с одним показателем)"; m.style.cssText = "font-size:11px;color:var(--text-faint);text-align:center;padding:30px 10px;"; chartWrap.appendChild(m); }
                                return;
                            }
                            if (noDataMsg) noDataMsg.remove();
                            const refBand = [
                                { label: '_min', data: labels.map(() => 0),   borderColor: 'transparent', backgroundColor: 'rgba(76,175,80,0.10)', fill: '+1', pointRadius: 0, borderWidth: 0 },
                                { label: '_max', data: labels.map(() => 100), borderColor: 'rgba(76,175,80,0.5)', backgroundColor: 'rgba(76,175,80,0.10)', fill: '-1', pointRadius: 0, borderWidth: 1, borderDash: [4, 3] },
                            ];
                            chartWrap._chart = new window.Chart(chartCanvas, {
                                type: 'line',
                                data: { labels, datasets: [...refBand, ...paramDatasets] },
                                options: {
                                    maintainAspectRatio: false,
                                    interaction: { mode: 'index', intersect: false },
                                    plugins: {
                                        legend: { position: 'bottom', labels: { color: "var(--text-normal)", font: { size: 10 }, boxWidth: 12, padding: 8, filter: item => !item.text.startsWith('_') } },
                                        tooltip: { callbacks: { label: ctx => {
                                            if (ctx.dataset.label.startsWith('_')) return null;
                                            const raw = Array.isArray(ctx.dataset.absData) ? ctx.dataset.absData[ctx.dataIndex] : null;
                                            const unit = ctx.dataset.unit ? ` ${ctx.dataset.unit}` : "";
                                            const rawText = raw !== null && raw !== undefined ? ` (${String(raw).replace(".", ",")}${unit})` : "";
                                            return ` ${ctx.dataset.label}: ${ctx.parsed.y}% от нормы${rawText}`;
                                        } } }
                                    },
                                    scales: {
                                        x: { ticks: { color: "var(--text-muted)", font: { size: 10 }, maxRotation: 45, minRotation: 45 } },
                                        y: { title: { display: true, text: '% от нормативного диапазона', color: 'var(--text-muted)', font: { size: 9 } }, ticks: { color: "var(--text-muted)", font: { size: 10 }, callback: v => v + '%' } }
                                    }
                                }
                            });
                        };
                        if (!window.Chart) { const s = modal.ownerDocument.createElement("script"); s.src = "https://cdn.jsdelivr.net/npm/chart.js"; s.onload = renderChart; document.head.appendChild(s); } else { renderChart(); }
                    };

                    mainBtn.onclick = () => drawGroupChart(-1);
                    groupBtns.forEach((btn, i) => { btn.onclick = () => drawGroupChart(i); });
                    drawGroupChart(activeGrp);
                } else {
                    chartArea.style.display = "none";
                }

                // ── Таблица ───────────────────────────────────────────────────────
                if (labData.length === 0) {
                    const emptyMsg = modal.ownerDocument.createElement("div");
                    emptyMsg.textContent = "Нет записей. Нажмите «+ Добавить анализы» чтобы начать.";
                    emptyMsg.style.cssText = "font-size:12px;color:var(--text-faint);padding:16px;text-align:center;";
                    tableWrap.appendChild(emptyMsg);
                    return;
                }

                const hasParamValue = (param) => labData.some(e => e[param] !== undefined && e[param] !== null && e[param] !== "");

                const table = modal.ownerDocument.createElement("table");
                table.style.cssText = "border-collapse:collapse;font-size:12px;min-width:max-content;width:100%;text-align:center;";

                const thead = modal.ownerDocument.createElement("thead");
                const hRow  = modal.ownerDocument.createElement("tr");

                const th0 = modal.ownerDocument.createElement("th");
                th0.textContent = "Показатель";
                th0.style.cssText = "text-align:left;padding:8px 10px;border-bottom:2px solid var(--background-modifier-border);color:var(--text-muted);font-weight:700;position:sticky;left:0;background:var(--background-primary);z-index:2;min-width:130px;";
                hRow.appendChild(th0);

                labData.forEach((entry, colIdx) => {
                    const th = modal.ownerDocument.createElement("th");
                    th.style.cssText = "padding:6px 8px;border-bottom:2px solid var(--background-modifier-border);min-width:110px;background:var(--background-primary);";
                    const thTop = modal.ownerDocument.createElement("div");
                    thTop.style.cssText = "display:flex;flex-direction:column;gap:4px;align-items:center;";

                    const dateInp = modal.ownerDocument.createElement("input");
                    dateInp.type = "date";
                    dateInp.className = "lab-date-inp";
                    let isoD = "";
                    try { if (entry.Дата) { const d = dv.date(entry.Дата); if (d) isoD = d.toFormat("yyyy-MM-dd"); } } catch(e){}
                    dateInp.value = isoD;
                    dateInp.style.cssText = "width:100%;border:1px solid var(--background-modifier-border);background:var(--background-primary);color:var(--text-normal);border-radius:4px;padding:2px 4px;font-size:11px;outline:none;box-sizing:border-box;";
                    dateInp.onfocus = () => dateInp.style.borderColor = "var(--interactive-accent)";
                    dateInp.onblur  = () => dateInp.style.borderColor = "var(--background-modifier-border)";
                    dateInp.onchange = () => { labData[colIdx].Дата = dateInp.value; saveNow({ "Лабораторные": labData }); renderLabEditor(); };

                    const delBtn = modal.ownerDocument.createElement("button");
                    delBtn.textContent = "× Удалить";
                    delBtn.style.cssText = "font-size:10px;color:#e53935;background:none;border:none;cursor:pointer;width:100%;text-align:center;padding:2px 0;border-radius:2px;";
                    delBtn.onmouseenter = () => delBtn.style.background = "rgba(229,57,53,0.08)";
                    delBtn.onmouseleave = () => delBtn.style.background = "none";
                    delBtn.onclick = () => { labData.splice(colIdx, 1); saveNow({ "Лабораторные": labData.length ? labData : null }); renderLabEditor(); };

                    thTop.appendChild(dateInp);
                    thTop.appendChild(delBtn);
                    th.appendChild(thTop);
                    hRow.appendChild(th);
                });

                const thNorm = modal.ownerDocument.createElement("th");
                thNorm.textContent = "Норма";
                thNorm.style.cssText = "padding:8px 10px;border-bottom:2px solid var(--background-modifier-border);color:var(--text-muted);font-weight:700;min-width:110px;";
                hRow.appendChild(thNorm);
                thead.appendChild(hRow);
                table.appendChild(thead);

                const tbody = modal.ownerDocument.createElement("tbody");

                LAB_GROUPS.forEach(group => {
                    const visParams = Object.entries(group.params).filter(([p]) => hasParamValue(p));
                    if (visParams.length === 0) return;

                    const grpTr = modal.ownerDocument.createElement("tr");
                    const grpTd = modal.ownerDocument.createElement("td");
                    grpTd.colSpan = labData.length + 2;
                    grpTd.textContent = group.name;
                    grpTd.style.cssText = `padding:7px 10px 5px;font-size:11px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;color:${group.color};background:var(--background-secondary);border-top:2px solid ${group.color}40;border-bottom:1px solid var(--background-modifier-border);`;
                    grpTr.appendChild(grpTd);
                    tbody.appendChild(grpTr);

                    visParams.forEach(([param, ref]) => {
                        const tr = modal.ownerDocument.createElement("tr");
                        tr.onmouseenter = () => tr.style.background = "var(--background-modifier-hover)";
                        tr.onmouseleave = () => tr.style.background = "";

                        const tdLabel = modal.ownerDocument.createElement("td");
                        tdLabel.textContent = param.replace(/_/g, ' ');
                        tdLabel.style.cssText = "text-align:left;padding:5px 10px;border-bottom:1px solid var(--background-modifier-border);color:var(--text-normal);font-weight:500;white-space:nowrap;position:sticky;left:0;background:var(--background-primary);z-index:1;font-size:12px;";
                        tr.appendChild(tdLabel);

                        labData.forEach((entry, colIdx) => {
                            const td = modal.ownerDocument.createElement("td");
                            td.style.cssText = "padding:3px 8px;border-bottom:1px solid var(--background-modifier-border);";
                            const rawVal = entry[param];
                            const isQual = !!ref.qualitative;
                            const valInp = modal.ownerDocument.createElement("input");
                            valInp.type = isQual ? "text" : "number";
                            if (!isQual) valInp.step = "any";
                            valInp.value = (rawVal !== undefined && rawVal !== null) ? rawVal : "";
                            const numVal = isQual ? NaN : Number(String(valInp.value).replace(',', '.'));
                            const isAbnormal = !isQual && valInp.value !== "" && Number.isFinite(numVal) && (numVal < ref.min || numVal > ref.max);
                            valInp.style.cssText = `width:${isQual ? '90px' : '65px'};text-align:center;border:none;background:transparent;font-size:12px;outline:none;color:${isAbnormal ? '#e53935' : 'var(--text-normal)'};font-weight:${isAbnormal ? '700' : '400'};border-bottom:1px solid transparent;border-radius:2px;padding:1px 2px;`;
                            valInp.onfocus = () => { valInp.style.borderBottom = "1px solid var(--interactive-accent)"; valInp.style.background = "var(--background-secondary)"; };
                            valInp.onblur  = () => { valInp.style.borderBottom = "1px solid transparent"; valInp.style.background = "transparent"; };
                            valInp.onchange = () => {
                                const v = valInp.value;
                                if (v === "") delete labData[colIdx][param];
                                else labData[colIdx][param] = isQual ? v : Number(v);
                                saveNow({ "Лабораторные": labData });
                                renderLabEditor();
                            };
                            const cellWrap = modal.ownerDocument.createElement("div");
                            cellWrap.style.cssText = "display:flex;flex-direction:column;align-items:center;";
                            const valRow = modal.ownerDocument.createElement("div");
                            valRow.style.cssText = "display:flex;align-items:center;justify-content:center;gap:1px;";
                            valRow.appendChild(valInp);
                            if (colIdx === 0 && labData.length > 1 && !isQual && valInp.value !== "") {
                                const prevRaw = labData[1][param];
                                if (prevRaw !== undefined && prevRaw !== null && prevRaw !== "") {
                                    const prev = Number(String(prevRaw).replace(',', '.'));
                                    if (Number.isFinite(numVal) && Number.isFinite(prev) && Math.abs(numVal - prev) > 1e-9) {
                                        const trendEl = modal.ownerDocument.createElement("span");
                                        trendEl.textContent = numVal > prev ? "↑" : "↓";
                                        trendEl.style.cssText = `font-size:11px;font-weight:700;color:${isAbnormal ? '#e53935' : '#00897b'};line-height:1;`;
                                        valRow.appendChild(trendEl);
                                    }
                                }
                            }
                            cellWrap.appendChild(valRow);
                            if (!isQual) {
                                const range = ref.max - ref.min;
                                const bar = modal.ownerDocument.createElement("div");
                                bar.style.cssText = "height:5px;border-radius:3px;margin-top:2px;overflow:visible;min-width:65px;position:relative;background:linear-gradient(to right,rgba(239,83,80,0.45) 0%,rgba(239,83,80,0.45) 25%,rgba(67,160,71,0.45) 25%,rgba(67,160,71,0.45) 75%,rgba(239,83,80,0.45) 75%,rgba(239,83,80,0.45) 100%);";
                                if (valInp.value !== "" && Number.isFinite(numVal) && range > 0) {
                                    const pos = Math.max(2, Math.min(98, 25 + ((numVal - ref.min) / range) * 50));
                                    const ind = modal.ownerDocument.createElement("div");
                                    ind.style.cssText = `position:absolute;top:-1px;left:${pos}%;width:3px;height:7px;background:${isAbnormal ? '#e53935' : '#1b5e20'};transform:translateX(-50%);border-radius:2px;box-shadow:0 0 0 1px rgba(255,255,255,0.4);`;
                                    bar.appendChild(ind);
                                }
                                cellWrap.appendChild(bar);
                            }
                            td.appendChild(cellWrap);
                            tr.appendChild(td);
                        });

                        const tdRef = modal.ownerDocument.createElement("td");
                        tdRef.style.cssText = "padding:5px 10px;border-bottom:1px solid var(--background-modifier-border);color:var(--text-faint);font-size:11px;white-space:nowrap;vertical-align:middle;";
                        tdRef.innerHTML = ref.qualitative ? `<span style="font-style:italic;color:var(--text-faint);">кач.</span>` : `${ref.min}–${ref.max}${ref.unit ? `<br><span style="font-size:10px;">${ref.unit}</span>` : ""}`;
                        tr.appendChild(tdRef);
                        tbody.appendChild(tr);
                    });
                });

                table.appendChild(tbody);
                tableWrap.appendChild(table);
            };

            addLabBtn.onclick = () => {
                const curLabs = Array.isArray(getVal("Лабораторные")) ? [...getVal("Лабораторные")] : [];
                const isoToday = window.moment().format("YYYY-MM-DD");
                curLabs.push({ Дата: isoToday });
                saveNow({ "Лабораторные": curLabs });
                renderLabEditor();
            };

            renderLabEditor();
            clinBody.appendChild(labSec);
            clinWrap.appendChild(clinBody);
        }
    };
    renderClin();
    wrap.appendChild(clinWrap);

    // ── Плавающая кнопка закрытия (пилюля снизу) ──────────────────────────────
    const floatBar = modal.ownerDocument.createElement("div");
    floatBar.className = "pf0-float-close";
    const confirmBtn = modal.ownerDocument.createElement("button");
    confirmBtn.className = "pf0-float-close-btn";
    confirmBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><line x1="2" y1="2" x2="14" y2="14" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><line x1="14" y1="2" x2="2" y2="14" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>Закрыть`;
    confirmBtn.onclick = () => doClose();
    floatBar.appendChild(confirmBtn);
    wrap.appendChild(floatBar);
    modalBody.appendChild(wrap);
    }; // end buildForm

    initTagsMap_fn();
    buildForm();
};
_pfSetMobileDockButton(
    "editor",
    "Редактировать карту",
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
    (e) => {
        e.preventDefault();
        openPatientCardEditorModal();
    },
    "desktop"
);
editBtn.onclick = () => openPatientCardEditorModal();
}



// ============================================================
// UNIFIED WORKFLOW BLOCK
// Консультация → Принять на лечение → Разметка → Оконтуривание → Госпитализация → Выписка
// ============================================================
{
const ST_KEY = 'pf_status_' + cur.file.path;
if (!window[ST_KEY]) window[ST_KEY] = {};
const st = window[ST_KEY];
const _WF_DISCHARGED_FOLDER = (typeof DISCHARGED_FOLDER === "string" && DISCHARGED_FOLDER.trim()) ? DISCHARGED_FOLDER.trim() : "Выписаны";
const _WF_DB_EXPORT_AT_KEY = (typeof DB_EXPORT_AT_KEY === "string" && DB_EXPORT_AT_KEY.trim()) ? DB_EXPORT_AT_KEY.trim() : "db_exported_at";
const _WF_DB_EXPORT_SOURCE_KEY = (typeof DB_EXPORT_SOURCE_KEY === "string" && DB_EXPORT_SOURCE_KEY.trim()) ? DB_EXPORT_SOURCE_KEY.trim() : "db_export_source";
const _WF_TRACKED_KEYS = [
    "Дата_консультации","Консультация_завершена","Консультация_решение",
    "Принят_на_лечение","Отказ_от_лечения",
    "Разметка","Оконтуривание","Госпитализация",
    "Переразметки","Дата_переразметки","Переразметка","Переоконтуривание",
    _WF_DB_EXPORT_AT_KEY,_WF_DB_EXPORT_SOURCE_KEY
];
if (!st.__fm || typeof st.__fm !== "object") st.__fm = {};
if (!st.__path) st.__path = String(file?.path || cur.file.path || "");
const _wfUtils = window['_pfUtils_' + cur.file.path] || {
    getVal: (k) => cur[k] ?? null,
    getStoredVal: (k) => cur[k] ?? null,
    refreshStoredFrontmatter: async () => ({}),
    syncPatientToDatabase: async () => ({ ok: true }),
    removePatientFromDatabase: async () => ({ ok: true }),
    dischargeCurrentPatient: async () => ({ ok: false, reason: "missing_helper", error: new Error("Помощник выписки не найден") })
};
const _wfClone = (value) => {
    try { return JSON.parse(JSON.stringify(value)); } catch (_) { return value; }
};
const _wfHydrateFromStored = () => {
    _WF_TRACKED_KEYS.forEach(key => {
        const _val = _wfUtils.getStoredVal ? _wfUtils.getStoredVal(key) : (cur[key] ?? null);
        if (_val === undefined || _val === null || _val === "") delete st.__fm[key];
        else st.__fm[key] = _wfClone(_val);
    });
    st.__path = String(file?.path || st.__path || cur.file.path || "");
};
const _wfApplyLocal = (updates = {}) => {
    Object.entries(updates || {}).forEach(([key, value]) => {
        if (value === undefined || value === null || value === "") delete st.__fm[key];
        else st.__fm[key] = _wfClone(value);
    });
};
const _wfSetPath = (nextPath) => {
    if (nextPath) st.__path = String(nextPath);
};
const _wfFileName = () => String(file?.name || cur.file.path.split("/").pop() || "");
const _wfPathForFolder = (folder) => `${folder}/${_wfFileName()}`;
_wfHydrateFromStored();
const _wfGetStoredVal = (key) => Object.prototype.hasOwnProperty.call(st.__fm, key)
    ? st.__fm[key]
    : (_wfUtils.getStoredVal ? _wfUtils.getStoredVal(key) : (cur[key] ?? null));
const _wfCurrentPath = () => String(st.__path || file?.path || cur.file.path || "");
const _wfInFolder = (folder) => _wfCurrentPath().startsWith(folder + "/");
const _wfIsDischarged = () => _wfInFolder(_WF_DISCHARGED_FOLDER) || !!_wfGetStoredVal(_WF_DB_EXPORT_AT_KEY);
const _wfGetRemarksList = () => {
    const raw = _wfGetStoredVal("Переразметки");
    if (Array.isArray(raw) && raw.length > 0) return raw.filter(Boolean);
    if (_wfGetStoredVal("Дата_переразметки")) return [{
        Дата: _wfGetStoredVal("Дата_переразметки"),
        Переразметка: _wfGetStoredVal("Переразметка") === true,
        Переоконтуривание: _wfGetStoredVal("Переоконтуривание") === true,
        Старт_нового_плана: ""
    }];
    return [];
};
const _wfSyncState = () => {
    st["Разметка"] = _wfGetStoredVal("Разметка") === true;
    st["Оконтуривание"] = _wfGetStoredVal("Оконтуривание") === true;
    st["Госпитализация"] = _wfGetStoredVal("Госпитализация") === true;
    st["Выписка"] = _wfIsDischarged();
    const remarks = _wfGetRemarksList();
    remarks.forEach((rmk, idx) => {
        st[`Переразметка_${idx}`] = rmk.Переразметка === true;
        st[`Переоконтуривание_${idx}`] = rmk.Переоконтуривание === true;
    });
    return remarks;
};
const _wfGetContext = () => {
    const inConsult = _wfInFolder("Консультации");
    const inPatients = _wfInFolder("Пациенты");
    const inNachali = _wfInFolder("Не начали");
    const inDischarged = _wfInFolder(_WF_DISCHARGED_FOLDER);
    let consultState = null;
    if (inConsult) consultState = "pending";
    else if (inPatients && !!_wfGetStoredVal("Дата_консультации") && _wfGetStoredVal("Принят_на_лечение") !== true) consultState = "pending";
    else if ((inPatients || inDischarged) && _wfGetStoredVal("Принят_на_лечение") === true) consultState = "accepted";
    else if (inNachali && _wfGetStoredVal("Отказ_от_лечения") === true) consultState = "rejected";
    return { inConsult, inPatients, inNachali, inDischarged, consultState };
};
_wfSyncState();
const _wfCtxInit = _wfGetContext();
if (_wfCtxInit.consultState !== null || _wfCtxInit.inPatients || _wfCtxInit.inDischarged) {

const _daysWord = (n) => {
    const a = Math.abs(n), m10 = a % 10, m100 = a % 100;
    if (m100 >= 11 && m100 <= 14) return `${a} дней`;
    if (m10 === 1) return `${a} день`;
    if (m10 >= 2 && m10 <= 4) return `${a} дня`;
    return `${a} дней`;
};
const _fmtDL = (dl) => {
    if (!dl) return null;
    const w = getWorkDays(today, dl);
    const date = dl.toFormat("dd.MM");
    if (w < 0)   return { date, badge: `−${_daysWord(w)}`, c: "#ff5252" };
    if (w === 0) return { date, badge: "Сегодня",          c: "#ff9800" };
    if (w === 1) return { date, badge: "Завтра",            c: "#ff9800" };
    return              { date, badge: _daysWord(w),        c: "var(--text-muted)" };
};

const _deadlines = {
    Разметка:       _wfGetStoredVal("Дата_разметки") ? dv.date(_wfGetStoredVal("Дата_разметки")) : null,
    Оконтуривание:  start1 ? minusWorkDays(start1, 3) : null,
    Госпитализация: start1 || null,
    Выписка:        overallEnd || null,
};

const _BASE_STEPS = [
    { key: "Разметка",       label: "Разметка",       color: "#ab47bc", dlKey: "Разметка" },
    { key: "Оконтуривание",  label: "Оконтуривание",  color: "#42a5f5", dlKey: "Оконтуривание" },
    { key: "Госпитализация", label: "Госпитализация", color: "#4caf50", dlKey: "Госпитализация" },
];
const _DISCHARGE_STEP = { key: "Выписка", label: "Выписка", color: "#ff9800", dlKey: "Выписка" };
const _getWorkflowSteps = () => {
    const steps = [..._BASE_STEPS];
    if (st["Госпитализация"] || _wfIsDischarged()) steps.push(_DISCHARGE_STEP);
    return steps;
};

// ── CSS ────────────────────────────────────────────────────────────────────────
if (!document.getElementById("pf-sv3-style")) {
    const _s = document.createElement("style");
    _s.id = "pf-sv3-style";
    _s.textContent = `
    .pf-sv3-row {
        display: flex; flex-direction: row; align-items: stretch;
        gap: 0; margin-bottom: 10px; box-sizing: border-box;
        font-family: var(--font-interface); border-radius: 8px; overflow: hidden;
        border: 1px solid var(--background-modifier-border);
    }
    .pf-sv3-step {
        display: flex; align-items: center; gap: 8px;
        padding: 8px 12px; box-sizing: border-box; flex: 1; min-width: 0;
        transition: background 0.15s, border-color 0.15s;
        position: relative;
    }
    .pf-sv3-step + .pf-sv3-step { border-left: 1px solid var(--background-modifier-border); }
    .pf-sv3-step.active { cursor: pointer; }
    .pf-sv3-step.active:hover { filter: brightness(1.07); }
    .pf-sv3-step.done-state { background: color-mix(in srgb, var(--background-primary-alt) 82%, transparent); }
    .pf-sv3-step.locked { opacity: 0.38; cursor: not-allowed; }
    .pf-sv3-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
    .pf-sv3-lbl { font-size: 0.83em; font-weight: 700; flex: 1; min-width: 0;
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .pf-sv3-step.done-state.pf-sv3-terminal-action { cursor: pointer; min-height: 44px; }
    .pf-sv3-step.done-state.pf-sv3-terminal-action:hover { filter: brightness(1.07); }
    .pf-sv3-terminal-undo-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        margin-right: 8px;
        color: inherit;
        opacity: 0.86;
        pointer-events: none;
    }
    .pf-sv3-dl  { display: flex; flex-direction: column; align-items: flex-end;
        gap: 0; flex-shrink: 0; line-height: 1.25; }
    .pf-sv3-dldate  { font-size: 0.7em; color: var(--text-muted); }
    .pf-sv3-dlbadge { font-size: 0.75em; font-weight: 700; }
    .pf-sv3-dldate-full {
        font-size: 0.95em;
        font-weight: 700;
        color: var(--text-normal);
        letter-spacing: 0.01em;
    }
    .pf-sv3-inline-date {
        display: inline-block;
        margin-left: 0;
        font-size: 0.94em;
        font-weight: 700;
        letter-spacing: 0.01em;
        white-space: nowrap;
    }
    .pf-sv3-done {
        display: flex; align-items: center; justify-content: center;
        width: 36px; flex-shrink: 0; cursor: pointer; box-sizing: border-box;
        padding: 0; border: none; background: transparent;
        transition: background 0.15s;
    }
    .pf-sv3-done + .pf-sv3-step,
    .pf-sv3-done + .pf-sv3-done { border-left: 1px solid var(--background-modifier-border); }
    .pf-sv3-done:hover { filter: brightness(0.88); }
    .pf-sv3-done svg { display: block; }
    .pf-sv3-rmk-row { display: flex; flex-direction: row; align-items: stretch;
        margin-bottom: 6px; border-radius: 8px; overflow: hidden;
        border: 1px solid var(--background-modifier-border);
        font-family: var(--font-interface); }
    /* === Мобильная адаптация ≤600px === */
    @media (max-width: 600px) {
        .pf-sv3-row, .pf-sv3-rmk-row { flex-wrap: wrap; align-items: stretch; }
        .pf-sv3-row { align-content: stretch; }
        .pf-sv3-step {
            min-height: 46px;
            padding: 9px 10px;
            align-items: flex-start;
        }
        .pf-sv3-lbl {
            white-space: normal;
            overflow: visible;
            text-overflow: clip;
            line-height: 1.18;
            font-size: 0.78em;
        }
        /* Дедлайн скрываем — нет места */
        .pf-sv3-dl { display: none !important; }
        /* Кнопки консультации: каждая занимает половину строки */
        .pf-sv3-step.pf-sv3-consult { flex: 1 1 calc(50% - 1px); min-width: 0; }
        .pf-sv3-step.active:not(.pf-sv3-consult),
        .pf-sv3-step.done-state.pf-sv3-terminal-action {
            flex: 1 1 100%;
        }
        .pf-sv3-done {
            width: 40px;
            min-width: 40px;
            min-height: 46px;
        }
        /* Перенос между консультацией и этапами лечения */
        .pf-sv3-break { display: block; border-top: 1px solid var(--background-modifier-border); }
        /* Заблокированные шаги — компактные */
        .pf-sv3-step.locked { flex: 1 1 calc(50% - 1px); min-width: 0; padding: 8px 8px; }
        .pf-sv3-step.locked .pf-sv3-lbl { font-size: 0.74em; }
        .pf-sv3-terminal-undo-icon { margin-right: 6px; }
    }
    /* Перенос строки скрыт на десктопе */
    .pf-sv3-break { flex: 1 1 100%; height: 0; width: 100%; display: none; }
    `;
    document.head.appendChild(_s);
}
if (!document.getElementById("pf-sv3-confirm-style")) {
    const _cs = document.createElement("style");
    _cs.id = "pf-sv3-confirm-style";
    _cs.textContent = `
    .pf-sv3-confirm-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.58);
        z-index: 100000;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 18px;
        box-sizing: border-box;
        backdrop-filter: blur(2px);
    }
    .pf-sv3-confirm-dialog {
        width: min(560px, 100%);
        max-height: min(88vh, 760px);
        overflow: auto;
        background: var(--background-primary-alt);
        border: 1px solid var(--background-modifier-border);
        border-radius: 18px;
        box-shadow: 0 20px 60px rgba(0,0,0,0.35);
        font-family: var(--font-interface);
        color: var(--text-normal);
    }
    .pf-sv3-confirm-head {
        display: flex;
        align-items: flex-start;
        gap: 14px;
        padding: 20px 22px 14px 22px;
        border-bottom: 1px solid var(--background-modifier-border);
    }
    .pf-sv3-confirm-icon {
        width: 42px;
        height: 42px;
        border-radius: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        background: color-mix(in srgb, #ff9800 16%, transparent);
        color: #ff9800;
    }
    .pf-sv3-confirm-title {
        font-size: 18px;
        font-weight: 700;
        line-height: 1.25;
        margin: 0;
        color: var(--text-normal);
    }
    .pf-sv3-confirm-subtitle {
        margin-top: 4px;
        font-size: 12px;
        line-height: 1.45;
        color: var(--text-muted);
    }
    .pf-sv3-confirm-body {
        display: flex;
        flex-direction: column;
        gap: 12px;
        padding: 18px 22px 22px 22px;
    }
    .pf-sv3-confirm-card {
        border: 1px solid var(--background-modifier-border);
        background: var(--background-primary);
        border-radius: 14px;
        padding: 14px 16px;
    }
    .pf-sv3-confirm-main {
        font-size: 14px;
        line-height: 1.6;
        color: var(--text-normal);
        white-space: pre-line;
    }
    .pf-sv3-confirm-note {
        font-size: 12px;
        line-height: 1.55;
        color: var(--text-muted);
    }
    .pf-sv3-confirm-actions {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
        flex-wrap: wrap;
        padding-top: 4px;
    }
    .pf-sv3-confirm-btn {
        min-width: 132px;
        height: 40px;
        padding: 0 16px;
        border-radius: 10px;
        border: 1px solid var(--background-modifier-border);
        background: var(--background-primary);
        color: var(--text-normal);
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.18s ease;
    }
    .pf-sv3-confirm-btn:hover {
        transform: translateY(-1px);
        border-color: var(--interactive-accent);
    }
    .pf-sv3-confirm-btn.primary {
        border: none;
        background: linear-gradient(135deg, #ff9800 0%, #f57c00 100%);
        color: #fff;
        box-shadow: 0 10px 28px rgba(245,124,0,0.28);
    }
    .pf-sv3-confirm-btn.primary:hover {
        filter: brightness(1.05);
        box-shadow: 0 12px 30px rgba(245,124,0,0.34);
    }
    @media (max-width: 640px) {
        .pf-sv3-confirm-overlay { padding: 10px; }
        .pf-sv3-confirm-dialog {
            width: 100%;
            max-height: calc(100vh - 20px);
            border-radius: 16px;
        }
        .pf-sv3-confirm-head { padding: 16px 16px 12px 16px; }
        .pf-sv3-confirm-body { padding: 14px 16px 16px 16px; }
        .pf-sv3-confirm-actions {
            flex-direction: column-reverse;
            align-items: stretch;
        }
        .pf-sv3-confirm-btn { width: 100%; }
    }`;
    document.head.appendChild(_cs);
}

const _ICO_UNDO  = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7h10a6 6 0 0 1 0 12H3"/><polyline points="7 3 3 7 7 11"/></svg>`;
const _ICO_LOCK  = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`;
const _ICO_CHECK = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
const _ICO_CROSS = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
const _ICO_WARNING = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;

const _root = dv.el("div", "");
_root.style.cssText = "width:100%;box-sizing:border-box;margin:0;padding:0;overflow-x:clip;";
requestAnimationFrame(function() {
    var el = _root.parentElement;
    while (el && !el.classList?.contains("markdown-preview-section") && !el.classList?.contains("cm-content")) {
        el.style.setProperty("margin-left","0","important");
        el.style.setProperty("padding-left","0","important");
        el.style.setProperty("margin-right","0","important");
        el.style.setProperty("padding-right","0","important");
        el = el.parentElement;
    }
});
const _showWorkflowConfirmModal = ({
    title = "Подтверждение",
    subtitle = "",
    message = "",
    note = "",
    confirmLabel = "Подтвердить",
    cancelLabel = "Отмена"
} = {}) => new Promise(resolve => {
    const doc = _root.ownerDocument || document;
    const modalId = `pf-sv3-confirm-${String(cur.file.path || cur.file.name || "patient").replace(/[^a-zA-Z0-9_-]/g, "_")}`;
    const existing = doc.getElementById(modalId);
    if (existing) existing.remove();

    const overlay = doc.createElement("div");
    overlay.id = modalId;
    overlay.className = "pf-sv3-confirm-overlay";

    const dialog = doc.createElement("div");
    dialog.className = "pf-sv3-confirm-dialog";
    dialog.onclick = (e) => e.stopPropagation();

    const head = doc.createElement("div");
    head.className = "pf-sv3-confirm-head";
    head.innerHTML = `
        <div class="pf-sv3-confirm-icon">${_ICO_WARNING}</div>
        <div style="min-width:0;flex:1;">
            <div class="pf-sv3-confirm-title">${escapeHtml(String(title || "Подтверждение"))}</div>
            ${subtitle ? `<div class="pf-sv3-confirm-subtitle">${escapeHtml(String(subtitle))}</div>` : ""}
        </div>`;

    const body = doc.createElement("div");
    body.className = "pf-sv3-confirm-body";

    const mainCard = doc.createElement("div");
    mainCard.className = "pf-sv3-confirm-card";
    mainCard.innerHTML = `<div class="pf-sv3-confirm-main">${escapeHtml(String(message || "")).replace(/\n/g, "<br>")}</div>`;
    body.appendChild(mainCard);

    if (note) {
        const noteCard = doc.createElement("div");
        noteCard.className = "pf-sv3-confirm-card";
        noteCard.innerHTML = `<div class="pf-sv3-confirm-note">${escapeHtml(String(note || "")).replace(/\n/g, "<br>")}</div>`;
        body.appendChild(noteCard);
    }

    const actions = doc.createElement("div");
    actions.className = "pf-sv3-confirm-actions";
    const cancelBtn = doc.createElement("button");
    cancelBtn.className = "pf-sv3-confirm-btn";
    cancelBtn.textContent = cancelLabel;
    const confirmBtn = doc.createElement("button");
    confirmBtn.className = "pf-sv3-confirm-btn primary";
    confirmBtn.textContent = confirmLabel;
    actions.appendChild(cancelBtn);
    actions.appendChild(confirmBtn);
    body.appendChild(actions);

    const cleanup = (result) => {
        try { doc.removeEventListener("keydown", onKeyDown, true); } catch (_) {}
        overlay.remove();
        resolve(result);
    };
    const onKeyDown = (e) => {
        if (e.key === "Escape") {
            e.preventDefault();
            cleanup(false);
        }
        if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
            e.preventDefault();
            cleanup(true);
        }
    };

    cancelBtn.onclick = () => cleanup(false);
    confirmBtn.onclick = () => cleanup(true);
    overlay.onclick = () => cleanup(false);

    dialog.appendChild(head);
    dialog.appendChild(body);
    overlay.appendChild(dialog);
    (doc.body || document.body).appendChild(overlay);
    doc.addEventListener("keydown", onKeyDown, true);
    setTimeout(() => confirmBtn.focus(), 0);
});
// ── Утилита: переместить файл в папку ─────────────────────────────────────────
const _moveToFolder = async (targetFolder) => {
    const oldPath = _wfCurrentPath();
    const fileName = String(file?.name || cur.file.path.split("/").pop() || "");
    if (!app.vault.getAbstractFileByPath(targetFolder)) await app.vault.createFolder(targetFolder);
    const newPath = targetFolder + "/" + fileName;
    await app.fileManager.renameFile(file, newPath);
    _wfSetPath(newPath);
    if (_wfUtils.refreshStoredFrontmatter) await _wfUtils.refreshStoredFrontmatter();
    _wfSyncState();
    _render();
    _refreshWorkflowLeaves({ fromPaths: [oldPath, newPath], toPath: newPath });
    _queueWorkflowRepaint({ hydrate: true });
};

// ── Строительные блоки UI ─────────────────────────────────────────────────────

// Выполнен — компактная 36px undo-иконка
function _mkDone(color, onUndo) {
    const btn = document.createElement("div");
    btn.className = "pf-sv3-done";
    btn.title = "Откатить";
    btn.style.background = color + "18";
    btn.style.color = color;
    btn.innerHTML = _ICO_UNDO;
    btn.onclick = (e) => { e.stopPropagation(); onUndo(); };
    return btn;
}
function _mkDoneTerminal(step, deadline, onUndo, opts = {}) {
    const el = document.createElement("div");
    el.className = "pf-sv3-step done-state pf-sv3-terminal-action";
    el.style.background = step.color + "12";
    let labelText = opts.label || step.label;
    let inlineDateHtml = "";
    let dl = _fmtDL(deadline);
    if (step?.key === "Выписка" && _wfIsDischarged()) {
        const rawDischargeDate = _wfGetStoredVal(_WF_DB_EXPORT_AT_KEY) || _wfGetStoredVal("Дата_окончания_лечения");
        let fullDate = "";
        try {
            const parsed = rawDischargeDate ? dv.date(rawDischargeDate) : null;
            if (parsed?.toFormat) fullDate = parsed.toFormat("dd.MM.yyyy");
        } catch (_) {}
        if (!fullDate && deadline?.toFormat) fullDate = deadline.toFormat("dd.MM.yyyy");
        if (!fullDate && rawDischargeDate) fullDate = String(rawDischargeDate);
        labelText = "Выписан";
        inlineDateHtml = fullDate ? ` <span class="pf-sv3-inline-date" style="color:${step.color}">${fullDate}</span>` : "";
        dl = null;
    }
    el.innerHTML = `
        <span class="pf-sv3-terminal-undo-icon" aria-hidden="true">${_ICO_UNDO}</span>
        <span class="pf-sv3-dot" style="background:${step.color}"></span>
        <span class="pf-sv3-lbl" style="color:${step.color}">${labelText}${inlineDateHtml}</span>
        ${dl ? `<span class="pf-sv3-dl">
            <span class="${dl.full ? "pf-sv3-dldate pf-sv3-dldate-full" : "pf-sv3-dldate"}"${dl.full ? ` style="color:${step.color}"` : ""}>${dl.date}</span>
            ${dl.badge ? `<span class="pf-sv3-dlbadge" style="color:${dl.c}">${dl.badge}</span>` : ""}
        </span>` : ""}`;
    el.title = "Откатить";
    el.onclick = (e) => { e.stopPropagation(); onUndo(); };
    return el;
}

// Активен — полная карточка с дедлайном
function _mkActive(step, deadline, onConfirm) {
    const el = document.createElement("div");
    el.className = "pf-sv3-step active";
    el.style.background = step.color + "10";
    const dl = _fmtDL(deadline);
    el.innerHTML = `
        <span class="pf-sv3-dot" style="background:${step.color}"></span>
        <span class="pf-sv3-lbl" style="color:${step.color}">${step.label}</span>
        ${dl ? `<span class="pf-sv3-dl">
            <span class="pf-sv3-dldate">${dl.date}</span>
            <span class="pf-sv3-dlbadge" style="color:${dl.c}">${dl.badge}</span>
        </span>` : ""}`;
    el.onclick = onConfirm;
    return el;
}

// Заблокирован
function _mkLocked(step) {
    const el = document.createElement("div");
    el.className = "pf-sv3-step locked";
    el.style.background = "var(--background-primary-alt)";
    el.innerHTML = `
        <span style="display:inline-flex;align-items:center;color:var(--text-muted);flex-shrink:0;">${_ICO_LOCK}</span>
        <span class="pf-sv3-lbl" style="color:var(--text-muted)">${step.label}</span>`;
    return el;
}

// Кнопка консультации (Принять / Отказать) — ячейка-шаг в активном стиле
function _mkConsultActive(color, icon, label, onClick) {
    const el = document.createElement("div");
    el.className = "pf-sv3-step active pf-sv3-consult";
    el.style.background = color + "10";
    el.innerHTML = `
        <span style="color:${color};flex-shrink:0;display:inline-flex;align-items:center;">${icon}</span>
        <span class="pf-sv3-lbl" style="color:${color}">${label}</span>`;
    el.onclick = onClick;
    return el;
}

// ── Обработчики действий ──────────────────────────────────────────────────────

const _logHistory = (fm, действие, тип) => {
    if (!Array.isArray(fm.История_статусов)) fm.История_статусов = [];
    fm.История_статусов.push({ дата: dv.date("now").toFormat("yyyy-MM-dd'T'HH:mm"), действие, тип });
};
let _wfBusy = false;
let _wfHydrateTimer = null;
let _wfLeafRefreshTimer = null;
const _refreshWorkflow = async ({ hydrate = true } = {}) => {
    if (hydrate && _wfUtils.refreshStoredFrontmatter) await _wfUtils.refreshStoredFrontmatter();
    if (hydrate) _wfHydrateFromStored();
    _wfSyncState();
};
const _scheduleWorkflowHydrate = () => {
    if (_wfHydrateTimer) clearTimeout(_wfHydrateTimer);
    _wfHydrateTimer = setTimeout(async () => {
        if (_wfBusy) return _scheduleWorkflowHydrate();
        await _refreshWorkflow({ hydrate: true });
        _render();
    }, 250);
};
function _refreshWorkflowLeaves({ fromPaths = [], toPath = _wfCurrentPath() } = {}) {
    if (window._pfRetargetMarkdownLeaves) {
        window._pfRetargetMarkdownLeaves({ fromPaths, toPath });
        return;
    }
    const _targetPath = String(toPath || _wfCurrentPath() || file?.path || cur.file.path || "").trim();
    const _paths = Array.from(new Set(
        [...(Array.isArray(fromPaths) ? fromPaths : [fromPaths]), _targetPath, String(file?.path || ""), String(cur.file.path || "")]
            .map(p => String(p || "").trim())
            .filter(Boolean)
    ));
    if (_wfLeafRefreshTimer) clearTimeout(_wfLeafRefreshTimer);
    _wfLeafRefreshTimer = setTimeout(async () => {
        try {
            const _leaves = app.workspace?.getLeavesOfType?.("markdown") || [];
            for (const _leaf of _leaves) {
                const _view = _leaf?.view;
                const _state = _leaf?.getViewState?.() || null;
                const _stateFile = String(_state?.state?.file || "");
                const _viewFile = String(_view?.file?.path || "");
                const _matches = _paths.includes(_stateFile) || _paths.includes(_viewFile);
                if (!_matches) continue;
                let _retargeted = false;
                if (_targetPath && _state?.type === "markdown") {
                    try {
                        const _nextState = JSON.parse(JSON.stringify(_state));
                        if (!_nextState.state) _nextState.state = {};
                        _nextState.state.file = _targetPath;
                        await _leaf.setViewState?.(_nextState, { focus: false, history: false });
                        _retargeted = true;
                    } catch (_) {}
                }
                if (!_retargeted) {
                    try { _view?.previewMode?.rerender?.(true); } catch (_) {}
                    try { _view?.currentMode?.rerender?.(true); } catch (_) {}
                    try { _view?.editor?.refresh?.(); } catch (_) {}
                }
            }
            try { app.workspace?.trigger?.("layout-change"); } catch (_) {}
        } catch (_) {}
    }, 60);
}
function _queueWorkflowRepaint({ hydrate = true } = {}) {
    try {
        _wfSyncState();
        _render();
    } catch (_) {}
    try {
        requestAnimationFrame(() => {
            try {
                _wfSyncState();
                _render();
            } catch (_) {}
        });
    } catch (_) {}
    setTimeout(async () => {
        if (_wfBusy) return;
        try {
            await _refreshWorkflow({ hydrate });
            _render();
        } catch (_) {}
    }, 80);
    setTimeout(async () => {
        if (_wfBusy) return;
        try {
            await _refreshWorkflow({ hydrate: true });
            _render();
        } catch (_) {}
    }, 240);
    _refreshWorkflowLeaves({ toPath: _wfCurrentPath() });
}
const _runWorkflowAction = async (fn) => {
    if (_wfBusy) return;
    _wfBusy = true;
    try {
        await fn();
    } catch (e) {
        console.error(e);
        new Notice("❌ Ошибка: " + (e?.message ?? e));
    } finally {
        await _refreshWorkflow({ hydrate: false });
        _wfBusy = false;
        _render();
        _queueWorkflowRepaint({ hydrate: false });
        _scheduleWorkflowHydrate();
    }
};
const _rollbackDischargeIfNeeded = async ({ silent = false } = {}) => {
    if (!_wfIsDischarged()) return;
    const _rmRes = await (_wfUtils.removePatientFromDatabase
        ? _wfUtils.removePatientFromDatabase({ clearExportMark: true })
        : Promise.resolve({ ok: true }));
    if (!_rmRes?.ok) throw (_rmRes?.error || new Error("Не удалось убрать пациента из БД"));
    if (_wfInFolder(_WF_DISCHARGED_FOLDER)) {
        await _moveToFolder("Пациенты");
        _wfSetPath(_wfPathForFolder("Пациенты"));
    }
    st["Выписка"] = false;
    _wfApplyLocal({ [_WF_DB_EXPORT_AT_KEY]: null, [_WF_DB_EXPORT_SOURCE_KEY]: null });
    _queueWorkflowRepaint({ hydrate: false });
    if (!silent) new Notice("↩ Выписка отменена");
};

const handleAccept = async () => _runWorkflowAction(async () => {
    const _ctx = _wfGetContext();
    const _acceptOps = _wfCore.getAcceptTreatmentOperationOrder({
        currentFolder: _ctx.inConsult ? "Консультации" : "Пациенты",
        targetFolder: "Пациенты"
    });
    _wfApplyLocal({
        Консультация_завершена: true,
        Консультация_решение: "принят",
        Принят_на_лечение: true,
        Отказ_от_лечения: false
    });
    _queueWorkflowRepaint({ hydrate: false });
    for (const _op of _acceptOps) {
        if (_op === "moveFile") {
            await _moveToFolder("Пациенты");
            _wfSetPath(_wfPathForFolder("Пациенты"));
        } else if (_op === "patchFrontmatter") {
            const _patchFile = app.vault.getAbstractFileByPath(_wfCurrentPath()) || file;
            await app.fileManager.processFrontMatter(_patchFile, fm => {
                fm.Консультация_завершена = true;
                fm.Консультация_решение = "принят";
                fm.Принят_на_лечение = true;
                fm.Отказ_от_лечения = false;
                _logHistory(fm, "Принят на лечение", "принято");
            });
        }
    }
    _queueWorkflowRepaint({ hydrate: false });
    new Notice("✅ Пациент принят на лечение");
});

const handleReject = async () => _runWorkflowAction(async () => {
    _wfApplyLocal({
        Консультация_завершена: true,
        Консультация_решение: "отказ",
        Отказ_от_лечения: true,
        Принят_на_лечение: false
    });
    _queueWorkflowRepaint({ hydrate: false });
    await app.fileManager.processFrontMatter(file, fm => {
        fm.Консультация_завершена = true;
        fm.Консультация_решение = "отказ";
        fm.Отказ_от_лечения = true;
        fm.Принят_на_лечение = false;
        _logHistory(fm, "Отказ от лечения", "отказ");
    });
    await _moveToFolder("Не начали");
    _wfSetPath(_wfPathForFolder("Не начали"));
    _queueWorkflowRepaint({ hydrate: false });
    new Notice("🚫 Пациент отклонён");
});

const handleUndoAccept = async () => _runWorkflowAction(async () => {
    const _hadDate = !!_wfGetStoredVal("Дата_консультации");
    await _rollbackDischargeIfNeeded({ silent: true });
    const _remarks = _wfGetRemarksList();
    _remarks.forEach((_, ri) => {
        st[`Переразметка_${ri}`] = false;
        st[`Переоконтуривание_${ri}`] = false;
    });
    _wfApplyLocal({
        Консультация_завершена: false,
        Консультация_решение: null,
        Принят_на_лечение: false,
        Отказ_от_лечения: false,
        Разметка: false,
        Оконтуривание: false,
        Госпитализация: false,
        Переразметки: Array.isArray(_remarks) ? _remarks.map(r => ({ ...r, Переразметка: false, Переоконтуривание: false })) : [],
        [_WF_DB_EXPORT_AT_KEY]: null,
        [_WF_DB_EXPORT_SOURCE_KEY]: null
    });
    _queueWorkflowRepaint({ hydrate: false });
    await app.fileManager.processFrontMatter(file, fm => {
        fm.Консультация_завершена = false;
        fm.Консультация_решение = null;
        fm.Принят_на_лечение = false;
        fm.Отказ_от_лечения = false;
        fm.Разметка = false;
        fm.Оконтуривание = false;
        fm.Госпитализация = false;
        try { delete fm[_WF_DB_EXPORT_AT_KEY]; } catch (_) { fm[_WF_DB_EXPORT_AT_KEY] = null; }
        try { delete fm[_WF_DB_EXPORT_SOURCE_KEY]; } catch (_) { fm[_WF_DB_EXPORT_SOURCE_KEY] = null; }
        if (Array.isArray(fm.Переразметки)) {
            fm.Переразметки = fm.Переразметки.map(r => ({ ...r, Переразметка: false, Переоконтуривание: false }));
        }
        _logHistory(fm, "Принятие на лечение", "откат");
    });
    if (!_hadDate) {
        await _moveToFolder("Консультации");
        _wfSetPath(_wfPathForFolder("Консультации"));
    }
    _queueWorkflowRepaint({ hydrate: false });
    new Notice("↩ Откат: принятие на лечение отменено");
});

const handleUndoReject = async () => _runWorkflowAction(async () => {
    _wfApplyLocal({
        Консультация_завершена: false,
        Консультация_решение: null,
        Отказ_от_лечения: false
    });
    _queueWorkflowRepaint({ hydrate: false });
    await app.fileManager.processFrontMatter(file, fm => {
        fm.Консультация_завершена = false;
        fm.Консультация_решение = null;
        fm.Отказ_от_лечения = false;
        _logHistory(fm, "Отказ от лечения", "откат");
    });
    await _moveToFolder("Пациенты");
    _wfSetPath(_wfPathForFolder("Пациенты"));
    _queueWorkflowRepaint({ hydrate: false });
    new Notice("↩ Откат: отказ отменён, файл перемещён в Пациенты/");
});

const handleStep = async (step) => _runWorkflowAction(async () => {
    if (step.key === "Выписка") {
        const _approved = await _showWorkflowConfirmModal({
            title: "Подтверждение выписки",
            subtitle: "Финальный шаг workflow пациента",
            message: "Пациент будет выписан только после успешной записи данных в БД.\nЕсли проверка БД не пройдёт, перенос файла не выполнится.",
            note: "Порядок действий: запись в БД -> проверка строки в БД -> перенос файла в папку Выписаны.\n\nПодсказка: Ctrl+Enter — подтвердить, Esc — отмена.",
            confirmLabel: "Выписать пациента",
            cancelLabel: "Отмена"
        });
        if (!_approved) return;
        const _res = await (_wfUtils.dischargeCurrentPatient
            ? _wfUtils.dischargeCurrentPatient({ source: "template-discharge", targetFolder: _WF_DISCHARGED_FOLDER })
            : Promise.resolve({ ok: false, reason: "missing_helper", error: new Error("Помощник выписки не найден") }));
        if (!_res?.ok) throw (_res?.error || new Error("Не удалось выписать пациента"));
        _wfApplyLocal({
            [_WF_DB_EXPORT_AT_KEY]: new Date().toISOString().slice(0, 10),
            [_WF_DB_EXPORT_SOURCE_KEY]: "template-discharge"
        });
        _wfSetPath(_wfPathForFolder(_WF_DISCHARGED_FOLDER));
        st["Выписка"] = true;
        _queueWorkflowRepaint({ hydrate: false });
        new Notice("✅ Пациент выписан и внесён в БД");
        return;
    }
    _wfApplyLocal({ [step.key]: true });
    await app.fileManager.processFrontMatter(file, fm => {
        fm[step.key] = true;
        _logHistory(fm, step.label, "выполнено");
    });
    new Notice("✅ " + step.label + " выполнена");
});

const handleUndoStep = async (idx) => _runWorkflowAction(async () => {
    const _steps = _getWorkflowSteps();
    const _keys = _steps.slice(idx).map(s => s.key);
    const _remarks = _wfGetRemarksList();
    if (_keys.includes("Выписка")) await _rollbackDischargeIfNeeded({ silent: true });
    _keys.forEach(k => { if (k !== "Выписка") st[k] = false; });
    _remarks.forEach((_, ri) => {
        st[`Переразметка_${ri}`] = false;
        st[`Переоконтуривание_${ri}`] = false;
    });
    const _localReset = {};
    _keys.forEach(k => {
        if (k === "Выписка") {
            _localReset[_WF_DB_EXPORT_AT_KEY] = null;
            _localReset[_WF_DB_EXPORT_SOURCE_KEY] = null;
        } else {
            _localReset[k] = false;
        }
    });
    if (_keys.includes("Выписка")) {
        st["Выписка"] = false;
        _wfSetPath(_wfPathForFolder("Пациенты"));
    }
    _wfApplyLocal(_localReset);
    if (_keys.includes("Выписка")) _queueWorkflowRepaint({ hydrate: false });
    await app.fileManager.processFrontMatter(file, fm => {
        _keys.forEach(k => {
            if (k === "Выписка") {
                try { delete fm[_WF_DB_EXPORT_AT_KEY]; } catch (_) { fm[_WF_DB_EXPORT_AT_KEY] = null; }
                try { delete fm[_WF_DB_EXPORT_SOURCE_KEY]; } catch (_) { fm[_WF_DB_EXPORT_SOURCE_KEY] = null; }
            } else {
                fm[k] = false;
            }
        });
        if (Array.isArray(fm.Переразметки)) {
            fm.Переразметки = fm.Переразметки.map(r => ({ ...r, Переразметка: false, Переоконтуривание: false }));
        }
        _logHistory(fm, _keys.join(", "), "откат");
    });
    if (_keys.includes("Выписка")) _queueWorkflowRepaint({ hydrate: true });
    new Notice("↩ Откат: " + _keys.join(", "));
});

const _wfRegisterRefresh = window['_pfRegisterRefreshSubscriber_' + cur.file.path]
    || window['_pfRegisterRefreshSubscriber_' + String(file?.path || "")];
if (typeof _wfRegisterRefresh === "function") {
    _wfRegisterRefresh("workflow", async () => {
        if (_wfBusy) return;
        await _refreshWorkflow();
        _render();
    });
}

// ── Главная функция рендера ───────────────────────────────────────────────────
function _render() {
    _wfSyncState();
    _root.innerHTML = "";

    const mainRow = document.createElement("div");
    mainRow.className = "pf-sv3-row";
    let _rowHasContent = false;

    const _ctx = _wfGetContext();
    const _steps = _getWorkflowSteps();
    const _remarksList = _wfGetRemarksList();
    const _allStepsDone = _steps.length > 0 && _steps.every(step => st[step.key]);
    const _renderWorkflowSteps = () => {
        const _terminalDone = _allStepsDone ? _steps[_steps.length - 1] : null;
        _steps.forEach((step, idx) => {
            const prevKey  = idx > 0 ? _steps[idx-1].key : null;
            const isLocked = prevKey ? !st[prevKey] : false;
            const isTerminal = !!_terminalDone && step.key === _terminalDone.key;
            if (st[step.key]) {
                if (isTerminal) {
                    mainRow.appendChild(_mkDoneTerminal(step, _deadlines[step.dlKey], () => handleUndoStep(idx)));
                } else {
                    mainRow.appendChild(_mkDone(step.color, () => handleUndoStep(idx)));
                }
            } else if (isLocked) {
                mainRow.appendChild(_mkLocked(step));
            } else {
                mainRow.appendChild(_mkActive(step, _deadlines[step.dlKey], () => handleStep(step)));
            }
        });
    };

    if (_ctx.consultState === "pending") {
        mainRow.appendChild(_mkConsultActive("#4caf50", _ICO_CHECK, "Принять",  handleAccept));
        mainRow.appendChild(_mkConsultActive("#e53935", _ICO_CROSS, "Отказать", handleReject));
        const _brk = document.createElement("div"); _brk.className = "pf-sv3-break"; mainRow.appendChild(_brk);
        _BASE_STEPS.forEach(step => mainRow.appendChild(_mkLocked(step)));
        _rowHasContent = true;

    } else if (_ctx.consultState === "accepted") {
        mainRow.appendChild(_mkDone("#4caf50", handleUndoAccept));
        _renderWorkflowSteps();
        _rowHasContent = true;

    } else if (_ctx.consultState === "rejected") {
        mainRow.appendChild(_mkDone("#e53935", handleUndoReject));
        _BASE_STEPS.forEach(step => mainRow.appendChild(_mkLocked(step)));
        _rowHasContent = true;

    } else if (_ctx.inPatients || _ctx.inDischarged) {
        _renderWorkflowSteps();
        _rowHasContent = true;
    }

    if (_rowHasContent) _root.appendChild(mainRow);

    // ── Переразметки — если Госпитализация выполнена ──────────────────────────
    if (st.Госпитализация && _remarksList.length > 0) {
        _remarksList.forEach((rmk, idx) => {
            // Скрываем с даты начала нового плана
            if (rmk.Старт_нового_плана) {
                try {
                    const ns = dv.date(rmk.Старт_нового_плана);
                    if (ns && today >= ns.startOf("day")) return;
                } catch(e) {}
            }

            const kR = `Переразметка_${idx}`, kO = `Переоконтуривание_${idx}`;
            if (st[kR] && st[kO]) return; // оба выполнены — не показываем

            const rmkD = rmk.Дата ? dv.date(rmk.Дата) : null;
            let dlRmk = null, dlOcont = null;
            if (rmkD) {
                let _rw = rmkD.startOf("day");
                while (_rw.weekday > 5 || holidays.has(_rw.toISODate())) _rw = _rw.plus({days:1});
                let _rem = 1;
                while (_rem > 0) { _rw = _rw.plus({days:1}); if (_rw.weekday<=5&&!holidays.has(_rw.toISODate())) _rem--; }
                dlRmk = rmkD; dlOcont = _rw;
            }

            const rmkSteps = [
                { key: kR, label: _remarksList.length > 1 ? `Переразметка ${idx+1}` : "Переразметка",
                  color: "#3f51b5", dl: dlRmk,   fmKey: "Переразметка" },
                { key: kO, label: _remarksList.length > 1 ? `Переоконтуривание ${idx+1}` : "Переоконтуривание",
                  color: "#00acc1", dl: dlOcont, fmKey: "Переоконтуривание" },
            ];

            const rmkRow = document.createElement("div");
            rmkRow.className = "pf-sv3-rmk-row";

            rmkSteps.forEach((step, si) => {
                const prevRmkKey = si > 0 ? rmkSteps[si-1].key : null;
                const isLocked   = prevRmkKey ? !st[prevRmkKey] : false;
                const isDone     = st[step.key] === true;

                if (isDone) {
                    rmkRow.appendChild(_mkDone(step.color, () => {
                        rmkSteps.slice(si).forEach(s => { st[s.key] = false; });
                        app.fileManager.processFrontMatter(file, fm => {
                            if (!Array.isArray(fm.Переразметки) || !fm.Переразметки[idx]) return;
                            rmkSteps.slice(si).forEach(s => { fm.Переразметки[idx][s.fmKey] = false; });
                        });
                        new Notice("↩ Откат: " + step.label);
                        _render();
                    }));
                } else if (isLocked) {
                    rmkRow.appendChild(_mkLocked(step));
                } else {
                    rmkRow.appendChild(_mkActive(step, step.dl, () => {
                        st[step.key] = true;
                        app.fileManager.processFrontMatter(file, fm => {
                            if (!Array.isArray(fm.Переразметки)) fm.Переразметки = [];
                            if (!fm.Переразметки[idx]) fm.Переразметки[idx] = {};
                            fm.Переразметки[idx][step.fmKey] = true;
                        });
                        new Notice("✅ " + step.label);
                        _render();
                    }));
                }
            });

            _root.appendChild(rmkRow);
        });
    }
}

_render();
} // end workflow visibility guard
}

// ============================================================
// ЧАТ С ИИ — модальное окно (как редактор карты)
// ============================================================
{
const _CHAT_AI_KEY_LS = "or_api_key";
const _CHAT_LITELLM_KEY_LS = "litellm_api_key";
const _CHAT_PROVIDER_LS = "ai_provider";
const _CHAT_MODEL_LS  = "or_chat_model";
const _CHAT_MODELS = [
    { id: "google/gemini-3-flash-preview", label: "Gemini 3 Flash" },
    { id: "deepseek/deepseek-v4-pro", label: "DeepSeek V4 Pro" },
    { id: "deepseek/deepseek-v4-flash", label: "DeepSeek V4 Flash" },
    { id: "qwen/qwen3.6-plus", label: "Qwen 3.6 Plus" },
    { id: "moonshotai/kimi-k2.5", label: "Kimi K2.5" },
];
const _CHAT_PROVIDERS = [
    { id: "openrouter", label: "OpenRouter", endpoint: "https://openrouter.ai/api/v1/chat/completions", keyStorage: _CHAT_AI_KEY_LS },
    { id: "litellm", label: "LiteLLM", endpoint: "http://212.86.115.215:4000/v1/chat/completions", keyStorage: _CHAT_LITELLM_KEY_LS }
];
const _CHAT_DEFAULT_MODEL = "google/gemini-3-flash-preview";
const _getChatProvider = () => localStorage.getItem(_CHAT_PROVIDER_LS) || "openrouter";
const _getChatProviderInfo = (providerId = _getChatProvider()) => _CHAT_PROVIDERS.find(item => item.id === providerId) || _CHAT_PROVIDERS[0];
const _getChatKey = (providerId = _getChatProvider()) => localStorage.getItem(_getChatProviderInfo(providerId).keyStorage) || "";
const _getChatModel = () => localStorage.getItem(_CHAT_MODEL_LS) || _CHAT_DEFAULT_MODEL;
const _getChatProviderModelId = (model, providerId = _getChatProvider()) => {
    const cleanModel = String(model || _CHAT_DEFAULT_MODEL).replace(/^openrouter\//, "");
    return providerId === "litellm" ? `openrouter/${cleanModel}` : cleanModel;
};
const _getChatProviderRequestConfig = (model, providerId = _getChatProvider()) => {
    const provider = _getChatProviderInfo(providerId);
    return {
        providerId: provider.id,
        endpoint: provider.endpoint,
        key: _getChatKey(provider.id),
        modelId: _getChatProviderModelId(model, provider.id)
    };
};
const _chatUtils = window['_pfUtils_' + cur.file.path] || { saveNow: async ()=>{}, getVal: (k)=>cur[k] ?? null, getStoredVal: (k)=>cur[k] ?? null, refreshStoredFrontmatter: async ()=>({}) };
const _chatGetVal = (key) => _chatUtils.getVal ? _chatUtils.getVal(key) : (cur[key] ?? null);
const _chatGetStoredVal = (key) => _chatUtils.getStoredVal ? _chatUtils.getStoredVal(key) : (cur[key] ?? null);
let _chatHist = Array.isArray(_chatGetStoredVal("Чат_история")) ? [..._chatGetStoredVal("Чат_история")] : [];
let _isAiTyping = false;

// Стили для чата
const _chatStyleId = "ai-chat-styles-v4";
{ const _old = document.getElementById("ai-chat-styles-v3"); if (_old) _old.remove(); }
if (!document.getElementById(_chatStyleId)) {
    const s = document.createElement("style"); s.id = _chatStyleId;
    s.textContent = `
        .ai-chat-open-btn { display:flex; align-items:center; gap:12px; flex:1 1 0; min-width:0; background:var(--background-primary-alt); border:1px solid var(--background-modifier-border); border-radius:12px; padding:0 18px; height:52px; cursor:pointer; transition:all 0.2s; font-family:var(--font-interface); color:var(--text-normal); box-sizing:border-box; line-height:1; }
        .ai-chat-open-btn:hover { border-color:#6200ea; background:var(--background-modifier-hover); box-shadow:0 0 0 3px rgba(98,0,234,0.12); }
        .ai-chat-open-icon { font-size:18px; flex-shrink:0; display:flex; align-items:center; justify-content:center; width:34px; height:34px; border-radius:8px; background:rgba(98,0,234,0.12); line-height:1; }
        .ai-chat-open-label { font-size:14px; font-weight:600; flex:1; text-align:left; line-height:1; background:linear-gradient(90deg,#6200ea,#b388ff); -webkit-background-clip:text; -webkit-text-fill-color:transparent; }
        .ai-chat-open-arrow { color:var(--text-muted); font-size:15px; flex-shrink:0; transition:transform 0.2s; display:flex; align-items:center; line-height:1; }
        .ai-chat-open-btn:hover .ai-chat-open-arrow { transform:translateX(4px); color:#6200ea; }
        .ai-chat-overlay { overflow:hidden; padding-top:max(8px, env(safe-area-inset-top, 0px)); box-sizing:border-box; height:100dvh; }
        .ai-chat-modal { display:flex; flex-direction:column; flex:1 1 auto; min-height:0; max-height:100%; }
        .ai-chat-header { padding:14px 16px 12px; gap:10px; cursor:default; }
        .ai-chat-header-right { display:flex; align-items:center; gap:6px; flex-shrink:0; }
        .ai-chat-head-btn {
            width:34px; height:34px; border-radius:50%; border:none; flex-shrink:0;
            display:flex; align-items:center; justify-content:center; cursor:pointer;
            background:var(--background-modifier-border); color:var(--text-muted); transition:all 0.2s;
        }
        .ai-chat-head-btn:hover { background:rgba(98,0,234,0.14); color:#6200ea; }
        .ai-chat-close-btn:hover { background:rgba(229,57,53,0.18); color:#e53935; }
        .ai-chat-title-text { min-width:0; }
        .ai-chat-hist { flex:1; overflow-y:auto; display:flex; flex-direction:column; gap:12px; padding:16px 20px; }
        .ai-msg-u { align-self:flex-end; max-width:85%; background:linear-gradient(135deg,#6200ea,#9c27b0); color:#fff; border-radius:14px 14px 0 14px; padding:10px 14px; font-size:13px; line-height:1.4; box-shadow:0 4px 12px rgba(98,0,234,0.25); word-break:break-word; }
        .ai-msg-a { align-self:flex-start; max-width:85%; background:var(--background-secondary); border:1px solid var(--background-modifier-border); color:var(--text-normal); border-radius:14px 14px 14px 0; padding:12px 16px; font-size:13px; line-height:1.5; box-shadow:0 4px 12px rgba(0,0,0,0.05); word-break:break-word; }
        .ai-msg-a pre, .ai-msg-a table { max-width:100%; overflow-x:auto; display:block; }
        .ai-msg-a code { word-break:break-word; white-space:pre-wrap; }
        .ai-msg-a p:last-child, .ai-msg-u p:last-child { margin-bottom:0; }
        .ai-chat-footer {
            flex-shrink:0;
            display:flex;
            flex-direction:column;
            gap:8px;
            padding:0 16px calc(env(safe-area-inset-bottom, 0px) + 14px);
            background:linear-gradient(180deg, rgba(0,0,0,0) 0%, color-mix(in srgb, var(--background-primary-alt) 92%, transparent) 22%);
        }
        .ai-chat-footer-top { display:flex; align-items:center; justify-content:space-between; gap:8px; }
        .ai-chat-model-select {
            height:32px; min-width:0; max-width:220px;
            padding:0 8px; border-radius:8px; border:1px solid var(--background-modifier-border);
            background:var(--background-primary); color:var(--text-muted); font-size:12px; cursor:pointer; outline:none;
        }
        .ai-chat-error { font-size:12px; display:none; font-weight:600; padding:7px 10px; border-radius:10px; background:rgba(244,67,54,0.1); flex-shrink:0; }
        .ai-chat-inp-wrap { display:flex; align-items:center; gap:8px; background:var(--background-secondary); padding:8px 10px; border-radius:12px; border:1px solid var(--background-modifier-border); transition:all 0.2s; flex-shrink:0; margin:0; }
        .ai-chat-inp-wrap:focus-within { border-color:#6200ea; box-shadow:0 0 0 2px rgba(98,0,234,0.15); background:var(--background-primary); }
        .ai-chat-inp { flex:1; border:none; background:transparent; font-size:14px; outline:none; color:var(--text-normal); padding:4px; min-width:0; }
        .ai-send-btn { width:36px; height:36px; border-radius:10px; background:#6200ea; color:#fff; border:none; display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:16px; transition:transform 0.1s, opacity 0.2s; box-shadow:0 2px 8px rgba(98,0,234,0.4); flex-shrink:0; }
        .ai-send-btn:active { transform:scale(0.92); }
        .ai-send-btn[disabled] { opacity:0.5; cursor:not-allowed; }
        @keyframes ai-pulse { 0%,100%{opacity:0.4;transform:translateY(0);} 50%{opacity:1;transform:translateY(-3px);} }
        .ai-typing { display:flex; align-items:center; gap:4px; padding:10px 16px; background:var(--background-secondary); border-radius:14px 14px 14px 0; align-self:flex-start; }
        .ai-typing span { display:inline-block; width:6px; height:6px; background:#6200ea; border-radius:50%; animation:ai-pulse 0.8s infinite; }
        .ai-typing span:nth-child(2){animation-delay:0.15s;} .ai-typing span:nth-child(3){animation-delay:0.3s;}
        .ai-scan-context-info { font-size:11px; color:#4caf50; display:flex; align-items:center; gap:6px; padding:0 20px 4px; flex-shrink:0; opacity:0.9; }
        @media (max-width: 640px) {
            .ai-chat-open-btn { flex: none; width: 100%; }
            .ai-chat-modal { border-radius:18px 18px 0 0; height:100%; }
            .ai-chat-header { padding:12px 14px 10px; }
            .ai-chat-title-text { font-size:15px; }
            .ai-chat-header-right { gap:4px; }
            .ai-chat-head-btn { width:36px; height:36px; }
            .ai-chat-hist { padding:12px 14px; gap:10px; }
            .ai-msg-u, .ai-msg-a { max-width:92%; font-size:13px; }
            .ai-chat-footer { padding:0 12px calc(env(safe-area-inset-bottom, 0px) + 10px); gap:6px; }
            .ai-chat-footer-top { flex-wrap:wrap; align-items:stretch; gap:6px; }
            .ai-chat-model-select { width:100%; max-width:none; height:34px; font-size:12px; }
            .ai-chat-inp-wrap { padding:7px 8px; gap:6px; border-radius:14px; }
            .ai-chat-inp { font-size:16px; padding:6px 4px; }
            .ai-send-btn { width:40px; height:40px; border-radius:12px; }
            .ai-scan-context-info { padding:0 14px 6px; }
        }
        @media (max-width: 380px) {
            .ai-chat-header { padding:10px 12px 8px; }
            .ai-chat-hist { padding:10px 12px; }
            .ai-chat-footer { padding:0 10px calc(env(safe-area-inset-bottom, 0px) + 8px); }
        }
    `;
    document.head.appendChild(s);
}

// Анонимизация
const _anonymizeCtx = (txt) => {
    let s = txt;
    s = s.replace(/\d{3}[\s\-]\d{3}[\s\-]\d{3}[\s\-]\d{2}|\b\d{11}\b/g, "[SNILS]");
    s = s.replace(/(?:\+7|8)[\s\-\(]?\(?\d{3}\)?[\s\-]?\d{3}[\s\-]?\d{2}[\s\-]?\d{2}/g, "[PHONE]");
    const fio = _chatGetStoredVal("ФИО") || "";
    if (fio) s = s.replace(new RegExp(fio.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), "[PATIENT_NAME]");
    else s = s.replace(/[\u0410-\u042f\u0401][\u0430-\u044f\u0451]+\s+[\u0410-\u042f\u0401][\u0430-\u044f\u0451]+\s+[\u0410-\u042f\u0401][\u0430-\u044f\u0451]+/g, "[PATIENT_NAME]");
    return s;
};

const _getExtContext = () => {
    let ctx = [];
    if (typeof overallEnd !== 'undefined' && overallEnd) {
        ctx.push(`(Авто-расчет) Дата окончания текущего плана лечения: ${overallEnd.toFormat("dd.MM.yyyy")}`);
    }
    let r = _chatGetStoredVal("Связанные_случаи");
    if (r) {
        if (!Array.isArray(r)) r = [r];
        const names = r.map(x => String(x).replace(/^\[\[/, "").replace(/\]\]$/, "").split("|")[0]);
        let linkData = [];
        names.forEach(n => {
            const p = dv.pages().find(pg => pg.file.name === n);
            if (p) {
                linkData.push(`- Случай [${n}]: Диагноз/Этап: ${p["Диагноз"]||"Нет"}, Лечение начато: ${p["Дата_начала_лечения"]||"Нет"}, Фракций ХЛТ: ${p["Количество_фракций"]||"Нет"}`);
            }
        });
        if (linkData.length > 0) {
            ctx.push(`ПРОШЛЫЕ/СВЯЗАННЫЕ СЛУЧАИ ПАЦИЕНТА:\n${linkData.join("\n")}`);
        }
    }
    return ctx.join("\n\n");
};

const _CHAT_MODAL_ID = 'ai-chat-modal-' + String(cur.file.path).replace(/[^a-zA-Z0-9_-]/g, "_").toLowerCase();

const _openChatModal = () => {
    if (document.getElementById(_CHAT_MODAL_ID)) return;

    const overlay = document.createElement('div');
    overlay.id = _CHAT_MODAL_ID;
    overlay.className = 'pf0-overlay ai-chat-overlay';

    const _chatCleanup = [];
    const _addChatCleanup = (fn) => { if (typeof fn === 'function') _chatCleanup.push(fn); };
    const _isMobileChatViewport = () => window.matchMedia ? window.matchMedia('(max-width: 640px)').matches : window.innerWidth <= 640;
    const doClose = () => {
        while (_chatCleanup.length) {
            const fn = _chatCleanup.pop();
            try { fn(); } catch (_) {}
        }
        overlay.remove();
        document.removeEventListener('keydown', onEsc);
    };
    overlay.addEventListener('click', e => {
        if (e.target === overlay && !_isMobileChatViewport()) doClose();
    });
    const onEsc = e => { if (e.key === 'Escape') { e.preventDefault(); doClose(); } };
    document.addEventListener('keydown', onEsc);

    const modal = document.createElement('div');
    modal.className = 'pf0-modal ai-chat-modal';

    // Заголовок
    const header = document.createElement('div');
    header.className = 'pf0-modal-header ai-chat-header';
    const title = document.createElement('div');
    title.className = 'pf0-modal-title ai-chat-title-text';
    title.innerHTML = '✨ Умный медицинский ИИ';
    title.style.cssText = 'background:linear-gradient(90deg,#6200ea,#b388ff);-webkit-background-clip:text;-webkit-text-fill-color:transparent;';

    // Кнопка удаления чата (корзина) в хедере
    const clearBtn = document.createElement('button');
    clearBtn.className = 'ai-chat-head-btn ai-chat-clear-btn';
    clearBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>`;
    clearBtn.title = 'Очистить чат';
    clearBtn.onclick = async (e) => {
        e.stopPropagation();
        _chatHist = [];
        await _chatUtils.saveNow({ "Чат_история": [] });
        renderHist();
    };

    const closeBtn = document.createElement('button');
    closeBtn.className = 'pf0-modal-close ai-chat-head-btn ai-chat-close-btn';
    closeBtn.innerHTML = '<svg width="13" height="13" viewBox="0 0 13 13" fill="none"><line x1="1.35" y1="1.35" x2="11.65" y2="11.65" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="11.65" y1="1.35" x2="1.35" y2="11.65" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
    closeBtn.title = 'Закрыть (Esc)';
    closeBtn.onclick = (e) => { e.stopPropagation(); doClose(); };

    const rightBtns = document.createElement('div');
    rightBtns.className = 'ai-chat-header-right';
    rightBtns.appendChild(clearBtn);
    rightBtns.appendChild(closeBtn);

    header.appendChild(title);
    header.appendChild(rightBtns);
    modal.appendChild(header);

    // История чата (скроллируемая область)
    const hist = document.createElement('div');
    hist.className = 'ai-chat-hist';

    const renderHist = () => {
        hist.innerHTML = '';
        clearBtn.style.display = _chatHist.length === 0 ? 'none' : 'flex';
        if (_chatHist.length === 0) {
            hist.innerHTML = `<div style="text-align:center;padding:48px 0;opacity:0.6;">
                <span style="font-size:48px;display:block;margin-bottom:12px;">🤖</span>
                <span style="font-size:15px;font-weight:600;color:var(--text-normal);">Я готов проанализировать эту карту!</span><br/>
                <span style="font-size:12px;color:var(--text-muted);">Задайте любой вопрос или попросите суммаризовать данные</span>
            </div>`;
        } else {
            _chatHist.forEach(m => {
                const b = document.createElement('div');
                b.className = m.role === 'user' ? 'ai-msg-u' : 'ai-msg-a';
                b.innerHTML = m.role === 'user' ? m.content : (window.marked?.parse(m.content) || m.content);
                hist.appendChild(b);
            });
        }
        if (_isAiTyping) {
            const tv = document.createElement('div');
            tv.className = 'ai-typing';
            tv.innerHTML = '<span></span><span></span><span></span>';
            hist.appendChild(tv);
        }
        setTimeout(() => { hist.scrollTop = hist.scrollHeight; }, 30);
    };
    renderHist();
    modal.appendChild(hist);

    // Индикатор контекста
    const extCtxStr = _getExtContext();
    if (extCtxStr.length > 5) {
        const ctxInfo = document.createElement('div');
        ctxInfo.className = 'ai-scan-context-info';
        ctxInfo.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg> Сканирует связанные госпитализации и расчеты`;
        modal.appendChild(ctxInfo);
    }

    // Ввод сообщения (адаптированный footer)
    const footer = document.createElement('div');
    footer.className = 'ai-chat-footer';

    const footerTop = document.createElement('div');
    footerTop.className = 'ai-chat-footer-top';

    const inputRow = document.createElement('div');
    inputRow.className = 'ai-chat-inp-wrap';

    const inp = document.createElement('input');
    inp.className = 'ai-chat-inp';
    inp.type = 'text';
    inp.inputMode = 'text';
    inp.enterKeyHint = 'send';
    inp.autocomplete = 'off';
    inp.placeholder = 'Спросить про пациента или план лечения...';

    const modelSel = document.createElement('select');
    modelSel.className = 'ai-chat-model-select';
    _CHAT_MODELS.forEach(m => {
        const o = document.createElement('option'); o.value = m.id; o.textContent = m.label;
        if (_getChatModel() === m.id) o.selected = true;
        modelSel.appendChild(o);
    });
    modelSel.onchange = () => localStorage.setItem(_CHAT_MODEL_LS, modelSel.value);

    const providerSel = document.createElement('select');
    providerSel.className = 'ai-chat-provider-select';
    _CHAT_PROVIDERS.forEach(provider => {
        const o = document.createElement('option'); o.value = provider.id; o.textContent = provider.label;
        if (_getChatProvider() === provider.id) o.selected = true;
        providerSel.appendChild(o);
    });
    providerSel.onchange = () => localStorage.setItem(_CHAT_PROVIDER_LS, providerSel.value);

    const sendBtn = document.createElement('button');
    sendBtn.className = 'ai-send-btn';
    sendBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>`;

    const errEl = document.createElement('div');
    errEl.className = 'ai-chat-error';
    const showErr = (msg) => { errEl.textContent = msg; errEl.style.color = '#f44336'; errEl.style.display = 'block'; setTimeout(() => errEl.style.display = 'none', 5000); };
    const _scrollChatToBottom = (delay = 40) => setTimeout(() => { hist.scrollTop = hist.scrollHeight; }, delay);

    const doSend = async () => {
        const q = inp.value.trim();
        if (!q) return;
        const key = _getChatKey(providerSel.value);
        if (!key) { showErr("⚠️ Откройте главные настройки чтобы сохранить API-ключ"); return; }
        await _chatUtils.refreshStoredFrontmatter?.();

        inp.value = ''; inp.disabled = true; sendBtn.disabled = true;
        _chatHist.push({ role: 'user', content: q });
        _isAiTyping = true;
        renderHist();
        _scrollChatToBottom(20);

        try {
            const coreCtxRaw = [
                `МКБ: ${_chatGetVal("МКБ 10") || ""}`,
                `Диагноз: ${_chatGetVal("Диагноз") || ""}`,
                _chatGetVal("Анамнез_заболевания") ? `Анамнез: ${_chatGetVal("Анамнез_заболевания")}` : "",
                _chatGetVal("Описания_исследований") ? `Исследования: ${_chatGetVal("Описания_исследований")}` : "",
                _chatGetVal("Решение_консилиума") ? `Консилиум: ${_chatGetVal("Решение_консилиума")}` : "",
            ].filter(Boolean).join("\n");

            let finalCtx = _anonymizeCtx(coreCtxRaw);
            const ext = _getExtContext();
            if (ext) finalCtx += "\n\n" + ext;

            const providerCfg = _getChatProviderRequestConfig(modelSel.value || _getChatModel(), providerSel.value);
            const resp = await fetch(providerCfg.endpoint, {
                method: "POST",
                headers: { "Authorization": `Bearer ${providerCfg.key}`, "Content-Type": "application/json" },
                body: JSON.stringify({
                    model: providerCfg.modelId,
                    messages: [
                        { role: "system", content: `Ты — медицинский ИИ-ассистент врача-онколога. Отвечай кратко, емко, и опираясь ТОЛЬКО на предоставленный контекст карты пациента и связанных случаев. Если данных нет, так и скажи. Форматируй ответ с помощью Markdown (используй списки и выделение жирным шрифтом где необходимо)\n\nКОНТЕКСТ:\n${finalCtx}` },
                        ..._chatHist.slice(-15)
                    ]
                })
            });
            if (!resp.ok) { const et = await resp.text(); throw new Error(`HTTP ${resp.status}: ${et.slice(0,100)}`); }
            const rj = await resp.json();
            const aiMsg = rj?.choices?.[0]?.message?.content || "";

            _chatHist.push({ role: 'assistant', content: aiMsg });
            await _chatUtils.saveNow({ "Чат_история": _chatHist });
        } catch (e) {
            _chatHist.push({ role: 'assistant', content: "❌ Ошибка: " + e.message });
        }

        _isAiTyping = false;
        inp.disabled = false; sendBtn.disabled = false;
        renderHist();
        setTimeout(() => inp.focus(), 50);
    };
    sendBtn.onclick = doSend;
    inp.onkeydown = e => { if (e.key === 'Enter') doSend(); };
    inp.onfocus = () => { _scheduleChatViewportSync(); _scrollChatToBottom(70); };
    inp.onblur = () => { setTimeout(_scheduleChatViewportSync, 120); };
    modelSel.onfocus = () => { _scheduleChatViewportSync(); _scrollChatToBottom(50); };
    modelSel.onblur = () => { setTimeout(_scheduleChatViewportSync, 120); };

    inputRow.appendChild(inp);
    inputRow.appendChild(sendBtn);
    footerTop.appendChild(providerSel);
    footerTop.appendChild(modelSel);
    footer.appendChild(errEl);
    footer.appendChild(footerTop);
    footer.appendChild(inputRow);

    modal.appendChild(footer);

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    setTimeout(() => inp.focus(), 100);

    // ── Мобильная клавиатура: поднимаем чат при открытии ─────────────────────
    const _vk = (typeof navigator !== 'undefined' && navigator.virtualKeyboard) ? navigator.virtualKeyboard : null;
    if (_vk) {
        try { _vk.overlaysContent = true; } catch (_) {}
    }
    const _getViewportOverlap = () => {
        const vv = window.visualViewport || null;
        if (!vv) return 0;
        return Math.max(0, Math.floor(window.innerHeight - ((vv.height || window.innerHeight) + (vv.offsetTop || 0))));
    };
    const _getKeyboardInset = () => {
        const overlap = _getViewportOverlap();
        const vkInset = (_vk && _vk.boundingRect && Number.isFinite(_vk.boundingRect.height))
            ? Math.max(0, Math.floor(_vk.boundingRect.height || 0))
            : 0;
        const activeInput = document.activeElement === inp;
        const fallbackInset = (activeInput && overlap === 0 && vkInset === 0)
            ? Math.round(Math.min(320, Math.max(220, window.innerHeight * 0.34)))
            : 0;
        const totalInset = Math.max(overlap, vkInset, fallbackInset);
        return {
            overlap,
            extraInset: Math.max(0, totalInset - overlap),
            totalInset
        };
    };
    const _syncChatViewport = () => {
        if (!document.body.contains(overlay)) return;
        const isMobileChat = _isMobileChatViewport();
        if (!isMobileChat) {
            overlay.style.top = '';
            overlay.style.bottom = '';
            overlay.style.height = '';
            overlay.style.paddingTop = '';
            overlay.style.paddingBottom = '';
            modal.style.height = '';
            modal.style.maxHeight = '';
            modal.style.paddingBottom = '';
            footer.style.position = '';
            footer.style.bottom = '';
            _scrollChatToBottom(60);
            return;
        }
        const vv = window.visualViewport || null;
        const viewportTop = vv && Number.isFinite(vv.offsetTop) ? Math.max(0, Math.floor(vv.offsetTop)) : 0;
        const viewportHeight = vv && Number.isFinite(vv.height) ? Math.max(180, Math.floor(vv.height)) : window.innerHeight;
        const keyboardState = _getKeyboardInset();
        overlay.style.top = `${viewportTop}px`;
        overlay.style.bottom = 'auto';
        overlay.style.height = `${viewportHeight}px`;
        overlay.style.paddingTop = 'max(8px, env(safe-area-inset-top, 0px))';
        overlay.style.paddingBottom = `calc(env(safe-area-inset-bottom, 0px) + ${keyboardState.extraInset}px)`;
        modal.style.height = '100%';
        modal.style.maxHeight = '100%';
        modal.style.paddingBottom = '';
        footer.style.position = keyboardState.totalInset > 0 ? 'sticky' : '';
        footer.style.bottom = keyboardState.totalInset > 0 ? '0' : '';
        if (keyboardState.totalInset > 0) {
            setTimeout(() => {
                try { inputRow.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (_) {}
                _scrollChatToBottom(40);
            }, 30);
        }
        _scrollChatToBottom(60);
    };
    const _scheduleChatViewportSync = () => {
        _syncChatViewport();
        setTimeout(_syncChatViewport, 90);
        setTimeout(_syncChatViewport, 260);
        setTimeout(_syncChatViewport, 520);
    };
    _scheduleChatViewportSync();
    if (window.visualViewport) {
        const _onVV = () => _scheduleChatViewportSync();
        window.visualViewport.addEventListener('resize', _onVV);
        window.visualViewport.addEventListener('scroll', _onVV);
        _addChatCleanup(() => {
            try { window.visualViewport.removeEventListener('resize', _onVV); } catch (_) {}
            try { window.visualViewport.removeEventListener('scroll', _onVV); } catch (_) {}
        });
    }
    if (_vk && typeof _vk.addEventListener === 'function') {
        const _onVk = () => _scheduleChatViewportSync();
        _vk.addEventListener('geometrychange', _onVk);
        _addChatCleanup(() => {
            try { _vk.removeEventListener('geometrychange', _onVk); } catch (_) {}
        });
    }
    const _onOrient = () => _scheduleChatViewportSync();
    window.addEventListener('orientationchange', _onOrient, { passive: true });
    _addChatCleanup(() => {
        try { window.removeEventListener('orientationchange', _onOrient, { passive: true }); } catch (_) {}
    });
};

// Кнопка открытия чата (такая же как "Редактировать карту")
const _chatBtn = document.createElement("button");
_chatBtn.className = "ai-chat-open-btn";
_chatBtn.innerHTML = `<span class="ai-chat-open-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M8 10h.01"/><path d="M12 10h.01"/><path d="M16 10h.01"/></svg></span><span class="ai-chat-open-label">ИИ Чат</span><span class="ai-chat-open-arrow"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg></span>`;
_chatBtn.onclick = _openChatModal;
_pfSetMobileDockButton(
    "chat",
    "ИИ чат",
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M8 10h.01"/><path d="M12 10h.01"/><path d="M16 10h.01"/></svg>`,
    (e) => {
        e.preventDefault();
        _openChatModal();
    },
    "desktop"
);
const _btnRow = window['_pfBtnRow_' + cur.file.path];
if (_btnRow) _btnRow.appendChild(_chatBtn);
else { const _fallback = dv.el("div", ""); _fallback.appendChild(_chatBtn); }
}

// ============================================================
// БЛОК 1: КАРТА ПАЦИЕНТА
// ============================================================
{
// ВИЗУАЛ
// ============================================================
const patientCardFundingLabel = (fundRaw) => {
    const compact = String(fundRaw || "").replace(/\s+/g, " ").trim();
    const f = compact.toLowerCase();
    if (!f) return "";
    if (f.includes("омс")) return "ОМС";
    if (f.includes("пму")) return "ПМУ";
    if (f.includes("дмс")) return "ДМС";
    if (f.includes("мэс")) {
        const match = compact.match(/(?:мэс\D*)(\d+)/iu) || compact.match(/(\d+)\D*мэс/iu);
        return match ? `МЭС ${match[1]}` : "МЭС";
    }
    if (f.includes("вмп") || f.includes("группа")) {
        const tariff = (compact.match(/(?:вмп\D*)(\d+)/iu) || compact.match(/\((\d+)\)/u) || compact.match(/\b(200|300)\b/u))?.[1] || "";
        const group = (compact.match(/группа\s*(\d+)/iu) || compact.match(/групп[аы]\s*(\d+)/iu))?.[1] || "";
        if (tariff && group) return `ВМП ${tariff} (Группа ${group})`;
        if (tariff) return `ВМП ${tariff}`;
        if (group) return `ВМП (Группа ${group})`;
        return "ВМП";
    }
    return compact;
};

// ── Утилита статусной пилюли ─────────────────────────────────────────────────
const _mkStatusPill = (dotColor, label, bg, textColor) =>
    `<span style="display:inline-flex;align-items:center;gap:5px;padding:2px 9px 2px 7px;border-radius:20px;font-size:0.82em;font-weight:700;background:${bg};color:${textColor};border:1px solid ${dotColor}40;white-space:nowrap;">` +
    `<span style="width:7px;height:7px;border-radius:50%;background:${dotColor};flex-shrink:0;display:inline-block;"></span>${label}</span>`;

// Пилюля текущего этапа
const stagePill = (() => {
    const _sRmkList = (() => {
        const r = cur.Переразметки;
        if (Array.isArray(r) && r.length > 0) return r.filter(Boolean);
        if (cur.Дата_переразметки) return [{ Переразметка: cur.Переразметка === true, Переоконтуривание: cur.Переоконтуривание === true }];
        return [];
    })();
    if (cur.Госпитализация === true) {
        // Есть незавершённые переразметки?
        const pendingRmk = _sRmkList.find((r, i) => !r.Переразметка);
        const pendingRecontour = _sRmkList.find((r, i) => r.Переразметка && !r.Переоконтуривание);
        if (pendingRmk)
            return _mkStatusPill("#3f51b5", "Переразметка", "rgba(63,81,181,0.12)", "#3f51b5");
        if (pendingRecontour)
            return _mkStatusPill("#00838f", "Переоконтуривание", "rgba(0,131,143,0.12)", "#00838f");
        if (treatmentStatus === "Завершено")
            return _mkStatusPill("#1565c0", "Завершено", "rgba(21,101,192,0.1)", "#1565c0");
        return _mkStatusPill("#2e7d32", "В процессе", "rgba(76,175,80,0.12)", "#2e7d32");
    }
    if (cur.Оконтуривание === true)
        return _mkStatusPill("#757575", "Ожидание", "rgba(158,158,158,0.12)", "var(--text-muted)");
    if (cur.Разметка === true)
        return _mkStatusPill("#0277bd", "Оконтуривание", "rgba(66,165,245,0.12)", "#0277bd");
    if (cur.Дата_разметки)
        return _mkStatusPill("#7b1fa2", "Разметка", "rgba(171,71,188,0.12)", "#7b1fa2");
    return _mkStatusPill("#9e9e9e", "Не начато", "rgba(150,150,150,0.1)", "var(--text-muted)");
})();

const fio = cur.ФИО || "ФИО не указано";
let ageStr = "";
if (cur.Дата_рождения) {
    const d = dv.date(cur.Дата_рождения);
    if (d) {
        const age = today.year - d.year - ((today.month < d.month || (today.month === d.month && today.day < d.day)) ? 1 : 0);
        ageStr = ` <span style="color:var(--text-muted); font-weight:normal; font-size: 0.75em">(${age} лет)</span>`;
    }
}

const hasValue = (val) => val && val !== "—" && val !== "" && val !== null && val !== undefined;
const patientTags = Array.isArray(cur.tags) ? cur.tags.map(t => String(t || "").toLowerCase()) : [];
const stationFromTags = patientTags.includes("кс") ? "КС" : (patientTags.includes("дс") ? "ДС" : "");
const stationLabel = hasValue(cur["КС"]) ? cur["КС"] : stationFromTags;
const acceleratorValues = [
    cur.Ускоритель,
    ...extraVolumes.map(vol => vol?.Ускоритель)
].filter(hasValue).map(v => String(v).trim()).filter(Boolean);
const acceleratorLabel = Array.from(new Set(acceleratorValues)).join(", ");

// Сегментированный прогресс-бар
const bar = `<div style="display:flex;gap:2px;width:100%;height:6px;border-radius:3px;margin:12px 0;">${
    barSegsList.map((sg, i) => {
        const filledPct = sg.frac > 0 ? Math.min(100, Math.round(sg.delivered / sg.frac * 100)) : 0;
        const segColor = sg.delivered >= sg.frac ? "#4caf50" : sg.color;
        return `<div style="flex:${sg.frac};height:100%;background:rgba(150,150,150,0.15);border-radius:3px;"><div style="width:${filledPct}%;height:100%;background:${segColor};border-radius:3px;"></div></div>`;
    }).join("")
}</div>`;

const color = percent >= 100 ? "#4caf50" : "#2196f3";
const card = dv.el("div", "", { cls: "patient-card" });
card.style.cssText = `background: var(--background-primary-alt); border-left: 4px solid ${color}; border-radius: 8px; padding: 15px; border: 1px solid var(--background-modifier-border); box-sizing: border-box; overflow-x: clip;`;

// Адаптивная сетка: 2 колонки на широком экране, 1 на узком
const gridStyle = `display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 8px 20px; font-size: 0.9em; line-height: 1.5;`;

// --- ОСНОВНОЙ ИНФО-БЛОК (без Радиомодификации — она в блоке ХЛТ) ---
let mainInfoItems = [];
if (hasValue(cur.Диагноз)) mainInfoItems.push(`<div><span style="color:var(--text-muted)">Диагноз:</span> ${cur.Диагноз}</div>`);
if (hasValue(cur["МКБ 10"])) mainInfoItems.push(`<div><span style="color:var(--text-muted)">МКБ-10:</span> ${cur["МКБ 10"]}</div>`);
if (hasValue(cur.Цель_лечения)) mainInfoItems.push(`<div><span style="color:var(--text-muted)">Цель:</span> ${cur.Цель_лечения}</div>`);
if (cur.ID_пациента) mainInfoItems.push(`<div><span style="color:var(--text-muted)">ID:</span> <strong style="font-family:monospace;font-size:14px;letter-spacing:1px;color:var(--text-accent)">${cur.ID_пациента}</strong></div>`);
if (hasValue(cur.Номер_телефона)) mainInfoItems.push(`<div><span style="color:var(--text-muted)">Тел:</span> ${cur.Номер_телефона}</div>`);
if (hasValue(cur.Email)) mainInfoItems.push(`<div><span style="color:var(--text-muted)">Email:</span> <a href="mailto:${cur.Email}" style="color:var(--text-accent)">${cur.Email}</a></div>`);
if (hasValue(cur.СНИЛС)) mainInfoItems.push(`<div data-copy-snils="${cur.СНИЛС}" title="Нажмите, чтобы скопировать СНИЛС" style="cursor:pointer;"><span style="color:var(--text-muted)">СНИЛС:</span> <span class="pf-snils-value">${cur.СНИЛС}</span></div>`);
if (hasValue(cur["Группа ВМП"])) mainInfoItems.push(`<div><span style="color:var(--text-muted)">Финансирование:</span> ${patientCardFundingLabel(cur["Группа ВМП"])}</div>`);
if (hasValue(cur["Передан"])) mainInfoItems.push(`<div><span style="color:var(--text-muted)">Передан:</span> 📦 ${cur["Передан"]}</div>`);
if (hasValue(stationLabel) || hasValue(cur["Палата"])) {
    const room = hasValue(cur["Палата"]) ? `, палата ${cur["Палата"]}` : "";
    mainInfoItems.push(`<div><span style="color:var(--text-muted)">Стационар:</span> ${stationLabel || "КС"}${room}</div>`);
}
if (hasValue(acceleratorLabel)) mainInfoItems.push(`<div><span style="color:var(--text-muted)">Ускоритель:</span> ${acceleratorLabel}</div>`);
if (hasValue(cur.ECOG_статус)) mainInfoItems.push(`<div><span style="color:var(--text-muted)">ECOG:</span> ${cur.ECOG_статус}</div>`);


const mainInfoHTML = mainInfoItems.length > 0
    ? `<div style="${gridStyle}">${mainInfoItems.join("")}</div>`
    : "";

// ============================================================
// БЛОК ДОЗ
// ============================================================
const CONN_COLORS = {
    "Последовательный буст":          "#9c27b0",
    "Одновременно":                   "#4caf50",
    "Параллельно":                    "#ff9800",
    "Последовательно":                "#ffc107",
    "Изолированно (параллельно)":     "#ff9800",
    "Изолированно (последовательно)": "#ffc107"
};
const CONN_LABELS = {
    "Последовательный буст":          "⇒ Буст",
    "Одновременно":                   "⟺ SIB",
    "Параллельно":                    "◎ Парал.",
    "Последовательно":                "→ Посл.",
    "Изолированно (параллельно)":     "◎ Парал.",
    "Изолированно (последовательно)": "→ Посл."
};

let cumBED10 = null, cumBED3 = null, cumEQD2_10 = null, cumEQD2_3 = null;
let cumulativeDoseDisplay = (frac1 && rod1) ? frac1 * rod1 : 0;

const renderBedBlock = (ownBED10, ownBED3, ownEQD2_10, ownEQD2_3, isCumulative, rod) => {
    if (!ownBED10 || !ownEQD2_10) return "";
    const showEQD2 = rod !== 2;
    if (!isCumulative) {
        return `
        <div style="padding: 6px 8px; background: rgba(100,100,100,0.08); border-radius: 4px; font-size: 0.82em;">
            <div style="margin-bottom: 2px;"><b>α/β=10</b> <span style="color:var(--text-muted)">BED:</span> <b>${formatDose(ownBED10)}</b> Гр${showEQD2 ? ` · <span style="color:var(--text-muted)">EQD2:</span> <b>${formatDose(ownEQD2_10)}</b> Гр` : ""}</div>
            <div><b>α/β=3 </b> <span style="color:var(--text-muted)">BED:</span> <b>${formatDose(ownBED3)}</b> Гр${showEQD2 ? ` · <span style="color:var(--text-muted)">EQD2:</span> <b>${formatDose(ownEQD2_3)}</b> Гр` : ""}</div>
        </div>`;
    }
    return `
    <div style="padding: 6px 8px; background: rgba(100,100,100,0.08); border-radius: 4px; font-size: 0.82em;">
        <div style="margin-bottom: 2px; color: var(--text-accent);"><b>α/β=10</b> <span style="color:var(--text-muted)">BED:</span> <b>${formatDose(cumBED10)}</b> Гр${showEQD2 ? ` · <span style="color:var(--text-muted)">EQD2:</span> <b>${formatDose(cumEQD2_10)}</b> Гр` : ""}</div>
        <div style="color: var(--text-accent);"><b>α/β=3 </b> <span style="color:var(--text-muted)">BED:</span> <b>${formatDose(cumBED3)}</b> Гр${showEQD2 ? ` · <span style="color:var(--text-muted)">EQD2:</span> <b>${formatDose(cumEQD2_3)}</b> Гр` : ""}</div>
    </div>`;
};

// Метки режима фракционирования для отображения в дозовом блоке
const fmtFrakLabel = (s) => {
    const m = (s || "").toString().toLowerCase();
    if (/2\s*раза|два\s*раза|bid/.test(m)) return "Два раза в день";
    if (/через\s*день|qod/.test(m)) return "Через день";
    if (/стажир/.test(m)) return "Стажированно";
    return "Ежедневно";
};

let doseSections = "";

if (frac1 && rod1) {
    const total1 = frac1 * rod1;
    const d1 = Math.max(1, decimalsOf(cur.РОД));
    const bed10_1   = calcBED(frac1, rod1, 10);
    const bed3_1    = calcBED(frac1, rod1, 3);
    const eqd2_10_1 = calcEQD2(total1, rod1, 10);
    const eqd2_3_1  = calcEQD2(total1, rod1, 3);

    cumBED10   = bed10_1;
    cumBED3    = bed3_1;
    cumEQD2_10 = eqd2_10_1;
    cumEQD2_3  = eqd2_3_1;

    doseSections += `
    <div style="margin-bottom: 6px; padding: 7px 10px 7px 10px; background: rgba(33,150,243,0.07); border-radius: 8px; border-left: 3px solid #2196f3;">
        <div style="font-weight: 700; font-size: 0.88em; color: #2196f3; margin-bottom: 3px;">
            ☢️ ${ptv1DisplayName}
            <span style="color:var(--text-muted); font-weight:400; font-size:0.9em"> · ${fmtFrakLabel(cur.Фракционирование)}</span>
        </div>
        ${hasValue(cur.Область_облучения) ? `<div style="font-size:0.82em;color:var(--text-muted);margin-bottom:3px;">${cur.Область_облучения}</div>` : ''}
        <div style="font-size: 0.88em; color: var(--text-normal); margin-bottom: 4px;">
            <b>${frac1}</b> фр. × <b>${fmtDose(rod1, d1)}</b> Гр = <b>${fmtDose(total1, d1)}</b> Гр
        </div>
        ${renderBedBlock(bed10_1, bed3_1, eqd2_10_1, eqd2_3_1, false, rod1)}
        ${isMultiPTV && start1 && end1 ? `<div style="font-size: 0.82em; color: var(--text-muted); margin-top: 4px;">📅 ${fmt(start1)} → ${fmt(end1)}</div>` : ""}
    </div>`;
}

// Группируем extraSchedules по родительскому объёму (аналогично блоку 0)
const schedGroups = [{ largeItem: null, items: [] }];
extraSchedules.forEach((s, idx) => {
    if (s.conn === "Параллельно" || s.conn === "Последовательно") {
        schedGroups.push({ largeItem: { s, idx }, items: [] });
    } else {
        schedGroups[schedGroups.length - 1].items.push({ s, idx });
    }
});

const renderSchedItem = (s, idx, isBoost) => {
    if (!s.fracN || !s.rodN) return "";
    const sdN = s.fracN * s.rodN;
    const dN = Math.max(1, decimalsOf(s.vol.РОД));
    const connColor = CONN_COLORS[s.conn] || "#2196f3";
    const connLabel = CONN_LABELS[s.conn] || s.conn;
    const name = extraDisplayNames[idx];

    const bed10N    = calcBED(s.fracN, s.rodN, 10);
    const bed3N     = calcBED(s.fracN, s.rodN, 3);
    const eqd2_10N  = calcEQD2(sdN, s.rodN, 10);
    const eqd2_3N   = calcEQD2(sdN, s.rodN, 3);

    const isAdditive = s.conn === "Последовательный буст";
    if (isAdditive && cumBED10 !== null && bed10N !== null) {
        cumBED10   += bed10N;
        cumBED3    += bed3N;
        cumEQD2_10 += eqd2_10N;
        cumEQD2_3  += eqd2_3N;
    }

    let displaySD = sdN;
    if (s.conn === "Последовательный буст") {
        cumulativeDoseDisplay += sdN;
        displaySD = cumulativeDoseDisplay;
    }

    const volArea = s.vol.Область_облучения;
    // Бусты рисуются внутри родительской карточки — без outer padding/bg (isBoost)
    if (isBoost) {
        return `
        <div style="margin-top:5px; padding:5px 8px; background:color-mix(in srgb,${connColor} 12%,transparent); border-radius:6px; border-left:3px solid ${connColor};">
            <div style="font-weight:700;font-size:0.85em;color:${connColor};margin-bottom:2px;">
                ☢️ ${name}
                <span style="color:var(--text-muted);font-weight:400;font-size:0.9em"> · ${connLabel} · ${fmtFrakLabel(s.vol.Фракционирование)}</span>
            </div>
            ${volArea ? `<div style="font-size:0.8em;color:var(--text-muted);margin-bottom:2px;">${volArea}</div>` : ''}
            <div style="font-size:0.85em;color:var(--text-normal);margin-bottom:3px;">
                <b>${s.fracN}</b> фр. × <b>${fmtDose(s.rodN, dN)}</b> Гр = <b>${fmtDose(displaySD, dN)}</b> Гр
            </div>
            ${renderBedBlock(bed10N, bed3N, eqd2_10N, eqd2_3N, isAdditive, s.rodN)}
            ${(s.conn !== "Одновременно" && s.schedule.length > 0) ? `<div style="font-size:0.8em;color:var(--text-muted);margin-top:3px;">📅 ${fmt(s.schedule[0])} → ${fmt(s.endN)}</div>` : ""}
        </div>`;
    }
    return `
    <div style="margin-bottom:6px; padding:7px 10px; background:color-mix(in srgb,${connColor} 10%,transparent); border-radius:8px; border-left:3px solid ${connColor};">
        <div style="font-weight:700;font-size:0.88em;color:${connColor};margin-bottom:3px;">
            ☢️ ${name}
            <span style="color:var(--text-muted);font-weight:400;font-size:0.9em"> · ${connLabel} · ${fmtFrakLabel(s.vol.Фракционирование)}</span>
        </div>
        ${volArea ? `<div style="font-size:0.82em;color:var(--text-muted);margin-bottom:3px;">${volArea}</div>` : ''}
        <div style="font-size:0.88em;color:var(--text-normal);margin-bottom:4px;">
            <b>${s.fracN}</b> фр. × <b>${fmtDose(s.rodN, dN)}</b> Гр = <b>${fmtDose(displaySD, dN)}</b> Гр
        </div>
        ${renderBedBlock(bed10N, bed3N, eqd2_10N, eqd2_3N, isAdditive, s.rodN)}
        ${(s.conn !== "Одновременно" && s.schedule.length > 0) ? `<div style="font-size:0.82em;color:var(--text-muted);margin-top:4px;">📅 ${fmt(s.schedule[0])} → ${fmt(s.endN)}</div>` : ""}
    </div>`;
};

// PTV1 + его бусты — в одной карточке
{
    const boosts1 = schedGroups[0].items.map(({ s, idx }) => renderSchedItem(s, idx, true)).join("");
    if (frac1 && rod1) {
        // Дополняем уже добавленный PTV1-блок бустами внутри — через замену последнего </div>
        if (boosts1) {
            // Убираем закрывающий </div> последнего блока и вставляем бусты перед ним
            const lastClose = doseSections.lastIndexOf("</div>");
            doseSections = doseSections.slice(0, lastClose) + boosts1 + "</div>";
        }
    } else {
        doseSections += boosts1;
    }
}
// Большие объёмы + их бусты — каждый в своей карточке
schedGroups.slice(1).forEach(({ largeItem, items }) => {
    const boostsHtml = items.map(({ s, idx }) => renderSchedItem(s, idx, true)).join("");
    const largeHtml  = renderSchedItem(largeItem.s, largeItem.idx, false);
    if (boostsHtml) {
        // Вставляем бусты внутрь карточки крупного объёма
        const lastClose = largeHtml.lastIndexOf("</div>");
        doseSections += largeHtml.slice(0, lastClose) + boostsHtml + "</div>";
    } else {
        doseSections += largeHtml;
    }
});

const doseSectionHTML = doseSections ? `
<hr style="border:none; border-top:1px solid var(--background-modifier-border); margin: 10px 0;">
${doseSections}` : "";

// --- ДАТЫ ---
let datesInfoItems = [];
const razmetkaRaw2 = cur.Дата_разметки && typeof cur.Дата_разметки !== 'boolean' ? dv.date(cur.Дата_разметки) : null;
const razmetkaDate = razmetkaRaw2 ? (cur.Разметка === true ? fmt(razmetkaRaw2) : fmtFull(razmetkaRaw2)) : null;
if (razmetkaDate) datesInfoItems.push(`<div>🟣 <b>Разметка:</b> ${razmetkaDate}</div>`);

// Переразметки (массив)
const _cardRmkList = (() => {
    const r = cur.Переразметки;
    if (Array.isArray(r) && r.length > 0) return r.filter(Boolean);
    if (cur.Дата_переразметки) return [{ Дата: cur.Дата_переразметки, Переразметка: cur.Переразметка === true, Переоконтуривание: cur.Переоконтуривание === true, Старт_нового_плана: "" }];
    return [];
})();
_cardRmkList.forEach((rmk, idx) => {
    const rmkRawD = rmk.Дата && typeof rmk.Дата !== 'boolean' ? dv.date(rmk.Дата) : null;
    if (!rmkRawD) return;
    const rmkLabel = _cardRmkList.length > 1 ? `Переразметка ${idx+1}` : "Переразметка";
    const rmkDateStr = (rmk.Переразметка === true) ? fmt(rmkRawD) : fmtFull(rmkRawD);
    datesInfoItems.push(`<div>🔵 <b>${rmkLabel}:</b> ${rmkDateStr}</div>`);
    if (rmk.Старт_нового_плана) {
        const newStartD = dv.date(rmk.Старт_нового_плана);
        if (newStartD) datesInfoItems.push(`<div>🟠 <b>Старт нового плана${_cardRmkList.length > 1 ? ` ${idx+1}` : ""}:</b> ${fmt(newStartD)}</div>`);
    }
});
if (start1) datesInfoItems.push(`<div>🟢 <b>Старт:</b> ${fmt(start1)}</div>`);
if (isMultiPTV && end1 && overallEnd && end1.toISODate() !== overallEnd.toISODate())
    datesInfoItems.push(`<div>🔵 <b>Финиш ${cur.Название_PTV || "PTV1"}:</b> ${fmt(end1)}</div>`);
if (overallEnd) datesInfoItems.push(`<div>🔴 <b>Выписка:</b> ${fmt(overallEnd)}</div>`);

const datesInfoHTML = datesInfoItems.length > 0
    ? `<div style="font-size:0.9em;margin-top:8px;padding:8px 10px;background:var(--background-secondary);border-radius:8px;border:1px solid var(--background-modifier-border);">
           <div style="display:flex;flex-wrap:wrap;justify-content:space-between;gap:4px 12px;line-height:1.6;">${datesInfoItems.join("")}</div>
       </div>`
    : "";

// --- ХЛТ + РАДИОМОДИФИКАЦИЯ (с датами введения) ---
let hltHTML = "";
const hltDrugsB1 = (() => {
    const raw = cur.ХЛТ_препараты;
    if (Array.isArray(raw) && raw.length > 0) return raw.filter(Boolean);
    if (hasValue(cur.Радиомодификация)) {
        return [{ Препарат: cur.Радиомодификация.toString(), Режим: cur.ХЛТ_режим || "" }];
    }
    return [];
})();
var _normalizeHltIsoList = (arr) => Array.from(new Set((arr || []).map(v => {
    const d = dv.date(v);
    if (d) return d.startOf("day").toISODate();
    const s = String(v ?? "").trim();
    return s || null;
}).filter(Boolean))).sort();
var _hltBreakRanges = (() => {
    const raw = cur.Перерыв_ХЛТ;
    if (!raw) return [];
    const arr = Array.isArray(raw) ? raw : [raw];
    return arr.map(brk => {
        if (!brk || !brk.Дата_начала || !brk.Дата_окончания) return null;
        const start = dv.date(brk.Дата_начала)?.startOf("day");
        const end = dv.date(brk.Дата_окончания)?.startOf("day");
        if (!start || !end) return null;
        return { start: start.toISODate(), end: end.toISODate() };
    }).filter(Boolean);
})();
var _isHltBreakIso = (iso) => _hltBreakRanges.some(r => iso >= r.start && iso <= r.end);
var _hltManualDates = _normalizeHltIsoList(cur.ХЛТ_ручные_даты);
var _hltSkippedDates = new Set(_normalizeHltIsoList(cur.Пропущенные_даты_ХЛТ));
var _buildHltAutoIsoDates = (drug, hltStartDate, treatEndDate, allRadIsoDates = []) => {
    const r = (drug?.Режим || "").toLowerCase();
    if (r === "в дни лучевой терапии") return _normalizeHltIsoList(allRadIsoDates);
    if (!hltStartDate || !treatEndDate) return [];

    if (r === "однократно") {
        let d = hltStartDate.startOf("day");
        let s = 0;
        while (s < 7 && (d.weekday > 5 || holidays.has(d.toISODate()))) { d = d.plus({ days: 1 }); s++; }
        return [d.toISODate()];
    }

    if (r === "ежедневно") {
        const dates = [];
        let curr = hltStartDate.startOf("day");
        let safety = 0;
        while (curr <= treatEndDate && safety < 365) {
            const iso = curr.toISODate();
            if (curr.weekday <= 5 && !holidays.has(iso)) dates.push(iso);
            curr = curr.plus({ days: 1 });
            safety++;
        }
        return _normalizeHltIsoList(dates);
    }

    let intervalDays = 7;
    if (r === "раз в 14 дней") intervalDays = 14;
    else if (r === "раз в 21 день") intervalDays = 21;

    const dates = [];
    let curr = hltStartDate.startOf("day");
    let safety = 0;
    while (curr <= treatEndDate && safety < 100) {
        let wd = curr;
        let ws = 0;
        while (ws < 7 && (wd.weekday > 5 || holidays.has(wd.toISODate()))) { wd = wd.plus({ days: 1 }); ws++; }
        dates.push(wd.toISODate());
        curr = wd.plus({ days: intervalDays });
        safety++;
    }
    return _normalizeHltIsoList(dates);
};
var _resolveHltIsoDates = (drug, hltStartDate, treatEndDate, allRadIsoDates = []) => {
    const autoDates = _buildHltAutoIsoDates(drug, hltStartDate, treatEndDate, allRadIsoDates);
    const manualDates = _hltManualDates;
    const manualLooksLikeFullOverride = manualDates.length > 0 && (
        autoDates.length === 0 || manualDates.length >= Math.max(3, Math.ceil(autoDates.length * 0.7))
    );
    const mergedDates = manualLooksLikeFullOverride
        ? manualDates
        : _normalizeHltIsoList([...autoDates, ...manualDates]);
    return mergedDates;
};
function buildDischargeChemoSnapshot(dischargeIso) {
    if (!Array.isArray(hltDrugsB1) || hltDrugsB1.length === 0) return "";
    const cutoffIso = String(dischargeIso || today?.toISODate?.() || "").slice(0, 10);
    if (!cutoffIso) return "";
    const hltStartDateRaw = cur.ХЛТ_дата_старта || cur.Дата_начала_лечения;
    const hltStartDate = hltStartDateRaw ? dv.date(hltStartDateRaw)?.startOf("day") : start1;
    if (!hltStartDate) return "";
    const treatEnd = dv.date(cutoffIso)?.startOf("day") || overallEnd || end1;
    const allRadIsoDates = [...schedule1, ...extraSchedules.flatMap(s => s.schedule)]
        .map(d => d?.toISODate ? d.toISODate() : "")
        .filter(Boolean);
    const rows = hltDrugsB1.map(drug => {
        const prep = String(drug?.Препарат ?? "").trim();
        if (!prep) return null;
        const dates = _resolveHltIsoDates(drug, hltStartDate, treatEnd, allRadIsoDates)
            .filter(iso => iso <= cutoffIso && !_hltSkippedDates.has(iso) && !_isHltBreakIso(iso));
        return { prep, count: dates.length };
    }).filter(Boolean);
    const totalIntroductions = rows.reduce((sum, row) => sum + row.count, 0);
    if (totalIntroductions <= 0) return "";
    const details = rows.map(row => `${row.prep}: ${row.count}`).join("; ");
    return `На дату выписки ${cutoffIso}: введено ХТ ${totalIntroductions}; ${details}`;
}

let _hltComputedDates = [];
if (hltDrugsB1.length > 0) {
    const hltStartDateRaw = cur.ХЛТ_дата_старта || cur.Дата_начала_лечения;
    const hltStartB1 = hltStartDateRaw ? dv.date(hltStartDateRaw)?.startOf("day") : start1;

    // Все дни облучения (для режима «в дни лучевой терапии»)
    const allRadB1 = [...schedule1, ...extraSchedules.flatMap(s => s.schedule)].map(d => d.toISODate());
    const allRadSetB1 = new Set(allRadB1);
    const lastRadB1 = allRadB1.length ? allRadB1.reduce((a, b) => a > b ? a : b) : null;

    // Вычисляем даты введения для одного препарата
    const calcDrugDates = (drug) => {
        const r = (drug.Режим || "").toLowerCase();
        if (r === "в дни лучевой терапии") return null;
        if (!hltStartB1) return [];

        const treatEnd = overallEnd || end1;
        if (!treatEnd) return [];
        return _resolveHltIsoDates(drug, hltStartB1, treatEnd, allRadB1)
            .map(iso => dv.date(iso))
            .filter(Boolean);
    };

    const todayIso = today.toISODate();

    const drugsHTML = hltDrugsB1.map((d, _dIdx) => {
        const prep = (d.Препарат ?? "").toString();
        const r = (d.Режим ?? "").toString().toLowerCase();
        const dates = calcDrugDates(d);

        let datesHTML = "";
        if (dates === null) {
            // «В дни лучевой терапии» — просто пишем режим без дат
            datesHTML = `<span style="color:var(--text-muted); font-size:0.85em;">в дни лучевой терапии</span>`;
        } else if (dates.length > 0) {
            // Находим ближайшую предстоящую (>= today)
            const nextDate = dates.find(d => {
                const iso = d.toISODate();
                return iso >= todayIso && !_hltSkippedDates.has(iso) && !_isHltBreakIso(iso);
            });
            const nextIso  = nextDate ? nextDate.toISODate() : null;

            const chips = dates.map(dt => {
                const iso = dt.toISODate();
                const isSkipped = _hltSkippedDates.has(iso) || _isHltBreakIso(iso);
                const label = dt.toFormat("dd.MM");
                let color, bg, fw, styles = "";
                if (isSkipped) {
                    color = "rgba(150,150,150,0.8)"; bg = "repeating-linear-gradient(45deg, rgba(0,0,0,0.03), rgba(0,0,0,0.03) 5px, rgba(0,0,0,0.07) 5px, rgba(0,0,0,0.07) 10px)"; fw = "400";
                    styles = "text-decoration: line-through; opacity: 0.7; border-style: dashed; padding: 0 5px;";
                } else if (iso === todayIso) {
                    color = "#fff"; bg = "#e53935"; fw = "700"; // сегодня — красный
                } else if (iso === nextIso) {
                    color = "#fff"; bg = "#4caf50"; fw = "700"; // ближайшая — зелёный
                } else if (iso < todayIso) {
                    color = "var(--text-faint)"; bg = "var(--background-modifier-border)"; fw = "400"; // прошедшие — серый
                } else {
                    color = "var(--text-muted)"; bg = "var(--background-primary)"; fw = "400"; // будущие
                }
                return `<span data-hlt-chip="${_dIdx}" data-hlt-iso="${iso}" title="Двойной клик: перенести или пропустить введение${isSkipped ? ' (Уже пропущено)' : ''}" style="display:inline-block; padding:1px 6px; border-radius:4px; font-size:0.8em; font-weight:${fw}; background:${bg}; color:${color}; border: 1px solid var(--background-modifier-border); white-space:nowrap; cursor:pointer; transition: transform 0.15s ease, opacity 0.15s, filter 0.15s; ${styles}" onmouseover="this.style.transform='scale(1.05)'; this.style.opacity='1'; this.style.filter='brightness(1.05)';" onmouseout="this.style.transform='none'; this.style.opacity='${isSkipped ? '0.7' : '1'}'; this.style.filter='none';">${label}</span>`;
            }).join(" ");
            datesHTML = `<div style="margin-top:4px; display:flex; flex-wrap:wrap; gap:3px; align-items:center;">${chips}</div>`;
        }

        const modeLabel = dates === null ? "в дни лучевой терапии" : `${r}:`;
        const isOnce = r === "однократно";
        const prepColored = `<span style="font-weight:700;color:#00838f;background:rgba(0,188,212,0.13);padding:1px 7px;border-radius:4px;">${prep}</span>`;
        return `<div style="margin-top:5px; padding-top:4px;">
            <span>🧪 ${prepColored}</span><span style="color:var(--text-muted); font-size:0.85em; margin-left:6px;">${modeLabel}</span>${isOnce && datesHTML ? `<span style="margin-left:5px;">${dates.map(dt => { const iso = dt.toISODate(); const isSkipped = _hltSkippedDates.has(iso) || _isHltBreakIso(iso); const label = dt.toFormat("dd.MM"); let color, bg, fw, styles = ""; if (isSkipped) { color="rgba(150,150,150,0.8)"; bg="repeating-linear-gradient(45deg, rgba(0,0,0,0.03), rgba(0,0,0,0.03) 5px, rgba(0,0,0,0.07) 5px, rgba(0,0,0,0.07) 10px)"; fw="400"; styles="text-decoration: line-through; opacity: 0.7; border-style: dashed; padding: 0 5px;"; } else if (iso === todayIso) { color="#fff"; bg="#e53935"; fw="700"; } else if (iso >= todayIso) { color="#fff"; bg="#4caf50"; fw="700"; } else { color="var(--text-faint)"; bg="var(--background-modifier-border)"; fw="400"; } return `<span data-hlt-chip="${_dIdx}" data-hlt-iso="${iso}" title="Двойной клик: перенести или пропустить введение${isSkipped ? ' (Уже пропущено)' : ''}" style="display:inline-block; padding:1px 6px; border-radius:4px; font-size:0.8em; font-weight:${fw}; background:${bg}; color:${color}; border:1px solid var(--background-modifier-border); white-space:nowrap; cursor:pointer; transition: transform 0.15s ease, opacity 0.15s, filter 0.15s; ${styles}" onmouseover="this.style.transform='scale(1.05)'; this.style.opacity='1'; this.style.filter='brightness(1.05)';" onmouseout="this.style.transform='none'; this.style.opacity='${isSkipped ? '0.7' : '1'}'; this.style.filter='none';">${label}</span>`; }).join("")}</span>` : ""}
            ${!isOnce && dates !== null && datesHTML ? datesHTML : ""}
        </div>`;
    }).join("");

    _hltComputedDates = hltDrugsB1.map(d => (calcDrugDates(d) ?? []).map(dt => dt.toISODate()));

    hltHTML = `<div style="font-size:0.9em;margin-top:8px;padding:8px 10px;background:rgba(0,188,212,0.08);border-radius:8px;border-left:3px solid #00bcd4;">
        <div style="font-weight:600;color:#00838f;margin-bottom:4px;">Лекарственные препараты</div>
        <div style="font-size:0.88em;color:var(--text-muted);font-weight:600;margin-bottom:4px;letter-spacing:0.02em;">ХИМИОТЕРАПИЯ</div>
        ${drugsHTML}
    </div>`;
}

// --- НАЗНАЧЕНИЕ Л/С ---
const medsDataB1 = normalizeLsAssignments(cur);

if (medsDataB1.length > 0) {
    const medsMkChips = (startD, termCode, daysCount) => {
        if (!startD) return "";
        const todayIso = today.toISODate();
        let days = [];
        if (termCode === "весь_курс") {
            if (!start1 && !overallEnd) return `<span style="color:var(--text-muted);font-size:0.85em;">весь период лечения</span>`;
            const s = (startD || start1 || today).startOf("day");
            const e = (overallEnd || end1 || s).startOf("day");
            let d = s, limit = 0;
            while (d <= e && limit < 400) { days.push(d); d = d.plus({days:1}); limit++; }
        } else {
            const parsed = Number(daysCount) > 0 ? Number(daysCount) : Number(((termCode || "").toString().match(/^(\d+)_дней$/) || [])[1] || 0);
            const n = parsed > 0 ? parsed : 1;
            let d = startD.startOf("day");
            for (let i = 0; i < n; i++) { days.push(d); d = d.plus({days:1}); }
        }
        if (days.length === 0) return "";
        const firstFuture = days.find(x => x.toISODate() >= todayIso);
        const nextIso = firstFuture ? firstFuture.toISODate() : null;
        const chips = days.map(dt => {
            const iso = dt.toISODate();
            const label = dt.toFormat("dd.MM");
            let color, bg, fw;
            if (iso === todayIso) { color="#fff"; bg="#e53935"; fw="700"; }
            else if (iso === nextIso) { color="#fff"; bg="#4caf50"; fw="700"; }
            else if (iso < todayIso) { color="var(--text-faint)"; bg="var(--background-modifier-border)"; fw="400"; }
            else { color="var(--text-muted)"; bg="var(--background-primary)"; fw="400"; }
            return `<span style="display:inline-block;padding:1px 6px;border-radius:4px;font-size:0.8em;font-weight:${fw};background:${bg};color:${color};border:1px solid var(--background-modifier-border);white-space:nowrap;">${label}</span>`;
        }).join(" ");
        return `<div style="margin-top:4px;display:flex;flex-wrap:wrap;gap:3px;">${chips}</div>`;
    };

    const medItemsHTML = medsDataB1.map(m => {
        const prep = (m.Препарат ?? "").toString().trim();
        if (!prep) return "";
        const dose = (m.Дозировка ?? "").toString().trim();
        const termCode = (m.Срок ?? "весь_курс").toString();
        const termLabel = toLsUiDuration(termCode, m.Дней);
        const startD = m.Дата_старта ? dv.date(m.Дата_старта) : (start1 || null);
        const prepColored = `<span style="font-weight:700;color:#5e35b1;background:rgba(123,97,255,0.13);padding:1px 7px;border-radius:4px;">${prep}</span>`;
        const dosePart = dose ? `<span style="color:var(--text-normal);font-weight:600;margin-left:6px;">${dose}</span>` : "";
        const chipsHtml = medsMkChips(startD, termCode, m.Дней);
        return `<div style="margin-top:5px;padding-top:4px;">
            <span>💊 ${prepColored}</span>${dosePart}<span style="color:var(--text-muted);font-size:0.85em;margin-left:6px;">${termLabel}${startD ? ` (с ${startD.toFormat("dd.MM.yyyy")})` : ""}</span>
            ${chipsHtml}
        </div>`;
    }).filter(Boolean).join("");

    const medsHR = `<hr style="border:none;border-top:1px solid rgba(0,188,212,0.3);margin:8px 0 4px 0;">`;
    const medsSubTitle = `<div style="font-size:0.88em;color:var(--text-muted);font-weight:600;margin-bottom:4px;letter-spacing:0.02em;">НАЗНАЧЕНИЕ Л/С</div>`;

    if (hltHTML) {
        hltHTML = hltHTML.replace("</div>", `${medsHR}${medsSubTitle}${medItemsHTML}</div>`);
    } else {
        hltHTML = `<div style="font-size:0.9em;margin-top:8px;padding:8px 10px;background:rgba(123,97,255,0.08);border-radius:8px;border-left:3px solid #7b61ff;">
            <div style="font-weight:600;color:#5e35b1;margin-bottom:4px;">Лекарственные препараты</div>
            ${medsSubTitle}${medItemsHTML}
        </div>`;
    }
}
const hasSick = cur.Больничный_лист === true;
const getElnBaseStart = () => {
    const openEnabled = cur.Открытый_ЭЛН_активен === true;
    const openEln = cur.Открытый_ЭЛН ? dv.date(cur.Открытый_ЭЛН) : null;
    if (openEnabled && openEln) return openEln.startOf("day");
    const admission = cur.Дата_начала_лечения ? dv.date(cur.Дата_начала_лечения) : null;
    return admission ? admission.startOf("day") : null;
};
const elnBaseStart = getElnBaseStart();

// ── D1/D2: Расчёт фактически полученной дозы на сегодня ─────────────────────
// Считаем по каждому сегменту отдельно (d=РОД для этого сегмента)
let deliveredGyTotal = 0;
let delivBED10 = 0, delivBED3 = 0, delivEQD2_10 = 0, delivEQD2_3 = 0;
if (frac1 && rod1 && delivered1 > 0) {
    const dGy1 = delivered1 * rod1;
    deliveredGyTotal += dGy1;
    delivBED10   += (delivered1 * rod1 * (1 + rod1 / 10));
    delivBED3    += (delivered1 * rod1 * (1 + rod1 / 3));
    delivEQD2_10 += dGy1 * (rod1 + 10) / (2 + 10);
    delivEQD2_3  += dGy1 * (rod1 + 3)  / (2 + 3);
}
extraSchedules.forEach(s => {
    if (!s.fracN || !s.rodN) return;
    if (s.conn !== "Последовательный буст") return;
    const delivN = s.schedule.filter(d => d <= today).length;
    if (delivN <= 0) return;
    const dGyN = delivN * s.rodN;
    deliveredGyTotal += dGyN;
    delivBED10   += (delivN * s.rodN * (1 + s.rodN / 10));
    delivBED3    += (delivN * s.rodN * (1 + s.rodN / 3));
    delivEQD2_10 += dGyN * (s.rodN + 10) / (2 + 10);
    delivEQD2_3  += dGyN * (s.rodN + 3)  / (2 + 3);
});
const _fmtN1 = v => (Math.round(v * 10) / 10).toFixed(1).replace(".", ",");
const plannedGyTotal = (() => {
    const explicit = Number((cur.Суммарная_доза ?? cur.СОД ?? "").toString().replace(",", "."));
    if (explicit > 0) return explicit;
    let total = (frac1 && rod1) ? frac1 * rod1 : 0;
    extraSchedules.forEach(s => {
        if (!s.fracN || !s.rodN || s.conn !== "Последовательный буст") return;
        total += s.fracN * s.rodN;
    });
    return total;
})();
const displayDoseLine = `⚡ ${_fmtN1(plannedGyTotal)} Гр  ·  ${totalDelivered}/${totalFrac} фр. (${percent}%)`;
const allVolumeDoseHtml = (() => {
    const items = [];
    if (frac1 && rod1) {
        items.push(`<div>${cur.Название_PTV || "PTV"}: <b style="color:var(--text-normal);">${_fmtN1(delivered1 * rod1)}</b> Гр</div>`);
    }
    extraSchedules.forEach((s, idx) => {
        if (!s.fracN || !s.rodN) return;
        const name = s.vol?.Название || `PTV${idx + 2}`;
        const deliveredN = s.schedule.filter(d => d <= today).length;
        items.push(`<div>${name}: <b style="color:var(--text-normal);">${_fmtN1(deliveredN * s.rodN)}</b> Гр</div>`);
    });
    return items.join("");
})();

const modelFractions = [
    ...(Array.isArray(schedule1) ? schedule1 : []),
    ...extraSchedules.flatMap(s => Array.isArray(s.schedule) ? s.schedule : [])
].map(d => d?.toISODate ? d.toISODate() : "").filter(Boolean).sort();

const patientModel = buildPatientModel(cur, {
    today,
    holidays,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Moscow"
}, {
    startTx: start1 ? start1.toISODate() : null,
    endTx: overallEnd ? overallEnd.toISODate() : null,
    fractions: modelFractions,
    skipped: skipDates.map(d => d.toISODate()),
    extra: manuals.map(d => d.toISODate()),
    doneFractions: totalDelivered,
    totalFractions: totalFrac,
    percent,
    doneGy: deliveredGyTotal,
    deliveredGy: deliveredGyTotal,
    plannedGy: plannedGyTotal,
    displayDoseLine,
    bed10: delivBED10,
    eqd2_10: delivEQD2_10,
    bed3: delivBED3,
    eqd2_3: delivEQD2_3,
    segments: barSegsList
});

// Плашка "Получено Гр / BED / EQD2" — компактный блок справа, на мобильном переносится над баром
// Скрываем EQD2 в плашке если РОД = 2 (EQD2 тривиально равен дозе)
const _delivShowEQD2 = !(rod1 === 2 && extraSchedules.every(s => s.rodN === 2));

const delivPillHTML = (patientModel.progress.totalFractions > 0 && (patientModel.progress.doneFractions > 0 || treatmentStatus !== "Не начато"))
    ? `<div style="display:inline-flex;flex-direction:column;align-items:flex-end;padding:5px 10px;background:rgba(120,120,120,0.08);border:1px solid var(--background-modifier-border);border-radius:8px;font-size:0.78em;line-height:1.6;color:var(--text-muted);white-space:nowrap;">
        <div style="font-weight:700;color:var(--text-normal);">${patientModel.dose.displayDoseLine || displayDoseLine}</div>
        ${allVolumeDoseHtml ? `<div style="max-width:420px;white-space:normal;text-align:right;">${allVolumeDoseHtml}</div>` : ""}
        ${patientModel.dose.deliveredGy > 0 ? `<div><b style="color:var(--text-normal);">α/β=10</b> BED <b style="color:var(--text-normal);">${_fmtN1(patientModel.dose.bed10)}</b>${_delivShowEQD2 ? ` · EQD2 <b style="color:var(--text-normal);">${_fmtN1(patientModel.dose.eqd2_10)}</b>` : ""} Гр</div>
        <div><b style="color:var(--text-normal);">α/β=3 &nbsp;</b> BED <b style="color:var(--text-normal);">${_fmtN1(patientModel.dose.bed3)}</b>${_delivShowEQD2 ? ` · EQD2 <b style="color:var(--text-normal);">${_fmtN1(patientModel.dose.eqd2_3)}</b>` : ""} Гр</div>` : ""}
    </div>` : "";

let footerHTML = "";
const vkStr = (() => {
    const arr = Array.isArray(cur.Напоминания) ? cur.Напоминания : [];
    const pending = arr
        .filter(r => r && (r.дата || r.Дата) && (r.текст || r.Текст) && String(r.текст || r.Текст).includes("Написать ВК по ЭЛН") && !(r.выполнено === true || r.Выполнено === true))
        .map(r => dv.date(r.дата || r.Дата))
        .filter(Boolean)
        .sort((a, b) => a.toMillis() - b.toMillis());
    return pending.length ? pending[0].toFormat("dd.MM.yyyy") : "";
})();
if (hasSick || vkStr) {
    const sickPart = hasSick ? `<span style="font-weight:600;color:#bf360c;">🏥 Больничный лист</span>` : "";
    const vkPart   = vkStr   ? `<span>👩‍⚕️ <b>Очередное ВК:</b> ${vkStr}</span>` : "";
    const sep      = hasSick && vkStr ? `<span style="color:var(--background-modifier-border);">·</span>` : "";
    footerHTML = `<div style="font-size:0.9em;margin-top:8px;padding:8px 10px;background:rgba(255,87,34,0.08);border-radius:8px;border-left:3px solid #ff5722;display:flex;flex-wrap:wrap;gap:8px;align-items:center;">${sickPart}${sep}${vkPart}</div>`;
}

// --- СВЯЗАННЫЕ СЛУЧАИ ---
let linkedCasesHTML = "";
const linkedRaw = cur.Связанные_случаи;
const linkedArr = Array.isArray(linkedRaw) ? linkedRaw : (linkedRaw ? [linkedRaw] : []);
const linkedCleaned = linkedArr.map(l => {
    if (!l) return null;
    const s = l.toString().trim();
    const m = s.match(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/);
    return m ? m[1].trim() : s;
}).filter(Boolean);

if (linkedCleaned.length > 0) {
    const linkItems = linkedCleaned.map(name => {
        const found = dv.pages().find(p => p.file.name === name || p.file.path === name);
        const path = found ? found.file.path : name;
        return `<a class="internal-link" href="${path}" style="display:inline-flex; align-items:center; gap:5px; text-decoration:none; color:var(--text-normal); background: var(--background-primary); border: 1px solid var(--background-modifier-border); border-radius: 6px; padding: 3px 10px; font-size: 0.85em; transition: background 0.15s;"
            onmouseenter="this.style.background='var(--background-modifier-hover)'"
            onmouseleave="this.style.background='var(--background-primary)'">
            🔗 ${name}
        </a>`;
    }).join("");
    linkedCasesHTML = `
    <hr style="border:none; border-top:1px solid var(--background-modifier-border); margin: 12px 0;">
    <div style="font-size: 0.85em; color: var(--text-muted); margin-bottom: 6px; font-weight: 600;">СВЯЗАННЫЕ СЛУЧАИ</div>
    <div style="display: flex; flex-wrap: wrap; gap: 6px;">${linkItems}</div>`;
}

// --- ДИСПАНСЕРНЫЙ УЧЁТ ---
let dispensaryHTML = "";
if (cur.Диспансерный_учет === true) {
    const dispReminders = (cur.Напоминания ?? []).filter(r =>
        r && r.текст && r.текст.toLowerCase().includes("диспансерный") && !r.выполнено && r.дата
    ).sort((a, b) => dv.date(a.дата) - dv.date(b.дата));
    const nextDisp = dispReminders.length > 0 ? dispReminders[0] : null;
    dispensaryHTML = `
    <div style="font-size: 0.88em; margin-top: 8px; padding: 7px 10px; background: rgba(76,175,80,0.08); border-radius: 6px; border-left: 3px solid #4caf50;">
        👁 <b>На диспансерном учёте</b>
        ${nextDisp ? `· Ближайший осмотр: <b>${dv.date(nextDisp.дата)?.toFormat("dd.MM.yyyy") || "—"}</b> — ${nextDisp.текст}` : ""}
    </div>`;
}


// ── Тип стационара (ДС / КС) ─────────────────────────────────────────────────
const patTags = (cur.tags ?? []).map(t => String(t).replace(/^#/, "").trim());
const hasDS = patTags.includes("ДС");
const hasKS = patTags.includes("КС");
const stacChip = (() => {
    if (hasDS) return `<span style="display:inline-flex;align-items:center;padding:2px 10px;border-radius:20px;font-size:0.8em;font-weight:700;background:rgba(76,175,80,0.15);color:#2e7d32;border:1px solid rgba(76,175,80,0.4);">🏥 Дневной стационар</span>`;
    if (hasKS) return `<span style="display:inline-flex;align-items:center;padding:2px 10px;border-radius:20px;font-size:0.8em;font-weight:700;background:rgba(255,193,7,0.15);color:#7a5800;border:1px solid rgba(255,193,7,0.5);">🏨 Круглосуточный стационар</span>`;
    return `<span style="display:inline-flex;align-items:center;padding:2px 10px;border-radius:20px;font-size:0.8em;font-weight:700;background:rgba(229,57,53,0.12);color:#c62828;border:1px solid rgba(229,57,53,0.35);">⚠️ Тип стационара не указан</span>`;
})();

// --- СБОРКА ---
// Инжектируем стиль для адаптивной плашки дозы
if (!document.getElementById('pf-deliv-style')) {
    const _ds = document.createElement('style');
    _ds.id = 'pf-deliv-style';
    _ds.textContent = `
        .pf-card-header { display:flex; align-items:flex-start; justify-content:space-between; gap:10px; flex-wrap:wrap; margin-bottom:6px; }
        .pf-card-header-left { min-width:0; flex:1; }
        .pf-deliv-pill { flex-shrink:0; }
        @media (max-width: 600px) {
            .pf-deliv-pill { flex: 1 1 100%; }
            .pf-deliv-pill > div { width:100% !important; box-sizing:border-box; align-items:flex-start !important; }
        }
    `;
    document.head.appendChild(_ds);
}

card.innerHTML = `
    <div class="pf-card-header">
        <div class="pf-card-header-left">
            <div style="font-size:1.3em;font-weight:700;margin-bottom:4px;line-height:1.2;">${fio}${ageStr}</div>
            <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">${stacChip}${stagePill}</div>
        </div>
        ${delivPillHTML ? `<div class="pf-deliv-pill">${delivPillHTML}</div>` : ""}
    </div>
    ${bar}
    ${mainInfoHTML}
    ${datesInfoHTML}
    ${doseSectionHTML}
    ${(hltHTML || hasValue(cur.Дополнительная_информация) || footerHTML) && doseSectionHTML ? `<hr style="border:none;border-top:1px solid var(--background-modifier-border);margin:10px 0;">` : ""}
    ${hltHTML}
    ${hasValue(cur.Дополнительная_информация) ? `<div style="font-size:0.9em;margin-top:8px;padding:8px 10px;background:var(--background-secondary);border-radius:8px;border-left:3px solid var(--background-modifier-border);"><div style="font-weight:600;color:var(--text-muted);margin-bottom:4px;">📝 Доп. информация</div><div style="color:var(--text-normal);">${cur.Дополнительная_информация}</div></div>` : ""}
    ${footerHTML}
    ${linkedCasesHTML}
    ${dispensaryHTML}
`;

// ── Скрытие нативной иконки календаря на inline-инпутах ─────────────────────
{
    let _hds = document.getElementById("_hlt-date-inp-style");
    if (!_hds) { _hds = document.createElement("style"); _hds.id = "_hlt-date-inp-style"; document.head.appendChild(_hds); }
    _hds.textContent = `.hlt-date-inp::-webkit-calendar-picker-indicator, .lab-date-inp::-webkit-calendar-picker-indicator { display: none !important; }`;
}

// ── Редактирование дат ХЛТ по двойному клику ─────────────────────────────────
if (hltDrugsB1.length > 0) {
    const _persistHltOverrides = (manualDates, skippedDates, successMsg) => {
        const nextManual = _normalizeHltIsoList(manualDates);
        const nextSkipped = _normalizeHltIsoList(skippedDates);
        return app.fileManager.processFrontMatter(file, fm => {
            fm.ХЛТ_ручные_даты = nextManual;
            if (nextSkipped.length) fm.Пропущенные_даты_ХЛТ = nextSkipped;
            else {
                try { delete fm.Пропущенные_даты_ХЛТ; } catch (e) { fm.Пропущенные_даты_ХЛТ = []; }
            }
        }).then(() => { new Notice(successMsg); })
          .catch(err => new Notice("❌ Ошибка: " + (err?.message || err)));
    };

    card.querySelectorAll('[data-hlt-chip]').forEach(chip => {
        chip.ondblclick = (e) => {
            e.stopPropagation();
            const origIso = chip.dataset.hltIso;
            const dIdx = parseInt(chip.dataset.hltChip);
            const currDates = _hltComputedDates[dIdx] ?? [];
            const currentSkipped = _normalizeHltIsoList(cur.Пропущенные_даты_ХЛТ);

            const wrapper = document.createElement("div");
            wrapper.style.cssText = "display:inline-flex;align-items:center;gap:4px;flex-wrap:wrap;padding:2px 0;";
            chip.parentNode.insertBefore(wrapper, chip);
            chip.style.display = "none";

            const _picker = makeDatePicker(wrapper, origIso, "width:160px;", false);
            _picker.el.style.display = "inline-flex";
            _picker.el.style.gap = "2px";

            const _mkActionBtn = (label, bg, color) => {
                const btn = document.createElement("button");
                btn.type = "button";
                btn.textContent = label;
                btn.style.cssText = `height:28px;padding:0 12px;border:none;border-radius:6px;background:${bg};color:${color};font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap;transition:all 0.2s ease;box-shadow:0 2px 4px rgba(0,0,0,0.1);`;
                btn.onmouseover = () => { btn.style.transform = "translateY(-1px)"; btn.style.boxShadow = "0 3px 6px rgba(0,0,0,0.15)"; btn.style.filter = "brightness(1.1)"; };
                btn.onmouseout = () => { btn.style.transform = "none"; btn.style.boxShadow = "0 2px 4px rgba(0,0,0,0.1)"; btn.style.filter = "none"; };
                btn.onmousedown = () => { btn.style.transform = "translateY(1px)"; btn.style.boxShadow = "none"; };
                btn.onmouseup = () => { btn.style.transform = "translateY(-1px)"; btn.style.boxShadow = "0 3px 6px rgba(0,0,0,0.15)"; };
                return btn;
            };
            const saveBtn = _mkActionBtn("Сохранить", "#2e7d32", "#fff");
            const skipBtn = _mkActionBtn("Пропустить", "#e53935", "#fff");
            const cancelBtn = _mkActionBtn("Отмена", "var(--background-secondary)", "var(--text-muted)");
            wrapper.appendChild(saveBtn);
            wrapper.appendChild(skipBtn);
            wrapper.appendChild(cancelBtn);

            const closeEditor = () => {
                wrapper.remove();
                chip.style.display = "";
            };
            const saveMove = () => {
                const newIso = _picker.value;
                closeEditor();
                if (!newIso || newIso === origIso) return;
                const updatedManual = _normalizeHltIsoList(
                    (currDates.includes(origIso)
                        ? currDates.map(d => d === origIso ? newIso : d)
                        : [...currDates.filter(d => d !== origIso), newIso]
                    )
                );
                const updatedSkipped = currentSkipped.filter(d => d !== origIso && d !== newIso);
                _persistHltOverrides(updatedManual, updatedSkipped, "✅ Дата введения изменена");
            };
            const skipDose = () => {
                closeEditor();
                const updatedManual = _normalizeHltIsoList(currDates.filter(d => d !== origIso));
                const updatedSkipped = _normalizeHltIsoList([...currentSkipped.filter(d => d !== origIso), origIso]);
                _persistHltOverrides(updatedManual, updatedSkipped, "⏭️ Введение пропущено");
            };

            saveBtn.onclick = saveMove;
            skipBtn.onclick = skipDose;
            cancelBtn.onclick = closeEditor;

            requestAnimationFrame(() => _picker.focus());
            const _txtInput = _picker.el.querySelector('input[type="text"]');
            if (_txtInput) {
                _txtInput.addEventListener("keydown", (ev) => {
                    if (ev.key === "Enter") { ev.preventDefault(); saveMove(); }
                    if (ev.key === "Escape") { closeEditor(); }
                });
            }
        };
    });
}

// ── АНАМНЕЗ (режим чтения) ────────────────────────────────────────────────────
{
    const anamViewData = ANAM_FIELDS.filter(([, k]) => hasValue(cur[k]));
    if (anamViewData.length > 0) {
        const det = document.createElement("details");
        det.style.cssText = "margin-top:10px;border:1px solid var(--background-modifier-border);border-radius:8px;overflow:hidden;font-size:0.9em;";
        const fieldsHTML = anamViewData.map(([label, k]) =>
            `<div style="display:flex;flex-direction:column;gap:3px;">
                <div style="font-size:0.8em;color:var(--text-muted);font-weight:600;">${escapeHtml(label)}</div>
                <div style="white-space:pre-wrap;line-height:1.5;color:var(--text-normal);">${escapeHtml(cur[k])}</div>
            </div>`
        ).join("");
        det.innerHTML = `
            <summary style="padding:10px 14px;cursor:pointer;font-weight:600;font-size:0.9em;background:var(--background-secondary);border-left:3px solid #e91e63;list-style:none;display:flex;align-items:center;gap:6px;-webkit-tap-highlight-color:transparent;">
                <span style="color:#e91e63;flex-shrink:0;">📋</span><span>Анамнез</span>
            </summary>
            <div style="padding:12px 14px;display:flex;flex-direction:column;gap:14px;background:var(--background-primary);">${fieldsHTML}</div>`;
        if (card.parentElement) {
            card.parentElement.insertBefore(det, card.nextSibling);
        }
    }
}

// ── ЛАБОРАТОРНЫЕ (режим чтения — таблица по группам с трендами и графиком) ───
{
    const _labReadOnly = Array.isArray(cur.Лабораторные) ? [...cur.Лабораторные].sort((a, b) => normalizeLabDateKey(b.Дата).localeCompare(normalizeLabDateKey(a.Дата))) : [];
    if (_labReadOnly.length > 0) {
        const LAB_GROUPS_RO = [
            { name: "🩸 Клинический анализ крови", color: "#1565c0", params: {
                Лейкоциты:   { min: 4.0,  max: 9.0,   unit: "×10⁹/л" },
                Нейтрофилы:  { min: 1.8,  max: 7.7,   unit: "×10⁹/л" },
                Лимфоциты:   { min: 1.0,  max: 4.5,   unit: "×10⁹/л" },
                Моноциты:    { min: 0.12, max: 0.99,  unit: "×10⁹/л" },
                Эозинофилы:  { min: 0.04, max: 0.54,  unit: "×10⁹/л" },
                Базофилы:    { min: 0.01, max: 0.08,  unit: "×10⁹/л" },
                Эритроциты:  { min: 3.8,  max: 5.5,   unit: "×10¹²/л" },
                Гемоглобин:  { min: 120,  max: 160,   unit: "г/л" },
                Гематокрит:  { min: 37,   max: 51,    unit: "%" },
                Тромбоциты:  { min: 150,  max: 400,   unit: "×10⁹/л" },
                СОЭ:         { min: 2,    max: 30,    unit: "мм/ч" },
            }},
            { name: "🧪 Биохимия", color: "#6a1b9a", params: {
                АЛТ:         { min: 5,    max: 40,    unit: "Ед/л" },
                АСТ:         { min: 5,    max: 40,    unit: "Ед/л" },
                ЩФ:          { min: 30,   max: 120,   unit: "Ед/л" },
                ГГТ:         { min: 8,    max: 61,    unit: "Ед/л" },
                Билирубин:   { min: 3.4,  max: 20.5,  unit: "мкмоль/л" },
                Бил_прям:    { min: 0.5,  max: 5.1,   unit: "мкмоль/л" },
                Общий_белок: { min: 64,   max: 83,    unit: "г/л" },
                Мочевина:    { min: 2.8,  max: 7.2,   unit: "мМоль/л" },
                Креатинин:   { min: 44,   max: 115,   unit: "мкмоль/л" },
                Глюкоза:     { min: 3.9,  max: 6.1,   unit: "мМоль/л" },
                Натрий:      { min: 136,  max: 145,   unit: "мМоль/л" },
                Калий:       { min: 3.5,  max: 5.1,   unit: "мМоль/л" },
            }},
            { name: "🔴 Коагулограмма", color: "#b71c1c", params: {
                МНО:         { min: 0.81, max: 1.07,  unit: "" },
                АЧТВ:        { min: 24,   max: 36,    unit: "с" },
                ТВ:          { min: 10.3, max: 16.6,  unit: "с" },
                ПТВ:         { min: 9.2,  max: 12.2,  unit: "с" },
                Д_димер:     { min: 109,  max: 560,   unit: "нг/мл" },
            }},
            { name: "🎯 Онкомаркеры", color: "#e65100", params: {
                ПСА:         { min: 0,    max: 4,     unit: "нг/мл" },
                РЭА:         { min: 0,    max: 5,     unit: "нг/мл" },
                СА_19_9:     { min: 0,    max: 30,    unit: "Ед/мл" },
                СА_125:      { min: 0,    max: 35,    unit: "Ед/мл" },
                АФП:         { min: 0,    max: 8.1,   unit: "МЕ/мл" },
                СА_15_3:     { min: 0,    max: 26.9,  unit: "Ед/мл" },
            }},
            { name: "💛 Анализ мочи", color: "#f9a825", params: {
                Уробилиноген_м: { min: 0,     max: 34,    unit: "мкмоль/л" },
                Удельный_вес_м: { min: 1.003, max: 1.030, unit: "" },
                pH_мочи:        { min: 5.0,   max: 7.5,   unit: "" },
                Лейкоциты_мочи: { min: 0,     max: 25,    unit: "/мкл" },
                Белок_мочи:     { min: 0,     max: 0.15,  unit: "г/л" },
                Билирубин_мочи: { qualitative: true, unit: "" },
                Глюкоза_мочи:   { qualitative: true, unit: "" },
                Кровь_мочи:     { qualitative: true, unit: "" },
                Кетоны_мочи:    { qualitative: true, unit: "" },
                Нитриты_мочи:   { qualitative: true, unit: "" },
            }},
        ];
        const _allParamsRef = {};
        LAB_GROUPS_RO.forEach(g => Object.assign(_allParamsRef, g.params));

        // Последние 3 записи для таблицы
        const _roEntries = _labReadOnly.slice(0, 3);
        const _roLabels = _roEntries.map(e => {
            try { const d = dv.date(e.Дата); return d ? d.toFormat("dd.MM.yy") : (e.Дата || "?"); } catch(_) { return e.Дата || "?"; }
        });
        const _roTrend = (param, idx) => {
            if (idx >= _roEntries.length - 1) return "";
            const c = Number(_roEntries[idx][param]), p = Number(_roEntries[idx + 1][param]);
            if (!Number.isFinite(c) || !Number.isFinite(p)) return "";
            const diff = Math.abs(c - p);
            if (diff < 0.001) return "<span style='color:var(--text-faint)'>→</span>";
            const ref = _allParamsRef[param];
            const isAbn = ref && !ref.qualitative && (c < ref.min || c > ref.max);
            const color = isAbn ? '#e53935' : '#00897b';
            return c > p ? `<span style='color:${color}'>↑</span>` : `<span style='color:${color}'>↓</span>`;
        };

        const labDet = document.createElement("details");
        labDet.style.cssText = "margin-top:10px;border:1px solid var(--background-modifier-border);border-radius:8px;overflow:hidden;font-size:0.9em;";
        const lastDate = _roEntries[0].Дата ? dv.date(_roEntries[0].Дата) : null;
        const lastDateStr = lastDate ? lastDate.toFormat("dd.MM.yyyy") : "";

        const labSummary = document.createElement("summary");
        labSummary.style.cssText = "padding:10px 14px;cursor:pointer;font-weight:600;font-size:0.9em;background:var(--background-secondary);border-left:3px solid #00897b;list-style:none;display:flex;align-items:center;gap:6px;-webkit-tap-highlight-color:transparent;";
        labSummary.innerHTML = `<span style="color:#00897b;flex-shrink:0;">🔬</span><span>Анализы${lastDateStr ? " <span style='color:var(--text-muted);font-weight:400;font-size:0.85em;'>от " + lastDateStr + "</span>" : ""}</span>`;

        const labBody = document.createElement("div");
        labBody.style.cssText = "background:var(--background-primary);";

        // Кнопка редактора
        const _editRow = document.createElement("div");
        _editRow.style.cssText = "display:flex;justify-content:flex-end;padding:8px 12px 4px;";
        const _editLabBtn = document.createElement("button");
        _editLabBtn.textContent = "✏️ Редактировать анализы";
        _editLabBtn.style.cssText = "font-size:11px;color:var(--text-accent);background:none;border:1px solid var(--text-accent);border-radius:4px;padding:3px 8px;cursor:pointer;";
        _editLabBtn.onclick = () => openPatientCardEditorModal();
        _editRow.appendChild(_editLabBtn);
        labBody.appendChild(_editRow);

        // Таблица по группам
        const _tableWrap = document.createElement("div");
        _tableWrap.style.cssText = "overflow-x:auto;";
        let _tHTML = `<table style="border-collapse:collapse;font-size:12px;min-width:max-content;width:100%;">`;
        _tHTML += `<thead><tr><th style="text-align:left;padding:5px 10px;border-bottom:2px solid var(--background-modifier-border);color:var(--text-muted);font-weight:700;position:sticky;left:0;background:var(--background-primary);z-index:2;min-width:120px;">Показатель</th>`;
        _roLabels.forEach((lbl, i) => {
            _tHTML += `<th style="padding:5px 8px;border-bottom:2px solid var(--background-modifier-border);min-width:85px;font-weight:${i===0?'700':'400'};color:${i===0?'var(--text-normal)':'var(--text-muted)'};text-align:center;">${lbl}</th>`;
        });
        _tHTML += `<th style="padding:5px 10px;border-bottom:2px solid var(--background-modifier-border);color:var(--text-muted);font-weight:700;min-width:100px;text-align:left;">Норма</th></tr></thead><tbody>`;

        LAB_GROUPS_RO.forEach(group => {
            const visParams = Object.entries(group.params).filter(([p]) => _roEntries.some(e => e[p] !== undefined && e[p] !== null && e[p] !== ""));
            if (visParams.length === 0) return;
            _tHTML += `<tr><td colspan="${_roLabels.length + 2}" style="padding:5px 10px 3px;font-size:10px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:${group.color};background:var(--background-secondary);border-top:2px solid ${group.color}30;border-bottom:1px solid var(--background-modifier-border);">${group.name}</td></tr>`;
            visParams.forEach(([param, ref]) => {
                _tHTML += `<tr>`;
                _tHTML += `<td style="text-align:left;padding:4px 10px;border-bottom:1px solid var(--background-modifier-border);color:var(--text-normal);font-weight:500;white-space:nowrap;position:sticky;left:0;background:var(--background-primary);z-index:1;">${param.replace(/_/g, ' ')}</td>`;
                _roEntries.forEach((entry, i) => {
                    const val = entry[param];
                    if (val === undefined || val === null || val === "") { _tHTML += `<td style="padding:4px 8px;border-bottom:1px solid var(--background-modifier-border);text-align:center;color:var(--text-faint);">—</td>`; return; }
                    const numVal = Number(val);
                    const isAbnormal = !ref.qualitative && Number.isFinite(numVal) && (numVal < ref.min || numVal > ref.max);
                    const isMost = i === 0;
                    const color = isAbnormal ? "#e53935" : (isMost ? "var(--text-normal)" : "var(--text-muted)");
                    const weight = (isAbnormal || isMost) ? "700" : "400";
                    const trend = isMost ? _roTrend(param, 0) : "";
                    const barHTML = (isMost && !ref.qualitative && Number.isFinite(numVal) && (ref.max - ref.min) > 0) ? (() => { const pos = Math.max(2, Math.min(98, 25 + ((numVal - ref.min) / (ref.max - ref.min)) * 50)); return `<div style="height:5px;border-radius:3px;margin-top:2px;overflow:visible;position:relative;background:linear-gradient(to right,rgba(239,83,80,0.45) 0%,rgba(239,83,80,0.45) 25%,rgba(67,160,71,0.45) 25%,rgba(67,160,71,0.45) 75%,rgba(239,83,80,0.45) 75%,rgba(239,83,80,0.45) 100%);"><div style="position:absolute;top:-1px;left:${pos}%;width:3px;height:7px;background:${isAbnormal?'#e53935':'#1b5e20'};transform:translateX(-50%);border-radius:2px;"></div></div>`; })() : "";
                    _tHTML += `<td style="padding:4px 8px;border-bottom:1px solid var(--background-modifier-border);text-align:center;"><div style="color:${color};font-weight:${weight};">${val}${trend}</div>${barHTML}</td>`;
                });
                _tHTML += `<td style="padding:4px 10px;border-bottom:1px solid var(--background-modifier-border);color:var(--text-faint);font-size:11px;white-space:nowrap;">${ref.qualitative ? 'кач.' : ref.min + '–' + ref.max + (ref.unit ? ' ' + ref.unit : '')}</td></tr>`;
            });
        });
        _tHTML += `</tbody></table>`;
        _tableWrap.innerHTML = _tHTML;
        labBody.appendChild(_tableWrap);

        // Спарклайн-график ключевых параметров
        if (_labReadOnly.length > 1) {
            const _sparkParams = ["Гемоглобин","Лейкоциты","Нейтрофилы","Тромбоциты","АЛТ","АСТ","Креатинин","Билирубин","ПСА"];
            const _sparkColors = ["#1e88e5","#43a047","#00897b","#e91e63","#fb8c00","#8e24aa","#6d4c41","#f06292","#ff9800"];
            const _sparkEntries = [..._labReadOnly].reverse();
            const _sparkLabels = _sparkEntries.map(e => { try { const d = dv.date(e.Дата); return d ? d.toFormat("dd.MM.yy") : ""; } catch(_) { return ""; } });
            const _sparkArea = document.createElement("div");
            _sparkArea.style.cssText = "padding:8px 12px 12px;border-top:1px solid var(--background-modifier-border);";
            _sparkArea.innerHTML = `<div style="font-size:10px;color:var(--text-muted);font-weight:600;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px;">Динамика ключевых показателей (% от нормы)</div>`;
            const _sparkCanvasWrap = document.createElement("div");
            _sparkCanvasWrap.style.cssText = "height:160px;position:relative;";
            const _sparkCanvas = document.createElement("canvas");
            _sparkCanvasWrap.appendChild(_sparkCanvas);
            _sparkArea.appendChild(_sparkCanvasWrap);
            labBody.appendChild(_sparkArea);
            const _drawSpark = () => {
                if (!window.Chart) return;
                const datasets = [];
                let _ci = 0;
                _sparkParams.forEach((param) => {
                    const ref = _allParamsRef[param];
                    if (!ref) return;
                    const range = ref.max - ref.min;
                    const absVals = _sparkEntries.map(e => { const v = e[param]; if (v===undefined||v===null||v==="") return null; const n=Number(String(v).replace(',','.')); return Number.isFinite(n) ? n : null; });
                    const vals = _sparkEntries.map(e => { const v = e[param]; if (v===undefined||v===null||v==="") return null; const n=Number(String(v).replace(',','.')); if (!Number.isFinite(n)) return null; return range>0 ? Math.round(((n-ref.min)/range)*1000)/10 : n; });
                    if (vals.filter(v=>v!==null).length >= 2) {
                        const c = _sparkColors[_ci++ % _sparkColors.length];
                        datasets.push({ label: param, data: vals, absData: absVals, unit: ref.unit || "", borderColor: c, backgroundColor: 'transparent', tension: 0.3, pointRadius: 2, borderWidth: 2, spanGaps: true });
                    }
                });
                if (datasets.length === 0) { _sparkArea.style.display = "none"; return; }
                const refBand = [
                    { label: '_min', data: _sparkLabels.map(()=>0),   borderColor:'transparent', backgroundColor:'rgba(76,175,80,0.10)', fill:'+1', pointRadius:0, borderWidth:0 },
                    { label: '_max', data: _sparkLabels.map(()=>100), borderColor:'rgba(76,175,80,0.4)', backgroundColor:'rgba(76,175,80,0.10)', fill:'-1', pointRadius:0, borderWidth:1, borderDash:[3,3] },
                ];
                new window.Chart(_sparkCanvas, {
                    type: 'line',
                    data: { labels: _sparkLabels, datasets: [...refBand, ...datasets] },
                    options: { maintainAspectRatio:false, interaction:{mode:'index',intersect:false},
                        plugins: { legend:{position:'bottom',labels:{color:"var(--text-normal)",font:{size:9},boxWidth:10,padding:6,filter:item=>!item.text.startsWith('_')}}, tooltip:{callbacks:{label:ctx=>{ if (ctx.dataset.label.startsWith('_')) return null; const raw=Array.isArray(ctx.dataset.absData)?ctx.dataset.absData[ctx.dataIndex]:null; const unit=ctx.dataset.unit?` ${ctx.dataset.unit}`:""; const rawText=raw!==null&&raw!==undefined?` (${String(raw).replace(".", ",")}${unit})`:""; return ` ${ctx.dataset.label}: ${ctx.parsed.y}% от нормы${rawText}`; }}} },
                        scales: { x:{ticks:{color:"var(--text-muted)",font:{size:9},maxRotation:45,minRotation:45}}, y:{ticks:{color:"var(--text-muted)",font:{size:9},callback:v=>v+'%'}} }
                    }
                });
            };
            if (window.Chart) { _drawSpark(); } else { const _s=document.createElement("script"); _s.src="https://cdn.jsdelivr.net/npm/chart.js"; _s.onload=_drawSpark; document.head.appendChild(_s); }
        }

        labDet.appendChild(labSummary);
        labDet.appendChild(labBody);
        if (card.parentElement) {
            card.parentElement.insertBefore(labDet, card.nextSibling);
        }
    }
}

// ── Копирование СНИЛС по клику ────────────────────────────────────────────────
card.querySelectorAll("[data-copy-snils]").forEach(el => {
    el.addEventListener("click", () => {
        const val = el.getAttribute("data-copy-snils");
        navigator.clipboard.writeText(val).then(() => {
            new Notice("📋 СНИЛС скопирован: " + val);
            const span = el.querySelector(".pf-snils-value");
            if (span) {
                const orig = span.textContent;
                span.style.color = "var(--interactive-accent)";
                span.textContent = "✓ скопировано";
                setTimeout(() => { span.textContent = orig; span.style.color = ""; }, 1500);
            }
        }).catch(() => new Notice("❌ Не удалось скопировать СНИЛС"));
    });
});

// ============================================================
// ПРЕДПИСАНИЕ — подраздел карты пациента
// ============================================================
{
    const prescRod1 = rod1;
    const prescFrac1 = frac1;
    const prescComma = (x) => (typeof x === "number" ? x.toString() : String(x)).replace(".", ",");
    const prescDecimalsOf = (val) => { const s = (val ?? "").toString().replace(",", "."); const m = s.match(/\.(\d+)/); return m ? m[1].length : 0; };
    const prescFmtDose = (val, dec = 1) => prescComma(Number(val).toFixed(dec));

    const prescFio = cur.ФИО ?? "ФИО не указано";
    const prescDob = dv.date(cur.Дата_рождения);
    const prescDobStr = prescDob ? prescDob.toFormat("dd.MM.yyyy") : "—";
    let prescAge = "—";
    if (prescDob) {
        const now = dv.date("now");
        prescAge = now.year - prescDob.year - ((now.month < prescDob.month || (now.month === prescDob.month && now.day < prescDob.day)) ? 1 : 0);
    }
    const prescDiag = (cur.Диагноз ?? "—").toString().replace(/(\r\n|\n|\r)/gm, " ").trim();
    const prescStartStr = start1 ? fmt(start1) : "—";
    const prescTags = (cur.tags ?? []).map(x => x.toLowerCase());

    // Строки доз (упрощённая логика)
    const PRESC_CONN_HEADERS = { "Последовательный буст": "Последовательный буст", "Одновременно": "Синхронный интегрированный буст", "Параллельно": "Параллельно", "Последовательно": "Последовательно" };
    const PRESC_CONN_COLORS  = { "Последовательный буст": "#9c27b0", "Одновременно": "#4caf50", "Параллельно": "#ff9800", "Последовательно": "#ffc107" };
    let prescDoseOutput = [];

    if (extraVolumes.length === 0) {
        if (prescFrac1 > 0 && prescRod1 > 0) {
            const d = Math.max(1, prescDecimalsOf(cur.РОД));
            const sd = prescRod1 * prescFrac1;
            prescDoseOutput.push({ type: "line", text: `${cur.Название_PTV || "PTV"} — ${prescFrac1} фр. по ${prescFmtDose(prescRod1, d)} Гр (СД ${prescFmtDose(sd, d)} Гр)` });
        }
    } else {
        const d1p = Math.max(1, prescDecimalsOf(cur.РОД));
        const sd1p = (prescFrac1 && prescRod1) ? prescFrac1 * prescRod1 : 0;
        if (prescFrac1 > 0 && prescRod1 > 0) {
            prescDoseOutput.push({ type: "line", text: `${cur.Название_PTV || "PTV1"} — ${prescFrac1} фр. по ${prescFmtDose(prescRod1, d1p)} Гр (СД ${prescFmtDose(sd1p, d1p)} Гр)` });
            const firstConn = normalizeConn(extraVolumes[0].Связь || "");
            if (PRESC_CONN_HEADERS[firstConn]) prescDoseOutput.push({ type: "header", text: PRESC_CONN_HEADERS[firstConn], color: PRESC_CONN_COLORS[firstConn] });
        }
        let cumDoseP = sd1p, prevConnP = null;
        extraVolumes.forEach((vol, idx) => {
            const conn = normalizeConn(vol.Связь || "");
            const fracN = (conn === "Одновременно") ? prescFrac1 : Number(vol.Количество_фракций);
            const rodN  = Number((vol.РОД ?? "").toString().replace(",", "."));
            if (!fracN || !rodN) return;
            const dN = Math.max(1, prescDecimalsOf(vol.РОД));
            const sdN = rodN * fracN;
            if (prevConnP !== null && conn !== prevConnP && PRESC_CONN_HEADERS[conn])
                prescDoseOutput.push({ type: "header", text: PRESC_CONN_HEADERS[conn], color: PRESC_CONN_COLORS[conn] });
            let displaySD = sdN;
            if (conn === "Последовательный буст") { cumDoseP += sdN; displaySD = cumDoseP; }
            prescDoseOutput.push({ type: "line", text: `${vol.Название || "PTV" + (idx + 2)} — ${fracN} фр. по ${prescFmtDose(rodN, dN)} Гр (СД ${prescFmtDose(displaySD, dN)} Гр)` });
            prevConnP = conn;
        });
    }

    // Третья строка
    const prescAreaPairs = [];
    if (cur.Область_облучения && cur.Область_облучения !== "—") prescAreaPairs.push(cur.Область_облучения);
    extraVolumes.forEach(vol => { if (vol.Область_облучения) prescAreaPairs.push(vol.Область_облучения); });
    const prescThirdLine = `${cur.Цель_лечения ? cur.Цель_лечения + ". " : ""}${prescAreaPairs.length ? "Объемы: " + prescAreaPairs.join("; ") : ""}`;
    const prescAcceleratorLine = cur.Ускоритель ? `Ускоритель: ${cur.Ускоритель}` : "";

    // ХЛТ
    let prescHltLine = "";
    const prescHltDrugs = (() => {
        const raw = cur.ХЛТ_препараты;
        if (Array.isArray(raw) && raw.length > 0) return raw.filter(Boolean);
        if (cur.Радиомодификация) return [{ Препарат: cur.Радиомодификация.toString(), Режим: cur.ХЛТ_режим || "" }];
        return [];
    })();
    if (prescHltDrugs.length > 0) {
        const drugsText = prescHltDrugs
            .map(d => `${(d.Препарат ?? "").trim()} ${(d.Режим ?? "").toLowerCase()}`.trim())
            .join(" + ");
        prescHltLine = `ХЛТ: ${drugsText}`;
    }

    // Статус стационара
    let prescStatusLine = "";
    if (prescTags.includes("дс")) prescStatusLine = "Дневной стационар.";
    else if (prescTags.includes("кс")) prescStatusLine = "Круглосуточный стационар.";
    const prescFundingLine = (() => {
        const fundingText = String(cur["Группа ВМП"] ?? "").replace(/\s+/g, " ").trim();
        const funding = patientCardFundingLabel(fundingText);
        return funding ? `Финансирование: ${funding}` : "";
    })();

    // Текст для копирования
    const prescLineItems = prescDoseOutput.filter(i => i.type === "line");
    const prescDoseCopy = prescDoseOutput.map(item => {
        if (item.type === "header") return `${item.text}:`;
        const isLast = prescLineItems.indexOf(item) === prescLineItems.length - 1;
        return `${item.text}${isLast ? "." : ";"}`;
    }).join("\n");
    const prescCopyText = [
        `${prescFio}, ${prescAge} лет, ${prescDobStr}`,
        prescDiag,
        prescThirdLine,
        prescAcceleratorLine || null,
        prescHltLine || null,
        prescDoseCopy,
        `Старт: ${prescStartStr}`,
        prescStatusLine,
        prescFundingLine
    ].filter(Boolean).join("\n\n");

    // --- ПЛАШКА (bottom bar) ---
    const PRESC_KEY = 'presc_open_' + cur.file.path;
    if (!window.hasOwnProperty(PRESC_KEY)) window[PRESC_KEY] = false;

    const bottomBar = card.createEl("div");
    bottomBar.className = "pf-bottom-tabs";
    bottomBar.dataset.hasEln = hasSick ? "1" : "0";
    bottomBar.style.cssText = "display:flex;align-items:center;justify-content:center;gap:6px;margin-top:14px;padding-top:10px;border-top:1px solid var(--background-modifier-border);position:relative;";

    { const _old = document.getElementById('pf-bottom-tabs-style'); if (_old) _old.remove();
      const _st = document.createElement('style');
      _st.id = 'pf-bottom-tabs-style';
      _st.textContent = `
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
      document.head.appendChild(_st);
    }

    // ── Кнопка «🔔 Напоминания» ───────────────────────────────────────────
    const REMFRAC_KEY = 'remfrac_open_' + cur.file.path;
    if (!window.hasOwnProperty(REMFRAC_KEY)) window[REMFRAC_KEY] = false;
    const BTN_BASE = "display:flex;align-items:center;gap:5px;padding:6px 13px;border-radius:20px;font-size:12px;font-weight:600;cursor:pointer;transition:all 0.18s;line-height:1;border:none;font-family:var(--font-interface);";
    const remFracBtn = bottomBar.createEl("button");
    remFracBtn.classList.add("pf-bottom-tab-btn");
    const hasActiveReminders = Array.isArray(cur.Напоминания) &&
        cur.Напоминания.some(r => r && r.дата && r.текст && r.выполнено !== true);
    const updateRemFracBtn = () => {
        const open = window[REMFRAC_KEY];
        remFracBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg> Напоминания`;
        if (open)
            remFracBtn.style.cssText = BTN_BASE + "background:#e3f2fd;color:#1565c0;box-shadow:0 0 0 2px rgba(21,101,192,0.25);";
        else if (hasActiveReminders)
            remFracBtn.style.cssText = BTN_BASE + "background:rgba(21,101,192,0.1);color:#1565c0;";
        else
            remFracBtn.style.cssText = BTN_BASE + "background:var(--background-modifier-hover);color:var(--text-muted);";
    };
    updateRemFracBtn();
    remFracBtn.onmouseenter = () => { if (!window[REMFRAC_KEY] && !hasActiveReminders) remFracBtn.style.background = "var(--background-modifier-border)"; };
    remFracBtn.onmouseleave = () => { updateRemFracBtn(); };

    // ── Кнопка «📋 Предписание» ────────────────────────────────────────────
    const expandBtn = bottomBar.createEl("button");
    expandBtn.classList.add("pf-bottom-tab-btn");
    const prescHighlight = cur.Оконтуривание === true;
    const updateExpandBtn = () => {
        const open = window[PRESC_KEY];
        expandBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg> Предписание`;
        if (open)
            expandBtn.style.cssText = BTN_BASE + "background:#f3e5f5;color:#6a1b9a;box-shadow:0 0 0 2px rgba(106,27,154,0.2);";
        else if (prescHighlight)
            expandBtn.style.cssText = BTN_BASE + "background:rgba(106,27,154,0.1);color:#7b1fa2;";
        else
            expandBtn.style.cssText = BTN_BASE + "background:var(--background-modifier-hover);color:var(--text-muted);";
    };
    updateExpandBtn();
    expandBtn.onmouseenter = () => { if (!window[PRESC_KEY] && !prescHighlight) expandBtn.style.background = "var(--background-modifier-border)"; };
    expandBtn.onmouseleave = () => { updateExpandBtn(); };

    // ── Кнопка «🧾 ЭЛН» (только если включён больничный) ───────────────────
    const ELN_KEY = 'eln_open_' + cur.file.path;
    if (!window.hasOwnProperty(ELN_KEY)) window[ELN_KEY] = false;
    let elnBtn = null;
    const updateElnBtn = () => {
        if (!elnBtn) return;
        const open = window[ELN_KEY];
        elnBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> ЭЛН`;
        elnBtn.style.cssText = BTN_BASE + (open
            ? "background:#fff3e0;color:#e65100;box-shadow:0 0 0 2px rgba(230,81,0,0.2);"
            : "background:var(--background-modifier-hover);color:var(--text-muted);");
    };
    if (hasSick) {
        elnBtn = bottomBar.createEl("button");
        elnBtn.classList.add("pf-bottom-tab-btn");
        updateElnBtn();
        elnBtn.onmouseenter = () => { if (!window[ELN_KEY]) elnBtn.style.background = "var(--background-modifier-border)"; };
        elnBtn.onmouseleave = () => { if (!window[ELN_KEY]) elnBtn.style.background = "var(--background-modifier-hover)"; };
    }


    // Панель предписания
    const prescPanel = card.createEl("div");
    prescPanel.style.cssText = `margin-top: 10px; padding: 14px 44px 14px 16px; background: var(--background-primary); border: 1px solid var(--background-modifier-border); border-radius: 7px; font-size: 0.9em; line-height: 1.6; display: ${window[PRESC_KEY] ? "block" : "none"}; position:relative;`;
    prescPanel.innerHTML = [
        `<div style="font-weight: 700; margin-bottom: 6px;">${prescFio}, ${prescAge} лет, ${prescDobStr}</div>`,
        `<div style="margin-bottom: 6px;">${prescDiag}</div>`,
        prescThirdLine ? `<div style="margin-bottom: 6px; font-weight: 500;">${prescThirdLine}</div>` : "",
        prescAcceleratorLine ? `<div style="margin-bottom: 6px; color: var(--text-muted);">${prescAcceleratorLine}</div>` : "",
        prescHltLine   ? `<div style="margin-bottom: 6px; color: var(--text-muted);">${prescHltLine}</div>` : "",
        `<div style="margin-bottom: 6px;">${prescDoseOutput.map(item => {
            if (item.type === "header") return `<div style="font-size: 0.78em; font-weight: 700; text-transform: uppercase; color: ${item.color || "var(--text-accent)"}; margin-top: 6px; margin-bottom: 2px;">${item.text}:</div>`;
            const isLast = prescLineItems.indexOf(item) === prescLineItems.length - 1;
            return `<div style="font-weight: 600;">${item.text}${isLast ? "." : ";"}</div>`;
        }).join("")}</div>`,
        `<div style="color: var(--text-muted);">Старт: ${prescStartStr}</div>`,
        prescStatusLine ? `<div style="color: var(--text-muted); font-style: italic;">${prescStatusLine}</div>` : "",
        prescFundingLine ? `<div style="color: var(--text-muted); font-style: italic;">${prescFundingLine}</div>` : ""
    ].filter(Boolean).join("");

    const copyPrescBtn = prescPanel.createEl("button");
    copyPrescBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect width="8" height="4" x="8" y="2" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/></svg>`;
    copyPrescBtn.title = "Копировать предписание";
    copyPrescBtn.style.cssText = "position:absolute;top:8px;right:8px;background:transparent;border:none;color:var(--text-muted);cursor:pointer;padding:6px;border-radius:6px;transition:all 0.2s;display:flex;align-items:center;";
    copyPrescBtn.onmouseenter = () => { copyPrescBtn.style.color="var(--text-normal)"; copyPrescBtn.style.background="var(--background-modifier-hover)"; };
    copyPrescBtn.onmouseleave = () => { copyPrescBtn.style.color="var(--text-muted)"; copyPrescBtn.style.background="transparent"; };
    copyPrescBtn.onclick = () => window.navigator.clipboard.writeText(prescCopyText).then(() => new Notice("📋 Предписание скопировано!"));

    // ── Панель «Напоминания и фракции» ────────────────────────────────────
    const remFracPanel = card.createEl("div");
    remFracPanel.style.cssText = `display:${window[REMFRAC_KEY] ? "block" : "none"};margin-top:10px;border-radius:10px;overflow:hidden;border:1px solid var(--background-modifier-border);`;

    // ── Панель «ЭЛН» ─────────────────────────────────────────────────────────
    const elnPanel = hasSick ? card.createEl("div") : null;
    if (elnPanel) {
        elnPanel.style.cssText = `display:${window[ELN_KEY] ? "block" : "none"};margin-top:10px;border-radius:10px;overflow:hidden;border:1px solid var(--background-modifier-border);`;
    }

    // ── Управление вкладками: только одна открыта одновременно ─────────────
    const syncBottomPanels = () => {
        prescPanel.style.display = window[PRESC_KEY] ? "block" : "none";
        remFracPanel.style.display = window[REMFRAC_KEY] ? "block" : "none";
        if (elnPanel) elnPanel.style.display = window[ELN_KEY] ? "block" : "none";
        updateExpandBtn();
        updateRemFracBtn();
        updateElnBtn();
    };

    const openSingleBottomPanel = (which) => {
        window[PRESC_KEY] = which === "presc";
        window[REMFRAC_KEY] = which === "rem";
        window[ELN_KEY] = !!elnPanel && which === "eln";
        syncBottomPanels();
    };

    const toggleBottomPanel = (which) => {
        const isOpen = which === "presc"
            ? window[PRESC_KEY]
            : (which === "rem" ? window[REMFRAC_KEY] : window[ELN_KEY]);
        openSingleBottomPanel(isOpen ? null : which);
    };

    // Нормализуем состояние (если ранее было открыто несколько)
    const initiallyOpen = window[REMFRAC_KEY]
        ? "rem"
        : (window[PRESC_KEY]
            ? "presc"
            : ((elnPanel && window[ELN_KEY]) ? "eln" : null));
    openSingleBottomPanel(initiallyOpen);

    expandBtn.onclick = () => toggleBottomPanel("presc");
    remFracBtn.onclick = () => toggleBottomPanel("rem");
    if (elnBtn && elnPanel) {
        elnBtn.onclick = () => toggleBottomPanel("eln");
    }

    // ── СОДЕРЖИМОЕ ПАНЕЛИ: НАПОМИНАНИЯ + ФРАКЦИИ ─────────────────────────
    {
    try {
    const pnl = remFracPanel;
    const P = "14px";  // единый горизонтальный отступ
    const CHIP_BTN = "display:flex;align-items:center;justify-content:center;gap:5px;height:36px;padding:0 14px;border-radius:6px;border:none;font-size:13px;font-weight:600;cursor:pointer;font-family:var(--font-interface);transition:opacity 0.15s;white-space:nowrap;flex-shrink:0;";
    const ACT_BTN  = "width:30px;height:30px;padding:0;display:flex;align-items:center;justify-content:center;background:transparent;border:1px solid var(--background-modifier-border);border-radius:6px;color:var(--text-muted);cursor:pointer;transition:all 0.15s;flex-shrink:0;";

    // ── Строка 1: дата + Пропуск + Фракция ───────────────────────────────
    const row1 = pnl.createEl("div");
    row1.className = `pf-rem-row1`;
    row1.style.cssText = `display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:12px ${P} 8px;`;
    const sharedDatePicker = makeDatePicker(row1, today.toFormat("yyyy-MM-dd"), "width:150px;flex-shrink:0;");
    const selectedFractionDates = new Set();
    const selectedFractionDatesRow = pnl.createEl("div");
    selectedFractionDatesRow.style.cssText = `display:none;align-items:center;gap:6px;flex-wrap:wrap;padding:0 ${P} 8px;`;
    const renderSelectedFractionDates = () => {
        selectedFractionDatesRow.empty();
        const selected = Array.from(selectedFractionDates).sort();
        selectedFractionDatesRow.style.display = selected.length ? "flex" : "none";
        selected.forEach(iso => {
            const chip = selectedFractionDatesRow.createEl("span");
            chip.setAttribute("data-pf-selected-fraction-date", iso);
            chip.style.cssText = "display:inline-flex;align-items:center;gap:5px;padding:3px 7px 3px 10px;border-radius:20px;background:var(--background-secondary);color:var(--text-normal);font-size:12px;border:1px solid var(--background-modifier-border);";
            chip.appendChild(document.createTextNode(dv.date(iso)?.toFormat("dd.MM.yyyy") || iso));
            const del = chip.createEl("button");
            del.type = "button";
            del.textContent = "×";
            del.style.cssText = "width:18px;height:18px;padding:0;border:none;border-radius:50%;background:var(--background-modifier-border);color:var(--text-muted);cursor:pointer;line-height:1;";
            del.onclick = () => { selectedFractionDates.delete(iso); renderSelectedFractionDates(); };
        });
    };
    const addSelectedDateBtn = row1.createEl("button");
    addSelectedDateBtn.textContent = "+ дата";
    addSelectedDateBtn.title = "Добавить дату в набор для массового пропуска/фракции";
    addSelectedDateBtn.style.cssText = "height:36px;padding:0 10px;border-radius:6px;border:1px solid var(--background-modifier-border);background:var(--background-primary);color:var(--text-normal);font-size:12px;cursor:pointer;flex-shrink:0;";
    addSelectedDateBtn.onclick = () => {
        const iso = sharedDatePicker.value;
        if (!iso) { new Notice("❌ Выберите дату!"); return; }
        selectedFractionDates.add(iso);
        renderSelectedFractionDates();
    };

    const skipBtn = row1.createEl("button");
    skipBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg> Пропуск`;
    skipBtn.style.cssText = CHIP_BTN + "background:#e53935;color:white;flex:1;";
    skipBtn.onmouseenter = () => skipBtn.style.opacity="0.82";
    skipBtn.onmouseleave = () => skipBtn.style.opacity="1";

    const fracBtn = row1.createEl("button");
    fracBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> Фракция`;
    fracBtn.style.cssText = CHIP_BTN + "background:#2e7d32;color:white;flex:1;";
    fracBtn.onmouseenter = () => fracBtn.style.opacity="0.82";
    fracBtn.onmouseleave = () => fracBtn.style.opacity="1";

    // ── Строка 2: текст + Напомнить ───────────────────────────────────────
    const row2 = pnl.createEl("div");
    row2.className = `pf-rem-row2`;
    row2.style.cssText = `display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:0 ${P} 12px;`;

    const remTextInput = row2.createEl("input");
    remTextInput.type = "text";
    remTextInput.placeholder = "Текст напоминания…";
    remTextInput.style.cssText = "flex:1;min-width:0;height:36px;border-radius:6px;border:1px solid var(--background-modifier-border);background:var(--background-primary);color:var(--text-normal);padding:0 10px;font-size:13px;font-family:var(--font-interface);outline:none;transition:border-color 0.15s;";
    remTextInput.onfocus = () => remTextInput.style.borderColor = "var(--interactive-accent)";
    remTextInput.onblur  = () => remTextInput.style.borderColor = "var(--background-modifier-border)";

    const remAddBtn = row2.createEl("button");
    remAddBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg> Напомнить`;
    remAddBtn.style.cssText = CHIP_BTN + "background:#1976d2;color:white;";
    remAddBtn.onmouseenter = () => remAddBtn.style.opacity="0.82";
    remAddBtn.onmouseleave = () => remAddBtn.style.opacity="1";

    const chemoRow = pnl.createEl("div");
    chemoRow.className = "pf-rem-chemo-row";
    chemoRow.style.cssText = `display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:0 ${P} 12px;border-top:1px solid var(--background-modifier-border);padding-top:10px;`;

    const chemoModeSelect = chemoRow.createEl("select");
    chemoModeSelect.setAttribute("data-pf-chemo-mode", "1");
    chemoModeSelect.style.cssText = "height:36px;min-width:150px;border-radius:6px;border:1px solid var(--background-modifier-border);background:var(--background-primary);color:var(--text-normal);padding:0 8px;font-size:13px;font-family:var(--font-interface);";
    [
        ["date-only", "ХТ: дата"],
        ["daily", "ХТ: ежедневно"],
        ["rt-days", "ХТ: дни ЛТ"]
    ].forEach(([value, label]) => {
        const opt = chemoModeSelect.createEl("option", { text: label });
        opt.value = value;
    });
    chemoModeSelect.value = String(cur["ХТ_режим"] || "date-only");

    const chemoDatePicker = makeDatePicker(chemoRow, (Array.isArray(cur["ХТ_даты"]) && cur["ХТ_даты"][0]) || (start1 ? start1.toFormat("yyyy-MM-dd") : today.toFormat("yyyy-MM-dd")), "width:150px;flex-shrink:0;");
    chemoDatePicker.setAttribute("data-pf-chemo-date", "1");

    const chemoGenerateBtn = chemoRow.createEl("button");
    chemoGenerateBtn.textContent = "Сгенерировать";
    chemoGenerateBtn.style.cssText = CHIP_BTN + "background:#7b4dff;color:white;";
    chemoGenerateBtn.onmouseenter = () => chemoGenerateBtn.style.opacity = "0.82";
    chemoGenerateBtn.onmouseleave = () => chemoGenerateBtn.style.opacity = "1";

    const chemoHint = chemoRow.createEl("span");
    chemoHint.textContent = "Ручной сдвиг ближайшей даты сдвинет последующие даты ХТ";
    chemoHint.style.cssText = "color:var(--text-muted);font-size:12px;line-height:1.3;flex:1 1 220px;";

    chemoModeSelect.onchange = () => {
        app.fileManager.processFrontMatter(file, fm => {
            fm["ХТ_режим"] = chemoModeSelect.value || "date-only";
        });
    };

    chemoGenerateBtn.onclick = async () => {
        if (!_pfPatientChemoReminders) {
            new Notice("❌ Модуль ХТ-напоминаний не загружен");
            return;
        }
        const treatmentStartIso = (start1 || dv.date(chemoDatePicker.value) || today)?.toISODate?.() || chemoDatePicker.value;
        const treatmentEndIso = (overallEnd || end1 || start1 || dv.date(chemoDatePicker.value) || today)?.toISODate?.() || treatmentStartIso;
        const rtDates = [
            ...(Array.isArray(schedule1) ? schedule1 : []),
            ...extraSchedules.flatMap(s => Array.isArray(s.schedule) ? s.schedule : [])
        ].map(d => d?.toISODate ? d.toISODate() : "").filter(Boolean);
        const skippedRtDates = skipDates.map(d => d?.toISODate ? d.toISODate() : "").filter(Boolean);
        const holidayDates = Array.from(holidays || []);
        const chemoDate = chemoDatePicker.value || treatmentStartIso;
        const chemoResult = _pfPatientChemoReminders.buildChemoReminders({
            mode: chemoModeSelect.value || "date-only",
            treatmentStartIso: chemoDate || treatmentStartIso,
            treatmentEndIso,
            rtDates,
            skippedRtDates,
            holidays: holidayDates
        });
        const labResult = _pfPatientChemoReminders.buildWeeklyLabReminders({
            treatmentStartIso,
            treatmentEndIso,
            skippedRtDates,
            holidays: holidayDates
        });
        await app.fileManager.processFrontMatter(file, fm => {
            fm["ХТ_режим"] = chemoModeSelect.value || "date-only";
            fm["ХТ_даты"] = chemoDate ? [chemoDate] : [];
            fm["ХТ_напоминания"] = chemoResult.chemo || [];
            fm["Контроль_крови"] = labResult || [];
        });
        new Notice("✅ ХТ-напоминания сгенерированы");
    };


    // ── Адаптив: на мобиле дата и кнопки на всю ширину ───────────────────
    { const _old = document.getElementById('pf-rem-style'); if (_old) _old.remove();
      const remStyle = document.createElement('style');
      remStyle.id = 'pf-rem-style';
      remStyle.textContent = `
        @media (max-width: 600px) {
            .pf-rem-row1 { flex-wrap: wrap !important; }
            .pf-rem-row1 > *:first-child { width: 100% !important; flex: none !important; min-width: 0 !important; }
            .pf-rem-row1 > button { flex: 1 1 0 !important; min-width: 0 !important; }
            .pf-rem-row2 { flex-wrap: wrap !important; }
            .pf-rem-row2 > input { width: 100% !important; flex: none !important; }
            .pf-rem-row2 > button { flex: 1 1 0 !important; min-width: 0 !important; }
            .pf-rem-chemo-row > select,
            .pf-rem-chemo-row > input,
            .pf-rem-chemo-row > button { width: 100% !important; flex: none !important; min-width: 0 !important; }
        }
      `;
      document.head.appendChild(remStyle); }

    // ── Список напоминаний ────────────────────────────────────────────────
    const remListContainer = pnl.createEl("div");
    remListContainer.className = `pf-rem-list`;
    remListContainer.style.cssText = `padding:0 ${P};`;

    const renderReminderCard = (reminder, insertBefore = null) => {
        const rDate = dv.date(reminder.дата);
        if (!rDate) return;
        const isDone  = reminder.выполнено === true;
        const isPast  = rDate < today;
        const isToday = rDate.toISODate() === today.toISODate();
        let color = "#1976d2";
        if (isDone) color = "var(--text-muted)";
        else if (isPast) color = "#e53935";
        else if (isToday) color = "#f57c00";
        const card2 = document.createElement("div");
        card2.style.cssText = `display:flex;align-items:center;gap:10px;padding:7px 10px;margin-bottom:5px;background:var(--background-primary);border:1px solid var(--background-modifier-border);border-left:3px solid ${color};border-radius:7px;opacity:${isDone?"0.45":"1"};transition:all 0.18s;`;
        const infoDiv = document.createElement("div");
        infoDiv.style.cssText = "flex:1;min-width:0;";
        const dateClass = isDone ? "text-decoration:line-through;" : "";
        infoDiv.innerHTML = `<span style="font-size:0.75em;color:var(--text-muted);margin-right:6px;">${rDate.toFormat("dd.MM.yyyy")}</span><span style="font-size:0.9em;font-weight:500;color:var(--text-normal);${dateClass}">${reminder.текст}</span>`;
        card2.appendChild(infoDiv);
        const btnDiv = document.createElement("div");
        btnDiv.style.cssText = "display:flex;gap:5px;flex-shrink:0;";
        card2.appendChild(btnDiv);
        const searchDate = rDate.toISODate();
        const searchText = reminder.текст;
        if (!isDone) {
            const checkBtn = document.createElement("button");
            checkBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8"><polyline points="20 6 9 17 4 12"/></svg>`;
            checkBtn.style.cssText = ACT_BTN;
            checkBtn.onmouseenter = () => { checkBtn.style.color="#4caf50"; checkBtn.style.borderColor="#4caf50"; checkBtn.style.background="rgba(76,175,80,0.08)"; };
            checkBtn.onmouseleave = () => { checkBtn.style.color="var(--text-muted)"; checkBtn.style.borderColor="var(--background-modifier-border)"; checkBtn.style.background="transparent"; };
            checkBtn.onclick = () => {
                card2.style.opacity="0.45"; card2.style.borderLeftColor="var(--text-muted)";
                infoDiv.querySelector("span:last-child").style.textDecoration="line-through";
                checkBtn.remove(); new Notice("✅ Выполнено");
                app.fileManager.processFrontMatter(file, fm => {
                    if (!fm.Напоминания) return;
                    const idx = fm.Напоминания.findIndex(r => { const fd=dv.date(r.дата); return fd&&fd.toISODate()===searchDate&&r.текст===searchText; });
                    if (idx!==-1) fm.Напоминания[idx].выполнено = true;
                });
            };
            btnDiv.appendChild(checkBtn);
        }
        const delBtn = document.createElement("button");
        delBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
        delBtn.style.cssText = ACT_BTN;
        delBtn.onmouseenter = () => { delBtn.style.color="#e53935"; delBtn.style.borderColor="#e53935"; delBtn.style.background="rgba(229,57,53,0.08)"; };
        delBtn.onmouseleave = () => { delBtn.style.color="var(--text-muted)"; delBtn.style.borderColor="var(--background-modifier-border)"; delBtn.style.background="transparent"; };
        delBtn.onclick = () => {
            card2.style.opacity="0"; card2.style.maxHeight="0"; card2.style.margin="0"; card2.style.padding="0";
            setTimeout(() => card2.remove(), 180); new Notice("🗑️ Удалено");
            app.fileManager.processFrontMatter(file, fm => {
                if (!fm.Напоминания) return;
                const idx = fm.Напоминания.findIndex(r => { const fd=dv.date(r.дата); return fd&&fd.toISODate()===searchDate&&r.текст===searchText; });
                if (idx!==-1) fm.Напоминания.splice(idx,1);
            });
        };
        btnDiv.appendChild(delBtn);
        if (insertBefore) remListContainer.insertBefore(card2, insertBefore);
        else remListContainer.appendChild(card2);
        return card2;
    };

    remAddBtn.onclick = () => {
        const date = sharedDatePicker.value;
        const text = remTextInput.value.trim();
        if (!date || !text) { new Notice("❌ Заполните дату и текст!"); return; }
        const newReminder = { дата: date, текст: text, выполнено: false };
        renderReminderCard(newReminder, remListContainer.firstChild);
        remTextInput.value = ""; new Notice("✅ Напоминание добавлено!");
        app.fileManager.processFrontMatter(file, fm => {
            if (!fm.Напоминания) fm.Напоминания = [];
            fm.Напоминания.push(newReminder);
        });
    };

    const isElnReminderText = (txt) => String(txt || "").includes("Написать ВК по ЭЛН");
const normalizeReminderDateIso = (v) => {
    if (!v) return "";
    const d = dv.date(v);
    if (d) return d.toFormat("yyyy-MM-dd");
    const s = String(v).trim();
    const mIso = s.match(/^(\d{4}-\d{2}-\d{2})/);
    if (mIso) return mIso[1];
    const mRu = s.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
    if (mRu) return `${mRu[3]}-${mRu[2]}-${mRu[1]}`;
    return s;
};
const normalizeReminderText = (v) => String(v ?? "").replace(/\s+/g, " ").trim();
const reminderKey = (r) => `${normalizeReminderDateIso(r?.дата ?? r?.Дата)}||${normalizeReminderText(r?.текст ?? r?.Текст)}`;
const isReminderDone = (r) => r?.выполнено === true || r?.Выполнено === true;
    let elnPendingState = [];
    let renderElnList = () => {};



    const addVkReminderFromEln = (selectedDateStr) => {
        const baseStart = getElnBaseStart();
        if (!baseStart) { new Notice("⚠️ Нет даты открытия ЭЛН/госпитализации"); return; }

        const todayIsoLocal = today.toFormat("yyyy-MM-dd");
        let targetDate = null;

        if (selectedDateStr && selectedDateStr !== todayIsoLocal) {
            targetDate = dv.date(selectedDateStr);
            if (!targetDate) { new Notice("❌ Некорректная дата"); return; }
            targetDate = targetDate.startOf("day");
        } else {
            let baseDate, daysToAdd;
            if (baseStart > today) {
                baseDate = baseStart; daysToAdd = 14;
            } else {
                const diffDays = today.diff(baseStart, "days").days;
                if (diffDays > 5) { baseDate = today; daysToAdd = 15; }
                else { baseDate = baseStart; daysToAdd = 14; }
            }
            targetDate = baseDate.plus({ days: daysToAdd });
        }

        let safety = 0;
        while (safety < 10) {
            const iso = targetDate.toISODate();
            if (targetDate.weekday > 5 || holidays.has(iso)) targetDate = targetDate.minus({ days: 1 });
            else break;
            safety++;
        }

        const totalDaysVal = Math.floor(targetDate.diff(baseStart, "days").days) + 1;
        let daysPassedVal, daysAddedVal;
        if (baseStart > today) {
            daysPassedVal = 0;
            daysAddedVal = totalDaysVal;
        } else {
            daysPassedVal = Math.floor(today.diff(baseStart, "days").days) + 1;
            daysAddedVal = Math.floor(targetDate.diff(today, "days").days);
        }

        const reminderText = `Написать ВК по ЭЛН (Прошло: ${daysPassedVal} + Доб: ${daysAddedVal} = Итог: ${totalDaysVal})`;
        const newReminder = { дата: targetDate.toFormat("yyyy-MM-dd"), текст: reminderText, выполнено: false };
        const targetIso = newReminder.дата;
        const existingIdx = elnPendingState.findIndex(r =>
            normalizeReminderDateIso(r?.дата ?? r?.Дата) === targetIso
        );

        app.fileManager.processFrontMatter(file, fm => {
            if (!Array.isArray(fm.Напоминания)) fm.Напоминания = [];
            let updated = false;
            fm.Напоминания = fm.Напоминания.map(r => {
                if (!r) return r;
                const txt = r.текст || r.Текст;
                if (!isElnReminderText(txt)) return r;
                if (isReminderDone(r)) return r;
                const iso = normalizeReminderDateIso(r.дата || r.Дата);
                if (iso !== targetIso) return r;
                updated = true;
                return { ...r, дата: newReminder.дата, текст: newReminder.текст, выполнено: false };
            });
            if (!updated) fm.Напоминания.push(newReminder);
        });

        if (existingIdx >= 0) {
            elnPendingState[existingIdx] = { ...elnPendingState[existingIdx], ...newReminder };
            new Notice(`♻️ Обновлено ВК на ${targetDate.toFormat("dd.MM.yyyy")}`);
        } else {
            elnPendingState.push(newReminder);
            new Notice(`✅ Добавлено ВК на ${targetDate.toFormat("dd.MM.yyyy")}`);
        }
        renderElnList();
    };

    if (hasSick && elnPanel) {
        const elnWrap = elnPanel.createEl("div");
        elnWrap.style.cssText = `padding:12px ${P};background:var(--background-primary);`;

        const openEnabled = cur.Открытый_ЭЛН_активен === true;

        const controlsRow = elnWrap.createEl("div");
        controlsRow.style.cssText = `display:grid;grid-template-columns:${openEnabled ? "1fr 1fr auto" : "1fr auto"};gap:8px;align-items:end;margin-bottom:8px;`;
        if (window.matchMedia && window.matchMedia("(max-width: 820px)").matches) {
            controlsRow.style.gridTemplateColumns = "1fr";
        }

        if (openEnabled) {
            const openCol = controlsRow.createEl("div");
            openCol.style.cssText = "display:flex;flex-direction:column;gap:4px;min-width:0;";

            const openLbl = openCol.createEl("span");
            openLbl.style.cssText = "font-size:12px;color:var(--text-muted);font-weight:600;";
            openLbl.textContent = "Открытый ЭЛН:";

            let openIso = "";
            if (cur.Открытый_ЭЛН) { const d = dv.date(cur.Открытый_ЭЛН); if (d) openIso = d.toFormat("yyyy-MM-dd"); }
            const openPicker = makeDatePicker(openCol, openIso, "width:100%;min-width:170px;");
            openPicker.onchange = () => {
                app.fileManager.processFrontMatter(file, fm => { fm.Открытый_ЭЛН = openPicker.value || null; });
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
        if (window.matchMedia && window.matchMedia("(max-width: 820px)").matches) {
            addVkBtn.style.width = "100%";
        }
        addVkBtn.onmouseenter = () => addVkBtn.style.opacity = "0.82";
        addVkBtn.onmouseleave = () => addVkBtn.style.opacity = "1";
        addVkBtn.onclick = () => addVkReminderFromEln(elnDatePicker.value);

        elnPendingState = (Array.isArray(cur.Напоминания) ? cur.Напоминания : [])
            .filter(r => r && (r.дата || r.Дата) && (r.текст || r.Текст) && isElnReminderText(r.текст || r.Текст) && !isReminderDone(r))
            .map(r => ({ ...r, дата: r.дата || r.Дата, текст: r.текст || r.Текст }));

        const pendingInfo = elnWrap.createEl("div");
        pendingInfo.style.cssText = "font-size:12px;color:var(--text-muted);margin-top:8px;";

        const elnList = elnWrap.createEl("div");
        elnList.style.cssText = "display:flex;flex-direction:column;gap:4px;margin-top:6px;";

        renderElnList = () => {
            elnPendingState.sort((a,b) => (dv.date(a.дата)||0) - (dv.date(b.дата)||0));
            pendingInfo.textContent = elnPendingState.length ? `Активные ВК: ${elnPendingState.length}` : "Активные ВК: нет";
            elnList.innerHTML = "";
            if (!elnPendingState.length) return;

            elnPendingState.forEach((r, idx) => {
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
                    const key = reminderKey(r);
                    await app.fileManager.processFrontMatter(file, fm => {
                        if (!Array.isArray(fm.Напоминания)) return;
                        fm.Напоминания.forEach(x => {
                            if (reminderKey(x) === key) {
                                x.выполнено = true;
                                x.Выполнено = true;
                            }
                        });
                    });
                    elnPendingState = elnPendingState.filter(x => reminderKey(x) !== key);
                    renderElnList();
                    new Notice("✅ ВК отмечено как выполненное");
                };

                const delBtn = row.createEl("button");
                delBtn.textContent = "×";
                delBtn.style.cssText = "width:26px;height:26px;border-radius:6px;border:1px solid var(--background-modifier-border);background:transparent;color:#e53935;cursor:pointer;font-weight:700;";
                delBtn.onclick = async () => {
                    const key = reminderKey(r);
                    await app.fileManager.processFrontMatter(file, fm => {
                        if (!Array.isArray(fm.Напоминания)) return;
                        fm.Напоминания = fm.Напоминания.filter(x => reminderKey(x) !== key);
                    });
                    elnPendingState = elnPendingState.filter(x => reminderKey(x) !== key);
                    renderElnList();
                    new Notice("🗑️ ВК удалено");
                };
            });
        };

        renderElnList();
    }
    if (cur.Напоминания && cur.Напоминания.length > 0) {
        const valid = cur.Напоминания
            .filter(r => r && (r.дата || r.Дата) && (r.текст || r.Текст) && !isElnReminderText(r.текст || r.Текст))
            .map(r => ({ ...r, дата: r.дата || r.Дата, текст: r.текст || r.Текст }));
        valid.sort((a,b) => { if (a.выполнено!==b.выполнено) return a.выполнено?1:-1; return (dv.date(a.дата)||0)-(dv.date(b.дата)||0); });
        valid.forEach(r => renderReminderCard(r));
    }

    // ── Одна строка чипов: пропуски (красные) + фракции (зелёные), сорт. по дате ──
    const fracSec = pnl.createEl("div");
    fracSec.style.cssText = `display:none;padding:8px ${P} 12px;border-top:1px solid var(--background-modifier-border);margin-top:6px;`;

    const chipsRow = fracSec.createEl("div");
    chipsRow.className = `pf-chips-row`;
    chipsRow.style.cssText = "display:flex;flex-wrap:wrap;gap:5px;";

    const skipContainer2 = { el: chipsRow };
    const fracContainer2 = { el: chipsRow };

    const resortChips = () => {
        const arr = Array.from(chipsRow.children);
        arr.sort((a, b) => (a.dataset.iso||"").localeCompare(b.dataset.iso||""));
        arr.forEach(c => chipsRow.appendChild(c));
    };

    const makeChip2 = (dateStr, fieldKey, chipBg, chipText) => {
        const d = dv.date(dateStr);
        const fmtDate2 = d ? d.toFormat("dd.MM.yyyy") : dateStr;
        const chip = document.createElement("div");
        chip.dataset.iso = dateStr;
        chip.dataset.field = fieldKey;
        chip.style.cssText = `display:inline-flex;align-items:center;gap:4px;padding:3px 5px 3px 10px;background:${chipBg};border-radius:20px;font-size:12px;font-weight:600;color:${chipText};`;
        const lbl = document.createElement("span");
        lbl.textContent = fmtDate2;
        chip.appendChild(lbl);
        const del = document.createElement("button");
        del.textContent = "×";
        del.style.cssText = `display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;padding:0;background:rgba(0,0,0,0.15);border:none;border-radius:50%;color:${chipText};font-size:15px;line-height:1;cursor:pointer;transition:background 0.15s;flex-shrink:0;`;
        del.onmouseenter = () => del.style.background = "rgba(0,0,0,0.30)";
        del.onmouseleave = () => del.style.background = "rgba(0,0,0,0.15)";
        del.onclick = () => {
            chip.style.transition = "opacity 0.15s"; chip.style.opacity = "0";
            setTimeout(() => {
                chip.remove();
                if (chipsRow.children.length === 0) fracSec.style.display = "none";
            }, 150);
            new Notice(`🗑️ Удалено: ${fmtDate2}`);
            app.fileManager.processFrontMatter(file, fm => {
                if (fm[fieldKey]) { fm[fieldKey] = fm[fieldKey].filter(x => String(x) !== dateStr); if (!fm[fieldKey].length) delete fm[fieldKey]; }
            });
        };
        chip.appendChild(del);
        chipsRow.appendChild(chip);
        resortChips();
        return chip;
    };

    const loadChips = (fieldKey, chipBg, chipText) => {
        const raw = cur[fieldKey];
        const dates = !raw ? [] : Array.isArray(raw)
            ? raw.map(x => x && x.toISODate ? x.toISODate() : String(x))
            : [raw && raw.toISODate ? raw.toISODate() : String(raw)];
        dates.forEach(ds => makeChip2(ds, fieldKey, chipBg, chipText));
    };
    loadChips("Пропущенные_даты",    "rgba(229,57,53,0.12)", "#c62828");
    loadChips("Внеплановые_фракции", "rgba(46,125,50,0.12)",  "#2e7d32");
    resortChips();
    if (chipsRow.children.length > 0) fracSec.style.display = "";

    const handleAdd2 = (dateVal, fieldKey, chipBg, chipText) => {
        if (!dateVal) { new Notice("❌ Выберите дату!"); return; }
        const fmtCheck = dv.date(dateVal)?.toFormat("dd.MM.yyyy") || dateVal;
        if (Array.from(chipsRow.children).some(c => c.dataset.iso === dateVal && c.dataset.field === fieldKey)) {
            new Notice("⚠️ Уже добавлено на эту дату"); return;
        }
        fracSec.style.display = "";
        makeChip2(dateVal, fieldKey, chipBg, chipText);
        new Notice(`✅ Добавлено: ${fmtCheck}`);
        app.fileManager.processFrontMatter(file, fm => {
            if (!fm[fieldKey]) fm[fieldKey] = [];
            if (!fm[fieldKey].some(d => String(d) === dateVal)) { fm[fieldKey].push(dateVal); fm[fieldKey].sort(); }
        });
    };

    const handleAddMany2 = (dateVal, fieldKey, chipBg, chipText) => {
        const selectedDates = (selectedFractionDates.size ? Array.from(selectedFractionDates) : [dateVal])
            .map(value => String(value || "").trim())
            .filter(Boolean)
            .sort();
        if (!selectedDates.length) { new Notice("❌ Выберите дату!"); return; }
        const existing = new Set(Array.from(chipsRow.children)
            .filter(c => c.dataset.field === fieldKey)
            .map(c => c.dataset.iso));
        const toAdd = selectedDates.filter(iso => !existing.has(iso));
        if (!toAdd.length) { new Notice("⚠️ Все выбранные даты уже добавлены"); return; }
        fracSec.style.display = "";
        toAdd.forEach(iso => makeChip2(iso, fieldKey, chipBg, chipText));
        app.fileManager.processFrontMatter(file, fm => {
            if (!fm[fieldKey]) fm[fieldKey] = [];
            const values = new Set((Array.isArray(fm[fieldKey]) ? fm[fieldKey] : [fm[fieldKey]]).map(d => String(d)));
            selectedDates.forEach(iso => values.add(iso));
            fm[fieldKey] = Array.from(values).filter(Boolean).sort();
        });
        selectedFractionDates.clear();
        renderSelectedFractionDates();
        new Notice(`✅ Добавлено дат: ${toAdd.length}`);
    };

    skipBtn.onclick = () => handleAddMany2(sharedDatePicker.value, "Пропущенные_даты",    "rgba(229,57,53,0.12)", "#c62828");
    fracBtn.onclick  = () => handleAddMany2(sharedDatePicker.value, "Внеплановые_фракции", "rgba(46,125,50,0.12)",  "#2e7d32");
    } catch (err) {
        console.error("Patient reminder/fraction panel failed; continuing patient page render", err);
        const fallback = remFracPanel.createEl("div");
        fallback.style.cssText = "padding:12px 14px;color:var(--text-muted);font-size:12px;background:var(--background-primary);";
        fallback.textContent = "Панель напоминаний временно недоступна. Календарь и заметки ниже продолжают отображаться.";
    }
    }
}
}


// ============================================================
// БЛОК 3: УМНЫЙ КАЛЕНДАРЬ
// ============================================================
{
const currentMonthStart = today.startOf("month");

const EXTRA_COLORS = ["#9c27b0", "#ff5722", "#00bcd4", "#8bc34a", "#e91e63"];

// normalizeConn — из пролога

const extraScheduleData = [];
let prevEnd = end1;

extraVolumes.forEach((vol, idx) => {
    const fracN = Number(vol.Количество_фракций);
    const modeN = (vol.Фракционирование ?? "Стандартный").toString().toLowerCase();
    const conn = normalizeConn(vol.Связь);
    const CONN_COLORS_B3 = { "Параллельно": "#ff9800", "Последовательно": "#ffc107", "Последовательный буст": "#9c27b0", "Одновременно": "#4caf50" };
    const color = CONN_COLORS_B3[conn] || EXTRA_COLORS[idx % EXTRA_COLORS.length];
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
                if (d.weekday <= 5 && !holidays.has(d.toISODate())) { startN = d; break; }
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

// ============================================================
// СВОДНАЯ КАРТА ДАТ: ISO -> { ptv1: bool, extras: [{color, conn}], hlt: bool }
// ============================================================

const dayInfoMap = new Map();

const ensureDay = (iso) => {
    if (!dayInfoMap.has(iso)) dayInfoMap.set(iso, {
        ptv1: false, extras: [], hlt: false, hltDrugs: [], reminders: [],
        consult: false, razmetka: false, remark: false, contourWin: false, recontourWin: false,
        planningWin: false, newPlanStart: false, newPlanningWin: false,
        meds: [], hltBreak: false, bloodControlNeeded: false, bloodControlDone: false
    });
    return dayInfoMap.get(iso);
};

// PTV1
schedule1.forEach(d => { ensureDay(toISO(d)).ptv1 = true; });

const _calConsult = cur.Дата_консультации && typeof cur.Дата_консультации !== 'boolean'
    ? dv.date(cur.Дата_консультации) : null;
if (_calConsult) {
    ensureDay(_calConsult.startOf("day").toISODate()).consult = true;
}

// Дополнительные PTV
extraScheduleData.forEach(({ schedule, conn, color, name }) => {
    schedule.forEach(d => {
        const info = ensureDay(toISO(d));
        if (!info.extras.some(e => e.color === color)) {
            info.extras.push({ color, conn, name });
        }
    });
});

// ============================================================
// ХЛТ РАСПИСАНИЕ — поддержка нескольких препаратов
// ============================================================
const hltDrugsB3 = (() => {
    const raw = cur.ХЛТ_препараты;
    if (Array.isArray(raw) && raw.length > 0) return raw.filter(Boolean);
    // fallback: старый формат
    if (cur.ХЛТ_режим) return [{ Препарат: cur.Радиомодификация || "", Режим: cur.ХЛТ_режим }];
    return [];
})();

const hltStartRaw = cur.ХЛТ_дата_старта
    ? dv.date(cur.ХЛТ_дата_старта)
    : start1;

const allScheduleEnds = [end1, ...extraScheduleData.map(s => s.schedule.length ? s.schedule[s.schedule.length - 1] : null)].filter(Boolean);
allScheduleEnds.sort((a, b) => a - b);
const treatmentEndForHlt = allScheduleEnds.length ? allScheduleEnds[allScheduleEnds.length - 1] : null;

// Собираем все дни облучения (объединение всех расписаний)
const allRadDatesSet = new Set();
schedule1.forEach(d => allRadDatesSet.add(d.toISODate()));
extraScheduleData.forEach(s => s.schedule.forEach(d => allRadDatesSet.add(d.toISODate())));

// Помечаем ХЛТ для каждого препарата
if (hltDrugsB3.length > 0 && hltStartRaw && treatmentEndForHlt) {
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
        const resolvedDates = _resolveHltIsoDates(
            drug,
            hltStartRaw.startOf("day"),
            treatmentEndForHlt.startOf("day"),
            Array.from(allRadDatesSet)
        );
        const activeDates = resolvedDates.filter(iso => !_hltSkippedDates.has(iso) && !_isHltBreakIso(iso));
        if (r === "в дни лучевой терапии" || activeDates.length > 0) {
            markDatesForDrug(drugInfo, activeDates);
        }
    });
}

// Перерыв в ХЛТ — маркеры в календаре
_hltBreakRanges.forEach(r => {
    let _bc = dv.date(r.start), _end = dv.date(r.end), _bs = 0;
    while (_bc <= _end && _bs < 365) {
        ensureDay(_bc.toISODate()).hltBreak = true;
        _bc = _bc.plus({ days: 1 }); _bs++;
    }
});

// Контроль анализов крови — расчёт дат
if (hltDrugsB3.length > 0 && hltStartRaw && treatmentEndForHlt) {
    const _controlNeeded = new Set();
    hltDrugsB3.forEach(drug => {
        const r = (drug.Режим || "").toLowerCase();
        const _dates = (r === "ежедневно" || r === "в дни лучевой терапии")
            ? null
            : _resolveHltIsoDates(
                drug,
                hltStartRaw.startOf("day"),
                treatmentEndForHlt.startOf("day"),
                Array.from(allRadDatesSet)
            ).map(iso => dv.date(iso)).filter(Boolean);
        if (_dates) {
            _dates.forEach(d => { const cd = d.minus({ days: 1 }); if (cd.weekday <= 5 || true) _controlNeeded.add(cd.toISODate()); });
        }
    });
    const _doneControls = Array.isArray(cur.Контроль_крови) ? cur.Контроль_крови.map(String) : [];
    _controlNeeded.forEach(iso => {
        const dd = ensureDay(iso);
        dd.bloodControlNeeded = true;
        dd.bloodControlDone = _doneControls.includes(iso);
    });
}

// ============================================================
// НАЗНАЧЕНИЕ Л/С — отмечаем дни приёма в календаре
// ============================================================
const medsB3 = normalizeLsAssignments(cur);

if (medsB3.length > 0) {
    medsB3.forEach(med => {
        const prep = (med.Препарат ?? "").toString().trim();
        if (!prep) return;
        const termCode = (med.Срок ?? "весь_курс").toString();
        const startD = med.Дата_старта ? dv.date(med.Дата_старта) : (start1 || null);
        if (!startD) return;

        let days = [];
        if (termCode === "весь_курс") {
            const endD = overallEnd || end1 || treatmentEndForHlt;
            if (!endD) return;
            let d = startD.startOf("day"), limit = 0;
            while (d.toISODate() <= endD.toISODate() && limit < 400) {
                days.push(d.toISODate()); d = d.plus({days: 1}); limit++;
            }
        } else {
            const parsed = Number(med.Дней) > 0
                ? Number(med.Дней)
                : Number((((termCode || "").match(/^(\d+)_дней$/)) || [])[1] || 0);
            const n = parsed > 0 ? parsed : 1;
            let d = startD.startOf("day");
            for (let i = 0; i < n; i++) {
                days.push(d.toISODate()); d = d.plus({days: 1});
            }
        }
        days.forEach(iso => {
            const di = ensureDay(iso);
            if (!di.meds.includes(prep)) di.meds.push(prep);
        });
    });
}

// ============================================================
// НАПОМИНАНИЯ
// ============================================================
const remindersRaw = Array.isArray(cur.Напоминания) ? cur.Напоминания : [];
remindersRaw.forEach(r => {
    if (!r || typeof r !== 'object') return;
    const dateStr = r.Дата || r.дата;
    const text = r.Текст || r.текст || "";
    if (!dateStr || !text) return;
    try {
        const d = dv.date(dateStr);
        if (!d) return;
        const iso = d.startOf("day").toISODate();
        ensureDay(iso).reminders.push(text);
    } catch(e) {}
});

// ============================================================
// E2: РАЗМЕТКА / ПЕРЕРАЗМЕТКИ / ОКНА / СТАРТ НОВОГО ПЛАНА
// ============================================================
const _NEW_PLAN_COLOR = "#00897b"; // бирюзово-зелёный

const _calRazm = cur.Дата_разметки && typeof cur.Дата_разметки !== 'boolean'
    ? dv.date(cur.Дата_разметки) : null;
if (_calRazm) {
    ensureDay(_calRazm.startOf("day").toISODate()).razmetka = true;
    if (start1) {
        const _contDl = minusWorkDays(start1, 3);
        if (_contDl && _contDl >= _calRazm.startOf("day")) {
            let _wc = _calRazm.startOf("day"), _ws = 0;
            while (_wc <= _contDl && _ws < 60) {
                if (_wc.weekday <= 5 && !holidays.has(_wc.toISODate()))
                    ensureDay(_wc.toISODate()).contourWin = true;
                _wc = _wc.plus({days: 1}); _ws++;
            }
        }
        const _contDl2 = minusWorkDays(start1, 3);
        if (_contDl2) {
            let _pw = _contDl2.plus({days: 1}), _ps = 0;
            while (_pw < start1 && _ps < 30) {
                if (_pw.weekday <= 5 && !holidays.has(_pw.toISODate()))
                    ensureDay(_pw.toISODate()).planningWin = true;
                _pw = _pw.plus({days: 1}); _ps++;
            }
        }
    }
}

// Переразметки: нормализуем массив
const _calRmkList = (() => {
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
const _calHasRemark = _calRmkList.length > 0;

_calRmkList.forEach((rmk) => {
    const _rmkD = rmk.Дата && typeof rmk.Дата !== 'boolean' ? dv.date(rmk.Дата) : null;
    if (!_rmkD) return;
    const _rmkDay = _rmkD.startOf("day");
    ensureDay(_rmkDay.toISODate()).remark = true;

    // Окно переоконтуривания: 2 рабочих дня с дня переразметки
    let _rwd = _rmkDay;
    while (_rwd.weekday > 5 || holidays.has(_rwd.toISODate())) _rwd = _rwd.plus({days: 1});
    let _remDl = _rwd, _remRem = 1;
    while (_remRem > 0) {
        _remDl = _remDl.plus({days: 1});
        if (_remDl.weekday <= 5 && !holidays.has(_remDl.toISODate())) _remRem--;
    }
    let _rwc = _rwd, _rws = 0;
    while (_rwc.toISODate() <= _remDl.toISODate() && _rws < 14) {
        if (_rwc.weekday <= 5 && !holidays.has(_rwc.toISODate()))
            ensureDay(_rwc.toISODate()).recontourWin = true;
        _rwc = _rwc.plus({days: 1}); _rws++;
    }

    // Старт нового плана + окно планирования нового плана
    if (rmk.Старт_нового_плана) {
        const _ns = dv.date(rmk.Старт_нового_плана);
        if (_ns) {
            ensureDay(_ns.startOf("day").toISODate()).newPlanStart = true;
            let _npw = _remDl.plus({days: 1}), _nps = 0;
            while (_npw < _ns.startOf("day") && _nps < 30) {
                if (_npw.weekday <= 5 && !holidays.has(_npw.toISODate()))
                    ensureDay(_npw.toISODate()).newPlanningWin = true;
                _npw = _npw.plus({days: 1}); _nps++;
            }
        }
    }
});

// ============================================================
// E1: ОПРЕДЕЛЕНИЕ ДИАПАЗОНА — ВСЕ МЕСЯЦЫ С СОБЫТИЯМИ
// ============================================================
// Собираем уникальные месяцы из dayInfoMap (включает разметку, окна и т.д.)
const _calMonthSet = new Set();
for (const _iso of dayInfoMap.keys()) {
    const _md = dv.date(_iso);
    if (_md) _calMonthSet.add(_md.startOf("month").toISODate());
}
const sortedCalMonths = [..._calMonthSet].sort().map(miso => dv.date(miso));

if (sortedCalMonths.length > 0) {

    // ============================================================
    // ЛЕГЕНДА
    // ============================================================
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
    if (_calRazm) mkDot("#7b1fa2", "Разметка");
    if (_calConsult) mkDot("#00897b", "Консультация");
    if (_calRazm && start1) mkDot("rgba(123,31,162,0.55)", "Оконтуривание");
    if (_calRazm && start1) mkDot("#ff9800", "Планирование");
    if (_calHasRemark) mkDot("#3f51b5", "Переразметка");
    if (_calHasRemark) mkDot("rgba(63,81,181,0.55)", "Переоконтуривание");
    if (_calRmkList.some(r => r.Старт_нового_плана)) mkDot(_NEW_PLAN_COLOR, "Новый план");
    if (remindersRaw.length > 0) mkDot("#ff5722", "Напоминания");
    if (_hltBreakRanges && _hltBreakRanges.length > 0) mkDot("#9e9e9e", "Перерыв ХЛТ");
    if (hltDrugsB3.length > 0) mkDot("#2196f3", "Контроль крови");

    const outerWrapper = dv.el("div", "");
    outerWrapper.style.cssText = "width: 100%; box-sizing: border-box; overflow-x: clip;";

    const wrapper = outerWrapper.createEl("div");
    wrapper.style.cssText = "display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 20px; margin-top: 12px; width: 100%;";

    const ruMonths = ["", "ЯНВАРЬ", "ФЕВРАЛЬ", "МАРТ", "АПРЕЛЬ", "МАЙ", "ИЮНЬ", "ИЮЛЬ", "АВГУСТ", "СЕНТЯБРЬ", "ОКТЯБРЬ", "НОЯБРЬ", "ДЕКАБРЬ"];
    const ruDays = ["ПН", "ВТ", "СР", "ЧТ", "ПТ", "СБ", "ВС"];

    // ============================================================
    // ПОПАП: ПОДРОБНОСТИ ДНЯ (ИСПРАВЛЕНО ДЛЯ МОБИЛЬНЫХ)
    // ============================================================
    const ruMonthsG = ["","января","февраля","марта","апреля","мая","июня","июля","августа","сентября","октября","ноября","декабря"];
    const ruDayNames = ["","понедельник","вторник","среда","четверг","пятница","суббота","воскресенье"];
    const ptv1Name = cur.Название_PTV || "PTV1";

    let activePopup = null;
    const closePopup = () => { if (activePopup) { activePopup.remove(); activePopup = null; } };
    document.addEventListener("click", closePopup);

    const showDayPopup = (dayDate, info, clickEvent) => {
        closePopup();
        const popup = document.createElement("div");
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
            max-width: 85vw; /* Ограничиваем ширину для мобильных */
            font-family: var(--font-interface);
            line-height: 1.5;
            opacity: 0; /* Прячем до расчета координат */
        `;
        popup.onclick = e => e.stopPropagation();

        const hdr = document.createElement("div");
        hdr.style.cssText = "font-weight:700;font-size:0.88em;color:var(--text-accent);margin-bottom:8px;padding-bottom:6px;border-bottom:1px solid var(--background-modifier-border);";
        hdr.textContent = `${dayDate.day} ${ruMonthsG[dayDate.month]} ${dayDate.year}, ${ruDayNames[dayDate.weekday]}`;
        popup.appendChild(hdr);

        const addRow = (color, text) => {
            const row = document.createElement("div");
            row.style.cssText = "display:flex;align-items:flex-start;gap:8px;margin-bottom:5px;";
            const dot = document.createElement("span");
            dot.style.cssText = `flex-shrink:0;margin-top:4px;display:inline-block;width:8px;height:8px;border-radius:50%;background:${color};`;
            const txt = document.createElement("span");
            txt.style.cssText = "color:var(--text-normal);font-size:0.88em;";
            txt.textContent = text;
            row.appendChild(dot); row.appendChild(txt);
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
        if (info.newPlanStart) addRow(_NEW_PLAN_COLOR, "🔷 Старт нового плана");
        if (info.newPlanningWin && !info.newPlanStart) addRow(_NEW_PLAN_COLOR, "📋 Планирование нового плана");

        if (!info.ptv1 && !info.extras.length && !info.hlt && !info.reminders?.length && !info.hltBreak && !info.bloodControlNeeded && !info.consult && !info.razmetka && !info.remark && !info.contourWin && !info.recontourWin && !info.planningWin && !info.newPlanStart && !info.newPlanningWin && !info.meds?.length) {
            const em = document.createElement("div");
            em.style.cssText = "color:var(--text-muted);font-size:0.85em;";
            em.textContent = "Нет событий";
            popup.appendChild(em);
        }

        document.body.appendChild(popup);
        activePopup = popup;

        // Динамическое позиционирование
        requestAnimationFrame(() => {
            if (!activePopup) return;
            const rect = activePopup.getBoundingClientRect();
            const margin = 12;
            let left = clickEvent.clientX + margin;
            let top = clickEvent.clientY + margin;

            // Если выходит за правый край
            if (left + rect.width > window.innerWidth) {
                left = window.innerWidth - rect.width - margin;
            }
            // Защита левого края
            if (left < margin) left = margin;

            // Если выходит за нижний край
            if (top + rect.height > window.innerHeight) {
                top = clickEvent.clientY - rect.height - margin;
            }
            // Защита верхнего края
            if (top < margin) top = margin;

            activePopup.style.left = left + "px";
            activePopup.style.top = top + "px";
            activePopup.style.opacity = "1"; // Показываем после расчётов
        });
    };

    // ── Drag-and-drop система ──────────────────────────────────────────────
    let _dragData = null;
    const applyDragMove = (eventData, newDate) => {
        if (eventData.type === "hlt") {
            const baseDates = _normalizeHltIsoList(
                (Array.isArray(cur.ХЛТ_ручные_даты) && cur.ХЛТ_ручные_даты.length > 0)
                    ? cur.ХЛТ_ручные_даты
                    : (Array.isArray(_hltComputedDates) ? _hltComputedDates.flat() : [])
            );
            const overrides = _normalizeHltIsoList([...baseDates.filter(d => d !== eventData.originalDate), newDate]);
            const skipped = _normalizeHltIsoList((cur.Пропущенные_даты_ХЛТ || []).filter(d => d !== eventData.originalDate && d !== newDate));
            app.fileManager.processFrontMatter(file, fm => {
                fm.ХЛТ_ручные_даты = overrides;
                if (skipped.length) fm.Пропущенные_даты_ХЛТ = skipped;
                else {
                    try { delete fm.Пропущенные_даты_ХЛТ; } catch (e) { fm.Пропущенные_даты_ХЛТ = []; }
                }
            })
                .then(() => { new Notice("✅ ХЛТ перенесена"); })
                .catch(e => { new Notice("❌ Ошибка: " + (e?.message || e)); });
        } else if (eventData.type === "reminder") {
            app.fileManager.processFrontMatter(file, fm => {
                if (Array.isArray(fm.Напоминания) && fm.Напоминания[eventData.index]) {
                    fm.Напоминания[eventData.index].дата = newDate;
                }
            }).then(() => { new Notice("✅ Напоминание перенесено"); })
              .catch(e => { new Notice("❌ Ошибка: " + (e?.message || e)); });
        }
    };

    sortedCalMonths.forEach(viewCursor => {
        // E1: пропускаем месяц, если в нём нет ни одного события
        const _mStart = viewCursor.startOf("month");
        const _mEnd = viewCursor.endOf("month");
        let _hasEvent = false;
        for (const [_eiso] of dayInfoMap) {
            const _ed = dv.date(_eiso);
            if (_ed && _ed >= _mStart && _ed <= _mEnd) { _hasEvent = true; break; }
        }
        if (!_hasEvent) return;
        const monthContainer = wrapper.createEl("div");
        monthContainer.style.cssText = "width: 100%; margin: 0; padding: 0;";

        const mName = ruMonths[viewCursor.month];
        const monthHeader = monthContainer.createEl("div");
        monthHeader.style.cssText = "text-align:center; font-weight:bold; margin-bottom:12px; color:var(--text-normal); border-bottom: 2px solid var(--interactive-accent); padding-bottom:6px;";
        monthHeader.textContent = `${mName} ${viewCursor.year}`;

        const grid = monthContainer.createEl("div");
        grid.style.cssText = "display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; justify-items: center; width: 100%;";

        // Заголовки дней
        ruDays.forEach(d => {
            const el = grid.createEl("div");
            el.textContent = d;
            el.style.cssText = "text-align:center; font-size:0.75em; color:var(--text-muted); padding-bottom: 4px; width: 100%;";
        });

        // Смещение первого дня месяца
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
            const isToday = (iso === toISO(today));
            const isWeekendOrHoliday = dayDate.weekday > 5 || holidays.has(iso);

            let mainBg = "transparent";
            let mainTextColor = isWeekendOrHoliday ? "var(--text-muted)" : "var(--text-normal)";
            let mainOpacity = isWeekendOrHoliday ? "0.4" : "1";
            let mainBorder = "none";
            let mainFontWeight = "normal";
            const _isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || (window.innerWidth <= 600);

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
                    mainBg = _NEW_PLAN_COLOR; mainOpacity = "1";
                } else if (dayInfo.newPlanningWin) {
                    mainBorder = `1px dashed ${_NEW_PLAN_COLOR}`;
                    mainTextColor = _NEW_PLAN_COLOR; mainOpacity = "0.85";
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
                    mainTextColor = isWeekendOrHoliday ? "#ff5722" : "#ff5722";
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

                // Drag source — только для ХЛТ и напоминаний (отключено на мобильных, чтобы не крашить обсидиан)
                if (!_isTouchDevice && (dayInfo.hlt || (dayInfo.reminders?.length > 0))) {
                    cell.draggable = true;
                    cell.ondragstart = (e) => {
                        if (dayInfo.hlt) {
                            _dragData = { type: "hlt", originalDate: iso };
                            e.dataTransfer.setData("text/plain", "hlt:" + iso);
                        } else if (dayInfo.reminders?.length > 0) {
                            const _reminders = Array.isArray(cur.Напоминания) ? cur.Напоминания : [];
                            const _rIdx = _reminders.findIndex(r => {
                                const rd = r?.дата ? dv.date(r.дата) : null;
                                return rd && rd.toISODate() === iso;
                            });
                            _dragData = { type: "reminder", index: _rIdx, originalDate: iso };
                            e.dataTransfer.setData("text/plain", "reminder:" + iso);
                        }
                        cell.style.opacity = "0.4";
                    };
                    cell.ondragend = () => { cell.style.opacity = ""; _dragData = null; };
                }

            } else if (isToday) {
                mainBorder = "2px solid var(--text-accent)";
            }

            // Drop target — все ячейки (отключено на мобильных)
            if (!_isTouchDevice) {
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
                if (dayInfo.ptv1 && dayInfo.extras.length > 0) {
                    dayInfo.extras.forEach(e => indicators.push(e.color));
                }
                if (!dayInfo.ptv1 && dayInfo.extras.length > 1) {
                    dayInfo.extras.slice(1).forEach(e => indicators.push(e.color));
                }
                if (dayInfo.hlt) indicators.push("#ff9800");
                if (dayInfo.meds?.length > 0) indicators.push("#7b61ff");
                if (dayInfo.bloodControlNeeded) indicators.push(dayInfo.bloodControlDone ? "#4caf50" : "#2196f3");
                if (dayInfo.consult && (dayInfo.ptv1 || dayInfo.extras.length > 0 || dayInfo.razmetka || dayInfo.remark)) indicators.push("#00897b");
                if (dayInfo.newPlanStart && (dayInfo.ptv1 || dayInfo.extras.length > 0)) indicators.push(_NEW_PLAN_COLOR);
                if (dayInfo.remark && (dayInfo.ptv1 || dayInfo.extras.length > 0)) indicators.push("#3f51b5");
                if (dayInfo.reminders?.length > 0 && (dayInfo.ptv1 || dayInfo.extras.length > 0)) {
                    indicators.push("#ff5722");
                }

                if (indicators.length > 0) {
                    const dotsRow = cell.createEl("div");
                    dotsRow.style.cssText = "display: flex; gap: 3px; justify-content: center; margin-top: 3px; height: 6px;";
                    indicators.forEach(dotColor => {
                        const dot = dotsRow.createEl("span");
                        dot.style.cssText = `display: inline-block; width: 6px; height: 6px; background: ${dotColor}; border-radius: 50%; flex-shrink: 0; box-shadow: 0 1px 3px rgba(0,0,0,0.35);`;
                    });
                }
                // E2: дополнительные маркеры разметки/окон (точки под номером)
                const extraMarkers = [];
                if (dayInfo.razmetka && (dayInfo.ptv1 || dayInfo.extras.length > 0)) extraMarkers.push("#7b1fa2");
                if (dayInfo.remark && (dayInfo.ptv1 || dayInfo.extras.length > 0)) extraMarkers.push("#3f51b5");
                if (extraMarkers.length > 0) {
                    let mRow = cell.querySelector(".cal-extra-markers");
                    if (!mRow) { mRow = cell.createEl("div"); mRow.className = "cal-extra-markers"; mRow.style.cssText = "display:flex;gap:2px;justify-content:center;margin-top:1px;"; }
                    extraMarkers.forEach(mc => { const ms = mRow.createEl("span"); ms.style.cssText = `display:inline-block;width:4px;height:4px;background:${mc};border-radius:50%;`; });
                }
            }
        }
    }); // end sortedCalMonths.forEach
}
}

// ============================================================
// БЛОКИ НАБЛЮДЕНИЕ + СВЯЗАТЬ — парный заголовок
// ============================================================
const _pairWrapper = dv.el("div", "");
_pairWrapper.style.cssText = "margin-top: 15px;";
const _headerRow = _pairWrapper.createEl("div");
_headerRow.style.cssText = "display:flex;gap:8px;";

// ============================================================
// БЛОК ДИСПАНСЕРНОГО УЧЁТА
// ============================================================
{
// ============================================================
// ИНТЕРВАЛЫ ДИСПАНСЕРНОГО НАБЛЮДЕНИЯ (месяцы)
// ============================================================
const DISPANSERY_INTERVALS = [
    { months: 3,  label: "3 мес." },
    { months: 6,  label: "6 мес." },
    { months: 12, label: "1 год" },
    { months: 18, label: "1,5 года" },
    { months: 24, label: "2 года" },
    { months: 30, label: "2,5 года" },
    { months: 36, label: "3 года" },
    { months: 42, label: "3,5 года" },
    { months: 48, label: "4 года" },
    { months: 54, label: "4,5 года" },
    { months: 60, label: "5 лет" },
];

const LAG_DAYS = 14; // Лаг компенсации задержек пациентов

// ============================================================
// ФУНКЦИЯ: ГЕНЕРАЦИЯ НАПОМИНАНИЙ ДИСПАНСЕРА
// ============================================================
const generateDispanseryReminders = (endDate) => {
    const reminders = [];
    DISPANSERY_INTERVALS.forEach(({ months, label }) => {
        // Дата: конец лечения + интервал + лаг 14 дней
        const rawDate = endDate.plus({ months: months }).plus({ days: LAG_DAYS });
        // Сдвиг на ближайший рабочий день (вперёд)
        const finalDate = nextWorkDay(rawDate);
        reminders.push({
            дата: finalDate.toFormat("yyyy-MM-dd"),
            текст: `Диспансерный осмотр (${label})`,
            выполнено: false
        });
    });
    return reminders;
};

const header = _headerRow.createEl("div");
header.style.cssText = "flex:1; font-weight:700; font-size:0.9em; padding:10px 12px; color:var(--text-normal); background:var(--background-primary-alt); border:1px solid var(--background-modifier-border); border-radius:8px; display:flex; align-items:center; gap:6px; cursor:pointer;";
header.createEl("span", { text: "👁 Наблюдение" });
const _DISP_KEY = "disp_open_" + file.path;
if (!window.hasOwnProperty(_DISP_KEY)) window[_DISP_KEY] = false;
const dispBody = _pairWrapper.createEl("div");
dispBody.style.cssText = window[_DISP_KEY] ? "padding:12px 15px; border:1px solid var(--background-modifier-border); border-top:none; border-radius:0 0 8px 8px; background:var(--background-primary-alt);" : "display:none;";
const dispArrow = header.createEl("span");
dispArrow.style.cssText = "font-size:11px;color:var(--text-muted);margin-left:auto;user-select:none;";
dispArrow.textContent = window[_DISP_KEY] ? "▲" : "▼";
header.onclick = () => {
    window[_DISP_KEY] = !window[_DISP_KEY];
    dispBody.style.cssText = window[_DISP_KEY] ? "padding:12px 15px; border:1px solid var(--background-modifier-border); border-top:none; border-radius:0 0 8px 8px; background:var(--background-primary-alt);" : "display:none;";
    dispArrow.textContent = window[_DISP_KEY] ? "▲" : "▼";
    header.style.borderRadius = window[_DISP_KEY] ? "8px 8px 0 0" : "8px";
};

const isActive = cur.Диспансерный_учет === true;

if (!isActive) {
    // === РЕЖИМ: НЕ АКТИВЕН ===
    const infoText = dispBody.createEl("div");
    infoText.style.cssText = "font-size: 0.88em; color: var(--text-muted); margin-bottom: 14px; line-height: 1.5;";

    if (!overallEnd) {
        infoText.textContent = "⚠️ Нет данных о дате окончания лечения. Заполните расписание лечения для активации диспансерного наблюдения.";
    } else {
        infoText.innerHTML = `Дата окончания лечения: <b>${overallEnd.toFormat("dd.MM.yyyy")}</b>.<br>
        При активации будет создано <b>${DISPANSERY_INTERVALS.length} напоминаний</b> на 5 лет
        (3 мес., 6 мес., 1 год ... 5 лет) с лагом <b>${LAG_DAYS} дней</b> и коррекцией на рабочие дни.`;
    }

    if (overallEnd) {
        // Превью дат
        const previewContainer = dispBody.createEl("div");
        previewContainer.style.cssText = "margin-bottom: 14px; display: flex; flex-wrap: wrap; gap: 6px;";

        generateDispanseryReminders(overallEnd).forEach(r => {
            const chip = previewContainer.createEl("span");
            const d = dv.date(r.дата);
            chip.style.cssText = "display: inline-block; font-size: 0.78em; padding: 3px 8px; background: rgba(76,175,80,0.1); border: 1px solid rgba(76,175,80,0.3); border-radius: 6px; color: var(--text-muted);";
            chip.textContent = `${r.текст.replace("Диспансерный осмотр ", "")} → ${d ? d.toFormat("dd.MM") : r.дата}`;
        });

        const activateBtn = dispBody.createEl("button");
        activateBtn.textContent = "✅ Взять на диспансерный учёт";
        activateBtn.style.cssText = "background: #4caf50; color: white; border: none; border-radius: 8px; padding: 11px 18px; font-size: 0.9em; font-weight: 600; cursor: pointer; transition: opacity 0.2s; width: 100%;";
        activateBtn.onmouseenter = () => activateBtn.style.opacity = "0.85";
        activateBtn.onmouseleave = () => activateBtn.style.opacity = "1";

        activateBtn.onclick = async () => {
            activateBtn.disabled = true;
            activateBtn.style.opacity = "0.5";
            activateBtn.textContent = "⏳ Создание напоминаний...";

            try {
                const newReminders = generateDispanseryReminders(overallEnd);
                await app.fileManager.processFrontMatter(file, (fm) => {
                    fm.Диспансерный_учет = true;
                    if (!Array.isArray(fm.Напоминания)) fm.Напоминания = [];
                    // Удаляем старые диспансерные напоминания если были
                    fm.Напоминания = fm.Напоминания.filter(r =>
                        !r || !r.текст || !r.текст.toLowerCase().includes("диспансерный осмотр")
                    );
                    fm.Напоминания.push(...newReminders);
                });
                new Notice(`✅ Диспансерный учёт активирован! Создано ${newReminders.length} напоминаний.`);
            } catch (err) {
                console.error(err);
                new Notice("❌ Ошибка при активации диспансерного учёта");
                activateBtn.disabled = false;
                activateBtn.style.opacity = "1";
                activateBtn.textContent = "✅ Взять на диспансерный учёт";
            }
        };
    }

} else {
    // === РЕЖИМ: АКТИВЕН ===
    const statusBadge = header.createEl("span");
    statusBadge.style.cssText = "font-size: 0.75em; background: rgba(76,175,80,0.15); color: #4caf50; border: 1px solid rgba(76,175,80,0.4); border-radius: 12px; padding: 2px 10px; font-weight: 600;";
    statusBadge.textContent = "● Активно";

    // Список диспансерных напоминаний
    const dispReminders = (cur.Напоминания ?? []).filter(r =>
        r && r.текст && r.текст.toLowerCase().includes("диспансерный осмотр") && r.дата
    ).sort((a, b) => {
        const da = dv.date(a.дата), db = dv.date(b.дата);
        return (da?.toMillis() || 0) - (db?.toMillis() || 0);
    });

    const done = dispReminders.filter(r => r.выполнено === true);
    const pending = dispReminders.filter(r => r.выполнено !== true);

    // Статистика
    const statsRow = dispBody.createEl("div");
    statsRow.style.cssText = "display: flex; gap: 16px; font-size: 0.85em; margin-bottom: 14px; flex-wrap: wrap;";
    const mkStat = (label, value, color) => {
        const s = statsRow.createEl("div");
        s.innerHTML = `<span style="color:var(--text-muted)">${label}:</span> <b style="color:${color}">${value}</b>`;
    };
    mkStat("Всего", dispReminders.length, "var(--text-normal)");
    mkStat("Пройдено", done.length, "#4caf50");
    mkStat("Осталось", pending.length, "#2196f3");
    if (overallEnd) mkStat("Конец лечения", overallEnd.toFormat("dd.MM.yyyy"), "var(--text-muted)");

    // Прогресс-бар
    if (dispReminders.length > 0) {
        const pct = Math.round((done.length / dispReminders.length) * 100);
        const pbWrap = dispBody.createEl("div");
        pbWrap.style.cssText = "width: 100%; background: rgba(150,150,150,0.15); height: 5px; border-radius: 3px; margin-bottom: 14px;";
        const pbFill = pbWrap.createEl("div");
        pbFill.style.cssText = `width: ${pct}%; background: #4caf50; height: 100%; border-radius: 3px; transition: width 0.3s;`;
    }

    // Ближайшие предстоящие осмотры
    if (pending.length > 0) {
        const nextLabel = dispBody.createEl("div");
        nextLabel.style.cssText = "font-size: 0.8em; color: var(--text-muted); font-weight: 600; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.04em;";
        nextLabel.textContent = "Предстоящие осмотры";

        const showCount = Math.min(5, pending.length);
        for (let i = 0; i < showCount; i++) {
            const r = pending[i];
            const rDate = dv.date(r.дата);
            const isPast = rDate && rDate < today;
            const isThisMonth = rDate && rDate.hasSame(today, 'month');
            let color = "#2196f3";
            if (isPast) color = "#f44336";
            else if (isThisMonth) color = "#ff9800";

            const row = dispBody.createEl("div");
            row.style.cssText = `display: flex; align-items: center; gap: 10px; padding: 7px 10px; margin-bottom: 4px; background: var(--background-primary); border: 1px solid var(--background-modifier-border); border-left: 4px solid ${color}; border-radius: 6px; font-size: 0.88em;`;
            row.innerHTML = `
                <span style="color:${color}; font-weight:700; flex-shrink:0;">${rDate ? rDate.toFormat("dd.MM.yyyy") : r.дата}</span>
                <span style="flex:1; color:var(--text-normal);">${r.текст}</span>
                ${isPast ? `<span style="font-size:0.8em; color:#f44336; font-weight:600;">Просрочено</span>` : ""}
            `;
        }

        if (pending.length > showCount) {
            const moreEl = dispBody.createEl("div");
            moreEl.style.cssText = "font-size: 0.8em; color: var(--text-muted); padding: 4px 10px;";
            moreEl.textContent = `... и ещё ${pending.length - showCount} осмотров`;
        }
    } else if (done.length > 0) {
        const completedMsg = dispBody.createEl("div");
        completedMsg.style.cssText = "font-size: 0.9em; color: #4caf50; font-weight: 600; padding: 8px 0;";
        completedMsg.textContent = "🎉 Все диспансерные осмотры пройдены!";
    }

    // Кнопка сброса (перегенерация)
    if (overallEnd) {
        const resetBtn = dispBody.createEl("button");
        resetBtn.textContent = "🔄 Пересчитать даты осмотров";
        resetBtn.style.cssText = "margin-top: 12px; background: transparent; border: 1px solid var(--background-modifier-border); color: var(--text-muted); border-radius: 6px; padding: 7px 14px; font-size: 0.82em; cursor: pointer; transition: all 0.2s; display: block; width: 100%;";
        resetBtn.onmouseenter = () => { resetBtn.style.borderColor = "#ff9800"; resetBtn.style.color = "#ff9800"; };
        resetBtn.onmouseleave = () => { resetBtn.style.borderColor = "var(--background-modifier-border)"; resetBtn.style.color = "var(--text-muted)"; };
        resetBtn.onclick = async () => {
            resetBtn.disabled = true;
            resetBtn.style.opacity = "0.5";
            try {
                const newReminders = generateDispanseryReminders(overallEnd);
                await app.fileManager.processFrontMatter(file, (fm) => {
                    if (!Array.isArray(fm.Напоминания)) fm.Напоминания = [];
                    fm.Напоминания = fm.Напоминания.filter(r =>
                        !r || !r.текст || !r.текст.toLowerCase().includes("диспансерный осмотр")
                    );
                    fm.Напоминания.push(...newReminders);
                });
                new Notice("✅ Даты диспансерного наблюдения пересчитаны");
            } catch (err) {
                console.error(err);
                new Notice("❌ Ошибка пересчёта");
                resetBtn.disabled = false;
                resetBtn.style.opacity = "1";
            }
        };
    }
}

}

// ============================================================
// БЛОК СВЯЗАННЫХ СЛУЧАЕВ
// ============================================================
{

const linkHeader = _headerRow.createEl("div");
linkHeader.style.cssText = "flex:1; font-weight:700; font-size:0.9em; padding:10px 12px; color:var(--text-normal); background:var(--background-primary-alt); border:1px solid var(--background-modifier-border); border-radius:8px; display:flex; align-items:center; gap:6px; cursor:pointer;";
linkHeader.createEl("span", { text: "🔗 Связать" });
const _LINK_KEY = "link_open_" + file.path;
if (!window.hasOwnProperty(_LINK_KEY)) window[_LINK_KEY] = false;
const linkBody = _pairWrapper.createEl("div");
linkBody.style.cssText = window[_LINK_KEY] ? "padding:12px 15px; border:1px solid var(--background-modifier-border); border-top:none; border-radius:0 0 8px 8px; background:var(--background-primary-alt);" : "display:none;";
const linkArrow = linkHeader.createEl("span");
linkArrow.style.cssText = "font-size:11px;color:var(--text-muted);margin-left:auto;user-select:none;";
linkArrow.textContent = window[_LINK_KEY] ? "▲" : "▼";
linkHeader.onclick = () => {
    window[_LINK_KEY] = !window[_LINK_KEY];
    linkBody.style.cssText = window[_LINK_KEY] ? "padding:12px 15px; border:1px solid var(--background-modifier-border); border-top:none; border-radius:0 0 8px 8px; background:var(--background-primary-alt);" : "display:none;";
    linkArrow.textContent = window[_LINK_KEY] ? "▲" : "▼";
    linkHeader.style.borderRadius = window[_LINK_KEY] ? "8px 8px 0 0" : "8px";
};

// ============================================================
// БЛОК СВЯЗАННЫХ СЛУЧАЕВ
// ============================================================
const _lnkStateKey = 'lnk_' + file.path;
if (!window[_lnkStateKey]) window[_lnkStateKey] = { open: window[_LINK_KEY] || false, search: '' };
const lnkState = window[_lnkStateKey];

// Чтение связанных случаев
const _getLinkNames = () => {
    const raw = cur.Связанные_случаи;
    const arr = Array.isArray(raw) ? raw : (raw ? [raw] : []);
    return arr.map(l => {
        if (!l) return null;
        const s = l.toString().trim();
        const m = s.match(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/);
        return (m ? m[1].trim() : s) || null;
    }).filter(Boolean);
};

const _renderLinkedCases = () => {
    linkBody.innerHTML = "";
    const linkedNames = _getLinkNames();

    // Секция: существующие связи
    if (linkedNames.length > 0) {
        const secLabel = linkBody.createEl("div");
        secLabel.style.cssText = "font-size:0.78em;color:var(--text-muted);font-weight:700;text-transform:uppercase;letter-spacing:.04em;margin-bottom:8px;";
        secLabel.textContent = `Связанные случаи (${linkedNames.length})`;

        const cardsWrap = linkBody.createEl("div");
        cardsWrap.style.cssText = "display:flex;flex-direction:column;gap:6px;margin-bottom:14px;";

        linkedNames.forEach(name => {
            const found = dv.pages().find(p => p.file.name === name);
            const path = found ? found.file.path : name + '.md';

            const card = cardsWrap.createEl("div");
            card.style.cssText = "display:flex;align-items:stretch;gap:0;border:1px solid var(--background-modifier-border);border-radius:6px;overflow:hidden;background:var(--background-primary);";

            const cardLink = card.createEl("a");
            cardLink.className = "internal-link";
            cardLink.href = path;
            cardLink.style.cssText = "flex:1;display:block;text-decoration:none;padding:8px 12px;border-left:4px solid #2196f3;transition:background .15s;";
            cardLink.onmouseenter = () => cardLink.style.background = "var(--background-modifier-hover)";
            cardLink.onmouseleave = () => cardLink.style.background = "var(--background-primary)";

            const nameEl = cardLink.createEl("div");
            nameEl.style.cssText = "font-size:0.9em;font-weight:600;color:var(--text-normal);margin-bottom:2px;";
            nameEl.textContent = `📄 ${name}`;

            if (found) {
                const infoEl = cardLink.createEl("div");
                infoEl.style.cssText = "font-size:0.76em;color:var(--text-muted);line-height:1.35;";
                const parts = [];
                if (found.Дата_начала_лечения) { const d = dv.date(found.Дата_начала_лечения); if(d) parts.push(d.toFormat("dd.MM.yyyy")); }
                if (found.Количество_фракций) parts.push(`${found.Количество_фракций} фр.`);
                if (found.Диагноз) parts.push(found.Диагноз.toString().slice(0,55) + (found.Диагноз.toString().length>55?'…':''));
                infoEl.textContent = parts.join(' · ');
            } else {
                const notFound = cardLink.createEl("div");
                notFound.style.cssText = "font-size:0.76em;color:var(--text-faint);";
                notFound.textContent = "Файл не найден";
            }

            // Кнопка удаления связи
            const delBtn = card.createEl("button");
            delBtn.title = "Удалить связь";
            delBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
            delBtn.style.cssText = "border:none;background:transparent;color:var(--text-faint);cursor:pointer;padding:0 10px;flex-shrink:0;transition:color .15s;";
            delBtn.onmouseenter = () => delBtn.style.color = "#ef5350";
            delBtn.onmouseleave = () => delBtn.style.color = "var(--text-faint)";
            delBtn.onclick = async (e) => {
                e.preventDefault(); e.stopPropagation();
                delBtn.disabled = true;
                // Удаляем ссылку из текущего файла
                await app.fileManager.processFrontMatter(file, fm => {
                    if (!Array.isArray(fm.Связанные_случаи)) return;
                    fm.Связанные_случаи = fm.Связанные_случаи.filter(l => l && !l.toString().includes(name));
                    if (fm.Связанные_случаи.length === 0) delete fm.Связанные_случаи;
                });
                // Удаляем обратную ссылку из связанного файла (если нашли)
                if (found) {
                    const linkedFile = app.vault.getAbstractFileByPath(found.file.path);
                    if (linkedFile) {
                        await app.fileManager.processFrontMatter(linkedFile, fm => {
                            if (!Array.isArray(fm.Связанные_случаи)) return;
                            const myName = file.basename;
                            fm.Связанные_случаи = fm.Связанные_случаи.filter(l => l && !l.toString().includes(myName));
                            if (fm.Связанные_случаи.length === 0) delete fm.Связанные_случаи;
                        });
                    }
                }
                new Notice(`🔗 Связь с "${name}" удалена`);
                _renderLinkedCases();
            };
            card.appendChild(delBtn);
        });
    } else {
        const noMsg = linkBody.createEl("div");
        noMsg.style.cssText = "font-size:0.88em;color:var(--text-muted);margin-bottom:12px;";
        noMsg.textContent = "Нет связанных случаев.";
    }

    // ------- Секция: Привязать существующий случай -------
    const searchLabel = linkBody.createEl("div");
    searchLabel.style.cssText = "font-size:0.78em;color:var(--text-muted);font-weight:700;text-transform:uppercase;letter-spacing:.04em;margin-bottom:6px;";
    searchLabel.textContent = "Привязать существующий";

    const searchInp = linkBody.createEl("input");
    searchInp.type = "text";
    searchInp.placeholder = "Поиск по имени файла...";
    searchInp.value = lnkState.search;
    searchInp.style.cssText = "width:100%;height:32px;padding:0 10px;border-radius:6px;border:1px solid var(--background-modifier-border);background:var(--background-primary);color:var(--text-normal);font-size:13px;outline:none;box-sizing:border-box;margin-bottom:6px;";
    searchInp.onfocus = () => searchInp.style.borderColor = "var(--interactive-accent)";
    searchInp.onblur  = () => searchInp.style.borderColor = "var(--background-modifier-border)";

    const resultsWrap = linkBody.createEl("div");
    resultsWrap.style.cssText = "display:flex;flex-direction:column;gap:4px;margin-bottom:14px;max-height:200px;overflow-y:auto;";

    const _doSearch = (q) => {
        lnkState.search = q;
        resultsWrap.innerHTML = "";
        if (!q || q.length < 2) { resultsWrap.innerHTML = "<div style='font-size:11px;color:var(--text-faint);padding:4px 0;'>Введите не менее 2 символов</div>"; return; }
        const ql = q.toLowerCase();
        const candidates = dv.pages('#Пациент').filter(p =>
            p.file.name !== file.basename &&
            !linkedNames.includes(p.file.name) &&
            p.file.name.toLowerCase().includes(ql)
        ).array().slice(0, 15);
        if (candidates.length === 0) {
            resultsWrap.innerHTML = "<div style='font-size:11px;color:var(--text-faint);padding:4px 0;'>Ничего не найдено</div>";
            return;
        }
        candidates.forEach(p => {
            const row = resultsWrap.createEl("div");
            row.style.cssText = "display:flex;align-items:center;justify-content:space-between;padding:5px 8px;border-radius:5px;border:1px solid var(--background-modifier-border);background:var(--background-primary);gap:8px;";
            const lbl = row.createEl("span");
            lbl.style.cssText = "font-size:12px;color:var(--text-normal);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;";
            lbl.textContent = p.file.name;
            const addBtn = row.createEl("button");
            addBtn.textContent = "+ Связать";
            addBtn.style.cssText = "font-size:11px;height:24px;padding:0 8px;background:var(--interactive-accent);color:#fff;border:none;border-radius:4px;cursor:pointer;flex-shrink:0;";
            addBtn.onclick = async () => {
                addBtn.disabled = true; addBtn.textContent = "…";
                // Добавляем ссылку в текущий файл
                await app.fileManager.processFrontMatter(file, fm => {
                    if (!Array.isArray(fm.Связанные_случаи)) fm.Связанные_случаи = [];
                    const lnk = `[[${p.file.name}]]`;
                    if (!fm.Связанные_случаи.some(l => l && l.toString().includes(p.file.name))) {
                        fm.Связанные_случаи.push(lnk);
                    }
                });
                // Добавляем обратную ссылку
                const linkedFile2 = app.vault.getAbstractFileByPath(p.file.path);
                if (linkedFile2) {
                    await app.fileManager.processFrontMatter(linkedFile2, fm => {
                        if (!Array.isArray(fm.Связанные_случаи)) fm.Связанные_случаи = [];
                        const myLnk = `[[${file.basename}]]`;
                        if (!fm.Связанные_случаи.some(l => l && l.toString().includes(file.basename))) {
                            fm.Связанные_случаи.push(myLnk);
                        }
                    });
                }
                lnkState.search = "";
                new Notice(`🔗 "Связано с "${p.file.name}"`);
                _renderLinkedCases();
            };
            row.appendChild(addBtn);
        });
    };
    searchInp.oninput = () => _doSearch(searchInp.value.trim());
    if (lnkState.search) _doSearch(lnkState.search);
    linkBody.appendChild(resultsWrap);

    // ------- Секция: Создать новый случай -------
    const createLabel = linkBody.createEl("div");
    createLabel.style.cssText = "font-size:0.78em;color:var(--text-muted);font-weight:700;text-transform:uppercase;letter-spacing:.04em;margin-bottom:6px;margin-top:4px;";
    createLabel.textContent = "Создать новый случай";

    const formRow = linkBody.createEl("div");
    formRow.style.cssText = "display:flex;flex-wrap:wrap;gap:8px;align-items:flex-end;";

    const nameInput = formRow.createEl("input");
    nameInput.type = "text";
    const suggestedName = `${file.basename} (Курс ${linkedNames.length + 2})`;
    nameInput.value = suggestedName;
    nameInput.placeholder = suggestedName;
    nameInput.style.cssText = "flex:1 1 200px;min-width:140px;height:34px;padding:0 10px;background:var(--background-primary);color:var(--text-normal);border:1px solid var(--background-modifier-border);border-radius:6px;font-size:13px;box-sizing:border-box;outline:none;";
    nameInput.onfocus = () => nameInput.style.borderColor = "var(--interactive-accent)";
    nameInput.onblur  = () => nameInput.style.borderColor = "var(--background-modifier-border)";

    const createBtn = formRow.createEl("button");
    createBtn.textContent = "🙄 Создать";
    createBtn.style.cssText = "height:34px;padding:0 14px;background:#2196f3;color:#fff;border:none;border-radius:6px;font-size:0.88em;font-weight:600;cursor:pointer;flex-shrink:0;white-space:nowrap;";
    createBtn.onmouseenter = () => createBtn.style.opacity = "0.85";
    createBtn.onmouseleave = () => createBtn.style.opacity = "1";
    createBtn.onclick = async () => {
        const newName = nameInput.value.trim();
        if (!newName) { new Notice("❌ Введите имя файла!"); return; }
        createBtn.disabled = true; createBtn.style.opacity = "0.5"; createBtn.textContent = "⏳...";
        try {
            const currentFolder = file.parent ? file.parent.path : "";
            const newFilePath = currentFolder ? `${currentFolder}/${newName}.md` : `${newName}.md`;
            if (app.vault.getAbstractFileByPath(newFilePath)) {
                new Notice(`❌ Файл "${newName}.md" уже существует!`);
                createBtn.disabled = false; createBtn.style.opacity = "1"; createBtn.textContent = "🙄 Создать";
                return;
            }
            const fio = cur.ФИО ?? ""; const dob = cur.Дата_рождения ? (dv.date(cur.Дата_рождения)?.toFormat("yyyy-MM-dd") ?? "") : "";
            const mkb = cur["МКБ 10"] ?? ""; const diag = cur.Диагноз ?? ""; const snils = cur.СНИЛС ?? "";
            const phone = cur.Номер_телефона ?? ""; const vmp = cur["Группа ВМП"] ?? "";
            const backLinkStr = `[[${file.basename}]]`;
            const newFileContent = `---
ФИО: ${fio}
Дата_рождения: ${dob}
МКБ 10: ${mkb}
Диагноз: >-
  ${diag.toString().replace(/\n/g, "\n  ")}
Дополнительная_информация:
Дата_консультации:
Дата_разметки:
Дата_начала_лечения:
Цель_лечения:
Область_облучения:
РОД:
Количество_фракций:
Фракционирование:
Ускоритель: Varian Halcyon
ХЛТ_препараты: []
ХЛТ_ручные_даты: []
Пропущенные_даты_ХЛТ: []
ЛС_назначения: []
Лекарственные_препараты: []
Больничный_лист: false
Открытый_ЭЛН_активен: false
Открытый_ЭЛН:
СНИЛС: ${snils}
Группа ВМП: ${vmp}
Номер_телефона: ${phone}
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
db_prog_type:
db_vital_status:
db_date_death:
db_date_last_contact:
db_stage:
db_t:
db_n:
db_m:
db_grade:
db_mol_subtype:
db_er:
db_pr:
db_her2:
db_ki67:
db_pdl1:
db_egfr_mut:
db_alk_status:
db_ros1_status:
db_kras_mut:
db_nras_mut:
db_ras_mut:
db_braf_mut:
db_idh_mut:
db_brca_mut:
db_ret_status:
db_met_status:
db_ntrk_status:
db_mgmt_meth:
db_msi_status:
db_mmr_status:
db_gleason:
db_initial_psa:
db_other_biomarkers:
db_ecog_last:
db_lc_days:
db_dfs_days:
AI_Парсер_модель:
AI_Парсер_версия_промпта:
AI_Парсер_дата:
AI_Парсер_источник:
AI_Парсер_service_tier:
AI_Парсер_system_fingerprint:
AI_Парсер_usage_json:
AI_Парсер_предупреждения:
AI_Парсер_ревью_json:
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
---
`;
            await app.vault.create(newFilePath, newFileContent);
            await app.fileManager.processFrontMatter(file, fm => {
                if (!Array.isArray(fm.Связанные_случаи)) fm.Связанные_случаи = [];
                const lnk = `[[${newName}]]`;
                if (!fm.Связанные_случаи.some(l => l && l.toString().includes(newName))) fm.Связанные_случаи.push(lnk);
            });
            new Notice(`✅ Создан: ${newName}`);
            const newFile = app.vault.getAbstractFileByPath(newFilePath);
            if (newFile) await app.workspace.getLeaf(false).openFile(newFile);
            _renderLinkedCases();
        } catch(err) {
            console.error(err); new Notice("❌ Ошибка создания");
            createBtn.disabled = false; createBtn.style.opacity = "1"; createBtn.textContent = "🙄 Создать";
        }
    };
};
_renderLinkedCases();

}

// ============================================================
// БЛОК ЗАМЕТОК
// ============================================================
{

const root = dv.el("div", "");
root.style.cssText = "font-family: var(--font-interface); margin-bottom: 4px; margin-top: 15px; box-sizing: border-box; overflow-x: clip;";

// ── Вспомогательная функция форматирования даты ──────────────────────────────
const fmtDate = (str) => {
    try { const d = dv.date(str); return d ? d.toFormat("dd.MM.yyyy HH:mm") : str; } catch { return str; }
};

// ── Вложения (фотографии) ─────────────────────────────────────────────────────
const attachments = Array.isArray(cur.Вложения) ? cur.Вложения.filter(a => a && typeof a === 'object') : [];

if (attachments.length > 0) {
    const secTitle = root.createEl("div");
    secTitle.style.cssText = "font-size: 0.75em; font-weight: 700; text-transform: uppercase; color: var(--text-accent); margin-bottom: 8px; letter-spacing: 0.05em; border-bottom: 1px solid var(--background-modifier-border); padding-bottom: 4px;";
    secTitle.textContent = "Фотографии и вложения";

    const grid = root.createEl("div");
    grid.style.cssText = "display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 14px;";

    [...attachments].reverse().forEach((att, revIdx) => {
        const idx = attachments.length - 1 - revIdx;
        const path = att.Путь || "";
        const name = att.Имя || path.split("/").pop() || "Файл";
        const dateStr = att.Дата || "";

        const wrap = grid.createEl("div");
        wrap.style.cssText = "position: relative; width: 90px; border-radius: 8px; overflow: hidden; border: 1px solid var(--background-modifier-border); background: var(--background-secondary); cursor: pointer; transition: box-shadow 0.15s;";
        wrap.onmouseenter = () => wrap.style.boxShadow = "0 2px 10px rgba(0,0,0,0.25)";
        wrap.onmouseleave = () => wrap.style.boxShadow = "none";

        const vaultFile = app.vault.getAbstractFileByPath(path);
        if (vaultFile) {
            const url = app.vault.getResourcePath(vaultFile);
            const img = wrap.createEl("img");
            img.src = url;
            img.style.cssText = "width: 90px; height: 90px; object-fit: cover; display: block;";
            img.onclick = () => app.workspace.openLinkText(path, cur.file.path);
        } else {
            const ph = wrap.createEl("div");
            ph.style.cssText = "width: 90px; height: 90px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; padding: 4px;";
            ph.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>`;
            const nm = ph.createEl("span");
            nm.style.cssText = "font-size: 0.65em; color: var(--text-muted); text-align: center; word-break: break-all; line-height: 1.2;";
            nm.textContent = name;
        }

        if (dateStr) {
            const lbl = wrap.createEl("div");
            lbl.style.cssText = "font-size: 0.6em; color: var(--text-muted); padding: 3px 5px; background: var(--background-primary); border-top: 1px solid var(--background-modifier-border); text-align: center;";
            lbl.textContent = fmtDate(dateStr).split(" ")[0];
        }

        const delBtn = wrap.createEl("button");
        delBtn.textContent = "×";
        delBtn.style.cssText = "position: absolute; top: 4px; right: 4px; background: rgba(0,0,0,0.55); color: white; border: none; border-radius: 50%; width: 20px; height: 20px; font-size: 13px; cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 0; line-height: 1; transition: background 0.15s;";
        delBtn.onmouseenter = () => delBtn.style.background = "rgba(229,57,53,0.85)";
        delBtn.onmouseleave = () => delBtn.style.background = "rgba(0,0,0,0.55)";
        delBtn.onclick = async (e) => {
            e.stopPropagation();
            wrap.style.opacity = "0.3"; wrap.style.pointerEvents = "none";
            await app.fileManager.processFrontMatter(file, fm => {
                if (Array.isArray(fm.Вложения)) fm.Вложения.splice(idx, 1);
            });
        };
    });
}

// ── Заметки ───────────────────────────────────────────────────────────────────
const notes = Array.isArray(cur.Заметки) ? cur.Заметки.filter(n => n && typeof n === 'object') : [];

{
    // Заголовок с поиском
    const notesHeader = root.createEl("div");
    notesHeader.style.cssText = "display:flex;align-items:center;gap:8px;margin-bottom:8px;";
    const secTitle2 = notesHeader.createEl("div");
    secTitle2.style.cssText = "font-size: 0.75em; font-weight: 700; text-transform: uppercase; color: var(--text-accent); letter-spacing: 0.05em; border-bottom: 1px solid var(--background-modifier-border); padding-bottom: 4px; flex: 1;";
    secTitle2.textContent = "Заметки" + (notes.length > 0 ? ` (${notes.length})` : "");

    let _noteFilter = "";
    const searchInput = notesHeader.createEl("input");
    searchInput.type = "text";
    searchInput.placeholder = "Поиск…";
    searchInput.style.cssText = "height:26px;border-radius:5px;border:1px solid var(--background-modifier-border);background:var(--background-primary);color:var(--text-normal);padding:0 8px;font-size:12px;outline:none;transition:border-color 0.15s;width:120px;";
    searchInput.onfocus = () => searchInput.style.borderColor = "var(--interactive-accent)";
    searchInput.onblur  = () => searchInput.style.borderColor = "var(--background-modifier-border)";
    if (notes.length === 0) searchInput.style.display = "none";

    const listEl = root.createEl("div");
    listEl.style.cssText = "display: flex; flex-direction: column; gap: 6px; margin-bottom: 12px;";

    const _extractTags = (text) => {
        const matches = String(text).match(/#[\wа-яёА-ЯЁ]+/g);
        return matches ? matches.map(t => t.toLowerCase()) : [];
    };

    const _applyNoteFilter = () => {
        const q = _noteFilter.trim().toLowerCase();
        listEl.querySelectorAll(".pf-note-item").forEach(el => {
            const txt = (el.dataset.noteText || "").toLowerCase();
            const tags = (el.dataset.noteTags || "").toLowerCase();
            const visible = !q || txt.includes(q) || tags.includes(q);
            el.style.display = visible ? "" : "none";
        });
    };
    searchInput.oninput = () => { _noteFilter = searchInput.value; _applyNoteFilter(); };

    if (notes.length > 0) {
        [...notes].reverse().forEach((note, revIdx) => {
            const idx = notes.length - 1 - revIdx;
            const text = (note.Текст || "").toString();
            const tags = _extractTags(text);
            const item = listEl.createEl("div");
            item.className = "pf-note-item";
            item.dataset.noteText = text;
            item.dataset.noteTags = tags.join(" ");
            item.style.cssText = "background: var(--background-primary); border: 1px solid var(--background-modifier-border); border-left: 3px solid var(--interactive-accent); border-radius: 6px; padding: 8px 12px; transition: opacity 0.15s, max-height 0.2s;";
            const meta = item.createEl("div");
            meta.style.cssText = "display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;";
            const metaLeft = meta.createEl("div");
            metaLeft.style.cssText = "display:flex;align-items:center;gap:6px;flex-wrap:wrap;";
            const dateLbl = metaLeft.createEl("span");
            dateLbl.style.cssText = "color: var(--text-muted); font-size: 0.78em;";
            dateLbl.textContent = fmtDate(note.Дата || "");
            // Теги
            tags.forEach(tag => {
                const chip = metaLeft.createEl("span");
                chip.textContent = tag;
                chip.style.cssText = "display:inline-block;background:rgba(var(--interactive-accent-rgb,33,150,243),0.12);color:var(--interactive-accent);border-radius:4px;padding:0 5px;font-size:0.72em;font-weight:700;cursor:pointer;";
                chip.onclick = () => { searchInput.value = tag; _noteFilter = tag; _applyNoteFilter(); };
            });
            const del = meta.createEl("button");
            del.textContent = "×";
            del.style.cssText = "background: transparent; border: none; color: var(--text-muted); cursor: pointer; font-size: 1.2em; padding: 0 4px; line-height: 1; border-radius: 3px; transition: color 0.15s;";
            del.onmouseenter = () => del.style.color = "#e53935";
            del.onmouseleave = () => del.style.color = "var(--text-muted)";
            del.onclick = () => {
                item.style.opacity = "0"; item.style.pointerEvents = "none";
                setTimeout(() => item.remove(), 150);
                app.fileManager.processFrontMatter(file, fm => {
                    if (Array.isArray(fm.Заметки)) fm.Заметки.splice(idx, 1);
                });
            };
            const content = item.createEl("div");
            content.style.cssText = "color: var(--text-normal); white-space: pre-wrap; word-break: break-word; font-size: 0.9em; line-height: 1.5;";
            content.textContent = text;
        });
    }

    // История изменений статусов
    const history = Array.isArray(cur.История_статусов) ? [...cur.История_статусов].reverse().slice(0, 10) : [];
    if (history.length > 0) {
        const histSec = root.createEl("div");
        histSec.style.cssText = "margin-bottom:10px;";
        const histTitle = histSec.createEl("div");
        histTitle.style.cssText = "font-size:0.75em;font-weight:700;text-transform:uppercase;color:var(--text-accent);margin-bottom:6px;letter-spacing:0.05em;border-bottom:1px solid var(--background-modifier-border);padding-bottom:4px;";
        histTitle.textContent = "История";
        history.forEach(entry => {
            const row = histSec.createEl("div");
            row.style.cssText = "display:flex;justify-content:space-between;align-items:center;padding:3px 0;font-size:0.8em;border-bottom:1px solid var(--background-modifier-border);gap:8px;";
            const typeColor = { "выполнено": "#4caf50", "откат": "#ff9800", "принято": "#4caf50", "отказ": "#e53935" }[entry.тип] || "var(--text-muted)";
            const lbl = row.createEl("span");
            lbl.style.cssText = "color:var(--text-normal);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;";
            lbl.textContent = entry.действие || "—";
            const typeLbl = row.createEl("span");
            typeLbl.style.cssText = `color:${typeColor};font-weight:600;flex-shrink:0;`;
            typeLbl.textContent = entry.тип || "";
            const dateLbl2 = row.createEl("span");
            dateLbl2.style.cssText = "color:var(--text-muted);flex-shrink:0;";
            dateLbl2.textContent = entry.дата ? (entry.дата.toISODate ? entry.дата.toISODate() : String(entry.дата).slice(0, 10)) : "";
        });
    }
}

// ── Форма добавления заметки ──────────────────────────────────────────────────
const ARCHIVE_FOLDER = "Архив/Вложения/" + String(cur.ФИО ?? cur.file.basename).replace(/[\\/:*?"<>|]/g, "_");
const form = root.createEl("div");
form.style.cssText = "display: flex; flex-direction: column; gap: 8px;";

const textarea = form.createEl("textarea");
textarea.placeholder = "Введите заметку… (Ctrl+Enter — сохранить)";
textarea.style.cssText = "width: 100%; min-height: 72px; background: var(--background-primary); color: var(--text-normal); border: 1px solid var(--background-modifier-border); border-radius: 6px; padding: 8px 12px; font-size: 14px; font-family: var(--font-interface); outline: none; resize: vertical; line-height: 1.45; box-sizing: border-box; transition: border-color 0.15s;";
textarea.onfocus = () => textarea.style.borderColor = "var(--interactive-accent)";
textarea.onblur  = () => textarea.style.borderColor = "var(--background-modifier-border)";

const btnRow = form.createEl("div");
btnRow.style.cssText = "display: flex; gap: 8px;";

const addBtn = btnRow.createEl("button");
addBtn.textContent = "+ Заметка";
addBtn.style.cssText = "flex: 1; min-height: 36px; background: var(--interactive-accent); color: var(--text-on-accent); border: none; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer; transition: opacity 0.2s;";
addBtn.onmouseenter = () => addBtn.style.opacity = "0.85";
addBtn.onmouseleave = () => addBtn.style.opacity = "1";

// ── Кнопка прикрепить фото ───────────────────────────────────────────────────
// ── Кнопка прикрепить фото (iOS-совместимая) ─────────────────────────────────
// На iOS WKWebView fileInput.click() программно — заблокирован.
// Решение: оборачиваем кнопку в relative-контейнер и кладём поверх прозрачный input.
const attachWrapper = btnRow.createEl("div");
attachWrapper.style.cssText = "position: relative; flex: 0 0 auto; display: inline-flex;";

const attachBtn = attachWrapper.createEl("button");
attachBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right:5px;vertical-align:middle"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>Фото`;
attachBtn.style.cssText = "min-height: 36px; padding: 0 14px; background: var(--background-primary); color: var(--text-muted); border: 1px solid var(--background-modifier-border); border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.15s; display: flex; align-items: center; pointer-events: none;";
attachBtn.onmouseenter = () => { attachBtn.style.borderColor = "#4caf50"; attachBtn.style.color = "#4caf50"; };
attachBtn.onmouseleave = () => { attachBtn.style.borderColor = "var(--background-modifier-border)"; attachBtn.style.color = "var(--text-muted)"; };

// fileInput поверх кнопки — пользователь тапает прямо по нему (iOS не блокирует)
const fileInput = attachWrapper.createEl("input");
fileInput.type = "file";
fileInput.accept = "image/*,application/pdf,.doc,.docx";
fileInput.multiple = true;
fileInput.style.cssText = "position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; font-size: 0;";

const saveNote = () => {
    const text = textarea.value.trim();
    if (!text) return;
    const ts = today.toFormat("yyyy-MM-dd'T'HH:mm");
    // Мгновенно рисуем новую заметку вверху списка
    const targetList = root.querySelector(".pf-note-item")?.parentElement || root.querySelector("div[style*='flex-direction: column']");
    const item = document.createElement("div");
    item.className = "pf-note-item";
    item.dataset.noteText = text;
    item.dataset.noteTags = (String(text).match(/#[\wа-яёА-ЯЁ]+/g) || []).map(t => t.toLowerCase()).join(" ");
    item.style.cssText = "background: var(--background-primary); border: 1px solid var(--background-modifier-border); border-left: 3px solid var(--interactive-accent); border-radius: 6px; padding: 8px 12px; transition: opacity 0.15s;";
    const meta = document.createElement("div");
    meta.style.cssText = "display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;";
    const dateLbl = document.createElement("span");
    dateLbl.style.cssText = "color: var(--text-muted); font-size: 0.78em;";
    dateLbl.textContent = today.toFormat("dd.MM.yyyy HH:mm");
    const del = document.createElement("button");
    del.textContent = "×";
    del.style.cssText = "background: transparent; border: none; color: var(--text-muted); cursor: pointer; font-size: 1.2em; padding: 0 4px; line-height: 1; border-radius: 3px; transition: color 0.15s;";
    del.onmouseenter = () => del.style.color = "#e53935";
    del.onmouseleave = () => del.style.color = "var(--text-muted)";
    del.onclick = () => {
        item.style.opacity = "0"; item.style.pointerEvents = "none";
        setTimeout(() => item.remove(), 150);
        // Удаляем по тексту + дате (самая свежая заметка с этим текстом)
        app.fileManager.processFrontMatter(file, fm => {
            if (!Array.isArray(fm.Заметки)) return;
            const idx = fm.Заметки.findIndex(n => n.Текст === text && n.Дата === ts);
            if (idx !== -1) fm.Заметки.splice(idx, 1);
        });
    };
    meta.appendChild(dateLbl); meta.appendChild(del);
    const content = document.createElement("div");
    content.style.cssText = "color: var(--text-normal); white-space: pre-wrap; word-break: break-word; font-size: 0.9em; line-height: 1.5;";
    content.textContent = text;
    item.appendChild(meta); item.appendChild(content);
    if (targetList) targetList.insertBefore(item, targetList.firstChild);
    textarea.value = "";
    // Фоновое сохранение
    app.fileManager.processFrontMatter(file, fm => {
        if (!Array.isArray(fm.Заметки)) fm.Заметки = [];
        fm.Заметки.push({ Дата: ts, Текст: text });
    });
};
addBtn.onclick = saveNote;
textarea.onkeydown = e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); saveNote(); } };

// ── Обработчик выбора файлов ──────────────────────────────────────────────────

// iOS WKWebView не поддерживает File.arrayBuffer() — используем FileReader
const readFileAsArrayBuffer = (f) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(f);
});

const saveFiles = async (files) => {
    if (!files || !files.length) return;
    fileInput.disabled = true;
    fileInput.style.pointerEvents = "none";
    attachBtn.style.opacity = "0.5";
    const ts = today.toFormat("yyyy-MM-dd'T'HH:mm");

    // Убеждаемся что папка Архив существует
    try {
        const folder = app.vault.getAbstractFileByPath(ARCHIVE_FOLDER);
        if (!folder) await app.vault.createFolder(ARCHIVE_FOLDER);
    } catch(e) {}

    for (const f of Array.from(files)) {
        try {
            // Читаем через FileReader (работает на iOS)
            const buf = await readFileAsArrayBuffer(f);
            // Уникальное имя файла
            let baseName = f.name.replace(/[\\/:*?"<>|]/g, "_");
            let targetPath = `${ARCHIVE_FOLDER}/${baseName}`;
            let counter = 1;
            while (app.vault.getAbstractFileByPath(targetPath)) {
                const ext = baseName.includes(".") ? "." + baseName.split(".").pop() : "";
                const base = baseName.includes(".") ? baseName.slice(0, baseName.lastIndexOf(".")) : baseName;
                targetPath = `${ARCHIVE_FOLDER}/${base}_${counter}${ext}`;
                counter++;
            }
            await app.vault.createBinary(targetPath, buf);
            await app.fileManager.processFrontMatter(file, fm => {
                if (!Array.isArray(fm.Вложения)) fm.Вложения = [];
                fm.Вложения.push({ Дата: ts, Путь: targetPath, Имя: f.name });
            });
            new Notice(`✅ Сохранено: ${baseName}`);
        } catch(err) {
            console.error("Ошибка прикрепления файла:", err);
            new Notice(`❌ Ошибка: ${f.name}\n${err?.message ?? err}`);
        }
    }
    fileInput.disabled = false;
    fileInput.style.pointerEvents = "auto";
    attachBtn.style.opacity = "1";
    fileInput.value = "";
};

fileInput.onchange = e => saveFiles(e.target.files);

// Drag & drop на весь блок
root.ondragover = e => { e.preventDefault(); root.style.outline = "2px dashed #4caf50"; root.style.borderRadius = "8px"; };
root.ondragleave = () => root.style.outline = "none";
root.ondrop = e => { e.preventDefault(); root.style.outline = "none"; saveFiles(e.dataTransfer.files); };

// ── Вставка из буфера обмена (Ctrl+V) ────────────────────────────────────────
const saveClipboardImages = async (clipboardItems) => {
    const imageItems = [];
    for (const item of clipboardItems) {
        if (item.kind === "file" && item.type.startsWith("image/")) {
            imageItems.push(item);
        }
    }
    if (!imageItems.length) return false; // нет картинок — пусть обычная вставка текста работает

    const ts = today.toFormat("yyyy-MM-dd'T'HH:mm");
    const tsFile = today.toFormat("yyyy-MM-dd'T'HH-mm-ss");

    try {
        const folder = app.vault.getAbstractFileByPath(ARCHIVE_FOLDER);
        if (!folder) await app.vault.createFolder(ARCHIVE_FOLDER);
    } catch(e) {}

    for (const item of imageItems) {
        const f = item.getAsFile();
        if (!f) continue;
        try {
            const buf = await f.arrayBuffer();
            const ext = f.type.split("/")[1] || "png";
            let baseName = `screenshot_${tsFile}.${ext}`;
            let targetPath = `${ARCHIVE_FOLDER}/${baseName}`;
            let counter = 1;
            while (app.vault.getAbstractFileByPath(targetPath)) {
                targetPath = `${ARCHIVE_FOLDER}/screenshot_${tsFile}_${counter}.${ext}`;
                counter++;
            }
            await app.vault.createBinary(targetPath, buf);
            await app.fileManager.processFrontMatter(file, fm => {
                if (!Array.isArray(fm.Вложения)) fm.Вложения = [];
                fm.Вложения.push({ Дата: ts, Путь: targetPath, Имя: baseName });
            });
            new Notice(`✅ Сохранено из буфера: ${baseName}`);
        } catch(err) {
            console.error(err);
            new Notice("❌ Ошибка вставки из буфера обмена");
        }
    }
    return true;
};

textarea.onpaste = async (e) => {
    if (e.clipboardData && e.clipboardData.items) {
        const hadImages = await saveClipboardImages(Array.from(e.clipboardData.items));
        if (hadImages) e.preventDefault(); // не вставлять мусорный текст если была картинка
    }
};

// Также ловим вставку на весь блок (если фокус не в textarea)
root.onpaste = async (e) => {
    if (e.target === textarea) return; // уже обработано выше
    if (e.clipboardData && e.clipboardData.items) {
        const hadImages = await saveClipboardImages(Array.from(e.clipboardData.items));
        if (hadImages) e.preventDefault();
    }
};
}

// ============================================================
// КНОПКА РЕДАКТОРА БАЗЫ ДАННЫХ + QR-КОД QLQ
// ============================================================
{
// Утилиты из блока 0 (экспортированы через window)
const { saveNow: _dbSaveNow, getVal: _dbGetVal } =
    window['_pfUtils_' + cur.file.path] || { saveNow: ()=>{}, getVal: ()=>null };

const _dbWrap = dv.el("div","");
_dbWrap.style.cssText = "margin:16px 0 8px 0;";

// ── Строка кнопок ─────────────────────────────────────────────────────────────
const _dbBtnRow = document.createElement("div");
_dbBtnRow.style.cssText = "display:flex;gap:8px;flex-wrap:wrap;align-items:center;";
_dbWrap.appendChild(_dbBtnRow);

// Кнопка редактора БД
const _dbEditBtn = document.createElement("button");
_dbEditBtn.style.cssText = "padding:8px 18px;background:var(--background-secondary);border:1px solid var(--background-modifier-border);border-radius:8px;cursor:pointer;font-size:13px;color:var(--text-normal);display:inline-flex;align-items:center;gap:8px;transition:background .15s;";
_dbEditBtn.innerHTML = `<span>📊</span><span>Редактировать данные БД</span>`;
_dbEditBtn.onmouseenter = () => _dbEditBtn.style.background = "var(--background-modifier-hover)";
_dbEditBtn.onmouseleave = () => _dbEditBtn.style.background = "var(--background-secondary)";
_dbBtnRow.appendChild(_dbEditBtn);

// Кнопка QR-кода QLQ
const _qrToggleBtn = document.createElement("button");
_qrToggleBtn.style.cssText = "padding:8px 14px;background:var(--background-secondary);border:1px solid var(--background-modifier-border);border-radius:8px;cursor:pointer;font-size:13px;color:var(--text-muted);display:inline-flex;align-items:center;gap:6px;transition:background .15s;";
_qrToggleBtn.innerHTML = `<span>📱</span><span>QLQ QR</span>`;
_qrToggleBtn.onmouseenter = () => _qrToggleBtn.style.background = "var(--background-modifier-hover)";
_qrToggleBtn.onmouseleave = () => _qrToggleBtn.style.background = "var(--background-secondary)";
_dbBtnRow.appendChild(_qrToggleBtn);

// ── QR-панель (скрыта по умолчанию) ──────────────────────────────────────────
const _qrPanel = document.createElement("div");
_qrPanel.style.cssText = "display:none;margin-top:10px;padding:12px;background:var(--background-secondary);border:1px solid var(--background-modifier-border);border-radius:8px;";
_dbWrap.appendChild(_qrPanel);

const _qlqModule = getQLQModule(cur["МКБ 10"]);
const QRL_DOMAIN = "qlq.example.com"; // ← заменить на реальный домен

if (cur.ID_пациента) {
    const _qUrl = `https://${QRL_DOMAIN}/q/${cur.ID_пациента}` + (_qlqModule ? `?m=${_qlqModule}` : "");
    const _qrInner = document.createElement("div");
    _qrInner.style.cssText = "display:flex;align-items:flex-start;gap:14px;flex-wrap:wrap;";
    const _qrDiv = document.createElement("div");
    _qrDiv.style.cssText = "background:#fff;padding:4px;border-radius:6px;border:1px solid #ccc;flex-shrink:0;";
    const _qrMeta = document.createElement("div");
    _qrMeta.style.cssText = "font-size:12px;color:var(--text-muted);line-height:1.6;";
    _qrMeta.innerHTML = `
        <div style="font-weight:700;font-size:13px;color:var(--text-normal);margin-bottom:4px;">
            EORTC QLQ-C30${_qlqModule ? ' + ' + _qlqModule : ''}
        </div>
        <div style="font-size:10px;word-break:break-all;max-width:240px;opacity:.75;">${_qUrl}</div>
        <div style="margin-top:6px;font-size:11px;">
            <span style="color:var(--text-accent)">ID пациента:</span>
            <strong style="font-family:monospace;letter-spacing:1px;">${cur.ID_пациента}</strong>
        </div>`;
    _qrInner.appendChild(_qrDiv); _qrInner.appendChild(_qrMeta);
    _qrPanel.appendChild(_qrInner);

    const _doQR = () => {
        try { new window.QRCode(_qrDiv, { text: _qUrl, width:96, height:96, colorDark:"#000", colorLight:"#fff", correctLevel: window.QRCode.CorrectLevel.M }); } catch(e) {}
    };
    _qrToggleBtn.onclick = () => {
        const visible = _qrPanel.style.display !== "none";
        _qrPanel.style.display = visible ? "none" : "block";
        _qrToggleBtn.style.color = visible ? "var(--text-muted)" : "var(--text-accent)";
        _qrToggleBtn.style.borderColor = visible ? "var(--background-modifier-border)" : "var(--interactive-accent)";
        if (!visible && !_qrDiv.firstChild) {
            if (window.QRCode) { _doQR(); }
            else {
                const _sc = document.createElement('script');
                _sc.src = "https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js";
                _sc.onload = () => { if (document.body.contains(_qrDiv)) _doQR(); };
                document.head.appendChild(_sc);
            }
        }
    };
} else {
    _qrToggleBtn.style.opacity = "0.4";
    _qrToggleBtn.title = "ID пациента не присвоен";
    _qrToggleBtn.disabled = true;
}

// Переименовываем _dbBtnWrap → _dbWrap для совместимости с appendChild ниже
const _dbBtnWrap = _dbWrap;

const DB_EDITOR_FIELDS = [
    { section:"Идентификация", label:"ID пациента (XXX-XXX)", key:"ID_пациента", type:"text" },

    { section:"Логистика", label:"Передан", key:"Передан", type:"text" },
    { section:"Логистика", label:"Палата", key:"Палата", type:"text" },

    { section:"Демография", label:"Пол", key:"db_sex", type:"select", opts:["","М","Ж"] },
    { section:"Демография", label:"ECOG на последнем визите (0–4)", key:"db_ecog_last", type:"select",
      opts:["","0","1","2","3","4"], vals:[null,0,1,2,3,4] },

    { section:"Диагноз", label:"Анатомическая локализация", key:"db_tumor_location", type:"text" },
    { section:"Диагноз", label:"Гистологический тип", key:"db_histotype", type:"text" },
    { section:"Диагноз", label:"Дата диагноза (yyyy-MM)", key:"db_date_dx", type:"text" },

    { section:"Стадирование", label:"Стадия (I / IIA / IIIB / IV …)", key:"db_stage", type:"text" },
    { section:"Стадирование", label:"T (опухоль)", key:"db_t", type:"text" },
    { section:"Стадирование", label:"N (лимфоузлы)", key:"db_n", type:"text" },
    { section:"Стадирование", label:"M (метастазы)", key:"db_m", type:"text" },
    { section:"Стадирование", label:"Grade (G1–G4)", key:"db_grade", type:"text" },

    { section:"Молекулярные маркеры", label:"Молекулярный подтип (только РМЖ)", key:"db_mol_subtype", type:"select",
      opts:["","1 — Люминальный A","2 — Люм. B HER2-","3 — Люм. B HER2+","4 — HER2-позитивный","5 — Тройной негативный"],
      vals:[null,1,2,3,4,5] },
    { section:"Молекулярные маркеры", label:"ER (баллы 0–8)", key:"db_er", type:"text" },
    { section:"Молекулярные маркеры", label:"PR (баллы 0–8)", key:"db_pr", type:"text" },
    { section:"Молекулярные маркеры", label:"HER2 (0 / 1+ / 2+ / 3+)", key:"db_her2", type:"text" },
    { section:"Молекулярные маркеры", label:"Ki67 (%)", key:"db_ki67", type:"text" },
    { section:"Молекулярные маркеры", label:"PD-L1 (например TPS 60% / CPS 15 / 0%)", key:"db_pdl1", type:"text" },
    { section:"Молекулярные маркеры", label:"MGMT", key:"db_mgmt_meth", type:"select",
      opts:["","метилирован","неметилирован"], vals:[null,"метилирован","неметилирован"] },
    { section:"Молекулярные маркеры", label:"MSI / MSS", key:"db_msi_status", type:"select",
      opts:["","MSS","MSI-H","MSI-L","MSI"], vals:[null,"MSS","MSI-H","MSI-L","MSI"] },
    { section:"Молекулярные маркеры", label:"MMR", key:"db_mmr_status", type:"select",
      opts:["","pMMR","dMMR"], vals:[null,"pMMR","dMMR"] },
    { section:"Молекулярные маркеры", label:"Прочие биомаркеры", key:"db_other_biomarkers", type:"textarea" },

    { section:"Геномные альтерации", label:"EGFR", key:"db_egfr_mut", type:"select",
      opts:["","0 — дикий тип / отрицательно","1 — мутация / положительно"], vals:[null,0,1] },
    { section:"Геномные альтерации", label:"ALK", key:"db_alk_status", type:"select",
      opts:["","0 — отрицательно","1 — положительно"], vals:[null,0,1] },
    { section:"Геномные альтерации", label:"ROS1", key:"db_ros1_status", type:"select",
      opts:["","0 — отрицательно","1 — положительно"], vals:[null,0,1] },
    { section:"Геномные альтерации", label:"KRAS", key:"db_kras_mut", type:"select",
      opts:["","0 — дикий тип / отрицательно","1 — мутация / положительно"], vals:[null,0,1] },
    { section:"Геномные альтерации", label:"NRAS", key:"db_nras_mut", type:"select",
      opts:["","0 — дикий тип / отрицательно","1 — мутация / положительно"], vals:[null,0,1] },
    { section:"Геномные альтерации", label:"RAS (общий)", key:"db_ras_mut", type:"select",
      opts:["","0 — дикий тип / отрицательно","1 — мутация / положительно"], vals:[null,0,1] },
    { section:"Геномные альтерации", label:"BRAF", key:"db_braf_mut", type:"select",
      opts:["","0 — дикий тип / отрицательно","1 — мутация / положительно"], vals:[null,0,1] },
    { section:"Геномные альтерации", label:"IDH1 / IDH2", key:"db_idh_mut", type:"select",
      opts:["","0 — дикий тип / отрицательно","1 — мутация / положительно"], vals:[null,0,1] },
    { section:"Геномные альтерации", label:"BRCA1 / BRCA2", key:"db_brca_mut", type:"select",
      opts:["","0 — дикий тип / отрицательно","1 — мутация / положительно"], vals:[null,0,1] },
    { section:"Геномные альтерации", label:"RET", key:"db_ret_status", type:"select",
      opts:["","0 — отрицательно","1 — положительно"], vals:[null,0,1] },
    { section:"Геномные альтерации", label:"MET", key:"db_met_status", type:"select",
      opts:["","0 — отрицательно","1 — положительно"], vals:[null,0,1] },
    { section:"Геномные альтерации", label:"NTRK", key:"db_ntrk_status", type:"select",
      opts:["","0 — отрицательно","1 — положительно"], vals:[null,0,1] },

    { section:"Простата", label:"Gleason", key:"db_gleason", type:"text" },
    { section:"Простата", label:"Initial PSA", key:"db_initial_psa", type:"text" },

    { section:"Лечение", label:"Тип операции", key:"db_surgery_type", type:"text" },
    { section:"Лечение", label:"Предшествующее лечение (хронология)", key:"db_prior_treatment", type:"textarea" },
    { section:"Лечение", label:"Химиотерапия: даты + схема(ы)", key:"db_chemo_regimen", type:"textarea" },
    { section:"Лечение", label:"Метод лучевой терапии", key:"db_rt_method", type:"text" },
    { section:"Лечение", label:"Препараты гормонотерапии", key:"db_hormonal_drug", type:"text" },
    { section:"Лечение", label:"Таргетные препараты", key:"db_targeted_drug", type:"text" },
    { section:"Лечение", label:"Иммунотерапия", key:"db_immunotherapy_drug", type:"text" },

    { section:"Исходы", label:"Прогрессирование", key:"db_progression", type:"select",
      opts:["","0 — нет","1 — да"], vals:[null,0,1] },
    { section:"Исходы", label:"Дата прогрессирования (yyyy-MM)", key:"db_date_prog", type:"text" },
    { section:"Исходы", label:"Тип прогрессирования", key:"db_prog_type", type:"select",
      opts:["","1 — локальное","2 — регионарное","3 — отдалённое","4 — смешанное"], vals:[null,1,2,3,4] },
    { section:"Исходы", label:"Витальный статус", key:"db_vital_status", type:"select",
      opts:["","0 — жив / цензурирован","1 — умер"], vals:[null,0,1] },
    { section:"Исходы", label:"Дата смерти (yyyy-MM-dd)", key:"db_date_death", type:"text" },
    { section:"Исходы", label:"Дата последнего контакта", key:"db_date_last_contact", type:"date" },

    { section:"Выживаемость", label:"Локальный контроль (дней)", key:"db_lc_days", type:"text" },
    { section:"Выживаемость", label:"Безрецидивная выживаемость (дней)", key:"db_dfs_days", type:"text" },
];

_dbEditBtn.onclick = () => {
    const _ov = document.createElement('div');
    _ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box;';
    const _box = document.createElement('div');
    _box.style.cssText = 'background:var(--background-primary);border-radius:12px;padding:20px 22px;width:100%;max-width:640px;max-height:90vh;overflow-y:auto;display:flex;flex-direction:column;gap:0;box-shadow:0 8px 40px rgba(0,0,0,0.4);';
    // Заголовок
    const _hdr = document.createElement('div');
    _hdr.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;';
    _hdr.innerHTML = '<strong style="font-size:15px;">📊 База данных — ручное редактирование</strong>';
    const _closeBtn = document.createElement('button');
    _closeBtn.textContent = '✕';
    _closeBtn.style.cssText = 'background:none;border:none;cursor:pointer;font-size:16px;color:var(--text-muted);padding:2px 6px;border-radius:4px;';
    _closeBtn.onclick = () => _ov.remove();
    _hdr.appendChild(_closeBtn);
    _box.appendChild(_hdr);

    const _inputs = {};
    let _curSection = "";
    DB_EDITOR_FIELDS.forEach(f => {
        if (f.section !== _curSection) {
            _curSection = f.section;
            const _sec = document.createElement('div');
            _sec.style.cssText = 'font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted);margin:14px 0 6px;padding-bottom:4px;border-bottom:1px solid var(--background-modifier-border);';
            _sec.textContent = _curSection;
            _box.appendChild(_sec);
        }
        const _row = document.createElement('div');
        _row.style.cssText = 'display:flex;flex-direction:column;gap:3px;margin-bottom:10px;';
        const _lbl = document.createElement('label');
        _lbl.style.cssText = 'font-size:12px;color:var(--text-muted);';
        _lbl.textContent = f.label;
        _row.appendChild(_lbl);
        let _inp;
        const _curVal = _dbGetVal(f.key);
        if (f.type === "select") {
            _inp = document.createElement('select');
            _inp.style.cssText = 'height:34px;border-radius:6px;border:1px solid var(--background-modifier-border);background:var(--background-primary);color:var(--text-normal);padding:0 8px;font-size:13px;';
            f.opts.forEach((opt, oi) => {
                const _o = document.createElement('option');
                _o.textContent = opt;
                const _opVal = f.vals ? f.vals[oi] : opt;
                _o.value = _opVal === null || _opVal === undefined ? "" : String(_opVal);
                if (_curVal !== null && _curVal !== undefined && String(_curVal) === _o.value) _o.selected = true;
                _inp.appendChild(_o);
            });
        } else if (f.type === "date") {
            _inp = document.createElement('input');
            _inp.type = "date";
            _inp.style.cssText = 'height:34px;border-radius:6px;border:1px solid var(--background-modifier-border);background:var(--background-primary);color:var(--text-normal);padding:0 8px;font-size:13px;box-sizing:border-box;width:100%;';
            if (_curVal) _inp.value = String(_curVal).slice(0,10);
        } else if (f.type === "textarea") {
            _inp = document.createElement('textarea');
            _inp.rows = 4;
            _inp.style.cssText = 'min-height:92px;border-radius:6px;border:1px solid var(--background-modifier-border);background:var(--background-primary);color:var(--text-normal);padding:8px 10px;font-size:13px;box-sizing:border-box;width:100%;resize:vertical;line-height:1.45;';
            if (_curVal !== null && _curVal !== undefined) _inp.value = String(_curVal);
        } else {
            _inp = document.createElement('input');
            _inp.type = "text";
            _inp.style.cssText = 'height:34px;border-radius:6px;border:1px solid var(--background-modifier-border);background:var(--background-primary);color:var(--text-normal);padding:0 10px;font-size:13px;box-sizing:border-box;width:100%;';
            if (_curVal !== null && _curVal !== undefined) _inp.value = String(_curVal);
        }
        _inputs[f.key] = { inp: _inp, field: f };
        _row.appendChild(_inp);
        _box.appendChild(_row);
    });

    // Кнопки
    const _btnRow = document.createElement('div');
    _btnRow.style.cssText = 'display:flex;gap:10px;justify-content:flex-end;margin-top:18px;padding-top:14px;border-top:1px solid var(--background-modifier-border);';
    const _cancelBtn = document.createElement('button');
    _cancelBtn.textContent = 'Отмена';
    _cancelBtn.style.cssText = 'padding:8px 18px;border:1px solid var(--background-modifier-border);border-radius:6px;background:none;color:var(--text-normal);cursor:pointer;font-size:13px;';
    _cancelBtn.onclick = () => _ov.remove();
    const _saveBtn = document.createElement('button');
    _saveBtn.textContent = '💾 Сохранить';
    _saveBtn.style.cssText = 'padding:8px 18px;border:none;border-radius:6px;background:#2196f3;color:#fff;cursor:pointer;font-size:13px;font-weight:600;';
    _saveBtn.onclick = () => {
        const _upd = {};
        Object.entries(_inputs).forEach(([k, {inp, field: f}]) => {
            let v = inp.value.trim();
            if (f.type === "select" && f.vals) {
                const _oi = f.opts.indexOf(inp.options[inp.selectedIndex].textContent);
                v = f.vals[_oi] === null || _oi < 0 ? null : f.vals[_oi];
            } else if (v === "") {
                v = null;
            } else if (f.type !== "text" && f.type !== "textarea" && f.type !== "date" && !isNaN(Number(v))) {
                v = Number(v);
            }
            _upd[k] = v;
        });
        _dbSaveNow(_upd);
        _ov.remove();
        new Notice("✅ Поля для БД сохранены в карте пациента");
    };
    _btnRow.appendChild(_cancelBtn); _btnRow.appendChild(_saveBtn);
    _box.appendChild(_btnRow);
    _ov.appendChild(_box);
    _ov.onclick = e => { if (e.target === _ov) _ov.remove(); };
    document.body.appendChild(_ov);
};
}
