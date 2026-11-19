

/**
 * Automatically detects the document language ("English" | "Spanish" | "German")
 * from explicit field or lexical analysis of the profile, headline, and cover letter.
 */
export function detectDocumentLanguage(raw: any, fallback: "English" | "Spanish" | "German" = "English"): "English" | "Spanish" | "German" {
  if (raw?.language && typeof raw.language === "string") {
    const l = raw.language.trim().toLowerCase();
    if (l === "german" || l === "deutsch" || l === "de") return "German";
    if (l === "spanish" || l === "español" || l === "espanol" || l === "es") return "Spanish";
    if (l === "english" || l === "en") return "English";
  }

  const cl = raw?.coverLetterContent || raw?.coverLetter || {};
  const sampleText = [
    raw?.professionalProfile,
    raw?.cvContent?.professionalProfile,
    raw?.headline,
    raw?.cvContent?.header?.headline,
    cl?.greeting,
    cl?.sidebarLabel,
    ...(Array.isArray(cl?.paragraphs)
      ? cl.paragraphs.map((p: any) => (typeof p === "string" ? p : p?.text || ""))
      : []),
  ]
    .filter(Boolean)
    .join(" ");

  if (!sampleText) return fallback;

  const germanMatches = (
    sampleText.match(/\b(und|für|mit|über|durch|sowie|Liebes|Sehr geehrte|ANSCHREIBEN|Erfahrung|Prozess|Kenntnisse|Bewerbung|Unternehmen)\b/gi) || []
  ).length;
  const spanishMatches = (
    sampleText.match(/\b(para|con|los|las|una|por|sobre|experiencia|procesos|empresa|puesto|equipo|Estimado|Atentamente)\b/gi) || []
  ).length;
  const englishMatches = (
    sampleText.match(/\b(the|and|with|for|across|experience|workflows|processes|operations|business|Dear|team)\b/gi) || []
  ).length;

  if (germanMatches >= 4 && germanMatches > englishMatches) return "German";
  if (spanishMatches >= 4 && spanishMatches > englishMatches) return "Spanish";
  if (englishMatches >= 4) return "English";

  return fallback;
}
