import { NextResponse } from "next/server";
import { guardApiRequest } from "@/lib/requestSecurity";
import { apiError } from "@/lib/apiErrors";
import { listDeliveries } from "@/lib/exportStore";

type RouteContext = { params: Promise<{ id: string }> };

/** Read-only list of frozen exports for one application, newest first. */
export async function GET(req: Request, { params }: RouteContext) {
  const denied = guardApiRequest(req); if (denied) return denied;
  try {
    const { id } = await params;
    return NextResponse.json(listDeliveries(id));
  } catch (error) { return apiError(error); }
}
