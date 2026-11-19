import { chromium, type Browser, type BrowserContext } from "playwright";
import { PDFDocument, PDFName, PDFNull, PDFNumber, PDFString } from "pdf-lib";
import fs from "fs";
import path from "path";
import { sanitizeFilename } from "./filenames";
import { SAFE_REFERENCE_ID_PATTERN } from "./referenceDocuments";
import { readSafeReferencePdf } from "./referenceDocumentsServer";
import { RequestSecurityError } from "./requestSecurity";
import { paginatePrintableDocument } from "./documentPagination";
export { sanitizeFilename } from "./filenames";

export const PDF_LIMITS = {
  htmlBytes: 8 * 1024 * 1024,
  requestBytes: 16 * 1024 * 1024,
  mergeHtmlBytes: 12 * 1024 * 1024,
  parts: 12,
  pdfBytes: 30 * 1024 * 1024,
  portalWarningBytes: 2 * 1024 * 1024,
  imageBytes: 5 * 1024 * 1024,
  renderTimeoutMs: 60000,
} as const;

async function closeBrowserContext(context: BrowserContext | null): Promise<void> {
  if (context) await context.close().catch(() => {});
}

export function validatePdfHtml(html: unknown): asserts html is string {
  if (typeof html !== "string" || !html.trim()) throw new RequestSecurityError("Missing HTML content");
  if (Buffer.byteLength(html, "utf8") > PDF_LIMITS.htmlBytes) throw new RequestSecurityError("Document HTML exceeds the permitted size", 413);
}

export function safePdfFilename(fileName: string | undefined, fallback: string): string {
  let base = (sanitizeFilename((fileName || fallback).replace(/\.pdf$/i, "")).slice(0, 120)).replace(/[_-]+$/g, "") || "Application_Document";
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(base)) base = `_${base}`;
  return `${base}.pdf`;
}

function staysWithin(candidate: string, directory: string): boolean {
  const relative = path.relative(directory, candidate);
  return relative !== "" && !relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative);
}

export function savePdfExport(bytes: Uint8Array, filename: string, company?: string): void {
  if (bytes.length > PDF_LIMITS.pdfBytes) throw new RequestSecurityError("PDF exceeds the permitted size", 413);
  const exportsRoot = path.resolve(process.env.JOB_EXPORTS_DIR || path.join(process.cwd(), "exports"));
  let companyFolder = sanitizeFilename(company || "").slice(0, 100);
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(companyFolder)) companyFolder = `_${companyFolder}`;
  const directory = companyFolder ? path.join(exportsRoot, companyFolder) : exportsRoot;
  fs.mkdirSync(directory, { recursive: true });
  const actualRoot = fs.realpathSync(exportsRoot);
  const actualDirectory = fs.realpathSync(directory);
  if (actualDirectory !== actualRoot && !staysWithin(actualDirectory, actualRoot)) throw new RequestSecurityError("Export directory is not permitted", 403);
  const destination = path.join(actualDirectory, safePdfFilename(filename, "Application_Document"));
  let linked = false;
  try { linked = fs.lstatSync(destination).isSymbolicLink(); } catch { /* New file. */ }
  if (!staysWithin(destination, actualDirectory) || linked || fs.existsSync(destination) && !staysWithin(fs.realpathSync(destination), actualDirectory)) {
    throw new RequestSecurityError("Export destination is not permitted", 403);
  }
  fs.writeFileSync(destination, bytes);
}

/**
 * Safe validated lookup for user-supplied reference PDFs under public/documents/.
 * Arbitrary filesystem paths, symlinks, and directory traversal are always rejected.
 */
