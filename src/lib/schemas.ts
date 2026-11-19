import { z } from "zod";
import { ApplicationCrmSchema, CrmStatusSchema } from "./crmSchemas";
import { DOCUMENT_SETTING_LIMITS as LIMITS } from "./documentSettingLimits";
import { normalizePriority as normalizePriorityEnum, normalizeRisk as normalizeRiskEnum } from "./applicationEnums";

// Language schema
export const LanguageSchema = z.object({
  language: z.string(),
  level: z.string(),
});

export type Language = z.infer<typeof LanguageSchema>;

// Link schema
export const LinkSchema = z.object({
  label: z.string(),
  url: z.string(),
});

export type Link = z.infer<typeof LinkSchema>;

// Profile Header schema
export const HeaderSchema = z.object({
  fullName: z.string(),
  headline: z.string(),
  location: z.string(),
  email: z.string(),
  phone: z.string(),
  links: z.array(LinkSchema).default([]),
  availability: z.string(),
  languages: z.array(LanguageSchema).default([]),
});

export type Header = z.infer<typeof HeaderSchema>;

// Structured Experience Pillar (deep duty catalog used by the AI prompt dossier)
export const ExperiencePillarSchema = z.object({
  id: z.string(),
  title: z.string(),
  duties: z.array(z.string()).default([]),
  keywords: z.array(z.string()).optional(),
});

export type ExperiencePillar = z.infer<typeof ExperiencePillarSchema>;

// Experience Bullet / Entry schema
export const ExperienceEntrySchema = z.object({
  id: z.string(),
  jobTitle: z.string(),
  company: z.string(),
  location: z.string(),
  dates: z.string(),
  summary: z.string().optional(),
  bullets: z.array(z.string()),
  pillars: z.array(ExperiencePillarSchema).optional(),
  roleFamilies: z.array(z.string()).optional(),
  keywords: z.array(z.string()).optional(),
  include: z.boolean().optional(),
});

export type ExperienceEntry = z.infer<typeof ExperienceEntrySchema>;

// Project entry
export const ProjectEntrySchema = z.object({
  id: z.string(),
  title: z.string(),
  role: z.string(),
  dates: z.string(),
  description: z.string(),
  bullets: z.array(z.string()).default([]),
  url: z.string().optional(),
  repoUrl: z.string().optional(),
  demoUrl: z.string().optional(),
  techStack: z.array(z.string()).optional(),
  include: z.boolean().optional(),
});

export type ProjectEntry = z.infer<typeof ProjectEntrySchema>;

// Education entry
export const EducationEntrySchema = z.object({
  id: z.string(),
  degree: z.string(),
  institution: z.string(),
  period: z.string(),
  description: z.string().optional(),
});

export type EducationEntry = z.infer<typeof EducationEntrySchema>;

// Certification entry
export const CertificationEntrySchema = z.object({
  id: z.string(),
  name: z.string(),
  authority: z.string().optional(),
  date: z.string().optional(),
  credentialId: z.string().optional(),
  expiryDate: z.string().optional(),
});

export type CertificationEntry = z.infer<typeof CertificationEntrySchema>;

export const StructuredStarStorySchema = z.object({
  title: z.string().default(""),
  situation: z.string().default(""),
  task: z.string().default(""),
  action: z.string().default(""),
  result: z.string().default(""),
  sourceId: z.string().optional(),
  keywords: z.array(z.string()).optional(),
});

export const InterviewPrepSchema = z.object({
  careerArcSummary: z.string().optional(),
  questionsToAsk: z.array(z.string()).optional(),
  callSurvivalNotes: z.array(z.string()).optional(),
  starStories: z.array(StructuredStarStorySchema).optional(),
});

export type InterviewPrep = z.infer<typeof InterviewPrepSchema>;

// Skill group schema
export const SkillGroupSchema = z.object({
  group: z.string(),
  skills: z.array(z.string()),
});

export type SkillGroup = z.infer<typeof SkillGroupSchema>;

