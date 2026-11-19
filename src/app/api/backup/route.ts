import { NextResponse } from "next/server";
import { z } from "zod";
import { guardApiRequest, privateResponseHeaders } from "@/lib/requestSecurity";
import { apiError, readObjectRequest } from "@/lib/apiErrors";
import {
  createLocalWorkspaceBackup,
  inspectLocalBackupStatus,
  loadApplications,
  loadCrmStore,
  loadMasterCv,
  loadOfferPreparations,
  scanAndPruneLocalOrphans,
} from "@/lib/storage";

const BackupActionSchema = z.object({
  action: z.enum(["create_backup", "prune_orphans"]),
  keepAssetPaths: z.array(z.string().max(300)).max(20).optional(),
});

export async function GET(req: Request) {
  const denied = guardApiRequest(req);
  if (denied) return denied;
  try {
    const url = new URL(req.url);
    if (url.searchParams.get("download") === "workspace") {
      const payload = {
        exportedAt: new Date().toISOString(),
        version: 1,
        masterCv: loadMasterCv(),
        applications: loadApplications(),
        crm: loadCrmStore(),
        preparations: loadOfferPreparations(),
      };
      const stamp = new Date().toISOString().slice(0, 10);
      return new NextResponse(JSON.stringify(payload, null, 2), {
        status: 200,
        headers: {
          ...privateResponseHeaders(),
          "Content-Type": "application/json; charset=utf-8",
          "Content-Disposition": `attachment; filename="Job_Studio_Workspace_${stamp}.json"`,
        },
      });
    }
    const keep = url.searchParams.getAll("keep").slice(0, 20);
    return NextResponse.json(inspectLocalBackupStatus({ keepAssetPaths: keep }), {
      headers: privateResponseHeaders(),
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(req: Request) {
  const denied = guardApiRequest(req, "json");
  if (denied) return denied;
  try {
    const parsed = BackupActionSchema.parse(await readObjectRequest(req));
    if (parsed.action === "create_backup") {
      const backup = createLocalWorkspaceBackup();
      const status = inspectLocalBackupStatus({ keepAssetPaths: parsed.keepAssetPaths });
      return NextResponse.json({ backup, status }, { headers: privateResponseHeaders() });
    }
    const pruned = scanAndPruneLocalOrphans({ prune: true, keepAssetPaths: parsed.keepAssetPaths });
    const status = inspectLocalBackupStatus({ keepAssetPaths: parsed.keepAssetPaths });
    return NextResponse.json({ pruned, status }, { headers: privateResponseHeaders() });
  } catch (error) {
    return apiError(error);
  }
}
