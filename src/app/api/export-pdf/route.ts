import { NextResponse } from "next/server";
import { chromium, type Browser } from "playwright";
import fs from "fs";
import path from "path";

const BASE_DIR = process.cwd();
const EXPORTS_DIR = path.join(BASE_DIR, "exports");
const UPLOADS_DIR = path.join(BASE_DIR, "public", "uploads");

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

    // Enforce uploads boundary
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

export async function POST(req: Request) {
  let context: import("playwright").BrowserContext | null = null;
  try {
    const body = await req.json();
    let { html, documentType, fileName, company } = body;

    if (!html || typeof html !== "string") {
      return NextResponse.json({ error: "Missing HTML content" }, { status: 400 });
    }

    html = convertImagesToBase64(html);

    let finalFileName = fileName ? sanitizeFilename(String(fileName).replace(/\.pdf$/i, "")) : "";
    if (!finalFileName) {
      const cleanCompany = sanitizeFilename(company || "Generic");
      const docTypeString =
        documentType === "cv" ? "CV" : documentType === "letter" ? "Cover_Letter" : "STAR_Prep";
      finalFileName = `Application_${docTypeString}_${cleanCompany}`;
    }
    finalFileName = `${finalFileName}.pdf`;

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

    // Security Hardening: Block file://, local access, and non-whitelisted protocols
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
    } catch {
      // Continue if fonts ready check times out
    }

    await page.emulateMedia({ media: "print" });

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: "0px", bottom: "0px", left: "0px", right: "0px" },
    });

    await context.close();
    context = null;

    // Save local copy safely in exports
    const cleanCompany = company ? sanitizeFilename(company) : "";
    const exportsTargetDir = cleanCompany ? path.join(EXPORTS_DIR, cleanCompany) : EXPORTS_DIR;
    const resolvedTarget = path.resolve(exportsTargetDir);

    if (resolvedTarget.startsWith(path.resolve(EXPORTS_DIR))) {
      if (!fs.existsSync(resolvedTarget)) {
        fs.mkdirSync(resolvedTarget, { recursive: true });
      }
      const localPath = path.join(resolvedTarget, finalFileName);
      fs.writeFileSync(localPath, pdfBuffer);
    }

    // Sanitize headers to prevent CRLF injection
    const headerSafeFilename = finalFileName.replace(/[\r\n"]/g, "");

    return new Response(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${headerSafeFilename}"`,
        "Content-Length": pdfBuffer.length.toString(),
        "X-Filename": headerSafeFilename,
      },
    });
  } catch (err: any) {
    console.error("PDF generation failed:", err);
    if (context) {
      try {
        await context.close();
      } catch {}
    }
    return NextResponse.json(
      { error: "PDF export failed: " + (err.message || String(err)) },
      { status: 500 }
    );
  }
}
