async ({ dv, window = null, document = globalThis.document, today, realToday, dateOffset, dateOffsetKey, dateNavDiv, _pfDesktopPlatform }) => {
    const coreSourcePath = "Архив/Scripts/src/shared/desktop-calendar-core.cjs";
    const coreSource = await dv.io.load(coreSourcePath);
    if (!coreSource) throw new Error("Desktop calendar core source not found: " + coreSourcePath);

    const module = { exports: {} };
    const exports = module.exports;
    const factory = new Function("module", "exports", `"use strict";\n${coreSource}\nreturn module.exports;`);
    const core = factory(module, exports);

    return core.createDesktopCalendarRuntime({
        dv,
        window,
        document,
        today,
        realToday,
        dateOffset,
        dateOffsetKey,
        dateNavDiv,
        desktopPlatform: _pfDesktopPlatform
    });
}
