import fs from "fs";
import path from "path";
import { MasterCv, Application, ApplicationSchema } from "./schemas";

// Root and secure base directories
const BASE_DIR = process.cwd();
const DATA_DIR = path.join(BASE_DIR, "data");
const MASTER_CV_PATH = path.join(DATA_DIR, "master-cv.json");
const MASTER_CV_EXAMPLE_PATH = path.join(DATA_DIR, "master-cv.example.json");
const APPLICATIONS_PATH = path.join(DATA_DIR, "applications.json");
const APPLICATIONS_EXAMPLE_PATH = path.join(DATA_DIR, "applications.example.json");
const UPLOADS_DIR = path.join(BASE_DIR, "public", "uploads");
const EXPORTS_DIR = path.join(BASE_DIR, "exports");

// Path traversal defense helper
function assertPathWithin(filePath: string, parentDir: string, label: string): string {
  const resolved = path.resolve(filePath);
  const resolvedParent = path.resolve(parentDir);
  if (!resolved.startsWith(resolvedParent + path.sep) && resolved !== resolvedParent) {
    throw new Error(`Security validation failed: Invalid ${label} path traversal attempt.`);
  }
  return resolved;
}

function sanitizeId(rawId: string): string {
  const clean = String(rawId || "").replace(/[^a-zA-Z0-9_\-]/g, "");
  if (!clean) {
    throw new Error("Invalid application identifier");
  }
  return clean;
}

function sanitizeFilename(name: string): string {
  return String(name || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9_\-]/g, "")
    .replace(/_+/g, "_")
    .slice(0, 100);
}

function ensureDirectoryExistence(filePath: string) {
  const dirname = path.dirname(filePath);
  if (!fs.existsSync(dirname)) {
    fs.mkdirSync(dirname, { recursive: true });
  }
}

// Storage APIs
export function loadMasterCv(): MasterCv {
  ensureDirectoryExistence(MASTER_CV_PATH);
  if (!fs.existsSync(MASTER_CV_PATH)) {
    if (fs.existsSync(MASTER_CV_EXAMPLE_PATH)) {
      try {
        const rawExample = fs.readFileSync(MASTER_CV_EXAMPLE_PATH, "utf-8");
        fs.writeFileSync(MASTER_CV_PATH, rawExample, "utf-8");
        return JSON.parse(rawExample) as MasterCv;
      } catch (err) {
        console.error("Failed to seed master-cv.json from example:", err);
      }
    }
    const emptyFallback: MasterCv = {
      fullName: "Candidate Name",
      location: "City, Country",
      email: "candidate@example.com",
      phone: "+00 000 000000",
      links: [],
      availability: "Available immediately",
      workModes: ["Hybrid", "Remote"],
      languages: [{ language: "English", level: "Fluent" }],
      headlineVariants: [],
      profileVariants: [],
      achievementsPool: [],
      skillsPool: [],
      experienceHistory: [],
      projectsHistory: [],
      educationHistory: [],
      certificationsHistory: [],
    };
    saveMasterCv(emptyFallback);
    return emptyFallback;
  }

  try {
    const raw = fs.readFileSync(MASTER_CV_PATH, "utf-8");
    return JSON.parse(raw) as MasterCv;
  } catch (err) {
    console.error("Error reading master CV, returning default:", err);
    throw err;
  }
}

export function saveMasterCv(data: MasterCv): void {
  ensureDirectoryExistence(MASTER_CV_PATH);
  fs.writeFileSync(MASTER_CV_PATH, JSON.stringify(data, null, 2), "utf-8");
}

