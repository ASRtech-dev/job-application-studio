import { PromptContextSchema, type PromptContext } from "./schemas";
import { PROMPT_VERSION } from "./editorialPolicy";
import type { PromptBuilderOptions } from "./promptBuilder";
import { contextForOffer } from "./offerPreparations";

/** Change detector, not a security hash. Kept synchronous for browser/server parity. */
export function fingerprintText(text: string): string {
  let hash = 2166136261;
  for (const character of text.replace(/\r\n/g, "\n").trim()) {
    hash ^= character.codePointAt(0) || 0;
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export const PENDING_GENERATION_KEY = "jas_pending_generation_v1";

export function createPromptContext(options: PromptBuilderOptions): PromptContext {
  const settings = { ...options };
  delete settings.masterCv;
  delete settings.existingApplication;
  const jobDescription = settings.jobDescription ?? "";
  delete settings.jobDescription;
  const generatedAt = settings.generatedAt || new Date().toISOString();
  delete settings.generatedAt;
  const trimOpt = (v?: string) => (v && v.trim() ? v.trim() : undefined);
  const url = trimOpt(settings.jobPostingUrl);
  const postingId = trimOpt(settings.jobPostingId);
  const deadline = trimOpt(settings.applicationDeadline);
  const salaryHint = trimOpt(settings.salaryExpectationHint);
  delete settings.jobPostingUrl;
  delete settings.jobPostingId;
  delete settings.applicationDeadline;
  delete settings.salaryExpectationHint;
  if (settings.includeInterviewPrep === undefined) delete settings.includeInterviewPrep;

  return PromptContextSchema.parse({
    version: PROMPT_VERSION,
    generatedAt,
    ...(options.masterCv ? { masterRevision: options.masterCv.revision ?? 0 } : {}),
    jobDescriptionFingerprint: fingerprintText(jobDescription),
    options: {
      ...settings,
      ...(url ? { jobPostingUrl: url } : {}),
      ...(postingId ? { jobPostingId: postingId } : {}),
      ...(deadline ? { applicationDeadline: deadline } : {}),
      ...(salaryHint ? { salaryExpectationHint: salaryHint } : {}),
    },
  });
}

export function resolvePromptContext(reported: unknown, captured: PromptContext | null): { context: PromptContext | null; warning?: string } {
  const parsed = PromptContextSchema.safeParse(reported);
  if (parsed.success) {
    const differs = captured && (parsed.data.version !== captured.version || parsed.data.generatedAt !== captured.generatedAt || JSON.stringify(parsed.data.options) !== JSON.stringify(captured.options));
    return { context: parsed.data, ...(differs ? { warning: "This JSON belongs to a different prompt generation than the latest copied prompt. Its original version and settings were preserved." } : {}) };
  }
  return { context: captured };
}

/** Use stored context only for the exact offer being imported. */
export function parsePendingGeneration(text: string | null, jobDescription: string): PromptContext | null {
  if (!text || !jobDescription.trim()) return null;
  try {
    const parsed = PromptContextSchema.safeParse(JSON.parse(text));
    return parsed.success && parsed.data.jobDescriptionFingerprint === fingerprintText(jobDescription) ? parsed.data : null;
  } catch {
    return null;
  }
}

export function readPendingGeneration(jobDescription: string): PromptContext | null {
  try {
    // Several saved preparations: pick the one copied for exactly this offer text.
    return contextForOffer(jobDescription) ?? parsePendingGeneration(localStorage.getItem(PENDING_GENERATION_KEY), jobDescription);
  } catch {
    return null;
  }
}
