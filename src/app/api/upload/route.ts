import { NextResponse } from "next/server";
import { saveUploadFile } from "@/lib/storage";

const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

const ALLOWED_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
]);

const ALLOWED_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp"]);

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const type = formData.get("type") as "signature" | "photo" | null;

    if (!file || !type) {
      return NextResponse.json({ error: "Missing file or upload type" }, { status: 400 });
    }

    if (type !== "signature" && type !== "photo") {
      return NextResponse.json({ error: "Invalid upload type (must be signature or photo)" }, { status: 400 });
    }

    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json({ error: "File size exceeds 5MB limit" }, { status: 400 });
    }

    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: "Unsupported file type. Use PNG, JPG, JPEG, or WEBP." },
        { status: 400 }
      );
    }

    const cleanBaseName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "");
    const ext = cleanBaseName.substring(cleanBaseName.lastIndexOf(".")).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return NextResponse.json({ error: "Invalid file extension." }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Simple magic bytes check for images
    if (buffer.length < 4) {
      return NextResponse.json({ error: "Invalid file payload" }, { status: 400 });
    }

    const isPng = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
    const isJpg = buffer[0] === 0xff && buffer[1] === 0xd8;
    const isWebp = buffer.slice(0, 4).toString("utf-8") === "RIFF" || ext === ".webp";

    if (!isPng && !isJpg && !isWebp) {
      return NextResponse.json({ error: "File content does not match allowed image format." }, { status: 400 });
    }

    const publicUrl = saveUploadFile(buffer, cleanBaseName, type);
    return NextResponse.json({ success: true, url: publicUrl });
  } catch (err: any) {
    console.error("Upload handler error:", err);
    return NextResponse.json({ error: err.message || "Failed to upload file" }, { status: 500 });
  }
}
