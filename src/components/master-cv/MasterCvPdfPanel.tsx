"use client";

import React, { useEffect, useRef, useState } from "react";
import { Download, FileText, Image as ImageIcon, Trash2, ZoomIn, ZoomOut } from "lucide-react";
import type { Application, MasterCv } from "@/lib/schemas";
import type { DocumentPaginationResult } from "@/lib/documentPagination";
import {
  getMasterDocumentFooterLabel,
  matchProfileVariant,
  type MasterCvExportLanguage,
  type MasterCvExportOptions,
} from "@/lib/masterCvExport";
import { DOCUMENT_FONT_PRESETS, EXECUTIVE_ACCENT_SWATCHES } from "@/lib/documentDesign";
import { PagedDocumentPreview } from "@/components/editor/PagedDocumentPreview";

interface MasterCvPdfPanelProps {
  masterCv: MasterCv;
  masterApp: Application;
  options: MasterCvExportOptions;
  setOptions: React.Dispatch<React.SetStateAction<MasterCvExportOptions>>;
  exporting: boolean;
  onExportPdf: () => void;
  pageResult: DocumentPaginationResult;
  onPagesMeasured: (result: DocumentPaginationResult) => void;
  onNotify: (msg: string, type: "success" | "error" | "warning" | "info") => void;
}

const ACCENT_PRESETS = EXECUTIVE_ACCENT_SWATCHES;

