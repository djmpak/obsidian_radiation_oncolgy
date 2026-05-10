// ───────────────────────────────────────────────────────────────
// РАБОЧИЙ СТОЛ — ЕДИНЫЙ БЛОК (ver. 06.03.2026)
// Вкладки: Оперативка | Планирование | Лечение | Выписка
// ────────────────────────────────────────────────────────────────

// ── 0. ФИКС ПРОКРУТКИ ──────────────────────────────────────────
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
                    } catch (_) { }
                }
                if (!_retargeted) {
                    try { _view?.previewMode?.rerender?.(true); } catch (_) { }
                    try { _view?.currentMode?.rerender?.(true); } catch (_) { }
                    try { _view?.editor?.refresh?.(); } catch (_) { }
                }
            }
            try { app.workspace?.trigger?.("layout-change"); } catch (_) { }
        } catch (e) {
            console.error("_pfRetargetMarkdownLeaves:", e);
        }
    };
}
// ── 1. ОБЩИЕ КОНСТАНТЫ ─────────────────────────────────────────
const DATE_OFFSET_KEY = 'rdt-date-offset';
let _dateOffset = 0;
try { _dateOffset = parseInt(localStorage.getItem(DATE_OFFSET_KEY) || "0") || 0; } catch (e) { }
const _realToday = dv.date("now");
const today = _dateOffset === 0 ? _realToday : _realToday.plus({ days: _dateOffset });
const todayStart = today.startOf("day");
const todayStr = todayStart.toISODate();
let holidayPath = "Архив/БД/БД_Праздники.md";
let DB_DISCHARGE_PATH = "Архив/БД/БД_выписки.md";
let DB_PATH = "Архив/База данных.md";
const DB_EXPORT_AT_KEY = "db_exported_at";
const DB_EXPORT_SOURCE_KEY = "db_export_source";
let DISCHARGED_FOLDER = "Выписаны";
const DESKTOP_DISCHARGE_RUNTIME_PATH = "Архив/Scripts/modules/desktop-discharge-runtime.js";

const _dbClonePlain = (value) => {
    try { return JSON.parse(JSON.stringify(value ?? {})); } catch (_) { return value ?? {}; }
};
const _dbNormalizeText = (value) => String(value ?? "").replace(/\r?\n+/g, " ").replace(/\s+/g, " ").trim();
const _dbJoinText = (...values) => values.map(_dbNormalizeText).filter(Boolean).join("\n");
const _dbDedupeSemicolonList = (value) => {
    const items = String(value ?? "")
        .split(/\s*;\s*/g)
        .map(v => _dbNormalizeText(v))
        .filter(Boolean);
    return Array.from(new Set(items)).join("; ");
};
const _dbNormalizeDrugNames = (value) => _dbDedupeSemicolonList(
    _dbNormalizeText(value)
        .replace(/\b\d+(?:[.,]\d+)?\s*(?:мг\/м2|мг|г|мкг|мл|ЕД|IU)\b/gi, "")
        .replace(/\s*[xх?]\s*\d+\b/gi, "")
        .replace(/\s*,\s*/g, "; ")
);
const CHEMO_UPPERCASE_TOKENS = new Set([
    "AC", "EC", "TC", "DC", "PC", "CHOP", "R-CHOP", "RCHOP", "ABVD", "BEP", "EP", "VIP",
    "FOLFOX", "FOLFIRI", "FOLFIRINOX", "CAPOX", "XELOX", "FLOT", "DCF", "TPF", "MVAC", "M-VAC", "CMF", "CAF", "FAC"
]);
const _dbGetCourseWord = (count) => {
    const abs = Math.abs(Number(count)) % 100;
    const last = abs % 10;
    if (abs >= 11 && abs <= 14) return "курсов";
    if (last === 1) return "курс";
    if (last >= 2 && last <= 4) return "курса";
    return "курсов";
};
const _dbNormalizeInlineText = (value) => String(value ?? "")
    .replace(/\r?\n+/g, " ")
    .replace(/[•?]/g, " ")
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
const _dbSplitDiagnosisSentences = (value) => _dbNormalizeInlineText(value)
    .split(/\.\s+(?=[А-ЯA-Z0-9С])/u)
    .map(part => part.trim().replace(/\.$/, ""))
    .filter(Boolean);
