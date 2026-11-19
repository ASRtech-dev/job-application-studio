import { NextResponse, type NextRequest } from "next/server";
import { guardApiRequest, privateResponseHeaders } from "./lib/requestSecurity";

export function proxy(request: NextRequest) {
  const rejected = guardApiRequest(request);
  if (rejected) return rejected;
  let response: NextResponse;
  if (request.nextUrl.pathname.startsWith("/uploads/")) {
    const rewriteUrl = request.nextUrl.clone();
    rewriteUrl.pathname = `/api${request.nextUrl.pathname}`;
    response = NextResponse.rewrite(rewriteUrl);
  } else {
    response = NextResponse.next();
  }
  for (const [name, value] of Object.entries(privateResponseHeaders())) response.headers.set(name, value);
  response.headers.set("X-Frame-Options", "DENY");
  if (!request.nextUrl.pathname.startsWith("/api/")) {
    response.headers.set("Content-Security-Policy", "default-src 'none'; sandbox");
  }
  return response;
}

export const config = {
  matcher: ["/api/:path*", "/uploads/:path*", "/documents/:path*"],
};