// Master CV Model schema
export const MasterCvSchema = z.object({
  revision: z.number().int().nonnegative().optional(),
  fullName: z.string(),
  location: z.string(),
  email: z.string(),
  phone: z.string(),
  links: z.array(LinkSchema).default([]),
  availability: z.string(),
  /** Confirmed work authorization statement (e.g., "UK citizen — unrestricted right to work"). Empty means unknown. */
  workAuthorization: z.string().optional(),
  /** Legacy v1.0 alias kept for backwards compatibility; prefer workAuthorization. */
  workPermitGermany: z.string().optional(),
  workModes: z.array(z.string()).default([]),
  languages: z.array(LanguageSchema).default([]),
  headlineVariants: z.array(z.object({
    category: z.string(),
    headline: z.string(),
  })).default([]),
  profileVariants: z.array(z.object({
    category: z.string(),
    text: z.string(),
  })).default([]),
  achievementsPool: z.array(z.string()).default([]),
  skillsPool: z.array(SkillGroupSchema).default([]),
  experienceHistory: z.array(ExperienceEntrySchema).default([]),
  projectsHistory: z.array(ProjectEntrySchema).default([]),
  educationHistory: z.array(EducationEntrySchema).default([]),
  certificationsHistory: z.array(CertificationEntrySchema).default([]),
  specializedCompetencies: z.array(z.string()).default([]),
  interviewPrep: InterviewPrepSchema.optional(),
});

export type MasterCv = z.infer<typeof MasterCvSchema>;

// Cover Letter Paragraph schema
export const CoverLetterParagraphSchema = z.object({
  type: z.enum(["opening", "evidence", "fit", "contribution", "closing"]),
  text: z.string(),
});

export type CoverLetterParagraph = z.infer<typeof CoverLetterParagraphSchema>;

// Cover Letter Model schema
export const CoverLetterSchema = z.object({
  company: z.string(),
  roleTitle: z.string(),
  subjectLine: z.string().optional(),
  positioningLine: z.string(),
  dateLine: z.string(),
  greeting: z.string(),
  paragraphs: z.array(CoverLetterParagraphSchema),
  closingPhrase: z.string().default("Kind regards,"),
  signatureName: z.string().default(""),
  sidebarLabel: z.string().default("COVER LETTER"),
  sidebarRole: z.string().optional(),
  sidebarCompany: z.string().optional(),
});

export type CoverLetter = z.infer<typeof CoverLetterSchema>;

// Asset settings schema
export const AssetSettingsSchema = z.object({
  signature: z.object({
    enabled: z.boolean().default(false),
    filePath: z.string().optional(), // Public local path
    widthPx: z.number().min(LIMITS.signatureWidthPx[0]).max(LIMITS.signatureWidthPx[1]).default(160),
    alignment: z.enum(["left", "center", "right"]).default("left"),
  }).default({ enabled: false, widthPx: 160, alignment: "left" }),
  photo: z.object({
    enabled: z.boolean().default(false),
    filePath: z.string().optional(), // Public local path
    cropStyle: z.enum(["circle", "rounded-square", "portrait-rectangle"]).default("portrait-rectangle"),
    placement: z.enum(["sidebar", "header-right", "header-left", "header-center"]).default("header-right"),
    widthPx: z.number().min(LIMITS.photoWidthPx[0]).max(LIMITS.photoWidthPx[1]).optional(),
  }).default({ enabled: false, cropStyle: "portrait-rectangle", placement: "header-right" }),
  referenceDocIds: z.array(z.string()).optional(),
});

export type AssetSettings = z.infer<typeof AssetSettingsSchema>;

// Normalize legacy v1.0 template IDs cleanly
function normalizeCoverLetterTemplate(value: unknown): unknown {
  if (value === "asr-sidebar") return "editorial-sidebar";
  return value;
}

// Template settings schema
export const TemplateSettingsSchema = z.object({
  cvTemplate: z.enum(["ats-clean", "modern-professional", "dach-tabular"]).default("ats-clean"),
  coverLetterTemplate: z.preprocess(
    normalizeCoverLetterTemplate,
    z.enum(["ats-letter", "editorial-sidebar", "din-editorial"])
  ).default("ats-letter"),
  accentColor: z.string().default("#10233f"),
  fontFamily: z.string().default("IBM Plex Sans"),
  pageSize: z.string().default("A4"),
  // Documentary limits (wider than the sliders) keep old valid values and reject absurd ones.
  fontSize: z.number().min(LIMITS.fontSize[0]).max(LIMITS.fontSize[1]).default(10),       // Font size in pt (e.g. 9.4 to 11)
  lineSpacing: z.number().min(LIMITS.lineSpacing[0]).max(LIMITS.lineSpacing[1]).default(1.42), // Breathable line height (e.g. 1.35 to 1.65)
  sectionSpacing: z.number().min(LIMITS.sectionSpacing[0]).max(LIMITS.sectionSpacing[1]).default(14), // Margin bottom in px (e.g. 10 to 24)
  letterFontSize: z.number().min(LIMITS.letterFontSize[0]).max(LIMITS.letterFontSize[1]).optional(),
  letterLineSpacing: z.number().min(LIMITS.letterLineSpacing[0]).max(LIMITS.letterLineSpacing[1]).optional(),
  letterParagraphSpacing: z.number().min(LIMITS.letterParagraphSpacing[0]).max(LIMITS.letterParagraphSpacing[1]).optional(),
  showKeyAchievements: z.boolean().optional().default(true),
  showProjects: z.boolean().optional().default(true),
  showSpecializedCompetencies: z.boolean().optional(),
  packetOrder: z.enum(["dach", "ats"]).optional(),
});

