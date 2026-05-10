"use strict";

const normalizeVaultPath = (value = "") => (
  String(value || "").replace(/\\/g, "/").replace(/^\/+|\/+$/g, "").trim()
);

const getParentFolderPath = (filePath = "") => {
  const normalized = normalizeVaultPath(filePath);
  const idx = normalized.lastIndexOf("/");
  return idx >= 0 ? normalized.slice(0, idx) : "";
};

const clonePlain = (value) => {
  try { return JSON.parse(JSON.stringify(value ?? {})); } catch (_) { return value ?? {}; }
};

const getFileNameFromPath = (filePath = "") => {
  const normalized = normalizeVaultPath(filePath);
  return normalized.split("/").filter(Boolean).pop() || "";
};

const createObsidianAdapter = ({
  app,
  window = null,
  parseYaml = null,
  console: logger = console
} = {}) => {
  if (!app?.vault) throw new Error("createObsidianAdapter: app.vault is required");

  const getYamlParser = () => {
    if (typeof parseYaml === "function") return parseYaml;
    if (typeof window?.parseYaml === "function") return window.parseYaml;
    try {
      if (typeof globalThis.parseYaml === "function") return globalThis.parseYaml;
    } catch (_) {}
    return null;
  };

  const getFile = (path) => {
    const normalized = normalizeVaultPath(path);
    return normalized ? app.vault.getAbstractFileByPath(normalized) : null;
  };

  const ensureFolderPath = async (folderPath) => {
    const normalized = normalizeVaultPath(folderPath);
    if (!normalized) return { ok: true, path: "" };
    const parts = normalized.split("/").filter(Boolean);
    let current = "";
    for (const part of parts) {
      current = current ? `${current}/${part}` : part;
      if (!getFile(current)) await app.vault.createFolder(current);
    }
    return { ok: true, path: normalized };
  };

  const readTextFile = async (pathOrFile) => {
    const targetFile = typeof pathOrFile === "string" ? getFile(pathOrFile) : pathOrFile;
    if (!targetFile) return null;
    return app.vault.read(targetFile);
  };

  const readFreshFrontmatter = async (targetFile) => {
    if (!targetFile) return {};
    try {
      const text = await app.vault.read(targetFile);
      const match = String(text || "").match(/^---\r?\n([\s\S]*?)\r?\n---/);
      const yamlParser = getYamlParser();
      if (match && yamlParser) {
        const parsed = yamlParser(match[1]);
        if (parsed && typeof parsed === "object") return clonePlain(parsed);
      }
    } catch (error) {
      logger?.error?.("readFreshFrontmatter:", error);
    }
    return clonePlain(app.metadataCache?.getFileCache?.(targetFile)?.frontmatter || {});
  };

  const patchFrontmatter = async (targetFile, mutator, {
    refresh = null,
    reread = true
  } = {}) => {
    if (!targetFile) throw new Error("patchFrontmatter: targetFile is required");
    if (typeof mutator !== "function") throw new Error("patchFrontmatter: mutator is required");
    await app.fileManager.processFrontMatter(targetFile, mutator);
    if (typeof refresh === "function") await refresh();
    const frontmatter = reread ? await readFreshFrontmatter(targetFile) : {};
    return { ok: true, file: targetFile, frontmatter };
  };

  const moveFileToFolder = async (targetFile, folderPath, {
    fileName = "",
    refresh = null
  } = {}) => {
    if (!targetFile) throw new Error("moveFileToFolder: targetFile is required");
    const folder = normalizeVaultPath(folderPath);
    if (!folder) throw new Error("moveFileToFolder: folderPath is required");
    await ensureFolderPath(folder);
    const name = String(fileName || targetFile.name || getFileNameFromPath(targetFile.path) || "").trim();
    if (!name) throw new Error("moveFileToFolder: file name is required");
    const oldPath = normalizeVaultPath(targetFile.path || "");
    const newPath = `${folder}/${name}`;
    if (oldPath !== newPath) await app.fileManager.renameFile(targetFile, newPath);
    if (typeof refresh === "function") await refresh();
    return { ok: true, moved: oldPath !== newPath, oldPath, newPath, file: targetFile };
  };

  const openFileByPath = async (path, leaf = null) => {
    const targetFile = getFile(path);
    if (!targetFile) return { ok: false, reason: "missing_file", path: normalizeVaultPath(path) };
    await (leaf || app.workspace?.getLeaf?.(false))?.openFile?.(targetFile);
    return { ok: true, file: targetFile };
  };

  const notice = (message, NoticeCtor = null) => {
    const Ctor = NoticeCtor || globalThis.Notice;
    if (typeof Ctor === "function") return new Ctor(String(message ?? ""));
    logger?.log?.(String(message ?? ""));
    return null;
  };

  return {
    normalizeVaultPath,
    getParentFolderPath,
    getFileNameFromPath,
    clonePlain,
    getFile,
    ensureFolderPath,
    readTextFile,
    readFreshFrontmatter,
    patchFrontmatter,
    moveFileToFolder,
    openFileByPath,
    notice
  };
};

module.exports = {
  normalizeVaultPath,
  getParentFolderPath,
  getFileNameFromPath,
  clonePlain,
  createObsidianAdapter
};
