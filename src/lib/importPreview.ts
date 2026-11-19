import { z } from "zod";
import type { Application } from "./schemas";
import { parseLooseAIJson } from "./ai-import/json";
import { normalizeImportedAIJson } from "./aiJsonMapper";
import { DOCUMENT_SETTING_LIMITS } from "./documentSettingLimits";

/**
 * Shared import validation for pasted text and files, in the dashboard, the editor
 * and the creation API: read -> recognize fields and their types -> (editor) normalize
 * a copy -> compare by section -> accept or cancel. Nothing here mutates a draft.
 */
const textField = z.string();
const objectList = z.array(z.record(z.string(), z.unknown()));
const limit = (key: keyof typeof DOCUMENT_SETTING_LIMITS) => z.number().finite().min(DOCUMENT_SETTING_LIMITS[key][0]).max(DOCUMENT_SETTING_LIMITS[key][1]);
const localAsset = z.string().max(300).regex(/^\/uploads\/[A-Za-z0-9/_.-]+$/, "only local /uploads/ paths are allowed");

const KNOWN_TYPES: Record<string, z.ZodType> = {
  company: textField, roleTitle: textField, language: textField, status: textField,
  jobDescription: textField, jobLocation: textField, workModel: textField, notes: textField,
  recruiterContact: textField, salaryOffer: textField, interviewDate: textField, searchTrack: textField,
  jobPostingUrl: z.string().max(2000), jobPostingId: z.string().max(200),
  applicationDeadline: z.string().max(40), salaryExpectationHint: z.string().max(200),
  headline: textField, professionalProfile: textField,
  header: z.record(z.string(), z.unknown()),
  keyAchievements: z.array(z.union([z.string(), z.number()])),
  coreSkills: z.union([z.array(z.unknown()), z.record(z.string(), z.unknown())]),
  skills: z.union([z.array(z.unknown()), z.record(z.string(), z.unknown())]),
  experience: objectList, professionalExperience: objectList,
  projects: objectList, selectedProjects: objectList,
  education: objectList, certifications: objectList,
  cvContent: z.record(z.string(), z.unknown()),
  coverLetterContent: z.object({ paragraphs: z.array(z.unknown()).optional() }).passthrough(),
  coverLetter: z.object({ paragraphs: z.array(z.unknown()).optional() }).passthrough(),
  formFieldAnswers: z.record(z.string(), z.unknown()), portalFormAnswers: z.record(z.string(), z.unknown()),
  roleClassification: z.record(z.string(), z.unknown()), fitAssessment: z.record(z.string(), z.unknown()),
  salaryPositioning: z.record(z.string(), z.unknown()), keywordStrategy: z.record(z.string(), z.unknown()),
  recruiterConcernHandling: z.union([z.record(z.string(), z.unknown()), z.array(z.unknown())]),
  qualityControl: z.record(z.string(), z.unknown()),
  specializedCompetencies: z.array(z.string()),
  keywordPlacementPlan: objectList,
  outreachMessages: z.record(z.string(), z.unknown()),
  portalQuestionAnswers: objectList,
  interviewPrep: z.record(z.string(), z.unknown()),
  jobAnalysis: z.union([z.record(z.string(), z.unknown()), z.null()]),
  promptContext: z.union([z.record(z.string(), z.unknown()), z.null()]),
  templateSettings: z.object({
    cvTemplate: z.enum(["ats-clean", "modern-professional", "dach-tabular"]).optional(),
    coverLetterTemplate: z.enum(["ats-letter", "editorial-sidebar", "din-editorial", "asr-sidebar"]).optional(),
    accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    fontFamily: z.string().max(60).optional(),
    pageSize: z.literal("A4").optional(),
    fontSize: limit("fontSize").optional(),
    lineSpacing: limit("lineSpacing").optional(),
    sectionSpacing: limit("sectionSpacing").optional(),
    letterFontSize: limit("letterFontSize").optional(),
    letterLineSpacing: limit("letterLineSpacing").optional(),
    letterParagraphSpacing: limit("letterParagraphSpacing").optional(),
    showKeyAchievements: z.boolean().optional(),
    showProjects: z.boolean().optional(),
    showSpecializedCompetencies: z.boolean().optional(),
    packetOrder: z.enum(["dach", "ats"]).optional(),
  }).strict(),
  assetSettings: z.object({
    signature: z.object({ enabled: z.boolean().optional(), filePath: localAsset.optional(), widthPx: limit("signatureWidthPx").optional(), alignment: z.enum(["left", "center", "right"]).optional() }).strict().optional(),
    photo: z.object({ enabled: z.boolean().optional(), filePath: localAsset.optional(), cropStyle: z.enum(["circle", "rounded-square", "portrait-rectangle"]).optional(), placement: z.enum(["sidebar", "header-right", "header-left", "header-center"]).optional(), widthPx: limit("photoWidthPx").optional() }).strict().optional(),
    referenceDocIds: z.array(z.string()).optional(),
  }).strict(),
};
const CV_KEYS = ["header", "headline", "professionalProfile", "keyAchievements", "coreSkills", "skills", "specializedCompetencies", "experience", "professionalExperience", "projects", "selectedProjects", "education", "certifications"];
const LANGUAGES = ["English", "German", "Spanish"];

