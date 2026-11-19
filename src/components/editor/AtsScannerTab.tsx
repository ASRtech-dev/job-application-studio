import React, { useEffect, useId, useState } from "react";
import { MasterCvSchema, type Application, type MasterCv } from "@/lib/schemas";
import type { EditorTab } from "@/lib/finalReview";
import type { ToastVariant } from "@/components/Toast";
import { containsFlexibleTerm, containsPhrase, getVisibleDocumentSections } from "@/lib/applicationQuality";
import { preScanOffer } from "@/lib/offerPreScan";
import { CopyTextButton } from "@/components/CopyTextButton";
import { SaveSectionButton } from "./SaveSectionButton";
import { RequirementEvidencePanel } from "./RequirementEvidencePanel";

export interface AtsScanResult {
  score: number;
  matched: string[];
  missing: string[];
  avoidFound: string[];
  sourceLabel: string;
  totalTarget: number;
}

/**
 * Evaluates ATS keyword coverage across all visible CV sections with 2x weight on must-include keywords.
 */
export function computeAtsScan(app: Application, master?: MasterCv): AtsScanResult {
  const hasJd = Boolean(app.jobDescription && app.jobDescription.trim());

  const mustInclude = app.keywordStrategy?.mustIncludeATSKeywords || [];
  const niceToHave = app.keywordStrategy?.niceToHaveKeywords || [];
  const strategyKeywords = [...mustInclude, ...niceToHave];

  const targetKeywordsMap = new Map<string, { label: string; weight: number }>();
  mustInclude.forEach((kw) => {
    if (kw && kw.trim()) targetKeywordsMap.set(kw.toLowerCase().trim(), { label: kw.trim(), weight: 2 });
  });
  niceToHave.forEach((kw) => {
    const clean = kw?.toLowerCase().trim();
    if (clean && !targetKeywordsMap.has(clean)) targetKeywordsMap.set(clean, { label: kw.trim(), weight: 1 });
  });
  if (hasJd) {
    const scan = preScanOffer(app.jobDescription || "", master);
    [...scan.matchedInMaster, ...scan.missingFromMaster].forEach((kw) => {
      const kwLower = kw.toLowerCase().trim();
      if (kwLower && !targetKeywordsMap.has(kwLower)) {
        targetKeywordsMap.set(kwLower, { label: kw.trim(), weight: 1 });
      }
    });
  }

  const searchEntries = Array.from(targetKeywordsMap.values());
  const cvText = Object.entries(getVisibleDocumentSections(app))
    .filter(([section]) => section !== "letter")
    .map(([, text]) => text)
    .join(" ");

  const matched: string[] = [];
  const missing: string[] = [];
  let earnedWeight = 0;
  let totalWeight = 0;

  searchEntries.forEach(({ label, weight }) => {
    totalWeight += weight;
    if (containsFlexibleTerm(cvText, label)) {
      matched.push(label);
      earnedWeight += weight;
    } else {
      missing.push(label);
    }
  });

  const avoidFound = (app.keywordStrategy?.avoidOrMinimizeKeywords || [])
    .map((kw) => kw.trim())
    .filter((kw) => kw && containsPhrase(cvText, kw));

  const totalTarget = matched.length + missing.length;
  const score = totalWeight > 0 ? Math.round((earnedWeight / totalWeight) * 100) : 0;
  const sourceLabel =
    hasJd && strategyKeywords.length > 0
      ? "Based on Job Description + AI Keyword Strategy across your full CV"
      : hasJd
      ? "Based on target keywords detected in the Job Description across your full CV"
      : "Based on AI Keyword Strategy across your full CV (paste Job Description above for deeper scan)";

  return { score, matched, missing, avoidFound, sourceLabel, totalTarget };
}

interface AtsScannerTabProps {
  app: Application;
  setApp: React.Dispatch<React.SetStateAction<Application | null>>;
  master?: MasterCv | null;
  masterCv?: MasterCv | null;
  onNavigateTab?: (tab: EditorTab, anchorId?: string) => void;
  onOpenPromptModal?: () => void;
  saving?: boolean;
  onSave?: () => void;
  onNotify?: (message: string, variant?: ToastVariant) => void;
}

const SECTION_LABELS: Record<string, { label: string; tab: EditorTab; anchorId?: string }> = {
  profile: { label: "Profile", tab: "cv-profile", anchorId: "field-profile-summary" },
  achievements: { label: "Achievements", tab: "cv-skills" },
  skills: { label: "Skills", tab: "cv-skills" },
  experience: { label: "Experience", tab: "cv-exp" },
  projects: { label: "Projects", tab: "cv-projects" },
  education: { label: "Education", tab: "cv-profile" },
  letter: { label: "Cover Letter", tab: "cover-letter" },
};

const PRIORITY_BADGES: Record<string, string> = {
  must_have: "Must-have",
  important: "Important",
  nice_to_have: "Nice-to-have",
};

/**
 * Editor tab for scanning ATS keyword compatibility against the full CV corpus.
 */