export async function readReferencePdf(part: { id?: string; content?: string }): Promise<Uint8Array> {
  const legacyPath = "public/documents/references.pdf";

  // Dynamic single-segment filename inside public/documents/
  if (part.id && part.content === undefined && SAFE_REFERENCE_ID_PATTERN.test(part.id)) {
    const loaded = await readSafeReferencePdf(part.id);
    if (!loaded) {
      throw new RequestSecurityError("Reference document is not available or not permitted", 404);
    }
    if (loaded.bytes.length > PDF_LIMITS.pdfBytes) {
      throw new RequestSecurityError("Reference document exceeds the permitted size", 413);
    }
    return loaded.bytes;
  }

  // Legacy combined references.pdf support (only via exact id "references" or explicit server env override)
  const isLegacyRequest =
    part.id !== undefined
      ? part.id === "references" && (part.content === undefined || part.content === legacyPath)
      : part.content === legacyPath;
  if (!isLegacyRequest) {
    throw new RequestSecurityError("Unknown reference document", 403);
  }

  const file = path.resolve(
    process.env.JOB_REFERENCES_PDF || path.join(process.cwd(), "public", "documents", "references.pdf")
  );
  const directory = path.dirname(file);
  if (!fs.existsSync(file)) throw new RequestSecurityError("Reference document is not available", 404);
  if (fs.lstatSync(file).isSymbolicLink()) throw new RequestSecurityError("Reference document is not permitted", 403);
  if (!staysWithin(fs.realpathSync(file), fs.realpathSync(directory))) {
    throw new RequestSecurityError("Reference document is not permitted", 403);
  }
  const stat = fs.statSync(file);
  if (!stat.isFile() || stat.size > PDF_LIMITS.pdfBytes) {
    throw new RequestSecurityError("Reference document exceeds the permitted size", 413);
  }
  const bytes = fs.readFileSync(file);
  if (bytes.subarray(0, 5).toString("ascii") !== "%PDF-") {
    throw new RequestSecurityError("Invalid reference PDF");
  }
  return new Uint8Array(bytes);
}

/** Validate declared type, extension, container signature and dimensions before decoding. */
export function inspectUploadedImage(bytes: Buffer, filename: string, declaredMime: string): { mime: string; width: number; height: number } {
  const extension = path.extname(filename).toLowerCase();
  const mime = declaredMime === "image/jpg" ? "image/jpeg" : declaredMime;
  const extensions: Record<string, string[]> = { "image/png": [".png"], "image/jpeg": [".jpg", ".jpeg"], "image/webp": [".webp"] };
  if (!extensions[mime]?.includes(extension)) throw new RequestSecurityError("Image type and extension must match PNG, JPEG or WEBP");
  if (!bytes.length || bytes.length > PDF_LIMITS.imageBytes) throw new RequestSecurityError("Image must be between 1 byte and 5 MB", 413);
  let width = 0;
  let height = 0;
  if (mime === "image/png") {
    if (bytes.length < 33 || !bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) || bytes.readUInt32BE(8) !== 13 || bytes.toString("ascii", 12, 16) !== "IHDR") {
      throw new RequestSecurityError("Invalid PNG image");
    }
    width = bytes.readUInt32BE(16);
    height = bytes.readUInt32BE(20);
  } else if (mime === "image/jpeg") {
    if (bytes.length < 4 || bytes[0] !== 255 || bytes[1] !== 216 || bytes[bytes.length - 2] !== 255 || bytes[bytes.length - 1] !== 217) {
      throw new RequestSecurityError("Invalid JPEG image");
    }
    let offset = 2;
    for (let segments = 0; offset + 3 < bytes.length && segments < 4096; segments++) {
      if (bytes[offset] !== 255) break;
      while (offset < bytes.length && bytes[offset] === 255) offset++;
      const marker = bytes[offset++];
      if (marker === 217 || marker === 218 || offset + 1 >= bytes.length) break;
      const length = bytes.readUInt16BE(offset);
      if (length < 2 || offset + length > bytes.length) break;
      if ([192, 193, 194, 195, 197, 198, 199, 201, 202, 203, 205, 206, 207].includes(marker) && length >= 8) {
        height = bytes.readUInt16BE(offset + 3);
        width = bytes.readUInt16BE(offset + 5);
        break;
      }
      offset += length;
    }
  } else {
    if (bytes.length < 25 || bytes.toString("ascii", 0, 4) !== "RIFF" || bytes.toString("ascii", 8, 12) !== "WEBP" || bytes.readUInt32LE(4) !== bytes.length - 8) {
      throw new RequestSecurityError("Invalid WEBP image");
    }
    const kind = bytes.toString("ascii", 12, 16);
    const chunkLength = bytes.readUInt32LE(16);
    if (chunkLength + 20 > bytes.length) throw new RequestSecurityError("Invalid WEBP image");
    if (kind === "VP8X" && chunkLength >= 10 && bytes.length >= 30) {
      width = bytes.readUIntLE(24, 3) + 1;
      height = bytes.readUIntLE(27, 3) + 1;
    } else if (kind === "VP8L" && chunkLength >= 5 && bytes[20] === 47) {
      const dimensions = bytes.readUInt32LE(21);
      width = (dimensions & 16383) + 1;
      height = (dimensions >>> 14 & 16383) + 1;
    } else if (kind === "VP8 " && chunkLength >= 10 && bytes.length >= 30 && bytes.toString("hex", 23, 26) === "9d012a") {
      width = bytes.readUInt16LE(26) & 16383;
      height = bytes.readUInt16LE(28) & 16383;
    }
  }
  if (!width || !height || width > 8192 || height > 8192 || width * height > 20000000) throw new RequestSecurityError("Invalid or oversized image dimensions");
  return { mime, width, height };
}

