"use client";

import { useEffect, useMemo, useState } from "react";
import { MasterCvSchema, type Application, type MasterCv } from "@/lib/schemas";
import { evaluateApplicationQuality } from "@/lib/applicationQuality";
import type { EditorTab } from "@/lib/finalReview";

const STATUS_LABELS = {
  covered: "Evidence found",
  transferable: "Related evidence",
  not_visible: "Not visible",
  gap: "Gap",
  unverified: "Unverified",
};
const STATUS_BADGE_CLASS = {
  covered: "border-emerald-500/35 bg-emerald-500/15 text-emerald-300",
  transferable: "border-sky-500/35 bg-sky-500/15 text-sky-300",
  not_visible: "border-amber-500/35 bg-amber-500/15 text-amber-200",
  gap: "border-rose-500/35 bg-rose-500/15 text-rose-300",
  unverified: "border-slate-600 bg-slate-800/70 text-slate-300",
};
const PRIORITY_LABELS = { must_have: "Must-have", important: "Important", nice_to_have: "Nice-to-have" };
const SCOPE_LABELS: Record<string, string> = {
  led: "led",
  implemented: "implemented",
  contributed: "contributed",
  direct: "direct",
  trained: "training / practice",
  transferable: "transferable",
  personal_project: "personal project",
  project_only: "project only",
  unknown: "unverified",
};
const SECTION_LABELS: Record<string, { label: string; tab: EditorTab; anchorId?: string }> = {
  profile: { label: "Profile", tab: "cv-profile", anchorId: "field-profile-summary" },
  achievements: { label: "Achievements", tab: "cv-skills" },
  skills: { label: "Skills", tab: "cv-skills" },
  experience: { label: "Experience", tab: "cv-exp" },
  projects: { label: "Projects", tab: "cv-projects" },
  education: { label: "Education", tab: "cv-profile" },
  letter: { label: "Cover Letter", tab: "cover-letter" },
};

