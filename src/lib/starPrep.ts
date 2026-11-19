import type { Application } from "@/lib/schemas";
import type { DocLang } from "@/lib/localization";

export interface StarStoryCard {
  id: string;
  question: string;
  achievementSource: string;
  relevanceHint: string;
  keywordsToWeave: string[];
  situation: string;
  task: string;
  action: string;
  result: string;
  sourceId?: string;
  sourceKind?: "achievement" | "experience" | "project";
  incompleteFields?: Array<"situation" | "task" | "action" | "result">;
}

export interface ConcernNeutralizerCard {
  id: string;
  concern: string;
  probeQuestion: string;
  howToNeutralize: string;
  sentenceToUse: string;
  source: "recruiterConcernHandling" | "degreeExplanation" | "mainRisk";
  sourceId?: string;
}

export interface SalaryDefenseData {
  hasSalaryData: boolean;
  recommendedRangeEUR: string;
  safeNumberEUR: string;
  ambitiousNumberEUR: string;
  riskComment: string;
  anchorScript: string;
  privateNotes?: string;
}

export interface TailoredInterviewQuestion {
  id: string;
  category: "Objection" | "STAR Story" | "Company Fit" | "Compensation";
  categoryLabel?: string;
  prompt: string;
  context?: string;
  suggestedAnswer: string;
  keyBullets: string[];
}

export interface StarPrepData {
  lang: DocLang;
  elevatorPitch: string;
  careerArcSummary?: string;
  bestAngles: string[];
  mustIncludeKeywords: string[];
  concerns: ConcernNeutralizerCard[];
  stories: StarStoryCard[];
  questionsToAsk: string[];
  callSurvivalNotes: string[];
  salaryDefense: SalaryDefenseData;
  drillDeck: TailoredInterviewQuestion[];
  roleTypeLabel?: string;
  applyDecisionLabel?: string;
}