export type TemplateSettings = z.infer<typeof TemplateSettingsSchema>;


// Enriched AI Application sub-schemas
export const RoleClassificationSchema = z.object({
  type: z.enum(["coreTarget", "bridgeRole", "stretchRole", "stabilityRole", "alternativeRole"]).catch("coreTarget"),
  seniorityLevel: z.enum(["entry", "junior", "mid", "mid-senior", "senior", "lead", "executive", "unclear"]).catch("mid"),
  roleFamily: z.string().default(""),
  applicationPriority: z.preprocess(normalizePriorityEnum, z.enum(["low", "medium", "high", "strategic"])).default("medium"),
  outputMode: z.enum(["fast", "standard", "premium"]).catch("standard"),
  recommendedPositioning: z.string().default(""),
  cvIntensity: z.enum(["Light", "Medium", "Strong", "Technical-Dense"]).catch("Medium"),
  overqualificationRisk: z.preprocess(normalizeRiskEnum, z.enum(["Low", "Medium", "High"])).default("Low"),
  dealBreakerRisk: z.preprocess(normalizeRiskEnum, z.enum(["Low", "Medium", "High"])).default("Low"),
});

export type RoleClassification = z.infer<typeof RoleClassificationSchema>;

export const FormFieldAnswersSchema = z.object({
  shortMotivationMessage: z.string().default(""),
  whyThisRole: z.string().default(""),
  whyThisCompany: z.string().default(""),
  additionalMessage: z.string().default(""),
  // Unknown stays empty: no availability, authorization, or personal link is implied by a default.
  availability: z.string().default(""),
  degreeExplanation: z.string().default(""),
  workAuthorization: z.string().default(""),
  /** Legacy v1.0 alias kept for backwards compatibility; prefer workAuthorization. */
  workPermitGermany: z.string().default(""),
  website: z.string().default(""),
  linkedin: z.string().default(""),
  github: z.string().optional(),
  salaryExpectation: z.string().optional(),
  startDateIso: z.string().optional(),
  noticePeriod: z.string().optional(),
  requiresSponsorship: z.string().optional(),
});

export type FormFieldAnswers = z.infer<typeof FormFieldAnswersSchema>;

export const SalaryPositioningSchema = z.object({
  recommendedRangeEUR: z.string().default(""),
  safeNumberEUR: z.string().default(""),
  ambitiousNumberEUR: z.string().default(""),
  riskComment: z.string().default(""),
});

export type SalaryPositioning = z.infer<typeof SalaryPositioningSchema>;

export const KeywordStrategySchema = z.object({
  mustIncludeATSKeywords: z.array(z.string()).default([]),
  niceToHaveKeywords: z.array(z.string()).default([]),
  humanNarrativeKeywords: z.array(z.string()).default([]),
  avoidOrMinimizeKeywords: z.array(z.string()).default([]),
});

export type KeywordStrategy = z.infer<typeof KeywordStrategySchema>;

export const RecruiterConcernSchema = z.object({
  concern: z.string().default(""),
  howToNeutralize: z.string().default(""),
  sentenceToUse: z.string().default(""),
});

export type RecruiterConcern = z.infer<typeof RecruiterConcernSchema>;

export const RecruiterConcernHandlingSchema = z.object({
  likelyConcerns: z.array(RecruiterConcernSchema).default([]),
});

export type RecruiterConcernHandling = z.infer<typeof RecruiterConcernHandlingSchema>;