/** Decode in the existing offline browser rather than trusting magic bytes alone. */
export async function verifyImageDecodes(bytes: Buffer, mime: string): Promise<boolean> {
  let context: BrowserContext | null = null;
  let expired = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const operation = async () => {
    const browser = await getSharedBrowser();
    if (expired) return false;
    context = await browser.newContext({ javaScriptEnabled: false, serviceWorkers: "block" });
    if (expired) { await context.close(); return false; }
    await context.route("**/*", (route) => route.abort("blockedbyclient"));
    const page = await context.newPage();
    return page.evaluate(async ({ encoded, type }) => {
      try {
        const raw = atob(encoded);
        const buffer = Uint8Array.from(raw, (character) => character.charCodeAt(0));
        const image = await createImageBitmap(new Blob([buffer], { type }));
        const valid = image.width > 0 && image.height > 0 && image.width * image.height <= 20000000;
        image.close();
        return valid;
      } catch { return false; }
    }, { encoded: bytes.toString("base64"), type: mime });
  };
  try {
    return await Promise.race([operation(), new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        expired = true;
        void closeBrowserContext(context);
        reject(new RequestSecurityError("Image validation timed out", 504));
      }, PDF_LIMITS.renderTimeoutMs);
    })]);
  } finally {
    if (timer) clearTimeout(timer);
    await closeBrowserContext(context);
  }
}

/** Downscales oversized uploaded portrait photos (>560px) to print-sharp ~500px JPEG so PDFs stay comfortably under 2 MB. */
export async function optimizePortraitPhotoBuffer(bytes: Buffer, mime: string, width: number): Promise<{ buffer: Buffer; mime: string; ext?: string }> {
  if (width <= 560) return { buffer: bytes, mime };
  let context: BrowserContext | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let expired = false;
  const operation = async () => {
    const browser = await getSharedBrowser();
    if (expired) return null;
    context = await browser.newContext({ javaScriptEnabled: false, serviceWorkers: "block" });
    if (expired) { await closeBrowserContext(context); return null; }
    await context.route("**/*", (route) => route.abort("blockedbyclient"));
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    return page.evaluate(async ({ encoded, type }) => {
      try {
        const raw = atob(encoded);
        const buf = Uint8Array.from(raw, (ch) => ch.charCodeAt(0));
        const bitmap = await createImageBitmap(new Blob([buf], { type }));
        const maxWidth = 500;
        if (bitmap.width <= maxWidth) { bitmap.close(); return null; }
        const scale = maxWidth / bitmap.width;
        const canvas = document.createElement("canvas");
        canvas.width = maxWidth;
        canvas.height = Math.max(1, Math.round(bitmap.height * scale));
        const ctx = canvas.getContext("2d");
        if (!ctx) { bitmap.close(); return null; }
        ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        bitmap.close();
        return canvas.toDataURL("image/jpeg", 0.86).split(",")[1] || null;
      } catch {
        return null;
      }
    }, { encoded: bytes.toString("base64"), type: mime });
  };
  try {
    const optimizedB64 = await Promise.race([
      operation(),
      new Promise<null>((resolve) => {
        timer = setTimeout(() => {
          expired = true;
          void closeBrowserContext(context);
          resolve(null);
        }, 12000);
      }),
    ]);
    if (optimizedB64) {
      const out = Buffer.from(optimizedB64, "base64");
      if (out.length > 0 && out.length < bytes.length) {
        return { buffer: out, mime: "image/jpeg", ext: ".jpeg" };
      }
    }
  } catch {
    // Non-fatal fallback: store validated original bytes.
  } finally {
    if (timer) clearTimeout(timer);
    await closeBrowserContext(context);
  }
  return { buffer: bytes, mime };
}

