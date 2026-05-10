"use strict";

const requireOptional = (path) => {
  try {
    if (typeof require === "function") return require(path);
  } catch (_) {}
  return null;
};

const schemaCore = requireOptional("./patient-schema-core.cjs")
  || (typeof globalThis !== "undefined" ? globalThis._pfPatientSchemaCore : null);
const pathsConfig = requireOptional("./paths-config-core.cjs")
  || (typeof globalThis !== "undefined" ? globalThis._pfPathsConfigCore : null);

if (!schemaCore) {
  throw new Error("patient-note-core requires patient-schema-core");
}

const PATIENT_VIEW_PATH = pathsConfig?.PATHS?.patientViewPath || "Архив/Scripts/views/patient";
const DEFAULT_FRONTMATTER = schemaCore.DEFAULT_FRONTMATTER;
const TEMP_FRONTMATTER_KEYS = schemaCore.TEMP_FRONTMATTER_KEYS;
const ensureInitialFrontmatter = schemaCore.ensureInitialFrontmatter;
const cloneValue = schemaCore.cloneValue;

const isPlainObject = (value) => !!value && typeof value === "object" && !Array.isArray(value);

const isSafeBareYamlString = (value) => {
  const text = String(value);
  if (!text) return false;
  if (/^\s|\s$/u.test(text)) return false;
  if (/[\r\n]/u.test(text)) return false;
  if (/^[-?:,[\]{}#&*!|>'"%@`]/u.test(text)) return false;
  if (/:\s/u.test(text)) return false;
  return true;
};

const renderYamlValue = (value) => {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  if (Array.isArray(value)) return value.length ? JSON.stringify(value) : "[]";
  if (isPlainObject(value)) return JSON.stringify(value);
  const text = String(value);
  return isSafeBareYamlString(text) ? text : JSON.stringify(text);
};

const renderFrontmatter = (frontmatter = {}) => {
  const lines = Object.entries(frontmatter).map(([key, value]) => `${key}: ${renderYamlValue(value)}`);
  return `---\n${lines.join("\n")}\n---`;
};

const renderPatientViewBlock = () => [
  "```dataviewjs",
  `await dv.view("${PATIENT_VIEW_PATH}", {`,
  "    notePath: dv.current()?.file?.path || \"\"",
  "});",
  "```"
].join("\n");

const renderInitialContent = ({ frontmatter = {} } = {}) => {
  const initialFrontmatter = ensureInitialFrontmatter(frontmatter);
  return `${renderFrontmatter(initialFrontmatter)}\n\n${renderPatientViewBlock()}\n`;
};

module.exports = {
  PATIENT_VIEW_PATH,
  DEFAULT_FRONTMATTER,
  TEMP_FRONTMATTER_KEYS,
  cloneValue,
  ensureInitialFrontmatter,
  renderYamlValue,
  renderFrontmatter,
  renderPatientViewBlock,
  renderInitialContent
};
