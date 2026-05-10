const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..", "..", "..");
const desktopViewPath = path.join(root, "Архив", "Scripts", "views", "desktop", "view.js");
const source = fs.readFileSync(desktopViewPath, "utf8");

assert.doesNotMatch(source, /patient-ai-search-runtime\.js/u);
assert.doesNotMatch(source, /_pfPatientAiSearchCore/u);
assert.doesNotMatch(source, /_openAiSearchModal/u);
assert.doesNotMatch(source, /rdt-ai-search-btn/u);
assert.doesNotMatch(source, /searchLocalIndex/u);
assert.doesNotMatch(source, /packContextForModel/u);
assert.doesNotMatch(source, /scope:\s*"all-patients"/u);
assert.doesNotMatch(source, /retrieval:\s*"local-ranked"/u);

console.log("OK desktop AI search removal checks passed");
