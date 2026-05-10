async ({ dv }) => {
  const loadCjs = async (sourcePath) => {
    const source = await dv.io.load(sourcePath);
    if (!source) throw new Error(`Source not found: ${sourcePath}`);
    const module = { exports: {} };
    const exports = module.exports;
    const factory = new Function("module", "exports", `"use strict";\n${source}\nreturn module.exports;`);
    return factory(module, exports);
  };

  const core = await loadCjs("Архив/Scripts/src/shared/patient-bottom-panels-core.cjs");
  const reminderCore = await loadCjs("Архив/Scripts/src/shared/patient-reminder-core.cjs");
  const scheduleCore = await loadCjs("Архив/Scripts/src/shared/schedule-core.cjs");
  const platform = await loadCjs("Архив/Scripts/src/platform/obsidian-adapter.cjs");

  return {
    buildDispanseryReminders: core.buildDispanseryReminders,
    mountPatientBottomPanels: (ctx = {}) => core.mountPatientBottomPanels({
      ...ctx,
      reminderCore,
      scheduleCore,
      platform
    })
  };
}
