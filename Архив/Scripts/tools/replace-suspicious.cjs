const fs = require("fs");
const path = require("path");
const viewPath = path.resolve(__dirname, "../views/desktop/view.js");
let viewContent = fs.readFileSync(viewPath, "utf8");

const start = "const getSuspiciousLabValues = (entries) => {";
const end = "return suspicious;\\n            };";

const startIdx = viewContent.indexOf(start);
const endIdx = viewContent.indexOf("return suspicious;\\r\\n            };", startIdx) + 33;

if (startIdx !== -1 && endIdx > startIdx) {
    const replacement = "const getSuspiciousLabValues = (entries) => _pfDesktopCore.getSuspiciousLabValues(entries);";
    viewContent = viewContent.substring(0, startIdx) + replacement + viewContent.substring(endIdx);
    fs.writeFileSync(viewPath, viewContent, "utf8");
    console.log("Successfully replaced getSuspiciousLabValues");
} else {
    console.log("Could not find getSuspiciousLabValues");
}
