import React, { useState } from "react";
import { Edit3, FileUp, Image as ImageIcon, Settings, Trash2 } from "lucide-react";
import type { Application } from "@/lib/schemas";
import type { ToastVariant } from "@/components/Toast";
import { computeSmartAutoFitSettings } from "@/lib/aiJsonMapper";
import { DOCUMENT_FONT_PRESETS, EXECUTIVE_ACCENT_SWATCHES, accentContrast, documentAccent, documentFontSize } from "@/lib/documentDesign";
import { DEFAULT_PHOTO_WIDTH_PX } from "@/components/templates/DocumentPrimitives";
import { resolveSelectedReferenceIds, type ReferenceDocumentMeta } from "@/lib/referenceDocuments";
import { SaveSectionButton } from "./SaveSectionButton";

interface AssetsDesignTabProps {
  app: Application;
  setApp: React.Dispatch<React.SetStateAction<Application | null>>;
  updateTemplateSettings: (field: string, val: string | number | boolean) => void;
  updateAssetSettings: (type: "signature" | "photo", field: string, val: string | number | boolean | undefined) => void;
  onOpenSignaturePad: () => void;
  onUploadAsset?: (file: File, type: "signature" | "photo") => Promise<boolean>;
  onNotify?: (message: string, variant?: ToastVariant) => void;
  availableReferences?: ReferenceDocumentMeta[];
  saving?: boolean;
  onSave?: () => void;
}

/**
 * Stateful media controls for portrait photo and signature uploads/previews.
 * Kept separate so `AssetsDesignTab` stays hook-free for shallow JSX tree inspection tests.
 */
