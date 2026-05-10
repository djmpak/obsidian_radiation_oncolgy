"use strict";

const PATIENT_EDITOR_FIELDS = [
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

const normalizePatientEditorValue = (field, input) => {
  const raw = String(input?.value ?? "").trim();
  if (field?.type === "select" && Array.isArray(field.vals)) {
    const optionText = String(input?.options?.[input?.selectedIndex]?.textContent ?? "");
    const idx = Array.isArray(field.opts) ? field.opts.indexOf(optionText) : -1;
    const value = idx >= 0 ? field.vals[idx] : null;
    return value === undefined ? null : value;
  }
  if (raw === "") return null;
  if (field?.type !== "text" && field?.type !== "textarea" && field?.type !== "date" && !Number.isNaN(Number(raw))) {
    return Number(raw);
  }
  return raw;
};

const collectPatientEditorUpdates = (inputs) => {
  const updates = {};
  Object.entries(inputs || {}).forEach(([key, { inp, field }]) => {
    updates[key] = normalizePatientEditorValue(field, inp);
  });
  return updates;
};

const openPatientCardEditorModal = (ctx = {}) => {
  const {
    dv,
    cur,
    saveNow,
    getVal,
    getQLQModule,
    notice = null,
    qrlDomain = "qlq.example.com",
    getCloseSnapshot,
    onClose
  } = ctx;

  if (!dv?.el) throw new Error("openPatientCardEditorModal: dv.el is required");
  if (!cur) throw new Error("openPatientCardEditorModal: cur is required");
  if (typeof saveNow !== "function") throw new Error("openPatientCardEditorModal: saveNow is required");
  if (typeof getVal !== "function") throw new Error("openPatientCardEditorModal: getVal is required");
  if (typeof getQLQModule !== "function") throw new Error("openPatientCardEditorModal: getQLQModule is required");

  return () => {
  const modalId = `pf0-modal-${String(cur.file?.path || cur.file?.name || "").replace(/[^a-zA-Z0-9_-]/g, "_").toLowerCase()}`;
  const oldStyle = document.getElementById("pf0-modal-global-style");
  if (oldStyle) oldStyle.remove();
  const ms = document.createElement("style");
  ms.id = "pf0-modal-global-style";
  ms.textContent = `
      .pf0-overlay {
          position: fixed; top: 0; left: 0; width: 100%; height: 100%;
          background: rgba(0,0,0,0.55); z-index: 99998;
          display: flex; flex-direction: column;
          box-sizing: border-box;
          padding-top: env(safe-area-inset-top, 0px);
      }
      .pf0-modal {
          background: var(--background-primary-alt);
          border: 1px solid var(--background-modifier-border);
          border-radius: 16px 16px 0 0;
          box-shadow: 0 -4px 40px rgba(0,0,0,0.3);
          width: 100%; box-sizing: border-box; font-family: var(--font-interface);
          display: flex; flex-direction: column;
          flex: 1; min-height: 0;
          overflow: hidden;
      }
      @media (min-width: 700px) {
          .pf0-modal { border-radius: 14px; flex: none; width: 90%; max-width: 720px; max-height: calc(100dvh - 40px); }
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
          .pf0-modal-body { padding-bottom: 20px; }
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

  const initialEditorSnapshot = typeof getCloseSnapshot === "function" ? getCloseSnapshot() : null;

  const buildEditorCloseSnapshot = () => {
    if (typeof getCloseSnapshot !== "function") return null;
    return getCloseSnapshot();
  };

  let _isClosing = false;
  const confirmEditorCloseIfDirty = () => new Promise(resolve => {
    if (!buildEditorCloseSnapshot || buildEditorCloseSnapshot() === initialEditorSnapshot) {
      resolve(true);
      return;
    }
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
      if (typeof onClose === "function") {
        await onClose();
      }
    } catch (error) {
      console.error(error);
      if (typeof notice === "function") notice(`❌ Ошибка закрытия/переименования: ${error?.message || error}`);
    }
    overlay.remove();
    document.removeEventListener('keydown', onKeyDown);
  };

  const overlay = document.createElement('div');
  overlay.id = modalId;
  overlay.className = 'pf0-overlay';
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
  const msc = "pfe";
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
        .${msc}-submit { display: none; }
        .pf0-float-close {
            position: fixed;
            bottom: env(safe-area-inset-bottom, 8px);
        }
    `;
  document.head.appendChild(innerStyle);

  const fieldWrap = document.createElement("div");
  fieldWrap.className = msc;
  modalBody.appendChild(fieldWrap);

  const inputs = {};
  let curSection = "";
  PATIENT_EDITOR_FIELDS.forEach((field) => {
    if (field.key === "Палата" && getVal("КС") !== "КС") return;
    if (field.section !== curSection) {
      curSection = field.section;
      const sec = document.createElement("div");
      sec.style.cssText = "font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted);margin:14px 0 6px;padding-bottom:4px;border-bottom:1px solid var(--background-modifier-border);";
      sec.textContent = curSection;
      fieldWrap.appendChild(sec);
    }
    const row = document.createElement("div");
    row.style.cssText = "display:flex;flex-direction:column;gap:3px;margin-bottom:10px;";
    const label = document.createElement("label");
    label.style.cssText = "font-size:12px;color:var(--text-muted);";
    label.textContent = field.label;
    row.appendChild(label);

    let inp;
    const curVal = getVal(field.key);
    if (field.type === "select") {
      inp = document.createElement("select");
      inp.style.cssText = "height:34px;border-radius:6px;border:1px solid var(--background-modifier-border);background:var(--background-primary);color:var(--text-normal);padding:0 8px;font-size:13px;";
      field.opts.forEach((opt, oi) => {
        const option = document.createElement("option");
        option.textContent = opt;
        const opVal = field.vals ? field.vals[oi] : opt;
        option.value = opVal === null || opVal === undefined ? "" : String(opVal);
        if (curVal !== null && curVal !== undefined && String(curVal) === option.value) option.selected = true;
        inp.appendChild(option);
      });
    } else if (field.type === "date") {
      inp = document.createElement("input");
      inp.type = "date";
      inp.style.cssText = "height:34px;border-radius:6px;border:1px solid var(--background-modifier-border);background:var(--background-primary);color:var(--text-normal);padding:0 8px;font-size:13px;box-sizing:border-box;width:100%;";
      if (curVal) inp.value = String(curVal).slice(0, 10);
    } else if (field.type === "textarea") {
      inp = document.createElement("textarea");
      inp.rows = 4;
      inp.style.cssText = "min-height:92px;border-radius:6px;border:1px solid var(--background-modifier-border);background:var(--background-primary);color:var(--text-normal);padding:8px 10px;font-size:13px;box-sizing:border-box;width:100%;resize:vertical;line-height:1.45;";
      if (curVal !== null && curVal !== undefined) inp.value = String(curVal);
    } else {
      inp = document.createElement("input");
      inp.type = "text";
      inp.style.cssText = "height:34px;border-radius:6px;border:1px solid var(--background-modifier-border);background:var(--background-primary);color:var(--text-normal);padding:0 10px;font-size:13px;box-sizing:border-box;width:100%;";
      if (curVal !== null && curVal !== undefined) inp.value = String(curVal);
    }
    inputs[field.key] = { inp, field };
    row.appendChild(inp);
    fieldWrap.appendChild(row);
  });

  const btnRow2 = document.createElement("div");
  btnRow2.style.cssText = "display:flex;gap:10px;justify-content:flex-end;margin-top:18px;padding-top:14px;border-top:1px solid var(--background-modifier-border);";
  const cancelBtn = document.createElement("button");
  cancelBtn.textContent = "Отмена";
  cancelBtn.style.cssText = "padding:8px 18px;border:1px solid var(--background-modifier-border);border-radius:6px;background:none;color:var(--text-normal);cursor:pointer;font-size:13px;";
  cancelBtn.onclick = doClose;
  const saveBtn = document.createElement("button");
  saveBtn.textContent = "💾 Сохранить";
  saveBtn.style.cssText = "padding:8px 18px;border:none;border-radius:6px;background:#2196f3;color:#fff;cursor:pointer;font-size:13px;font-weight:600;";
  saveBtn.onclick = () => {
    const updates = collectPatientEditorUpdates(inputs);
    saveNow(updates);
    overlay.remove();
    if (typeof notice === "function") notice("✅ Поля для БД сохранены в карте пациента");
  };
  btnRow2.appendChild(cancelBtn);
  btnRow2.appendChild(saveBtn);
  fieldWrap.appendChild(btnRow2);

  overlay.onclick = (e) => { if (e.target === overlay) doClose(); };
  };
};

const mountPatientEditorControls = ({
  dv,
  cur,
  saveNow,
  getVal,
  getQLQModule,
  notice = null,
  qrlDomain = "qlq.example.com",
  openPatientCardEditorModal: providedOpenPatientCardEditorModal = null,
  getCloseSnapshot = null,
  onClose = null
} = {}) => {
  if (!dv?.el) throw new Error("mountPatientEditorControls: dv.el is required");
  if (!cur) throw new Error("mountPatientEditorControls: cur is required");
  if (typeof saveNow !== "function") throw new Error("mountPatientEditorControls: saveNow is required");
  if (typeof getVal !== "function") throw new Error("mountPatientEditorControls: getVal is required");
  if (typeof getQLQModule !== "function") throw new Error("mountPatientEditorControls: getQLQModule is required");

  const root = dv.el("div", "");
  root.style.cssText = "margin:16px 0 8px 0;";

  const btnRow = document.createElement("div");
  btnRow.style.cssText = "display:flex;gap:8px;flex-wrap:wrap;align-items:center;";
  root.appendChild(btnRow);

  const dbEditBtn = document.createElement("button");
  dbEditBtn.style.cssText = "padding:8px 18px;background:var(--background-secondary);border:1px solid var(--background-modifier-border);border-radius:8px;cursor:pointer;font-size:13px;color:var(--text-normal);display:inline-flex;align-items:center;gap:8px;transition:background .15s;";
  dbEditBtn.innerHTML = `<span>📊</span><span>Редактировать данные БД</span>`;
  dbEditBtn.onmouseenter = () => { dbEditBtn.style.background = "var(--background-modifier-hover)"; };
  dbEditBtn.onmouseleave = () => { dbEditBtn.style.background = "var(--background-secondary)"; };
  btnRow.appendChild(dbEditBtn);

  const qrToggleBtn = document.createElement("button");
  qrToggleBtn.style.cssText = "padding:8px 14px;background:var(--background-secondary);border:1px solid var(--background-modifier-border);border-radius:8px;cursor:pointer;font-size:13px;color:var(--text-muted);display:inline-flex;align-items:center;gap:6px;transition:background .15s;";
  qrToggleBtn.innerHTML = `<span>📱</span><span>QLQ QR</span>`;
  qrToggleBtn.onmouseenter = () => { qrToggleBtn.style.background = "var(--background-modifier-hover)"; };
  qrToggleBtn.onmouseleave = () => { qrToggleBtn.style.background = "var(--background-secondary)"; };
  btnRow.appendChild(qrToggleBtn);

  const qrPanel = document.createElement("div");
  qrPanel.style.cssText = "display:none;margin-top:10px;padding:12px;background:var(--background-secondary);border:1px solid var(--background-modifier-border);border-radius:8px;";
  root.appendChild(qrPanel);

  const qlqModule = getQLQModule(cur["МКБ 10"]);
  const QRL_DOMAIN = qrlDomain || "qlq.example.com";

  let qrDiv = null;
  if (cur.ID_пациента) {
    const qUrl = `https://${QRL_DOMAIN}/q/${cur.ID_пациента}` + (qlqModule ? `?m=${qlqModule}` : "");
    const qrInner = document.createElement("div");
    qrInner.style.cssText = "display:flex;align-items:flex-start;gap:14px;flex-wrap:wrap;";
    qrDiv = document.createElement("div");
    qrDiv.style.cssText = "background:#fff;padding:4px;border-radius:6px;border:1px solid #ccc;flex-shrink:0;";
    const qrMeta = document.createElement("div");
    qrMeta.style.cssText = "font-size:12px;color:var(--text-muted);line-height:1.6;";
    qrMeta.innerHTML = `
        <div style="font-weight:700;font-size:13px;color:var(--text-normal);margin-bottom:4px;">
            EORTC QLQ-C30${qlqModule ? " + " + qlqModule : ""}
        </div>
        <div style="font-size:10px;word-break:break-all;max-width:240px;opacity:.75;">${qUrl}</div>
        <div style="margin-top:6px;font-size:11px;">
            <span style="color:var(--text-accent)">ID пациента:</span>
            <strong style="font-family:monospace;letter-spacing:1px;">${cur.ID_пациента}</strong>
        </div>`;
    qrInner.appendChild(qrDiv);
    qrInner.appendChild(qrMeta);
    qrPanel.appendChild(qrInner);

    const doQR = () => {
      try {
        new window.QRCode(qrDiv, {
          text: qUrl,
          width: 96,
          height: 96,
          colorDark: "#000",
          colorLight: "#fff",
          correctLevel: window.QRCode.CorrectLevel.M
        });
      } catch (error) {}
    };

    qrToggleBtn.onclick = () => {
      const visible = qrPanel.style.display !== "none";
      qrPanel.style.display = visible ? "none" : "block";
      qrToggleBtn.style.color = visible ? "var(--text-muted)" : "var(--text-accent)";
      qrToggleBtn.style.borderColor = visible ? "var(--background-modifier-border)" : "var(--interactive-accent)";
      if (!visible && !qrDiv.firstChild) {
        if (window.QRCode) {
          doQR();
        } else {
          const sc = document.createElement("script");
          sc.src = "https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js";
          sc.onload = () => { if (document.body.contains(qrDiv)) doQR(); };
          document.head.appendChild(sc);
        }
      }
    };
  } else {
    qrToggleBtn.style.opacity = "0.4";
    qrToggleBtn.title = "ID пациента не присвоен";
    qrToggleBtn.disabled = true;
  }

  const openPatientCardEditorModalFn = providedOpenPatientCardEditorModal || openPatientCardEditorModal({
    dv,
    cur,
    saveNow,
    getVal,
    getQLQModule,
    notice,
    qrlDomain,
    getCloseSnapshot,
    onClose
  });

  dbEditBtn.onclick = openPatientCardEditorModalFn;
  return root;
};

module.exports = {
  PATIENT_EDITOR_FIELDS,
  normalizePatientEditorValue,
  collectPatientEditorUpdates,
  openPatientCardEditorModal,
  mountPatientEditorControls
};
