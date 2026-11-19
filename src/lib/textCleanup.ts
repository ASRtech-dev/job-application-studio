import type { Application } from "./schemas";
import { AI_CLICHE_PATTERNS, computeTokenOverlap, sanitizeAiText } from "./ai-import/sanitize";

/**
 * Manual wording cleanup for the editor. Unlike the importer, it never selects,
 * deduplicates, truncates or reorders content: each proposal is one text field,
 * reviewed before/after, accepted individually and reversible.
 */
export type CleanupPath = (string | number)[];

export interface CleanupChange {
  id: string;
  path: CleanupPath;
  label: string;
  before: string;
  after: string;
}

export interface CleanupReviewItem {
  label: string;
  terms: string[];
}

export interface CleanupProposal {
  changes: CleanupChange[];
  manualReview: CleanupReviewItem[];
}

interface TextField {
  path: CleanupPath;
  label: string;
  value: string;
}

function textFields(app: Application): TextField[] {
  const fields: TextField[] = [];
  const push = (path: CleanupPath, label: string, value: unknown) => {
    if (typeof value === "string" && value.trim()) fields.push({ path, label, value });
  };
  push(["cvContent", "header", "headline"], "CV · Headline", app.cvContent.header.headline);
  push(["cvContent", "professionalProfile"], "CV · Profile", app.cvContent.professionalProfile);
  app.cvContent.keyAchievements.forEach((text, index) => push(["cvContent", "keyAchievements", index], `CV · Achievement ${index + 1}`, text));
  app.cvContent.experience.forEach((entry, entryIndex) => {
    if (entry.include === false) return;
    const role = `${entry.jobTitle || "Experience"}${entry.company ? ` (${entry.company})` : ""}`;
    push(["cvContent", "experience", entryIndex, "summary"], `CV · ${role} · summary`, entry.summary);
    entry.bullets.forEach((text, index) => push(["cvContent", "experience", entryIndex, "bullets", index], `CV · ${role} · bullet ${index + 1}`, text));
  });
  (app.cvContent.projects || []).forEach((project, projectIndex) => {
    if (project.include === false) return;
    const title = project.title || "Project";
    push(["cvContent", "projects", projectIndex, "description"], `CV · ${title} · description`, project.description);
    project.bullets.forEach((text, index) => push(["cvContent", "projects", projectIndex, "bullets", index], `CV · ${title} · bullet ${index + 1}`, text));
  });
  push(["coverLetterContent", "subjectLine"], "Cover Letter · Subject", app.coverLetterContent.subjectLine);
  push(["coverLetterContent", "positioningLine"], "Cover Letter · Positioning Line", app.coverLetterContent.positioningLine);
  app.coverLetterContent.paragraphs.forEach((paragraph, index) => push(["coverLetterContent", "paragraphs", index, "text"], `Cover Letter · Paragraph ${index + 1}`, paragraph.text));
  const answers = app.formFieldAnswers;
  if (answers) {
    push(["formFieldAnswers", "shortMotivationMessage"], "Form Answers · Short Motivation", answers.shortMotivationMessage);
    push(["formFieldAnswers", "whyThisRole"], "Form Answers · Why This Role", answers.whyThisRole);
    push(["formFieldAnswers", "whyThisCompany"], "Form Answers · Why This Company", answers.whyThisCompany);
    push(["formFieldAnswers", "additionalMessage"], "Form Answers · Additional Message", answers.additionalMessage);
    push(["formFieldAnswers", "degreeExplanation"], "Form Answers · Education Note", answers.degreeExplanation);
  }
  return fields;
}

function clichesIn(text: string): { replaceable: string[]; detectionOnly: string[] } {
  const replaceable: string[] = [];
  const detectionOnly: string[] = [];
  for (const { pattern, replacement, label } of AI_CLICHE_PATTERNS) {
    pattern.lastIndex = 0;
    if (!pattern.test(text)) continue;
    (replacement === undefined ? detectionOnly : replaceable).push(label);
  }
  return { replaceable, detectionOnly };
}

