import { NextResponse } from "next/server";
import { guardApiRequest } from "@/lib/requestSecurity";
import { apiError, readObjectRequest } from "@/lib/apiErrors";
import { getCrmOverview, runGlobalCrmCommand } from "@/lib/crmServer";

export async function GET(request: Request) {
  const denied = guardApiRequest(request); if (denied) return denied;
  try { return NextResponse.json(getCrmOverview()); }
  catch (error) { return apiError(error); }
}

export async function POST(request: Request) {
  const denied = guardApiRequest(request, "json"); if (denied) return denied;
  try { return NextResponse.json(runGlobalCrmCommand(await readObjectRequest(request))); }
  catch (error) { return apiError(error); }
}
