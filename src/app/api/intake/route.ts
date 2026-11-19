import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { guardApiRequest } from "@/lib/requestSecurity";
import { apiError, readObjectRequest } from "@/lib/apiErrors";
import { findDuplicateOffers } from "@/lib/offerPreparations";
import { loadApplications, upsertOfferPreparation } from "@/lib/storage";
import { PROMPT_VERSION } from "@/lib/editorialPolicy";

const IntakeRequestSchema = z.object({
  company: z.string().trim().max(300).optional().default(""),
  roleTitle: z.string().trim().max(300).optional().default(""),
  jobDescription: z.string().trim().min(1).max(200_000),
  jobPostingUrl: z.string().trim().max(2000).optional(),
  jobPostingId: z.string().trim().max(200).optional(),
  applicationDeadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

/** Local-only intake endpoint for bookmarklets, CLI scripts, or local automation workflows (manual review remains required). */
export async function POST(request: Request) {
  const denied = guardApiRequest(request, "json"); if (denied) return denied;
  try {
    const parsed = IntakeRequestSchema.safeParse(await readObjectRequest(request));
    if (!parsed.success) return NextResponse.json({ error: "Invalid intake payload" }, { status: 400 });
    const now = new Date().toISOString();
    const { company, roleTitle, jobDescription, jobPostingUrl, jobPostingId, applicationDeadline } = parsed.data;
    const duplicates = findDuplicateOffers({ company, roleTitle, jobPostingUrl }, loadApplications());
    const id = `prep_${randomUUID().slice(0, 12)}`;
    const list = upsertOfferPreparation({
      id,
      createdAt: now,
      updatedAt: now,
      company,
      roleTitle,
      jobDescription,
      ...(jobPostingUrl ? { jobPostingUrl } : {}),
      ...(jobPostingId ? { jobPostingId } : {}),
      ...(applicationDeadline ? { applicationDeadline } : {}),
      promptContext: {
        version: PROMPT_VERSION,
        generatedAt: now,
        options: { targetLanguage: "auto", strategyAngle: "auto", tonePreset: "auto", cvLengthMode: "auto_clean", emphasisHighlights: [] },
      },
    });
    return NextResponse.json({ id, duplicates, count: list.length });
  } catch (err) {
    return apiError(err);
  }
}
