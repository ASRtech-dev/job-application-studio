import fs from "node:fs";
import { NextResponse } from "next/server";
import { apiError } from "@/lib/apiErrors";
import { guardApiRequest, privateResponseHeaders, securityError } from "@/lib/requestSecurity";
import { resolveUploadFilePath } from "@/lib/storage";

type RouteContext = { params: Promise<{ path: string[] }> };

/**
 * Serves runtime-uploaded photo and signature assets dynamically.
 * Required so files written under `public/uploads` after `next build` / `next start`
 * render immediately without rebuilding or restarting the server.
 */
export async function GET(request: Request, { params }: RouteContext) {
  const denied = guardApiRequest(request);
  if (denied) return denied;
  try {
    const { path: segments } = await params;
    if (!Array.isArray(segments) || segments.length < 2 || segments.length > 3) {
      return securityError("Upload not found", 404);
    }
    if (segments.some((segment) => !/^[A-Za-z0-9_.-]+$/.test(segment) || segment === "." || segment === "..")) {
      return securityError("Invalid upload path", 400);
    }

    const resolved = resolveUploadFilePath(`/uploads/${segments.join("/")}`);
    if (!resolved) {
      return securityError("Upload not found", 404);
    }

    const bytes = fs.readFileSync(resolved.filePath);
    return new NextResponse(bytes, {
      status: 200,
      headers: {
        ...privateResponseHeaders(),
        "Content-Security-Policy": "default-src 'none'; sandbox",
        "Content-Type": resolved.mimeType,
        "Content-Length": String(bytes.byteLength),
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
