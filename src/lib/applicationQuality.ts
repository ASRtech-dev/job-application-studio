import type { Application, JobRequirement, MasterCv } from "./schemas";
import { fingerprintText } from "./generationContext";

export type RequirementStatus = "covered" | "transferable" | "not_visible" | "gap" | "unverified";
export interface RequirementReview {
  requirement: JobRequirement;
  status: RequirementStatus;
  offerQuoteVerified: boolean;
  evidenceQuoteVerified: boolean;
  visibleSections: string[];
  missingSourceIds: string[];
  explanation: string;
}

export function normalizeSearchText(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^\p{L}\p{N}+#]+/gu, " ").replace(/\s+/g, " ").trim();
}

export function containsPhrase(text: string, phrase: string): boolean {
  const normalized = normalizeSearchText(phrase);
  return Boolean(normalized && ` ${normalizeSearchText(text)} `.includes(` ${normalized} `));
}

const ATS_TERM_EQUIVALENTS: Readonly<Record<string, readonly string[]>> = {
  "gdpr": ["dsgvo", "rgpd", "data privacy", "datenschutz"],
  "dsgvo": ["gdpr", "rgpd", "datenschutz"],
  "anonymization": ["anonymisierung", "pseudonymisierung", "anonymization", "redact", "masking"],
  "customer kpis": ["kpis", "customer kpi", "kpi tracking", "kpi reporting", "service kpis", "kunden kpis"],
  "quality assurance": ["qa", "qualitatssicherung", "quality audits", "quality controls", "qualitatskontrolle"],
  "input data quality": ["data quality", "datenqualitat", "input quality", "data validation", "datenvalidierung"],
  "documentation hygiene": ["process documentation", "documentation standards", "dokumentationsstandards", "dokumentation", "sop", "sops"],
  "stakeholder communication": ["stakeholder management", "stakeholder coordination", "stakeholder kommunikation", "interne kommunikation"],
  "escalation management": ["escalation handling", "eskalationsmanagement", "escalations", "eskalationen", "tier 2", "tier 3"],
  "workflow automation": ["workflow automatisierung", "process automation", "prozessautomatisierung"],
};

/**
 * Richer ATS matcher used in scanner coverage: preserves exact word-boundary checks for short acronyms
 * while allowing parenthetical acronyms ("Quality Assurance (QA)"), composite slashes ("GDPR / Anonymization"),
 * German compound spacing, and grounded bilingual terminology equivalents.
 */
export function containsFlexibleTerm(text: string, phrase: string): boolean {
  if (!phrase?.trim() || !text?.trim()) return false;
  if (containsPhrase(text, phrase)) return true;
  const trimmed = phrase.trim();
  // Composite slash terms like "GDPR / Anonymization" or "A / B": require each significant part to match
  if (/\s+\/\s+/.test(trimmed)) {
    const parts = trimmed.split(/\s+\/\s+/).map((p) => p.trim()).filter((p) => p.length >= 2);
    if (parts.length >= 2) return parts.every((p) => containsFlexibleTerm(text, p));
  }
  // Parenthetical acronyms like "Quality Assurance (QA)" -> match base phrase OR standalone acronym if >= 2 chars
  const parenMatch = trimmed.match(/^(.+?)\s*\(([^)]{2,12})\)\s*$/);
  if (parenMatch) {
    if (containsFlexibleTerm(text, parenMatch[1]) || containsPhrase(text, parenMatch[2])) return true;
  }
  const norm = normalizeSearchText(trimmed);
  if (!norm) return false;
  // Direct bilingual equivalents
  const aliases = ATS_TERM_EQUIVALENTS[norm];
  if (aliases?.some((alias) => containsPhrase(text, alias))) return true;
  // Hyphen / spacing fold + simple plural tolerance for multi-char terms (>= 6 chars)
  const hay = ` ${normalizeSearchText(text)} `;
  const noSpaceHay = hay.replace(/\s+/g, "");
  const noSpaceNorm = norm.replace(/\s+/g, "");
  if (norm.length >= 8 && noSpaceHay.includes(noSpaceNorm)) return true;
  if (norm.length >= 6) {
    const stem = norm.endsWith("s") ? norm.slice(0, -1) : norm;
    if (hay.includes(` ${stem}s `) || hay.includes(` ${stem} `)) return true;
  }
  return false;
}

