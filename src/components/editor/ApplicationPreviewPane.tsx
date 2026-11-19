import React, { useDeferredValue, useEffect, useRef, useState } from "react";
import type { Application } from "@/lib/schemas";
import { buildStarPrepData } from "@/lib/starPrep";
import { CV_LENGTH_POLICIES } from "@/lib/editorialPolicy";
import { PagedDocumentPreview } from "./PagedDocumentPreview";
import type { DocumentPaginationResult } from "@/lib/documentPagination";
import { documentFontSize } from "@/lib/documentDesign";
import {
  AtsCleanCv,
  ModernProfessionalCv,
  DachTabularCv,
  AtsLetter,
  EditorialSidebarLetter,
  DinEditorialLetter,
  StarPrepGuide,
} from "@/components/templates/DocumentTemplates";
import {
  analyzeApplicationReadiness,
  computeSmartAutoFitSettings,
} from "@/lib/aiJsonMapper";
import { applyTextCleanup, proposeTextCleanup, type CleanupProposal } from "@/lib/textCleanup";
import type { EditorTab } from "@/lib/finalReview";
import { TextCleanupDialog } from "./TextCleanupDialog";

interface ApplicationPreviewPaneProps {
  app: Application;
  setApp: React.Dispatch<React.SetStateAction<Application | null>>;
  activePreviewTab: "cv" | "letter" | "prep";
  zoomScale: number;
  setZoomScale: React.Dispatch<React.SetStateAction<number>>;
  updateTemplateSettings: (field: string, val: string | number | boolean) => void;
  /** Reports the real A4 page count measured by the shared paginator. */
  onPagesMeasured?: (type: "cv" | "letter", pages: number) => void;
  onNavigateTab?: (tab: EditorTab, anchorId?: string) => void;
}

/**
 * Right-hand A4 live document preview panel.
 * Uses useDeferredValue so typing in left-hand editor fields never stutters on heavy template or readiness recalculations.
 */
