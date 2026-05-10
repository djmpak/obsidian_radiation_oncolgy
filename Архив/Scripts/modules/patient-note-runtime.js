async ({ dv }) => {
    const schemaSourcePath = "Архив/Scripts/src/shared/patient-schema-core.cjs";
    const schemaSource = await dv.io.load(schemaSourcePath);
    if (!schemaSource) throw new Error(`Patient schema core source not found: ${schemaSourcePath}`);
    const schemaModule = { exports: {} };
    const schemaExports = schemaModule.exports;
    const schemaFactory = new Function("module", "exports", `"use strict";\n${schemaSource}\nreturn module.exports;`);
    const schemaCore = schemaFactory(schemaModule, schemaExports);

    const pathsSourcePath = "Архив/Scripts/src/shared/paths-config-core.cjs";
    const pathsSource = await dv.io.load(pathsSourcePath);
    if (!pathsSource) throw new Error(`Paths config core source not found: ${pathsSourcePath}`);
    const pathsModule = { exports: {} };
    const pathsExports = pathsModule.exports;
    const pathsFactory = new Function("module", "exports", `"use strict";\n${pathsSource}\nreturn module.exports;`);
    const pathsConfigCore = pathsFactory(pathsModule, pathsExports);

    const sourcePath = "Архив/Scripts/src/shared/patient-note-core.cjs";
    const source = await dv.io.load(sourcePath);
    if (!source) throw new Error(`Patient note core source not found: ${sourcePath}`);

    const module = { exports: {} };
    const exports = module.exports;
    const previousSchema = globalThis._pfPatientSchemaCore;
    const previousPaths = globalThis._pfPathsConfigCore;
    globalThis._pfPatientSchemaCore = schemaCore;
    globalThis._pfPathsConfigCore = pathsConfigCore;
    let core;
    try {
        const factory = new Function("module", "exports", `"use strict";\n${source}\nreturn module.exports;`);
        core = factory(module, exports);
    } finally {
        globalThis._pfPatientSchemaCore = previousSchema;
        globalThis._pfPathsConfigCore = previousPaths;
    }

    return {
        ...core,
        renderInitialContent: core.renderInitialContent
    };
}
