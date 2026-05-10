const fs = require("fs");
const path = require("path");
const viewPath = path.resolve(__dirname, "../views/desktop/view.js");
let viewContent = fs.readFileSync(viewPath, "utf8");

const startIdx = viewContent.indexOf("const getSuspiciousLabValues = (entries) => {");
const endIdx = viewContent.indexOf("return suspicious;", startIdx);
// Find the next `};` after `return suspicious;`
const trueEndIdx = viewContent.indexOf("};", endIdx) + 2;

if (startIdx !== -1 && trueEndIdx > startIdx) {
    const replacement = "const getSuspiciousLabValues = (entries) => _pfDesktopCore.getSuspiciousLabValues(entries);";
    viewContent = viewContent.substring(0, startIdx) + replacement + viewContent.substring(trueEndIdx);
    fs.writeFileSync(viewPath, viewContent, "utf8");
    console.log("Successfully replaced getSuspiciousLabValues");
} else {
    console.log("Could not find getSuspiciousLabValues");
}
