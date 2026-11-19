import React, { useId, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { Application, InterviewPrep } from "@/lib/schemas";
type StructuredStarStory = NonNullable<InterviewPrep["starStories"]>[number];
import type { EditorTab } from "@/lib/finalReview";
import type { ToastVariant } from "@/components/Toast";
import { preScanOffer } from "@/lib/offerPreScan";
import { CopyTextButton } from "@/components/CopyTextButton";
import { SaveSectionButton } from "./SaveSectionButton";
import { RequirementEvidencePanel } from "./RequirementEvidencePanel";

interface StrategyTabProps {
  app: Application;
  setApp: React.Dispatch<React.SetStateAction<Application | null>>;
  updateFitAssessment: (field: string, val: string | number | null | string[]) => void;
  updateRoleClassification: (field: string, val: string) => void;
  updateSalaryPositioning: (field: string, val: string) => void;
  updateKeywordStrategy: (field: string, val: string[]) => void;
  handleAddRecruiterConcern: () => void;
  handleRemoveRecruiterConcern: (idx: number) => void;
  updateRecruiterConcern: (idx: number, field: string, val: string) => void;
  updateQualityControl: (field: string, val: string | string[]) => void;
  saving: boolean;
  onSave: () => void;
  onNavigateTab?: (tab: EditorTab, anchorId?: string) => void;
  onOpenPromptModal?: () => void;
  onNotify?: (message: string, variant?: ToastVariant) => void;
}

function MultilineArrayTextarea({
  id,
  rows = 3,
  value,
  onChangeLines,
  className,
  placeholder,
}: {
  id: string;
  rows?: number;
  value: string[];
  onChangeLines: (lines: string[]) => void;
  className: string;
  placeholder?: string;
}) {
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState("");
  return (
    <textarea
      id={id}
      rows={rows}
      value={focused ? draft : value.join("\n")}
      onFocus={() => {
        setFocused(true);
        setDraft(value.join("\n"));
      }}
      onChange={(e) => {
        const next = e.target.value;
        setDraft(next);
        onChangeLines(next.split("\n").map((s) => s.trim()).filter(Boolean));
      }}
      onBlur={() => setFocused(false)}
      className={className}
      placeholder={placeholder}
    />
  );
}

/**
 * Editor tab for viewing and tuning LLM fit assessment, role classification, salary strategy, keywords, concerns, interview prep, and QC notes.
 */
export function StrategyTab({
  app,
  setApp,
  updateFitAssessment,
  updateRoleClassification,
  updateSalaryPositioning,
  updateKeywordStrategy,
  handleAddRecruiterConcern,
  handleRemoveRecruiterConcern,
  updateRecruiterConcern,
  updateQualityControl,
  saving,
  onSave,
  onNavigateTab,
  onOpenPromptModal,
  onNotify,
}: StrategyTabProps) {
  const fieldId = useId();
  const offerHints = React.useMemo(
    () => (app.jobDescription?.trim() ? preScanOffer(app.jobDescription) : null),
    [app.jobDescription]
  );

  const updateInterviewPrep = (patch: Partial<InterviewPrep>) => {
    setApp((prev) =>
      prev
        ? {
            ...prev,
            interviewPrep: {
              ...(prev.interviewPrep || {}),
              ...patch,
            },
          }
        : prev
    );
  };

  const starStories = app.interviewPrep?.starStories || [];
  const updateStarStory = (idx: number, patch: Partial<StructuredStarStory>) => {
    const next = [...starStories];
    next[idx] = { ...next[idx], ...patch };
    updateInterviewPrep({ starStories: next });
  };

  return (
    <div className="ui-controls space-y-6">
      <div className="border-b border-[var(--ui-border)] pb-2 flex flex-wrap gap-2 justify-between items-center">
        <div>
          <h3 className="text-sm font-bold text-white">Application strategy</h3>
          <p className="text-xs text-slate-400">
            Review the role analysis, target terminology, and preparation notes.
          </p>
        </div>
        <span className="text-xs px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold">
          Prep notes
        </span>
      </div>

      <nav aria-label="Strategy sections" className="flex flex-wrap gap-1.5 text-[11px]">
        {[
          { href: `${fieldId}-evidence`, label: "Evidence" },
          { href: `${fieldId}-fit`, label: "Fit" },
          { href: `${fieldId}-classification`, label: "Classification" },
          { href: `${fieldId}-salary`, label: "Salary" },
          { href: `${fieldId}-keywords`, label: "Keywords" },
          { href: `${fieldId}-concerns`, label: "Concerns" },
          { href: `${fieldId}-star-manual`, label: "STAR script" },
          { href: `${fieldId}-qc`, label: "Review" },
        ].map((item) => (
          <a
            key={item.href}
            href={`#${item.href}`}
            className="px-2 py-0.5 rounded-md bg-[var(--ui-inset)] border border-[var(--ui-border)] text-slate-300 hover:text-white hover:border-[#6d8ead]/50"
          >
            {item.label}
          </a>
        ))}
      </nav>

      <div id={`${fieldId}-evidence`}>
        <RequirementEvidencePanel app={app} onNavigateTab={onNavigateTab} onOpenPromptModal={onOpenPromptModal} />
      </div>
      <p className="text-xs text-slate-400">Model assessments are guidance only. They do not verify eligibility or predict interviews.</p>

      {/* Fit Assessment Card */}
      <div id={`${fieldId}-fit`} className="ui-panel bg-[var(--ui-surface)] p-4 rounded-xl border border-[var(--ui-border)] space-y-4">
        <h4 className="text-xs font-bold text-white flex items-center justify-between border-b border-[#1f2937]/50 pb-2">
          <span>Fit assessment</span>
          <span className="text-xs text-[#6d8ead]">Analysis summary</span>
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor={`${fieldId}-1`} className="text-xs font-bold text-[#6d8ead] block mb-1">Model score (0–10)</label>
            <input id={`${fieldId}-1`}
              type="number"
              min="0"
              max="10"
              step="0.5"
              placeholder="Not set"
              value={app.fitAssessment?.scoreOutOf10 ?? ""}
              onChange={(e) => {
                const val = e.target.value === "" ? null : Number(e.target.value);
                updateFitAssessment("scoreOutOf10", val);
              }}
              className="min-w-0 w-full px-2.5 py-1.5 rounded bg-[#0a0f1d] border border-[#1f2937] text-white text-xs"
            />
          </div>
          <div>
            <label htmlFor={`${fieldId}-2`} className="text-xs font-bold text-[#6d8ead] block mb-1">Indicative fit tier</label>
            <select id={`${fieldId}-2`}
              value={app.fitAssessment?.probabilityTier || "Medium"}
              onChange={(e) => updateFitAssessment("probabilityTier", e.target.value)}
              className="min-w-0 w-full px-2.5 py-1.5 rounded bg-[#0a0f1d] border border-[#1f2937] text-white text-xs cursor-pointer"
            >
              <option value="Very Low">Very Low</option>
              <option value="Low">Low</option>
              <option value="Medium-Low">Medium-Low</option>
              <option value="Medium">Medium</option>
              <option value="Medium-High">Medium-High</option>
              <option value="High">High</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor={`${fieldId}-3`} className="text-xs font-bold text-[#6d8ead] block mb-1">Model recommendation</label>
            <select id={`${fieldId}-3`}
              value={app.fitAssessment?.applyOrSkip || "Apply selectively"}
              onChange={(e) => updateFitAssessment("applyOrSkip", e.target.value)}
              className="min-w-0 w-full px-2.5 py-1.5 rounded bg-[#0a0f1d] border border-[#1f2937] text-white text-xs cursor-pointer"
            >
              <option value="Apply">Apply</option>
              <option value="Apply selectively">Apply selectively</option>
              <option value="Skip">Skip</option>
            </select>
          </div>
          <div>
            <label htmlFor={`${fieldId}-4`} className="text-xs font-bold text-[#6d8ead] block mb-1">Suggested CV version</label>
            <input id={`${fieldId}-4`}
              type="text"
              value={app.fitAssessment?.recommendedCVVersion || ""}
              onChange={(e) => updateFitAssessment("recommendedCVVersion", e.target.value)}
              className="min-w-0 w-full px-2.5 py-1.5 rounded bg-[#0a0f1d] border border-[#1f2937] text-white text-xs"
              placeholder="Describe the recommended CV focus"
            />
          </div>
        </div>

        <div>
          <label htmlFor={`${fieldId}-5`} className="text-xs font-bold text-[#6d8ead] block mb-1">Assessment rationale</label>
          <textarea id={`${fieldId}-5`}
            rows={3}
            value={app.fitAssessment?.summary || ""}
            onChange={(e) => updateFitAssessment("summary", e.target.value)}
            className="min-w-0 w-full px-3 py-2 rounded-lg bg-[#0a0f1d] border border-[#1f2937] text-white text-xs leading-relaxed"
            placeholder="Why this role fits (or where gaps exist)"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor={`${fieldId}-6`} className="text-xs font-bold text-emerald-400 block mb-1">
              Strongest angles (one per line)
            </label>
            <MultilineArrayTextarea
              id={`${fieldId}-6`}
              rows={3}
              value={app.fitAssessment?.bestAngles || []}
              onChangeLines={(lines) => updateFitAssessment("bestAngles", lines)}
              className="min-w-0 w-full px-3 py-2 rounded-lg bg-[var(--ui-inset)] border border-[var(--ui-border)] text-white text-xs leading-relaxed"
              placeholder="Key strengths relevant to the posting"
            />
          </div>
          <div>
            <div className="flex flex-wrap items-center justify-between gap-1 mb-1">
              <label htmlFor={`${fieldId}-7`} className="text-xs font-bold text-rose-400 block">
                Risks &amp; gaps (one per line)
              </label>
              {(app.fitAssessment?.mainRisks || []).length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const existing = new Set((app.recruiterConcernHandling?.likelyConcerns || []).map((c) => c.concern.trim().toLowerCase()));
                    const nextConcerns = [...(app.recruiterConcernHandling?.likelyConcerns || [])];
                    for (const risk of app.fitAssessment?.mainRisks || []) {
                      const trimmed = risk.trim();
                      if (trimmed && !existing.has(trimmed.toLowerCase())) {
                        existing.add(trimmed.toLowerCase());
                        nextConcerns.push({ concern: trimmed, howToNeutralize: "", sentenceToUse: "" });
                      }
                    }
                    setApp((prev) => prev ? { ...prev, recruiterConcernHandling: { likelyConcerns: nextConcerns } } : prev);
                  }}
                  className="text-[11px] text-[#8db2d6] hover:underline"
                >
                  Copy to concerns to address
                </button>
              )}
            </div>
            <MultilineArrayTextarea
              id={`${fieldId}-7`}
              rows={3}
              value={app.fitAssessment?.mainRisks || []}
              onChangeLines={(lines) => updateFitAssessment("mainRisks", lines)}
              className="min-w-0 w-full px-3 py-2 rounded-lg bg-[var(--ui-inset)] border border-[var(--ui-border)] text-white text-xs leading-relaxed"
              placeholder="Gaps or requirements to verify"
            />
          </div>
        </div>

        <div>
          <label htmlFor={`${fieldId}-8`} className="text-xs font-bold text-[#6d8ead] block mb-1">
            Suggested tone &amp; strategy
          </label>
          <textarea id={`${fieldId}-8`}
            rows={2}
            value={app.fitAssessment?.recommendedApplicationStrategy || ""}
            onChange={(e) => updateFitAssessment("recommendedApplicationStrategy", e.target.value)}
            className="min-w-0 w-full px-3 py-2 rounded-lg bg-[#0a0f1d] border border-[#1f2937] text-white text-xs leading-relaxed"
            placeholder="Recommended tone and angle for the application"
          />
        </div>
      </div>

      {/* Role Classification Card */}
      <div id={`${fieldId}-classification`} className="ui-panel bg-[var(--ui-surface)] p-4 rounded-xl border border-[var(--ui-border)] space-y-4">
        <h4 className="text-xs font-bold text-white flex items-center justify-between border-b border-[#1f2937]/50 pb-2">
          <span>Role classification</span>
          <span className="text-xs text-[#6d8ead]">Model classification</span>
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor={`${fieldId}-9`} className="text-xs font-bold text-[#6d8ead] block mb-1">Opportunity type</label>
            <select id={`${fieldId}-9`}
              value={app.roleClassification?.type || "coreTarget"}
              onChange={(e) => updateRoleClassification("type", e.target.value)}
              className="min-w-0 w-full px-2.5 py-1.5 rounded bg-[#0a0f1d] border border-[#1f2937] text-white text-xs cursor-pointer"
            >
              <option value="coreTarget">Core target</option>
              <option value="bridgeRole">Bridge role</option>
              <option value="stretchRole">Stretch role</option>
              <option value="stabilityRole">Stability role</option>
              <option value="alternativeRole">Alternative role</option>
            </select>
          </div>
          <div>
            <label htmlFor={`${fieldId}-10`} className="text-xs font-bold text-[#6d8ead] block mb-1">Seniority level</label>
            <select id={`${fieldId}-10`}
              value={app.roleClassification?.seniorityLevel || "mid"}
              onChange={(e) => updateRoleClassification("seniorityLevel", e.target.value)}
              className="min-w-0 w-full px-2.5 py-1.5 rounded bg-[#0a0f1d] border border-[#1f2937] text-white text-xs cursor-pointer"
            >
              <option value="entry">Entry</option>
              <option value="junior">Junior</option>
              <option value="mid">Mid-level</option>
              <option value="mid-senior">Mid-Senior</option>
              <option value="senior">Senior</option>
              <option value="lead">Lead</option>
              <option value="executive">Executive</option>
              <option value="unclear">Unclear</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor={`${fieldId}-11`} className="text-xs font-bold text-[#6d8ead] block mb-1">Role family</label>
            <input id={`${fieldId}-11`}
              type="text"
              value={app.roleClassification?.roleFamily || ""}
              onChange={(e) => updateRoleClassification("roleFamily", e.target.value)}
              className="min-w-0 w-full px-2.5 py-1.5 rounded bg-[#0a0f1d] border border-[#1f2937] text-white text-xs"
              placeholder="Functional area or discipline"
            />
          </div>
          <div>
            <label htmlFor={`${fieldId}-12`} className="text-xs font-bold text-[#6d8ead] block mb-1">Priority</label>
            <select id={`${fieldId}-12`}
              value={app.roleClassification?.applicationPriority || "medium"}
              onChange={(e) => updateRoleClassification("applicationPriority", e.target.value)}
              className="min-w-0 w-full px-2.5 py-1.5 rounded bg-[#0a0f1d] border border-[#1f2937] text-white text-xs cursor-pointer"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="strategic">Strategic</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor={`${fieldId}-13`} className="text-xs font-bold text-[#6d8ead] block mb-1">Job location</label>
            <input id={`${fieldId}-13`}
              type="text"
              value={app.jobLocation || ""}
              onChange={(e) => setApp({ ...app, jobLocation: e.target.value })}
              className="min-w-0 w-full px-2.5 py-1.5 rounded bg-[#0a0f1d] border border-[#1f2937] text-white text-xs"
              placeholder="Location listed in the job posting"
            />
          </div>
          <div>
            <label htmlFor={`${fieldId}-14`} className="text-xs font-bold text-[#6d8ead] block mb-1">Work model</label>
            <input id={`${fieldId}-14`}
              type="text"
              value={app.workModel || ""}
              onChange={(e) => setApp({ ...app, workModel: e.target.value })}
              className="min-w-0 w-full px-2.5 py-1.5 rounded bg-[#0a0f1d] border border-[#1f2937] text-white text-xs"
              placeholder="e.g. Hybrid, Remote, or On-site"
            />
          </div>
        </div>

        <div>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
            <label htmlFor={`${fieldId}-15`} className="text-xs font-bold text-[#8db2d6] block">
              Recommended positioning
            </label>
            <CopyTextButton
              label="Copy"
              disabled={!(app.roleClassification?.recommendedPositioning || "").trim()}
              successMessage="Positioning copied."
              getText={() => app.roleClassification?.recommendedPositioning || ""}
              onNotify={onNotify}
              className="ui-button ui-button--secondary text-[11px]"
            />
          </div>
          <textarea id={`${fieldId}-15`}
            rows={2}
            value={app.roleClassification?.recommendedPositioning || ""}
            onChange={(e) => updateRoleClassification("recommendedPositioning", e.target.value)}
            className="min-w-0 w-full px-3 py-2 rounded-lg bg-[var(--ui-inset)] border border-[var(--ui-border)] text-white text-xs leading-relaxed"
            placeholder="Tailored positioning statement for this role"
          />
        </div>
      </div>

      {/* Salary Positioning Card */}
      <div id={`${fieldId}-salary`} className="ui-panel bg-[var(--ui-surface)] p-4 rounded-xl border border-[var(--ui-border)] space-y-4">
        <h4 className="text-xs font-bold text-white flex flex-wrap items-center justify-between gap-2 border-b border-[var(--ui-border)] pb-2">
          <span>Salary notes</span>
          <span className="text-xs text-[#8db2d6]">Compensation prep</span>
        </h4>
        {(offerHints?.detectedSalaryBand || (offerHints?.mentionsLanguageRequirement?.length ?? 0) > 0) && (
          <div className="rounded-lg border border-[#6d8ead]/30 bg-[var(--ui-inset)] p-2.5 text-xs text-slate-300 flex flex-wrap gap-3">
            {offerHints?.detectedSalaryBand && <span>Detected band in posting: <strong className="text-white">{offerHints.detectedSalaryBand}</strong></span>}
            {offerHints?.mentionsLanguageRequirement?.length ? <span>Language requirement mentioned: <strong className="text-white">{offerHints.mentionsLanguageRequirement.join(", ")}</strong></span> : null}
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
          <div>
            <label htmlFor={`${fieldId}-16`} className="text-xs font-bold text-[#6d8ead] block mb-1">Suggested range</label>
            <input id={`${fieldId}-16`}
              type="text"
              value={app.salaryPositioning?.recommendedRangeEUR || ""}
              onChange={(e) => updateSalaryPositioning("recommendedRangeEUR", e.target.value)}
              className="min-w-0 w-full px-2.5 py-1.5 rounded bg-[#0a0f1d] border border-[#1f2937] text-white text-xs"
              placeholder="Range, if applicable"
            />
          </div>
          <div>
            <label htmlFor={`${fieldId}-17`} className="text-xs font-bold text-[#6d8ead] block mb-1">Safe anchor</label>
            <input id={`${fieldId}-17`}
              type="text"
              value={app.salaryPositioning?.safeNumberEUR || ""}
              onChange={(e) => updateSalaryPositioning("safeNumberEUR", e.target.value)}
              className="min-w-0 w-full px-2.5 py-1.5 rounded bg-[#0a0f1d] border border-[#1f2937] text-white text-xs"
              placeholder="Conservative figure, if applicable"
            />
          </div>
          <div>
            <label htmlFor={`${fieldId}-18`} className="text-xs font-bold text-[#6d8ead] block mb-1">Target figure</label>
            <input id={`${fieldId}-18`}
              type="text"
              value={app.salaryPositioning?.ambitiousNumberEUR || ""}
              onChange={(e) => updateSalaryPositioning("ambitiousNumberEUR", e.target.value)}
              className="min-w-0 w-full px-2.5 py-1.5 rounded bg-[#0a0f1d] border border-[#1f2937] text-white text-xs"
              placeholder="Ambitious figure, if applicable"
            />
          </div>
        </div>

        <div>
          <label htmlFor={`${fieldId}-19`} className="text-xs font-bold text-[#6d8ead] block mb-1">
            Compensation risks &amp; notes
          </label>
          <textarea id={`${fieldId}-19`}
            rows={2}
            value={app.salaryPositioning?.riskComment || ""}
            onChange={(e) => updateSalaryPositioning("riskComment", e.target.value)}
            className="min-w-0 w-full px-3 py-2 rounded-lg bg-[#0a0f1d] border border-[#1f2937] text-white text-xs leading-relaxed"
            placeholder="Notes to prepare for a salary discussion"
          />
        </div>
      </div>

      {/* Keyword Strategy Card */}
      <div id={`${fieldId}-keywords`} className="ui-panel bg-[var(--ui-surface)] p-4 rounded-xl border border-[var(--ui-border)] space-y-4">
        <h4 className="text-xs font-bold text-white flex items-center justify-between border-b border-[var(--ui-border)] pb-2">
          <span>Application keywords</span>
          <span className="text-xs text-[#8db2d6]">Keyword library</span>
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor={`${fieldId}-20`} className="text-xs font-bold text-emerald-400 block mb-1">
              Priority ATS keywords (one per line)
            </label>
            <MultilineArrayTextarea
              id={`${fieldId}-20`}
              rows={3}
              value={app.keywordStrategy?.mustIncludeATSKeywords || []}
              onChangeLines={(lines) => updateKeywordStrategy("mustIncludeATSKeywords", lines)}
              className="min-w-0 w-full px-3 py-2 rounded-lg bg-[var(--ui-inset)] border border-[var(--ui-border)] text-white text-xs leading-relaxed"
              placeholder="e.g. Stakeholder management&#10;Data analysis&#10;Project delivery"
            />
          </div>
          <div>
            <label htmlFor={`${fieldId}-21`} className="text-xs font-bold text-blue-400 block mb-1">
              Nice-to-have keywords (one per line)
            </label>
            <MultilineArrayTextarea
              id={`${fieldId}-21`}
              rows={3}
              value={app.keywordStrategy?.niceToHaveKeywords || []}
              onChangeLines={(lines) => updateKeywordStrategy("niceToHaveKeywords", lines)}
              className="min-w-0 w-full px-3 py-2 rounded-lg bg-[var(--ui-inset)] border border-[var(--ui-border)] text-white text-xs leading-relaxed"
              placeholder="e.g. SQL&#10;Process improvement&#10;Compliance"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor={`${fieldId}-22`} className="text-xs font-bold text-indigo-400 block mb-1">
              Narrative phrases (one per line)
            </label>
            <MultilineArrayTextarea
              id={`${fieldId}-22`}
              rows={3}
              value={app.keywordStrategy?.humanNarrativeKeywords || []}
              onChangeLines={(lines) => updateKeywordStrategy("humanNarrativeKeywords", lines)}
              className="min-w-0 w-full px-3 py-2 rounded-lg bg-[var(--ui-inset)] border border-[var(--ui-border)] text-white text-xs leading-relaxed"
              placeholder="Natural domain phrasing to weave into bullets and cover letter"
            />
          </div>
          <div>
            <label htmlFor={`${fieldId}-23`} className="text-xs font-bold text-rose-400 block mb-1">
              Terms to avoid or minimize (one per line)
            </label>
            <MultilineArrayTextarea
              id={`${fieldId}-23`}
              rows={3}
              value={app.keywordStrategy?.avoidOrMinimizeKeywords || []}
              onChangeLines={(lines) => updateKeywordStrategy("avoidOrMinimizeKeywords", lines)}
              className="min-w-0 w-full px-3 py-2 rounded-lg bg-[var(--ui-inset)] border border-[var(--ui-border)] text-white text-xs leading-relaxed"
              placeholder="Terms to review or downplay"
            />
          </div>
        </div>
      </div>

      {/* Recruiter Concerns Card */}
      <div id={`${fieldId}-concerns`} className="ui-panel bg-[var(--ui-surface)] p-4 rounded-xl border border-[var(--ui-border)] space-y-4">
        <div className="flex flex-wrap gap-3 justify-between items-center border-b border-[#1f2937]/50 pb-2">
          <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
            Likely recruiter questions &amp; concerns
          </h4>
          <button
            type="button"
            onClick={handleAddRecruiterConcern}
            className="ui-button ui-button--secondary text-xs text-[#6d8ead] hover:underline"
          >
            + Add item
          </button>
        </div>

        <div className="space-y-4">
          {(app.recruiterConcernHandling?.likelyConcerns || []).map((c, idx) => (
            <div key={idx} className="ui-inset bg-[#0a0f1d] p-3 rounded-lg border border-[#1f2937] space-y-2 relative">
              <button
                type="button"
                onClick={() => handleRemoveRecruiterConcern(idx)}
                className="ui-button ui-button--danger absolute top-2 right-2 text-rose-400 hover:text-rose-300 font-bold text-xs"
                title="Remove item" aria-label="Remove item"
              >
                ×
              </button>

              <div>
                <label htmlFor={`${fieldId}-24-${idx}`} className="text-xs font-bold text-[#6d8ead] block mb-0.5">
                  Question or concern
                </label>
                <input id={`${fieldId}-24-${idx}`}
                  type="text"
                  value={c.concern}
                  onChange={(e) => updateRecruiterConcern(idx, "concern", e.target.value)}
                  className="w-[90%] px-2.5 py-1 rounded bg-[#0e162d] border border-[#1f2937] text-white text-xs"
                  placeholder="Potential recruiter question or gap to clarify"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor={`${fieldId}-25-${idx}`} className="text-xs font-bold text-amber-400/80 block mb-0.5">
                    How to address
                  </label>
                  <textarea id={`${fieldId}-25-${idx}`}
                    rows={2}
                    value={c.howToNeutralize}
                    onChange={(e) => updateRecruiterConcern(idx, "howToNeutralize", e.target.value)}
                    className="min-w-0 w-full px-2 py-1 rounded bg-[#0e162d] border border-[#1f2937] text-white text-xs"
                    placeholder="Strategy for explaining this point"
                  />
                </div>
                <div>
                  <label htmlFor={`${fieldId}-26-${idx}`} className="text-xs font-bold text-emerald-400 block mb-0.5">
                    Prepared response
                  </label>
                  <textarea id={`${fieldId}-26-${idx}`}
                    rows={2}
                    value={c.sentenceToUse}
                    onChange={(e) => updateRecruiterConcern(idx, "sentenceToUse", e.target.value)}
                    className="min-w-0 w-full px-2 py-1 rounded bg-[#0e162d] border border-[#1f2937] text-white text-xs"
                    placeholder="Concise phrasing ready for interviews or messages"
                  />
                </div>
              </div>
            </div>
          ))}
          {(app.recruiterConcernHandling?.likelyConcerns || []).length === 0 && (
            <p className="text-xs text-slate-500 italic">
              No items recorded yet. Use &ldquo;Add item&rdquo; to add one.
            </p>
          )}
        </div>
      </div>

      {/* Structured Manual Interview & STAR Prep */}
      <div id={`${fieldId}-star-manual`} className="ui-panel bg-[var(--ui-surface)] p-4 rounded-xl border border-[var(--ui-border)] space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--ui-border)] pb-2">
          <div>
            <h4 className="text-xs font-bold text-white">Manual interview script (STAR &amp; questions)</h4>
            <p className="text-[11px] text-slate-400">Edit STAR stories, your career arc, and questions to ask (reflected in the STAR Prep preview).</p>
          </div>
          <button
            type="button"
            onClick={() =>
              updateInterviewPrep({
                starStories: [...starStories, { title: "", situation: "", task: "", action: "", result: "", keywords: [] }],
              })
            }
            className="ui-button ui-button--secondary text-xs flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" /> Add STAR story
          </button>
        </div>

        <div>
          <label htmlFor={`${fieldId}-career-arc`} className="text-xs font-bold text-[#8db2d6] block mb-1">Career arc</label>
          <textarea
            id={`${fieldId}-career-arc`}
            rows={2}
            value={app.interviewPrep?.careerArcSummary || ""}
            onChange={(e) => updateInterviewPrep({ careerArcSummary: e.target.value })}
            placeholder="Connect your background to this role in 2–3 sentences..."
            className="min-w-0 w-full px-3 py-2 rounded-lg bg-[var(--ui-inset)] border border-[var(--ui-border)] text-white text-xs leading-relaxed"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor={`${fieldId}-questions-ask`} className="text-xs font-bold text-[#8db2d6] block mb-1">Questions to ask the interviewer (one per line)</label>
            <MultilineArrayTextarea
              id={`${fieldId}-questions-ask`}
              rows={3}
              value={app.interviewPrep?.questionsToAsk || []}
              onChangeLines={(lines) => updateInterviewPrep({ questionsToAsk: lines })}
              className="min-w-0 w-full px-3 py-2 rounded-lg bg-[var(--ui-inset)] border border-[var(--ui-border)] text-white text-xs leading-relaxed"
              placeholder="e.g. How do you define success in the first 90 days?"
            />
          </div>
          <div>
            <label htmlFor={`${fieldId}-call-notes`} className="text-xs font-bold text-[#8db2d6] block mb-1">Quick call notes (one per line)</label>
            <MultilineArrayTextarea
              id={`${fieldId}-call-notes`}
              rows={3}
              value={app.interviewPrep?.callSurvivalNotes || []}
              onChangeLines={(lines) => updateInterviewPrep({ callSurvivalNotes: lines })}
              className="min-w-0 w-full px-3 py-2 rounded-lg bg-[var(--ui-inset)] border border-[var(--ui-border)] text-white text-xs leading-relaxed"
              placeholder="Key reminders for screening calls..."
            />
          </div>
        </div>

        {starStories.length > 0 && (
          <div className="space-y-3">
            {starStories.map((story, idx) => (
              <div key={idx} className="ui-inset rounded-lg border border-[var(--ui-border)] p-3 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <input
                    aria-label={`STAR story ${idx + 1} title`}
                    type="text"
                    value={story.title}
                    placeholder={`STAR story #${idx + 1}: title or competency`}
                    onChange={(e) => updateStarStory(idx, { title: e.target.value })}
                    className="min-w-0 flex-1 px-2.5 py-1 rounded bg-[var(--ui-surface)] border border-[var(--ui-border)] text-white text-xs font-semibold"
                  />
                  <button
                    type="button"
                    aria-label={`Remove STAR story ${idx + 1}`}
                    onClick={() => updateInterviewPrep({ starStories: starStories.filter((_, i) => i !== idx) })}
                    className="ui-button ui-button--danger text-rose-400 hover:text-rose-300 px-2 py-1 text-xs"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-[11px] font-bold text-[#8db2d6] block mb-0.5">Situation</label>
                    <textarea rows={2} value={story.situation} onChange={(e) => updateStarStory(idx, { situation: e.target.value })} placeholder="Context and initial challenge..." className="min-w-0 w-full px-2.5 py-1.5 rounded bg-[var(--ui-surface)] border border-[var(--ui-border)] text-white text-xs" />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-[#8db2d6] block mb-0.5">Task</label>
                    <textarea rows={2} value={story.task} onChange={(e) => updateStarStory(idx, { task: e.target.value })} placeholder="Goal under your responsibility..." className="min-w-0 w-full px-2.5 py-1.5 rounded bg-[var(--ui-surface)] border border-[var(--ui-border)] text-white text-xs" />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-[#8db2d6] block mb-0.5">Action</label>
                    <textarea rows={2} value={story.action} onChange={(e) => updateStarStory(idx, { action: e.target.value })} placeholder="Concrete steps you took..." className="min-w-0 w-full px-2.5 py-1.5 rounded bg-[var(--ui-surface)] border border-[var(--ui-border)] text-white text-xs" />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-emerald-400 block mb-0.5">Result</label>
                    <textarea rows={2} value={story.result} onChange={(e) => updateStarStory(idx, { result: e.target.value })} placeholder="Verifiable outcome or metric..." className="min-w-0 w-full px-2.5 py-1.5 rounded bg-[var(--ui-surface)] border border-[var(--ui-border)] text-white text-xs" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quality Control Card */}
      <div id={`${fieldId}-qc`} className="ui-panel bg-[var(--ui-surface)] p-4 rounded-xl border border-[var(--ui-border)] space-y-4">
        <h4 className="text-xs font-bold text-white flex items-center justify-between border-b border-[var(--ui-border)] pb-2">
          <span>Content review</span>
          <span className="text-xs text-[#8db2d6]">Writing checks</span>
        </h4>

        <div>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
            <label htmlFor={`${fieldId}-27`} className="text-xs font-bold text-[#8db2d6] block">
              One-sentence positioning
            </label>
            <CopyTextButton
              label="Copy"
              disabled={!(app.qualityControl?.oneSentencePositioning || "").trim()}
              successMessage="Positioning sentence copied."
              getText={() => app.qualityControl?.oneSentencePositioning || ""}
              onNotify={onNotify}
              className="ui-button ui-button--secondary text-[11px]"
            />
          </div>
          <input id={`${fieldId}-27`}
            type="text"
            value={app.qualityControl?.oneSentencePositioning || ""}
            onChange={(e) => updateQualityControl("oneSentencePositioning", e.target.value)}
            className="min-w-0 w-full px-2.5 py-1.5 rounded bg-[var(--ui-inset)] border border-[var(--ui-border)] text-white text-xs"
            placeholder="Concise one-sentence positioning"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor={`${fieldId}-28`} className="text-xs font-bold text-[#8db2d6] block mb-1">
              Direct evidence used (one per line)
            </label>
            <MultilineArrayTextarea
              id={`${fieldId}-28`}
              rows={2}
              value={app.qualityControl?.directEvidenceUsed || []}
              onChangeLines={(lines) => updateQualityControl("directEvidenceUsed", lines)}
              className="min-w-0 w-full px-3 py-2 rounded-lg bg-[var(--ui-inset)] border border-[var(--ui-border)] text-white text-xs leading-relaxed"
              placeholder="Direct evidence supporting this application"
            />
          </div>
          <div>
            <label htmlFor={`${fieldId}-29`} className="text-xs font-bold text-[#8db2d6] block mb-1">
              Transferable evidence used (one per line)
            </label>
            <MultilineArrayTextarea
              id={`${fieldId}-29`}
              rows={2}
              value={app.qualityControl?.transferableEvidenceUsed || []}
              onChangeLines={(lines) => updateQualityControl("transferableEvidenceUsed", lines)}
              className="min-w-0 w-full px-3 py-2 rounded-lg bg-[var(--ui-inset)] border border-[var(--ui-border)] text-white text-xs leading-relaxed"
              placeholder="Transferable experience highlighted"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor={`${fieldId}-30`} className="text-xs font-bold text-amber-400 block mb-1">
              Unsupported claims avoided (one per line)
            </label>
            <MultilineArrayTextarea
              id={`${fieldId}-30`}
              rows={2}
              value={app.qualityControl?.potentialOverclaimsAvoided || []}
              onChangeLines={(lines) => updateQualityControl("potentialOverclaimsAvoided", lines)}
              className="min-w-0 w-full px-3 py-2 rounded-lg bg-[var(--ui-inset)] border border-[var(--ui-border)] text-white text-xs leading-relaxed"
              placeholder="Potential overclaims intentionally avoided"
            />
          </div>
          <div>
            <label htmlFor={`${fieldId}-31`} className="text-xs font-bold text-[#8db2d6] block mb-1">
              Human recruiter impression
            </label>
            <input id={`${fieldId}-31`}
              type="text"
              value={app.qualityControl?.humanRecruiterImpression || ""}
              onChange={(e) => updateQualityControl("humanRecruiterImpression", e.target.value)}
              className="min-w-0 w-full px-2.5 py-1.5 rounded bg-[var(--ui-inset)] border border-[var(--ui-border)] text-white text-xs"
              placeholder="Expected first impression for a human reviewer"
            />
          </div>
        </div>
      </div>

      <SaveSectionButton label="Save strategy" saving={saving} onSave={onSave} />
    </div>
  );
}
