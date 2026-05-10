const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..", "..", "..");
const corePath = path.join(root, "Архив", "Scripts", "src", "shared", "desktop-hlt-core.cjs");
const runtimePath = path.join(root, "Архив", "Scripts", "modules", "desktop-hlt-runtime.js");
const core = require(corePath);

assert.equal(typeof core.mountDesktopHltSection, "function");
assert.equal(Array.isArray(core.HLT_REGIMES), true);
assert.equal(core.HLT_REGIMES[0], "Однократно");
assert.equal(core.HLT_REGIMES.at(-1), "В дни лучевой терапии");

const runtimeSource = fs.readFileSync(runtimePath, "utf8");
assert.match(runtimeSource, /desktop-hlt-core\.cjs/u);
assert.match(runtimeSource, /module\.exports/u);

console.log("OK desktop HLT core exports and runtime wiring checks passed");