function strings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === "object") return Object.entries(value).filter(([key]) => key !== "id").flatMap(([, item]) => strings(item));
  return [];
}

export function getEvidenceSources(master: MasterCv): Map<string, string[]> {
  const sources = new Map<string, string[]>();
  const recordStrings = (value: unknown): string[] => {
    const leaf = strings(value);
    return leaf.length > 1 ? [...leaf, leaf.join(" ")] : leaf;
  };
  for (const entry of [...master.experienceHistory, ...master.projectsHistory, ...master.educationHistory, ...master.certificationsHistory]) {
    sources.set(entry.id, recordStrings(entry));
  }
  for (const field of ["achievementsPool", "skillsPool", "languages"] as const) {
    master[field].forEach((entry, index) => sources.set(`${field}[${index}]`, recordStrings(entry)));
  }
  master.specializedCompetencies?.forEach((entry, index) => {
    sources.set(`specializedCompetencies[${index}]`, [entry]);
  });
  const workAuth = (master.workAuthorization || master.workPermitGermany || "").trim();
  if (workAuth) {
    sources.set("workAuthorization", [workAuth]);
    sources.set("workPermitGermany", [workAuth]);
  }
  sources.set("availability", [master.availability]);
  sources.set("workModes", master.workModes);
  return sources;
}

/** Only includes content printed in the CV/letter; hidden catalog duties never count. */
export function getVisibleDocumentSections(app: Application): Record<string, string> {
  const cv = app.cvContent;
  return {
    profile: [cv.header.headline, cv.professionalProfile, cv.header.location, cv.header.availability, ...cv.header.languages.map((entry) => `${entry.language} ${entry.level}`)].join(" "),
    achievements: app.templateSettings.showKeyAchievements !== false ? cv.keyAchievements.join(" ") : "",
    skills: [
      ...cv.coreSkills.flatMap((group) => [group.group, ...group.skills]),
      ...(app.templateSettings.showSpecializedCompetencies !== false ? cv.specializedCompetencies || [] : []),
    ].join(" "),
    experience: cv.experience.filter((entry) => entry.include !== false).flatMap((entry) => [entry.jobTitle, entry.company, entry.summary || "", ...entry.bullets]).join(" "),
    projects: app.templateSettings.showProjects !== false ? cv.projects.filter((entry) => entry.include !== false).flatMap((entry) => [entry.title, entry.role, entry.description, ...entry.bullets]).join(" ") : "",
    education: [...cv.education.flatMap((entry) => [entry.degree, entry.institution, entry.period, entry.description || ""]), ...cv.certifications.flatMap((entry) => [entry.name, entry.authority || ""])].join(" "),
    letter: app.coverLetterContent.paragraphs.map((paragraph) => paragraph.text).join(" "),
  };
}

