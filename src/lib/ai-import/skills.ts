import { type SkillGroup } from "@/lib/schemas";
import { cleanPlainField } from "./fields";
import { EDITORIAL_LIMITS } from "../editorialPolicy";

const SKILL_SEPARATOR_RE = /\s*[|;•·]\s*|\s+\/\s+/;

export function detectSkillAnomalies(groups: SkillGroup[]): string[] {
  const warnings: string[] = [];
  for (const g of groups) {
    for (const s of g.skills) {
      const clean = s.trim();
      if (!clean) continue;
      if (/[(/,-]$/.test(clean) || (clean.includes("(") && !clean.includes(")"))) {
        warnings.push(`Potentially truncated skill: "${clean}"`);
      } else if (/\s+[&/]\s+/.test(clean) || clean.length > 44) {
        warnings.push(`Composite or overly long ATS skill: "${clean}"`);
      }
    }
  }
  return warnings;
}

/**
 * Normalizes coreSkills arrays, splitting pipe/semicolon/spaced-slash concatenated skill strings,
 * deduplicating items, and enforcing an editorial budget so skills never overflow.
 */
export function normalizeCoreSkills(rawSkills: any): SkillGroup[] | null {
  if (!rawSkills) return null;
  // A supplied empty list is a deliberate selection, not missing input.
  if (Array.isArray(rawSkills) && rawSkills.length === 0) return [];

  let groups: SkillGroup[] = [];

  if (Array.isArray(rawSkills)) {
    groups = rawSkills
      .map((item: any) => {
        if (!item) return null;
        if (typeof item === "string") {
          const parts = item.split(":");
          if (parts.length >= 2) {
            return {
              group: cleanPlainField(parts[0]),
              skills: parts
                .slice(1)
                .join(":")
                .split(new RegExp(SKILL_SEPARATOR_RE.source + "|\\s*,\\s*"))
                .map(cleanPlainField)
                .filter(Boolean),
            };
          }
          return {
            group: "Core Competencies",
            skills: item.split(new RegExp(SKILL_SEPARATOR_RE.source + "|\\s*,\\s*")).map(cleanPlainField).filter(Boolean),
          };
        }
        if (typeof item === "object") {
          const groupName = cleanPlainField(item.group || item.category || item.name || item.title || "Skills");
          const rawList = Array.isArray(item.skills)
            ? item.skills
            : Array.isArray(item.items)
            ? item.items
            : typeof item.skills === "string"
            ? [item.skills]
            : [];
          const expandedSkills = rawList
            .flatMap((s: any) => String(s || "").split(SKILL_SEPARATOR_RE))
            .map((s: string) => cleanPlainField(s))
            .filter(Boolean);
          return { group: groupName, skills: expandedSkills };
        }
        return null;
      })
      .filter((g): g is SkillGroup => Boolean(g && g.skills.length > 0));
  } else if (typeof rawSkills === "object") {
    groups = Object.entries(rawSkills)
      .map(([key, val]) => {
        const groupName = cleanPlainField(
          key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
        );
        const rawList = Array.isArray(val) ? val : typeof val === "string" ? [val] : [];
        const expandedSkills = rawList
          .flatMap((s: any) => String(s || "").split(SKILL_SEPARATOR_RE))
          .map((s: string) => cleanPlainField(s))
          .filter(Boolean);
        return { group: groupName, skills: expandedSkills };
      })
      .filter((g) => g.skills.length > 0);
  }

  if (groups.length === 0) return Array.isArray(rawSkills) || typeof rawSkills === "object" ? [] : null;

  // Preserve priority order, claimed proficiency and the shared 4 × 5 budget.
  const seenGlobal = new Set<string>();
  return groups.slice(0, EDITORIAL_LIMITS.maxSkillGroups).map((g) => {
    const uniqueSkills: string[] = [];
    for (const sk of g.skills) {
      if (uniqueSkills.length >= EDITORIAL_LIMITS.maxSkillsPerGroup) break;
      const cleaned = sk.trim();
      const key = cleaned.toLowerCase();
      if (cleaned && !seenGlobal.has(key)) {
        seenGlobal.add(key);
        uniqueSkills.push(cleaned);
      }
    }
    return {
      group: g.group,
      skills: uniqueSkills,
    };
  }).filter((g) => g.skills.length > 0);
}
