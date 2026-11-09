import { NextResponse } from "next/server";
import { loadApplications, saveApplications, mirrorApplicationJson } from "@/lib/storage";
import { ApplicationSchema } from "@/lib/schemas";

function isValidId(id: string): boolean {
  return /^[a-zA-Z0-9_\-]{3,64}$/.test(id);
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!isValidId(id)) {
      return NextResponse.json({ error: "Invalid application identifier format" }, { status: 400 });
    }
    const list = loadApplications();
    const app = list.find((a) => a.id === id);
    if (!app) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }
    return NextResponse.json(app);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to load application" }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!isValidId(id)) {
      return NextResponse.json({ error: "Invalid application identifier format" }, { status: 400 });
    }
    const body = await req.json();
    const list = loadApplications();
    const idx = list.findIndex((a) => a.id === id);

    if (idx === -1) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }

    const parsed = ApplicationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", details: parsed.error.format() }, { status: 400 });
    }

    const updatedApp = parsed.data;
    updatedApp.id = id; // Ensure ID cannot be overridden
    updatedApp.dateModified = new Date().toISOString();

    list[idx] = updatedApp;
    saveApplications(list);
    mirrorApplicationJson(updatedApp);

    return NextResponse.json(updatedApp);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to update application" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!isValidId(id)) {
      return NextResponse.json({ error: "Invalid application identifier format" }, { status: 400 });
    }
    const list = loadApplications();
    const filtered = list.filter((a) => a.id !== id);

    if (list.length === filtered.length) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }

    saveApplications(filtered);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to delete application" }, { status: 500 });
  }
}
