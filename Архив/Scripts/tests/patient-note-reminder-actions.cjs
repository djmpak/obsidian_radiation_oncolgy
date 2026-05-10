const assert = require("assert");
const {
  DISPANSERY_INTERVALS,
  buildDispanseryReminders,
  createPatientNoteReminderActions
} = require("../src/shared/patient-note-reminder-actions.cjs");

const test = async (name, fn) => {
  try {
    await fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    console.error(error);
    process.exitCode = 1;
  }
};

const makeEndDate = () => {
  const makeValue = (months, days) => ({
    months,
    days,
    plus(delta = {}) {
      return makeValue(months + (delta.months || 0), days + (delta.days || 0));
    },
    startOf() { return this; },
    toFormat(fmt) {
      if (fmt === "yyyy-MM-dd") return `${String(months).padStart(2, "0")}m-${String(days).padStart(2, "0")}d`;
      if (fmt === "yyyy-MM-dd'T'HH:mm") return `stamp-${months}-${days}`;
      return `${months}/${days}`;
    },
    toISODate() {
      return `${String(months).padStart(2, "0")}m-${String(days).padStart(2, "0")}d`;
    }
  });
  return makeValue(0, 0);
};

(async () => {
  await test("buildDispanseryReminders applies interval and workday callback", () => {
    const reminders = buildDispanseryReminders(makeEndDate(), {
      nextWorkDay: (rawDate) => ({
        toFormat: () => `work-${rawDate.months}-${rawDate.days}`
      })
    });

    assert.strictEqual(reminders.length, DISPANSERY_INTERVALS.length);
    assert.deepStrictEqual(reminders[0], {
      дата: "work-3-14",
      текст: "Диспансерный осмотр (3 мес.)",
      выполнено: false
    });
    assert.deepStrictEqual(reminders.at(-1), {
      дата: "work-60-14",
      текст: "Диспансерный осмотр (5 лет)",
      выполнено: false
    });
  });

  await test("saveNote, deleteNote and dispensary actions patch frontmatter", async () => {
    const fm = {
      Напоминания: [
        { дата: "2026-01-01", текст: "Диспансерный осмотр (старое)", выполнено: false },
        { дата: "2026-01-01", текст: "Другое", выполнено: false }
      ],
      Заметки: [{ Дата: "2026-05-02T10:00", Текст: "Старое" }]
    };
    const patches = [];
    const actions = createPatientNoteReminderActions({
      dv: { date: () => null },
      nextWorkDay: (rawDate) => ({ toFormat: () => `work-${rawDate.months}-${rawDate.days}` }),
      patchCurrentFrontmatter: async (mutator) => {
        mutator(fm);
        patches.push(JSON.parse(JSON.stringify(fm)));
      }
    });

    const generated = await actions.activateDispanseryMonitoring(makeEndDate());
    assert.strictEqual(generated.length, DISPANSERY_INTERVALS.length);
    assert.strictEqual(fm.Диспансерный_учет, true);
    assert.strictEqual(fm.Напоминания.some(r => String(r.текст).includes("старое")), false);
    assert.strictEqual(fm.Напоминания.some(r => r.текст === "Другое"), true);
    assert.strictEqual(fm.Напоминания.some(r => r.текст === "Диспансерный осмотр (3 мес.)"), true);

    const note = await actions.saveNote({ text: "Новая заметка #tag", timestamp: makeEndDate() });
    assert.deepStrictEqual(note, { Дата: "stamp-0-0", Текст: "Новая заметка #tag" });
    assert.strictEqual(fm.Заметки.at(-1).Текст, "Новая заметка #tag");

    const removed = await actions.deleteNote({ text: "Новая заметка #tag", timestamp: "stamp-0-0" });
    assert.strictEqual(removed, true);
    assert.strictEqual(fm.Заметки.some(n => n.Текст === "Новая заметка #tag"), false);
    assert.ok(patches.length >= 3);
  });

  if (!process.exitCode) console.log("OK patient note/reminder actions core tests passed");
})();
