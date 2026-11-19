import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { PDFDocument } from "pdf-lib";
import { createSourceLoader } from "./helpers/source-loader.mjs";

const engine = createSourceLoader()("src/lib/pdfEngine.ts");

test("PDF HTML cannot run scripts or fetch HTTP, CSS, SVG or local-file resources", { timeout: 90000 }, async (t) => {
  const browser = await engine.getSharedBrowser();
  const nativeNewContext = browser.newContext.bind(browser);
  const failures = [];
  const responses = [];
  let scriptExecuted;
  browser.newContext = async (options) => {
    const context = await nativeNewContext(options);
    context.on("page", (page) => {
      page.on("requestfailed", (request) => failures.push({ url: request.url(), failure: request.failure()?.errorText }));
      page.on("response", (response) => responses.push(response.url()));
      const nativePdf = page.pdf.bind(page);
      page.pdf = async (options) => {
        scriptExecuted = await page.evaluate(() => window.__securityExecuted === true);
        return nativePdf(options);
      };
    });
    return context;
  };
  t.after(async () => { browser.newContext = nativeNewContext; await browser.close(); });
  const pdf = await engine.renderHtmlToPdf(`<html><head><style>@import url("http://127.0.0.1:9/css-probe"); body { background-image: url("http://127.0.0.1:9/background-probe"); }</style></head><body>
    <script>window.__securityExecuted = true; fetch("http://127.0.0.1:9/script-probe")</script>
    <img src="http://127.0.0.1:9/image-probe"><svg><image href="http://127.0.0.1:9/svg-probe" width="10" height="10"/></svg>
    <iframe src="file:///does-not-exist/private.pdf"></iframe><p>Selectable safe content.</p>
    </body></html>`);
  assert.equal(scriptExecuted, false);
  assert.deepEqual(responses.filter((url) => /^(https?|file):/i.test(url)), []);
  assert.ok(failures.some((item) => item.url.includes("image-probe") && item.failure?.includes("BLOCKED_BY_CLIENT")));
  assert.ok(failures.some((item) => item.url.includes("css-probe") && item.failure?.includes("BLOCKED_BY_CLIENT")));
  assert.ok(!failures.some((item) => item.url.includes("script-probe")), "Inline JavaScript never ran");
  assert.ok((await PDFDocument.load(pdf)).getPageCount() > 0);
});

test("offline image decoding rejects truncated containers and accepts a real local PNG", { timeout: 90000 }, async (t) => {
  t.after(async () => { if (globalThis.__pdfChromiumBrowser?.isConnected()) await globalThis.__pdfChromiumBrowser.close(); });
  const bytes = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4AWJiYGBgAAAAAP//XRcpzQAAAAZJREFUAwAADwADJDd96QAAAABJRU5ErkJggg==", "base64");
  assert.equal(await engine.verifyImageDecodes(bytes, "image/png"), true);
  assert.equal(await engine.verifyImageDecodes(bytes.subarray(0, 33), "image/png"), false);
  const browser = await engine.getSharedBrowser();
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    for (const mime of ["image/jpeg", "image/webp"]) {
      const data = await page.evaluate((mime) => {
        const canvas = document.createElement("canvas");
        canvas.width = 2; canvas.height = 2;
        return canvas.toDataURL(mime).split(",")[1];
      }, mime);
      const bytes = Buffer.from(data, "base64");
      const type = engine.inspectUploadedImage(bytes, mime === "image/jpeg" ? "photo.jpg" : "photo.webp", mime);
      assert.equal(type.width, 2);
      assert.equal(await engine.verifyImageDecodes(bytes, mime), true);
    }
  } finally { await context.close(); }
});

test("a valid signature upload passes the real multipart route and saves only in a temporary directory", { timeout: 90000 }, async (t) => {
  const originalCwd = process.cwd();
  const temporaryRoot = path.resolve(os.tmpdir());
  const directory = fs.mkdtempSync(path.join(temporaryRoot, "job-upload-security-"));
  process.chdir(directory);
  t.after(async () => {
    if (globalThis.__pdfChromiumBrowser?.isConnected()) await globalThis.__pdfChromiumBrowser.close();
    process.chdir(originalCwd);
    fs.rmSync(directory, { recursive: true, force: true });
  });
  const route = createSourceLoader()("src/app/api/upload/route.ts");
  const bytes = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4AWJiYGBgAAAAAP//XRcpzQAAAAZJREFUAwAADwADJDd96QAAAABJRU5ErkJggg==", "base64");
  const form = new FormData();
  form.set("file", new File([bytes], "signature.png", { type: "image/png" }));
  form.set("type", "signature");
  const response = await route.POST(new Request("http://localhost:3100/api/upload", { method: "POST", body: form }));
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.success, true);
  assert.match(data.url, /^\/uploads\/(?:development\/)?signature\/[a-zA-Z0-9_-]+\.png$/);
  const saved = path.join(directory, "public", data.url.slice(1));
  assert.deepEqual(fs.readFileSync(saved), bytes);
});
