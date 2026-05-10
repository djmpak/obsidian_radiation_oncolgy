async ({ dv, app, window = null, parseYaml: parseYamlFn = null, console = globalThis.console }) => {
    const sourcePath = "Архив/Scripts/src/platform/obsidian-adapter.cjs";
    const source = await dv.io.load(sourcePath);
    if (!source) throw new Error(`Obsidian adapter source not found: ${sourcePath}`);

    const module = { exports: {} };
    const exports = module.exports;
    const factory = new Function("module", "exports", `"use strict";\n${source}\nreturn module.exports;`);
    const core = factory(module, exports);
    return {
        ...core,
        adapter: core.createObsidianAdapter({ app, window, parseYaml: parseYamlFn, console })
    };
}
