import {
  ApplicationSchema,
  type Application,
  type ExperienceEntry,
  type MasterCv,
  type ProjectEntry,
} from "./schemas";
import { normalizeEducationEntries } from "./ai-import/education";

export type MasterCvExportLanguage = "English" | "German" | "Spanish";

export interface MasterCvExportOptions {
  language: MasterCvExportLanguage;
  template: "ats-clean" | "modern-professional" | "dach-tabular";
  fontFamily: string;
  variantCategory: string;
  profileCategory?: string;
  includeHiddenEntries: boolean;
  includeDetailedPillars: boolean;
  includeAchievementsPool: boolean;
  includeSpecializedCompetencies: boolean;
  includeWorkPermit: boolean;
  includePhoto: boolean;
  photoPath?: string;
  photoCropStyle: "portrait-rectangle" | "circle" | "rounded-square";
  photoPlacement: "header-right" | "header-left" | "header-center" | "sidebar";
  photoWidthPx: number;
  accentColor: string;
  fontSize: number;
  lineSpacing: number;
  sectionSpacing: number;
}

export const DEFAULT_MASTER_CV_EXPORT_OPTIONS: MasterCvExportOptions = {
  language: "English",
  template: "ats-clean",
  fontFamily: "IBM Plex Sans",
  variantCategory: "",
  profileCategory: "",
  includeHiddenEntries: true,
  includeDetailedPillars: true,
  includeAchievementsPool: true,
  includeSpecializedCompetencies: true,
  includeWorkPermit: true,
  includePhoto: false,
  photoPath: undefined,
  photoCropStyle: "portrait-rectangle",
  photoPlacement: "header-right",
  photoWidthPx: 104,
  accentColor: "#10233f",
  fontSize: 10,
  lineSpacing: 1.38,
  sectionSpacing: 11,
};

function significantTokens(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9äöüßáéíóúñ+]+/gi, " ")
      .split(/\s+/)
      .filter((token) => token.length >= 4)
  );
}

function isNearDuplicate(candidate: string, existingBullets: string[]): boolean {
  const candidateTokens = significantTokens(candidate);
  if (candidateTokens.size === 0) return true;
  for (const bullet of existingBullets) {
    const bulletTokens = significantTokens(bullet);
    if (bulletTokens.size === 0) continue;
    let shared = 0;
    for (const token of candidateTokens) {
      if (bulletTokens.has(token)) shared++;
    }
    const minSize = Math.min(candidateTokens.size, bulletTokens.size);
    if (minSize > 0 && shared / minSize >= 0.65) return true;
  }
  return false;
}

function mergeExperienceWithPillars(entry: ExperienceEntry, includeDetailedPillars: boolean): ExperienceEntry {
  const combinedBullets = [...(entry.bullets || [])];
  if (includeDetailedPillars && entry.pillars?.length) {
    for (const pillar of entry.pillars) {
      for (const rawDuty of pillar.duties || []) {
        const duty = rawDuty.trim();
        if (!duty || isNearDuplicate(duty, combinedBullets)) continue;
        combinedBullets.push(duty);
      }
    }
  }
  return {
    ...entry,
    include: true,
    bullets: combinedBullets,
  };
}

function buildMasterProject(project: ProjectEntry): ProjectEntry {
  const stackLine =
    project.techStack && project.techStack.length > 0 && !project.bullets.some((b) => /\bstack\b|\btechnolog/i.test(b))
      ? `**Stack:** ${project.techStack.join(" · ")}`
      : null;
  return {
    ...project,
    include: true,
    bullets: stackLine ? [...project.bullets, stackLine] : [...project.bullets],
  };
}

export function getMasterDocumentFooterLabel(language: MasterCvExportLanguage): string {
  if (language === "German") return "Master-Lebenslauf";
  if (language === "Spanish") return "CV Maestro";
  return "Master CV";
}

function categoryTokens(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9äöüßáéíóúñ+]+/gi, " ")
      .split(/\s+/)
      .filter((token) => token.length >= 2)
  );
}

/** Matches the closest profile summary variant for a selected headline category or explicit choice. */
export function matchProfileVariant(
  masterCv: Pick<MasterCv, "profileVariants" | "headlineVariants">,
  variantCategory?: string,
  explicitProfileCategory?: string
) {
  const profiles = masterCv.profileVariants || [];
  if (!profiles.length) return undefined;
  if (explicitProfileCategory) {
    const directExplicit = profiles.find((v) => v.category === explicitProfileCategory);
    if (directExplicit) return directExplicit;
  }
  const target = (variantCategory || "").trim();
  if (target) {
    const exact = profiles.find((v) => v.category === target);
    if (exact) return exact;
    const targetTokens = categoryTokens(target);
    let bestMatch = profiles[0];
    let bestScore = 0;
    for (const candidate of profiles) {
      const candidateTokens = categoryTokens(candidate.category);
      let shared = 0;
      for (const tok of targetTokens) {
        if (candidateTokens.has(tok)) shared++;
      }
      const denom = Math.max(targetTokens.size, candidateTokens.size, 1);
      const score = shared / denom;
      if (shared > 0 && score > bestScore) {
        bestScore = score;
        bestMatch = candidate;
      }
    }
    if (bestScore > 0) return bestMatch;
  }
  return profiles[0];
}

