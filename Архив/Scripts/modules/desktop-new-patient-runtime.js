async ({ dv, app, window = null, document = globalThis.document, _pfDesktopCore, _pfDesktopPlatform, _pfDiagnosisCore, normalizeConn, _dbResolvePatientId, _dbMergeDiagnosisText, _dbNormalizeHistoryText, _dbNormalizeDrugNames, _dbNormalizeDiagnosisText }) => {
    const coreSourcePath = "Архив/Scripts/src/shared/desktop-new-patient-core.cjs";
    const coreSource = await dv.io.load(coreSourcePath);
    if (!coreSource) throw new Error("Desktop new-patient core source not found: " + coreSourcePath);

    const module = { exports: {} };
    const exports = module.exports;
    const factory = new Function("module", "exports", `"use strict";\n${coreSource}\nreturn module.exports;`);
    const core = factory(module, exports);
    if (!window?._pfLoadRuntimeModule) throw new Error("desktop-new-patient-runtime: window._pfLoadRuntimeModule is required");

    const parserUi = await window._pfLoadRuntimeModule("Архив/Scripts/modules/desktop-parser-runtime.js");
    const clinicalSection = await window._pfLoadRuntimeModule("Архив/Scripts/modules/desktop-editor-clinical-runtime.js");
    const hltRuntime = await window._pfLoadRuntimeModule("Архив/Scripts/modules/desktop-hlt-runtime.js");
    const treatmentVolumesRuntime = await window._pfLoadRuntimeModule("Архив/Scripts/modules/desktop-treatment-volumes-runtime.js");
    const patientAcceleratorCore = await window._pfLoadRuntimeModule("Архив/Scripts/modules/patient-accelerator-runtime.js");
    const patientNoteCore = await window._pfLoadRuntimeModule("Архив/Scripts/modules/patient-note-runtime.js");
    const patientTransferCore = await window._pfLoadRuntimeModule("Архив/Scripts/modules/patient-transfer-runtime.js");

    return core.createDesktopNewPatientRuntime({
        dv,
        app,
        window,
        document,
        _pfDesktopCore,
        _pfDesktopPlatform,
        _pfDiagnosisCore,
        normalizeConn,
        _pfDesktopParserUi: parserUi,
        _pfDesktopClinicalSection: clinicalSection,
        _pfDesktopHlt: hltRuntime,
        _pfDesktopTreatmentVolumes: treatmentVolumesRuntime,
        _pfPatientAcceleratorCore: patientAcceleratorCore,
        _pfPatientNoteCore: patientNoteCore,
        _pfPatientTransferCore: patientTransferCore,
        _dbResolvePatientId,
        _dbMergeDiagnosisText,
        _dbNormalizeHistoryText,
        _dbNormalizeDrugNames,
        _dbNormalizeDiagnosisText
    });
}
