import fs from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { sanitizeFilename } from "./filenames";
import { PDF_LIMITS, safePdfFilename } from "./pdfEngine";
import { RequestSecurityError } from "./requestSecurity";
import { loadApplications } from "./storage";

/**
 * Versioned PDF exports and immutable delivery records.
 * - Every export gets its own internal file, written once (never replaced).
 * - When it belongs to an application, a delivery record freezes what was exported:
 *   files, hashes, revision, offer fingerprint and prompt context.
 * Exporting is not sending: a sent event may later reference one delivery id.
 */
// Resolved on every call (like pdfEngine) so tests and QA redirects always apply.
const exportsDir = () => path.resolve(process.env.JOB_EXPORTS_DIR || path.join(process.cwd(), "exports"));
const ID_PATTERN = /^[A-Za-z0-9_-]{1,80}$/;

export type { DeliveryFile, DeliveryRecord } from "./deliveryRecords";
export { getDelivery, listDeliveries } from "./deliveryRecords";
import type { DeliveryFile, DeliveryRecord } from "./deliveryRecords";
import { deliveriesDir } from "./deliveryRecords";

export interface ExportRequest {
  bytes: Uint8Array;
  downloadName: string;
  documentType: string;
  applicationId?: string;
  clientRevision?: number;
  company?: string;
  parts?: string[];
}

export const sha256 = (bytes: Uint8Array | Buffer) => createHash("sha256").update(bytes).digest("hex");

function staysWithin(candidate: string, directory: string): boolean {
  const relative = path.relative(directory, candidate);
  return relative !== "" && !relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative);
}

function folderName(value: string, fallback: string): string {
  let name = sanitizeFilename(value || "").slice(0, 100) || fallback;
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(name)) name = `_${name}`;
  return name;
}

function safeDirectory(...segments: string[]): string {
  fs.mkdirSync(exportsDir(), { recursive: true });
  const root = fs.realpathSync(exportsDir());
  const directory = path.join(root, ...segments);
  if (!staysWithin(directory, root)) throw new RequestSecurityError("Export directory is not permitted", 403);
  fs.mkdirSync(directory, { recursive: true });
  const actual = fs.realpathSync(directory);
  if (!staysWithin(actual, root)) throw new RequestSecurityError("Export directory is not permitted", 403);
  return actual;
}

function stamp(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z").replace("T", "-");
}

function contentFingerprint(app: ReturnType<typeof loadApplications>[number]): string {
  return sha256(Buffer.from(JSON.stringify({
    company: app.company, roleTitle: app.roleTitle, language: app.language,
    cvContent: app.cvContent, coverLetterContent: app.coverLetterContent,
    templateSettings: app.templateSettings, assetSettings: app.assetSettings,
  }), "utf8"));
}

function writeOnce(file: string, bytes: Uint8Array | string): void {
  // "wx" never replaces an existing file; a collision is an error, not an overwrite.
  fs.writeFileSync(file, bytes, { flag: "wx", mode: 0o600 });
}

function writeRecord(record: DeliveryRecord): void {
  fs.mkdirSync(deliveriesDir(), { recursive: true });
  const file = path.join(deliveriesDir(), `${record.id}.json`);
  try { writeOnce(file, JSON.stringify(record, null, 2)); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") throw new Error("Delivery record already exists; records are immutable.");
    throw error;
  }
}

/** Test seam: proves records cannot be rewritten. */
export function writeDeliveryRecordForTest(record: DeliveryRecord): void { writeRecord(record); }

/** Stores one export uniquely and, when tied to an application, freezes a delivery record. */
export type StoredExport = DeliveryRecord | { id: null; downloadName: string; files: DeliveryFile[] };

export function recordPdfExport(request: ExportRequest): StoredExport {
  if (request.bytes.length > PDF_LIMITS.pdfBytes) throw new RequestSecurityError("PDF exceeds the permitted size", 413);
  const downloadName = safePdfFilename(request.downloadName, "Application_Document");
  const now = new Date();
  const exportId = randomUUID();
  let app: ReturnType<typeof loadApplications>[number] | undefined;
  if (request.applicationId !== undefined) {
    if (!ID_PATTERN.test(request.applicationId)) throw new RequestSecurityError("Invalid application id", 400);
    app = loadApplications().find((item) => item.id === request.applicationId);
    if (!app) throw new RequestSecurityError("Unknown application for this export", 404);
  }
  const company = app?.company ?? request.company ?? "";
  const revision = app?.revision ?? 0;
  const directory = safeDirectory(folderName(company, "No_Company"), app ? folderName(app.id, "app") : "unlinked");
  const fileName = `${stamp(now)}_r${app ? revision : "x"}_${exportId.slice(0, 8)}_${downloadName}`;
  const destination = path.join(directory, fileName);
  if (!staysWithin(destination, directory)) throw new RequestSecurityError("Export destination is not permitted", 403);
  writeOnce(destination, request.bytes);
  const file: DeliveryFile = {
    path: path.relative(fs.realpathSync(exportsDir()), destination).split(path.sep).join("/"),
    name: downloadName,
    sha256: sha256(request.bytes),
    bytes: request.bytes.length,
  };
  if (!app) return { id: null, downloadName, files: [file] };

  const clientRevision = Number.isInteger(request.clientRevision) ? Number(request.clientRevision) : -1;
  const record: DeliveryRecord = {
    id: exportId,
    version: 1,
    applicationId: app.id,
    applicationRevision: revision,
    clientRevision,
    revisionMatches: clientRevision === revision,
    exportedAt: now.toISOString(),
    documentType: request.documentType,
    parts: request.parts ?? [request.documentType],
    downloadName,
    company: app.company,
    roleTitle: app.roleTitle,
    language: app.language,
    files: [file],
    offer: {
      jobDescriptionSha256: app.jobDescription?.trim() ? sha256(Buffer.from(app.jobDescription, "utf8")) : null,
      jobDescriptionFingerprint: app.jobAnalysis?.jobDescriptionFingerprint ?? app.promptContext?.jobDescriptionFingerprint ?? null,
    },
    promptContext: app.promptContext ? { version: app.promptContext.version, generatedAt: app.promptContext.generatedAt } : null,
    applicationContentSha256: contentFingerprint(app),
  };
  try {
    writeRecord(record);
  } catch (error) {
    try { fs.unlinkSync(destination); } catch { /* Best-effort rollback of unrecorded PDF copy. */ }
    throw error;
  }
  return record;
}

