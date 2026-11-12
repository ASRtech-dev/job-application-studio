import React from "react";
import { Application, ProjectEntry, SkillGroup } from "@/lib/schemas";

interface TemplateProps {
  data: Application;
  // Optional base64 overrides for assets
  photoBase64?: string;
  signatureBase64?: string;
}

// -------------------------------------------------------------
// LOCALIZATION DICTIONARY (EN / DE / ES)
// -------------------------------------------------------------
type DocLang = "English" | "German" | "Spanish";

const SECTION_LABELS: Record<
  DocLang,
  {
    profile: string;
    achievements: string;
    skills: string;
    experience: string;
    projects: string;
    education: string;
    certifications: string;
    languages: string;
    availability: string;
  }
> = {
  English: {
    profile: "Professional Profile",
    achievements: "Key Achievements",
    skills: "Core Skills",
    experience: "Professional Experience",
    projects: "Selected Projects",
    education: "Education",
    certifications: "Certifications",
    languages: "Languages",
    availability: "Availability",
  },
  German: {
    profile: "Berufsprofil",
    achievements: "Wichtigste Erfolge",
    skills: "Kernkompetenzen",
    experience: "Berufserfahrung",
    projects: "Ausgewählte Projekte",
    education: "Ausbildung",
    certifications: "Zertifizierungen",
    languages: "Sprachen",
    availability: "Verfügbarkeit",
  },
  Spanish: {
    profile: "Perfil Profesional",
    achievements: "Logros Clave",
    skills: "Competencias Clave",
    experience: "Experiencia Profesional",
    projects: "Proyectos Destacados",
    education: "Educación",
    certifications: "Certificaciones",
    languages: "Idiomas",
    availability: "Disponibilidad",
  },
};

function getEffectiveLanguage(data: Application): DocLang {
  if (data.language === "German" || data.language === "Spanish") {
    return data.language;
  }
  const sample = [
    data.cvContent?.professionalProfile || "",
    data.coverLetterContent?.greeting || "",
    data.coverLetterContent?.sidebarLabel || "",
  ].join(" ");
  if (/\b(und|für|mit|über|durch|Liebes|Sehr geehrte|ANSCHREIBEN)\b/i.test(sample)) {
    return "German";
  }
  if (/\b(para|con|los|las|una|Estimado|Atentamente|CARTA DE PRESENTACIÓN)\b/i.test(sample)) {
    return "Spanish";
  }
  return "English";
}

// -------------------------------------------------------------
// RICH TEXT & METRIC EMPHASIS HELPER (100% ATS-SAFE INLINE DOM)
// -------------------------------------------------------------
const METRIC_REGEX =
  /(\*\*[^*]+?\*\*|\b\d+(?:[.,]\d+)?\s*(?:%|percent|Prozent)\b|(?:€|\$|£)\s*\d+(?:[.,]\d+)?\s*[KMBkmb]?\+?|\b\d+(?:[.,]\d+)?\s*[KMBkmb]?\+?\s*(?:€|EUR|USD)\b|\b\d+\+\s*(?:documented\s+processes|processes|dokumentierte\s+Prozesse|procesos\s+documentados|markets|Märkte|mercados)\b|\b14\s+(?:European\s+markets|europäischen?\s+Märkten?|mercados\s+europeos)\b)/gi;

export function renderRichText(text: string, autoHighlightMetrics = true): React.ReactNode {
  if (!text) return null;
  const cleaned = text.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, "$1");

  const hasExplicitBold = cleaned.includes("**");
  if (!autoHighlightMetrics && !hasExplicitBold) {
    return cleaned;
  }

  // If text already contains explicit **bold** markers from the LLM, do not run METRIC_REGEX
  // on top of it—prevents the "AI zebra-bolding" giveaway where 4 phrases per line are bolded.
  const useRegex = hasExplicitBold ? /(\*\*[^*]+?\*\*)/g : METRIC_REGEX;
  const parts = cleaned.split(useRegex);
  let boldCount = 0;

  return parts.map((part, idx) => {
    if (!part) return null;
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      boldCount++;
      const inner = part.slice(2, -2);
      if (boldCount > 2) {
        return <React.Fragment key={idx}>{inner}</React.Fragment>;
      }
      return (
        <strong key={idx} style={{ fontWeight: 600, color: "inherit" }}>
          {inner}
        </strong>
      );
    }
    if (!hasExplicitBold && autoHighlightMetrics && METRIC_REGEX.test(part)) {
      METRIC_REGEX.lastIndex = 0;
      boldCount++;
      if (boldCount > 2) {
        return <React.Fragment key={idx}>{part}</React.Fragment>;
      }
      return (
        <strong key={idx} style={{ fontWeight: 600, color: "inherit" }}>
          {part}
        </strong>
      );
    }
    METRIC_REGEX.lastIndex = 0;
    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}

// -------------------------------------------------------------
// DEFENSIVE DATA SANITIZERS FOR LEGACY / IMPORTED JSONS
// -------------------------------------------------------------
function getCleanSkills(coreSkills: SkillGroup[] | undefined): SkillGroup[] {
  if (!coreSkills || !Array.isArray(coreSkills)) return [];
  return coreSkills
    .map((g) => ({
      group: g.group,
      skills: (g.skills || [])
        .flatMap((s) => String(s || "").split(/\s*[|;]\s*/))
        .map((s) => s.trim())
        .filter(Boolean),
    }))
    .filter((g) => g.skills.length > 0);
}

function getCleanProjects(projects: ProjectEntry[] | undefined): ProjectEntry[] {
  if (!projects || !Array.isArray(projects)) return [];
  return projects
    .filter((p) => {
      if (!p || (p as any).include === false) return false;
      // Filter legacy un-excluded placeholder project if it has literal "Dates"
      if (p.dates === "Dates" && p.title.toLowerCase().includes("application builder")) {
        return false;
      }
      return true;
    })
    .map((p) => ({
      ...p,
      dates: p.dates === "Dates" || p.dates === "Period" ? "" : p.dates,
    }));
}

function formatProjectTitleAndRole(title: string, role?: string): { cleanTitle: string; cleanRole: string; hasParensInTitle: boolean } {
  const cleanTitle = (title || "").trim();
  const cleanRole = (role || "").trim();
  const hasParensInTitle = /\([^)]+\)\s*$/.test(cleanTitle);
  return { cleanTitle, cleanRole, hasParensInTitle };
}