export function RequirementEvidencePanel({
  app,
  masterCv: providedMasterCv,
  onNavigateTab,
  onOpenPromptModal,
}: {
  app: Application;
  masterCv?: MasterCv | null;
  onNavigateTab?: (tab: EditorTab, anchorId?: string) => void;
  onOpenPromptModal?: () => void;
}) {
  const [fetchedMasterCv, setFetchedMasterCv] = useState<MasterCv | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [filterMode, setFilterMode] = useState<"all" | "pending">("all");
  useEffect(() => {
    if (providedMasterCv !== undefined) return;
    const controller = new AbortController();
    fetch("/api/master-cv", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Master CV unavailable");
        return MasterCvSchema.parse(await response.json());
      })
      .then(setFetchedMasterCv)
      .catch(() => { if (!controller.signal.aborted) setLoadError(true); });
    return () => controller.abort();
  }, [providedMasterCv]);
  const masterCv = providedMasterCv ?? fetchedMasterCv;
  const review = useMemo(() => evaluateApplicationQuality(app, masterCv || undefined), [app, masterCv]);
  const displayedRequirements = filterMode === "pending"
    ? review.requirements.filter((r) => r.status !== "covered")
    : review.requirements;

  return <section className="ui-panel ui-controls [overflow-wrap:anywhere] space-y-3 rounded-xl border border-[#6d8ead]/30 bg-[var(--ui-surface)] p-4" aria-label="Job requirements and evidence review">
    <div className="flex items-start justify-between gap-3">
      <div>
        <h3 className="text-sm font-bold text-white">Job requirements &amp; evidence review</h3>
        <p className="text-xs text-slate-400 mt-1">Compares the job posting, source evidence, and visible content in your documents.</p>
      </div>
      {review.coverage !== null && <div className="text-right shrink-0"><strong className="text-xl text-[#8db2d6]">{review.coverage}%</strong><p className="text-xs text-slate-400">Weighted coverage</p></div>}
    </div>
    <p className="text-xs text-slate-400">Coverage checks source quotes and visible terms. Review the evidence directly — this figure does not verify mastery or predict interviews.</p>
    {!app.jobAnalysis?.requirements.length && <p className="text-xs text-amber-200">This application has no requirement map yet. Generate a prompt with the full job description and import the result to review priorities and evidence.</p>}
    {app.jobAnalysis && <>
      {review.stale && (
        <div role="status" className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-500/35 bg-amber-500/10 p-2.5 text-xs text-amber-200">
          <span>The job description changed after this analysis. Regenerate the analysis; coverage is currently paused.</span>
          {onOpenPromptModal && (
            <button type="button" onClick={onOpenPromptModal} className="ui-button ui-button--secondary text-xs">
              Prepare updated prompt
            </button>
          )}
        </div>
      )}
      {review.unbound && <p className="text-xs text-amber-200">This analysis is not linked to a saved job description. Regenerate it to preserve provenance.</p>}
      {!masterCv && <p className="text-xs text-amber-200">{loadError ? "Could not load your Master CV. Source evidence remains unverified." : "Loading Master CV to verify source quotes…"}</p>}
      <p className="text-xs text-slate-200">{app.jobAnalysis.positioningThesis || app.jobAnalysis.roleMission}</p>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs text-slate-300">Requirements: <strong className={review.eligibility === "gaps" ? "text-amber-300" : "text-slate-100"}>{review.eligibility === "gaps" ? "Must-have requirements need review" : review.eligibility === "meets" ? "Declared as met — verify supporting evidence" : "To be confirmed"}</strong></div>
        {review.requirements.length > 0 && (
          <div className="flex items-center gap-1.5" role="group" aria-label="Filter requirements">
            <button type="button" aria-pressed={filterMode === "all"} onClick={() => setFilterMode("all")} className={`px-2 py-0.5 rounded border text-[11px] ${filterMode === "all" ? "bg-[#10233f] border-[#6d8ead]/50 text-white" : "bg-[var(--ui-inset)] border-[var(--ui-border)] text-slate-300"}`}>All ({review.requirements.length})</button>
            <button type="button" aria-pressed={filterMode === "pending"} onClick={() => setFilterMode("pending")} className={`px-2 py-0.5 rounded border text-[11px] ${filterMode === "pending" ? "bg-[#10233f] border-[#6d8ead]/50 text-white" : "bg-[var(--ui-inset)] border-[var(--ui-border)] text-slate-300"}`}>Pending only ({review.requirements.filter((r) => r.status !== "covered").length})</button>
          </div>
        )}
      </div>
      {app.jobAnalysis.eligibility.notes && <p className="text-xs text-slate-400">{app.jobAnalysis.eligibility.notes}</p>}
      {!!app.jobAnalysis.eligibility.unmetRequirements.length && <ul className="list-disc pl-4 text-xs text-amber-200">{app.jobAnalysis.eligibility.unmetRequirements.map((item, index) => <li key={index}>{item}</li>)}</ul>}
      {displayedRequirements.map((item, index) => {
        const targets = item.requirement.targetSections || [];
        return (
          <details key={`${item.requirement.id}-${index}`} className="rounded-lg border border-slate-700/70 p-3">
            <summary className="cursor-pointer text-xs text-white flex flex-wrap items-center gap-2">
              <span className="font-medium flex-1">{item.requirement.requirement}</span>
              <span className={`text-[11px] px-2 py-0.5 rounded border font-semibold ${STATUS_BADGE_CLASS[item.status]}`}>
                {PRIORITY_LABELS[item.requirement.priority]} · {STATUS_LABELS[item.status]}
              </span>
            </summary>
            <div className="mt-2 space-y-2 text-xs text-slate-300">
              <p><strong>Job posting:</strong> “{item.requirement.sourceQuote}”</p>
              {item.requirement.evidence.map((evidence, evidenceIndex) => <p key={evidenceIndex}><strong>Source evidence ({SCOPE_LABELS[evidence.scope] || evidence.scope.replace(/_/g, " ")}):</strong> “{evidence.quote}” {evidence.relevance}</p>)}
              <p className="text-slate-400">{item.explanation}</p>
              {!!item.visibleSections.length && <p>Visible terms in: {item.visibleSections.map((s) => SECTION_LABELS[s]?.label || s).join(", ")}</p>}
              {item.status === "not_visible" && (
                <div className="space-y-1 text-amber-200">
                  {!!item.requirement.keywords.length && <p>Expected keywords: {item.requirement.keywords.join(", ")}</p>}
                  {!!targets.length && <p>Suggested sections: {targets.map((s) => SECTION_LABELS[s]?.label || s).join(", ")}</p>}
                </div>
              )}
              {onNavigateTab && targets.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {targets.map((sec) => {
                    const dest = SECTION_LABELS[sec];
                    if (!dest) return null;
                    return (
                      <button key={sec} type="button" onClick={() => onNavigateTab(dest.tab, dest.anchorId)} className="ui-button ui-button--secondary text-[11px]">
                        Go to {dest.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </details>
        );
      })}
      <p className="text-xs text-slate-400">Cover letter: {review.letterWords} words. Verify that your motivation and examples address this posting and add context beyond the CV.</p>
      {review.letterOverLimit && <p role="status" className="text-xs text-amber-200">The job posting specifies a maximum of {review.letterWordLimit} words for the cover letter. Trim it before exporting.</p>}
    </>}
    {app.promptContext && <p className="text-xs text-slate-400">Prompt {app.promptContext.version} · {app.promptContext.options.cvLengthMode.replace(/_/g, " ")} · {app.promptContext.options.emphasisHighlights.length} content preferences</p>}
    {!!app.importMetadata?.warnings?.length && <div className="text-xs text-amber-200">{app.importMetadata.warnings.map((warning, index) => <p key={index}>{warning}</p>)}</div>}
    {!!app.importMetadata?.changes?.length && <details className="text-xs text-slate-300">
      <summary className="cursor-pointer">Review {app.importMetadata.changes.length} adjustments made during import</summary>
      <div className="mt-2 space-y-3">{app.importMetadata.changes.map((change, index) => <div key={index} className="border-l border-slate-600 pl-2 break-words"><strong>{change.field}</strong><p className="text-slate-400">Received: {change.before || "(empty)"}</p><p>Imported: {change.after || "(empty)"}</p></div>)}</div>
    </details>}
  </section>;
}
