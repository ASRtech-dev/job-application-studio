import { type Application } from "@/lib/schemas";

export const AI_CLICHE_PATTERNS: Array<{ pattern: RegExp; replacement?: string; label: string }> = [
  { pattern: /\boperational leverage\b/gi, label: "operational leverage" },
  { pattern: /\bspearheaded\b/gi, replacement: "led", label: "spearheaded" },
  { pattern: /\bspearheading\b/gi, replacement: "leading", label: "spearheading" },
  { pattern: /\bspearhead\b/gi, replacement: "lead", label: "spearhead" },
  { pattern: /\borchestrated\b/gi, label: "orchestrated" },
  { pattern: /\borchestrating\b/gi, label: "orchestrating" },
  { pattern: /\borchestrate\b/gi, label: "orchestrate" },
  { pattern: /\bsynergized\b/gi, label: "synergized" },
  { pattern: /\bsynergize\b/gi, label: "synergize" },
  { pattern: /\bsynergies\b/gi, label: "synergies" },
  { pattern: /\bsynergy\b/gi, label: "synergy" },
  { pattern: /\bfostered\b/gi, label: "fostered" },
  { pattern: /\bfostering\b/gi, label: "fostering" },
  { pattern: /\bfoster\b/gi, label: "foster" },
  { pattern: /\bcatalyzed\b/gi, label: "catalyzed" },
  { pattern: /\brevolutionized\b/gi, label: "revolutionized" },
  { pattern: /\bpioneered\b/gi, label: "pioneered" },
  { pattern: /\bleveraged\b/gi, replacement: "used", label: "leveraged" },
  { pattern: /\bleveraging\b/gi, replacement: "using", label: "leveraging" },
  { pattern: /\bleverage\b/gi, replacement: "use", label: "leverage" },
  { pattern: /\butilized\b/gi, replacement: "used", label: "utilized" },
  { pattern: /\butilizing\b/gi, replacement: "using", label: "utilizing" },
  { pattern: /\butilize\b/gi, replacement: "use", label: "utilize" },
  { pattern: /\bpivotal\b/gi, label: "pivotal" },
  { pattern: /\bdelved into\b/gi, label: "delved into" },
  { pattern: /\bdelving into\b/gi, label: "delving into" },
  { pattern: /\bcutting-edge\b/gi, label: "cutting-edge" },
  { pattern: /\bstate-of-the-art\b/gi, label: "state-of-the-art" },
  { pattern: /\bseamlessly(?=\s|[.,;:!?)])/gi, replacement: "", label: "seamlessly" },
  { pattern: /\bseamless\s+/gi, replacement: "smooth ", label: "seamless" },
  { pattern: /\bholistically(?=\s|[.,;:!?)])/gi, replacement: "", label: "holistically" },
  { pattern: /\bholistic\s+/gi, label: "holistic" },
  { pattern: /\bmeticulously(?=\s|[.,;:!?)])/gi, replacement: "", label: "meticulously" },
  { pattern: /\brelentlessly(?=\s|[.,;:!?)])/gi, replacement: "", label: "relentlessly" },
  { pattern: /\btirelessly(?=\s|[.,;:!?)])/gi, replacement: "", label: "tirelessly" },
  // German AI buzzwords & inflections
  { pattern: /\borchestrierte\b/gi, label: "orchestrierte" },
  { pattern: /\borchestrierten\b/gi, label: "orchestrierten" },
  { pattern: /\borchestrieren\b/gi, label: "orchestrieren" },
  { pattern: /\brevolutionierte\b/gi, label: "revolutionierte" },
  { pattern: /\bbahnbrechend(e|er|es|en)?\b/gi, label: "bahnbrechend" },
  { pattern: /\bsynergetisch(e|er|es|en)?\b/gi, label: "synergetisch" },
  { pattern: /\bOperational\s+Leverage\b/gi, label: "Operational Leverage" },
  { pattern: /\bHebelwirkung\b/gi, label: "Hebelwirkung" },
  { pattern: /\bSynergiepotenziale\b/gi, label: "Synergiepotenziale" },
  { pattern: /\bSynergien\b/gi, label: "Synergien" },
  { pattern: /\bganzheitlich(e|er|es|en)?(?=\s|[.,;:!?)])/gi, replacement: "", label: "ganzheitlich" },
  { pattern: /\bfederführend(e|er|es|en)?(?=\s|[.,;:!?)])/gi, replacement: "", label: "federführend" },
  { pattern: /\bnahtlos(e|er|es|en)?(?=\s|[.,;:!?)])/gi, replacement: "", label: "nahtlos" },
  // Spanish AI buzzwords
  { pattern: /\borquestó\b/gi, label: "orquestó" },
  { pattern: /\borquesté\b/gi, label: "orquesté" },
  { pattern: /\borquestar\b/gi, label: "orquestar" },
  { pattern: /\brevolucionó\b/gi, label: "revolucionó" },
  { pattern: /\bapalancar\b/gi, label: "apalancar" },
  { pattern: /\bapalancando\b/gi, label: "apalancando" },
  { pattern: /\bholístico\b/gi, label: "holístico" },
  { pattern: /\bsinérgicamente\s+/gi, replacement: "", label: "sinérgicamente" },
  { pattern: /\bimpecablemente\s+/gi, replacement: "", label: "impecablemente" },
];

