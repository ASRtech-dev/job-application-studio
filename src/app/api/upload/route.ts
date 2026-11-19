import { saveUploadFile } from "@/lib/storage";
import { inspectUploadedImage, verifyImageDecodes, optimizePortraitPhotoBuffer, PDF_LIMITS } from "@/lib/pdfEngine";
import { guardApiRequest, readRequestBytes, RequestSecurityError, securityError, privateResponseHeaders } from "@/lib/requestSecurity";

export async function POST(request: Request) {
  const rejected = guardApiRequest(request, "multipart");
  if (rejected) return rejected;
  try {
    const bytes = await readRequestBytes(request, PDF_LIMITS.imageBytes + 64 * 1024);
    const form = await new Response(new Uint8Array(bytes), { headers: { "Content-Type": request.headers.get("content-type")! } }).formData();
    const file = form.get("file");
    const type = form.get("type");
    if (!(file instanceof File) || form.getAll("file").length !== 1 || form.getAll("type").length !== 1 || type !== "photo" && type !== "signature") {
      return securityError("Provide one image file and a photo or signature upload type");
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    const inspected = inspectUploadedImage(buffer, file.name, file.type);
    if (!await verifyImageDecodes(buffer, inspected.mime)) return securityError("Image could not be decoded. Use a valid PNG, JPEG or WEBP image.");
    const finalAsset = type === "photo"
      ? await optimizePortraitPhotoBuffer(buffer, inspected.mime, inspected.width)
      : { buffer, mime: inspected.mime };
    const storedName = finalAsset.ext ? file.name.replace(/\.[^.]+$/, finalAsset.ext) : file.name;
    const url = saveUploadFile(finalAsset.buffer, storedName, type);
    return Response.json({ success: true, url }, { headers: privateResponseHeaders() });
  } catch (error: unknown) {
    if (error instanceof RequestSecurityError) return securityError(error.message, error.status);
    if (error instanceof TypeError) return securityError("Invalid upload request");
    console.error("Image upload failed");
    return securityError("Image upload failed. Please retry.", 500);
  }
}
