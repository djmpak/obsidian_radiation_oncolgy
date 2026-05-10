const assert = require("assert");

const core = require("../src/shared/patient-accelerator-core.cjs");

const test = (name, fn) => {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    console.error(error);
    process.exitCode = 1;
  }
};

test("defaults to Halcyon when treatment context is not stereotactic", () => {
  assert.deepEqual(core.ACCELERATORS, ["Varian Halcyon", "Varian TrueBeam"]);
  assert.equal(core.resolveAccelerator({ mode: "Конформная терапия" }), "Varian Halcyon");
  assert.equal(core.getDefaultAccelerator({ method: "IMRT" }), "Varian Halcyon");
});

test("uses TrueBeam for stereotactic mode, method, or fractionation", () => {
  assert.equal(core.resolveAccelerator({ mode: "SRS" }), "Varian TrueBeam");
  assert.equal(core.resolveAccelerator({ method: "SBRT" }), "Varian TrueBeam");
  assert.equal(core.resolveAccelerator({ fractionation: "Стереотаксическое" }), "Varian TrueBeam");
});

test("normalizeAccelerator keeps a known accelerator as-is", () => {
  assert.equal(core.normalizeAccelerator("Varian TrueBeam"), "Varian TrueBeam");
  assert.equal(core.normalizeAccelerator("Varian Halcyon"), "Varian Halcyon");
});

test("normalizeAccelerator falls back to the safe default for unknown values", () => {
  assert.equal(
    core.normalizeAccelerator("Unknown accelerator", { mode: "SBRT" }),
    "Varian TrueBeam"
  );
  assert.equal(
    core.normalizeAccelerator("", { mode: "Паллиативная терапия" }),
    "Varian Halcyon"
  );
});

test("isStereotaxisMode detects stereotactic keywords", () => {
  assert.equal(core.isStereotaxisMode("стереотаксическая терапия"), true);
  assert.equal(core.isStereotaxisMode("SRT"), true);
  assert.equal(core.isStereotaxisMode("Conventional"), false);
});

if (process.exitCode) process.exit(process.exitCode);
console.log("OK patient accelerator core tests passed");