const CHROMIUM_ARGS = [
  "--no-sandbox",
  "--disable-setuid-sandbox",
  "--disable-gpu",
  "--disable-dev-shm-usage",
  "--no-first-run",
  "--no-default-browser-check",
  "--disable-extensions",
  "--disable-background-networking",
];

declare global {
  var __pdfChromiumBrowser: Browser | null | undefined;
  var __pdfChromiumLaunchPromise: Promise<Browser> | null | undefined;
  var __cachedInterFontFaceCss: string | undefined;
  var __cachedFontFaceRulesByFamily: Map<string, string[]> | undefined;
}

export interface PdfMetadataInput {
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string[];
  documentType?: string;
  company?: string;
  roleTitle?: string;
  language?: string;
  creator?: string;
  producer?: string;
}

const DOC_TYPE_LABELS_BY_LANG: Record<"English" | "German" | "Spanish", Record<string, string>> = {
  English: {
    cv: "CV",
    "master-cv": "Master CV",
    letter: "Cover Letter",
    prep: "STAR Interview Prep",
    references: "References",
    "cv-refs": "CV & References",
    "letter-refs": "Cover Letter & References",
    "full-bundle": "Application Bundle",
    "ats-bundle": "ATS Application Bundle",
    bundle: "Application Bundle",
  },
  German: {
    cv: "Lebenslauf",
    "master-cv": "Master-Lebenslauf",
    letter: "Anschreiben",
    prep: "Interview-Vorbereitung",
    references: "Zeugnisse & Nachweise",
    "cv-refs": "Lebenslauf & Zeugnisse",
    "letter-refs": "Anschreiben & Zeugnisse",
    "full-bundle": "Bewerbungsmappe",
    "ats-bundle": "ATS-Bewerbungsunterlagen",
    bundle: "Bewerbungsmappe",
  },
  Spanish: {
    cv: "Currículum",
    "master-cv": "CV Maestro",
    letter: "Carta de presentación",
    prep: "Preparación de entrevista",
    references: "Referencias y certificados",
    "cv-refs": "Currículum y referencias",
    "letter-refs": "Carta y referencias",
    "full-bundle": "Dossier de candidatura",
    "ats-bundle": "Dossier ATS de candidatura",
    bundle: "Dossier de candidatura",
  },
};

function normalizedMetaLang(language?: string): "English" | "German" | "Spanish" {
  const norm = (language || "").trim().toLowerCase();
  if (norm === "german" || norm === "de" || norm === "de-de") return "German";
  if (norm === "spanish" || norm === "es" || norm === "es-es") return "Spanish";
  return "English";
}

