const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..", "..", "..");

const runtimeModulePath = path.join(root, "Архив", "Scripts", "modules", "database-runtime.js");
const adapterCorePath = path.join(root, "Архив", "Scripts", "src", "platform", "obsidian-adapter.cjs");
const frontmatterCorePath = path.join(root, "Архив", "Scripts", "src", "shared", "storage-frontmatter-core.cjs");
const writeLayerCorePath = path.join(root, "Архив", "Scripts", "src", "shared", "write-layer-core.cjs");
const desktopViewPath = path.join(root, "Архив", "Scripts", "views", "desktop", "view.js");
const patientViewPath = path.join(root, "Архив", "Scripts", "views", "patient", "view.js");

const tests = [];
const test = (name, fn) => tests.push({ name, fn });
const readUtf8 = (filePath) => fs.readFileSync(filePath, "utf8");

test("shared runtime database module exists and loads database-core source", () => {
  assert.equal(fs.existsSync(runtimeModulePath), true, "database-runtime.js does not exist");
  const source = readUtf8(runtimeModulePath);
  assert.match(source, /src\/shared\/database-core\.cjs/u);
  assert.match(source, /src\/platform\/obsidian-adapter\.cjs/u);
  assert.match(source, /src\/shared\/storage-frontmatter-core\.cjs/u);
  assert.match(source, /src\/shared\/write-layer-core\.cjs/u);
  assert.match(source, /module\.exports/u);
  assert.match(source, /upsertDatabaseRowFile/u);
  assert.match(source, /findDatabaseRowFile/u);
  assert.match(source, /removeDatabaseRowFile/u);
  assert.match(source, /waitForDatabaseRowFile/u);
  assert.match(source, /markDatabaseExport/u);
  assert.match(source, /clearDatabaseExportMark/u);
  assert.match(source, /moveFileToFolder/u);
  assert.match(source, /readFreshFrontmatter/u);
  assert.match(source, /installFrontmatterPatch/u);
  assert.match(source, /installRenamePatch/u);
  assert.match(source, /patchFrontmatter/u);
  assert.doesNotMatch(source, /const\s+restoreScrollAfterFrame\s*=/u);
  assert.doesNotMatch(source, /const\s+runFrontmatterRefreshHooks\s*=/u);
  assert.doesNotMatch(source, /app\.fileManager\.processFrontMatter\s*=\s*async/u);
  assert.doesNotMatch(source, /app\.fileManager\.renameFile\s*=\s*async/u);
});

