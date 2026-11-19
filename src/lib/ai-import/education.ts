import { type Application } from "@/lib/schemas";
import { cleanPlainField, cleanRichTextField } from "./fields";
import { localizeDateRange } from "@/lib/localization";

/**
 * Cleans and localizes selected education entries without inventing or overwriting
 * user-authored degrees or institutions.
 */
export function normalizeEducationEntries(app: Application): void {
  const lang = app.language;
  const currentList = Array.isArray(app.cvContent.education) ? app.cvContent.education : [];

  app.cvContent.education = currentList
    .filter((entry) => entry && (entry.degree || entry.institution))
    .map((entry, idx) => ({
      id: entry.id || `edu-${idx + 1}`,
      degree: cleanPlainField(entry.degree || ""),
      institution: cleanPlainField(entry.institution || ""),
      period: localizeDateRange(cleanPlainField(entry.period || ""), lang),
      ...(entry.description !== undefined
        ? { description: cleanRichTextField(entry.description) }
        : {}),
    }));
}

/** Backwards-compatible alias for normalizeEducationEntries. */
export const ensureCanonicalEducation = normalizeEducationEntries;
