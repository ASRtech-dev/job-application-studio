import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { StorageError } from "./storage";
import { RequestSecurityError, privateResponseHeaders, readJsonRequest } from "./requestSecurity";
import { ImportValidationError } from "./aiJsonMapper";

export async function readObjectRequest(request: Request): Promise<Record<string, unknown>> {
  const value = await readJsonRequest(request);
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new RequestSecurityError("Expected a JSON object.", 400);
  return value as Record<string, unknown>;
}

export function apiError(error: unknown): Response {
  const baseHeaders = privateResponseHeaders();
  if (error instanceof ImportValidationError) {
    return NextResponse.json({ error: error.message, code: "IMPORT_VALIDATION" }, { status: 400, headers: baseHeaders });
  }
  if (error instanceof ZodError) {
    return NextResponse.json({ error: "Validation failed.", code: "SCHEMA_VALIDATION", details: error.flatten() }, { status: 400, headers: baseHeaders });
  }
  if (error instanceof StorageError) {
    const code = error.status === 409 ? "REVISION_CONFLICT" : error.status === 503 ? "LOCK_BUSY" : error.status === 404 ? "NOT_FOUND" : "STORAGE_ERROR";
    const headers = error.status === 503 ? { ...baseHeaders, "Retry-After": "1" } : baseHeaders;
    return NextResponse.json({ error: error.message, code }, { status: error.status, headers });
  }
  if (error instanceof RequestSecurityError) {
    return NextResponse.json({ error: error.message, code: "SECURITY_REJECTED" }, { status: error.status, headers: baseHeaders });
  }
  console.error("Unhandled API error:", error instanceof Error ? error.stack || error.message : error);
  return NextResponse.json({ error: "Could not complete the operation on the local server.", code: "INTERNAL_ERROR" }, { status: 500, headers: baseHeaders });
}

export function expectedRevision(value: unknown): number {
  if (value === undefined) return 0; // Legacy clients may save an untouched legacy record once.
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) throw new RequestSecurityError("Invalid revision.", 400);
  return value;
}
