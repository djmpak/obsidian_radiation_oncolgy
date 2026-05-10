const assert = require("node:assert/strict");
const path = require("node:path");

const core = require(path.resolve(__dirname, "..", "src", "shared", "desktop-calendar-core.cjs"));

const makeEl = (tag = "div") => {
  const el = {
    tagName: String(tag).toUpperCase(),
    children: [],
    style: {},
    dataset: {},
    textContent: "",
    innerHTML: "",
    parentNode: null,
    getBoundingClientRect: () => ({ left: 100, width: 40, bottom: 60 }),
    contains(target) {
      if (target === el) return true;
      return el.children.some(child => child?.contains?.(target));
    },
    appendChild(child) {
      child.parentNode = el;
      el.children.push(child);
      return child;
    },
    createEl(nextTag = "div", opts = {}) {
      const child = makeEl(nextTag);
      if (opts.cls) child.className = opts.cls;
      if (opts.text) child.textContent = opts.text;
      child.classList = makeClassList(child);
      el.appendChild(child);
      return child;
    },
    createDiv(opts = {}) {
      return el.createEl("div", opts);
    }
  };
  el.classList = makeClassList(el);
  return el;
};

const makeClassList = (el) => {
  const items = new Set();
  return {
    add(...names) {
      names.forEach(name => { if (name) items.add(String(name)); });
    },
    contains(name) {
      return items.has(String(name));
    },
    toArray() {
      return Array.from(items);
    }
  };
};

const makeDate = (iso) => {
  const d = new Date(`${iso}T00:00:00Z`);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    weekday: ((d.getUTCDay() + 6) % 7) + 1,
    daysInMonth: new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate(),
    toFormat(fmt) {
      if (fmt === "dd.MM") return iso.slice(8, 10) + "." + iso.slice(5, 7);
      if (fmt === "dd.MM.yyyy") return iso.slice(8, 10) + "." + iso.slice(5, 7) + "." + iso.slice(0, 4);
      return iso;
    },
    toISODate() {
      return iso;
    },
    startOf() {
      return makeDate(iso);
    },
    plus({ days = 0 } = {}) {
      const next = new Date(`${iso}T00:00:00Z`);
      next.setUTCDate(next.getUTCDate() + days);
      return makeDate(next.toISOString().slice(0, 10));
    },
    diff(other) {
      const delta = (Date.parse(`${iso}T00:00:00Z`) - Date.parse(`${other.toISODate()}T00:00:00Z`)) / 86400000;
      return { days: delta };
    }
  };
};

const body = makeEl("body");
const popupHost = makeEl("div");
body.appendChild(popupHost);

const dateNavDiv = makeEl("div");
const localStorageCalls = [];
const reopened = [];
const runtime = core.createDesktopCalendarRuntime({
  dv: { date: (iso) => makeDate(iso) },
  document: {
    body,
    createElement: (tag) => makeEl(tag),
    addEventListener() {}
  },
  window: {
    innerWidth: 1280,
    localStorage: {
      setItem(key, value) {
        localStorageCalls.push([key, value]);
      }
    }
  },
  dateNavDiv,
  today: makeDate("2026-05-05"),
  realToday: makeDate("2026-05-03"),
  dateOffset: 2,
  dateOffsetKey: "rdt-date-offset",
  desktopPlatform: {
    reopenCurrentFile: async () => {
      reopened.push("ok");
    }
  }
});

assert.equal(dateNavDiv.children.length, 3);
assert.equal(runtime._navToday.textContent, "05.05");
assert.equal(runtime._navToday.title, "Выбрать дату");
assert.equal(runtime._navPrev.textContent, "◀");
assert.equal(runtime._navNext.textContent, "▶");

async function main() {
  await runtime._navPrev.onclick();
  assert.deepEqual(localStorageCalls.at(-1), ["rdt-date-offset", "1"]);
  assert.equal(reopened.length, 1);

  await runtime._navNext.onclick();
  assert.deepEqual(localStorageCalls.at(-1), ["rdt-date-offset", "3"]);
  assert.equal(reopened.length, 2);

  await runtime._navDate(0);
  assert.deepEqual(localStorageCalls.at(-1), ["rdt-date-offset", "0"]);
  assert.equal(reopened.length, 3);

  runtime._navToday.onclick({ stopPropagation() {} });
  assert.equal(runtime.calPopup.style.display, "block");
  assert.equal(runtime.calPopup.children[0].children[1].textContent, "Май 2026");
  assert.equal(runtime.calPopup.children[1].children.length, 7);

  const grid = runtime.calPopup.children[2];
  const day3 = grid.children.find?.(child => child.textContent === "3");
  const day5 = grid.children.find?.(child => child.textContent === "5");
  assert.ok(day3);
  assert.ok(day5);
  assert.match(day3.style.cssText, /box-shadow:inset 0 0 0 1px var\(--interactive-accent\)/u);
  assert.match(day5.style.cssText, /background:var\(--interactive-accent\);color:white;font-weight:700;/u);

  runtime._positionCal();
  assert.match(runtime.calPopup.style.left, /px$/u);
  assert.match(runtime.calPopup.style.top, /px$/u);

  const may10 = grid.children.find?.(child => child.textContent === "10");
  await may10.onclick({ stopPropagation() {} });
  assert.deepEqual(localStorageCalls.at(-1), ["rdt-date-offset", "7"]);
  assert.equal(reopened.length, 4);
}

main()
  .then(() => console.log("OK desktop calendar core export checks passed"))
  .catch(err => {
    console.error(err);
    process.exitCode = 1;
  });