export type DetectedImportMode = "full_application" | "triage_only" | "outreach_only" | "interview_prep" | "partial";

export interface ImportValidation {
  syntaxOk: boolean;
  ok: boolean;
  /** True when only some recognized fields were supplied (e.g. only company). */
  partial: boolean;
  detectedMode?: DetectedImportMode;
  errors: string[];
  warnings: string[];
  recognized: string[];
  data?: Record<string, unknown>;
  cleanedText?: string;
  summary: { company?: string; roleTitle?: string; language?: string; fitScore?: number | null; priority?: string; positioning?: string; applyOrSkip?: string; fitSummary?: string; mainRisks?: string[] };
}

function issueText(key: string, error: z.ZodError): string {
  const first = error.issues[0];
  const where = [key, ...first.path.map(String)].join(".");
  const hint =
    first.code === "invalid_type"
      ? `expected a different type (${first.message})`
      : first.code === "too_big" || first.code === "too_small"
      ? `out of permitted range (${first.message})`
      : first.message;
  return `"${where}" does not match the expected type or range (${hint}).`;
}

/** Validates a parsed payload: plain object root, recognized fields and their types. */
export function validateImportPayload(data: unknown): Omit<ImportValidation, "syntaxOk" | "cleanedText"> {
  const empty = { ok: false, partial: false, warnings: [], recognized: [], summary: {} };
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return { ...empty, errors: ["The JSON root must be an object { ... }, not an array or primitive value."] };
  }
  const root = data as Record<string, unknown>;
  const cv = root.cvContent && typeof root.cvContent === "object" && !Array.isArray(root.cvContent) ? root.cvContent as Record<string, unknown> : null;
  const errors: string[] = [];
  const warnings: string[] = [];
  const recognized: string[] = [];
  const check = (key: string, value: unknown, label = key) => {
    const schema = KNOWN_TYPES[key];
    if (!schema || value === undefined) return;
    recognized.push(label);
    const parsed = schema.safeParse(value);
    if (!parsed.success) errors.push(issueText(label, parsed.error));
  };
  for (const [key, value] of Object.entries(root)) check(key, value);
  if (cv) for (const key of CV_KEYS) check(key, cv[key], `cvContent.${key}`);
  const shadowed = cv ? CV_KEYS.filter((key) => key in root) : [];
  if (shadowed.length) warnings.push(`Root field(s) ${shadowed.join(", ")} ignored because the JSON includes cvContent.`);
  if (typeof root.language === "string" && !LANGUAGES.includes(root.language)) warnings.push(`Unrecognized language "${root.language}": it will be detected from document content.`);
  const unknown = Object.keys(root).filter((key) => !KNOWN_TYPES[key]);
  if (unknown.length) warnings.push(`Ignored unrecognized fields: ${unknown.slice(0, 8).join(", ")}${unknown.length > 8 ? "..." : ""}.`);
  // promptContext alone is legitimate provenance for a new draft; an empty cvContent is not content.
  const meaningful = recognized.filter((key) => key !== "cvContent");
  if (!meaningful.length) errors.push("No recognized application fields found (company, roleTitle, cvContent, coverLetterContent, etc.).");

  const fit = root.fitAssessment as Record<string, unknown> | undefined;
  const classification = root.roleClassification as Record<string, unknown> | undefined;
  const summary = {
    company: typeof root.company === "string" ? root.company : undefined,
    roleTitle: typeof root.roleTitle === "string" ? root.roleTitle : undefined,
    language: typeof root.language === "string" ? root.language : undefined,
    fitScore: typeof fit?.scoreOutOf10 === "number" ? fit.scoreOutOf10 : null,
    priority: typeof classification?.applicationPriority === "string" ? classification.applicationPriority : undefined,
    positioning: typeof classification?.recommendedPositioning === "string" ? classification.recommendedPositioning : undefined,
    applyOrSkip: typeof fit?.applyOrSkip === "string" ? fit.applyOrSkip : undefined,
    fitSummary: typeof fit?.summary === "string" ? fit.summary : undefined,
    mainRisks: Array.isArray(fit?.mainRisks) ? fit.mainRisks.map((r) => String(r)).filter(Boolean) : undefined,
  };
  const hasCvOrLetter = Boolean(cv || root.coverLetterContent || root.coverLetter || root.experience || root.professionalExperience || root.professionalProfile);
  const detectedMode: DetectedImportMode = hasCvOrLetter
    ? "full_application"
    : root.interviewPrep
      ? "interview_prep"
      : root.outreachMessages || root.portalQuestionAnswers
        ? "outreach_only"
        : root.jobAnalysis || root.fitAssessment
          ? "triage_only"
          : "partial";
  const substantive = meaningful.filter((key) => !["company", "roleTitle", "language", "status", "searchTrack", "promptContext"].includes(key));
  return { ok: errors.length === 0, partial: substantive.length === 0 || !(cv || root.coverLetterContent || root.coverLetter), detectedMode, errors, warnings, recognized, data: root, summary };
}

