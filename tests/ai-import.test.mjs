import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { createSourceLoader, projectRoot } from "./helpers/source-loader.mjs";

const load = createSourceLoader();
const { parseLooseAIJson, normalizeImportedAIJson } = load("src/lib/aiJsonMapper.ts");
const { validateImportText, previewImport } = load("src/lib/importPreview.ts");
const { proposeTextCleanup, applyTextCleanup } = load("src/lib/textCleanup.ts");

const sampleApps = JSON.parse(fs.readFileSync(path.join(projectRoot, "data", "applications.example.json"), "utf8"));
const baseApp = sampleApps[0];

test("parseLooseAIJson handles markdown fences, trailing commas, and wrapper prose", () => {
  const raw = 'Sure! Here is your JSON:\n```json\n{"company": "Vanguard Bio", "roleTitle": "Lead Analyst",}\n```\nHope this helps!';
  const { data } = parseLooseAIJson(raw);
  assert.equal(data.company, "Vanguard Bio");
  assert.equal(data.roleTitle, "Lead Analyst");
});

test("normalizeImportedAIJson separates multiple roles at the same employer without collision", () => {
  const multiRoleBase = structuredClone(baseApp);
  multiRoleBase.cvContent.experience = [
    { id: "exp-1", jobTitle: "Senior Operations Manager", company: "Northstar Cloud Ltd.", location: "London, UK", dates: "2023 – Present", bullets: ["Led ops."] },
    { id: "exp-2", jobTitle: "Operations Analyst", company: "Northstar Cloud Ltd.", location: "London, UK", dates: "2021 – 2023", bullets: ["Analyzed ops."] },
  ];
  const imported = normalizeImportedAIJson(
    {
      company: "Kallisto Labs",
      roleTitle: "Head of Operations",
      experience: [
        { company: "Northstar Cloud Ltd.", jobTitle: "Senior Operations Manager", bullets: ["Scaled European rollout by 30%."] },
        { company: "Northstar Cloud Ltd.", jobTitle: "Operations Analyst", bullets: ["Built automated SLA dashboards."] },
      ],
    },
    multiRoleBase
  );
  assert.equal(imported.cvContent.experience.length, 2);
  assert.equal(imported.cvContent.experience[0].id, "exp-1");
  assert.equal(imported.cvContent.experience[1].id, "exp-2");
  assert.match(imported.cvContent.experience[0].bullets[0], /30%/);
  assert.match(imported.cvContent.experience[1].bullets[0], /SLA/);
});

test("normalizeImportedAIJson respects explicit include:false and localizes German dates & labels generically", () => {
  const imported = normalizeImportedAIJson(
    {
      company: "Alpenblick GmbH",
      roleTitle: "Operations Manager",
      language: "German",
      cvContent: {
        professionalProfile: "Erfahrene Führungskraft im Operations-Bereich.",
        experience: [
          { id: "exp-1", company: "Northstar Cloud Ltd.", jobTitle: "Operations Manager", location: "Munich, Germany", dates: "Jan 2022 – Present", include: true, bullets: ["Verbesserte Durchlaufzeiten um 25%."] },
          { id: "exp-2", include: false, bullets: [] },
        ],
      },
      coverLetterContent: {
        dateLine: "London, May 14, 2026",
        greeting: "Dear Hiring Team,",
        paragraphs: [{ type: "opening", text: "Hiermit bewerbe ich mich bei Alpenblick GmbH." }],
      },
      formFieldAnswers: {
        workAuthorization: "Yes",
      },
    },
    baseApp
  );
  assert.equal(imported.language, "German");
  assert.equal(imported.cvContent.experience.length, 1);
  assert.equal(imported.cvContent.experience[0].dates, "Jan. 2022 – Heute");
  assert.equal(imported.cvContent.experience[0].location, "Munich, Deutschland");
  assert.equal(imported.coverLetterContent.greeting, "Sehr geehrte Damen und Herren,");
  assert.equal(imported.coverLetterContent.closingPhrase, "Mit freundlichen Grüßen");
  assert.equal(imported.formFieldAnswers.workAuthorization, "Ja");
});

test("import preview validates payloads in English and computes section diffs cleanly", () => {
  const bad = validateImportText("[1, 2, 3]");
  assert.equal(bad.ok, false);
  assert.match(bad.errors[0], /JSON root must be an object/i);

  const preview = previewImport(JSON.stringify({ company: "NewCo", roleTitle: "Director of Ops" }), baseApp);
  assert.equal(preview.validation.ok, true);
  assert.ok(preview.diff.some((s) => s.section === "identity"));
});

test("text cleanup proposes and reversibly applies safe cliché replacements", () => {
  const dirty = structuredClone(baseApp);
  dirty.cvContent.professionalProfile = "Spearheaded workflows and seamlessly utilized modern analytics.";
  const proposal = proposeTextCleanup(dirty);
  assert.ok(proposal.changes.length >= 1);
  const { app: cleaned, previous } = applyTextCleanup(dirty, proposal.changes, proposal.changes.map((c) => c.id));
  assert.match(cleaned.cvContent.professionalProfile, /^Led workflows/i);
  assert.ok(!cleaned.cvContent.professionalProfile.includes("seamlessly"));
  assert.equal(previous.cvContent.professionalProfile, dirty.cvContent.professionalProfile);
});
