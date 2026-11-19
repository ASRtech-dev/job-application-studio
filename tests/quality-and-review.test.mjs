import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { createSourceLoader, projectRoot } from "./helpers/source-loader.mjs";

const load = createSourceLoader();
const { evaluateApplicationQuality } = load("src/lib/applicationQuality.ts");
const { buildFinalReview, compareLetterAndCvFigures } = load("src/lib/finalReview.ts");
const { buildStarPrepData } = load("src/lib/starPrep.ts");
const { buildMasterCvExportApp } = load("src/lib/masterCvExport.ts");
const { filterAndSortApplications, computeDashboardFunnelAnalytics } = load("src/lib/dashboardFilters.ts");
const { toApplicationSummary } = load("src/lib/schemas.ts");
const { defaultMasterCv } = load("src/lib/defaultMasterCv.ts");

const sampleApps = JSON.parse(fs.readFileSync(path.join(projectRoot, "data", "applications.example.json"), "utf8"));
const sampleEn = sampleApps[0];

test("evaluateApplicationQuality verifies quotes against job description and Master CV", () => {
  const quality = evaluateApplicationQuality(sampleEn, defaultMasterCv);
  assert.equal(quality.stale, false);
  assert.equal(quality.unbound, false);
  assert.ok(Array.isArray(quality.requirements));
  assert.ok(quality.coverage === null || (quality.coverage >= 0 && quality.coverage <= 100));
});

test("buildFinalReview produces English diagnostics and respects dynamic availableReferences size checks", () => {
  const review = buildFinalReview({
    app: { ...sampleEn, assetSettings: { ...sampleEn.assetSettings, referenceDocIds: ["big-portfolio.pdf"] } },
    master: defaultMasterCv,
    saveState: { dirty: false, failed: false },
    pages: { cv: 2, letter: 1 },
    deliveries: [],
    availableReferences: [
      { id: "big-portfolio.pdf", fileName: "big-portfolio.pdf", label: "Big Portfolio", sizeBytes: 2_100_000, approxKb: 2050, modifiedAt: "2026-01-01T00:00:00Z" },
    ],
  });
  assert.ok(review.items.some((item) => item.id === "bundle-size-warning" && /exceed 2 MB/i.test(item.message)));
  assert.ok(review.items.some((item) => item.id === "cv-pages" && item.severity === "ok"));

  const figs = compareLetterAndCvFigures(sampleEn);
  assert.ok(Array.isArray(figs.shared) && Array.isArray(figs.letterOnly));
});

test("buildStarPrepData and buildMasterCvExportApp work generically", () => {
  const prep = buildStarPrepData(sampleEn);
  assert.equal(prep.lang, "English");
  assert.ok(prep.stories.length > 0);
  assert.ok(prep.drillDeck.length > 0);

  const masterApp = buildMasterCvExportApp(defaultMasterCv, { language: "English", template: "ats-clean" });
  assert.equal(masterApp.cvContent.header.fullName, "Alex Morgan");
  assert.ok(masterApp.formFieldAnswers.workAuthorization.length > 0);
});

test("dashboard filters and funnel analytics summarize applications cleanly by language", () => {
  const summaries = sampleApps.map(toApplicationSummary);
  const filtered = filterAndSortApplications(summaries, {
    searchQuery: "Kallisto",
    statusFilter: "all",
    languageFilter: "all",
    roleTypeFilter: "all",
    fitDecisionFilter: "all",
    sortBy: "dateModified",
  });
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].company, "Kallisto Analytics Ltd.");

  const funnel = computeDashboardFunnelAnalytics(summaries);
  assert.equal(funnel.totalReal, 2);
  assert.ok(funnel.byLanguage.some((row) => row.language === "English"));
  assert.ok(funnel.byLanguage.some((row) => row.language === "German"));
});
