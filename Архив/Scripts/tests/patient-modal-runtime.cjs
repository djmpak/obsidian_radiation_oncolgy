const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..", "..", "..");
const runtimePath = path.join(root, "Архив", "Scripts", "modules", "patient-modal-runtime.js");
const corePath = "Архив/Scripts/src/shared/desktop-parser-ui.cjs";
const chatStylePath = "Архив/Scripts/src/shared/patient-modal-chat-style.cjs";

const readUtf8 = (filePath) => fs.readFileSync(filePath, "utf8");

async function loadRuntime() {
  const runtimeSource = readUtf8(runtimePath);
  const runtimeLoader = new Function(`return (${runtimeSource});`)();
  const coreSource = readUtf8(path.join(root, corePath));
  const chatStyleSource = readUtf8(path.join(root, chatStylePath));
  const requestedPaths = [];
  const dv = {
    io: {
      load: async (requestedPath) => {
        requestedPaths.push(requestedPath);
        if (requestedPath === corePath) return coreSource;
        if (requestedPath === chatStylePath) return chatStyleSource;
        assert.fail(`patient-modal runtime loaded an unexpected path: ${requestedPath}`);
      }
    }
  };

  const exports = await runtimeLoader({ dv });
  return { exports, requestedPaths, runtimeSource, coreSource, chatStyleSource };
}

(async () => {
  assert.equal(fs.existsSync(runtimePath), true, "patient-modal-runtime.js does not exist");
  assert.equal(fs.existsSync(path.join(root, chatStylePath)), true, "patient-modal-chat-style.cjs does not exist");

  const { exports, requestedPaths, runtimeSource, coreSource, chatStyleSource } = await loadRuntime();
  assert.match(coreSource, /const normalizeHistoryText\s*=\s*_dbNormalizeHistoryText/u);
  assert.match(coreSource, /const normalizeDrugNames\s*=\s*_dbNormalizeDrugNames/u);
  assert.match(coreSource, /const normalizeDiagnosisText\s*=\s*_dbNormalizeDiagnosisText/u);
  assert.match(coreSource, /const normalizeEcog\s*=\s*_npNormalizeEcog/u);
  assert.match(coreSource, /const matchEcogInText\s*=\s*_npMatchEcogInText/u);
  assert.match(coreSource, /const normalizeLabDateKey\s*=\s*_npNormalizeLabDateKey/u);
  assert.match(coreSource, /ensureCurrentPatientId:\s*contextEnsureCurrentPatientId/u);
  assert.match(coreSource, /const ensureCurrentPatientId\s*=\s*typeof contextEnsureCurrentPatientId === "function"/u);
  assert.match(coreSource, /const PROVIDER_LS\s*=\s*"ai_provider"/u);
  assert.match(coreSource, /const LITELLM_KEY_LS\s*=\s*"litellm_api_key"/u);
  assert.match(coreSource, /http:\/\/212\.86\.115\.215:4000\/v1\/chat\/completions/u);
  assert.match(coreSource, /model:\s*providerCfg\.modelId/u);
  assert.match(coreSource, /providerId === "litellm"\s*\?\s*`openrouter\/\$\{cleanModel\}`\s*:\s*cleanModel/u);
  assert.match(coreSource, /replace\(\^?\/\^openrouter\\\/\//u);
  assert.match(coreSource, /id:\s*"deepseek\/deepseek-v4-pro"[\s\S]*label:\s*"DeepSeek V4 Pro"/u);
  assert.match(coreSource, /id:\s*"deepseek\/deepseek-v4-flash"[\s\S]*label:\s*"DeepSeek V4 Flash"/u);
  assert.doesNotMatch(coreSource, /deepseek-v3\.2|DeepSeek V3\.2/u);
  assert.match(runtimeSource, /src\/shared\/desktop-parser-ui\.cjs/u);
  assert.match(runtimeSource, /src\/shared\/patient-modal-chat-style\.cjs/u);
  assert.match(runtimeSource, /ensureCurrentPatientId:\s*context\.ensureCurrentPatientId/u);
  assert.equal(requestedPaths.length, 1);
  assert.equal(typeof exports.buildAiPanel, "function");
  assert.equal(typeof exports.openPatientChatModal, "function");

  const doc = {
    nodes: new Map(),
    head: {
      appendChild(node) {
        this.lastChild = node;
        doc.nodes.set(node.id, node);
      }
    },
    getElementById(id) {
      if (id === "ai-chat-modal-patient-note_md") return {};
      return doc.nodes.get(id) || null;
    },
    createElement(tag) {
      return { tagName: tag.toUpperCase(), style: {}, setAttribute() {}, appendChild() {}, remove() {} };
    }
  };
  const styleModuleModule = { exports: {} };
  const styleModuleFactory = new Function("module", "exports", `"use strict";\n${chatStyleSource}\nreturn module.exports;`);
  const styleModule = styleModuleFactory(styleModuleModule, styleModuleModule.exports);
  assert.equal(typeof styleModule.ensurePatientChatStyles, "function");
  assert.match(styleModule.CHAT_STYLE_TEXT, /\.ai-chat-open-btn/u);
  assert.equal(styleModule.ensurePatientChatStyles(doc), true);
  assert.equal(doc.head.lastChild.id, "pf-patient-chat-modal-style");

  const fakeContext = {
    cur: { file: { path: "patient-note.md" } },
    document: doc,
    window: {},
    getVal: () => null,
    getStoredVal: () => null
  };
  await exports.openPatientChatModal(fakeContext);
  assert.deepEqual(requestedPaths, [corePath, chatStylePath]);

  console.log("OK patient-modal runtime smoke test passed");
})().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exit(1);
});
