import React from "react";

// -------------------------------------------------------------
// INLINE VECTOR ICONS (OUTSIDE PDF TEXT LAYER — 100% ATS-INVISIBLE)
// -------------------------------------------------------------
export const IconPin: React.FC<{ color?: string }> = ({ color = "#6b7280" }) => (
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

export const IconMail: React.FC<{ color?: string }> = ({ color = "#6b7280" }) => (
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

export const IconPhone: React.FC<{ color?: string }> = ({ color = "#6b7280" }) => (
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

export const IconGlobe: React.FC<{ color?: string }> = ({ color = "#6b7280" }) => (
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

export const IconCalendar: React.FC<{ color?: string }> = ({ color = "#6b7280" }) => (
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

export const PageBreakGuides: React.FC<PageBreakGuidesProps> = ({
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
export const DEFAULT_PHOTO_WIDTH_PX = 116;

export function getExecutivePortraitStyle(
  cropStyle: string | undefined,
  accentColor: string,
  variant: "ats" | "modern" = "modern",
  widthPx?: number
): { container: React.CSSProperties; image: React.CSSProperties } {
  const mode = cropStyle || "portrait-rectangle";
  const isCircle = mode === "circle";
  const isSquircle = mode === "rounded-square";

  const clampedWidth = Math.round(Math.min(200, Math.max(64, Number(widthPx) || DEFAULT_PHOTO_WIDTH_PX)));
  const computedHeight = isCircle || isSquircle ? clampedWidth : Math.round((clampedWidth * 4) / 3);
  const framePadding = clampedWidth >= 132 ? 3.5 : 3;

  const innerRadiusPx = isSquircle
    ? Math.round(Math.max(8, clampedWidth * 0.11))
    : Math.round(Math.max(3, clampedWidth * 0.045));
  const outerRadius = isCircle ? "50%" : `${innerRadiusPx + framePadding}px`;
  const innerRadius = isCircle ? "50%" : `${innerRadiusPx}px`;

  const isModern = variant === "modern";

  return {
    container: {
      display: "inline-block",
      padding: `${framePadding}px`,
      backgroundColor: "#ffffff",
      border: isModern && isCircle ? `1.5px solid ${accentColor}` : "1px solid #cbd5e1",
      ...(isModern && !isCircle ? { borderTop: `2.5px solid ${accentColor}` } : {}),
      borderRadius: outerRadius,
      boxShadow: isModern
        ? "0 2px 6px rgba(15, 23, 42, 0.08)"
        : "0 1px 2px rgba(15, 23, 42, 0.05)",
      flexShrink: 0,
      alignSelf: "center",
    },
    image: {
      width: `${clampedWidth}px`,
      height: `${computedHeight}px`,
      borderRadius: innerRadius,
      objectFit: "cover" as const,
      objectPosition: isCircle || isSquircle ? "center 18%" : "center 14%",
      display: "block",
    },
  };
}

/** Shared education institution + unbroken period row to prevent mid-range wraps like "2013 –\n2017". */
export const EducationMetaRow: React.FC<{
  institution: string;
  period?: string;
  accentColor: string;
  fontSize: number;
}> = ({ institution, period, accentColor, fontSize }) => (
  <div
    style={{
      minWidth: 0,
      display: "flex",
      flexWrap: "wrap",
      justifyContent: "space-between",
      alignItems: "baseline",
      columnGap: "8px",
      rowGap: "1px",
      color: accentColor,
      fontWeight: 600,
      fontSize: `${Math.max(fontSize - 0.7, 9)}pt`,
    }}
  >
    <span>{institution}</span>
    {period && (
      <span
        style={{
          minWidth: 0,
          color: "#4b5563",
          fontWeight: 400,
          fontVariantNumeric: "tabular-nums",
          whiteSpace: period.length <= 20 ? "nowrap" : undefined,
        }}
      >
        {period}
      </span>
    )}
  </div>
);
