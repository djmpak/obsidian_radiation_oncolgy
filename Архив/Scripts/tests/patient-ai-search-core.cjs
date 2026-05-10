const assert = require("node:assert/strict");
const test = require("node:test");

const core = require("../src/shared/patient-ai-search-core.cjs");

test("searchLocalIndex ranks patient documents by local clinical keywords", () => {
  const docs = [
    { path: "Пациенты/A.md", frontmatter: { ФИО: "Иванов", Диагноз: "рак лёгкого C34" }, body: "Химиотерапия" },
    { path: "Выписаны/B.md", frontmatter: { ФИО: "Петров", Диагноз: "рак простаты C61" }, body: "ПСА" }
  ];

  const result = core.searchLocalIndex({ docs, query: "C34 лёгкое", limit: 1 });

  assert.equal(result[0].path, "Пациенты/A.md");
});

test("packContextForModel keeps only bounded excerpts with paths", () => {
  const hits = core.searchLocalIndex({
    docs: [
      {
        path: "Пациенты/A.md",
        frontmatter: { ФИО: "Иванов", Диагноз: "рак лёгкого C34" },
        body: "Химиотерапия. ".repeat(1000)
      }
    ],
    query: "C34 лёгкое",
    limit: 1
  });

  const packed = core.packContextForModel({
    hits,
    maxChars: 6000
  });

  assert.ok(packed.totalChars <= 6000);
  assert.ok(packed.items.every(item => item.path && item.excerpt));
});

