import { NextResponse } from "next/server";
import { loadApplications, updateApplication, mirrorApplicationJson } from "@/lib/storage";
import { ApplicationSchema, toApplicationSummary } from "@/lib/schemas";
import { guardApiRequest } from "@/lib/requestSecurity";
import { apiError, readObjectRequest, expectedRevision } from "@/lib/apiErrors";
import { assertCrmUnchanged } from "@/lib/crmServer";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: RouteContext) {
  const denied = guardApiRequest(req); if (denied) return denied;
  try {
    const { id } = await params;
    const app = loadApplications().find(item => item.id === id);
    return app ? NextResponse.json({ ...app, revision: app.revision ?? 0 }) : NextResponse.json({ error: "Application not found" }, { status: 404 });
  } catch (error) { return apiError(error); }
}

async function save(req: Request, context: RouteContext, patch: boolean) {
  const denied = guardApiRequest(req, "json"); if (denied) return denied;
  try {
    const { id } = await context.params;
    const body = await readObjectRequest(req);
    const saved = updateApplication(id, expectedRevision(body.revision), current => {
      assertCrmUnchanged(current, body);
      const candidate = patch ? { ...current, ...body } : body;
      return ApplicationSchema.parse({ ...candidate, crm: current.crm, id: current.id, dateCreated: current.dateCreated });
    });
    if (!saved) throw new Error("Application was not saved.");
    mirrorApplicationJson(saved);
    return NextResponse.json(patch ? toApplicationSummary(saved) : saved);
  } catch (error) { return apiError(error); }
}

export async function PUT(req: Request, context: RouteContext) { return save(req, context, false); }
export async function PATCH(req: Request, context: RouteContext) { return save(req, context, true); }

export async function DELETE(req: Request, { params }: RouteContext) {
  const denied = guardApiRequest(req); if (denied) return denied;
  try {
    const { id } = await params;
    const revision = new URL(req.url).searchParams.get("revision");
    const parsedRevision = revision === null ? undefined : revision.trim() === "" ? Number.NaN : Number(revision);
    updateApplication(id, expectedRevision(parsedRevision), () => null);
    return NextResponse.json({ success: true });
  } catch (error) { return apiError(error); }
}
