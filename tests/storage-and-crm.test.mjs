import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createSourceLoader } from "./helpers/source-loader.mjs";
import { createDataBackup, verifyDataBackup, restoreDataBackup } from "../scripts/data-backup.mjs";

test("storage, CRM commands, and backup/restore work end-to-end in an isolated temp workspace", async (t) => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "job-studio-storage-"));
  const dataDir = path.join(tempRoot, "data");
  const exportsDir = path.join(tempRoot, "exports");
  const prevDataDir = process.env.JOB_DATA_DIR;
  const prevExportsDir = process.env.JOB_EXPORTS_DIR;
  process.env.JOB_DATA_DIR = dataDir;
  process.env.JOB_EXPORTS_DIR = exportsDir;
  t.after(() => {
    if (prevDataDir === undefined) delete process.env.JOB_DATA_DIR;
    else process.env.JOB_DATA_DIR = prevDataDir;
    if (prevExportsDir === undefined) delete process.env.JOB_EXPORTS_DIR;
    else process.env.JOB_EXPORTS_DIR = prevExportsDir;
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  const load = createSourceLoader();
  const storage = load("src/lib/storage.ts");
  const crmServer = load("src/lib/crmServer.ts");
  const crmView = load("src/lib/crmView.ts");
  const { defaultMasterCv } = load("src/lib/defaultMasterCv.ts");
  const { ApplicationSchema } = load("src/lib/schemas.ts");

  // 1. Master CV atomic save + revision conflict protection
  const initialMaster = storage.loadMasterCv();
  assert.equal(initialMaster.fullName, defaultMasterCv.fullName);
  const updatedMaster = storage.saveMasterCv({ ...initialMaster, location: "Edinburgh, UK" }, 0);
  assert.equal(updatedMaster.revision, 1);
  assert.throws(() => storage.saveMasterCv(updatedMaster, 0), (err) => err.status === 409);

  // 2. Create application + run idempotent CRM commands
  const app = storage.createApplication(
    ApplicationSchema.parse({
      id: "app_test_crm_1",
      company: "Meridian Labs",
      roleTitle: "Product Operations Lead",
      dateCreated: "2026-03-01T10:00:00.000Z",
      dateModified: "2026-03-01T10:00:00.000Z",
      status: "draft",
      language: "English",
      cvContent: {
        header: {
          fullName: "Alex Morgan",
          headline: "Operations Lead",
          location: "London, UK",
          email: "alex@example.com",
          phone: "+44 20 7946 0192",
          links: [],
          availability: "4 weeks notice",
          languages: [{ language: "English", level: "Native" }],
        },
        professionalProfile: "Operations leader.",
        keyAchievements: [],
        coreSkills: [],
        experience: [],
      },
      coverLetterContent: {
        company: "Meridian Labs",
        roleTitle: "Product Operations Lead",
        positioningLine: "Operations Lead",
        dateLine: "London, March 1, 2026",
        greeting: "Dear Hiring Team,",
        paragraphs: [{ type: "opening", text: "Hello." }],
        signatureName: "Alex Morgan",
      },
      templateSettings: {},
      assetSettings: {},
    })
  );
  assert.equal(app.revision, 0);

  const today = crmView.getLocalCrmDate();
  const cmd = { type: "register_application", sentOn: today, revision: 0, commandId: "cmd-send-1" };
  const afterSend = crmServer.runApplicationCrmCommand(app.id, cmd);
  assert.equal(afterSend.status, "applied");
  assert.equal(afterSend.revision, 1);
  // Idempotent retry with identical commandId returns current record without duplicating
  const replay = crmServer.runApplicationCrmCommand(app.id, cmd);
  assert.equal(replay.revision, 1);

  const overview = crmServer.getCrmOverview();
  const daySummary = crmView.getCrmDaySummary(overview, today);
  assert.equal(daySummary.applications.count, 1);

  // 3. Verified backup & restore round-trip
  const backupDir = path.join(tempRoot, "backup-snap");
  createDataBackup(tempRoot, backupDir);
  const manifest = verifyDataBackup(backupDir);
  assert.equal(manifest.version, 2);

  storage.saveMasterCv({ ...updatedMaster, location: "Changed Location" }, 1);
  assert.equal(storage.loadMasterCv().location, "Changed Location");

  const rescueDir = path.join(tempRoot, "rescue-snap");
  createDataBackup(tempRoot, rescueDir, { rescue: true });
  restoreDataBackup(backupDir, tempRoot, { rescueDirectory: rescueDir });
  storage.invalidateApplicationsCache();
  assert.equal(storage.loadMasterCv().location, "Edinburgh, UK");
});