export function MasterCvPdfPanel({
  masterCv,
  masterApp,
  options,
  setOptions,
  exporting,
  onExportPdf,
  pageResult,
  onPagesMeasured,
  onNotify,
}: MasterCvPdfPanelProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const paperRef = useRef<HTMLDivElement>(null);
  const [availableWidth, setAvailableWidth] = useState(0);
  const [paperSize, setPaperSize] = useState({ width: 796, height: 1125 });
  const [zoomScale, setZoomScale] = useState(0.78);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  useEffect(() => {
    const viewport = viewportRef.current;
    const paper = paperRef.current;
    if (!viewport || !paper) return;
    const measure = () => {
      const style = getComputedStyle(viewport);
      setAvailableWidth(viewport.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight));
      setPaperSize((prev) =>
        prev.width === paper.offsetWidth && prev.height === paper.offsetHeight
          ? prev
          : { width: paper.offsetWidth, height: paper.offsetHeight }
      );
    };
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    observer.observe(paper);
    measure();
    return () => observer.disconnect();
  }, []);

  const displayScale = availableWidth > 0 ? Math.min(zoomScale, availableWidth / paperSize.width) : zoomScale;

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setUploadingPhoto(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("type", "photo");
    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok || !data.url) {
        onNotify(data.error || "Could not upload photo.", "error");
        return;
      }
      try {
        window.localStorage.setItem("jas_default_photo", data.url);
        window.localStorage.setItem("jas_photo_enabled", "true");
      } catch {
        // Ignore restricted browser storage
      }
      setOptions((prev) => ({ ...prev, includePhoto: true, photoPath: data.url }));
      onNotify("Photo uploaded and applied to Master CV.", "success");
    } catch {
      onNotify("Could not upload photo.", "error");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleRemovePhoto = () => {
    try {
      window.localStorage.setItem("jas_photo_enabled", "false");
    } catch { /* ignore */ }
    setOptions((prev) => ({ ...prev, includePhoto: false }));
    onNotify("Photo disabled for the Master PDF.", "info");
  };

  const activeHeadlineCat = options.variantCategory || masterCv.headlineVariants[0]?.category || "";
  const resolvedProfile = matchProfileVariant(masterCv, activeHeadlineCat, options.profileCategory);
  const hiddenEntriesCount =
    (masterCv.experienceHistory || []).filter((e) => e.include === false).length +
    (masterCv.projectsHistory || []).filter((p) => p.include === false).length;
  const hasWorkAuthorizationText = Boolean((masterCv.workAuthorization || masterCv.workPermitGermany)?.trim());
  const footerLabel = getMasterDocumentFooterLabel(options.language);

  return (
    <div className="space-y-5">
      <div className="ui-panel rounded-xl px-4 py-3 text-sm text-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-2.5 max-w-3xl">
          <FileText className="w-5 h-5 text-blue-300 shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <p className="font-semibold text-white">Complete Master CV PDF (3–5+ pages, no 2-page cap)</p>
            <p className="text-xs text-slate-400 mt-0.5">
              Built for job boards, recruiters, and career archives with your full history, pillars, and projects. Tailored applications inside each job stay focused within the 2-page target.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onExportPdf}
          disabled={exporting}
          className="ui-button ui-button--primary"
        >
          <Download className="w-4 h-4" aria-hidden="true" />
          {exporting
            ? "Generating PDF…"
            : pageResult.pages > 0
            ? `Download Master PDF (${pageResult.pages} ${pageResult.pages === 1 ? "page" : "pages"})`
            : "Download Master PDF"}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[370px_minmax(0,1fr)] gap-6 items-start">
        <div className="ui-panel p-5 space-y-5 lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto">
          <div>
            <h3 className="text-sm font-bold text-white border-b border-[var(--ui-border)] pb-2 mb-3">Master PDF Settings</h3>
            <div className="space-y-3">
              <div>
                <label htmlFor="master-pdf-variant" className="text-xs font-semibold text-slate-300 block mb-1">
                  Primary professional headline
                </label>
                <select
                  id="master-pdf-variant"
                  value={activeHeadlineCat}
                  onChange={(e) => setOptions((prev) => ({ ...prev, variantCategory: e.target.value, profileCategory: "" }))}
                  className="w-full px-3 py-2 rounded-lg text-xs"
                >
                  {masterCv.headlineVariants.map((variant) => (
                    <option key={variant.category} value={variant.category}>
                      {variant.category}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="master-pdf-profile" className="text-xs font-semibold text-slate-300 block mb-1">
                  Professional profile / summary
                </label>
                <select
                  id="master-pdf-profile"
                  value={options.profileCategory || resolvedProfile?.category || ""}
                  onChange={(e) => setOptions((prev) => ({ ...prev, profileCategory: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg text-xs"
                >
                  {masterCv.profileVariants.map((variant) => (
                    <option key={variant.category} value={variant.category}>
                      {variant.category}
                    </option>
                  ))}
                </select>
                {resolvedProfile && (
                  <p className="mt-1 text-[11px] text-slate-400">
                    Active profile: <strong className="text-slate-200">{resolvedProfile.category}</strong>
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="master-pdf-template" className="text-xs font-semibold text-slate-300 block mb-1">
                    Template
                  </label>
                  <select
                    id="master-pdf-template"
                    value={options.template}
                    onChange={(e) =>
                      setOptions((prev) => ({
                        ...prev,
                        template: e.target.value as "ats-clean" | "modern-professional" | "dach-tabular",
                      }))
                    }
                    className="w-full px-3 py-2 rounded-lg text-xs"
                  >
                    <option value="dach-tabular">DACH Tabular</option>
                    <option value="ats-clean">ATS Clean</option>
                    <option value="modern-professional">Modern Editorial</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="master-pdf-language" className="text-xs font-semibold text-slate-300 block mb-1">
                    Section language
                  </label>
                  <select
                    id="master-pdf-language"
                    value={options.language}
                    onChange={(e) =>
                      setOptions((prev) => ({
                        ...prev,
                        language: e.target.value as MasterCvExportLanguage,
                      }))
                    }
                    className="w-full px-3 py-2 rounded-lg text-xs"
                  >
                    <option value="English">English</option>
                    <option value="German">German (Deutsch)</option>
                    <option value="Spanish">Spanish (Español)</option>
                  </select>
                </div>
              </div>
              <div>
                <label htmlFor="master-pdf-font" className="text-xs font-semibold text-slate-300 block mb-1">
                  Editorial typography
                </label>
                <select
                  id="master-pdf-font"
                  value={options.fontFamily}
                  onChange={(e) => setOptions((prev) => ({ ...prev, fontFamily: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg text-xs"
                >
                  {DOCUMENT_FONT_PRESETS.map((preset) => (
                    <option key={preset.id} value={preset.id}>{preset.label}</option>
                  ))}
                </select>
              </div>
              {options.language !== "English" && (
                <p className="text-[11px] text-slate-400">
                  Localizes section headings, dates, and education labels; experience bullets keep their original Master CV wording.
                </p>
              )}
            </div>
          </div>

          <div className="border-t border-[var(--ui-border)] pt-4 space-y-2.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-blue-300">Content scope</h4>
            <label className="flex items-start gap-2.5 text-xs text-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={options.includeDetailedPillars}
                onChange={(e) => setOptions((prev) => ({ ...prev, includeDetailedPillars: e.target.checked }))}
                className="mt-0.5 rounded border-slate-600"
              />
              <span>Include all detailed responsibilities by pillar (generates a full 3–5+ page CV)</span>
            </label>
            <label className="flex items-start gap-2.5 text-xs text-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={options.includeHiddenEntries}
                onChange={(e) => setOptions((prev) => ({ ...prev, includeHiddenEntries: e.target.checked }))}
                className="mt-0.5 rounded border-slate-600"
              />
              <span>
                Include entries hidden by default ({hiddenEntriesCount > 0 ? `${hiddenEntriesCount} hidden` : "none currently hidden"})
              </span>
            </label>
            <label className="flex items-start gap-2.5 text-xs text-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={options.includeAchievementsPool}
                onChange={(e) => setOptions((prev) => ({ ...prev, includeAchievementsPool: e.target.checked }))}
                className="mt-0.5 rounded border-slate-600"
              />
              <span>Include full achievements library ({masterCv.achievementsPool.length} {masterCv.achievementsPool.length === 1 ? "achievement" : "achievements"})</span>
            </label>
            <label className="flex items-start gap-2.5 text-xs text-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={options.includeSpecializedCompetencies}
                onChange={(e) => setOptions((prev) => ({ ...prev, includeSpecializedCompetencies: e.target.checked }))}
                className="mt-0.5 rounded border-slate-600"
              />
              <span>Include specialized competencies & methodologies ({masterCv.specializedCompetencies?.length || 0})</span>
            </label>
            <label className={`flex items-start gap-2.5 text-xs ${hasWorkAuthorizationText ? "text-slate-200 cursor-pointer" : "text-slate-500"}`}>
              <input
                type="checkbox"
                checked={hasWorkAuthorizationText && options.includeWorkPermit}
                disabled={!hasWorkAuthorizationText}
                onChange={(e) => setOptions((prev) => ({ ...prev, includeWorkPermit: e.target.checked }))}
                className="mt-0.5 rounded border-slate-600"
              />
              <span>
                Include work authorization
                {!hasWorkAuthorizationText ? " (not set in Personal Details)" : ""}
              </span>
            </label>
          </div>

          <div className="border-t border-[var(--ui-border)] pt-4 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-blue-300">Photo & A4 typography</h4>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={options.includePhoto && Boolean(options.photoPath)}
                  disabled={!options.photoPath}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    try { window.localStorage.setItem("jas_photo_enabled", String(checked)); } catch { /* ignore */ }
                    setOptions((prev) => ({ ...prev, includePhoto: checked }));
                  }}
                  className="rounded border-slate-600"
                />
                <span>Include profile photo</span>
              </label>
              <label className="ui-button ui-button--secondary cursor-pointer text-xs focus-within:outline-2 focus-within:outline-[var(--ui-focus)]">
                <ImageIcon className="w-3.5 h-3.5" aria-hidden="true" />
                {uploadingPhoto ? "Uploading…" : options.photoPath ? "Change photo" : "Upload photo"}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="sr-only"
                  disabled={uploadingPhoto}
                  onChange={handlePhotoUpload}
                />
              </label>
            </div>

            {options.photoPath && (
              <div className="ui-inset flex items-center gap-3 rounded-xl p-2.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={options.photoPath}
                  alt="Master CV profile photo thumbnail"
                  className="h-14 w-11 rounded object-cover object-[center_14%] border border-slate-600 shrink-0"
                />
                <div className="min-w-0 flex-1 grid grid-cols-1 gap-1.5">
                  <div className="grid grid-cols-2 gap-1.5">
                    <select
                      aria-label="Photo placement"
                      value={options.photoPlacement}
                      onChange={(e) => setOptions((prev) => ({ ...prev, photoPlacement: e.target.value as MasterCvExportOptions["photoPlacement"] }))}
                      className="w-full px-2 py-1 rounded text-xs"
                    >
                      <option value="header-right">Right</option>
                      <option value="header-left">Left</option>
                      <option value="sidebar">Sidebar</option>
                    </select>
                    <select
                      aria-label="Photo crop style"
                      value={options.photoCropStyle}
                      onChange={(e) => setOptions((prev) => ({ ...prev, photoCropStyle: e.target.value as MasterCvExportOptions["photoCropStyle"] }))}
                      className="w-full px-2 py-1 rounded text-xs"
                    >
                      <option value="portrait-rectangle">Portrait 3:4</option>
                      <option value="rounded-square">Rounded</option>
                      <option value="circle">Circle</option>
                    </select>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <label className="flex items-center gap-1.5 text-[11px] text-slate-300 flex-1">
                      Width ({options.photoWidthPx}px)
                      <input
                        type="range"
                        min={76}
                        max={128}
                        step={2}
                        value={options.photoWidthPx}
                        onChange={(e) => setOptions((prev) => ({ ...prev, photoWidthPx: Number(e.target.value) }))}
                        className="w-20"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={handleRemovePhoto}
                      title="Disable photo"
                      aria-label="Disable photo for Master PDF"
                      className="ui-button ui-button--danger-subtle p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <label htmlFor="master-pdf-accent" className="text-[11px] text-slate-400 block mb-1">Accent</label>
                <select
                  id="master-pdf-accent"
                  value={options.accentColor}
                  onChange={(e) => setOptions((prev) => ({ ...prev, accentColor: e.target.value }))}
                  className="w-full px-2 py-1.5 rounded text-xs"
                >
                  {ACCENT_PRESETS.map((preset) => (
                    <option key={preset.value} value={preset.value}>{preset.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="master-pdf-fontsize" className="text-[11px] text-slate-400 block mb-1">Font size</label>
                <select
                  id="master-pdf-fontsize"
                  value={String(options.fontSize)}
                  onChange={(e) => setOptions((prev) => ({ ...prev, fontSize: Number(e.target.value) }))}
                  className="w-full px-2 py-1.5 rounded text-xs"
                >
                  <option value="9.5">9.5 pt</option>
                  <option value="10">10 pt</option>
                  <option value="10.5">10.5 pt</option>
                </select>
              </div>
              <div>
                <label htmlFor="master-pdf-linespacing" className="text-[11px] text-slate-400 block mb-1">Line height</label>
                <select
                  id="master-pdf-linespacing"
                  value={String(options.lineSpacing)}
                  onChange={(e) => setOptions((prev) => ({ ...prev, lineSpacing: Number(e.target.value) }))}
                  className="w-full px-2 py-1.5 rounded text-xs"
                >
                  <option value="1.32">1.32</option>
                  <option value="1.38">1.38</option>
                  <option value="1.45">1.45</option>
                </select>
              </div>
            </div>
            <div>
              <label htmlFor="master-pdf-spacing" className="text-[11px] text-slate-400 flex items-center justify-between mb-1">
                <span>Section spacing</span>
                <span className="tabular-nums text-slate-200">{options.sectionSpacing} px</span>
              </label>
              <input
                id="master-pdf-spacing"
                type="range"
                min={6}
                max={20}
                step={1}
                value={options.sectionSpacing}
                onChange={(e) => setOptions((prev) => ({ ...prev, sectionSpacing: Number(e.target.value) }))}
                className="w-full accent-blue-400"
              />
            </div>
          </div>
        </div>

        <div ref={viewportRef} className="ui-preview min-w-0 rounded-2xl border border-[var(--ui-border)] bg-[#090d16] px-4 pb-4 flex flex-col items-center">
          <div className="sticky top-0 z-10 w-full flex flex-wrap items-center justify-between gap-2 bg-[#090d16]/95 backdrop-blur py-3 mb-3 border-b border-[var(--ui-border)] text-xs text-slate-300">
            <span role="status" className="font-medium text-emerald-300">
              {pageResult.pages > 0
                ? `${pageResult.pages} ${pageResult.pages === 1 ? "A4 page" : "A4 pages"} · Unbounded mode (no 2-page cap)`
                : "Composing A4 pages…"}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                aria-label="Zoom out preview"
                onClick={() => setZoomScale((z) => Math.max(0.45, +(z - 0.1).toFixed(2)))}
                className="ui-button ui-button--secondary p-1.5"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="w-12 text-center font-mono tabular-nums" title={`Target zoom: ${Math.round(zoomScale * 100)}%`}>
                {Math.round(displayScale * 100)}%
              </span>
              <button
                type="button"
                aria-label="Zoom in preview"
                onClick={() => setZoomScale((z) => Math.min(1.15, +(z + 0.1).toFixed(2)))}
                className="ui-button ui-button--secondary p-1.5"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {pageResult.warnings.length > 0 && (
            <div role="status" className="w-full mb-3 rounded-xl border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-xs text-amber-200 space-y-0.5">
              {pageResult.warnings.map((w, i) => <p key={i}>• {w}</p>)}
            </div>
          )}

          <div className="relative shrink-0" style={{ width: paperSize.width * displayScale, height: paperSize.height * displayScale }}>
            <div
              ref={paperRef}
              style={{ transform: `scale(${displayScale})`, transformOrigin: "top left" }}
              className="ui-print-reset absolute top-0 left-0 w-max shadow-2xl shadow-black/80 border border-slate-800 rounded-sm overflow-hidden"
            >
              <PagedDocumentPreview
                app={masterApp}
                type="cv"
                unboundedPages
                documentLabel={footerLabel}
                onMeasured={onPagesMeasured}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
