import { NextResponse } from "next/server";
import { loadApplications, createApplication, loadMasterCv, mirrorApplicationJson, archiveImport } from "@/lib/storage";
import { guardApiRequest } from "@/lib/requestSecurity";
import { apiError, readObjectRequest } from "@/lib/apiErrors";
import { Application, CoverLetterParagraph, toApplicationSummary, PromptContextSchema } from "@/lib/schemas";
import { parseLooseAIJson, normalizeImportedAIJson, detectDocumentLanguage } from "@/lib/aiJsonMapper";
import { validateImportPayload } from "@/lib/importPreview";
import { formatDocumentDateLine } from "@/lib/localization";
import { resolvePromptContext } from "@/lib/generationContext";
import { pickSmartTemplateDefaults } from "@/lib/documentDesign";

/**
 * Neutral starter letter. It only reuses evidence present in the master CV (the selected
 * profile text); without that evidence it leaves a visible prompt to complete the paragraph.
 * It never asserts employers, metrics, studies or availability on its own.
 */
function buildLocalizedStarterCoverLetter(
  company: string,
  roleTitle: string,
  language: string,
  masterEvidence: string
): { paragraphs: CoverLetterParagraph[]; sidebarLabel: string; subjectLine: string } {
  const evidence = masterEvidence.trim();
  if (language === "German") {
    return {
      sidebarLabel: "ANSCHREIBEN",
      subjectLine: `Bewerbung als ${roleTitle}`,
      paragraphs: [
        { type: "opening", text: `hiermit bewerbe ich mich bei ${company} als ${roleTitle}.` },
        { type: "evidence", text: evidence || "[Bitte ergänzen: eine konkrete Erfahrung aus Ihrem Master-CV, die zur Stelle passt.]" },
        { type: "closing", text: `Ich freue mich darauf, im Gespräch zu klären, wie ich ${company} unterstützen kann.` },
      ],
    };
  }
  if (language === "Spanish") {
    return {
      sidebarLabel: "CARTA DE PRESENTACIÓN",
      subjectLine: `Candidatura para ${roleTitle}`,
      paragraphs: [
        { type: "opening", text: `Me dirijo a ${company} para presentar mi candidatura al puesto de ${roleTitle}.` },
        { type: "evidence", text: evidence || "[Por completar: una experiencia concreta de tu CV maestro relacionada con el puesto.]" },
        { type: "closing", text: `Me encantaría conversar sobre cómo puedo contribuir al equipo de ${company}.` },
      ],
    };
  }
  return {
    sidebarLabel: "COVER LETTER",
    subjectLine: `Application for ${roleTitle}`,
    paragraphs: [
      { type: "opening", text: `I am applying for the ${roleTitle} role at ${company}.` },
      { type: "evidence", text: evidence || "[To complete: one concrete experience from your master CV that matches this role.]" },
      { type: "closing", text: `I would welcome the opportunity to discuss how I can contribute to ${company}.` },
    ],
  };
}

/** A link is reused only when the master CV contains it; no personal fallback URLs. */
function masterLink(links: { label: string; url: string }[], pattern: RegExp): string {
  return links.find((link) => pattern.test(link.label) || pattern.test(link.url))?.url || "";
}

/** Profession-agnostic token-overlap matcher that picks the closest Master CV variant for any role title. */
function pickClosestVariant<T extends { category: string }>(
  list: T[],
  roleTitle: string,
  preferredCategory?: string
): T | undefined {
  if (!list.length) return undefined;
  if (preferredCategory?.trim()) {
    const exact = list.find((item) => item.category.toLowerCase() === preferredCategory.trim().toLowerCase());
    if (exact) return exact;
  }
  const tokenize = (value: string) =>
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .split(/\s+/)
      .filter((tok) => tok.length >= 3);
  const roleTokens = new Set(tokenize(roleTitle));
  if (!roleTokens.size) return list[0];

  let best: T | undefined;
  let bestScore = 0;
  for (const item of list) {
    const catTokens = tokenize(item.category);
    let score = 0;
    for (const token of catTokens) {
      if (roleTokens.has(token)) score += 2;
      else if ([...roleTokens].some((rt) => rt.includes(token) || token.includes(rt))) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      best = item;
    }
  }
  return best ?? list[0];
}