/**
 * Converts the saved Master CV record into a full, multi-page-ready Application document
 * for portal uploads and archive exports without truncating pools, hidden roles or pillar duties.
 */
export function buildMasterCvExportApp(
  masterCv: MasterCv,
  partialOptions: Partial<MasterCvExportOptions> = {}
): Application {
  const options: MasterCvExportOptions = { ...DEFAULT_MASTER_CV_EXPORT_OPTIONS, ...partialOptions };
  const selectedHeadline =
    masterCv.headlineVariants.find((v) => v.category === options.variantCategory) ||
    masterCv.headlineVariants[0];
  const selectedProfile = matchProfileVariant(
    masterCv,
    selectedHeadline?.category || options.variantCategory,
    options.profileCategory
  );

  const experience = (masterCv.experienceHistory || [])
    .filter((entry) => options.includeHiddenEntries || entry.include !== false)
    .map((entry) => mergeExperienceWithPillars(entry, options.includeDetailedPillars));

  const projects = (masterCv.projectsHistory || [])
    .filter((proj) => options.includeHiddenEntries || proj.include !== false)
    .map(buildMasterProject);

  const photoEnabled = Boolean(options.includePhoto && options.photoPath);

  const rawApp = ApplicationSchema.parse({
    id: "master_cv_export_preview",
    company: "Master Profile",
    roleTitle: selectedHeadline?.category || "Complete Master CV",
    dateCreated: "2026-01-01T00:00:00.000Z",
    dateModified: "2026-01-01T00:00:00.000Z",
    status: "draft",
    language: options.language,
    cvContent: {
      header: {
        fullName: masterCv.fullName,
        headline: selectedHeadline?.headline || "",
        location: masterCv.location,
        email: masterCv.email,
        phone: masterCv.phone,
        links: structuredClone(masterCv.links || []),
        availability: masterCv.availability,
        languages: structuredClone(masterCv.languages || []),
      },
      professionalProfile: selectedProfile?.text || "",
      keyAchievements: options.includeAchievementsPool ? [...(masterCv.achievementsPool || [])] : [],
      coreSkills: structuredClone(masterCv.skillsPool || []),
      experience,
      projects,
      education: structuredClone(masterCv.educationHistory || []),
      certifications: structuredClone(masterCv.certificationsHistory || []),
      specializedCompetencies: options.includeSpecializedCompetencies
        ? [...(masterCv.specializedCompetencies || [])]
        : [],
    },
    coverLetterContent: {
      company: "Master Profile",
      roleTitle: selectedHeadline?.category || "Master CV",
      positioningLine: "",
      dateLine: "",
      greeting: "",
      paragraphs: [],
      signatureName: masterCv.fullName,
    },
    formFieldAnswers: {
      shortMotivationMessage: "",
      whyThisRole: "",
      whyThisCompany: "",
      additionalMessage: "",
      availability: masterCv.availability,
      degreeExplanation: "",
      workAuthorization: options.includeWorkPermit ? (masterCv.workAuthorization || masterCv.workPermitGermany || "") : "",
      workPermitGermany: options.includeWorkPermit ? (masterCv.workAuthorization || masterCv.workPermitGermany || "") : "",
      website: "",
      linkedin: "",
    },
    templateSettings: {
      cvTemplate: options.template,
      coverLetterTemplate: "ats-letter",
      accentColor: options.accentColor,
      fontFamily: options.fontFamily || "IBM Plex Sans",
      pageSize: "A4",
      fontSize: options.fontSize,
      lineSpacing: options.lineSpacing,
      sectionSpacing: options.sectionSpacing,
      showKeyAchievements: options.includeAchievementsPool && (masterCv.achievementsPool?.length || 0) > 0,
      showProjects: projects.length > 0,
      showSpecializedCompetencies:
        options.includeSpecializedCompetencies && (masterCv.specializedCompetencies?.length || 0) > 0,
    },
    assetSettings: {
      signature: { enabled: false, widthPx: 160, alignment: "left" },
      photo: {
        enabled: photoEnabled,
        filePath: options.photoPath,
        cropStyle: options.photoCropStyle,
        placement: options.photoPlacement,
        widthPx: options.photoWidthPx,
      },
    },
  });

  normalizeEducationEntries(rawApp);
  return rawApp;
}
