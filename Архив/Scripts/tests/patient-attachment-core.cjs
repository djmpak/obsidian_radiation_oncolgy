const assert = require("assert");
const { createPatientAttachmentActions } = require("../src/shared/patient-attachment-core.cjs");

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

const makeFileReader = () => {
  return class FileReader {
    readAsArrayBuffer(file) {
      setTimeout(() => {
        if (file?.shouldFail) {
          this.error = new Error("boom");
          this.onerror?.();
          return;
        }
        this.result = file.__buffer || new Uint8Array([1, 2, 3]).buffer;
        this.onload?.();
      }, 0);
    }
  };
};

const makeApp = () => {
  const files = new Map();
  const folders = new Set();
  const created = [];
  const app = {
    vault: {
      async createBinary(path, buffer) {
        created.push({ path, buffer });
        files.set(path, { path, buffer });
      }
    },
    _files: files,
    _folders: folders,
    _created: created
  };
  return app;
};

(async () => {
  const oldFileReader = global.FileReader;
  global.FileReader = makeFileReader();

  await test("saveFiles stores unique attachment paths and frontmatter entries", async () => {
    const app = makeApp();
    const folders = app._folders;
    const files = app._files;
    const notices = [];
    const fm = {};
    const actions = createPatientAttachmentActions({
      app,
      platform: {
        ensureFolderPath: async (folderPath) => { folders.add(folderPath); },
        getFile: (path) => files.get(path) || null
      },
      patchCurrentFrontmatter: async (mutator) => { mutator(fm); },
      notice: (message) => notices.push(message),
      now: { toFormat: (fmt) => fmt === "yyyy-MM-dd'T'HH:mm" ? "2026-05-02T10:30" : "2026-05-02T10-30-00" }
    });

    await actions.saveFiles([
      { name: "scan.png", __buffer: new Uint8Array([10, 20]).buffer }
    ], { folderPath: "Архив/Вложения/Пациент" });

    assert.strictEqual(app._created.length, 1);
    assert.strictEqual(app._created[0].path, "Архив/Вложения/Пациент/scan.png");
    assert.deepStrictEqual(fm.Вложения[0], {
      Дата: "2026-05-02T10:30",
      Путь: "Архив/Вложения/Пациент/scan.png",
      Имя: "scan.png"
    });
    assert.ok(notices.some(msg => String(msg).includes("Сохранено: scan.png")));
  });

  await test("saveClipboardImages writes screenshot attachments", async () => {
    const app = makeApp();
    const folders = app._folders;
    const files = app._files;
    const notices = [];
    const fm = {};
    const actions = createPatientAttachmentActions({
      app,
      platform: {
        ensureFolderPath: async (folderPath) => { folders.add(folderPath); },
        getFile: (path) => files.get(path) || null
      },
      patchCurrentFrontmatter: async (mutator) => { mutator(fm); },
      notice: (message) => notices.push(message),
      now: { toFormat: (fmt) => fmt === "yyyy-MM-dd'T'HH:mm" ? "2026-05-02T10:30" : "2026-05-02T10-30-00" }
    });

    const hadImages = await actions.saveClipboardImages([
      { kind: "file", type: "image/png", getAsFile: () => ({ type: "image/png", __buffer: new Uint8Array([1, 2, 3]).buffer }) }
    ], { folderPath: "Архив/Вложения/Пациент" });

    assert.strictEqual(hadImages, true);
    assert.strictEqual(app._created[0].path, "Архив/Вложения/Пациент/screenshot_2026-05-02T10-30-00.png");
    assert.deepStrictEqual(fm.Вложения[0], {
      Дата: "2026-05-02T10:30",
      Путь: "Архив/Вложения/Пациент/screenshot_2026-05-02T10-30-00.png",
      Имя: "screenshot_2026-05-02T10-30-00.png"
    });
    assert.ok(notices.some(msg => String(msg).includes("Сохранено из буфера")));
  });

  global.FileReader = oldFileReader;
  if (!process.exitCode) console.log("OK patient attachment core tests passed");
})();
