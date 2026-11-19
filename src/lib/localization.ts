import { getAppTimeZone, getLocalIsoDate } from "./timeZone";

export type DocLang = "English" | "German" | "Spanish";

export { getLocalIsoDate };

/**
 * Extracts the leading city name from a location string such as "London, United Kingdom" or "Munich, Germany".
 */
function extractCity(location?: string): string {
  if (!location) return "";
  const clean = location
    .replace(/\s*[/|·]\s*(Hybrid|Remote|On-site|Vor Ort|Presencial|Híbrido|Remoto)\b/gi, "")
    .trim();
  if (!clean) return "";
  const firstSegment = clean.split(",")[0]?.trim() || "";
  return firstSegment.length <= 48 ? firstSegment : "";
}

/**
 * Formats a clean Cover Letter dateLine anchored to today's local date in the target document language.
 * Prepends the candidate's city when provided (e.g., "London, May 14, 2026" or "München, 14. Mai 2026").
 */
export function formatDocumentDateLine(
  lang: DocLang = "English",
  now: Date = new Date(),
  location?: string
): string {
  const timeZone = getAppTimeZone();
  const city = extractCity(location);

  if (lang === "German") {
    const formatted = new Intl.DateTimeFormat("de-DE", {
      timeZone,
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(now);
    return city ? `${city}, ${formatted}` : formatted;
  }
  if (lang === "Spanish") {
    const formatted = new Intl.DateTimeFormat("es-ES", {
      timeZone,
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(now);
    return city ? `${city}, ${formatted}` : formatted;
  }
  const formatted = new Intl.DateTimeFormat("en-US", {
    timeZone,
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(now);
  return city ? `${city}, ${formatted}` : formatted;
}

/**
 * Localizes English month abbreviations and "Present" in date ranges into German or Spanish.
 */
export function localizeDateRange(dates: string | undefined, lang: DocLang): string {
  if (!dates) return "";
  if (lang === "German") {
    return dates
      .replace(/\bJan\b\.?/g, "Jan.")
      .replace(/\bFeb\b\.?/g, "Feb.")
      .replace(/\bMar\b\.?/g, "März")
      .replace(/\bApr\b\.?/g, "Apr.")
      .replace(/\bMay\b/g, "Mai")
      .replace(/\bJun\b\.?/g, "Juni")
      .replace(/\bJul\b\.?/g, "Juli")
      .replace(/\bAug\b\.?/g, "Aug.")
      .replace(/\bSep\b\.?/g, "Sep.")
      .replace(/\bOct\b\.?/g, "Okt.")
      .replace(/\bNov\b\.?/g, "Nov.")
      .replace(/\bDec\b\.?/g, "Dez.")
      .replace(/\bPresent\b/gi, "Heute");
  }
  if (lang === "Spanish") {
    return dates
      .replace(/\bJan\b\.?/g, "Ene.")
      .replace(/\bFeb\b\.?/g, "Feb.")
      .replace(/\bMar\b\.?/g, "Mar.")
      .replace(/\bApr\b\.?/g, "Abr.")
      .replace(/\bMay\b\.?/g, "Mayo")
      .replace(/\bJun\b\.?/g, "Jun.")
      .replace(/\bJul\b\.?/g, "Jul.")
      .replace(/\bAug\b\.?/g, "Ago.")
      .replace(/\bSep\b\.?/g, "Sep.")
      .replace(/\bOct\b\.?/g, "Oct.")
      .replace(/\bNov\b\.?/g, "Nov.")
      .replace(/\bDec\b\.?/g, "Dic.")
      .replace(/\bPresent\b/gi, "Actualidad");
  }
  return dates;
}

export interface LocalizeLocationOptions {
  stripWorkMode?: boolean;
}

/**
 * Localizes common country names in location strings into the target document language.
 */
export function localizeLocation(
  loc: string | undefined,
  lang: DocLang,
  options: LocalizeLocationOptions = {}
): string {
  if (!loc) return "";
  const { stripWorkMode = false } = options;

  let cleaned = stripWorkMode
    ? loc.replace(/\s*[/|·]\s*(Hybrid|Remote|On-site|Vor Ort|Presencial|Híbrido|Remoto)\b/gi, "").trim()
    : loc;

  if (lang === "German") {
    cleaned = cleaned
      .replace(/\bGermany\b/gi, "Deutschland")
      .replace(/\bUnited Kingdom\b/gi, "Vereinigtes Königreich")
      .replace(/\bSpain\b/gi, "Spanien")
      .replace(/\bSwitzerland\b/gi, "Schweiz")
      .replace(/\bAustria\b/gi, "Österreich")
      .replace(/\bFrance\b/gi, "Frankreich")
      .replace(/\bUnited States\b/gi, "USA");
    return cleaned;
  }
  if (lang === "Spanish") {
    cleaned = cleaned
      .replace(/\bGermany\b/gi, "Alemania")
      .replace(/\bUnited Kingdom\b/gi, "Reino Unido")
      .replace(/\bSpain\b/gi, "España")
      .replace(/\bSwitzerland\b/gi, "Suiza")
      .replace(/\bAustria\b/gi, "Austria")
      .replace(/\bFrance\b/gi, "Francia")
      .replace(/\bUnited States\b/gi, "Estados Unidos");
    return cleaned;
  }
  return cleaned;
}

/**
 * Localizes standard regulatory acronyms inside certification names into the target document language.
 */
export function localizeCertificationName(name: string | undefined, lang: DocLang): string {
  if (!name) return "";
  if (lang === "German") {
    return name.replace(/\bGDPR\b/g, "DSGVO");
  }
  if (lang === "Spanish") {
    return name.replace(/\bGDPR\b/g, "RGPD");
  }
  return name;
}

/**
 * Localizes simple affirmative work-authorization answers when explicitly present.
 * Leaves detailed candidate-authored statements untouched unless they are exact simple tokens.
 */
export function localizeWorkAuthorization(value: string | undefined, lang: DocLang): string {
  if (!value) return "";
  if (lang === "German") {
    return value.replace(/^Yes$/i, "Ja").replace(/^No$/i, "Nein");
  }
  if (lang === "Spanish") {
    return value.replace(/^Yes$/i, "Sí").replace(/^No$/i, "No");
  }
  return value;
}

/** Backwards-compatible alias for localizeWorkAuthorization. */
export const localizeWorkPermit = localizeWorkAuthorization;
