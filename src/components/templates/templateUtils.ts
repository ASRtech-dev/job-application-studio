import { type Application, type ProjectEntry, type SkillGroup } from "@/lib/schemas";
import { type DocLang, localizeDateRange, localizeLocation, localizeCertificationName, localizeWorkAuthorization } from "@/lib/localization";

// -------------------------------------------------------------
// LOCALIZATION DICTIONARY (EN / DE / ES) FOR GENERATED DOCUMENTS
// -------------------------------------------------------------

export const SECTION_LABELS: Record<
  DocLang,
  {
    profile: string;
    achievements: string;
    skills: string;
    specializedCompetencies: string;
    experience: string;
    projects: string;
    education: string;
    certifications: string;
    languages: string;
    availability: string;
    promoted: string;
    attachments: string;
  }
> = {
  English: {
    profile: "Professional Profile",
    achievements: "Key Achievements",
    skills: "Core Skills",
    specializedCompetencies: "Applied Methodologies & Domain Scope",
    experience: "Professional Experience",
    projects: "Selected Projects",
    education: "Education",
    certifications: "Certifications",
    languages: "Languages",
    availability: "Availability",
    promoted: "↑ Internal Promotion",
    attachments: "Enclosures: CV & Supporting Documents",
  },
  German: {
    profile: "Berufsprofil",
    achievements: "Wichtigste Erfolge",
    skills: "Kernkompetenzen",
    specializedCompetencies: "Angewandte Methoden & Fachkompetenzen",
    experience: "Berufserfahrung",
    projects: "Ausgewählte Projekte",
    education: "Ausbildung & Studium",
    certifications: "Zertifikate & Weiterbildungen",
    languages: "Sprachen",
    availability: "Verfügbarkeit",
    promoted: "↑ Interner Aufstieg",
    attachments: "Anlagen: Lebenslauf, Zeugnisse & Zertifikate",
  },
  Spanish: {
    profile: "Perfil Profesional",
    achievements: "Logros Clave",
    skills: "Competencias Clave",
    specializedCompetencies: "Metodologías y Competencias Aplicadas",
    experience: "Experiencia Profesional",
    projects: "Proyectos Destacados",
    education: "Educación",
    certifications: "Certificaciones",
    languages: "Idiomas",
    availability: "Disponibilidad",
    promoted: "↑ Promoción interna",
    attachments: "Adjuntos: CV, certificados y referencias",
  },
};

export function getEffectiveLanguage(data: Application): DocLang {
  if (data.language === "German" || data.language === "Spanish") {
    return data.language;
  }
  const sample = [
    data.cvContent?.professionalProfile || "",
    data.coverLetterContent?.greeting || "",
    data.coverLetterContent?.sidebarLabel || "",
  ].join(" ");
  if (/\b(und|für|mit|über|durch|Liebes|Sehr geehrte|ANSCHREIBEN)\b/i.test(sample)) {
    return "German";
  }
  if (/\b(para|con|los|las|una|Estimado|Atentamente|CARTA DE PRESENTACIÓN)\b/i.test(sample)) {
    return "Spanish";
  }
  return "English";
}

export const renderLocalizedDateRange = localizeDateRange;

export function renderLocalizedLocation(loc: string | undefined, lang: DocLang): string {
  return localizeLocation(loc, lang, { stripWorkMode: true });
}

export const renderLocalizedCertificationName = localizeCertificationName;

export function isSameCompany(compA?: string, compB?: string): boolean {
  if (!compA || !compB) return false;
  const normA = compA.toLowerCase().replace(/\bgmbh\b|\binc\.?\b|\bltd\.?\b|\bllc\b|\bplc\b/g, "").trim();
  const normB = compB.toLowerCase().replace(/\bgmbh\b|\binc\.?\b|\bltd\.?\b|\bllc\b|\bplc\b/g, "").trim();
  return Boolean(normA && normB && (normA === normB || normA.includes(normB) || normB.includes(normA)));
}

export function getLanguageMatchedValueHook(data: Application, lang: DocLang): string | null {
  const hook = data.qualityControl?.oneSentencePositioning?.trim();
  if (!hook) return null;
  // Ensure we don't render an English qualityControl summary inside a German or Spanish Cover Letter
  const looksGerman = /\b(und|für|mit|über|durch|sowie|Ein|Eine|der|die)\b/.test(hook);
  const looksSpanish = /\b(para|con|los|las|una|por|sobre|que)\b/.test(hook);
  if (lang === "German" && !looksGerman) return null;
  if (lang === "Spanish" && !looksSpanish) return null;
  if (lang === "English" && (looksGerman || looksSpanish)) return null;
  return hook;
}

