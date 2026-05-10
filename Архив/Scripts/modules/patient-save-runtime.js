async ({ dv, patchCurrentFrontmatter, mergeIntoStoredFrontmatter, refreshStoredFrontmatter, ls, notify = null, markPhase = null, showSaveFlash = null }) => {
    const sourcePath = "Архив/Scripts/src/shared/patient-save-actions.cjs";
    const source = await dv.io.load(sourcePath);
    if (!source) throw new Error(`Patient save actions source not found: ${sourcePath}`);

    const module = { exports: {} };
    const exports = module.exports;
    const factory = new Function("module", "exports", `"use strict";\n${source}\nreturn module.exports;`);
    const core = factory(module, exports);

    return {
        ...core,
        actions: core.createPatientSaveActions({
            patchCurrentFrontmatter,
            mergeIntoStoredFrontmatter,
            refreshStoredFrontmatter,
            ls,
            notify,
            markPhase,
            showSaveFlash
        })
    };
}
