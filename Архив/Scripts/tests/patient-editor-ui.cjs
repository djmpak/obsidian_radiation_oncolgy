const assert = require("assert");
const {
  PATIENT_EDITOR_FIELDS,
  normalizePatientEditorValue,
  collectPatientEditorUpdates,
  mountPatientEditorControls
} = require("../src/shared/patient-editor-ui.cjs");

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

const makeElement = (tag = "div") => {
  const el = {
    tagName: tag.toUpperCase(),
    children: [],
    style: {},
    attributes: {},
    className: "",
    id: "",
    textContent: "",
    innerHTML: "",
    title: "",
    disabled: false,
    value: "",
    selectedIndex: 0,
    options: [],
    appendChild(child) {
      this.children.push(child);
      if (this.tagName === "SELECT") this.options.push(child);
      child.parentElement = this;
      return child;
    },
    remove() {
      this.removed = true;
    },
    addEventListener() {},
    setAttribute(name, value) {
      this.attributes[name] = value;
    },
    get firstChild() {
      return this.children[0] || null;
    }
  };
  Object.defineProperty(el, "cssText", {
    get() { return this.style.cssText || ""; },
    set(value) { this.style.cssText = value; }
  });
  return el;
};

(async () => {
  await test("field list includes treatment editor block", () => {
    assert.ok(PATIENT_EDITOR_FIELDS.some(f => f.key === "db_prior_treatment"));
    assert.ok(PATIENT_EDITOR_FIELDS.some(f => f.section === "Лечение"));
  });

  await test("field list includes transfer and inpatient logistics", () => {
    assert.ok(PATIENT_EDITOR_FIELDS.some(f => f.key === "Передан" && f.type === "text"));
    assert.ok(!PATIENT_EDITOR_FIELDS.some(f => f.key === "КС"));
    assert.ok(PATIENT_EDITOR_FIELDS.some(f => f.key === "Палата" && f.type === "text"));
  });

  await test("normalizePatientEditorValue follows current save rules", () => {
    assert.strictEqual(normalizePatientEditorValue({ type: "text" }, { value: "  abc  " }), "abc");
    assert.strictEqual(normalizePatientEditorValue({ type: "date" }, { value: "" }), null);
    assert.strictEqual(normalizePatientEditorValue({ type: "number" }, { value: " 12 " }), 12);
    assert.strictEqual(
      normalizePatientEditorValue(
        { type: "select", opts: ["", "0 — нет", "1 — да"], vals: [null, 0, 1] },
        { value: "1", selectedIndex: 2, options: [{ textContent: "" }, { textContent: "0 — нет" }, { textContent: "1 — да" }] }
      ),
      1
    );
  });

  await test("collectPatientEditorUpdates normalizes a mixed field set", () => {
    const updates = collectPatientEditorUpdates({
      ID_пациента: { field: { type: "text" }, inp: { value: " 123-456 " } },
      db_progression: {
        field: { type: "select", opts: ["", "0 — нет", "1 — да"], vals: [null, 0, 1] },
        inp: { value: "1", selectedIndex: 2, options: [{ textContent: "" }, { textContent: "0 — нет" }, { textContent: "1 — да" }] }
      },
      db_date_last_contact: { field: { type: "date" }, inp: { value: "" } }
    });

    assert.deepStrictEqual(updates, {
      ID_пациента: "123-456",
      db_progression: 1,
      db_date_last_contact: null
    });
  });

  await test("mountPatientEditorControls builds the editor wrapper", () => {
    const oldDocument = global.document;
    const oldWindow = global.window;

    const head = makeElement("head");
    const body = makeElement("body");
    const doc = {
      head,
      body,
      createElement: (tag) => makeElement(tag),
      getElementById: () => null
    };
    body.contains = () => true;

    global.document = doc;
    global.window = { QRCode: null };

    const root = mountPatientEditorControls({
      dv: { el: () => makeElement("div") },
      cur: {
        file: { path: "Пациенты/Test.md" },
        ID_пациента: "123-456",
        "МКБ 10": "C34"
      },
      saveNow: () => {},
      getVal: () => null,
      getQLQModule: () => "module",
      notice: () => {}
    });

    assert.ok(root);
    assert.strictEqual(root.children.length, 2);

    global.document = oldDocument;
    global.window = oldWindow;
  });

  if (!process.exitCode) console.log("OK patient editor ui tests passed");
})();
