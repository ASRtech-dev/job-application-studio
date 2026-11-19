import { type Application } from "@/lib/schemas";
import {
  localizeDateRange,
  localizeLocation,
  localizeCertificationName,
  localizeWorkAuthorization,
  formatDocumentDateLine,
} from "@/lib/localization";
import { sanitizeAiText } from "./sanitize";
import { normalizeEducationEntries } from "./education";

function formatGermanNumbersAndProse(text: string): string {
  if (!text) return "";
  return text
    .replace(/€\s*(\d{1,3})\s*K\s*[–-]\s*€?\s*(\d{1,3})\s*K\b/gi, "$1.000–$2.000 €")
    .replace(/€\s*(\d{1,3})\s*K\b/gi, "$1.000 €")
    .replace(/\bEUR\s*(\d{1,3}),(\d{3})\b/gi, "$1.$2 €")
    .replace(/\b(\d{1,3}),(\d{3})\s*€/g, "$1.$2 €")
    .replace(/\boperative\s+Execution\b/g, "operative Umsetzung")
    .replace(/\boperativen\s+Execution\b/g, "operativen Umsetzung");
}

const GERMAN_SKILL_GROUP_LABELS: Readonly<Record<string, string>> = {
  "core competencies": "Kernkompetenzen",
  "process & operations": "Prozessmanagement & Operations",
  "process execution": "Prozessausführung",
  "ai & automation": "KI & Automatisierung",
  "ai workflows": "KI-Workflows",
  "quality governance": "Qualitäts-Governance",
  "quality & governance": "Qualität & Governance",
  "governance & compliance": "Governance & Compliance",
  "technical stack": "Technischer Stack",
  "operational tooling": "Systeme & Tooling",
  "data & analytics": "Daten & Analytik",
  "systems & tooling": "Systeme & Tooling",
  "product & delivery": "Produkt & Umsetzung",
  "leadership & communication": "Führung & Kommunikation",
};

function localizeGermanSkillGroupTitle(group: string): string {
  const mapped = GERMAN_SKILL_GROUP_LABELS[group.trim().toLowerCase()];
  return mapped || group.replace(/\bGDPR\b/g, "DSGVO");
}

function normalizeAvailabilityText(val: string | undefined, baseAvailability: string): string {
  const text = String(val || "").trim();
  const base = baseAvailability.trim();
  const isImmediateClaim = (value: string) =>
    /^(available immediately|sofort verfügbar|ab sofort(\s+verfügbar)?|disponibilidad inmediata|incorporación inmediata)$/i.test(value);
  // Missing text inherits the draft (the master's confirmed value, possibly empty). An
  // "immediately" claim only yields to a different confirmed availability from the base.
  if (!text) return base;
  if (isImmediateClaim(text) && base && !isImmediateClaim(base)) return base;
  return text;
}

function normalizeDateLineForLang(
  val: string | undefined,
  lang: "English" | "German" | "Spanish",
  location?: string
): string {
  const text = String(val || "").trim();
  if (!text || /\[?(date|datum|fecha|month|day|year|today)\]?/i.test(text)) {
    return formatDocumentDateLine(lang, new Date(), location);
  }
  const hasEnglishMonth = /\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/i.test(text);
  const hasSpanishMarker = /\b(de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre))\b/i.test(text);
  const hasGermanMarker = /\bden\s+\d{1,2}\.\b|\b(Januar|Februar|März|Mai|Juni|Juli|Oktober|Dezember)\b/i.test(text);

  if (lang === "German" && (hasEnglishMonth || hasSpanishMarker)) return formatDocumentDateLine("German", new Date(), location);
  if (lang === "Spanish" && (hasEnglishMonth || hasGermanMarker)) return formatDocumentDateLine("Spanish", new Date(), location);
  if (lang === "English" && (hasGermanMarker || hasSpanishMarker)) return formatDocumentDateLine("English", new Date(), location);
  return text;
}

