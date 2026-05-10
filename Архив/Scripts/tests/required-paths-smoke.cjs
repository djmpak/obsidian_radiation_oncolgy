const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..", "..", "..");

const requiredPaths = [
  "Архив/Scripts/views/desktop/view.js",
  "Архив/Scripts/views/patient/view.js",
  "Архив/Scripts/modules/database-runtime.js",
  "Архив/Scripts/modules/storage-frontmatter-runtime.js",
  "Архив/Scripts/modules/patient-platform-runtime.js",
  "Архив/Scripts/modules/desktop-platform-runtime.js",
  "Архив/Scripts/src/shared/write-layer-core.cjs",
  "Архив/Scripts/src/shared/patient-save-actions.cjs",
  "Архив/Scripts/modules/patient-attachment-runtime.js",
  "Архив/Scripts/modules/patient-ui-actions-runtime.js",
  "Архив/Scripts/modules/patient-linked-cases-runtime.js",
  "Архив/Scripts/modules/patient-save-runtime.js",
  "Архив/Scripts/modules/patient-bottom-panels-runtime.js",
  "Архив/Scripts/modules/patient-editor-ui-runtime.js",
  "Архив/Scripts/modules/patient-modal-runtime.js",
  "Архив/Scripts/modules/patient-db-actions-runtime.js",
  "Архив/Scripts/modules/patient-domain-actions-runtime.js",
  "Архив/Scripts/src/shared/patient-modal-chat-style.cjs",
  "Архив/Scripts/modules/desktop-discharge-runtime.js",
  "Архив/Scripts/modules/desktop-calendar-runtime.js",
  "Архив/Scripts/modules/desktop-new-patient-runtime.js",
  "Архив/Scripts/modules/desktop-hlt-runtime.js",
  "Архив/Scripts/modules/desktop-editor-clinical-runtime.js",
  "Архив/Scripts/modules/desktop-treatment-volumes-runtime.js",
  "Архив/Scripts/modules/patient-accelerator-runtime.js",
  "Архив/Scripts/modules/patient-ai-search-runtime.js",
  "Архив/Scripts/modules/patient-chemo-reminders-runtime.js",
  "Архив/Scripts/modules/desktop-parser-runtime.js",
  "Архив/Scripts/modules/patient-note-runtime.js",
  "Архив/Scripts/src/shared/desktop-render.cjs",
  "Архив/Scripts/src/shared/desktop-discharge-core.cjs",
  "Архив/Scripts/src/shared/desktop-calendar-core.cjs",
  "Архив/Scripts/src/shared/desktop-new-patient-core.cjs",
  "Архив/Scripts/src/shared/desktop-hlt-core.cjs",
  "Архив/Scripts/src/shared/desktop-editor-clinical-core.cjs",
  "Архив/Scripts/src/shared/patient-schema-core.cjs",
  "Архив/Scripts/src/shared/patient-accelerator-core.cjs",
  "Архив/Scripts/src/shared/patient-ai-search-core.cjs",
  "Архив/Scripts/src/shared/patient-chemo-reminders-core.cjs",
  "Архив/Scripts/src/shared/patient-workflow-core.cjs",
  "Архив/Scripts/src/shared/patient-db-actions.cjs",
  "Архив/Scripts/src/shared/patient-domain-actions.cjs",
  "Архив/Scripts/src/platform/obsidian-adapter.cjs",
  "Шаблон пациента.md"
];

for (const relPath of requiredPaths) {
  const absPath = path.join(root, relPath);
  assert.equal(
    fs.existsSync(absPath),
    true,
    `missing required path: ${relPath}`
  );
}

console.log(`OK ${requiredPaths.length} required paths exist`);
