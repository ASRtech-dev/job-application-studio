import type { CrmDeliveryOption } from "./crmSchemas";
import { formatLocalDateTime } from "./timeZone";

const DOCUMENT_LABELS: Record<string, string> = {
  cv: "CV",
  letter: "Cover Letter",
  prep: "STAR Prep",
  "cv-refs": "CV + Attachments",
  "letter-refs": "Cover Letter + Attachments",
  "full-bundle": "Full Bundle (Letter -> CV -> Attachments)",
  "ats-bundle": "ATS Bundle (CV -> Letter)",
  references: "Attachments",
};

/** Maps immutable delivery records from the API to selectable options; unknown shapes are skipped. */
export function deliveriesToOptions(records: unknown): CrmDeliveryOption[] {
  if (!Array.isArray(records)) return [];
  return records.flatMap((record) => {
    if (!record || typeof record !== "object") return [];
    const { id, documentType, exportedAt, applicationRevision, files, revisionMatches } = record as Record<string, unknown>;
    if (typeof id !== "string" || typeof exportedAt !== "string" || !Array.isArray(files)) return [];
    const when = formatLocalDateTime(exportedAt, "en-US");
    const kind = DOCUMENT_LABELS[String(documentType)] ?? String(documentType);
    const revisionNote = revisionMatches === false ? " · revision unconfirmed" : ` · rev. ${String(applicationRevision)}`;
    return [{
      id,
      label: `${kind} · ${when}${revisionNote}`,
      exportedAt,
      files: files.flatMap((file) => file && typeof file === "object" && typeof (file as { name?: unknown }).name === "string" ? [(file as { name: string }).name] : []),
    }];
  });
}
