async ({ dv, app, parseYaml: parseYamlFn = null, window = null }) => {
    const sourcePath = "Архив/Scripts/src/shared/database-core.cjs";
    const source = await dv.io.load(sourcePath);
    if (!source) throw new Error(`Database core source not found: ${sourcePath}`);
    const adapterSourcePath = "Архив/Scripts/src/platform/obsidian-adapter.cjs";
    const adapterSource = await dv.io.load(adapterSourcePath);
    if (!adapterSource) throw new Error(`Obsidian adapter source not found: ${adapterSourcePath}`);
    const frontmatterSourcePath = "Архив/Scripts/src/shared/storage-frontmatter-core.cjs";
    const frontmatterSource = await dv.io.load(frontmatterSourcePath);
    if (!frontmatterSource) throw new Error(`Storage frontmatter core source not found: ${frontmatterSourcePath}`);
    const writeLayerSourcePath = "Архив/Scripts/src/shared/write-layer-core.cjs";
    const writeLayerSource = await dv.io.load(writeLayerSourcePath);
    if (!writeLayerSource) throw new Error(`Write layer core source not found: ${writeLayerSourcePath}`);

    const module = { exports: {} };
    const exports = module.exports;
    const factory = new Function("module", "exports", `"use strict";\n${source}\nreturn module.exports;`);
    const core = factory(module, exports);
    const adapterModule = { exports: {} };
    const adapterExports = adapterModule.exports;
    const adapterFactory = new Function("module", "exports", `"use strict";\n${adapterSource}\nreturn module.exports;`);
    const adapterCore = adapterFactory(adapterModule, adapterExports);
    const frontmatterModule = { exports: {} };
    const frontmatterExports = frontmatterModule.exports;
    const frontmatterFactory = new Function("module", "exports", `"use strict";\n${frontmatterSource}\nreturn module.exports;`);
    const frontmatterCore = frontmatterFactory(frontmatterModule, frontmatterExports);
    const writeLayerModule = { exports: {} };
    const writeLayerExports = writeLayerModule.exports;
    const writeLayerFactory = new Function("module", "exports", `"use strict";\n${writeLayerSource}\nreturn module.exports;`);
    const writeLayerCore = writeLayerFactory(writeLayerModule, writeLayerExports);

    const adapter = adapterCore.createObsidianAdapter({
        app,
        window,
        parseYaml: (text) => {
            try {
                if (typeof parseYamlFn === "function") return parseYamlFn(text);
                if (typeof window?.parseYaml === "function") return window.parseYaml(text);
            } catch (_) {}
            return null;
        },
        console
    });
    const frontmatter = frontmatterCore.createStorageFrontmatterCore({ adapter });
    const writeLayer = writeLayerCore.createWriteLayerCore({ frontmatter, app, window, console });
    const ensureFolderPath = adapter.ensureFolderPath;
    const getParentFolderPath = adapter.getParentFolderPath;

    const ensureDatabaseFile = async (dbPath) => {
        const path = String(dbPath || "").trim();
        if (!path) throw new Error("ensureDatabaseFile: dbPath is required");
        let dbFile = app.vault.getAbstractFileByPath(path);
        if (dbFile) {
            return { dbFile, content: core.ensureDatabaseSchema(await app.vault.read(dbFile)) };
        }

        await ensureFolderPath(getParentFolderPath(path));
        const content = core.ensureDatabaseSchema("");
        try {
            dbFile = await app.vault.create(path, content);
        } catch (error) {
            dbFile = app.vault.getAbstractFileByPath(path);
            if (!dbFile) throw error;
        }
        return { dbFile, content };
    };

    const readDatabaseFile = async (dbPath) => {
        const path = String(dbPath || "").trim();
        if (!path) return null;
        const dbFile = app.vault.getAbstractFileByPath(path);
        if (!dbFile) return null;
        return { dbFile, content: core.ensureDatabaseSchema(await app.vault.read(dbFile)) };
    };

    const readFreshFrontmatter = writeLayer.readFreshFrontmatter;
    const installFrontmatterPatch = writeLayer.installFrontmatterPatch;
    const installRenamePatch = writeLayer.installRenamePatch;
    const patchFrontmatter = writeLayer.patchFrontmatter;

    const findDatabaseRowFile = async (dbPath, patientId) => {
        const read = await readDatabaseFile(dbPath);
        if (!read) return null;
        return core.findDatabaseRow(read.content, patientId);
    };

    const waitForDatabaseRowFile = async (dbPath, patientId, { exists = true, attempts = 7, delayMs = 180 } = {}) => {
        const dbId = String(patientId || "").trim();
        if (!dbId) return null;
        let lastFound = null;
        for (let attempt = 0; attempt < attempts; attempt++) {
            const found = await findDatabaseRowFile(dbPath, dbId);
            lastFound = found;
            if (exists ? !!found : !found) return found;
            if (attempt < attempts - 1) await new Promise(resolve => setTimeout(resolve, delayMs));
        }
        return lastFound;
    };

    const upsertDatabaseRowFile = async (dbPath, row, patientId, { recordDate } = {}) => {
        const { dbFile, content } = await ensureDatabaseFile(dbPath);
        const result = core.upsertDatabaseRow(content, row, patientId, { recordDate });
        await app.vault.modify(dbFile, result.content);
        return { ok: true, dbFile, ...result };
    };

    const removeDatabaseRowFile = async (dbPath, patientId) => {
        const read = await readDatabaseFile(dbPath);
        if (!read) return { ok: true, removed: false, lineIndex: -1 };
        const result = core.removeDatabaseRow(read.content, patientId);
        if (result.removed) await app.vault.modify(read.dbFile, result.content);
        return { ok: true, dbFile: read.dbFile, ...result };
    };

    const DEFAULT_EXPORT_AT_KEY = "db_exported_at";
    const DEFAULT_EXPORT_SOURCE_KEY = "db_export_source";

    const markDatabaseExport = async (targetFile, {
        source = "",
        dateIso = "",
        atKey = DEFAULT_EXPORT_AT_KEY,
        sourceKey = DEFAULT_EXPORT_SOURCE_KEY,
        refresh = null
    } = {}) => {
        if (!targetFile) throw new Error("markDatabaseExport: targetFile is required");
        const exportedAt = String(dateIso || new Date().toISOString().slice(0, 10));
        await patchFrontmatter(targetFile, fm => {
            fm[atKey] = exportedAt;
            fm[sourceKey] = source;
        }, { refresh, reread: false });
        return { ok: true, exportedAt, source };
    };

    const clearDatabaseExportMark = async (targetFile, {
        atKey = DEFAULT_EXPORT_AT_KEY,
        sourceKey = DEFAULT_EXPORT_SOURCE_KEY,
        refresh = null
    } = {}) => {
        if (!targetFile) throw new Error("clearDatabaseExportMark: targetFile is required");
        await patchFrontmatter(targetFile, fm => {
            try { delete fm[atKey]; } catch (_) { fm[atKey] = null; }
            try { delete fm[sourceKey]; } catch (_) { fm[sourceKey] = null; }
        }, { refresh, reread: false });
        return { ok: true };
    };

    const moveFileToFolder = adapter.moveFileToFolder;

    const _makeDischargePatientFileDeps = (dbPath, exportOpts = {}) => ({
        readFreshFrontmatter,
        resolvePatientId: (fm) => core.resolvePatientId({ existingId: fm?.ID_пациента, fio: fm?.ФИО, birthDate: fm?.Дата_рождения }),
        patchFrontmatter,
        upsertRowFile: (row, patientId, recordDate) => upsertDatabaseRowFile(dbPath, row, patientId, { recordDate }),
        buildRowFromFm: (fm) => core.buildDatabaseRow({
            getVal: (key) => Object.prototype.hasOwnProperty.call(fm || {}, key) ? (fm[key] ?? null) : null,
            todayIso: () => new Date().toISOString().slice(0, 10)
        }),
        waitForRowFile: (patientId, opts) => waitForDatabaseRowFile(dbPath, patientId, opts),
        moveFileToFolder,
        markExport: (file, source) => markDatabaseExport(file, { source, ...exportOpts }),
        clearExportMark: (file) => clearDatabaseExportMark(file, exportOpts),
        removeRowFile: (patientId) => removeDatabaseRowFile(dbPath, patientId),
        todayIso: () => new Date().toISOString().slice(0, 10)
    });

    const dischargePatientFile = async (dbPath, targetFile, opts = {}) =>
        core.dischargePatient(_makeDischargePatientFileDeps(dbPath, {
            atKey: opts.atKey,
            sourceKey: opts.sourceKey
        }), targetFile, opts);

    /**
     * Syncs patient frontmatter to the markdown DB without moving the file.
     * Ensures patient ID, builds and upserts the DB row, then optionally marks export.
     */
    const syncPatientFileToDatabase = async (dbPath, targetFile, {
        markExport = true,
        source = "desktop-sync",
        atKey,
        sourceKey
    } = {}) => {
        try {
            if (!targetFile) return { ok: false, reason: "missing_file" };
            let fm = await readFreshFrontmatter(targetFile);
            const deps = _makeDischargePatientFileDeps(dbPath, { atKey, sourceKey });
            const { id: resolvedId, source: idSource } = deps.resolvePatientId(fm);
            if (idSource !== "existing" && resolvedId) {
                await patchFrontmatter(targetFile, (data) => {
                    Object.assign(data, core.getPatientIdPatch(resolvedId));
                }, { reread: false });
                fm = await readFreshFrontmatter(targetFile);
            }
            const dbId = resolvedId || String((fm || {}).ID_пациента || "");
            if (!dbId) return { ok: false, reason: "missing_id" };
            const row = deps.buildRowFromFm(fm);
            await deps.upsertRowFile(row, dbId, deps.todayIso());
            const verified = await deps.waitForRowFile(dbId, { exists: true });
            if (!verified) throw new Error("Не удалось подтвердить запись пациента в БД");
            if (markExport) {
                await deps.markExport(targetFile, source);
            }
            return { ok: true, id: String(dbId) };
        } catch (e) {
            console.error("syncPatientFileToDatabase:", e);
            return { ok: false, reason: "write_failed", error: e };
        }
    };

    /**
     * Removes patient from the markdown DB and optionally clears the export mark.
     */
    const removePatientFileFromDatabase = async (dbPath, targetFile, {
        clearExportMark = true,
        atKey,
        sourceKey
    } = {}) => {
        try {
            if (!targetFile) return { ok: false, reason: "missing_file" };
            const fm = await readFreshFrontmatter(targetFile);
            const dbId = String((fm || {}).ID_пациента || "").trim();
            if (!dbId) return { ok: false, reason: "missing_id" };
            await removeDatabaseRowFile(dbPath, dbId);
            const verified = await waitForDatabaseRowFile(dbPath, dbId, { exists: false });
            if (verified) throw new Error("Не удалось подтвердить удаление пациента из БД");
            if (clearExportMark) {
                await clearDatabaseExportMark(targetFile, { atKey, sourceKey });
            }
            return { ok: true, id: dbId };
        } catch (e) {
            console.error("removePatientFileFromDatabase:", e);
            return { ok: false, reason: "delete_failed", error: e };
        }
    };

    return {
        ...core,
        ensureFolderPath,
        readFreshFrontmatter,
        installFrontmatterPatch,
        installRenamePatch,
        patchFrontmatter,
        ensureDatabaseFile,
        readDatabaseFile,
        findDatabaseRowFile,
        waitForDatabaseRowFile,
        upsertDatabaseRowFile,
        removeDatabaseRowFile,
        markDatabaseExport,
        clearDatabaseExportMark,
        moveFileToFolder,
        dischargePatientFile,
        syncPatientFileToDatabase,
        removePatientFileFromDatabase
    };
}
