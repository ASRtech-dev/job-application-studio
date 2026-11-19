import { type ExperienceEntry } from "@/lib/schemas";

function normalizeText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[—–\-/|().,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenOverlapScore(a: string, b: string): number {
  const tokensA = normalizeText(a).split(" ").filter((t) => t.length >= 3);
  const tokensB = new Set(normalizeText(b).split(" ").filter((t) => t.length >= 3));
  if (tokensA.length === 0 || tokensB.size === 0) return 0;
  let shared = 0;
  for (const t of tokensA) {
    if (tokensB.has(t)) shared++;
  }
  return shared / Math.max(tokensA.length, tokensB.size);
}

/**
 * Deterministic multi-criteria matcher for Experience entries.
 * Safely separates multiple promotions/roles held at the same employer without overwriting earlier entries.
 */
export function matchExperienceEntry(
  jExp: Record<string, unknown>,
  existingList: ExperienceEntry[],
  usedIds: Set<string>
): ExperienceEntry | undefined {
  const rawId = String(jExp.id || "").toLowerCase().trim();
  if (rawId) {
    const byId = existingList.find((e) => e.id.toLowerCase() === rawId && !usedIds.has(e.id));
    if (byId) return byId;
  }

  const rawTitle = String(jExp.jobTitle || jExp.title || jExp.role || "").trim();
  const rawCompany = String(jExp.company || "").trim();
  const rawDates = String(jExp.dates || "").trim();
  const normTitle = normalizeText(rawTitle);
  const normCompany = normalizeText(rawCompany);

  const unused = existingList.filter((e) => !usedIds.has(e.id));
  if (unused.length === 0) return undefined;

  // 1. Exact or strong jobTitle + company match (handles multi-role tenure at one employer cleanly)
  if (normTitle && normCompany) {
    const byBoth = unused.find((e) => {
      const eTitle = normalizeText(e.jobTitle);
      const eComp = normalizeText(e.company);
      const companyMatch = eComp === normCompany || eComp.includes(normCompany) || normCompany.includes(eComp);
      const titleMatch =
        eTitle === normTitle ||
        eTitle.includes(normTitle) ||
        normTitle.includes(eTitle) ||
        tokenOverlapScore(rawTitle, e.jobTitle) >= 0.6;
      return companyMatch && titleMatch;
    });
    if (byBoth) return byBoth;
  }

  // 2. Company + exact start/end year match when a role title was translated into another language
  if (normCompany && rawDates) {
    const years = rawDates.match(/\b(19|20)\d{2}\b/g) || [];
    if (years.length > 0) {
      const byCompanyAndYear = unused.filter((e) => {
        const eComp = normalizeText(e.company);
        const companyMatch = eComp === normCompany || eComp.includes(normCompany) || normCompany.includes(eComp);
        if (!companyMatch) return false;
        return years.every((y) => e.dates.includes(y));
      });
      if (byCompanyAndYear.length === 1) return byCompanyAndYear[0];
    }
  }

  // 3. Job title match across remaining unused entries
  if (normTitle) {
    const byTitle = unused.find((e) => {
      const eTitle = normalizeText(e.jobTitle);
      return (
        eTitle === normTitle ||
        eTitle.includes(normTitle) ||
        normTitle.includes(eTitle) ||
        tokenOverlapScore(rawTitle, e.jobTitle) >= 0.65
      );
    });
    if (byTitle) return byTitle;
  }

  // 4. Fallback by company ONLY if there is exactly 1 unmatched entry for that company
  if (normCompany) {
    const companyMatches = unused.filter((e) => {
      const eComp = normalizeText(e.company);
      return eComp === normCompany || eComp.includes(normCompany) || normCompany.includes(eComp);
    });
    if (companyMatches.length === 1) {
      return companyMatches[0];
    }
  }

  return undefined;
}
