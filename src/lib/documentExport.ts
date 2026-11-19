import { sanitizeDownloadName } from "./filenames";
import type { Application } from "./schemas";
import { DOCUMENT_LAYOUT } from "./documentDesign";

export type DocumentType = "cv" | "letter" | "prep";
export type PdfExportType = DocumentType | "master-cv" | "cv-refs" | "letter-refs" | "full-bundle" | "ats-bundle" | "references";
export type JsonExportTarget = "full" | "strategic" | "cv" | "letter";

export interface DocumentHtmlOptions {
  /** Disables the strict 2-page CV ceiling (used for complete portal Master CV exports). */
  unboundedPages?: boolean;
  /** Optional footer suffix label overriding the default "CV" / "Lebenslauf". */
  documentLabel?: string;
}

/** Identifies the existing preview node; the caller owns DOM access. */
export function getDocumentElementId(app: Application, docType: DocumentType): string {
    if (docType === "cv") {
      if (app.templateSettings.cvTemplate === "modern-professional") return "cv-template-modern";
      if (app.templateSettings.cvTemplate === "dach-tabular") return "cv-template-tabular";
      return "cv-template-ats";
    }
    if (docType === "letter") {
      if (app.templateSettings.coverLetterTemplate === "editorial-sidebar") return "letter-template-sidebar";
      if (app.templateSettings.coverLetterTemplate === "din-editorial") return "letter-template-din";
      return "letter-template-ats";
    }
    return "prep-template-star";
}

/** Wraps document markup with the same A4 print rules used by the live editor. */
export function buildDocumentHtml(app: Application, docType: DocumentType, documentMarkup: string, options?: DocumentHtmlOptions): string {
    const isSidebarTemplate = docType === "letter" && app.templateSettings.coverLetterTemplate === "editorial-sidebar";
    const isDinTemplate = docType === "letter" && app.templateSettings.coverLetterTemplate === "din-editorial";
    const baseLayout = docType === "cv"
      ? DOCUMENT_LAYOUT.cv
      : isSidebarTemplate
      ? DOCUMENT_LAYOUT.sidebarLetter
      : isDinTemplate
      ? DOCUMENT_LAYOUT.dinLetter
      : DOCUMENT_LAYOUT.letter;
    const layout = options?.unboundedPages || options?.documentLabel
      ? {
          ...baseLayout,
          ...(options.unboundedPages ? { maxPages: null } : {}),
          ...(options.documentLabel ? { documentLabel: options.documentLabel } : {}),
        }
      : baseLayout;
    const paginated = docType !== "prep";
    const pageMarginCss = paginated
      ? `@page { size: A4; margin: 0; }`
      : `@page { size: A4; margin: 15mm 16mm; }`;

    const printOverrideCss = docType === "prep"
      ? `
        #cv-template-ats, #cv-template-modern, #cv-template-tabular, #letter-template-ats, #letter-template-din, #prep-template-star {
          padding: 0 !important;
          margin: 0 !important;
          width: 100% !important;
          min-height: 0 !important;
          box-shadow: none !important;
          border: none !important;
        }
      `
      : `.document-page { break-inside: avoid; page-break-inside: avoid; }
         .document-page-content * { max-width: 100%; }
         .document-page-content a { overflow-wrap: anywhere; }
         .document-pages { margin: 0 !important; }
         @media screen { .document-page + .document-page { box-shadow: 0 -1px 0 #d8dee8; } }`;

    const htmlLang = app.language === "German" ? "de" : app.language === "Spanish" ? "es" : "en";

    return `
      <!DOCTYPE html>
      <html lang="${htmlLang}">
        <head>
          <meta charset="utf-8">
          ${paginated ? `<meta name="job-page-layout" content='${JSON.stringify(layout)}'>` : ""}
          <style>
            * {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
            }
            ul {
              padding-left: 16px;
              list-style-type: disc;
            }
            body {
              margin: 0;
              padding: 0;
              background-color: white;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
              -webkit-font-smoothing: antialiased;
              -moz-osx-font-smoothing: grayscale;
              text-rendering: geometricPrecision;
              font-variant-ligatures: none;
              font-feature-settings: "liga" 0, "clig" 0;
            }
            ${pageMarginCss}
            ${printOverrideCss}
            .break-avoid, .signature-block, .project-entry, li {
              break-inside: avoid !important;
              page-break-inside: avoid !important;
            }
            p, ul {
              orphans: 2;
              widows: 2;
            }
            h2, h3, .section-heading {
              break-after: avoid !important;
              page-break-after: avoid !important;
              break-inside: avoid !important;
              page-break-inside: avoid !important;
            }
            .page-break-indicator {
              display: none !important;
            }
          </style>
        </head>
        <body>
          ${documentMarkup}
        </body>
      </html>
    `;
  }

