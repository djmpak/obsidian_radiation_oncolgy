async ({ dv, app, window = null, parseYaml: parseYamlFn = null, console = globalThis.console, timers = globalThis, debounceMs = 120 }) => {
    const coreSourcePath = "Архив/Scripts/src/shared/storage-frontmatter-core.cjs";
    const coreSource = await dv.io.load(coreSourcePath);
    if (!coreSource) throw new Error(`Storage frontmatter core source not found: ${coreSourcePath}`);

    const adapterSourcePath = "Архив/Scripts/src/platform/obsidian-adapter.cjs";
    const adapterSource = await dv.io.load(adapterSourcePath);
    if (!adapterSource) throw new Error(`Obsidian adapter source not found: ${adapterSourcePath}`);

    const module = { exports: {} };
    const exports = module.exports;
    const factory = new Function("module", "exports", `"use strict";\n${coreSource}\nreturn module.exports;`);
    const core = factory(module, exports);

    const adapterModule = { exports: {} };
    const adapterExports = adapterModule.exports;
    const adapterFactory = new Function("module", "exports", `"use strict";\n${adapterSource}\nreturn module.exports;`);
    const adapterCore = adapterFactory(adapterModule, adapterExports);
    const adapter = adapterCore.createObsidianAdapter({ app, window, parseYaml: parseYamlFn, console });
    const storageFrontmatter = core.createStorageFrontmatterCore({ adapter, timers, debounceMs });

    return {
        ...core,
        adapter,
        storageFrontmatter,
        readFreshFrontmatter: storageFrontmatter.readFreshFrontmatter,
        mergeFrontmatterShallow: storageFrontmatter.mergeFrontmatterShallow,
        patchFrontmatter: storageFrontmatter.patchFrontmatter,
        createDebouncedWriteQueue: storageFrontmatter.createDebouncedWriteQueue
    };
}
