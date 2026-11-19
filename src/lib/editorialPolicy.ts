/** Shared by the prompt, controls and import budgeting; keep one editorial contract. */
export const PROMPT_VERSION = "4.0.0";

export const CV_LENGTH_POLICIES = {
  auto_clean: {
    minWords: 400,
    maxWords: 520,
    label: "Clean Executive (400–520 words · 1–2 pages)",
    description: "Balance relevant proof and comfortable whitespace across one or two A4 pages.",
  },
  ultra_compact_1p: {
    minWords: 330,
    maxWords: 380,
    label: "Ultra-Compact (330–380 words · 1 page)",
    description: "Prioritize decisive requirements; omit secondary detail instead of shrinking readable text.",
  },
  comprehensive_2p: {
    minWords: 460,
    maxWords: 600,
    label: "Comprehensive (460–600 words · 2 pages)",
    description: "Use a second page for material evidence, relevant earlier roles or projects; avoid padding.",
  },
} as const;

export const EDITORIAL_LIMITS = {
  maxSkillGroups: 4,
  maxSkillsPerGroup: 5,
  maxAchievements: 4,
} as const;
