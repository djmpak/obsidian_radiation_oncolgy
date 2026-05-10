async ({ dv, saveNow, resolveCurrentPatientId, buildDatabaseRowFromCurrent, upsertDatabaseRowFile, removeDatabaseRowFile, waitForPatientInDatabase, markDatabaseExportForCurrent, clearDatabaseExportMarkForCurrent, moveCurrentFileToFolder, isDischargedFilePath, getCurrentFilePath, getCurrentFileName, dischargeFolder, notify }) => {
    const sourcePath = "Архив/Scripts/src/shared/patient-db-actions.cjs";
    const source = await dv.io.load(sourcePath);
    if (!source) throw new Error(`Patient database actions source not found: ${sourcePath}`);

    const module = { exports: {} };
    const exports = module.exports;
    const factory = new Function("module", "exports", `"use strict";\n${source}\nreturn module.exports;`);
    const core = factory(module, exports);

    return {
        ...core,
        actions: core.createPatientDatabaseActions({
            saveNow,
            resolveCurrentPatientId,
            buildDatabaseRowFromCurrent,
            upsertDatabaseRowFile,
            removeDatabaseRowFile,
            waitForPatientInDatabase,
            markDatabaseExportForCurrent,
            clearDatabaseExportMarkForCurrent,
            moveCurrentFileToFolder,
            isDischargedFilePath,
            getCurrentFilePath,
            getCurrentFileName,
            dischargeFolder,
            notify
        })
    };
}
