import React from "react";
import { type TemplateProps } from "./types";
import { getEffectiveLanguage, SECTION_LABELS, getCoverLetterMeta, renderLocalizedLocation } from "./templateUtils";
import { renderRichText } from "./RichText";
import { DOCUMENT_LAYOUT, accentTint, documentAccent, documentFontSize, documentLinkText, resolveDocumentFontStack } from "@/lib/documentDesign";

// -------------------------------------------------------------
// 3. ATS LETTER TEMPLATE (EXECUTIVE STANDARD)
// -------------------------------------------------------------
export const AtsLetter: React.FC<TemplateProps> = ({ data, signatureBase64 }) => {
  const letter = data.coverLetterContent;
  const cv = data.cvContent;
  const lang = getEffectiveLanguage(data);
  const labels = SECTION_LABELS[lang];

  const { bodyFont, headingFont } = resolveDocumentFontStack(data.templateSettings?.fontFamily);
  const fontSize = documentFontSize(data.templateSettings?.letterFontSize ?? data.templateSettings?.fontSize, "letter");
  const accentColor = documentAccent(data.templateSettings?.accentColor);
  const layout = DOCUMENT_LAYOUT.letter;
  const lineSpacing = data.templateSettings?.letterLineSpacing ?? 1.4;
  const paragraphSpacing = data.templateSettings?.letterParagraphSpacing ?? 10;

  const showSignature = data.assetSettings?.signature?.enabled;
  const signatureUrl = signatureBase64 || data.assetSettings?.signature?.filePath;
  const signatureWidth = data.assetSettings?.signature?.widthPx || 160;
  const signatureAlignment = data.assetSettings?.signature?.alignment || "left";

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

  const effectiveLineHeight = Math.max(lineSpacing, 1.4);
  const effectiveParagraphGap = Math.min(Math.max(paragraphSpacing, 10), 16);
  const contactStyle: React.CSSProperties = { minWidth: 0, maxWidth: "100%", overflowWrap: "anywhere" };
  const contacts: React.ReactNode[] = [];
  if (localizedHeaderLocation.trim()) contacts.push(<span key="location" style={contactStyle}>{localizedHeaderLocation}</span>);
  if (cv.header.email.trim()) contacts.push(<a key="email" href={`mailto:${cv.header.email}`} style={{ ...contactStyle, color: "#374151", textDecoration: "none" }}>{cv.header.email}</a>);
  if (cv.header.phone.trim()) contacts.push(<span key="phone" style={contactStyle}>{cv.header.phone}</span>);
  (cv.header.links || []).filter((link) => link.url.trim()).forEach((link, index) => contacts.push(
    <a key={`link-${index}`} href={link.url} style={{ ...contactStyle, color: accentColor, textDecoration: "none", fontWeight: 600 }}>{documentLinkText(link.url, link.label)}</a>
  ));
  if (cv.header.availability.trim()) contacts.push(<span key="availability" style={contactStyle}><strong>{labels.availability}:</strong> {cv.header.availability}</span>);

  return (
    <div
      id="letter-template-ats"
      className="letter-content"
      lang={lang === "German" ? "de" : lang === "Spanish" ? "es" : "en"}
      style={{
        boxSizing: "border-box",
        width: "210mm",
        minHeight: "297mm",
        padding: `${layout.top}mm ${layout.right}mm ${layout.bottom}mm ${layout.left}mm`,
        backgroundColor: "#ffffff",
        color: "#111827",
        fontFamily: bodyFont,
        fontSize: `${fontSize}pt`,
        lineHeight: effectiveLineHeight,
        margin: "0 auto",
        position: "relative",
        fontVariantLigatures: "none",
        fontFeatureSettings: '"liga" 0, "clig" 0',
        fontVariantNumeric: "tabular-nums",
        fontKerning: "normal",
      }}
    >
      {/* Header with Complete Contact Information & Clickable Portfolio Links */}
      <div data-layout-block="header" style={{ marginBottom: "14px", borderBottom: `1px solid ${accentTint(accentColor, 0.25)}`, paddingBottom: "10px", overflowWrap: "anywhere" }}>
        <h1 style={{ fontFamily: headingFont, fontSize: "19pt", lineHeight: 1.18, fontWeight: 700, margin: "0 0 3px 0", color: "#111827", letterSpacing: "-0.25px" }}>
          {cv.header.fullName}
        </h1>
        <div
          style={{
            fontSize: "10.5pt",
            color: "#374151",
            fontWeight: 600,
            marginBottom: "4px",
            textWrap: "balance",
          }}
        >
          {letter.positioningLine}
        </div>
        {contacts.length > 0 && <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: "3px 8px", fontSize: "9.5pt", color: "#4b5563", lineHeight: 1.4 }}>
          {contacts.map((contact, index) => <React.Fragment key={index}>{index > 0 && <span aria-hidden="true" style={{ color: "#6b7280" }}>·</span>}{contact}</React.Fragment>)}
        </div>}
      </div>

      {/* Recipient and date remain one layout unit. */}
      <div
        data-layout-block="recipient"
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: "14px",
          gap: "16px",
        }}
      >
        {targetCompany ? (
          <div style={{ flex: "1 1 60mm", minWidth: 0, fontSize: "9.5pt", lineHeight: 1.4, color: "#374151", overflowWrap: "anywhere" }}>
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
        <div data-layout-block="subject" data-keep-with-next="true" style={{ marginBottom: "12px", overflowWrap: "anywhere" }}>
          <h2
            style={{
              margin: 0,
              fontSize: "11.5pt",
              fontWeight: 700,
              color: "#111827",
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
                marginTop: "2px",
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

      {/* Letter Body */}
      <div className="letter-body" style={{ textAlign: "left" }}>
        {letter.paragraphs.map((p, idx) => (
          <p
            key={idx}
            data-layout-item="paragraph"
            style={{
              margin: `0 0 ${effectiveParagraphGap}px 0`,
              color: "#1f2937",
              textWrap: "pretty",
              overflowWrap: "anywhere",
            }}
          >
            {renderRichText(p.text, true, 1)}
          </p>
        ))}
      </div>

      {/* Sign-off with Signature Image Support */}
      <div
        className="signature-block break-avoid"
        data-layout-block="signature"
        style={{
          marginTop: "8px",
          breakInside: "avoid",
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
        <div style={{ marginBottom: showSignature && signatureUrl ? "8px" : "24px" }}>{closingText}</div>
        {showSignature && signatureUrl && (
          <div style={{ marginBottom: "6px" }}>
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
        )}
        <div style={{ fontWeight: 700, color: "#111827" }}>{letter.signatureName}</div>
        {hasAttachments && (
          <div style={{ fontSize: "9pt", color: "#4b5563", marginTop: "8px" }}>
            {labels.attachments}
          </div>
        )}
      </div>

    </div>
  );
};
