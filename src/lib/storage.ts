import fs from "node:fs";
import path from "node:path";
import { randomUUID, createHash } from "node:crypto";
import { lockSync } from "proper-lockfile";
import { defaultMasterCv } from "./defaultMasterCv";
import { sanitizeFilename } from "./filenames";
import { MasterCv, Application, ApplicationSchema, MasterCvSchema } from "./schemas";
import { ApplicationCrmSchema, CrmStoreSchema, type CrmStore } from "./crmSchemas";
import { OfferPreparationSchema, type OfferPreparation } from "./offerPreparations";
import { getLocalIsoDate } from "./timeZone";

const DATA_DIR = path.resolve(process.env.JOB_DATA_DIR || path.join(process.cwd(), "data"));
const MASTER_CV_PATH = path.join(DATA_DIR, "master-cv.json");
const APPLICATIONS_PATH = path.join(DATA_DIR, "applications.json");
const CRM_PATH = path.join(DATA_DIR, "crm.json");
const PREPARATIONS_PATH = path.join(DATA_DIR, "preparations.json");
const UPLOADS_PREFIX = process.env.JOB_DEVELOPMENT === "1" ? "/uploads/development" : "/uploads";
const UPLOADS_DIR = path.join(process.cwd(), "public", UPLOADS_PREFIX);
const EXPORTS_DIR = path.resolve(process.env.JOB_EXPORTS_DIR || path.join(process.cwd(), "exports"));

export class StorageError extends Error {
  constructor(message: string, public readonly status = 500) { super(message); }
}

const SLEEP_BUFFER = typeof SharedArrayBuffer === "function" ? new Int32Array(new SharedArrayBuffer(4)) : null;
let lockDepth = 0;

function withLock<T>(operation: () => T): T {
  if (lockDepth > 0) {
    lockDepth++;
    try { return operation(); }
    finally { lockDepth--; }
  }
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const lockPath = path.join(DATA_DIR, ".write.lock");
  let release: (() => void) | undefined;
  const maxAttempts = 4;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      release = lockSync(DATA_DIR, { lockfilePath: lockPath, stale: 60_000, update: 30_000 });
      break;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ELOCKED") {
        if (attempt === maxAttempts - 1) {
          throw new StorageError("Another save is in progress. Retry after it finishes.", 503);
        }
        if (SLEEP_BUFFER) {
          Atomics.wait(SLEEP_BUFFER, 0, 0, 35);
        }
        continue;
      }
      throw error;
    }
  }
  if (!release) throw new StorageError("Another save is in progress. Retry after it finishes.", 503);
  lockDepth++;
  try { return operation(); }
  finally {
    lockDepth--;
    release();
  }
}

interface ApplicationsCacheEntry {
  filePath: string;
  size: number;
  mtimeNs: bigint;
  apps: Application[];
}
let applicationsCache: ApplicationsCacheEntry | null = null;

export function invalidateApplicationsCache(): void {
  applicationsCache = null;
}

