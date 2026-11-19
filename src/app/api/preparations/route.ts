import { NextResponse } from "next/server";
import { guardApiRequest } from "@/lib/requestSecurity";
import { apiError, readObjectRequest } from "@/lib/apiErrors";
import { OfferPreparationSchema } from "@/lib/offerPreparations";
import { deleteOfferPreparation, loadOfferPreparations, upsertOfferPreparation } from "@/lib/storage";

export async function GET(request: Request) {
  const denied = guardApiRequest(request); if (denied) return denied;
  try {
    return NextResponse.json(loadOfferPreparations());
  } catch (err) {
    return apiError(err);
  }
}

export async function POST(request: Request) {
  const denied = guardApiRequest(request, "json"); if (denied) return denied;
  try {
    const body = await readObjectRequest(request);
    const parsed = OfferPreparationSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Invalid preparation payload" }, { status: 400 });
    return NextResponse.json(upsertOfferPreparation(parsed.data));
  } catch (err) {
    return apiError(err);
  }
}

export async function DELETE(request: Request) {
  const denied = guardApiRequest(request); if (denied) return denied;
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id")?.trim();
    if (!id) return NextResponse.json({ error: "Missing preparation id" }, { status: 400 });
    return NextResponse.json(deleteOfferPreparation(id));
  } catch (err) {
    return apiError(err);
  }
}
