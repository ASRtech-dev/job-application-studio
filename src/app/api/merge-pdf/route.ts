import { NextResponse } from "next/server";
import { chromium, type Browser } from "playwright";
import { PDFDocument } from "pdf-lib";
import fs from "fs";
import path from "path";

const BASE_DIR = process.cwd();
const EXPORTS_DIR = path.join(BASE_DIR, "exports");
const UPLOADS_DIR = path.join(BASE_DIR, "public", "uploads");
const DOCUMENTS_DIR = path.join(BASE_DIR, "public", "documents");

function sanitizeFilename(name: string): string {
  return String(name || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9_\-]/g, "")
    .replace(/_+/g, "_")
    .slice(0, 100);
}

function convertImagesToBase64(html: string): string {
  const regex = /src=["'](\/uploads\/[^"']+)["']/g;
  let match;
  let modifiedHtml = html;

  while ((match = regex.exec(html)) !== null) {
    const relativePath = match[1];
    const cleanRelativePath = relativePath.startsWith("/") ? relativePath.substring(1) : relativePath;
    const fullPath = path.resolve(BASE_DIR, "public", cleanRelativePath);

    if (!fullPath.startsWith(path.resolve(UPLOADS_DIR) + path.sep)) {
      continue;
    }

    if (fs.existsSync(fullPath)) {
      try {
        const fileBuffer = fs.readFileSync(fullPath);
        const ext = path.extname(fullPath).toLowerCase();
        let mimeType = "image/png";
        if (ext === ".jpg" || ext === ".jpeg") mimeType = "image/jpeg";
        else if (ext === ".webp") mimeType = "image/webp";

        const base64 = fileBuffer.toString("base64");
        const dataUrl = `data:${mimeType};base64,${base64}`;
        modifiedHtml = modifiedHtml.replaceAll(relativePath, dataUrl);
      } catch (err) {
        console.error("Failed to convert image to base64:", fullPath, err);
      }
    }
  }
  return modifiedHtml;
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
  // eslint-disable-next-line no-var
  var __pdfChromiumBrowser: Browser | null | undefined;
  // eslint-disable-next-line no-var
  var __pdfChromiumLaunchPromise: Promise<Browser> | null | undefined;
}

async function getSharedBrowser(): Promise<Browser> {
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
      timeout: 60000,
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

async function renderHtmlToPdf(html: string): Promise<Uint8Array> {
  let context: import("playwright").BrowserContext | null = null;
  try {
    let browser: Browser;
    try {
      browser = await getSharedBrowser();
      context = await browser.newContext();
    } catch {
      globalThis.__pdfChromiumBrowser = null;
      globalThis.__pdfChromiumLaunchPromise = null;
      browser = await getSharedBrowser();
      context = await browser.newContext();
    }

    const page = await context.newPage();

    await page.route("**/*", (route) => {
      const url = route.request().url().toLowerCase();
      if (url.startsWith("file:") || url.startsWith("javascript:")) {
        return route.abort();
      }
      route.continue();
    });

    await page.setViewportSize({ width: 794, height: 1123 });

    try {
      await page.setContent(html, { waitUntil: "networkidle", timeout: 10000 });
    } catch {
      await page.setContent(html, { waitUntil: "domcontentloaded", timeout: 5000 });
    }

    try {
      await page.evaluate(() => document.fonts.ready);
    } catch {}

    await page.emulateMedia({ media: "print" });

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: "0px", bottom: "0px", left: "0px", right: "0px" },
    });

    return new Uint8Array(pdfBuffer);
  } finally {
    if (context) {
      try {
        await context.close();
      } catch {}
    }
  }
}

interface PdfPart {
  type: "html" | "file";
  content: string;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { parts, fileName, company } = body as {
      parts: PdfPart[];
      fileName?: string;
      company?: string;
    };

    if (!parts || !Array.isArray(parts) || parts.length === 0) {
      return NextResponse.json({ error: "Missing PDF parts" }, { status: 400 });
    }

    const pdfBuffers: Uint8Array[] = [];

    for (const part of parts) {
      if (part.type === "html") {
        if (!part.content || typeof part.content !== "string") {
          return NextResponse.json({ error: "Invalid HTML content in PDF parts" }, { status: 400 });
        }
        const processedHtml = convertImagesToBase64(part.content);
        const buffer = await renderHtmlToPdf(processedHtml);
        pdfBuffers.push(buffer);
      } else if (part.type === "file") {
        // Enforce strict security boundary: only allow PDF files from public/documents or public/uploads
        const normalizedRel = path.normalize(part.content).replace(/^(\.\.(\/|\\|$))+/, "");
        const fullPath = path.resolve(BASE_DIR, normalizedRel);

        const isDoc = fullPath.startsWith(path.resolve(DOCUMENTS_DIR) + path.sep);
        const isUpload = fullPath.startsWith(path.resolve(UPLOADS_DIR) + path.sep);

        if (!isDoc && !isUpload) {
          return NextResponse.json(
            { error: "Access denied: File part path outside permitted documents directories." },
            { status: 403 }
          );
        }

        if (!fullPath.toLowerCase().endsWith(".pdf")) {
          return NextResponse.json({ error: "Invalid file type: only PDF files are allowed." }, { status: 400 });
        }

        if (!fs.existsSync(fullPath)) {
          // If a requested optional bundle file like references.pdf does not exist yet, inform the user clearly
          const baseName = path.basename(fullPath);
          return NextResponse.json(
            {
              error: `Document not found: '${baseName}'. Please place your certificate/reference PDF in 'public/documents/${baseName}' first.`,
            },
            { status: 404 }
          );
        }

        const buffer = fs.readFileSync(fullPath);
        pdfBuffers.push(new Uint8Array(buffer));
      }
    }

    const mergedPdf = await PDFDocument.create();

    for (const buffer of pdfBuffers) {
      const donorPdf = await PDFDocument.load(buffer);
      const copiedPages = await mergedPdf.copyPages(donorPdf, donorPdf.getPageIndices());
      for (const page of copiedPages) {
        mergedPdf.addPage(page);
      }
    }

    const mergedBytes = await mergedPdf.save();

    let finalFileName = fileName ? sanitizeFilename(String(fileName).replace(/\.pdf$/i, "")) : "";
    if (!finalFileName) {
      const cleanCompany = sanitizeFilename(company || "Generic");
      finalFileName = `Application_Bundle_${cleanCompany}`;
    }
    finalFileName = `${finalFileName}.pdf`;

    const cleanCompany = company ? sanitizeFilename(company) : "";
    const exportsTargetDir = cleanCompany ? path.join(EXPORTS_DIR, cleanCompany) : EXPORTS_DIR;
    const resolvedTarget = path.resolve(exportsTargetDir);

    if (resolvedTarget.startsWith(path.resolve(EXPORTS_DIR))) {
      if (!fs.existsSync(resolvedTarget)) {
        fs.mkdirSync(resolvedTarget, { recursive: true });
      }
      const localPath = path.join(resolvedTarget, finalFileName);
      fs.writeFileSync(localPath, mergedBytes);
    }

    const headerSafeFilename = finalFileName.replace(/[\r\n"]/g, "");

    return new Response(Buffer.from(mergedBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${headerSafeFilename}"`,
        "Content-Length": mergedBytes.length.toString(),
        "X-Filename": headerSafeFilename,
      },
    });
  } catch (err: any) {
    console.error("PDF merge failed:", err);
    return NextResponse.json(
      { error: "PDF merge failed: " + (err.message || String(err)) },
      { status: 500 }
    );
  }
}
