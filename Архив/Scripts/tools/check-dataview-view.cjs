const fs = require("node:fs");
const path = require("node:path");

const [, , sourceArg] = process.argv;

if (!sourceArg) {
  console.error("Usage: node check-dataview-view.cjs <view.js>");
  process.exit(1);
}

const sourcePath = path.resolve(process.cwd(), sourceArg);
const source = fs.readFileSync(sourcePath, "utf8");

try {
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  // Dataview executes view scripts in an async context with injected dv/input.
  // Compiling as AsyncFunction catches syntax errors while allowing top-level await.
  new AsyncFunction("dv", "input", source);
  console.log(`OK ${sourceArg}`);
} catch (error) {
  console.error(`FAIL ${sourceArg}`);
  console.error(error.stack || error.message || String(error));
  process.exit(1);
}
