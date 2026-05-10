"use strict";

const requireOptional = (path) => {
  try {
    if (typeof require === "function") return require(path);
  } catch (_) {}
  return null;
};

const createDesktopNewPatientRuntime = (deps = {}) => {
  const {
    dv = globalThis.dv,
    app = globalThis.app,
    window = globalThis.window,
    document = globalThis.document,
    _pfDesktopCore,
    _pfDesktopPlatform,
    _pfDiagnosisCore,
    normalizeConn = (raw) => String(raw || ""),
    _pfDesktopParserUi,
    _pfDesktopClinicalSection,
    _pfDesktopHlt,
    _pfDesktopTreatmentVolumes,
    _pfPatientAcceleratorCore = null,
    _pfPatientNoteCore,
    _pfPatientTransferCore = requireOptional("./patient-transfer-core.cjs")
      || (typeof globalThis !== "undefined" ? globalThis._pfPatientTransferCore : null),
    _dbResolvePatientId,
    _dbMergeDiagnosisText,
    _dbNormalizeHistoryText,
    _dbNormalizeDrugNames,
    _dbNormalizeDiagnosisText
  } = deps;

  if (!dv?.date) throw new Error("createDesktopNewPatientRuntime: dv is required");
  if (!document) throw new Error("createDesktopNewPatientRuntime: document is required");
  if (!_pfDesktopCore) throw new Error("createDesktopNewPatientRuntime: _pfDesktopCore is required");
  if (!_pfDesktopPlatform) throw new Error("createDesktopNewPatientRuntime: _pfDesktopPlatform is required");
  if (!_pfDiagnosisCore) throw new Error("createDesktopNewPatientRuntime: _pfDiagnosisCore is required");
  if (!_pfDesktopParserUi) throw new Error("createDesktopNewPatientRuntime: _pfDesktopParserUi is required");
  if (!_pfDesktopClinicalSection) throw new Error("createDesktopNewPatientRuntime: _pfDesktopClinicalSection is required");
  if (!_pfDesktopHlt) throw new Error("createDesktopNewPatientRuntime: _pfDesktopHlt is required");
  if (!_pfDesktopTreatmentVolumes) throw new Error("createDesktopNewPatientRuntime: _pfDesktopTreatmentVolumes is required");
  if (!_pfPatientNoteCore) throw new Error("createDesktopNewPatientRuntime: _pfPatientNoteCore is required");
  if (!_pfPatientTransferCore) throw new Error("createDesktopNewPatientRuntime: _pfPatientTransferCore is required");
  if (typeof _dbResolvePatientId !== "function") throw new Error("createDesktopNewPatientRuntime: _dbResolvePatientId is required");

  if (window) {
    window._pfDesktopParserUi = _pfDesktopParserUi;
    window._pfDesktopClinicalSection = _pfDesktopClinicalSection;
    window._pfDesktopHlt = _pfDesktopHlt;
    window._pfDesktopTreatmentVolumes = _pfDesktopTreatmentVolumes;
    window._pfPatientAcceleratorCore = _pfPatientAcceleratorCore;
    window._pfPatientNoteCore = _pfPatientNoteCore;
    window._pfPatientTransferCore = _pfPatientTransferCore;
  }

  const TRANSFER_DOCTORS_PATH = "Архив/Врачи.md";
  const TRANSFER_ADD_DOCTOR_VALUE = "__pf_add_transfer_doctor__";

  const _npBuildDoctorsMarkdown = (doctors = []) => {
    const list = _pfPatientTransferCore.sortDoctors(doctors);
    return `# Врачи\n\n${list.map(name => `- ${name}`).join("\n")}\n`;
  };

  const _npLoadTransferDoctors = async () => {
    try {
      const source = await dv.io.load(TRANSFER_DOCTORS_PATH);
      const parsed = _pfPatientTransferCore.parseDoctorsMarkdown(source || "");
      if (parsed.length > 0) return _pfPatientTransferCore.sortDoctors(parsed);
    } catch (_) {}
    return _pfPatientTransferCore.DEFAULT_DOCTORS.slice();
  };

  const _npWriteTransferDoctors = async (doctors = []) => {
    const content = _npBuildDoctorsMarkdown(doctors);
    if (app?.vault?.adapter?.write) {
      await app.vault.adapter.write(TRANSFER_DOCTORS_PATH, content);
      return;
    }
    const file = app?.vault?.getAbstractFileByPath?.(TRANSFER_DOCTORS_PATH);
    if (file && app?.vault?.modify) {
      await app.vault.modify(file, content);
    }
  };

  const _npEnsureTransferDoctor = async (name = "") => {
    const normalized = _pfPatientTransferCore.normalizeDoctorName(name);
    if (!normalized) return "";
    const doctors = _pfPatientTransferCore.ensureDoctor(await _npLoadTransferDoctors(), normalized);
    await _npWriteTransferDoctors(doctors);
    return normalized;
  };

  const NEW_PATIENT_ANAM_FIELDS = [
      ["Решение консилиума", "Решение_консилиума"],  
      ["Жалобы", "Жалобы"],  
      ["Анамнез заболевания", "Анамнез_заболевания"],  
      ["Анамнез жизни", "Анамнез_жизни"],  
      ["Описания исследований", "Описания_исследований"],  
      ["Сопутствующие заболевания", "Сопутствующие_заболевания"],  
  ];  
    
  const NEW_PATIENT_ECOG_KEY = "ECOG_статус";  
  const NEW_PATIENT_ECOG_OPTS = ["0", "1", "2", "3", "4"];  
    
  const _npNormalizeEcog = (raw) => _pfDiagnosisCore.normalizeEcog(raw);  
    
  const _npMatchEcogInText = (text) => _pfDiagnosisCore.matchEcogInText(text);  
    
  const _npExtractEcogFromText = (text) => _npMatchEcogInText(text)?.value ?? null;  
    
  const _npNormalizeLabDateKey = (raw) => _pfDesktopCore.normalizeLabDateKey(raw, (value) => {  
      if (typeof dv === "undefined" || !dv?.date) return null;  
      return dv.date(value);  
  });  
    
  const _openNewPatientEditorModal = () => new Promise((resolve) => {  
      const MODAL_ID = "rdt-new-patient-modal-v2";  
      { const prev = document.getElementById(MODAL_ID); if (prev) prev.remove(); }  
    
      // ── Draft: все сохранения идут в этот объект ──────────────────────────────  
      const draft = {};  
      const ls = draft;  
      const saveNow = (updates) => { Object.assign(draft, updates); return Promise.resolve(); };  
      const saveLater = (key, val) => { draft[key] = val; };  
      const setPending = (key, val) => { draft[key] = val; };  
      const getVal = (key) => draft.hasOwnProperty(key) ? draft[key] : null;  
    
      // ── Вспомогательные функции черновика редактора ─────────────────────────  
      const _npNormalizeDateIso = (value) => value ? (dv.date(value)?.toFormat("yyyy-MM-dd") || "") : "";  
      const _npToLsUiDuration = (term, days) => _pfDesktopCore.getMedicationTermUiLabel(term, days);  
      const _npToLsTerm = (uiVal) => _pfDesktopCore.parseMedicationTerm(uiVal);  
      const _npNormalizeLsAssignments = (pageObj) => _pfDesktopCore.normalizeMedicationAssignments(pageObj, {  
          normalizeDate: _npNormalizeDateIso  
      });  
      const _npDedupLsAssignments = (arr) => _pfDesktopCore.dedupeMedicationAssignments(arr);  
    
      // ── Global CSS для полей дат ──────────────────────────────────────────────  
      if (!document.getElementById('pf-global-date-style')) {  
          const _gs = document.createElement('style');  
          _gs.id = 'pf-global-date-style';  
          _gs.textContent = `  
              input[type="date"].pf-date-field,input[type="datetime-local"].pf-date-field{display:flex!important;align-items:center!important;-webkit-appearance:none!important;appearance:none!important;padding:0 12px!important;height:40px!important;}  
              input[type="date"].pf-date-field::-webkit-date-and-time-value,input[type="datetime-local"].pf-date-field::-webkit-date-and-time-value{text-align:left!important;margin:0!important;}  
              input[type="date"].pf-date-field:focus,input[type="datetime-local"].pf-date-field:focus{border-color:var(--interactive-accent)!important;outline:none!important;}`;  
          document.head.appendChild(_gs);  
      }  
    
      // ── makeDatePicker ────────────────────────────────────────────────────────  
      const _npMakeDatePicker = (parent, initISO, extraStyle = "", isDateTime = false, timeOpts = {}) => {  
          const BASE = `height:40px;border-radius:6px;border:1px solid var(--background-modifier-border);font-family:var(--font-interface);font-size:14px;box-sizing:border-box;background:var(--background-primary);color:var(--text-normal);outline:none;transition:border-color 0.15s;`;  
          const _dpId = "dp-" + Math.random().toString(36).slice(2, 9);  
          const wrapper = document.createElement("div");  
          wrapper.style.cssText = `position:relative;display:flex;align-items:center;${extraStyle}`;  
          parent.appendChild(wrapper);  
          const hidden = document.createElement("input");  
          hidden.type = "date"; hidden.id = _dpId;  
          hidden.style.cssText = "position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);border:0;outline:none;pointer-events:none;background:transparent;";  
          wrapper.appendChild(hidden);  
          const txt = document.createElement("input");  
          txt.type = "text"; txt.inputMode = "numeric";  
          txt.placeholder = "дд.мм.гггг";  
          txt.autocomplete = "off";  
          txt.style.cssText = isDateTime  
              ? BASE + `flex:1;min-width:0;padding:0 12px;border-radius:6px 0 0 6px;border-right:none;`  
              : BASE + `flex:1;min-width:0;padding:0 40px 0 12px;`;  
          wrapper.appendChild(txt);  
          let timeSel = null;  
          const _tsListeners = [];  
          const tsStep = (timeOpts && timeOpts.step) || 30;  
          const tsMin = (timeOpts && timeOpts.minTime) || "00:00";  
          const tsMax = (timeOpts && timeOpts.maxTime) || "23:30";  
          const ico = document.createElement("label");  
          ico.setAttribute("for", _dpId);  
          ico.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`;  
          if (isDateTime) {  
              ico.style.cssText = `flex-shrink:0;width:36px;height:40px;box-sizing:border-box;border:1px solid var(--background-modifier-border);border-right:none;background:var(--background-secondary);display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--text-muted);transition:border-color 0.15s;`;  
              wrapper.appendChild(ico);  
              const [minH, minM] = tsMin.split(':').map(Number);  
              const [maxH, maxM] = tsMax.split(':').map(Number);  
              const minTotal = minH * 60 + minM, maxTotal = maxH * 60 + maxM;  
              timeSel = document.createElement("select");  
              timeSel.style.cssText = `flex-shrink:0;width:70px;height:40px;box-sizing:border-box;padding:0 2px;border:1px solid var(--background-modifier-border);border-radius:0 6px 6px 0;background:var(--background-secondary);color:var(--text-normal);font-size:13px;cursor:pointer;outline:none;transition:border-color 0.15s;text-align:center;text-align-last:center;`;  
              for (let tot = minTotal; tot <= maxTotal; tot += tsStep) {  
                  const _o = document.createElement("option");  
                  const _v = `${String(Math.floor(tot / 60)).padStart(2, "0")}:${String(tot % 60).padStart(2, "0")}`;  
                  _o.value = _v; _o.textContent = _v; timeSel.appendChild(_o);  
              }  
              timeSel.value = tsMin;  
              wrapper.appendChild(timeSel);  
          } else {  
              ico.style.cssText = `position:absolute;right:0;top:0;bottom:0;width:40px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--text-muted);flex-shrink:0;`;  
              wrapper.appendChild(ico);  
          }  
          const _snapTime = (d) => {  
              const [minH2, minM2] = tsMin.split(':').map(Number);  
              const [maxH2, maxM2] = tsMax.split(':').map(Number);  
              let tot = d.hour * 60 + d.minute;  
              tot = Math.round(tot / tsStep) * tsStep;  
              tot = Math.max(minH2 * 60 + minM2, Math.min(maxH2 * 60 + maxM2, tot));  
              return d.set({ hour: Math.floor(tot / 60), minute: tot % 60, second: 0 });  
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
          if (initISO) _setISO(initISO);  
          txt.addEventListener("input", () => {  
              let raw = txt.value.replace(/[^\d]/g, "").slice(0, 8), out = raw;  
              if (raw.length > 4) out = raw.slice(0, 2) + "." + raw.slice(2, 4) + "." + raw.slice(4);  
              else if (raw.length > 2) out = raw.slice(0, 2) + "." + raw.slice(2);  
              txt.value = out;  
              const m2 = out.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);  
              if (m2) { const iso = `${m2[3]}-${m2[2]}-${m2[1]}`; if (dv.date(iso)) { hidden.value = iso; hidden.dispatchEvent(new Event("change")); } }  
              else if (!raw) { hidden.value = ""; hidden.dispatchEvent(new Event("change")); }  
          });  
          ico.addEventListener("click", () => { try { hidden.showPicker(); } catch (_) { } });  
          hidden.addEventListener("change", () => {  
              const d = dv.date(hidden.value);  
              if (d) txt.value = d.toFormat("dd.MM.yyyy");  
              if (!document.body.classList.contains("is-mobile")) txt.focus();  
          });  
          if (isDateTime) {  
              timeSel.addEventListener("change", () => {  
                  _tsListeners.forEach(fn => { try { fn(); } catch (e) { } });  
              });  
          }  
          const _setBorder = (c) => {  
              txt.style.borderColor = c;  
              if (isDateTime) { ico.style.borderColor = c; if (timeSel) timeSel.style.borderColor = c; }  
          };  
          txt.onfocus = () => _setBorder("var(--interactive-accent)");  
          txt.onblur = () => _setBorder("var(--background-modifier-border)");  
          if (isDateTime && timeSel) {  
              timeSel.onfocus = () => _setBorder("var(--interactive-accent)");  
              timeSel.onblur = () => _setBorder("var(--background-modifier-border)");  
          }  
          return {  
              get value() { return _getISO(); },  
              set value(iso) { _setISO(iso); },  
              set onchange(fn) { hidden.addEventListener("change", fn); if (isDateTime) _tsListeners.push(fn); },  
              hidden, el: wrapper, focus() { txt.focus(); }  
          };  
      };  
    
      // ── Global modal CSS ──────────────────────────────────────────────────────  
      { const _old = document.getElementById('pf0-modal-global-style'); if (_old) _old.remove(); }  
      const _npMs = document.createElement('style');  
      _npMs.id = 'pf0-modal-global-style';  
      _npMs.textContent = `  
          .pf0-overlay{position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.55);z-index:99998;display:flex;flex-direction:column;box-sizing:border-box;padding-top:env(safe-area-inset-top,0px);}  
          .pf0-modal{background:var(--background-primary-alt);border:1px solid var(--background-modifier-border);border-radius:16px 16px 0 0;box-shadow:0 -4px 40px rgba(0,0,0,0.3);width:100%;box-sizing:border-box;font-family:var(--font-interface);display:flex;flex-direction:column;flex:1;min-height:0;overflow:hidden;position:relative;}  
          @media(min-width:700px){.pf0-overlay{align-items:center;justify-content:center;padding:20px 12px;}.pf0-modal{border-radius:14px;flex:none;width:90%;max-width:720px;max-height:calc(100dvh - 40px);}}  
          .pf0-modal-header{display:flex;align-items:center;justify-content:space-between;padding:16px 20px 14px;flex-shrink:0;border-bottom:1px solid var(--background-modifier-border);background:var(--background-primary-alt);}  
          .pf0-modal-body{overflow-y:auto;flex:1;min-height:0;padding:16px 20px;-webkit-overflow-scrolling:touch;padding-bottom:max(80px,calc(60px + env(safe-area-inset-bottom,24px)));}  
          @media(min-width:700px){.pf0-modal-body{padding-bottom:20px;}}  
          .pf0-modal-title{font-size:16px;font-weight:700;color:var(--text-normal);}  
          .pf0-modal-close{display:flex;align-items:center;justify-content:center;width:30px;height:30px;flex-shrink:0;background:var(--background-modifier-border);border:none;cursor:pointer;color:var(--text-muted);border-radius:50%;transition:all 0.2s;}  
          .pf0-modal-close:hover{background:rgba(229,57,53,0.18);color:#e53935;}.pf0-modal-close svg{display:block;}`;  
      document.head.appendChild(_npMs);  
    
      // ── Overlay + Modal DOM ───────────────────────────────────────────────────  
      const overlay = document.createElement('div');  
      overlay.id = MODAL_ID;  
      overlay.className = 'pf0-overlay';  
    
      let _isClosing = false;  
      // discard=true ? resolve(null), файл не создаётся; discard=false ? resolve(draft)  
      const doClose = (discard = false) => {  
          if (_isClosing) return; _isClosing = true;  
          overlay.remove();  
          document.removeEventListener('keydown', _npOnKeyDown);  
          if (_npAcEl) { try { _npAcEl.remove(); } catch (e) { } }  
          if (discard) { resolve(null); }  
          else { resolve(_pfDesktopCore.getPatientDraftResult(draft)); }  
      };  
    
      const _isDirty = () => _pfDesktopCore.isPatientDraftDirty(draft);  
    
      const _confirmClose = () => {  
          if (modal.querySelector('.pf0-confirm-ov')) return;  
          const ov = document.createElement('div');  
          ov.className = 'pf0-confirm-ov';  
          ov.style.cssText = 'position:absolute;inset:0;background:rgba(0,0,0,0.35);z-index:20;display:flex;align-items:center;justify-content:center;border-radius:inherit;';  
          const box = document.createElement('div');  
          box.style.cssText = 'background:var(--background-primary);border:1px solid var(--background-modifier-border);border-radius:12px;padding:22px 28px 18px;box-shadow:0 6px 24px rgba(0,0,0,0.2);text-align:center;max-width:380px;width:92%;';  
          const msg = document.createElement('div');  
          msg.style.cssText = 'font-size:0.93em;color:var(--text-normal);margin-bottom:18px;line-height:1.5;white-space:nowrap;';  
          msg.textContent = 'Закрыть окно? Данные не сохранены.';  
          const btns = document.createElement('div');  
          btns.style.cssText = 'display:flex;gap:8px;justify-content:center;flex-wrap:wrap;';  
          const stayBtn = document.createElement('button');  
          stayBtn.textContent = 'Продолжить';  
          stayBtn.style.cssText = 'padding:7px 16px;border-radius:7px;border:1px solid var(--background-modifier-border);background:var(--background-modifier-hover);color:var(--text-normal);cursor:pointer;font-size:0.88em;font-weight:600;';  
          stayBtn.onclick = () => ov.remove();  
          const closeBtn2 = document.createElement('button');  
          closeBtn2.textContent = 'Сохранить';  
          closeBtn2.style.cssText = 'padding:7px 16px;border-radius:7px;border:none;background:#1976d2;color:#fff;cursor:pointer;font-size:0.88em;font-weight:600;';  
          closeBtn2.onclick = () => { ov.remove(); doClose(false); };  
          const deleteBtn = document.createElement('button');  
          deleteBtn.textContent = 'Удалить';  
          deleteBtn.style.cssText = 'padding:7px 16px;border-radius:7px;border:none;background:#e53935;color:#fff;cursor:pointer;font-size:0.88em;font-weight:600;';  
          deleteBtn.onclick = () => { ov.remove(); doClose(true); };  
          btns.appendChild(stayBtn); btns.appendChild(closeBtn2); btns.appendChild(deleteBtn);  
          box.appendChild(msg); box.appendChild(btns);  
          ov.appendChild(box);  
          ov.addEventListener('click', (e) => { if (e.target === ov) ov.remove(); });  
          modal.appendChild(ov);  
          stayBtn.focus();  
      };  
    
      // Пустой черновик ? закрыть без файла; заполненный ? показать подтверждение  
      const _tryClose = () => { _isDirty() ? _confirmClose() : doClose(true); };  
    
      overlay.addEventListener('click', (e) => { if (e.target === overlay) _tryClose(); });  
      const _npOnKeyDown = (e) => {  
          if (e.key === 'Escape') {  
              e.preventDefault();  
              if (modal.querySelector('.pf0-confirm-ov')) { modal.querySelector('.pf0-confirm-ov').remove(); return; }  
              _tryClose();  
          }  
      };  
      document.addEventListener('keydown', _npOnKeyDown);  
    
      const modal = document.createElement('div');  
      modal.className = 'pf0-modal';  
    
      const header = document.createElement('div');  
      header.className = 'pf0-modal-header';  
      header.style.cssText = 'cursor:pointer;';  
      const titleEl = document.createElement('div');  
      titleEl.className = 'pf0-modal-title';  
      titleEl.textContent = 'Новый пациент';  
      const closeBtn = document.createElement('button');  
      closeBtn.className = 'pf0-modal-close';  
      closeBtn.innerHTML = '<svg width="13" height="13" viewBox="0 0 13 13" fill="none"><line x1="1.35" y1="1.35" x2="11.65" y2="11.65" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="11.65" y1="1.35" x2="1.35" y2="11.65" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';  
      closeBtn.title = 'Отмена (Esc)';  
      closeBtn.onclick = (e) => { e.stopPropagation(); _tryClose(); };  
      header.onclick = () => _tryClose();  
      header.addEventListener('mouseenter', () => { closeBtn.style.background = 'rgba(229,57,53,0.18)'; closeBtn.style.color = '#e53935'; });  
      header.addEventListener('mouseleave', () => { closeBtn.style.background = ''; closeBtn.style.color = ''; });  
      header.appendChild(titleEl); header.appendChild(closeBtn);  
      modal.appendChild(header);  
    
      const modalBody = document.createElement('div');  
      modalBody.className = 'pf0-modal-body';  
      modal.appendChild(modalBody);  
      overlay.appendChild(modal);  
      document.body.appendChild(overlay);  
    
      // ── Inner CSS ─────────────────────────────────────────────────────────────  
      const msc = "rdt-np-m";  
      { const _old = document.getElementById('pf0-inner-style-' + msc); if (_old) _old.remove(); }  
      const _npInnerStyle = document.createElement('style');  
      _npInnerStyle.id = 'pf0-inner-style-' + msc;  
      _npInnerStyle.textContent = `  
          .${msc}{width:100%;max-width:100%;box-sizing:border-box;font-family:var(--font-interface);}  
          .${msc} *{box-sizing:border-box;}  
          .${msc}-grid{display:grid;grid-template-columns:1fr;gap:16px 24px;width:100%;align-items:start;}  
          @media(min-width:500px){.${msc}-grid{grid-template-columns:minmax(0,2fr) minmax(0,1fr);}}  
          .${msc}-grid>*{min-width:0;}  
          .${msc}-sec-title{font-size:.75em;font-weight:700;text-transform:uppercase;color:var(--text-accent);margin-bottom:12px;letter-spacing:.05em;border-bottom:1px solid var(--background-modifier-border);padding-bottom:6px;}  
          .${msc}-sub-title{font-size:.75em;font-weight:700;text-transform:uppercase;color:var(--text-accent);margin-bottom:8px;margin-top:4px;letter-spacing:.05em;border-bottom:1px solid var(--background-modifier-border);padding-bottom:4px;}  
          .${msc}-field-row{display:flex;flex-direction:column;gap:6px;margin-bottom:12px;min-width:0;max-width:100%;}  
          .${msc}-label{font-size:.8em;color:var(--text-muted);font-weight:600;}  
          .${msc}-input,.${msc}-textarea{width:100%;max-width:100%;min-width:0;min-height:40px;background:var(--background-primary);color:var(--text-normal);border:1px solid var(--background-modifier-border);border-radius:6px;padding:8px 12px;font-size:14px;outline:none;transition:border-color .15s;-webkit-appearance:none;appearance:none;}  
          .${msc}-select{width:100%;max-width:100%;min-width:0;height:40px;background:var(--background-primary);color:var(--text-normal);border:1px solid var(--background-modifier-border);border-radius:6px;padding:0 12px;font-size:14px;outline:none;transition:border-color .15s;-webkit-appearance:none;appearance:none;}  
          .${msc}-input:focus,.${msc}-select:focus,.${msc}-textarea:focus{border-color:var(--interactive-accent);}  
          .${msc}-textarea{resize:none;overflow-y:hidden;line-height:1.45;field-sizing:content;}  
          .${msc}-toggle-btn{display:flex;align-items:center;justify-content:space-between;width:100%;height:40px;min-height:40px;background:var(--background-primary);border:1px solid var(--background-modifier-border);border-radius:6px;padding:0 12px;cursor:pointer;transition:border-color .2s;}  
          .${msc}-toggle-btn:hover{border-color:var(--interactive-accent);}  
          .${msc}-toggle-text{font-size:14px;color:var(--text-normal);font-weight:500;}  
          .${msc}-toggle-switch{width:38px;height:22px;background:var(--background-modifier-border);border-radius:20px;position:relative;transition:background .3s;flex-shrink:0;}  
          .${msc}-toggle-switch::after{content:"";position:absolute;top:3px;left:3px;width:16px;height:16px;background:var(--background-primary);border-radius:50%;transition:transform .3s cubic-bezier(.4,.0,.2,1);box-shadow:0 1px 3px rgba(0,0,0,.3);}  
          .${msc}-toggle-btn.active .${msc}-toggle-switch{background:#2196f3;}  
          .${msc}-toggle-btn.active .${msc}-toggle-switch::after{transform:translateX(16px);}  
          .${msc}-tags-container{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px;align-items:center;}  
          .${msc}-tag{display:inline-flex;align-items:stretch;height:32px;border-radius:16px;font-size:13px;font-family:var(--font-interface);border:1px solid var(--background-modifier-border);background:var(--background-primary);box-sizing:border-box;overflow:hidden;transition:all .15s ease;}  
          .${msc}-tag-preset{padding:0 14px;cursor:pointer;align-items:center;justify-content:center;color:var(--text-muted);}  
          .${msc}-tag-preset:hover{border-color:var(--text-muted);color:var(--text-normal);}  
          .${msc}-tag-preset.active{background:#2196f3;border-color:#2196f3;color:white;}  
          .${msc}-tag-custom{color:var(--text-normal);}  
          .${msc}-tag-custom span{display:flex;align-items:center;padding:0 6px 0 12px;}  
          .${msc}-tag-custom-del{display:flex;align-items:center;justify-content:center;padding:0 10px 0 6px;background:transparent;border:none;color:var(--text-muted);cursor:pointer;transition:all .15s ease;outline:none;margin:0;}  
          .${msc}-tag-custom-del:hover{color:#e53935;background:rgba(229,57,53,.12);}  
          .${msc}-tag-custom-del svg{width:14px;height:14px;}  
          .${msc}-add-tag-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:4px;max-width:100%;}  
          .${msc}-add-tag-input{flex:1 1 150px;min-width:0;max-width:100%;}  
          .${msc}-add-tag-btn{flex:0 0 auto;min-height:40px;padding:0 16px;background:var(--background-primary);color:var(--text-muted);border:1px solid var(--background-modifier-border);border-radius:6px;cursor:pointer;font-size:.85em;font-weight:600;transition:all .15s;white-space:nowrap;}  
          .${msc}-add-tag-btn:hover{color:var(--text-accent);border-color:var(--interactive-accent);box-shadow:0 0 0 3px color-mix(in srgb, var(--interactive-accent) 10%, transparent);}  
          .${msc}-submit{display:none;}  
          .pf0-float-close{position:fixed;bottom:env(safe-area-inset-bottom,8px);left:50%;transform:translateX(-50%);z-index:99999;pointer-events:none;display:flex;justify-content:center;}  
          @media(min-width:700px){.pf0-float-close{position:static;transform:none;padding:16px 0 4px;pointer-events:auto;}}  
          .pf0-float-close-btn{pointer-events:all;display:inline-flex;align-items:center;gap:8px;padding:14px 36px;border:none;border-radius:999px;cursor:pointer;font-size:15px;font-weight:700;letter-spacing:.02em;color:#fff;background:#e53935;box-shadow:0 4px 18px rgba(229,57,53,.35),0 1px 4px rgba(0,0,0,.15);transition:transform .15s,box-shadow .15s,background .2s;-webkit-tap-highlight-color:transparent;}  
          .pf0-float-close-btn:hover{background:#ef5350;box-shadow:0 6px 24px rgba(229,57,53,.45),0 2px 6px rgba(0,0,0,.2);transform:translateY(-2px);}  
          .pf0-float-close-btn:active{transform:translateY(0px) scale(.97);box-shadow:0 2px 10px rgba(229,57,53,.3);}  
          @media(min-width:700px){.pf0-float-close-btn{width:100%;justify-content:center;border-radius:10px;padding:12px 24px;}}  
          #acEl-${msc}{position:fixed;z-index:999999;background:var(--background-primary);border:1px solid var(--interactive-accent);border-radius:6px;box-shadow:0 6px 20px rgba(0,0,0,.25);max-height:240px;overflow-y:auto;display:none;font-size:13px;}  
          #acEl-${msc} div{padding:10px 14px;cursor:pointer;border-bottom:1px solid var(--background-modifier-border);color:var(--text-normal);}  
          #acEl-${msc} div:hover{background:var(--background-modifier-hover);}  
          .${msc}-vol-card{background:var(--background-primary);border:1px solid var(--background-modifier-border);border-radius:8px;padding:12px;margin-bottom:8px;transition:opacity .3s ease;}  
          .${msc}-vol-header{display:flex;align-items:center;gap:8px;margin-bottom:10px;flex-wrap:wrap;}  
          .${msc}-vol-dose-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(80px,1fr));gap:8px;margin-top:8px;}  
          .${msc}-inline-field{display:flex;flex-direction:column;gap:4px;}  
          .${msc}-inline-label{font-size:.8em;color:var(--text-muted);font-weight:600;}  
          .${msc}-inline-input,.${msc}-inline-select{width:100%;min-height:40px;height:40px;background:var(--background-primary);color:var(--text-normal);border:1px solid var(--background-modifier-border);border-radius:6px;font-size:14px;-webkit-appearance:none;appearance:none;outline:none;transition:border-color .15s;}  
          .${msc}-inline-input{padding:0 12px;}  
          .${msc}-inline-select{padding:0 8px;cursor:pointer;}  
          .${msc}-inline-input:focus,.${msc}-inline-select:focus{border-color:var(--interactive-accent);}  
          .${msc}-ptv-name-input{width:100%;min-height:36px;height:36px;background:transparent;color:var(--text-normal);border:none;border-bottom:2px solid var(--background-modifier-border);border-radius:0;font-size:15px;font-weight:700;box-sizing:border-box;outline:none;padding:0 4px;transition:border-color .15s;}  
          .${msc}-ptv-name-input:focus{border-bottom-color:var(--interactive-accent);}  
          .${msc}-ptv-name-input::placeholder{color:var(--text-faint);font-weight:400;}  
          .${msc}-add-vol-btn{width:100%;padding:9px 14px;background:var(--background-primary);border:1px solid var(--background-modifier-border);border-radius:8px;color:var(--text-muted);cursor:pointer;font-size:13px;font-weight:600;transition:all .2s;box-sizing:border-box;margin-top:6px;text-align:center;}  
          .${msc}-add-vol-btn:hover{border-color:#ff9800;color:#ff9800;background:rgba(255,152,0,.06);box-shadow:0 0 0 3px rgba(255,152,0,0.08);}  
    
          .pf-sec-input{width:100%;height:32px;border-radius:6px;border:1px solid var(--background-modifier-border);background:var(--background-primary);color:var(--text-normal);padding:0 8px;font-size:13px;outline:none;transition:border-color .15s;box-sizing:border-box;}  
          .pf-sec-input:focus{border-color:var(--interactive-accent);}  
          .pf-sec-label{font-size:11px;color:var(--text-muted);font-weight:600;margin-bottom:2px;display:block;}  
          .pf-sec-card{padding:10px;background:var(--background-primary);border:1px solid var(--background-modifier-border);border-radius:8px;display:flex;flex-direction:column;gap:8px;}  
          .pf-sec-add-btn{width:100%;padding:9px 14px;background:var(--background-primary);border:1px solid var(--background-modifier-border);border-radius:8px;color:var(--text-muted);cursor:pointer;font-size:13px;font-weight:600;transition:all .2s;box-sizing:border-box;margin-bottom:8px;text-align:left;}  
          .pf-sec-inline-btn{width:100%;padding:7px 14px;background:var(--background-primary);border:1px solid var(--background-modifier-border);border-radius:8px;color:var(--text-muted);cursor:pointer;font-size:12px;font-weight:600;transition:all .2s;box-sizing:border-box;margin-bottom:4px;text-align:left;}  
          .pf-sec-del-btn{width:20px;height:20px;background:transparent;border:none;color:var(--text-faint);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:color .15s;flex-shrink:0;padding:0;}  
          .pf-sec-del-btn:hover{color:#e53935;}  
      `;  
      document.head.appendChild(_npInnerStyle);  
    
      // ── Autocomplete + helpers ────────────────────────────────────────────────  
      const FOLDERS = ["Выписаны", "Пациенты", "Не начали", "Консультации"];  
      const _npAllPts = dv.pages().where(p => {  
          if (!p.file || !p.file.path) return false;  
          return FOLDERS.some(f => p.file.path.startsWith(f + "/") || p.file.path.includes("/" + f + "/"));  
      });  
      function _npUniq(fieldName) {  
          const vals = [];  
          _npAllPts.forEach(p => { const v = p[fieldName]; if (v && typeof v === "string" && v.trim()) vals.push(v.trim()); });  
          return [...new Set(vals)].sort();  
      }  
      function _npGetAllTags() {  
          const tags = new Set();  
          _npAllPts.forEach(p => {  
              (p.file?.tags || []).concat(p.tags || []).forEach(t => {  
                  if (t && typeof t === "string") { const c = t.replace(/^#/, "").trim(); if (c) tags.add(c); }  
              });  
          });  
          return [...tags].sort();  
      }  
      const SUGGEST = { "МКБ 10": _npUniq("МКБ 10"), "Область_облучения": _npUniq("Область_облучения"), "Теги": _npGetAllTags() };  
    
      let _npAcEl = document.getElementById(`acEl-${msc}`);  
      if (!_npAcEl) { _npAcEl = document.createElement("div"); _npAcEl.id = `acEl-${msc}`; document.body.appendChild(_npAcEl); }  
      overlay.addEventListener('remove', () => { try { _npAcEl.remove(); } catch (e) { } }, { once: true });  
    
      let acInput = null, acList = [];
      let externalAddTagFunc = null;
      let buildForm, initTagsMap_fn;
      const setAcInput = (value) => { acInput = value; };
      const setAcList = (value) => { acList = value; };
    
      initTagsMap_fn = () => {  
          ls._tagsMap = _pfDesktopCore.createTagMap(ls.hasOwnProperty('tags') ? ls.tags : []);  
      };  
    
      function positionAC() {  
          if (!acInput) return;  
          const r = acInput.getBoundingClientRect();  
          _npAcEl.style.width = r.width + "px"; _npAcEl.style.left = r.left + "px";  
          const spaceBelow = window.innerHeight - r.bottom;  
          if (spaceBelow < 250 && r.top > 250) { _npAcEl.style.top = ""; _npAcEl.style.bottom = (window.innerHeight - r.top) + "px"; }  
          else { _npAcEl.style.bottom = ""; _npAcEl.style.top = (r.bottom + 4) + "px"; }  
      }  
      function renderAC(q) {  
          const filtered = q.trim() ? acList.filter(v => v.toLowerCase().includes(q.toLowerCase())) : acList;  
          if (!filtered.length) { _npAcEl.style.display = "none"; return; }  
          _npAcEl.innerHTML = "";  
          filtered.forEach(val => {  
              const item = document.createElement("div");  
              if (q.trim()) {  
                  const i = val.toLowerCase().indexOf(q.toLowerCase());  
                  item.innerHTML = i >= 0 ? val.slice(0, i) + `<b style="color:var(--text-accent)">${val.slice(i, i + q.length)}</b>` + val.slice(i + q.length) : val;  
              } else { item.textContent = val; }  
              item.onmousedown = (e) => {  
                  e.preventDefault(); acInput.value = val;  
                  if (acInput.dataset.isTagInput === "true" && externalAddTagFunc) externalAddTagFunc();  
                  else acInput.dispatchEvent(new Event("change"));  
                  _npAcEl.style.display = "none"; acInput = null;  
              };  
              _npAcEl.appendChild(item);  
          });  
          _npAcEl.style.display = "block"; positionAC();  
      }  
      const _npCloseAC = (e) => { if (acInput && !_npAcEl.contains(e.target) && e.target !== acInput) { _npAcEl.style.display = "none"; acInput = null; } };  
      document.addEventListener("mousedown", _npCloseAC);  
      overlay.addEventListener('remove', () => document.removeEventListener("mousedown", _npCloseAC), { once: true });  
      function autoGrow(el) { el.style.height = "auto"; el.style.height = (el.scrollHeight || 36) + "px"; }  
    
      // ── field() helper ────────────────────────────────────────────────────────  
      function field(container, label, fieldKey, type = "text", { acKey, opts, defaultVal, onChange, dpOpts } = {}) {  
          if (type === "toggle") {  
              const row = document.createElement("div"); row.className = `${msc}-field-row`;  
              const lbl = document.createElement("label"); lbl.innerHTML = "&nbsp;"; lbl.className = `${msc}-label`; lbl.style.display = "block";  
              row.appendChild(lbl);  
              const btn = document.createElement("div"); btn.className = `${msc}-toggle-btn`;  
              if (getVal(fieldKey) === true) btn.classList.add("active");  
              const btnText = document.createElement("span"); btnText.textContent = label; btnText.className = `${msc}-toggle-text`;  
              const btnSwitch = document.createElement("div"); btnSwitch.className = `${msc}-toggle-switch`;  
              btn.appendChild(btnText); btn.appendChild(btnSwitch);  
              btn.onclick = () => {  
                  const isNowActive = !btn.classList.contains("active");  
                  if (isNowActive) btn.classList.add("active"); else btn.classList.remove("active");  
                  saveNow({ [fieldKey]: isNowActive });  
                  if (onChange) onChange(isNowActive);  
              };  
              row.appendChild(btn); container.appendChild(row); return;  
          }  
          const row = document.createElement("div"); row.className = `${msc}-field-row`;  
          const lbl = document.createElement("label"); lbl.textContent = label; lbl.className = `${msc}-label`;  
          row.appendChild(lbl); container.appendChild(row);  
          let el;  
          if (type === "select") {  
              el = document.createElement("select"); el.className = `${msc}-select`;  
              const defOpt = document.createElement("option"); defOpt.textContent = "— выбрать —"; defOpt.value = ""; el.appendChild(defOpt);  
              const curVal = getVal(fieldKey);  
              (opts || []).forEach(o => { const opt = document.createElement("option"); opt.textContent = o; opt.value = o; if (curVal === o) opt.selected = true; el.appendChild(opt); });  
          } else if (type === "textarea") {  
              el = document.createElement("textarea"); el.className = `${msc}-textarea`; el.rows = 1;  
              el.value = getVal(fieldKey) ?? "";  
              requestAnimationFrame(() => autoGrow(el)); el.oninput = () => autoGrow(el);  
          } else if (type === "date" || type === "datetime") {  
              const rawVal = getVal(fieldKey); const rawToUse = rawVal || defaultVal || null;  
              const isDefault = !rawVal && !!defaultVal; let initISO2 = "";  
              if (rawToUse) { try { const d = dv.date(rawToUse); if (d) initISO2 = type === "date" ? d.toFormat("yyyy-MM-dd") : d.toFormat("yyyy-MM-dd'T'HH:mm"); } catch { } }  
              const _picker = _npMakeDatePicker(row, initISO2, `width:100%;max-width:100%;`, type === "datetime", dpOpts || {});  
              if (isDefault) _picker.hidden.style.opacity = "0.5";  
              _picker.onchange = () => {  
                  const val = _picker.value; ls[fieldKey] = val || null; saveNow({ [fieldKey]: val || null });  
                  if (onChange) onChange(val); _picker.hidden.style.opacity = "";  
              };  
              return;  
          } else {  
              el = document.createElement("input"); el.type = type === "number" ? "number" : "text";  
              el.className = `${msc}-input`; if (type === "number") el.step = "any";  
              el.value = getVal(fieldKey) ?? "";  
          }  
          if (type === "select") {  
              el.onchange = () => { let val = el.value.trim() || null; ls[fieldKey] = val; saveNow({ [fieldKey]: val }); if (onChange) onChange(val); };  
          } else {  
              el.onchange = () => {  
                  let val = el.value.trim();  
                  if (type === "number") val = val ? Number(val) : null; else val = val || null;  
                  ls[fieldKey] = val; saveLater(fieldKey, val); if (onChange) onChange(val);  
              };  
              if (type !== "number") {  
                  el.oninput = () => {  
                      const val = el.value; ls[fieldKey] = val.trim() || null; saveLater(fieldKey, val.trim() || null);  
                      if (acKey) { acList = SUGGEST[acKey] ?? []; renderAC(val); }  
                      if (type === "textarea") autoGrow(el);  
                  };  
              }  
          }  
          if (acKey && (type === "text" || !type)) {  
              el.onfocus = () => { acInput = el; acList = SUGGEST[acKey] ?? []; renderAC(el.value); };  
              el.onblur = () => setTimeout(() => { if (document.activeElement !== _npAcEl) _npAcEl.style.display = "none"; }, 200);  
          }  
          row.appendChild(el);  
      }  
    
      const renderTransferDoctorField = (container) => {
          const row = document.createElement("div"); row.className = `${msc}-field-row`;
          const lbl = document.createElement("label"); lbl.textContent = "Передан"; lbl.className = `${msc}-label`;
          row.appendChild(lbl); container.appendChild(row);

          const clearTransferControl = () => {
              row.querySelectorAll("[data-pf-transfer-doctor], [data-pf-transfer-add-doctor]").forEach(node => node.remove());
          };

          const renderSelect = (doctors = _pfPatientTransferCore.DEFAULT_DOCTORS) => {
              clearTransferControl();
              const sel = document.createElement("select");
              sel.className = `${msc}-select`;
              sel.setAttribute("data-pf-transfer-doctor", "1");
              const curVal = _pfPatientTransferCore.normalizeDoctorName(getVal("Передан"));
              const defOpt = document.createElement("option"); defOpt.textContent = "— не передан —"; defOpt.value = ""; sel.appendChild(defOpt);
              _pfPatientTransferCore.ensureDoctor(doctors, curVal).forEach(name => {
                  const opt = document.createElement("option");
                  opt.textContent = name; opt.value = name; if (curVal === name) opt.selected = true;
                  sel.appendChild(opt);
              });
              const addOpt = document.createElement("option");
              addOpt.textContent = "+ Добавить врача"; addOpt.value = TRANSFER_ADD_DOCTOR_VALUE;
              sel.appendChild(addOpt);
              sel.onchange = async () => {
                  if (sel.value === TRANSFER_ADD_DOCTOR_VALUE) {
                      renderInput();
                      return;
                  }
                  const val = _pfPatientTransferCore.normalizeDoctorName(sel.value);
                  ls["Передан"] = val || null;
                  await saveNow({ "Передан": val || null });
              };
              row.appendChild(sel);
          };

          const renderInput = () => {
              clearTransferControl();
              const input = document.createElement("input");
              input.type = "text";
              input.className = `${msc}-input`;
              input.placeholder = "Фамилия И.О.";
              input.setAttribute("data-pf-transfer-add-doctor", "1");
              const commit = async () => {
                  const doctor = await _npEnsureTransferDoctor(input.value);
                  ls["Передан"] = doctor || null;
                  await saveNow({ "Передан": doctor || null });
                  renderSelect(await _npLoadTransferDoctors());
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
          void _npLoadTransferDoctors().then(renderSelect);
      };

      // ── Совместимость с шаблонным buildForm в режиме черновика ──────────────?
      const getStoredVal = (key) => getVal(key);  
      const refreshStoredFrontmatter = async () => {  
          // В модальном редакторе нового пациента данные живут в draft.  
          // Оставляем безопасный async-хук, чтобы вызовы AI-парсера/чата не падали.  
          return Promise.resolve();  
      };  
      const _npEscapeHtml = (s) => String(s ?? "")  
          .replace(/&/g, "&amp;")  
          .replace(/</g, "&lt;")  
          .replace(/>/g, "&gt;")  
          .replace(/\"/g, "&quot;")  
          .replace(/'/g, "&#39;");  
      const _npProcessFrontMatter = async (mutator) => {  
          const fm = { ...draft };  
          try { mutator(fm); } catch (e) { console.error("np processFrontMatter emulation:", e); }  
          Object.assign(draft, fm);  
          return Promise.resolve();  
      };  
    
      // ── buildForm ─────────────────────────────────────────────────────────────  
      buildForm = async () => {  
          // Сбрасываем состояние перед перестройкой  
          externalAddTagFunc = null;  
          while (modalBody.firstChild) modalBody.removeChild(modalBody.firstChild);  
    
          // ── Основная обёртка ──────────────────────────────────────────────────────  
          const wrap = modal.ownerDocument.createElement("div");  
          wrap.className = msc;  
    
    
          // ── AI-ПАРСЕР & УМНЫЙ ЧАТ (делегировано) ──────────────────────────────────  
          if (window._pfDesktopParserUi && typeof window._pfDesktopParserUi.buildAiPanel === "function") {  
              try {  
                  const parserUi = await window._pfDesktopParserUi.buildAiPanel({  
                      msc, MODAL_ID, modal, _pfDesktopCore, ls, getVal, saveNow,  
                      _dbMergeDiagnosisText, _npNormalizeLabDateKey,  
                      _npMatchEcogInText, _npNormalizeEcog, _dbNormalizeHistoryText,  
                      _dbNormalizeDrugNames, _dbNormalizeDiagnosisText, _dbResolvePatientId,  
                      draft, getStoredVal, refreshStoredFrontmatter, buildForm, wrap  
                  });  
                  parserUi.renderAiPanel();  
                  parserUi.renderChatPanel();  
              } catch (err) {  
                  console.error("Failed to build AI Parser UI", err);  
                  const errDiv = modal.ownerDocument.createElement("div");  
                  errDiv.style.color = "red";  
                  errDiv.textContent = "Ошибка загрузки AI-Парсера: " + err.message;  
                  wrap.appendChild(errDiv);  
              }  
          } else {  
              console.warn("window._pfDesktopParserUi not found");  
          }  
    
    
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
          const statState = _pfDesktopCore.getDsKsTagState(ls._tagsMap).state;  
          const segOuter = modal.ownerDocument.createElement('div'); segOuter.className = "pf-seg-wrap";  
          const segFieldRow = modal.ownerDocument.createElement('div'); segFieldRow.className = `${msc}-field-row`;  
          const segLbl = modal.ownerDocument.createElement('label'); segLbl.innerHTML = "&nbsp;"; segLbl.className = `${msc}-label`;  
          segFieldRow.appendChild(segLbl);  
          const sWrap = modal.ownerDocument.createElement('div'); sWrap.className = "pf-seg";  
          const bDs = modal.ownerDocument.createElement('button'); bDs.title = "Дневной стационар";  
          bDs.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg><span>ДС</span>`;  
          bDs.className = "pf-seg-btn" + (statState === 'ДС' ? " ds-on" : "");  
          const bKs = modal.ownerDocument.createElement('button'); bKs.title = "Круглосуточный стационар";  
          bKs.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg><span>КС</span>`;  
          bKs.className = "pf-seg-btn" + (statState === 'КС' ? " ks-on" : "");  
          bDs.onclick = () => { if (ls._tagsMap) { ls._tagsMap = _pfDesktopCore.setExclusiveDsKsTag(ls._tagsMap, "ДС"); setPending("tags", _pfDesktopCore.tagMapToList(ls._tagsMap)); } ls["КС"] = "ДС"; ls["Палата"] = null; saveNow({ "КС": "ДС", "Палата": null }); rerenderForm(); };
          bKs.onclick = () => { if (ls._tagsMap) { ls._tagsMap = _pfDesktopCore.setExclusiveDsKsTag(ls._tagsMap, "КС"); setPending("tags", _pfDesktopCore.tagMapToList(ls._tagsMap)); } ls["КС"] = "КС"; saveNow({ "КС": "КС" }); rerenderForm(); };
          sWrap.appendChild(bDs); sWrap.appendChild(bKs);  
          segFieldRow.appendChild(sWrap);  
          segOuter.appendChild(segFieldRow);  
          topAdminRow.appendChild(segOuter);

          const inpatientSubRow = modal.ownerDocument.createElement("div");
          inpatientSubRow.className = "pf-adm-sub";
          if (getVal("КС") === "КС") {
              const roomWrap = modal.ownerDocument.createElement("div");
              roomWrap.className = "pf-field-toggle-inline";
              field(roomWrap, "Палата", "Палата", "text");
              roomWrap.querySelector("input")?.setAttribute("data-pf-inpatient-room", "1");
              inpatientSubRow.appendChild(roomWrap);
          }
          c1.appendChild(inpatientSubRow);
    
          // Больничный (на той же строке)  
          const elnWrap = modal.ownerDocument.createElement("div"); elnWrap.className = "pf-field-toggle-inline";  
          field(elnWrap, "Больничный", "Больничный_лист", "toggle", {  
              onChange: (isOn) => { if (!isOn) saveNow({ "Открытый_ЭЛН": null, "Открытый_ЭЛН_активен": false }); rerenderForm(); }  
          });  
          topAdminRow.appendChild(elnWrap);  
          c1.appendChild(topAdminRow);  
    
          // ЭЛН — подстрока (только если Больничный включён)  
          if (getVal("Больничный_лист") === true) {  
              const elnSubRow = modal.ownerDocument.createElement("div");  
              elnSubRow.className = "pf-adm-sub";  
    
              const openedElnWrap = modal.ownerDocument.createElement("div"); openedElnWrap.className = "pf-field-toggle-inline";  
              field(openedElnWrap, "ЭЛН открыт", "Открытый_ЭЛН_активен", "toggle", {  
                  onChange: (isOn) => { if (!isOn) saveNow({ "Открытый_ЭЛН": null }); rerenderForm(); }  
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
              btn.onmouseenter = () => { btn.style.borderColor = color; btn.style.color = color; btn.style.background = `${color}0f`; btn.style.boxShadow = `0 0 0 3px ${color}14`; };  
              btn.onmouseleave = () => { btn.style.borderColor = "var(--background-modifier-border)"; btn.style.color = "var(--text-muted)"; btn.style.background = "var(--background-primary)"; btn.style.boxShadow = "none"; };  
              btn.onclick = () => { btn.remove(); renderFn(); };  
              return btn;  
          };  
    
          // Хелпер: карточка-запись с цветной полоской  
          const _mkEntryCard = (accentColor) => {  
              const card = modal.ownerDocument.createElement("div");  
              card.style.cssText = `padding:10px;background:var(--background-primary);border:1px solid var(--background-modifier-border);border-left:3px solid ${accentColor};border-radius:8px;display:flex;flex-direction:column;gap:8px;`;  
              return card;  
          };  
    
          // Хелпер: поле с подписью сверху. onDelete — опционально, добавляет ? справа от подписи  
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
    
          // Хелпер: строка заголовка секции (удаление через ? в карточке)  
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
              const _picker = _npMakeDatePicker(row, initISO, "width:100%;max-width:100%;", isDateTime);  
              _picker.onchange = () => { onChangeFn(_picker.value || null); };  
          };  
          const _isHospitalized = getVal("Госпитализация") === true  
              || getStoredVal("Госпитализация") === true  
              || (window['pf_status_' + MODAL_ID] || {}).Госпитализация === true;  
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
                  rmkSection.appendChild(_mkSecHeader("── Переразметка", "#3f51b5"));  
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
                  if (entry.Дата) { try { const d = dv.date(entry.Дата); if (d) _dateISO = d.toFormat("yyyy-MM-dd'T'HH:mm"); } catch (e) { } }  
                  const _dateRow = modal.ownerDocument.createElement("div");  
                  _dateRow.className = `${msc}-field-row`;  
                  card.appendChild(_dateRow);  
                  const _datePicker = _npMakeDatePicker(_dateRow, _dateISO, "width:100%;max-width:100%;", true);  
                  _datePicker.onchange = () => { card.dataset.rmkDate = _datePicker.value || ""; saveRemarks(); };  
                  card.dataset.rmkDate = _dateISO;  
    
                  let _startISO = "";  
                  if (entry.Старт_нового_плана) { try { const d = dv.date(entry.Старт_нового_плана); if (d) _startISO = d.toFormat("yyyy-MM-dd"); } catch (e) { } }  
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
    
          // ── ЯКОРЯ для фиксации порядка (ХЛТ всегда перед назначениями Л/С) ────────?  
          const MEDS_SECTION_LABEL = "Лекарственные препараты";  
          const medsSectionTitle = modal.ownerDocument.createElement("div");  
          medsSectionTitle.style.cssText = "margin:10px 0 6px 0;font-size:13px;font-weight:700;color:var(--text-normal);";  
          medsSectionTitle.textContent = `── ${MEDS_SECTION_LABEL}`;  
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
              btn.onmouseenter = () => { btn.style.borderColor = color; btn.style.color = color; btn.style.background = `${color}0f`; };  
              btn.onmouseleave = () => { btn.style.borderColor = "var(--background-modifier-border)"; btn.style.color = "var(--text-muted)"; btn.style.background = "var(--background-primary)"; };  
              btn.onclick = onClick;  
              return btn;  
          };  
    
          // ── ХЛТ ───────────────────────────────────────────────────────────────────
          const hltDrugs = (() => {
              const raw = getVal("ХЛТ_препараты");
              return Array.isArray(raw) ? raw.filter(Boolean) : [];
          })();
  
          // Дефолтная дата = дата начала лечения
          const _defaultHltDateISO = (() => {
              const raw = getVal("ХЛТ_дата_старта") || getVal("Дата_начала_лечения");
              if (!raw) return "";
              try { const d = dv.date(raw); return d ? d.toFormat("yyyy-MM-dd") : ""; } catch (e) { return ""; }
          })();
  
          await _pfDesktopHlt.mountDesktopHltSection({
              anchor: _hltAnchor,
              modal,
              getVal,
              saveNow,
              mkAddBtn: _mkAddBtn,
              mkInlineBtn: _mkInlineBtn,
              mkSecHeader: _mkSecHeader,
              mkEntryCard: _mkEntryCard,
              mkField: _mkField,
              mkDateField: _mkDateField,
              defaultHltDateISO: _defaultHltDateISO,
              initialDrugs: hltDrugs,
              document: modal.ownerDocument,
              dv
          });
    
          // ── НАЗНАЧЕНИЕ Л/С ─────────────────────────────────────────────────────────  
          const LS_COLOR = "#7b61ff";  
          const LS_DURATIONS = ["Весь период лечения", "1 день", "2 дня", "3 дня", "4 дня", "5 дней", "6 дней", "7 дней", "10 дней", "14 дней", "21 день", "28 дней", "30 дней", "60 дней", "90 дней"];  
          const lsRaw = (() => {  
              const tmp = {  
                  ЛС_назначения: getVal("ЛС_назначения"),  
                  Лекарственные_препараты: getVal("Лекарственные_препараты")  
              };  
              return _npNormalizeLsAssignments(tmp);  
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
    
              const medsHeader = _mkSecHeader("── Назначение Л/С", LS_COLOR);  
              medsWrap.appendChild(medsHeader);  
    
              const medList = modal.ownerDocument.createElement("div");  
              medList.style.cssText = "display:flex;flex-direction:column;gap:8px;margin-bottom:8px;";  
    
              const toLegacyLs = (items) => (items || []).map(e => ({  
                  Препарат: e.Препарат || "",  
                  Дозировка: e.Дозировка || "",  
                  Срок: _npToLsUiDuration(e.Срок, e.Дней),  
                  Дата_начала: e.Дата_старта || ""  
              }));  
    
              const getLsFromDOM = () =>  
                  _npDedupLsAssignments(Array.from(medList.querySelectorAll(".med-entry")).map(card => {  
                      const prep = card.querySelector(".med-name")?.value?.trim() ?? "";  
                      const dose = card.querySelector(".med-dose")?.value?.trim() ?? "";  
                      const durUi = card.querySelector(".med-duration")?.value ?? LS_DURATIONS[0];  
                      const t = _npToLsTerm(durUi);  
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
                  delBtn.textContent = "🗑️ Удалить";  
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
                  nameInp.onblur = () => { nameInp.style.borderColor = "var(--background-modifier-border)"; saveLs(); };  
                  nameInp.oninput = () => saveLs();  
                  grid.appendChild(createCol(nameInp));  
    
                  const doseInp = modal.ownerDocument.createElement("input");  
                  doseInp.type = "text"; doseInp.className = "med-dose";  
                  doseInp.value = entry.Дозировка ?? ""; doseInp.placeholder = "Дозировка";  
                  doseInp.style.cssText = _SEC_INP + "margin-top:0;height:34px;";  
                  doseInp.onfocus = () => doseInp.style.borderColor = "var(--interactive-accent)";  
                  doseInp.onblur = () => { doseInp.style.borderColor = "var(--background-modifier-border)"; saveLs(); };  
                  doseInp.oninput = () => saveLs();  
                  grid.appendChild(createCol(doseInp));  
    
                  const durSel = modal.ownerDocument.createElement("select");  
                  durSel.className = "med-duration";  
                  durSel.style.cssText = _SEC_INP + "height:34px;cursor:pointer;margin-top:0;";  
                  durSel.onfocus = () => durSel.style.borderColor = "var(--interactive-accent)";  
                  durSel.onblur = () => durSel.style.borderColor = "var(--background-modifier-border)";  
                  const selectedDur = _npToLsUiDuration(entry.Срок, entry.Дней);  
                  LS_DURATIONS.forEach(v => {  
                      const opt = modal.ownerDocument.createElement("option");  
                      opt.textContent = v; opt.value = v;  
                      if (v === selectedDur) opt.selected = true;  
                      durSel.appendChild(opt);  
                  });  
                  durSel.onchange = saveLs;  
                  grid.appendChild(createCol(durSel));  
    
                  let _medDateISO = "";  
                  if (entry.Дата_старта) { try { const d = dv.date(entry.Дата_старта); if (d) _medDateISO = d.toFormat("yyyy-MM-dd"); } catch (e) { } }  
                  card.dataset.medDate = _medDateISO;  
                  const dateInp = modal.ownerDocument.createElement("input");  
                  dateInp.type = "date";  
                  dateInp.value = _medDateISO;  
                  dateInp.style.cssText = _SEC_INP + "height:34px;cursor:pointer;margin-top:0;";  
                  if (!_medDateISO) dateInp.style.color = "var(--text-faint)";  
                  dateInp.onchange = () => { dateInp.style.color = dateInp.value ? "var(--text-normal)" : "var(--text-faint)"; card.dataset.medDate = dateInp.value || ""; saveLs(); };  
                  dateInp.onfocus = () => dateInp.style.borderColor = "var(--interactive-accent)";  
                  dateInp.onblur = () => dateInp.style.borderColor = "var(--background-modifier-border)";  
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
    
          await _pfDesktopTreatmentVolumes.mountDesktopTreatmentVolumesSection({
              wrap, modal, msc, ls, getVal, getStoredVal, setPending,
              buildForm, _npProcessFrontMatter, _pfDesktopCore, _pfDesktopPlatform,
              _pfPatientAcceleratorCore,
              document: modal.ownerDocument,
              normalizeConn,
              SUGGEST,
              renderAC,
              positionAC,
              setAcInput,
              setAcList
          });
          if (false) {
          // ── СЕКЦИЯ: ОБЪЁМЫ (PTV) ──────────────────────────────────────────────────
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
              initTagsMap_fn();  
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
              areaIn.onfocus = () => { acInput = areaIn; acList = SUGGEST["Область_облучения"] ?? []; renderAC(areaIn.value); };  
              areaIn.oninput = () => { acList = SUGGEST["Область_облучения"] ?? []; renderAC(areaIn.value); };  
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
              } else {  
                  mkVolField(doseRow, "РОД (Гр) SIB", "number", boostVol.РОД, null, v => { boostVol.РОД = v; setPending("Объёмы", ls._volumes.slice()); });  
                  mkVolField(doseRow, "Фракции (авто)", "number", ptv1Frac, null, async () => { }, true);  
                  mkVolField(doseRow, "Режим (авто)", "select", ptv1Mode || "Стандартный", FRAKTS_LIST, async () => { }, true);  
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
          areaIn1.onfocus = () => { acInput = areaIn1; acList = SUGGEST["Область_облучения"] ?? []; renderAC(areaIn1.value); };  
          areaIn1.oninput = () => { acList = SUGGEST["Область_облучения"] ?? []; renderAC(areaIn1.value); };  
          areaIn1.onblur = () => setTimeout(() => { if (document.activeElement !== _npAcEl) _npAcEl.style.display = "none"; }, 200);  
          areaIn1.onchange = () => { setPending("Область_облучения", areaIn1.value.trim() || null); };  
          area1Row.appendChild(area1Lbl); area1Row.appendChild(areaIn1);  
          card1.appendChild(area1Row);  
    
          const dose1Row = modal.ownerDocument.createElement("div");  
          dose1Row.className = `${msc}-vol-dose-row`;  
          mkVolField(dose1Row, "РОД (Гр)", "number", getVal("РОД"), null, v => { setPending("РОД", v); });  
          mkVolField(dose1Row, "Фракции", "number", getVal("Количество_фракций"), null, v => { setPending("Количество_фракций", v); });  
          mkVolField(dose1Row, "Режим", "select", getVal("Фракционирование") || "Стандартный", FRAKTS_LIST, v => { setPending("Фракционирование", v); });  
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
              areaIn2.onfocus = () => { acInput = areaIn2; acList = SUGGEST["Область_облучения"] ?? []; renderAC(areaIn2.value); };  
              areaIn2.oninput = () => { acList = SUGGEST["Область_облучения"] ?? []; renderAC(areaIn2.value); };  
              areaIn2.onblur = () => setTimeout(() => { if (document.activeElement !== _npAcEl) _npAcEl.style.display = "none"; }, 200);  
              areaIn2.onchange = () => { vol.Область_облучения = areaIn2.value.trim() || null; setPending("Объёмы", ls._volumes.slice()); };  
              areaFieldRow.appendChild(areaLbl2); areaFieldRow.appendChild(areaIn2);  
              card.appendChild(areaFieldRow);  
    
              const doseRow2 = modal.ownerDocument.createElement("div");  
              doseRow2.className = `${msc}-vol-dose-row`;  
              mkVolField(doseRow2, "РОД (Гр)", "number", vol.РОД, null, v => { vol.РОД = v; setPending("Объёмы", ls._volumes.slice()); });  
              mkVolField(doseRow2, "Фракции", "number", vol.Количество_фракций, null, v => { vol.Количество_фракций = v; setPending("Объёмы", ls._volumes.slice()); });  
              mkVolField(doseRow2, "Режим", "select", vol.Фракционирование || "Стандартный", FRAKTS_LIST, v => { vol.Фракционирование = v; setPending("Объёмы", ls._volumes.slice()); });  
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
              newAreaIn.onfocus = () => { acInput = newAreaIn; acList = SUGGEST["Область_облучения"] ?? []; renderAC(newAreaIn.value); };  
              newAreaIn.oninput = () => { acList = SUGGEST["Область_облучения"] ?? []; renderAC(newAreaIn.value); };  
              newAreaIn.onblur = () => setTimeout(() => { if (document.activeElement !== _npAcEl) _npAcEl.style.display = "none"; }, 200);  
              newAreaIn.onchange = () => { newVol.Область_облучения = newAreaIn.value.trim() || null; setPending("Объёмы", ls._volumes.slice()); };  
              newAreaRow.appendChild(newAreaLbl); newAreaRow.appendChild(newAreaIn);  
              newCard.appendChild(newAreaRow);  
    
              const newDoseRow = modal.ownerDocument.createElement("div");  
              newDoseRow.className = `${msc}-vol-dose-row`;  
              mkVolField(newDoseRow, "РОД (Гр)", "number", null, null, v => { newVol.РОД = v; setPending("Объёмы", ls._volumes.slice()); });  
              mkVolField(newDoseRow, "Фракции", "number", null, null, v => { newVol.Количество_фракций = v; setPending("Объёмы", ls._volumes.slice()); });  
              mkVolField(newDoseRow, "Режим", "select", "Стандартное", FRAKTS_LIST, v => { newVol.Фракционирование = v; setPending("Объёмы", ls._volumes.slice()); });  
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
          }
  
          // ── ТЕГИ ──────────────────────────────────────────────────────────────────
          const tagSec = modal.ownerDocument.createElement("div");  
          const tagSecTitle = modal.ownerDocument.createElement("div");  
          tagSecTitle.textContent = "Теги"; tagSecTitle.className = `${msc}-sec-title`;  
          tagSecTitle.style.marginTop = "16px";  
          tagSec.appendChild(tagSecTitle);  
          wrap.appendChild(tagSec);  
    
          const PRESETS = [  
              { key: "ДС", label: "── ДС" }, { key: "КС", label: "── КС" },  
              { key: "SBRT", label: "SBRT" }, { key: "SRT", label: "SRT" },  
              { key: "SRS", label: "SRS" }, { key: "ХЛТ", label: "ХЛТ" },  
              { key: "длинный_курс", label: "Длинный курс" }  
          ];  
          const presetKeys = new Set(PRESETS.map(p => p.key.toLowerCase()));  
    
          // Инициализируем tagsMap от cur при каждом открытии  
          // ls._tagsMap инициализирован через initTagsMap_fn() перед вызовом buildForm()  
    
          const flushTags = () => setPending("tags", _pfDesktopCore.tagMapToList(ls._tagsMap));  
    
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
                  } else {  
                      btn.classList.add("active");  
                  }  
                  ls._tagsMap = _pfDesktopCore.toggleTagInMap(ls._tagsMap, key);  
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
                  ls._tagsMap = _pfDesktopCore.removeTagFromMap(ls._tagsMap, lk);  
                  flushTags();  
                  _pfDesktopPlatform.notice(`──❌ Тег «${originalTag}» удалён`);
              };  
              chip.appendChild(delBtn);  
              chipRow.appendChild(chip);  
          };  
    
          _pfDesktopCore.getCustomTagsFromMap(ls._tagsMap, presetKeys)  
              .forEach(tag => renderCustomChip(tag));  
    
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
                  ls._tagsMap = _pfDesktopCore.addTagToMap(ls._tagsMap, val);  
                  renderCustomChip(val);  
                  flushTags();  
                  _pfDesktopPlatform.notice(`──❌ Тег «${val}» добавлен`);
              }  
              tagInput.value = "";  
          };  
    
          addTagBtn.onclick = externalAddTagFunc;  
          tagInput.onfocus = () => { acInput = tagInput; acList = SUGGEST["Теги"] || []; renderAC(tagInput.value); };  
          tagInput.oninput = () => { acList = SUGGEST["Теги"] || []; renderAC(tagInput.value); };  
          tagInput.onblur = () => setTimeout(() => { if (document.activeElement !== _npAcEl) _npAcEl.style.display = "none"; }, 200);  
          tagInput.onkeydown = e => { if (e.key === "Enter") { e.preventDefault(); externalAddTagFunc(); _npAcEl.style.display = "none"; } };  
    
          void _pfDesktopClinicalSection.mountNewPatientClinicalSection({
              wrap,
              modal,
              msc,
              MODAL_ID,
              getVal,
              field,
              saveNow,
              window,
              document,
              dv,
              _pfDesktopCore,
              NEW_PATIENT_ANAM_FIELDS,
              SUGGEST: {},
              renderAC: () => {},
              positionAC: () => {},
              notice: _pfDesktopPlatform.notice
          });
    
          // ── Плавающая кнопка создания пациента ───────────────────────────────────  
          const floatBar = modal.ownerDocument.createElement("div");  
          floatBar.className = "pf0-float-close";  
          const confirmBtn = modal.ownerDocument.createElement("button");  
          confirmBtn.className = "pf0-float-close-btn";  
          confirmBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><polyline points="2,8 6,12 14,4" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>Создать пациента`;  
          confirmBtn.onclick = () => doClose(false);  
          floatBar.appendChild(confirmBtn);  
          wrap.appendChild(floatBar);  
          modalBody.appendChild(wrap);  
      }; // end buildForm  
    
      initTagsMap_fn();  
      buildForm();  
  });  
    
  const createPatientNote = async () => {  
      try {  
          const draft = await _openNewPatientEditorModal();  
          if (!draft) return;  
          if (!draft["ID_пациента"]) {  
              const resolvedId = _dbResolvePatientId(draft);  
              if (resolvedId.id) draft["ID_пациента"] = resolvedId.id;  
          }  
    
          const draftDob = draft["Дата_рождения"] ? dv.date(draft["Дата_рождения"]) : null;  
          const form = {  
              fio: draft["ФИО"] || "",  
              dobIso: draftDob ? draftDob.toFormat("yyyy-MM-dd") : "",  
              mkb10: draft["МКБ 10"] || "",  
              vmpGroup: draft["Группа ВМП"] || "",  
          };  
          let baseName = _pfDesktopCore.buildPatientFileBaseName({
              ...form,
              todayIso: dv.date("today")?.toISODate?.()
          });
          if (!baseName) {  
              const _fioRaw = _pfDesktopCore.sanitizeFileName(form.fio || "");
              const _mkbRaw = String(form.mkb10 || "").toUpperCase().replace(/\s+/g, "").replace(/[^A-ZА-Я0-9.\-]/g, "");  
              const _ts = new Date();  
              const _dateStr = `${_ts.getFullYear()}-${String(_ts.getMonth() + 1).padStart(2, "0")}-${String(_ts.getDate()).padStart(2, "0")}`;  
              baseName = (_fioRaw || _mkbRaw) ? _pfDesktopCore.sanitizeFileName(`${_mkbRaw} ${_fioRaw}`.trim()) : `Новый пациент ${_dateStr}`;
          }  
    
          const todayIso = dv.date("today")?.toISODate?.() || "";
          const transferPatch = _pfPatientTransferCore.buildTransferredPatientPatch({
              transferredBy: draft["Передан"],
              todayIso,
              markupIso: draft["Дата_разметки"],
              treatmentStartIso: draft["Дата_начала_лечения"]
          });
          Object.assign(draft, transferPatch);
          const targetFolder = _pfPatientTransferCore.normalizeDoctorName(draft["Передан"]) ? "Пациенты" : "Консультации";
          const content = _pfPatientNoteCore.renderInitialContent({ frontmatter: draft });
          const created = await _pfDesktopPlatform.createUniqueFile(targetFolder, baseName, content || "");
          _pfDesktopPlatform.notice(`✅ Пациент создан: ${created.basename}`);
      } catch (e) {
          console.error(e);
          _pfDesktopPlatform.notice(`Ошибка создания пациента: ${e?.message || e}`);
      }
  };
    

  return {
    NEW_PATIENT_ANAM_FIELDS,
    NEW_PATIENT_ECOG_KEY,
    NEW_PATIENT_ECOG_OPTS,
    openNewPatientEditorModal: _openNewPatientEditorModal,
    createPatientNote
  };
};

module.exports = {
  createDesktopNewPatientRuntime
};
