import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { PDFDocument } from "pdf-lib";
import { createSourceLoader } from "./helpers/source-loader.mjs";

const load = createSourceLoader();
const security = load("src/lib/requestSecurity.ts");
const engine = load("src/lib/pdfEngine.ts");
const refServer = load("src/lib/referenceDocumentsServer.ts");
const merge = load("src/app/api/merge-pdf/route.ts");
const exportPdf = load("src/app/api/export-pdf/route.ts");
const upload = load("src/app/api/upload/route.ts");
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4AWJiYGBgAAAAAP//XRcpzQAAAAZJREFUAwAADwADJDd96QAAAABJRU5ErkJggg==", "base64");
const jsonRequest = (body, headers = {}) => new Request("http://localhost:3100/api/test", { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });

test("API guards permit same-origin loopback requests and local CLI requests", () => {
  for (const origin of ["http://localhost:3100", "http://127.0.0.1:3100", "http://[::1]:3100"]) {
    const request = new Request(`${origin}/api/test`, { method: "POST", headers: { Origin: origin, Host: new URL(origin).host, "Content-Type": "application/json; charset=utf-8", "Sec-Fetch-Site": "same-origin" }, body: "{}" });
    assert.equal(security.guardApiRequest(request, "json"), null);
  }
  assert.equal(security.guardApiRequest(jsonRequest({}), "json"), null);
  assert.equal(security.guardApiRequest(new Request("http://localhost:3100/api/test")), null);
});

test("API guards reject remote hosts, rebinding names, foreign origins and cross-site requests", () => {
  for (const request of [
    new Request("http://remote.example/api/test"),
    new Request("http://localhost:3100/api/test", { headers: { Host: "attacker.example:3100" } }),
    new Request("http://localhost:3100/api/test", { headers: { Host: "localhost.attacker.example" } }),
    new Request("http://localhost:3100/api/test", { headers: { Origin: "http://localhost:3200" } }),
    new Request("http://localhost:3100/api/test", { headers: { Origin: "null" } }),
    new Request("http://localhost:3100/api/test", { headers: { Origin: "https://attacker.example" } }),
    new Request("http://localhost:3100/api/test", { headers: { "Sec-Fetch-Site": "cross-site" } }),
  ]) assert.equal(security.guardApiRequest(request)?.status, 403);
  assert.equal(security.guardApiRequest(new Request("http://localhost:3100/api/test"), "json")?.status, 415);
  assert.equal(security.guardApiRequest(jsonRequest({}), "multipart")?.status, 415);
});

test("JSON input is bounded even without Content-Length and rejects invalid UTF-8/JSON", async () => {
  await assert.rejects(security.readJsonRequest(jsonRequest({ text: "x".repeat(100) }), 16), (error) => error.status === 413);
  await assert.rejects(security.readJsonRequest(jsonRequest({}, { "Content-Length": "1000" }), 16), (error) => error.status === 413);
  await assert.rejects(security.readJsonRequest(new Request("http://localhost/api", { method: "POST", body: "{broken" })), /Invalid JSON/);
  assert.deepEqual(await security.readJsonRequest(jsonRequest({ text: "valid" })), { text: "valid" });
});

test("PDF filenames cannot escape exports or inject response headers", () => {
  const name = engine.safePdfFilename('../../CV\r\nX-Evil: value".PDF', "fallback");
  assert.match(name, /^[a-zA-Z0-9_-]+\.pdf$/);
  assert.equal(engine.safePdfFilename("CON.pdf", "fallback"), "_CON.pdf");
  assert.ok(engine.safePdfFilename("a".repeat(1000), "fallback").length <= 124);
});

test("legacy merge paths, traversal IDs, too many parts and oversized HTML are rejected before export", async () => {
  for (const content of ["../private.pdf", "public/documents/other.pdf", "public/documents/../documents/references.pdf", "C:\\private.pdf", "/public/documents/references.pdf"]) {
    const response = await merge.POST(jsonRequest({ parts: [{ type: "file", content }] }));
    assert.equal(response.status, 403);
  }
  assert.equal((await merge.POST(jsonRequest({ parts: [{ type: "file", id: "../secret.pdf" }] }))).status, 403);
  assert.equal((await merge.POST(jsonRequest({ parts: [{ type: "file", id: "other" }] }))).status, 403);
  assert.equal((await merge.POST(jsonRequest({ parts: Array(engine.PDF_LIMITS.parts + 1).fill({ type: "html", content: "test" }) }))).status, 400);
  assert.equal((await exportPdf.POST(jsonRequest({ html: "x".repeat(engine.PDF_LIMITS.htmlBytes + 1) }))).status, 413);
});

