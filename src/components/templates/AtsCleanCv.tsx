import React from "react";
import { type TemplateProps } from "./types";
import { getEffectiveLanguage, SECTION_LABELS, getCleanSkills, getCleanProjects, renderLocalizedLocation, isSameCompany, renderLocalizedDateRange, formatProjectTitleAndRole, renderLocalizedCertificationName, getWorkAuthorizationBadge } from "./templateUtils";
import { getExecutivePortraitStyle, EducationMetaRow } from "./DocumentPrimitives";
import { renderRichText } from "./RichText";
import { DOCUMENT_LAYOUT, accentTint, documentAccent, documentFontSize, documentLinkText, resolveDocumentFontStack } from "@/lib/documentDesign";

// -------------------------------------------------------------
// 1. ATS CLEAN CV TEMPLATE (EXECUTIVE SINGLE-COLUMN + 2-COL SKILLS)
// -------------------------------------------------------------
export const AtsCleanCv: React.FC<TemplateProps> = ({ data, photoBase64 }) => {
  const cv = data.cvContent;
  const visibleExperience = cv.experience.filter((entry) => entry.include !== false);
  const lang = getEffectiveLanguage(data);
  const labels = SECTION_LABELS[lang];

  const accentColor = documentAccent(data.templateSettings?.accentColor);
  const { bodyFont, headingFont } = resolveDocumentFontStack(data.templateSettings?.fontFamily);
  const showPhoto = data.assetSettings?.photo?.enabled;
  const photoUrl = photoBase64 || data.assetSettings?.photo?.filePath;
  const cropStyle = data.assetSettings?.photo?.cropStyle || "portrait-rectangle";
  const photoWidthPx = data.assetSettings?.photo?.widthPx;
  const photoPlacement = data.assetSettings?.photo?.placement || "header-right";
  const isPhotoLeft = photoPlacement === "sidebar" || photoPlacement === "header-left";
  const isPhotoCenter = photoPlacement === "header-center";
  const hasPhoto = Boolean(showPhoto && photoUrl);
  const centerHeaderText = !hasPhoto || isPhotoCenter;
  const portraitStyle = getExecutivePortraitStyle(cropStyle, accentColor, "ats", photoWidthPx);

  const fontSize = documentFontSize(data.templateSettings?.fontSize, "cv");
  const lineSpacing = Math.max(data.templateSettings?.lineSpacing || 1.42, 1.38);
  const sectionSpacing = data.templateSettings?.sectionSpacing || 14;
  const bulletLineHeight = Math.max(lineSpacing - 0.02, 1.36);
  const showKeyAchievements = data.templateSettings?.showKeyAchievements !== false;
  const showProjects = data.templateSettings?.showProjects !== false;

  const cleanSkills = getCleanSkills(cv.coreSkills);
  const cleanProjects = showProjects ? getCleanProjects(cv.projects) : [];
  const showSpecializedCompetencies = data.templateSettings?.showSpecializedCompetencies !== false;
  const specializedCompetencies = showSpecializedCompetencies ? (cv.specializedCompetencies || []).filter(Boolean) : [];
  const workAuthBadge = getWorkAuthorizationBadge(
    data.formFieldAnswers?.workAuthorization || data.formFieldAnswers?.workPermitGermany,
    lang
  );

  const sectionHeadingStyle: React.CSSProperties = {
    fontFamily: headingFont,
    fontSize: `${Math.max(fontSize, 10.5)}pt`,
    textTransform: "uppercase",
    letterSpacing: "0.09em",
    borderBottom: `1px solid ${accentTint(accentColor, 0.25)}`,
    paddingBottom: "2.5px",
    marginTop: "5px",
    marginBottom: "6px",
    fontWeight: 700,
    color: accentColor,
    breakAfter: "avoid",
    pageBreakAfter: "avoid",
  };

  return (
    <div
      id="cv-template-ats"
      lang={lang === "German" ? "de" : lang === "Spanish" ? "es" : "en"}
      style={{ minWidth: 0, 
        boxSizing: "border-box",
        width: "210mm",
        minHeight: "297mm",
        padding: `${DOCUMENT_LAYOUT.cv.top}mm ${DOCUMENT_LAYOUT.cv.right}mm ${DOCUMENT_LAYOUT.cv.bottom}mm ${DOCUMENT_LAYOUT.cv.left}mm`,
        overflowWrap: "anywhere",
        backgroundColor: "#ffffff",
        color: "#111827",
        fontFamily: bodyFont,
        fontSize: `${fontSize}pt`,
        lineHeight: lineSpacing,
        margin: "0 auto",
        position: "relative",
        fontVariantLigatures: "none",
        fontFeatureSettings: '"liga" 0, "clig" 0',
        fontVariantNumeric: "tabular-nums",
        fontKerning: "normal",
      }}
    >
      {/* Header */}
      <div data-layout-section="header"
        className="break-avoid"
        style={
          hasPhoto
            ? {
                display: "flex",
                flexDirection: isPhotoCenter ? "column-reverse" : isPhotoLeft ? "row-reverse" : "row",
                justifyContent: isPhotoCenter ? "center" : "space-between",
                alignItems: "center",
                textAlign: centerHeaderText ? "center" : "left",
                gap: isPhotoCenter ? "10px" : "20px",
                marginBottom: "10px",
                paddingBottom: "8px",
                borderBottom: "1px solid #e2e8f0",
              }
            : { textAlign: "center", marginBottom: "8px" }
        }
      >
        <div style={{ minWidth: 0,  flex: 1 }}>
          <h1
            style={{ minWidth: 0, 
              fontFamily: headingFont,
              fontSize: "20.5pt", lineHeight: 1.18,
              fontWeight: 700,
              margin: "0 0 3px 0",
              color: "#111827",
              letterSpacing: "-0.35px",
            }}
          >
            {cv.header.fullName}
          </h1>
          <div
            style={{ minWidth: 0, 
              fontSize: "10.3pt",
              fontWeight: 600,
              color: accentColor,
              marginBottom: "4px",
              textWrap: "balance",
            }}
          >
            {cv.header.headline}
          </div>
          <div
            style={{ minWidth: 0, 
              display: "flex",
              flexWrap: "wrap",
              justifyContent: centerHeaderText ? "center" : "flex-start",
              alignItems: "center",
              gap: "2px 7px",
              fontSize: "9pt",
              color: "#374151",
            }}
          >
            {cv.header.location && (
              <span style={{ minWidth: 0,  whiteSpace: "normal" }}>{renderLocalizedLocation(cv.header.location, lang)}</span>
            )}
            {cv.header.email && (
              <>
                <span aria-hidden="true" style={{ minWidth: 0,  color: "#9ca3af" }}>·</span>
                <a
                  href={`mailto:${cv.header.email}`}
                  style={{ minWidth: 0,  color: "#374151", textDecoration: "none", whiteSpace: "normal" }}
                >
                  {cv.header.email}
                </a>
              </>
            )}
            {cv.header.phone && (
              <>
                <span aria-hidden="true" style={{ minWidth: 0,  color: "#9ca3af" }}>·</span>
                <span style={{ minWidth: 0,  whiteSpace: "normal" }}>{cv.header.phone}</span>
              </>
            )}
            {cv.header.links &&
              cv.header.links.map((link, idx) => {
                const displayUrl = documentLinkText(link.url, link.label);
                return (
                  <React.Fragment key={idx}>
                    <span aria-hidden="true" style={{ minWidth: 0,  color: "#9ca3af" }}>·</span>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ minWidth: 0,  color: accentColor, textDecoration: "none", fontWeight: 600, whiteSpace: "normal" }}
                    >
                      {displayUrl}
                    </a>
                  </React.Fragment>
                );
              })}
          </div>
          <div
            style={{ minWidth: 0, 
              display: "flex",
              flexWrap: "wrap",
              justifyContent: centerHeaderText ? "center" : "flex-start",
              alignItems: "center",
              gap: "2px 8px",
              fontSize: "9pt",
              color: "#4b5563",
              marginTop: "2.5px",
            }}
          >
            <span style={{ minWidth: 0,  whiteSpace: "normal" }}>
              <strong style={{ flexShrink: 0, minWidth: 0,  color: "#374151" }}>{labels.availability}:</strong> {cv.header.availability}
            </span>
            {workAuthBadge && (
              <>
                <span aria-hidden="true" style={{ minWidth: 0,  color: "#9ca3af" }}>·</span>
                <span style={{ minWidth: 0, whiteSpace: "normal" }}>{workAuthBadge}</span>
              </>
            )}
            {cv.header.languages && cv.header.languages.length > 0 && (
              <>
                <span aria-hidden="true" style={{ minWidth: 0,  color: "#9ca3af" }}>·</span>
                <span>
                  <strong style={{ flexShrink: 0, minWidth: 0,  color: "#374151" }}>{labels.languages}:</strong>{" "}
                  {cv.header.languages.map((l) => `${l.language} (${l.level})`).join(", ")}
                </span>
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
        <div data-layout-section="profile" className="break-avoid" style={{ minWidth: 0,  marginBottom: `${sectionSpacing}px` }}>
          <h2 data-section-heading style={sectionHeadingStyle}>{labels.profile}</h2>
          <p data-layout-item
            style={{ minWidth: 0, 
              margin: "0",
              fontSize: `${fontSize}pt`,
              textAlign: "left",
              color: "#1f2937",
              textWrap: "pretty",
            }}
          >
            {renderRichText(cv.professionalProfile, true, 3)}
          </p>
        </div>
      )}

      {/* Key Achievements */}
      {showKeyAchievements && cv.keyAchievements && cv.keyAchievements.length > 0 && (
        <div data-layout-section="achievements" style={{ minWidth: 0,  marginBottom: `${sectionSpacing}px` }}>
          <h2 data-section-heading className="section-heading" style={sectionHeadingStyle}>{labels.achievements}</h2>
          <ul style={{ minWidth: 0,  margin: "0", paddingLeft: "15px" }}>
            {cv.keyAchievements.map((achievement, idx) => (
              <li data-layout-item
                key={idx}
                className="break-avoid"
                style={{ minWidth: 0, 
                  marginBottom: "3.5px",
                  lineHeight: bulletLineHeight,
                  fontSize: `${fontSize}pt`,
                  textAlign: "left",
                  color: "#1f2937",
                  textWrap: "pretty",
                }}
              >
                {renderRichText(achievement, true)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Core Skills — Tabular Editorial Category Grid (2-second scan) */}
      {(cleanSkills.length > 0 || specializedCompetencies.length > 0) && (
        <div data-layout-section="skills" style={{ minWidth: 0,  marginBottom: `${sectionSpacing}px` }}>
          <h2 data-section-heading className="section-heading" style={sectionHeadingStyle}>{labels.skills}</h2>
          <div
            style={{ minWidth: 0, 
              display: "flex",
              flexDirection: "column",
              gap: "3.5px",
            }}
          >
            {cleanSkills.map((group, idx) => (
              <div data-layout-entry
                key={idx}
                className="break-avoid"
                style={{ minWidth: 0, 
                  display: "grid",
                  gridTemplateColumns: "165px minmax(0, 1fr)",
                  gap: "10px",
                  alignItems: "baseline",
                  fontSize: `${fontSize}pt`,
                  lineHeight: 1.33,
                  textAlign: "left",
                  paddingBottom: idx < cleanSkills.length - 1 || specializedCompetencies.length > 0 ? "2px" : "0",
                  borderBottom: idx < cleanSkills.length - 1 || specializedCompetencies.length > 0 ? "0.5px solid #f1f5f9" : "none",
                }}
              >
                <strong style={{ minWidth: 0,  color: "#111827", fontWeight: 700 }}>{group.group}</strong>
                <span style={{ minWidth: 0,  color: "#374151", textWrap: "pretty" }}>{group.skills.join("  ·  ")}</span>
              </div>
            ))}
            {specializedCompetencies.length > 0 && (
              <div data-layout-entry
                className="break-avoid"
                style={{ minWidth: 0,
                  display: "grid",
                  gridTemplateColumns: "165px minmax(0, 1fr)",
                  gap: "10px",
                  alignItems: "baseline",
                  fontSize: `${fontSize}pt`,
                  lineHeight: 1.33,
                  textAlign: "left",
                }}
              >
                <strong style={{ minWidth: 0, color: "#111827", fontWeight: 700 }}>{labels.specializedCompetencies}</strong>
                <span style={{ minWidth: 0, color: "#374151", textWrap: "pretty" }}>{specializedCompetencies.join("  ·  ")}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Professional Experience */}
      {visibleExperience.length > 0 && (
        <div data-layout-section="experience" style={{ minWidth: 0,  marginBottom: `${sectionSpacing}px` }}>
          <h2 data-section-heading className="section-heading" style={sectionHeadingStyle}>{labels.experience}</h2>
          {visibleExperience.map((exp, idx) => {
            const isPromotedFromBelow = isSameCompany(exp.company, visibleExperience[idx + 1]?.company);
            return (
              <div data-continuation-label={[exp.jobTitle, exp.company].filter(Boolean).join(" — ")} data-layout-entry key={exp.id || idx} className="experience-entry" style={{ minWidth: 0,  marginBottom: "9.5px" }}>
                <div >
                  <div data-entry-heading
                    style={{ minWidth: 0, flexWrap: "wrap", 
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "baseline",
                      fontSize: `${fontSize}pt`,
                      gap: "4px 16px",
                      marginBottom: "1.5px",
                    }}
                  >
                    <div data-entry-title style={{ minWidth: 0, flex: "1 1 330px", display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: "0 6px" }}>
                      <h3 style={{ minWidth: 0, margin: 0, fontSize: "inherit", color: "#111827", fontWeight: 700 }}>{exp.jobTitle}</h3>
                      {exp.company && (
                        <span style={{ minWidth: 0, color: accentColor, fontWeight: 600, overflowWrap: "anywhere" }}><span aria-hidden="true">— </span>{exp.company}</span>
                      )}
                      {isPromotedFromBelow && (
                        <span
                          style={{ minWidth: 0, 
                            fontSize: `${Math.max(fontSize - 2.1, 8.5)}pt`,
                            fontWeight: 600,
                            color: accentColor,
                            backgroundColor: "#f1f5f9",
                            border: "0.5px solid #cbd5e1",
                            padding: "0.5px 5px",
                            borderRadius: "3px",
                            verticalAlign: "1px",
                            whiteSpace: "nowrap",
                            display: "inline-block",
                            maxWidth: "100%",
                          }}
                        >
                          {labels.promoted}
                        </span>
                      )}
                    </div>
                    <div
                      style={{ minWidth: 0, 
                        fontWeight: 600,
                        fontSize: `${Math.max(fontSize - 0.8, 9)}pt`,
                        color: "#374151",
                        whiteSpace: "normal",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {renderLocalizedDateRange(exp.dates, lang)}
                      {exp.location && (
                        <span style={{ minWidth: 0,  fontWeight: 400, color: "#6b7280" }}>
                          {" "}
                          <span aria-hidden="true">· </span>{renderLocalizedLocation(exp.location, lang)}
                        </span>
                      )}
                    </div>
                  </div>
                  {exp.summary && (
                    <p data-layout-item
                      style={{ minWidth: 0, 
                        margin: "1.5px 0 2.5px 0",
                        fontStyle: "italic",
                        fontSize: `${Math.max(fontSize - 0.8, 9)}pt`,
                        color: "#4b5563",
                      }}
                    >
                      {renderRichText(exp.summary, false)}
                    </p>
                  )}
                  {exp.bullets.length > 0 && (
                    <ul style={{ minWidth: 0,  margin: "2px 0 0 0", paddingLeft: "15px" }}>
                      {exp.bullets.map((bullet, bIdx) => (
                        <li data-layout-item
                          key={bIdx}
                          style={{ minWidth: 0, 
                            marginBottom: "3.2px",
                            lineHeight: bulletLineHeight,
                            fontSize: `${fontSize}pt`,
                            textAlign: "left",
                            color: "#1f2937",
                            textWrap: "pretty",
                          }}
                        >
                          {renderRichText(bullet, true)}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                
              </div>
            );
          })}
        </div>
      )}

      {/* Selected Projects */}
      {cleanProjects.length > 0 && (
        <div data-layout-section="projects" style={{ minWidth: 0,  marginBottom: `${sectionSpacing}px` }}>
          <h2 data-section-heading className="section-heading" style={sectionHeadingStyle}>{labels.projects}</h2>
          {cleanProjects.map((proj, idx) => {
            const { cleanTitle, cleanRole, hasParensInTitle } = formatProjectTitleAndRole(
              proj.title,
              proj.role
            );
            return (
              <div data-layout-entry key={proj.id || idx} className="project-entry break-avoid" style={{ minWidth: 0,  marginBottom: "8px" }}>
                <div data-entry-heading
                  style={{ minWidth: 0, flexWrap: "wrap", 
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "baseline",
                    fontSize: `${fontSize}pt`,
                    gap: "4px 16px",
                  }}
                >
                  <div style={{ minWidth: 0, flex: "1 1 330px", display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: "0 6px" }}>
                    <h3 style={{ minWidth: 0, margin: 0, fontSize: "inherit", color: "#111827", fontWeight: 700 }}>{cleanTitle}</h3>
                    {cleanRole && (
                      <span style={{ minWidth: 0,  fontWeight: 600, color: accentColor }}>
                        {hasParensInTitle ? `— ${cleanRole}` : `· ${cleanRole}`}
                      </span>
                    )}
                    {(proj.url || proj.repoUrl || proj.demoUrl) && (
                      <a
                        href={proj.url || proj.repoUrl || proj.demoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontSize: `${Math.max(fontSize - 1.2, 8.8)}pt`, color: accentColor, textDecoration: "none", fontWeight: 500 }}
                      >
                        [{documentLinkText(proj.url || proj.repoUrl || proj.demoUrl || "", proj.repoUrl ? "Repo" : "Demo")}]
                      </a>
                    )}
                  </div>
                  {proj.dates && (
                    <div
                      style={{ minWidth: 0, 
                        fontWeight: 600,
                        fontSize: `${Math.max(fontSize - 0.8, 9)}pt`,
                        color: "#374151",
                        whiteSpace: "normal",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {renderLocalizedDateRange(proj.dates, lang)}
                    </div>
                  )}
                </div>
                {proj.description && proj.description.trim() && (
                  <p data-layout-item style={{ minWidth: 0,  margin: "1.5px 0 2px 0", fontSize: `${Math.max(fontSize - 0.7, 9)}pt`, lineHeight: 1.35, color: "#374151" }}>
                    {renderRichText(proj.description, false)}
                  </p>
                )}
                {proj.bullets && proj.bullets.length > 0 && (
                  <ul style={{ minWidth: 0,  margin: "2px 0 0 0", paddingLeft: "15px" }}>
                    {proj.bullets.map((b, bIdx) => (
                      <li data-layout-item
                        key={bIdx}
                        style={{ minWidth: 0, 
                          marginBottom: "3px",
                          lineHeight: bulletLineHeight,
                          fontSize: `${fontSize}pt`,
                          textAlign: "left",
                          color: "#1f2937",
                          textWrap: "pretty",
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
      <div data-layout-section="education-certifications" style={{ minWidth: 0,  display: "grid", gridTemplateColumns: cv.education?.length && cv.certifications?.length ? "minmax(0, 1.08fr) minmax(0, 0.92fr)" : "minmax(0, 1fr)", gap: "22px", alignItems: "start" }}>
        {/* Education */}
        {cv.education && cv.education.length > 0 && (
          <div data-layout-section="education" data-layout-column style={{ minWidth: 0 }}>
            <h2 data-section-heading className="section-heading" style={sectionHeadingStyle}>{labels.education}</h2>
            {cv.education.map((edu, idx) => (
              <div data-continuation-label={[edu.degree, edu.institution].filter(Boolean).join(" — ")} data-layout-entry key={edu.id || idx} className="break-avoid" style={{ minWidth: 0,  marginBottom: "5.5px", fontSize: `${fontSize}pt` }}>
                <div data-entry-heading style={{ minWidth: 0 }}>
                    <h3 style={{ minWidth: 0, margin: 0, fontSize: "inherit", fontWeight: 700, color: "#111827" }}>{edu.degree}</h3>
                    <EducationMetaRow institution={edu.institution} period={edu.period} accentColor={accentColor} fontSize={fontSize} />
                  </div>
                {edu.description && (
                  <div data-layout-item style={{ minWidth: 0,  fontSize: `${Math.max(fontSize - 0.9, 9)}pt`, color: "#4b5563", marginTop: "1.5px", lineHeight: 1.33 }}>
                    {renderRichText(edu.description, false)}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Certifications — Single Uncompressed Column for Clean Readability */}
        {cv.certifications && cv.certifications.length > 0 && (
          <div data-layout-section="certifications" data-layout-column style={{ minWidth: 0 }}>
            <h2 data-section-heading className="section-heading" style={sectionHeadingStyle}>{labels.certifications}</h2>
            <div
              style={{ minWidth: 0, 
                display: "flex",
                flexDirection: "column",
                gap: "3.5px",
                fontSize: `${Math.max(fontSize - 0.6, 9)}pt`,
                lineHeight: 1.33,
              }}
            >
              {cv.certifications.map((cert, idx) => (
                <div data-layout-entry
                  key={cert.id || idx}
                  className="break-avoid"
                  style={{ minWidth: 0,  display: "flex", alignItems: "baseline", gap: "6px", textAlign: "left" }}
                >
                  <span aria-hidden="true" style={{ minWidth: 0,  color: accentColor, fontWeight: 700, flexShrink: 0 }}>·</span>
                  <div>
                    <span style={{ minWidth: 0,  color: "#1f2937", fontWeight: 500 }}>{renderLocalizedCertificationName(cert.name, lang)}</span>
                    {(cert.authority || cert.date || cert.credentialId) && (
                      <span style={{ minWidth: 0,  color: "#6b7280", fontSize: `${Math.max(fontSize - 1.0, 9)}pt` }}>
                        {cert.authority ? ` — ${cert.authority}` : ""}
                        {cert.date ? ` · ${cert.date}` : ""}
                        {cert.credentialId ? ` · ID: ${cert.credentialId}` : ""}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
