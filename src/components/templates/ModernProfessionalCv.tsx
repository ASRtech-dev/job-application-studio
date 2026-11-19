import React from "react";
import { type TemplateProps } from "./types";
import { getEffectiveLanguage, SECTION_LABELS, getCleanSkills, getCleanProjects, renderLocalizedLocation, isSameCompany, renderLocalizedDateRange, formatProjectTitleAndRole, renderLocalizedCertificationName, getWorkAuthorizationBadge } from "./templateUtils";
import { getExecutivePortraitStyle, EducationMetaRow, IconPin, IconMail, IconPhone, IconCalendar, IconGlobe } from "./DocumentPrimitives";
import { renderRichText } from "./RichText";
import { DOCUMENT_LAYOUT, accentTint, documentAccent, documentFontSize, documentLinkText, resolveDocumentFontStack } from "@/lib/documentDesign";

// -------------------------------------------------------------
// 2. MODERN PROFESSIONAL CV TEMPLATE (MODULAR FULL-WIDTH EDITORIAL GRID)
// -------------------------------------------------------------
export const ModernProfessionalCv: React.FC<TemplateProps> = ({ data, photoBase64 }) => {
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
  const hasPhoto = Boolean(showPhoto && photoUrl);
  const isPhotoLeft = photoPlacement === "sidebar" || photoPlacement === "header-left";
  const isPhotoCenter = photoPlacement === "header-center";

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

  const portraitStyle = getExecutivePortraitStyle(cropStyle, accentColor, "modern", photoWidthPx);

  const renderSectionTitle = (title: string) => (
    <div data-section-heading
      className="section-heading break-avoid"
      style={{ minWidth: 0, 
        display: "flex",
        alignItems: "center",
        gap: "10px",
        marginBottom: "6px",
        marginTop: "4px",
        breakAfter: "avoid",
        pageBreakAfter: "avoid",
      }}
    >
      <h2
        style={{ minWidth: 0, 
          fontFamily: headingFont,
          fontSize: `${Math.max(fontSize, 10.5)}pt`,
          fontWeight: 700,
          color: accentColor,
          textTransform: "uppercase",
          letterSpacing: "0.09em",
          margin: 0,
          whiteSpace: "normal",
          breakAfter: "avoid",
          pageBreakAfter: "avoid",
        }}
      >
        {title}
      </h2>
      <div style={{ flex: 1, height: "1px", backgroundColor: accentTint(accentColor, 0.22) }} />
    </div>
  );

  return (
    <div
      id="cv-template-modern"
      lang={lang === "German" ? "de" : lang === "Spanish" ? "es" : "en"}
      style={{ minWidth: 0, 
        boxSizing: "border-box",
        width: "210mm",
        minHeight: "297mm",
        padding: `${DOCUMENT_LAYOUT.cv.top}mm ${DOCUMENT_LAYOUT.cv.right}mm ${DOCUMENT_LAYOUT.cv.bottom}mm ${DOCUMENT_LAYOUT.cv.left}mm`,
        overflowWrap: "anywhere",
        backgroundColor: "#ffffff",
        color: "#1f2937",
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
      {/* Top Executive Hairline Rule */}
      <div
        data-layout-section="accent"
        style={{
          height: "2px",
          backgroundColor: accentColor,
          marginBottom: "10px",
        }}
      />

      {/* Header Container */}
      <div data-layout-section="header"
        className="break-avoid"
        style={{ minWidth: 0, gap: hasPhoto && isPhotoCenter ? "10px" : "20px", 
          display: "flex",
          flexDirection: hasPhoto && isPhotoCenter ? "column-reverse" : hasPhoto && isPhotoLeft ? "row-reverse" : "row",
          justifyContent: hasPhoto && isPhotoCenter ? "center" : "space-between",
          alignItems: hasPhoto ? "center" : "flex-start",
          textAlign: hasPhoto && isPhotoCenter ? "center" : "left",
          marginBottom: "10px",
          paddingBottom: "8px",
          borderBottom: `1px solid ${accentTint(accentColor, 0.2)}`,
        }}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          <h1
            style={{ minWidth: 0, 
              fontFamily: headingFont,
              fontSize: "21.5pt", lineHeight: 1.16,
              fontWeight: 700,
              margin: "0 0 3px 0",
              color: accentColor,
              letterSpacing: "-0.35px",
            }}
          >
            {cv.header.fullName}
          </h1>
          <div
            style={{ minWidth: 0, 
              fontSize: "10.3pt",
              fontWeight: 600,
              color: "#374151",
              textWrap: "balance",
              marginBottom: "4.5px",
            }}
          >
            {cv.header.headline}
          </div>

          {/* Contact & Meta Line 1 */}
          <div
            style={{ minWidth: 0, 
              display: "flex",
              flexWrap: "wrap",
              justifyContent: hasPhoto && isPhotoCenter ? "center" : "flex-start",
              alignItems: "center",
              gap: "2.5px 9px",
              fontSize: `${Math.max(fontSize - 1.4, 9)}pt`,
              color: "#4b5563",
            }}
          >
            <span style={{ minWidth: 0,  display: "inline-flex", alignItems: "center", whiteSpace: "normal" }}>
              <IconPin color={accentColor} />
              {renderLocalizedLocation(cv.header.location, lang)}
            </span>
            <span aria-hidden="true" style={{ minWidth: 0,  color: "#cbd5e1" }}>·</span>
            <span style={{ minWidth: 0,  display: "inline-flex", alignItems: "center", whiteSpace: "normal" }}>
              <IconMail color={accentColor} />
              <a href={`mailto:${cv.header.email}`} style={{ minWidth: 0,  color: "#374151", textDecoration: "none" }}>
                {cv.header.email}
              </a>
            </span>
            <span aria-hidden="true" style={{ minWidth: 0,  color: "#cbd5e1" }}>·</span>
            <span style={{ minWidth: 0,  display: "inline-flex", alignItems: "center", whiteSpace: "normal" }}>
              <IconPhone color={accentColor} />
              {cv.header.phone}
            </span>
            {cv.header.links &&
              cv.header.links.map((link, idx) => {
                const cleanUrl = documentLinkText(link.url, link.label);
                return (
                  <React.Fragment key={idx}>
                    <span aria-hidden="true" style={{ minWidth: 0,  color: "#cbd5e1" }}>·</span>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ minWidth: 0,  color: accentColor, textDecoration: "none", fontWeight: 600, whiteSpace: "normal" }}
                    >
                      {cleanUrl}
                    </a>
                  </React.Fragment>
                );
              })}
          </div>

          {/* Contact & Meta Line 2: Availability & Languages */}
          <div
            style={{ minWidth: 0, 
              display: "flex",
              flexWrap: "wrap",
              justifyContent: hasPhoto && isPhotoCenter ? "center" : "flex-start",
              alignItems: "center",
              gap: "2.5px 9px",
              fontSize: `${Math.max(fontSize - 1.5, 9)}pt`,
              color: "#4b5563",
              marginTop: "3px",
            }}
          >
            <span style={{ minWidth: 0,  display: "inline-flex", alignItems: "center", whiteSpace: "normal" }}>
              <IconCalendar color={accentColor} />
              <strong style={{ flexShrink: 0, minWidth: 0,  color: "#374151", marginRight: "3px" }}>{labels.availability}:</strong>
              {cv.header.availability}
            </span>
            {workAuthBadge && (
              <>
                <span aria-hidden="true" style={{ minWidth: 0,  color: "#cbd5e1" }}>·</span>
                <span style={{ minWidth: 0, whiteSpace: "normal" }}>{workAuthBadge}</span>
              </>
            )}
            {cv.header.languages && cv.header.languages.length > 0 && (
              <>
                <span aria-hidden="true" style={{ minWidth: 0,  color: "#cbd5e1" }}>·</span>
                <span style={{ minWidth: 0,  display: "inline-flex", alignItems: "center" }}>
                  <IconGlobe color={accentColor} />
                  <strong style={{ flexShrink: 0, minWidth: 0,  color: "#374151", marginRight: "3px" }}>{labels.languages}:</strong>
                  {cv.header.languages.map((l) => `${l.language} (${l.level})`).join(", ")}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Optional Photo */}
        {hasPhoto && (
          <div style={portraitStyle.container}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photoUrl} alt={cv.header.fullName} style={portraitStyle.image} />
          </div>
        )}
      </div>

      {/* BAND 1: PROFESSIONAL PROFILE */}
      {cv.professionalProfile && (
        <div data-layout-section="profile" className="break-avoid" style={{ minWidth: 0,  marginBottom: `${sectionSpacing}px` }}>
          {renderSectionTitle(labels.profile)}
          <div data-layout-item
            style={{ minWidth: 0, 
              borderLeft: `2.5px solid ${accentColor}`,
              paddingLeft: "10px",
              fontSize: `${fontSize}pt`,
              color: "#374151",
              textAlign: "left",
              textWrap: "pretty",
            }}
          >
            {renderRichText(cv.professionalProfile, true, 3)}
          </div>
        </div>
      )}

      {/* BAND 2: KEY ACHIEVEMENTS (PURE WHITE SWISS EDITORIAL ACCENT — NO BOX BORDERS) */}
      {showKeyAchievements && cv.keyAchievements && cv.keyAchievements.length > 0 && (
        <div data-layout-section="achievements" style={{ minWidth: 0,  marginBottom: `${sectionSpacing}px` }}>
          <div className="section-heading break-avoid">
            {renderSectionTitle(labels.achievements)}
          </div>
          <ul
            style={{ minWidth: 0, 
              listStyle: "none",
              margin: 0,
              padding: "1px 0 1px 10px",
              borderLeft: `2px solid ${accentColor}`,
              display: "flex",
              flexDirection: "column",
              gap: "3.5px",
            }}
          >
            {cv.keyAchievements.map((achievement, idx) => (
              <li data-layout-item
                key={idx}
                className="break-avoid"
                style={{ minWidth: 0, 
                  display: "flex",
                  gap: "7px",
                  alignItems: "flex-start",
                  lineHeight: bulletLineHeight,
                  fontSize: `${fontSize}pt`,
                }}
              >
                <span aria-hidden="true" style={{ minWidth: 0,  color: accentColor, fontWeight: 700, flexShrink: 0 }}>–</span>
                <span style={{ minWidth: 0,  color: "#1f2937", textAlign: "left", textWrap: "pretty" }}>
                  {renderRichText(achievement, true)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* BAND 3: CORE SKILLS (SWISS TYPOGRAPHIC 2-COLUMN INDEX — ZERO BOX NOISE) */}
      {(cleanSkills.length > 0 || specializedCompetencies.length > 0) && (
        <div data-layout-section="skills" style={{ minWidth: 0,  marginBottom: `${sectionSpacing}px` }}>
          {renderSectionTitle(labels.skills)}
          <div
            style={{ minWidth: 0, 
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
              gap: "8px 18px",
            }}
          >
            {cleanSkills.map((group, idx) => (
              <div data-layout-entry
                key={idx}
                className="break-avoid"
                style={{ minWidth: 0, 
                  borderTop: `1px solid ${accentTint(accentColor, 0.24)}`,
                  paddingTop: "4px",
                  ...(cleanSkills.length % 2 === 1 && idx === cleanSkills.length - 1 ? { gridColumn: "1 / -1" } : {}),
                }}
              >
                <div
                  style={{ minWidth: 0, 
                    fontWeight: 700,
                    color: accentColor,
                    fontSize: `${Math.max(fontSize - 1.3, 9)}pt`,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    marginBottom: "2px",
                  }}
                >
                  {group.group}
                </div>
                <div
                  style={{ minWidth: 0, 
                    fontSize: `${Math.max(fontSize - 0.6, 9)}pt`,
                    color: "#374151",
                    lineHeight: 1.35,
                    wordBreak: "break-word",
                    textWrap: "pretty",
                  }}
                >
                  {group.skills.join("  ·  ")}
                </div>
              </div>
            ))}
            {specializedCompetencies.length > 0 && (
              <div data-layout-entry
                className="break-avoid"
                style={{ minWidth: 0,
                  gridColumn: "1 / -1",
                  borderTop: `1px solid ${accentTint(accentColor, 0.24)}`,
                  paddingTop: "4px",
                }}
              >
                <div style={{ minWidth: 0, fontWeight: 700, color: accentColor, fontSize: `${Math.max(fontSize - 1.3, 9)}pt`, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "2px" }}>
                  {labels.specializedCompetencies}
                </div>
                <div style={{ minWidth: 0, fontSize: `${Math.max(fontSize - 0.6, 9)}pt`, color: "#374151", lineHeight: 1.35, textWrap: "pretty" }}>
                  {specializedCompetencies.join("  ·  ")}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* BAND 4: PROFESSIONAL EXPERIENCE (FULL WIDTH EDITORIAL + INTERNAL PROMOTION TRACK) */}
      {visibleExperience.length > 0 && (
        <div data-layout-section="experience" style={{ minWidth: 0,  marginBottom: `${sectionSpacing}px` }}>
          {renderSectionTitle(labels.experience)}
          <div style={{ minWidth: 0,  display: "flex", flexDirection: "column", gap: "9.5px" }}>
            {visibleExperience.map((exp, idx) => {
              const isPromotedFromBelow = isSameCompany(exp.company, visibleExperience[idx + 1]?.company);
              const isPromotedIntoAbove = isSameCompany(exp.company, visibleExperience[idx - 1]?.company);
              const isSameCompanyChain = isPromotedFromBelow || isPromotedIntoAbove;

              return (
                <div data-continuation-label={[exp.jobTitle, exp.company].filter(Boolean).join(" — ")} data-layout-entry
                  key={exp.id || idx}
                  className="experience-entry"
                  style={
                    isSameCompanyChain
                      ? {
                          borderLeft: "2px solid #cbd5e1",
                          paddingLeft: "9px",
                        }
                      : undefined
                  }
                >
                  <div >
                    <div data-entry-heading
                      style={{ minWidth: 0, flexWrap: "wrap", 
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "baseline",
                        gap: "4px 16px",
                        marginBottom: "1.5px",
                      }}
                    >
                      <div data-entry-title style={{ minWidth: 0, flex: "1 1 330px",  fontSize: `${fontSize + 0.2}pt`, fontWeight: 700, color: "#111827", display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: "0 6px" }}>
                        <h3 style={{ minWidth: 0, margin: 0, fontSize: "inherit", fontWeight: 700, color: "#111827" }}>{exp.jobTitle}</h3>
                        {exp.company && (
                          <span style={{ minWidth: 0, color: accentColor, fontWeight: 600, overflowWrap: "anywhere" }}><span aria-hidden="true">— </span>{exp.company}</span>
                        )}
                        {isPromotedFromBelow && (
                          <span
                            style={{ minWidth: 0, 
                              fontSize: `${Math.max(fontSize - 2.2, 8.5)}pt`,
                              fontWeight: 600,
                              color: accentColor,
                              backgroundColor: "#f1f5f9",
                              border: "1px solid #cbd5e1",
                              padding: "0.5px 5.5px",
                              borderRadius: "4px",
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
                          fontSize: `${Math.max(fontSize - 0.8, 9)}pt`,
                          color: "#374151",
                          fontWeight: 600,
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
                      <div data-layout-item
                        style={{ minWidth: 0, 
                          fontSize: `${Math.max(fontSize - 0.8, 9)}pt`,
                          color: "#4b5563",
                          fontStyle: "italic",
                          marginBottom: "2.5px",
                        }}
                      >
                        {renderRichText(exp.summary, false)}
                      </div>
                    )}
                    {exp.bullets.length > 0 && (
                      <ul style={{ minWidth: 0, margin: "2px 0 0 0", paddingLeft: "15px", display: "flex", flexDirection: "column", gap: "3.2px" }}>
                        {exp.bullets.map((bullet, bIdx) => (
                          <li data-layout-item
                            key={bIdx}
                            style={{ minWidth: 0, 
                              lineHeight: bulletLineHeight,
                              fontSize: `${fontSize}pt`,
                              color: "#1f2937",
                              textAlign: "left",
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
        </div>
      )}

      {/* BAND 5: SELECTED PROJECTS (FULL WIDTH EDITORIAL — NO BARCODE BORDERS) */}
      {cleanProjects.length > 0 && (
        <div data-layout-section="projects" style={{ minWidth: 0,  marginBottom: `${sectionSpacing}px` }}>
          {renderSectionTitle(labels.projects)}
          <div style={{ minWidth: 0,  display: "flex", flexDirection: "column", gap: "8px" }}>
            {cleanProjects.map((proj, idx) => {
              const { cleanTitle, cleanRole, hasParensInTitle } = formatProjectTitleAndRole(
                proj.title,
                proj.role
              );
              return (
                <div data-layout-entry
                  key={proj.id || idx}
                  className="project-entry break-avoid"
                >
                  <div data-entry-heading
                    style={{ minWidth: 0, flexWrap: "wrap", 
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "baseline",
                      gap: "4px 16px",
                      marginBottom: "1.5px",
                    }}
                  >
                    <div style={{ minWidth: 0, flex: "1 1 330px",  fontSize: `${fontSize}pt`, fontWeight: 700, color: "#111827", display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: "0 6px" }}>
                      <h3 style={{ minWidth: 0, margin: 0, fontSize: "inherit", fontWeight: 700, color: "#111827" }}>{cleanTitle}</h3>
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
                          fontSize: `${Math.max(fontSize - 0.8, 9)}pt`,
                          color: "#374151",
                          fontWeight: 600,
                          whiteSpace: "normal",
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {renderLocalizedDateRange(proj.dates, lang)}
                      </div>
                    )}
                  </div>
                  {proj.description && proj.description.trim() && (
                    <p data-layout-item style={{ minWidth: 0,  margin: "0 0 2px 0", fontSize: `${Math.max(fontSize - 0.7, 9)}pt`, lineHeight: 1.33, color: "#4b5563", textAlign: "left" }}>
                      {renderRichText(proj.description, false)}
                    </p>
                  )}
                  {proj.bullets && proj.bullets.length > 0 && (
                    <ul style={{ minWidth: 0, margin: "2px 0 0 0", paddingLeft: "15px", display: "flex", flexDirection: "column", gap: "3px" }}>
                      {proj.bullets.map((bullet, bIdx) => (
                        <li data-layout-item
                          key={bIdx}
                          style={{ minWidth: 0, 
                            lineHeight: bulletLineHeight,
                            fontSize: `${fontSize}pt`,
                            color: "#1f2937",
                            textAlign: "left",
                            textWrap: "pretty",
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
        </div>
      )}

      {/* BAND 6: SYMMETRIC FOOTER GRID (EDUCATION | CERTIFICATIONS) */}
      <div data-layout-section="education-certifications" style={{ minWidth: 0,  display: "grid", gridTemplateColumns: cv.education?.length && cv.certifications?.length ? "minmax(0, 1fr) minmax(0, 1fr)" : "minmax(0, 1fr)", gap: "22px", alignItems: "start" }}>
        {cv.education && cv.education.length > 0 && (
          <div data-layout-section="education" data-layout-column style={{ minWidth: 0 }}>
            {renderSectionTitle(labels.education)}
            <div style={{ minWidth: 0,  display: "flex", flexDirection: "column", gap: "5.5px" }}>
              {cv.education.map((edu, idx) => (
                <div data-continuation-label={[edu.degree, edu.institution].filter(Boolean).join(" — ")} data-layout-entry key={edu.id || idx} className="break-avoid">
                  <div data-entry-heading style={{ minWidth: 0 }}>
                    <h3 style={{ minWidth: 0, margin: 0, fontWeight: 700, color: "#111827", fontSize: `${fontSize}pt` }}>
                    {edu.degree}
                  </h3>
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
          </div>
        )}

        {cv.certifications && cv.certifications.length > 0 && (
          <div data-layout-section="certifications" data-layout-column style={{ minWidth: 0 }}>
            {renderSectionTitle(labels.certifications)}
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
