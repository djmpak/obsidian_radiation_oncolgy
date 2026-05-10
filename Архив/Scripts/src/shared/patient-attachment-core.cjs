"use strict";

const readFileAsArrayBuffer = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = () => reject(reader.error);
  reader.readAsArrayBuffer(file);
});

const createPatientAttachmentActions = ({
  app,
  platform,
  patchCurrentFrontmatter,
  notice = null,
  now = null
} = {}) => {
  if (!app?.vault) throw new Error("createPatientAttachmentActions: app.vault is required");
  if (!platform?.ensureFolderPath || !platform?.getFile) throw new Error("createPatientAttachmentActions: platform adapter is required");
  if (typeof patchCurrentFrontmatter !== "function") throw new Error("createPatientAttachmentActions: patchCurrentFrontmatter is required");

  const getNow = () => now || new Date();
  const formatStamp = (format) => {
    const current = getNow();
    if (current && typeof current.toFormat === "function") return current.toFormat(format);
    return new Date().toISOString();
  };

  const ensureFolder = async (folderPath) => platform.ensureFolderPath(folderPath);

  const getUniquePath = async (folderPath, baseName) => {
    const folder = String(folderPath || "").replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
    const cleanBase = String(baseName || "").replace(/[\\/:*?"<>|]/g, "_");
    let targetPath = `${folder}/${cleanBase}`;
    let counter = 1;
    while (platform.getFile(targetPath)) {
      const ext = cleanBase.includes(".") ? "." + cleanBase.split(".").pop() : "";
      const stem = cleanBase.includes(".") ? cleanBase.slice(0, cleanBase.lastIndexOf(".")) : cleanBase;
      targetPath = `${folder}/${stem}_${counter}${ext}`;
      counter++;
    }
    return targetPath;
  };

  const saveFiles = async (files, { folderPath } = {}) => {
    if (!files || !files.length) return;
    const archiveFolder = String(folderPath || "").trim();
    if (!archiveFolder) throw new Error("saveFiles: folderPath is required");
    await ensureFolder(archiveFolder);
    const ts = formatStamp("yyyy-MM-dd'T'HH:mm");
    for (const f of Array.from(files)) {
      try {
        const buf = await readFileAsArrayBuffer(f);
        const targetPath = await getUniquePath(archiveFolder, f.name);
        await app.vault.createBinary(targetPath, buf);
        await patchCurrentFrontmatter(fm => {
          if (!Array.isArray(fm.Вложения)) fm.Вложения = [];
          fm.Вложения.push({ Дата: ts, Путь: targetPath, Имя: f.name });
        }, { reread: false });
        if (typeof notice === "function") notice(`✅ Сохранено: ${f.name}`);
      } catch (error) {
        console.error("saveFiles:", error);
        if (typeof notice === "function") notice(`❌ Ошибка: ${f.name}\n${error?.message ?? error}`);
      }
    }
  };

  const saveClipboardImages = async (clipboardItems, { folderPath } = {}) => {
    const imageItems = [];
    for (const item of clipboardItems || []) {
      if (item.kind === "file" && item.type.startsWith("image/")) imageItems.push(item);
    }
    if (!imageItems.length) return false;
    const archiveFolder = String(folderPath || "").trim();
    if (!archiveFolder) throw new Error("saveClipboardImages: folderPath is required");
    await ensureFolder(archiveFolder);
    const ts = formatStamp("yyyy-MM-dd'T'HH:mm");
    const tsFile = formatStamp("yyyy-MM-dd'T'HH-mm-ss");
    for (const item of imageItems) {
      const f = item.getAsFile();
      if (!f) continue;
      try {
        const buf = await readFileAsArrayBuffer(f);
        const ext = f.type.split("/")[1] || "png";
        const baseName = `screenshot_${tsFile}.${ext}`;
        const targetPath = await getUniquePath(archiveFolder, baseName);
        await app.vault.createBinary(targetPath, buf);
        await patchCurrentFrontmatter(fm => {
          if (!Array.isArray(fm.Вложения)) fm.Вложения = [];
          fm.Вложения.push({ Дата: ts, Путь: targetPath, Имя: baseName });
        }, { reread: false });
        if (typeof notice === "function") notice(`✅ Сохранено из буфера: ${baseName}`);
      } catch (error) {
        console.error(error);
        if (typeof notice === "function") notice("❌ Ошибка вставки из буфера обмена");
      }
    }
    return true;
  };

  return {
    saveFiles,
    saveClipboardImages
  };
};

module.exports = {
  readFileAsArrayBuffer,
  createPatientAttachmentActions
};