function AssetResourcePanels({
  app,
  setApp,
  updateAssetSettings,
  onOpenSignaturePad,
  onUploadAsset,
  onNotify,
  availableReferences,
}: Omit<AssetsDesignTabProps, "updateTemplateSettings">) {
  const [failedPhotoPath, setFailedPhotoPath] = useState<string | null>(null);
  const [failedSigPath, setFailedSigPath] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadingSig, setUploadingSig] = useState(false);
  const photoPath = app.assetSettings.photo.filePath;
  const sigPath = app.assetSettings.signature.filePath;
  const photoLoadError = Boolean(photoPath && failedPhotoPath === photoPath);
  const sigLoadError = Boolean(sigPath && failedSigPath === sigPath);
  const photoWidthPx = Math.round(Math.min(160, Math.max(72, Number(app.assetSettings.photo.widthPx) || DEFAULT_PHOTO_WIDTH_PX)));
  const photoCropStyle = app.assetSettings.photo.cropStyle || "portrait-rectangle";
  const photoPlacement = app.assetSettings.photo.placement === "header-left"
    ? "sidebar"
    : (app.assetSettings.photo.placement || "header-right");
  const photoHeightPx = photoCropStyle === "portrait-rectangle"
    ? Math.round((photoWidthPx * 4) / 3)
    : photoWidthPx;
  const previewFrameClass = photoCropStyle === "circle"
    ? "w-[72px] h-[72px] rounded-full object-[center_18%]"
    : photoCropStyle === "rounded-square"
    ? "w-[72px] h-[72px] rounded-xl object-[center_18%]"
    : "w-16 h-[86px] rounded-md object-[center_14%]";
  const placementLabel = photoPlacement === "sidebar"
    ? "Left"
    : photoPlacement === "header-center"
    ? "Centered"
    : "Right";

  const readDefaultPath = (key: "jas_default_photo" | "jas_default_sig"): string | null => {
    try {
      return typeof window !== "undefined" ? localStorage.getItem(key) : null;
    } catch {
      return null;
    }
  };
  const defaultPhotoPath = readDefaultPath("jas_default_photo");
  const defaultSigPath = readDefaultPath("jas_default_sig");

  const applyAssetPath = (type: "photo" | "signature", nextPath: string | undefined, enabled: boolean) => {
    setApp((prev) => prev ? {
      ...prev,
      assetSettings: {
        ...prev.assetSettings,
        [type]: {
          ...prev.assetSettings[type],
          enabled,
          filePath: nextPath,
        },
      },
    } : prev);
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>, type: "photo" | "signature") => {
    const input = e.currentTarget;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    const setBusy = type === "photo" ? setUploadingPhoto : setUploadingSig;
    setBusy(true);
    try {
      if (onUploadAsset) {
        await onUploadAsset(file, type);
      } else {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("type", type);
        const res = await fetch("/api/upload", { method: "POST", body: formData });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.success && typeof data.url === "string") {
          applyAssetPath(type, data.url, true);
          onNotify?.(type === "photo" ? "Photo uploaded and applied." : "Signature uploaded and applied.", "success");
        } else {
          onNotify?.(data.error || "Could not upload file.", "error");
        }
      }
    } catch {
      onNotify?.("Could not upload file.", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {/* Photo Toggles */}
      <div className="ui-panel bg-[var(--ui-surface)] p-4 rounded-xl border border-[var(--ui-border)] space-y-4">
        <div className="flex flex-wrap gap-3 justify-between items-center">
          <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
            <ImageIcon className="w-4 h-4 text-[#8db2d6]" /> Profile photo
          </h3>
          <input
            type="checkbox"
            aria-label="Show profile photo on document"
            checked={app.assetSettings.photo.enabled}
            onChange={(e) => updateAssetSettings("photo", "enabled", e.target.checked)}
            className="w-4 h-4 rounded border-[var(--ui-border)] accent-[#6d8ead] cursor-pointer"
            disabled={!app.assetSettings.photo.filePath}
          />
        </div>

        {photoPath ? (
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--ui-border)] bg-[var(--ui-inset)] p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photoPath}
              alt="Profile photo preview"
              onLoad={() => setFailedPhotoPath(null)}
              onError={() => setFailedPhotoPath(photoPath)}
              className={`${previewFrameClass} object-cover border border-[#6d8ead]/50 bg-slate-900 shrink-0`}
            />
            <div className="flex-1 min-w-[140px] space-y-0.5">
              <p className="text-xs font-semibold text-white truncate">Current photo</p>
              <p className="text-xs text-slate-300 tabular-nums">
                {photoWidthPx} × {photoHeightPx} px · {photoCropStyle === "portrait-rectangle" ? "Portrait 3:4" : photoCropStyle === "circle" ? "Circle 1:1" : "Square 1:1"} · {placementLabel}
              </p>
              <p className="text-xs text-slate-400">
                {photoLoadError ? "Could not load image. Upload a new one." : app.assetSettings.photo.enabled ? "Visible on CV" : "Hidden (check the box to display it)"}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <label className="relative cursor-pointer px-2.5 py-1.5 rounded-lg border border-[var(--ui-border)] hover:border-[#6d8ead]/40 text-xs font-semibold text-[#8db2d6] bg-[var(--ui-surface-2)] focus-within:ring-2 focus-within:ring-[#6d8ead]">
                {uploadingPhoto ? "Uploading…" : "Replace"}
                <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" disabled={uploadingPhoto} onChange={(e) => handleFileSelected(e, "photo")} />
              </label>
              {defaultPhotoPath && defaultPhotoPath !== photoPath && (
                <button
                  type="button"
                  onClick={() => applyAssetPath("photo", defaultPhotoPath, true)}
                  className="px-2.5 py-1.5 rounded-lg border border-[var(--ui-border)] hover:border-[#6d8ead]/40 text-xs font-semibold text-blue-300 bg-[var(--ui-surface-2)]"
                >
                  Use default
                </button>
              )}
              <button
                type="button"
                onClick={() => applyAssetPath("photo", undefined, false)}
                title="Remove photo from this application"
                aria-label="Remove profile photo"
                className="p-1.5 rounded-lg border border-[var(--ui-border)] hover:border-rose-500/40 text-slate-400 hover:text-rose-300 bg-[var(--ui-surface-2)]"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-amber-300">No photo saved on this application yet.</p>
            <div className="flex flex-wrap gap-2">
              <label className="relative flex-1 min-w-[160px] flex items-center justify-center gap-2 py-2 px-3 rounded-xl border border-[var(--ui-border)] hover:border-[#6d8ead]/40 text-xs font-semibold text-[#8db2d6] bg-[var(--ui-surface-2)] cursor-pointer focus-within:ring-2 focus-within:ring-[#6d8ead]">
                <FileUp className="w-3.5 h-3.5" />
                {uploadingPhoto ? "Uploading…" : "Upload photo"}
                <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" disabled={uploadingPhoto} onChange={(e) => handleFileSelected(e, "photo")} />
              </label>
              {defaultPhotoPath && (
                <button
                  type="button"
                  onClick={() => applyAssetPath("photo", defaultPhotoPath, true)}
                  className="ui-button ui-button--secondary py-2 px-3 rounded-xl border border-[#1f2937] hover:border-[#6d8ead]/40 text-xs font-semibold text-blue-300 bg-[#0c1328]"
                >
                  Use saved photo
                </button>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
          <div>
            <label htmlFor="document-photo-crop" className="text-xs font-bold text-[#6d8ead] block mb-1">Photo frame</label>
            <select
              id="document-photo-crop"
              value={photoCropStyle}
              onChange={(e) => updateAssetSettings("photo", "cropStyle", e.target.value)}
              className="min-w-0 w-full px-2.5 py-1.5 rounded bg-[#0a0f1d] border border-[#1f2937] text-white text-xs cursor-pointer"
            >
              <option value="portrait-rectangle">Portrait rectangle · 3:4</option>
              <option value="rounded-square">Rounded square · 1:1</option>
              <option value="circle">Circle · 1:1</option>
            </select>
          </div>

          <div>
            <label htmlFor="document-photo-placement" className="text-xs font-bold text-[#6d8ead] block mb-1">Header placement</label>
            <select
              id="document-photo-placement"
              value={photoPlacement}
              onChange={(e) => updateAssetSettings("photo", "placement", e.target.value)}
              className="min-w-0 w-full px-2.5 py-1.5 rounded bg-[#0a0f1d] border border-[#1f2937] text-white text-xs cursor-pointer"
            >
              <option value="header-right">Header right (standard)</option>
              <option value="sidebar">Header left (DACH style)</option>
              <option value="header-center">Top centered (above name)</option>
            </select>
          </div>
        </div>

        <div className="space-y-2.5 pt-2 border-t border-[#1f2937]/50">
          <div className="flex justify-between items-center text-xs font-semibold text-[#6d8ead]">
            <label htmlFor="document-photo-width">Photo size on CV</label>
            <span className="text-white tabular-nums">
              {photoWidthPx} × {photoHeightPx} px ({photoCropStyle === "portrait-rectangle" ? "3:4" : "1:1"})
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5" role="group" aria-label="Photo size presets">
            {[
              { label: "Compact", width: 92 },
              { label: "Standard", width: 116 },
              { label: "Large", width: 136 },
              { label: "Extra large", width: 156 },
            ].map((preset) => {
              const isSelected = Math.abs(photoWidthPx - preset.width) <= 2;
              return (
                <button
                  key={preset.label}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => updateAssetSettings("photo", "widthPx", preset.width)}
                  className={`ui-button ui-button--secondary px-2 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer ${
                    isSelected
                      ? "border-[#6d8ead]/40 bg-[#6d8ead] text-white"
                      : "border-[#1f2937] hover:border-[#6d8ead]/50 bg-[#0a0f1d] text-slate-300 hover:text-white"
                  }`}
                >
                  {preset.label} · {preset.width} px
                </button>
              );
            })}
          </div>

          <input
            type="range"
            id="document-photo-width"
            min={72}
            max={160}
            step={2}
            value={photoWidthPx}
            onChange={(e) => updateAssetSettings("photo", "widthPx", Number(e.target.value))}
            className="min-w-0 w-full accent-[#6d8ead] cursor-pointer"
          />
        </div>
      </div>

      {/* Signature Toggles */}
      <div className="ui-panel bg-[#0e162d] p-4 rounded-xl border border-[#1f2937]/50 space-y-4">
        <div className="flex flex-wrap gap-3 justify-between items-center">
          <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
            <Edit3 className="w-4 h-4 text-[#6d8ead]" /> Handwritten signature
          </h3>
          <input
            type="checkbox"
            aria-label="Show handwritten signature on document"
            checked={app.assetSettings.signature.enabled}
            onChange={(e) => updateAssetSettings("signature", "enabled", e.target.checked)}
            className="w-4 h-4 rounded border-[#1f2937] accent-[#6d8ead] cursor-pointer"
            disabled={!app.assetSettings.signature.filePath}
          />
        </div>

        {sigPath ? (
          <div className="space-y-4">
            <div className="space-y-2 rounded-xl border border-[#1f2937] bg-[#0a0f1d] p-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-white">Current signature</span>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="relative cursor-pointer px-2.5 py-1 rounded-lg border border-[var(--ui-border)] hover:border-[#6d8ead]/40 text-xs font-semibold text-[#8db2d6] bg-[var(--ui-surface-2)] focus-within:ring-2 focus-within:ring-[#6d8ead]">
                    {uploadingSig ? "Uploading…" : "Upload image"}
                    <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" disabled={uploadingSig} onChange={(e) => handleFileSelected(e, "signature")} />
                  </label>
                  {defaultSigPath && defaultSigPath !== sigPath && (
                    <button
                      type="button"
                      onClick={() => applyAssetPath("signature", defaultSigPath, true)}
                      className="px-2.5 py-1 rounded-lg border border-[#1f2937] hover:border-[#6d8ead]/40 text-xs font-semibold text-blue-300 bg-[#0c1328]"
                    >
                      Use default
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => applyAssetPath("signature", undefined, false)}
                    title="Remove signature from this application"
                    aria-label="Remove handwritten signature"
                    className="p-1 rounded-lg border border-[#1f2937] hover:border-rose-500/40 text-slate-400 hover:text-rose-300 bg-[#0c1328]"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div className="bg-white p-2 rounded-lg flex justify-center border border-[#1f2937]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={sigPath}
                  alt="Handwritten signature preview"
                  onLoad={() => setFailedSigPath(null)}
                  onError={() => setFailedSigPath(sigPath)}
                  className="h-10 w-auto object-contain"
                />
              </div>
              {sigLoadError && (
                <p className="text-xs text-amber-300">Could not load saved signature. Upload or draw a new one.</p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="document-signature-width" className="text-xs font-bold text-[#6d8ead] block mb-1">Width in pixels</label>
                <input
                  type="number"
                  id="document-signature-width"
                  value={app.assetSettings.signature.widthPx}
                  onChange={(e) => updateAssetSettings("signature", "widthPx", Number(e.target.value))}
                  className="min-w-0 w-full px-3 py-1 rounded bg-[#0a0f1d] border border-[#1f2937] text-white text-xs"
                  min={80}
                  max={300}
                />
              </div>

              <div>
                <label htmlFor="document-signature-alignment" className="text-xs font-bold text-[#6d8ead] block mb-1">Alignment</label>
                <select
                  id="document-signature-alignment"
                  value={app.assetSettings.signature.alignment}
                  onChange={(e) => updateAssetSettings("signature", "alignment", e.target.value)}
                  className="min-w-0 w-full px-2.5 py-1.5 rounded bg-[#0a0f1d] border border-[#1f2937] text-white text-xs cursor-pointer"
                >
                  <option value="left">Left</option>
                  <option value="center">Center</option>
                  <option value="right">Right</option>
                </select>
              </div>
            </div>
            <button
              type="button"
              onClick={onOpenSignaturePad}
              className="ui-button ui-button--secondary w-full text-center py-1.5 border border-[#1f2937] hover:border-[#6d8ead]/40 rounded-xl text-xs text-[#6d8ead] bg-[#0c1328] font-semibold"
            >
              Draw or replace signature
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-amber-300">No signature saved on this application yet.</p>
            <div className="flex flex-wrap gap-2">
              <label className="relative flex-1 min-w-[150px] flex items-center justify-center gap-2 py-2 px-3 rounded-xl border border-[var(--ui-border)] hover:border-[#6d8ead]/40 text-xs font-semibold text-[#8db2d6] bg-[var(--ui-surface-2)] cursor-pointer focus-within:ring-2 focus-within:ring-[#6d8ead]">
                <FileUp className="w-3.5 h-3.5" />
                {uploadingSig ? "Uploading…" : "Upload signature image"}
                <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" disabled={uploadingSig} onChange={(e) => handleFileSelected(e, "signature")} />
              </label>
              <button
                type="button"
                onClick={onOpenSignaturePad}
                className="flex-1 min-w-[150px] ui-button ui-button--secondary text-center py-2 border border-[#1f2937] hover:border-[#6d8ead]/40 rounded-xl text-xs text-[#6d8ead] bg-[#0c1328] font-semibold"
              >
                Draw signature here
              </button>
            </div>
            {defaultSigPath && (
              <button
                type="button"
                onClick={() => applyAssetPath("signature", defaultSigPath, true)}
                className="ui-button ui-button--secondary w-full text-center py-2 border border-[#1f2937] hover:border-[#6d8ead]/40 rounded-xl text-xs text-blue-300 bg-[#0c1328] font-semibold"
              >
                Use saved signature
              </button>
            )}
          </div>
        )}
      </div>

      {/* Modular Reference Packet & Export Order */}
      {(() => {
        const docs = availableReferences || [];
        const selectedIds = resolveSelectedReferenceIds(app, docs);
        const estimatedRefKb = docs
          .filter((doc) => selectedIds.includes(doc.id))
          .reduce((sum, doc) => sum + doc.approxKb, 0);
        const packetOrder = app.templateSettings.packetOrder || "dach";
        const toggleRef = (id: string) => {
          const next = selectedIds.includes(id)
            ? selectedIds.filter((item) => item !== id)
            : [...selectedIds, id];
          setApp((prev) => prev ? {
            ...prev,
            assetSettings: { ...prev.assetSettings, referenceDocIds: next },
          } : prev);
        };
        return (
          <div className="ui-panel bg-[#0e162d] p-4 rounded-xl border border-[#1f2937]/50 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-white">Local PDF attachments &amp; bundle order</h3>
              {docs.length > 0 && (
                <span className={`text-xs font-semibold px-2 py-0.5 rounded border ${estimatedRefKb > 1500 ? "border-amber-500/40 bg-amber-950/30 text-amber-200" : "border-emerald-500/30 bg-emerald-950/20 text-emerald-200"}`}>
                  Attachments ~{estimatedRefKb} KB
                </span>
              )}
            </div>
            {docs.length === 0 ? (
              <div className="ui-inset rounded-lg border border-dashed border-[#35465f] bg-[#0a0f1d] p-3 text-xs text-slate-300 leading-relaxed">
                No local PDF attachments found. Drop your own PDFs (reference letters, diplomas, certificates) into{" "}
                <code className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[11px] text-slate-100">public/documents/</code>{" "}
                and reload to include them in merged bundles.
              </div>
            ) : (
              <div className="space-y-1.5">
                {docs.map((doc) => {
                  const checked = selectedIds.includes(doc.id);
                  return (
                    <label key={doc.id} className="ui-inset flex items-start justify-between gap-2 p-2.5 rounded-lg bg-[#0a0f1d] border border-[#1f2937] cursor-pointer">
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-white">{doc.label}</div>
                        <div className="text-[11px] text-slate-400">
                          {doc.pageCount ? `${doc.pageCount} ${doc.pageCount === 1 ? "page" : "pages"} · ` : ""}~{doc.approxKb} KB
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleRef(doc.id)}
                        className="mt-1 w-3.5 h-3.5 rounded accent-[#6d8ead] cursor-pointer shrink-0"
                      />
                    </label>
                  );
                })}
              </div>
            )}
            <div>
              <label htmlFor="packet-export-order" className="text-xs font-bold text-[#6d8ead] block mb-1">Full bundle order</label>
              <select
                id="packet-export-order"
                value={packetOrder}
                onChange={(e) => setApp((prev) => prev ? {
                  ...prev,
                  templateSettings: { ...prev.templateSettings, packetOrder: e.target.value as "dach" | "ats" },
                } : prev)}
                className="min-w-0 w-full px-2.5 py-1.5 rounded bg-[#0a0f1d] border border-[#1f2937] text-white text-xs cursor-pointer"
              >
                <option value="dach">DACH standard: Cover Letter → CV → Selected attachments</option>
                <option value="ats">International ATS portal: CV → Cover Letter → Attachments (CV on page 1)</option>
              </select>
              {docs.length > 0 && (
                <p className="mt-1.5 text-[11px] text-slate-400">
                  Attachment merge order: {docs.map((d) => d.label).join(" → ")}.
                </p>
              )}
            </div>
          </div>
        );
      })()}
    </>
  );
}

/**
 * Editor tab for selecting templates, typography, A4 density presets, portrait photo, and signature settings.
 */
export function AssetsDesignTab({
  app,
  setApp,
  updateTemplateSettings,
  updateAssetSettings,
  onOpenSignaturePad,
  onUploadAsset,
  onNotify,
  availableReferences,
  saving,
  onSave,
}: AssetsDesignTabProps) {
  const cvFontSize = documentFontSize(app.templateSettings.fontSize, "cv");
  const letterFontSize = documentFontSize(app.templateSettings.letterFontSize ?? app.templateSettings.fontSize, "letter");
  const letterLineSpacing = Math.max(1.4, app.templateSettings.letterLineSpacing ?? 1.4);
  const letterParagraphSpacing = Math.max(10, app.templateSettings.letterParagraphSpacing ?? 10);
  const needsContrastFallback = accentContrast(app.templateSettings.accentColor) < 4.5;
  const coverLetterTemplateValue =
    (app.templateSettings.coverLetterTemplate as string) === "asr-sidebar"
      ? "editorial-sidebar"
      : app.templateSettings.coverLetterTemplate;
  const applyCvTypography = (settings: Partial<Pick<Application["templateSettings"], "fontSize" | "lineSpacing" | "sectionSpacing">>) => {
    setApp((previous) => previous ? {
      ...previous,
      templateSettings: {
        ...previous.templateSettings,
        letterFontSize: previous.templateSettings.letterFontSize ?? documentFontSize(previous.templateSettings.fontSize, "letter"),
        ...settings,
      },
    } : previous);
  };
  const currentLineSpacing = Math.max(1.38, app.templateSettings.lineSpacing || 1.42);
  const currentSectionSpacing = app.templateSettings.sectionSpacing || 14;
  const activePreset =
    Math.abs(cvFontSize - 10) < 0.05 && Math.abs(currentLineSpacing - 1.38) < 0.015 && currentSectionSpacing === 12
      ? "compact"
      : Math.abs(cvFontSize - 10.5) < 0.05 && Math.abs(currentLineSpacing - 1.42) < 0.015 && currentSectionSpacing === 14
      ? "balanced"
      : Math.abs(cvFontSize - 11) < 0.05 && Math.abs(currentLineSpacing - 1.48) < 0.015 && currentSectionSpacing === 16
      ? "spacious"
      : "custom";
  return (
    <div className="ui-controls space-y-6">
      {/* Templates Selector */}
      <div className="ui-panel bg-[var(--ui-surface)] p-4 rounded-xl border border-[var(--ui-border)] space-y-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
          <Settings className="w-4 h-4 text-[#8db2d6]" /> Document design
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="document-cv-template" className="text-xs font-bold text-[#8db2d6] block mb-1">CV template</label>
            <select
              id="document-cv-template"
              value={app.templateSettings.cvTemplate}
              onChange={(e) => updateTemplateSettings("cvTemplate", e.target.value)}
              className="min-w-0 w-full px-2.5 py-1.5 rounded bg-[var(--ui-inset)] border border-[var(--ui-border)] text-white text-xs cursor-pointer"
            >
              <option value="ats-clean">Single-column CV (ATS Clean)</option>
              <option value="modern-professional">Swiss Editorial CV (clean grid)</option>
              <option value="dach-tabular">DACH Tabular CV (German Lebenslauf)</option>
            </select>
          </div>

          <div>
            <label htmlFor="document-letter-template" className="text-xs font-bold text-[#8db2d6] block mb-1">Cover letter template</label>
            <select
              id="document-letter-template"
              value={coverLetterTemplateValue}
              onChange={(e) => updateTemplateSettings("coverLetterTemplate", e.target.value)}
              className="min-w-0 w-full px-2.5 py-1.5 rounded bg-[var(--ui-inset)] border border-[var(--ui-border)] text-white text-xs cursor-pointer"
            >
              <option value="ats-letter">Single-column Cover Letter</option>
              <option value="din-editorial">DIN 5008 Executive Letter (German standard)</option>
              <option value="editorial-sidebar">Editorial Sidebar Letter</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
          <div>
            <label htmlFor="document-accent" className="text-xs font-bold text-[#8db2d6] block mb-1">Accent color</label>
            <div className="flex flex-wrap gap-2 items-center">
              {EXECUTIVE_ACCENT_SWATCHES.map((swatch) => {
                const selected = app.templateSettings.accentColor.toLowerCase() === swatch.value;
                return (
                  <button
                    key={swatch.value}
                    type="button"
                    data-swatch=""
                    aria-pressed={selected}
                    title={swatch.label}
                    aria-label={swatch.label}
                    onClick={() => updateTemplateSettings("accentColor", swatch.value)}
                    style={{ backgroundColor: swatch.value }}
                    className={`w-6 h-6 rounded-full border transition-transform cursor-pointer ${
                      selected ? "border-white ring-2 ring-[#6d8ead] scale-110" : "border-slate-600 hover:scale-105"
                    }`}
                  />
                );
              })}
              <input
                type="color"
                id="document-accent"
                value={app.templateSettings.accentColor}
                onChange={(e) => updateTemplateSettings("accentColor", e.target.value)}
                className="w-7 h-7 rounded border border-[var(--ui-border)] bg-transparent cursor-pointer"
              />
              <span className="text-xs text-slate-300 font-mono">{app.templateSettings.accentColor}</span>
            </div>
            {needsContrastFallback && <p className="mt-2 text-xs text-amber-200" role="status">The selected color has low contrast on white. The document uses {documentAccent(app.templateSettings.accentColor)} to keep text legible.</p>}
          </div>

          <div>
            <label htmlFor="document-font-family" className="text-xs font-bold text-[#8db2d6] block mb-1">Editorial typography (offline)</label>
            <select
              id="document-font-family"
              value={app.templateSettings.fontFamily}
              onChange={(e) => updateTemplateSettings("fontFamily", e.target.value)}
              className="min-w-0 w-full px-2.5 py-1.5 rounded bg-[var(--ui-inset)] border border-[var(--ui-border)] text-white text-xs cursor-pointer"
            >
              {DOCUMENT_FONT_PRESETS.map((preset) => (
                <option key={preset.id} value={preset.id}>{preset.label}</option>
              ))}
              {!DOCUMENT_FONT_PRESETS.some((p) => p.id === app.templateSettings.fontFamily) && (
                <option value={app.templateSettings.fontFamily}>{app.templateSettings.fontFamily} (legacy)</option>
              )}
            </select>
          </div>
        </div>

        <div className="space-y-3 pt-3 border-t border-[var(--ui-border)]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-xs font-bold text-white">CV typography &amp; spacing</h4>
            <button
              type="button"
              onClick={() => {
                const autoFit = computeSmartAutoFitSettings(app);
                applyCvTypography(autoFit);
              }}
              className="ui-button ui-button--secondary px-2.5 py-1 rounded-lg border border-emerald-500/40 bg-emerald-500/15 text-xs font-bold text-emerald-300 hover:bg-emerald-500/25 cursor-pointer"
            >
              Suggest CV spacing
            </button>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-1.5" role="group" aria-label="CV typography presets">
            <button
              type="button"
              aria-pressed={activePreset === "compact"}
              onClick={() =>
                applyCvTypography({ fontSize: 10, lineSpacing: 1.38, sectionSpacing: 12 })
              }
              className={`ui-button ui-button--secondary px-2 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer ${
                activePreset === "compact"
                  ? "border-[#6d8ead]/60 bg-[#6d8ead] text-white"
                  : "border-[var(--ui-border)] hover:border-[#6d8ead]/50 bg-[var(--ui-inset)] text-slate-300 hover:text-white"
              }`}
            >
              Compact · 10 pt
            </button>
            <button
              type="button"
              aria-pressed={activePreset === "balanced"}
              onClick={() =>
                applyCvTypography({ fontSize: 10.5, lineSpacing: 1.42, sectionSpacing: 14 })
              }
              className={`ui-button ui-button--secondary px-2 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer ${
                activePreset === "balanced"
                  ? "border-[#6d8ead]/60 bg-[#6d8ead] text-white"
                  : "border-[var(--ui-border)] hover:border-[#6d8ead]/50 bg-[var(--ui-inset)] text-slate-300 hover:text-white"
              }`}
            >
              Balanced · 10.5 pt
            </button>
            <button
              type="button"
              aria-pressed={activePreset === "spacious"}
              onClick={() =>
                applyCvTypography({ fontSize: 11, lineSpacing: 1.48, sectionSpacing: 16 })
              }
              className={`ui-button ui-button--secondary px-2 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer ${
                activePreset === "spacious"
                  ? "border-[#6d8ead]/60 bg-[#6d8ead] text-white"
                  : "border-[var(--ui-border)] hover:border-[#6d8ead]/50 bg-[var(--ui-inset)] text-slate-300 hover:text-white"
              }`}
            >
              Spacious · 11 pt
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
            <label className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-[#0a0f1d] border border-[#1f2937] cursor-pointer">
              <span className="text-xs font-semibold text-slate-300">Key achievements</span>
              <input
                type="checkbox"
                checked={app.templateSettings.showKeyAchievements !== false}
                onChange={(e) => updateTemplateSettings("showKeyAchievements", e.target.checked)}
                className="w-3.5 h-3.5 rounded accent-[#6d8ead] cursor-pointer"
              />
            </label>
            <label className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-[#0a0f1d] border border-[#1f2937] cursor-pointer">
              <span className="text-xs font-semibold text-slate-300">Selected projects</span>
              <input
                type="checkbox"
                checked={app.templateSettings.showProjects !== false}
                onChange={(e) => updateTemplateSettings("showProjects", e.target.checked)}
                className="w-3.5 h-3.5 rounded accent-[#6d8ead] cursor-pointer"
              />
            </label>
          </div>

          <div>
            <div className="flex justify-between text-xs font-semibold text-[#6d8ead] mb-1">
              <label htmlFor="document-font-size">CV font size</label>
              <span className="text-white">CV {cvFontSize} pt · Letter {letterFontSize} pt</span>
            </div>
            <input
              type="range"
              id="document-font-size"
              min="10"
              max="12"
              step="0.1"
              value={cvFontSize}
              onChange={(e) => applyCvTypography({ fontSize: Number(e.target.value) })}
              className="min-w-0 w-full accent-[#6d8ead] cursor-pointer"
            />
            <p className="mt-2 text-xs text-slate-300">Adjusting CV typography preserves your current cover letter size. If content exceeds 2 A4 pages, the paginator automatically tightens spacing so it stays within 2 pages.</p>
          </div>

          <div>
            <div className="flex justify-between text-xs font-semibold text-[#6d8ead] mb-1">
              <label htmlFor="document-line-spacing">CV line spacing</label>
              <span className="text-white">{Math.max(1.38, app.templateSettings.lineSpacing || 1.42)}</span>
            </div>
            <input
              type="range"
              id="document-line-spacing"
              min="1.38"
              max="1.65"
              step="0.02"
              value={Math.max(1.38, app.templateSettings.lineSpacing || 1.42)}
              onChange={(e) => updateTemplateSettings("lineSpacing", Number(e.target.value))}
              className="min-w-0 w-full accent-[#6d8ead] cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs font-semibold text-[#6d8ead] mb-1">
              <label htmlFor="document-section-spacing">CV section spacing</label>
              <span className="text-white">{app.templateSettings.sectionSpacing || 14}px</span>
            </div>
            <input
              type="range"
              id="document-section-spacing"
              min="8"
              max="24"
              step="1"
              value={app.templateSettings.sectionSpacing || 14}
              onChange={(e) => updateTemplateSettings("sectionSpacing", Number(e.target.value))}
              className="min-w-0 w-full accent-[#6d8ead] cursor-pointer"
            />
          </div>
        </div>

        <fieldset className="space-y-3 pt-3 border-t border-[#1f2937]/50">
          <legend className="px-1 text-xs font-bold text-white">Cover letter typography &amp; spacing</legend>
          <p className="text-xs text-slate-300">These controls adjust the cover letter independently of the CV.</p>
          <div>
            <div className="flex justify-between gap-2 text-xs font-semibold text-[#6d8ead] mb-1">
              <label htmlFor="document-letter-font-size">Cover letter font size</label>
              <span className="text-white">{letterFontSize} pt</span>
            </div>
            <input id="document-letter-font-size" type="range" min="10.5" max="12" step="0.1" value={letterFontSize} onChange={(e) => updateTemplateSettings("letterFontSize", Number(e.target.value))} className="min-w-0 w-full accent-[#6d8ead] cursor-pointer" />
          </div>
          <div>
            <div className="flex justify-between gap-2 text-xs font-semibold text-[#6d8ead] mb-1">
              <label htmlFor="document-letter-line-spacing">Cover letter line spacing</label>
              <span className="text-white">{letterLineSpacing}</span>
            </div>
            <input id="document-letter-line-spacing" type="range" min="1.4" max="1.65" step="0.01" value={letterLineSpacing} onChange={(e) => updateTemplateSettings("letterLineSpacing", Number(e.target.value))} className="min-w-0 w-full accent-[#6d8ead] cursor-pointer" />
          </div>
          <div>
            <div className="flex justify-between gap-2 text-xs font-semibold text-[#6d8ead] mb-1">
              <label htmlFor="document-letter-paragraph-spacing">Cover letter paragraph spacing</label>
              <span className="text-white">{letterParagraphSpacing} px</span>
            </div>
            <input id="document-letter-paragraph-spacing" type="range" min="10" max="16" step="1" value={letterParagraphSpacing} onChange={(e) => updateTemplateSettings("letterParagraphSpacing", Number(e.target.value))} className="min-w-0 w-full accent-[#6d8ead] cursor-pointer" />
          </div>
        </fieldset>
      </div>

      <AssetResourcePanels
        app={app}
        setApp={setApp}
        updateAssetSettings={updateAssetSettings}
        onOpenSignaturePad={onOpenSignaturePad}
        onUploadAsset={onUploadAsset}
        onNotify={onNotify}
        availableReferences={availableReferences}
      />
      {onSave && <SaveSectionButton label="Save design & attachments" saving={Boolean(saving)} onSave={onSave} />}
    </div>
  );
}