export function getProfessionalFilename(app: Application, docType: PdfExportType): string {
  const cleanName = sanitizeDownloadName(app.cvContent?.header?.fullName || "Candidate");
  if (docType === "master-cv") {
    return `${cleanName}_Master_CV_${sanitizeDownloadName(app.language || "English")}.pdf`;
  }
  const cleanCompany = sanitizeDownloadName(app.company || "Generic");
  // The role keeps two applications to one company apart in the download name.
  const cleanRole = sanitizeDownloadName(app.roleTitle || "").slice(0, 60).replace(/[_-]+$/g, "");
  const labels: Record<PdfExportType, string> = {
    cv: "CV",
    "master-cv": "Master_CV",
    letter: "Cover_Letter",
    prep: "STAR_Prep",
    "cv-refs": "CV_References",
    "letter-refs": "Cover_Letter_References",
    "full-bundle": "Application_Bundle",
    "ats-bundle": "Application_ATS_Bundle",
    references: "References",
  };
  return cleanName + "_" + (labels[docType] || "CV") + "_" + cleanCompany + (cleanRole ? "_" + cleanRole : "") + ".pdf";
}

export function getPdfKeywords(app: Application): string[] {
  return Array.from(
    new Set([
      ...(app.keywordStrategy?.mustIncludeATSKeywords || []),
      ...(app.qualityControl?.atsKeywordsIncluded || []),
      ...(app.keywordStrategy?.niceToHaveKeywords || []).slice(0, 5),
    ].map((keyword) => keyword.trim()).filter(Boolean))
  );
}

/** Stamps PDF /Keywords only with terms verified in visible CV content (no phantom metadata). */
export function getVerifiedPdfKeywords(app: Application): string[] {
  const normalize = (value: string) => value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9+.#/-]+/g, " ").trim();
  const visibleExperiences = (app.cvContent?.experience || []).filter((e) => e.include !== false);
  const visibleProjects = (app.cvContent?.projects || []).filter((p) => p.include !== false);
  const haystack = normalize([
    app.cvContent?.header?.headline || "",
    app.cvContent?.professionalProfile || "",
    ...(app.cvContent?.keyAchievements || []),
    ...visibleExperiences.flatMap((e) => [e.jobTitle, e.company, e.summary || "", ...(e.bullets || [])]),
    ...visibleProjects.flatMap((p) => [p.title, p.role || "", p.description || "", ...(p.techStack || []), ...(p.bullets || [])]),
    ...(app.cvContent?.coreSkills || []).flatMap((g) => [g.group, ...(g.skills || [])]),
    ...(app.cvContent?.specializedCompetencies || []),
    ...(app.cvContent?.certifications || []).flatMap((c) => [c.name, c.authority || ""]),
    ...(app.cvContent?.header?.languages || []).flatMap((l) => [l.language, l.level]),
  ].join(" "));
  if (!haystack) return [];
  return getPdfKeywords(app).filter((kw) => {
    const clean = normalize(kw);
    return Boolean(clean) && haystack.includes(clean);
  });
}

/** Selects the JSON payload without touching the draft or browser state. */
export function buildJsonExport(app: Application, target: JsonExportTarget): { data: unknown; filename: string } {
  let data: unknown = app;
  let label = "Full_Data";
  if (target === "strategic") {
    data = {
      roleClassification: app.roleClassification,
      fitAssessment: app.fitAssessment,
      salaryPositioning: app.salaryPositioning,
      keywordStrategy: app.keywordStrategy,
      recruiterConcernHandling: app.recruiterConcernHandling,
      qualityControl: app.qualityControl,
      importMetadata: app.importMetadata,
      jobDescription: app.jobDescription,
      jobAnalysis: app.jobAnalysis,
      promptContext: app.promptContext,
    };
    label = "Strategic_Plan";
  } else if (target === "cv") {
    data = app.cvContent;
    label = "CV_Data";
  } else if (target === "letter") {
    data = app.coverLetterContent;
    label = "Cover_Letter_Data";
  }
  const name = sanitizeDownloadName(app.cvContent?.header?.fullName || "Candidate");
  const company = sanitizeDownloadName(app.company || "Generic");
  return { data, filename: name + "_" + label + "_" + company + ".json" };
}
