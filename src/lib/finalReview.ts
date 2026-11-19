import type { Application, MasterCv } from "./schemas";
import { containsFlexibleTerm, evaluateApplicationQuality, getVisibleDocumentSections } from "./applicationQuality";
import { computeTokenOverlap } from "./ai-import/sanitize";
import { resolveSelectedReferenceIds, type ReferenceDocumentMeta } from "./referenceDocuments";

/**
 * Pre-send review that gathers existing checks into locatable warnings. It never turns
 * coverage or a chatbot fit into a hiring probability, never forbids applying and never
 * registers a send: recording the send stays manual and separate.
 */
export type EditorTab = "cv-profile" | "cv-exp" | "cv-projects" | "cv-skills" | "cover-letter" | "assets" | "tracking" | "ats-scanner" | "strategy" | "form-answers";
export type ReviewSeverity = "ok" | "info" | "pending" | "warning";

export interface ReviewItem {
  id: string;
  severity: ReviewSeverity;
  /** Human field name and the editor tab where it is fixed. */
  field: string;
  tab: EditorTab;
  /** Optional target element ID inside the tab for scroll + focus jump. */
  anchorId?: string;
  /** Optional preview document tab to sync alongside navigation. */
  previewTab?: "cv" | "letter";
  message: string;
}

export interface FinalReviewInput {
  app: Application;
  master?: MasterCv;
  saveState: { dirty: boolean; failed: boolean };
  /** Real page counts from the shared paginator; undefined = not measured yet. */
  pages: { cv?: number; letter?: number };
  deliveries: { id: string; applicationRevision: number; exportedAt: string; documentType: string }[];
  /** Local reference PDFs discovered via GET /api/references (optional). */
  availableReferences?: readonly ReferenceDocumentMeta[];
}

const FIGURE = /(?:[€$£]\s?)?\d+(?:[.,]\d+)?(?:\s?[–-]\s?\d+(?:[.,]\d+)?)?\s?(?:%|[kKmM]\b|[€$£])?(?:\+)?/g;

function figures(text: string): string[] {
  return (text.match(FIGURE) || [])
    .map((value) => value.replace(/\s+/g, "").replace(/-/g, "–"))
    // A bare number (years, counts) is not compared; only figures with a unit or range.
    .filter((value) => /[%€$£kKmM+–]/.test(value) && !/^\d{4}–\d{4}$/.test(value));
}

/**
 * Compares figures in the letter's paragraphs with the CV content actually selected
 * for this application (visible sections only). Counts are about paragraph text only.
 */
export function compareLetterAndCvFigures(app: Application): { shared: string[]; letterOnly: string[]; paragraphsWithFigures: number } {
  const sections = getVisibleDocumentSections(app);
  const cvText = Object.entries(sections).filter(([key]) => key !== "letter").map(([, text]) => text).join(" ");
  const cvFigures = new Set(figures(cvText).map((value) => value.toLowerCase()));
  const expectedSalaryFigures = new Set(
    figures([
      app.salaryOffer || "",
      app.salaryPositioning?.recommendedRangeEUR || "",
      app.salaryPositioning?.safeNumberEUR || "",
      app.salaryPositioning?.ambitiousNumberEUR || "",
      app.formFieldAnswers?.salaryExpectation || "",
    ].join(" ")).map((value) => value.toLowerCase())
  );
  const letterFigures = Array.from(new Set(app.coverLetterContent.paragraphs.flatMap((paragraph) => figures(paragraph.text))));
  return {
    shared: letterFigures.filter((value) => cvFigures.has(value.toLowerCase())),
    letterOnly: letterFigures.filter((value) => {
      const low = value.toLowerCase();
      return !cvFigures.has(low) && !expectedSalaryFigures.has(low);
    }),
    paragraphsWithFigures: app.coverLetterContent.paragraphs.filter((paragraph) => figures(paragraph.text).length > 0).length,
  };
}

const PLACEHOLDER = /\[(?:por completar|to complete|bitte ergänzen|insert|placeholder|todo|company|empresa|unternehmen|role|puesto|name|nombre)[^\]]*\]|lorem ipsum|\bTODO\b|\bTBD\b|\bXXX\b|\bMax Mustermann\b/i;