// -------------------------------------------------------------
// INLINE VECTOR ICONS (OUTSIDE PDF TEXT LAYER — 100% ATS-INVISIBLE)
// -------------------------------------------------------------
const IconPin: React.FC<{ color?: string }> = ({ color = "#6b7280" }) => (
  <svg
    width="10"
    height="10"
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
    style={{ width: "10px", height: "10px", display: "inline-block", verticalAlign: "-1px", marginRight: "3px", flexShrink: 0 }}
  >
    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

const IconMail: React.FC<{ color?: string }> = ({ color = "#6b7280" }) => (
  <svg
    width="10"
    height="10"
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
    style={{ width: "10px", height: "10px", display: "inline-block", verticalAlign: "-1px", marginRight: "3px", flexShrink: 0 }}
  >
    <rect width="20" height="16" x="2" y="4" rx="2" />
    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
  </svg>
);

const IconPhone: React.FC<{ color?: string }> = ({ color = "#6b7280" }) => (
  <svg
    width="10"
    height="10"
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
    style={{ width: "10px", height: "10px", display: "inline-block", verticalAlign: "-1px", marginRight: "3px", flexShrink: 0 }}
  >
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
  </svg>
);

const IconGlobe: React.FC<{ color?: string }> = ({ color = "#6b7280" }) => (
  <svg
    width="10"
    height="10"
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
    style={{ width: "10px", height: "10px", display: "inline-block", verticalAlign: "-1px", marginRight: "3px", flexShrink: 0 }}
  >
    <circle cx="12" cy="12" r="10" />
    <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
    <path d="M2 12h20" />
  </svg>
);

const IconCalendar: React.FC<{ color?: string }> = ({ color = "#6b7280" }) => (
  <svg
    width="10"
    height="10"
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
    style={{ width: "10px", height: "10px", display: "inline-block", verticalAlign: "-1px", marginRight: "3px", flexShrink: 0 }}
  >
    <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
    <line x1="16" x2="16" y1="2" y2="6" />
    <line x1="8" x2="8" y1="2" y2="6" />
    <line x1="3" x2="21" y1="10" y2="10" />
  </svg>
);

// -------------------------------------------------------------
// ACCURATE PAGE BREAK GUIDES (MATCHING CHROMIUM @page PRINT AREA)
// -------------------------------------------------------------
interface PageBreakGuidesProps {
  topPaddingMm?: number;
  netPageHeightMm?: number;
}

const PageBreakGuides: React.FC<PageBreakGuidesProps> = ({
  topPaddingMm = 15,
  netPageHeightMm = 267, // 297mm A4 - (15mm top + 15mm bottom @page margin) = 267mm net printable height
}) => {
  const pages = [1, 2, 3];
  return (
    <>
      {pages.map((page) => {
        const breakTopMm = topPaddingMm + page * netPageHeightMm;
        return (
          <div
            key={page}
            className="page-break-indicator"
            style={{
              position: "absolute",
              top: `${breakTopMm}mm`,
              left: 0,
              right: 0,
              borderTop: "2px dashed rgba(244, 63, 94, 0.65)",
              zIndex: 100,
              pointerEvents: "none",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span
              style={{
                fontSize: "7.5pt",
                color: "#ffffff",
                backgroundColor: "rgba(244, 63, 94, 0.9)",
                padding: "2px 8px",
                borderRadius: "4px",
                fontWeight: "bold",
                transform: "translateY(-50%)",
                marginLeft: "10px",
                fontFamily: "Inter, Arial, sans-serif",
                letterSpacing: "0.5px",
              }}
            >
              END OF PAGE {page} · START OF PAGE {page + 1}
            </span>
            <span
              style={{
                fontSize: "7pt",
                color: "rgba(244, 63, 94, 0.95)",
                backgroundColor: "#ffffff",
                border: "1.5px solid rgba(244, 63, 94, 0.55)",
                padding: "1px 6px",
                borderRadius: "4px",
                fontWeight: 600,
                transform: "translateY(-50%)",
                marginRight: "10px",
                fontFamily: "Inter, Arial, sans-serif",
              }}
            >
              A4 PDF Page Break ({breakTopMm}mm)
            </span>
          </div>
        );
      })}
    </>
  );
};

// -------------------------------------------------------------
// SHARED EXECUTIVE PORTRAIT FRAMING HELPER (DACH 3:4 BEWERBUNGSFOTO)
// -------------------------------------------------------------
function getExecutivePortraitStyle(
  cropStyle: string | undefined,
  accentColor: string,
  variant: "ats" | "modern" = "modern"
): { container: React.CSSProperties; image: React.CSSProperties } {
  const mode = cropStyle || "portrait-rectangle";
  const isCircle = mode === "circle";
  const isSquircle = mode === "rounded-square";

  const width = isCircle
    ? "84px"
    : isSquircle
    ? "84px"
    : variant === "ats"
    ? "78px"
    : "82px";

  const height = isCircle
    ? "84px"
    : isSquircle
    ? "94px"
    : variant === "ats"
    ? "100px"
    : "106px";

  const outerRadius = isCircle ? "50%" : isSquircle ? "12px" : "8px";
  const innerRadius = isCircle ? "50%" : isSquircle ? "9px" : "5.5px";

  return {
    container: {
      display: "inline-block",
      padding: "2.5px",
      backgroundColor: "#ffffff",
      border: "1px solid #cbd5e1",
      borderTop: isCircle ? "1px solid #cbd5e1" : `2.5px solid ${accentColor}`,
      borderRadius: outerRadius,
      boxShadow:
        "0 6px 16px -3px rgba(16, 35, 63, 0.14), 0 2px 5px -1px rgba(15, 23, 42, 0.06)",
      flexShrink: 0,
      marginLeft: "18px",
    },
    image: {
      width,
      height,
      borderRadius: innerRadius,
      objectFit: "cover" as const,
      objectPosition: "center 16%",
      display: "block",
    },
  };
}

// -------------------------------------------------------------
// 1. ATS CLEAN CV TEMPLATE (EXECUTIVE SINGLE-COLUMN + 2-COL SKILLS)
// -------------------------------------------------------------
export const AtsCleanCv: React.FC<TemplateProps> = ({ data, photoBase64 }) => {
  const cv = data.cvContent;
  const lang = getEffectiveLanguage(data);
  const labels = SECTION_LABELS[lang];

  const accentColor = data.templateSettings?.accentColor || "#10233f";
  const fontFamily = data.templateSettings?.fontFamily || "Inter";
  const showPhoto = data.assetSettings?.photo?.enabled;
  const photoUrl = photoBase64 || data.assetSettings?.photo?.filePath;
  const cropStyle = data.assetSettings?.photo?.cropStyle || "portrait-rectangle";
  const hasPhoto = Boolean(showPhoto && photoUrl);
  const portraitStyle = getExecutivePortraitStyle(cropStyle, accentColor, "ats");

  const fontSize = data.templateSettings?.fontSize || 10;
  const lineSpacing = data.templateSettings?.lineSpacing || 1.32;
  const sectionSpacing = data.templateSettings?.sectionSpacing || 12;
  const bulletLineHeight = Math.max(lineSpacing - 0.05, 1.24);
  const showKeyAchievements = data.templateSettings?.showKeyAchievements !== false;
  const showProjects = data.templateSettings?.showProjects !== false;

  const cleanSkills = getCleanSkills(cv.coreSkills);
  const cleanProjects = showProjects ? getCleanProjects(cv.projects) : [];

  const sectionHeadingStyle: React.CSSProperties = {
    fontSize: "9.8pt",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    borderBottom: "1px solid #cbd5e1",
    paddingBottom: "2.5px",
    marginTop: "8px",
    marginBottom: "6px",
    fontWeight: 700,
    color: accentColor,
  };

  return (
    <div
      id="cv-template-ats"
      lang={lang === "German" ? "de" : lang === "Spanish" ? "es" : "en"}
      style={{
        boxSizing: "border-box",
        width: "210mm",
        minHeight: "297mm",
        padding: "15mm 16mm",
        backgroundColor: "#ffffff",
        color: "#111827",
        fontFamily: `${fontFamily}, Arial, Helvetica, sans-serif`,
        fontSize: `${fontSize}pt`,
        lineHeight: lineSpacing,
        margin: "0 auto",
        position: "relative",
        fontVariantLigatures: "none",
        fontFeatureSettings: '"liga" 0, "clig" 0',
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {/* Header */}
      <div
        className="break-avoid"
        style={
          hasPhoto
            ? {
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "10px",
                paddingBottom: "8px",
                borderBottom: "1px solid #e2e8f0",
              }
            : { textAlign: "center", marginBottom: "10px" }
        }
      >
        <div style={{ flex: 1 }}>
          <h1
            style={{
              fontSize: "20.5pt",
              fontWeight: 700,
              margin: "0 0 3px 0",
              color: "#111827",
              letterSpacing: "-0.35px",
            }}
          >
            {cv.header.fullName}
          </h1>
          <div
            style={{
              fontSize: "10.3pt",
              fontWeight: 600,
              color: accentColor,
              marginBottom: "5px",
              textWrap: "balance" as any,
            }}
          >
            {cv.header.headline}
          </div>
          <div style={{ fontSize: "8.7pt", color: "#374151" }}>
            {[cv.header.location, cv.header.email, cv.header.phone].filter(Boolean).join("  ·  ")}
            {cv.header.links &&
              cv.header.links.map((link, idx) => {
                const displayUrl = link.url
                  .replace(/^https?:\/\//i, "")
                  .replace(/^www\./i, "")
                  .replace(/\/$/, "");
                return (
                  <span key={idx}>
                    {"  ·  "}
                    <a href={link.url} style={{ color: accentColor, textDecoration: "none", fontWeight: 600 }}>
                      {displayUrl}
                    </a>
                  </span>
                );
              })}
          </div>
          <div style={{ fontSize: "8.5pt", color: "#4b5563", marginTop: "2.5px" }}>
            <strong style={{ color: "#374151" }}>{labels.availability}:</strong> {cv.header.availability}
            {cv.header.languages && cv.header.languages.length > 0 && (
              <>
                {"  ·  "}
                <strong style={{ color: "#374151" }}>{labels.languages}:</strong>{" "}
                {cv.header.languages.map((l) => `${l.language} (${l.level})`).join(", ")}
              </>
            )}
          </div>
        </div>
        {hasPhoto && (
          <div style={portraitStyle.container}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photoUrl} alt={cv.header.fullName} style={portraitStyle.image} />
          </div>
        )}
      </div>

      {/* Professional Profile */}
      {cv.professionalProfile && (
        <div className="break-avoid" style={{ marginBottom: `${sectionSpacing}px` }}>
          <h2 style={sectionHeadingStyle}>{labels.profile}</h2>
          <p
            style={{
              margin: "0",
              fontSize: `${fontSize - 0.2}pt`,
              textAlign: "left",
              color: "#1f2937",
              textWrap: "pretty" as any,
            }}
          >
            {renderRichText(cv.professionalProfile, true)}
          </p>
        </div>
      )}

      {/* Key Achievements */}
      {showKeyAchievements && cv.keyAchievements && cv.keyAchievements.length > 0 && (
        <div style={{ marginBottom: `${sectionSpacing}px` }}>
          <div className="break-avoid">
            <h2 style={sectionHeadingStyle}>{labels.achievements}</h2>
            <ul style={{ margin: "0", paddingLeft: "15px" }}>
              <li
                style={{
                  marginBottom: "3.5px",
                  lineHeight: bulletLineHeight,
                  fontSize: `${fontSize - 0.2}pt`,
                  textAlign: "left",
                  color: "#1f2937",
                  textWrap: "pretty" as any,
                }}
              >
                {renderRichText(cv.keyAchievements[0], true)}
              </li>
            </ul>
          </div>
          {cv.keyAchievements.length > 1 && (
            <ul style={{ margin: "0", paddingLeft: "15px" }}>
              {cv.keyAchievements.slice(1).map((achievement, idx) => (
                <li
                  key={idx}
                  className="break-avoid"
                  style={{
                    marginBottom: "3.5px",
                    lineHeight: bulletLineHeight,
                    fontSize: `${fontSize - 0.2}pt`,
                    textAlign: "left",
                    color: "#1f2937",
                    textWrap: "pretty" as any,
                  }}
                >
                  {renderRichText(achievement, true)}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Core Skills — Tabular Editorial Category Grid (2-second scan) */}
      {cleanSkills.length > 0 && (
        <div className="break-avoid" style={{ marginBottom: `${sectionSpacing}px` }}>
          <h2 style={sectionHeadingStyle}>{labels.skills}</h2>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "3.5px",
            }}
          >
            {cleanSkills.map((group, idx) => (
              <div
                key={idx}
                className="break-avoid"
                style={{
                  display: "grid",
                  gridTemplateColumns: "165px 1fr",
                  gap: "10px",
                  alignItems: "baseline",
                  fontSize: `${fontSize - 0.5}pt`,
                  lineHeight: 1.28,
                  textAlign: "left",
                  paddingBottom: idx < cleanSkills.length - 1 ? "2.5px" : "0",
                  borderBottom: idx < cleanSkills.length - 1 ? "0.5px solid #f1f5f9" : "none",
                }}
              >
                <strong style={{ color: "#111827", fontWeight: 700 }}>{group.group}</strong>
                <span style={{ color: "#374151", textWrap: "pretty" as any }}>{group.skills.join("  ·  ")}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Professional Experience */}
      {cv.experience && cv.experience.length > 0 && (
        <div style={{ marginBottom: `${sectionSpacing}px` }}>
          <h2 style={sectionHeadingStyle}>{labels.experience}</h2>
          {cv.experience.map((exp, idx) => {
            const firstBullets = exp.bullets.slice(0, 2);
            const restBullets = exp.bullets.slice(2);
            return (
              <div key={exp.id || idx} className="experience-entry" style={{ marginBottom: "9.5px" }}>
                <div className="break-avoid">
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "baseline",
                      fontSize: `${fontSize}pt`,
                      gap: "12px",
                      marginBottom: "1.5px",
                    }}
                  >
                    <div>
                      <strong style={{ color: "#111827", fontWeight: 700 }}>{exp.jobTitle}</strong>
                      {exp.company && (
                        <span style={{ color: accentColor, fontWeight: 600 }}>  —  {exp.company}</span>
                      )}
                    </div>
                    <div
                      style={{
                        fontWeight: 600,
                        fontSize: `${fontSize - 0.8}pt`,
                        color: "#374151",
                        whiteSpace: "nowrap",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {exp.dates}
                      {exp.location && (
                        <span style={{ fontWeight: 400, color: "#6b7280" }}> · {exp.location}</span>
                      )}
                    </div>
                  </div>
                  {exp.summary && (
                    <p
                      style={{
                        margin: "1.5px 0 3px 0",
                        fontStyle: "italic",
                        fontSize: `${fontSize - 0.8}pt`,
                        color: "#4b5563",
                      }}
                    >
                      {renderRichText(exp.summary, false)}
                    </p>
                  )}
                  {firstBullets.length > 0 && (
                    <ul style={{ margin: "2.5px 0 0 0", paddingLeft: "15px" }}>
                      {firstBullets.map((bullet, bIdx) => (
                        <li
                          key={bIdx}
                          style={{
                            marginBottom: "3.2px",
                            lineHeight: bulletLineHeight,
                            fontSize: `${fontSize - 0.4}pt`,
                            textAlign: "left",
                            color: "#1f2937",
                            textWrap: "pretty" as any,
                          }}
                        >
                          {renderRichText(bullet, true)}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                {restBullets.length > 0 && (
                  <ul style={{ margin: "0", paddingLeft: "15px" }}>
                    {restBullets.map((bullet, bIdx) => (
                      <li
                        key={bIdx}
                        className="break-avoid"
                        style={{
                          marginBottom: "3.2px",
                          lineHeight: bulletLineHeight,
                          fontSize: `${fontSize - 0.4}pt`,
                          textAlign: "left",
                          color: "#1f2937",
                          textWrap: "pretty" as any,
                        }}
                      >
                        {renderRichText(bullet, true)}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Selected Projects */}
      {cleanProjects.length > 0 && (
        <div style={{ marginBottom: `${sectionSpacing}px` }}>
          <h2 style={sectionHeadingStyle}>{labels.projects}</h2>
          {cleanProjects.map((proj, idx) => {
            const { cleanTitle, cleanRole, hasParensInTitle } = formatProjectTitleAndRole(proj.title, proj.role);
            return (
              <div key={proj.id || idx} className="project-entry break-avoid" style={{ marginBottom: "7.5px" }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "baseline",
                    fontSize: `${fontSize - 0.2}pt`,
                    gap: "12px",
                  }}
                >
                  <div>
                    <strong style={{ color: "#111827", fontWeight: 700 }}>{cleanTitle}</strong>
                    {cleanRole && (
                      <span style={{ fontWeight: 600, color: accentColor }}>
                        {hasParensInTitle ? `  —  ${cleanRole}` : `  ·  ${cleanRole}`}
                      </span>
                    )}
                  </div>
                  {proj.dates && (
                    <div
                      style={{
                        fontWeight: 600,
                        fontSize: `${fontSize - 0.8}pt`,
                        color: "#374151",
                        whiteSpace: "nowrap",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {proj.dates}
                    </div>
                  )}
                </div>
                {proj.description && proj.description.trim() && (
                  <p style={{ margin: "1.5px 0 2px 0", fontSize: `${fontSize - 0.8}pt`, color: "#374151" }}>
                    {renderRichText(proj.description, false)}
                  </p>
                )}
                {proj.bullets && proj.bullets.length > 0 && (
                  <ul style={{ margin: "2.5px 0 0 0", paddingLeft: "15px" }}>
                    {proj.bullets.map((b, bIdx) => (
                      <li
                        key={bIdx}
                        style={{
                          marginBottom: "2.8px",
                          lineHeight: bulletLineHeight,
                          fontSize: `${fontSize - 0.5}pt`,
                          textAlign: "left",
                          color: "#1f2937",
                          textWrap: "pretty" as any,
                        }}
                      >
                        {renderRichText(b, true)}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Education & Certifications — Balanced Bottom Section */}
      <div className="break-avoid" style={{ display: "grid", gridTemplateColumns: "48% 1fr", gap: "22px", alignItems: "start" }}>
        {/* Education */}
        {cv.education && cv.education.length > 0 && (
          <div>
            <h2 style={sectionHeadingStyle}>{labels.education}</h2>
            {cv.education.map((edu, idx) => (
              <div key={edu.id || idx} style={{ marginBottom: "5.5px", fontSize: `${fontSize - 0.5}pt` }}>
                <div style={{ fontWeight: 700, color: "#111827" }}>{edu.degree}</div>
                <div style={{ color: accentColor, fontWeight: 600, fontSize: `${fontSize - 0.8}pt` }}>
                  {edu.institution}
                  {edu.period && (
                    <span style={{ color: "#4b5563", fontWeight: 400 }}> · {edu.period}</span>
                  )}
                </div>
                {edu.description && (
                  <div style={{ fontSize: `${fontSize - 1.2}pt`, color: "#4b5563", marginTop: "1px", lineHeight: 1.25 }}>
                    {edu.description}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Certifications — Single Uncompressed Column for Clean Readability */}
        {cv.certifications && cv.certifications.length > 0 && (
          <div>
            <h2 style={sectionHeadingStyle}>{labels.certifications}</h2>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "3.5px",
                fontSize: `${fontSize - 0.7}pt`,
                lineHeight: 1.28,
              }}
            >
              {cv.certifications.map((cert, idx) => (
                <div
                  key={cert.id || idx}
                  style={{ display: "flex", alignItems: "baseline", gap: "6px", textAlign: "left" }}
                >
                  <span style={{ color: accentColor, fontWeight: 700, flexShrink: 0 }}>·</span>
                  <div>
                    <span style={{ color: "#1f2937", fontWeight: 500 }}>{cert.name}</span>
                    {cert.authority && (
                      <span style={{ color: "#6b7280", fontSize: `${fontSize - 1.1}pt` }}> — {cert.authority}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Visual page break guide synced to 15mm @page margin */}
      <PageBreakGuides topPaddingMm={15} netPageHeightMm={267} />
    </div>
  );
};

// -------------------------------------------------------------
// 2. MODERN PROFESSIONAL CV TEMPLATE (MODULAR FULL-WIDTH EDITORIAL GRID)
// -------------------------------------------------------------
export const ModernProfessionalCv: React.FC<TemplateProps> = ({ data, photoBase64 }) => {
  const cv = data.cvContent;
  const lang = getEffectiveLanguage(data);
  const labels = SECTION_LABELS[lang];

  const accentColor = data.templateSettings?.accentColor || "#10233f";
  const fontFamily = data.templateSettings?.fontFamily || "Inter";
  const showPhoto = data.assetSettings?.photo?.enabled;
  const photoUrl = photoBase64 || data.assetSettings?.photo?.filePath;
  const cropStyle = data.assetSettings?.photo?.cropStyle || "portrait-rectangle";

  const fontSize = data.templateSettings?.fontSize || 10;
  const lineSpacing = data.templateSettings?.lineSpacing || 1.32;
  const sectionSpacing = data.templateSettings?.sectionSpacing || 12;
  const bulletLineHeight = Math.max(lineSpacing - 0.05, 1.24);
  const showKeyAchievements = data.templateSettings?.showKeyAchievements !== false;
  const showProjects = data.templateSettings?.showProjects !== false;

  const cleanSkills = getCleanSkills(cv.coreSkills);
  const cleanProjects = showProjects ? getCleanProjects(cv.projects) : [];

  const getPhotoStyle = () => getExecutivePortraitStyle(cropStyle, accentColor, "modern");

  const renderSectionTitle = (title: string) => (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        marginBottom: "6.5px",
        marginTop: "6px",
      }}
    >
      <h2
        style={{
          fontSize: "9.8pt",
          fontWeight: 700,
          color: accentColor,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          margin: 0,
          whiteSpace: "nowrap",
        }}
      >
        {title}
      </h2>
      <div style={{ flex: 1, height: "1px", backgroundColor: "#cbd5e1" }} />
    </div>
  );

  return (
    <div
      id="cv-template-modern"
      lang={lang === "German" ? "de" : lang === "Spanish" ? "es" : "en"}
      style={{
        boxSizing: "border-box",
        width: "210mm",
        minHeight: "297mm",
        padding: "15mm 16mm",
        backgroundColor: "#ffffff",
        color: "#1f2937",
        fontFamily: `${fontFamily}, system-ui, sans-serif`,
        fontSize: `${fontSize}pt`,
        lineHeight: lineSpacing,
        margin: "0 auto",
        position: "relative",
        fontVariantLigatures: "none",
        fontFeatureSettings: '"liga" 0, "clig" 0',
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {/* Top Executive Accent Bar */}
      <div
        style={{
          height: "3px",
          background: `linear-gradient(90deg, ${accentColor} 0%, #6d8ead 100%)`,
          marginBottom: "12px",
          borderRadius: "2px",
        }}
      />

      {/* Header Container */}
      <div
        className="break-avoid"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "10px",
          paddingBottom: "10px",
          borderBottom: "1px solid #cbd5e1",
        }}
      >
        <div style={{ flex: 1, paddingRight: showPhoto && photoUrl ? "14px" : "0" }}>
          <h1
            style={{
              fontSize: "22pt",
              fontWeight: 700,
              margin: "0 0 3px 0",
              color: accentColor,
              lineHeight: 1.1,
              letterSpacing: "-0.4px",
            }}
          >
            {cv.header.fullName}
          </h1>
          <div
            style={{
              fontSize: "10pt",
              fontWeight: 600,
              color: "#374151",
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              textWrap: "balance" as any,
              marginBottom: "6px",
            }}
          >
            {cv.header.headline}
          </div>

          {/* Contact & Meta Line 1 */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: "3px 10px",
              fontSize: `${fontSize - 1.4}pt`,
              color: "#4b5563",
            }}
          >
            <span style={{ display: "inline-flex", alignItems: "center" }}>
              <IconPin color={accentColor} />
              {cv.header.location}
            </span>
            <span style={{ color: "#cbd5e1" }}>·</span>
            <span style={{ display: "inline-flex", alignItems: "center" }}>
              <IconMail color={accentColor} />
              <a href={`mailto:${cv.header.email}`} style={{ color: "#374151", textDecoration: "none" }}>
                {cv.header.email}
              </a>
            </span>
            <span style={{ color: "#cbd5e1" }}>·</span>
            <span style={{ display: "inline-flex", alignItems: "center" }}>
              <IconPhone color={accentColor} />
              {cv.header.phone}
            </span>
            {cv.header.links &&
              cv.header.links.map((link, idx) => {
                const cleanUrl = link.url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
                return (
                  <React.Fragment key={idx}>
                    <span style={{ color: "#cbd5e1" }}>·</span>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: accentColor, textDecoration: "none", fontWeight: 600 }}
                    >
                      {cleanUrl}
                    </a>
                  </React.Fragment>
                );
              })}
          </div>

          {/* Contact & Meta Line 2: Availability & Languages */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: "3px 10px",
              fontSize: `${fontSize - 1.5}pt`,
              color: "#4b5563",
              marginTop: "3px",
            }}
          >
            <span style={{ display: "inline-flex", alignItems: "center" }}>
              <IconCalendar color={accentColor} />
              <strong style={{ color: "#374151", marginRight: "3px" }}>{labels.availability}:</strong>
              {cv.header.availability}
            </span>
            {cv.header.languages && cv.header.languages.length > 0 && (
              <>
                <span style={{ color: "#cbd5e1" }}>·</span>
                <span style={{ display: "inline-flex", alignItems: "center" }}>
                  <IconGlobe color={accentColor} />
                  <strong style={{ color: "#374151", marginRight: "3px" }}>{labels.languages}:</strong>
                  {cv.header.languages.map((l) => `${l.language} (${l.level})`).join(", ")}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Optional Photo */}
        {showPhoto && photoUrl && (
          <div style={getPhotoStyle().container}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photoUrl} alt={cv.header.fullName} style={getPhotoStyle().image} />
          </div>
        )}
      </div>

      {/* BAND 1: PROFESSIONAL PROFILE */}
      {cv.professionalProfile && (
        <div className="break-avoid" style={{ marginBottom: `${sectionSpacing}px` }}>
          {renderSectionTitle(labels.profile)}
          <div
            style={{
              borderLeft: `2.5px solid ${accentColor}`,
              paddingLeft: "10px",
              fontSize: `${fontSize - 0.3}pt`,
              color: "#374151",
              textAlign: "left",
              textWrap: "pretty" as any,
            }}
          >
            {renderRichText(cv.professionalProfile, true)}
          </div>
        </div>
      )}

      {/* BAND 2: KEY ACHIEVEMENTS */}
      {showKeyAchievements && cv.keyAchievements && cv.keyAchievements.length > 0 && (
        <div style={{ marginBottom: `${sectionSpacing}px` }}>
          <div className="break-avoid">
            {renderSectionTitle(labels.achievements)}
            <div style={{ display: "flex", flexDirection: "column", gap: "3.5px" }}>
              <div
                style={{
                  display: "flex",
                  gap: "7px",
                  alignItems: "flex-start",
                  lineHeight: bulletLineHeight,
                  fontSize: `${fontSize - 0.3}pt`,
                }}
              >
                <span style={{ color: accentColor, fontWeight: 700, flexShrink: 0 }}>▸</span>
                <span style={{ color: "#1f2937", textAlign: "left", textWrap: "pretty" as any }}>
                  {renderRichText(cv.keyAchievements[0], true)}
                </span>
              </div>
            </div>
          </div>
          {cv.keyAchievements.length > 1 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "3.5px", marginTop: "3.5px" }}>
              {cv.keyAchievements.slice(1).map((achievement, idx) => (
                <div
                  key={idx}
                  className="break-avoid"
                  style={{
                    display: "flex",
                    gap: "7px",
                    alignItems: "flex-start",
                    lineHeight: bulletLineHeight,
                    fontSize: `${fontSize - 0.3}pt`,
                  }}
                >
                  <span style={{ color: accentColor, fontWeight: 700, flexShrink: 0 }}>▸</span>
                  <span style={{ color: "#1f2937", textAlign: "left", textWrap: "pretty" as any }}>
                    {renderRichText(achievement, true)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* BAND 3: CORE SKILLS (CLEAN EDITORIAL GRID — NO COMPETING BORDERS) */}
      {cleanSkills.length > 0 && (
        <div className="break-avoid" style={{ marginBottom: `${sectionSpacing}px` }}>
          {renderSectionTitle(labels.skills)}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "6px 14px",
            }}
          >
            {cleanSkills.map((group, idx) => (
              <div
                key={idx}
                className="break-avoid"
                style={{
                  backgroundColor: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  padding: "4.5px 9px",
                  borderRadius: "5px",
                }}
              >
                <div
                  style={{
                    fontWeight: 700,
                    color: accentColor,
                    fontSize: `${fontSize - 1.4}pt`,
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    marginBottom: "1.5px",
                  }}
                >
                  {group.group}
                </div>
                <div
                  style={{
                    fontSize: `${fontSize - 0.9}pt`,
                    color: "#374151",
                    lineHeight: 1.26,
                    wordBreak: "break-word",
                    textWrap: "pretty" as any,
                  }}
                >
                  {group.skills.join("  ·  ")}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* BAND 4: PROFESSIONAL EXPERIENCE (FULL WIDTH EDITORIAL — NO BARCODE BORDERS) */}
      {cv.experience && cv.experience.length > 0 && (
        <div style={{ marginBottom: `${sectionSpacing}px` }}>
          {renderSectionTitle(labels.experience)}
          <div style={{ display: "flex", flexDirection: "column", gap: "9.5px" }}>
            {cv.experience.map((exp, idx) => {
              const firstBullets = exp.bullets.slice(0, 2);
              const restBullets = exp.bullets.slice(2);
              return (
                <div
                  key={exp.id || idx}
                  className="experience-entry"
                >
                  <div className="break-avoid">
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "baseline",
                        gap: "12px",
                        marginBottom: "2px",
                      }}
                    >
                      <div style={{ fontSize: `${fontSize + 0.2}pt`, fontWeight: 700, color: "#111827" }}>
                        {exp.jobTitle}
                        {exp.company && (
                          <span style={{ fontWeight: 600, color: accentColor }}>  —  {exp.company}</span>
                        )}
                      </div>
                      <div
                        style={{
                          fontSize: `${fontSize - 0.9}pt`,
                          color: "#374151",
                          fontWeight: 600,
                          whiteSpace: "nowrap",
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {exp.dates}
                        {exp.location && (
                          <span style={{ fontWeight: 400, color: "#6b7280" }}> · {exp.location}</span>
                        )}
                      </div>
                    </div>
                    {exp.summary && (
                      <div
                        style={{
                          fontSize: `${fontSize - 0.9}pt`,
                          color: "#4b5563",
                          fontStyle: "italic",
                          marginBottom: "3px",
                        }}
                      >
                        {renderRichText(exp.summary, false)}
                      </div>
                    )}
                    {firstBullets.length > 0 && (
                      <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                        {firstBullets.map((bullet, bIdx) => (
                          <div
                            key={bIdx}
                            style={{
                              display: "flex",
                              gap: "6.5px",
                              alignItems: "flex-start",
                              lineHeight: bulletLineHeight,
                              fontSize: `${fontSize - 0.4}pt`,
                            }}
                          >
                            <span style={{ color: accentColor, fontSize: "8pt", lineHeight: 1.35, flexShrink: 0 }}>•</span>
                            <span style={{ color: "#1f2937", textAlign: "left", textWrap: "pretty" as any }}>
                              {renderRichText(bullet, true)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  {restBullets.length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "3px", marginTop: "3px" }}>
                      {restBullets.map((bullet, bIdx) => (
                        <div
                          key={bIdx}
                          className="break-avoid"
                          style={{
                            display: "flex",
                            gap: "6.5px",
                            alignItems: "flex-start",
                            lineHeight: bulletLineHeight,
                            fontSize: `${fontSize - 0.4}pt`,
                          }}
                        >
                          <span style={{ color: accentColor, fontSize: "8pt", lineHeight: 1.35, flexShrink: 0 }}>•</span>
                          <span style={{ color: "#1f2937", textAlign: "left", textWrap: "pretty" as any }}>
                            {renderRichText(bullet, true)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* BAND 5: SELECTED PROJECTS (FULL WIDTH EDITORIAL — NO BARCODE BORDERS) */}
      {cleanProjects.length > 0 && (
        <div style={{ marginBottom: `${sectionSpacing}px` }}>
          {renderSectionTitle(labels.projects)}
          <div style={{ display: "flex", flexDirection: "column", gap: "7.5px" }}>
            {cleanProjects.map((proj, idx) => {
              const { cleanTitle, cleanRole, hasParensInTitle } = formatProjectTitleAndRole(proj.title, proj.role);
              return (
                <div
                  key={proj.id || idx}
                  className="project-entry break-avoid"
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "baseline",
                      gap: "12px",
                      marginBottom: "1.5px",
                    }}
                  >
                    <div style={{ fontSize: `${fontSize}pt`, fontWeight: 700, color: "#111827" }}>
                      {cleanTitle}
                      {cleanRole && (
                        <span style={{ fontWeight: 600, color: accentColor }}>
                          {hasParensInTitle ? `  —  ${cleanRole}` : `  ·  ${cleanRole}`}
                        </span>
                      )}
                    </div>
                    {proj.dates && (
                      <div
                        style={{
                          fontSize: `${fontSize - 0.9}pt`,
                          color: "#374151",
                          fontWeight: 600,
                          whiteSpace: "nowrap",
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {proj.dates}
                      </div>
                    )}
                  </div>
                  {proj.description && proj.description.trim() && (
                    <p style={{ margin: "0 0 2.5px 0", fontSize: `${fontSize - 0.9}pt`, color: "#4b5563", textAlign: "left" }}>
                      {renderRichText(proj.description, false)}
                    </p>
                  )}
                  {proj.bullets && proj.bullets.length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "2.5px" }}>
                      {proj.bullets.map((bullet, bIdx) => (
                        <div
                          key={bIdx}
                          style={{
                            display: "flex",
                            gap: "6.5px",
                            alignItems: "flex-start",
                            lineHeight: bulletLineHeight,
                            fontSize: `${fontSize - 0.5}pt`,
                          }}
                        >
                          <span style={{ color: accentColor, fontSize: "8pt", lineHeight: 1.35, flexShrink: 0 }}>•</span>
                          <span style={{ color: "#1f2937", textAlign: "left", textWrap: "pretty" as any }}>
                            {renderRichText(bullet, true)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* BAND 6: SYMMETRIC FOOTER GRID (EDUCATION | CERTIFICATIONS) */}
      <div className="break-avoid" style={{ display: "grid", gridTemplateColumns: "48% 1fr", gap: "22px", alignItems: "start" }}>
        {cv.education && cv.education.length > 0 && (
          <div>
            {renderSectionTitle(labels.education)}
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {cv.education.map((edu, idx) => (
                <div key={edu.id || idx}>
                  <div style={{ fontWeight: 700, color: "#111827", fontSize: `${fontSize - 0.4}pt` }}>
                    {edu.degree}
                  </div>
                  <div style={{ color: accentColor, fontWeight: 600, fontSize: `${fontSize - 0.9}pt` }}>
                    {edu.institution}
                    {edu.period && (
                      <span style={{ color: "#4b5563", fontWeight: 400 }}> · {edu.period}</span>
                    )}
                  </div>
                  {edu.description && (
                    <div style={{ fontSize: `${fontSize - 1.3}pt`, color: "#6b7280", marginTop: "1px", lineHeight: 1.25 }}>
                      {edu.description}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {cv.certifications && cv.certifications.length > 0 && (
          <div>
            {renderSectionTitle(labels.certifications)}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "3.5px",
                fontSize: `${fontSize - 0.7}pt`,
                lineHeight: 1.28,
              }}
            >
              {cv.certifications.map((cert, idx) => (
                <div
                  key={cert.id || idx}
                  style={{ display: "flex", alignItems: "baseline", gap: "6px", textAlign: "left" }}
                >
                  <span style={{ color: accentColor, fontWeight: 700, flexShrink: 0 }}>·</span>
                  <div>
                    <span style={{ color: "#1f2937", fontWeight: 500 }}>{cert.name}</span>
                    {cert.authority && (
                      <span style={{ color: "#6b7280", fontSize: `${fontSize - 1.1}pt` }}> — {cert.authority}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Visual page break guide synced to 15mm @page margin */}
      <PageBreakGuides topPaddingMm={15} netPageHeightMm={267} />
    </div>
  );
};

// -------------------------------------------------------------
// 3. ATS LETTER TEMPLATE (DIN 5008 / BERLIN EXECUTIVE STANDARD)
// -------------------------------------------------------------
export const AtsLetter: React.FC<TemplateProps> = ({ data, signatureBase64 }) => {
  const letter = data.coverLetterContent;
  const cv = data.cvContent;
  const lang = getEffectiveLanguage(data);
  const labels = SECTION_LABELS[lang];

  const fontFamily = data.templateSettings?.fontFamily || "Inter";
  const fontSize = data.templateSettings?.fontSize || 10;
  const lineSpacing = data.templateSettings?.lineSpacing || 1.4;
  const sectionSpacing = data.templateSettings?.sectionSpacing || 15;

  const showSignature = data.assetSettings?.signature?.enabled;
  const signatureUrl = signatureBase64 || data.assetSettings?.signature?.filePath;
  const signatureWidth = data.assetSettings?.signature?.widthPx || 160;
  const signatureAlignment = data.assetSettings?.signature?.alignment || "left";

  const closingText =
    lang === "German" && letter.closingPhrase === "Kind regards,"
      ? "Mit freundlichen Grüßen"
      : lang === "Spanish" && letter.closingPhrase === "Kind regards,"
      ? "Atentamente,"
      : letter.closingPhrase || "Kind regards,";

  const targetRole = letter.roleTitle || data.roleTitle || "";
  const targetCompany = letter.company || data.company || "";
  const targetLocation = data.jobLocation || "Berlin, Germany";
  const recipientDept =
    lang === "German"
      ? "Personalabteilung / Recruiting Team"
      : lang === "Spanish"
      ? "Departamento de Selección / Hiring Team"
      : "Hiring Team / Talent Acquisition";

  const computedSubject =
    letter.subjectLine && letter.subjectLine.trim()
      ? letter.subjectLine.trim()
      : lang === "German"
      ? `Bewerbung als ${targetRole}`
      : lang === "Spanish"
      ? `Candidatura al puesto de ${targetRole}`
      : `Application for ${targetRole}`;

  const letterWordCount = (letter.paragraphs || [])
    .map((p) => p.text || "")
    .join(" ")
    .split(/\s+/)
    .filter(Boolean).length;

  const effectiveFontSize =
    letterWordCount > 315
      ? Math.min(fontSize - 0.5, 9.4)
      : letterWordCount < 230
      ? Math.max(fontSize - 0.1, 9.9)
      : fontSize - 0.3;
  const effectiveLineHeight =
    letterWordCount > 315
      ? Math.min(lineSpacing, 1.34)
      : letterWordCount < 230
      ? Math.max(lineSpacing, 1.44)
      : Math.max(lineSpacing, 1.38);
  const effectiveParagraphGap =
    letterWordCount > 315 ? 8 : letterWordCount < 230 ? 12 : Math.max(sectionSpacing - 3, 10);

  return (
    <div
      id="letter-template-ats"
      lang={lang === "German" ? "de" : lang === "Spanish" ? "es" : "en"}
      style={{
        boxSizing: "border-box",
        width: "210mm",
        minHeight: "297mm",
        padding: "18mm 20mm",
        backgroundColor: "#ffffff",
        color: "#111827",
        fontFamily: `${fontFamily}, Arial, Helvetica, sans-serif`,
        fontSize: `${effectiveFontSize}pt`,
        lineHeight: effectiveLineHeight,
        margin: "0 auto",
        position: "relative",
        fontVariantLigatures: "none",
        fontFeatureSettings: '"liga" 0, "clig" 0',
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {/* Header with Complete Contact Information & Clickable Portfolio Links */}
      <div style={{ marginBottom: "14px", borderBottom: "1px solid #cbd5e1", paddingBottom: "10px" }}>
        <h1 style={{ fontSize: "19pt", fontWeight: 700, margin: "0 0 3px 0", color: "#111827", letterSpacing: "-0.25px" }}>
          {cv.header.fullName}
        </h1>
        <div
          style={{
            fontSize: "9.5pt",
            color: "#374151",
            fontWeight: 600,
            marginBottom: "4px",
            textWrap: "balance" as any,
          }}
        >
          {letter.positioningLine}
        </div>
        <div style={{ fontSize: "8.4pt", color: "#4b5563" }}>
          {[cv.header.location, cv.header.email, cv.header.phone].filter(Boolean).join("  ·  ")}
          {cv.header.links &&
            cv.header.links.map((link, idx) => {
              const cleanUrl = link.url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
              return (
                <React.Fragment key={idx}>
                  {"  ·  "}
                  <a href={link.url} style={{ color: "#111827", textDecoration: "none", fontWeight: 600 }}>
                    {cleanUrl}
                  </a>
                </React.Fragment>
              );
            })}
          {"  ·  "}
          <strong>{labels.availability}:</strong> {cv.header.availability}
        </div>
      </div>

      {/* DIN 5008 Recipient Block (Left) & Date Line (Right) */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: "14px",
          gap: "16px",
        }}
      >
        {targetCompany ? (
          <div style={{ fontSize: "8.8pt", lineHeight: 1.35, color: "#374151" }}>
            <div style={{ fontWeight: 700, color: "#111827", fontSize: "9.4pt" }}>{targetCompany}</div>
            <div>{recipientDept}</div>
            <div style={{ color: "#6b7280", fontSize: "8.4pt" }}>{targetLocation}</div>
          </div>
        ) : (
          <div />
        )}
        <div style={{ fontSize: "9pt", color: "#4b5563", textAlign: "right", whiteSpace: "nowrap" }}>
          {letter.dateLine}
        </div>
      </div>

      {/* DIN 5008 Executive Subject Line (Betreffzeile) */}
      {targetRole && (
        <div
          style={{
            marginBottom: "12px",
            fontSize: "10.2pt",
            fontWeight: 700,
            color: "#111827",
            letterSpacing: "-0.1px",
          }}
        >
          {computedSubject}
        </div>
      )}

      {/* Greeting */}
      <div style={{ marginBottom: "12px", fontWeight: 700, color: "#111827" }}>
        {letter.greeting}
      </div>

      {/* Letter Body */}
      <div style={{ textAlign: "left", marginBottom: "18px" }}>
        {letter.paragraphs.map((p, idx) => (
          <p
            key={idx}
            style={{
              margin: `0 0 ${effectiveParagraphGap}px 0`,
              color: "#1f2937",
              textWrap: "pretty" as any,
            }}
          >
            {renderRichText(p.text, true)}
          </p>
        ))}
      </div>

      {/* Sign-off with Signature Image Support */}
      <div
        className="signature-block break-avoid"
        style={{
          marginTop: "14px",
          display: "flex",
          flexDirection: "column",
          alignItems:
            signatureAlignment === "center"
              ? "center"
              : signatureAlignment === "right"
              ? "flex-end"
              : "flex-start",
        }}
      >
        <div style={{ marginBottom: showSignature && signatureUrl ? "8px" : "24px" }}>{closingText}</div>
        {showSignature && signatureUrl && (
          <div style={{ marginBottom: "6px" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={signatureUrl}
              alt="Signature"
              className="signature-image"
              style={{
                width: `${signatureWidth}px`,
                height: "auto",
                maxHeight: "56px",
                display: "block",
              }}
            />
          </div>
        )}
        <div style={{ fontWeight: 700, color: "#111827" }}>{letter.signatureName}</div>
        <div style={{ fontSize: "8.2pt", color: "#6b7280", marginTop: "1px" }}>
          {cv.header.headline || letter.positioningLine}
        </div>
      </div>

      {/* Visual page break guide */}
      <PageBreakGuides topPaddingMm={18} netPageHeightMm={265} />
    </div>
  );
};

// -------------------------------------------------------------
// 4. ASR SIDEBAR COVER LETTER TEMPLATE (BERLIN EXECUTIVE DIN 5008)
// -------------------------------------------------------------
export const AsrSidebarLetter: React.FC<TemplateProps> = ({ data, signatureBase64 }) => {
  const letter = data.coverLetterContent;
  const cv = data.cvContent;
  const lang = getEffectiveLanguage(data);
  const labels = SECTION_LABELS[lang];

  const accentColor = data.templateSettings?.accentColor || "#10233f";
  const fontFamily = data.templateSettings?.fontFamily || "Inter";
  const showSignature = data.assetSettings?.signature?.enabled;
  const signatureUrl = signatureBase64 || data.assetSettings?.signature?.filePath;
  const signatureWidth = data.assetSettings?.signature?.widthPx || 160;
  const signatureAlignment = data.assetSettings?.signature?.alignment || "left";

  const fontSize = data.templateSettings?.fontSize || 10;
  const lineSpacing = data.templateSettings?.lineSpacing || 1.38;
  const sectionSpacing = data.templateSettings?.sectionSpacing || 14;

  const closingText =
    lang === "German" && letter.closingPhrase === "Kind regards,"
      ? "Mit freundlichen Grüßen"
      : lang === "Spanish" && letter.closingPhrase === "Kind regards,"
      ? "Atentamente,"
      : letter.closingPhrase || "Kind regards,";

  const sidebarLabelText =
    lang === "German" && letter.sidebarLabel === "COVER LETTER"
      ? "ANSCHREIBEN"
      : lang === "Spanish" && letter.sidebarLabel === "COVER LETTER"
      ? "CARTA DE PRESENTACIÓN"
      : letter.sidebarLabel || "COVER LETTER";

  const targetRole = letter.roleTitle || data.roleTitle || "";
  const targetCompany = letter.company || data.company || "";
  const targetLocation = data.jobLocation || "Berlin, Germany";
  const recipientDept =
    lang === "German"
      ? "Personalabteilung / Recruiting Team"
      : lang === "Spanish"
      ? "Departamento de Selección / Hiring Team"
      : "Hiring Team / Talent Acquisition";

  const computedSubject =
    letter.subjectLine && letter.subjectLine.trim()
      ? letter.subjectLine.trim()
      : lang === "German"
      ? `Bewerbung als ${targetRole}`
      : lang === "Spanish"
      ? `Candidatura al puesto de ${targetRole}`
      : `Application for ${targetRole}`;

  const letterWordCount = (letter.paragraphs || [])
    .map((p) => p.text || "")
    .join(" ")
    .split(/\s+/)
    .filter(Boolean).length;

  const effectiveBodyFontSize =
    letterWordCount > 315
      ? Math.min(fontSize - 0.7, 9.2)
      : letterWordCount < 230
      ? Math.max(fontSize - 0.2, 9.8)
      : fontSize - 0.5;
  const effectiveBodyLineHeight =
    letterWordCount > 315
      ? Math.min(lineSpacing, 1.33)
      : letterWordCount < 230
      ? Math.max(lineSpacing, 1.43)
      : lineSpacing;
  const effectiveParagraphGap =
    letterWordCount > 315 ? 7.5 : letterWordCount < 230 ? 11.5 : Math.max(sectionSpacing - 4, 9);

  const monogramInitials =
    (cv.header.fullName || "")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 3)
      .map((w) => w[0]?.toUpperCase() || "")
      .join("") || "CV";

  return (
    <div
      id="letter-template-asr"
      className="letter-page"
      lang={lang === "German" ? "de" : lang === "Spanish" ? "es" : "en"}
      style={{
        boxSizing: "border-box",
        width: "210mm",
        minHeight: "297mm",
        display: "grid",
        gridTemplateColumns: "30mm 1fr",
        backgroundColor: "#ffffff",
        color: "#1f2937",
        fontFamily: `${fontFamily}, system-ui, sans-serif`,
        margin: "0 auto",
        boxShadow: "none",
        position: "relative",
        fontVariantLigatures: "none",
        fontFeatureSettings: '"liga" 0, "clig" 0',
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {/* 30mm LEFT NAVY SIDEBAR */}
      <div
        className="sidebar"
        style={{
          backgroundColor: accentColor,
          color: "#ffffff",
          position: "relative",
          height: "100%",
          minHeight: "297mm",
          boxSizing: "border-box",
        }}
      >
        {/* Executive Monogram */}
        <div
          className="monogram"
          style={{
            width: "16mm",
            height: "16mm",
            border: "1.2px solid rgba(255, 255, 255, 0.75)",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "14mm auto 0",
            fontSize: "8.5pt",
            fontWeight: 700,
            letterSpacing: "1.5px",
            color: "#ffffff",
          }}
        >
          {monogramInitials}
        </div>

        {/* Vertical LABEL */}
        <div
          className="vertical-label"
          style={{
            position: "absolute",
            top: "125mm",
            left: "50%",
            transform: "translateX(-50%) rotate(-90deg)",
            transformOrigin: "center center",
            whiteSpace: "nowrap",
            letterSpacing: "3px",
            fontSize: "7pt",
            fontWeight: 600,
            opacity: 0.85,
          }}
        >
          {sidebarLabelText}
        </div>

        {/* Bottom Sidebar details */}
        <div
          className="sidebar-footer"
          style={{
            position: "absolute",
            bottom: "12mm",
            left: "3.5mm",
            right: "3.5mm",
            fontSize: "6.8pt",
            lineHeight: 1.35,
            textAlign: "center",
            opacity: 0.9,
            wordBreak: "break-word",
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: "2px" }}>
            {letter.sidebarRole || letter.roleTitle || data.roleTitle}
          </div>
          <div style={{ opacity: 0.8 }}>
            {letter.sidebarCompany || letter.company || data.company}
          </div>
        </div>
      </div>

      {/* RIGHT MAIN CONTENT AREA */}
      <div
        className="letter-content"
        style={{
          padding: "15mm 18mm 14mm 14mm",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header Block with Full Contact Details, Clickable Links & Clean SVG Icons */}
        <div>
          <h1
            className="header-name"
            style={{
              fontSize: "20pt",
              fontWeight: 700,
              letterSpacing: "-0.2px",
              color: accentColor,
              margin: "0 0 3px 0",
            }}
          >
            {cv.header.fullName}
          </h1>
          <div
            className="positioning-line"
            style={{
              fontSize: "9.5pt",
              fontWeight: 600,
              color: "#374151",
              margin: "0 0 5px 0",
              textWrap: "balance" as any,
            }}
          >
            {letter.positioningLine}
          </div>
          <div
            className="meta-line"
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: "3px 8px",
              fontSize: "8.1pt",
              color: "#4b5563",
              margin: "0 0 3px 0",
            }}
          >
            <span style={{ display: "inline-flex", alignItems: "center" }}>
              <IconPin color="#6d8ead" />
              {cv.header.location}
            </span>
            <span style={{ color: "#cbd5e1" }}>·</span>
            <span style={{ display: "inline-flex", alignItems: "center" }}>
              <IconMail color="#6d8ead" />
              <a href={`mailto:${cv.header.email}`} style={{ color: "#4b5563", textDecoration: "none" }}>
                {cv.header.email}
              </a>
            </span>
            <span style={{ color: "#cbd5e1" }}>·</span>
            <span style={{ display: "inline-flex", alignItems: "center" }}>
              <IconPhone color="#6d8ead" />
              {cv.header.phone}
            </span>
            {cv.header.links &&
              cv.header.links.map((link, idx) => {
                const cleanUrl = link.url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
                return (
                  <React.Fragment key={idx}>
                    <span style={{ color: "#cbd5e1" }}>·</span>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: accentColor, textDecoration: "none", fontWeight: 600 }}
                    >
                      {cleanUrl}
                    </a>
                  </React.Fragment>
                );
              })}
          </div>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: "3px 8px",
              fontSize: "7.9pt",
              color: "#6b7280",
              margin: "0 0 6px 0",
            }}
          >
            <span style={{ display: "inline-flex", alignItems: "center" }}>
              <IconGlobe color="#6d8ead" />
              {cv.header.languages.map((l) => l.language).join(", ")}
            </span>
            <span style={{ color: "#cbd5e1" }}>·</span>
            <span style={{ display: "inline-flex", alignItems: "center" }}>
              <IconCalendar color="#6d8ead" />
              {labels.availability}: {cv.header.availability}
            </span>
          </div>
          <div
            className="header-divider"
            style={{
              height: "1px",
              backgroundColor: "#cbd5e1",
              marginBottom: "4.5mm",
            }}
          />
        </div>

        {/* DIN 5008 Recipient Block (Left) & Date Line (Right) */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: "10px",
            gap: "12px",
          }}
        >
          {targetCompany ? (
            <div style={{ fontSize: "8.4pt", lineHeight: 1.32, color: "#4b5563" }}>
              <div style={{ fontWeight: 700, color: "#111827", fontSize: "9pt" }}>{targetCompany}</div>
              <div>{recipientDept}</div>
              <div style={{ color: "#6b7280", fontSize: "8pt" }}>{targetLocation}</div>
            </div>
          ) : (
            <div />
          )}
          <div style={{ fontSize: "8.8pt", color: "#6b7280", textAlign: "right", whiteSpace: "nowrap" }}>
            {letter.dateLine}
          </div>
        </div>

        {/* DIN 5008 Executive Subject Line (Betreffzeile) */}
        {targetRole && (
          <div
            style={{
              marginBottom: "10px",
              paddingLeft: "8px",
              borderLeft: `2.5px solid ${accentColor}`,
              fontSize: "10pt",
              fontWeight: 700,
              color: accentColor,
              letterSpacing: "-0.1px",
            }}
          >
            {computedSubject}
          </div>
        )}

        {/* Greeting */}
        <div style={{ marginBottom: "10px", fontWeight: 700, fontSize: "9.6pt", color: "#111827" }}>
          {letter.greeting}
        </div>

        {/* Body Text */}
        <div
          className="letter-body"
          style={{
            fontSize: `${effectiveBodyFontSize}pt`,
            lineHeight: effectiveBodyLineHeight,
            color: "#1f2937",
            textAlign: "left",
            flexGrow: 1,
          }}
        >
          {letter.paragraphs.map((p, idx) => (
            <p
              key={idx}
              style={{
                margin: `0 0 ${effectiveParagraphGap}px 0`,
                textWrap: "pretty" as any,
              }}
            >
              {renderRichText(p.text, true)}
            </p>
          ))}
        </div>

        {/* Executive Signature Block (No form line when signature image is stamped) */}
        <div
          className="signature-block break-avoid"
          style={{
            marginTop: "10px",
            pageBreakInside: "avoid",
            display: "flex",
            flexDirection: "column",
            alignItems:
              signatureAlignment === "center"
                ? "center"
                : signatureAlignment === "right"
                ? "flex-end"
                : "flex-start",
          }}
        >
          <div style={{ marginBottom: "6px", fontSize: "9.4pt", color: "#1f2937" }}>{closingText}</div>

          {showSignature && signatureUrl ? (
            <div style={{ margin: "2px 0 4px 0" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={signatureUrl}
                alt="Signature"
                className="signature-image"
                style={{
                  width: `${signatureWidth}px`,
                  height: "auto",
                  maxHeight: "55px",
                  display: "block",
                }}
              />
            </div>
          ) : (
            <div
              style={{
                height: "26px",
                width: `${Math.max(signatureWidth, 150)}px`,
                borderBottom: "1px solid #d1d5db",
                marginBottom: "4px",
              }}
            />
          )}

          <div
            className="signature-name"
            style={{
              fontSize: "9.5pt",
              color: "#111827",
              fontWeight: 700,
            }}
          >
            {letter.signatureName}
          </div>
          <div style={{ fontSize: "8pt", color: "#6b7280", marginTop: "1px" }}>
            {cv.header.headline || letter.positioningLine}
          </div>
        </div>
      </div>

      {/* Visual page break guide for full-bleed 297mm A4 letter */}
      <PageBreakGuides topPaddingMm={0} netPageHeightMm={297} />
    </div>
  );
};

// -------------------------------------------------------------
// 5. STAR INTERVIEW PREPARATION GUIDE TEMPLATE
// -------------------------------------------------------------
export const StarPrepGuide: React.FC<TemplateProps> = ({ data }) => {
  const achievements = data.cvContent.keyAchievements || [];
  const accentColor = data.templateSettings?.accentColor || "#10233f";
  const fontFamily = data.templateSettings?.fontFamily || "Inter";

  const getStarStory = (text: string) => {
    const lower = text.toLowerCase();

    if (lower.includes("routing") || lower.includes("ticket")) {
      return {
        question: "Describe a process optimization project that had a major operational impact.",
        situation: "Managing ticket operations across 14 European markets with significant dispatch delays and manual workload.",
        task: "Identify bottlenecks in routing flows and design an automated solution to reduce routing time without increasing headcount.",
        action: "Audited current routing guidelines, designed a logic-based ticket-routing engine using n8n/Python automation, and aligned operations teams across multi-market divisions.",
        result: "Reduced ticket-routing time by 70%, standardizing workflows and improving SLA compliance across all 14 markets.",
      };
    }

    if (lower.includes("repository") || lower.includes("documented")) {
      return {
        question: "How do you manage documentation and knowledge sharing in complex multi-market teams?",
        situation: "Lack of process alignment and operational clarity across 14 European markets leading to inconsistent client service.",
        task: "Establish a single source of truth for standard operating procedures (SOPs) accessible to all cross-functional teams.",
        action: "Conducted workshops with process managers, standardized documentation formats, and built a central repository containing 140+ processes.",
        result: "Created a single source of truth, accelerating onboarding and reducing compliance deviations across markets.",
      };
    }

    if (lower.includes("payment") || lower.includes("500k") || lower.includes("losses")) {
      return {
        question: "Tell me about a time you identified a high-risk compliance issue or saved company costs.",
        situation: "Unmonitored workflow leakages in billing and payment processing across international market layers.",
        task: "Audit transaction paths, detect processing anomalies, and implement controls to stop revenue leakages.",
        action: "Mapped the payment process using BPMN standards, audited billing records, isolated the processing gap, and deployed automated validations.",
        result: "Prevented €500K in annual process-related losses and established a permanent compliance reporting mechanism.",
      };
    }

    if (lower.includes("claims") || lower.includes("fraud") || lower.includes("validation")) {
      return {
        question: "Give an example of collaborating with cross-functional teams to solve a technical problem.",
        situation: "High processing times, high error rates, and manual validation bottlenecks in UK claims operations.",
        task: "Bridge gaps between Operations, Finance, and Technical teams to automate claims validation and reduce fraud exposure.",
        action: "Co-facilitated automation design sessions, helped build claims-screening scripts, and deployed rules-based validations.",
        result: "Contributed to a 12% fraud reduction, 50% processing-time reduction, and 35% error-rate reduction in validation cycles.",
      };
    }

    if (lower.includes("dashboard") || lower.includes("reporting") || lower.includes("elim")) {
      return {
        question: "How do you leverage automation or programming tools to eliminate manual administrative work?",
        situation: "Operations teams spent hours manually compiling weekly and monthly quality steering reports.",
        task: "Streamline reports to let analysts focus on process analysis instead of data gathering.",
        action: "Wrote custom Python scripts to fetch, parse, and aggregate CRM and quality database logs automatically.",
        result: "Completely eliminated manual reporting workload, freeing up capacity for strategic business steering.",
      };
    }

    return {
      question: "Give an example of using process analysis and metrics to drive operational excellence.",
      situation: "Steering operational performance across multi-market service lines with high transaction volumes.",
      task: "Translate raw process deviations into structured, actionable steering recommendations for management.",
      action: "Created a weekly quality dashboard, monitored process metrics, and facilitated alignment meetings with team leads.",
      result: "Enabled data-driven decisions that stabilized service delivery and improved overall process compliance.",
    };
  };

  return (
    <div
      id="prep-template-star"
      style={{
        boxSizing: "border-box",
        width: "210mm",
        minHeight: "297mm",
        padding: "16mm",
        backgroundColor: "#ffffff",
        color: "#1f2937",
        fontFamily: `${fontFamily}, system-ui, sans-serif`,
        fontSize: "9.5pt",
        lineHeight: "1.4",
        margin: "0 auto",
        position: "relative",
      }}
    >
      {/* Header */}
      <div style={{ borderBottom: `2px solid ${accentColor}`, paddingBottom: "10px", marginBottom: "16px" }}>
        <h1 style={{ fontSize: "16pt", fontWeight: "bold", color: accentColor, margin: "0 0 2px 0" }}>
          STAR Interview Cheat-Sheet
        </h1>
        <div style={{ fontSize: "9.5pt", color: "#4b5563" }}>
          Preparación personalizada para <strong>{data.roleTitle}</strong> en <strong>{data.company}</strong>
        </div>
      </div>

      <div
        style={{
          marginBottom: "16px",
          backgroundColor: `${accentColor}08`,
          padding: "10px",
          borderRadius: "6px",
          border: `1px solid ${accentColor}15`,
        }}
      >
        <p style={{ margin: 0, fontSize: "8.5pt", color: "#4b5563", lineHeight: 1.35 }}>
          <strong>Guía del método STAR:</strong> Estructura tus respuestas en base a la <strong>Situación</strong> (contexto),{" "}
          <strong>Tarea</strong> (el reto), <strong>Acción</strong> (lo que tú hiciste específicamente) y{" "}
          <strong>Resultado</strong> (el impacto cuantitativo). Esta hoja recopila los STAR stories específicos mapeados desde
          tus logros activos en este currículum.
        </p>
      </div>

      {/* Stories list */}
      <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        {achievements.slice(0, 4).map((ach, idx) => {
          const story = getStarStory(ach);
          return (
            <div
              key={idx}
              className="break-avoid"
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: "8px",
                padding: "12px",
                backgroundColor: "#f9fafb",
              }}
            >
              <div
                style={{
                  fontWeight: "bold",
                  fontSize: "10pt",
                  color: accentColor,
                  marginBottom: "8px",
                  display: "flex",
                  gap: "6px",
                }}
              >
                <span>#{idx + 1}</span>
                <span>{story.question}</span>
              </div>

              <div
                style={{
                  fontSize: "8.5pt",
                  color: "#6b7280",
                  fontStyle: "italic",
                  marginBottom: "8px",
                  borderLeft: "2px solid #6d8ead",
                  paddingLeft: "8px",
                }}
              >
                Logro: &ldquo;{ach}&rdquo;
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "75px 1fr", gap: "4px 8px", fontSize: "9pt" }}>
                <span style={{ fontWeight: "bold", color: accentColor }}>SITUACIÓN:</span>
                <span style={{ color: "#374151" }}>{story.situation}</span>

                <span style={{ fontWeight: "bold", color: accentColor }}>TAREA:</span>
                <span style={{ color: "#374151" }}>{story.task}</span>

                <span style={{ fontWeight: "bold", color: accentColor }}>ACCIÓN:</span>
                <span style={{ color: "#374151" }}>{story.action}</span>

                <span style={{ fontWeight: "bold", color: accentColor }}>RESULTADO:</span>
                <span style={{ color: "#10b981", fontWeight: 600 }}>{story.result}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Visual page break guide */}
      <PageBreakGuides topPaddingMm={16} netPageHeightMm={265} />
    </div>
  );
};