/** Builds per-field proposals. The input is never mutated. */
export function proposeTextCleanup(app: Application): CleanupProposal {
  const changes: CleanupChange[] = [];
  const manualReview: CleanupReviewItem[] = [];
  for (const field of textFields(app)) {
    const { replaceable, detectionOnly } = clichesIn(field.value);
    if (replaceable.length) {
      const after = sanitizeAiText(field.value);
      if (after && after !== field.value) {
        changes.push({ id: field.path.join("."), path: field.path, label: field.label, before: field.value, after });
      }
    }
    if (detectionOnly.length) manualReview.push({ label: field.label, terms: detectionOnly });
  }
  const seen = new Map<string, number>();
  app.cvContent.keyAchievements.forEach((achievement, index) => {
    const key = achievement.toLowerCase().replace(/\*\*/g, "").trim();
    if (!key) return;
    if (seen.has(key)) manualReview.push({ label: `CV · Achievement ${index + 1}`, terms: [`Duplicate of achievement ${(seen.get(key) ?? 0) + 1}`] });
    else seen.set(key, index);
  });

  // Detect high cross-section overlap (>= 0.55) between keyAchievements and visible experience/projects bullets
  const visibleBullets = [
    ...app.cvContent.experience.filter((e) => e.include !== false).flatMap((e) => e.bullets),
    ...(app.cvContent.projects || []).filter((p) => p.include !== false).flatMap((p) => p.bullets),
  ];
  app.cvContent.keyAchievements.forEach((achievement, index) => {
    if (visibleBullets.some((bullet) => computeTokenOverlap(achievement, bullet) >= 0.55)) {
      manualReview.push({ label: `CV · Achievement ${index + 1}`, terms: ["High overlap with an Experience/Projects bullet (avoid repeating metrics)"] });
    }
  });

  // Detect passive openers in visible CV bullets for manual strengthening
  const passiveRe = /^\s*(?:\*\*)?(responsible for|helped with|assisted in|worked on|verantwortlich für|zuständig für|mitarbeit bei|responsable de|encargado de)\b/i;
  app.cvContent.experience.forEach((entry) => {
    if (entry.include === false) return;
    entry.bullets.forEach((bullet, bIdx) => {
      if (passiveRe.test(bullet)) {
        manualReview.push({
          label: `CV · ${entry.jobTitle || "Experience"} · bullet ${bIdx + 1}`,
          terms: ["Passive opener (prefer a direct action verb + measurable outcome)"],
        });
      }
    });
  });
  return { changes, manualReview };
}

function readPath(target: unknown, path: CleanupPath): unknown {
  return path.reduce<unknown>((node, key) => (node && typeof node === "object" ? (node as Record<string | number, unknown>)[key] : undefined), target);
}

function writePath(target: unknown, path: CleanupPath, value: string): void {
  const parent = readPath(target, path.slice(0, -1));
  if (parent && typeof parent === "object") (parent as Record<string | number, unknown>)[path[path.length - 1]] = value;
}

/**
 * Applies only the accepted proposals whose field still holds the proposed "before"
 * text. Returns the exact previous state for undo and the ids that were skipped.
 */
export function applyTextCleanup(app: Application, changes: CleanupChange[], acceptedIds: string[]): { app: Application; previous: Application; skipped: string[] } {
  const previous = structuredClone(app);
  const accepted = new Set(acceptedIds);
  if (!changes.some(change => accepted.has(change.id))) return { app, previous, skipped: [] };
  const next = structuredClone(app);
  const skipped: string[] = [];
  for (const change of changes) {
    if (!accepted.has(change.id)) continue;
    if (readPath(next, change.path) !== change.before) { skipped.push(change.id); continue; }
    writePath(next, change.path, change.after);
  }
  return { app: next, previous, skipped };
}
