import React from "react";
import { type TemplateProps } from "./types";
import {
  getEffectiveLanguage,
  SECTION_LABELS,
  getCleanSkills,
  getCleanProjects,
  renderLocalizedLocation,
  isSameCompany,
  renderLocalizedDateRange,
  formatProjectTitleAndRole,
  renderLocalizedCertificationName,
  getWorkAuthorizationBadge,
} from "./templateUtils";
import { getExecutivePortraitStyle, IconPin, IconMail, IconPhone, IconCalendar, IconGlobe } from "./DocumentPrimitives";
import { renderRichText } from "./RichText";
import { DOCUMENT_LAYOUT, accentTint, documentAccent, documentFontSize, documentLinkText, resolveDocumentFontStack } from "@/lib/documentDesign";

// ---------------------------------------------------------------------------
// 5. DACH TABULAR CV TEMPLATE (TABELLARISCHER LEBENSLAUF · SWISS RAIL GRID)
// ---------------------------------------------------------------------------
const RAIL_WIDTH_PX = 124;
const RAIL_GAP_PX = 16;
const CONTENT_OFFSET_PX = RAIL_WIDTH_PX + RAIL_GAP_PX;

export const DachTabularCv: React.FC<TemplateProps> = ({ data, photoBase64 }) => {
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
  const portraitStyle = getExecutivePortraitStyle(cropStyle, accentColor, "modern", photoWidthPx);

  const fontSize = documentFontSize(data.templateSettings?.fontSize, "cv");
  const lineSpacing = Math.max(data.templateSettings?.lineSpacing || 1.4, 1.38);
  const sectionSpacing = data.templateSettings?.sectionSpacing || 13;
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

  const renderSectionTitle = (title: string) => (
    <div
      data-section-heading
      className="section-heading break-avoid"
      style={{
        minWidth: 0,
        display: "grid",
        gridTemplateColumns: `${RAIL_WIDTH_PX}px minmax(0, 1fr)`,
        columnGap: `${RAIL_GAP_PX}px`,
        alignItems: "center",
        marginTop: "3px",
        marginBottom: "6px",
        breakAfter: "avoid",
        pageBreakAfter: "avoid",
      }}
    >
      <div aria-hidden="true" style={{ height: "1.5px", backgroundColor: accentColor }} />
      <h2
        style={{
          minWidth: 0,
          margin: 0,
          fontFamily: headingFont,
          fontSize: `${Math.max(fontSize, 10.2)}pt`,
          fontWeight: 700,
          color: accentColor,
          textTransform: "uppercase",
          letterSpacing: "0.09em",
          borderBottom: `1px solid ${accentTint(accentColor, 0.2)}`,
          paddingBottom: "2px",
        }}
      >
        {title}
      </h2>
    </div>
  );

  return (
    <div
      id="cv-template-tabular"
      lang={lang === "German" ? "de" : lang === "Spanish" ? "es" : "en"}
      style={{
        minWidth: 0,
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
      <div
        data-layout-section="header"
        className="break-avoid"
        style={{
          minWidth: 0,
          display: "flex",
          flexDirection: hasPhoto && isPhotoCenter ? "column-reverse" : hasPhoto && isPhotoLeft ? "row-reverse" : "row",
          justifyContent: hasPhoto && isPhotoCenter ? "center" : "space-between",
          alignItems: hasPhoto ? "center" : "flex-start",
          textAlign: hasPhoto && isPhotoCenter ? "center" : "left",
          gap: hasPhoto && isPhotoCenter ? "10px" : "20px",
          marginBottom: "11px",
          paddingBottom: "9px",
          borderBottom: `1.5px solid ${accentColor}`,
        }}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          <h1
            style={{
              minWidth: 0,
              fontFamily: headingFont,
              fontSize: "21pt",
              lineHeight: 1.15,
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
              minWidth: 0,
              fontSize: "10.2pt",
              fontWeight: 600,
              color: accentColor,
              textWrap: "balance",
              marginBottom: "5px",
            }}
          >
            {cv.header.headline}
          </div>

          <div
            style={{
              minWidth: 0,
              display: "flex",
              flexWrap: "wrap",
              justifyContent: hasPhoto && isPhotoCenter ? "center" : "flex-start",
              alignItems: "center",
              gap: "2.5px 9px",
              fontSize: `${Math.max(fontSize - 1.3, 9)}pt`,
              color: "#374151",
            }}
          >
            {cv.header.location && (
              <span style={{ minWidth: 0, display: "inline-flex", alignItems: "center" }}>
                <IconPin color={accentColor} />
                {renderLocalizedLocation(cv.header.location, lang)}
              </span>
            )}
            {cv.header.email && (
              <>
                <span aria-hidden="true" style={{ color: "#cbd5e1" }}>·</span>
                <span style={{ minWidth: 0, display: "inline-flex", alignItems: "center" }}>
                  <IconMail color={accentColor} />
                  <a href={`mailto:${cv.header.email}`} style={{ color: "#374151", textDecoration: "none" }}>
                    {cv.header.email}
                  </a>
                </span>
              </>
            )}
            {cv.header.phone && (
              <>
                <span aria-hidden="true" style={{ color: "#cbd5e1" }}>·</span>
                <span style={{ minWidth: 0, display: "inline-flex", alignItems: "center" }}>
                  <IconPhone color={accentColor} />
                  {cv.header.phone}
                </span>
              </>
            )}
            {(cv.header.links || []).map((link, idx) => (
              <React.Fragment key={idx}>
                <span aria-hidden="true" style={{ color: "#cbd5e1" }}>·</span>
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: accentColor, textDecoration: "none", fontWeight: 600 }}
                >
                  {documentLinkText(link.url, link.label)}
                </a>
              </React.Fragment>
            ))}
          </div>

          <div
            style={{
              minWidth: 0,
              display: "flex",
              flexWrap: "wrap",
              justifyContent: hasPhoto && isPhotoCenter ? "center" : "flex-start",
              alignItems: "center",
              gap: "2.5px 9px",
              fontSize: `${Math.max(fontSize - 1.4, 9)}pt`,
              color: "#4b5563",
              marginTop: "3px",
            }}
          >
            {cv.header.availability && (
              <span style={{ minWidth: 0, display: "inline-flex", alignItems: "center" }}>
                <IconCalendar color={accentColor} />
                <strong style={{ color: "#1f2937", marginRight: "3px" }}>{labels.availability}:</strong>
                {cv.header.availability}
              </span>
            )}
            {workAuthBadge && (
              <>
                <span aria-hidden="true" style={{ color: "#cbd5e1" }}>·</span>
                <span>{workAuthBadge}</span>
              </>
            )}
            {cv.header.languages && cv.header.languages.length > 0 && (
              <>
                <span aria-hidden="true" style={{ color: "#cbd5e1" }}>·</span>
                <span style={{ minWidth: 0, display: "inline-flex", alignItems: "center" }}>
                  <IconGlobe color={accentColor} />
                  <strong style={{ color: "#1f2937", marginRight: "3px" }}>{labels.languages}:</strong>
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

      {/* Profile (aligned along the 140px axis) */}
      {cv.professionalProfile && (
        <div data-layout-section="profile" className="break-avoid" style={{ minWidth: 0, marginBottom: `${sectionSpacing}px` }}>
          {renderSectionTitle(labels.profile)}
          <div style={{ paddingLeft: `${CONTENT_OFFSET_PX}px` }}>
            <p
              data-layout-item
              style={{
                margin: 0,
                fontSize: `${fontSize}pt`,
                color: "#1f2937",
                textAlign: "left",
                textWrap: "pretty",
              }}
            >
              {renderRichText(cv.professionalProfile, true, 3)}
            </p>
          </div>
        </div>
      )}

      {/* Key Achievements */}
      {showKeyAchievements && cv.keyAchievements && cv.keyAchievements.length > 0 && (
        <div data-layout-section="achievements" style={{ minWidth: 0, marginBottom: `${sectionSpacing}px` }}>
          {renderSectionTitle(labels.achievements)}
          <div style={{ paddingLeft: `${CONTENT_OFFSET_PX}px` }}>
            <ul style={{ margin: 0, paddingLeft: "14px" }}>
              {cv.keyAchievements.map((achievement, idx) => (
                <li
                  key={idx}
                  data-layout-item
                  className="break-avoid"
                  style={{
                    marginBottom: "3.2px",
                    lineHeight: bulletLineHeight,
                    fontSize: `${fontSize}pt`,
                    color: "#1f2937",
                    textAlign: "left",
                    textWrap: "pretty",
                  }}
                >
                  {renderRichText(achievement, true)}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Core Skills (Left rail category label | Right skills tokens) */}
      {(cleanSkills.length > 0 || specializedCompetencies.length > 0) && (
        <div data-layout-section="skills" style={{ minWidth: 0, marginBottom: `${sectionSpacing}px` }}>
          {renderSectionTitle(labels.skills)}
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            {cleanSkills.map((group, idx) => (
              <div
                key={idx}
                data-layout-entry
                className="break-avoid"
                style={{
                  minWidth: 0,
                  display: "grid",
                  gridTemplateColumns: `${RAIL_WIDTH_PX}px minmax(0, 1fr)`,
                  columnGap: `${RAIL_GAP_PX}px`,
                  alignItems: "baseline",
                  fontSize: `${Math.max(fontSize - 0.3, 9.2)}pt`,
                  lineHeight: 1.35,
                  paddingBottom: "2.5px",
                  borderBottom: idx < cleanSkills.length - 1 || specializedCompetencies.length > 0 ? "0.5px solid #e2e8f0" : "none",
                }}
              >
                <strong style={{ color: accentColor, fontWeight: 700, fontSize: `${Math.max(fontSize - 0.8, 9)}pt` }}>
                  {group.group}
                </strong>
                <span style={{ color: "#1f2937", textWrap: "pretty" }}>{group.skills.join("  ·  ")}</span>
              </div>
            ))}
            {specializedCompetencies.length > 0 && (
              <div
                data-layout-entry
                className="break-avoid"
                style={{
                  minWidth: 0,
                  display: "grid",
                  gridTemplateColumns: `${RAIL_WIDTH_PX}px minmax(0, 1fr)`,
                  columnGap: `${RAIL_GAP_PX}px`,
                  alignItems: "baseline",
                  fontSize: `${Math.max(fontSize - 0.3, 9.2)}pt`,
                  lineHeight: 1.35,
                }}
              >
                <strong style={{ color: accentColor, fontWeight: 700, fontSize: `${Math.max(fontSize - 0.8, 9)}pt` }}>
                  {labels.specializedCompetencies}
                </strong>
                <span style={{ color: "#1f2937", textWrap: "pretty" }}>{specializedCompetencies.join("  ·  ")}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Professional Experience (DOM order keeps Role/Company before Dates for ATS while CSS Grid places Dates in Left Rail) */}
      {visibleExperience.length > 0 && (
        <div data-layout-section="experience" style={{ minWidth: 0, marginBottom: `${sectionSpacing}px` }}>
          {renderSectionTitle(labels.experience)}
          {visibleExperience.map((exp, idx) => {
            const isPromotedFromBelow = isSameCompany(exp.company, visibleExperience[idx + 1]?.company);
            return (
              <div
                key={exp.id || idx}
                data-continuation-label={[exp.jobTitle, exp.company].filter(Boolean).join(" — ")}
                data-layout-entry
                className="experience-entry"
                style={{ minWidth: 0, marginBottom: "9.5px" }}
              >
                <div
                  data-entry-heading
                  style={{
                    minWidth: 0,
                    display: "grid",
                    gridTemplateColumns: `${RAIL_WIDTH_PX}px minmax(0, 1fr)`,
                    columnGap: `${RAIL_GAP_PX}px`,
                    alignItems: "baseline",
                    marginBottom: "2px",
                  }}
                >
                  <div data-entry-title style={{ gridColumn: 2, gridRow: 1, minWidth: 0, display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: "2px 6px" }}>
                    <h3 style={{ margin: 0, fontSize: `${fontSize}pt`, fontWeight: 700, color: "#111827" }}>
                      {exp.jobTitle}
                    </h3>
                    {exp.company && (
                      <span style={{ color: accentColor, fontWeight: 600, fontSize: `${fontSize}pt` }}>
                        <span aria-hidden="true">— </span>{exp.company}
                      </span>
                    )}
                    {isPromotedFromBelow && (
                      <span
                        style={{
                          fontSize: `${Math.max(fontSize - 2.1, 8.5)}pt`,
                          fontWeight: 600,
                          color: accentColor,
                          backgroundColor: accentTint(accentColor, 0.05),
                          border: `0.75px solid ${accentTint(accentColor, 0.25)}`,
                          padding: "0.5px 5px",
                          borderRadius: "3px",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {labels.promoted}
                      </span>
                    )}
                  </div>
                  <div
                    style={{
                      gridColumn: 1,
                      gridRow: 1,
                      minWidth: 0,
                      fontSize: `${Math.max(fontSize - 0.9, 8.8)}pt`,
                      color: "#374151",
                      lineHeight: 1.32,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>{renderLocalizedDateRange(exp.dates, lang)}</div>
                    {exp.location && <div style={{ color: "#6b7280" }}>{renderLocalizedLocation(exp.location, lang)}</div>}
                  </div>
                </div>

                {exp.summary && (
                  <p
                    data-layout-item
                    style={{
                      margin: "1.5px 0 2.5px 0",
                      paddingLeft: `${CONTENT_OFFSET_PX}px`,
                      fontStyle: "italic",
                      fontSize: `${Math.max(fontSize - 0.7, 9)}pt`,
                      color: "#4b5563",
                    }}
                  >
                    {renderRichText(exp.summary, false)}
                  </p>
                )}

                {exp.bullets.length > 0 && (
                  <ul style={{ margin: "2px 0 0 0", paddingLeft: `${CONTENT_OFFSET_PX + 14}px` }}>
                    {exp.bullets.map((bullet, bIdx) => (
                      <li
                        key={bIdx}
                        data-layout-item
                        style={{
                          marginBottom: "3px",
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
            );
          })}
        </div>
      )}

      {/* Selected Projects */}
      {cleanProjects.length > 0 && (
        <div data-layout-section="projects" style={{ minWidth: 0, marginBottom: `${sectionSpacing}px` }}>
          {renderSectionTitle(labels.projects)}
          {cleanProjects.map((proj, idx) => {
            const { cleanTitle, cleanRole, hasParensInTitle } = formatProjectTitleAndRole(
              proj.title,
              proj.role
            );
            return (
              <div
                key={proj.id || idx}
                data-layout-entry
                className="project-entry break-avoid"
                style={{ minWidth: 0, marginBottom: "8px" }}
              >
                <div
                  data-entry-heading
                  style={{
                    minWidth: 0,
                    display: "grid",
                    gridTemplateColumns: `${RAIL_WIDTH_PX}px minmax(0, 1fr)`,
                    columnGap: `${RAIL_GAP_PX}px`,
                    alignItems: "baseline",
                    marginBottom: "1.5px",
                  }}
                >
                  <div style={{ gridColumn: 2, gridRow: 1, minWidth: 0, display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: "2px 6px" }}>
                    <h3 style={{ margin: 0, fontSize: `${fontSize}pt`, fontWeight: 700, color: "#111827" }}>
                      {cleanTitle}
                    </h3>
                    {cleanRole && (
                      <span style={{ color: accentColor, fontWeight: 600, fontSize: `${fontSize}pt` }}>
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
                  <div
                    style={{
                      gridColumn: 1,
                      gridRow: 1,
                      fontSize: `${Math.max(fontSize - 0.9, 8.8)}pt`,
                      fontWeight: 600,
                      color: "#374151",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {proj.dates ? renderLocalizedDateRange(proj.dates, lang) : ""}
                  </div>
                </div>

                {proj.description && proj.description.trim() && (
                  <p
                    data-layout-item
                    style={{
                      margin: "1.5px 0 2px 0",
                      paddingLeft: `${CONTENT_OFFSET_PX}px`,
                      fontSize: `${Math.max(fontSize - 0.7, 9)}pt`,
                      lineHeight: 1.35,
                      color: "#374151",
                    }}
                  >
                    {renderRichText(proj.description, false)}
                  </p>
                )}

                {proj.bullets && proj.bullets.length > 0 && (
                  <ul style={{ margin: "2px 0 0 0", paddingLeft: `${CONTENT_OFFSET_PX + 14}px` }}>
                    {proj.bullets.map((bullet, bIdx) => (
                      <li
                        key={bIdx}
                        data-layout-item
                        style={{
                          marginBottom: "2.8px",
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
            );
          })}
        </div>
      )}

      {/* Education (Tabular aligned along 140px axis) */}
      {cv.education && cv.education.length > 0 && (
        <div data-layout-section="education" style={{ minWidth: 0, marginBottom: cv.certifications?.length ? `${sectionSpacing}px` : 0 }}>
          {renderSectionTitle(labels.education)}
          {cv.education.map((edu, idx) => (
            <div
              key={edu.id || idx}
              data-continuation-label={[edu.degree, edu.institution].filter(Boolean).join(" — ")}
              data-layout-entry
              className="break-avoid"
              style={{ minWidth: 0, marginBottom: "6px" }}
            >
              <div
                data-entry-heading
                style={{
                  minWidth: 0,
                  display: "grid",
                  gridTemplateColumns: `${RAIL_WIDTH_PX}px minmax(0, 1fr)`,
                  columnGap: `${RAIL_GAP_PX}px`,
                  alignItems: "baseline",
                }}
              >
                <div style={{ gridColumn: 2, gridRow: 1, minWidth: 0 }}>
                  <h3 style={{ margin: 0, fontSize: `${fontSize}pt`, fontWeight: 700, color: "#111827" }}>{edu.degree}</h3>
                  <div style={{ color: accentColor, fontWeight: 600, fontSize: `${Math.max(fontSize - 0.7, 9)}pt` }}>{edu.institution}</div>
                </div>
                <div
                  style={{
                    gridColumn: 1,
                    gridRow: 1,
                    minWidth: 0,
                    fontSize: `${Math.max(fontSize - 0.9, 8.8)}pt`,
                    fontWeight: 600,
                    color: "#374151",
                    fontVariantNumeric: "tabular-nums",
                    whiteSpace: edu.period && edu.period.length <= 20 ? "nowrap" : "normal",
                  }}
                >
                  {edu.period}
                </div>
              </div>
              {edu.description && (
                <div
                  data-layout-item
                  style={{
                    paddingLeft: `${CONTENT_OFFSET_PX}px`,
                    fontSize: `${Math.max(fontSize - 0.9, 9)}pt`,
                    color: "#4b5563",
                    marginTop: "1.5px",
                    lineHeight: 1.33,
                  }}
                >
                  {renderRichText(edu.description, false)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Certifications (Tabular aligned along 140px axis) */}
      {cv.certifications && cv.certifications.length > 0 && (
        <div data-layout-section="certifications" style={{ minWidth: 0 }}>
          {renderSectionTitle(labels.certifications)}
          <div style={{ display: "flex", flexDirection: "column", gap: "3.5px" }}>
            {cv.certifications.map((cert, idx) => (
              <div
                key={cert.id || idx}
                data-layout-entry
                className="break-avoid"
                style={{
                  minWidth: 0,
                  display: "grid",
                  gridTemplateColumns: `${RAIL_WIDTH_PX}px minmax(0, 1fr)`,
                  columnGap: `${RAIL_GAP_PX}px`,
                  alignItems: "baseline",
                  fontSize: `${Math.max(fontSize - 0.5, 9)}pt`,
                  lineHeight: 1.33,
                }}
              >
                <div style={{ gridColumn: 2, gridRow: 1, minWidth: 0 }}>
                  <span style={{ color: "#111827", fontWeight: 600 }}>{renderLocalizedCertificationName(cert.name, lang)}</span>
                  {(cert.authority || cert.credentialId) && (
                    <span style={{ color: "#4b5563", fontSize: `${Math.max(fontSize - 0.9, 9)}pt` }}>
                      {cert.authority ? ` — ${cert.authority}` : ""}
                      {cert.credentialId ? ` · ID: ${cert.credentialId}` : ""}
                    </span>
                  )}
                </div>
                <div
                  style={{
                    gridColumn: 1,
                    gridRow: 1,
                    color: "#374151",
                    fontWeight: 600,
                    fontSize: `${Math.max(fontSize - 0.9, 8.8)}pt`,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {cert.date || ""}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
