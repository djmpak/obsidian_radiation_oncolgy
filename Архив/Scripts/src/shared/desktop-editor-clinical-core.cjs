"use strict";

const mountNewPatientClinicalSection = ({
  wrap,
  modal,
  msc,
  MODAL_ID,
  getVal,
  field,
  saveNow,
  window: runtimeWindow = globalThis.window,
  document: runtimeDocument = globalThis.document,
  dv = globalThis.dv,
  _pfDesktopCore,
  NEW_PATIENT_ANAM_FIELDS,
  SUGGEST,
  renderAC,
  positionAC,
  setAcInput = null,
  setAcList = null,
  notice = null
} = {}) => {
  if (!wrap) throw new Error("mountNewPatientClinicalSection: wrap is required");
  if (!modal) throw new Error("mountNewPatientClinicalSection: modal is required");
  if (!msc) throw new Error("mountNewPatientClinicalSection: msc is required");
  if (!MODAL_ID) throw new Error("mountNewPatientClinicalSection: MODAL_ID is required");
  if (typeof getVal !== "function") throw new Error("mountNewPatientClinicalSection: getVal is required");
  if (typeof field !== "function") throw new Error("mountNewPatientClinicalSection: field is required");
  if (typeof saveNow !== "function") throw new Error("mountNewPatientClinicalSection: saveNow is required");
  if (!runtimeWindow) throw new Error("mountNewPatientClinicalSection: window is required");
  if (!runtimeDocument) throw new Error("mountNewPatientClinicalSection: document is required");
  if (!_pfDesktopCore) throw new Error("mountNewPatientClinicalSection: _pfDesktopCore is required");
  if (!Array.isArray(NEW_PATIENT_ANAM_FIELDS)) throw new Error("mountNewPatientClinicalSection: NEW_PATIENT_ANAM_FIELDS is required");
  if (!SUGGEST) throw new Error("mountNewPatientClinicalSection: SUGGEST is required");
  if (typeof renderAC !== "function") throw new Error("mountNewPatientClinicalSection: renderAC is required");
  if (typeof positionAC !== "function") throw new Error("mountNewPatientClinicalSection: positionAC is required");

  const notify = typeof notice === "function" ? notice : (message) => console.log(message);
  const setInput = typeof setAcInput === "function" ? setAcInput : () => {};
  const setList = typeof setAcList === "function" ? setAcList : () => {};

  const clinWrap = runtimeDocument.createElement("div");
  clinWrap.style.cssText = "margin-top:16px;margin-bottom:8px; border-radius:8px; transition:box-shadow .15s;";
  const CLIN_OPEN_KEY = "pf-clin-open-" + MODAL_ID;

  const renderClin = () => {
    clinWrap.innerHTML = "";
    const hasAnam = NEW_PATIENT_ANAM_FIELDS.some(([, k]) => getVal(k));
    const hasLabs = Array.isArray(getVal("Лабораторные")) && getVal("Лабораторные").length > 0;
    const isOpen = runtimeWindow[CLIN_OPEN_KEY] !== undefined ? runtimeWindow[CLIN_OPEN_KEY] : (hasAnam || hasLabs);

    const clinHdr = runtimeDocument.createElement("button");
    clinHdr.style.cssText = `width:100%;box-sizing:border-box;display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:var(--background-primary);border:1px solid var(--background-modifier-border);border-radius:${isOpen ? "8px 8px 0 0" : "8px"};color:var(--text-accent);font-size:0.75em;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;cursor:pointer;touch-action:manipulation;transition:background .15s,box-shadow .15s;`;
    clinHdr.innerHTML = `<span style="display:flex;align-items:center;gap:8px;">── Анамнез и Анализы</span><span style="font-size:11px;opacity:.7;">${isOpen ? "▼" : "▶"}</span>`;
    clinHdr.onmouseenter = () => { clinHdr.style.background = "var(--background-modifier-hover)"; clinWrap.style.boxShadow = "0 0 0 3px var(--background-modifier-border)"; };
    clinHdr.onmouseleave = () => { clinHdr.style.background = "var(--background-primary)"; clinWrap.style.boxShadow = "none"; };
    clinHdr.onclick = () => { runtimeWindow[CLIN_OPEN_KEY] = !isOpen; renderClin(); };
    clinWrap.appendChild(clinHdr);

    if (!isOpen) return;

    const clinBody = runtimeDocument.createElement("div");
    clinBody.style.cssText = "border:1px solid var(--background-modifier-border);border-top:none;border-radius:0 0 8px 8px;padding:16px 12px;display:flex;flex-direction:column;gap:20px;background:var(--background-primary);box-sizing:border-box;";

    const anamBlock = runtimeDocument.createElement("div");
    anamBlock.style.cssText = "display:flex;flex-direction:column;gap:0;";
    NEW_PATIENT_ANAM_FIELDS.forEach(([label, key]) => field(anamBlock, label, key, "textarea"));
    clinBody.appendChild(anamBlock);

    const LAB_GROUPS = _pfDesktopCore.LAB_GROUPS;
    const LAB_CHART_COLORS = _pfDesktopCore.LAB_CHART_COLORS;

    const labSec = runtimeDocument.createElement("div");
    const labSecHdr = runtimeDocument.createElement("div");
    labSecHdr.style.cssText = "display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;";

    const labSecTitle = runtimeDocument.createElement("div");
    labSecTitle.textContent = "── Лабораторные данные";
    labSecTitle.className = `${msc}-sec-title`;
    labSecTitle.style.marginTop = "0";
    labSecHdr.appendChild(labSecTitle);

    const addLabBtn = runtimeDocument.createElement("button");
    addLabBtn.textContent = "+ Добавить анализы";
    addLabBtn.style.cssText = "font-size:11px;color:var(--text-accent);background:none;border:1px solid var(--text-accent);border-radius:4px;padding:3px 8px;cursor:pointer;";
    labSecHdr.appendChild(addLabBtn);
    labSec.appendChild(labSecHdr);

    const CHART_GRP_KEY = "lab_chart_grp_" + MODAL_ID;
    const chartArea = runtimeDocument.createElement("div");
    chartArea.style.cssText = "display:none;border:1px solid var(--background-modifier-border);border-radius:8px;padding:10px 12px;margin-bottom:8px;background:var(--background-secondary);";

    const CHEMO_KEY_PARAMS = ["Гемоглобин", "Лейкоциты", "Нейтрофилы", "Тромбоциты", "АЛТ", "АСТ", "Креатинин", "Билирубин", "ПСА"];
    const groupBtnsRow = runtimeDocument.createElement("div");
    groupBtnsRow.style.cssText = "display:flex;gap:5px;flex-wrap:wrap;margin-bottom:8px;";
    const mainBtn = runtimeDocument.createElement("button");
    mainBtn.textContent = "── Основное";
    mainBtn.style.cssText = "font-size:10px;padding:3px 10px;border:1px solid #00897b;border-radius:12px;cursor:pointer;transition:all 0.15s;background:#00897b;color:#fff;font-weight:700;white-space:nowrap;";
    groupBtnsRow.appendChild(mainBtn);
    const groupBtns = LAB_GROUPS.map((group) => {
      const btn = runtimeDocument.createElement("button");
      btn.textContent = group.name;
      btn.style.cssText = `font-size:10px;padding:3px 10px;border:1px solid ${group.color};border-radius:12px;cursor:pointer;transition:all 0.15s;background:none;color:${group.color};white-space:nowrap;`;
      groupBtnsRow.appendChild(btn);
      return btn;
    });
    chartArea.appendChild(groupBtnsRow);

    const chartWrap = runtimeDocument.createElement("div");
    chartWrap.style.cssText = "width:100%;height:230px;position:relative;";
    const chartCanvas = runtimeDocument.createElement("canvas");
    chartWrap.appendChild(chartCanvas);
    chartArea.appendChild(chartWrap);
    labSec.appendChild(chartArea);

    const tableWrap = runtimeDocument.createElement("div");
    tableWrap.style.cssText = "overflow-x:auto;-webkit-overflow-scrolling:touch;border:1px solid var(--background-modifier-border);border-radius:6px;";
    labSec.appendChild(tableWrap);

    const renderLabEditor = () => {
      tableWrap.innerHTML = "";
      const rawLabs = getVal("Лабораторные");
      let labData = Array.isArray(rawLabs) ? [...rawLabs] : [];
      labData.sort((a, b) => _pfDesktopCore.normalizeLabDateKey(b.Дата, (value) => dv?.date?.(value)).localeCompare(_pfDesktopCore.normalizeLabDateKey(a.Дата, (value) => dv?.date?.(value))));

      if (labData.length > 1) {
        chartArea.style.display = "block";
        const activeGrp = runtimeWindow[CHART_GRP_KEY] ?? -1;

        const drawGroupChart = (gIdx) => {
          runtimeWindow[CHART_GRP_KEY] = gIdx;
          mainBtn.style.background = gIdx === -1 ? "#00897b" : "none";
          mainBtn.style.color = gIdx === -1 ? "#fff" : "#00897b";
          mainBtn.style.fontWeight = gIdx === -1 ? "700" : "400";
          groupBtns.forEach((btn, j) => {
            const isActive = j === gIdx;
            btn.style.background = isActive ? LAB_GROUPS[j].color : "none";
            btn.style.color = isActive ? "#fff" : LAB_GROUPS[j].color;
            btn.style.fontWeight = isActive ? "700" : "400";
          });
          const paramsToChart = gIdx === -1
            ? CHEMO_KEY_PARAMS.flatMap(p => { for (const g of LAB_GROUPS) { if (g.params[p] && !g.params[p].qualitative) return [[p, g.params[p]]]; } return []; })
            : Object.entries(LAB_GROUPS[gIdx].params).filter(([, ref]) => !ref.qualitative);
          const labels = [...labData].reverse().map(e => {
            try { const d = dv.date(e.Дата); return d ? d.toFormat("dd.MM.yy") : (e.Дата || ""); } catch (_) { return e.Дата || ""; }
          });
          let colorIdx = 0;
          const paramDatasets = [];
          paramsToChart.forEach(([param, ref]) => {
            const range = ref.max - ref.min;
            const chartEntries = [...labData].reverse();
            const absVals = chartEntries.map(e => {
              const v = e[param];
              if (v === undefined || v === null || v === "") return null;
              const n = Number(String(v).replace(",", "."));
              return Number.isFinite(n) ? n : null;
            });
            const vals = chartEntries.map(e => {
              const v = e[param];
              if (v === undefined || v === null || v === "") return null;
              const n = Number(String(v).replace(",", "."));
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
              if (!noDataMsg) {
                const m = runtimeDocument.createElement("div");
                m.className = "lab-no-chart";
                m.textContent = "Нет данных для графика (нужно >= 2 записей с одним показателем)";
                m.style.cssText = "font-size:11px;color:var(--text-faint);text-align:center;padding:30px 10px;";
                chartWrap.appendChild(m);
              }
              return;
            }
            if (noDataMsg) noDataMsg.remove();
            const refBand = [
              { label: "_min", data: labels.map(() => 0), borderColor: "transparent", backgroundColor: "rgba(76,175,80,0.10)", fill: "+1", pointRadius: 0, borderWidth: 0 },
              { label: "_max", data: labels.map(() => 100), borderColor: "rgba(76,175,80,0.5)", backgroundColor: "rgba(76,175,80,0.10)", fill: "-1", pointRadius: 0, borderWidth: 1, borderDash: [4, 3] },
            ];
            chartWrap._chart = new runtimeWindow.Chart(chartCanvas, {
              type: "line",
              data: { labels, datasets: [...refBand, ...paramDatasets] },
              options: {
                maintainAspectRatio: false,
                interaction: { mode: "index", intersect: false },
                plugins: {
                  legend: { position: "bottom", labels: { color: "var(--text-normal)", font: { size: 10 }, boxWidth: 12, padding: 8, filter: item => !item.text.startsWith("_") } },
                  tooltip: {
                    callbacks: {
                      label: ctx => {
                        if (ctx.dataset.label.startsWith("_")) return null;
                        const raw = Array.isArray(ctx.dataset.absData) ? ctx.dataset.absData[ctx.dataIndex] : null;
                        const unit = ctx.dataset.unit ? ` ${ctx.dataset.unit}` : "";
                        const rawText = raw !== null && raw !== undefined ? ` (${String(raw).replace(".", ",")}${unit})` : "";
                        return ` ${ctx.dataset.label}: ${ctx.parsed.y}% от нормы${rawText}`;
                      }
                    }
                  }
                },
                scales: {
                  x: { ticks: { color: "var(--text-muted)", font: { size: 10 }, maxRotation: 45, minRotation: 45 } },
                  y: { title: { display: true, text: "% от нормативного диапазона", color: "var(--text-muted)", font: { size: 9 } }, ticks: { color: "var(--text-muted)", font: { size: 10 }, callback: v => v + "%" } }
                }
              }
            });
          };
          if (!runtimeWindow.Chart) {
            const s = runtimeDocument.createElement("script");
            s.src = "https://cdn.jsdelivr.net/npm/chart.js";
            s.onload = renderChart;
            runtimeDocument.head.appendChild(s);
          } else {
            renderChart();
          }
        };

        mainBtn.onclick = () => drawGroupChart(-1);
        groupBtns.forEach((btn, i) => { btn.onclick = () => drawGroupChart(i); });
        drawGroupChart(activeGrp);
      } else {
        chartArea.style.display = "none";
      }

      if (labData.length === 0) {
        const emptyMsg = runtimeDocument.createElement("div");
        emptyMsg.textContent = "Нет записей. Нажмите «+ Добавить анализы» чтобы начать.";
        emptyMsg.style.cssText = "font-size:12px;color:var(--text-faint);padding:16px;text-align:center;";
        tableWrap.appendChild(emptyMsg);
        return;
      }

      const hasParamValue = (param) => labData.some(e => e[param] !== undefined && e[param] !== null && e[param] !== "");
      const table = runtimeDocument.createElement("table");
      table.style.cssText = "border-collapse:collapse;font-size:12px;min-width:max-content;width:100%;text-align:center;";
      const thead = runtimeDocument.createElement("thead");
      const hRow = runtimeDocument.createElement("tr");

      const th0 = runtimeDocument.createElement("th");
      th0.textContent = "Показатель";
      th0.style.cssText = "text-align:left;padding:8px 10px;border-bottom:2px solid var(--background-modifier-border);color:var(--text-muted);font-weight:700;position:sticky;left:0;background:var(--background-primary);z-index:2;min-width:130px;";
      hRow.appendChild(th0);

      labData.forEach((entry, colIdx) => {
        const th = runtimeDocument.createElement("th");
        th.style.cssText = "padding:6px 8px;border-bottom:2px solid var(--background-modifier-border);min-width:110px;background:var(--background-primary);";
        const thTop = runtimeDocument.createElement("div");
        thTop.style.cssText = "display:flex;flex-direction:column;gap:4px;align-items:center;";

        const dateInp = runtimeDocument.createElement("input");
        dateInp.type = "date";
        dateInp.className = "lab-date-inp";
        let isoD = "";
        try { if (entry.Дата) { const d = dv.date(entry.Дата); if (d) isoD = d.toFormat("yyyy-MM-dd"); } } catch (_) {}
        dateInp.value = isoD;
        dateInp.style.cssText = "width:100%;border:1px solid var(--background-modifier-border);background:var(--background-primary);color:var(--text-normal);border-radius:4px;padding:2px 4px;font-size:11px;outline:none;box-sizing:border-box;";
        dateInp.onfocus = () => dateInp.style.borderColor = "var(--interactive-accent)";
        dateInp.onblur = () => dateInp.style.borderColor = "var(--background-modifier-border)";
        dateInp.onchange = () => { labData[colIdx].Дата = dateInp.value; saveNow({ "Лабораторные": labData }); renderLabEditor(); };

        const delBtn = runtimeDocument.createElement("button");
        delBtn.textContent = "🗑️ Удалить";
        delBtn.style.cssText = "font-size:10px;color:#e53935;background:none;border:none;cursor:pointer;width:100%;text-align:center;padding:2px 0;border-radius:2px;";
        delBtn.onmouseenter = () => delBtn.style.background = "rgba(229,57,53,0.08)";
        delBtn.onmouseleave = () => delBtn.style.background = "none";
        delBtn.onclick = () => { labData.splice(colIdx, 1); saveNow({ "Лабораторные": labData.length ? labData : null }); renderLabEditor(); };

        thTop.appendChild(dateInp);
        thTop.appendChild(delBtn);
        th.appendChild(thTop);
        hRow.appendChild(th);
      });

      const thNorm = runtimeDocument.createElement("th");
      thNorm.textContent = "Норма";
      thNorm.style.cssText = "padding:8px 10px;border-bottom:2px solid var(--background-modifier-border);color:var(--text-muted);font-weight:700;min-width:110px;";
      hRow.appendChild(thNorm);
      thead.appendChild(hRow);
      table.appendChild(thead);

      const tbody = runtimeDocument.createElement("tbody");
      LAB_GROUPS.forEach(group => {
        const visParams = Object.entries(group.params).filter(([p]) => hasParamValue(p));
        if (visParams.length === 0) return;

        const grpTr = runtimeDocument.createElement("tr");
        const grpTd = runtimeDocument.createElement("td");
        grpTd.colSpan = labData.length + 2;
        grpTd.textContent = group.name;
        grpTd.style.cssText = `padding:7px 10px 5px;font-size:11px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;color:${group.color};background:var(--background-secondary);border-top:2px solid ${group.color}40;border-bottom:1px solid var(--background-modifier-border);`;
        grpTr.appendChild(grpTd);
        tbody.appendChild(grpTr);

        visParams.forEach(([param, ref]) => {
          const tr = runtimeDocument.createElement("tr");
          tr.onmouseenter = () => tr.style.background = "var(--background-modifier-hover)";
          tr.onmouseleave = () => tr.style.background = "";

          const tdLabel = runtimeDocument.createElement("td");
          tdLabel.textContent = param.replace(/_/g, " ");
          tdLabel.style.cssText = "text-align:left;padding:5px 10px;border-bottom:1px solid var(--background-modifier-border);color:var(--text-normal);font-weight:500;white-space:nowrap;position:sticky;left:0;background:var(--background-primary);z-index:1;font-size:12px;";
          tr.appendChild(tdLabel);

          labData.forEach((entry, colIdx) => {
            const td = runtimeDocument.createElement("td");
            td.style.cssText = "padding:3px 8px;border-bottom:1px solid var(--background-modifier-border);";
            const rawVal = entry[param];
            const isQual = !!ref.qualitative;
            const valInp = runtimeDocument.createElement("input");
            valInp.type = isQual ? "text" : "number";
            if (!isQual) valInp.step = "any";
            valInp.value = (rawVal !== undefined && rawVal !== null) ? rawVal : "";
            const numVal = isQual ? NaN : Number(String(valInp.value).replace(",", "."));
            const isAbnormal = !isQual && valInp.value !== "" && Number.isFinite(numVal) && (numVal < ref.min || numVal > ref.max);
            valInp.style.cssText = `width:${isQual ? "90px" : "65px"};text-align:center;border:none;background:transparent;font-size:12px;outline:none;color:${isAbnormal ? "#e53935" : "var(--text-normal)"};font-weight:${isAbnormal ? "700" : "400"};border-bottom:1px solid transparent;border-radius:2px;padding:1px 2px;`;
            valInp.onfocus = () => { valInp.style.borderBottom = "1px solid var(--interactive-accent)"; valInp.style.background = "var(--background-secondary)"; };
            valInp.onblur = () => { valInp.style.borderBottom = "1px solid transparent"; valInp.style.background = "transparent"; };
            valInp.onchange = () => {
              const v = valInp.value;
              if (v === "") delete labData[colIdx][param];
              else labData[colIdx][param] = isQual ? v : Number(v);
              saveNow({ "Лабораторные": labData });
              renderLabEditor();
            };
            const cellWrap = runtimeDocument.createElement("div");
            cellWrap.style.cssText = "display:flex;flex-direction:column;align-items:center;";
            const valRow = runtimeDocument.createElement("div");
            valRow.style.cssText = "display:flex;align-items:center;justify-content:center;gap:1px;";
            valRow.appendChild(valInp);
            if (colIdx === 0 && labData.length > 1 && !isQual && valInp.value !== "") {
              const prevRaw = labData[1][param];
              if (prevRaw !== undefined && prevRaw !== null && prevRaw !== "") {
                const prev = Number(String(prevRaw).replace(",", "."));
                if (Number.isFinite(numVal) && Number.isFinite(prev) && Math.abs(numVal - prev) > 1e-9) {
                  const trendEl = runtimeDocument.createElement("span");
                  trendEl.textContent = numVal > prev ? "▲" : "▼";
                  trendEl.style.cssText = `font-size:11px;font-weight:700;color:${isAbnormal ? "#e53935" : "#00897b"};line-height:1;`;
                  valRow.appendChild(trendEl);
                }
              }
            }
            cellWrap.appendChild(valRow);
            if (!isQual) {
              const range = ref.max - ref.min;
              const bar = runtimeDocument.createElement("div");
              bar.style.cssText = "height:5px;border-radius:3px;margin-top:2px;overflow:visible;min-width:65px;position:relative;background:linear-gradient(to right,rgba(239,83,80,0.45) 0%,rgba(239,83,80,0.45) 25%,rgba(67,160,71,0.45) 25%,rgba(67,160,71,0.45) 75%,rgba(239,83,80,0.45) 75%,rgba(239,83,80,0.45) 100%);";
              if (valInp.value !== "" && Number.isFinite(numVal) && range > 0) {
                const pos = Math.max(2, Math.min(98, 25 + ((numVal - ref.min) / range) * 50));
                const ind = runtimeDocument.createElement("div");
                ind.style.cssText = `position:absolute;top:-1px;left:${pos}%;width:3px;height:7px;background:${isAbnormal ? "#e53935" : "#1b5e20"};transform:translateX(-50%);border-radius:2px;box-shadow:0 0 0 1px rgba(255,255,255,0.4);`;
                bar.appendChild(ind);
              }
              cellWrap.appendChild(bar);
            }
            td.appendChild(cellWrap);
            tr.appendChild(td);
          });

          const tdRef = runtimeDocument.createElement("td");
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
      const isoToday = runtimeWindow.moment().format("YYYY-MM-DD");
      curLabs.push({ Дата: isoToday });
      saveNow({ "Лабораторные": curLabs });
      renderLabEditor();
    };

    renderLabEditor();
    clinBody.appendChild(labSec);
    clinWrap.appendChild(clinBody);
  };

  renderClin();
  wrap.appendChild(clinWrap);
  return clinWrap;
};

module.exports = {
  mountNewPatientClinicalSection
};
