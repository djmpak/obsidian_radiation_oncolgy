async ({ dv, patchCurrentFrontmatter, workflowCore, linkedCaseActions = null, notice = null }) => {
    const sourcePath = "Архив/Scripts/src/shared/patient-domain-actions.cjs";
    const source = await dv.io.load(sourcePath);
    if (!source) throw new Error(`Patient domain actions core source not found: ${sourcePath}`);

    const module = { exports: {} };
    const exports = module.exports;
    const factory = new Function("module", "exports", `"use strict";\n${source}\nreturn module.exports;`);
    const core = factory(module, exports);

    return {
        ...core,
        actions: core.createPatientDomainActions({
            patchCurrentFrontmatter,
            workflowCore,
            linkedCaseActions,
            notice
        })
    };
}
