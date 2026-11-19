import { type Application } from "@/lib/schemas";

export interface TemplateProps {
  data: Application;
  // Optional base64 overrides for assets
  photoBase64?: string;
  signatureBase64?: string;
}
