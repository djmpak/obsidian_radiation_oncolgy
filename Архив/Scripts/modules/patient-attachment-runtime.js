async ({ dv, app, now = null, patchCurrentFrontmatter = null, notice = null, platform = null }) => {
    const sourcePath = "Архив/Scripts/src/shared/patient-attachment-core.cjs";
    const source = await dv.io.load(sourcePath);
    if (!source) throw new Error(`Patient attachment core source not found: ${sourcePath}`);

    const module = { exports: {} };
    const exports = module.exports;
    const factory = new Function("module", "exports", `"use strict";\n${source}\nreturn module.exports;`);
    const core = factory(module, exports);

    return {
        ...core,
        actions: core.createPatientAttachmentActions({
            app,
            platform,
            patchCurrentFrontmatter,
            notice,
            now
        })
    };
}