export const FitAssessmentSchema = z.object({
  scoreOutOf10: z.number().min(0).max(10).nullable().default(null),
  probabilityTier: z.enum(["Very Low", "Low", "Medium-Low", "Medium", "Medium-High", "High"]).catch("Medium"),
  summary: z.string().default(""),
  bestAngles: z.array(z.string()).default([]),
  mainRisks: z.array(z.string()).default([]),
  recommendedApplicationStrategy: z.string().default(""),
  recommendedTone: z.string().default(""),
  recommendedCVVersion: z.string().default(""),
  applyOrSkip: z.enum(["Apply", "Apply selectively", "Skip"]).catch("Apply selectively"),
});

export type FitAssessment = z.infer<typeof FitAssessmentSchema>;

export const QualityControlSchema = z.object({
  directEvidenceUsed: z.array(z.string()).default([]),
  transferableEvidenceUsed: z.array(z.string()).default([]),
  adaptableSkillsUsed: z.array(z.string()).default([]),
  potentialOverclaimsAvoided: z.array(z.string()).default([]),
  atsKeywordsIncluded: z.array(z.string()).default([]),
  humanRecruiterImpression: z.string().default(""),
  finalContentRisk: z.preprocess(normalizeRiskEnum, z.enum(["Low", "Medium", "High"])).default("Low"),
  oneSentencePositioning: z.string().default(""),
});

export type QualityControl = z.infer<typeof QualityControlSchema>;

// Optional evidence map. Legacy applications remain valid without these fields.
export const RequirementEvidenceSchema = z.object({
  sourceId: z.string(),
  quote: z.string(),
  relevance: z.string().default(""),
  scope: z.enum(["led", "implemented", "contributed", "trained", "personal_project", "unknown"]).default("unknown"),
});

export const JobRequirementSchema = z.object({
  id: z.string(),
  requirement: z.string(),
  sourceQuote: z.string(),
  priority: z.enum(["must_have", "important", "nice_to_have"]).default("important"),
  category: z.enum(["skill", "responsibility", "language", "qualification", "logistics"]).default("responsibility"),
  keywords: z.array(z.string()).default([]),
  evidence: z.array(RequirementEvidenceSchema).default([]),
  evidenceLevel: z.enum(["direct", "transferable", "gap", "unknown"]).default("unknown"),
  targetSections: z.array(z.enum(["profile", "achievements", "skills", "experience", "projects", "education", "letter"])).default([]),
});

export const JobAnalysisSchema = z.object({
  roleMission: z.string().default(""),
  positioningThesis: z.string().default(""),
  employerPriorities: z.array(z.string()).default([]),
  companyFacts: z.array(z.string()).default([]),
  applicationInstructions: z.array(z.string()).default([]),
  requirements: z.array(JobRequirementSchema).default([]),
  eligibility: z.object({
    status: z.enum(["meets", "uncertain", "gaps"]).default("uncertain"),
    unmetRequirements: z.array(z.string()).default([]),
    notes: z.string().default(""),
  }).default({ status: "uncertain", unmetRequirements: [], notes: "" }),
  jobDescriptionFingerprint: z.string().optional(),
});

export type JobAnalysis = z.infer<typeof JobAnalysisSchema>;
export type JobRequirement = z.infer<typeof JobRequirementSchema>;

export const STRATEGY_ANGLES = [
  "auto",
  "technical_execution",
  "strategy_leadership",
  "operations_delivery",
  "client_stakeholder",
  "governance_compliance",
] as const;

export const TONE_PRESETS = [
  "auto",
  "startup_modern",
  "enterprise_formal",
  "technical_direct",
] as const;

export const PromptContextSchema = z.object({
  version: z.string(),
  generatedAt: z.string(),
  masterRevision: z.number().int().nonnegative().optional(),
  jobDescriptionFingerprint: z.string().optional(),
  options: z.object({
    searchTrack: z.string().max(80).optional(),
    targetLanguage: z.enum(["auto", "English", "German", "Spanish"]),
    promptMode: z.enum(["triage_only", "full_application", "outreach_only", "interview_prep"]).optional(),
    addressingMode: z.enum(["auto", "sie", "du"]).optional(),
    strategyAngle: z.enum(STRATEGY_ANGLES).catch("auto"),
    tonePreset: z.enum(TONE_PRESETS).catch("auto").default("auto"),
    cvLengthMode: z.enum(["auto_clean", "ultra_compact_1p", "comprehensive_2p"]).default("auto_clean"),
    emphasisHighlights: z.array(z.string()).default([]),
    customInstructions: z.string().optional(),
    companyHint: z.string().optional(),
    roleTitleHint: z.string().optional(),
    jobPostingUrl: z.string().max(2000).optional(),
    jobPostingId: z.string().max(200).optional(),
    applicationDeadline: z.string().max(40).optional(),
    salaryExpectationHint: z.string().max(200).optional(),
    includeInterviewPrep: z.boolean().optional(),
  }),
});

