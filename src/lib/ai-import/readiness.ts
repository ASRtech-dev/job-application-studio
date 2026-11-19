import { type Application } from "@/lib/schemas";
import { AI_CLICHE_PATTERNS, computeTokenOverlap } from "./sanitize";
import { detectSkillAnomalies } from "./skills";
import { compareLetterAndCvFigures } from "../finalReview";
import { documentLinkText } from "../documentDesign";

function wordCount(text: string): number {
  return text.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/\*+/g, "").split(/\s+/).filter(Boolean).length;
}

/** Selected content only; section labels and layout are measured by the paginator. */
export function getVisibleCvText(app: Application): string {
  const cv = app.cvContent;
  const header = cv.header;
  const skills = cv.coreSkills.map((group) => ({
    ...group,
    skills: group.skills.flatMap((skill) => skill.split(/\s*[|;]\s*/))
      .map((skill) => skill.trim()).filter(Boolean),
  })).filter((group) => group.skills.length > 0);
  const experience = cv.experience.filter((entry) => entry.include !== false);
  const projects = app.templateSettings.showProjects === false ? [] : cv.projects.filter((entry) =>
    entry.include !== false);
  return [
    header.fullName, header.headline, header.location, header.email, header.phone, header.availability,
    ...header.links.map((link) => documentLinkText(link.url, link.label)),
    ...header.languages.map((language) => `${language.language} ${language.level}`),
    cv.professionalProfile,
    ...(app.templateSettings.showKeyAchievements === false ? [] : cv.keyAchievements),
    ...skills.flatMap((group) => [group.group, ...group.skills]),
    ...(app.templateSettings?.showSpecializedCompetencies !== false ? cv.specializedCompetencies || [] : []),
    ...experience.flatMap((entry) => [entry.jobTitle, entry.company, entry.location, entry.dates, entry.summary, ...entry.bullets]),
    ...projects.flatMap((entry) => [entry.title, entry.role, /^(Dates|Period)$/.test(entry.dates) ? "" : entry.dates, entry.description, ...entry.bullets]),
    ...cv.education.flatMap((entry) => [entry.degree, entry.institution, entry.period, entry.description]),
    ...cv.certifications.flatMap((entry) => [entry.name, entry.authority]),
  ].filter(Boolean).join(" ");
}

/**
 * Suggests readable CV density from all selected content and bullet counts.
 * This heuristic never guarantees a page count; the rendered paginator measures fit.
 */
export function computeSmartAutoFitSettings(app: Application): {
  fontSize: number;
  lineSpacing: number;
  sectionSpacing: number;
} {
  const showAch = app.templateSettings?.showKeyAchievements !== false;
  const showProj = app.templateSettings?.showProjects !== false;

  const achBullets = showAch ? (app.cvContent.keyAchievements || []) : [];
  const expBullets = (app.cvContent.experience || [])
    .filter((e) => e.include !== false)
    .flatMap((e) => e.bullets || []);
  const projBullets = showProj
    ? (app.cvContent.projects || [])
        .filter((p) => p.include !== false)
        .flatMap((p) => p.bullets || [])
    : [];

  const allBullets = [...achBullets, ...expBullets, ...projBullets];
  const rawWords = wordCount(getVisibleCvText(app));
  const templateFactor = app.templateSettings?.cvTemplate === "dach-tabular" ? 1.12
    : app.templateSettings?.cvTemplate === "modern-professional" ? 1.04 : 1;
  const specCompBonus = app.templateSettings?.showSpecializedCompetencies !== false
    ? (app.cvContent.specializedCompetencies?.length || 0) * 5
    : 0;
  const totalWords = Math.round(rawWords * templateFactor) + specCompBonus;
  const totalBullets = allBullets.length;

  if (totalWords <= 350 && totalBullets <= 10) {
    return { fontSize: 11, lineSpacing: 1.45, sectionSpacing: 16 };
  }
  if (totalWords <= 440 && totalBullets <= 14) {
    return { fontSize: 10.5, lineSpacing: 1.42, sectionSpacing: 14 };
  }
  if (totalWords <= 530 && totalBullets <= 18) {
    return { fontSize: 10.2, lineSpacing: 1.4, sectionSpacing: 13 };
  }
  return { fontSize: 10, lineSpacing: 1.38, sectionSpacing: 12 };
}

/**
 * Analyzes CV & Cover Letter for the live "Human & ATS Readiness" bar in the Editor.
 */
export function analyzeApplicationReadiness(app: Application): {
  totalCvWords: number;
  totalLetterWords: number;
  totalBullets: number;
  longBulletsCount: number;
  aiBuzzwordsFound: string[];
  duplicateAchievementsCount: number;
  coverLetterMetricOverlapCount: number;
  skillAnomalies: string[];
} {
  const showAch = app.templateSettings?.showKeyAchievements !== false;
  const showProj = app.templateSettings?.showProjects !== false;

  const achBullets = showAch ? (app.cvContent.keyAchievements || []) : [];
  const expBullets = (app.cvContent.experience || [])
    .filter((e) => e.include !== false)
    .flatMap((e) => e.bullets || []);
  const projBullets = showProj
    ? (app.cvContent.projects || [])
        .filter((p) => p.include !== false)
        .flatMap((p) => p.bullets || [])
    : [];

  const allBullets = [...achBullets, ...expBullets, ...projBullets];
  const longBulletsCount = allBullets.filter(
    (b) => b.replace(/\*\*/g, "").split(/\s+/).filter(Boolean).length > 28
  ).length;

  const cvFullText = getVisibleCvText(app);

  const letterFullText = (app.coverLetterContent.paragraphs || []).map((p) => p.text).join(" ");

  const totalCvWords = wordCount(cvFullText);
  const totalLetterWords = wordCount(letterFullText);

  const combinedText = `${cvFullText} ${letterFullText}`;
  const aiBuzzwordsFound: string[] = [];
  for (const { pattern, label } of AI_CLICHE_PATTERNS) {
    pattern.lastIndex = 0;
    if (pattern.test(combinedText)) {
      aiBuzzwordsFound.push(label);
    }
  }

  let duplicateAchievementsCount = 0;
  for (const ach of achBullets) {
    const maxOverlap = Math.max(0, ...expBullets.map((eb) => computeTokenOverlap(ach, eb)));
    if (maxOverlap >= 0.85) duplicateAchievementsCount++;
  }

  // Figures shared between the letter paragraphs and the CV content selected for this
  // application (not a fixed list of historical figures).
  const coverLetterMetricOverlapCount = compareLetterAndCvFigures(app).shared.length;

  return {
    totalCvWords,
    totalLetterWords,
    totalBullets: allBullets.length,
    longBulletsCount,
    aiBuzzwordsFound,
    duplicateAchievementsCount,
    coverLetterMetricOverlapCount,
    skillAnomalies: detectSkillAnomalies(app.cvContent.coreSkills || []),
  };
}