function backupApplicationsFile(): void {
  try {
    if (fs.existsSync(APPLICATIONS_PATH)) {
      const date = new Date();
      const pad = (num: number) => String(num).padStart(2, "0");
      const timestamp = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`;
      const backupPath = path.join(DATA_DIR, `applications.backup.${timestamp}.json`);
      fs.copyFileSync(APPLICATIONS_PATH, backupPath);
      console.log(`Created backup of applications.json at: ${backupPath}`);
    }
  } catch (err) {
    console.error("Failed to create backup of applications.json:", err);
  }
}

export function loadApplications(): Application[] {
  ensureDirectoryExistence(APPLICATIONS_PATH);
  if (!fs.existsSync(APPLICATIONS_PATH)) {
    if (fs.existsSync(APPLICATIONS_EXAMPLE_PATH)) {
      try {
        const rawExample = fs.readFileSync(APPLICATIONS_EXAMPLE_PATH, "utf-8");
        fs.writeFileSync(APPLICATIONS_PATH, rawExample, "utf-8");
        return JSON.parse(rawExample) as Application[];
      } catch (err) {
        console.error("Failed to seed applications.json from example:", err);
      }
    }
    saveApplications([]);
    return [];
  }

  try {
    const raw = fs.readFileSync(APPLICATIONS_PATH, "utf-8");
    const list = JSON.parse(raw) as any[];

    let needsMigration = false;
    for (const app of list) {
      if (app.schemaVersion !== 2) {
        needsMigration = true;
        break;
      }
    }

    if (needsMigration) {
      console.log("Migration to schemaVersion 2 needed. Creating backup...");
      backupApplicationsFile();
      const migrated = list.map((item) => {
        const m = { ...item, schemaVersion: 2 };
        try {
          return ApplicationSchema.parse(m);
        } catch {
          return m as Application;
        }
      });
      saveApplications(migrated);
      return migrated;
    }

    return list as Application[];
  } catch (err) {
    console.error("Error reading applications, returning empty list:", err);
    return [];
  }
}

export function saveApplications(data: Application[]): void {
  ensureDirectoryExistence(APPLICATIONS_PATH);
  fs.writeFileSync(APPLICATIONS_PATH, JSON.stringify(data, null, 2), "utf-8");
}

export function saveUploadFile(fileBuffer: Buffer, fileName: string, fileType: "signature" | "photo"): string {
  const targetDir = path.join(UPLOADS_DIR, fileType);
  assertPathWithin(targetDir, UPLOADS_DIR, "uploads directory");
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const rawExt = path.extname(fileName).toLowerCase();
  const allowedExts = [".png", ".jpg", ".jpeg", ".webp"];
  const ext = allowedExts.includes(rawExt) ? rawExt : ".png";

  const randomSuffix = Math.random().toString(36).substring(2, 10);
  const safeBase = sanitizeFilename(path.basename(fileName, rawExt)) || fileType;
  const safeName = `${safeBase}_${randomSuffix}${ext}`;

  const targetPath = path.join(targetDir, safeName);
  assertPathWithin(targetPath, targetDir, "uploaded file");

  fs.writeFileSync(targetPath, fileBuffer);
  return `/uploads/${fileType}/${safeName}`;
}

export function deleteUploadFile(publicPath: string): void {
  if (!publicPath || !publicPath.startsWith("/uploads/")) return;
  const relativePath = publicPath.replace(/^\//, "");
  const fullPath = path.join(BASE_DIR, "public", relativePath);

  try {
    assertPathWithin(fullPath, UPLOADS_DIR, "delete upload");
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
  } catch (e) {
    console.error("Failed to delete file safely:", fullPath, e);
  }
}

export function mirrorApplicationJson(app: Application): void {
  try {
    const cleanCompany = sanitizeFilename(app.company || "Generic");
    const cleanPosition = sanitizeFilename(app.roleTitle || "Position");
    const safeId = sanitizeId(app.id);

    const companyDir = path.join(EXPORTS_DIR, cleanCompany);
    assertPathWithin(companyDir, EXPORTS_DIR, "export company directory");

    if (!fs.existsSync(companyDir)) {
      fs.mkdirSync(companyDir, { recursive: true });
    }

    const jsonPath = path.join(companyDir, `${cleanPosition}_${safeId}.json`);
    assertPathWithin(jsonPath, companyDir, "export json");

    fs.writeFileSync(jsonPath, JSON.stringify(app, null, 2), "utf-8");
  } catch (err) {
    console.error("Failed to mirror application JSON:", err);
  }
}
