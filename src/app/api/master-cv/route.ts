import { NextResponse } from "next/server";
import { loadMasterCv, saveMasterCv } from "@/lib/storage";
import { MasterCvSchema } from "@/lib/schemas";

export async function GET() {
  try {
    const data = loadMasterCv();
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to load master CV" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = MasterCvSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", details: parsed.error.format() }, { status: 400 });
    }
    saveMasterCv(parsed.data);
    return NextResponse.json({ success: true, data: parsed.data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to save master CV" }, { status: 500 });
  }
}
