import { z } from "zod";
import { renderHtmlToPdfWithMeta, sanitizeFilename, stampPdfMetadata, safePdfFilename, validatePdfHtml, PDF_LIMITS } from "@/lib/pdfEngine";
import { recordPdfExport } from "@/lib/exportStore";
import { guardApiRequest, readJsonRequest, RequestSecurityError, securityError, privateResponseHeaders } from "@/lib/requestSecurity";

const ExportRequestSchema = z.object({
  html: z.string().min(1),
  documentType: z.string().max(40).optional(),
  fileName: z.string().max(1000).optional(),
  company: z.string().max(500).optional(),
  roleTitle: z.string().max(500).optional(),
  author: z.string().max(500).optional(),
  language: z.string().max(30).optional(),
  keywords: z.array(z.string().max(200)).max(80).optional(),
  // Optional link to the saved application; without it the copy is stored but no delivery is recorded.
  applicationId: z.string().max(80).optional(),
  revision: z.number().int().nonnegative().optional(),
});

export async function POST(request: Request) {
  const rejected = guardApiRequest(request, "json");
  if (rejected) return rejected;
  try {
    const parsed = ExportRequestSchema.safeParse(await readJsonRequest(request, PDF_LIMITS.requestBytes));
    if (!parsed.success) return securityError("Invalid PDF export request");
    const { html, fileName, documentType, company, roleTitle, author, language, keywords, applicationId, revision } = parsed.data;
    validatePdfHtml(html);
    const label = documentType === "cv" ? "CV" : documentType === "master-cv" ? "Master_CV" : documentType === "letter" ? "Cover_Letter" : "STAR_Prep";
    const filename = safePdfFilename(fileName, `Candidate_${label}_${sanitizeFilename(company || "Generic")}`);
    const rendered = await renderHtmlToPdfWithMeta(html);
    const bytes = await stampPdfMetadata(rendered.bytes, { documentType, company, roleTitle, author, language, keywords });
    // Unique internal copy (never replaces an earlier export) plus an immutable delivery record.
    const stored = recordPdfExport({ bytes, downloadName: filename, documentType: documentType || "cv", applicationId, clientRevision: revision, company });
    return new Response(new Uint8Array(bytes), {
      headers: {
        ...privateResponseHeaders(),
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(bytes.length),
        "X-Filename": filename,
        "X-PDF-Pages": String(rendered.pages || 0),
        "X-PDF-Warnings": rendered.warnings.length ? encodeURIComponent(rendered.warnings.join(" | ")) : "",
        "X-PDF-Size-Bytes": String(bytes.length),
        "X-PDF-Size-Warning": bytes.length > PDF_LIMITS.portalWarningBytes ? "exceeds_2mb" : "ok",
        ...(stored.id ? { "X-Delivery-Id": stored.id } : {}),
      },
    });
  } catch (error: unknown) {
    if (error instanceof RequestSecurityError) return securityError(error.message, error.status);
    const msg = error instanceof Error ? error.message : String(error);
    console.error("PDF export failed:", msg);
    if (/printable area|100-page limit|signature block|signature image|graphic asset/i.test(msg)) return securityError(msg, 422);
    if (/timeout|timed out/i.test(msg)) return securityError("PDF export timed out. Please retry.", 504);
    return securityError("Failed to generate the PDF. Please retry.", 500);
  }
}
