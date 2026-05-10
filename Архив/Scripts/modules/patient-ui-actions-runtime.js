async ({ dv, patchCurrentFrontmatter }) => {
    const sourcePath = "Архив/Scripts/src/shared/patient-ui-actions.cjs";
    const source = await dv.io.load(sourcePath);
    if (!source) throw new Error(`Patient UI actions source not found: ${sourcePath}`);

    const module = { exports: {} };
    const exports = module.exports;
    const factory = new Function("module", "exports", `"use strict";\n${source}\nreturn module.exports;`);
    const core = factory(module, exports);

    return {
        ...core,
        actions: core.createPatientUiActions({
            patchCurrentFrontmatter
        })
    };
}
