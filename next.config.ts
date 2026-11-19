import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

const HTML_SECURITY_HEADERS = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "frame-src 'self' blob:",
      "connect-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  distDir: /^\.next-[a-z0-9-]+$/.test(process.env.JOB_DIST_DIR || "")
    ? process.env.JOB_DIST_DIR!
    : process.env.JOB_DEVELOPMENT === "1"
    ? ".next-development"
    : ".next",
  async headers() {
    return [
      {
        source: "/((?!_next/static|_next/image|favicon.ico).*)",
        headers: HTML_SECURITY_HEADERS,
      },
    ];
  },
  webpack: (config) => {
    config.watchOptions = {
      ignored: ["**/exports/**", "**/data/**", "**/.local/**", "**/node_modules/**"],
    };
    return config;
  },
};

export default nextConfig;