function localizeLanguageEntry(
  entry: { language: string; level: string },
  targetLang: "English" | "German" | "Spanish"
): { language: string; level: string } {
  const name = entry.language.toLowerCase();
  if (targetLang === "German") {
    if (name.includes("span") || name.includes("espa")) return { ...entry, language: "Spanisch", level: entry.level.replace(/native|nativo/gi, "Muttersprache") };
    if (name.includes("engl") || name.includes("ingl")) return { ...entry, language: "Englisch", level: entry.level.replace(/native|nativo/gi, "Muttersprache") };
    if (name.includes("germ") || name.includes("deut") || name.includes("alem")) return { ...entry, language: "Deutsch", level: entry.level.replace(/native|nativo/gi, "Muttersprache") };
    if (name.includes("fren") || name.includes("fran")) return { ...entry, language: "Französisch", level: entry.level.replace(/native|nativo/gi, "Muttersprache") };
    if (name.includes("ital")) return { ...entry, language: "Italienisch", level: entry.level.replace(/native|nativo/gi, "Muttersprache") };
    return { ...entry, level: entry.level.replace(/native|nativo/gi, "Muttersprache") };
  }
  if (targetLang === "Spanish") {
    if (name.includes("span") || name.includes("espa")) return { ...entry, language: "Español", level: entry.level.replace(/native|muttersprache/gi, "Nativo") };
    if (name.includes("engl") || name.includes("ingl")) return { ...entry, language: "Inglés", level: entry.level.replace(/native|muttersprache/gi, "Nativo") };
    if (name.includes("germ") || name.includes("alem") || name.includes("deut")) return { ...entry, language: "Alemán", level: entry.level.replace(/native|muttersprache/gi, "Nativo") };
    if (name.includes("fren") || name.includes("fran")) return { ...entry, language: "Francés", level: entry.level.replace(/native|muttersprache/gi, "Nativo") };
    if (name.includes("ital")) return { ...entry, language: "Italiano", level: entry.level.replace(/native|muttersprache/gi, "Nativo") };
    return { ...entry, level: entry.level.replace(/native|muttersprache/gi, "Nativo") };
  }
  return entry;
}

/**
 * Localizes inherited fallback fields when the document is in English, German, or Spanish,
 * and normalizes Cover Letter greetings, date lines, and availability without hardcoding personal facts.
 */