const BUNDLED_FONT_PACKAGES: Array<{ family: string; pkg: string; weights: string[] }> = [
  { family: "Inter", pkg: "inter", weights: ["300", "400", "400-italic", "500", "600", "600-italic", "700", "700-italic"] },
  { family: "IBM Plex Sans", pkg: "ibm-plex-sans", weights: ["400", "400-italic", "500", "600", "600-italic", "700", "700-italic"] },
  { family: "IBM Plex Serif", pkg: "ibm-plex-serif", weights: ["400", "400-italic", "500", "600", "600-italic", "700", "700-italic"] },
  { family: "Plus Jakarta Sans", pkg: "plus-jakarta-sans", weights: ["400", "400-italic", "500", "600", "600-italic", "700", "700-italic"] },
];

/**
 * Parses @font-face latin & latin-ext rules from local @fontsource CSS and inlines WOFF2 fonts as base64 data URLs.
 */
function loadFontFamilyRules(familyName: string): string[] {
  if (!globalThis.__cachedFontFaceRulesByFamily) {
    globalThis.__cachedFontFaceRulesByFamily = new Map();
  }
  const cached = globalThis.__cachedFontFaceRulesByFamily.get(familyName);
  if (cached !== undefined) return cached;

  const spec = BUNDLED_FONT_PACKAGES.find((item) => item.family.toLowerCase() === familyName.toLowerCase());
  if (!spec) {
    globalThis.__cachedFontFaceRulesByFamily.set(familyName, []);
    return [];
  }

  const pkgDir = path.resolve(process.cwd(), "node_modules", "@fontsource", spec.pkg);
  const publicFontDir = path.resolve(process.cwd(), "public", "fonts");
  const rules: string[] = [];

  for (const weightFile of spec.weights) {
    const cssPath = path.join(pkgDir, `${weightFile}.css`);
    if (!fs.existsSync(cssPath)) continue;
    try {
      const css = fs.readFileSync(cssPath, "utf8");
      const blockRegex = /\/\*\s*([a-z0-9-]+-latin(?:-ext)?-[^*]+?)\s*\*\/\s*@font-face\s*\{([^}]+)\}/gi;
      let match: RegExpExecArray | null;
      while ((match = blockRegex.exec(css)) !== null) {
        const blockBody = match[2];
        const woff2Match = blockBody.match(/url\(\.\/files\/([^)]+\.woff2)\)/i);
        if (!woff2Match) continue;
        const fileName = woff2Match[1];
        const candidatePaths = [path.join(pkgDir, "files", fileName), path.join(publicFontDir, fileName)];
        const resolvedPath = candidatePaths.find((p) => fs.existsSync(p));
        if (!resolvedPath) continue;
        const b64 = fs.readFileSync(resolvedPath).toString("base64");
        const inlinedBody = blockBody.replace(
          /src:\s*[^;]+;/i,
          `src: url('data:font/woff2;base64,${b64}') format('woff2');`
        );
        rules.push(`@font-face {${inlinedBody}}`);
      }
    } catch (err) {
      console.warn("Failed to inline local font CSS:", cssPath, err);
    }
  }

  globalThis.__cachedFontFaceRulesByFamily.set(familyName, rules);
  return rules;
}

/**
 * Loads and caches base64 @font-face rules for Inter from the locally installed @fontsource/inter package.
 */
export function getLocalInterFontFaceCss(): string {
  if (globalThis.__cachedInterFontFaceCss !== undefined) {
    return globalThis.__cachedInterFontFaceCss;
  }
  const rules = loadFontFamilyRules("Inter");
  globalThis.__cachedInterFontFaceCss = rules.length > 0 ? `<style data-local-fonts="inter">\n${rules.join("\n")}\n</style>` : "";
  return globalThis.__cachedInterFontFaceCss;
}

/**
 * Strips remote Google Fonts links and embeds local @font-face rules for all referenced bundled families.
 */
