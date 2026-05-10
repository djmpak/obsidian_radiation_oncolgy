const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..", "..", "..");
const corePath = path.join(root, "Архив", "Scripts", "src", "shared", "desktop-treatment-volumes-core.cjs");
const runtimePath = path.join(root, "Архив", "Scripts", "modules", "desktop-treatment-volumes-runtime.js");
const core = require(corePath);

assert.equal(typeof core.mountDesktopTreatmentVolumesSection, "function");
assert.equal(typeof core.buildTreatmentVolumeGroups, "function");
assert.equal(typeof core.getTreatmentVolumeDefaultName, "function");

assert.deepEqual(
  core.buildTreatmentVolumeGroups([
    { Связь: "Одновременно" },
    { Связь: "Параллельно" },
    { Связь: "Последовательный буст" },
    { Связь: "Последовательно" },
    { Связь: "Одновременно" }
  ], (raw) => String(raw || "")),
  [
    { largeVol: null, largeIdx: null, conn: null, boosts: [{ vol: { Связь: "Одновременно" }, idx: 0 }] },
    { largeVol: { Связь: "Параллельно" }, largeIdx: 1, conn: "Параллельно", boosts: [{ vol: { Связь: "Последовательный буст" }, idx: 2 }] },
    { largeVol: { Связь: "Последовательно" }, largeIdx: 3, conn: "Последовательно", boosts: [{ vol: { Связь: "Одновременно" }, idx: 4 }] }
  ]
);

assert.equal(core.getTreatmentVolumeDefaultName(1, 1), "PTV");
assert.equal(core.getTreatmentVolumeDefaultName(3, 2), "PTV2");

const runtimeSource = fs.readFileSync(runtimePath, "utf8");
assert.match(runtimeSource, /desktop-treatment-volumes-core\.cjs/u);
assert.match(runtimeSource, /module\.exports/u);
assert.match(fs.readFileSync(corePath, "utf8"), /Ускоритель/u);

console.log("OK desktop treatment volumes core exports and grouping checks passed");