export function localizeApplicationFallbacks(
  app: Application,
  base: { headerAvailability?: string; answerAvailability?: string } = {}
): void {
  const lang = app.language;
  const roleLabel = app.roleTitle || app.coverLetterContent.roleTitle || "Open Position";

  // Clean "/ Hybrid" or "/ Remote" from jobLocation
  if (app.jobLocation) {
    app.jobLocation = app.jobLocation
      .replace(/\s*[/|·]\s*(Hybrid|Remote|On-site|Vor Ort|Presencial|Híbrido|Remoto)\b/gi, "")
      .trim();
  }

  // Capitalize "hiring team" in English greetings if lowercase
  if (app.coverLetterContent.greeting) {
    app.coverLetterContent.greeting = app.coverLetterContent.greeting.replace(
      /\bhiring team\b/g,
      "Hiring Team"
    );
  }

  // Normalize Cover Letter dateLine anchored to candidate city (when known) and target language
  const localizedHeaderLocation = localizeLocation(app.cvContent.header.location, lang);
  app.coverLetterContent.dateLine = normalizeDateLineForLang(
    app.coverLetterContent.dateLine,
    lang,
    localizedHeaderLocation
  );

  // Normalize availability cleanly across both header and portal answers
  app.cvContent.header.availability = normalizeAvailabilityText(
    app.cvContent.header.availability,
    base.headerAvailability ?? ""
  );
  if (app.formFieldAnswers) {
    app.formFieldAnswers.availability = normalizeAvailabilityText(
      app.formFieldAnswers.availability,
      base.answerAvailability ?? base.headerAvailability ?? ""
    );
    const workAuth = app.formFieldAnswers.workAuthorization || app.formFieldAnswers.workPermitGermany;
    const localizedAuth = localizeWorkAuthorization(workAuth, lang);
    app.formFieldAnswers.workAuthorization = localizedAuth;
    if (app.formFieldAnswers.workPermitGermany) {
      app.formFieldAnswers.workPermitGermany = localizedAuth;
    }
  }

  if (lang === "German") {
    if (app.coverLetterContent.greeting && /hiring\s+team/i.test(app.coverLetterContent.greeting)) {
      app.coverLetterContent.greeting = "Sehr geehrte Damen und Herren,";
    }
    if (!app.coverLetterContent.closingPhrase || app.coverLetterContent.closingPhrase === "Kind regards,") {
      app.coverLetterContent.closingPhrase = "Mit freundlichen Grüßen";
    }
    if (!app.coverLetterContent.sidebarLabel || app.coverLetterContent.sidebarLabel === "COVER LETTER") {
      app.coverLetterContent.sidebarLabel = "ANSCHREIBEN";
    }
    if (
      !app.coverLetterContent.subjectLine ||
      app.coverLetterContent.subjectLine.startsWith("Application for ")
    ) {
      app.coverLetterContent.subjectLine = `Bewerbung als ${roleLabel}`;
    }
    app.coverLetterContent.paragraphs = (app.coverLetterContent.paragraphs || []).map((p) => ({
      ...p,
      text: formatGermanNumbersAndProse(p.text),
    }));
    app.cvContent.header.location = localizedHeaderLocation;
    app.cvContent.header.languages = app.cvContent.header.languages.map((l) =>
      localizeLanguageEntry(l, "German")
    );
    app.cvContent.professionalProfile = formatGermanNumbersAndProse(app.cvContent.professionalProfile);
    app.cvContent.keyAchievements = (app.cvContent.keyAchievements || []).map(formatGermanNumbersAndProse);
    app.cvContent.experience = (app.cvContent.experience || []).map((e) => ({
      ...e,
      location: localizeLocation(e.location, "German"),
      dates: localizeDateRange(e.dates, "German"),
      summary: typeof e.summary === "string" ? formatGermanNumbersAndProse(e.summary) : e.summary,
      bullets: (e.bullets || []).map(formatGermanNumbersAndProse),
    }));
    app.cvContent.projects = (app.cvContent.projects || []).map((p) => ({
      ...p,
      dates: localizeDateRange(p.dates, "German"),
      description: formatGermanNumbersAndProse(p.description),
      bullets: (p.bullets || []).map(formatGermanNumbersAndProse),
    }));
    app.cvContent.certifications = (app.cvContent.certifications || []).map((c) => ({
      ...c,
      name: localizeCertificationName(c.name, "German"),
    }));
    app.cvContent.coreSkills = (app.cvContent.coreSkills || []).map((g) => ({
      group: localizeGermanSkillGroupTitle(g.group),
      skills: g.skills.map((s) => s.replace(/\bGDPR\b/g, "DSGVO")),
    }));
    if (Array.isArray(app.cvContent.specializedCompetencies)) {
      app.cvContent.specializedCompetencies = app.cvContent.specializedCompetencies.map((item) =>
        localizeCertificationName(item, "German")
      );
    }
    if (app.formFieldAnswers?.additionalMessage) {
      app.formFieldAnswers.additionalMessage = sanitizeAiText(app.formFieldAnswers.additionalMessage);
    }
  } else if (lang === "Spanish") {
    if (!app.coverLetterContent.closingPhrase || app.coverLetterContent.closingPhrase === "Kind regards,") {
      app.coverLetterContent.closingPhrase = "Atentamente,";
    }
    if (!app.coverLetterContent.sidebarLabel || app.coverLetterContent.sidebarLabel === "COVER LETTER") {
      app.coverLetterContent.sidebarLabel = "CARTA DE PRESENTACIÓN";
    }
    if (
      !app.coverLetterContent.subjectLine ||
      app.coverLetterContent.subjectLine.startsWith("Application for ")
    ) {
      app.coverLetterContent.subjectLine = `Candidatura al puesto de ${roleLabel}`;
    }
    app.cvContent.header.location = localizedHeaderLocation;
    app.cvContent.header.languages = app.cvContent.header.languages.map((l) =>
      localizeLanguageEntry(l, "Spanish")
    );
    app.cvContent.experience = (app.cvContent.experience || []).map((e) => ({
      ...e,
      location: localizeLocation(e.location, "Spanish"),
      dates: localizeDateRange(e.dates, "Spanish"),
    }));
    app.cvContent.projects = (app.cvContent.projects || []).map((p) => ({
      ...p,
      dates: localizeDateRange(p.dates, "Spanish"),
    }));
    app.cvContent.certifications = (app.cvContent.certifications || []).map((c) => ({
      ...c,
      name: localizeCertificationName(c.name, "Spanish"),
    }));
    if (Array.isArray(app.cvContent.specializedCompetencies)) {
      app.cvContent.specializedCompetencies = app.cvContent.specializedCompetencies.map((item) =>
        localizeCertificationName(item, "Spanish")
      );
    }
  } else {
    if (!app.coverLetterContent.subjectLine) {
      app.coverLetterContent.subjectLine = `Application for ${roleLabel}`;
    }
  }

  normalizeEducationEntries(app);
}