function languageLevelCheck(requirement: JobRequirement, master: MasterCv): "gap" | "met" | "unknown" | null {
  if (requirement.category !== "language") return null;
  const text = normalizeSearchText(requirement.requirement);
  const language = /\b(deutsch|german|aleman)\b/.test(text) ? /german|deutsch|alemán|aleman/i
    : /\b(english|englisch|ingles)\b/.test(text) ? /english|englisch|inglés|ingles/i
    : /\b(spanish|spanisch|espanol)\b/.test(text) ? /spanish|spanisch|español|espanol/i
    : /\b(french|franzosisch|frances)\b/.test(text) ? /french|französisch|franzosisch|francés|frances/i : null;
  if (!language) return "unknown";
  const levels = ["A1", "A2", "B1", "B2", "C1", "C2"];
  const source = normalizeSearchText(requirement.sourceQuote);
  const langPattern = /\b(?:deutsch\w*|german|aleman\w*|english|englisch\w*|ingles|spanish|spanisch\w*|espanol\w*|french|franzosisch\w*|frances\w*)\b/g;
  const mentionedLanguages = source.match(langPattern) || [];
  const relevantClause = source.match(new RegExp(`\\b${language.source.replace(/\|/g, "\\b|\\b")}\\b`, "i"));
  let expected: number[] = [];
  if (relevantClause?.index !== undefined) {
    const suffix = source.slice(relevantClause.index + relevantClause[0].length);
    const nextLanguage = suffix.search(/\b(?:deutsch\w*|german|aleman\w*|english|englisch\w*|ingles|spanish|spanisch\w*|espanol\w*|french|franzosisch\w*|frances\w*)\b/);
    const clause = suffix.slice(0, nextLanguage < 0 ? undefined : nextLanguage);
    expected = (clause.match(/\b[abc][12]\b/gi) || []).map((level) => levels.indexOf(level.toUpperCase()));
    if (!expected.length && /\b(fluent|business fluent|fließend|verhandlungssicher|fluid[oa])\b/i.test(clause)) expected = [4];
    if (!expected.length && /\b(native|muttersprach|nativo)\b/i.test(clause)) expected = [5];
  }
  if (!expected.length && mentionedLanguages.length <= 1) {
    expected = (source.match(/\b[abc][12]\b/gi) || []).map((level) => levels.indexOf(level.toUpperCase()));
    if (!expected.length && /\b(fluent|business fluent|fließend|verhandlungssicher|fluid[oa])\b/i.test(source)) expected = [4];
    if (!expected.length && /\b(native|muttersprach|nativo)\b/i.test(source)) expected = [5];
  }
  if (!expected.length) return "unknown";
  const candidate = master.languages.find((entry) => language.test(entry.language));
  if (!candidate) return "gap";
  if (/native|muttersprach|nativo/i.test(candidate.level)) return "met";
  const actual = candidate.level.match(/\b[ABC][12]\b/i)?.[0].toUpperCase();
  return !actual ? "unknown" : levels.indexOf(actual) < Math.min(...expected) ? "gap" : "met";
}

export function reviewRequirement(requirement: JobRequirement, app: Application, master?: MasterCv): RequirementReview {
  const sources = master ? getEvidenceSources(master) : null;
  const quoteSegments = requirement.sourceQuote.split(/\s*(?:\.\.\.|…)\s*/).map((s) => s.trim()).filter((s) => s.length >= 2);
  const offerQuoteVerified = quoteSegments.length > 0 && quoteSegments.every((seg) => containsPhrase(app.jobDescription || "", seg));
  const validEvidence = requirement.evidence.filter((entry) => {
    const sourceValues = sources?.get(entry.sourceId) || [];
    if (!sourceValues.length) return false;
    const segments = entry.quote.split(/\s*(?:\.\.\.|…)\s*/).map((s) => s.trim()).filter((s) => s.length >= 2);
    return segments.length > 0 && segments.every((seg) => sourceValues.some((source) => containsPhrase(source, seg)));
  });
  const evidenceQuoteVerified = validEvidence.length > 0;
  const missingSourceIds = requirement.evidence.filter((entry) => !sources?.has(entry.sourceId)).map((entry) => entry.sourceId);
  const sections = getVisibleDocumentSections(app);
  const targets = requirement.targetSections.length ? requirement.targetSections : Object.keys(sections);
  const visibleSections = targets.filter((section) => (requirement.keywords.length ? requirement.keywords : [requirement.requirement]).some((keyword) => containsFlexibleTerm(sections[section] || "", keyword)));
  let status: RequirementStatus;
  let explanation: string;
  const languageCheck = master ? languageLevelCheck(requirement, master) : null;
  if (!offerQuoteVerified) {
    status = "unverified";
    explanation = "The quoted requirement was not found in the saved job description.";
  } else if (requirement.evidenceLevel === "gap" || languageCheck === "gap") {
    status = "gap";
    explanation = "A requirement is not supported at the requested level. Do not claim it is met.";
  } else if (!evidenceQuoteVerified || requirement.evidenceLevel === "unknown" || languageCheck === "unknown") {
    status = "unverified";
    explanation = master ? "No matching source quote was found in the Master CV. Review the evidence." : "Load the Master CV to check the cited evidence.";
  } else if (!visibleSections.length) {
    status = "not_visible";
    explanation = "Evidence is referenced, but its keywords were not found in the intended visible sections. Review wording and translations.";
  } else if (requirement.evidenceLevel === "transferable" || (languageCheck !== "met" && validEvidence.every((entry) => entry.scope === "trained" || entry.scope === "unknown"))) {
    status = "transferable";
    explanation = "Related or training evidence is visible; it does not establish direct professional experience.";
  } else {
    status = "covered";
    explanation = "An offer quote, a Master CV source quote and visible terminology were found. A human must still check that the evidence proves the requirement.";
  }
  return { requirement, status, offerQuoteVerified, evidenceQuoteVerified, visibleSections, missingSourceIds, explanation };
}

