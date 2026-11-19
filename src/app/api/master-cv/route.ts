import { NextResponse } from "next/server";
import { loadMasterCv, saveMasterCv } from "@/lib/storage";
import { MasterCvSchema } from "@/lib/schemas";
import { guardApiRequest } from "@/lib/requestSecurity";
import { apiError, readObjectRequest, expectedRevision } from "@/lib/apiErrors";

export async function GET(req: Request) {
  const denied = guardApiRequest(req); if (denied) return denied;
  try {
    const data = loadMasterCv();
    return NextResponse.json({ ...data, revision: data.revision ?? 0 });
  } catch (error) { return apiError(error); }
}

export async function POST(req: Request) {
  const denied = guardApiRequest(req, "json"); if (denied) return denied;
  try {
    const body = await readObjectRequest(req);
    const saved = saveMasterCv(MasterCvSchema.parse(body), expectedRevision(body.revision));
    return NextResponse.json({ success: true, data: saved });
  } catch (error) { return apiError(error); }
}
