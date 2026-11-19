import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { createSourceLoader, projectRoot } from "./helpers/source-loader.mjs";

const load = createSourceLoader();
const { MasterCvSchema, ApplicationSchema, TemplateSettingsSchema, PromptContextSchema, toApplicationSummary } = load("src/lib/schemas.ts");
const { defaultMasterCv } = load("src/lib/defaultMasterCv.ts");

test("defaultMasterCv and data/master-cv.example.json strictly validate against MasterCvSchema", () => {
  const parsedDefault = MasterCvSchema.parse(defaultMasterCv);
  assert.equal(parsedDefault.fullName, "Alex Morgan");
  assert.ok(parsedDefault.experienceHistory.length >= 2);
  assert.ok(parsedDefault.achievementsPool.length >= 3);

  const exampleRaw = JSON.parse(fs.readFileSync(path.join(projectRoot, "data", "master-cv.example.json"), "utf8"));
  const parsedExample = MasterCvSchema.parse(exampleRaw);
  assert.equal(parsedExample.fullName, "Alex Morgan");
  assert.ok(parsedExample.workAuthorization);
});

test("data/applications.example.json strictly validates against ApplicationSchema", () => {
  const appsRaw = JSON.parse(fs.readFileSync(path.join(projectRoot, "data", "applications.example.json"), "utf8"));
  assert.ok(Array.isArray(appsRaw) && appsRaw.length >= 2);
  for (const raw of appsRaw) {
    const parsed = ApplicationSchema.parse(raw);
    assert.ok(parsed.company);
    assert.ok(parsed.roleTitle);
    const summary = toApplicationSummary(parsed);
    assert.equal(summary.id, parsed.id);
    assert.equal(summary.company, parsed.company);
  }
});

test("v1.0 legacy coverLetterTemplate and prompt options coerce gracefully without breaking saved data", () => {
  const ts = TemplateSettingsSchema.parse({ coverLetterTemplate: "asr-sidebar" });
  assert.equal(ts.coverLetterTemplate, "editorial-sidebar");

  const ctx = PromptContextSchema.parse({
    version: "3.3.0",
    generatedAt: "2026-01-01T00:00:00.000Z",
    options: {
      targetLanguage: "English",
      strategyAngle: "legacy_custom_angle",
      tonePreset: "legacy_tone",
      cvLengthMode: "auto_clean",
      emphasisHighlights: [],
    },
  });
  assert.equal(ctx.options.strategyAngle, "auto");
  assert.equal(ctx.options.tonePreset, "auto");
});
