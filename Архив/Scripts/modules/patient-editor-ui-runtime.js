async ({ dv, cur, saveNow, getVal, getQLQModule, notice = null } = {}) => {
    const sourcePath = "Архив/Scripts/src/shared/patient-editor-ui.cjs";
    const source = await dv.io.load(sourcePath);
    if (!source) throw new Error(`Patient editor UI source not found: ${sourcePath}`);

    const module = { exports: {} };
    const exports = module.exports;
    const factory = new Function("module", "exports", `"use strict";\n${source}\nreturn module.exports;`);
    const core = factory(module, exports);

    const makeContext = (overrides = {}) => ({
        dv,
        cur,
        saveNow,
        getVal,
        getQLQModule,
        notice,
        ...overrides
    });

    const api = {
        ...core,
        root: null,
        openPatientCardEditorModal: (overrides = {}) => core.openPatientCardEditorModal(makeContext(overrides)),
        mountPatientEditorControls: (overrides = {}) => {
            const context = makeContext(overrides);
            const openPatientCardEditorModal = context.openPatientCardEditorModal || api.openPatientCardEditorModal(overrides);
            const root = core.mountPatientEditorControls({
                ...context,
                openPatientCardEditorModal
            });
            api.root = root;
            return { root, openPatientCardEditorModal };
        }
    };

    return api;
}