export function ApplicationPreviewPane({
  app,
  setApp,
  activePreviewTab,
  zoomScale,
  setZoomScale,
  updateTemplateSettings,
  onPagesMeasured,
  onNavigateTab,
}: ApplicationPreviewPaneProps) {
  const deferredApp = useDeferredValue(app);
  const [drillOpen, setDrillOpen] = useState(false);
  const [drillCategory, setDrillCategory] = useState<string>("all");
  const [drillIdx, setDrillIdx] = useState(0);
  const [revealAnswer, setRevealAnswer] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);
  const paperRef = useRef<HTMLDivElement>(null);
  const [availableWidth, setAvailableWidth] = useState(0);
  const [paperSize, setPaperSize] = useState({ width: 796, height: 1125 });
  const [pageLayout, setPageLayout] = useState<DocumentPaginationResult>({ pages: 0, height: 0, warnings: [] });
  const [cleanupProposal, setCleanupProposal] = useState<CleanupProposal | null>(null);
  // Undo is offered only while the draft is exactly the cleaned result.
  const [cleanupUndo, setCleanupUndo] = useState<{ previous: Application; applied: Application; skipped: number } | null>(null);
  // A save may replace the object (new revision); compare the document content instead.
  const contentKey = (value: Application) => JSON.stringify({ ...value, revision: undefined, dateModified: undefined, crm: undefined });
  const canUndoCleanup = cleanupUndo !== null && (cleanupUndo.applied === app || contentKey(cleanupUndo.applied) === contentKey(app));

  // Scale only the surrounding preview. Document roots retain their A4 styles and
  // remain mounted for exports, including documents in inactive preview tabs.
  useEffect(() => {
    const viewport = viewportRef.current;
    const paper = paperRef.current;
    if (!viewport || !paper) return;
    const measure = () => {
      const style = getComputedStyle(viewport);
      setAvailableWidth(viewport.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight));
      const width = paper.offsetWidth;
      const height = paper.offsetHeight;
      setPaperSize((previous) => previous.width === width && previous.height === height ? previous : { width, height });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    observer.observe(paper);
    measure();
    return () => observer.disconnect();
  }, []);
  const displayScale = availableWidth > 0 ? Math.min(zoomScale, availableWidth / paperSize.width) : zoomScale;

  const readiness = analyzeApplicationReadiness(deferredApp);
  const wordBudget = CV_LENGTH_POLICIES[app.promptContext?.options.cvLengthMode || "auto_clean"];
  const isWordCountIdeal = readiness.totalCvWords >= wordBudget.minWords && readiness.totalCvWords <= wordBudget.maxWords;
  const aiIssueCount = readiness.aiBuzzwordsFound.length + readiness.duplicateAchievementsCount;
  const showAch = app.templateSettings.showKeyAchievements !== false;
  const showProj = app.templateSettings.showProjects !== false;
  const prepData = activePreviewTab === "prep" ? buildStarPrepData(deferredApp) : null;
  const drillCategories = prepData
    ? Array.from(new Set(prepData.drillDeck.map((card) => card.categoryLabel || card.category)))
    : [];
  const filteredDrillDeck = prepData
    ? (drillCategory === "all"
        ? prepData.drillDeck
        : prepData.drillDeck.filter((card) => (card.categoryLabel || card.category) === drillCategory))
    : [];
  const safeDrillIdx = filteredDrillDeck.length > 0 ? Math.min(drillIdx, filteredDrillDeck.length - 1) : 0;
  const activeDrillCard = filteredDrillDeck[safeDrillIdx] || null;
  const fitScale = availableWidth > 0 ? Math.min(1.2, Math.max(0.4, Number((availableWidth / paperSize.width).toFixed(2)))) : 0.7;

  return (
    <div ref={viewportRef} className="ui-preview min-w-0 w-full flex-1 bg-[var(--ui-canvas)] overflow-y-auto overflow-x-hidden flex flex-col items-center px-4 pb-6 pt-3 relative">
      {/* Live Human & ATS Readiness Toolbar + Zoom Controls */}
      <div className="ui-preview-toolbar ui-controls w-full max-w-[940px] mb-4 flex flex-wrap items-center justify-between gap-3 z-10 lg:sticky lg:top-0 lg:bg-[var(--ui-canvas)]/95 lg:backdrop-blur-sm lg:py-2 lg:border-b lg:border-[var(--ui-border-subtle)]">
        {activePreviewTab !== "prep" && <p role="status" className="w-full text-xs text-slate-300">
          {pageLayout.pages ? `${pageLayout.pages} ${pageLayout.pages === 1 ? "A4 page" : "A4 pages"}${activePreviewTab === "cv" ? " (max 2 pages)" : ""} · Shared layout with PDF export` : "Composing A4 pages…"}
          {pageLayout.pages > (activePreviewTab === "cv" ? 2 : 1) && <span className="block font-semibold text-amber-300">Page limit exceeded ({pageLayout.pages} pages): tighten bullets or summary before exporting; legible typography (≥ 9.3 pt) is preserved.</span>}
          {pageLayout.warnings.map((warning) => <span key={warning} className="block text-amber-200">{warning}</span>)}
        </p>}
        <div className="ui-inset min-w-0 border rounded-xl px-3 py-2 flex flex-wrap items-center gap-2.5">
          <span
            className={`text-xs font-bold px-2 py-0.5 rounded-md border ${
              isWordCountIdeal
                ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
                : "bg-amber-500/10 text-amber-300 border-amber-500/30"
            }`}
            title={`Target length: ${wordBudget.minWords}–${wordBudget.maxWords} words. Check exact pages in the live preview.`}
          >
            CV: ~{readiness.totalCvWords} words {isWordCountIdeal ? "· On target" : readiness.totalCvWords < wordBudget.minWords ? "· Brief" : "· Dense"}
          </span>

          {readiness.coverLetterMetricOverlapCount >= 3 && (
            <span
              className="text-xs font-semibold px-2 py-0.5 rounded-md border bg-amber-500/10 text-amber-300 border-amber-500/30"
              title="Figures in cover letter paragraphs that also appear in the selected CV. Check whether the letter adds distinct motivation and context."
            >
              Letter: {readiness.coverLetterMetricOverlapCount} repeated CV figures (paragraphs)
            </span>
          )}

          <span
            className={`text-xs font-semibold px-2 py-0.5 rounded-md border ${
              readiness.longBulletsCount === 0
                ? "bg-slate-800/80 text-slate-300 border-slate-700"
                : "bg-amber-500/10 text-amber-300 border-amber-500/30"
            }`}
            title="Review bullets over 28 words while keeping the context that backs each claim."
          >
            {readiness.totalBullets} bullets {readiness.longBulletsCount > 0 ? `(${readiness.longBulletsCount} >28 words)` : "· Concise"}
          </span>

          {canUndoCleanup && (
            <button
              type="button"
              onClick={() => {
                // Restore the exact previous content; keep the current revision so the next save is not a conflict.
                setApp((current) => current ? { ...cleanupUndo.previous, revision: current.revision, dateModified: current.dateModified, crm: current.crm } : current);
                setCleanupUndo(null);
              }}
              className="text-xs font-bold px-2.5 py-0.5 rounded-md bg-[#6d8ead]/15 text-white border border-[#6d8ead]/40"
            >
              Undo cleanup{cleanupUndo.skipped ? ` (${cleanupUndo.skipped} skipped)` : ""}
            </button>
          )}
          {aiIssueCount > 0 ? (
            <button
              type="button"
              onClick={() => setCleanupProposal(proposeTextCleanup(app))}
              className="text-xs font-bold px-2.5 py-0.5 rounded-md bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 transition-all cursor-pointer"
              title={`Detected clichés: ${readiness.aiBuzzwordsFound.join(", ") || "none"} | Achievements overlapping Experience: ${readiness.duplicateAchievementsCount}`}
            >
              Review wording ({aiIssueCount} {aiIssueCount === 1 ? "flag" : "flags"})
            </button>
          ) : (
            <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
              No style flags detected
            </span>
          )}

          {activePreviewTab === "cv" && (
            <>
              <span className="text-slate-700" aria-hidden="true">|</span>

              <button
                type="button"
                onClick={() => updateTemplateSettings("showKeyAchievements", !showAch)}
                className={`text-xs font-semibold px-2 py-0.5 rounded-md border transition-all cursor-pointer ${
                  showAch
                    ? "bg-[#10233f] text-white border-[#6d8ead]/40"
                    : "bg-[var(--ui-inset)] text-slate-400 border-[var(--ui-border)]"
                }`}
                aria-pressed={showAch}
                title="Show or hide the Key Achievements section"
              >
                Achievements: {showAch ? "shown" : "hidden"}
              </button>

              <button
                type="button"
                onClick={() => updateTemplateSettings("showProjects", !showProj)}
                className={`text-xs font-semibold px-2 py-0.5 rounded-md border transition-all cursor-pointer ${
                  showProj
                    ? "bg-[#10233f] text-white border-[#6d8ead]/40"
                    : "bg-[var(--ui-inset)] text-slate-400 border-[var(--ui-border)]"
                }`}
                aria-pressed={showProj}
                title="Show or hide the Projects section"
              >
                Projects: {showProj ? "shown" : "hidden"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setApp((previous) => previous ? {
                    ...previous,
                    templateSettings: {
                      ...previous.templateSettings,
                      letterFontSize: previous.templateSettings.letterFontSize ?? documentFontSize(previous.templateSettings.fontSize, "letter"),
                      ...computeSmartAutoFitSettings(previous),
                    },
                  } : previous);
                }}
                className="text-xs font-bold px-2.5 py-0.5 rounded-md bg-[#6d8ead]/15 hover:bg-[#6d8ead]/30 text-white border border-[#6d8ead]/40 transition-all cursor-pointer"
                title="Suggest CV font size and line spacing while keeping cover letter settings intact"
              >
                Auto-fit CV ({documentFontSize(app.templateSettings.fontSize)} pt)
              </button>
            </>
          )}
        </div>

        {/* Zoom controls */}
        <div className="ui-inset border rounded-xl px-3 py-1.5 flex items-center gap-2">
          <span className="text-xs text-slate-300 font-bold">Zoom</span>
          <input
            type="range"
            min="0.4"
            max="1.2"
            step="0.05"
            aria-label="Preview zoom level"
            value={zoomScale}
            onChange={(e) => setZoomScale(Number(e.target.value))}
            className="w-20 accent-[#6d8ead] cursor-pointer"
          />
          <span className="text-xs text-white font-mono font-bold w-10 text-right">{Math.round(displayScale * 100)}%</span>
          <button
            type="button"
            onClick={() => setZoomScale(fitScale)}
            className="text-[11px] font-semibold px-2 py-0.5 rounded bg-[var(--ui-surface-2)] hover:bg-slate-700 text-slate-200 border border-[var(--ui-border)] cursor-pointer"
            title="Fit A4 page to available preview width"
          >
            Fit
          </button>
        </div>
      </div>

      {/* Interactive Mock Interview Simulator (shown only in STAR Prep tab; excluded from A4 PDF DOM node) */}
      {activePreviewTab === "prep" && prepData && prepData.drillDeck.length > 0 && (
        <div className="ui-controls w-full max-w-[940px] mb-4 z-20">
          <div className="ui-inset border rounded-xl p-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white">Interview practice</span>
                <span className="text-xs px-2 py-0.5 rounded bg-[#10233f] text-slate-300 border border-[#1f2937]">
                  {prepData.drillDeck.length} questions · {prepData.concerns.length} objections{prepData.salaryDefense.anchorScript ? " · Salary talking points ready" : ""}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setDrillOpen((prev) => !prev);
                  setRevealAnswer(false);
                }}
                className="px-3 py-1 rounded-lg bg-[#6d8ead]/20 hover:bg-[#6d8ead]/35 text-white text-xs font-bold border border-[#6d8ead]/40 transition-all cursor-pointer"
              >
                {drillOpen ? "Close practice" : "Start practice"}
              </button>
            </div>

            {drillOpen && activeDrillCard && (
              <div className="mt-3 pt-3 border-t border-[var(--ui-border)] space-y-3">
                {drillCategories.length > 1 && (
                  <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter practice questions by category">
                    <button
                      type="button"
                      onClick={() => { setDrillCategory("all"); setDrillIdx(0); setRevealAnswer(false); }}
                      aria-pressed={drillCategory === "all"}
                      className={`text-[11px] font-semibold px-2 py-0.5 rounded border cursor-pointer ${drillCategory === "all" ? "bg-[#10233f] text-white border-[#6d8ead]/50" : "bg-[var(--ui-surface)] text-slate-300 border-[var(--ui-border)]"}`}
                    >
                      All ({prepData.drillDeck.length})
                    </button>
                    {drillCategories.map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => { setDrillCategory(cat); setDrillIdx(0); setRevealAnswer(false); }}
                        aria-pressed={drillCategory === cat}
                        className={`text-[11px] font-semibold px-2 py-0.5 rounded border cursor-pointer ${drillCategory === cat ? "bg-[#10233f] text-white border-[#6d8ead]/50" : "bg-[var(--ui-surface)] text-slate-300 border-[var(--ui-border)]"}`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                )}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                    {activeDrillCard.categoryLabel || activeDrillCard.category}
                  </span>
                  <span className="text-xs font-mono text-slate-300">
                    Question {safeDrillIdx + 1} / {filteredDrillDeck.length}
                  </span>
                </div>

                <div className="text-sm font-semibold text-white leading-snug">
                  {activeDrillCard.prompt}
                </div>

                {activeDrillCard.context && (
                  <div className="text-xs text-[#8db2d6]">{activeDrillCard.context}</div>
                )}

                {revealAnswer ? (
                  <div className="bg-[var(--ui-surface)] border border-emerald-500/30 rounded-lg p-3 space-y-2">
                    <div className="text-xs text-emerald-200 leading-relaxed font-medium">
                      {activeDrillCard.suggestedAnswer}
                    </div>
                    {activeDrillCard.keyBullets.length > 0 && (
                      <ul className="list-disc pl-4 space-y-1 text-xs text-slate-300">
                        {activeDrillCard.keyBullets.map((b, i) => (
                          <li key={i}>{b}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ) : (
                  <div className="text-xs text-slate-400 italic">
                    Answer out loud first, then reveal the suggested talking points and supporting evidence.
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setDrillIdx((prev) => (prev - 1 + filteredDrillDeck.length) % filteredDrillDeck.length);
                        setRevealAnswer(false);
                      }}
                      className="px-2.5 py-1 rounded bg-[#10233f] hover:bg-[#1a335a] text-slate-200 text-xs font-semibold border border-[var(--ui-border)] cursor-pointer"
                    >
                      ← Previous
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDrillIdx((prev) => (prev + 1) % filteredDrillDeck.length);
                        setRevealAnswer(false);
                      }}
                      className="px-2.5 py-1 rounded bg-[#10233f] hover:bg-[#1a335a] text-slate-200 text-xs font-semibold border border-[var(--ui-border)] cursor-pointer"
                    >
                      Next →
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setRevealAnswer((prev) => !prev)}
                    className="px-3 py-1 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 text-xs font-bold border border-emerald-500/40 cursor-pointer"
                  >
                    {revealAnswer ? "Hide talking points" : "Show talking points & key bullets"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Source nodes stay mounted for export. Pagination happens in an isolated document. */}
      <div aria-hidden="true" style={{ position: "absolute", left: -10000, top: 0, width: "210mm", pointerEvents: "none" }}>
        <div style={{ display: activePreviewTab === "cv" ? "block" : "none" }}>
          {deferredApp.templateSettings.cvTemplate === "modern-professional"
            ? <ModernProfessionalCv data={deferredApp} />
            : deferredApp.templateSettings.cvTemplate === "dach-tabular"
            ? <DachTabularCv data={deferredApp} />
            : <AtsCleanCv data={deferredApp} />}
        </div>
        <div style={{ display: activePreviewTab === "letter" ? "block" : "none" }}>
          {deferredApp.templateSettings.coverLetterTemplate === "editorial-sidebar" ||
          (deferredApp.templateSettings.coverLetterTemplate as string) === "asr-sidebar"
            ? <EditorialSidebarLetter data={deferredApp} />
            : deferredApp.templateSettings.coverLetterTemplate === "din-editorial"
            ? <DinEditorialLetter data={deferredApp} />
            : <AtsLetter data={deferredApp} />}
        </div>
      </div>
      {/* Physically composed A4 pages; only this outer wrapper is zoomed. */}
      <div className="relative shrink-0" style={{ width: paperSize.width * displayScale, height: paperSize.height * displayScale }}>
        <div
          ref={paperRef}
          style={{
            transform: `scale(${displayScale})`,
            transformOrigin: "top left",
          }}
          className="ui-print-reset absolute top-0 left-0 w-max shadow-2xl shadow-black/80 border border-slate-800 rounded-sm overflow-hidden"
        >
          {activePreviewTab !== "prep" && <PagedDocumentPreview app={deferredApp} type={activePreviewTab} onMeasured={(layout) => { setPageLayout(layout); if (layout.pages) onPagesMeasured?.(activePreviewTab, layout.pages); }} />}
          <div style={{ display: activePreviewTab === "prep" ? "block" : "none" }}>
            <StarPrepGuide data={deferredApp} />
          </div>
        </div>
      </div>
      {cleanupProposal && (
        <TextCleanupDialog
          proposal={cleanupProposal}
          onCancel={() => setCleanupProposal(null)}
          onGoToManual={onNavigateTab ? () => {
            setCleanupProposal(null);
            onNavigateTab("cv-profile", "field-profile-summary");
          } : undefined}
          onAccept={(acceptedIds) => {
            const result = applyTextCleanup(app, cleanupProposal.changes, acceptedIds);
            setCleanupProposal(null);
            if (result.app === app) return;
            setApp(result.app);
            setCleanupUndo({ previous: result.previous, applied: result.app, skipped: result.skipped.length });
          }}
        />
      )}
    </div>
  );
}
