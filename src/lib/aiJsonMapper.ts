import { normalizePriority, normalizeRisk } from "./applicationEnums";
import { applyImportContext } from "./ai-import/context";
import { ApplicationSchema, type Application, type ExperienceEntry, type ProjectEntry } from "@/lib/schemas";
import { cleanScrapedTitleOrCompany, cleanPlainField, cleanRichTextField, cleanUrlField, cleanKeyword } from "./ai-import/fields";
import { detectDocumentLanguage } from "./ai-import/language";
import { normalizeCoreSkills } from "./ai-import/skills";
import { matchExperienceEntry } from "./ai-import/experience";
import { localizeApplicationFallbacks } from "./ai-import/localize";
import { sanitizeApplicationAiContent } from "./ai-import/sanitize";
import { computeSmartAutoFitSettings } from "./ai-import/readiness";
import { documentFontSize, pickSmartTemplateDefaults } from "./documentDesign";
import { EDITORIAL_LIMITS } from "./editorialPolicy";

export class ImportValidationError extends Error {}


/**
 * Normalizes and maps any raw LLM JSON input (full schema, partial CV fields, cover letter paragraphs)
 * to an Application while preserving the selected evidence and explicit omissions.
 * Missing collection fields inherit the draft; supplied arrays replace that selection.
 */
