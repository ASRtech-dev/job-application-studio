import React, { useId } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { Application } from "@/lib/schemas";
import type { ToastVariant } from "@/components/Toast";
import { SaveSectionButton } from "./SaveSectionButton";
import { CopyTextButton } from "@/components/CopyTextButton";

interface FormAnswersTabProps {
  app: Application;
  setApp?: React.Dispatch<React.SetStateAction<Application | null>>;
  updateFormFieldAnswers: (field: string, val: string) => void;
  saving: boolean;
  onSave: () => void;
  onNotify?: (message: string, variant?: ToastVariant) => void;
}

function formatEuropeanDate(isoDate?: string): string {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return "";
  const [y, m, d] = isoDate.split("-");
  return `${d}.${m}.${y}`;
}

/**
 * Editor tab for managing pre-generated portal screening questions, copiable logistics cards, and quick-copy answers.
 */
export function FormAnswersTab({
  app,
  setApp,
  updateFormFieldAnswers,
  saving,
  onSave,
  onNotify,
}: FormAnswersTabProps) {
  const fieldId = useId();
  const europeanStartDate = formatEuropeanDate(app.formFieldAnswers?.startDateIso);
  const workAuthValue = app.formFieldAnswers?.workAuthorization || app.formFieldAnswers?.workPermitGermany || "";
  const updateWorkAuthorization = (val: string) => {
    if (setApp && app.formFieldAnswers?.workPermitGermany) {
      setApp((prev) =>
        prev
          ? {
              ...prev,
              formFieldAnswers: {
                ...prev.formFieldAnswers,
                workAuthorization: val,
                workPermitGermany: "",
              },
            }
          : prev
      );
      return;
    }
    updateFormFieldAnswers("workAuthorization", val);
  };
  const languageSummary = (app.cvContent.header.languages || []).map((l) => `${l.language}: ${l.level}`).join(" · ");
  const copyAnswerFields = [
    {
      field: "shortMotivationMessage" as const,
      label: "Short motivation message",
      placeholder: "Summarize your motivation in one or two short paragraphs",
    },
    {
      field: "whyThisRole" as const,
      label: "Why this role?",
      placeholder: "Explain the relevant experience and impact you bring",
    },
    {
      field: "whyThisCompany" as const,
      label: "Why this company?",
      placeholder: "Explain what draws you to this organization",
    },
    {
      field: "additionalMessage" as const,
      label: "Additional message",
      placeholder: "Any extra context worth sharing",
    },
  ];
  const quickCopyChips = [
    { label: "Full name", value: app.cvContent.header.fullName },
    { label: "Email", value: app.cvContent.header.email },
    { label: "Phone", value: app.cvContent.header.phone },
    { label: "Location", value: app.cvContent.header.location },
    { label: "Languages", value: languageSummary },
    { label: "Work authorization", value: workAuthValue },
    { label: "Visa sponsorship required?", value: app.formFieldAnswers?.requiresSponsorship },
    { label: "Availability", value: app.formFieldAnswers?.availability || app.cvContent.header.availability },
    { label: "Start date (ISO)", value: app.formFieldAnswers?.startDateIso },
    { label: "Start date (DD.MM.YYYY)", value: europeanStartDate },
    { label: "Notice period", value: app.formFieldAnswers?.noticePeriod },
    { label: "Salary expectation", value: app.formFieldAnswers?.salaryExpectation },
    { label: "Website", value: app.formFieldAnswers?.website },
    { label: "LinkedIn", value: app.formFieldAnswers?.linkedin },
    { label: "GitHub", value: app.formFieldAnswers?.github },
  ].filter((c): c is { label: string; value: string } => Boolean(c.value?.trim()));

  const portalQuestions = app.portalQuestionAnswers || [];

  return (
    <div className="ui-controls space-y-6">
      <div className="border-b border-[var(--ui-border)] pb-2 flex flex-wrap gap-2 justify-between items-center">
        <div>
          <h3 className="text-sm font-bold text-white">Portal form answers</h3>
          <p className="text-xs text-slate-400">
            Copy logistics fields and review screening answers before pasting them into an application portal.
          </p>
        </div>
        <span className="text-xs px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold">
          Prep notes
        </span>
      </div>

      {/* 1. Fast Portal Copy Card */}
      <div className="ui-panel bg-[var(--ui-surface)] p-4 rounded-xl border border-[var(--ui-border)] space-y-3">
        <p className="text-xs font-bold text-[#8db2d6]">Quick-copy portal card (Workday / Greenhouse / Lever / ATS portals)</p>
        {quickCopyChips.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            {quickCopyChips.map((chip) => (
              <div key={chip.label} className="ui-inset flex items-center justify-between gap-2 rounded-lg border border-[var(--ui-border)] px-2.5 py-1.5">
                <div className="min-w-0">
                  <span className="text-[11px] text-slate-400 block">{chip.label}</span>
                  <span className="text-white font-medium truncate block">{chip.value}</span>
                </div>
                <CopyTextButton
                  label="Copy"
                  successMessage={`${chip.label} copied.`}
                  getText={() => chip.value}
                  onNotify={onNotify}
                  className="ui-button ui-button--secondary text-[11px] shrink-0"
                />
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-400">Fill in your details below to enable one-click copy buttons.</p>
        )}
      </div>

      {/* 2. Editable Logistics & Screening Fields */}
      <div className="ui-panel bg-[var(--ui-surface)] p-4 rounded-xl border border-[var(--ui-border)] space-y-4">
        <h4 className="text-xs font-bold text-white">Logistics &amp; common portal links</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <div className="flex items-center justify-between gap-2 mb-1">
              <label htmlFor="field-form-availability" className="text-xs font-bold text-[#8db2d6]">Availability (text)</label>
              <CopyTextButton
                label="Copy"
                disabled={!(app.formFieldAnswers?.availability || "").trim()}
                successMessage="Availability copied."
                getText={() => app.formFieldAnswers?.availability || ""}
                onNotify={onNotify}
                className="ui-button ui-button--secondary text-[11px]"
              />
            </div>
            <input id="field-form-availability"
              type="text"
              value={app.formFieldAnswers?.availability || ""}
              onChange={(e) => updateFormFieldAnswers("availability", e.target.value)}
              className="min-w-0 w-full px-2.5 py-1.5 rounded bg-[var(--ui-inset)] border border-[var(--ui-border)] text-white text-xs"
              placeholder="Confirmed start date or notice window"
            />
          </div>
          <div>
            <div className="flex items-center justify-between gap-2 mb-1">
              <label htmlFor="field-form-work-permit" className="text-xs font-bold text-[#8db2d6]">Work Authorization</label>
              <CopyTextButton
                label="Copy"
                disabled={!workAuthValue.trim()}
                successMessage="Work authorization copied."
                getText={() => workAuthValue}
                onNotify={onNotify}
                className="ui-button ui-button--secondary text-[11px]"
              />
            </div>
            <input id="field-form-work-permit"
              type="text"
              value={workAuthValue}
              onChange={(e) => updateWorkAuthorization(e.target.value)}
              className="min-w-0 w-full px-2.5 py-1.5 rounded bg-[var(--ui-inset)] border border-[var(--ui-border)] text-white text-xs"
              placeholder="To be confirmed"
            />
            {!workAuthValue.trim() && (
              <p className="mt-1 text-xs text-amber-400">To be confirmed: never inferred from location or default values.</p>
            )}
          </div>
          <div>
            <div className="flex items-center justify-between gap-2 mb-1">
              <label htmlFor={`${fieldId}-start-iso`} className="text-xs font-bold text-[#8db2d6]">Exact start date (ISO / DD.MM.YYYY)</label>
              <CopyTextButton
                label="Copy"
                disabled={!(app.formFieldAnswers?.startDateIso || "").trim()}
                successMessage="ISO start date copied."
                getText={() => app.formFieldAnswers?.startDateIso || ""}
                onNotify={onNotify}
                className="ui-button ui-button--secondary text-[11px]"
              />
            </div>
            <input id={`${fieldId}-start-iso`}
              type="date"
              value={app.formFieldAnswers?.startDateIso || ""}
              onChange={(e) => updateFormFieldAnswers("startDateIso", e.target.value)}
              className="min-w-0 w-full px-2.5 py-1.5 rounded bg-[var(--ui-inset)] border border-[var(--ui-border)] text-white text-xs"
            />
            {europeanStartDate && <p className="mt-1 text-[11px] text-slate-400">European DD.MM.YYYY format: <span className="font-mono text-slate-200">{europeanStartDate}</span></p>}
          </div>
          <div>
            <div className="flex items-center justify-between gap-2 mb-1">
              <label htmlFor={`${fieldId}-notice`} className="text-xs font-bold text-[#8db2d6]">Notice period</label>
              <CopyTextButton
                label="Copy"
                disabled={!(app.formFieldAnswers?.noticePeriod || "").trim()}
                successMessage="Notice period copied."
                getText={() => app.formFieldAnswers?.noticePeriod || ""}
                onNotify={onNotify}
                className="ui-button ui-button--secondary text-[11px]"
              />
            </div>
            <input id={`${fieldId}-notice`}
              type="text"
              value={app.formFieldAnswers?.noticePeriod || ""}
              onChange={(e) => updateFormFieldAnswers("noticePeriod", e.target.value)}
              placeholder="e.g. 2 weeks / 30 days (available from 2026-06-01)"
              className="min-w-0 w-full px-2.5 py-1.5 rounded bg-[var(--ui-inset)] border border-[var(--ui-border)] text-white text-xs"
            />
          </div>
          <div>
            <div className="flex items-center justify-between gap-2 mb-1">
              <label htmlFor={`${fieldId}-salary`} className="text-xs font-bold text-[#8db2d6]">Salary expectation</label>
              <div className="flex items-center gap-1.5">
                {app.salaryPositioning?.recommendedRangeEUR && (
                  <button
                    type="button"
                    onClick={() => updateFormFieldAnswers("salaryExpectation", app.salaryPositioning.recommendedRangeEUR)}
                    className="text-[11px] px-2 py-0.5 rounded bg-[#10233f] text-blue-200 hover:text-white border border-[#6d8ead]/30"
                  >
                    Use Strategy
                  </button>
                )}
                <CopyTextButton
                  label="Copy"
                  disabled={!(app.formFieldAnswers?.salaryExpectation || "").trim()}
                  successMessage="Salary expectation copied."
                  getText={() => app.formFieldAnswers?.salaryExpectation || ""}
                  onNotify={onNotify}
                  className="ui-button ui-button--secondary text-[11px]"
                />
              </div>
            </div>
            <input id={`${fieldId}-salary`}
              type="text"
              value={app.formFieldAnswers?.salaryExpectation || ""}
              onChange={(e) => updateFormFieldAnswers("salaryExpectation", e.target.value)}
              placeholder="e.g. $85,000–$95,000 or €60,000–€70,000 gross/year"
              className="min-w-0 w-full px-2.5 py-1.5 rounded bg-[var(--ui-inset)] border border-[var(--ui-border)] text-white text-xs"
            />
          </div>
          <div>
            <div className="flex items-center justify-between gap-2 mb-1">
              <label htmlFor={`${fieldId}-sponsor`} className="text-xs font-bold text-[#8db2d6]">Visa sponsorship required?</label>
              <CopyTextButton
                label="Copy"
                disabled={!(app.formFieldAnswers?.requiresSponsorship || "").trim()}
                successMessage="Sponsorship answer copied."
                getText={() => app.formFieldAnswers?.requiresSponsorship || ""}
                onNotify={onNotify}
                className="ui-button ui-button--secondary text-[11px]"
              />
            </div>
            <input id={`${fieldId}-sponsor`}
              type="text"
              value={app.formFieldAnswers?.requiresSponsorship || ""}
              onChange={(e) => updateFormFieldAnswers("requiresSponsorship", e.target.value)}
              placeholder="e.g. No / Yes (specify details)"
              className="min-w-0 w-full px-2.5 py-1.5 rounded bg-[var(--ui-inset)] border border-[var(--ui-border)] text-white text-xs"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 pt-2">
          <div>
            <div className="flex items-center justify-between gap-2 mb-1">
              <label htmlFor={`${fieldId}-5`} className="text-xs font-bold text-[#8db2d6]">Website</label>
              <CopyTextButton
                label="Copy"
                disabled={!(app.formFieldAnswers?.website || "").trim()}
                successMessage="Website copied."
                getText={() => app.formFieldAnswers?.website || ""}
                onNotify={onNotify}
                className="ui-button ui-button--secondary text-[11px]"
              />
            </div>
            <input id={`${fieldId}-5`}
              type="text"
              value={app.formFieldAnswers?.website || ""}
              onChange={(e) => updateFormFieldAnswers("website", e.target.value)}
              className="min-w-0 w-full px-2.5 py-1.5 rounded bg-[var(--ui-inset)] border border-[var(--ui-border)] text-white text-xs"
            />
          </div>
          <div>
            <div className="flex items-center justify-between gap-2 mb-1">
              <label htmlFor={`${fieldId}-6`} className="text-xs font-bold text-[#8db2d6]">LinkedIn profile</label>
              <CopyTextButton
                label="Copy"
                disabled={!(app.formFieldAnswers?.linkedin || "").trim()}
                successMessage="LinkedIn copied."
                getText={() => app.formFieldAnswers?.linkedin || ""}
                onNotify={onNotify}
                className="ui-button ui-button--secondary text-[11px]"
              />
            </div>
            <input id={`${fieldId}-6`}
              type="text"
              value={app.formFieldAnswers?.linkedin || ""}
              onChange={(e) => updateFormFieldAnswers("linkedin", e.target.value)}
              className="min-w-0 w-full px-2.5 py-1.5 rounded bg-[var(--ui-inset)] border border-[var(--ui-border)] text-white text-xs"
            />
          </div>
          <div>
            <div className="flex items-center justify-between gap-2 mb-1">
              <label htmlFor={`${fieldId}-7-github`} className="text-xs font-bold text-[#8db2d6]">GitHub</label>
              <CopyTextButton
                label="Copy"
                disabled={!(app.formFieldAnswers?.github || "").trim()}
                successMessage="GitHub copied."
                getText={() => app.formFieldAnswers?.github || ""}
                onNotify={onNotify}
                className="ui-button ui-button--secondary text-[11px]"
              />
            </div>
            <input id={`${fieldId}-7-github`}
              type="text"
              value={app.formFieldAnswers?.github || ""}
              onChange={(e) => updateFormFieldAnswers("github", e.target.value)}
              placeholder="https://github.com/..."
              className="min-w-0 w-full px-2.5 py-1.5 rounded bg-[var(--ui-inset)] border border-[var(--ui-border)] text-white text-xs"
            />
          </div>
        </div>
      </div>

      {/* 3. Editable Portal Screening Questions */}
      {(portalQuestions.length > 0 || setApp) && (
        <div className="ui-panel bg-[var(--ui-surface)] p-4 rounded-xl border border-[var(--ui-border)] space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-xs font-bold text-white">Portal-specific screening questions</h4>
            {setApp && (
              <button
                type="button"
                onClick={() =>
                  setApp((prev) =>
                    prev
                      ? { ...prev, portalQuestionAnswers: [...(prev.portalQuestionAnswers || []), { question: "", answer: "" }] }
                      : prev
                  )
                }
                className="ui-button ui-button--secondary text-xs flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Add question
              </button>
            )}
          </div>
          {portalQuestions.length === 0 ? (
            <p className="text-xs text-slate-400">No portal questions recorded for this application yet.</p>
          ) : (
            <div className="space-y-3">
              {portalQuestions.map((qa, idx) => (
                <div key={idx} className="ui-inset rounded-lg border border-[var(--ui-border)] p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    {setApp ? (
                      <input
                        aria-label={`Portal question ${idx + 1}`}
                        type="text"
                        value={qa.question}
                        placeholder={`Portal question ${idx + 1}...`}
                        onChange={(e) => {
                          const next = [...portalQuestions];
                          next[idx] = { ...next[idx], question: e.target.value };
                          setApp((prev) => prev ? { ...prev, portalQuestionAnswers: next } : prev);
                        }}
                        className="min-w-0 flex-1 px-2.5 py-1 rounded bg-[var(--ui-surface)] border border-[var(--ui-border)] text-blue-200 text-xs font-semibold"
                      />
                    ) : (
                      <p className="text-xs font-semibold text-blue-200">{qa.question}</p>
                    )}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <CopyTextButton
                        label="Copy"
                        disabled={!qa.answer.trim()}
                        successMessage={`Question ${idx + 1} answer copied.`}
                        getText={() => qa.answer}
                        onNotify={onNotify}
                        className="ui-button ui-button--secondary text-[11px]"
                      />
                      {setApp && (
                        <button
                          type="button"
                          aria-label={`Remove portal question ${idx + 1}`}
                          onClick={() => {
                            const next = portalQuestions.filter((_, i) => i !== idx);
                            setApp((prev) => prev ? { ...prev, portalQuestionAnswers: next } : prev);
                          }}
                          className="ui-button ui-button--danger px-2 py-1 text-rose-400 hover:text-rose-300"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                  {setApp ? (
                    <textarea
                      aria-label={`Answer to portal question ${idx + 1}`}
                      rows={3}
                      value={qa.answer}
                      placeholder="Concise answer ready to paste into the portal..."
                      onChange={(e) => {
                        const next = [...portalQuestions];
                        next[idx] = { ...next[idx], answer: e.target.value };
                        setApp((prev) => prev ? { ...prev, portalQuestionAnswers: next } : prev);
                      }}
                      className="min-w-0 w-full px-2.5 py-1.5 rounded bg-[var(--ui-surface)] border border-[var(--ui-border)] text-slate-200 text-xs leading-relaxed"
                    />
                  ) : (
                    <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">{qa.answer}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 4. Long Form Motivation Answers */}
      <div className="ui-panel bg-[var(--ui-surface)] p-4 rounded-xl border border-[var(--ui-border)] space-y-4">
        <h4 className="text-xs font-bold text-white">Long-form motivation answers</h4>
        {copyAnswerFields.map((item) => (
          <div key={item.field}>
            <div className="flex flex-wrap gap-3 justify-between items-center mb-1">
              <label htmlFor={`${fieldId}-1-${item.field}`} className="text-xs font-bold text-[#8db2d6] block">{item.label}</label>
              <CopyTextButton
                label="Copy text"
                disabled={!(app.formFieldAnswers?.[item.field] || "").trim()}
                successMessage={`${item.label} copied.`}
                getText={() => app.formFieldAnswers?.[item.field] || ""}
                onNotify={onNotify}
                className="ui-button ui-button--secondary text-xs"
              />
            </div>
            <textarea id={`${fieldId}-1-${item.field}`}
              rows={3}
              value={app.formFieldAnswers?.[item.field] || ""}
              onChange={(e) => updateFormFieldAnswers(item.field, e.target.value)}
              className="min-w-0 w-full px-3 py-2 rounded-lg bg-[var(--ui-inset)] border border-[var(--ui-border)] text-white text-xs leading-relaxed"
              placeholder={item.placeholder}
            />
          </div>
        ))}

        <div>
          <div className="flex items-center justify-between gap-2 mb-1">
            <label htmlFor={`${fieldId}-4`} className="text-xs font-bold text-[#8db2d6]">
              Education note
            </label>
            <CopyTextButton
              label="Copy text"
              disabled={!(app.formFieldAnswers?.degreeExplanation || "").trim()}
              successMessage="Education note copied."
              getText={() => app.formFieldAnswers?.degreeExplanation || ""}
              onNotify={onNotify}
              className="ui-button ui-button--secondary text-[11px]"
            />
          </div>
          <textarea id={`${fieldId}-4`}
            rows={2}
            value={app.formFieldAnswers?.degreeExplanation || ""}
            onChange={(e) => updateFormFieldAnswers("degreeExplanation", e.target.value)}
            className="min-w-0 w-full px-3 py-2 rounded-lg bg-[var(--ui-inset)] border border-[var(--ui-border)] text-white text-xs leading-relaxed"
            placeholder="Describe your education background or credentials if relevant"
          />
        </div>
      </div>

      <SaveSectionButton label="Save form answers" saving={saving} onSave={onSave} />
    </div>
  );
}