const TEXT = {
  English: {
    source: "Original source quotation", context: "Recorded context", relation: "Discuss the connection to this requirement",
    missingSituation: "To complete: what was the specific situation, and when did it occur? The source does not describe it separately.",
    missingTask: "To complete: what were you personally asked to do? Separate your responsibility from the team's work.",
    missingResult: "To complete: what outcome can you substantiate? No separate measured result is recorded; do not invent a figure.",
    missingPitch: "To complete: select one documented capability and explain its relevance to this posting.",
    missingRelation: "To complete: explain whether and how this documented example relates to the posting.",
    storyQuestion: "How would you describe this documented example using situation, task, action and result?",
    concernQuestion: "How would you address this recorded concern using only documented facts?",
    concernReview: "Confirm the requirement and your actual evidence. State any unresolved gap plainly; do not promise a qualification you do not have.",
    degree: "Recorded education and qualification limits", degreeQuestion: "If asked, how would you describe your verified education and its limits accurately?",
    companyQuestion: "Which stated need in this posting connects to your documented experience?",
    companyMissing: "To complete: cite a stated employer need and choose a documented example; do not invent company facts.",
    salaryQuestion: "What salary expectation have you recorded for this application?", salaryStatement: "My recorded salary expectation is",
    recordedRange: "Recorded range", situation: "Situation", task: "Task", action: "Action", result: "Result",
    categories: { Objection: "Recorded concern", "STAR Story": "STAR example", "Company Fit": "Connection to the posting", Compensation: "Salary discussion" },
    roles: { coreTarget: "Core target", bridgeRole: "Transition role", stretchRole: "Stretch role", stabilityRole: "Stability role", alternativeRole: "Alternative role" },
    decisions: { Apply: "Apply", "Apply selectively": "Apply selectively", Skip: "Skip" },
  },
  German: {
    source: "Originalzitat aus der Quelle", context: "Dokumentierter Kontext", relation: "Bezug zu dieser Anforderung erläutern",
    missingSituation: "Noch zu ergänzen: Wie war die konkrete Ausgangslage und wann trat sie auf? Die Quelle beschreibt sie nicht gesondert.",
    missingTask: "Noch zu ergänzen: Was war Ihre persönliche Aufgabe? Trennen Sie Ihre Verantwortung von der Arbeit des Teams.",
    missingResult: "Noch zu ergänzen: Welches Ergebnis können Sie belegen? Ein gesondertes Messergebnis ist nicht dokumentiert; keine Zahl erfinden.",
    missingPitch: "Noch zu ergänzen: Wählen Sie eine dokumentierte Fähigkeit und erläutern Sie deren Bezug zur Ausschreibung.",
    missingRelation: "Noch zu ergänzen: Erläutern Sie, ob und wie dieses dokumentierte Beispiel zur Ausschreibung passt.",
    storyQuestion: "Wie würden Sie dieses dokumentierte Beispiel nach Ausgangslage, Aufgabe, Handlung und Ergebnis erläutern?",
    concernQuestion: "Wie würden Sie diesen dokumentierten Vorbehalt anhand belegbarer Fakten ansprechen?",
    concernReview: "Prüfen Sie die Anforderung und Ihre tatsächlichen Belege. Benennen Sie offene Lücken, ohne eine fehlende Qualifikation zu versprechen.",
    degree: "Dokumentierte Ausbildung und Qualifikationsgrenzen", degreeQuestion: "Wie würden Sie auf Nachfrage Ihre belegte Ausbildung und deren Grenzen sachlich erläutern?",
    companyQuestion: "Welche ausdrücklich genannte Anforderung passt zu Ihrer dokumentierten Erfahrung?",
    companyMissing: "Noch zu ergänzen: Zitieren Sie eine genannte Anforderung und wählen Sie einen Beleg; keine Unternehmensfakten erfinden.",
    salaryQuestion: "Welche Gehaltsvorstellung haben Sie für diese Bewerbung festgehalten?", salaryStatement: "Meine festgehaltene Gehaltsvorstellung beträgt",
    recordedRange: "Dokumentierter Rahmen", situation: "Ausgangslage", task: "Aufgabe", action: "Handlung", result: "Ergebnis",
    categories: { Objection: "Dokumentierter Vorbehalt", "STAR Story": "STAR-Beispiel", "Company Fit": "Bezug zur Ausschreibung", Compensation: "Gehaltsgespräch" },
    roles: { coreTarget: "Kernzielrolle", bridgeRole: "Übergangsrolle", stretchRole: "Rolle mit erhöhten Anforderungen", stabilityRole: "Stabilitätsrolle", alternativeRole: "Alternative Rolle" },
    decisions: { Apply: "Bewerben", "Apply selectively": "Gezielt bewerben", Skip: "Auslassen" },
  },
  Spanish: {
    source: "Cita original de la fuente", context: "Contexto documentado", relation: "Explica la conexión con este requisito",
    missingSituation: "Por completar: ¿cuál era la situación concreta y cuándo ocurrió? La fuente no la describe por separado.",
    missingTask: "Por completar: ¿qué se te pidió personalmente? Separa tu responsabilidad del trabajo del equipo.",
    missingResult: "Por completar: ¿qué resultado puedes respaldar? No consta un resultado medido por separado; no inventes una cifra.",
    missingPitch: "Por completar: elige una capacidad documentada y explica su relación con esta oferta.",
    missingRelation: "Por completar: explica si este ejemplo documentado responde a la oferta y cómo.",
    storyQuestion: "¿Cómo explicarías este ejemplo documentado mediante situación, tarea, acción y resultado?",
    concernQuestion: "¿Cómo abordarías esta duda registrada usando solo hechos documentados?",
    concernReview: "Confirma el requisito y tus evidencias reales. Expón las brechas pendientes sin prometer una cualificación que no tienes.",
    degree: "Formación documentada y límites de la cualificación", degreeQuestion: "Si te preguntan, ¿cómo explicarías con precisión tu formación verificada y sus límites?",
    companyQuestion: "¿Qué necesidad explícita de esta oferta conecta con tu experiencia documentada?",
    companyMissing: "Por completar: cita una necesidad de la oferta y elige una evidencia; no inventes hechos sobre la empresa.",
    salaryQuestion: "¿Qué expectativa salarial has registrado para esta candidatura?", salaryStatement: "Mi expectativa salarial registrada es",
    recordedRange: "Rango registrado", situation: "Situación", task: "Tarea", action: "Acción", result: "Resultado",
    categories: { Objection: "Duda registrada", "STAR Story": "Ejemplo STAR", "Company Fit": "Conexión con la oferta", Compensation: "Conversación salarial" },
    roles: { coreTarget: "Objetivo principal", bridgeRole: "Puesto de transición", stretchRole: "Puesto de mayor exigencia", stabilityRole: "Puesto de estabilidad", alternativeRole: "Puesto alternativo" },
    decisions: { Apply: "Postular", "Apply selectively": "Postular selectivamente", Skip: "Descartar" },
  },
} as const;