export type PromptContext = z.infer<typeof PromptContextSchema>;

export const ImportMetadataSchema = z.object({
  runId: z.string().optional(),
  timestamp: z.string(),
  source: z.string().optional().default(""),
  rawImportedAIJson: z.string().optional(),
  warnings: z.array(z.string()).optional(),
  changes: z.array(z.object({ field: z.string(), before: z.string(), after: z.string() })).optional(),
});

export type ImportMetadata = z.infer<typeof ImportMetadataSchema>;

// Single Application version schema
export const ApplicationSchema = z.object({
  crm: ApplicationCrmSchema.optional(),
  searchTrack: z.string().max(80).optional(),
  revision: z.number().int().nonnegative().optional(),
  id: z.string(),
  company: z.string(),
  roleTitle: z.string(),
  dateCreated: z.string(),
  dateModified: z.string(),
  status: CrmStatusSchema.default("draft"),
  language: z.enum(["English", "Spanish", "German"]).default("English"),
  cvContent: z.object({
    header: HeaderSchema,
    professionalProfile: z.string(),
    keyAchievements: z.array(z.string()),
    coreSkills: z.array(SkillGroupSchema),
    experience: z.array(ExperienceEntrySchema),
    projects: z.array(ProjectEntrySchema).default([]),
    education: z.array(EducationEntrySchema).default([]),
    certifications: z.array(CertificationEntrySchema).default([]),
    specializedCompetencies: z.array(z.string()).optional(),
  }),
  coverLetterContent: CoverLetterSchema,
  templateSettings: TemplateSettingsSchema,
  assetSettings: AssetSettingsSchema,
  notes: z.string().optional().default(""),
  interviewDate: z.string().optional().default(""),
  recruiterContact: z.string().optional().default(""),
  salaryOffer: z.string().optional().default(""),
  jobDescription: z.string().optional().default(""),
  /** Offer identity, only when known (never inferred or scraped). Old records stay valid without them. */
  jobPostingUrl: z.string().max(2000).optional(),
  jobPostingId: z.string().max(200).optional(),
  applicationDeadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  jobAnalysis: JobAnalysisSchema.nullable().optional(),
  promptContext: PromptContextSchema.nullable().optional(),

  // Enriched AI Application Schema extensions
  schemaVersion: z.number().default(2),
  importMetadata: ImportMetadataSchema.nullable().optional().default(null),
  jobLocation: z.string().optional().default(""),
  workModel: z.string().optional().default(""),
  roleClassification: RoleClassificationSchema.default({
    type: "coreTarget",
    seniorityLevel: "mid",
    roleFamily: "",
    applicationPriority: "medium",
    outputMode: "standard",
    recommendedPositioning: "",
    cvIntensity: "Medium",
    overqualificationRisk: "Low",
    dealBreakerRisk: "Low"
  }),
  formFieldAnswers: FormFieldAnswersSchema.default({
    shortMotivationMessage: "",
    whyThisRole: "",
    whyThisCompany: "",
    additionalMessage: "",
    availability: "",
    degreeExplanation: "",
    workAuthorization: "",
    workPermitGermany: "",
    website: "",
    linkedin: ""
  }),
  salaryPositioning: SalaryPositioningSchema.default({
    recommendedRangeEUR: "",
    safeNumberEUR: "",
    ambitiousNumberEUR: "",
    riskComment: ""
  }),
  keywordStrategy: KeywordStrategySchema.default({
    mustIncludeATSKeywords: [],
    niceToHaveKeywords: [],
    humanNarrativeKeywords: [],
    avoidOrMinimizeKeywords: []
  }),
  recruiterConcernHandling: RecruiterConcernHandlingSchema.default({
    likelyConcerns: []
  }),
  fitAssessment: FitAssessmentSchema.default({
    scoreOutOf10: null,
    probabilityTier: "Medium",
    summary: "",
    bestAngles: [],
    mainRisks: [],
    recommendedApplicationStrategy: "",
    recommendedTone: "",
    recommendedCVVersion: "",
    applyOrSkip: "Apply selectively"
  }),
  qualityControl: QualityControlSchema.default({
    directEvidenceUsed: [],
    transferableEvidenceUsed: [],
    adaptableSkillsUsed: [],
    potentialOverclaimsAvoided: [],
    atsKeywordsIncluded: [],
    humanRecruiterImpression: "",
    finalContentRisk: "Low",
    oneSentencePositioning: ""
  }),
  outreachMessages: z.object({
    linkedInConnectionNote: z.string().optional(),
    recruiterDirectMessage: z.string().optional(),
    hiringManagerNote: z.string().optional(),
    followUpMessage: z.string().optional(),
  }).optional(),
  portalQuestionAnswers: z.array(z.object({
    question: z.string(),
    answer: z.string(),
  })).optional(),
  keywordPlacementPlan: z.array(z.object({
    keyword: z.string(),
    priority: z.string().optional(),
    targetSection: z.string().optional(),
    exactSurfaceForm: z.string().optional(),
  })).optional(),
  interviewPrep: InterviewPrepSchema.optional(),
});

