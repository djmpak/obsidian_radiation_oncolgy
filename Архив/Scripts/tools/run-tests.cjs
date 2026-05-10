const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..", "..", "..");
const testsDir = path.join(root, "Архив", "Scripts", "tests");

const files = fs.readdirSync(testsDir)
  .filter(name => name.endsWith(".cjs"))
  .sort();

for (const file of files) {
  const fullPath = path.join(testsDir, file);
  console.log(`RUN ${file}`);
  const result = spawnSync(process.execPath, [fullPath], {
    cwd: root,
    stdio: "inherit"
  });
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}