export function injectLocalFonts(html: string): string {
  const cleanedHtml = html.replace(/<link[^>]*href=["']https?:\/\/fonts\.googleapis\.com[^"']*["'][^>]*\/?>/gi, "");
  if (cleanedHtml.includes('data-local-fonts=')) {
    return cleanedHtml;
  }

  const lower = cleanedHtml.toLowerCase();
  const referenced = BUNDLED_FONT_PACKAGES.filter((spec) => lower.includes(spec.family.toLowerCase())).map((spec) => spec.family);
  if (!referenced.length) referenced.push("Inter");

  const rules = referenced.flatMap((family) => loadFontFamilyRules(family));
  if (!rules.length) {
    return cleanedHtml;
  }

  const fontStyleBlock = `<style data-local-fonts="${referenced.join(",").toLowerCase()}">\n${rules.join("\n")}\n</style>`;
  if (/<\/head>/i.test(cleanedHtml)) {
    return cleanedHtml.replace(/<\/head>/i, `${fontStyleBlock}\n</head>`);
  }
  return `${fontStyleBlock}\n${cleanedHtml}`;
}

/**
 * Normalizes a language label ("English", "German", "Spanish") into an ISO BCP-47 PDF language tag.
 */
export function toPdfLanguageTag(language?: string): string {
  const lang = normalizedMetaLang(language);
  if (lang === "German") return "de-DE";
  if (lang === "Spanish") return "es-ES";
  return "en-US";
}

function buildLocalizedSubject(lang: "English" | "German" | "Spanish", docLabel: string, roleTitle: string, company: string): string {
  if (lang === "German") {
    if (roleTitle && company) return `${docLabel} für ${roleTitle} bei ${company}`;
    return company ? `${docLabel} für ${company}` : docLabel;
  }
  if (lang === "Spanish") {
    if (roleTitle && company) return `${docLabel} para ${roleTitle} en ${company}`;
    return company ? `${docLabel} para ${company}` : docLabel;
  }
  if (roleTitle && company) return `${docLabel} for ${roleTitle} at ${company}`;
  return company ? `${docLabel} for ${company}` : docLabel;
}

/**
 * Applies standard Info / XMP metadata (/Title, /Author, /Subject, /Keywords, /Lang) onto a pdf-lib PDFDocument.
 */
export function applyPdfMetadata(pdfDoc: PDFDocument, meta: PdfMetadataInput): void {
  const lang = normalizedMetaLang(meta.language);
  const author = (meta.author || "").trim();
  const rawCompany = (meta.company || "").trim();
  const company = rawCompany === "Master_CV" || rawCompany === "Master Profile" ? "" : rawCompany;
  const roleTitle = (meta.roleTitle || "").trim();
  const docType = meta.documentType || "cv";
  const docLabel = DOC_TYPE_LABELS_BY_LANG[lang][docType] || DOC_TYPE_LABELS_BY_LANG[lang].cv;

  const computedTitle =
    (meta.title || "").trim() ||
    [author, docLabel, roleTitle, company].filter(Boolean).join(" - ");

  const computedSubject =
    (meta.subject || "").trim() ||
    buildLocalizedSubject(lang, docLabel, roleTitle, company);

  const includeCvKeywords = !["letter", "prep", "references"].includes(docType);
  const uniqueKeywords = Array.from(
    new Set(
      [...(includeCvKeywords ? meta.keywords || [] : []), roleTitle, company, docLabel]
        .map((k) => k.trim())
        .filter(Boolean)
    )
  );

  pdfDoc.setTitle(computedTitle, { showInWindowTitleBar: true });
  if (author) pdfDoc.setAuthor(author);
  pdfDoc.setSubject(computedSubject);
  if (uniqueKeywords.length > 0) {
    pdfDoc.setKeywords(uniqueKeywords);
  }
  pdfDoc.setCreator(meta.creator || "Application Studio Export");
  pdfDoc.setProducer(meta.producer || "Chromium Print & PDF");
  pdfDoc.setLanguage(toPdfLanguageTag(meta.language));

  const now = new Date();
  pdfDoc.setCreationDate(now);
  pdfDoc.setModificationDate(now);
}