export function buildFinalReview({ app, master, saveState, pages, deliveries, availableReferences }: FinalReviewInput): { items: ReviewItem[]; overall: "ready" | "review" } {
  const items: ReviewItem[] = [];
  const add = (item: ReviewItem) => items.push(item);

  if (saveState.failed) add({ id: "save-failed", severity: "warning", field: "Save state", tab: "cv-profile", message: "The last save attempt failed. Save before exporting or sending." });
  if (saveState.dirty) add({ id: "save-pending", severity: "warning", field: "Save state", tab: "cv-profile", message: "You have unsaved changes; exports will use the saved version once saved." });

  if (!app.company.trim()) add({ id: "company-missing", severity: "warning", field: "Company", tab: "cv-profile", anchorId: "field-company", message: "The application has no company name." });
  if (!app.roleTitle.trim()) add({ id: "role-missing", severity: "warning", field: "Role title", tab: "cv-profile", anchorId: "field-roleTitle", message: "The application has no role title." });
  const letter = app.coverLetterContent;
  if (letter.company && app.company && letter.company.trim() !== app.company.trim()) add({ id: "letter-company-mismatch", severity: "warning", field: "Cover Letter · company", tab: "cover-letter", anchorId: "field-letter-company", previewTab: "letter", message: `The cover letter is addressed to "${letter.company}", while the application targets "${app.company}".` });
  if (letter.roleTitle && app.roleTitle && letter.roleTitle.trim() !== app.roleTitle.trim()) add({ id: "letter-role-mismatch", severity: "info", field: "Cover Letter · role", tab: "cover-letter", anchorId: "field-letter-role", previewTab: "letter", message: `The cover letter mentions "${letter.roleTitle}", while the application targets "${app.roleTitle}".` });
  const requested = app.promptContext?.options.targetLanguage;
  if (requested && requested !== "auto" && requested !== app.language) add({ id: "language-mismatch", severity: "warning", field: "Document language", tab: "cv-profile", anchorId: "field-document-language", message: `The prompt requested ${requested}, but the document is set to ${app.language}.` });
  else add({ id: "language", severity: "info", field: "Document language", tab: "cv-profile", anchorId: "field-document-language", message: `Document language: ${app.language}.` });

  if (!app.cvContent.header.availability.trim()) add({ id: "availability-unconfirmed", severity: "pending", field: "Availability (CV header)", tab: "cv-profile", anchorId: "field-cv-availability", previewTab: "cv", message: "Availability not yet confirmed." });
  if (!app.formFieldAnswers.availability.trim()) add({ id: "answer-availability-unconfirmed", severity: "pending", field: "Form Answers · availability", tab: "form-answers", anchorId: "field-form-availability", message: "Portal availability answer not yet confirmed." });
  const workAuth = (app.formFieldAnswers.workAuthorization || app.formFieldAnswers.workPermitGermany || "").trim();
  if (!workAuth) add({ id: "work-permit-unconfirmed", severity: "pending", field: "Form Answers · work authorization", tab: "form-answers", anchorId: "field-form-work-permit", message: "Work authorization is not confirmed; never inferred from location." });
  if (!app.cvContent.header.email.trim()) add({ id: "email-missing", severity: "warning", field: "Email (CV header)", tab: "cv-profile", anchorId: "field-email", message: "Contact email is missing." });
  if (!app.cvContent.header.phone.trim()) add({ id: "phone-missing", severity: "pending", field: "Phone (CV header)", tab: "cv-profile", anchorId: "field-phone", message: "Contact phone number is missing." });
  if (!(app.cvContent.header.links || []).some((l) => l.url?.trim())) add({ id: "links-missing", severity: "info", field: "Links (CV header)", tab: "cv-profile", anchorId: "field-cv-links", message: "No professional links (LinkedIn, GitHub, Portfolio) are currently visible." });

  const placeholderFields: [string, EditorTab, string][] = [
    ["CV Profile", "cv-profile", app.cvContent.professionalProfile],
    ["Key Achievements", "cv-skills", app.cvContent.keyAchievements.join(" ")],
    ["Experience", "cv-exp", app.cvContent.experience.flatMap((entry) => entry.bullets).join(" ")],
    ["Cover Letter", "cover-letter", [letter.greeting, letter.subjectLine || "", ...letter.paragraphs.map((paragraph) => paragraph.text)].join(" ")],
    ["Portal Form Answers", "form-answers", Object.values(app.formFieldAnswers).join(" ")],
  ];
  for (const [field, tab, text] of placeholderFields) {
    if (PLACEHOLDER.test(text)) add({ id: tab === "cover-letter" ? "placeholder-text" : `placeholder-${tab}`, severity: "warning", field, tab, message: "Contains sample placeholder text or an unfinished marker." });
  }

  // Cross-section repetition & unquantified visible roles
  const visibleExp = app.cvContent.experience.filter((e) => e.include !== false);
  const expBullets = visibleExp.flatMap((e) => e.bullets);
  const overlappingAch = (app.cvContent.keyAchievements || []).filter((ach) => expBullets.some((b) => computeTokenOverlap(ach, b) >= 0.55));
  if (overlappingAch.length > 0) add({ id: "achievement-overlap", severity: "info", field: "Key Achievements vs Experience", tab: "cv-skills", message: `${overlappingAch.length} key achievement(s) closely repeat Experience bullets. Differentiate them to save space.` });
  const unquantifiedRoles = visibleExp.filter((e) => e.bullets.length > 0 && !/\d/.test(e.bullets.join(" ")));
  if (unquantifiedRoles.length > 0) add({ id: "unquantified-role", severity: "info", field: "Experience · metrics", tab: "cv-exp", message: `${unquantifiedRoles.length} visible role(s) have no numbers or scope metrics.` });

  // Bilingual leak detection across letter and visible German/English CV sections
  const letterTextCombined = [letter.dateLine, letter.greeting, letter.subjectLine || "", ...letter.paragraphs.map((p) => p.text)].join(" ");
  const cvGermanLeakSource = [
    ...(app.cvContent.specializedCompetencies || []),
    ...app.cvContent.experience.filter((e) => e.include !== false).map((e) => e.jobTitle),
    ...app.cvContent.coreSkills.map((g) => g.group),
  ].join(" ");
  if (
    app.language === "German" &&
    (/hiring\s+team/i.test(letterTextCombined) ||
      /\bAvailable from\b/i.test(app.cvContent.header.availability) ||
      /\b(January|February|March|May|June|July|October|December)\b/.test(letter.dateLine) ||
      /\b(Core Competencies|Professional Experience|Key Achievements|Work Experience|Cover Letter)\b/i.test(cvGermanLeakSource))
  ) {
    add({ id: "bilingual-leak", severity: "warning", field: "Language consistency (DE)", tab: "cover-letter", message: "Possible English remnants (date, availability, 'Hiring Team', or section headers) inside a German document." });
  } else if (app.language === "English" && (/Mit freundlichen Grüßen|Sehr geehrte|\bHeute\b/.test(letterTextCombined))) {
    add({ id: "bilingual-leak", severity: "warning", field: "Language consistency (EN)", tab: "cover-letter", message: "Possible German expressions inside an English document." });
  }

  // Keyword placement plan regression guard
  if (Array.isArray(app.keywordPlacementPlan) && app.keywordPlacementPlan.length > 0) {
    const sections = getVisibleDocumentSections(app);
    const missingPlanned = app.keywordPlacementPlan.filter((item) => {
      const target = String(item.targetSection || "").trim().toLowerCase();
      if (!target || !(target in sections)) return false;
      const surface = (item.exactSurfaceForm || item.keyword || "").trim();
      return Boolean(surface && !containsFlexibleTerm(sections[target] || "", surface));
    });
    if (missingPlanned.length > 0) {
      add({
        id: "keyword-plan-regression",
        severity: missingPlanned.some((m) => m.priority === "must_have") ? "warning" : "info",
        field: "ATS Keyword Plan",
        tab: "ats-scanner",
        message: `${missingPlanned.length} planned keyword(s) are missing from their target section (${missingPlanned.slice(0, 3).map((m) => `${m.exactSurfaceForm || m.keyword} -> ${m.targetSection}`).join(", ")}).`,
      });
    }
  }

  // Estimated merged PDF size check (common 2 MB portal limit)
  if (availableReferences && availableReferences.length > 0) {
    const selectedRefs = resolveSelectedReferenceIds(app, availableReferences);
    const estRefsKb = selectedRefs.reduce(
      (sum, id) => sum + (availableReferences.find((d) => d.id === id)?.approxKb || 0),
      0
    );
    if (estRefsKb + 180 > 1950) {
      add({
        id: "bundle-size-warning",
        severity: "warning",
        field: "Full PDF Bundle",
        tab: "assets",
        message: `With selected attachments (~${estRefsKb + 180} KB estimated), the bundle may exceed 2 MB (a common ATS portal cap). Consider toggling off optional attachments.`,
      });
    }
  }

  const quality = evaluateApplicationQuality(app, master);
  if (!app.jobDescription?.trim()) add({ id: "offer-missing", severity: "pending", field: "Job Description", tab: "tracking", message: "No saved job description: requirement coverage cannot be checked." });
  else if (!app.jobAnalysis) add({ id: "analysis-missing", severity: "pending", field: "Offer Analysis", tab: "strategy", message: "Job description is saved, but no requirement analysis has been imported yet." });
  else if (quality.stale) add({ id: "analysis-stale", severity: "warning", field: "Offer Analysis", tab: "strategy", message: "The job description changed after the analysis was imported: coverage is outdated." });
  else if (quality.unbound) add({ id: "analysis-unbound", severity: "pending", field: "Offer Analysis", tab: "strategy", message: "The requirement analysis is not linked to a specific version of the job description." });
  if (quality.criticalGaps.length) add({ id: "critical-gaps", severity: "warning", field: "Must-have Requirements", tab: "ats-scanner", message: `${quality.criticalGaps.length} must-have requirement(s) flagged as gaps. Decide whether to apply without claiming unsupported skills.` });
  if (quality.uncertainRequirements.length) add({ id: "unverified-requirements", severity: "pending", field: "Evidence", tab: "ats-scanner", message: `${quality.uncertainRequirements.length} requirement(s) lack a verified quote in the job description or Master CV.` });
  if (quality.letterOverLimit) add({ id: "letter-limit", severity: "warning", field: "Cover Letter · length", tab: "cover-letter", message: `The cover letter has ${quality.letterWords} words, exceeding the posting's ${quality.letterWordLimit}-word limit.` });

  const comparison = compareLetterAndCvFigures(app);
  if (comparison.letterOnly.length) add({ id: "letter-figures-not-in-cv", severity: "warning", field: "Cover Letter · figures", tab: "cover-letter", message: `Figures in the cover letter not present in the selected CV: ${comparison.letterOnly.join(", ")}. Confirm they are backed by verified evidence.` });
  if (comparison.shared.length >= 3) add({ id: "letter-figures-repeated", severity: "info", field: "Cover Letter · figures", tab: "cover-letter", message: `The cover letter repeats ${comparison.shared.length} CV figures across ${comparison.paragraphsWithFigures} paragraph(s).` });

  if (pages.cv === undefined) add({ id: "cv-pages", severity: "pending", field: "CV · pages", tab: "assets", previewTab: "cv", message: "Open the CV preview to measure its exact rendered page count." });
  else add({ id: "cv-pages", severity: pages.cv > 2 ? "warning" : "ok", field: "CV · pages", tab: "assets", previewTab: "cv", message: `The CV spans ${pages.cv} A4 page(s).` });
  if (pages.letter === undefined) add({ id: "letter-pages", severity: "pending", field: "Cover Letter · pages", tab: "cover-letter", previewTab: "letter", message: "Open the Cover Letter preview to measure its exact rendered page count." });
  else add({ id: "letter-pages", severity: pages.letter > 1 ? "warning" : "ok", field: "Cover Letter · pages", tab: "cover-letter", previewTab: "letter", message: `The cover letter spans ${pages.letter} A4 page(s).` });

  const latest = deliveries[0];
  if (!latest) add({ id: "delivery-missing", severity: "pending", field: "Exported Documents", tab: "assets", message: "No exported PDFs have been recorded for this application yet." });
  else if (latest.applicationRevision !== (app.revision ?? 0)) add({ id: "delivery-outdated", severity: "warning", field: "Exported Documents", tab: "assets", message: `The latest export is from revision ${latest.applicationRevision}; the saved draft is at revision ${app.revision ?? 0}. Re-export before sending this version.` });
  else add({ id: "delivery-current", severity: "ok", field: "Exported Documents", tab: "assets", message: `Latest export is up to date (${latest.documentType}). Select this delivery when logging your submission.` });

  const reviewed = app.crm?.preparation?.reviewed === true;
  add({ id: "manual-review", severity: reviewed ? "ok" : "pending", field: "Manual Review", tab: "tracking", anchorId: "field-crm-preparation", message: reviewed ? "Manual review confirmed for the current revision." : "Manual review pending (automatically resets whenever documents or the job description change)." });

  return { items, overall: items.some((item) => item.severity === "warning" || item.severity === "pending") ? "review" : "ready" };
}