test("dynamic user PDFs in public/documents and legacy references work safely in an isolated directory", async (t) => {
  const before = process.cwd();
  const root = path.resolve(os.tmpdir());
  const directory = fs.mkdtempSync(path.join(root, "job-security-test-"));
  const referenceDirSetting = process.env.JOB_REFERENCES_DIR;
  const referencePdfSetting = process.env.JOB_REFERENCES_PDF;
  const exportSetting = process.env.JOB_EXPORTS_DIR;
  process.env.JOB_REFERENCES_DIR = path.join(directory, "public", "documents");
  process.env.JOB_REFERENCES_PDF = path.join(directory, "public", "documents", "references.pdf");
  process.env.JOB_EXPORTS_DIR = path.join(directory, "exports");
  process.chdir(directory);
  t.after(() => {
    process.chdir(before);
    if (referenceDirSetting === undefined) delete process.env.JOB_REFERENCES_DIR;
    else process.env.JOB_REFERENCES_DIR = referenceDirSetting;
    if (referencePdfSetting === undefined) delete process.env.JOB_REFERENCES_PDF;
    else process.env.JOB_REFERENCES_PDF = referencePdfSetting;
    if (exportSetting === undefined) delete process.env.JOB_EXPORTS_DIR;
    else process.env.JOB_EXPORTS_DIR = exportSetting;
    fs.rmSync(directory, { recursive: true, force: true });
  });

  const document = await PDFDocument.create();
  document.addPage([595.28, 841.89]);
  const bytes = await document.save();
  fs.mkdirSync(path.join("public", "documents"), { recursive: true });
  fs.writeFileSync(path.join("public", "documents", "references.pdf"), bytes);
  fs.writeFileSync(path.join("public", "documents", "diploma-certificate.pdf"), bytes);
  fs.writeFileSync(path.join("public", "documents", "fake.pdf"), Buffer.from("NOT_A_PDF"));

  const listed = await refServer.listReferenceDocuments();
  assert.deepEqual(listed.map((d) => d.id), ["diploma-certificate.pdf", "references.pdf"]);
  assert.equal(listed[0].pageCount, 1);
  assert.equal(await refServer.readSafeReferencePdf("../references.pdf"), null);
  assert.equal(await refServer.readSafeReferencePdf("fake.pdf"), null);

  assert.deepEqual(await engine.readReferencePdf({ id: "diploma-certificate.pdf" }), new Uint8Array(bytes));
  assert.deepEqual(await engine.readReferencePdf({ id: "references" }), new Uint8Array(bytes));
  assert.deepEqual(await engine.readReferencePdf({ content: "public/documents/references.pdf" }), new Uint8Array(bytes));

  const response = await merge.POST(jsonRequest({ parts: [{ type: "file", id: "diploma-certificate.pdf" }], company: "Example", fileName: "../../safe.pdf" }));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("X-Filename"), "safe.pdf");
  assert.match(response.headers.get("Cache-Control"), /no-store/);
  const stored = fs.readdirSync("exports/Example", { recursive: true }).map(String).filter((name) => name.endsWith("_safe.pdf"));
  assert.equal(stored.length, 1);
  assert.ok(path.resolve("exports/Example", stored[0]).startsWith(path.resolve("exports") + path.sep));
  assert.ok(!fs.existsSync("safe.pdf"));

  fs.mkdirSync(path.join("public", "uploads", "photo"), { recursive: true });
  fs.writeFileSync(path.join("public", "uploads", "photo", "test.png"), png);
  assert.ok(engine.convertImagesToBase64('<img src="/uploads/photo/test.png">').includes("data:image/png;base64,"));
  assert.equal(engine.convertImagesToBase64('<img src="/uploads/../documents/references.pdf">'), '<img src="/uploads/../documents/references.pdf">');
});

test("image validation checks coherent signatures and dimensions, never a .webp extension alone", () => {
  assert.deepEqual(engine.inspectUploadedImage(png, "signature.png", "image/png"), { mime: "image/png", width: 1, height: 1 });
  for (const [bytes, filename, type] of [
    [Buffer.from("not an image"), "fake.webp", "image/webp"],
    [Buffer.from("RIFFnot really a webp"), "fake.webp", "image/webp"],
    [png, "fake.jpg", "image/jpeg"],
    [png, "evil.html", "image/png"],
    [png, "mismatch.png", "image/webp"],
  ]) assert.throws(() => engine.inspectUploadedImage(bytes, filename, type));
  const bomb = Buffer.from(png);
  bomb.writeUInt32BE(100000, 16);
  assert.throws(() => engine.inspectUploadedImage(bomb, "large.png", "image/png"), /dimensions/);
});

test("uploads reject text fields, fake WEBP and duplicate form fields without saving", async () => {
  const formRequest = (form) => new Request("http://localhost:3100/api/upload", { method: "POST", body: form });
  const wrong = new FormData();
  wrong.set("file", "a string is not a File"); wrong.set("type", "photo");
  assert.equal((await upload.POST(formRequest(wrong))).status, 400);
  const fake = new FormData();
  fake.set("file", new File(["not an image"], "fake.webp", { type: "image/webp" })); fake.set("type", "photo");
  assert.equal((await upload.POST(formRequest(fake))).status, 400);
  const duplicate = new FormData();
  duplicate.append("file", new File([png], "test.png", { type: "image/png" }));
  duplicate.append("file", new File([png], "test.png", { type: "image/png" })); duplicate.set("type", "signature");
  assert.equal((await upload.POST(formRequest(duplicate))).status, 400);
});

test("the PDF deadline closes its context and disables script/service-worker execution", async (t) => {
  const previous = globalThis.__pdfChromiumBrowser;
  let closed = 0;
  let contextOptions;
  const context = {
    route: async () => {}, close: async () => { closed++; },
    newPage: async () => ({ setDefaultTimeout() {}, setViewportSize: async () => {}, setContent: async () => {}, evaluate: async () => {}, emulateMedia: async () => {}, pdf: async () => new Promise(() => {}) }),
  };
  globalThis.__pdfChromiumBrowser = { isConnected: () => true, newContext: async (options) => { contextOptions = options; return context; } };
  t.after(() => { globalThis.__pdfChromiumBrowser = previous; });
  await assert.rejects(engine.renderHtmlToPdf("<html><body>test</body></html>", { timeoutMs: 20 }), (error) => error.status === 504);
  assert.deepEqual(contextOptions, { javaScriptEnabled: false, serviceWorkers: "block" });
  assert.ok(closed > 0);
});