test("desktop view loads and delegates safe database helpers to shared runtime", () => {
  const source = readUtf8(desktopViewPath);
  assert.match(source, /Архив\/Scripts\/modules\/database-runtime\.js/u);
  assert.match(source, /const\s+DB_COLS\s*=\s*_pfDatabaseCore\.DB_COLS/u);
  assert.match(source, /const\s+DB_STAGE_TO_NUM\s*=\s*_pfDatabaseCore\.DB_STAGE_TO_NUM/u);
  assert.match(source, /const\s+DB_GOAL_MAP\s*=\s*_pfDatabaseCore\.DB_GOAL_MAP/u);
  assert.match(source, /const\s+DB_TX_STATUS_MAP\s*=\s*_pfDatabaseCore\.DB_TX_STATUS_MAP/u);
  assert.match(source, /_dbUpsertRowFile\s*=\s*\(row,\s*patientId,\s*recordDate\)\s*=>\s*_pfDatabaseCore\.upsertDatabaseRowFile/u);
  assert.match(source, /_dbFindRowFile\s*=\s*\(patientId\)\s*=>\s*_pfDatabaseCore\.findDatabaseRowFile/u);
  assert.match(source, /_dbRemoveRowFile\s*=\s*\(patientId\)\s*=>\s*_pfDatabaseCore\.removeDatabaseRowFile/u);
  assert.match(source, /_dbWaitForRowFile\s*=\s*\(patientId,\s*opts\)\s*=>\s*_pfDatabaseCore\.waitForDatabaseRowFile/u);
  assert.match(source, /_dbBuildRowFromFmShared\s*=\s*\(fm\s*=\s*\{\}\)\s*=>\s*_pfDatabaseCore\.buildDatabaseRow/u);
  assert.match(source, /_dbResolvePatientId\s*=\s*\(fm\s*=\s*\{\}\)\s*=>\s*_pfDatabaseCore\.resolvePatientId/u);
  assert.match(source, /_pfDatabaseCore\.getPatientIdPatch\(nextId\)/u);
  assert.match(source, /_dbMarkExport\s*=\s*\(targetFile,\s*source\)\s*=>\s*_pfDatabaseCore\.markDatabaseExport/u);
  assert.match(source, /_dbClearExportMark\s*=\s*\(targetFile\)\s*=>\s*_pfDatabaseCore\.clearDatabaseExportMark/u);
  assert.match(source, /_dbMoveFileToFolder\s*=\s*\(targetFile,\s*folderPath,\s*opts\s*=\s*\{\}\)\s*=>\s*_pfDatabaseCore\.moveFileToFolder/u);
  assert.match(source, /_dbReadFreshFrontmatter\s*=\s*\(targetFile\)\s*=>\s*_pfDatabaseCore\.readFreshFrontmatter/u);
  assert.match(source, /_dbPatchFrontmatter\s*=\s*\(targetFile,\s*mutator,\s*opts\s*=\s*\{\}\)\s*=>\s*_pfDatabaseCore\.patchFrontmatter/u);
  assert.doesNotMatch(source, /app\.metadataCache\.getFileCache\(targetFile\)\?\.frontmatter/u);
  assert.doesNotMatch(source, /app\.fileManager\.processFrontMatter\(targetFile/u);
  assert.doesNotMatch(source, /_dbGeneratePatientIdFromFm/u);
  assert.doesNotMatch(source, /_dbNormalizeLinkedCases/u);
  assert.doesNotMatch(source, /_inheritId/u);
  assert.doesNotMatch(source, /Math\.random\(\)\s*\*\s*900/u);
  assert.doesNotMatch(source, /const\s+_buildDbRowFromFm\s*=/u);
  assert.doesNotMatch(source, /const\s+_origPFM/u);
  assert.doesNotMatch(source, /const\s+_origRename/u);
  assert.doesNotMatch(source, /app\.fileManager\.renameFile\(/u);
  assert.match(source, /_pfDatabaseCore\.installFrontmatterPatch\(\)/u);
  assert.match(source, /_pfDatabaseCore\.installRenamePatch\(\)/u);
  assert.ok(
    source.indexOf("const _pfDatabaseCore = await window._pfLoadRuntimeModule") < source.indexOf("_pfDatabaseCore.installFrontmatterPatch()"),
    "desktop installs frontmatter patch before database runtime is loaded"
  );
  assert.ok(
    source.indexOf("const _pfDatabaseCore = await window._pfLoadRuntimeModule") < source.indexOf("_pfDatabaseCore.installRenamePatch()"),
    "desktop installs rename patch before database runtime is loaded"
  );
  assert.match(source, /_dbGetQlqModule\s*=\s*\(icd10Raw\)\s*=>\s*_pfDatabaseCore\.getQlqModule/u);
  const remindersStart = source.indexOf("// Напоминания");
  const remindersEnd = source.indexOf("// Консультации", remindersStart);
  assert.notEqual(remindersStart, -1, "desktop reminders block start marker not found");
  assert.notEqual(remindersEnd, -1, "desktop reminders block end marker not found");
  const remindersBlock = source.slice(remindersStart, remindersEnd);
  assert.doesNotMatch(remindersBlock, /app\.fileManager\.processFrontMatter\(tFile/u);
  assert.match(remindersBlock, /_pfDesktopCore\.getDueReminderCount/u);
});

test("legacy patient view keeps database helpers inline", () => {
  const source = readUtf8(patientViewPath);
  assert.doesNotMatch(source, /Архив\/Scripts\/modules\/database-runtime\.js/u);
  assert.match(source, /const DB_COLS = \[/u);
  assert.match(source, /const DB_STAGE_TO_NUM = \{/u);
  assert.match(source, /const DB_EXPORT_AT_KEY = "db_exported_at"/u);
  assert.match(source, /const buildDbRow = \(\) =>/u);
  assert.match(source, /const syncPatientToDatabase = async/u);
  assert.match(source, /const removePatientFromDatabase = async/u);
  assert.match(source, /const dischargeCurrentPatient = async/u);
  assert.match(source, /let saveNow = \(updates\) =>/u);
  assert.match(source, /app\.fileManager\.processFrontMatter\(file/u);
  assert.match(source, /getQLQModule = \(mkb\) =>/u);
});

let passed = 0;
for (const { name, fn } of tests) {
  try {
    fn();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    console.error(error.stack || error.message || String(error));
    process.exit(1);
  }
}

console.log(`OK ${passed} shared database runtime integration checks passed`);
