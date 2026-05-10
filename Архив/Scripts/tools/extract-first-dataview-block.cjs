const fs = require("node:fs");
const path = require("node:path");

const [, , sourceArg, targetArg] = process.argv;

if (!sourceArg || !targetArg) {
  console.error("Usage: node extract-first-dataview-block.cjs <source.md> <target.js>");
  process.exit(1);
}

const sourcePath = path.resolve(process.cwd(), sourceArg);
const targetPath = path.resolve(process.cwd(), targetArg);

const source = fs.readFileSync(sourcePath, "utf8");
const lines = source.split(/\r?\n/u);

let start = -1;
let end = -1;

for (let i = 0; i < lines.length; i += 1) {
  if (start === -1 && /^```dataviewjs\s*$/u.test(lines[i])) {
    start = i + 1;
    continue;
  }
  if (start !== -1 && i >= start && /^```\s*$/u.test(lines[i])) {
    end = i;
    break;
  }
}

if (start === -1 || end === -1 || end < start) {
  console.error(`Could not find the first dataviewjs block in ${sourceArg}`);
  process.exit(1);
}

const body = lines.slice(start, end).join("\n").replace(/\s+$/u, "");
fs.mkdirSync(path.dirname(targetPath), { recursive: true });
fs.writeFileSync(targetPath, `${body}\n`, "utf8");

console.log(`Extracted ${sourceArg} -> ${targetArg}`);
