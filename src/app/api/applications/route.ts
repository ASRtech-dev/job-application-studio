import { NextResponse } from "next/server";
import { loadApplications, saveApplications, loadMasterCv, mirrorApplicationJson } from "@/lib/storage";
import { Application, ApplicationSchema } from "@/lib/schemas";
import { normalizeImportedAIJson } from "@/lib/aiJsonMapper";

export async function GET() {
  try {
    const list = loadApplications();
    list.sort((a, b) => new Date(b.dateModified).getTime() - new Date(a.dateModified).getTime());
    return NextResponse.json(list);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to load applications" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { company, roleTitle, language = "English", pastedJson } = body;

    let pastedData: any = null;
    if (pastedJson && typeof pastedJson === "string" && pastedJson.trim()) {
      try {
        pastedData = JSON.parse(pastedJson);
      } catch (err: any) {
        return NextResponse.json({ error: "Invalid JSON format: " + err.message }, { status: 400 });
      }
    }

    const finalCompany = company || pastedData?.company;
    const finalRoleTitle = roleTitle || pastedData?.roleTitle;
    const finalLanguage = language || pastedData?.language || "English";

    if (!finalCompany || !finalRoleTitle) {
      return NextResponse.json({ error: "Company and Role Title are required" }, { status: 400 });
    }

    const masterCv = loadMasterCv();

    let headline = masterCv.headlineVariants[0]?.headline || "";
    const lowerRole = String(finalRoleTitle).toLowerCase();
    const matchedHeadline = masterCv.headlineVariants.find((h) =>
      lowerRole.includes(h.category.toLowerCase().slice(0, 5))
    );
    if (matchedHeadline) headline = matchedHeadline.headline;

    let profileText = masterCv.profileVariants[0]?.text || "";
    const matchedProfile = masterCv.profileVariants.find((p) =>
      lowerRole.includes(p.category.toLowerCase().slice(0, 5))
    );
    if (matchedProfile) profileText = matchedProfile.text;

    const keyAchievements = masterCv.achievementsPool.slice(0, 3);

    const date = new Date();
    const day = date.getDate();
    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const monthsEs = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
    const monthsDe = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];

    let dateLine = `Berlin, ${day} ${months[date.getMonth()]} ${date.getFullYear()}`;
    let greeting = `Dear ${finalCompany} Hiring Team,`;
    let closingPhrase = "Kind regards,";

    if (finalLanguage === "Spanish") {
      dateLine = `Berlín, ${day} de ${monthsEs[date.getMonth()]} de ${date.getFullYear()}`;
      greeting = `Estimado equipo de selección de ${finalCompany},`;
      closingPhrase = "Atentamente,";
    } else if (finalLanguage === "German") {
      dateLine = `Berlin, den ${day}. ${monthsDe[date.getMonth()]} ${date.getFullYear()}`;
      greeting = `Sehr geehrtes ${finalCompany} Hiring Team,`;
      closingPhrase = "Mit freundlichen Grüßen,";
    }

    let newApp: Application = {
      id: "app_" + Math.random().toString(36).substring(2, 11),
      company: finalCompany,
      roleTitle: finalRoleTitle,
      dateCreated: date.toISOString(),
      dateModified: date.toISOString(),
      status: "draft",
      language: finalLanguage as "English" | "Spanish" | "German",
      cvContent: pastedData?.cvContent || {
        header: {
          fullName: masterCv.fullName,
          headline,
          location: masterCv.location,
          email: masterCv.email,
          phone: masterCv.phone,
          links: masterCv.links,
          availability: masterCv.availability,
          languages: masterCv.languages,
        },
        professionalProfile: profileText,
        keyAchievements,
        coreSkills: masterCv.skillsPool.slice(0, 4).map((g) => ({
          ...g,
          skills: g.skills.slice(0, 6),
        })),
        experience: masterCv.experienceHistory.map((exp, idx) => ({
          ...exp,
          summary: "",
          bullets: exp.bullets.slice(0, idx === 0 ? 4 : 2),
        })),
        projects: (masterCv.projectsHistory || []).map((proj) => ({
          ...proj,
          bullets: (proj.bullets || []).slice(0, 2),
        })),
        education: masterCv.educationHistory,
        certifications: masterCv.certificationsHistory,
      },
      coverLetterContent: pastedData?.coverLetterContent || {
        company: finalCompany,
        roleTitle: finalRoleTitle,
        subjectLine: `Application for ${finalRoleTitle}`,
        positioningLine: headline,
        dateLine,
        greeting,
        paragraphs: [
          {
            type: "opening",
            text: `${finalCompany}'s focus presents an exciting operational challenge. What makes this role compelling to me is the opportunity to deliver structured, scalable workflows.`
          },
          {
            type: "evidence",
            text: `My core background centers on designing reliable operating frameworks around complex processes, driving standardization, and eliminating repetitive manual reporting.`
          },
          {
            type: "fit",
            text: `This foundation maps directly to the needs of the ${finalRoleTitle} position: maintaining clean operational cadences and translating data into actionable decisions.`
          },
          {
            type: "contribution",
            text: `I contribute a hands-on, problem-solving mindset: documenting workflows with precision, resolving operational bottlenecks, and aligning cross-functional teams.`
          },
          {
            type: "closing",
            text: `I would welcome the opportunity to discuss how my background can support ${finalCompany}'s operational goals.`
          }
        ],
        closingPhrase,
        signatureName: masterCv.fullName,
        sidebarLabel: "COVER LETTER",
        sidebarRole: finalRoleTitle,
        sidebarCompany: finalCompany,
      },
      templateSettings: pastedData?.templateSettings || {
        cvTemplate: "ats-clean",
        coverLetterTemplate: "asr-sidebar",
        accentColor: "#10233f",
        fontFamily: "Inter",
        pageSize: "A4",
        fontSize: 10,
        lineSpacing: 1.32,
        sectionSpacing: 12,
        showKeyAchievements: true,
        showProjects: true,
      },
      assetSettings: pastedData?.assetSettings || {
        signature: {
          enabled: false,
          widthPx: 160,
          alignment: "left",
        },
        photo: {
          enabled: false,
          cropStyle: "portrait-rectangle",
          placement: "header-right",
        }
      },
      notes: pastedData?.notes || "",
      interviewDate: pastedData?.interviewDate || "",
      recruiterContact: pastedData?.recruiterContact || "",
      salaryOffer: pastedData?.salaryOffer || "",
      jobDescription: pastedData?.jobDescription || "",
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
        dealBreakerRisk: "Low"
      },
      formFieldAnswers: {
        shortMotivationMessage: "",
        whyThisRole: "",
        whyThisCompany: "",
        additionalMessage: "",
        availability: masterCv.availability || "Available immediately",
        degreeExplanation: "",
        workPermitGermany: "Yes",
        website: masterCv.links?.find((l) => l.label.toLowerCase().includes("web") || l.label.toLowerCase().includes("port"))?.url || "",
        linkedin: masterCv.links?.find((l) => l.label.toLowerCase().includes("link"))?.url || ""
      },
      salaryPositioning: {
        recommendedRangeEUR: "",
        safeNumberEUR: "",
        ambitiousNumberEUR: "",
        riskComment: ""
      },
      keywordStrategy: {
        mustIncludeATSKeywords: [],
        niceToHaveKeywords: [],
        humanNarrativeKeywords: [],
        avoidOrMinimizeKeywords: []
      },
      recruiterConcernHandling: {
        likelyConcerns: []
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
        applyOrSkip: "Apply selectively"
      },
      qualityControl: {
        directEvidenceUsed: [],
        transferableEvidenceUsed: [],
        adaptableSkillsUsed: [],
        potentialOverclaimsAvoided: [],
        atsKeywordsIncluded: [],
        humanRecruiterImpression: "",
        finalContentRisk: "Low",
        oneSentencePositioning: ""
      }
    };

    if (pastedJson && typeof pastedJson === "string" && pastedJson.trim()) {
      newApp = normalizeImportedAIJson(pastedData, newApp, pastedJson);
      if (!newApp.id) newApp.id = "app_" + Math.random().toString(36).substring(2, 11);
      newApp.dateCreated = date.toISOString();
      newApp.dateModified = date.toISOString();
    }

    const list = loadApplications();
    list.push(newApp);
    saveApplications(list);
    mirrorApplicationJson(newApp);

    return NextResponse.json(newApp);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to create application" }, { status: 500 });
  }
}