/** Interrupted writes never truncate the live JSON. Backups precede replacement. */
function atomicWrite(filePath: string, data: unknown, backup = false): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${randomUUID()}.tmp`;
  try {
    const descriptor = fs.openSync(temporaryPath, "wx", 0o600);
    try {
      fs.writeFileSync(descriptor, JSON.stringify(data, null, 2), "utf8");
      fs.fsyncSync(descriptor);
    } finally { fs.closeSync(descriptor); }
    if (backup && fs.existsSync(filePath)) {
      const directory = path.join(DATA_DIR, "backups");
      fs.mkdirSync(directory, { recursive: true });
      const prefix = `${path.basename(filePath, ".json")}.`;
      const name = `${prefix}${new Date().toISOString().replace(/[:.]/g, "-")}.${randomUUID()}.json`;
      fs.copyFileSync(filePath, path.join(directory, name), fs.constants.COPYFILE_EXCL);
      const history = fs.readdirSync(directory).filter(name => name.startsWith(prefix)).sort().reverse();
      for (const name of history.slice(20)) fs.unlinkSync(path.join(directory, name));
    }
    fs.renameSync(temporaryPath, filePath);
  } finally {
    if (fs.existsSync(temporaryPath)) fs.unlinkSync(temporaryPath);
  }
}

function readJson(filePath: string): unknown {
  try { return JSON.parse(fs.readFileSync(filePath, "utf8")); }
  catch { throw new StorageError(`Cannot read ${path.basename(filePath)}. Existing data was preserved; restore a verified backup before saving.`); }
}

function reviewContent(app: Application): string {
  return JSON.stringify({
    company: app.company, roleTitle: app.roleTitle, language: app.language,
    cvContent: app.cvContent, coverLetterContent: app.coverLetterContent,
    templateSettings: app.templateSettings, assetSettings: app.assetSettings,
    jobDescription: app.jobDescription, jobLocation: app.jobLocation, workModel: app.workModel,
    positioning: app.qualityControl?.oneSentencePositioning,
  });
}

export function loadMasterCv(): MasterCv {
  if (!fs.existsSync(MASTER_CV_PATH)) {
    withLock(() => {
      if (!fs.existsSync(MASTER_CV_PATH)) atomicWrite(MASTER_CV_PATH, defaultMasterCv);
    });
  }
  const result = MasterCvSchema.safeParse(readJson(MASTER_CV_PATH));
  if (!result.success) throw new StorageError("The master CV is invalid. Existing data was preserved.");
  return result.data;
}

export function saveMasterCv(data: MasterCv, expectedRevision?: number): MasterCv {
  return withLock(() => {
    const current = fs.existsSync(MASTER_CV_PATH) ? loadMasterCv() : undefined;
    if (expectedRevision !== undefined && expectedRevision !== (current?.revision ?? 0)) {
      throw new StorageError("The master CV changed in another tab. Your edits are still here; reload the latest version before saving.", 409);
    }
    const saved = MasterCvSchema.parse(expectedRevision === undefined ? data : { ...data, revision: (current?.revision ?? 0) + 1 });
    atomicWrite(MASTER_CV_PATH, saved, true);
    return saved;
  });
}

export function loadApplications(): Application[] {
  if (!fs.existsSync(APPLICATIONS_PATH)) {
    withLock(() => {
      if (!fs.existsSync(APPLICATIONS_PATH)) atomicWrite(APPLICATIONS_PATH, []);
    });
  }
  try {
    const stat = fs.statSync(APPLICATIONS_PATH, { bigint: true });
    if (
      applicationsCache &&
      applicationsCache.filePath === APPLICATIONS_PATH &&
      applicationsCache.size === Number(stat.size) &&
      applicationsCache.mtimeNs === stat.mtimeNs
    ) {
      return structuredClone(applicationsCache.apps);
    }
  } catch { /* fall through to readJson */ }

  const raw = readJson(APPLICATIONS_PATH);
  if (!Array.isArray(raw)) {
    applicationsCache = null;
    throw new StorageError("Applications must be a list. Existing data was preserved.");
  }
  const parsedList = raw.map((item) => {
    const parsed = ApplicationSchema.safeParse(item);
    if (!parsed.success) {
      applicationsCache = null;
      throw new StorageError("An application is invalid. Existing data was preserved; no automatic migration was written.");
    }
    return parsed.data;
  });
  try {
    const stat = fs.statSync(APPLICATIONS_PATH, { bigint: true });
    applicationsCache = { filePath: APPLICATIONS_PATH, size: Number(stat.size), mtimeNs: stat.mtimeNs, apps: structuredClone(parsedList) };
  } catch { /* cache optional */ }
  return parsedList;
}

export function saveApplications(data: Application[]): void {
  withLock(() => {
    if (fs.existsSync(APPLICATIONS_PATH)) loadApplications();
    data.forEach(item => ApplicationSchema.parse(item));
    atomicWrite(APPLICATIONS_PATH, data, true);
    invalidateApplicationsCache();
  });
}

export function createApplication(data: Application): Application {
  return withLock(() => {
    const list = loadApplications();
    if (list.some(item => item.id === data.id)) throw new StorageError("Application ID already exists.", 409);
    // Imports and ordinary creation cannot manufacture user-confirmed CRM history.
    const saved = ApplicationSchema.parse({ ...data, crm: undefined, revision: 0 });
    atomicWrite(APPLICATIONS_PATH, [...list, saved], true);
    invalidateApplicationsCache();
    return saved;
  });
}

export function updateApplication(id: string, expectedRevision: number, update: (current: Application) => Application | null, command?: { commandId: string; fingerprint: string }): Application | null {
  return withLock(() => {
    const list = loadApplications();
    const index = list.findIndex(item => item.id === id);
    if (index < 0) throw new StorageError("Application not found.", 404);
    const current = list[index];
    const receipt = command && current.crm?.events.find(event => event.commandId === command.commandId);
    if (receipt) {
      if (receipt.commandFingerprint !== command?.fingerprint) throw new StorageError("This command ID was already used for a different operation.", 409);
      return current;
    }
    if ((current.revision ?? 0) !== expectedRevision) {
      throw new StorageError("This application changed in another tab. Your edits are still here; reload the latest version before saving.", 409);
    }
    const updated = update(structuredClone(current));
    let saved: Application | null = null;
    if (updated) {
      const registeredAt = new Date().toISOString();
      if (current.crm?.preparation?.reviewed && reviewContent(current) !== reviewContent(updated)) {
        const crm = ApplicationCrmSchema.parse(updated.crm || current.crm);
        crm.preparation = { reviewed: false };
        crm.events.push({ id: randomUUID(), type: "preparation_reviewed", occurredOn: getLocalIsoDate(new Date(registeredAt)), registeredAt, applicationId: current.id, note: "Document content or offer changed; a new review is required." });
        updated.crm = crm;
      }
      if (current.status !== updated.status) {
        const crm = ApplicationCrmSchema.parse(updated.crm || current.crm || {});
        const previousIds = new Set(current.crm?.events.map(event => event.id) || []);
        if (!crm.events.some(event => !previousIds.has(event.id) && event.type === "status_changed" && event.fromStatus === current.status && event.toStatus === updated.status)) {
          crm.events.push({ id: randomUUID(), type: "status_changed", occurredOn: getLocalIsoDate(new Date(registeredAt)), registeredAt, applicationId: current.id, fromStatus: current.status, toStatus: updated.status });
        }
        updated.crm = crm;
      }
      saved = ApplicationSchema.parse({ ...updated, id: current.id, dateCreated: current.dateCreated, dateModified: registeredAt, revision: expectedRevision + 1 });
      list[index] = saved;
    } else list.splice(index, 1);
    atomicWrite(APPLICATIONS_PATH, list, true);
    invalidateApplicationsCache();
    return saved;
  });
}

/** Missing CRM state is a read-only empty view; reading old applications never migrates them. */
export function loadCrmStore(): CrmStore {
  if (!fs.existsSync(CRM_PATH)) return { revision: 0, goals: { applications: 6, contacts: 2 }, contacts: [], events: [], actions: [] };
  const parsed = CrmStoreSchema.safeParse(readJson(CRM_PATH));
  if (!parsed.success) throw new StorageError("The CRM file is invalid. Existing data was preserved.");
  return parsed.data;
}

export function updateCrmStore(expectedRevision: number, command: { commandId: string; fingerprint: string }, update: (current: CrmStore) => CrmStore): CrmStore {
  return withLock(() => {
    const current = loadCrmStore();
    const receipt = current.events.find(event => event.commandId === command.commandId);
    if (receipt) {
      if (receipt.commandFingerprint !== command.fingerprint) throw new StorageError("This command ID was already used for a different operation.", 409);
      return current;
    }
    if (current.revision !== expectedRevision) throw new StorageError("The CRM changed in another window. Your input was kept; reload and review before retrying.", 409);
    const saved = CrmStoreSchema.parse({ ...update(structuredClone(current)), revision: current.revision + 1 });
    atomicWrite(CRM_PATH, saved, true);
    return saved;
  });
}

export function saveUploadFile(fileBuffer: Buffer, fileName: string, fileType: "signature" | "photo"): string {
  const targetDir = path.join(UPLOADS_DIR, fileType);
  fs.mkdirSync(targetDir, { recursive: true });
  const name = `${randomUUID()}${path.extname(fileName).toLowerCase()}`;
  fs.writeFileSync(path.join(targetDir, name), fileBuffer, { flag: "wx", mode: 0o600 });
  return `${UPLOADS_PREFIX}/${fileType}/${name}`;
}

const UPLOAD_MIME_BY_EXTENSION: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

/**
 * Resolves a stored `/uploads/...` path inside `UPLOADS_DIR` without allowing directory traversal or symlinks.
 */
export function resolveUploadFilePath(publicPath: string): { filePath: string; mimeType: string } | null {
  if (!publicPath.startsWith(`${UPLOADS_PREFIX}/`)) return null;
  const relative = publicPath.slice(UPLOADS_PREFIX.length + 1);
  if (!/^(signature|photo)\/[A-Za-z0-9_.-]+$/.test(relative) || relative.includes("..")) return null;
  const mimeType = UPLOAD_MIME_BY_EXTENSION[path.extname(relative).toLowerCase()];
  if (!mimeType) return null;
  const fullPath = path.resolve(UPLOADS_DIR, relative);
  if (!fullPath.startsWith(`${UPLOADS_DIR}${path.sep}`) || !fs.existsSync(fullPath)) return null;
  try {
    if (fs.lstatSync(fullPath).isSymbolicLink()) return null;
    const realRoot = fs.realpathSync(UPLOADS_DIR);
    const realPath = fs.realpathSync(fullPath);
    if (!realPath.startsWith(`${realRoot}${path.sep}`)) return null;
    if (!fs.statSync(realPath).isFile()) return null;
    return { filePath: realPath, mimeType };
  } catch {
    return null;
  }
}

export function deleteUploadFile(publicPath: string): void {
  if (!publicPath.startsWith(`${UPLOADS_PREFIX}/`)) return;
  const relative = publicPath.slice(UPLOADS_PREFIX.length + 1);
  if (!/^(signature|photo)\/[^/\\]+$/.test(relative) || relative.includes("..")) return;
  const fullPath = path.resolve(UPLOADS_DIR, relative);
  if (!fullPath.startsWith(`${UPLOADS_DIR}${path.sep}`) || !fs.existsSync(UPLOADS_DIR) || !fs.existsSync(fullPath)) return;
  try {
    if (fs.lstatSync(fullPath).isSymbolicLink()) return;
    const realRoot = fs.realpathSync(UPLOADS_DIR);
    const realPath = fs.realpathSync(fullPath);
    if (!realPath.startsWith(`${realRoot}${path.sep}`)) return;
    fs.unlinkSync(realPath);
  } catch { /* ignore */ }
}

/** Manual-only orphan scanner and cleanup across local uploads and temp files. */
export function scanAndPruneLocalOrphans(options: { prune?: boolean; keepAssetPaths?: string[] } = {}): {
  orphanUploads: string[];
  staleTempFiles: string[];
  removedCount: number;
} {
  const apps = loadApplications();
  const referenced = new Set<string>(
    (options.keepAssetPaths || []).filter((p) => typeof p === "string" && p.startsWith(`${UPLOADS_PREFIX}/`))
  );
  for (const app of apps) {
    const photoPath = app.assetSettings?.photo?.filePath;
    const sigPath = app.assetSettings?.signature?.filePath;
    if (photoPath) referenced.add(photoPath);
    if (sigPath) referenced.add(sigPath);
  }
  const orphanUploads: string[] = [];
  if (fs.existsSync(UPLOADS_DIR)) {
    for (const kind of ["photo", "signature"] as const) {
      const dir = path.join(UPLOADS_DIR, kind);
      if (!fs.existsSync(dir)) continue;
      for (const name of fs.readdirSync(dir)) {
        const rel = `${UPLOADS_PREFIX}/${kind}/${name}`;
        const full = path.join(dir, name);
        try {
          const st = fs.lstatSync(full);
          if (st.isSymbolicLink() || !st.isFile()) continue;
          if (!referenced.has(rel)) {
            orphanUploads.push(rel);
            if (options.prune) deleteUploadFile(rel);
          }
        } catch { /* ignore */ }
      }
    }
  }
  const staleTempFiles: string[] = [];
  if (fs.existsSync(DATA_DIR)) {
    const cutoff = Date.now() - 10 * 60_000;
    for (const name of fs.readdirSync(DATA_DIR)) {
      if (!name.endsWith(".tmp")) continue;
      const full = path.join(DATA_DIR, name);
      try {
        const st = fs.lstatSync(full);
        if (!st.isSymbolicLink() && st.isFile() && st.mtimeMs < cutoff) {
          staleTempFiles.push(name);
          if (options.prune) fs.unlinkSync(full);
        }
      } catch { /* ignore */ }
    }
  }
  return {
    orphanUploads,
    staleTempFiles,
    removedCount: options.prune ? orphanUploads.length + staleTempFiles.length : 0,
  };
}

export function getDataRootDir(): string {
  return path.dirname(DATA_DIR);
}

export function getDataDirectory(): string {
  return DATA_DIR;
}

function getLocalBackupsDir(): string {
  return path.join(getDataRootDir(), ".local", "backups");
}

function listVerifiedSnapshotDirs(): Array<{ name: string; fullPath: string; createdAt: string; fileCount: number }> {
  const root = getLocalBackupsDir();
  if (!fs.existsSync(root)) return [];
  const results: Array<{ name: string; fullPath: string; createdAt: string; fileCount: number }> = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const fullPath = path.join(root, entry.name);
    const manifestPath = path.join(fullPath, "manifest.json");
    if (!fs.existsSync(manifestPath)) continue;
    try {
      const parsed = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as {
        version?: number;
        rescue?: boolean;
        createdAt?: string;
        files?: unknown[];
      };
      if ((parsed.version === 1 || parsed.version === 2) && !parsed.rescue && typeof parsed.createdAt === "string") {
        results.push({
          name: entry.name,
          fullPath,
          createdAt: parsed.createdAt,
          fileCount: Array.isArray(parsed.files) ? parsed.files.length : 0,
        });
      }
    } catch { /* ignore unreadable manifest */ }
  }
  return results.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Reads latest local backup status and detects active JSON stores modified afterwards. */
export function inspectLocalBackupStatus(options: { keepAssetPaths?: string[] } = {}) {
  const snapshots = listVerifiedSnapshotDirs();
  const latest = snapshots[0] || null;
  const latestTimeMs = latest ? Date.parse(latest.createdAt) || 0 : 0;
  let dataChangedSinceBackup = !latest;
  for (const file of [MASTER_CV_PATH, APPLICATIONS_PATH, CRM_PATH, PREPARATIONS_PATH]) {
    if (!fs.existsSync(file)) continue;
    try {
      if (fs.statSync(file).mtimeMs > latestTimeMs + 1000) {
        dataChangedSinceBackup = true;
        break;
      }
    } catch { /* ignore */ }
  }
  const orphans = scanAndPruneLocalOrphans({ prune: false, keepAssetPaths: options.keepAssetPaths });
  return {
    latestBackupAt: latest?.createdAt ?? null,
    latestBackupName: latest?.name ?? null,
    latestBackupFileCount: latest?.fileCount ?? 0,
    backupCount: snapshots.length,
    dataChangedSinceBackup,
    orphanUploadsCount: orphans.orphanUploads.length,
    staleTempCount: orphans.staleTempFiles.length,
  };
}

/** Creates a verified local snapshot under .local/backups matching data-backup manifest v2 format. */
export function createLocalWorkspaceBackup(): { directory: string; createdAt: string; fileCount: number } {
  return withLock(() => {
    const masterCv = loadMasterCv();
    const applications = loadApplications();
    const hasCrm = fs.existsSync(CRM_PATH);
    const crm = hasCrm ? loadCrmStore() : null;
    const hasPreparations = fs.existsSync(PREPARATIONS_PATH);
    if (hasPreparations) loadOfferPreparations();

    const rootDir = getDataRootDir();
    const backupRoot = getLocalBackupsDir();
    fs.mkdirSync(backupRoot, { recursive: true });
    const stamp = `${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID()}`;
    const destination = path.join(backupRoot, stamp);
    fs.mkdirSync(destination, { recursive: true });

    const manifestEntries: Array<{ relative: string; sha256: string; size: number }> = [];
    const copyIfExists = (absSource: string, relative: string) => {
      if (!fs.existsSync(absSource)) return false;
      const st = fs.lstatSync(absSource);
      if (st.isSymbolicLink() || !st.isFile()) return false;
      const bytes = fs.readFileSync(absSource);
      const target = path.join(destination, relative);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, bytes, { flag: "wx", mode: 0o600 });
      manifestEntries.push({
        relative,
        sha256: createHash("sha256").update(bytes).digest("hex"),
        size: bytes.length,
      });
      return true;
    };
    const walkDir = (absDir: string, relBase: string) => {
      if (!fs.existsSync(absDir)) return;
      const st = fs.lstatSync(absDir);
      if (st.isSymbolicLink()) return;
      if (st.isDirectory()) {
        for (const name of fs.readdirSync(absDir)) {
          walkDir(path.join(absDir, name), `${relBase}/${name}`);
        }
      } else {
        copyIfExists(absDir, relBase);
      }
    };

    // Ensure validated stores exist cleanly before snapshotting
    void masterCv;
    void applications;
    void crm;
    copyIfExists(MASTER_CV_PATH, "data/master-cv.json");
    copyIfExists(APPLICATIONS_PATH, "data/applications.json");
    if (hasCrm) copyIfExists(CRM_PATH, "data/crm.json");
    if (hasPreparations) copyIfExists(PREPARATIONS_PATH, "data/preparations.json");
    walkDir(path.join(DATA_DIR, "imports"), "data/imports");
    walkDir(path.join(DATA_DIR, "deliveries"), "data/deliveries");
    walkDir(UPLOADS_DIR, `public/${UPLOADS_PREFIX.replace(/^\//, "")}`);
    walkDir(path.join(rootDir, "public", "documents"), "public/documents");

    const present = new Set(manifestEntries.map((e) => e.relative));
    const createdAt = new Date().toISOString();
    const manifest = {
      version: 2,
      rescue: false,
      createdAt,
      stores: {
        "data/master-cv.json": present.has("data/master-cv.json") ? "present" : "absent",
        "data/applications.json": present.has("data/applications.json") ? "present" : "absent",
        "data/crm.json": present.has("data/crm.json") ? "present" : "absent",
      },
      files: manifestEntries,
    };
    fs.writeFileSync(path.join(destination, "manifest.json"), JSON.stringify(manifest, null, 2), { flag: "wx", mode: 0o600 });
    return { directory: stamp, createdAt, fileCount: manifestEntries.length };
  });
}