export function AtsScannerTab({
  app,
  setApp,
  master,
  masterCv,
  onNavigateTab,
  onOpenPromptModal,
  saving,
  onSave,
  onNotify,
}: AtsScannerTabProps) {
  const fieldId = useId();
  const providedMaster = master !== undefined ? master : masterCv;
  const [fetchedMaster, setFetchedMaster] = useState<MasterCv | null>(null);
  useEffect(() => {
    if (providedMaster !== undefined || typeof fetch !== "function") return;
    const controller = new AbortController();
    fetch("/api/master-cv", { signal: controller.signal })
      .then(async (res) => (res.ok ? MasterCvSchema.parse(await res.json()) : null))
      .then((parsed) => {
        if (!controller.signal.aborted && parsed) setFetchedMaster(parsed);
      })
      .catch(() => { /* Master CV context is optional for ATS scan */ });
    return () => controller.abort();
  }, [providedMaster]);

  const activeMaster = providedMaster ?? fetchedMaster ?? undefined;
  const { score, matched, missing, avoidFound, sourceLabel, totalTarget } = computeAtsScan(app, activeMaster);
  const mustSet = new Set((app.keywordStrategy?.mustIncludeATSKeywords || []).map((k) => k.trim().toLowerCase()));
  const missingPriority = missing.filter((kw) => mustSet.has(kw.trim().toLowerCase()));
  const missingSecondary = missing.filter((kw) => !mustSet.has(kw.trim().toLowerCase()));

  const sections = React.useMemo(() => getVisibleDocumentSections(app), [app]);
  const avoidLocations = avoidFound.map((kw) => ({
    kw,
    where: Object.entries(sections)
      .filter(([sec, text]) => sec !== "letter" && containsPhrase(text || "", kw))
      .map(([sec]) => SECTION_LABELS[sec]?.label || sec),
  }));

  const placementChecks = React.useMemo(() => {
    const plan = app.keywordPlacementPlan || [];
    if (!plan.length) return [];
    return plan.map((item) => {
      const target = String(item.targetSection || "").trim().toLowerCase();
      const surface = (item.exactSurfaceForm || item.keyword || "").trim();
      const inTarget = Boolean(target && target in sections && surface && containsFlexibleTerm(sections[target] || "", surface));
      const foundElsewhere = inTarget
        ? []
        : Object.entries(sections)
            .filter(([sec, text]) => sec !== target && surface && containsFlexibleTerm(text || "", surface))
            .map(([sec]) => sec);
      return { ...item, target, surface, inTarget, foundElsewhere };
    });
  }, [app.keywordPlacementPlan, sections]);

  return (
    <div className="ui-controls space-y-5">
      <RequirementEvidencePanel app={app} masterCv={activeMaster} onNavigateTab={onNavigateTab} onOpenPromptModal={onOpenPromptModal} />
      <div className="border-b border-[var(--ui-border)] pb-2">
        <h3 className="text-sm font-bold text-white">Keyword &amp; ATS check</h3>
        <p className="text-xs text-slate-400">
          Compares target keywords against visible CV text. Use this as a writing aid — only add a term when backed by real experience.
        </p>
      </div>

      <div>
        <label htmlFor={`${fieldId}-1`} className="text-xs font-bold text-[#8db2d6] block mb-1">
          Job description (optional if keywords were already imported)
        </label>
        <textarea id={`${fieldId}-1`}
          rows={6}
          placeholder="Paste the full job posting here…"
          value={app.jobDescription || ""}
          onChange={(e) => setApp({ ...app, jobDescription: e.target.value })}
          className="min-w-0 w-full px-3 py-2 rounded-xl bg-[var(--ui-inset)] border border-[var(--ui-border)] text-white text-xs focus:border-[#6d8ead] leading-relaxed resize-y"
        />
      </div>

      {app.jobDescription?.trim() || totalTarget > 0 ? (
        <div className="space-y-4">
          <div className="ui-panel bg-[var(--ui-surface)] p-4 rounded-xl border border-[var(--ui-border)] flex items-center justify-between gap-3">
            <div>
              <span className="text-xs font-bold text-white block">Target keyword coverage</span>
              <span className="text-xs text-slate-400">{sourceLabel}</span>
            </div>
            <div
              className={`w-14 h-14 shrink-0 rounded-full flex items-center justify-center font-bold text-base border-2 ${
                score >= 70
                  ? "border-emerald-500 text-emerald-400 bg-emerald-500/10"
                  : score >= 40
                  ? "border-amber-500 text-amber-400 bg-amber-500/10"
                  : "border-rose-500 text-rose-400 bg-rose-500/10"
              }`}
            >
              {score}%
            </div>
          </div>

          <div>
            <span className="text-xs font-bold text-emerald-400 block mb-1.5">
              Matched terms ({matched.length})
            </span>
            {matched.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {matched.map((kw, i) => (
                  <span
                    key={i}
                    className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full"
                  >
                    {kw}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">No matches found yet.</p>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold text-rose-400 block">
                Missing terms ({missing.length})
              </span>
              {missing.length > 0 && (
                <CopyTextButton
                  label="Copy all"
                  successMessage="Missing terms copied."
                  getText={() => missing.join(", ")}
                  onNotify={onNotify}
                  className="ui-button ui-button--secondary text-[11px]"
                />
              )}
            </div>
            {missing.length > 0 ? (
              <div className="space-y-2">
                {missingPriority.length > 0 && (
                  <div>
                    <span className="text-[11px] font-semibold text-rose-300 block mb-1">Priority</span>
                    <div className="flex flex-wrap gap-1.5">
                      {missingPriority.map((kw, i) => (
                        <CopyTextButton
                          key={`p-${i}`}
                          label={kw}
                          successMessage={`Copied term: ${kw}`}
                          getText={() => kw}
                          onNotify={onNotify}
                          className="text-xs bg-rose-500/15 hover:bg-rose-500/25 text-rose-200 border border-rose-500/35 px-2.5 py-0.5 rounded-full cursor-pointer"
                        />
                      ))}
                    </div>
                  </div>
                )}
                {missingSecondary.length > 0 && (
                  <div>
                    {missingPriority.length > 0 && <span className="text-[11px] font-semibold text-amber-200 block mb-1">Secondary &amp; general</span>}
                    <div className="flex flex-wrap gap-1.5">
                      {missingSecondary.map((kw, i) => (
                        <CopyTextButton
                          key={`s-${i}`}
                          label={kw}
                          successMessage={`Copied term: ${kw}`}
                          getText={() => kw}
                          onNotify={onNotify}
                          className="text-xs bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20 px-2 py-0.5 rounded-full cursor-pointer"
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-emerald-400 italic font-semibold">
                All target terms appear in the CV. Review supporting evidence and other job requirements as well.
              </p>
            )}
          </div>

          {avoidLocations.length > 0 && (
            <div className="rounded-xl border border-amber-500/35 bg-amber-500/10 p-3 space-y-1.5">
              <span className="text-xs font-bold text-amber-300 block">
                Terms marked to avoid/minimize found in CV ({avoidLocations.length})
              </span>
              <div className="flex flex-wrap gap-1.5">
                {avoidLocations.map((item, i) => (
                  <span key={i} className="text-xs bg-amber-500/15 text-amber-200 border border-amber-500/30 px-2 py-0.5 rounded-full">
                    {item.kw}{item.where.length ? ` (${item.where.join(", ")})` : ""}
                  </span>
                ))}
              </div>
            </div>
          )}

          {placementChecks.length > 0 && (
            <div className="ui-panel bg-[var(--ui-surface)] p-4 rounded-xl border border-[var(--ui-border)] space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--ui-border)] pb-2">
                <span className="text-xs font-bold text-white">Section placement plan</span>
                <span className="text-xs font-semibold text-emerald-300">
                  {placementChecks.filter((p) => p.inTarget).length}/{placementChecks.length} in target section
                </span>
              </div>
              <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                {placementChecks.map((item, idx) => {
                  const dest = SECTION_LABELS[item.target];
                  return (
                    <div key={`${item.keyword}-${idx}`} className="flex flex-wrap items-center justify-between gap-2 text-xs rounded-lg bg-[var(--ui-inset)] border border-[var(--ui-border)] px-2.5 py-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`font-bold ${item.inTarget ? "text-emerald-400" : "text-amber-300"}`}>
                          {item.inTarget ? "✓" : "!"}
                        </span>
                        <span className="text-slate-100 font-medium truncate">{item.surface || item.keyword}</span>
                        {item.priority && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#10233f] text-slate-300">{PRIORITY_BADGES[item.priority] || item.priority}</span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                        <span className="px-2 py-0.5 rounded bg-[#10233f] text-[#8ab4d8]">
                          Target: {dest?.label || item.target || "—"}
                        </span>
                        {!item.inTarget && item.foundElsewhere.length > 0 && (
                          <span className="text-amber-200">
                            Visible in: {item.foundElsewhere.map((s) => SECTION_LABELS[s]?.label || s).join(", ")}
                          </span>
                        )}
                        {!item.inTarget && item.foundElsewhere.length === 0 && (
                          <span className="text-rose-300">Missing from visible text</span>
                        )}
                        {!item.inTarget && onNavigateTab && dest && (
                          <button type="button" onClick={() => onNavigateTab(dest.tab, dest.anchorId)} className="text-[#8db2d6] underline">
                            Go to {dest.label}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="ui-panel bg-[var(--ui-surface)] border border-dashed border-[var(--ui-border)] p-5 rounded-xl text-center text-xs text-slate-400">
          Paste the full job posting or import reference keywords to run the scan.
        </div>
      )}
      {onSave && <SaveSectionButton label="Save posting & changes" saving={Boolean(saving)} onSave={onSave} />}
    </div>
  );
}
