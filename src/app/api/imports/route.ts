import { NextResponse } from "next/server";
import { z } from "zod";
import { guardApiRequest } from "@/lib/requestSecurity";
import { readObjectRequest, apiError } from "@/lib/apiErrors";
import { archiveImport } from "@/lib/storage";

export async function POST(request: Request) {
  const denied = guardApiRequest(request, "json"); if (denied) return denied;
  try {
    const body = z.object({ rawText: z.string().min(1), applicationId: z.string().optional() }).strict().parse(await readObjectRequest(request));
    return NextResponse.json({ runId: archiveImport(body.rawText, body.applicationId) });
  } catch (error) { return apiError(error); }
}
