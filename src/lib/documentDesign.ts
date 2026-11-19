/** Shared screen/print design policy. Does not change any stored document facts. */
export const DOCUMENT_LAYOUT = {
  cv: { top: 15, right: 16, bottom: 18, left: 16, sidebar: 0 },
  letter: { top: 18, right: 20, bottom: 18, left: 20, sidebar: 0 },
  sidebarLetter: { top: 15, right: 18, bottom: 18, left: 32, sidebar: 18 },
  dinLetter: { top: 16, right: 20, bottom: 18, left: 24, sidebar: 0 },
} as const;

export const DOCUMENT_FONT_PRESETS = [
  {
    id: "IBM Plex Sans",
    label: "IBM Plex Sans · Executive Clean (Recommended)",
    body: "'IBM Plex Sans', Arial, sans-serif",
    heading: "'IBM Plex Sans', Arial, sans-serif",
  },
  {
    id: "IBM Plex Editorial",
    label: "IBM Plex Editorial · Serif Headings + Sans Body",
    body: "'IBM Plex Sans', Arial, sans-serif",
    heading: "'IBM Plex Serif', Georgia, serif",
  },
  {
    id: "Plus Jakarta Sans",
    label: "Plus Jakarta Sans · Modern Product / Tech",
    body: "'Plus Jakarta Sans', 'IBM Plex Sans', Arial, sans-serif",
    heading: "'Plus Jakarta Sans', 'IBM Plex Sans', Arial, sans-serif",
  },
  {
    id: "IBM Plex Serif",
    label: "IBM Plex Serif · Consulting & Leadership",
    body: "'IBM Plex Serif', Georgia, serif",
    heading: "'IBM Plex Serif', Georgia, serif",
  },
  {
    id: "Inter",
    label: "Inter · Classic Neutral",
    body: "'Inter', Arial, Helvetica, sans-serif",
    heading: "'Inter', Arial, Helvetica, sans-serif",
  },
] as const;

export const EXECUTIVE_ACCENT_SWATCHES = [
  { label: "Prussian Blue", value: "#10233f" },
  { label: "Charcoal Graphite", value: "#1f2937" },
  { label: "Deep Teal Slate", value: "#0f4c5c" },
  { label: "Executive Burgundy", value: "#5c1d2e" },
  { label: "Deep Forest", value: "#1b4332" },
] as const;

/** Resolves stored fontFamily presets to bundled @fontsource font stacks with safe system fallbacks. */
export function resolveDocumentFontStack(fontFamily: string | undefined): { bodyFont: string; headingFont: string } {
  const value = (fontFamily || "Inter").trim();
  const preset = DOCUMENT_FONT_PRESETS.find((item) => item.id === value);
  if (preset) return { bodyFont: preset.body, headingFont: preset.heading };
  if (value === "Georgia") {
    return { bodyFont: "Georgia, 'IBM Plex Serif', serif", headingFont: "Georgia, 'IBM Plex Serif', serif" };
  }
  if (value === "Arial") {
    return { bodyFont: "Arial, 'IBM Plex Sans', Helvetica, sans-serif", headingFont: "Arial, 'IBM Plex Sans', Helvetica, sans-serif" };
  }
  return {
    bodyFont: `'${value.replace(/['"]/g, "")}', 'IBM Plex Sans', Arial, sans-serif`,
    headingFont: `'${value.replace(/['"]/g, "")}', 'IBM Plex Sans', Arial, sans-serif`,
  };
}

export function documentFontSize(size: number | undefined, kind: "cv" | "letter" = "cv"): number {
  return Math.max(kind === "letter" ? 10.5 : 10, Number.isFinite(size) ? size! : 10.5);
}

export function accentContrast(color: string): number {
  if (!/^#[0-9a-f]{6}$/i.test(color)) return 0;
  const channels = [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16) / 255)
    .map((v) => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 1.05 / (0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2] + 0.05);
}

export function documentAccent(color: string | undefined): string {
  return color && accentContrast(color) >= 4.5 ? color : "#10233f";
}

/** Converts a validated 6-char hex accent color into a translucent rgba tint for subtle editorial hairlines and fills. */
export function accentTint(hex: string, alpha: number): string {
  const clean = /^#[0-9a-f]{6}$/i.test(hex) ? hex : "#10233f";
  const r = parseInt(clean.slice(1, 3), 16);
  const g = parseInt(clean.slice(3, 5), 16);
  const b = parseInt(clean.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Keep the full destination in href while avoiding an unbreakable printed URL. */
export function documentLinkText(url: string, label?: string): string {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./i, "");
    const text = `${host}${parsed.pathname.replace(/\/$/, "")}`;
    return text.length <= 48 ? text : (label?.trim() || host);
  } catch {
    return label?.trim() || url;
  }
}

/** Picks clean DACH vs international/ATS default templates and offline typography when the user has not customized layout yet. */
export function pickSmartTemplateDefaults(
  language: "English" | "German" | "Spanish" = "English",
  tonePreset?: string
): {
  cvTemplate: "ats-clean" | "modern-professional" | "dach-tabular";
  coverLetterTemplate: "ats-letter" | "editorial-sidebar" | "din-editorial";
  fontFamily: string;
} {
  if (language === "German") {
    return {
      cvTemplate: "dach-tabular",
      coverLetterTemplate: "din-editorial",
      fontFamily: "IBM Plex Sans",
    };
  }
  if (tonePreset === "startup_modern" || tonePreset === "technical_direct") {
    return {
      cvTemplate: "modern-professional",
      coverLetterTemplate: "editorial-sidebar",
      fontFamily: "IBM Plex Sans",
    };
  }
  return {
    cvTemplate: "ats-clean",
    coverLetterTemplate: "ats-letter",
    fontFamily: "IBM Plex Sans",
  };
}
