"use strict";

const ACCELERATORS = Object.freeze([
  "Varian Halcyon",
  "Varian TrueBeam"
]);

const ACCELERATOR_ALIASES = new Map([
  ["varian halcyon", "Varian Halcyon"],
  ["halcyon", "Varian Halcyon"],
  ["varian truebeam", "Varian TrueBeam"],
  ["truebeam", "Varian TrueBeam"],
  ["true beam", "Varian TrueBeam"]
]);

const STEREOTAXIS_PATTERNS = [
  /\bSBRT\b/iu,
  /\bSRS\b/iu,
  /\bSRT\b/iu,
  /stereotax/iu,
  /стереотакс/iu
];

const normalizeText = (value) => String(value ?? "").replace(/\s+/gu, " ").trim();

const isStereotaxisMode = (value) => {
  const text = normalizeText(value);
  if (!text) return false;
  return STEREOTAXIS_PATTERNS.some((pattern) => pattern.test(text));
};

const getDefaultAccelerator = (context = {}) => resolveAccelerator(context);

const resolveAccelerator = (context = {}) => {
  const source = typeof context === "string" ? { mode: context } : (context || {});
  const values = [source.mode, source.method, source.fractionation];
  return values.some(isStereotaxisMode) ? "Varian TrueBeam" : "Varian Halcyon";
};

const normalizeAccelerator = (value, context = {}) => {
  const text = normalizeText(value);
  if (text) {
    const normalized = ACCELERATOR_ALIASES.get(text.toLowerCase());
    if (normalized) return normalized;
  }
  return resolveAccelerator(context);
};

module.exports = {
  ACCELERATORS,
  normalizeAccelerator,
  isStereotaxisMode,
  getDefaultAccelerator,
  resolveAccelerator
};
