import { JobAnalysisSchema, PromptContextSchema, type Application } from "../schemas";
import { fingerprintText } from "../generationContext";

type ImportChange = NonNullable<Application["importMetadata"]>["changes"];

function preview(value: unknown): string {
  return (typeof value === "string" ? value : JSON.stringify(value) || "").slice(0, 400);
}

/** Adds optional traceability without trusting malformed model-generated metadata. */
export function applyImportContext(raw: Record<string, unknown>, updated: Application): Application {
  const warnings: string[] = [];
  if (typeof raw.searchTrack === "string" && raw.searchTrack.trim().length <= 80 && raw.searchTrack.trim()) {
    updated.searchTrack = raw.searchTrack.trim();
  }
  if (Object.hasOwn(raw, "jobAnalysis")) {
    if (raw.jobAnalysis === null) updated.jobAnalysis = null;
    else {
      const analysis = JobAnalysisSchema.safeParse(raw.jobAnalysis);
      if (analysis.success) {
        const suppliedContext = PromptContextSchema.safeParse(raw.promptContext);
        const linkedFingerprint =
          analysis.data.jobDescriptionFingerprint ||
          (suppliedContext.success ? suppliedContext.data.jobDescriptionFingerprint : undefined) ||
          (typeof raw.jobDescription === "string" && raw.jobDescription.trim() ? fingerprintText(raw.jobDescription) : undefined);
        updated.jobAnalysis = { ...analysis.data, ...(linkedFingerprint ? { jobDescriptionFingerprint: linkedFingerprint } : {}) };
        if (!linkedFingerprint) warnings.push("The requirement map has no linked source offer. Regenerate it to establish its provenance.");
      } else {
        warnings.push("The offer-to-evidence analysis could not be read. Review or regenerate it; document content was retained.");
        updated.jobAnalysis = null;
      }
    }
  }
  if (Object.hasOwn(raw, "promptContext")) {
    const context = PromptContextSchema.safeParse(raw.promptContext);
    if (context.success) {
      updated.promptContext = context.data;
      if (context.data.options.searchTrack) updated.searchTrack = context.data.options.searchTrack;
    } else if (raw.promptContext === null) updated.promptContext = null;
    else warnings.push("Prompt version and settings could not be read.");
  }
  // Invalidating an old analysis is better than showing an apparently current score.
  if (!Object.hasOwn(raw, "jobAnalysis") && updated.jobAnalysis && typeof raw.jobDescription === "string" && updated.jobAnalysis.jobDescriptionFingerprint !== fingerprintText(raw.jobDescription)) {
    warnings.push("The job description changed. Regenerate the requirement analysis before relying on its coverage.");
  }

  const changes: NonNullable<ImportChange> = [];
  const compare = (field: string, before: unknown, after: unknown) => {
    if (before !== undefined && JSON.stringify(before) !== JSON.stringify(after)) changes.push({ field, before: preview(before), after: preview(after) });
  };
  const cv = raw.cvContent && typeof raw.cvContent === "object" ? raw.cvContent as Record<string, unknown> : raw;
  for (const field of ["professionalProfile", "keyAchievements", "coreSkills", "education", "certifications"] as const) compare(field, cv[field], updated.cvContent[field]);
  for (const field of ["experience", "projects"] as const) {
    const entries = cv[field];
    if (!Array.isArray(entries)) continue;
    for (const entry of entries) {
      if (!entry || typeof entry !== "object" || entry.include === false) continue;
      const result = updated.cvContent[field].find((item) => item.id === entry.id);
      if (result) compare(`${field}: ${entry.id}`, entry.bullets, result.bullets);
    }
  }
  const letter = raw.coverLetterContent || raw.coverLetter;
  if (letter && typeof letter === "object") {
    const paragraphs = (letter as Record<string, unknown>).paragraphs;
    if (Array.isArray(paragraphs)) compare("Cover letter paragraphs", paragraphs.map((p) => typeof p === "string" ? p : p?.text), updated.coverLetterContent.paragraphs.map((p) => p.text));
  }
  updated.importMetadata = {
    timestamp: updated.importMetadata?.timestamp || new Date().toISOString(),
    source: updated.importMetadata?.source || "import-modal",
    warnings,
    changes: changes.slice(0, 30),
  };
  return updated;
}
