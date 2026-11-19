import { NextResponse } from "next/server";
import { guardApiRequest } from "@/lib/requestSecurity";
import { apiError, readObjectRequest } from "@/lib/apiErrors";
import { loadApplications } from "@/lib/storage";
import { runApplicationCrmCommand } from "@/lib/crmServer";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: RouteContext) {
  const denied = guardApiRequest(request); if (denied) return denied;
  try {
    const { id } = await params;
    const app = loadApplications().find(item => item.id === id);
    return app ? NextResponse.json({ ...app, revision: app.revision ?? 0 }) : NextResponse.json({ error: "Application not found." }, { status: 404 });
  } catch (error) { return apiError(error); }
}

export async function POST(request: Request, { params }: RouteContext) {
  const denied = guardApiRequest(request, "json"); if (denied) return denied;
  try {
    const { id } = await params;
    return NextResponse.json(runApplicationCrmCommand(id, await readObjectRequest(request)));
  } catch (error) { return apiError(error); }
}
