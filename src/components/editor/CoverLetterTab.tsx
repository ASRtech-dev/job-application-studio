import React from "react";
import type { Application } from "@/lib/schemas";
import type { ToastVariant } from "@/components/Toast";
import { SaveSectionButton } from "./SaveSectionButton";
import { CopyTextButton } from "@/components/CopyTextButton";

interface CoverLetterTabProps {
  app: Application;
  setApp: React.Dispatch<React.SetStateAction<Application | null>>;
  updateCoverLetterParagraph: (idx: number, val: string) => void;
  saving: boolean;
  onSave: () => void;
  onNotify?: (message: string, variant?: ToastVariant) => void;
}

/**
 * Editor tab for customizing Cover Letter headers, DIN 5008 subject, editorial sidebar labels, and body paragraphs.
 */
export function CoverLetterTab({
  app,
  setApp,
  updateCoverLetterParagraph,
  saving,
  onSave,
  onNotify,
}: CoverLetterTabProps) {
  const fieldId = React.useId();
  return (
    <div className="ui-controls space-y-5">
      <div className="border-b border-[#1f2937] pb-2 flex justify-between items-center">
        <div>
          <h3 className="text-sm font-bold text-white">Cover letter</h3>
          <p className="text-xs text-slate-500">
            Edit cover letter paragraphs and review the layout before exporting.
          </p>
        </div>
        <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
          Document content
        </span>
      </div>

      <div className="ui-panel flex flex-wrap gap-3 justify-between items-center bg-[#0e162d] p-3 rounded-xl border border-[#1f2937]/50">
        <div className="flex flex-col">
          <span className="text-xs font-semibold text-white">Copy cover letter</span>
          <span className="text-xs text-slate-400">Copy plain text to paste into an email or portal form.</span>
        </div>
        <CopyTextButton
          label="Copy full cover letter as text"
          successMessage="Cover letter copied as text."
          onNotify={onNotify}
          className="ui-button ui-button--secondary px-3 py-1.5 rounded-lg bg-[#10233f] hover:bg-[#183661] border border-[#6d8ead]/30 text-white font-semibold text-xs"
          getText={() => {
            const date = app.coverLetterContent.dateLine || "";
            const targetRole = app.coverLetterContent.roleTitle || app.roleTitle || "";
            const subject =
              app.coverLetterContent.subjectLine ||
              (app.language === "German"
                ? `Bewerbung als ${targetRole}`
                : app.language === "Spanish"
                ? `Candidatura al puesto de ${targetRole}`
                : `Application for ${targetRole}`);
            const greeting = app.coverLetterContent.greeting || "";
            const paragraphsStr = app.coverLetterContent.paragraphs.map((p) => p.text).join("\n\n");
            const closing = app.coverLetterContent.closingPhrase || "";
            const signature = app.coverLetterContent.signatureName || "";
            const fullLetter = `${date}\n\n${subject}\n\n${greeting}\n\n${paragraphsStr}\n\n${closing}\n\n${signature}`;
            return fullLetter;
          }}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor={`${fieldId}-field-1`} className="text-xs font-bold text-[#6d8ead] block mb-1">Date &amp; location</label>
          <input id={`${fieldId}-field-1`}
            type="text"
            value={app.coverLetterContent.dateLine}
            onChange={(e) =>
              setApp({
                ...app,
                coverLetterContent: { ...app.coverLetterContent, dateLine: e.target.value },
              })
            }
            className="min-w-0 w-full px-3 py-1.5 rounded bg-[#0a0f1d] border border-[#1f2937] text-white text-xs"
          />
        </div>
        <div>
          <label htmlFor={`${fieldId}-field-2`} className="text-xs font-bold text-[#6d8ead] block mb-1">Greeting</label>
          <input id={`${fieldId}-field-2`}
            type="text"
            value={app.coverLetterContent.greeting}
            onChange={(e) =>
              setApp({
                ...app,
                coverLetterContent: { ...app.coverLetterContent, greeting: e.target.value },
              })
            }
            className="min-w-0 w-full px-3 py-1.5 rounded bg-[#0a0f1d] border border-[#1f2937] text-white text-xs"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor={`${fieldId}-field-3`} className="text-xs font-bold text-[#6d8ead] block mb-1">
            Letter subject
          </label>
          <input id={`${fieldId}-field-3`}
            type="text"
            value={app.coverLetterContent.subjectLine || ""}
            onChange={(e) =>
              setApp({
                ...app,
                coverLetterContent: { ...app.coverLetterContent, subjectLine: e.target.value },
              })
            }
            className="min-w-0 w-full px-3 py-1.5 rounded bg-[#0a0f1d] border border-[#1f2937] text-white text-xs"
            placeholder={`Defaults to role title if blank: ${app.roleTitle || "target role"}`}
          />
        </div>
        <div>
          <label htmlFor={`${fieldId}-field-4`} className="text-xs font-bold text-[#6d8ead] block mb-1">
            Positioning line / subtitle
          </label>
          <input id={`${fieldId}-field-4`}
            type="text"
            value={app.coverLetterContent.positioningLine || ""}
            onChange={(e) =>
              setApp({
                ...app,
                coverLetterContent: { ...app.coverLetterContent, positioningLine: e.target.value },
              })
            }
            className="min-w-0 w-full px-3 py-1.5 rounded bg-[#0a0f1d] border border-[#1f2937] text-white text-xs"
            placeholder="Role focus or subtitle"
          />
        </div>
      </div>

      {/* Letter Target (syncs with FinalReview mismatch anchors) */}
      <div className="ui-panel rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface)] p-4 space-y-3">
        <h4 className="text-xs font-bold text-white">Recipient &amp; reference on letter</h4>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
          <div>
            <label htmlFor="field-letter-company" className="text-xs font-bold text-[#8db2d6] block mb-1">Recipient company on letter</label>
            <input
              id="field-letter-company"
              type="text"
              value={app.coverLetterContent.company || ""}
              onChange={(e) =>
                setApp({
                  ...app,
                  coverLetterContent: { ...app.coverLetterContent, company: e.target.value },
                })
              }
              className="min-w-0 w-full px-2.5 py-1.5 rounded bg-[var(--ui-inset)] border border-[var(--ui-border)] text-white text-xs"
              placeholder={app.company || "Company name"}
            />
          </div>
          <div>
            <label htmlFor="field-letter-role" className="text-xs font-bold text-[#8db2d6] block mb-1">Role referenced on letter</label>
            <input
              id="field-letter-role"
              type="text"
              value={app.coverLetterContent.roleTitle || ""}
              onChange={(e) =>
                setApp({
                  ...app,
                  coverLetterContent: { ...app.coverLetterContent, roleTitle: e.target.value },
                })
              }
              className="min-w-0 w-full px-2.5 py-1.5 rounded bg-[var(--ui-inset)] border border-[var(--ui-border)] text-white text-xs"
              placeholder={app.roleTitle || "Target role"}
            />
          </div>
        </div>
      </div>

      {/* Sidebar customization details */}
      <div className="ui-panel rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface)] p-4 space-y-3">
        <h4 className="text-xs font-bold text-white mb-0.5">Editorial sidebar labels</h4>
        <p className="text-xs text-slate-400 -mt-1.5">
          Displayed when using the Editorial Sidebar Letter template.
        </p>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
          <div>
            <label htmlFor={`${fieldId}-field-5`} className="text-xs font-bold text-[#8db2d6] block mb-1">Sidebar label</label>
            <input id={`${fieldId}-field-5`}
              type="text"
              value={app.coverLetterContent.sidebarLabel ?? ""}
              onChange={(e) =>
                setApp({
                  ...app,
                  coverLetterContent: { ...app.coverLetterContent, sidebarLabel: e.target.value },
                })
              }
              className="min-w-0 w-full px-2.5 py-1.5 rounded bg-[var(--ui-inset)] border border-[var(--ui-border)] text-white text-xs"
              placeholder="COVER LETTER / BEWERBUNG"
            />
          </div>
          <div>
            <label htmlFor={`${fieldId}-field-6`} className="text-xs font-bold text-[#8db2d6] block mb-1">Role in sidebar</label>
            <input id={`${fieldId}-field-6`}
              type="text"
              value={app.coverLetterContent.sidebarRole || ""}
              onChange={(e) =>
                setApp({
                  ...app,
                  coverLetterContent: { ...app.coverLetterContent, sidebarRole: e.target.value },
                })
              }
              className="min-w-0 w-full px-2.5 py-1.5 rounded bg-[var(--ui-inset)] border border-[var(--ui-border)] text-white text-xs"
              placeholder="Defaults to role title if blank"
            />
          </div>
          <div>
            <label htmlFor={`${fieldId}-field-7`} className="text-xs font-bold text-[#8db2d6] block mb-1">Company in sidebar</label>
            <input id={`${fieldId}-field-7`}
              type="text"
              value={app.coverLetterContent.sidebarCompany || ""}
              onChange={(e) =>
                setApp({
                  ...app,
                  coverLetterContent: { ...app.coverLetterContent, sidebarCompany: e.target.value },
                })
              }
              className="min-w-0 w-full px-2.5 py-1.5 rounded bg-[var(--ui-inset)] border border-[var(--ui-border)] text-white text-xs"
              placeholder="Defaults to company if blank"
            />
          </div>
        </div>
      </div>

      <div className="space-y-4 pt-2">
        {app.coverLetterContent.paragraphs.map((p, idx) => (
          <div key={idx} className="ui-inset space-y-1 bg-[#0a0f1d] p-3.5 rounded border border-[#1f2937]/50">
            <span className="text-xs font-bold text-[#6d8ead]">
              Paragraph {idx + 1}
            </span>
            <textarea aria-label={`Cover letter paragraph ${idx + 1}`} id={`${fieldId}-field-8-${idx}`}
              rows={5}
              value={p.text}
              onChange={(e) => updateCoverLetterParagraph(idx, e.target.value)}
              className="min-w-0 w-full bg-transparent text-white text-xs leading-relaxed border-t border-transparent focus:border-t-[#1f2937] pt-1.5"
            />
          </div>
        ))}
      </div>

      <div className="border-t border-[#1f2937] pt-4">
        <label htmlFor={`${fieldId}-field-9`} className="text-xs font-bold text-[#6d8ead] block mb-1">Closing phrase</label>
        <input id={`${fieldId}-field-9`}
          type="text"
          value={app.coverLetterContent.closingPhrase}
          onChange={(e) =>
            setApp({
              ...app,
              coverLetterContent: { ...app.coverLetterContent, closingPhrase: e.target.value },
            })
          }
          className="min-w-0 w-full px-3 py-1.5 rounded bg-[#0a0f1d] border border-[#1f2937] text-white text-xs"
        />
      </div>

      <SaveSectionButton label="Save cover letter" saving={saving} onSave={onSave} />
    </div>
  );
}
