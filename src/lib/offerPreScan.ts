import type { MasterCv } from "./schemas";
import { containsFlexibleTerm, containsPhrase } from "./applicationQuality";

export interface OfferPreScanResult {
  detectedLanguage: "English" | "German" | "Spanish" | null;
  detectedAddressing: "du" | "sie" | null;
  detectedSalaryBand: string | null;
  matchedInMaster: string[];
  missingFromMaster: string[];
  mentionsLanguageRequirement: string[];
  wordCount: number;
}

const NOISE_ACRONYMS = new Set([
  "THE", "AND", "FOR", "WITH", "YOU", "OUR", "ALL", "ARE", "NOT", "CAN", "HAS", "NEW", "TOP",
  "JOB", "DAY", "PER", "EUR", "USD", "GBP", "CHF", "CAD", "AUD", "UTC", "GMT", "CET", "EST",
  "PST", "USA", "UK", "EU", "DE", "EN", "ES", "FR", "CEO", "CTO", "CFO", "COO", "VP", "HR",
  "PR", "ID", "VS", "EG", "IE", "AM", "PM", "CV", "OR", "IN", "ON", "AT", "TO", "BY", "OF",
  "AS", "IS", "BE", "WE", "IT", "AN", "NO", "YES", "TBD", "TBA", "FAQ", "ETC", "INC", "LTD",
  "LLC", "GMBH", "AG", "PLC", "MWD", "FMD", "MFD", "GN",
]);

function collectMasterCorpus(masterCv?: MasterCv): string {
  if (!masterCv) return "";
  return [
    masterCv.location,
    masterCv.availability,
    masterCv.workAuthorization,
    masterCv.workPermitGermany,
    ...masterCv.workModes,
    ...masterCv.languages.map((l) => `${l.language} ${l.level}`),
    ...masterCv.achievementsPool,
    ...masterCv.skillsPool.flatMap((g) => [g.group, ...g.skills]),
    ...(masterCv.specializedCompetencies || []),
    ...masterCv.experienceHistory.flatMap((e) => [
      e.jobTitle,
      e.company,
      e.summary || "",
      ...e.bullets,
      ...(e.keywords || []),
      ...(e.pillars || []).flatMap((p) => [p.title, ...p.duties, ...(p.keywords || [])]),
    ]),
    ...masterCv.projectsHistory.flatMap((p) => [
      p.title,
      p.role,
      p.description,
      ...(p.techStack || []),
      ...p.bullets,
    ]),
    ...masterCv.educationHistory.flatMap((e) => [e.degree, e.institution, e.description || ""]),
    ...masterCv.certificationsHistory.map((c) => `${c.name} ${c.authority || ""}`),
  ]
    .filter(Boolean)
    .join(" ");
}

