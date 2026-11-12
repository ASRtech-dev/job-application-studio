import { ApplicationSchema, type Application, type ExperienceEntry, type ProjectEntry, type SkillGroup } from "./schemas";

function cleanKeyword(kw: string): string {
  if (!kw || typeof kw !== "string") return "";
  return cleanPlainField(kw).replace(/^[-•·*]\s*/, "").trim();
}

export function cleanScrapedTitleOrCompany(raw: string): string {
  if (!raw || typeof raw !== "string") return "";
  return raw
    .replace(/\b\d+(\.\d+)?\s+\d+(\.\d+)?\s+out of\s+\d+\s+stars\b/gi, "")
    .replace(/\b\d+(\.\d+)?\s+out of\s+\d+\s+stars\b/gi, "")
    .replace(/\b(working from home|permanent position|full-time|part-time)\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function cleanPlainField(text: string): string {
  if (!text || typeof text !== "string") return "";
  return text
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function cleanUrlField(text: string): string {
  if (!text || typeof text !== "string") return "";
  const mdMatch = text.match(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/);
  if (mdMatch) {
    return mdMatch[2].trim();
  }
  return text.trim();
}

export function cleanRichTextField(text: string): string {
  if (!text || typeof text !== "string") return "";
  return text
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, "$1")
    .replace(/^[\s]*[-•·]\s+/, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

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

function matchExperienceEntry(
  jExp: any,
  existingList: ExperienceEntry[],
  usedIds: Set<string>
): ExperienceEntry | undefined {
  const rawId = String(jExp.id || "").toLowerCase().trim();
  if (rawId) {
    const byId = existingList.find((e) => e.id.toLowerCase() === rawId && !usedIds.has(e.id));
    if (byId) return byId;
  }

  const rawTitle = String(jExp.jobTitle || jExp.title || jExp.role || "").toLowerCase().trim();
  const rawCompany = String(jExp.company || "").toLowerCase().trim();

  if (rawTitle) {
    const normalizeTitle = (t: string) => t.replace(/[—–-]/g, " ").replace(/\s+/g, " ").trim();
    const normRaw = normalizeTitle(rawTitle);
    const byTitle = existingList.find((e) => {
      if (usedIds.has(e.id)) return false;
      const normExisting = normalizeTitle(e.jobTitle.toLowerCase());
      return normExisting === normRaw || normExisting.includes(normRaw) || normRaw.includes(normExisting);
    });
    if (byTitle) return byTitle;
  }

  if (rawCompany) {
    const companyMatches = existingList.filter(
      (e) =>
        !usedIds.has(e.id) &&
        (e.company.toLowerCase().includes(rawCompany) || rawCompany.includes(e.company.toLowerCase()))
    );
    if (companyMatches.length === 1) {
      return companyMatches[0];
    }
  }

  return undefined;
}

function normalizeCoreSkills(rawSkills: any): SkillGroup[] | null {
  if (!rawSkills) return null;

  let groups: SkillGroup[] = [];

  if (Array.isArray(rawSkills)) {
    groups = rawSkills
      .map((item: any) => {
        if (!item) return null;
        if (typeof item === "string") {
          const parts = item.split(":");
          if (parts.length >= 2) {
            return {
              group: cleanPlainField(parts[0]),
              skills: parts
                .slice(1)
                .join(":")
                .split(/\s*[|,;•·]\s*/)
                .map(cleanPlainField)
                .filter(Boolean),
            };
          }
          return {
            group: "Core Competencies",
            skills: item.split(/\s*[|,;•·]\s*/).map(cleanPlainField).filter(Boolean),
          };
        }
        if (typeof item === "object") {
          const groupName = cleanPlainField(item.group || item.category || item.name || item.title || "Skills");
          const rawList = Array.isArray(item.skills)
            ? item.skills
            : Array.isArray(item.items)
            ? item.items
            : typeof item.skills === "string"
            ? [item.skills]
            : [];
          const expandedSkills = rawList
            .flatMap((s: any) => String(s || "").split(/\s*[|;•]\s*/))
            .map((s: string) => cleanPlainField(s))
            .filter(Boolean);
          return { group: groupName, skills: expandedSkills };
        }
        return null;
      })
      .filter((g): g is SkillGroup => Boolean(g && g.skills.length > 0));
  } else if (typeof rawSkills === "object") {
    groups = Object.entries(rawSkills)
      .map(([key, val]) => {
        const groupName = cleanPlainField(
          key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
        );
        const rawList = Array.isArray(val) ? val : typeof val === "string" ? [val] : [];
        const expandedSkills = rawList
          .flatMap((s: any) => String(s || "").split(/\s*[|;•]\s*/))
          .map((s: string) => cleanPlainField(s))
          .filter(Boolean);
        return { group: groupName, skills: expandedSkills };
      })
      .filter((g) => g.skills.length > 0);
  }

  if (groups.length === 0) return null;

  const seenGlobal = new Set<string>();
  return groups.slice(0, 4).map((g) => {
    const uniqueSkills: string[] = [];
    for (const sk of g.skills) {
      const cleaned = sk
        .replace(/\s+(Adaptability|Learning Readiness|Awareness)$/i, "")
        .trim();
      const key = cleaned.toLowerCase();
      if (cleaned && !seenGlobal.has(key)) {
        seenGlobal.add(key);
        uniqueSkills.push(cleaned);
      }
    }
    return {
      group: g.group,
      skills: uniqueSkills.slice(0, 6),
    };
  }).filter((g) => g.skills.length > 0);
}

const AI_CLICHE_PATTERNS: Array<{ pattern: RegExp; replacement: string; label: string }> = [
  { pattern: /\bspearheaded\b/gi, replacement: "led", label: "spearheaded" },
  { pattern: /\bspearheading\b/gi, replacement: "leading", label: "spearheading" },
  { pattern: /\borchestrated\b/gi, replacement: "built", label: "orchestrated" },
  { pattern: /\borchestrating\b/gi, replacement: "coordinating", label: "orchestrating" },
  { pattern: /\bsynergized\b/gi, replacement: "aligned", label: "synergized" },
  { pattern: /\bcatalyzed\b/gi, replacement: "accelerated", label: "catalyzed" },
  { pattern: /\brevolutionized\b/gi, replacement: "redesigned", label: "revolutionized" },
  { pattern: /\bpioneered\b/gi, replacement: "launched", label: "pioneered" },
  { pattern: /\bleveraged\b/gi, replacement: "used", label: "leveraged" },
  { pattern: /\bleveraging\b/gi, replacement: "using", label: "leveraging" },
  { pattern: /\butilized\b/gi, replacement: "used", label: "utilized" },
  { pattern: /\butilizing\b/gi, replacement: "using", label: "utilizing" },
  { pattern: /\bdelved into\b/gi, replacement: "analyzed", label: "delved into" },
  { pattern: /\bdelving into\b/gi, replacement: "analyzing", label: "delving into" },
  { pattern: /\b(?:seamlessly|holistically|meticulously|relentlessly|tirelessly)\s+(?:and|or)\s+/gi, replacement: "", label: "adverb+conjunction" },
  { pattern: /\s+(?:and|or)\s+(?:seamlessly|holistically|meticulously|relentlessly|tirelessly)\b/gi, replacement: "", label: "conjunction+adverb" },
  { pattern: /\bseamlessly\s+/gi, replacement: "", label: "seamlessly" },
  { pattern: /\bholistically\s+/gi, replacement: "", label: "holistically" },
  { pattern: /\bmeticulously\s+/gi, replacement: "", label: "meticulously" },
  { pattern: /\brelentlessly\s+/gi, replacement: "", label: "relentlessly" },
  { pattern: /\btirelessly\s+/gi, replacement: "", label: "tirelessly" },
];

export function sanitizeAiText(text: string): string {
  if (!text) return "";
  let out = text;
  for (const { pattern, replacement } of AI_CLICHE_PATTERNS) {
    out = out.replace(pattern, (match) => {
      if (!replacement) return "";
      const isCapitalized = match[0] === match[0].toUpperCase() && match[0] !== match[0].toLowerCase();
      if (isCapitalized) {
        return replacement.charAt(0).toUpperCase() + replacement.slice(1);
      }
      return replacement;
    });
  }
  out = out.replace(
    /\b(interact|work|collaborate|communicate|operate|integrate)\s+and\s+(efficiently|effectively|accurately|reliably|autonomously|securely)\b/gi,
    "$1 $2"
  );
  out = out.replace(/^\s*([a-z])/, (_, c) => c.toUpperCase());
  return out.replace(/\s{2,}/g, " ").trim();
}

const CONSECUTIVE_VERB_ALTERNATIVES: Record<string, string[]> = {
  built: ["Architected", "Engineered", "Developed", "Implemented"],
  designed: ["Architected", "Structured", "Formulated", "Engineered"],
  created: ["Developed", "Established", "Produced", "Engineered"],
  developed: ["Engineered", "Built", "Implemented", "Architected"],
  implemented: ["Deployed", "Executed", "Operationalized", "Integrated"],
  led: ["Directed", "Steered", "Guided", "Managed"],
  managed: ["Directed", "Oversaw", "Governed", "Coordinated"],
};

export function deduplicateConsecutiveBulletVerbs(bullets: string[]): string[] {
  if (!Array.isArray(bullets) || bullets.length < 2) return bullets;
  const result: string[] = [];
  let prevVerb = "";
  let altCounter = 0;

  for (const bullet of bullets) {
    const match = bullet.match(/^([A-Za-zÀ-ÿ-]+)(\s+.*)$/);
    if (!match) {
      result.push(bullet);
      prevVerb = "";
      continue;
    }
    const firstWord = match[1];
    const rest = match[2];
    const lowerVerb = firstWord.toLowerCase();

    if (lowerVerb === prevVerb && CONSECUTIVE_VERB_ALTERNATIVES[lowerVerb]) {
      const alternatives = CONSECUTIVE_VERB_ALTERNATIVES[lowerVerb];
      const replacement = alternatives[altCounter % alternatives.length];
      altCounter++;
      result.push(`${replacement}${rest}`);
      prevVerb = replacement.toLowerCase();
    } else {
      result.push(bullet);
      prevVerb = lowerVerb;
    }
  }
  return result;
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

function computeTokenOverlap(a: string, b: string): number {
  const tokensA = getSignificantTokens(a);
  const tokensB = new Set(getSignificantTokens(b));
  if (tokensA.length === 0 || tokensB.size === 0) return 0;
  let shared = 0;
  for (const t of tokensA) {
    if (tokensB.has(t)) shared++;
  }
  return shared / Math.min(tokensA.length, tokensB.size);
}

export function deduplicateAchievementsAgainstExperience(app: Application): void {
  const achievements = app.cvContent.keyAchievements || [];
  if (achievements.length === 0) return;

  const expBullets = (app.cvContent.experience || [])
    .filter((e) => e.include !== false)
    .flatMap((e) => e.bullets || []);

  if (expBullets.length === 0) {
    app.cvContent.keyAchievements = achievements.slice(0, 4);
    return;
  }

  const scored = achievements.map((ach, idx) => {
    const maxOverlap = Math.max(0, ...expBullets.map((eb) => computeTokenOverlap(ach, eb)));
    return { ach, idx, maxOverlap };
  });

  const nonDuplicate = scored.filter((item) => item.maxOverlap < 0.88).map((item) => item.ach);
  const targetMin = Math.min(achievements.length, 3);

  if (nonDuplicate.length >= targetMin) {
    app.cvContent.keyAchievements = nonDuplicate.slice(0, 4);
  } else {
    const sortedByUniqueness = [...scored]
      .sort((a, b) => a.maxOverlap - b.maxOverlap || a.idx - b.idx)
      .slice(0, Math.min(achievements.length, 4))
      .sort((a, b) => a.idx - b.idx)
      .map((item) => item.ach);
    app.cvContent.keyAchievements = sortedByUniqueness;
  }
}

export function sanitizeApplicationAiContent(app: Application): Application {
  const copy = JSON.parse(JSON.stringify(app)) as Application;
  copy.cvContent.header.headline = sanitizeAiText(copy.cvContent.header.headline);
  copy.cvContent.professionalProfile = sanitizeAiText(copy.cvContent.professionalProfile);
  copy.cvContent.keyAchievements = deduplicateConsecutiveBulletVerbs(
    (copy.cvContent.keyAchievements || []).map(sanitizeAiText)
  );
  copy.cvContent.experience = (copy.cvContent.experience || []).map((exp) => ({
    ...exp,
    summary: exp.summary ? sanitizeAiText(exp.summary) : exp.summary,
    bullets: deduplicateConsecutiveBulletVerbs((exp.bullets || []).map(sanitizeAiText)),
  }));
  copy.cvContent.projects = (copy.cvContent.projects || []).map((proj) => ({
    ...proj,
    description: proj.description ? sanitizeAiText(proj.description) : proj.description,
    bullets: deduplicateConsecutiveBulletVerbs((proj.bullets || []).map(sanitizeAiText)),
  }));
  copy.coverLetterContent.positioningLine = sanitizeAiText(copy.coverLetterContent.positioningLine);
  copy.coverLetterContent.paragraphs = (copy.coverLetterContent.paragraphs || []).map((p) => ({
    ...p,
    text: sanitizeAiText(p.text),
  }));
  deduplicateAchievementsAgainstExperience(copy);
  return copy;
}

export function computeSmartAutoFitSettings(app: Application): {
  fontSize: number;
  lineSpacing: number;
  sectionSpacing: number;
} {
  const showAch = app.templateSettings?.showKeyAchievements !== false;
  const showProj = app.templateSettings?.showProjects !== false;

  const profileWords = (app.cvContent.professionalProfile || "").split(/\s+/).filter(Boolean).length;
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
  const bulletWords = allBullets.join(" ").split(/\s+/).filter(Boolean).length;
  const skillWords = (app.cvContent.coreSkills || [])
    .flatMap((g) => [g.group, ...(g.skills || [])])
    .join(" ")
    .split(/\s+/)
    .filter(Boolean).length;

  const totalWords = profileWords + bulletWords + skillWords + 65;
  const totalBullets = allBullets.length;

  if (totalWords <= 340 && totalBullets <= 10) {
    return { fontSize: 10.2, lineSpacing: 1.34, sectionSpacing: 13 };
  }
  if (totalWords <= 430 && totalBullets <= 13) {
    return { fontSize: 10, lineSpacing: 1.3, sectionSpacing: 11 };
  }
  if (totalWords <= 510 && totalBullets <= 16) {
    return { fontSize: 9.7, lineSpacing: 1.25, sectionSpacing: 10 };
  }
  return { fontSize: 9.4, lineSpacing: 1.22, sectionSpacing: 9 };
}

export function analyzeApplicationReadiness(app: Application): {
  totalCvWords: number;
  totalLetterWords: number;
  totalBullets: number;
  longBulletsCount: number;
  aiBuzzwordsFound: string[];
  duplicateAchievementsCount: number;
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
    (b) => b.replace(/\*\*/g, "").split(/\s+/).filter(Boolean).length > 20
  ).length;

  const cvFullText = [
    app.cvContent.header.headline,
    app.cvContent.professionalProfile,
    ...allBullets,
    ...(app.cvContent.coreSkills || []).flatMap((g) => [g.group, ...g.skills]),
  ].join(" ");

  const letterFullText = (app.coverLetterContent.paragraphs || []).map((p) => p.text).join(" ");

  const totalCvWords = cvFullText.split(/\s+/).filter(Boolean).length + 55;
  const totalLetterWords = letterFullText.split(/\s+/).filter(Boolean).length;

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
    if (maxOverlap >= 0.62) duplicateAchievementsCount++;
  }

  return {
    totalCvWords,
    totalLetterWords,
    totalBullets: allBullets.length,
    longBulletsCount,
    aiBuzzwordsFound,
    duplicateAchievementsCount,
  };
}

function localizeDateRange(dateStr: string, lang: "English" | "Spanish" | "German"): string {
  if (!dateStr) return "";
  if (lang === "German") {
    return dateStr
      .replace(/\bJan\b/g, "Jan.")
      .replace(/\bFeb\b/g, "Feb.")
      .replace(/\bMar\b/g, "März")
      .replace(/\bApr\b/g, "Apr.")
      .replace(/\bMay\b/g, "Mai")
      .replace(/\bJun\b/g, "Juni")
      .replace(/\bJul\b/g, "Juli")
      .replace(/\bAug\b/g, "Aug.")
      .replace(/\bSep\b/g, "Sep.")
      .replace(/\bOct\b/g, "Okt.")
      .replace(/\bNov\b/g, "Nov.")
      .replace(/\bDec\b/g, "Dez.")
      .replace(/\bPresent\b/gi, "Heute")
      .replace(/\bCurrent\b/gi, "Heute");
  }
  if (lang === "Spanish") {
    return dateStr
      .replace(/\bJan\b/g, "Ene.")
      .replace(/\bApr\b/g, "Abr.")
      .replace(/\bAug\b/g, "Ago.")
      .replace(/\bDec\b/g, "Dic.")
      .replace(/\bPresent\b/gi, "Actualidad")
      .replace(/\bCurrent\b/gi, "Actualidad");
  }
  return dateStr;
}

function localizeLocation(loc: string, lang: "English" | "Spanish" | "German"): string {
  if (!loc) return "";
  if (lang === "German") {
    return loc
      .replace(/\bBerlin,\s*Germany\b/gi, "Berlin, Deutschland")
      .replace(/\bGermany\b/gi, "Deutschland")
      .replace(/\bSpain\b/gi, "Spanien");
  }
  if (lang === "Spanish") {
    return loc
      .replace(/\bBerlin,\s*Germany\b/gi, "Berlín, Alemania")
      .replace(/\bGermany\b/gi, "Alemania")
      .replace(/\bSpain\b/gi, "España");
  }
  return loc;
}

function localizeProjectRole(role: string, lang: "English" | "Spanish" | "German"): string {
  if (!role) return "";
  if (lang === "German") {
    return role
      .replace(/\bAI Automation Engineer\b/gi, "KI-Automatisierungsingenieur")
      .replace(/\bLead Builder\b/gi, "Lead-Architekt & Entwickler")
      .replace(/\bCreator\s*&\s*Developer\b/gi, "Entwickler & Architekt")
      .replace(/\bCo-Creator\s*&\s*Product Builder\b/gi, "Co-Entwickler & Produktarchitekt");
  }
  if (lang === "Spanish") {
    return role
      .replace(/\bAI Automation Engineer\b/gi, "Ingeniero de Automatización IA")
      .replace(/\bLead Builder\b/gi, "Arquitecto y Desarrollador Principal")
      .replace(/\bCreator\s*&\s*Developer\b/gi, "Creador y Desarrollador")
      .replace(/\bCo-Creator\s*&\s*Product Builder\b/gi, "Co-Creador y Desarrollador de Producto");
  }
  return role;
}

function localizeApplicationFallbacks(app: Application): void {
  const lang = app.language;
  const roleLabel = app.roleTitle || app.coverLetterContent.roleTitle || "Open Position";

  if (app.coverLetterContent.greeting) {
    app.coverLetterContent.greeting = app.coverLetterContent.greeting
      .replace(/\bhiring team\b/g, "Hiring Team")
      .replace(/\brecruiting team\b/g, "Recruiting Team");
  }

  app.cvContent.header.location = localizeLocation(app.cvContent.header.location, lang);
  app.cvContent.experience = (app.cvContent.experience || []).map((exp) => ({
    ...exp,
    dates: localizeDateRange(exp.dates, lang),
    location: localizeLocation(exp.location, lang),
  }));
  app.cvContent.projects = (app.cvContent.projects || []).map((proj) => ({
    ...proj,
    dates: localizeDateRange(proj.dates, lang),
    role: localizeProjectRole(proj.role, lang),
  }));

  if (lang === "German") {
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
    if (app.cvContent.header.availability === "Available immediately") {
      app.cvContent.header.availability = "Sofort verfügbar";
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
    if (app.cvContent.header.availability === "Available immediately") {
      app.cvContent.header.availability = "Disponibilidad inmediata";
    }
  } else {
    if (!app.coverLetterContent.subjectLine) {
      app.coverLetterContent.subjectLine = `Application for ${roleLabel}`;
    }
  }
}

function normalizePriority(val: any): "low" | "medium" | "high" | "strategic" {
  const s = String(val || "").toLowerCase().trim();
  if (s.includes("strategic") || s.includes("veryhigh") || s.includes("very high") || s.includes("very_high")) return "strategic";
  if (s.includes("high")) return "high";
  if (s.includes("low")) return "low";
  return "medium";
}

function normalizeRisk(val: any): "Low" | "Medium" | "High" {
  const s = String(val || "").toLowerCase().trim();
  if (s === "low-medium" || s === "medium") return "Medium";
  if (s.includes("high")) return "High";
  return "Low";
}

export function normalizeImportedAIJson(raw: any, existing: Application, rawText?: string): Application {
  if (!raw || typeof raw !== "object") {
    throw new Error("Pasted JSON is not an object.");
  }

  const updated = JSON.parse(JSON.stringify(existing)) as Application;

  if (raw.company && typeof raw.company === "string") {
    updated.company = cleanScrapedTitleOrCompany(cleanPlainField(raw.company));
  }
  if (raw.roleTitle && typeof raw.roleTitle === "string") {
    updated.roleTitle = cleanScrapedTitleOrCompany(cleanPlainField(raw.roleTitle));
  }
  if (raw.jobLocation && typeof raw.jobLocation === "string") updated.jobLocation = cleanPlainField(raw.jobLocation);
  if (raw.workModel && typeof raw.workModel === "string") updated.workModel = cleanPlainField(raw.workModel);
  if (raw.status && typeof raw.status === "string") {
    const validStatuses = ["draft", "applied", "interviewing", "offered", "rejected", "archived", "reviewed", "exported"];
    if (validStatuses.includes(raw.status)) {
      updated.status = raw.status as any;
    }
  }

  updated.language = detectDocumentLanguage(raw, updated.language || "English");

  if (raw.jobDescription && typeof raw.jobDescription === "string") updated.jobDescription = raw.jobDescription;
  if (raw.notes && typeof raw.notes === "string") updated.notes = raw.notes;
  if (raw.recruiterContact && typeof raw.recruiterContact === "string") updated.recruiterContact = cleanPlainField(raw.recruiterContact);
  if (raw.salaryOffer && typeof raw.salaryOffer === "string") updated.salaryOffer = cleanPlainField(raw.salaryOffer);
  if (raw.interviewDate && typeof raw.interviewDate === "string") updated.interviewDate = raw.interviewDate;

  const sourceCv = raw.cvContent && typeof raw.cvContent === "object" ? raw.cvContent : raw;

  if (sourceCv.header && typeof sourceCv.header === "object") {
    updated.cvContent.header = {
      ...updated.cvContent.header,
      ...sourceCv.header,
    };
  }
  if (sourceCv.headline && typeof sourceCv.headline === "string") {
    updated.cvContent.header.headline = cleanPlainField(sourceCv.headline);
  }
  if (sourceCv.professionalProfile && typeof sourceCv.professionalProfile === "string") {
    updated.cvContent.professionalProfile = cleanRichTextField(sourceCv.professionalProfile);
  }
  if (sourceCv.keyAchievements && Array.isArray(sourceCv.keyAchievements)) {
    updated.cvContent.keyAchievements = sourceCv.keyAchievements
      .map((a: any) => cleanRichTextField(String(a)))
      .filter(Boolean)
      .slice(0, 4);
  }

  const normalizedSkills = normalizeCoreSkills(sourceCv.coreSkills || sourceCv.skills);
  if (normalizedSkills) {
    updated.cvContent.coreSkills = normalizedSkills;
  }

  const rawExpList = sourceCv.experience || sourceCv.professionalExperience;
  if (Array.isArray(rawExpList) && rawExpList.length > 0) {
    const usedIds = new Set<string>();
    const resultExperiences: ExperienceEntry[] = [];

    for (const jExp of rawExpList) {
      if (!jExp || typeof jExp !== "object") continue;
      if (jExp.include === false) continue;

      const matched = matchExperienceEntry(jExp, updated.cvContent.experience, usedIds);
      const rawBullets = Array.isArray(jExp.bullets)
        ? jExp.bullets.map((b: any) => cleanRichTextField(String(b))).filter(Boolean)
        : [];

      if (matched) {
        usedIds.add(matched.id);
        const bulletCap = resultExperiences.length === 0 ? 4 : 2;
        resultExperiences.push({
          ...matched,
          jobTitle: jExp.jobTitle ? cleanPlainField(jExp.jobTitle) : matched.jobTitle,
          company: jExp.company ? cleanPlainField(jExp.company) : matched.company,
          location: jExp.location ? cleanPlainField(jExp.location) : matched.location,
          dates: jExp.dates ? cleanPlainField(jExp.dates) : matched.dates,
          summary: typeof jExp.summary === "string" ? cleanRichTextField(jExp.summary) : "",
          bullets: rawBullets.length > 0 ? rawBullets.slice(0, bulletCap) : matched.bullets.slice(0, bulletCap),
        });
      } else if (jExp.company || jExp.jobTitle) {
        const newId = jExp.id || "exp_" + Math.random().toString(36).substring(2, 9);
        usedIds.add(newId);
        resultExperiences.push({
          id: newId,
          jobTitle: cleanPlainField(jExp.jobTitle || "Specialist"),
          company: cleanPlainField(jExp.company || ""),
          location: cleanPlainField(jExp.location || "City, Country"),
          dates: jExp.dates && jExp.dates !== "Dates" ? cleanPlainField(jExp.dates) : "",
          summary: jExp.summary ? cleanRichTextField(jExp.summary) : "",
          bullets: rawBullets.slice(0, 2),
        });
      }
    }

    if (resultExperiences.length > 0) {
      updated.cvContent.experience = resultExperiences;
    }
  }

  const rawProjList = sourceCv.projects || sourceCv.selectedProjects;
  if (Array.isArray(rawProjList) && rawProjList.length > 0) {
    const updatedProjects: ProjectEntry[] = [];
    for (const jProj of rawProjList) {
      if (!jProj || typeof jProj !== "object" || !jProj.title) continue;
      if (jProj.include === false) continue;

      const cleanBullets = Array.isArray(jProj.bullets)
        ? jProj.bullets.map((b: any) => cleanRichTextField(String(b))).filter(Boolean).slice(0, 2)
        : [];

      updatedProjects.push({
        id: jProj.id || "proj_" + Math.random().toString(36).substring(2, 9),
        title: cleanPlainField(jProj.title),
        role: jProj.role ? cleanPlainField(String(jProj.role)) : "Lead",
        dates: jProj.dates && jProj.dates !== "Dates" && jProj.dates !== "Period" ? cleanPlainField(String(jProj.dates)) : "",
        description: jProj.description ? cleanRichTextField(String(jProj.description)) : "",
        bullets: cleanBullets.slice(0, 2),
      });
    }

    if (updatedProjects.length > 0) {
      updated.cvContent.projects = updatedProjects.slice(0, 2);
    }
  }

  if (sourceCv.education && Array.isArray(sourceCv.education)) {
    updated.cvContent.education = sourceCv.education;
  }
  if (sourceCv.certifications && Array.isArray(sourceCv.certifications)) {
    updated.cvContent.certifications = sourceCv.certifications;
  }

  updated.coverLetterContent.company = updated.company;
  updated.coverLetterContent.roleTitle = updated.roleTitle;

  const coverLetterObj = raw.coverLetterContent || raw.coverLetter;
  if (coverLetterObj && typeof coverLetterObj === "object") {
    const cl = coverLetterObj;
    if (cl.subjectLine && typeof cl.subjectLine === "string") {
      updated.coverLetterContent.subjectLine = cleanPlainField(cl.subjectLine);
    }
    if (cl.positioningLine && typeof cl.positioningLine === "string") {
      updated.coverLetterContent.positioningLine = cleanPlainField(cl.positioningLine);
    } else if (updated.cvContent.header.headline) {
      updated.coverLetterContent.positioningLine = updated.cvContent.header.headline;
    }
    if (cl.dateLine && typeof cl.dateLine === "string") {
      updated.coverLetterContent.dateLine = cleanPlainField(cl.dateLine);
    }
    if (cl.greeting && typeof cl.greeting === "string") {
      updated.coverLetterContent.greeting = cleanPlainField(cl.greeting);
    }
    if (cl.closingPhrase && typeof cl.closingPhrase === "string") {
      updated.coverLetterContent.closingPhrase = cleanPlainField(cl.closingPhrase);
    }
    if (cl.signatureName && typeof cl.signatureName === "string") {
      updated.coverLetterContent.signatureName = cleanPlainField(cl.signatureName);
    }

    const sidebarObj = cl.sidebar && typeof cl.sidebar === "object" ? cl.sidebar : {};
    const sLabel = cl.sidebarLabel || sidebarObj.label;
    const sRole = cl.sidebarRole || sidebarObj.role || updated.roleTitle;
    const sCompany = cl.sidebarCompany || sidebarObj.company || updated.company;

    if (sLabel && typeof sLabel === "string") {
      updated.coverLetterContent.sidebarLabel = cleanPlainField(sLabel);
    }
    if (sRole && typeof sRole === "string") {
      updated.coverLetterContent.sidebarRole = cleanScrapedTitleOrCompany(cleanPlainField(sRole));
    }
    if (sCompany && typeof sCompany === "string") {
      updated.coverLetterContent.sidebarCompany = cleanScrapedTitleOrCompany(cleanPlainField(sCompany));
    }

    if (cl.paragraphs && Array.isArray(cl.paragraphs)) {
      const rawTexts = cl.paragraphs
        .map((p: any) => (typeof p === "string" ? cleanRichTextField(p) : cleanRichTextField(p?.text || "")))
        .filter(Boolean);

      let finalTexts = rawTexts;
      if (rawTexts.length > 5) {
        const opening = rawTexts[0];
        const evidence = rawTexts[1];
        const fit = rawTexts[2];
        const closing = rawTexts[rawTexts.length - 1];
        const mergedContribution = rawTexts.slice(3, rawTexts.length - 1).join(" ");
        finalTexts = [opening, evidence, fit, mergedContribution, closing];
      }

      const paragraphTypes: Array<"opening" | "evidence" | "fit" | "contribution" | "closing"> = [
        "opening",
        "evidence",
        "fit",
        "contribution",
        "closing",
      ];

      updated.coverLetterContent.paragraphs = finalTexts.map((text: string, idx: number) => ({
        type:
          idx === finalTexts.length - 1
            ? "closing"
            : paragraphTypes[idx] || "contribution",
        text,
      }));
    }
  }

  localizeApplicationFallbacks(updated);

  const sanitized = sanitizeApplicationAiContent(updated);
  updated.cvContent = sanitized.cvContent;
  updated.coverLetterContent = sanitized.coverLetterContent;

  if (raw.templateSettings && typeof raw.templateSettings === "object") {
    updated.templateSettings = { ...updated.templateSettings, ...raw.templateSettings };
  } else {
    const autoFit = computeSmartAutoFitSettings(updated);
    updated.templateSettings = {
      ...updated.templateSettings,
      ...autoFit,
    };
  }
  if (raw.assetSettings && typeof raw.assetSettings === "object") {
    updated.assetSettings = { ...updated.assetSettings, ...raw.assetSettings };
  }

  const rawClass = raw.roleClassification || raw.roleClassificationStrategy || raw.classification;
  if (rawClass && typeof rawClass === "object") {
    updated.roleClassification = {
      type: rawClass.type || updated.roleClassification.type,
      seniorityLevel: rawClass.seniorityLevel || updated.roleClassification.seniorityLevel,
      roleFamily: rawClass.roleFamily !== undefined ? cleanPlainField(String(rawClass.roleFamily)) : updated.roleClassification.roleFamily,
      applicationPriority: normalizePriority(rawClass.applicationPriority || updated.roleClassification.applicationPriority),
      outputMode: rawClass.outputMode || updated.roleClassification.outputMode,
      recommendedPositioning: rawClass.recommendedPositioning !== undefined ? cleanPlainField(String(rawClass.recommendedPositioning)) : updated.roleClassification.recommendedPositioning,
      cvIntensity: rawClass.cvIntensity || updated.roleClassification.cvIntensity,
      overqualificationRisk: normalizeRisk(rawClass.overqualificationRisk || updated.roleClassification.overqualificationRisk),
      dealBreakerRisk: normalizeRisk(rawClass.dealBreakerRisk || updated.roleClassification.dealBreakerRisk),
    };
  }

  const rawAnswers = raw.formFieldAnswers || raw.portalFormAnswers || raw.formAnswers || raw.formFields;
  if (rawAnswers && typeof rawAnswers === "object") {
    updated.formFieldAnswers = {
      shortMotivationMessage: rawAnswers.shortMotivationMessage !== undefined ? cleanPlainField(String(rawAnswers.shortMotivationMessage)) : updated.formFieldAnswers.shortMotivationMessage,
      whyThisRole: rawAnswers.whyThisRole !== undefined ? cleanPlainField(String(rawAnswers.whyThisRole)) : updated.formFieldAnswers.whyThisRole,
      whyThisCompany: rawAnswers.whyThisCompany !== undefined ? cleanPlainField(String(rawAnswers.whyThisCompany)) : updated.formFieldAnswers.whyThisCompany,
      additionalMessage: rawAnswers.additionalMessage !== undefined ? cleanPlainField(String(rawAnswers.additionalMessage)) : updated.formFieldAnswers.additionalMessage,
      availability: rawAnswers.availability !== undefined ? cleanPlainField(String(rawAnswers.availability)) : updated.formFieldAnswers.availability,
      degreeExplanation: rawAnswers.degreeExplanation !== undefined ? cleanPlainField(String(rawAnswers.degreeExplanation)) : updated.formFieldAnswers.degreeExplanation,
      workPermitGermany: rawAnswers.workPermitGermany !== undefined ? cleanPlainField(String(rawAnswers.workPermitGermany)) : updated.formFieldAnswers.workPermitGermany,
      website: rawAnswers.website !== undefined ? cleanUrlField(String(rawAnswers.website)) : updated.formFieldAnswers.website,
      linkedin: rawAnswers.linkedin !== undefined ? cleanUrlField(String(rawAnswers.linkedin)) : updated.formFieldAnswers.linkedin,
    };
  }

  const rawSalary = raw.salaryPositioning || raw.salary || raw.salaryStrategy;
  if (rawSalary && typeof rawSalary === "object") {
    const recRange = rawSalary.recommendedRangeEUR ?? rawSalary.recommendedRangeUSD ?? rawSalary.recommendedRange;
    const safeNum = rawSalary.safeNumberEUR ?? rawSalary.safeNumberUSD ?? rawSalary.safeNumber;
    const ambNum = rawSalary.ambitiousNumberEUR ?? rawSalary.ambitiousNumberUSD ?? rawSalary.ambitiousNumber;

    updated.salaryPositioning = {
      recommendedRangeEUR: recRange !== undefined ? cleanPlainField(String(recRange)) : updated.salaryPositioning.recommendedRangeEUR,
      safeNumberEUR: safeNum !== undefined ? cleanPlainField(String(safeNum)) : updated.salaryPositioning.safeNumberEUR,
      ambitiousNumberEUR: ambNum !== undefined ? cleanPlainField(String(ambNum)) : updated.salaryPositioning.ambitiousNumberEUR,
      riskComment: rawSalary.riskComment !== undefined ? cleanPlainField(String(rawSalary.riskComment)) : updated.salaryPositioning.riskComment,
    };
  }

  const rawKw = raw.keywordStrategy || raw.keywords || raw.keywordStrategyPool;
  if (rawKw && typeof rawKw === "object") {
    updated.keywordStrategy = {
      mustIncludeATSKeywords: Array.isArray(rawKw.mustIncludeATSKeywords) ? rawKw.mustIncludeATSKeywords.map(cleanKeyword) : updated.keywordStrategy.mustIncludeATSKeywords,
      niceToHaveKeywords: Array.isArray(rawKw.niceToHaveKeywords) ? rawKw.niceToHaveKeywords.map(cleanKeyword) : updated.keywordStrategy.niceToHaveKeywords,
      humanNarrativeKeywords: Array.isArray(rawKw.humanNarrativeKeywords) ? rawKw.humanNarrativeKeywords.map(cleanKeyword) : updated.keywordStrategy.humanNarrativeKeywords,
      avoidOrMinimizeKeywords: Array.isArray(rawKw.avoidOrMinimizeKeywords) ? rawKw.avoidOrMinimizeKeywords.map(cleanKeyword) : updated.keywordStrategy.avoidOrMinimizeKeywords,
    };
  }

  const rawConcern = raw.recruiterConcernHandling || raw.recruiterConcerns || raw.concerns;
  if (rawConcern && typeof rawConcern === "object") {
    let list: any[] = [];
    if (Array.isArray(rawConcern.likelyConcerns)) {
      list = rawConcern.likelyConcerns;
    } else if (Array.isArray(rawConcern)) {
      list = rawConcern;
    }
    if (list.length > 0) {
      updated.recruiterConcernHandling.likelyConcerns = list.map((item: any) => ({
        concern: item.concern !== undefined ? cleanPlainField(String(item.concern)) : "",
        howToNeutralize: item.howToNeutralize !== undefined ? cleanPlainField(String(item.howToNeutralize)) : "",
        sentenceToUse: item.sentenceToUse !== undefined ? cleanPlainField(String(item.sentenceToUse)) : "",
      }));
    }
  }

  const rawFit = raw.fitAssessment || raw.fit || raw.fitScore;
  if (rawFit && typeof rawFit === "object") {
    let score: any = rawFit.scoreOutOf10;
    if (score === null || score === undefined || score === "") {
      score = null;
    } else {
      score = Number(score);
      if (isNaN(score)) score = null;
    }

    updated.fitAssessment = {
      scoreOutOf10: score,
      probabilityTier: rawFit.probabilityTier || updated.fitAssessment.probabilityTier,
      summary: rawFit.summary !== undefined ? cleanPlainField(String(rawFit.summary)) : updated.fitAssessment.summary,
      bestAngles: Array.isArray(rawFit.bestAngles) ? rawFit.bestAngles.map((s: any) => cleanPlainField(String(s))) : updated.fitAssessment.bestAngles,
      mainRisks: Array.isArray(rawFit.mainRisks) ? rawFit.mainRisks.map((s: any) => cleanPlainField(String(s))) : updated.fitAssessment.mainRisks,
      recommendedApplicationStrategy: rawFit.recommendedApplicationStrategy !== undefined ? cleanPlainField(String(rawFit.recommendedApplicationStrategy)) : updated.fitAssessment.recommendedApplicationStrategy,
      recommendedTone: rawFit.recommendedTone !== undefined ? cleanPlainField(String(rawFit.recommendedTone)) : updated.fitAssessment.recommendedTone,
      recommendedCVVersion: rawFit.recommendedCVVersion !== undefined ? cleanPlainField(String(rawFit.recommendedCVVersion)) : updated.fitAssessment.recommendedCVVersion,
      applyOrSkip: rawFit.applyOrSkip || updated.fitAssessment.applyOrSkip,
    };
  }

  const rawQc = raw.qualityControl || raw.quality || raw.qc;
  if (rawQc && typeof rawQc === "object") {
    updated.qualityControl = {
      directEvidenceUsed: Array.isArray(rawQc.directEvidenceUsed) ? rawQc.directEvidenceUsed.map((s: any) => cleanPlainField(String(s))) : updated.qualityControl.directEvidenceUsed,
      transferableEvidenceUsed: Array.isArray(rawQc.transferableEvidenceUsed) ? rawQc.transferableEvidenceUsed.map((s: any) => cleanPlainField(String(s))) : updated.qualityControl.transferableEvidenceUsed,
      adaptableSkillsUsed: Array.isArray(rawQc.adaptableSkillsUsed) ? rawQc.adaptableSkillsUsed.map((s: any) => cleanPlainField(String(s))) : updated.qualityControl.adaptableSkillsUsed,
      potentialOverclaimsAvoided: Array.isArray(rawQc.potentialOverclaimsAvoided) ? rawQc.potentialOverclaimsAvoided.map((s: any) => cleanPlainField(String(s))) : updated.qualityControl.potentialOverclaimsAvoided,
      atsKeywordsIncluded: Array.isArray(rawQc.atsKeywordsIncluded) ? rawQc.atsKeywordsIncluded.map((s: any) => cleanPlainField(String(s))) : updated.qualityControl.atsKeywordsIncluded,
      humanRecruiterImpression: rawQc.humanRecruiterImpression !== undefined ? cleanPlainField(String(rawQc.humanRecruiterImpression)) : updated.qualityControl.humanRecruiterImpression,
      finalContentRisk: normalizeRisk(rawQc.finalContentRisk || updated.qualityControl.finalContentRisk),
      oneSentencePositioning: rawQc.oneSentencePositioning !== undefined ? cleanPlainField(String(rawQc.oneSentencePositioning)) : updated.qualityControl.oneSentencePositioning,
    };
  }

  updated.schemaVersion = 2;
  if (rawText !== undefined) {
    updated.importMetadata = {
      timestamp: new Date().toISOString(),
      source: "import-modal",
      rawImportedAIJson: rawText,
    };
  }

  const parsed = ApplicationSchema.safeParse(updated);
  if (!parsed.success) {
    console.warn("Import validation warnings:", parsed.error.format());
    return updated;
  }
  return parsed.data;
}
