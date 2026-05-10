const assert = require("node:assert/strict");
const path = require("node:path");

const root = path.resolve(__dirname, "..", "..", "..");
const core = require(path.join(root, "Архив", "Scripts", "src", "shared", "desktop-discharge-core.cjs"));

const makeDate = (iso) => ({
  _iso: iso,
  isValid: Boolean(iso),
  startOf: () => makeDate(iso),
  toISODate: () => iso,
  toFormat: () => iso,
  toMillis: () => Date.parse(`${iso}T00:00:00Z`)
});

const makeNode = (tag = "div") => ({
  tag,
  children: [],
  dataset: {},
  style: {},
  classList: { add() {} },
  createEl(nextTag = "div") {
    const node = makeNode(nextTag);
    this.children.push(node);
    return node;
  },
  createDiv() {
    const node = makeNode("div");
    this.children.push(node);
    return node;
  },
  appendChild(node) {
    this.children.push(node);
    return node;
  },
  set innerHTML(value) { this._html = value; },
  get innerHTML() { return this._html || ""; },
  set textContent(value) { this._text = value; },
  get textContent() { return this._text || ""; }
});

assert.equal(typeof core.buildDesktopDischargeState, "function");
assert.equal(typeof core.renderDesktopDischargeTab, "function");

(async () => {
  await assert.rejects(core.buildDesktopDischargeState(), /app\.vault is required/);
  assert.throws(() => core.renderDesktopDischargeTab(), /tab is required/);

  const state = await core.buildDesktopDischargeState({
    app: {
      vault: {
        getAbstractFileByPath: () => ({ path: "Архив/БД/БД_выписки.md" }),
        read: async () => "alpha\nbeta"
      }
    },
    dv: {
      date: (iso) => makeDate(iso),
      pages: (query) => ({
        where: () => {
          const rows = query === "\"Архив/Выписаны\""
            ? [{ ФИО: "Иванов", db_exported_at: "2026-05-02", Дата_окончания_лечения: "2026-05-01", file: { path: "Архив/Выписаны/Иванов.md" } }]
            : [];
          return {
            array: () => rows,
            forEach: (fn) => rows.forEach(fn)
          };
        }
      })
    },
    allModels: [
      { end: makeDate("2026-05-07"), currFrac: 1, frac: 4, p: { ФИО: "Петров", file: { path: "Пациенты/Петров.md", name: "Петров.md", tags: [] } } }
    ],
    today: makeDate("2026-05-02"),
    todayStart: makeDate("2026-05-02"),
    todayStr: "2026-05-02",
    holidays: [],
    DB_DISCHARGE_PATH: "Архив/БД/БД_выписки.md",
    DISCHARGED_FOLDER: "Выписаны",
    _pfDesktopCore: {
      isPlannedDischarge: ({ endIso, limitIso }) => endIso <= limitIso,
      isRecentDischarge: ({ dateIso }) => Boolean(dateIso),
      getPlannedDischargeCardMeta: () => ({ color: "#ff9800", opacity: 1, bgFilter: "none", fractionsLeft: 3, infos: [], daysText: "3 дн.", copyString: "copy" }),
      getRecentDischargeCardMeta: () => ({ color: "#ff9800", infos: [], title: "", dateLabel: "", agoText: "" })
    },
    _pfScheduleCore: { addWorkDaysFromIso: () => "2026-05-08" },
    _pfAsIso: () => "2026-05-02",
    minusWorkDays: () => makeDate("2026-04-28"),
    safeDate: (value) => value ? makeDate(value) : null
  });

  assert.equal(state.copiedSet.has("alpha"), true);
  assert.equal(state.dischargeData.length, 1);
  assert.equal(state.recentDischargedData.length, 1);

  const tab = makeNode("div");
  const notices = [];

  core.renderDesktopDischargeTab({
    tab,
    state,
    app: {
      vault: {
        getAbstractFileByPath: () => ({ path: "Пациенты/Петров.md" }),
        create: async () => {},
        append: async () => {}
      },
      workspace: { getLeaf: () => ({ openFile: () => {} }) }
    },
    todayStart: makeDate("2026-05-02"),
    todayStr: "2026-05-02",
    getWorkDays: () => 3,
    getPatientBadges: () => "",
    getPatientFilterHints: () => "",
    getFundingType: () => "ОМС",
    dayPhrases: { 1: "в понедельник", 2: "во вторник", 3: "в среду", 4: "в четверг", 5: "в пятницу", 6: "в субботу", 7: "в воскресенье" },
    DB_DISCHARGE_PATH: "Архив/БД/БД_выписки.md",
    _pfDesktopCore: {
      getPlannedDischargeCardMeta: () => ({ color: "#ff9800", opacity: 1, bgFilter: "none", fractionsLeft: 3, infos: [], daysText: "3 дн.", copyString: "copy" }),
      getRecentDischargeCardMeta: () => ({ color: "#ff9800", infos: [], title: "", dateLabel: "", agoText: "" })
    },
    _h: (node, title) => { node.children.push({ title }); },
    _spacer: (node) => { node.children.push({ spacer: true }); },
    _HI_LOGOUT: "logout",
    notice: (msg) => notices.push(msg)
  });

  assert.ok(tab.children.length > 0);

  console.log("OK desktop discharge core export checks passed");
})().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