const _dbDiagnosisEventStamp = (part) => {
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
const _dbSplitDiagnosisHeadAndEvents = (parts) => {
    const list = Array.isArray(parts) ? parts.filter(Boolean) : [];
    const eventIdx = list.findIndex(part => _dbDiagnosisEventStamp(part) !== null);
    if (eventIdx < 0) return { head: list, events: [] };
    return { head: list.slice(0, eventIdx), events: list.slice(eventIdx) };
};
const _dbMergeDistinctSegments = (baseParts, nextParts) => {
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
const _dbBuildDiagnosisText = (parts) => {
    const list = (Array.isArray(parts) ? parts : [])
        .map(part => _dbNormalizeInlineText(part).replace(/\.$/, ""))
        .filter(Boolean);
    return list.length ? `${list.join(". ")}.` : "";
};
const _dbNormalizeDiagnosisText = (value) => _pfDiagnosisCore.normalizeDiagnosisText(value);
const _dbMergeDiagnosisText = (existingText, nextText) => _pfDiagnosisCore.mergeDiagnosisText(existingText, nextText);
const _dbNormalizeChemoSchemeToken = (token) => {
    const text = _dbNormalizeInlineText(token);
    if (!text) return "";
    const upper = text.toUpperCase();
    if (CHEMO_UPPERCASE_TOKENS.has(upper)) return upper;
    return text.replace(/(^|[\s/()-])([A-Za-zА-Яа-яЁё])/gu, (_, prefix, letter) => `${prefix}${letter.toUpperCase()}`);
};
const _dbNormalizeChemoSchemeText = (text) => String(text || "")
    .split(/\s*?\s*/u)
    .map(step => step.split(/\s*\+\s*/u).map(_dbNormalizeChemoSchemeToken).filter(Boolean).join(" + "))
    .filter(Boolean)
    .join(" ? ");
const _dbNormalizeChemoEntry = (value) => _pfDiagnosisCore.normalizeChemoEntry(value);
const _dbNormalizeHistoryText = (value, mode = "generic") => _dbDedupeSemicolonList(_pfDiagnosisCore.normalizeHistoryText(value, mode));
const _dbExtractSentenceEvents = (value, predicate, mode = "generic") => {
    const text = String(value ?? "").replace(/\r?\n+/g, " ").trim();
    if (!text) return "";
    const items = text
        .split(/\.\s+(?=[А-ЯA-Z0-9С])/u)
        .map(v => v.trim().replace(/\.$/, ""))
        .filter(Boolean)
        .filter(predicate)
        .map(v => _dbNormalizeHistoryText(v, mode))
        .filter(Boolean);
    return Array.from(new Set(items)).join("; ");
};
const _dbInferBinaryMarker = (sourceText, markerPattern, positivePatterns = [], negativePatterns = []) => {
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
const _dbInferPdl1 = (sourceText) => {
    if (!sourceText) return "";
    const match = sourceText.match(/PD-?L1[^\n.;]{0,80}?(TPS\s*\d+(?:[.,]\d+)?%|CPS\s*\d+(?:[.,]\d+)?|\d+(?:[.,]\d+)?%|отриц[^.;\n]*|negative|не выявлен)/i);
    if (!match) return "";
    const raw = _dbNormalizeText(match[1] || match[0].replace(/PD-?L1/i, ""));
    return /отриц|negative|не выяв/i.test(raw) ? "0%" : raw;
};
const _dbInferMsiStatus = (sourceText) => {
    if (!sourceText) return "";
    if (/\bMSI-H\b/i.test(sourceText)) return "MSI-H";
    if (/\bMSI-L\b/i.test(sourceText)) return "MSI-L";
    if (/\bMSS\b/i.test(sourceText) || /микросателлит[а-я\s-]*стабил/i.test(sourceText)) return "MSS";
    if (/\bMSI\b/i.test(sourceText) || /микросателлит[а-я\s-]*нестабил/i.test(sourceText)) return "MSI";
    return "";
};
const _dbInferMmrStatus = (sourceText) => {
    if (!sourceText) return "";
    if (/\bdMMR\b/i.test(sourceText) || /дефицит[а-я\s-]*MMR/i.test(sourceText) || /утрат[а-я\s-]*экспрес[а-я\s-]*MMR/i.test(sourceText)) return "dMMR";
    if (/\bpMMR\b/i.test(sourceText) || /сохранн[а-я\s-]*экспрес[а-я\s-]*MMR/i.test(sourceText) || /MMR intact/i.test(sourceText)) return "pMMR";
    return "";
};
const _dbInferMgmtMeth = (sourceText) => {
    if (!sourceText) return "";
    if (/MGMT[^\n.;]{0,80}(?:неметилир|unmethyl)/i.test(sourceText)) return "неметилирован";
    if (/MGMT[^\n.;]{0,80}(?:метилир|methyl)/i.test(sourceText)) return "метилирован";
    return "";
};
const _dbInferGleason = (sourceText) => {
    if (!sourceText) return "";
    const match = sourceText.match(/Gleason[^\d]{0,20}(\d\s*\+\s*\d(?:\s*=\s*\d+)?)|Глисон[^\d]{0,20}(\d\s*\+\s*\d(?:\s*=\s*\d+)?)|сумма\s+Gleason[^\d]{0,20}(\d+)/i);
    return _dbNormalizeText(match?.[1] || match?.[2] || match?.[3] || "");
};
const _dbInferInitialPsa = (sourceText) => {
    if (!sourceText) return "";
    const match = sourceText.match(/(?:исходн(?:ый|ая)|первичн(?:ый|ая)|initial)\s*(?:PSA|ПСА)[^\d]{0,20}(\d+(?:[.,]\d+)?)/i)
        || sourceText.match(/(?:PSA|ПСА)[^\d]{0,20}(\d+(?:[.,]\d+)?)[^.;\n]{0,30}(?:исходн|первичн|initial)/i);
    return match?.[1] ? match[1].replace(",", ".") : "";
};
const _dbIsTreatmentEvent = (line) => /операц|резекц|лобэктом|пневмонэктом|мастэктом|лампэктом|простатэктом|нефрэктом|гистерэктом|лимфодиссекц|биопси|ПХТ|МХТ|\bХТ\b|ХЛТ|ДЛТ|лучев|радиохирург|брахитерап|стереотакс|гормонотерап|таргет|иммунотерап|ниволумаб|пембролизумаб|осимертиниб|гефитиниб|бевацизумаб|трастузумаб|тамоксифен|летрозол|анастрозол|дегареликс|энзалутамид/i.test(line);
const _dbIsChemoEvent = (line) => /ПХТ|МХТ|\bХТ\b|ХЛТ|FOLFOX|FOLFIRI|FOLFIRINOX|R-CHOP|CHOP|CAPOX|XELOX|AC\b|EC\b|этопозид|цисплатин|карбоплатин|капецитабин|паклитаксел|доцетаксел|иринотекан|оксалиплатин|гемцитабин|темозоломид/i.test(line);
const _dbUpsertRowFile = (row, patientId, recordDate) => _pfDatabaseCore.upsertDatabaseRowFile(DB_PATH, row, patientId, { recordDate });
const _dbFindRowFile = (patientId) => _pfDatabaseCore.findDatabaseRowFile(DB_PATH, patientId);
const _dbRemoveRowFile = (patientId) => _pfDatabaseCore.removeDatabaseRowFile(DB_PATH, patientId);
const _dbWaitForRowFile = (patientId, opts) => _pfDatabaseCore.waitForDatabaseRowFile(DB_PATH, patientId, opts);
const _dbMarkExport = (targetFile, source) => _pfDatabaseCore.markDatabaseExport(targetFile, {
    source,
    atKey: DB_EXPORT_AT_KEY,
    sourceKey: DB_EXPORT_SOURCE_KEY
});
const _dbClearExportMark = (targetFile) => _pfDatabaseCore.clearDatabaseExportMark(targetFile, {
    atKey: DB_EXPORT_AT_KEY,
    sourceKey: DB_EXPORT_SOURCE_KEY
});
const _dbMoveFileToFolder = (targetFile, folderPath, opts = {}) => _pfDatabaseCore.moveFileToFolder(targetFile, folderPath, opts);
const _dbPatchFrontmatter = (targetFile, mutator, opts = {}) => _pfDatabaseCore.patchFrontmatter(targetFile, mutator, opts);
const _dbBuildRowFromFmShared = (fm = {}) => _pfDatabaseCore.buildDatabaseRow({
    getVal: (key) => _dbGetVal(fm, key),
    normalizeText: _dbNormalizeText,
    joinText: _dbJoinText,
    normalizeHistoryText: _dbNormalizeHistoryText,
    normalizeDrugNames: _dbNormalizeDrugNames,
    extractSentenceEvents: _dbExtractSentenceEvents,
    isTreatmentEvent: _dbIsTreatmentEvent,
    isChemoEvent: _dbIsChemoEvent,
    inferPdl1: _dbInferPdl1,
    inferBinaryMarker: _dbInferBinaryMarker,
    inferMgmtMeth: _dbInferMgmtMeth,
    inferMsiStatus: _dbInferMsiStatus,
    inferMmrStatus: _dbInferMmrStatus,
    inferGleason: _dbInferGleason,
    inferInitialPsa: _dbInferInitialPsa,
    getQlqModule: _dbGetQlqModule,
    todayIso: () => new Date().toISOString().slice(0, 10)
});
const _dbReadFreshFrontmatter = (targetFile) => _pfDatabaseCore.readFreshFrontmatter(targetFile);
const _dbGetVal = (fm, key) => Object.prototype.hasOwnProperty.call(fm || {}, key) ? (fm[key] ?? null) : null;
const _dbResolvePatientId = (fm = {}) => _pfDatabaseCore.resolvePatientId({
    existingId: _dbGetVal(fm, "ID_пациента"),
    fio: _dbGetVal(fm, "ФИО"),
    birthDate: _dbGetVal(fm, "Дата_рождения"),
    linkedCases: _dbGetVal(fm, "Связанные_случаи"),
    existingIds: new Set(dv.pages().filter(p => p.ID_пациента).map(p => String(p.ID_пациента)).array()),
    findLinkedPatient: (item) => dv.pages().find(p => p.file?.basename === item || p.file?.path === item)
});
const _dbEnsurePatientIdForFile = async (targetFile, fm = null) => {
    let frontmatter = fm || await _dbReadFreshFrontmatter(targetFile);
    const { id: nextId, source: idSource } = _dbResolvePatientId(frontmatter);
    if (idSource === "existing") return { id: nextId, fm: frontmatter };
    if (!nextId) return { id: "", fm: frontmatter };
    const patchRes = await _dbPatchFrontmatter(targetFile, data => {
        Object.assign(data, _pfDatabaseCore.getPatientIdPatch(nextId));
    });
    frontmatter = patchRes.frontmatter || await _dbReadFreshFrontmatter(targetFile);
    return { id: nextId, fm: frontmatter };
};
const _dbGetQlqModule = (icd10Raw) => _pfDatabaseCore.getQlqModule(icd10Raw);
// ── Sync / find / remove / discharge — делегируют в _pfDatabaseCore ──────────────
// Orchestration-функции вынесены в database-runtime: syncPatientFileToDatabase,
// removePatientFileFromDatabase, dischargePatientFile.
// Обертки ниже сохранены для внутренней совместимости в этом файле.
const _syncPatientFileToDatabase = async (targetFile, { markExport = true, source = "desktop-discharge" } = {}) =>
    _pfDatabaseCore.syncPatientFileToDatabase(DB_PATH, targetFile, { markExport, source });

const _findPatientInDatabase = async (patientId) => {
    const dbId = String(patientId || "").trim();
    if (!dbId) return null;
    return _dbFindRowFile(dbId);
};
const _waitForDatabaseRow = async (patientId, { exists = true, attempts = 7, delayMs = 180 } = {}) => {
    const dbId = String(patientId || "").trim();
    if (!dbId) return null;
    return _dbWaitForRowFile(dbId, { exists, attempts, delayMs });
};
const _removePatientFileFromDatabase = async (targetFile, { clearExportMark = true } = {}) =>
    _pfDatabaseCore.removePatientFileFromDatabase(DB_PATH, targetFile, { clearExportMark });

const _dischargePatientFile = async (targetFile, { source = "desktop-discharge" } = {}) =>
    _pfDatabaseCore.dischargePatientFile(DB_PATH, targetFile, { source, dischargedFolder: DISCHARGED_FOLDER });

// ── 2. ЗАГРУЗКА ПРАЗДНИКОВ (1 раз) ─────────────────────────────
let holidays = new Set();
try {
    const hc = await dv.io.load(holidayPath);
    if (hc) hc.split(/\r?\n/).forEach(l => {
        const t = l.trim();
        if (t && /^\d{4}-\d{2}-\d{2}$/.test(t)) holidays.add(t);
    });
} catch (e) { console.error("Ошибка загрузки праздников:", e); }

// ── BOOT UI: создаём контейнер до runtime-загрузки, чтобы pre-render ошибки не давали пустой экран.
const PILL_BOTTOM_OFFSET = 56;
const MOBILE_CONTENT_BOTTOM_SPACE = 126;
const root = dv.el("div", "");
root.classList.add("rdt-root");
root.style.cssText = "width:100%;box-sizing:border-box;";
if (window.innerWidth <= 600) root.style.marginBottom = MOBILE_CONTENT_BOTTOM_SPACE + 'px';
const _pfBootStatus = root.createEl("div");
_pfBootStatus.style.cssText = "padding:12px;border:1px solid var(--background-modifier-border);border-radius:8px;background:var(--background-primary-alt);color:var(--text-muted);font-size:12px;line-height:1.5;";
const _pfSetBootStatus = (message) => { _pfBootStatus.textContent = `Загрузка рабочего стола: ${message}`; };
const _pfPhase0 = performance.now();
const markPhase = (name) => {
    try { console.debug(`[desktop] ${name} ${(performance.now() - _pfPhase0).toFixed(1)}ms`); } catch (_) { }
};
const _pfShowDesktopBootError = (error, context = "runtime") => {
    try {
        let errContainer = root.querySelector('.rdt-boot-errors');
        if (!errContainer) {
            root.textContent = "";
            errContainer = root.createEl("div", { cls: "rdt-boot-errors" });
            errContainer.style.cssText = "display:flex;flex-direction:column;gap:8px;padding:12px;";
        }
        const box = errContainer.createEl("div");
        box.style.cssText = "padding:12px;border:1px solid var(--text-error);border-radius:8px;background:rgba(255,82,82,0.08);color:var(--text-error);font-size:12px;line-height:1.5;white-space:pre-wrap;font-family:monospace;max-height:300px;overflow-y:auto;";
        
        let msg = `Ошибка рабочего стола (${context}): ${error?.message || error || "unknown error"}`;
        if (error && typeof error === 'object' && error.stack) {
            msg += `\n\nStack Trace:\n${error.stack}`;
        }
        box.textContent = msg;
    } catch (_) { }
};
if (window.__pfDesktopBootErrorCleanup) {
    try { window.__pfDesktopBootErrorCleanup(); } catch (_) { }
}
const _pfBootOnError = (event) => _pfShowDesktopBootError(event?.error || event?.message, "window.error");
const _pfBootOnRejection = (event) => _pfShowDesktopBootError(event?.reason, "unhandledrejection");
window.addEventListener("error", _pfBootOnError);
window.addEventListener("unhandledrejection", _pfBootOnRejection);
window.__pfDesktopBootErrorCleanup = () => {
    window.removeEventListener("error", _pfBootOnError);
    window.removeEventListener("unhandledrejection", _pfBootOnRejection);
};
_pfSetBootStatus("runtime-модули");

const _PF_RUNTIME_LOADER_VERSION = "2026-04-29-cache-bust-v6";
if (!window._pfRuntimeModuleCache || !(window._pfRuntimeModuleCache instanceof Map)) {
    window._pfRuntimeModuleCache = new Map();
}
if (window._pfRuntimeModuleLoaderVersion !== _PF_RUNTIME_LOADER_VERSION) {
    window._pfRuntimeModuleCache.clear();
    window._pfRuntimeModuleLoaderVersion = _PF_RUNTIME_LOADER_VERSION;
}
window._pfLoadRuntimeModule = async (modulePath, context = {}) => {
    const normalizedPath = String(modulePath || "").trim();
    try {
        if (!normalizedPath) throw new Error("Runtime module path is required");
        const source = await dv.io.load(normalizedPath);
        if (!source) throw new Error(`Runtime module not found: ${normalizedPath}`);
        // Hash includes transitive sources (e.g. desktop-core.cjs loaded by desktop-runtime.js)
        let sourceHashInput = source;
        const depMatch = source.match(/dv\.io\.load\(\s*["']([^"']+)["']\s*\)/);
        if (depMatch?.[1]) {
            const depSource = await dv.io.load(depMatch[1]);
            if (depSource) sourceHashInput += `\n/* dep:${depMatch[1]}:${depSource.length}:${depSource.slice(0, 128)}:${depSource.slice(-128)} */`;
        }
        const sourceHash = `${sourceHashInput.length}:${sourceHashInput.slice(0, 256)}:${sourceHashInput.slice(-256)}`;
        const cached = window._pfRuntimeModuleCache.get(normalizedPath);
        if (cached?.sourceHash === sourceHash) {
            return cached.moduleValue;
        }
        const AsyncFunction = Object.getPrototypeOf(async function () { }).constructor;
        const factory = await new AsyncFunction(`"use strict"; return (${source});`)();
        if (typeof factory !== "function") {
            throw new Error(`Runtime module must export a factory function: ${normalizedPath}`);
        }
        const moduleValue = await factory({ dv, app, window, document, console, ...context });
        window._pfRuntimeModuleCache.set(normalizedPath, { sourceHash, moduleValue });
        return moduleValue;
    } catch (error) {
        _pfBootStatus.style.color = "var(--text-error)";
        _pfBootStatus.textContent = `Ошибка загрузки runtime module ${normalizedPath || "(empty)"}: ${error?.message || error}`;
        throw error;
    }
};
const _pfScheduleCore = await window._pfLoadRuntimeModule("Архив/Scripts/modules/schedule-runtime.js");
const normalizeConn = (raw) => _pfScheduleCore.normalizeConn(raw);
const _pfDiagnosisCore = await window._pfLoadRuntimeModule("Архив/Scripts/modules/diagnosis-runtime.js");
const _pfPathsConfigCore = await window._pfLoadRuntimeModule("Архив/Scripts/modules/paths-config-runtime.js", { dv });
const _pfDatabaseCore = await window._pfLoadRuntimeModule("Архив/Scripts/modules/database-runtime.js");
_pfDatabaseCore.installFrontmatterPatch();
_pfDatabaseCore.installRenamePatch();
const _pfDesktopCore = await window._pfLoadRuntimeModule("Архив/Scripts/modules/desktop-runtime.js");
const _pfDesktopRender = await window._pfLoadRuntimeModule("Архив/Scripts/modules/desktop-render-runtime.js");
window._pfDesktopRender = _pfDesktopRender;
const _pfDesktopPlatform = await window._pfLoadRuntimeModule("Архив/Scripts/modules/desktop-platform-runtime.js");
const _pfDesktopDischarge = await window._pfLoadRuntimeModule(DESKTOP_DISCHARGE_RUNTIME_PATH);
window._pfDesktopDischarge = _pfDesktopDischarge;
const DESKTOP_NEW_PATIENT_RUNTIME_PATH = "Архив/Scripts/modules/desktop-new-patient-runtime.js";
const _pfDesktopNewPatient = await window._pfLoadRuntimeModule(DESKTOP_NEW_PATIENT_RUNTIME_PATH, {
    _pfDesktopCore,
    _pfDesktopPlatform,
    _pfDiagnosisCore,
    _dbResolvePatientId,
    _dbMergeDiagnosisText,
    _dbNormalizeHistoryText,
    _dbNormalizeDrugNames,
    _dbNormalizeDiagnosisText,
    normalizeConn
});
window._pfDesktopNewPatient = _pfDesktopNewPatient;
markPhase("boot");
_pfSetBootStatus("данные пациентов");
const PATHS = _pfPathsConfigCore?.PATHS || {};
const _resolveExistingPath = (...candidates) => {
    for (const candidate of candidates) {
        const clean = String(candidate || "").trim();
        if (!clean) continue;
        try {
            if (app.vault?.getAbstractFileByPath?.(clean)) return clean;
        } catch (e) { }
    }
    return String(candidates.find(Boolean) || "");
};
holidayPath = _resolveExistingPath(PATHS.holidaysPath, holidayPath);
DB_PATH = _resolveExistingPath(PATHS.databasePath, DB_PATH);
DISCHARGED_FOLDER = PATHS.dischargedFolder || DISCHARGED_FOLDER;
const DB_COLS = _pfDatabaseCore.DB_COLS;
const DB_STAGE_TO_NUM = _pfDatabaseCore.DB_STAGE_TO_NUM;
const DB_GOAL_MAP = _pfDatabaseCore.DB_GOAL_MAP;
const DB_TX_STATUS_MAP = _pfDatabaseCore.DB_TX_STATUS_MAP;
const _candidateFolders = (...folders) => Array.from(new Set(
    folders.flat().map(value => String(value || "").trim()).filter(Boolean)
));
const _withArchiveFallback = (folder) => {
    const clean = String(folder || "").trim();
    if (!clean) return [];
    return clean.startsWith("Архив/") ? [clean] : [clean, `Архив/${clean}`];
};
const _folderPages = (...folders) => {
    const seen = new Set();
    const result = [];
    _candidateFolders(...folders).forEach(folder => {
        try {
            dv.pages(`"${folder}"`).forEach(p => {
                const filePath = String(p?.file?.path || "");
                if (!filePath || seen.has(filePath)) return;
                seen.add(filePath);
                result.push(p);
            });
        } catch (e) { }
    });
    return result;
};
const _PATIENT_FOLDERS = _candidateFolders(..._withArchiveFallback(PATHS.patientsFolder || "Пациенты"));
const _CONSULTATION_FOLDERS = _candidateFolders(..._withArchiveFallback(PATHS.consultationsFolder || "Консультации"));
const _DISCHARGED_FOLDERS = _candidateFolders(..._withArchiveFallback(PATHS.dischargedFolder || "Выписаны"));
const _REJECTED_FOLDERS = _candidateFolders(..._withArchiveFallback(PATHS.rejectedFolder || "Не начали"));

// ── 3. ЗАГРУЗКА ДАННЫХ (1 раз) ─────────────────────────────────
const patients = _folderPages(_PATIENT_FOLDERS).filter(p => p.ФИО);
const consultationPages = _folderPages(_CONSULTATION_FOLDERS).filter(p => p.ФИО);
const dischargedPages = _folderPages(_DISCHARGED_FOLDERS).filter(p => p.ФИО);
const rejectedPages = _folderPages(_REJECTED_FOLDERS).filter(p => p.ФИО);
const searchOnlyPages = [...dischargedPages, ...rejectedPages];

// ── 4. ОБЩИЕ УТИЛИТЫ ───────────────────────────────────────────
const toISO = d => d.toISODate();
const safeDate = d => d ? dv.date(d) : null;
const fmt = d => d ? d.toFormat("dd.MM.yyyy") : "—";
const fmtFull = d => d ? d.toFormat("dd.MM.yyyy HH:mm") : "—";
const _pfToStartOfDay = (value) => {
    const parsed = value ? dv.date(value) : null;
    return parsed ? parsed.startOf("day") : null;
};
const _pfAsIso = (value) => value?.toISODate?.() || _pfToStartOfDay(value)?.toISODate?.() || null;

const nextWorkDay = (d) => {
    const iso = _pfScheduleCore.nextWorkDayAfter(_pfAsIso(d), holidays, 30);
    return iso ? dv.date(iso).startOf("day") : d?.plus?.({ days: 1 }) || null;
};

const getWorkDays = (startRaw, endRaw) => _pfScheduleCore.getWorkDays(_pfAsIso(startRaw), _pfAsIso(endRaw), holidays);

const minusWorkDays = (dateObj, n) => {
    const iso = _pfScheduleCore.minusWorkDays(_pfAsIso(dateObj), n, holidays);
    return iso ? dv.date(iso).startOf("day") : null;
};

const dayPhrases = _pfDesktopCore.DAY_PHRASES;

if (!window._pfDesktopModelCache || !(window._pfDesktopModelCache instanceof Map)) {
    window._pfDesktopModelCache = new Map();
}
const _pfDesktopModelCache = window._pfDesktopModelCache;
const _pfPatientModelCacheKey = (p) => {
    const filePath = p?.file?.path || "";
    const fileMtime = p?.file?.mtime?.ts || p?.file?.mtime || "";
    const payload = JSON.stringify([
        p?.ФИО || "",
        p?.Количество_фракций || "",
        p?.Дата_начала_лечения || "",
        p?.Фракционирование || "",
        p?.Больничный_лист ? 1 : 0,
        p?.Дата_разметки || "",
        p?.Переразметка ? 1 : 0,
        p?.Дата_переразметки || "",
        p?.["Очередное_ВК"] || [],
        p?.Объёмы || [],
        p?.Внеплановые_фракции || [],
        p?.Пропущенные_даты || [],
        todayStr,
        Array.from(holidays)
    ]);
    return `${filePath}|${fileMtime}|${payload}`;
};

// ── 6. ЕДИНАЯ МОДЕЛЬ ПАЦИЕНТА ───────────────────────────────────
const calcPatient = (p) => {
    const cacheKey = _pfPatientModelCacheKey(p);
    const cached = _pfDesktopModelCache.get(cacheKey);
    if (cached) return cached;

    const raw = _pfDesktopCore.buildPatientModel(p, {
        holidays: Array.from(holidays),
        todayIso: todayStr,
        scheduleCore: _pfScheduleCore
    });

    return {
        p: raw.p,
        start: safeDate(raw.startIso),
        end: safeDate(raw.endIso),
        schedule: raw.scheduleIsos.map(iso => dv.date(iso)?.startOf("day")).filter(Boolean),
        currFrac: raw.currFrac,
        frac: raw.frac,
        segments: raw.segments,
        totalFrac: raw.totalFrac,
        totalCurrFrac: raw.totalCurrFrac,
        extraSchedules: raw.extraSchedules.map(s => ({
            ...s,
            schedule: s.scheduleIsos.map(iso => dv.date(iso)?.startOf("day")).filter(Boolean),
            startN: safeDate(s.startIsoN),
            endN: safeDate(s.endIsoN)
        })),
        hasFractionToday: raw.hasFractionToday,
        isSick: raw.isSick,
        vkDates: raw.vkDateIsos.map(iso => dv.date(iso)?.startOf("day")).filter(Boolean),
        contourDeadline: safeDate(raw.contourDeadlineIso),
        remarkDate: safeDate(raw.remarkDateIso),
        recontourDeadline: safeDate(raw.recontourDeadlineIso),
        mark: safeDate(raw.markIso)
    };

    _pfDesktopModelCache.set(cacheKey, model);
    return model;
};

// Расчёт для всех пациентов (1 раз)
_pfSetBootStatus("расчёт карточек пациентов");
const _pfModelErrors = [];
const allModels = [];
patients.forEach(p => {
    try {
        allModels.push(calcPatient(p));
    } catch (error) {
        _pfModelErrors.push({
            name: p?.file?.name || p?.ФИО || "(без имени)",
            path: p?.file?.path || "",
            message: error?.message || String(error)
        });
        console.error("calcPatient failed:", p?.file?.path || p?.ФИО, error);
    }
});

const modelMap = new Map();
allModels.forEach(m => modelMap.set(m.p.file.path, m));
markPhase("write");


// ── 7. ЗНАЧКИ И ТЕКСТ ПРЕДПИСАНИЯ ──────────────────────────────
const getPatientBadges = (p) => _pfDesktopCore.getPatientBadges(p);
const getPatientFilterHints = (p) => _pfDesktopCore.getPatientFilterHints(p);
const reminderHasVk = (text) => _pfDesktopCore.reminderHasVk(text);
const getReminderFilterHints = (item) => _pfDesktopCore.getReminderFilterHints(item);
const getPrescriptionFundingLabel = (raw) => _pfDesktopCore.getPrescriptionFundingLabel(raw);
const getFundingType = (p) => _pfDesktopCore.getFundingType(p);

const buildPrescText = (p) => _pfDesktopCore.buildPrescriptionText(p, {
    todayIso: dv.date("now")?.toISODate?.(),
    normalizeConn
});

// ── 8. ОБЩИЕ РЕНДЕР-УТИЛИТЫ (контейнерные) ─────────────────────
// Иконки заголовков секций
const _HI_BELL = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>`;
const _HI_PHONE = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.7 11.8 19.79 19.79 0 0 1 1.61 3.18 2 2 0 0 1 3.59 1h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 8.96a16 16 0 0 0 6.13 6.13l.92-.92a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`;
const _HI_LOGOUT = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`;
const _HI_USRPLUS = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>`;
const _HI_ALERT = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;
const _HI_CALCHK = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><polyline points="9 16 11 18 15 14"/></svg>`;
const _HI_PEN = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>`;
const _HI_TARGET = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>`;
const _HI_CLOCK = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;
const _HI_PULSE = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>`;
// Цветные точки для статус-меток
const _DOT = (c) => `<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${c};vertical-align:middle;flex-shrink:0;margin-right:2px;"></span>`;

const _h = (parent, text, icon = "") => {
    const el = parent.createEl("div");
    el.classList.add("rdt-section-head");
    const iconHtml = icon ? `<span style="display:inline-flex;align-items:center;vertical-align:middle;margin-right:3px;color:var(--text-muted);">${icon}</span>` : "";
    el.innerHTML = `<div style="display:flex;align-items:center;gap:6px;margin:12px 0 4px 0;"><span style="font-size:0.95em;font-weight:700;color:var(--text-normal);white-space:nowrap;display:flex;align-items:center;">${iconHtml}${text}</span><div style="flex:1;height:1px;background:var(--background-modifier-border);"></div></div>`;
    return el;
};
const _spacer = (parent) => { const el = parent.createEl("div"); el.classList.add("rdt-spacer"); el.style.height = "6px"; return el; };
const _subh = (parent, text, color = "var(--text-muted)") => { const el = parent.createEl("div"); el.style.cssText = `font-size:0.76em;font-weight:700;text-transform:uppercase;color:${color};margin:8px 0 2px 2px;letter-spacing:0.04em;`; el.textContent = text; return el; };
const _dateh = (parent, text) => {
    const el = parent.createEl("div");
    el.classList.add("rdt-section-head");
    el.innerHTML = `<div style="display:flex;align-items:center;gap:8px;margin:8px 0 3px 0;"><span style="font-size:0.8em;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:var(--text-muted);">${text}</span><div style="flex:1;height:1px;background:var(--background-modifier-border);opacity:0.65;"></div></div>`;
    return el;
};

// ── 9. ДАННЫЕ ДЛЯ ОПЕРАТИВКИ ───────────────────────────────────
// Напоминания
const allReminders = [];
const scanReminders = (pages) => {
    pages.forEach(p => {
        if (p.Напоминания && Array.isArray(p.Напоминания)) {
            p.Напоминания.forEach((r, idx) => {
                if (!r || !r.дата || !r.текст) return;
                const rd = dv.date(r.дата);
                if (!rd) return;
                if (r.выполнено === true) {
                    return;
                }
                allReminders.push({ patient: p, reminder: r, date: rd, index: idx });
            });
        }
    });
};
scanReminders(patients);
scanReminders(consultationPages);
allReminders.sort((a, b) => a.date - b.date);
const activeReminderCount = _pfDesktopCore.getDueReminderCount(allReminders, todayStr, item => item.date?.toISODate?.() || "");

// Консультации
const parseLegacyConsultOrder = (name, targetDate) => _pfDesktopCore.parseLegacyConsultOrder(name, targetDate.day);

const getConsultations = (targetDate) => {
    const targetIso = targetDate.toISODate();
    const result = [];
    const seen = new Set();

    const getAge = (p) => _pfDesktopCore.getAgeLabel(p.Дата_рождения, targetIso);

    const pushItem = (p, opts = {}) => {
        if (!p?.file?.path || seen.has(p.file.path)) return;
        const consultAt = opts.consultAt || null;
        const legacyOrder = opts.legacyOrder ?? null;

        let consultSort = { sortMinutes: 24 * 60, time: "—" };
        if (consultAt) {
            consultSort = _pfDesktopCore.getConsultSort({ hour: consultAt.hour, minute: consultAt.minute });
        } else if (legacyOrder) {
            consultSort = _pfDesktopCore.getConsultSort({ legacyOrder });
        }

        const identity = _pfDesktopCore.getConsultationIdentity({
            fio: p.ФИО,
            fileName: p.file.name,
            mkb10: p["МКБ 10"],
            ageLabel: getAge(p)
        });
        seen.add(p.file.path);
        result.push({
            file: p.file,
            fio: identity.fio,
            mkb: identity.mkb,
            age: getAge(p),
            displayName: identity.displayName,
            snils: p.СНИЛС,
            time: consultSort.time,
            sortMinutes: consultSort.sortMinutes,
            legacyOrder: legacyOrder || 999,
            source: opts.source || "unknown",
            hasConsultField: !!consultAt
        });
    };

    consultationPages.forEach(p => {
        const consultAt = p.Дата_консультации ? dv.date(p.Дата_консультации) : null;
        if (consultAt) {
            if (consultAt.toISODate() === targetIso) {
                pushItem(p, { consultAt: consultAt.startOf("minute"), source: "consult_field" });
            }
            return; // при наличии Дата_консультации старый DD.N не используем
        }
        const legacyOrder = parseLegacyConsultOrder(p.file.name, targetDate);
        if (legacyOrder) pushItem(p, { legacyOrder, source: "legacy_ddn" });
    });

    patients.filter(p => p.Дата_консультации && !p.Принят_на_лечение).forEach(p => {
        const consultAt = dv.date(p.Дата_консультации);
        if (!consultAt || consultAt.toISODate() !== targetIso) return;
        pushItem(p, { consultAt: consultAt.startOf("minute"), source: "consult_field" });
    });

    return result.sort(_pfDesktopCore.compareTodayConsultations);
};
const consultations = getConsultations(today);
const getScheduledConsultations = () => {
    const result = [];
    const seen = new Set();
    const getAge = (p, consultAt) => consultAt ? _pfDesktopCore.getAgeLabel(p.Дата_рождения, consultAt.toISODate()) : "";
    const pushItem = (p, consultAt, source) => {
        if (!p?.file?.path || seen.has(p.file.path) || !consultAt) return;
        const identity = _pfDesktopCore.getConsultationIdentity({
            fio: p.ФИО,
            fileName: p.file.name,
            mkb10: p["МКБ 10"],
            ageLabel: getAge(p, consultAt)
        });
        seen.add(p.file.path);
        result.push({
            file: p.file,
            patient: p,
            fio: identity.fio,
            mkb: identity.mkb,
            age: getAge(p, consultAt),
            displayName: identity.displayName,
            snils: p.СНИЛС,
            consultAt: consultAt.startOf("minute"),
            dateIso: consultAt.toISODate(),
            time: consultAt.toFormat("HH:mm"),
            sortMinutes: _pfDesktopCore.getConsultSort({ hour: consultAt.hour, minute: consultAt.minute }).sortMinutes,
            sortMillis: consultAt.toMillis(),
            source
        });
    };
    consultationPages.forEach(p => {
        const consultAt = dv.date(p.Дата_консультации);
        if (!consultAt) return;
        pushItem(p, consultAt, "consultations_folder");
    });
    patients.filter(p => p.Дата_консультации && !p.Принят_на_лечение).forEach(p => {
        const consultAt = dv.date(p.Дата_консультации);
        if (!consultAt) return;
        pushItem(p, consultAt, "patients_folder");
    });
    return result.sort(_pfDesktopCore.compareScheduledConsultations);
};
const scheduledConsultations = getScheduledConsultations();

// Фильтры для оперативки
const starts = allModels.filter(d => _pfDesktopCore.isTodayModelStart({ startIso: d.start?.toISODate?.() || "", todayIso: todayStr }));
const ends = allModels.filter(d => _pfDesktopCore.isTodayModelEnd({ endIso: d.end?.toISODate?.() || "", todayIso: todayStr }));
const markups = patients.filter(p => _pfDesktopCore.isTodayMarkup({ markIso: dv.date(p.Дата_разметки)?.toISODate?.() || "", todayIso: todayStr }));
const reMarkups = patients.filter(p => _pfDesktopCore.isTodayRemarkup({
    hospitalized: p.Госпитализация === true,
    remarkIso: dv.date(p.Дата_переразметки)?.toISODate?.() || "",
    remarkupDone: p.Переразметка === true,
    todayIso: todayStr
}));
const overdueReMarkups = patients.filter(p => _pfDesktopCore.isOverdueRemarkup({
    hospitalized: p.Госпитализация === true,
    remarkIso: dv.date(p.Дата_переразметки)?.startOf("day")?.toISODate?.() || "",
    remarkupDone: p.Переразметка === true,
    todayIso: todayStr
}));

let contours = allModels.filter(d => d.p.Разметка === true && !d.p.Оконтуривание && d.p.Госпитализация !== true);
contours.sort((a, b) => (a.start?.toMillis() || 0) - (b.start?.toMillis() || 0));
const reContours = allModels.filter(d => d.p.Госпитализация === true && d.p.Переразметка === true && d.p.Оконтуривание !== true);

const contourPlan = _pfDesktopCore.getContourPlan(contours.map(d => ({
    source: d,
    contourDeadlineIso: d.contourDeadline?.toISODate?.() || "",
    todayIso: todayStr,
    workDaysToDeadline: d.contourDeadline ? getWorkDays(todayStart, d.contourDeadline) : 999
})), { plannedLimit: 2 });
contourPlan.sort((a, b) => (a.start?.toMillis() || 0) - (b.start?.toMillis() || 0));

// Все госпитализации: сначала просроченные, потом сегодняшние
const allAdmissions = _pfDesktopCore.getAdmissionPlan(allModels.map(d => ({
    source: d,
    startIso: d.start?.toISODate?.() || "",
    todayIso: todayStr,
    contoured: d.p.Оконтуривание === true,
    hospitalized: d.p.Госпитализация === true
})));
allAdmissions.sort((a, b) => (a.start?.toMillis() || 0) - (b.start?.toMillis() || 0));
const overdueAdmissions = allAdmissions.filter(item => item?.isOverdue === true);

const _vkSplit = _pfDesktopCore.splitVkItems(allModels.map(d => ({
    p: d.p,
    dateIsos: d.vkDates.map(date => date.toISODate())
})), todayStr);
const elnVkItems = _vkSplit.todayItems.map(item => ({ p: item.p, date: dv.date(item.dateIso) }));
const overdueVkItems = _vkSplit.overdueItems.map(item => ({ p: item.p, date: dv.date(item.dateIso) }));

// Просроченные консультации (Консультации/ и Пациенты/ с датой < сегодня, не принятые)
const overdueConsultations = (() => {
    const _getAge = (p) => _pfDesktopCore.getAgeLabel(p.Дата_рождения, todayStr);
    const _getIdentity = (p) => _pfDesktopCore.getConsultationIdentity({
        fio: p.ФИО,
        fileName: p.file.name,
        mkb10: p["МКБ 10"],
        ageLabel: _getAge(p)
    });
    const res = [];
    dv.pages('"Консультации"').where(p => p.ФИО && p.Дата_консультации).forEach(p => {
        const d = dv.date(p.Дата_консультации);
        if (d && d.startOf("day") < todayStart)
            res.push({ file: p.file, name: _getIdentity(p).displayName, snils: p.СНИЛС, date: d });
    });
    dv.pages('"Пациенты"').where(p => p.ФИО && p.Дата_консультации && !p.Принят_на_лечение).forEach(p => {
        const d = dv.date(p.Дата_консультации);
        if (d && d.startOf("day") < todayStart)
            res.push({ file: p.file, name: _getIdentity(p).displayName, snils: p.СНИЛС, date: d });
    });
    return res.sort((a, b) => a.date - b.date);
})();

// Просроченные выписки (конец курса в прошлом, пациент ещё в лечении)
const overdueEnds = allModels.filter(d => _pfDesktopCore.isOverdueTreatmentEnd({
    endIso: d.end?.toISODate?.() || "",
    todayIso: todayStr,
    hospitalized: d.p.Госпитализация === true
}))
    .sort((a, b) => a.end - b.end);

// Просроченные начальные разметки (Дата_разметки < сегодня, Разметка не выполнена)
const overdueMarkupsArr = patients
    .filter(p => _pfDesktopCore.isOverdueInitialMarkup({
        markIso: dv.date(p.Дата_разметки)?.startOf("day")?.toISODate?.() || "",
        todayIso: todayStr,
        markupDone: p.Разметка === true,
        hospitalized: p.Госпитализация === true
    }));

// Статистика
const _desktopStats = _pfDesktopCore.getModelStats(allModels.map(d => ({
    startIso: d.start?.toISODate?.() || "",
    endIso: d.end?.toISODate?.() || ""
})), todayStr);
const active = _desktopStats.active;
const waiting = _desktopStats.waiting;
const admitting = _desktopStats.admitting;
const discharging = _desktopStats.discharging;

// Данные для планирования (Блок 3)
const calcPercentMarkup = (targetDate) => targetDate ? _pfDesktopCore.calcPercentMarkupByWorkDays(getWorkDays(todayStart, targetDate)) : 0;
const calcPercentContour = (markDate, targetDate) => {
    if (!markDate || !targetDate) return 0;
    const mk = markDate.startOf('day'), tg = targetDate.startOf('day');
    return _pfDesktopCore.calcPercentContourProgress({
        isBeforeOrOnMark: todayStart <= mk,
        totalWorkDays: getWorkDays(mk, tg),
        passedWorkDays: getWorkDays(mk, todayStart)
    });
};
const calcPercentWaiting = (markDate, startDate) => {
    if (!startDate) return 0;
    if (markDate) {
        const mk = markDate.startOf('day'), st = startDate.startOf('day');
        return _pfDesktopCore.calcPercentWaitingProgress({
            hasMark: true,
            totalWorkDays: getWorkDays(mk, st),
            passedWorkDays: getWorkDays(mk, todayStart)
        });
    }
    return _pfDesktopCore.calcPercentWaitingProgress({
        hasMark: false,
        workDaysToStart: getWorkDays(todayStart, startDate)
    });
};

// Списки для планирования
const listMarkup = [], listReMarkup = [], listContour = [], listWaiting = [], listTreatment = [], listSearchOnly = [];

searchOnlyPages.forEach(p => {
    listSearchOnly.push({ p, d: null, status: _pfDesktopCore.getSearchOnlyStatus(p.file.path) });
});

patients.forEach(p => {
    const d = modelMap.get(p.file.path);
    if (!d) return;
    _pfDesktopCore.getPlanningStatuses(p, {
        hasRemarkDate: !!d.remarkDate,
        hasMark: !!d.mark
    }).forEach(status => {
        const item = { p, d, status };
        if (status === "treatment") listTreatment.push(item);
        else if (status === "remarkup") listReMarkup.push(item);
        else if (status === "waiting") listWaiting.push(item);
        else if (status === "contour") listContour.push(item);
        else if (status === "markup") listMarkup.push(item);
    });
});
listMarkup.sort((a, b) => (a.d.mark?.toMillis() || 0) - (b.d.mark?.toMillis() || 0));
listReMarkup.sort((a, b) => (a.d.remarkDate?.toMillis() || 0) - (b.d.remarkDate?.toMillis() || 0));
listContour.sort((a, b) => (a.d.start?.toMillis() || 0) - (b.d.start?.toMillis() || 0));
listWaiting.sort((a, b) => (b.d.start?.toMillis() || 0) - (a.d.start?.toMillis() || 0));
listTreatment.sort((a, b) => (b.d.start?.toMillis() || 0) - (a.d.start?.toMillis() || 0));
const isOnTreatmentDate = (d, day = todayStart) => _pfDesktopCore.isOnTreatmentDateIso({
    startIso: d?.start?.toISODate?.() || "",
    endIso: d?.end?.toISODate?.() || "",
    dayIso: day?.toISODate?.() || ""
});
const getTreatmentBucket = (x) => _pfDesktopCore.getTreatmentBucket({
    startIso: x?.d?.start?.toISODate?.() || "",
    endIso: x?.d?.end?.toISODate?.() || "",
    hasFractionToday: x?.d?.hasFractionToday === true
}, todayStr);
const treatmentWithFractionToday = listTreatment.filter(x => getTreatmentBucket(x) === "fraction_today");
const treatmentBreakToday = listTreatment.filter(x => getTreatmentBucket(x) === "break_today");
const treatmentOther = listTreatment.filter(x => getTreatmentBucket(x) === "other");

// Данные для выписки (Блок 4)
let _desktopDischargeState = { copiedSet: new Set(), limitDateIso: "", limitDate: null, dischargeData: [], recentDischargeStart: null, recentDischargedData: [] };
try {
    _desktopDischargeState = await window._pfDesktopDischarge.buildDesktopDischargeState({
        app,
        dv,
        allModels,
        today,
        todayStart,
        todayStr,
        holidays: Array.from(holidays),
        DB_DISCHARGE_PATH,
        DISCHARGED_FOLDER,
        _pfDesktopCore,
        _pfScheduleCore,
        _pfAsIso,
        minusWorkDays,
        safeDate
    });
} catch (e) {
    console.error("desktop discharge state:", e);
}
const dischargeData = _desktopDischargeState.dischargeData;


// ────────────────────────────────────────────────────────────────
// 10. TAB UI + CSS
// ────────────────────────────────────────────────────────────────
{
    const _oldTabsStyle = document.getElementById('rdt-tabs-style');
    if (_oldTabsStyle) _oldTabsStyle.remove();

    const _ts = document.createElement('style');
    _ts.id = 'rdt-tabs-style';
    _ts.textContent = `
        .rdt-tabs{display:flex;gap:6px;margin-bottom:6px;flex-wrap:wrap;padding:0;}
        .rdt-tab{padding:8px 18px;border-radius:12px;font-size:0.88em;font-weight:700;cursor:pointer;border:1.5px solid var(--background-modifier-border);background:var(--background-primary-alt);color:var(--text-muted);transition:all 0.18s;white-space:nowrap;user-select:none;-webkit-user-select:none;text-align:center;min-width:0;flex:1 1 auto;}
        .rdt-tab:hover{background:var(--background-modifier-hover);border-color:var(--interactive-accent);color:var(--text-normal);}
        .rdt-tab.active{background:var(--interactive-accent);color:white;border-color:var(--interactive-accent);box-shadow:0 2px 8px rgba(0,0,0,0.15);}
        .rdt-tab .rdt-badge{display:inline-block;min-width:18px;height:18px;line-height:18px;text-align:center;border-radius:9px;font-size:0.75em;font-weight:800;margin-left:5px;padding:0 5px;background:rgba(255,255,255,0.3);color:inherit;}
        .rdt-tab:not(.active) .rdt-badge{background:rgba(100,100,100,0.1);color:var(--text-muted);}
        .rdt-tab-icon{display:none;width:16px;height:16px;vertical-align:middle;margin-right:5px;flex-shrink:0;}
        .rdt-tab-icon svg{width:100%;height:100%;}
        .rdt-tab-label{display:inline;}
        @media(max-width:600px){
            .rdt-tabs{position:fixed;bottom:calc(env(safe-area-inset-bottom,0px) + ${PILL_BOTTOM_OFFSET}px);left:50%;transform:translateX(-50%);z-index:999;background:rgba(26,26,28,0.88);-webkit-backdrop-filter:blur(18px);backdrop-filter:blur(18px);border-radius:30px;padding:5px 6px;margin:0;gap:2px;flex-wrap:nowrap;box-shadow:0 6px 28px rgba(0,0,0,0.45),0 1px 0 rgba(255,255,255,0.06) inset;border:none;width:auto;display:flex;align-items:center;will-change:transform;position:fixed;}
            .rdt-tabs-indicator{position:absolute;background:var(--interactive-accent);border-radius:22px;transition:left 0.35s cubic-bezier(0.4,0,0.2,1),width 0.35s cubic-bezier(0.4,0,0.2,1),top 0.35s cubic-bezier(0.4,0,0.2,1),height 0.35s cubic-bezier(0.4,0,0.2,1);pointer-events:none;z-index:0;}
            .rdt-tab{padding:9px 14px;border-radius:22px;font-size:0;flex:0 0 auto;min-width:0;border:none;background:transparent !important;display:flex;flex-direction:column;align-items:center;justify-content:center;position:relative;color:rgba(255,255,255,0.45);transition:color 0.25s ease;z-index:1;}
            .rdt-tab.active{color:white !important;}
            .rdt-tab-icon{display:block;width:24px;height:24px;}
            .rdt-tab-label{display:none;}
            .rdt-tab .rdt-badge{position:absolute;top:3px;right:3px;min-width:15px;height:15px;line-height:15px;font-size:10px !important;font-weight:800;border-radius:8px;background:#ff453a;color:white;padding:0 4px;margin:0;box-shadow:0 1px 4px rgba(0,0,0,0.4);z-index:2;}
            .rdt-tabs-spacer{display:none;}
            .rdt-tab-content{padding-bottom:calc(env(safe-area-inset-bottom,0px) + 30px);}

        }
        @media(max-width:600px) and (prefers-color-scheme:light){
            .rdt-tabs{background:rgba(242,242,247,0.92);box-shadow:0 4px 24px rgba(0,0,0,0.14),0 0.5px 0 rgba(0,0,0,0.08) inset;}
            .rdt-tab{color:rgba(60,60,67,0.38);}
            .rdt-tab.active{color:white;}
        }
        @media(min-width:601px){.rdt-tabs-spacer{display:none;}.rdt-tab-content{}}
        .rdt-stat-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:5px;margin-bottom:8px;}
        @media(max-width:600px){.rdt-stat-grid{grid-template-columns:repeat(2,1fr);}}
        .rdt-date-input{height:40px;border-radius:6px;border:1px solid var(--background-modifier-border);background:var(--background-primary);color:var(--text-normal);padding:0 12px;font-size:14px;box-sizing:border-box;outline:none;transition:border-color 0.15s;-webkit-appearance:none;appearance:none;}
        .rdt-date-input:focus{border-color:var(--interactive-accent);}
        .rdt-date-input::-webkit-calendar-picker-indicator{margin-left:4px;opacity:0.6;cursor:pointer;}
        .rdt-mass-skip{margin-top:12px;border:1px solid var(--background-modifier-border);border-radius:8px;overflow:hidden;}
        .rdt-mass-skip-header{padding:8px 12px;cursor:pointer;display:flex;align-items:center;gap:8px;background:var(--background-primary-alt);font-size:0.85em;font-weight:600;color:var(--text-muted);transition:background 0.15s;user-select:none;}
        .rdt-mass-skip-header:hover{background:var(--background-modifier-hover);}
        .rdt-mass-skip-body{padding:10px 12px;display:none;border-top:1px solid var(--background-modifier-border);}
        .rdt-mass-skip.open .rdt-mass-skip-body{display:block;}
        .rdt-ms-row{display:flex;align-items:center;gap:8px;padding:4px 0;font-size:0.9em;}
        .rdt-ms-row label{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer;}
        .rdt-ms-cb{width:18px;height:18px;cursor:pointer;flex-shrink:0;}

        .rdt-top-panel{margin:0 0 12px 0;padding:10px;border:1px solid var(--background-modifier-border);border-radius:10px;background:var(--background-primary-alt);display:flex;flex-direction:column;gap:8px;}
        .rdt-controls-row{display:grid;grid-template-columns:minmax(140px,180px) minmax(0,1fr) auto;gap:8px;align-items:center;}
        .rdt-date-nav{display:flex;align-items:center;gap:2px;flex-shrink:0;}
        .rdt-date-nav-btn{height:34px;padding:0 10px;border-radius:8px;border:1px solid var(--background-modifier-border);background:var(--background-primary);color:var(--text-muted);font-size:12px;font-weight:700;cursor:pointer;transition:all .16s ease;white-space:nowrap;}
        .rdt-date-nav-btn:hover{border-color:var(--interactive-accent);color:var(--text-normal);}
        .rdt-date-nav-btn.rdt-today-active{background:var(--interactive-accent);color:white;border-color:var(--interactive-accent);}
        .rdt-date-nav-btn.rdt-today-other{color:#ff9800;border-color:#ff9800;}
        @media(max-width:600px){
            .rdt-date-nav{width:100%;}
            .rdt-date-nav-center{flex:1;text-align:center;}
            .rdt-date-nav-btn{height:40px;}
        }
        .rdt-viewing-banner{display:none;padding:5px 12px;background:rgba(255,152,0,0.12);border:1px solid rgba(255,152,0,0.35);border-radius:6px;font-size:0.82em;color:#ff9800;font-weight:600;margin-bottom:6px;text-align:center;}
        .rdt-viewing-banner.active{display:block;}
        .rdt-create-btn{height:36px;border-radius:10px;border:1px solid var(--background-modifier-border);background:var(--background-primary);color:var(--text-normal);font-size:12px;font-weight:700;cursor:pointer;transition:all .16s ease;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:0 10px;}
        .rdt-create-btn:hover{border-color:var(--interactive-accent);background:var(--background-modifier-hover);}
        .rdt-search-input{height:36px;width:100%;border-radius:10px;border:1px solid var(--background-modifier-border);background:var(--background-primary);color:var(--text-normal);padding:0 10px;font-size:12px;font-weight:600;outline:none;box-sizing:border-box;min-width:0;}
        .rdt-search-input:focus{border-color:var(--interactive-accent);}
        .rdt-filter-row{display:flex;align-items:stretch;gap:6px;flex-wrap:wrap;overflow:visible;scrollbar-width:none;}
        .rdt-filter-row::-webkit-scrollbar{display:none;}
        .rdt-filter-chip{min-height:32px;flex:1 1 calc((100% - 24px)/5);min-width:0;padding:5px 8px;border-radius:999px;border:1px solid var(--background-modifier-border);background:var(--background-primary);color:var(--text-muted);font-size:11px;font-weight:700;cursor:pointer;white-space:normal;line-height:1.12;text-align:center;display:flex;align-items:center;justify-content:center;gap:4px;transition:all .16s ease;}
        .rdt-filter-count{display:inline-flex;align-items:center;justify-content:center;background:rgba(100,100,255,0.18);color:var(--interactive-accent);border-radius:999px;font-size:10px;font-weight:800;min-width:16px;height:16px;line-height:16px;padding:0 4px;flex-shrink:0;}
        .rdt-filter-chip:hover{border-color:var(--interactive-accent);color:var(--text-normal);}
        .rdt-filter-chip.active{background:var(--interactive-accent);color:white;border-color:var(--interactive-accent);}
        :root{
            --clr-admit:#4caf50; --clr-plan:#9e9e9e; --clr-treat:#2196f3; --clr-discharge:#ff9800;
            --clr-overdue:#ff5252; --clr-urgent:#ff9800;
            --clr-pf-map:#ab47bc; --clr-pf-contour:#42a5f5; --clr-pf-hosp:#4caf50;
        }
        .rdt-task-card{will-change:opacity, transform, box-shadow;transition:box-shadow 0.15s ease;}
        .rdt-task-card:not(.rdt-hidden):hover{box-shadow:0 2px 10px rgba(0,0,0,0.11);}
        .rdt-task-card.rdt-hidden{display:none !important;}
        .rdt-root.rdt-compact .rdt-top-panel{padding:8px;border-radius:9px;}
        .rdt-root.rdt-compact .rdt-tab{padding:7px 12px;font-size:0.82em;}
        .rdt-root.rdt-compact .rdt-tab .rdt-badge{min-width:16px;height:16px;line-height:16px;font-size:0.7em;}
        .rdt-root.rdt-compact .rdt-create-btn,
        .rdt-root.rdt-compact .rdt-search-input{height:32px;font-size:11px;padding:0 8px;}
        .rdt-root.rdt-compact .rdt-filter-chip{min-height:30px;font-size:10px;padding:4px 7px;}
        .rdt-root.rdt-compact .rdt-stat-grid{grid-template-columns:repeat(2,1fr);}
        .rdt-root.rdt-narrow .rdt-controls-row{grid-template-columns:1fr;gap:6px;}
        .rdt-root.rdt-narrow .rdt-filter-row{gap:4px;}
        .rdt-root.rdt-narrow .rdt-filter-chip{flex-basis:calc((100% - 4px)/2);min-height:34px;border-radius:12px;}
        .rdt-root.rdt-narrow .rdt-search-input{min-width:0;}
        .rdt-root.rdt-narrow .rdt-tab{padding:7px 9px;font-size:0.79em;}
        .rdt-root.rdt-narrow .rdt-op-main,
        .rdt-root.rdt-narrow .rdt-op-title,
        .rdt-root.rdt-narrow .rdt-op-sub,
        .rdt-root.rdt-narrow .rdt-card-name,
        .rdt-root.rdt-narrow .rdt-card-meta-left,
        .rdt-root.rdt-narrow .rdt-card-meta-right{white-space:normal !important;overflow:visible !important;text-overflow:clip !important;}
        .rdt-root.rdt-narrow .rdt-op-meta,
        .rdt-root.rdt-narrow .rdt-card-meta{flex-direction:column !important;align-items:flex-start !important;gap:3px !important;}
        @media(min-width:901px){
            .rdt-top-panel{position:sticky;top:8px;z-index:20;}
            .rdt-tab-content{max-width:1080px;margin:0 auto;}
        }
        @media(max-width:600px){
            .rdt-top-panel{padding:8px 8px;border-radius:9px;}
            .rdt-controls-row{grid-template-columns:1fr;gap:6px;}
            .rdt-create-btn{height:36px;font-size:12px;padding:0 10px;}
            .rdt-search-input{height:36px;font-size:12px;padding:0 10px;}
            .rdt-filter-row{gap:5px;flex-wrap:nowrap;overflow-x:auto;overflow-y:hidden;padding-bottom:2px;-webkit-overflow-scrolling:touch;}
            .rdt-filter-chip,
            .rdt-root.rdt-narrow .rdt-filter-chip{flex:0 0 auto;min-width:max-content;min-height:34px;font-size:10px;padding:5px 10px;border-radius:999px;white-space:nowrap;}
            .rdt-filter-count{font-size:9px;min-width:15px;height:15px;line-height:15px;padding:0 3px;}
        }
        .rdt-filter-bar{display:none;align-items:center;justify-content:space-between;padding:6px 12px;background:var(--background-primary-alt);border:1px solid var(--background-modifier-border);border-radius:8px;margin-bottom:8px;font-size:0.85em;color:var(--text-muted);}
        .rdt-filter-bar.active{display:flex;}
        .rdt-reset-btn{background:none;border:none;color:var(--interactive-accent);cursor:pointer;font-size:0.85em;font-weight:600;padding:2px 8px;border-radius:4px;}
        .rdt-reset-btn:hover{background:var(--background-modifier-hover);}
        .rdt-group-header{display:none;padding:12px 10px 6px;font-size:0.78em;font-weight:800;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.08em;margin-top:8px;border-radius:6px 6px 0 0;background:var(--background-primary-alt);border:1px solid var(--background-modifier-border);border-bottom:none;}
        .rdt-group-header.visible{display:block;}
        .rdt-group-header.visible + .rdt-tab-content .rdt-task-card:last-child{border-radius:0 0 6px 6px;}
    `;
    document.head.appendChild(_ts);
}

const TAB_KEY = 'rdt-active-tab';
const FILTER_PRESET_KEY = 'rdt-filter-preset';
const FILTER_QUERY_KEY = 'rdt-filter-query';
let activeTab = 'operativka';
try { activeTab = localStorage.getItem(TAB_KEY) || 'operativka'; } catch (e) { }

_pfSetBootStatus("инициализация интерфейса");
markPhase("boot");

if (typeof window.__rdtCompactCleanup === "function") {
    try { window.__rdtCompactCleanup(); } catch (e) { }
}
let __rdtCompactRaf = 0;
const _applyCompactByWidth = () => {
    const w = Math.round((root.getBoundingClientRect()?.width || root.clientWidth || window.innerWidth));
    root.classList.toggle("rdt-compact", w <= 760);
    root.classList.toggle("rdt-narrow", w <= 620);
};
const _onCompactResize = () => {
    if (__rdtCompactRaf) return;
    __rdtCompactRaf = requestAnimationFrame(() => {
        __rdtCompactRaf = 0;
        _applyCompactByWidth();
    });
};
let __rdtCompactRO = null;
try {
    __rdtCompactRO = new ResizeObserver(_onCompactResize);
    __rdtCompactRO.observe(root);
} catch (e) { }
window.addEventListener("resize", _onCompactResize, { passive: true });
_applyCompactByWidth();
window.__rdtCompactCleanup = () => {
    try { window.removeEventListener("resize", _onCompactResize); } catch (e) { }
    try { if (__rdtCompactRO) __rdtCompactRO.disconnect(); } catch (e) { }
    try { if (__rdtCompactRaf) cancelAnimationFrame(__rdtCompactRaf); } catch (e) { }
};

// Подсчёт бейджей для вкладок
const tabCounts = _pfDesktopCore.getDesktopTabCounts({
    activeReminderCount,
    consultations,
    starts,
    ends,
    contourPlan,
    markups,
    reMarkups,
    overdueReMarkups,
    overdueAdmissions,
    elnVkItems,
    reContours,
    listMarkup,
    listReMarkup,
    listContour,
    listWaiting,
    listTreatment,
    dischargeData
});
const opCount = tabCounts.operativka;
const planCount = tabCounts.planning;
const treatCount = tabCounts.treatment;
const dischCount = tabCounts.discharge;

const TAB_ICONS = {
    operativka: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>`,
    planning: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
    treatment: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>`,
    discharge: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`,
};
const TABS = [
    { id: 'operativka', label: 'Оперативка', count: opCount },
    { id: 'planning', label: 'Планирование', count: planCount },
    { id: 'treatment', label: 'Лечение', count: treatCount },
    { id: 'discharge', label: 'Выписка', count: dischCount },
];
const TAB_IDS = TABS.map(t => t.id);
if (!TAB_IDS.includes(activeTab)) activeTab = 'operativka';
if (_dateOffset === 0) {
    const activeTabHasCards = (TABS.find(t => t.id === activeTab)?.count || 0) > 0;
    if (!activeTabHasCards && opCount > 0) {
        activeTab = "operativka";
        try { localStorage.setItem(TAB_KEY, activeTab); } catch (e) { }
    }
}
const TAB_LABELS = Object.fromEntries(TABS.map(t => [t.id, t.label]));
const groupHeaders = {};

const tabBar = root.createEl("div", { cls: "rdt-tabs" });
const tabContainers = {};
let applyCardFilter = () => { };
let activeFilterPreset = "all";
try { activeFilterPreset = localStorage.getItem(FILTER_PRESET_KEY) || "all"; } catch (e) { }
let _desktopAutoResetFilterPresetDone = false;

// Скользящий индикатор (только мобайл)
let _indicator = null;
if (window.innerWidth <= 600) _indicator = tabBar.createEl("div", { cls: "rdt-tabs-indicator" });

const switchTab = (toId) => {
    if (!TAB_IDS.includes(toId)) return;

    tabBar.querySelectorAll('.rdt-tab').forEach(b => {
        b.classList.remove('active');
        b.style.background = '';
    });
    const activeBtn = tabBar.querySelector(`[data-tab="${toId}"]`);
    if (activeBtn) {
        activeBtn.classList.add('active');
        activeBtn.style.background = 'var(--interactive-accent)';
        if (_indicator) {
            _indicator.style.left = activeBtn.offsetLeft + 'px';
            _indicator.style.width = activeBtn.offsetWidth + 'px';
            _indicator.style.top = activeBtn.offsetTop + 'px';
            _indicator.style.height = activeBtn.offsetHeight + 'px';
        }
    }

    Object.entries(tabContainers).forEach(([id, c]) => {
        c.style.display = id === toId ? 'block' : 'none';
    });

    activeTab = toId;
    try { localStorage.setItem(TAB_KEY, toId); } catch (e) { }
    applyCardFilter();
};

const _sanitizeFileName = (name) => _pfDesktopCore.sanitizeFileName(name);
const _yearsWord = (n) => _pfDesktopCore.yearsWord(n);
const _calcAgeFromDobIso = (dobIso) => _pfDesktopCore.calcAgeFromDobIso(dobIso, dv.date("today")?.toISODate?.());
const _fundMarkFromGroup = (raw) => _pfDesktopCore.fundMarkFromGroup(raw);
const _buildPatientFileBaseName = ({ fio, dobIso, mkb10, vmpGroup }) => _pfDesktopCore.buildPatientFileBaseName({
    fio,
    dobIso,
    mkb10,
    vmpGroup,
    todayIso: dv.date("today")?.toISODate?.()
});

// ── Этап 1 глобального редизайна: центр дня + быстрые действия ────────────
markPhase("render");
if (_pfBootStatus.parentNode === root) _pfBootStatus.remove();
if (_pfModelErrors.length) {
    const errBanner = root.createEl("div");
    errBanner.style.cssText = "padding:10px 12px;margin-bottom:8px;border:1px solid rgba(255,152,0,0.45);border-radius:8px;background:rgba(255,152,0,0.10);color:#ff9800;font-size:12px;line-height:1.45;white-space:pre-wrap;";
    const firstErrors = _pfModelErrors.slice(0, 5).map(item => `- ${item.name}: ${item.message}`).join("\n");
    errBanner.textContent = `Часть карточек пациентов пропущена из-за ошибки расчёта (${_pfModelErrors.length}).\n${firstErrors}${_pfModelErrors.length > 5 ? "\n..." : ""}`;
}
const topPanel = root.createEl("div", { cls: "rdt-top-panel" });
root.insertBefore(topPanel, tabBar);

const filterResultBar = root.createEl("div", { cls: "rdt-filter-bar" });
root.insertBefore(filterResultBar, tabBar);
const filterResultCount = filterResultBar.createEl("span");
filterResultCount.textContent = "Найдено: 0";
const resetFilterBtn = filterResultBar.createEl("button", { cls: "rdt-reset-btn" });
resetFilterBtn.textContent = "🔄 Сбросить";
resetFilterBtn.onclick = () => { filterInput.value = ""; try { localStorage.setItem(FILTER_QUERY_KEY, ""); } catch (e) { } _setActivePreset("all"); };

const controlsRow = topPanel.createEl("div", { cls: "rdt-controls-row" });
const createPatientBtn = controlsRow.createEl("button", { cls: "rdt-create-btn" });
createPatientBtn.textContent = "➕ Пациент";
createPatientBtn.onclick = () => _pfDesktopNewPatient.createPatientNote();

const filterInput = controlsRow.createEl("input", { cls: "rdt-search-input" });
filterInput.type = "text";
filterInput.placeholder = "Поиск по ФИО / задаче";
try { filterInput.value = localStorage.getItem(FILTER_QUERY_KEY) || ""; } catch (e) { }

// ── Навигация по дате ──────────────────────────────────────────
const dateNavDiv = controlsRow.createEl("div", { cls: "rdt-date-nav" });
const _navPrev = dateNavDiv.createEl("button", { cls: "rdt-date-nav-btn" });
_navPrev.textContent = "←";
_navPrev.title = "Предыдущий день";
const _navToday = dateNavDiv.createEl("button", { cls: "rdt-date-nav-btn rdt-date-nav-center" + (_dateOffset === 0 ? " rdt-today-active" : " rdt-today-other") });
_navToday.textContent = _dateOffset === 0 ? "Сегодня" : today.toFormat("dd.MM");
_navToday.title = _dateOffset === 0 ? "Вы смотрите сегодня" : `Просмотр: ${today.toFormat("dd.MM.yyyy")} · Нажмите для возврата`;
const _navNext = dateNavDiv.createEl("button", { cls: "rdt-date-nav-btn" });
_navNext.textContent = "→";
_navNext.title = "Следующий день";

const _navDate = async (newOffset) => {
    try { localStorage.setItem(DATE_OFFSET_KEY, String(newOffset)); } catch(e) {}
    const leaf = app.workspace.activeLeaf;
    const file = app.workspace.getActiveFile();
    if (!leaf || !file) return;
    await leaf.setViewState({ type: 'empty' });
    await leaf.openFile(file, { active: true });
};
_navPrev.onclick  = () => _navDate(_dateOffset - 1);
_navNext.onclick  = () => _navDate(_dateOffset + 1);

// ── Календарь-попап ────────────────────────────────────────────
_navToday.title = "Выбрать дату";
let _calMonth = today.startOf("month");
const calPopup = document.body.createEl("div");
calPopup.className = "rdt-calendar-popup";
calPopup.style.cssText = "display:none;position:fixed;z-index:9999;background:var(--background-primary);border:1px solid var(--background-modifier-border);border-radius:10px;box-shadow:0 10px 30px rgba(0,0,0,.35);padding:10px;min-width:230px;";
const _monthNames = ["январь","февраль","март","апрель","май","июнь","июль","август","сентябрь","октябрь","ноябрь","декабрь"];
const _renderCal = () => {
    calPopup.empty();
    const head = calPopup.createEl("div");
    head.style.cssText = "display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px;";
    const prevM = head.createEl("button", { text: "‹" });
    const title = head.createEl("b", { text: `${_monthNames[_calMonth.month - 1]} ${_calMonth.year}` });
    title.style.cssText = "font-size:12px;text-transform:capitalize;";
    const nextM = head.createEl("button", { text: "›" });
    [prevM,nextM].forEach(b => b.style.cssText = "border:1px solid var(--background-modifier-border);background:var(--background-secondary);border-radius:6px;padding:2px 8px;cursor:pointer;");
    prevM.onclick = (e) => { e.stopPropagation(); _calMonth = _calMonth.minus({ months: 1 }); _renderCal(); };
    nextM.onclick = (e) => { e.stopPropagation(); _calMonth = _calMonth.plus({ months: 1 }); _renderCal(); };

    const week = calPopup.createEl("div");
    week.style.cssText = "display:grid;grid-template-columns:repeat(7,1fr);gap:3px;margin-bottom:3px;color:var(--text-muted);font-size:10px;text-align:center;";
    ["Пн","Вт","Ср","Чт","Пт","Сб","Вс"].forEach(d => week.createEl("div", { text: d }));

    const grid = calPopup.createEl("div");
    grid.style.cssText = "display:grid;grid-template-columns:repeat(7,1fr);gap:3px;";
    const first = _calMonth.startOf("month");
    const daysInMonth = _calMonth.daysInMonth;
    const startPad = (first.weekday + 6) % 7;
    for (let i = 0; i < startPad; i++) grid.createEl("div");
    for (let d = 1; d <= daysInMonth; d++) {
        const date = _calMonth.set({ day: d });
        const btn = grid.createEl("button", { text: String(d) });
        const isSelected = date.hasSame(today, "day");
        const isRealToday = date.hasSame(_realToday, "day");
        btn.style.cssText = "height:28px;border-radius:7px;border:1px solid var(--background-modifier-border);background:var(--background-primary);color:var(--text-normal);font-size:11px;cursor:pointer;";
        if (isRealToday) btn.style.borderColor = "var(--interactive-accent)";
        if (isSelected) {
            btn.style.background = "var(--interactive-accent)";
            btn.style.color = "white";
        }
        btn.onclick = (e) => {
            e.stopPropagation();
            const diff = Math.round(date.startOf("day").diff(_realToday.startOf("day"), "days").days);
            _navDate(diff);
        };
    }
};
const _positionCal = () => {
    const r = _navToday.getBoundingClientRect();
    calPopup.style.top = `${Math.min(window.innerHeight - 260, r.bottom + 6)}px`;
    calPopup.style.left = `${Math.max(8, Math.min(window.innerWidth - 250, r.left))}px`;
};
_navToday.onclick = (e) => {
    e.stopPropagation();
    _calMonth = today.startOf("month");
    _renderCal();
    _positionCal();
    calPopup.style.display = calPopup.style.display === "none" ? "block" : "none";
};
document.addEventListener("click", function _rdtCloseCal(e) {
    if (calPopup.style.display !== "none" && !calPopup.contains(e.target) && e.target !== _navToday) {
        calPopup.style.display = "none";
    }
}, true);

// Баннер "Вы просматриваете другую дату"
const viewingBanner = root.createEl("div", { cls: "rdt-viewing-banner" });
if (_dateOffset !== 0) {
    viewingBanner.classList.add("active");
    const _dayLabel = _dateOffset === -1 ? "Вчера" : _dateOffset === 1 ? "Завтра" : today.toFormat("dd.MM.yyyy");
    viewingBanner.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:4px;"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> Просмотр: <b>${_dayLabel} (${today.toFormat("dd.MM.yyyy")})</b>`;
    const _backLink = viewingBanner.createEl("a", { text: " · Вернуться к сегодня" });
    _backLink.href = "#";
    _backLink.style.cssText = "color:#ff9800;text-decoration:underline;margin-left:4px;";
    _backLink.onclick = (e) => { e.preventDefault(); _navDate(0); };
}
root.insertBefore(viewingBanner, tabBar);

// Фильтры
const filterRow = topPanel.createEl("div", { cls: "rdt-filter-row" });
const filterPresetDefs = [
    { id: "ds", label: "ДС" },
    { id: "ks", label: "КС" },
    { id: "eln", label: "ЭЛН" },
    { id: "vk", label: "ВК" },
    { id: "contour", label: "Контур" },
    { id: "markup", label: "Разметка" },
    { id: "consult", label: "Консультации" },
    { id: "hlt", label: "ХЛТ" },
    { id: "fraction_today", label: "Фракция сегодня" },
    { id: "overdue", label: "Просрочено" },
];
const filterPresetBtns = new Map();
const _matchPreset = (txt, presetId) => _pfDesktopCore.matchPreset(txt, presetId);
const _getCardFilterText = (card) => _pfDesktopCore.getCardFilterText(card);
const _presetAllowsCard = (card, presetId) => _pfDesktopCore.presetAllowsCard(card, presetId);
const _cardMatchesFilter = (card, presetId, query = "", isFiltering = true) => _pfDesktopCore.cardMatchesFilter(card, presetId, query, isFiltering);
const _getCardDedupeKey = (card) => _pfDesktopCore.getCardDedupeKey(card);
const _setActivePreset = (id) => {
    activeFilterPreset = id;
    try { localStorage.setItem(FILTER_PRESET_KEY, id); } catch (e) { }
    filterPresetBtns.forEach((btn, key) => {
        const isActive = key === id;
        btn.classList.toggle("active", isActive);
        const badge = btn.querySelector(".rdt-filter-count");
        if (badge) {
            badge.style.background = isActive ? "rgba(255,255,255,0.25)" : "rgba(100,100,255,0.18)";
            badge.style.color = isActive ? "white" : "var(--interactive-accent)";
        }
    });
    applyCardFilter();
};
filterPresetDefs.forEach(def => {
    const b = filterRow.createEl("button", { cls: "rdt-filter-chip" });
    b.textContent = def.label;
    b.onclick = () => _setActivePreset(def.id);
    filterPresetBtns.set(def.id, b);
});


applyCardFilter = () => {
    const q = String(filterInput.value || "").trim().toLowerCase();
    const isFiltering = q || activeFilterPreset !== "all";
    const _syncSectionHeaders = (cont) => {
        if (!cont) return;
        const children = Array.from(cont.children);
        for (let i = 0; i < children.length; i++) {
            const el = children[i];
            if (!el.classList.contains("rdt-section-head")) continue;
            let j = i + 1, hasVisibleCard = false;
            while (j < children.length && !children[j].classList.contains("rdt-section-head")) {
                if (children[j].classList.contains("rdt-task-card") && !children[j].classList.contains("rdt-hidden")) hasVisibleCard = true;
                j++;
            }
            el.style.display = hasVisibleCard ? "" : "none";
            if (i > 0 && children[i - 1].classList.contains("rdt-spacer")) children[i - 1].style.display = hasVisibleCard ? "" : "none";
        }
    };

    let totalVisible = 0;
    const tabVis = {};
    TABS.forEach(({ id }) => {
        const cont = tabContainers[id];
        if (!cont) { tabVis[id] = false; return; }
        let hasVisible = false;
        cont.querySelectorAll(".rdt-task-card").forEach(card => {
            const show = _cardMatchesFilter(card, activeFilterPreset, q, isFiltering);
            card.classList.toggle("rdt-hidden", !show);
            if (show) hasVisible = true;
        });
        tabVis[id] = hasVisible;
        if (hasVisible) totalVisible += cont.querySelectorAll(".rdt-task-card:not(.rdt-hidden)").length;
        _syncSectionHeaders(cont);
    });

    // Дедупликация: при фильтрации один пациент показывается только в первой вкладке (приоритет: Оперативка ? Планирование ? ...)
    if (isFiltering) {
        const _seenKeys = new Set();
        TABS.forEach(({ id }) => {
            const cont = tabContainers[id];
            if (!cont) return;
            cont.querySelectorAll(".rdt-task-card:not(.rdt-hidden)").forEach(card => {
                const key = _getCardDedupeKey(card);
                if (!key) return;
                if (_seenKeys.has(key)) {
                    card.classList.add("rdt-hidden");
                } else {
                    _seenKeys.add(key);
                }
            });
        });
        TABS.forEach(({ id }) => _syncSectionHeaders(tabContainers[id]));
        // Пересчитать hasVisible и tabVis после дедупликации
        TABS.forEach(({ id }) => {
            const cont = tabContainers[id];
            if (!cont) return;
            tabVis[id] = cont.querySelectorAll(".rdt-task-card:not(.rdt-hidden)").length > 0;
        });
        totalVisible = 0;
        TABS.forEach(({ id }) => {
            const cont = tabContainers[id];
            if (cont && tabVis[id]) totalVisible += cont.querySelectorAll(".rdt-task-card:not(.rdt-hidden)").length;
        });
    }

    const _statGrid = tabContainers.operativka?.querySelector('.rdt-stat-grid');
    if (isFiltering) {
        tabBar.style.display = "none";
        if (_statGrid) _statGrid.style.display = "none";
        filterResultBar.classList.add("active");
        const _breakdown = TABS
            .filter(({ id }) => tabVis[id])
            .map(({ id, label }) => {
                const n = tabContainers[id]?.querySelectorAll(".rdt-task-card:not(.rdt-hidden)").length || 0;
                return `${label}: ${n}`;
            }).join(" · ");
        filterResultCount.innerHTML = `<b>${totalVisible}</b> <span style="color:var(--text-faint);font-size:0.9em;">${_breakdown ? `(${_breakdown})` : ""}</span>`;
        TABS.forEach(({ id }) => {
            const cont = tabContainers[id];
            if (cont) cont.style.display = tabVis[id] ? "block" : "none";
        });
    } else {
        tabBar.style.display = "";
        if (_statGrid) _statGrid.style.display = "";
        filterResultBar.classList.remove("active");
        TABS.forEach(({ id }) => {
            const cont = tabContainers[id];
            const gh = groupHeaders[id];
            if (cont) cont.style.display = id === activeTab ? "block" : "none";
            if (gh) gh.classList.remove("visible");
        });
    }

    const totalCards = TABS.reduce((sum, { id }) => {
        const cont = tabContainers[id];
        return sum + (cont ? cont.querySelectorAll(".rdt-task-card").length : 0);
    }, 0);
    if (!q && activeFilterPreset !== "all" && totalCards > 0 && totalVisible === 0 && !_desktopAutoResetFilterPresetDone) {
        _desktopAutoResetFilterPresetDone = true;
        try { localStorage.setItem(FILTER_PRESET_KEY, "all"); } catch (e) { }
        activeFilterPreset = "all";
        filterPresetBtns.forEach((btn, key) => {
            const isActive = key === "all";
            btn.classList.toggle("active", isActive);
            const badge = btn.querySelector(".rdt-filter-count");
            if (badge) {
                badge.style.background = isActive ? "rgba(255,255,255,0.25)" : "rgba(100,100,255,0.18)";
                badge.style.color = isActive ? "white" : "var(--interactive-accent)";
            }
        });
        applyCardFilter();
        return;
    }

    // Empty-state сообщения
    TABS.forEach(({ id }) => {
        const cont = tabContainers[id];
        if (!cont) return;
        const _existing = cont.querySelector('.rdt-empty-state');
        const _visibleCards = cont.querySelectorAll('.rdt-task-card:not(.rdt-hidden)').length;
        if (_visibleCards === 0 && (cont.style.display === "" || cont.style.display === "block")) {
            if (!_existing) {
                const _empty = document.createElement('div');
                _empty.className = 'rdt-empty-state';
                _empty.style.cssText = 'text-align:center;padding:40px 20px;color:var(--text-muted);font-size:0.85em;line-height:1.5;';
                _empty.textContent = isFiltering ? 'Ничего не найдено' : 'Нет задач';
                cont.appendChild(_empty);
            }
        } else if (_existing) {
            _existing.remove();
        }
    });
};
filterInput.oninput = () => { try { localStorage.setItem(FILTER_QUERY_KEY, filterInput.value); } catch (e) { } applyCardFilter(); };

TABS.forEach(t => {
    const btn = tabBar.createEl("div", { cls: `rdt-tab${t.id === activeTab ? ' active' : ''}` });
    btn.innerHTML = `<span class="rdt-tab-icon">${TAB_ICONS[t.id]}</span><span class="rdt-tab-label">${t.label}</span>${t.count > 0 ? `<span class="rdt-badge">${t.count}</span>` : ''}`;
    btn.dataset.tab = t.id;
    if (t.id === activeTab) btn.style.background = 'var(--interactive-accent)';

    const gh = root.createEl("div", { cls: "rdt-group-header" });
    gh.textContent = TAB_LABELS[t.id] || t.label;
    groupHeaders[t.id] = gh;

    const cont = root.createEl("div", { cls: "rdt-tab-content" });
    cont.style.display = t.id === activeTab ? "block" : "none";
    tabContainers[t.id] = cont;

    btn.onclick = () => switchTab(t.id);
});

// Позиция индикатора при старте (после рендера кнопок)
requestAnimationFrame(() => {
    if (!_indicator) return;
    const activeBtn = tabBar.querySelector(`[data-tab="${activeTab}"]`);
    if (!activeBtn) return;
    _indicator.style.transition = 'none';
    _indicator.style.left = activeBtn.offsetLeft + 'px';
    _indicator.style.width = activeBtn.offsetWidth + 'px';
    _indicator.style.top = activeBtn.offsetTop + 'px';
    _indicator.style.height = activeBtn.offsetHeight + 'px';
    requestAnimationFrame(() => { _indicator.style.transition = ''; });
});
// ── СИНХРОНИЗАЦИЯ ПОЗИЦИИ С ТУЛБАРОМ OBSIDIAN (optimized) ────?
if (typeof window.__rdtMobileNavSyncCleanup === "function") {
    try { window.__rdtMobileNavSyncCleanup(); } catch (e) { }
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
        const _hideY = _tbH + _safeBottom + PILL_BOTTOM_OFFSET + 20;
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
            tabBar.style.transition = `transform ${dur} ${fn} ${del}, opacity ${dur} ${fn} ${del}`;
        };

        const _isEditableEl = (el) => {
            if (!el || !(el instanceof HTMLElement)) return false;
            if (el.isContentEditable) return true;
            const tag = String(el.tagName || "").toLowerCase();
            if (tag === "textarea") return true;
            if (tag !== "input") return false;
            const t = String(el.type || "text").toLowerCase();
            return !["button", "submit", "reset", "checkbox", "radio", "range", "color", "file", "image", "hidden"].includes(t);
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
            tabBar.style.transform = `translate3d(-50%, ${ty.toFixed(2)}px, 0)`;
            tabBar.style.opacity = keyboardOpen ? "0" : "1";
            tabBar.style.pointerEvents = keyboardOpen ? "none" : "auto";
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

        window.__rdtMobileNavSyncCleanup = () => {
            try { _obsBar.removeEventListener('transitionrun', _onNavTransition); } catch (e) { }
            try { _obsBar.removeEventListener('transitionstart', _onNavTransition); } catch (e) { }
            try { _obsBar.removeEventListener('transitionend', _onWindow); } catch (e) { }
            try { _obsBar.removeEventListener('transitioncancel', _onWindow); } catch (e) { }
            try { window.removeEventListener('resize', _onWindow); } catch (e) { }
            try { window.removeEventListener('orientationchange', _onNavTransition); } catch (e) { }
            try { document.removeEventListener('focusin', _onFocusIn, true); } catch (e) { }
            try { document.removeEventListener('focusout', _onFocusOut, true); } catch (e) { }
            try { if (_vv) _vv.removeEventListener('resize', _onWindow); } catch (e) { }
            try { if (_vv) _vv.removeEventListener('scroll', _onWindow); } catch (e) { }
            try { if (_scroller && _scroller.removeEventListener) _scroller.removeEventListener('scroll', _onWindow); } catch (e) { }
            try { _mo.disconnect(); } catch (e) { }
            try { if (_raf) cancelAnimationFrame(_raf); } catch (e) { }
        };
    }
}

// ── РЕНДЕРИНГ (делегировано) ─────────────────────────────────────────────
    if (window._pfDesktopRender && typeof window._pfDesktopRender.buildDesktopRender === "function") {
        const renderResult = await window._pfDesktopRender.buildDesktopRender({
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
        });
    } else {
        console.warn("window._pfDesktopRender not found");
    }

// ── Счётчики на кнопках фильтров ──────────────────────────────────────────
if (window._pfDesktopDischarge && typeof window._pfDesktopDischarge.renderDesktopDischargeTab === "function") {
    await window._pfDesktopDischarge.renderDesktopDischargeTab({
        tab: tabContainers.discharge,
        state: _desktopDischargeState,
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
        notice: _pfDesktopPlatform.notice
    });
} else {
    console.warn("window._pfDesktopDischarge not found");
}

// ── Счётчики на кнопках фильтров ──────────────────────────────────────────
requestAnimationFrame(() => {
    const _seenKeys = new Set();
    const uniqueCards = [];
    TABS.forEach(({ id }) => {
        const cont = tabContainers[id];
        if (!cont) return;
        cont.querySelectorAll(".rdt-task-card").forEach(card => {
            const key = _getCardDedupeKey(card);
            if (key && _seenKeys.has(key)) return;
            if (key) _seenKeys.add(key);
            uniqueCards.push(card);
        });
    });
    filterPresetDefs.forEach(def => {
        if (def.id === "all") return;
        const count = uniqueCards.filter(card => _cardMatchesFilter(card, def.id, "", true)).length;
        const btn = filterPresetBtns.get(def.id);
        if (!btn) return;
        btn.style.opacity = count === 0 ? "0.4" : "";
        if (count > 0) {
            const badge = document.createElement("span");
            badge.className = "rdt-filter-count";
            badge.textContent = String(count);
            btn.textContent = def.label;
            btn.appendChild(badge);
        }
    });
    // Восстанавливаем сохранённый фильтр после рендера карточек
    if (activeFilterPreset && activeFilterPreset !== "all") _setActivePreset(activeFilterPreset);
    else applyCardFilter();
});
