async ({ dv, app, file, cur, window = null, patchFileFrontmatter = null, notice = null, platform = null }) => {
    const sourcePath = "Архив/Scripts/src/shared/patient-linked-cases-core.cjs";
    const source = await dv.io.load(sourcePath);
    if (!source) throw new Error(`Patient linked cases core source not found: ${sourcePath}`);

    const module = { exports: {} };
    const exports = module.exports;
    const factory = new Function("module", "exports", `"use strict";\n${source}\nreturn module.exports;`);
    const core = factory(module, exports);

    return {
        ...core,
        actions: core.createPatientLinkedCaseActions({
            app,
            dv,
            file,
            cur,
            platform,
            patchFileFrontmatter,
            notice
        })
    };
}