export async function GET(req: Request) {
  const denied = guardApiRequest(req); if (denied) return denied;
  try {
    const list = loadApplications();
    // Sort by dateModified descending
    list.sort((a, b) => new Date(b.dateModified).getTime() - new Date(a.dateModified).getTime());

    const { searchParams } = new URL(req.url);
    const full = searchParams.get("full") === "true" || searchParams.get("full") === "1";

    return NextResponse.json(full ? list : list.map(toApplicationSummary));
  } catch (err: unknown) {
    return apiError(err);
  }
}

export async function POST(req: Request) {
  const denied = guardApiRequest(req, "json"); if (denied) return denied;
  try {
    const body = await readObjectRequest(req) as {
      company?: string;
      roleTitle?: string;
      language?: string;
      pastedJson?: string;
      jobDescription?: string;
      promptContext?: unknown;
      variantCategory?: string;
      jobPostingUrl?: string;
      jobPostingId?: string;
      applicationDeadline?: string;
    };
    for (const key of ["company", "roleTitle", "language", "pastedJson", "jobDescription", "variantCategory", "jobPostingUrl", "jobPostingId", "applicationDeadline"] as const) {
      if (body[key] !== undefined && typeof body[key] !== "string") return NextResponse.json({ error: `Invalid ${key}` }, { status: 400 });
    }
    const { company, roleTitle, language, pastedJson, jobDescription, promptContext, variantCategory } = body;

    let pastedData: Record<string, unknown> | null = null;
    let cleanedJsonText = pastedJson;
    if (pastedJson && pastedJson.trim()) {
      try {
        const parsedRes = parseLooseAIJson(pastedJson);
        pastedData = parsedRes.data as Record<string, unknown>;
        cleanedJsonText = parsedRes.cleanedText;
      } catch (err: unknown) {
        return NextResponse.json({ error: "Invalid JSON format: " + (err instanceof Error ? err.message : String(err)) }, { status: 400 });
      }
      const validation = validateImportPayload(pastedData);
      if (!validation.ok) return NextResponse.json({ error: validation.errors.join(" ") }, { status: 400 });
    }

    const finalCompany = company || (typeof pastedData?.company === "string" ? pastedData.company : "");
    const finalRoleTitle = roleTitle || (typeof pastedData?.roleTitle === "string" ? pastedData.roleTitle : "");
    const explicitBodyLang = typeof language === "string" && language.trim() ? language.trim() : undefined;
    const detectedLang = pastedData
      ? detectDocumentLanguage(
          pastedData,
          explicitBodyLang === "German" || explicitBodyLang === "Spanish" || explicitBodyLang === "English" ? explicitBodyLang : "English"
        )
      : (explicitBodyLang || "English");
    const finalLanguage = detectedLang;

    if (!finalCompany || !finalRoleTitle) {
      return NextResponse.json({ error: "Company and Role Title are required" }, { status: 400 });
    }

    const capturedContext = PromptContextSchema.safeParse(promptContext);
    const reportedContext = PromptContextSchema.safeParse(pastedData?.promptContext);
    const masterCv = loadMasterCv();

    const headline = pickClosestVariant(masterCv.headlineVariants, finalRoleTitle, variantCategory)?.headline || "";
    const profileText = pickClosestVariant(masterCv.profileVariants, finalRoleTitle, variantCategory)?.text || "";
    const keyAchievements = masterCv.achievementsPool.slice(0, 3);

    const date = new Date();
    const typedLang = (finalLanguage === "German" || finalLanguage === "Spanish" ? finalLanguage : "English") as "English" | "German" | "Spanish";
    const dateLine = formatDocumentDateLine(typedLang, date, masterCv.location);
    let greeting = `Dear ${finalCompany} Hiring Team,`;
    let closingPhrase = "Kind regards,";

    if (finalLanguage === "Spanish") {
      greeting = `Estimado equipo de selección de ${finalCompany},`;
      closingPhrase = "Atentamente,";
    } else if (finalLanguage === "German") {
      greeting = "Sehr geehrte Damen und Herren,";
      closingPhrase = "Mit freundlichen Grüßen";
    }

    const confirmedAvailability = masterCv.availability.trim();
    const confirmedWorkAuth = (masterCv.workAuthorization || masterCv.workPermitGermany || "").trim();
    const starterLetter = buildLocalizedStarterCoverLetter(finalCompany, finalRoleTitle, finalLanguage, profileText);
    const linkedinUrl = masterLink(masterCv.links, /linkedin/i);
    const githubUrl = masterLink(masterCv.links, /github/i);
    const websiteUrl = masterCv.links.find((l) => /website|web|portfolio/i.test(l.label) && !/linkedin|github/i.test(l.url))?.url || "";

    let newApp: Application = {
      id: "app_" + Math.random().toString(36).substring(2, 11),
      company: finalCompany,
      roleTitle: finalRoleTitle,
      dateCreated: date.toISOString(),
      dateModified: date.toISOString(),
      status: "draft",
      language: typedLang,
      cvContent: {
        header: {
          fullName: masterCv.fullName,
          headline,
          location: masterCv.location,
          email: masterCv.email,
          phone: masterCv.phone,
          links: masterCv.links,
          availability: confirmedAvailability,
          languages: masterCv.languages,
        },
        professionalProfile: profileText,
        keyAchievements,
        coreSkills: masterCv.skillsPool.slice(0, 4).map((g) => ({
          ...g,
          skills: g.skills.slice(0, 5),
        })),
        experience: masterCv.experienceHistory.map((exp, idx) => ({
          ...exp,
          summary: "",
          bullets: exp.bullets.slice(0, idx === 0 ? 4 : idx === 1 ? 3 : 2),
        })),
        projects: masterCv.projectsHistory.map((proj) => ({
          ...proj,
          bullets: proj.bullets.slice(0, 2),
        })),
        education: masterCv.educationHistory,
        certifications: masterCv.certificationsHistory,
        ...(masterCv.specializedCompetencies?.length ? { specializedCompetencies: masterCv.specializedCompetencies } : {}),
      },
      coverLetterContent: {
        company: finalCompany,
        roleTitle: finalRoleTitle,
        subjectLine: starterLetter.subjectLine,
        positioningLine: headline,
        dateLine,
        greeting,
        paragraphs: starterLetter.paragraphs,
        closingPhrase,
        signatureName: masterCv.fullName,
        sidebarLabel: starterLetter.sidebarLabel,
        sidebarRole: finalRoleTitle,
        sidebarCompany: finalCompany,
      },
      templateSettings: (pastedData?.templateSettings as Application["templateSettings"] | undefined) || {
        ...pickSmartTemplateDefaults(
          typedLang,
          (reportedContext.success ? reportedContext.data.options.tonePreset : undefined) ??
            (capturedContext.success ? capturedContext.data.options.tonePreset : undefined)
        ),
        accentColor: "#10233f",
        pageSize: "A4",
        fontSize: 10,
        lineSpacing: 1.42,
        sectionSpacing: 14,
        showKeyAchievements: true,
        showProjects: true,
      },
      assetSettings: {
        signature: {
          enabled: false,
          widthPx: 160,
          alignment: "left",
        },
        photo: {
          enabled: false,
          cropStyle: "portrait-rectangle",
          placement: "header-right",
        },
      },
      notes: typeof pastedData?.notes === "string" ? pastedData.notes : "",
      interviewDate: typeof pastedData?.interviewDate === "string" ? pastedData.interviewDate : "",
      recruiterContact: typeof pastedData?.recruiterContact === "string" ? pastedData.recruiterContact : "",
      salaryOffer: typeof pastedData?.salaryOffer === "string" ? pastedData.salaryOffer : "",
      jobDescription: (typeof jobDescription === "string" && jobDescription.trim())
        ? jobDescription.trim()
        : (typeof pastedData?.jobDescription === "string" ? pastedData.jobDescription : ""),

      schemaVersion: 2,
      importMetadata: null,
      jobLocation: "",
      workModel: "",
      roleClassification: {
        type: "coreTarget",
        seniorityLevel: "mid",
        roleFamily: "",
        applicationPriority: "medium",
        outputMode: "standard",
        recommendedPositioning: "",
        cvIntensity: "Medium",
        overqualificationRisk: "Low",
        dealBreakerRisk: "Low",
      },
      formFieldAnswers: {
        shortMotivationMessage: "",
        whyThisRole: "",
        whyThisCompany: "",
        additionalMessage: "",
        availability: confirmedAvailability,
        degreeExplanation: "",
        workAuthorization: confirmedWorkAuth,
        workPermitGermany: confirmedWorkAuth,
        website: websiteUrl,
        linkedin: linkedinUrl,
        ...(githubUrl ? { github: githubUrl } : {}),
      },
      salaryPositioning: {
        recommendedRangeEUR: "",
        safeNumberEUR: "",
        ambitiousNumberEUR: "",
        riskComment: "",
      },
      keywordStrategy: {
        mustIncludeATSKeywords: [],
        niceToHaveKeywords: [],
        humanNarrativeKeywords: [],
        avoidOrMinimizeKeywords: [],
      },
      recruiterConcernHandling: {
        likelyConcerns: [],
      },
      fitAssessment: {
        scoreOutOf10: null,
        probabilityTier: "Medium",
        summary: "",
        bestAngles: [],
        mainRisks: [],
        recommendedApplicationStrategy: "",
        recommendedTone: "",
        recommendedCVVersion: "",
        applyOrSkip: "Apply selectively",
      },
      qualityControl: {
        directEvidenceUsed: [],
        transferableEvidenceUsed: [],
        adaptableSkillsUsed: [],
        potentialOverclaimsAvoided: [],
        atsKeywordsIncluded: [],
        humanRecruiterImpression: "",
        finalContentRisk: "Low",
        oneSentencePositioning: "",
      },
      ...(masterCv.interviewPrep ? { interviewPrep: structuredClone(masterCv.interviewPrep) } : {}),
    };

    if (pastedJson && pastedJson.trim()) {
      newApp = normalizeImportedAIJson(pastedData, newApp, cleanedJsonText);
      if (!newApp.id) newApp.id = "app_" + Math.random().toString(36).substring(2, 11);
      if (typeof jobDescription === "string" && jobDescription.trim() && !newApp.jobDescription) {
        newApp.jobDescription = jobDescription.trim();
      }
      newApp.dateCreated = date.toISOString();
      newApp.dateModified = date.toISOString();
    }

    if (body.jobPostingUrl?.trim()) newApp.jobPostingUrl = body.jobPostingUrl.trim();
    if (body.jobPostingId?.trim()) newApp.jobPostingId = body.jobPostingId.trim();
    if (body.applicationDeadline?.trim()) newApp.applicationDeadline = body.applicationDeadline.trim();

    const provenance = resolvePromptContext(newApp.promptContext, capturedContext.success ? capturedContext.data : null);
    if (provenance.context) newApp.promptContext = provenance.context;
    if (provenance.warning && newApp.importMetadata) newApp.importMetadata.warnings = [...(newApp.importMetadata.warnings || []), provenance.warning];

    const ctxOpts = newApp.promptContext?.options;
    if (ctxOpts) {
      if (!newApp.jobPostingUrl && ctxOpts.jobPostingUrl?.trim()) newApp.jobPostingUrl = ctxOpts.jobPostingUrl.trim();
      if (!newApp.jobPostingId && ctxOpts.jobPostingId?.trim()) newApp.jobPostingId = ctxOpts.jobPostingId.trim();
      if (!newApp.applicationDeadline && ctxOpts.applicationDeadline && /^\d{4}-\d{2}-\d{2}$/.test(ctxOpts.applicationDeadline.trim())) {
        newApp.applicationDeadline = ctxOpts.applicationDeadline.trim();
      }
      if (!newApp.formFieldAnswers.salaryExpectation?.trim() && ctxOpts.salaryExpectationHint?.trim()) {
        newApp.formFieldAnswers.salaryExpectation = ctxOpts.salaryExpectationHint.trim();
      }
    }

    if (pastedJson?.trim() && newApp.importMetadata) newApp.importMetadata.runId = archiveImport(pastedJson, newApp.id);
    newApp = createApplication(newApp);
    mirrorApplicationJson(newApp);

    return NextResponse.json(newApp);
  } catch (err: unknown) {
    return apiError(err);
  }
}
