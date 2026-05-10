const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..", "..", "..");
const corePath = path.join(root, "Архив", "Scripts", "src", "shared", "patient-editor-ui.cjs");
const runtimePath = path.join(root, "Архив", "Scripts", "modules", "patient-editor-ui-runtime.js");
const viewPath = path.join(root, "Архив", "Scripts", "views", "patient", "view.js");

const readUtf8 = (filePath) => fs.readFileSync(filePath, "utf8");

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

async function loadRuntime() {
  const runtimeSource = readUtf8(runtimePath);
  const runtimeLoader = new Function(`return (${runtimeSource});`)();
  const coreSource = readUtf8(corePath);
  const requestedPaths = [];

  const runtime = await runtimeLoader({
    dv: {
      io: {
        load: async (requestedPath) => {
          requestedPaths.push(requestedPath);
          assert.equal(
            requestedPath,
            "Архив/Scripts/src/shared/patient-editor-ui.cjs",
            "patient-editor-ui runtime loaded the wrong shared core"
          );
          return coreSource;
        }
      }
    }
  });

  return { runtime, runtimeSource, requestedPaths };
}

(async () => {
  assert.equal(fs.existsSync(runtimePath), true, "patient-editor-ui-runtime.js does not exist");
  assert.equal(fs.existsSync(viewPath), true, "patient view.js does not exist");

  const core = require("../src/shared/patient-editor-ui.cjs");
  assert.equal(typeof core.openPatientCardEditorModal, "function");

  const { runtime, runtimeSource, requestedPaths } = await loadRuntime();
  assert.match(runtimeSource, /openPatientCardEditorModal/u);
  assert.match(runtimeSource, /mountPatientEditorControls/u);
  assert.equal(requestedPaths.length, 1);
  assert.equal(typeof runtime.openPatientCardEditorModal, "function");
  assert.equal(typeof runtime.mountPatientEditorControls, "function");

  const oldDocument = global.document;
  const oldWindow = global.window;
  const head = makeElement("head");
  const body = makeElement("body");
  const documentStub = {
    head,
    body,
    createElement: (tag) => makeElement(tag),
    getElementById: () => null
  };
  body.contains = () => true;
  global.document = documentStub;
  global.window = { QRCode: null };

  const context = {
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
  };

  const opener = runtime.openPatientCardEditorModal(context);
  assert.equal(typeof opener, "function");

  const mounted = runtime.mountPatientEditorControls({
    ...context,
    openPatientCardEditorModal: opener
  });
  assert.ok(mounted.root);
  assert.equal(typeof mounted.openPatientCardEditorModal, "function");

  global.document = oldDocument;
  global.window = oldWindow;

  const viewSource = readUtf8(viewPath);
  const AsyncFunction = Object.getPrototypeOf(async function() {}).constructor;
  assert.doesNotThrow(() => new AsyncFunction(viewSource));
  assert.equal(
    viewSource.indexOf("const extraVolumes =") > -1
      && viewSource.indexOf("const extraVolumes =") < viewSource.indexOf("const isMultiPTV = extraVolumes.length > 0"),
    true,
    "patient view must initialize extraVolumes before PTV rendering"
  );
  assert.match(viewSource, /const\s+openPatientCardEditorModal\s*=\s*\(\)\s*=>/u);
  assert.match(viewSource, /const card = dv\.el\("div", "", \{ cls: "patient-card" \}\);/u);
  assert.match(viewSource, /const \{ saveNow: _dbSaveNow, getVal: _dbGetVal \}/u);
  assert.match(viewSource, /key:\s*"Передан"/u);
  assert.match(viewSource, /key:\s*"Палата"/u);
  assert.doesNotMatch(viewSource, /label:\s*"Тип стационара",\s*key:\s*"КС"/u);

  console.log("OK patient editor ui runtime regression passed");
})().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exit(1);
});
