import React from "react";
import { type TemplateProps } from "./types";
import { getEffectiveLanguage, SECTION_LABELS, getCoverLetterMeta, renderLocalizedLocation } from "./templateUtils";
import { DOCUMENT_LAYOUT, accentTint, documentAccent, documentFontSize, documentLinkText, resolveDocumentFontStack } from "@/lib/documentDesign";
import { renderRichText } from "./RichText";

// -------------------------------------------------------------
// 4. EXECUTIVE LIGHT SIDEBAR COVER LETTER TEMPLATE
// -------------------------------------------------------------
export const EditorialSidebarLetter: React.FC<TemplateProps> = ({ data, signatureBase64 }) => {
  const letter = data.coverLetterContent;
  const cv = data.cvContent;
  const lang = getEffectiveLanguage(data);
  const labels = SECTION_LABELS[lang];

  const accentColor = documentAccent(data.templateSettings?.accentColor);
  const layout = DOCUMENT_LAYOUT.sidebarLetter;
  const { bodyFont, headingFont } = resolveDocumentFontStack(data.templateSettings?.fontFamily);
  const showSignature = data.assetSettings?.signature?.enabled;
  const signatureUrl = signatureBase64 || data.assetSettings?.signature?.filePath;
  const signatureWidth = data.assetSettings?.signature?.widthPx || 160;
  const signatureAlignment = data.assetSettings?.signature?.alignment || "left";

  const fontSize = documentFontSize(data.templateSettings?.letterFontSize ?? data.templateSettings?.fontSize, "letter");
  const lineSpacing = data.templateSettings?.letterLineSpacing ?? 1.4;
  const paragraphSpacing = data.templateSettings?.letterParagraphSpacing ?? 10;

  const {
    targetRole,
    targetCompany,
    targetLocation,
    recipientDept,
    closingText,
    computedSubject,
    normalizedGreeting,
    valueHook,
    hasAttachments,
  } = getCoverLetterMeta(data, lang);
  const localizedHeaderLocation = renderLocalizedLocation(cv.header.location, lang);

  const effectiveBodyLineHeight = Math.max(lineSpacing, 1.4);
  const effectiveParagraphGap = Math.min(Math.max(paragraphSpacing, 10), 16);
  const contactStyle: React.CSSProperties = { minWidth: 0, maxWidth: "100%", overflowWrap: "anywhere" };
  const contacts: React.ReactNode[] = [];
  if (localizedHeaderLocation.trim()) contacts.push(<span key="location" style={contactStyle}>{localizedHeaderLocation}</span>);
  if (cv.header.email.trim()) contacts.push(<a key="email" href={`mailto:${cv.header.email}`} style={{ ...contactStyle, color: "#374151", textDecoration: "none" }}>{cv.header.email}</a>);
  if (cv.header.phone.trim()) contacts.push(<span key="phone" style={contactStyle}>{cv.header.phone}</span>);
  (cv.header.links || []).filter((link) => link.url.trim()).forEach((link, index) => contacts.push(
    <a key={`link-${index}`} href={link.url} target="_blank" rel="noopener noreferrer" style={{ ...contactStyle, color: accentColor, textDecoration: "none", fontWeight: 600 }}>{documentLinkText(link.url, link.label)}</a>
  ));
  const languages = (cv.header.languages || []).filter((entry) => entry.language.trim()).map((entry) => `${entry.language} (${entry.level})`).join(", ");
  if (languages) contacts.push(<span key="languages" style={contactStyle}>{languages}</span>);
  if (cv.header.availability.trim()) contacts.push(<span key="availability" style={contactStyle}><strong>{labels.availability}:</strong> {cv.header.availability}</span>);

  const monogramInitials =
    (cv.header.fullName || "")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 3)
      .map((w) => w[0]?.toUpperCase() || "")
      .join("") || "CV";

  return (
    <div
      id="letter-template-sidebar"
      className="letter-page"
      lang={lang === "German" ? "de" : lang === "Spanish" ? "es" : "en"}
      style={{
        boxSizing: "border-box",
        width: "210mm",
        minHeight: "297mm",
        display: "grid",
        gridTemplateColumns: `${layout.sidebar}mm minmax(0, 1fr)`,
        gridTemplateAreas: '"sidebar content"',
        backgroundColor: "#ffffff",
        color: "#1f2937",
        fontSize: `${fontSize}pt`,
        lineHeight: effectiveBodyLineHeight,
        fontFamily: bodyFont,
        margin: "0 auto",
        boxShadow: "none",
        position: "relative",
        fontVariantLigatures: "none",
        fontFeatureSettings: '"liga" 0, "clig" 0',
        fontVariantNumeric: "tabular-nums",
        fontKerning: "normal",
      }}
    >
      {/* 1. RIGHT MAIN CONTENT AREA FIRST IN DOM FOR LINEAR ATS EXTRACTION */}
      <div
        className="letter-content"
        style={{
          gridArea: "content",
          padding: `${layout.top}mm ${layout.right}mm ${layout.bottom}mm ${layout.left - layout.sidebar}mm`,
          minWidth: 0,
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header and contacts remain a single accessible layout block. */}
        <div data-layout-block="header" style={{ overflowWrap: "anywhere" }}>
          <h1
            className="header-name"
            style={{
              fontFamily: headingFont,
              fontSize: "20pt", lineHeight: 1.18,
              fontWeight: 700,
              letterSpacing: "-0.25px",
              color: accentColor,
              margin: "0 0 3px 0",
            }}
          >
            {cv.header.fullName}
          </h1>
          <div
            className="positioning-line"
            style={{
              fontSize: "10.5pt",
              fontWeight: 600,
              color: "#374151",
              margin: "0 0 5px 0",
              textWrap: "balance",
            }}
          >
            {letter.positioningLine}
          </div>
          {contacts.length > 0 && <div className="meta-line" style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: "3px 8px", marginBottom: "6px", fontSize: "9.5pt", lineHeight: 1.4, color: "#4b5563" }}>
            {contacts.map((contact, index) => <React.Fragment key={index}>{index > 0 && <span aria-hidden="true" style={{ color: "#6b7280" }}>·</span>}{contact}</React.Fragment>)}
          </div>}
          <div
            className="header-divider"
            style={{
              height: "1px",
              backgroundColor: "#cbd5e1",
              marginBottom: "3.5mm",
            }}
          />
        </div>

        {/* Recipient and date remain a single layout block. */}
        <div
          data-layout-block="recipient"
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: "10px",
            gap: "12px",
          }}
        >
          {targetCompany ? (
            <div style={{ flex: "1 1 60mm", minWidth: 0, fontSize: "9.5pt", lineHeight: 1.4, color: "#4b5563", overflowWrap: "anywhere" }}>
              <div style={{ fontWeight: 700, color: "#111827", fontSize: "10.5pt" }}>{targetCompany}</div>
              <div>{recipientDept}</div>
              {targetLocation && <div style={{ color: "#6b7280", fontSize: "9.5pt" }}>{renderLocalizedLocation(targetLocation, lang)}</div>}
            </div>
          ) : (
            <div />
          )}
          <div style={{ maxWidth: "100%", marginLeft: "auto", fontSize: "9.5pt", color: "#4b5563", textAlign: "right", overflowWrap: "anywhere" }}>
            {letter.dateLine}
          </div>
        </div>

        {/* DIN 5008 Executive Subject Line (Betreffzeile) + Strategic Value Hook */}
        {targetRole && (
          <div
            data-layout-block="subject"
            data-keep-with-next="true"
            style={{
              marginBottom: "12px",
              overflowWrap: "anywhere",
              paddingLeft: "8px",
              borderLeft: `2.5px solid ${accentColor}`,
            }}
          >
            <h2
              style={{
                margin: 0,
                fontSize: "11.5pt",
                fontWeight: 700,
                color: accentColor,
                letterSpacing: "-0.1px",
              }}
            >
              {computedSubject}
            </h2>
            {valueHook && valueHook !== letter.positioningLine && (
              <div
                style={{
                  fontSize: "10pt",
                  fontWeight: 600,
                  color: "#4b5563",
                  marginTop: "1.5px",
                }}
              >
                {valueHook}
              </div>
            )}
          </div>
        )}

        {/* Greeting */}
        <p data-layout-block="greeting" data-keep-with-next="true" style={{ margin: "0 0 12px 0", fontWeight: 700, color: "#111827" }}>
          {normalizedGreeting}
        </p>

        {/* Body Text */}
        <div
          className="letter-body"
          style={{
            fontSize: `${fontSize}pt`,
            lineHeight: effectiveBodyLineHeight,
            color: "#1f2937",
            textAlign: "left",
          }}
        >
          {letter.paragraphs.map((p, idx) => (
            <p
              key={idx}
              data-layout-item="paragraph"
              style={{
                margin: `0 0 ${effectiveParagraphGap}px 0`,
                textWrap: "pretty",
                overflowWrap: "anywhere",
              }}
            >
              {renderRichText(p.text, true, 1)}
            </p>
          ))}
        </div>

        {/* Executive Signature Block (No form line when signature image is stamped) */}
        <div
          className="signature-block break-avoid"
          data-layout-block="signature"
          style={{
            marginTop: "8px",
            pageBreakInside: "avoid",
            breakInside: "avoid",
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
          <div style={{ marginBottom: "6px", fontSize: `${fontSize}pt`, color: "#1f2937" }}>{closingText}</div>

          {showSignature && signatureUrl ? (
            <div style={{ margin: "2px 0 4px 0" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={signatureUrl}
                alt=""
                aria-hidden="true"
                className="signature-image"
                style={{
                  width: `${signatureWidth}px`,
                  height: "auto",
                  maxHeight: "40px",
                  maxWidth: "100%",
                  objectFit: "contain",
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
              fontSize: `${fontSize}pt`,
              color: "#111827",
              fontWeight: 700,
            }}
          >
            {letter.signatureName}
          </div>
          {hasAttachments && (
            <div style={{ fontSize: "9pt", color: "#4b5563", marginTop: "8px" }}>
              {labels.attachments}
            </div>
          )}
        </div>
      </div>

      {/* Subtle architectural sidebar rail following the full letter in reading order. */}
      <div
        className="sidebar"
        aria-hidden="true"
        style={{
          gridArea: "sidebar",
          backgroundColor: accentTint(accentColor, 0.05),
          borderLeft: `3px solid ${accentColor}`,
          borderRight: `1px solid ${accentTint(accentColor, 0.16)}`,
          color: accentColor,
          minHeight: "297mm",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <div className="monogram" style={{ fontFamily: headingFont, width: "10.5mm", height: "10.5mm", margin: "15mm auto 0", display: "flex", alignItems: "center", justifyContent: "center", border: `1.2px solid ${accentTint(accentColor, 0.45)}`, borderRadius: "50%", fontSize: "8pt", fontWeight: 700, letterSpacing: "0.6px", color: accentColor, backgroundColor: "#ffffff" }}>
          {monogramInitials}
        </div>
        {(letter.sidebarLabel || letter.sidebarRole || letter.sidebarCompany) && (
          <div
            style={{
              marginTop: "10mm",
              maxHeight: "220mm",
              overflow: "hidden",
              writingMode: "vertical-rl",
              transform: "rotate(180deg)",
              fontSize: "8pt",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: accentTint(accentColor, 0.72),
              fontWeight: 600,
              whiteSpace: "nowrap",
            }}
          >
            {[
              letter.sidebarLabel || (lang === "German" ? "ANSCHREIBEN" : lang === "Spanish" ? "CARTA DE PRESENTACIÓN" : "COVER LETTER"),
              letter.sidebarRole,
              letter.sidebarCompany,
            ].filter(Boolean).join(" · ")}
          </div>
        )}
      </div>

    </div>
  );
};
