import type { ImportDiffSection, ImportValidation } from "@/lib/importPreview";

interface ImportPreviewPanelProps {
  validation: ImportValidation;
  diff?: ImportDiffSection[];
  /** Shown when the preview cannot compare (e.g. new application from the dashboard). */
  showSummary?: boolean;
}

const count = (section: ImportDiffSection) => [
  section.added ? `${section.added} added` : "",
  section.replaced ? `${section.replaced} updated` : "",
  section.removed ? `${section.removed} removed` : "",
  section.excluded ? `${section.excluded} excluded` : "",
].filter(Boolean).join(" · ");

const MODE_BADGE: Record<string, string> = {
  full_application: "Full application (CV + Cover Letter)",
  triage_only: "Quick triage (fit assessment)",
  outreach_only: "Outreach messages & portal Q&A",
  interview_prep: "STAR interview prep",
};

const DECISION_LABELS: Record<string, string> = {
  Apply: "Apply",
  "Apply selectively": "Apply selectively",
  Skip: "Skip",
};

const PRIORITY_LABELS: Record<string, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
  strategic: "Strategic",
  coreTarget: "Core target",
  bridgeRole: "Bridge role",
};

const LANGUAGE_LABELS: Record<string, string> = {
  English: "English",
  German: "German",
  Spanish: "Spanish",
};

const FIELD_LABELS: Record<string, string> = {
  company: "Company",
  roleTitle: "Role title",
  language: "Language",
  status: "Status",
  searchTrack: "Focus area",
  promptContext: "Prompt provenance",
  cvContent: "CV content",
  "cvContent.header": "CV header",
  "cvContent.professionalProfile": "Professional profile",
  "cvContent.keyAchievements": "Key achievements",
  "cvContent.coreSkills": "Core skills",
  "cvContent.experience": "Experience",
  "cvContent.projects": "Projects",
  "cvContent.education": "Education",
  "cvContent.certifications": "Certifications",
  coverLetterContent: "Cover letter",
  fitAssessment: "Fit assessment",
  roleClassification: "Role classification",
  salaryPositioning: "Salary positioning",
  keywordStrategy: "ATS keyword strategy",
  jobAnalysis: "Job requirements analysis",
  outreachMessages: "Outreach messages",
  portalQuestionAnswers: "Portal Q&A",
  interviewPrep: "STAR interview prep",
};

function translateKey(key: string): string {
  return FIELD_LABELS[key] || key.replace(/^cvContent\./, "CV · ");
}

/** Honest import status: syntax, structure, partial content and section changes. */
export function ImportPreviewPanel({ validation, diff, showSummary = true }: ImportPreviewPanelProps) {
  const tone = !validation.ok ? "bg-rose-500/10 border-rose-500/30 text-rose-200" : validation.partial ? "bg-amber-500/10 border-amber-500/30 text-amber-100" : "bg-emerald-500/10 border-emerald-500/30 text-emerald-100";
  const modeNote = validation.detectedMode && validation.detectedMode !== "partial" ? ` · ${MODE_BADGE[validation.detectedMode] || ""}` : "";
  const recognizedLabels = validation.recognized.map(translateKey).join(", ");
  const title = !validation.syntaxOk
    ? "Unreadable JSON"
    : !validation.ok
      ? "Valid JSON, but not a recognized application payload"
      : validation.partial
        ? `Partial import${modeNote}: ${recognizedLabels}`
        : `Valid JSON and recognized fields${modeNote}`;

  const data = (validation.data || {}) as Record<string, unknown>;
  const cv = (data.cvContent && typeof data.cvContent === "object" ? data.cvContent : null) as Record<string, unknown> | null;
  const expCount = Array.isArray(cv?.experience) ? cv.experience.length : 0;
  const achCount = Array.isArray(cv?.keyAchievements) ? cv.keyAchievements.length : 0;
  const hasLetter = Boolean(data.coverLetterContent || data.coverLetter);
  const hasOutreach = Boolean(data.outreachMessages || data.portalQuestionAnswers);
  const hasPrep = Boolean(data.interviewPrep);
  const inventory = [
    expCount > 0 ? `${expCount} ${expCount === 1 ? "experience" : "experiences"}` : "",
    achCount > 0 ? `${achCount} ${achCount === 1 ? "achievement" : "achievements"}` : "",
    hasLetter ? "Cover Letter" : "",
    hasOutreach ? "Outreach / Q&A" : "",
    hasPrep ? "STAR Guide" : "",
  ].filter(Boolean);

  return (
    <div role="status" aria-live="polite" className={`mt-3 rounded-xl border p-3 text-xs leading-relaxed ${tone}`}>
      <p className="mb-1 font-bold">{title}</p>
      {validation.errors.length > 0 && <ul className="list-disc space-y-0.5 pl-4">{validation.errors.map((error) => <li key={error}>{error}</li>)}</ul>}
      {validation.warnings.length > 0 && <ul className="mt-1 list-disc space-y-0.5 pl-4 text-amber-200">{validation.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>}
      {showSummary && validation.ok && (
        <div className="mt-1.5 space-y-1 text-slate-200">
          {validation.summary.company && <p><strong>Company:</strong> {validation.summary.company}</p>}
          {validation.summary.roleTitle && <p><strong>Role:</strong> {validation.summary.roleTitle}</p>}
          {validation.summary.language && (
            <p><strong>Document language:</strong> {LANGUAGE_LABELS[validation.summary.language] || validation.summary.language}</p>
          )}
          {typeof validation.summary.fitScore === "number" && <p><strong>AI fit rating (not an interview probability):</strong> {validation.summary.fitScore}/10</p>}
          {validation.summary.applyOrSkip && (
            <p><strong>AI recommendation:</strong> {DECISION_LABELS[validation.summary.applyOrSkip] || validation.summary.applyOrSkip}</p>
          )}
          {validation.summary.priority && (
            <p><strong>Estimated priority:</strong> {PRIORITY_LABELS[validation.summary.priority] || validation.summary.priority}</p>
          )}
          {inventory.length > 0 && (
            <p className="text-slate-300"><strong>Included blocks:</strong> {inventory.join(" · ")}</p>
          )}
          {validation.summary.fitSummary && <p className="text-slate-300 mt-1">{validation.summary.fitSummary}</p>}
          {validation.summary.mainRisks && validation.summary.mainRisks.length > 0 && (
            <div className="mt-1 rounded-lg border border-amber-500/25 bg-amber-500/5 p-2 text-amber-100">
              <p className="font-semibold">Flagged risks:</p>
              <ul className="list-disc pl-4 space-y-0.5">
                {validation.summary.mainRisks.slice(0, 4).map((risk, i) => <li key={i}>{risk}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
      {diff && validation.ok && (
        diff.length === 0 ? <p className="mt-2">No changes compared to the current draft.</p> : (
          <div className="mt-2">
            <p className="font-semibold text-slate-100">Changes by section</p>
            <ul className="mt-1 space-y-1">
              {diff.map((section) => (
                <li key={section.section}>
                  <details>
                    <summary className="cursor-pointer text-slate-100">{section.label}: {count(section)}</summary>
                    <ul className="mt-1 list-disc pl-5 text-slate-300">
                      {section.details.slice(0, 20).map((detail, index) => <li key={`${section.section}-${index}`}>{detail}</li>)}
                      {section.details.length > 20 && <li className="text-slate-400 italic">+{section.details.length - 20} more changes</li>}
                    </ul>
                  </details>
                </li>
              ))}
            </ul>
          </div>
        )
      )}
    </div>
  );
}
