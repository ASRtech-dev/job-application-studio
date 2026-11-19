#!/usr/bin/env node

/**
 * Automated Zero-PII & Personal-Data Privacy Gate for public release.
 * Scans tracked, staged, and non-ignored untracked files in the repository.
 * Usage:
 *   node scripts/check-pii-leak.mjs
 *   node scripts/check-pii-leak.mjs --staged
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const stagedOnly = process.argv.includes("--staged");

function gitList(args) {
  const out = execFileSync("git", args, { cwd: repoRoot, encoding: "utf8", maxBuffer: 20 * 1024 * 1024 });
  return out.split("\0").filter(Boolean);
}

const files = stagedOnly
  ? gitList(["diff", "--cached", "--name-only", "--diff-filter=ACMR", "-z"])
  : Array.from(
      new Set([
        ...gitList(["ls-files", "-z"]),
        ...gitList(["diff", "--cached", "--name-only", "--diff-filter=ACMR", "-z"]),
        ...gitList(["ls-files", "--others", "--exclude-standard", "-z"]),
      ])
    );

const BINARY_EXTS = new Set([".ico", ".woff", ".woff2", ".ttf", ".eot"]);
const FORBIDDEN_PATH_PATTERNS = [
  { name: "runtime-data", re: /^data\/(?!.*\.example\.json$|\.gitkeep$)/i },
  { name: "exports-dir", re: /^exports\//i },
  { name: "local-sandbox", re: /^\.local\//i },
  { name: "uploaded-assets", re: /^public\/(uploads|documents)\/(?!\.gitkeep$)/i },
  { name: "committed-pdf", re: /\.pdf$/i },
  { name: "secret-env", re: /^\.env(?!\.example$)/i },
];

// Sensitive tokens built indirectly so this scanner never triggers false self-matches when auditing.
const FORBIDDEN_CONTENT_RULES = [
  { name: "personal-first", re: new RegExp("\\bale" + "jandro\\b", "i") },
  { name: "personal-last1", re: new RegExp("s[aá]n" + "chez", "i") },
  { name: "personal-last2", re: new RegExp("ram[ií]" + "rez", "i") },
  { name: "personal-email-prefix", re: new RegExp("sr\\.?" + "alejandro|sralejandro", "i") },
  { name: "personal-os-user", re: new RegExp("(?:C:[\\\\/]|/)Users[\\\\/]dem" + "ok|\\bdem" + "ok\\b", "i") },
  { name: "personal-phone", re: new RegExp("7269" + "347|\\+49\\s*163\\b", "i") },
  { name: "personal-brand", re: new RegExp("atram" + "systems|atram\\s+systems", "i") },
  { name: "personal-project", re: new RegExp("nexus\\s+" + "command", "i") },
  { name: "personal-employer-1", re: new RegExp("\\bfound" + "ever\\b", "i") },
  { name: "personal-employer-2", re: new RegExp("\\barv" + "ato\\b|\\bmaj" + "orel\\b", "i") },
  { name: "personal-employer-3", re: new RegExp("\\bconcen" + "trix\\b", "i") },
  { name: "personal-school-1", re: new RegExp("wbs\\s*cod" + "ing|isPreWbs|edu-wbs", "i") },
  { name: "personal-school-2", re: new RegExp("las\\s+pal" + "mas|\\bulp" + "gc\\b", "i") },
  { name: "personal-cert-id", re: new RegExp("\\bmmjq" + "jvstyr\\b", "i") },
  { name: "personal-dates", re: new RegExp("dec\\s*1[01],?\\s*2026|1[01][./]12[./]2026", "i") },
  { name: "personal-metrics", re: new RegExp("700k|900k|\\bbene" + "lux\\b|\\bmedia" + "markt\\b|\\b3uk\\b|14\\s+european\\s+markets|13[- ]second", "i") },
  { name: "personal-sample-companies", re: new RegExp("\\bzal" + "ando\\b|oxg\\s+glas" + "faser", "i") },
  { name: "personal-bank", re: new RegExp("spark" + "asse|konto" + "ausz", "i") },
  { name: "personal-storage-key", re: new RegExp("\\basr_(?:default|sig|photo|autosave|master|dashboard|pending|offer)", "i") },
  { name: "personal-app-id", re: new RegExp("app_general_" + "master_en", "i") },
  { name: "personal-hobby", re: new RegExp("\\bwar" + "hammer\\b", "i") },
  { name: "personal-template-id", re: new RegExp("AsrSidebar|letter-template-asr", "i") },
  {
    name: "real-email-domain",
    re: /[a-z0-9._%+-]+@(?:gmail|outlook|hotmail|yahoo|icloud|proton|gmx|web\.de)\.[a-z]{2,}/i,
  },
];

const hits = [];

for (const rel of files) {
  const normalized = rel.replace(/\\/g, "/");
  for (const rule of FORBIDDEN_PATH_PATTERNS) {
    if (rule.re.test(normalized)) {
      hits.push(`${normalized}: [path:${rule.name}] Forbidden path in repository`);
    }
  }
  if (normalized === "scripts/check-pii-leak.mjs") continue;
  const full = path.join(repoRoot, rel);
  if (!fs.existsSync(full) || !fs.statSync(full).isFile()) continue;
  const ext = path.extname(normalized).toLowerCase();
  if (BINARY_EXTS.has(ext)) continue;
  if ([".png", ".jpg", ".jpeg", ".webp", ".gif"].includes(ext)) {
    hits.push(`${normalized}: [binary-image] Unexpected image file in repository`);
    continue;
  }
  const content = fs.readFileSync(full, "utf8");
  const lines = content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const rule of FORBIDDEN_CONTENT_RULES) {
      if (rule.re.test(line)) {
        hits.push(`${normalized}:${i + 1}: [${rule.name}] ${line.trim().slice(0, 120)}`);
      }
    }
  }
}

if (hits.length > 0) {
  console.error(`PII / Privacy check FAILED (${hits.length} issue(s) found):\n`);
  for (const hit of hits) console.error(`  - ${hit}`);
  process.exit(1);
}

console.log(`Zero-PII check PASSED across ${files.length} ${stagedOnly ? "staged " : ""}files.`);
