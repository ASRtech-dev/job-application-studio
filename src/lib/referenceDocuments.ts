import type { Application } from "./schemas";

/**
 * Client-safe metadata for a user-supplied PDF placed in public/documents/.
 * Job Application Studio ships with zero personal attachments; users add their
 * own reference letters, diplomas, or certificates locally in public/documents/.
 */
export interface ReferenceDocumentMeta {
  /** Exact validated PDF filename (e.g., "recommendation-letter.pdf"). */
  id: string;
  fileName: string;
  /** Human-friendly label derived from the filename. */
  label: string;
  sizeBytes: number;
  approxKb: number;
  pageCount?: number;
  modifiedAt: string;
}

/** Strict single-segment PDF filename pattern shared between client and server. */
export const SAFE_REFERENCE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,120}\.pdf$/i;

/** Turns a PDF filename like "make_level-3-certificate.pdf" into a readable label. */
export function formatReferenceLabel(fileName: string): string {
  const stem = fileName.replace(/\.pdf$/i, "").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  if (!stem) return fileName;
  return stem
    .split(" ")
    .map((word) => {
      if (/^[A-Z0-9]{2,}$/.test(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

/**
 * Resolves which reference PDFs from public/documents/ should be bundled for an application.
 * - If `availableDocs` is supplied (from GET /api/references), preserves available order and
 *   filters out any stale/removed IDs.
 * - If the application has no explicit `referenceDocIds` saved yet, defaults to all currently
 *   available local reference PDFs (empty when the user has not placed any PDFs yet).
 */
export function resolveSelectedReferenceIds(
  app: Pick<Application, "assetSettings">,
  availableDocs?: readonly Pick<ReferenceDocumentMeta, "id">[]
): string[] {
  const configured = app.assetSettings?.referenceDocIds;

  if (availableDocs) {
    const allowed = new Set(availableDocs.map((doc) => doc.id));
    if (Array.isArray(configured)) {
      const selected = new Set(configured.filter((id) => allowed.has(id)));
      return availableDocs.filter((doc) => selected.has(doc.id)).map((doc) => doc.id);
    }
    return availableDocs.map((doc) => doc.id);
  }

  if (Array.isArray(configured)) {
    return Array.from(new Set(configured.filter((id) => SAFE_REFERENCE_ID_PATTERN.test(id))));
  }
  return [];
}