export function evaluateApplicationQuality(app: Application, master?: MasterCv) {
  const analysis = app.jobAnalysis;
  const unbound = Boolean(analysis && !analysis.jobDescriptionFingerprint);
  const stale = Boolean(analysis?.jobDescriptionFingerprint && analysis.jobDescriptionFingerprint !== fingerprintText(app.jobDescription || ""));
  const requirements = (analysis?.requirements || []).map((requirement) => reviewRequirement(requirement, app, master));
  const weights = { must_have: 3, important: 2, nice_to_have: 1 };
  const totalWeight = requirements.reduce((sum, item) => sum + weights[item.requirement.priority], 0);
  const coveredWeight = requirements.reduce((sum, item) => sum + weights[item.requirement.priority] * (item.status === "covered" ? 1 : item.status === "transferable" ? 0.5 : 0), 0);
  const criticalGaps = requirements.filter((item) => item.requirement.priority === "must_have" && item.status === "gap");
  const uncertainRequirements = requirements.filter((item) => item.status === "unverified");
  const eligibility = stale || unbound || !analysis ? "uncertain" : criticalGaps.length || analysis.eligibility.status === "gaps" || analysis.eligibility.unmetRequirements.length ? "gaps"
    : !requirements.length || !master || uncertainRequirements.some((item) => item.requirement.priority === "must_have") || requirements.some((item) => item.requirement.priority === "must_have" && ["language", "qualification", "logistics"].includes(item.requirement.category) && item.status !== "covered") ? "uncertain" : analysis.eligibility.status;
  const letterText = app.coverLetterContent.paragraphs.map((paragraph) => paragraph.text).join(" ");
  const letterWords = letterText.split(/\s+/).filter(Boolean).length;
  const explicitLimits = (analysis?.applicationInstructions || []).filter((instruction) => containsPhrase(app.jobDescription || "", instruction))
    .filter((instruction) => /letter|carta|anschreiben/i.test(instruction))
    .flatMap((instruction) => [...instruction.matchAll(/(?:max(?:imum|imo)?\.?|máximo|höchstens|at most|up to)\s*(?:(?:of|de)\s*)?(\d{2,3})\s*(?:words|palabras|worter|wörter)/gi)].map((match) => Number(match[1])));
  const letterWordLimit = explicitLimits.length ? Math.min(...explicitLimits) : null;
  const normalizedCompany = app.company.replace(/\b(gmbh|se|ag|ug|mbh|e\.?v\.?|inc\.?|ltd\.?|ohg|kg)\b/gi, "").trim();
  const companyToken = normalizedCompany.length >= 3 ? normalizedCompany : app.company.trim();
  return {
    requirements, stale, unbound, criticalGaps, uncertainRequirements, eligibility,
    coverage: master && totalWeight && !stale && !unbound ? Math.round(100 * coveredWeight / totalWeight) : null,
    letterWords, letterWordLimit,
    letterOverLimit: letterWordLimit !== null && letterWords > letterWordLimit,
    letterCompanyMentioned: Boolean(companyToken && (containsPhrase(letterText, app.company) || containsPhrase(letterText, companyToken))),
    // These are review signals, not automated judgments of prose or employability.
    letterNeedsReview: !analysis || !analysis.employerPriorities.length || (letterWordLimit !== null && letterWords > letterWordLimit),
  };
}