/**
 * Removes filler and applies only equivalent wording simplifications. Patterns
 * without a replacement are detection-only: their meaning needs human review.
 */
export function sanitizeAiText(text: string): string {
  if (!text) return "";
  let out = text;

  // 1. Strip adverb + conjunction pairs BEFORE stripping standalone adverbs
  // Prevents "interact seamlessly and efficiently" -> "interact and efficiently"
  out = out
    .replace(/\b(seamlessly|holistically|meticulously|relentlessly|tirelessly|nahtlos|federführend|impecablemente|ganzheitlich)\s+(and|or|und|oder|y|o)\s+/gi, "")
    .replace(/\s+(and|or|und|oder|y|o)\s+(seamlessly|holistically|meticulously|relentlessly|tirelessly|nahtlos|federführend|impecablemente|ganzheitlich)\b/gi, "");

  for (const { pattern, replacement } of AI_CLICHE_PATTERNS) {
    if (replacement === undefined) continue;
    out = out.replace(pattern, (match) => {
      if (!replacement) return "";
      const isCapitalized = match[0] === match[0].toUpperCase() && match[0] !== match[0].toLowerCase();
      if (isCapitalized) {
        return replacement.charAt(0).toUpperCase() + replacement.slice(1);
      }
      return replacement;
    });
  }

  // Repair any legacy dangling "interact and efficiently" / "operate and reliably"
  out = out.replace(
    /\b(interact|work|operate|function|collaborate|integrate|scale|execute)\s+and\s+(efficiently|effectively|reliably|accurately|securely|smoothly)\b/gi,
    "$1 $2"
  );

  // Repair German Anglicisms
  out = out
    .replace(/\boperative\s+Execution\b/g, "operative Umsetzung")
    .replace(/\boperativen\s+Execution\b/g, "operativen Umsetzung");

  // Repair whitespace/punctuation left behind after stripped adverbs
  out = out
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/,\s*([.!?])/g, "$1")
    .replace(/,\s*,+/g, ",")
    .replace(/\.\s*\.+/g, ".");

  // Ensure sentence starts with a capital letter if a leading adverb was stripped
  out = out
    .replace(/^\s*([a-zäöüßáéíóú])/, (_, c) => c.toUpperCase())
    .replace(/([.!?]\s+)([a-zäöüßáéíóú])/g, (_, sep, c) => sep + c.toUpperCase());
  return out.replace(/\s{2,}/g, " ").trim();
}



const STOPWORDS = new Set([
  "with", "from", "that", "this", "into", "over", "across", "through", "while", "using",
  "used", "under", "between", "within", "including", "their", "your", "para", "como",
  "entre", "desde", "sobre", "durch", "über", "unter", "sowie", "oder", "und", "the", "and", "for"
]);

function getSignificantTokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/\*\*/g, "")
    .replace(/[^\p{L}\p{N}\s%]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !STOPWORDS.has(w));
}

export function computeTokenOverlap(a: string, b: string): number {
  const tokensA = getSignificantTokens(a);
  const tokensB = new Set(getSignificantTokens(b));
  if (tokensA.length === 0 || tokensB.size === 0) return 0;
  let shared = 0;
  for (const t of tokensA) {
    if (tokensB.has(t)) shared++;
  }
  return shared / Math.min(tokensA.length, tokensB.size);
}





/**
 * Deduplicates identical achievement entries. The public function name is kept
 * for compatibility; overlap with experience is reported, never rewritten here.
 */
export function deduplicateAchievementsAgainstExperience(app: Application): void {
  const achievements = (app.cvContent.keyAchievements || []).filter(Boolean);
  const seen = new Set<string>();
  app.cvContent.keyAchievements = achievements.filter((achievement) => {
    const normalized = achievement.toLowerCase().replace(/\*\*/g, "").trim();
    if (seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
  // The editorial limit applies only to achievements supplied by an import (see
  // normalizeImportedAIJson); inherited or manual achievements are never truncated here.
  // Repetition across sections is a readiness warning. Rewriting or replacing
  // a tailored experience bullet here would change the evidence selected for the job.
}

/**
 * Cleans CV and letter wording without changing the selected actions, metrics,
 * responsibilities or order. Potentially non-equivalent clichés remain reviewable.
 */
export function sanitizeApplicationAiContent(app: Application): Application {
  const copy = JSON.parse(JSON.stringify(app)) as Application;
  copy.cvContent.header.headline = sanitizeAiText(copy.cvContent.header.headline);
  copy.cvContent.professionalProfile = sanitizeAiText(copy.cvContent.professionalProfile);
  copy.cvContent.keyAchievements = (copy.cvContent.keyAchievements || []).map(sanitizeAiText);
  copy.cvContent.experience = (copy.cvContent.experience || []).map((exp) => ({
    ...exp,
    ...(typeof exp.summary === "string" ? { summary: sanitizeAiText(exp.summary) } : {}),
    bullets: (exp.bullets || []).map(sanitizeAiText),
  }));
  copy.cvContent.projects = (copy.cvContent.projects || []).map((proj) => ({
    ...proj,
    description: proj.description ? sanitizeAiText(proj.description) : proj.description,
    bullets: (proj.bullets || []).map(sanitizeAiText),
  }));
  if (copy.coverLetterContent.subjectLine) {
    copy.coverLetterContent.subjectLine = sanitizeAiText(copy.coverLetterContent.subjectLine);
  }
  copy.coverLetterContent.positioningLine = sanitizeAiText(copy.coverLetterContent.positioningLine);
  copy.coverLetterContent.paragraphs = (copy.coverLetterContent.paragraphs || []).map((p) => ({
    ...p,
    text: sanitizeAiText(p.text),
  }));
  if (copy.roleClassification?.recommendedPositioning) {
    copy.roleClassification.recommendedPositioning = sanitizeAiText(
      copy.roleClassification.recommendedPositioning
    );
  }
  if (copy.fitAssessment?.summary) {
    copy.fitAssessment.summary = sanitizeAiText(copy.fitAssessment.summary);
  }
  if (copy.formFieldAnswers) {
    copy.formFieldAnswers = {
      ...copy.formFieldAnswers,
      shortMotivationMessage: sanitizeAiText(copy.formFieldAnswers.shortMotivationMessage),
      whyThisRole: sanitizeAiText(copy.formFieldAnswers.whyThisRole),
      whyThisCompany: sanitizeAiText(copy.formFieldAnswers.whyThisCompany),
      additionalMessage: sanitizeAiText(copy.formFieldAnswers.additionalMessage),
      degreeExplanation: sanitizeAiText(copy.formFieldAnswers.degreeExplanation),
    };
  }
  deduplicateAchievementsAgainstExperience(copy);
  return copy;
}
