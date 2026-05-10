const fs = require("fs");
const path = require("path");

const viewPath = path.resolve(__dirname, "../views/desktop/view.js");
const corePath = path.resolve(__dirname, "../src/shared/desktop-core.cjs");

let viewContent = fs.readFileSync(viewPath, "utf8");
let coreContent = fs.readFileSync(corePath, "utf8");

// 1. Extract getSuspiciousLabValues
const getSuspiciousStart = "const getSuspiciousLabValues = (entries) => {";
const getSuspiciousEndMarker = "return suspicious;\n            };";
const getSuspiciousStartIdx = viewContent.indexOf(getSuspiciousStart);
const getSuspiciousEndIdx = viewContent.indexOf(getSuspiciousEndMarker, getSuspiciousStartIdx) + getSuspiciousEndMarker.length;
const getSuspiciousBlock = viewContent.substring(getSuspiciousStartIdx, getSuspiciousEndIdx);

// 2. Extract TEMPLATES
const templatesStart = "const TEMPLATES = [";
const templatesEndMarker = "        ];\n\n        // UI: строка выбора шаблона";
const templatesStartIdx = viewContent.indexOf(templatesStart);
const templatesEndIdx = viewContent.indexOf(templatesEndMarker, templatesStartIdx) + 10; // includes "        ];"
const templatesBlock = viewContent.substring(templatesStartIdx, templatesEndIdx).replace("const TEMPLATES =", "const TREATMENT_TEMPLATES =");

// 3. Extract LAB_GROUPS & LAB_CHART_COLORS
const labStart = "const LAB_GROUPS = [";
const labEndMarker = "const LAB_CHART_COLORS = [\"#1e88e5\", \"#43a047\", \"#e53935\", \"#fb8c00\", \"#8e24aa\", \"#00897b\", \"#f4511e\", \"#3949ab\", \"#d81b60\", \"#00acc1\", \"#c0ca33\", \"#6d4c41\"];";
const labStartIdx = viewContent.indexOf(labStart);
const labEndIdx = viewContent.indexOf(labEndMarker, labStartIdx) + labEndMarker.length;
const labBlock = viewContent.substring(labStartIdx, labEndIdx);

// --- Modify desktop-core.cjs ---
const coreInsertion = `
// --- Extracted from view.js ---
${templatesBlock.split('\\n').map(l => l.trimStart() ? l.replace(/^ {8}/, '') : l).join('\\n')}

${labBlock.split('\\n').map(l => l.trimStart() ? l.replace(/^ {16}/, '') : l).join('\\n')}

${getSuspiciousBlock.split('\\n').map(l => l.trimStart() ? l.replace(/^ {12}/, '') : l).join('\\n')}
`;

const coreExportIdx = coreContent.indexOf("module.exports = {");
coreContent = coreContent.substring(0, coreExportIdx) + coreInsertion + "\\n" + coreContent.substring(coreExportIdx);

fs.writeFileSync(corePath, coreContent, "utf8");
console.log("Updated desktop-core.cjs");

// --- Modify view.js ---
const viewGetSuspiciousReplacement = "const getSuspiciousLabValues = (entries) => _pfDesktopCore.getSuspiciousLabValues(entries);";
viewContent = viewContent.substring(0, getSuspiciousStartIdx) + viewGetSuspiciousReplacement + viewContent.substring(getSuspiciousEndIdx);

// Recalculate indices for TEMPLATES due to previous replacement
const tStart2 = viewContent.indexOf(templatesStart);
const tEnd2 = viewContent.indexOf("        ];", tStart2) + 10;
const viewTemplatesReplacement = "const TEMPLATES = _pfDesktopCore.TREATMENT_TEMPLATES;";
viewContent = viewContent.substring(0, tStart2) + viewTemplatesReplacement + viewContent.substring(tEnd2);

// Recalculate indices for LAB_GROUPS
const lStart2 = viewContent.indexOf(labStart);
const lEnd2 = viewContent.indexOf(labEndMarker, lStart2) + labEndMarker.length;
const viewLabReplacement = "const LAB_GROUPS = _pfDesktopCore.LAB_GROUPS;\\n                const LAB_CHART_COLORS = _pfDesktopCore.LAB_CHART_COLORS;";
viewContent = viewContent.substring(0, lStart2) + viewLabReplacement + viewContent.substring(lEnd2);

fs.writeFileSync(viewPath, viewContent, "utf8");
console.log("Updated view.js");