/** Adds top-level PDF /Outlines bookmarks pointing to the start page of each merged dossier part. */
export function applyMergedOutlines(merged: PDFDocument, entries: Array<{ title: string; pageIndex: number }>): void {
  const valid = entries.filter((e) => e.title.trim() && e.pageIndex >= 0 && e.pageIndex < merged.getPageCount());
  if (!valid.length) return;
  const ctx = merged.context;
  const pages = merged.getPages();
  const outlinesRef = ctx.nextRef();
  const itemRefs = valid.map(() => ctx.nextRef());
  valid.forEach((entry, i) => {
    const pageRef = pages[entry.pageIndex].ref;
    const itemDict = ctx.obj({
      Title: PDFString.of(entry.title.trim()),
      Parent: outlinesRef,
      Dest: [pageRef, PDFName.of("XYZ"), PDFNull, PDFNull, PDFNull],
    });
    if (i > 0) itemDict.set(PDFName.of("Prev"), itemRefs[i - 1]);
    if (i < valid.length - 1) itemDict.set(PDFName.of("Next"), itemRefs[i + 1]);
    ctx.assign(itemRefs[i], itemDict);
  });
  ctx.assign(
    outlinesRef,
    ctx.obj({
      Type: PDFName.of("Outlines"),
      First: itemRefs[0],
      Last: itemRefs[valid.length - 1],
      Count: PDFNumber.of(valid.length),
    })
  );
  merged.catalog.set(PDFName.of("Outlines"), outlinesRef);
  merged.catalog.set(PDFName.of("PageMode"), PDFName.of("UseOutlines"));
}

/**
 * Stamps PDF metadata onto raw PDF bytes and returns the updated bytes.
 */
export async function stampPdfMetadata(pdfBytes: Uint8Array, meta: PdfMetadataInput): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBytes);
  applyPdfMetadata(pdfDoc, meta);
  return new Uint8Array(await pdfDoc.save());
}


/**
 * Inlines `/uploads/...` image references inside HTML as base64 data URLs for offline Chromium rendering.
 */
export function convertImagesToBase64(html: string): string {
  const regex = /src=["'](\/uploads\/[^"']+)["']/g;
  let match: RegExpExecArray | null;
  let modifiedHtml = html;
  const publicDir = path.resolve(process.cwd(), "public");
  const uploadsDir = path.join(publicDir, "uploads", ...(process.env.JOB_DEVELOPMENT === "1" ? ["development"] : []));

  while ((match = regex.exec(html)) !== null) {
    const relativePath = match[1];
    const cleanRelativePath = relativePath.startsWith("/") ? relativePath.substring(1) : relativePath;
    const fullPath = path.resolve(publicDir, cleanRelativePath);

    if (!staysWithin(fullPath, uploadsDir) || ![".png", ".jpg", ".jpeg", ".webp"].includes(path.extname(fullPath).toLowerCase())) {
      continue;
    }

    if (fs.existsSync(fullPath)) {
      try {
        if (!staysWithin(fs.realpathSync(fullPath), fs.realpathSync(uploadsDir))) continue;
        const stat = fs.statSync(fullPath);
        if (!stat.isFile() || stat.size > PDF_LIMITS.imageBytes) continue;
        const fileBuffer = fs.readFileSync(fullPath);
        const ext = path.extname(fullPath).toLowerCase();
        let mimeType = "image/png";
        if (ext === ".jpg" || ext === ".jpeg") mimeType = "image/jpeg";
        else if (ext === ".webp") mimeType = "image/webp";

        const base64 = fileBuffer.toString("base64");
        const dataUrl = `data:${mimeType};base64,${base64}`;
        modifiedHtml = modifiedHtml.replaceAll(relativePath, dataUrl);
      } catch {
        // Missing/unreadable assets remain unresolved; the offline renderer never fetches them.
      }
    }
  }
  return modifiedHtml;
}

/**
 * Returns a shared, lazily initialized headless Chromium instance across PDF export requests.
 */
