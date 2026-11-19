import fs from "node:fs";
import path from "node:path";

/** Read side of immutable delivery records (no PDF engine dependency). */
// Resolved on every call so JOB_DATA_DIR redirects (tests, QA) always apply.
export const deliveriesDir = () => path.join(path.resolve(process.env.JOB_DATA_DIR || path.join(process.cwd(), "data")), "deliveries");
const ID_PATTERN = /^[A-Za-z0-9_-]{1,80}$/;

export interface DeliveryFile {
  /** Path relative to the exports directory, with forward slashes. */
  path: string;
  name: string;
  sha256: string;
  bytes: number;
}

export interface DeliveryRecord {
  id: string;
  version: 1;
  applicationId: string;
  applicationRevision: number;
  clientRevision: number;
  revisionMatches: boolean;
  exportedAt: string;
  documentType: string;
  parts: string[];
  downloadName: string;
  company: string;
  roleTitle: string;
  language: string;
  files: DeliveryFile[];
  offer: { jobDescriptionSha256: string | null; jobDescriptionFingerprint: string | null };
  promptContext: { version: string; generatedAt: string } | null;
  applicationContentSha256: string;
}

export function getDelivery(id: string): DeliveryRecord | null {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const file = path.join(deliveriesDir(), `${id}.json`);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf8")) as DeliveryRecord;
}

/** Newest first. Unreadable records are skipped rather than blocking the list. */
export function listDeliveries(applicationId: string): DeliveryRecord[] {
  if (!ID_PATTERN.test(applicationId) || !fs.existsSync(deliveriesDir())) return [];
  const records: DeliveryRecord[] = [];
  for (const name of fs.readdirSync(deliveriesDir())) {
    if (!name.endsWith(".json")) continue;
    try {
      const record = JSON.parse(fs.readFileSync(path.join(deliveriesDir(), name), "utf8")) as DeliveryRecord;
      if (record.applicationId === applicationId) records.push(record);
    } catch { /* A damaged record stays on disk for manual review. */ }
  }
  return records.sort((a, b) => b.exportedAt.localeCompare(a.exportedAt));
}