export type Application = z.infer<typeof ApplicationSchema>;

export interface ApplicationSummary {
  crmSummary?: {
    priority?: "normal" | "high" | "paused";
    preparationReviewed: boolean;
    hasOffer: boolean;
    eligibility?: "meets" | "uncertain" | "gaps";
    sentOn?: string;
  };
  searchTrack?: string;
  revision?: number;
  id: string;
  company: string;
  roleTitle: string;
  dateCreated: string;
  dateModified: string;
  status: Application["status"];
  language: Application["language"];
  notes?: string;
  interviewDate?: string;
  recruiterContact?: string;
  salaryOffer?: string;
  jobLocation?: string;
  workModel?: string;
  jobPostingUrl?: string;
  jobPostingId?: string;
  applicationDeadline?: string;
  jobDescriptionFingerprint?: string;
  roleClassification?: Application["roleClassification"];
  fitAssessment?: Application["fitAssessment"];
  salaryPositioning?: Application["salaryPositioning"];
  cvTemplate?: Application["templateSettings"]["cvTemplate"];
}

/**
 * Projects a full Application object to a lightweight CRM summary item for Dashboard listing and status patches.
 */
export function toApplicationSummary(app: Application): ApplicationSummary {
  return {
    crmSummary: {
      priority: app.crm?.priority,
      preparationReviewed: app.crm?.preparation?.reviewed === true,
      hasOffer: Boolean(app.jobDescription?.trim()),
      eligibility: app.jobAnalysis?.eligibility.status,
      sentOn: app.crm?.events.find(event => event.type === "application_sent" && !event.voidedAt)?.occurredOn,
    },
    ...(app.searchTrack ? { searchTrack: app.searchTrack } : {}),
    revision: app.revision ?? 0,
    id: app.id,
    company: app.company,
    roleTitle: app.roleTitle,
    dateCreated: app.dateCreated,
    dateModified: app.dateModified,
    status: app.status,
    language: app.language,
    notes: app.notes,
    interviewDate: app.interviewDate,
    recruiterContact: app.recruiterContact,
    salaryOffer: app.salaryOffer,
    jobLocation: app.jobLocation,
    workModel: app.workModel,
    ...(app.jobPostingUrl ? { jobPostingUrl: app.jobPostingUrl } : {}),
    ...(app.jobPostingId ? { jobPostingId: app.jobPostingId } : {}),
    ...(app.applicationDeadline ? { applicationDeadline: app.applicationDeadline } : {}),
    ...(app.jobDescription?.trim() ? { jobDescriptionFingerprint: offerFingerprint(app.jobDescription) } : {}),
    roleClassification: app.roleClassification,
    fitAssessment: app.fitAssessment,
    salaryPositioning: app.salaryPositioning,
    ...(app.templateSettings?.cvTemplate ? { cvTemplate: app.templateSettings.cvTemplate } : {}),
  };
}

/** Same FNV-1a change detector as generationContext.fingerprintText (kept here to avoid an import cycle). */
function offerFingerprint(text: string): string {
  let hash = 2166136261;
  for (const character of text.replace(/\r\n/g, "\n").trim()) {
    hash ^= character.codePointAt(0) || 0;
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}
