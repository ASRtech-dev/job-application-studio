import fs from "node:fs";
import path from "node:path";
import { PDFDocument } from "pdf-lib";
import {
  formatReferenceLabel,
  SAFE_REFERENCE_ID_PATTERN,
  type ReferenceDocumentMeta,
} from "./referenceDocuments";

export const MAX_REFERENCE_PDF_BYTES = 15 * 1024 * 1024;
export const MAX_REFERENCE_FILES = 25;

const pageCountCache = new Map<string, number>();

/** Resolves the local reference attachments directory (overridable via JOB_REFERENCES_DIR for tests). */
export function getReferenceDocumentsDir(): string {
  return path.resolve(
    process.env.JOB_REFERENCES_DIR || path.join(process.cwd(), "public", "documents")
  );
}

function staysInsideRoot(candidate: string, root: string): boolean {
  const relative = path.relative(root, candidate);
  return (
    relative !== "" &&
    !relative.startsWith(`..${path.sep}`) &&
    relative !== ".." &&
    !path.isAbsolute(relative)
  );
}

function isPdfHeader(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 5 &&
    bytes[0] === 0x25 && // %
    bytes[1] === 0x50 && // P
    bytes[2] === 0x44 && // D
    bytes[3] === 0x46 && // F
    bytes[4] === 0x2d // -
  );
}

async function resolvePageCount(cacheKey: string, bytes: Uint8Array): Promise<number | undefined> {
  const cached = pageCountCache.get(cacheKey);
  if (cached !== undefined) return cached;
  try {
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const count = doc.getPageCount();
    if (pageCountCache.size > 200) pageCountCache.clear();
    pageCountCache.set(cacheKey, count);
    return count;
  } catch {
    return undefined;
  }
}

/**
 * Safely scans `public/documents/` (non-recursively) for user-supplied PDF files.
 * Rejects symlinks, path traversal, non-PDF files, and oversized files.
 */
export async function listReferenceDocuments(): Promise<ReferenceDocumentMeta[]> {
  const dir = getReferenceDocumentsDir();
  if (!fs.existsSync(dir)) return [];

  let realRoot: string;
  try {
    realRoot = fs.realpathSync(dir);
  } catch {
    return [];
  }

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(realRoot, { withFileTypes: true });
  } catch {
    return [];
  }

  const candidates = entries
    .filter((entry) => !entry.isSymbolicLink() && entry.isFile() && SAFE_REFERENCE_ID_PATTERN.test(entry.name))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b, "en", { numeric: true, sensitivity: "base" }))
    .slice(0, MAX_REFERENCE_FILES);

  const results: ReferenceDocumentMeta[] = [];
  for (const fileName of candidates) {
    const loaded = await readSafeReferencePdf(fileName);
    if (loaded) results.push(loaded.meta);
  }
  return results;
}

/**
 * Validates and reads a single PDF from `public/documents/` by exact filename ID.
 * Returns null if missing, unsafe, symlinked, too large, or not a valid PDF header.
 */
export async function readSafeReferencePdf(
  id: string
): Promise<{ meta: ReferenceDocumentMeta; bytes: Uint8Array } | null> {
  if (typeof id !== "string" || !SAFE_REFERENCE_ID_PATTERN.test(id)) return null;

  const dir = getReferenceDocumentsDir();
  if (!fs.existsSync(dir)) return null;

  let realRoot: string;
  try {
    realRoot = fs.realpathSync(dir);
  } catch {
    return null;
  }

  const candidate = path.join(realRoot, id);
  if (!staysInsideRoot(candidate, realRoot)) return null;

  let lstat: fs.Stats;
  try {
    lstat = fs.lstatSync(candidate);
  } catch {
    return null;
  }
  if (lstat.isSymbolicLink() || !lstat.isFile()) return null;
  if (lstat.size <= 0 || lstat.size > MAX_REFERENCE_PDF_BYTES) return null;

  let realCandidate: string;
  try {
    realCandidate = fs.realpathSync(candidate);
  } catch {
    return null;
  }
  if (!staysInsideRoot(realCandidate, realRoot)) return null;

  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(fs.readFileSync(realCandidate));
  } catch {
    return null;
  }

  if (!isPdfHeader(bytes)) return null;

  const cacheKey = `${realCandidate}:${lstat.mtimeMs}:${lstat.size}`;
  const pageCount = await resolvePageCount(cacheKey, bytes);

  return {
    bytes,
    meta: {
      id,
      fileName: id,
      label: formatReferenceLabel(id),
      sizeBytes: bytes.length,
      approxKb: Math.max(1, Math.round(bytes.length / 1024)),
      ...(pageCount !== undefined ? { pageCount } : {}),
      modifiedAt: lstat.mtime.toISOString(),
    },
  };
}
