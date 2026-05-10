async ({ dv }) => {
    const sourcePath = "Архив/Scripts/src/shared/desktop-editor-clinical-core.cjs";
    const source = await dv.io.load(sourcePath);
    if (!source) throw new Error(`Desktop editor clinical core source not found: ${sourcePath}`);

    const module = { exports: {} };
    const exports = module.exports;
    const factory = new Function("module", "exports", `"use strict";\n${source}\nreturn module.exports;`);
    return factory(module, exports);
}
