const fs = require('fs');

const viewJsPath = 'c:\\Users\\DmitryGL\\Documents\\Obsidian Vault\\OpenRouter\\Архив\\Scripts\\views\\desktop\\view.js';
const coreJsPath = 'c:\\Users\\DmitryGL\\Documents\\Obsidian Vault\\OpenRouter\\Архив\\Scripts\\src\\shared\\desktop-core.cjs';

let viewContent = fs.readFileSync(viewJsPath, 'utf-8');
let coreContent = fs.readFileSync(coreJsPath, 'utf-8');

// Extract the block from PARSER_PROMPT to parserParseLabBatch
const startStr = 'const PARSER_PROMPT = `Ты — медицинский ассистент.';
const endStrPattern = /const parserParseLabBatch = \(batch\) => \{[\s\S]*?\};\s*const runStructuredParserRequest =/;

const match = viewContent.match(endStrPattern);
if (!match) {
    console.error("Could not find the end pattern");
    process.exit(1);
}

const endIndex = match.index + match[0].indexOf('const runStructuredParserRequest =');
const startIndex = viewContent.indexOf(startStr);

if (startIndex === -1) {
    console.error("Could not find start string");
    process.exit(1);
}

// 1. Get the extracted code
let extractedCode = viewContent.substring(startIndex, endIndex);

// Modify parserCoerceValue to accept helpers
extractedCode = extractedCode.replace(
    'const parserCoerceValue = (key, rawValue) => {',
    'const parserCoerceValue = (key, rawValue, helpers = {}) => {'
);
extractedCode = extractedCode.replace(
    /return _npNormalizeEcog\(value\);/g,
    'return helpers.normalizeEcog ? helpers.normalizeEcog(value) : value;'
);
extractedCode = extractedCode.replace(
    /return _dbNormalizeHistoryText\(value, "chemo"\);/g,
    'return helpers.normalizeHistoryText ? helpers.normalizeHistoryText(value, "chemo") : value;'
);
extractedCode = extractedCode.replace(
    /return _dbNormalizeHistoryText\(value, "generic"\);/g,
    'return helpers.normalizeHistoryText ? helpers.normalizeHistoryText(value, "generic") : value;'
);
extractedCode = extractedCode.replace(
    /return _dbNormalizeDrugNames\(value\);/g,
    'return helpers.normalizeDrugNames ? helpers.normalizeDrugNames(value) : value;'
);
extractedCode = extractedCode.replace(
    /return _dbNormalizeDiagnosisText\(parserNormalizeProstateTerminology\(value\)\);/g,
    'return helpers.normalizeDiagnosisText ? helpers.normalizeDiagnosisText(parserNormalizeProstateTerminology(value)) : parserNormalizeProstateTerminology(value);'
);

// Format it for core (remove indentation if desired, but not strictly necessary)
// Find all exported names from extractedCode
const exportNames = [];
const regex = /const (PARSER_[A-Z0-9_]+|TNM_STAGE_REVIEW_SCHEMA|getParserFieldLabel|parseOpenRouterJsonContent|parser[A-Za-z0-9_]+)\s*=/g;
let m;
while ((m = regex.exec(extractedCode)) !== null) {
    exportNames.push(m[1]);
}

// 2. Append to core JS
const coreExportPattern = /module\.exports = \{([\s\S]*?)\};/;
const coreExportMatch = coreContent.match(coreExportPattern);
if (!coreExportMatch) {
    console.error("Could not find module.exports in core");
    process.exit(1);
}

let newCoreContent = coreContent.replace(coreExportPattern, `\n\n// --- AI PARSER EXTRACTED ---\n${extractedCode}\n\nmodule.exports = {\n${coreExportMatch[1].trim()},\n  // AI Parser\n  ${exportNames.join(',\n  ')}\n};`);

fs.writeFileSync(coreJsPath, newCoreContent);

// 3. Replace in view.js
// We need to delete the extracted code
viewContent = viewContent.substring(0, startIndex) + viewContent.substring(endIndex);

// Now, inside `_openNewPatientEditorModal`, inject the destructured variables!
const injectStr = `        const {\n            ${exportNames.join(',\n            ')}\n        } = _pfDesktopCore;\n\n`;

// Where to inject? Right after `const _getOrKey = ...`
const injectIndex = viewContent.indexOf('const _getOrKey = () => localStorage.getItem(AI_KEY_LS) || "";') + 'const _getOrKey = () => localStorage.getItem(AI_KEY_LS) || "";'.length;

viewContent = viewContent.substring(0, injectIndex) + '\n' + injectStr + viewContent.substring(injectIndex);

// Also we need to fix the parserCoerceValue calls in view.js to pass helpers.
viewContent = viewContent.replace(/parserCoerceValue\(([^,]+),\s*([^)]+)\)/g, 'parserCoerceValue($1, $2, { normalizeEcog: _npNormalizeEcog, normalizeHistoryText: _dbNormalizeHistoryText, normalizeDrugNames: _dbNormalizeDrugNames, normalizeDiagnosisText: _dbNormalizeDiagnosisText })');

fs.writeFileSync(viewJsPath, viewContent);
console.log("Done refactoring.");