/** Collects profession-agnostic terms directly from the user's Master CV plus domain acronyms present in the JD. */
function collectCandidateTerms(jobText: string, masterCv?: MasterCv): string[] {
  const fromMaster = [
    ...(masterCv?.skillsPool.flatMap((g) => g.skills) || []),
    ...(masterCv?.specializedCompetencies || []),
    ...(masterCv?.experienceHistory.flatMap((e) => [
      ...(e.keywords || []),
      ...(e.pillars || []).flatMap((p) => p.keywords || []),
    ]) || []),
    ...(masterCv?.projectsHistory.flatMap((p) => p.techStack || []) || []),
    ...(masterCv?.certificationsHistory.map((c) => c.name) || []),
  ]
    .map((term) => term.trim())
    .filter((term) => term.length >= 2 && term.length <= 42);

  // Extract technical/domain uppercase acronyms or compound tech tokens from the job posting itself
  const extractedFromOffer = [
    ...(jobText.match(/\b[A-Z][A-Z0-9+#.-]{1,10}\b/g) || []),
    ...(jobText.match(/\b(?:ISO\s?\d{4,5}|SOC\s?2|GDPR|DSGVO|HIPAA|PCI[\s-]DSS|OKRs?|KPIs?|SLAs?|SaaS|B2B|B2C|ERP|CRM|SQL|NoSQL|REST\s?APIs?|GraphQL|CI\/CD|DevOps|Agile|Scrum|Kanban|Power\s?BI|Tableau|Excel|Python|TypeScript|JavaScript|Java|C\+\+|C#|Go|Rust|React|Next\.js|Node\.js|AWS|Azure|GCP|Docker|Kubernetes|Terraform|Figma|Salesforce|HubSpot|Jira|Confluence|SAP|Workday|Snowflake|Databricks|Spark|Airflow)\b/gi) || []),
  ]
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && !NOISE_ACRONYMS.has(t.toUpperCase()));

  const seen = new Map<string, string>();
  for (const term of [...fromMaster, ...extractedFromOffer]) {
    const key = term.toLowerCase();
    if (!seen.has(key)) seen.set(key, term);
  }
  return Array.from(seen.values());
}

function detectLanguageFromOffer(text: string): "English" | "German" | "Spanish" | null {
  if (!text.trim()) return null;
  // Explicit application language instructions win over posting prose language.
  const applyEn = /\b(apply|application|cv|resume|cover letter)\s+(in|on)\s+english\b|\b(bewerbung|unterlagen)\s+(auf|in)\s+englisch\b|\benviar\s+cv\s+en\s+ingl[eé]s\b/i.test(text);
  const applyDe = /\b(bewerbung|unterlagen)\s+(auf|in)\s+deutsch\b|\b(apply|application)\s+in\s+german\b/i.test(text);
  const applyEs = /\benviar\s+cv\s+en\s+espa[nñ]ol\b|\b(apply|application)\s+in\s+spanish\b/i.test(text);
  if (applyDe && !applyEn) return "German";
  if (applyEn && !applyDe) return "English";
  if (applyEs) return "Spanish";

  const de = (text.match(/\b(und|für|mit|wir|suchen|aufgaben|profil|deine|ihre|kenntnisse|erfahrung|m\/w\/d|w\/m\/d|vollzeit|unbefristet|ab sofort|bewerbung)\b/gi) || []).length;
  const es = (text.match(/\b(para|con|requisitos|experiencia|buscamos|funciones|puesto|empresa|incorporación|idiomas|conocimientos)\b/gi) || []).length;
  const en = (text.match(/\b(the|and|with|for|you|your|experience|responsibilities|requirements|role|team|about us|what you)\b/gi) || []).length;

  if (de >= 5 && de >= en && de >= es) return "German";
  if (es >= 5 && es > en && es > de) return "Spanish";
  if (en >= 4) return "English";
  return null;
}

function detectAddressingFromOffer(text: string, lang: "English" | "German" | "Spanish" | null): "du" | "sie" | null {
  if (lang !== "German" && !/\b(m\/w\/d|dein profil|ihr profil|dich|ihnen)\b/i.test(text)) return null;
  const duCount = (text.match(/\b(du|dir|dich|dein|deine|deinem|deinen|deiner)\b/gi) || []).length;
  const sieCount = (text.match(/\b(Sie|Ihnen|Ihr|Ihre|Ihrem|Ihren|Ihrer)\b/g) || []).length;
  if ((duCount >= 2 || (duCount >= 1 && sieCount === 0)) && duCount > sieCount) return "du";
  if ((sieCount >= 2 || (sieCount >= 1 && duCount === 0)) && sieCount >= duCount) return "sie";
  return null;
}

function detectSalaryBand(text: string): string | null {
  const currency = "(?:€|EUR|\\$|USD|£|GBP|CHF|CAD|AUD)";
  const amount = "\\d{2,3}(?:[.,]\\d{3}|[kKmM])";
  const rangeRe1 = new RegExp(`${currency}\\s?${amount}\\s*(?:[–-]|to|bis)\\s*(?:${currency})?\\s?${amount}(?:\\s?${currency})?`, "i");
  const rangeRe2 = new RegExp(`${amount}\\s*(?:[–-]|to|bis)\\s*${amount}\\s*${currency}`, "i");
  const match = text.match(rangeRe1) || text.match(rangeRe2);
  return match ? match[0].replace(/\s+/g, " ").trim() : null;
}

/**
 * Synchronous deterministic pre-scan of a job posting against the user's Master CV
 * before copying the LLM prompt, exposing matched/unmatched terms and language/salary hints.
 */
export function preScanOffer(jobDescription: string, masterCv?: MasterCv): OfferPreScanResult {
  const text = (jobDescription || "").trim();
  const wordCount = text ? text.split(/\s+/).filter(Boolean).length : 0;
  if (!text) {
    return {
      detectedLanguage: null,
      detectedAddressing: null,
      detectedSalaryBand: null,
      matchedInMaster: [],
      missingFromMaster: [],
      mentionsLanguageRequirement: [],
      wordCount: 0,
    };
  }

  const detectedLanguage = detectLanguageFromOffer(text);
  const detectedAddressing = detectAddressingFromOffer(text, detectedLanguage);
  const detectedSalaryBand = detectSalaryBand(text);

  const candidateTerms = collectCandidateTerms(text, masterCv);
  const mentionedInOffer = candidateTerms.filter((term) => containsPhrase(text, term));
  const masterCorpus = collectMasterCorpus(masterCv);

  const matchedInMaster: string[] = [];
  const missingFromMaster: string[] = [];
  for (const term of mentionedInOffer) {
    if (masterCorpus && containsFlexibleTerm(masterCorpus, term)) {
      matchedInMaster.push(term);
    } else {
      missingFromMaster.push(term);
    }
  }

  const langMentions = Array.from(
    new Set(
      (
        text.match(
          /\b(?:German|Deutsch|English|Englisch|Spanish|Spanisch|Español|French|Français|Italian|Dutch|Portuguese|Japanese|Mandarin)\s*(?:C1|C2|B2|B1|A2|fluent|native|proficient|fließend|verhandlungssicher|Muttersprache)\b/gi
        ) || []
      ).map((m) => m.replace(/\s+/g, " ").trim())
    )
  ).slice(0, 6);

  return {
    detectedLanguage,
    detectedAddressing,
    detectedSalaryBand,
    matchedInMaster: matchedInMaster.slice(0, 18),
    missingFromMaster: missingFromMaster.slice(0, 12),
    mentionsLanguageRequirement: langMentions,
    wordCount,
  };
}