export async function getSharedBrowser(): Promise<Browser> {
  if (globalThis.__pdfChromiumBrowser && globalThis.__pdfChromiumBrowser.isConnected()) {
    return globalThis.__pdfChromiumBrowser;
  }

  if (globalThis.__pdfChromiumLaunchPromise) {
    return globalThis.__pdfChromiumLaunchPromise;
  }

  globalThis.__pdfChromiumLaunchPromise = chromium
    .launch({
      headless: true,
      args: CHROMIUM_ARGS,
      timeout: 60000, // 60s timeout to prevent Windows Defender cold-start timeouts
    })
    .then((browser) => {
      globalThis.__pdfChromiumBrowser = browser;
      globalThis.__pdfChromiumLaunchPromise = null;
      browser.on("disconnected", () => {
        if (globalThis.__pdfChromiumBrowser === browser) {
          globalThis.__pdfChromiumBrowser = null;
        }
      });
      return browser;
    })
    .catch((err) => {
      globalThis.__pdfChromiumLaunchPromise = null;
      globalThis.__pdfChromiumBrowser = null;
      throw err;
    });

  return globalThis.__pdfChromiumLaunchPromise;
}

export interface RenderedPdfResult {
  bytes: Uint8Array;
  pages: number;
  warnings: string[];
}

/**
 * Renders an HTML document into an A4 PDF buffer alongside measured page metadata.
 */
export async function renderHtmlToPdfWithMeta(html: string, options: { timeoutMs?: number } = {}): Promise<RenderedPdfResult> {
  validatePdfHtml(html);
  const offlineReadyHtml = injectLocalFonts(convertImagesToBase64(html));
  let context: BrowserContext | null = null;
  let expired = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutMs = Math.min(Math.max(options.timeoutMs ?? PDF_LIMITS.renderTimeoutMs, 1), PDF_LIMITS.renderTimeoutMs);
  const operation = async (): Promise<RenderedPdfResult> => {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const browser = await getSharedBrowser();
        if (expired) throw new RequestSecurityError("PDF rendering timed out", 504);
        context = await browser.newContext({ javaScriptEnabled: false, serviceWorkers: "block" });
        break;
      } catch (error) {
        if (expired || attempt === 1) throw error;
        const staleBrowser = globalThis.__pdfChromiumBrowser;
        globalThis.__pdfChromiumBrowser = null;
        void staleBrowser?.close().catch(() => {});
      }
    }
    if (!context) throw new Error("PDF context unavailable");
    if (expired) {
      await context.close();
      throw new RequestSecurityError("PDF rendering timed out", 504);
    }
    // Data URLs and about:blank do not need network. Abort every intercepted
    // request, including nested CSS/SVG resources, file URLs and redirects.
    await context.route("**/*", (route) => route.abort("blockedbyclient"));
    const page = await context.newPage();
    page.setDefaultTimeout(Math.min(timeoutMs, 25000));
    await page.setViewportSize({ width: 794, height: 1123 });
    await page.setContent(offlineReadyHtml, { waitUntil: "load", timeout: Math.min(timeoutMs, 10000) });
    await page.evaluate(() => document.fonts.ready);
    await page.emulateMedia({ media: "print" });
    const pagination = (await page.evaluate(paginatePrintableDocument)) as { pages?: number; warnings?: string[] } | undefined;
    const buffer = await page.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true, tagged: true, outline: true, margin: { top: "0px", bottom: "0px", left: "0px", right: "0px" } });
    if (buffer.length > PDF_LIMITS.pdfBytes) throw new RequestSecurityError("PDF exceeds the permitted size", 413);
    return {
      bytes: new Uint8Array(buffer),
      pages: typeof pagination?.pages === "number" ? pagination.pages : 0,
      warnings: Array.isArray(pagination?.warnings) ? pagination.warnings : [],
    };
  };
  try {
    return await Promise.race([
      operation(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          expired = true;
          void closeBrowserContext(context);
          reject(new RequestSecurityError("PDF rendering timed out", 504));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
    await closeBrowserContext(context);
  }
}

/**
 * Renders an HTML document into an A4 PDF buffer via Playwright with print media emulation.
 * Injects local fonts so PDF export runs instantaneously and 100% offline.
 */
export async function renderHtmlToPdf(html: string, options: { timeoutMs?: number } = {}): Promise<Uint8Array> {
  const result = await renderHtmlToPdfWithMeta(html, options);
  return result.bytes;
}
