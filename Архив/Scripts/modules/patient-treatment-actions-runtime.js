async ({ dv, saveNow = null, ls = null }) => {
    const sourcePath = "Архив/Scripts/src/shared/patient-treatment-actions.cjs";
    const source = await dv.io.load(sourcePath);
    if (!source) throw new Error(`Patient treatment actions source not found: ${sourcePath}`);

    const module = { exports: {} };
    const exports = module.exports;
    const factory = new Function("module", "exports", `"use strict";\n${source}\nreturn module.exports;`);
    const core = factory(module, exports);

    return {
        ...core,
        actions: core.createPatientTreatmentActions({
            saveNow,
            ls
        })
    };
}