function normalized(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^\p{L}\p{N}+#]+/gu, " ").replace(/\s+/g, " ").trim();
}

function contains(text: string, phrase: string): boolean {
  const value = normalized(phrase);
  return Boolean(value && ` ${normalized(text)} `.includes(` ${value} `));
}

function original(text: string, lang: DocLang): string {
  return `${TEXT[lang].source}: “${text}”`;
}

interface StorySource {
  id: string;
  kind: NonNullable<StarStoryCard["sourceKind"]>;
  text: string;
  context: string;
}

function selectedSources(data: Application): StorySource[] {
  const cv = data.cvContent;
  const sources: StorySource[] = [];
  if (data.templateSettings.showKeyAchievements !== false) {
    cv.keyAchievements.forEach((text, index) => { if (text.trim()) sources.push({ id: `cvContent.keyAchievements[${index}]`, kind: "achievement", text, context: "" }); });
  }
  for (const entry of cv.experience.filter((entry) => entry.include !== false)) {
    const context = [entry.jobTitle, entry.company, entry.location, entry.dates].filter(Boolean).join(" · ");
    for (const text of entry.bullets) if (text.trim()) sources.push({ id: entry.id, kind: "experience", text, context });
    if (!entry.bullets.some((text) => text.trim()) && entry.summary?.trim()) sources.push({ id: entry.id, kind: "experience", text: entry.summary, context });
  }
  if (data.templateSettings.showProjects !== false) {
    for (const entry of cv.projects.filter((entry) => entry.include !== false)) {
      const context = [entry.title, entry.role, entry.dates].filter(Boolean).join(" · ");
      for (const text of entry.bullets) if (text.trim()) sources.push({ id: entry.id, kind: "project", text, context });
      if (!entry.bullets.some((text) => text.trim()) && entry.description.trim()) sources.push({ id: entry.id, kind: "project", text: entry.description, context });
    }
  }
  const seen = new Set<string>();
  return sources.filter((source) => {
    const key = `${source.id}:${normalized(source.text)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function mappedRequirements(data: Application, source?: StorySource) {
  return (data.jobAnalysis?.requirements || []).filter((requirement) =>
    contains(data.jobDescription || "", requirement.sourceQuote) &&
    (!source || requirement.evidence.some((evidence) => (evidence.sourceId === source.id || (source.kind === "achievement" && /^achievementsPool\[\d+\]$/.test(evidence.sourceId))) && contains(source.text, evidence.quote)))
  );
}

function buildStory(source: StorySource, index: number, data: Application, lang: DocLang): StarStoryCard {
  const labels = TEXT[lang];
  const requirements = mappedRequirements(data, source);
  const keywords = [...new Set(requirements.flatMap((requirement) => requirement.keywords))].filter((keyword) => contains(source.text, keyword));
  const hasRecordedResult = /\d+(?:[.,]\d+)?\s*%(?!\w)|\d+(?:[.,]\d+)?\s*(?:percent|prozent|por ciento|seconds?|secs?|sekunden?|segundos?|minutes?|minuten?|minutos?|hours?|stunden?|horas?)\b|(?:€|\$|£)\s*\d|\d\s*(?:€|EUR|USD)\b|\b\d+\+\s*(?:SOPs?|processes|Prozesse|procesos)\b/i.test(source.text);
  const incompleteFields: NonNullable<StarStoryCard["incompleteFields"]> = ["situation", "task"];
  if (!hasRecordedResult) incompleteFields.push("result");
  return {
    id: `story-${index}`,
    sourceId: source.id,
    sourceKind: source.kind,
    achievementSource: source.text,
    question: labels.storyQuestion,
    relevanceHint: requirements.length ? `${labels.relation}: ${requirements.map((requirement) => `“${requirement.sourceQuote}”`).join("; ")}` : labels.missingRelation,
    keywordsToWeave: keywords.slice(0, 3),
    situation: source.context ? `${labels.context}: ${source.context}. ${labels.missingSituation}` : labels.missingSituation,
    task: labels.missingTask,
    action: original(source.text, lang),
    // A source can contain action and outcome together. Quote it intact rather
    // than inventing an S/T/A/R decomposition or changing its metric/ownership.
    result: hasRecordedResult ? original(source.text, lang) : labels.missingResult,
    incompleteFields,
  };
}

/** Purely derives preparation from this application's recorded content. No live
 * Master CV, browser state, clock, model call or fixed biography is consulted. */
export function buildStarPrepData(data: Application): StarPrepData {
  const lang: DocLang = data.language === "German" || data.language === "Spanish" ? data.language : "English";
  const labels = TEXT[lang];
  const requirements = mappedRequirements(data);
  const requirementKeywords = requirements.flatMap((requirement) => requirement.keywords);
  const strategyKeywords = data.keywordStrategy?.mustIncludeATSKeywords || [];
  const mustIncludeKeywords = [...new Set([...requirementKeywords, ...strategyKeywords])].filter((keyword) => contains(data.jobDescription || "", keyword));
  const bestAngles = (data.fitAssessment?.bestAngles || []).filter((text) => text.trim()).map((text) => original(text, lang));
  const pitch = data.cvContent.professionalProfile?.trim() || data.jobAnalysis?.positioningThesis?.trim() || data.qualityControl?.oneSentencePositioning?.trim();
  const elevatorPitch = pitch ? original(pitch, lang) : labels.missingPitch;

  const concerns: ConcernNeutralizerCard[] = [];
  const addConcern = (item: ConcernNeutralizerCard) => {
    if (concerns.some((existing) => normalized(existing.concern) === normalized(item.concern))) return;
    concerns.push(item);
  };
  (data.recruiterConcernHandling?.likelyConcerns || []).forEach((item, index) => {
    if (!item.concern.trim() && !item.howToNeutralize.trim() && !item.sentenceToUse.trim()) return;
    addConcern({
      id: `concern-${index}`, concern: item.concern ? original(item.concern, lang) : labels.concernQuestion,
      probeQuestion: labels.concernQuestion,
      howToNeutralize: item.howToNeutralize ? original(item.howToNeutralize, lang) : labels.concernReview,
      sentenceToUse: item.sentenceToUse ? original(item.sentenceToUse, lang) : "",
      source: "recruiterConcernHandling", sourceId: `recruiterConcernHandling.likelyConcerns[${index}]`,
    });
  });
  if (data.formFieldAnswers?.degreeExplanation?.trim()) {
    addConcern({ id: "concern-degree", concern: labels.degree, probeQuestion: labels.degreeQuestion,
      howToNeutralize: labels.concernReview, sentenceToUse: original(data.formFieldAnswers.degreeExplanation, lang),
      source: "degreeExplanation", sourceId: "formFieldAnswers.degreeExplanation" });
  }
  const risks = [...(data.fitAssessment?.mainRisks || []), ...(data.jobAnalysis?.eligibility.unmetRequirements || [])];
  risks.forEach((risk, index) => {
    if (!risk.trim()) return;
    addConcern({ id: `risk-${index}`, concern: original(risk, lang), probeQuestion: labels.concernQuestion,
      howToNeutralize: labels.concernReview, sentenceToUse: "", source: "mainRisk" });
  });
  requirements.filter((requirement) => requirement.priority === "must_have" && ["gap", "unknown"].includes(requirement.evidenceLevel)).forEach((requirement) => {
    addConcern({ id: `requirement-${requirement.id}`, concern: original(requirement.sourceQuote, lang), probeQuestion: labels.concernQuestion,
      howToNeutralize: labels.concernReview, sentenceToUse: "", source: "mainRisk", sourceId: `jobAnalysis.requirements[${requirement.id}]` });
  });

  const weight = { must_have: 3, important: 2, nice_to_have: 1 };
  const ranked = selectedSources(data).map((source, index) => ({ source, index,
    priority: mappedRequirements(data, source).reduce((total, requirement) => total + weight[requirement.priority], 0) }));
  ranked.sort((a, b) => b.priority - a.priority || a.index - b.index);
  const structuredStories: StarStoryCard[] = (data.interviewPrep?.starStories || [])
    .filter((s) => s.title.trim() && (s.situation.trim() || s.action.trim() || s.result.trim()))
    .map((s, idx) => ({
      id: `structured-${idx}`,
      sourceId: s.sourceId,
      achievementSource: s.title,
      question: s.title,
      relevanceHint: labels.relation,
      keywordsToWeave: (s.keywords || []).slice(0, 4),
      situation: s.situation || labels.missingSituation,
      task: s.task || labels.missingTask,
      action: s.action || labels.context,
      result: s.result || labels.missingResult,
    }));
  const fallbackStories = ranked.slice(0, 6).map(({ source }, index) => buildStory(source, index, data, lang));
  const stories = structuredStories.length > 0 ? structuredStories.slice(0, 6) : fallbackStories;
  const careerArcSummary = data.interviewPrep?.careerArcSummary?.trim() || undefined;
  const questionsToAsk = (data.interviewPrep?.questionsToAsk || []).map((q) => q.trim()).filter(Boolean);
  const callSurvivalNotes = (data.interviewPrep?.callSurvivalNotes || []).map((n) => n.trim()).filter(Boolean);

  const sp = data.salaryPositioning;
  const range = (sp?.recommendedRangeEUR || "").trim();
  const safe = (sp?.safeNumberEUR || "").trim();
  const ambitious = (sp?.ambitiousNumberEUR || "").trim();
  const privateNotes = (sp?.riskComment || "").trim();
  // A private floor is not automatically a proposed spoken anchor.
  const target = range || ambitious;
  const salaryDefense: SalaryDefenseData = {
    hasSalaryData: Boolean(range || safe || ambitious), recommendedRangeEUR: range, safeNumberEUR: safe, ambitiousNumberEUR: ambitious,
    riskComment: privateNotes, privateNotes,
    anchorScript: target ? `${labels.salaryStatement} ${target}.` : "",
  };

  const drillDeck: TailoredInterviewQuestion[] = concerns.map((concern) => ({
    id: `drill-${concern.id}`, category: "Objection", categoryLabel: labels.categories.Objection,
    prompt: concern.probeQuestion, context: concern.concern, suggestedAnswer: concern.sentenceToUse || concern.howToNeutralize,
    keyBullets: [concern.howToNeutralize].filter(Boolean),
  }));
  const motivation = data.formFieldAnswers?.whyThisCompany?.trim() || data.formFieldAnswers?.whyThisRole?.trim();
  if (motivation || data.jobAnalysis?.employerPriorities.length) {
    drillDeck.push({ id: "drill-company-fit", category: "Company Fit", categoryLabel: labels.categories["Company Fit"],
      prompt: labels.companyQuestion, suggestedAnswer: motivation ? original(motivation, lang) : labels.companyMissing,
      keyBullets: (data.jobAnalysis?.employerPriorities || []).map((priority) => original(priority, lang)),
    });
  }
  stories.forEach((story) => {
    drillDeck.push({ id: `drill-${story.id}`, category: "STAR Story", categoryLabel: labels.categories["STAR Story"],
      prompt: story.question, context: story.relevanceHint, suggestedAnswer: story.action,
      keyBullets: [`${labels.situation}: ${story.situation}`, `${labels.task}: ${story.task}`, `${labels.action}: ${story.action}`, `${labels.result}: ${story.result}`],
    });
  });
  if (salaryDefense.anchorScript) {
    drillDeck.push({ id: "drill-salary", category: "Compensation", categoryLabel: labels.categories.Compensation,
      prompt: labels.salaryQuestion, context: `${labels.recordedRange}: ${target}`, suggestedAnswer: salaryDefense.anchorScript,
      keyBullets: [],
    });
  }

  return { lang, elevatorPitch, careerArcSummary, bestAngles, mustIncludeKeywords, concerns, stories, questionsToAsk, callSurvivalNotes, salaryDefense, drillDeck,
    roleTypeLabel: labels.roles[data.roleClassification.type], applyDecisionLabel: labels.decisions[data.fitAssessment.applyOrSkip] };
}
