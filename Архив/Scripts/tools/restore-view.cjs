const fs = require("fs");
const path = require("path");

const viewPath = path.resolve(__dirname, "../views/desktop/view.js");
let viewContent = fs.readFileSync(viewPath, "utf8");

const badReplacement = "const getSuspiciousLabValues = (entries) => _pfDesktopCore.getSuspiciousLabValues(entries);";
const idx = viewContent.indexOf(badReplacement);

if (idx !== -1) {
    const prefix = viewContent.substring(0, 31);
    const suffix = viewContent.substring(idx + badReplacement.length);
    const restored = prefix + suffix;
    fs.writeFileSync(viewPath, restored, "utf8");
    console.log("Restored view.js! New length: " + restored.length);
} else {
    console.log("Bad replacement not found!");
}
