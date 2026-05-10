const assert = require("assert");
const {
  normalizeReminderDateIso,
  normalizeReminderText,
  reminderKey,
  isReminderDone,
  isElnReminderText,
  getActiveReminders,
  getElnPendingReminders,
  buildElnReminderDraft,
  upsertElnReminder
} = require("../src/shared/patient-reminder-core.cjs");

const test = (name, fn) => {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    console.error(error);
    process.exitCode = 1;
  }
};

class FakeDate {
  constructor(iso) {
    this._date = new Date(`${iso}T00:00:00Z`);
  }

  static from(date) {
    return new FakeDate(date.toISOString().slice(0, 10));
  }

  get weekday() {
    const day = this._date.getUTCDay();
    return day === 0 ? 7 : day;
  }

  startOf() {
    return new FakeDate(this.toISODate());
  }

  plus({ days = 0 } = {}) {
    const next = new Date(this._date);
    next.setUTCDate(next.getUTCDate() + days);
    return FakeDate.from(next);
  }

  minus({ days = 0 } = {}) {
    return this.plus({ days: -days });
  }

  diff(other) {
    const ms = this._date - other._date;
    return { days: ms / 86400000 };
  }

  toISODate() {
    return this._date.toISOString().slice(0, 10);
  }

  toFormat(fmt) {
    const iso = this.toISODate();
    if (fmt === "yyyy-MM-dd") return iso;
    if (fmt === "dd.MM.yyyy") return `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;
    return iso;
  }

  valueOf() {
    return this._date.getTime();
  }
}

const dv = {
  date: (value) => {
    if (!value) return null;
    if (value instanceof FakeDate) return value;
    if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return new FakeDate(value);
    if (typeof value === "string" && /^\d{2}\.\d{2}\.\d{4}$/.test(value)) {
      return new FakeDate(`${value.slice(6, 10)}-${value.slice(3, 5)}-${value.slice(0, 2)}`);
    }
    return null;
  }
};

test("normalizes reminder date and text values", () => {
  assert.strictEqual(normalizeReminderDateIso("2026-05-02", dv), "2026-05-02");
  assert.strictEqual(normalizeReminderDateIso("02.05.2026", dv), "2026-05-02");
  assert.strictEqual(normalizeReminderText("  ВК   по   ЭЛН  "), "ВК по ЭЛН");
  assert.strictEqual(reminderKey({ дата: "02.05.2026", текст: "ВК  по ЭЛН" }, dv), "2026-05-02||ВК по ЭЛН");
  assert.strictEqual(isReminderDone({ выполнено: true }), true);
  assert.strictEqual(isElnReminderText("Написать ВК по ЭЛН"), true);
});

test("buildElnReminderDraft computes a reminder from the base start", () => {
  const today = new FakeDate("2026-05-02");
  const baseStart = new FakeDate("2026-05-01");
  const draft = buildElnReminderDraft({
    today,
    baseStart,
    holidays: new Set(),
    dv
  });
  assert.ok(draft);
  assert.strictEqual(draft.targetIso, "2026-05-15");
  assert.strictEqual(draft.newReminder.дата, "2026-05-15");
  assert.ok(draft.reminderText.includes("Написать ВК по ЭЛН"));
});

test("buildElnReminderDraft honors selected date input", () => {
  const today = new FakeDate("2026-05-02");
  const baseStart = new FakeDate("2026-05-01");
  const draft = buildElnReminderDraft({
    selectedDateStr: "2026-05-20",
    today,
    baseStart,
    holidays: new Set(),
    dv
  });
  assert.ok(draft);
  assert.strictEqual(draft.targetIso, "2026-05-20");
});

test("upsertElnReminder updates existing pending reminder or appends a new one", () => {
  const first = upsertElnReminder({
    reminders: [
      { дата: "2026-05-10", текст: "Написать ВК по ЭЛН (Прошло: 1 + Доб: 2 = Итог: 3)", выполнено: false },
      { дата: "2026-05-11", текст: "Другое", выполнено: false }
    ],
    targetIso: "2026-05-10",
    newReminder: { дата: "2026-05-10", текст: "Написать ВК по ЭЛН (Прошло: 2 + Доб: 1 = Итог: 3)", выполнено: false },
    dv
  });
  assert.strictEqual(first.updated, true);
  assert.strictEqual(first.reminders[0].текст, "Написать ВК по ЭЛН (Прошло: 2 + Доб: 1 = Итог: 3)");

  const second = upsertElnReminder({
    reminders: [],
    targetIso: "2026-05-12",
    newReminder: { дата: "2026-05-12", текст: "Написать ВК по ЭЛН (Прошло: 0 + Доб: 14 = Итог: 14)", выполнено: false },
    dv
  });
  assert.strictEqual(second.updated, false);
  assert.strictEqual(second.reminders.length, 1);
});

test("getActiveReminders and getElnPendingReminders accept alias fields", () => {
  const reminders = getActiveReminders([
    { Дата: "2026-05-10", Текст: "  Написать   ВК по ЭЛН  ", Выполнено: false },
    { дата: "2026-05-11", текст: "Сделано", выполнено: true },
    { дата: "2026-05-12", текст: "Другое", выполнено: false }
  ], dv);

  assert.deepStrictEqual(reminders.map(r => ({ дата: r.дата, текст: r.текст, iso: r.iso })), [
    { дата: "2026-05-10", текст: "  Написать   ВК по ЭЛН  ", iso: "2026-05-10" },
    { дата: "2026-05-12", текст: "Другое", iso: "2026-05-12" }
  ]);
  assert.deepStrictEqual(
    getElnPendingReminders([
      { Дата: "2026-05-10", Текст: "Написать ВК по ЭЛН", Выполнено: false },
      { дата: "2026-05-11", текст: "Написать ВК по ЭЛН", выполнено: true }
    ], dv).map(r => r.iso),
    ["2026-05-10"]
  );
});

if (!process.exitCode) console.log("OK patient reminder core tests passed");
