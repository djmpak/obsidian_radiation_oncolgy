"use strict";

const HLT_REGIMES = ["Однократно", "Ежедневно", "Еженедельно", "Раз в 14 дней", "Раз в 21 день", "В дни лучевой терапии"];

const mountDesktopHltSection = async ({
  anchor,
  modal,
  getVal,
  saveNow,
  mkAddBtn,
  mkInlineBtn,
  mkSecHeader,
  mkEntryCard,
  mkField,
  mkDateField,
  defaultHltDateISO = "",
  initialDrugs = [],
  document = modal?.ownerDocument,
  dv
} = {}) => {
  if (!anchor) throw new Error("mountDesktopHltSection: anchor is required");
  if (!modal) throw new Error("mountDesktopHltSection: modal is required");
  if (typeof getVal !== "function") throw new Error("mountDesktopHltSection: getVal is required");
  if (typeof saveNow !== "function") throw new Error("mountDesktopHltSection: saveNow is required");
  if (typeof mkAddBtn !== "function") throw new Error("mountDesktopHltSection: mkAddBtn is required");
  if (typeof mkInlineBtn !== "function") throw new Error("mountDesktopHltSection: mkInlineBtn is required");
  if (typeof mkSecHeader !== "function") throw new Error("mountDesktopHltSection: mkSecHeader is required");
  if (typeof mkEntryCard !== "function") throw new Error("mountDesktopHltSection: mkEntryCard is required");
  if (typeof mkField !== "function") throw new Error("mountDesktopHltSection: mkField is required");
  if (typeof mkDateField !== "function") throw new Error("mountDesktopHltSection: mkDateField is required");
  if (!document) throw new Error("mountDesktopHltSection: document is required");
  if (!dv?.date) throw new Error("mountDesktopHltSection: dv is required");

  const toIsoDate = (raw) => {
    if (!raw) return "";
    try {
      const d = dv.date(raw);
      return d ? d.toFormat("yyyy-MM-dd") : "";
    } catch (_) {
      return "";
    }
  };

  const blankDrug = () => ({ Препарат: "", Режим: HLT_REGIMES[0], Дата: "" });
  const hltWrap = document.createElement("div");
  hltWrap.className = "hlt-section";

  const renderHltSection = (initialItems) => {
    anchor.innerHTML = "";
    anchor.appendChild(hltWrap);
    hltWrap.innerHTML = "";

    const hltHeader = mkSecHeader("── Химиотерапия", "#00bcd4");
    hltWrap.appendChild(hltHeader);

    const drugList = document.createElement("div");
    drugList.style.cssText = "display:flex;flex-direction:column;gap:8px;margin-bottom:8px;";

    const getDrugsFromDOM = () =>
      Array.from(drugList.querySelectorAll(".hlt-drug-row")).map(card => ({
        Препарат: card.querySelector(".hlt-drug-name")?.value?.trim() ?? "",
        Режим: card.querySelector(".hlt-drug-regime")?.value ?? "",
        Дата: card.dataset.hltDate || ""
      })).filter(d => d.Препарат || d.Режим);

    const saveDrugs = () => saveNow({ "ХЛТ_препараты": getDrugsFromDOM() });

    const resetToAddButton = () => {
      anchor.innerHTML = "";
      anchor.appendChild(mkAddBtn("+ Химиотерапия", "#00bcd4", () => renderHltSection([blankDrug()])));
    };

    const collapseHlt = async () => {
      await saveNow({ "ХЛТ_препараты": null, "ХЛТ_дата_старта": null, "Перерыв_ХЛТ": null, "ХЛТ_ручные_даты": null, "Пропущенные_даты_ХЛТ": null });
      resetToAddButton();
    };

    const addDrugRow = (препарат = "", режим = "", датаStr = "") => {
      if (drugList.querySelectorAll(".hlt-drug-row").length >= 2) return;
      const card = mkEntryCard("#00bcd4");
      card.className = "hlt-drug-row";

      const nameInp = document.createElement("input");
      nameInp.type = "text";
      nameInp.value = препарат;
      nameInp.placeholder = "Наименование препарата";
      nameInp.className = "hlt-drug-name";
      nameInp.style.cssText = "width:100%;height:32px;border-radius:6px;border:1px solid var(--background-modifier-border);background:var(--background-primary);color:var(--text-normal);padding:0 8px;font-size:13px;outline:none;transition:border-color 0.15s;box-sizing:border-box;";
      nameInp.onfocus = () => { nameInp.style.borderColor = "var(--interactive-accent)"; };
      nameInp.onblur = () => { nameInp.style.borderColor = "var(--background-modifier-border)"; saveDrugs(); };
      nameInp.oninput = () => saveDrugs();
      card.appendChild(mkField("Препарат", nameInp, () => {
        card.remove();
        saveDrugs();
        addDrugBtn.style.display = "";
        if (drugList.querySelectorAll(".hlt-drug-row").length === 0) collapseHlt();
      }));

      const regSel = document.createElement("select");
      regSel.className = "hlt-drug-regime";
      regSel.style.cssText = "width:100%;height:32px;border-radius:6px;border:1px solid var(--background-modifier-border);background:var(--background-primary);color:var(--text-normal);padding:0 8px;font-size:13px;outline:none;transition:border-color 0.15s;box-sizing:border-box;height:34px;cursor:pointer;";
      regSel.onfocus = () => { regSel.style.borderColor = "var(--interactive-accent)"; };
      regSel.onblur = () => { regSel.style.borderColor = "var(--background-modifier-border)"; };
      HLT_REGIMES.forEach(r => {
        const opt = document.createElement("option");
        opt.textContent = r;
        opt.value = r;
        if (r === режим) opt.selected = true;
        regSel.appendChild(opt);
      });
      regSel.onchange = saveDrugs;
      card.appendChild(mkField("Режим", regSel));

      const initISO = toIsoDate(датаStr) || defaultHltDateISO;
      card.dataset.hltDate = initISO;
      mkDateField(card, "Дата начала", initISO, false, (val) => {
        card.dataset.hltDate = val || "";
        saveDrugs();
      });

      drugList.appendChild(card);
      addDrugBtn.style.display = drugList.querySelectorAll(".hlt-drug-row").length >= 2 ? "none" : "";
    };

    const addDrugBtn = mkInlineBtn("+ Добавить препарат", "#00bcd4", () => {
      if (drugList.querySelectorAll(".hlt-drug-row").length >= 2) return;
      addDrugRow("", HLT_REGIMES[0], "");
      addDrugBtn.style.display = drugList.querySelectorAll(".hlt-drug-row").length >= 2 ? "none" : "";
    });

    initialItems.forEach(d => addDrugRow(d?.Препарат ?? "", d?.Режим ?? "", d?.Дата ?? ""));
    hltWrap.appendChild(drugList);

    const brkWrap = document.createElement("div");
    brkWrap.style.cssText = "margin-bottom:8px; display:flex; flex-direction:column; gap:6px;";

    const renderBreak = () => {
      brkWrap.innerHTML = "";
      const raw = getVal("Перерыв_ХЛТ");
      const brkList = Array.isArray(raw) ? raw : (raw ? [raw] : []);

      const saveBreaks = (newList) => {
        saveNow({ "Перерыв_ХЛТ": newList.length ? newList : null });
        renderBreak();
      };

      brkList.forEach((brk, idx) => {
        const brkCard = mkEntryCard("#00bcd4");
        brkCard.style.borderLeft = "3px solid #9e9e9e";
        const brkHdr = document.createElement("div");
        brkHdr.style.cssText = "display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;";
        const brkLbl = document.createElement("span");
        brkLbl.textContent = `⏸️ Перерыв ${idx + 1}`;
        brkLbl.style.cssText = "font-size:11px;color:var(--text-muted);font-weight:600;";
        const brkDel = document.createElement("button");
        brkDel.textContent = "🗑️ Удалить";
        brkDel.style.cssText = "font-size:11px;color:#e53935;background:none;border:none;cursor:pointer;font-weight:600;padding:2px 6px;border-radius:4px;";
        brkDel.onmouseenter = () => { brkDel.style.background = "rgba(229,57,53,0.1)"; };
        brkDel.onmouseleave = () => { brkDel.style.background = "none"; };
        brkDel.onclick = () => {
          const newList = [...brkList];
          newList.splice(idx, 1);
          saveBreaks(newList);
        };
        brkHdr.appendChild(brkLbl);
        brkHdr.appendChild(brkDel);
        brkCard.appendChild(brkHdr);

        const bkStartISO = toIsoDate(brk?.Дата_начала);
        mkDateField(brkCard, "Начало", bkStartISO, false, (val) => {
          const newList = [...brkList];
          newList[idx] = { ...newList[idx], Дата_начала: val || "" };
          saveNow({ "Перерыв_ХЛТ": newList });
        });

        const bkEndISO = toIsoDate(brk?.Дата_окончания);
        mkDateField(brkCard, "Окончание", bkEndISO, false, (val) => {
          const newList = [...brkList];
          newList[idx] = { ...newList[idx], Дата_окончания: val || "" };
          saveNow({ "Перерыв_ХЛТ": newList });
        });

        brkWrap.appendChild(brkCard);
      });

      brkWrap.appendChild(mkInlineBtn("+ Перерыв", "#9e9e9e", () => {
        saveBreaks([...brkList, { Дата_начала: "", Дата_окончания: "" }]);
      }));
    };

    renderBreak();
    hltWrap.appendChild(brkWrap);

    hltWrap.appendChild(addDrugBtn);
    if (initialItems.length >= 2) addDrugBtn.style.display = "none";
  };

  if (!Array.isArray(initialDrugs) || initialDrugs.length === 0) {
    anchor.appendChild(mkAddBtn("+ Химиотерапия", "#00bcd4", () => renderHltSection([blankDrug()])));
    return;
  }

  renderHltSection(initialDrugs);
};

module.exports = {
  HLT_REGIMES,
  mountDesktopHltSection
};
