export type ApiBodyType = "json" | "multipart";

export class RequestSecurityError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
    this.name = "RequestSecurityError";
  }
}

export function privateResponseHeaders(): Record<string, string> {
  return {
    "Cache-Control": "private, no-store, max-age=0",
    "X-Content-Type-Options": "nosniff",
    "Cross-Origin-Resource-Policy": "same-origin",
    "Referrer-Policy": "no-referrer",
  };
}

export function securityError(message: string, status = 400): Response {
  return Response.json({ error: message }, { status, headers: privateResponseHeaders() });
}

function isLoopbackHost(hostname: string): boolean {
  return ["localhost", "127.0.0.1", "[::1]"].includes(hostname.toLowerCase());
}

/** Local-only boundary. Absent Origin permits local CLI clients, never remote hosts. */
export function guardApiRequest(request: Request, expected?: ApiBodyType): Response | null {
  let target: URL;
  try {
    target = new URL(request.url);
  } catch {
    return securityError("Invalid request address", 400);
  }
  if (!["http:", "https:"].includes(target.protocol) || !isLoopbackHost(target.hostname)) {
    return securityError("Only local application requests are allowed", 403);
  }

  const host = request.headers.get("host");
  let authority = target;
  if (host) {
    if (!/^(localhost|127\.0\.0\.1|\[::1\])(?::\d{1,5})?$/i.test(host)) {
      return securityError("Unrecognized application host", 403);
    }
    try {
      authority = new URL(`${target.protocol}//${host}`);
      if (!isLoopbackHost(authority.hostname) || authority.port !== target.port) {
        return securityError("Unrecognized application host", 403);
      }
    } catch {
      return securityError("Unrecognized application host", 403);
    }
  }

  const origin = request.headers.get("origin");
  if (origin) {
    try {
      const source = new URL(origin);
      if (source.origin !== authority.origin || source.origin !== origin) {
        return securityError("Cross-origin requests are not allowed", 403);
      }
    } catch {
      return securityError("Cross-origin requests are not allowed", 403);
    }
  }
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") {
    return securityError("Cross-site requests are not allowed", 403);
  }

  if (expected) {
    const contentType = request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
    const required = expected === "json" ? "application/json" : "multipart/form-data";
    if (contentType !== required) return securityError(`Expected ${required}`, 415);
  }
  return null;
}

/** Bound the stream itself, including requests without a Content-Length header. */
export async function readRequestBytes(request: Request, maxBytes: number): Promise<Uint8Array> {
  const declaredLength = request.headers.get("content-length");
  if (declaredLength && (!/^\d+$/.test(declaredLength) || Number(declaredLength) > maxBytes)) {
    throw new RequestSecurityError("Request body exceeds the permitted size", 413);
  }
  if (!request.body) throw new RequestSecurityError("Missing request body");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > maxBytes) {
        await reader.cancel();
        throw new RequestSecurityError("Request body exceeds the permitted size", 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

export async function readJsonRequest(request: Request, maxBytes = 8 * 1024 * 1024): Promise<unknown> {
  const bytes = await readRequestBytes(request, maxBytes);
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    throw new RequestSecurityError("Invalid JSON body");
  }
}
