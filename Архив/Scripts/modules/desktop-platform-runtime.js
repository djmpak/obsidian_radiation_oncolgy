async ({ dv, app, window = null, Notice = globalThis.Notice }) => {
    const adapterRuntimePath = "Архив/Scripts/modules/obsidian-adapter-runtime.js";
    const adapterRuntime = await window._pfLoadRuntimeModule(adapterRuntimePath);
    const adapter = adapterRuntime?.adapter;
    if (!adapter) throw new Error(`Desktop platform adapter not found: ${adapterRuntimePath}`);

    const notice = (message) => adapter.notice(message, Notice);
    const getFile = (path) => adapter.getFile(path);
    const fileExists = (path) => Boolean(getFile(path));
    const ensureFolderPath = (folderPath) => adapter.ensureFolderPath(folderPath);

    const openFileByPath = (path, leaf = null) => adapter.openFileByPath(path, leaf);
    const openLinkText = async (linkText, sourcePath = "", leaf = null) => {
        const targetLeaf = leaf || app.workspace?.getLeaf?.(false) || null;
        if (typeof app.workspace?.openLinkText === "function") {
            return app.workspace.openLinkText(linkText, sourcePath, targetLeaf);
        }
        return openFileByPath(linkText, targetLeaf);
    };

    const reopenCurrentFile = async () => {
        const leaf = app.workspace?.activeLeaf;
        const file = app.workspace?.getActiveFile?.();
        if (!leaf || !file) return null;
        await leaf.setViewState({ type: "empty" });
        await leaf.openFile(file, { active: true });
        return file;
    };
    const refreshCurrentFile = reopenCurrentFile;

    const createFile = async (path, content = "") => {
        const normalized = adapter.normalizeVaultPath(path);
        if (!normalized) throw new Error("createFile: path is required");
        const parentFolder = adapter.getParentFolderPath(normalized);
        if (parentFolder) await ensureFolderPath(parentFolder);
        return app.vault.create(normalized, content || "");
    };

    const createUniqueFile = async (folderPath, baseName, content = "", { extension = ".md" } = {}) => {
        const folder = adapter.normalizeVaultPath(folderPath);
        const safeBase = String(baseName || "").trim();
        const ext = String(extension || ".md").startsWith(".") ? String(extension || ".md") : `.${String(extension || "").trim()}`;
        if (!folder) throw new Error("createUniqueFile: folderPath is required");
        if (!safeBase) throw new Error("createUniqueFile: baseName is required");

        await ensureFolderPath(folder);
        let candidate = `${folder}/${safeBase}${ext}`;
        let index = 2;
        while (true) {
            try {
                if (fileExists(candidate)) throw new Error("exists");
                return await createFile(candidate, content);
            } catch (error) {
                if (!String(error?.message || error).includes("exists")) throw error;
                candidate = `${folder}/${safeBase} (${index})${ext}`;
                index++;
            }
        }
    };

    return {
        ...adapter,
        notice,
        getFile,
        fileExists,
        ensureFolderPath,
        openFileByPath,
        openLinkText,
        refreshCurrentFile,
        reopenCurrentFile,
        createFile,
        createUniqueFile
    };
}
