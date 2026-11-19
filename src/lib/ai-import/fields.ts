

/**
 * Clean and sanitize a string representing an ATS keyword or plain field.
 */
export function cleanKeyword(kw: string): string {
  if (!kw || typeof kw !== "string") return "";
  return cleanPlainField(kw).replace(/^[-•·*]\s*/, "").trim();
}

/**
 * Cleans job-board scraping artifacts from roleTitle or company strings
 * (e.g. "Acme Corp 4.2 4.2 out of 5 stars working from home Permanent position").
 */
export function cleanScrapedTitleOrCompany(raw: string): string {
  if (!raw || typeof raw !== "string") return "";
  return raw
    .replace(/\b\d+([.,]\d+)?\s+\d+([.,]\d+)?\s+(?:out of|von)\s+\d+\s+(?:stars|Sternen)\b/gi, "")
    .replace(/\b\d+([.,]\d+)?\s+(?:out of|von)\s+\d+\s+(?:stars|Sternen)\b/gi, "")
    .replace(/\s*\((?:m\/w\/d|w\/m\/d|f\/m\/d|m\/f\/d|d\/f\/m|gn|all genders)\)/gi, "")
    .replace(/\b(working from home|Homeoffice möglich|permanent position|Festanstellung|full-time|part-time|Vollzeit|Teilzeit)\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * Sanitizes plain-text fields (headers, form answers, skills, titles):
 * - Converts Markdown links [label](url) -> label (or url)
 * - Removes **bold** and *italic* markers so ATS form textareas stay clean
 */
export function cleanPlainField(text: string): string {
  if (!text || typeof text !== "string") return "";
  return text
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * Extracts a clean URL from Markdown link syntax [https://...](https://...)
 */
export function cleanUrlField(text: string): string {
  if (!text || typeof text !== "string") return "";
  const mdMatch = text.match(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/);
  if (mdMatch) {
    return mdMatch[2].trim();
  }
  return text.trim();
}

/**
 * Sanitizes narrative / bullet fields:
 * - Converts Markdown links [label](url) -> label
 * - Strips leading bullet symbols (- , • , * )
 * - Preserves balanced **bold** pairs for rich rendering in templates
 */
export function cleanRichTextField(text: string): string {
  if (!text || typeof text !== "string") return "";
  return text
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, "$1")
    .replace(/^[\s]*(?:[-•·*]|\d+\))\s+/, "")
    .replace(/^[\s]*\d+\.\s+(?!Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember|January|February|March|April|May|June|July|August|September|October|November|December)(?=[A-Za-zÄÖÜäöüÁÉÍÓÚáéíóú])/, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}
