async ({ dv }) => {
  const loadSource = async (sourcePath) => {
    const source = await dv.io.load(sourcePath);
    if (!source) throw new Error(`Source not found: ${sourcePath}`);
    return source;
  };

  const scheduleSource = await loadSource("Архив/Scripts/src/shared/schedule-core.cjs");
  const scheduleModule = { exports: {} };
  const scheduleExports = scheduleModule.exports;
  const scheduleFactory = new Function("module", "exports", `"use strict";\n${scheduleSource}\nreturn module.exports;`);
  const scheduleCore = scheduleFactory(scheduleModule, scheduleExports);

  const chemoSource = await loadSource("Архив/Scripts/src/shared/patient-chemo-reminders-core.cjs");
  const chemoModule = { exports: {} };
  const chemoExports = chemoModule.exports;
  const localRequire = (id) => {
    if (id === "./schedule-core.cjs") return scheduleCore;
    throw new Error(`Unsupported runtime dependency: ${id}`);
  };
  const chemoFactory = new Function("module", "exports", "require", `"use strict";\n${chemoSource}\nreturn module.exports;`);
  return chemoFactory(chemoModule, chemoExports, localRequire);
}
