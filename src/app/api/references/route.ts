import { NextResponse } from "next/server";
import { guardApiRequest, privateResponseHeaders } from "@/lib/requestSecurity";
import { listReferenceDocuments } from "@/lib/referenceDocumentsServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const blocked = guardApiRequest(request);
  if (blocked) return blocked;
  const documents = await listReferenceDocuments();
  return NextResponse.json({ documents }, { headers: privateResponseHeaders() });
}
