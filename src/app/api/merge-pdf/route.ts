import { z } from "zod";
import { PDFDocument } from "pdf-lib";
import { applyMergedOutlines, applyPdfMetadata, renderHtmlToPdfWithMeta, sanitizeFilename, safePdfFilename, readReferencePdf, validatePdfHtml, PDF_LIMITS } from "@/lib/pdfEngine";
import { formatReferenceLabel } from "@/lib/referenceDocuments";
import { recordPdfExport } from "@/lib/exportStore";
import { guardApiRequest, readJsonRequest, RequestSecurityError, securityError, privateResponseHeaders } from "@/lib/requestSecurity";
import { TaggedPdfMerger } from "@/lib/mergeTaggedPdf";

const PartSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("html"), content: z.string().min(1), role: z.enum(["deckblatt", "letter", "cv", "html"]).optional(), title: z.string().max(120).optional() }),
  z.object({ type: z.literal("file"), id: z.string().max(160).optional(), content: z.string().max(500).optional(), title: z.string().max(120).optional() }),
]);
const MergeRequestSchema = z.object({
  parts: z.array(PartSchema).min(1).max(PDF_LIMITS.parts),
  fileName: z.string().max(1000).optional(),
  documentType: z.string().max(40).optional(),
  company: z.string().max(500).optional(),
  roleTitle: z.string().max(500).optional(),
  author: z.string().max(500).optional(),
  language: z.string().max(30).optional(),
  keywords: z.array(z.string().max(200)).max(80).optional(),
  // Optional link to the saved application; without it the copy is stored but no delivery is recorded.
  applicationId: z.string().max(80).optional(),
  revision: z.number().int().nonnegative().optional(),
});

function defaultOutlineTitle(part: z.infer<typeof PartSchema>, language?: string): string {
  if (part.title?.trim()) return part.title.trim();
  const isDe = (language || "").toLowerCase().includes("german") || (language || "").toLowerCase() === "de";
  const isEs = (language || "").toLowerCase().includes("spanish") || (language || "").toLowerCase() === "es";
  if (part.type === "file") {
    if (part.id && part.id !== "references") return formatReferenceLabel(part.id);
    return isDe ? "Anlagen & Zeugnisse" : isEs ? "Referencias y certificados" : "References & Attachments";
  }
  if (part.role === "letter") return isDe ? "Anschreiben" : isEs ? "Carta de presentación" : "Cover Letter";
  if (part.role === "cv") return isDe ? "Lebenslauf" : isEs ? "Currículum" : "CV";
  if (part.role === "deckblatt") return isDe ? "Deckblatt" : isEs ? "Portada" : "Cover Sheet";
  return isDe ? "Dokument" : isEs ? "Documento" : "Document";
}

export async function POST(request: Request) {
  const rejected = guardApiRequest(request, "json");
  if (rejected) return rejected;
  try {
    const parsed = MergeRequestSchema.safeParse(await readJsonRequest(request, PDF_LIMITS.requestBytes));
    if (!parsed.success) return securityError("Invalid PDF bundle request");
    const { parts, fileName, company, roleTitle, documentType, author, language, keywords, applicationId, revision } = parsed.data;
    let htmlBytes = 0;
    // Validate all parts before launching Chromium or creating an export file.
    const prepared: Array<{ html?: string; bytes?: Uint8Array; part: z.infer<typeof PartSchema> }> = [];
    for (const part of parts) {
      if (part.type === "html") {
        validatePdfHtml(part.content);
        htmlBytes += Buffer.byteLength(part.content, "utf8");
        if (htmlBytes > PDF_LIMITS.mergeHtmlBytes) throw new RequestSecurityError("Bundle HTML exceeds the permitted size", 413);
        prepared.push({ html: part.content, part });
      } else {
        prepared.push({ bytes: await readReferencePdf(part), part });
      }
    }
    const deadline = Date.now() + 90000;
    const merged = await PDFDocument.create();
    const merger = new TaggedPdfMerger(merged);
    const outlines: Array<{ title: string; pageIndex: number }> = [];
    const warnings: string[] = [];
    for (const item of prepared) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) throw new RequestSecurityError("PDF bundle rendering timed out", 504);
      const rendered = item.bytes ? { bytes: item.bytes, warnings: [] as string[] } : await renderHtmlToPdfWithMeta(item.html!, { timeoutMs: remaining });
      if (rendered.warnings.length) warnings.push(...rendered.warnings);
      let donor: PDFDocument;
      try {
        donor = await PDFDocument.load(rendered.bytes);
      } catch {
        throw new RequestSecurityError("A PDF document could not be read");
      }
      if (donor.getPageCount() > 100 || merged.getPageCount() + donor.getPageCount() > 150) {
        throw new RequestSecurityError("PDF bundle has too many pages", 413);
      }
      const startPage = merged.getPageCount();
      merger.append(donor);
      outlines.push({ title: defaultOutlineTitle(item.part, language), pageIndex: startPage });
    }
    applyMergedOutlines(merged, outlines);
    applyPdfMetadata(merged, { documentType: documentType || "bundle", company, roleTitle, author, language, keywords });
    const bytes = await merged.save();
    const filename = safePdfFilename(fileName, `Candidate_Application_Bundle_${sanitizeFilename(company || "Generic")}`);
    // Records the real order of the bundle (e.g. letter -> CV -> references) with the delivery.
    const partLabels = parts.map((part) => part.type === "file" ? (part.id || "references") : (part.role || "html"));
    const stored = recordPdfExport({ bytes, downloadName: filename, documentType: documentType || "bundle", applicationId, clientRevision: revision, company, parts: partLabels });
    return new Response(new Uint8Array(bytes), {
      headers: {
        ...privateResponseHeaders(),
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(bytes.length),
        "X-Filename": filename,
        "X-PDF-Pages": String(merged.getPageCount()),
        "X-PDF-Warnings": warnings.length ? encodeURIComponent(warnings.join(" | ")) : "",
        "X-PDF-Tagging": merger.taggingStatus,
        "X-PDF-Size-Bytes": String(bytes.length),
        "X-PDF-Size-Warning": bytes.length > PDF_LIMITS.portalWarningBytes ? "exceeds_2mb" : "ok",
        ...(stored.id ? { "X-Delivery-Id": stored.id } : {}),
      },
    });
  } catch (error: unknown) {
    if (error instanceof RequestSecurityError) return securityError(error.message, error.status);
    const msg = error instanceof Error ? error.message : String(error);
    console.error("PDF merge failed:", msg);
    if (/printable area|100-page limit|signature block|signature image|graphic asset/i.test(msg)) return securityError(msg, 422);
    if (/timeout|timed out/i.test(msg)) return securityError("PDF bundle export timed out. Please retry.", 504);
    return securityError("Failed to assemble the PDF bundle. Please retry.", 500);
  }
}
