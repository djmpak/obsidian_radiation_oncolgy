"use strict";

const INDEX_FRONTMATTER_FIELDS = Object.freeze([
  "ФИО",
  "Диагноз",
  "МКБ 10",
  "Дата_рождения",
  "Передан",
  "Статус_лечения"
]);

const DEFAULT_PATIENT_FOLDERS = Object.freeze([
  "Выписаны",
  "Консультации",
  "Не начали",
  "Пациенты"
]);

const normalizeText = (value = "") => String(value || "")
  .toLowerCase()
  .replace(/ё/g, "е")
  .replace(/[^0-9a-zа-я]+/giu, " ")
  .replace(/\s+/g, " ")
  .trim();

const tokenize = (value = "") => normalizeText(value)
  .split(" ")
  .map(token => token.trim())
  .filter(token => token.length >= 2);

const stemToken = (token = "") => {
  const text = normalizeText(token);
  if (/^[а-я]{5,}$/u.test(text)) return text.replace(/(ого|ему|ыми|ими|ая|ое|ые|ий|ый|ой|ая|яя|ью|ом|ем|ах|ях|ам|ям|а|я|е|у|ы|и|о)$/u, "");
  return text;
};

const buildSearchText = (doc = {}) => {
  const fm = doc.frontmatter || {};
  const fields = INDEX_FRONTMATTER_FIELDS.map(key => fm[key]).filter(value => value !== undefined && value !== null);
  return [
    doc.path || "",
    doc.basename || "",
    ...fields,
    doc.body || ""
  ].join("\n");
};

const normalizeDoc = (doc = {}) => {
  const path = String(doc.path || "").trim();
  const basename = String(doc.basename || path.split(/[\\/]/).pop()?.replace(/\.md$/iu, "") || "").trim();
  const frontmatter = doc.frontmatter && typeof doc.frontmatter === "object" ? { ...doc.frontmatter } : {};
  const body = String(doc.body || "");
  const searchText = buildSearchText({ path, basename, frontmatter, body });
  return {
    path,
    basename,
    frontmatter,
    body,
    searchText,
    normalizedText: normalizeText(searchText),
    tokens: tokenize(searchText).map(stemToken)
  };
};

const tokenMatches = (docTokens, queryToken) => {
  const wanted = stemToken(queryToken);
  if (!wanted) return 0;
  return docTokens.reduce((count, token) => {
    if (token === wanted) return count + 1;
    if (token.length >= 4 && wanted.length >= 4 && (token.includes(wanted) || wanted.includes(token))) return count + 1;
    return count;
  }, 0);
};

const scoreDoc = (doc, queryTokens) => {
  if (!doc.path || !queryTokens.length) return 0;
  const docTokens = doc.tokens || [];
  let score = 0;
  for (const token of queryTokens) {
    const matches = tokenMatches(docTokens, token);
    if (!matches) continue;
    score += 2 + Math.min(matches, 5);
    const normalizedToken = normalizeText(token);
    if (normalizeText(doc.frontmatter?.["Диагноз"]).includes(normalizedToken)) score += 3;
    if (normalizeText(doc.frontmatter?.["МКБ 10"]).includes(normalizedToken)) score += 4;
    if (normalizeText(doc.frontmatter?.["ФИО"]).includes(normalizedToken)) score += 2;
  }
  return score;
};

const makeExcerpt = ({ doc, queryTokens = [], maxChars = 1200 } = {}) => {
  const text = String(doc?.body || doc?.searchText || "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  const normalized = normalizeText(text);
  const hitPositions = queryTokens
    .map(token => normalized.indexOf(normalizeText(token)))
    .filter(index => index >= 0);
  const firstHit = hitPositions.length ? Math.min(...hitPositions) : 0;
  const start = Math.max(0, firstHit - Math.floor(maxChars / 3));
  return text.slice(start, start + maxChars).trim();
};

const searchLocalIndex = ({ docs = [], query = "", limit = 10, excerptChars = 1200 } = {}) => {
  const queryTokens = tokenize(query);
  if (!queryTokens.length) return [];

  return (Array.isArray(docs) ? docs : [])
    .map(normalizeDoc)
    .map(doc => ({
      ...doc,
      score: scoreDoc(doc, queryTokens),
      excerpt: makeExcerpt({ doc, queryTokens, maxChars: excerptChars })
    }))
    .filter(doc => doc.score > 0)
    .sort((left, right) => right.score === left.score ? left.path.localeCompare(right.path, "ru") : right.score - left.score)
    .slice(0, Math.max(0, Number(limit) || 10));
};

const packContextForModel = ({ hits = [], maxChars = 6000, itemMaxChars = 1200 } = {}) => {
  const budget = Math.max(0, Number(maxChars) || 0);
  const items = [];
  let totalChars = 0;

  for (const hit of Array.isArray(hits) ? hits : []) {
    const path = String(hit.path || "").trim();
    const baseExcerpt = String(hit.excerpt || hit.body || hit.searchText || "").replace(/\s+/g, " ").trim();
    if (!path || !baseExcerpt || totalChars >= budget) continue;
    const remaining = budget - totalChars;
    const excerpt = baseExcerpt.slice(0, Math.min(itemMaxChars, remaining)).trim();
    if (!excerpt) continue;
    items.push({
      path,
      score: Number(hit.score) || 0,
      excerpt
    });
    totalChars += excerpt.length;
  }

  return { totalChars, items };
};

module.exports = {
  INDEX_FRONTMATTER_FIELDS,
  DEFAULT_PATIENT_FOLDERS,
  normalizeText,
  tokenize,
  normalizeDoc,
  searchLocalIndex,
  packContextForModel
};