export function validateImportText(text: string): ImportValidation {
  let parsed: { data: unknown; cleanedText: string };
  try { parsed = parseLooseAIJson(text); }
  catch (error) {
    return { syntaxOk: false, ok: false, partial: false, errors: [`JSON syntax error: ${error instanceof Error ? error.message : String(error)}`], warnings: [], recognized: [], summary: {} };
  }
  return { syntaxOk: true, cleanedText: parsed.cleanedText, ...validateImportPayload(parsed.data) };
}

export type ImportSectionId = "identity" | "header" | "profile" | "achievements" | "skills" | "experience" | "projects" | "education" | "certifications" | "letter" | "answers" | "strategy" | "offer" | "design" | "normalizer";

export interface ImportDiffSection {
  section: ImportSectionId;
  label: string;
  added: number;
  removed: number;
  replaced: number;
  excluded: number;
  details: string[];
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const short = (value: unknown) => { const text = typeof value === "string" ? value : JSON.stringify(value) ?? ""; return text.length > 90 ? `${text.slice(0, 87)}...` : text; };

function fieldDiff(section: ImportSectionId, label: string, before: Record<string, unknown>, after: Record<string, unknown>, keys?: string[]): ImportDiffSection | null {
  const details: string[] = [];
  for (const key of keys ?? Array.from(new Set([...Object.keys(before), ...Object.keys(after)]))) {
    if (!same(before[key], after[key])) details.push(`${key}: "${short(before[key])}" -> "${short(after[key])}"`);
  }
  return details.length ? { section, label, added: 0, removed: 0, replaced: details.length, excluded: 0, details } : null;
}

function listDiff<T>(section: ImportSectionId, label: string, before: T[], after: T[], key: (item: T, index: number) => string, name: (item: T) => string, excludedKeys = new Set<string>()): ImportDiffSection | null {
  const beforeMap = new Map(before.map((item, index) => [key(item, index), item]));
  const afterMap = new Map(after.map((item, index) => [key(item, index), item]));
  const result: ImportDiffSection = { section, label, added: 0, removed: 0, replaced: 0, excluded: 0, details: [] };
  for (const [id, item] of afterMap) {
    const previous = beforeMap.get(id);
    if (previous === undefined) { result.added++; result.details.push(`Added: ${name(item)}`); }
    else if (!same(previous, item)) { result.replaced++; result.details.push(`Updated: ${name(item)}`); }
  }
  for (const [id, item] of beforeMap) {
    if (afterMap.has(id)) continue;
    if (excludedKeys.has(id)) { result.excluded++; result.details.push(`Explicitly excluded: ${name(item)}`); }
    else { result.removed++; result.details.push(`Removed: ${name(item)}`); }
  }
  if (!result.added && !result.removed && !result.replaced && !result.excluded && !same(before, after)) {
    result.replaced++; result.details.push("Order changed");
  }
  return result.added || result.removed || result.replaced || result.excluded ? result : null;
}

function explicitExclusions(raw: Record<string, unknown>, keys: string[]): Set<string> {
  const cv = raw.cvContent && typeof raw.cvContent === "object" ? raw.cvContent as Record<string, unknown> : raw;
  const ids = new Set<string>();
  for (const key of keys) {
    const list = cv[key] ?? raw[key];
    if (Array.isArray(list)) for (const item of list) if (item && typeof item === "object" && (item as { include?: unknown }).include === false && typeof (item as { id?: unknown }).id === "string") ids.add((item as { id: string }).id);
  }
  return ids;
}

/** Section-level comparison of the current draft and the normalized import. */
export function diffImport(base: Application, candidate: Application, raw: Record<string, unknown> = {}): ImportDiffSection[] {
  const sections: (ImportDiffSection | null)[] = [
    fieldDiff("identity", "Company, Role & Language", base as unknown as Record<string, unknown>, candidate as unknown as Record<string, unknown>, ["company", "roleTitle", "language", "jobLocation", "workModel"]),
    fieldDiff("header", "CV Header", base.cvContent.header, candidate.cvContent.header),
    same(base.cvContent.professionalProfile, candidate.cvContent.professionalProfile) ? null : { section: "profile", label: "Professional Profile", added: 0, removed: 0, replaced: 1, excluded: 0, details: [`"${short(base.cvContent.professionalProfile)}" -> "${short(candidate.cvContent.professionalProfile)}"`] },
    listDiff("achievements", "Key Achievements", base.cvContent.keyAchievements, candidate.cvContent.keyAchievements, (item) => item, short),
    listDiff("skills", "Core Skills", base.cvContent.coreSkills, candidate.cvContent.coreSkills, (item) => item.group, (item) => item.group),
    same(base.cvContent.specializedCompetencies ?? [], candidate.cvContent.specializedCompetencies ?? []) ? null : { section: "skills", label: "Applied Methodologies", added: 0, removed: 0, replaced: 1, excluded: 0, details: [`${(base.cvContent.specializedCompetencies ?? []).length} -> ${(candidate.cvContent.specializedCompetencies ?? []).length} items`] },
    listDiff("experience", "Experience", base.cvContent.experience, candidate.cvContent.experience, (item) => item.id, (item) => `${item.jobTitle} · ${item.company}`, explicitExclusions(raw, ["experience", "professionalExperience"])),
    listDiff("projects", "Projects", base.cvContent.projects, candidate.cvContent.projects, (item) => item.id, (item) => item.title, explicitExclusions(raw, ["projects", "selectedProjects"])),
    listDiff("education", "Education", base.cvContent.education, candidate.cvContent.education, (item) => item.id, (item) => `${item.degree} · ${item.institution}`),
    listDiff("certifications", "Certifications", base.cvContent.certifications, candidate.cvContent.certifications, (item) => item.id, (item) => item.name),
    fieldDiff("letter", "Cover Letter", base.coverLetterContent as unknown as Record<string, unknown>, candidate.coverLetterContent as unknown as Record<string, unknown>),
    fieldDiff("answers", "Portal Form Answers", base.formFieldAnswers as unknown as Record<string, unknown>, candidate.formFieldAnswers as unknown as Record<string, unknown>),
    fieldDiff("strategy", "Strategy & Fit Assessment", base as unknown as Record<string, unknown>, candidate as unknown as Record<string, unknown>, ["roleClassification", "fitAssessment", "salaryPositioning", "keywordStrategy", "keywordPlacementPlan", "recruiterConcernHandling", "qualityControl", "outreachMessages", "portalQuestionAnswers", "interviewPrep"]),
    fieldDiff("offer", "Job Offer & Analysis", base as unknown as Record<string, unknown>, candidate as unknown as Record<string, unknown>, ["jobDescription", "jobAnalysis", "promptContext"]),
    fieldDiff("design", "Design & Assets", base as unknown as Record<string, unknown>, candidate as unknown as Record<string, unknown>, ["templateSettings", "assetSettings"]),
  ];
  const adjustments = candidate.importMetadata?.changes ?? [];
  const warnings = candidate.importMetadata?.warnings ?? [];
  if (adjustments.length || warnings.length) {
    sections.push({ section: "normalizer", label: "Normalizer Adjustments", added: 0, removed: 0, replaced: adjustments.length, excluded: 0, details: [...adjustments.map((change) => `${change.field}: "${short(change.before)}" -> "${short(change.after)}"`), ...warnings] });
  }
  return sections.filter((section): section is ImportDiffSection => section !== null);
}

export interface ImportPreview {
  validation: ImportValidation;
  candidate?: Application;
  diff: ImportDiffSection[];
}

/** Normalizes a copy of the draft; returns errors instead of throwing. */
export function previewImport(text: string, base: Application, augment?: (data: Record<string, unknown>) => Record<string, unknown>): ImportPreview {
  const validation = validateImportText(text);
  if (!validation.ok || !validation.data) return { validation, diff: [] };
  try {
    const input = augment ? augment(validation.data) : validation.data;
    const candidate = normalizeImportedAIJson(input, structuredClone(base), validation.cleanedText);
    const diff = diffImport(base, candidate, validation.data);
    if (!diff.some((section) => section.section !== "normalizer")) validation.warnings.push("This JSON produces no recognizable changes to the current draft.");
    return { validation, candidate, diff };
  } catch (error) {
    return { validation: { ...validation, ok: false, errors: [...validation.errors, `The normalized result is not a valid application: ${error instanceof Error ? error.message : String(error)}`] }, diff: [] };
  }
}
