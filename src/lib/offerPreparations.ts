import { z } from "zod";
import { PromptContextSchema, type PromptContext } from "./schemas";
import { fingerprintText } from "./generationContext";

/**
 * Several recoverable preparations per job offer (browser storage), instead of a single
 * global pending offer. Each keeps the offer, user-entered posting facts, the chosen
 * preferences and the context of the prompt actually copied for it.
 */
export const PREPARATIONS_KEY = "jas_offer_preparations_v1";
const MAX_PREPARATIONS = 40;

const DaySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const OfferPreparationSchema = z.object({
  id: z.string().min(1).max(80),
  createdAt: z.string(),
  updatedAt: z.string(),
  company: z.string().max(300).default(""),
  roleTitle: z.string().max(300).default(""),
  jobDescription: z.string().max(200_000).default(""),
  /** Only when known; never inferred or scraped. */
  jobPostingUrl: z.string().max(2000).optional(),
  jobPostingId: z.string().max(200).optional(),
  applicationDeadline: DaySchema.optional(),
  salaryExpectationHint: z.string().max(200).optional(),
  triageResult: z.object({
    company: z.string().optional(),
    roleTitle: z.string().optional(),
    language: z.string().optional(),
    scoreOutOf10: z.number().nullable().optional(),
    probabilityTier: z.string().optional(),
    applyOrSkip: z.string().optional(),
    summary: z.string().optional(),
    mainRisks: z.array(z.string()).optional(),
    rawJson: z.string().max(200_000).optional(),
  }).optional(),
  promptContext: PromptContextSchema.optional(),
});
export type OfferPreparation = z.infer<typeof OfferPreparationSchema>;

export interface KeyValueStorage { getItem(key: string): string | null; setItem(key: string, value: string): void }

function browserStorage(): KeyValueStorage | null {
  try { return typeof localStorage === "undefined" ? null : localStorage; } catch { return null; }
}

export function listPreparations(storage: KeyValueStorage | null = browserStorage()): OfferPreparation[] {
  if (!storage) return [];
  try {
    const raw = JSON.parse(storage.getItem(PREPARATIONS_KEY) || "[]");
    if (!Array.isArray(raw)) return [];
    return raw.flatMap((item) => { const parsed = OfferPreparationSchema.safeParse(item); return parsed.success ? [parsed.data] : []; })
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } catch { return []; }
}

/** Inserts or updates by id; keeps the newest MAX_PREPARATIONS. */
export function savePreparation(preparation: OfferPreparation, storage: KeyValueStorage | null = browserStorage()): OfferPreparation[] {
  if (!storage) return [];
  const parsed = OfferPreparationSchema.parse(preparation);
  const list = [parsed, ...listPreparations(storage).filter((item) => item.id !== parsed.id)].slice(0, MAX_PREPARATIONS);
  try { storage.setItem(PREPARATIONS_KEY, JSON.stringify(list)); } catch { /* Quota: the prompt still carries its own context. */ }
  return list;
}

export function removePreparation(id: string, storage: KeyValueStorage | null = browserStorage()): OfferPreparation[] {
  if (!storage) return [];
  const list = listPreparations(storage).filter((item) => item.id !== id);
  try { storage.setItem(PREPARATIONS_KEY, JSON.stringify(list)); } catch { /* ignore */ }
  return list;
}

/** Context of the prompt copied for exactly this offer text, newest first. */
export function contextForOffer(jobDescription: string, storage: KeyValueStorage | null = browserStorage()): PromptContext | null {
  if (!jobDescription.trim()) return null;
  const fingerprint = fingerprintText(jobDescription);
  return listPreparations(storage).find((item) => item.promptContext?.jobDescriptionFingerprint === fingerprint)?.promptContext ?? null;
}

const norm = (value?: string) => (value || "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
export function normalizePostingUrl(url?: string): string {
  if (!url?.trim()) return "";
  try {
    const parsed = new URL(url.trim());
    for (const key of [...parsed.searchParams.keys()]) if (/^(utm_|ref|refid|trk|source|gh_src)/i.test(key)) parsed.searchParams.delete(key);
    return `${parsed.hostname.replace(/^www\./, "")}${parsed.pathname.replace(/\/+$/, "")}${parsed.search}`.toLowerCase();
  } catch { return url.trim().toLowerCase(); }
}

export interface OfferIdentity { id?: string; company?: string; roleTitle?: string; jobPostingUrl?: string; jobPostingId?: string; jobDescription?: string; jobDescriptionFingerprint?: string }
export interface DuplicateWarning { id: string; strength: "same-offer" | "possible"; reason: string }

/**
 * Warns, never blocks: identical posting URL/ID = same offer; same company and role,
 * or the same offer text, is only a secondary hint. Two roles of one company are fine.
 */
export function findDuplicateOffers(candidate: OfferIdentity, existing: OfferIdentity[]): DuplicateWarning[] {
  const url = normalizePostingUrl(candidate.jobPostingUrl);
  const postingId = norm(candidate.jobPostingId);
  const companyRole = norm(candidate.company) && norm(candidate.roleTitle) ? `${norm(candidate.company)}|${norm(candidate.roleTitle)}` : "";
  const fingerprint = candidate.jobDescriptionFingerprint || (candidate.jobDescription?.trim() ? fingerprintText(candidate.jobDescription) : "");
  const warnings: DuplicateWarning[] = [];
  for (const item of existing) {
    if (!item.id || item.id === candidate.id) continue;
    if (url && url === normalizePostingUrl(item.jobPostingUrl)) { warnings.push({ id: item.id, strength: "same-offer", reason: "Same job posting URL" }); continue; }
    if (postingId && postingId === norm(item.jobPostingId) && norm(candidate.company) === norm(item.company)) { warnings.push({ id: item.id, strength: "same-offer", reason: "Same job ID at the same company" }); continue; }
    const itemFingerprint = item.jobDescriptionFingerprint || (item.jobDescription?.trim() ? fingerprintText(item.jobDescription) : "");
    if (fingerprint && fingerprint === itemFingerprint) { warnings.push({ id: item.id, strength: "possible", reason: "Job description text matches" }); continue; }
    if (companyRole && companyRole === `${norm(item.company)}|${norm(item.roleTitle)}`) warnings.push({ id: item.id, strength: "possible", reason: "Same company and role title" });
  }
  return warnings;
}