export function normalizeImportedAIJson(raw: any, existing: Application, rawText?: string): Application {
  if (!raw || typeof raw !== "object") {
    throw new Error("Pasted JSON is not an object.");
  }

  // Deep clone existing draft to preserve original data
  const updated = JSON.parse(JSON.stringify(existing)) as Application;
  // Confirmed draft values (from the master CV) that partial imports inherit.
  const baseAvailability = {
    headerAvailability: existing.cvContent.header.availability ?? "",
    answerAvailability: existing.formFieldAnswers?.availability ?? "",
  };

  // 1. Basic properties + scraping cleanup
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

  // Detect language automatically from JSON content or explicit field
  updated.language = detectDocumentLanguage(raw, updated.language || "English");

  if (raw.jobDescription && typeof raw.jobDescription === "string") updated.jobDescription = raw.jobDescription;
  if (typeof raw.jobPostingUrl === "string" && raw.jobPostingUrl.trim()) updated.jobPostingUrl = cleanUrlField(raw.jobPostingUrl);
  if (typeof raw.jobPostingId === "string" && raw.jobPostingId.trim()) updated.jobPostingId = cleanPlainField(raw.jobPostingId);
  if (typeof raw.applicationDeadline === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw.applicationDeadline.trim())) {
    updated.applicationDeadline = raw.applicationDeadline.trim();
  }
  if (raw.notes && typeof raw.notes === "string") updated.notes = raw.notes;
  if (raw.recruiterContact && typeof raw.recruiterContact === "string") updated.recruiterContact = cleanPlainField(raw.recruiterContact);
  if (raw.salaryOffer && typeof raw.salaryOffer === "string") updated.salaryOffer = cleanPlainField(raw.salaryOffer);
  if (raw.interviewDate && typeof raw.interviewDate === "string") updated.interviewDate = raw.interviewDate;

  // 2. Nested Content check (Full / Old Export format) vs Partial Flat Format
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
      .slice(0, EDITORIAL_LIMITS.maxAchievements);
  }

  const normalizedSkills = normalizeCoreSkills(sourceCv.coreSkills ?? sourceCv.skills);
  if (normalizedSkills !== null) {
    updated.cvContent.coreSkills = normalizedSkills;
  }

  // 3. Deterministic Experience Mapping (Collision-Free for Multi-Role Tenures)
  const rawExpList = sourceCv.experience ?? sourceCv.professionalExperience;
  if (Array.isArray(rawExpList)) {
    const usedIds = new Set<string>();
    const resultExperiences: ExperienceEntry[] = [];

    for (const jExp of rawExpList) {
      if (!jExp || typeof jExp !== "object") continue;
      if (jExp.include === false) continue;

      // An ID supplied twice is still one selected role, not a reason to fall
      // through to title matching and overwrite a sibling role at the same employer.
      const incomingId = String(jExp.id || "").trim().toLowerCase();
      if (incomingId && [...usedIds].some((id) => id.toLowerCase() === incomingId)) continue;

      const matched = matchExperienceEntry(jExp, updated.cvContent.experience, usedIds);
      const rawBullets = Array.isArray(jExp.bullets)
        ? jExp.bullets.map((b: unknown) => cleanRichTextField(String(b))).filter(Boolean)
        : undefined;

      if (matched) {
        usedIds.add(matched.id);
        resultExperiences.push({
          ...matched,
          ...(jExp.include === true ? { include: true } : {}),
          jobTitle: typeof jExp.jobTitle === "string" ? cleanPlainField(jExp.jobTitle) : matched.jobTitle,
          company: typeof jExp.company === "string" ? cleanPlainField(jExp.company) : matched.company,
          location: typeof jExp.location === "string" ? cleanPlainField(jExp.location) : matched.location,
          dates: typeof jExp.dates === "string" ? cleanPlainField(jExp.dates) : matched.dates,
          ...(typeof jExp.summary === "string"
            ? { summary: cleanRichTextField(jExp.summary) }
            : {}),
          bullets: rawBullets ?? matched.bullets,
        });
      } else if (jExp.company || jExp.jobTitle) {
        const newId = jExp.id || "exp_" + Math.random().toString(36).substring(2, 9);
        usedIds.add(newId);
        resultExperiences.push({
          id: newId,
          jobTitle: cleanPlainField(jExp.jobTitle || ""),
          company: cleanPlainField(jExp.company || ""),
          location: cleanPlainField(jExp.location || ""),
          dates: jExp.dates && jExp.dates !== "Dates" ? cleanPlainField(jExp.dates) : "",
          summary: jExp.summary ? cleanRichTextField(jExp.summary) : "",
          ...(jExp.include === true ? { include: true } : {}),
          bullets: rawBullets ?? [],
        });
      }
    }

    // The array is the selected list, including an intentional empty selection.
    // Never refill it with roles the chatbot deliberately excluded or omitted.
    updated.cvContent.experience = resultExperiences;
  }

  // 4. Deterministic Projects Mapping (Respect include:false and never inject "Dates")
  const rawProjList = sourceCv.projects ?? sourceCv.selectedProjects;
  if (Array.isArray(rawProjList)) {
    const updatedProjects: ProjectEntry[] = [];
    const usedProjIds = new Set<string>();

    for (const jProj of rawProjList) {
      if (!jProj || typeof jProj !== "object") continue;
      if (jProj.include === false) continue;

      const rawProjId = String(jProj.id || "").toLowerCase().trim();
      if (rawProjId && [...usedProjIds].some((id) => id.toLowerCase() === rawProjId)) continue;
      const titleLower = String(jProj.title || "").toLowerCase();
      const match = updated.cvContent.projects.find(
        (p) =>
          !usedProjIds.has(p.id) &&
          ((rawProjId && p.id.toLowerCase() === rawProjId) ||
            (titleLower && (p.title.toLowerCase().includes(titleLower) ||
              titleLower.includes(p.title.toLowerCase().replace(/\s*\(.*?\)\s*/g, "")))))
      );

      const cleanBullets = Array.isArray(jProj.bullets)
        ? jProj.bullets.map((b: unknown) => cleanRichTextField(String(b))).filter(Boolean)
        : undefined;

      if (match) {
        usedProjIds.add(match.id);
        const cleanDates =
          typeof jProj.dates === "string" && jProj.dates !== "Dates" && jProj.dates !== "Period"
            ? cleanPlainField(String(jProj.dates))
            : match.dates !== "Dates" && match.dates !== "Period"
            ? match.dates
            : "";

        updatedProjects.push({
          ...match,
          ...(jProj.include === true ? { include: true } : {}),
          title: typeof jProj.title === "string" ? cleanPlainField(jProj.title) : match.title,
          role: typeof jProj.role === "string" ? cleanPlainField(jProj.role) : match.role,
          dates: cleanDates,
          description: typeof jProj.description === "string" ? cleanRichTextField(jProj.description) : match.description,
          bullets: cleanBullets ?? match.bullets,
          ...(typeof jProj.url === "string" && jProj.url.trim() ? { url: cleanUrlField(jProj.url) } : {}),
          ...(typeof jProj.repoUrl === "string" && jProj.repoUrl.trim() ? { repoUrl: cleanUrlField(jProj.repoUrl) } : {}),
          ...(typeof jProj.demoUrl === "string" && jProj.demoUrl.trim() ? { demoUrl: cleanUrlField(jProj.demoUrl) } : {}),
          ...(Array.isArray(jProj.techStack) ? { techStack: jProj.techStack.map((t: unknown) => cleanPlainField(String(t))).filter(Boolean) } : {}),
        });
      } else if (jProj.title) {
        const rawDates =
          jProj.dates && jProj.dates !== "Dates" && jProj.dates !== "Period"
            ? cleanPlainField(String(jProj.dates))
            : "";

        updatedProjects.push({
          id: jProj.id || "proj_" + Math.random().toString(36).substring(2, 9),
          title: cleanPlainField(jProj.title),
          role: typeof jProj.role === "string" ? cleanPlainField(jProj.role) : "",
          dates: rawDates,
          description: jProj.description ? cleanRichTextField(String(jProj.description)) : "",
          ...(jProj.include === true ? { include: true } : {}),
          bullets: cleanBullets ?? [],
          ...(typeof jProj.url === "string" && jProj.url.trim() ? { url: cleanUrlField(jProj.url) } : {}),
          ...(typeof jProj.repoUrl === "string" && jProj.repoUrl.trim() ? { repoUrl: cleanUrlField(jProj.repoUrl) } : {}),
          ...(typeof jProj.demoUrl === "string" && jProj.demoUrl.trim() ? { demoUrl: cleanUrlField(jProj.demoUrl) } : {}),
          ...(Array.isArray(jProj.techStack) ? { techStack: jProj.techStack.map((t: unknown) => cleanPlainField(String(t))).filter(Boolean) } : {}),
        });
      }
    }

    updated.cvContent.projects = updatedProjects;
  }

  if (sourceCv.education && Array.isArray(sourceCv.education)) {
    updated.cvContent.education = sourceCv.education;
  }
  if (sourceCv.certifications && Array.isArray(sourceCv.certifications)) {
    updated.cvContent.certifications = sourceCv.certifications;
  }
  const rawSpecComp = sourceCv.specializedCompetencies ?? raw.specializedCompetencies;
  if (Array.isArray(rawSpecComp)) {
    updated.cvContent.specializedCompetencies = Array.from(
      new Set(rawSpecComp.map((c: unknown) => cleanPlainField(String(c))).filter(Boolean))
    );
  }

  // 5. Cover Letter fields mapper (keep the chosen paragraph structure intact)
  updated.coverLetterContent.company = updated.company;
  updated.coverLetterContent.roleTitle = updated.roleTitle;

  const coverLetterObj = raw.coverLetterContent || raw.coverLetter;
  if (coverLetterObj && typeof coverLetterObj === "object") {
    const cl = coverLetterObj;
    if (typeof cl.subjectLine === "string") {
      updated.coverLetterContent.subjectLine = cleanPlainField(cl.subjectLine);
    }
    if (typeof cl.positioningLine === "string") {
      updated.coverLetterContent.positioningLine = cleanPlainField(cl.positioningLine);
    } else if (updated.cvContent.header.headline) {
      updated.coverLetterContent.positioningLine = updated.cvContent.header.headline;
    }
    if (typeof cl.dateLine === "string") {
      updated.coverLetterContent.dateLine = cleanPlainField(cl.dateLine);
    }
    if (typeof cl.greeting === "string") {
      updated.coverLetterContent.greeting = cleanPlainField(cl.greeting);
    }
    if (typeof cl.closingPhrase === "string") {
      updated.coverLetterContent.closingPhrase = cleanPlainField(cl.closingPhrase);
    }
    if (typeof cl.signatureName === "string") {
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

    if (Array.isArray(cl.paragraphs)) {
      const paragraphTypes: Array<"opening" | "evidence" | "fit" | "contribution" | "closing"> = [
        "opening",
        "evidence",
        "fit",
        "contribution",
        "closing",
      ];
      const paragraphs = cl.paragraphs.map((paragraph: unknown) => {
        const entry = typeof paragraph === "object" && paragraph !== null ? paragraph as Record<string, unknown> : {};
        const text = typeof paragraph === "string" ? paragraph : typeof entry.text === "string" ? entry.text : "";
        const type = paragraphTypes.includes(entry.type as typeof paragraphTypes[number])
          ? entry.type as typeof paragraphTypes[number]
          : undefined;
        return { type, text: cleanRichTextField(text) };
      }).filter((paragraph: { text: string }) => Boolean(paragraph.text));
      updated.coverLetterContent.paragraphs = paragraphs.map((paragraph: { type?: typeof paragraphTypes[number]; text: string }, index: number) => ({
        type: paragraph.type ?? (index === paragraphs.length - 1 ? "closing" : paragraphTypes[index] || "contribution"),
        text: paragraph.text,
      }));
    }
  }

  // 6. Strategic analysis fields & portal answers BEFORE localization/sanitization so answers stay synced
  // A. Role Classification
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

  // B. Portal Form Answers (strip Markdown links & **bold** so portal paste is 100% clean)
  const rawAnswers = raw.formFieldAnswers || raw.portalFormAnswers || raw.formAnswers || raw.formFields;
  if (rawAnswers && typeof rawAnswers === "object") {
    const incomingWorkAuth =
      rawAnswers.workAuthorization !== undefined
        ? cleanPlainField(String(rawAnswers.workAuthorization))
        : rawAnswers.workPermitGermany !== undefined
        ? cleanPlainField(String(rawAnswers.workPermitGermany))
        : updated.formFieldAnswers.workAuthorization || updated.formFieldAnswers.workPermitGermany;
    updated.formFieldAnswers = {
      shortMotivationMessage: rawAnswers.shortMotivationMessage !== undefined ? cleanPlainField(String(rawAnswers.shortMotivationMessage)) : updated.formFieldAnswers.shortMotivationMessage,
      whyThisRole: rawAnswers.whyThisRole !== undefined ? cleanPlainField(String(rawAnswers.whyThisRole)) : updated.formFieldAnswers.whyThisRole,
      whyThisCompany: rawAnswers.whyThisCompany !== undefined ? cleanPlainField(String(rawAnswers.whyThisCompany)) : updated.formFieldAnswers.whyThisCompany,
      additionalMessage: rawAnswers.additionalMessage !== undefined ? cleanPlainField(String(rawAnswers.additionalMessage)) : updated.formFieldAnswers.additionalMessage,
      availability: rawAnswers.availability !== undefined ? cleanPlainField(String(rawAnswers.availability)) : updated.formFieldAnswers.availability,
      degreeExplanation: rawAnswers.degreeExplanation !== undefined ? cleanPlainField(String(rawAnswers.degreeExplanation)) : updated.formFieldAnswers.degreeExplanation,
      workAuthorization: incomingWorkAuth,
      workPermitGermany: rawAnswers.workPermitGermany !== undefined ? cleanPlainField(String(rawAnswers.workPermitGermany)) : updated.formFieldAnswers.workPermitGermany,
      website: rawAnswers.website !== undefined ? cleanUrlField(String(rawAnswers.website)) : updated.formFieldAnswers.website,
      linkedin: rawAnswers.linkedin !== undefined ? cleanUrlField(String(rawAnswers.linkedin)) : updated.formFieldAnswers.linkedin,
      ...(rawAnswers.github !== undefined ? { github: cleanUrlField(String(rawAnswers.github)) } : updated.formFieldAnswers.github !== undefined ? { github: updated.formFieldAnswers.github } : {}),
      ...(rawAnswers.salaryExpectation !== undefined ? { salaryExpectation: cleanPlainField(String(rawAnswers.salaryExpectation)) } : updated.formFieldAnswers.salaryExpectation !== undefined ? { salaryExpectation: updated.formFieldAnswers.salaryExpectation } : {}),
      ...(rawAnswers.startDateIso !== undefined ? { startDateIso: cleanPlainField(String(rawAnswers.startDateIso)) } : updated.formFieldAnswers.startDateIso !== undefined ? { startDateIso: updated.formFieldAnswers.startDateIso } : {}),
      ...(rawAnswers.noticePeriod !== undefined ? { noticePeriod: cleanPlainField(String(rawAnswers.noticePeriod)) } : updated.formFieldAnswers.noticePeriod !== undefined ? { noticePeriod: updated.formFieldAnswers.noticePeriod } : {}),
      ...(rawAnswers.requiresSponsorship !== undefined ? { requiresSponsorship: cleanPlainField(String(rawAnswers.requiresSponsorship)) } : updated.formFieldAnswers.requiresSponsorship !== undefined ? { requiresSponsorship: updated.formFieldAnswers.requiresSponsorship } : {}),
    };
  }

  // Apply language-aware localization for English / German / Spanish documents
  localizeApplicationFallbacks(updated, baseAvailability);

  // Sanitize any surviving robotic AI verbs/adverbs and deduplicate Key Achievements against Experience
  const sanitized = sanitizeApplicationAiContent(updated);
  updated.cvContent = sanitized.cvContent;
  updated.coverLetterContent = sanitized.coverLetterContent;
  updated.roleClassification = sanitized.roleClassification;
  updated.formFieldAnswers = sanitized.formFieldAnswers;

  // Auto-upgrade legacy untouched factory template defaults when importing a full document
  const hasFullDocPayload = Boolean(
    raw.cvContent || raw.coverLetterContent || raw.coverLetter || raw.experience || raw.professionalExperience || raw.professionalProfile
  );
  const isUntouchedLegacyDefault =
    updated.templateSettings.cvTemplate === "ats-clean" &&
    updated.templateSettings.coverLetterTemplate === "ats-letter" &&
    (updated.templateSettings.fontFamily === "Inter" || updated.templateSettings.fontFamily === "IBM Plex Sans");
  const incomingTone = typeof raw?.promptContext?.options?.tonePreset === "string"
    ? raw.promptContext.options.tonePreset
    : updated.promptContext?.options?.tonePreset;
  if (!raw.templateSettings && hasFullDocPayload && isUntouchedLegacyDefault) {
    updated.templateSettings = {
      ...updated.templateSettings,
      ...pickSmartTemplateDefaults(updated.language, incomingTone),
    };
  }

  const autoFit = computeSmartAutoFitSettings(updated);
  if (raw.templateSettings && typeof raw.templateSettings === "object") {
    const rawTs = raw.templateSettings as Record<string, unknown>;
    updated.templateSettings = {
      ...updated.templateSettings,
      ...raw.templateSettings,
      fontSize: typeof rawTs.fontSize === "number" ? rawTs.fontSize : autoFit.fontSize,
      lineSpacing: typeof rawTs.lineSpacing === "number" ? rawTs.lineSpacing : autoFit.lineSpacing,
      sectionSpacing: typeof rawTs.sectionSpacing === "number" ? rawTs.sectionSpacing : autoFit.sectionSpacing,
    };
  } else {
    // Automatically tune font size, line height, and section spacing based on imported content density
    updated.templateSettings = {
      ...updated.templateSettings,
      letterFontSize: updated.templateSettings.letterFontSize ?? documentFontSize(updated.templateSettings.fontSize, "letter"),
      ...autoFit,
    };
  }
  if (raw.assetSettings && typeof raw.assetSettings === "object") {
    const rawAssets = raw.assetSettings as Record<string, unknown>;
    const mergeAssetBranch = <T extends { filePath?: string }>(current: T, incoming: unknown): T => {
      if (!incoming || typeof incoming !== "object" || Array.isArray(incoming)) return current;
      const patch = Object.fromEntries(
        Object.entries(incoming as Record<string, unknown>).filter(([, v]) => v !== undefined)
      ) as Partial<T>;
      const merged = { ...current, ...patch };
      if (typeof patch.filePath === "string" && !patch.filePath.trim()) {
        if (current.filePath) merged.filePath = current.filePath;
        else delete merged.filePath;
      }
      return merged;
    };
    updated.assetSettings = {
      signature: mergeAssetBranch(updated.assetSettings.signature, rawAssets.signature),
      photo: mergeAssetBranch(updated.assetSettings.photo, rawAssets.photo),
    };
  }

  // C. Salary Positioning (support EUR, USD, hourly and generic keys)
  const rawSalary = raw.salaryPositioning || raw.salary || raw.salaryStrategy;
  if (rawSalary && typeof rawSalary === "object") {
    const recRange =
      rawSalary.recommendedRangeEUR ??
      rawSalary.recommendedRangeUSD ??
      rawSalary.recommendedRangeUSDHourly ??
      rawSalary.recommendedRange;
    const safeNum =
      rawSalary.safeNumberEUR ??
      rawSalary.safeNumberUSD ??
      rawSalary.safeNumberUSDHourly ??
      rawSalary.safeNumber;
    const ambNum =
      rawSalary.ambitiousNumberEUR ??
      rawSalary.ambitiousNumberUSD ??
      rawSalary.ambitiousNumberUSDHourly ??
      rawSalary.ambitiousNumber;

    updated.salaryPositioning = {
      recommendedRangeEUR: recRange !== undefined ? cleanPlainField(String(recRange)) : updated.salaryPositioning.recommendedRangeEUR,
      safeNumberEUR: safeNum !== undefined ? cleanPlainField(String(safeNum)) : updated.salaryPositioning.safeNumberEUR,
      ambitiousNumberEUR: ambNum !== undefined ? cleanPlainField(String(ambNum)) : updated.salaryPositioning.ambitiousNumberEUR,
      riskComment: rawSalary.riskComment !== undefined ? cleanPlainField(String(rawSalary.riskComment)) : updated.salaryPositioning.riskComment,
    };
  }

  // D. Keyword Strategy
  const rawKw = raw.keywordStrategy || raw.keywords || raw.keywordStrategyPool;
  if (rawKw && typeof rawKw === "object") {
    updated.keywordStrategy = {
      mustIncludeATSKeywords: Array.isArray(rawKw.mustIncludeATSKeywords) ? rawKw.mustIncludeATSKeywords.map(cleanKeyword) : updated.keywordStrategy.mustIncludeATSKeywords,
      niceToHaveKeywords: Array.isArray(rawKw.niceToHaveKeywords) ? rawKw.niceToHaveKeywords.map(cleanKeyword) : updated.keywordStrategy.niceToHaveKeywords,
      humanNarrativeKeywords: Array.isArray(rawKw.humanNarrativeKeywords) ? rawKw.humanNarrativeKeywords.map(cleanKeyword) : updated.keywordStrategy.humanNarrativeKeywords,
      avoidOrMinimizeKeywords: Array.isArray(rawKw.avoidOrMinimizeKeywords) ? rawKw.avoidOrMinimizeKeywords.map(cleanKeyword) : updated.keywordStrategy.avoidOrMinimizeKeywords,
    };
  }

  // E. Recruiter Concern Handling
  const rawConcern = raw.recruiterConcernHandling || raw.recruiterConcerns || raw.concerns;
  if (rawConcern && typeof rawConcern === "object") {
    let list: any[] = [];
    if (Array.isArray(rawConcern.likelyConcerns)) {
      list = rawConcern.likelyConcerns;
    } else if (Array.isArray(rawConcern)) {
      list = rawConcern;
    }
    if (Array.isArray(rawConcern.likelyConcerns) || Array.isArray(rawConcern)) {
      updated.recruiterConcernHandling.likelyConcerns = list.map((item: any) => ({
        concern: item.concern !== undefined ? cleanPlainField(String(item.concern)) : "",
        howToNeutralize: item.howToNeutralize !== undefined ? cleanPlainField(String(item.howToNeutralize)) : "",
        sentenceToUse: item.sentenceToUse !== undefined ? cleanPlainField(String(item.sentenceToUse)) : "",
      }));
    }
  }

  // F. Fit Assessment
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

  // G. Quality Control
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

  // H. Optional Outreach, Portal Questions, Keyword Placement Plan & Interview Prep
  if (raw.outreachMessages && typeof raw.outreachMessages === "object") {
    const om = raw.outreachMessages as Record<string, unknown>;
    updated.outreachMessages = {
      ...(typeof om.linkedInConnectionNote === "string" ? { linkedInConnectionNote: cleanPlainField(om.linkedInConnectionNote) } : {}),
      ...(typeof om.recruiterDirectMessage === "string" ? { recruiterDirectMessage: cleanPlainField(om.recruiterDirectMessage) } : {}),
      ...(typeof om.hiringManagerNote === "string" ? { hiringManagerNote: cleanPlainField(om.hiringManagerNote) } : {}),
      ...(typeof om.followUpMessage === "string" ? { followUpMessage: cleanPlainField(om.followUpMessage) } : {}),
    };
  }
  if (Array.isArray(raw.portalQuestionAnswers)) {
    updated.portalQuestionAnswers = raw.portalQuestionAnswers
      .filter((item: unknown): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
      .map((item: Record<string, unknown>) => ({
        question: cleanPlainField(String(item.question || "")),
        answer: cleanPlainField(String(item.answer || "")),
      }))
      .filter((item: { question: string; answer: string }) => Boolean(item.question || item.answer));
  }
  if (Array.isArray(raw.keywordPlacementPlan)) {
    updated.keywordPlacementPlan = raw.keywordPlacementPlan
      .filter((item: unknown): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
      .map((item: Record<string, unknown>) => ({
        keyword: cleanKeyword(String(item.keyword || "")),
        ...(typeof item.priority === "string" ? { priority: cleanPlainField(item.priority) } : {}),
        ...(typeof item.targetSection === "string" ? { targetSection: cleanPlainField(item.targetSection) } : {}),
        ...(typeof item.exactSurfaceForm === "string" ? { exactSurfaceForm: cleanPlainField(item.exactSurfaceForm) } : {}),
      }))
      .filter((item: { keyword: string }) => Boolean(item.keyword));
  }
  if (raw.interviewPrep && typeof raw.interviewPrep === "object") {
    const ip = raw.interviewPrep as Record<string, unknown>;
    updated.interviewPrep = {
      ...(typeof ip.careerArcSummary === "string" ? { careerArcSummary: cleanPlainField(ip.careerArcSummary) } : {}),
      ...(Array.isArray(ip.questionsToAsk) ? { questionsToAsk: ip.questionsToAsk.map((q: unknown) => cleanPlainField(String(q))).filter(Boolean) } : {}),
      ...(Array.isArray(ip.callSurvivalNotes) ? { callSurvivalNotes: ip.callSurvivalNotes.map((n: unknown) => cleanPlainField(String(n))).filter(Boolean) } : {}),
      ...(Array.isArray(ip.starStories) ? {
        starStories: ip.starStories
          .filter((s: unknown): s is Record<string, unknown> => Boolean(s && typeof s === "object"))
          .map((s: Record<string, unknown>) => ({
            title: cleanPlainField(String(s.title || "")),
            situation: cleanPlainField(String(s.situation || "")),
            task: cleanPlainField(String(s.task || "")),
            action: cleanPlainField(String(s.action || "")),
            result: cleanPlainField(String(s.result || "")),
            ...(typeof s.sourceId === "string" ? { sourceId: cleanPlainField(s.sourceId) } : {}),
            ...(Array.isArray(s.keywords) ? { keywords: s.keywords.map((k: unknown) => cleanKeyword(String(k))).filter(Boolean) } : {}),
          })),
      } : {}),
    };
  }

  // 7. Set Version and Audit metadata (omit rawImportedAIJson to avoid storing redundant 10-15KB blobs)
  updated.schemaVersion = 2;
  if (rawText !== undefined) {
    updated.importMetadata = {
      timestamp: new Date().toISOString(),
      source: "import-modal",
    };
  } else if (updated.importMetadata?.rawImportedAIJson) {
    const cleanedMeta = { ...updated.importMetadata };
    delete cleanedMeta.rawImportedAIJson;
    updated.importMetadata = cleanedMeta;
  }

  applyImportContext(raw, updated);

  // Backfill posting identity and user salary hint carried via promptContext when not supplied explicitly
  const ctxOpts = updated.promptContext?.options;
  if (ctxOpts) {
    if (!updated.jobPostingUrl && ctxOpts.jobPostingUrl?.trim()) updated.jobPostingUrl = cleanUrlField(ctxOpts.jobPostingUrl);
    if (!updated.jobPostingId && ctxOpts.jobPostingId?.trim()) updated.jobPostingId = cleanPlainField(ctxOpts.jobPostingId);
    if (!updated.applicationDeadline && ctxOpts.applicationDeadline && /^\d{4}-\d{2}-\d{2}$/.test(ctxOpts.applicationDeadline.trim())) {
      updated.applicationDeadline = ctxOpts.applicationDeadline.trim();
    }
    if (!updated.formFieldAnswers.salaryExpectation?.trim() && ctxOpts.salaryExpectationHint?.trim()) {
      updated.formFieldAnswers.salaryExpectation = cleanPlainField(ctxOpts.salaryExpectationHint);
    }
  }

  // 8. Validate with Zod and cast back to Application
  const parsed = ApplicationSchema.safeParse(updated);
  if (!parsed.success) {
    throw new ImportValidationError(`Imported content failed validation: ${parsed.error.issues.map(issue => issue.path.join(".")).join(", ")}`);
  }
  return parsed.data;
}

// Backward-compatible public API. Domain modules import each other directly to
// keep the normalization pipeline free of circular dependencies.
export { cleanAIJsonText, parseLooseAIJson } from "./ai-import/json";
export { cleanScrapedTitleOrCompany, cleanPlainField, cleanUrlField, cleanRichTextField } from "./ai-import/fields";
export { detectDocumentLanguage } from "./ai-import/language";
export { sanitizeAiText, deduplicateAchievementsAgainstExperience, sanitizeApplicationAiContent } from "./ai-import/sanitize";
export { computeSmartAutoFitSettings, analyzeApplicationReadiness } from "./ai-import/readiness";
export { localizeDateRange, localizeLocation, localizeCertificationName, localizeWorkAuthorization } from "./localization";
