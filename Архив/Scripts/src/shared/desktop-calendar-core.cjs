"use strict";

const MONTH_NAMES = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
const WEEKDAY_LABELS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

const createDesktopCalendarRuntime = ({
  dv,
  document,
  window,
  dateNavDiv,
  today,
  realToday,
  dateOffset = 0,
  dateOffsetKey,
  desktopPlatform
} = {}) => {
  if (!dv?.date) throw new Error("createDesktopCalendarRuntime: dv is required");
  if (!document?.createElement) throw new Error("createDesktopCalendarRuntime: document is required");
  if (!window) throw new Error("createDesktopCalendarRuntime: window is required");
  if (!dateNavDiv?.createEl) throw new Error("createDesktopCalendarRuntime: dateNavDiv is required");
  if (!today) throw new Error("createDesktopCalendarRuntime: today is required");
  if (!realToday) throw new Error("createDesktopCalendarRuntime: realToday is required");
  if (!dateOffsetKey) throw new Error("createDesktopCalendarRuntime: dateOffsetKey is required");
  if (typeof desktopPlatform?.reopenCurrentFile !== "function") {
    throw new Error("createDesktopCalendarRuntime: desktopPlatform.reopenCurrentFile is required");
  }

  const _navPrev = dateNavDiv.createEl("button", { cls: "rdt-date-nav-btn" });
  _navPrev.textContent = "◀";
  _navPrev.title = "Предыдущий день";

  const _navToday = dateNavDiv.createEl("button", { cls: "rdt-date-nav-btn rdt-date-nav-center" + (dateOffset === 0 ? " rdt-today-active" : " rdt-today-other") });
  _navToday.textContent = dateOffset === 0 ? "Сегодня" : today.toFormat("dd.MM");
  _navToday.title = dateOffset === 0 ? "Вы смотрите сегодня" : `Просмотр: ${today.toFormat("dd.MM.yyyy")} · Нажмите для возврата`;

  const _navNext = dateNavDiv.createEl("button", { cls: "rdt-date-nav-btn" });
  _navNext.textContent = "▶";
  _navNext.title = "Следующий день";

  const _navDate = async (newOffset) => {
    try { window.localStorage?.setItem?.(dateOffsetKey, String(newOffset)); } catch (e) { }
    return await desktopPlatform.reopenCurrentFile();
  };

  _navPrev.onclick = () => _navDate(dateOffset - 1);
  _navNext.onclick = () => _navDate(dateOffset + 1);

  _navToday.title = "Выбрать дату";

  let _calOpen = false;
  let _calYear = today.year;
  let _calMonth = today.month;

  const calPopup = document.createElement("div");
  calPopup.style.cssText = "display:none;position:fixed;z-index:9999;background:var(--background-primary);border:1px solid var(--background-modifier-border);border-radius:10px;box-shadow:0 4px 20px rgba(0,0,0,0.18);padding:10px 8px 8px;user-select:none;width:224px;";
  document.body.appendChild(calPopup);

  const _positionCal = () => {
    const r = _navToday.getBoundingClientRect();
    let left = r.left + r.width / 2 - 112;
    left = Math.max(6, Math.min(left, window.innerWidth - 230));
    calPopup.style.left = left + "px";
    calPopup.style.top = (r.bottom + 6) + "px";
  };

  const _renderCal = () => {
    calPopup.innerHTML = "";

    const hdr = document.createElement("div");
    hdr.style.cssText = "display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;";

    const pBtn = document.createElement("button");
    pBtn.textContent = "◀";
    pBtn.style.cssText = "background:none;border:none;cursor:pointer;color:var(--text-muted);padding:2px 7px;border-radius:4px;font-size:13px;line-height:1;";

    const nBtn = document.createElement("button");
    nBtn.textContent = "▶";
    nBtn.style.cssText = pBtn.style.cssText;

    const mLbl = document.createElement("span");
    mLbl.style.cssText = "font-weight:700;font-size:0.88em;color:var(--text-normal);";
    mLbl.textContent = `${MONTH_NAMES[_calMonth - 1]} ${_calYear}`;

    pBtn.onclick = (e) => {
      e.stopPropagation();
      _calMonth--;
      if (_calMonth < 1) {
        _calMonth = 12;
        _calYear--;
      }
      _renderCal();
    };
    nBtn.onclick = (e) => {
      e.stopPropagation();
      _calMonth++;
      if (_calMonth > 12) {
        _calMonth = 1;
        _calYear++;
      }
      _renderCal();
    };

    hdr.appendChild(pBtn);
    hdr.appendChild(mLbl);
    hdr.appendChild(nBtn);
    calPopup.appendChild(hdr);

    const dowRow = document.createElement("div");
    dowRow.style.cssText = "display:grid;grid-template-columns:repeat(7,1fr);margin-bottom:3px;";
    WEEKDAY_LABELS.forEach(label => {
      const el = document.createElement("div");
      el.textContent = label;
      el.style.cssText = "text-align:center;font-size:0.7em;color:var(--text-muted);padding:1px 0;";
      dowRow.appendChild(el);
    });
    calPopup.appendChild(dowRow);

    const grid = document.createElement("div");
    grid.style.cssText = "display:grid;grid-template-columns:repeat(7,1fr);gap:2px;";
    const firstDay = dv.date(`${_calYear}-${String(_calMonth).padStart(2, "0")}-01`);
    const startDow = firstDay.weekday;
    const daysInMonth = firstDay.daysInMonth;
    const todayIso = realToday.toISODate();
    const viewedIso = today.toISODate();

    for (let i = 1; i < startDow; i++) grid.appendChild(document.createElement("div"));

    for (let d = 1; d <= daysInMonth; d++) {
      const dayDate = firstDay.plus({ days: d - 1 });
      const dayIso = dayDate.toISODate();
      const isToday_ = dayIso === todayIso;
      const isViewed = dayIso === viewedIso;
      const dow = dayDate.weekday;
      const offset = Math.round(dayDate.startOf("day").diff(realToday.startOf("day"), "days").days);

      const cell = document.createElement("button");
      cell.textContent = String(d);
      let cellCss = "border:none;cursor:pointer;border-radius:5px;padding:4px 2px;font-size:0.83em;text-align:center;transition:background 0.1s;";
      if (isViewed) {
        cellCss += "background:var(--interactive-accent);color:white;font-weight:700;";
      } else if (isToday_) {
        cellCss += "background:transparent;color:var(--interactive-accent);font-weight:700;box-shadow:inset 0 0 0 1px var(--interactive-accent);";
      } else if (dow === 6 || dow === 7) {
        cellCss += "background:transparent;color:#ff7043;font-weight:400;";
      } else {
        cellCss += "background:transparent;color:var(--text-normal);font-weight:400;";
      }
      cell.style.cssText = cellCss;
      if (!isViewed) {
        cell.onmouseenter = () => { cell.style.background = "var(--background-modifier-hover)"; };
        cell.onmouseleave = () => { cell.style.background = isToday_ ? "transparent" : "transparent"; };
      }
      cell.onclick = (e) => {
        e.stopPropagation();
        _calOpen = false;
        calPopup.style.display = "none";
        _navDate(offset);
      };
      grid.appendChild(cell);
    }
    calPopup.appendChild(grid);
  };

  _navToday.onclick = (e) => {
    e.stopPropagation();
    if (_calOpen) {
      _calOpen = false;
      calPopup.style.display = "none";
    } else {
      _calYear = today.year;
      _calMonth = today.month;
      _renderCal();
      _positionCal();
      calPopup.style.display = "block";
      _calOpen = true;
    }
  };

  document.addEventListener("click", function _rdtCloseCal(e) {
    if (_calOpen && !calPopup.contains(e.target) && e.target !== _navToday) {
      _calOpen = false;
      calPopup.style.display = "none";
    }
  }, true);

  return {
    _navPrev,
    _navToday,
    _navNext,
    _navDate,
    calPopup,
    _renderCal,
    _positionCal
  };
};

module.exports = {
  createDesktopCalendarRuntime
};