// -------------------------------------------------------------
// DEFENSIVE DATA SANITIZERS FOR LEGACY / IMPORTED JSONS
// -------------------------------------------------------------
export function getCleanSkills(coreSkills: SkillGroup[] | undefined): SkillGroup[] {
  if (!coreSkills || !Array.isArray(coreSkills)) return [];
  return coreSkills
    .map((g) => ({
      group: g.group,
      skills: (g.skills || [])
        .flatMap((s) => String(s || "").split(/\s*[|;]\s*|\s+\/\s+/))
        .map((s) => s.trim())
        .filter(Boolean),
    }))
    .filter((g) => g.skills.length > 0);
}

export function getCleanProjects(projects: ProjectEntry[] | undefined): ProjectEntry[] {
  if (!projects || !Array.isArray(projects)) return [];
  return projects
    .filter((p) => Boolean(p && p.include !== false))
    .map((p) => ({
      ...p,
      dates: p.dates === "Dates" || p.dates === "Period" ? "" : p.dates,
    }));
}

export function formatProjectTitleAndRole(title: string, role?: string): { cleanTitle: string; cleanRole: string; hasParensInTitle: boolean } {
  const cleanTitle = (title || "").trim();
  const cleanRole = (role || "").trim();
  const hasParensInTitle = /\([^)]+\)\s*$/.test(cleanTitle);
  return { cleanTitle, cleanRole, hasParensInTitle };
}

/** Formats an explicit, verified work authorization statement into a compact header badge. */
export function getWorkAuthorizationBadge(workAuth: string | undefined, lang: DocLang): string {
  const localized = localizeWorkAuthorization(workAuth, lang).trim();
  if (!localized) return "";
  // Skip bare boolean-only tokens like "Yes"/"No" that carry no meaning without a form label
  if (/^(yes|no|ja|nein|sí|si)$/i.test(localized)) return "";
  return localized.length <= 72 ? localized : `${localized.slice(0, 69).trim()}...`;
}

/** Shared localized metadata resolution across all Cover Letter templates. */
export function getCoverLetterMeta(data: Application, lang: DocLang) {
  const letter = data.coverLetterContent;
  const targetRole = letter.roleTitle || data.roleTitle || "";
  const targetCompany = letter.company || data.company || "";
  const targetLocation = (data.jobLocation || "").trim();
  const recipientDept =
    lang === "German"
      ? "Personalabteilung / Recruiting Team"
      : lang === "Spanish"
      ? "Departamento de Selección / Hiring Team"
      : "Hiring Team / Talent Acquisition";

  const closingText =
    lang === "German" && letter.closingPhrase === "Kind regards,"
      ? "Mit freundlichen Grüßen"
      : lang === "Spanish" && letter.closingPhrase === "Kind regards,"
      ? "Atentamente,"
      : letter.closingPhrase || "Kind regards,";

  const computedSubject =
    letter.subjectLine && letter.subjectLine.trim()
      ? letter.subjectLine.trim()
      : lang === "German"
      ? `Bewerbung als ${targetRole}`
      : lang === "Spanish"
      ? `Candidatura al puesto de ${targetRole}`
      : `Application for ${targetRole}`;

  const rawGreeting = (letter.greeting || "")
    .replace(/\bhiring team\b/g, "Hiring Team")
    .replace(/\brecruiting team\b/g, "Recruiting Team");
  const normalizedGreeting =
    lang === "German" && /hiring\s+team|recruiting\s+team/i.test(rawGreeting)
      ? "Sehr geehrte Damen und Herren,"
      : rawGreeting;

  const valueHook = getLanguageMatchedValueHook(data, lang);
  const hasAttachments = Array.isArray(data.assetSettings?.referenceDocIds) && data.assetSettings.referenceDocIds.length > 0;

  return {
    targetRole,
    targetCompany,
    targetLocation,
    recipientDept,
    closingText,
    computedSubject,
    normalizedGreeting,
    valueHook,
    hasAttachments,
  };
}