export function mirrorApplicationJson(app: Application): void {
  try {
    const companyDir = path.join(EXPORTS_DIR, sanitizeFilename(app.company || "Generic"));
    const filename = `${sanitizeFilename(app.roleTitle || "Position")}_${sanitizeFilename(app.id)}.json`;
    atomicWrite(path.join(companyDir, filename), app);
  } catch {
    console.error("Could not update the application export mirror.");
  }
}

/** Original input is retained separately, never duplicated in dashboard payloads. */
export function archiveImport(rawText: string, applicationId?: string): string {
  if (!rawText.trim() || Buffer.byteLength(rawText, "utf8") > 2 * 1024 * 1024) throw new StorageError("Import text must contain between 1 byte and 2 MB.", 400);
  const runId = randomUUID();
  atomicWrite(path.join(DATA_DIR, "imports", `${runId}.json`), {
    runId, applicationId, importedAt: new Date().toISOString(), rawText,
    sha256: createHash("sha256").update(rawText).digest("hex"),
    schemaVersion: 2, normalizerVersion: "4.0.0", masterRevisionAtImport: loadMasterCv().revision ?? 0,
  });
  return runId;
}

/** Disk-backed offer preparations queue (survives browser switches & accepts local intake). */
export function loadOfferPreparations(): OfferPreparation[] {
  if (!fs.existsSync(PREPARATIONS_PATH)) return [];
  const raw = readJson(PREPARATIONS_PATH);
  if (!Array.isArray(raw)) return [];
  return raw
    .flatMap((item) => {
      const parsed = OfferPreparationSchema.safeParse(item);
      return parsed.success ? [parsed.data] : [];
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function upsertOfferPreparation(prep: OfferPreparation): OfferPreparation[] {
  const parsed = OfferPreparationSchema.parse(prep);
  return withLock(() => {
    const existing = loadOfferPreparations().filter((item) => item.id !== parsed.id);
    const next = [parsed, ...existing].slice(0, 60);
    atomicWrite(PREPARATIONS_PATH, next);
    return next;
  });
}

export function deleteOfferPreparation(id: string): OfferPreparation[] {
  return withLock(() => {
    const next = loadOfferPreparations().filter((item) => item.id !== id);
    atomicWrite(PREPARATIONS_PATH, next);
    return next;
  });
}
