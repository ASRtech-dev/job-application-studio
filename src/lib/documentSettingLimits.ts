/**
 * Documentary limits for stored and imported settings. They are deliberately wider than
 * the editor sliders so that every previously valid application stays valid, while
 * absurd values (e.g. fontSize = 1000000) are rejected. Units: pt, ratio, px.
 */
export const DOCUMENT_SETTING_LIMITS = {
  fontSize: [6, 16],
  lineSpacing: [0.8, 3],
  sectionSpacing: [0, 60],
  letterFontSize: [6, 16],
  letterLineSpacing: [0.8, 3],
  letterParagraphSpacing: [0, 60],
  signatureWidthPx: [20, 600],
  photoWidthPx: [48, 220],
} as const;
