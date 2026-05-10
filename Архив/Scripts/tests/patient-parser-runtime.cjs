const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..", "..", "..");
const patientViewPath = path.join(root, "Архив", "Scripts", "views", "patient", "view.js");
const sharedParserPath = path.join(root, "Архив", "Scripts", "src", "shared", "desktop-parser-ui.cjs");
const source = fs.readFileSync(patientViewPath, "utf8");
const sharedSource = fs.readFileSync(sharedParserPath, "utf8");

assert.match(source, /const slotMetaMap\s*=/u);
const payloadStart = source.indexOf("const prepareParserReviewPayload");
const localDeclaration = source.indexOf("const slotMetaMap", payloadStart);
const localUsage = source.indexOf("slotMetaMap?.", localDeclaration + 1);

assert.ok(payloadStart >= 0, "prepareParserReviewPayload must exist");
assert.ok(localDeclaration > payloadStart, "slotMetaMap must be declared inside parser review payload");
assert.ok(
  localUsage === -1 || localDeclaration < localUsage,
  "slotMetaMap must be declared before first usage in parser review payload"
);

assert.match(
  source,
  /до неоадъювантного лечения указана стадия cTNM\/stage/u,
  "parser prompt must preserve initial clinical stage before neoadjuvant treatment"
);
assert.match(
  source,
  /после радикальной операции указана ypTNM\/pTNM/u,
  "parser prompt must preserve postoperative stage near surgery"
);

assert.match(source, /id:\s*"deepseek\/deepseek-v4-pro"[\s\S]*label:\s*"DeepSeek V4 Pro"/u);
assert.match(source, /id:\s*"deepseek\/deepseek-v4-flash"[\s\S]*label:\s*"DeepSeek V4 Flash"/u);
assert.doesNotMatch(source, /DEFAULT_MODEL\s*=\s*"[^"]*V3\.2|DEFAULT_MODEL\s*=\s*"[^"]*v3\.2/iu);
assert.doesNotMatch(source, /_CHAT_DEFAULT_MODEL\s*=\s*"[^"]*V3\.2|_CHAT_DEFAULT_MODEL\s*=\s*"[^"]*v3\.2/iu);
assert.match(source, /const PROVIDER_LS\s*=\s*"ai_provider"/u);
assert.match(source, /const LITELLM_KEY_LS\s*=\s*"litellm_api_key"/u);
assert.match(source, /http:\/\/212\.86\.115\.215:4000\/v1\/chat\/completions/u);
assert.match(source, /model:\s*providerCfg\.modelId/u);
assert.match(source, /providerId === "litellm"\s*\?\s*`openrouter\/\$\{cleanModel\}`\s*:\s*cleanModel/u, "LiteLLM proxy should receive exactly one openrouter prefix");
assert.match(source, /replace\(\^?\/\^openrouter\\\/\//u, "provider model normalization should strip stale openrouter prefixes");
assert.doesNotMatch(source, /showTnmStageConfirmModal/u, "TNM recalculation should not use a separate modal");
assert.doesNotMatch(source, /maybeRunTnmStageReview/u, "TNM recalculation should be part of the parser review flow");
assert.match(source, /applyInlineTnmStageSuggestion/u, "parser review should prepare TNM recalculation inline");
assert.ok(
  source.indexOf("applyInlineTnmStageSuggestion") < source.indexOf("showParserReviewModal"),
  "inline TNM suggestion must be prepared before opening parser review"
);
assert.match(source, /Автоподтверждённые слоты/u, "100% auto-approved parser data should stay under collapsed spoiler");
assert.doesNotMatch(source, /showParserDiffModal/u, "parser should use one final review screen without a second diff modal");
assert.match(source, /parserReviewGroupOrder/u, "review rows should be grouped by clinical section");
assert.match(source, /Конфликты требуют решения/u, "conflicts should be surfaced before regular rows");
assert.match(source, /Оставить старое/u, "each review row should support keeping current value");
assert.match(source, /Принять новое/u, "each review row should support accepting incoming value");
assert.match(source, /Объединить/u, "text review rows should support merge action");
assert.match(source, /Записать выбранное/u, "single final review screen should write selected data");
assert.match(source, /Было/u, "review rows should show current value inline");
assert.match(source, /Станет/u, "review rows should show resulting value inline");
assert.doesNotMatch(source, /grid-template-columns:1fr 1fr;gap:8px/u, "parser preview blocks should span full width");
assert.match(source, /width:100%;box-sizing:border-box;border:1px solid var\(--background-modifier-border\)/u, "parser value preview blocks should be full-width");
assert.match(source, /const mergeDiagnosisText\s*=/u, "legacy parser runtime must define diagnosis merge before save planning");
assert.match(sharedSource, /ensureCurrentPatientId:\s*contextEnsureCurrentPatientId/u, "shared parser runtime must receive patient ID creation from context");
assert.match(sharedSource, /const ensureCurrentPatientId\s*=\s*typeof contextEnsureCurrentPatientId === "function"/u, "shared parser runtime must not reference an undeclared patient ID helper");
assert.match(source, /isFullConfidenceAutoField/u, "100% confidence parser rows should be auto-hidden even after risk labeling");
assert.match(source, /item\.auto_apply \|\| isFullConfidenceAutoField\(item\)/u, "100% confidence parser rows should be preselected automatically");

console.log("OK patient parser runtime checks passed");
