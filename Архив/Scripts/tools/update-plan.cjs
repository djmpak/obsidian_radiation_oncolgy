const fs = require('fs');
const p = 'c:/Users/DmitryGL/Documents/Obsidian Vault/OpenRouter/Архив/Планы/План_реализации_архитектуры_без_Шаблона_пациента.md';
let c = fs.readFileSync(p, 'utf8');
c = c.replace(/- \[ \] \*\*Извлечение \`TEMPLATES\` и \`LAB_GROUPS\` из \`view\.js\`\*\*/, '- [x] **Извлечение `TEMPLATES` и `LAB_GROUPS` из `view.js`**');
c = c.replace(/- Перенести референсные значения лаборатории и валидационные функции в/, '- Перенести референсные значения лаборатории и валидационные функции (`getSuspiciousLabValues`) в');
fs.writeFileSync(p, c, 'utf8');
