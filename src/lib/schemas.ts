import { z } from "zod";

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

// Experience Bullet / Entry schema
export const ExperienceEntrySchema = z.object({
  id: z.string(),
  jobTitle: z.string(),
  company: z.string(),
  location: z.string(),
  dates: z.string(),
  summary: z.string().optional(),
  bullets: z.array(z.string()),
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
});

export type CertificationEntry = z.infer<typeof CertificationEntrySchema>;

// Skill group schema
export const SkillGroupSchema = z.object({
  group: z.string(),
  skills: z.array(z.string()),
});

export type SkillGroup = z.infer<typeof SkillGroupSchema>;

// Master CV Model schema
export const MasterCvSchema = z.object({
  fullName: z.string(),
  location: z.string(),
  email: z.string(),
  phone: z.string(),
  links: z.array(LinkSchema).default([]),
  availability: z.string(),
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
  signatureName: z.string().default("Candidate Name"),
  sidebarLabel: z.string().default("COVER LETTER"),
  sidebarRole: z.string().optional(),
  sidebarCompany: z.string().optional(),
});

export type CoverLetter = z.infer<typeof CoverLetterSchema>;

// Asset settings schema
export const AssetSettingsSchema = z.object({
  signature: z.object({
    enabled: z.boolean().default(false),
    filePath: z.string().optional(),
    widthPx: z.number().default(160),
    alignment: z.enum(["left", "center", "right"]).default("left"),
  }).default({ enabled: false, widthPx: 160, alignment: "left" }),
  photo: z.object({
    enabled: z.boolean().default(false),
    filePath: z.string().optional(),
    cropStyle: z.enum(["circle", "rounded-square", "portrait-rectangle"]).default("circle"),
    placement: z.enum(["sidebar", "header-right"]).default("sidebar"),
  }).default({ enabled: false, cropStyle: "circle", placement: "sidebar" }),
});

export type AssetSettings = z.infer<typeof AssetSettingsSchema>;

// Template settings schema
export const TemplateSettingsSchema = z.object({
  cvTemplate: z.enum(["ats-clean", "modern-professional"]).default("ats-clean"),
  coverLetterTemplate: z.enum(["ats-letter", "asr-sidebar"]).default("asr-sidebar"),
  accentColor: z.string().default("#10233f"),
  fontFamily: z.string().default("Inter"),
  pageSize: z.string().default("A4"),
  fontSize: z.number().default(10),
  lineSpacing: z.number().default(1.3),
  sectionSpacing: z.number().default(12),
  showKeyAchievements: z.boolean().optional().default(true),
  showProjects: z.boolean().optional().default(true),
});

export type TemplateSettings = z.infer<typeof TemplateSettingsSchema>;

// Helpers to normalize flexible AI enum strings safely
const normalizePriorityEnum = (val: unknown) => {
  const s = String(val || "").toLowerCase().trim();
  if (s.includes("strategic") || s.includes("veryhigh") || s.includes("very high") || s.includes("very_high")) return "strategic";
  if (s.includes("high")) return "high";
  if (s.includes("low")) return "low";
  return "medium";
};

const normalizeRiskEnum = (val: unknown) => {
  const s = String(val || "").toLowerCase().trim();
  if (s === "low-medium" || s === "medium") return "Medium";
  if (s.includes("high")) return "High";
  return "Low";
};

// Enriched AI Candidatura sub-schemas
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
  availability: z.string().default("Available immediately"),
  degreeExplanation: z.string().default(""),
  workPermitGermany: z.string().default("Yes"),
  website: z.string().default(""),
  linkedin: z.string().default(""),
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

export const ImportMetadataSchema = z.object({
  timestamp: z.string(),
  source: z.string().optional().default(""),
  rawImportedAIJson: z.string().optional(),
});

export type ImportMetadata = z.infer<typeof ImportMetadataSchema>;

// Single Application version schema
export const ApplicationSchema = z.object({
  id: z.string(),
  company: z.string(),
  roleTitle: z.string(),
  dateCreated: z.string(),
  dateModified: z.string(),
  status: z.enum(["draft", "applied", "interviewing", "offered", "rejected", "archived", "reviewed", "exported"]).default("draft"),
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
  }),
  coverLetterContent: CoverLetterSchema,
  templateSettings: TemplateSettingsSchema,
  assetSettings: AssetSettingsSchema,
  notes: z.string().optional().default(""),
  interviewDate: z.string().optional().default(""),
  recruiterContact: z.string().optional().default(""),
  salaryOffer: z.string().optional().default(""),
  jobDescription: z.string().optional().default(""),
  
  // Enriched AI Candidatura Schema extensions
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
    availability: "Available immediately",
    degreeExplanation: "",
    workPermitGermany: "Yes",
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
});

export type Application = z.infer<typeof ApplicationSchema>;
