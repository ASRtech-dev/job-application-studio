import React from "react";
import { type TemplateProps } from "./types";
import { getEffectiveLanguage, SECTION_LABELS, getCoverLetterMeta, getWorkAuthorizationBadge, renderLocalizedLocation } from "./templateUtils";
import { renderRichText } from "./RichText";
import { DOCUMENT_LAYOUT, accentTint, documentAccent, documentFontSize, documentLinkText, resolveDocumentFontStack } from "@/lib/documentDesign";

// -----------------------------------------------------------------------------
// 6. DIN 5008 FORM B EXECUTIVE EDITORIAL LETTER (GERMAN ARCHITECTURAL STANDARD)
// -----------------------------------------------------------------------------
export const DinEditorialLetter: React.FC<TemplateProps> = ({ data, signatureBase64 }) => {
  const letter = data.coverLetterContent;
  const cv = data.cvContent;
  const lang = getEffectiveLanguage(data);
  const labels = SECTION_LABELS[lang];

  const { bodyFont, headingFont } = resolveDocumentFontStack(data.templateSettings?.fontFamily);
  const fontSize = documentFontSize(data.templateSettings?.letterFontSize ?? data.templateSettings?.fontSize, "letter");
  const accentColor = documentAccent(data.templateSettings?.accentColor);
  const layout = DOCUMENT_LAYOUT.dinLetter;
  const effectiveLineHeight = Math.max(data.templateSettings?.letterLineSpacing ?? 1.42, 1.4);
  const effectiveParagraphGap = Math.min(Math.max(data.templateSettings?.letterParagraphSpacing ?? 11, 10), 16);

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
  const workAuthBadge = getWorkAuthorizationBadge(
    data.formFieldAnswers?.workAuthorization || data.formFieldAnswers?.workPermitGermany,
    lang
  );
  const metaHeadingDate = lang === "German" ? "Datum" : lang === "Spanish" ? "Fecha" : "Date";
  const metaHeadingPermit = lang === "German" ? "Status" : lang === "Spanish" ? "Permiso" : "Status";

  return (
    <div
      id="letter-template-din"
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
      {/* Top Executive Letterhead (Briefkopf) */}
      <div
        data-layout-block="header"
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) 245px",
          alignItems: "end",
          gap: "10px 18px",
          paddingBottom: "8px",
          marginBottom: "14px",
          borderBottom: `1.5px solid ${accentColor}`,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <h1
            style={{
              fontFamily: headingFont,
              fontSize: "19pt",
              lineHeight: 1.15,
              fontWeight: 700,
              margin: "0 0 2.5px 0",
              color: "#111827",
              letterSpacing: "-0.3px",
            }}
          >
            {cv.header.fullName}
          </h1>
          <div style={{ fontSize: "9.5pt", fontWeight: 600, color: accentColor, textWrap: "balance", lineHeight: 1.32 }}>
            {letter.positioningLine}
          </div>
        </div>

        <div
          style={{
            minWidth: 0,
            textAlign: "right",
            fontSize: "8.4pt",
            lineHeight: 1.38,
            color: "#374151",
          }}
        >
          {localizedHeaderLocation && <div>{localizedHeaderLocation}</div>}
          {cv.header.email && (
            <div>
              <a href={`mailto:${cv.header.email}`} style={{ color: "#111827", textDecoration: "none", fontWeight: 500 }}>
                {cv.header.email}
              </a>
            </div>
          )}
          {cv.header.phone && <div>{cv.header.phone}</div>}
          {(cv.header.links || []).length > 0 && (
            <div style={{ overflowWrap: "anywhere" }}>
              {(cv.header.links || [])
                .filter((link) => link.url.trim())
                .map((link, idx) => (
                  <React.Fragment key={idx}>
                    {idx > 0 && <span aria-hidden="true" style={{ color: "#9ca3af" }}> · </span>}
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
          )}
        </div>
      </div>

      {/* DIN 5008 Form B Recipient Zone (Anschriftfeld) & Metadata Block (Bezugszeichenzeile) */}
      <div
        data-layout-block="recipient"
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.05fr) minmax(0, 0.95fr)",
          gap: "20px",
          alignItems: "start",
          marginBottom: "14px",
        }}
      >
        <div style={{ minWidth: 0, overflowWrap: "anywhere" }}>
          <div
            style={{
              fontSize: "7.5pt",
              color: "#6b7280",
              borderBottom: `0.5px solid ${accentTint(accentColor, 0.28)}`,
              paddingBottom: "2px",
              marginBottom: "5px",
              display: "inline-block",
            }}
          >
            {[cv.header.fullName, localizedHeaderLocation].filter(Boolean).join(" · ")}
          </div>
          {targetCompany && (
            <div style={{ fontSize: "10pt", lineHeight: 1.42, color: "#1f2937" }}>
              <div style={{ fontWeight: 700, color: "#111827", fontSize: "10.5pt" }}>{targetCompany}</div>
              <div>{recipientDept}</div>
              {targetLocation && <div style={{ color: "#4b5563" }}>{renderLocalizedLocation(targetLocation, lang)}</div>}
            </div>
          )}
        </div>

        <div
          style={{
            minWidth: 0,
            fontSize: "8.8pt",
            lineHeight: 1.45,
            color: "#374151",
            borderLeft: `1px solid ${accentTint(accentColor, 0.2)}`,
            paddingLeft: "12px",
          }}
        >
          {letter.dateLine && (
            <div>
              <span style={{ color: "#6b7280", textTransform: "uppercase", fontSize: "7.5pt", letterSpacing: "0.06em" }}>
                {metaHeadingDate}:{" "}
              </span>
              <span style={{ fontWeight: 600, color: "#111827" }}>{letter.dateLine}</span>
            </div>
          )}
          {cv.header.availability.trim() && (
            <div>
              <span style={{ color: "#6b7280", textTransform: "uppercase", fontSize: "7.5pt", letterSpacing: "0.06em" }}>
                {labels.availability}:{" "}
              </span>
              <span style={{ fontWeight: 600, color: "#111827" }}>{cv.header.availability}</span>
            </div>
          )}
          {workAuthBadge && (
            <div>
              <span style={{ color: "#6b7280", textTransform: "uppercase", fontSize: "7.5pt", letterSpacing: "0.06em" }}>
                {metaHeadingPermit}:{" "}
              </span>
              <span>{workAuthBadge}</span>
            </div>
          )}
        </div>
      </div>

      {/* Betreff / Subject */}
      {targetRole && (
        <div data-layout-block="subject" data-keep-with-next="true" style={{ marginBottom: "14px", overflowWrap: "anywhere" }}>
          <h2
            style={{
              margin: 0,
              fontFamily: headingFont,
              fontSize: "11.5pt",
              fontWeight: 700,
              color: accentColor,
              letterSpacing: "-0.1px",
            }}
          >
            {computedSubject}
          </h2>
          {valueHook && valueHook !== letter.positioningLine && (
            <div style={{ fontSize: "9.8pt", fontWeight: 600, color: "#4b5563", marginTop: "2px" }}>
              {valueHook}
            </div>
          )}
        </div>
      )}

      {/* Greeting */}
      <p data-layout-block="greeting" data-keep-with-next="true" style={{ margin: "0 0 12px 0", fontWeight: 700, color: "#111827" }}>
        {normalizedGreeting}
      </p>

      {/* Body Paragraphs */}
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

      {/* Signature & Enclosures */}
      <div
        className="signature-block break-avoid"
        data-layout-block="signature"
        style={{
          marginTop: "10px",
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
          <div style={{ fontSize: "9pt", color: "#4b5563", marginTop: "9px" }}>
            {labels.attachments}
          </div>
        )}
      </div>
    </div>
  );
};
