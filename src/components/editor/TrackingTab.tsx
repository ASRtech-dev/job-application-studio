import React, { useState, useId } from "react";
import type { Application } from "@/lib/schemas";
import type { ToastVariant } from "@/components/Toast";
import { CopyTextButton } from "@/components/CopyTextButton";
import { SaveSectionButton } from "./SaveSectionButton";

interface TrackingTabProps {
  app: Application;
  setApp: React.Dispatch<React.SetStateAction<Application | null>>;
  saving: boolean;
  onSave: () => void;
  onNotify?: (message: string, variant?: ToastVariant) => void;
  onOpenCrmAction?: () => void;
  onTriggerAppliedCrm?: (nextStatus: Application["status"]) => void;
}

/**
 * Editor tab for application pipeline status, manual CRM review summary, recruiter details, notes, editable outreach, and follow-up email templates.
 */
export function TrackingTab({ app, setApp, saving, onSave, onNotify, onOpenCrmAction, onTriggerAppliedCrm }: TrackingTabProps) {
  const fieldId = useId();
  const candidateName = app.cvContent?.header?.fullName || "Candidate";
  const thesis = (app.jobAnalysis?.positioningThesis || app.qualityControl?.oneSentencePositioning || "").trim();
  const englishContext = app.language === "English" && thesis ? `\n\nA relevant point from my application: ${thesis}` : "";
  const germanContext = app.language === "German" && thesis ? `\n\nEin relevanter Punkt aus meiner Bewerbung: ${thesis}` : "";
  const spanishContext = app.language === "Spanish" && thesis ? `\n\nUn punto relevante de mi candidatura: ${thesis}` : "";
  const [reviewedTemplates, setReviewedTemplates] = useState<Record<number, string>>({});

  const sentEvent = app.crm?.events?.find((ev) => ev.type === "application_sent" && !ev.voidedAt);
  const openActionsCount = (app.crm?.actions || []).filter((a) => a.status === "open").length;
  const crmReviewed = app.crm?.preparation?.reviewed === true;

  const emailTemplates = [
    {
      key: "en-followup",
      recommended: app.language === "English" && app.status !== "interviewing",
      title: "Application follow-up · English",
      subject: `Application Follow-up - ${app.roleTitle} - ${candidateName}`,
      body: `Dear Hiring Team,\n\nI am following up on my application for the ${app.roleTitle} role at ${app.company}.${englishContext}\n\nI remain interested in the opportunity. Please let me know if you need any further information or can share an update on the hiring process.\n\nBest regards,\n${candidateName}`,
    },
    {
      key: "en-thanks",
      recommended: app.language === "English" && app.status === "interviewing",
      title: "Post-interview thank-you · English",
      subject: `Thank you — Interview for ${app.roleTitle} - ${candidateName}`,
      body: `Dear Hiring Team,\n\nThank you for taking the time to discuss the ${app.roleTitle} position at ${app.company}. I remain interested in the opportunity.\n\nPlease let me know if you need any further information from me. I would welcome an update on the next steps.\n\nBest regards,\n${candidateName}`,
      reviewLabel: "I had this conversation and reviewed the draft.",
    },
    {
      key: "de-followup",
      recommended: app.language === "German",
      title: "Application follow-up · German",
      subject: `Rückfrage zur Bewerbung als ${app.roleTitle} - ${candidateName}`,
      body: `Guten Tag,\n\nich möchte mich nach dem aktuellen Stand meiner Bewerbung als ${app.roleTitle} bei ${app.company} erkundigen.${germanContext}\n\nIch bin weiterhin an der Position interessiert und stehe für Rückfragen gerne zur Verfügung. Über eine kurze Rückmeldung zum weiteren Ablauf würde ich mich freuen.\n\nMit freundlichen Grüßen\n${candidateName}`,
    },
    {
      key: "es-followup",
      recommended: app.language === "Spanish",
      title: "Application follow-up · Spanish",
      subject: `Seguimiento de candidatura: ${app.roleTitle} - ${candidateName}`,
      body: `Hola,\n\nMe pongo en contacto para hacer seguimiento de mi candidatura al puesto de ${app.roleTitle} en ${app.company}.${spanishContext}\n\nSigo muy interesado/a en la oportunidad y quedo a su disposición si necesitan información adicional. Agradecería cualquier actualización sobre los próximos pasos.\n\nUn saludo cordial,\n${candidateName}`,
    },
  ];

  const customOutreach = app.outreachMessages || {};
  const headlineFact = app.cvContent?.header?.headline?.trim();
  const availabilityFact = app.cvContent?.header?.availability?.trim();
  const lang = app.language;
  const defaultConnect =
    lang === "German"
      ? `Hallo, ich habe mich auf die Position ${app.roleTitle} bei ${app.company} beworben${thesis ? ` (${thesis.slice(0, 120)})` : headlineFact ? ` (${headlineFact.slice(0, 120)})` : ""} und freue mich über die Vernetzung.`
      : lang === "Spanish"
      ? `Hola, acabo de presentar mi candidatura para ${app.roleTitle} en ${app.company}${thesis ? ` (${thesis.slice(0, 120)})` : headlineFact ? ` (${headlineFact.slice(0, 120)})` : ""} y me encantaría conectar.`
      : `Hi — I just applied for the ${app.roleTitle} role at ${app.company}${thesis ? ` (${thesis.slice(0, 120)})` : headlineFact ? ` (${headlineFact.slice(0, 120)})` : ""} and would welcome connecting.`;
  const defaultDm =
    lang === "German"
      ? `Guten Tag,\n\nich habe mich soeben als ${app.roleTitle} bei ${app.company} beworben.${thesis ? ` Kurzprofil: ${thesis}` : headlineFact ? ` Profil: ${headlineFact}.` : ""}${availabilityFact ? `\nVerfügbarkeit: ${availabilityFact}.` : ""}\n\nVielen Dank für Ihre Zeit!\n${candidateName}`
      : lang === "Spanish"
      ? `Hola,\n\nAcabo de presentar mi candidatura para ${app.roleTitle} en ${app.company}.${thesis ? ` Contexto breve: ${thesis}` : headlineFact ? ` Perfil: ${headlineFact}.` : ""}${availabilityFact ? `\nDisponibilidad: ${availabilityFact}.` : ""}\n\nMuchas gracias por su tiempo.\n${candidateName}`
      : `Hi,\n\nI just applied for the ${app.roleTitle} role at ${app.company}.${thesis ? ` Brief context: ${thesis}` : headlineFact ? ` Profile: ${headlineFact}.` : ""}${availabilityFact ? `\nAvailability: ${availabilityFact}.` : ""}\n\nBest regards,\n${candidateName}`;
  const defaultDay10 =
    lang === "German"
      ? `Guten Tag,\n\nkurze Nachfrage zu meiner Bewerbung als ${app.roleTitle} bei ${app.company}. Falls sich der Zeitplan verschoben hat, danke ich Ihnen für eine kurze Rückmeldung.\n\nFreundliche Grüße\n${candidateName}`
      : lang === "Spanish"
      ? `Hola,\n\nTe escribo brevemente para hacer seguimiento de mi candidatura para ${app.roleTitle} en ${app.company}. Entiendo perfectamente si los plazos han cambiado — agradecería cualquier novedad.\n\nUn saludo cordial,\n${candidateName}`
      : `Hi,\n\nChecking in briefly regarding my application for ${app.roleTitle} at ${app.company}. Completely understand if timelines shifted — any quick status update is appreciated.\n\nBest regards,\n${candidateName}`;

  const outreachRows = [
    {
      field: "linkedInConnectionNote" as const,
      title: `LinkedIn connection note (${(customOutreach.linkedInConnectionNote ?? defaultConnect).slice(0, 300).length}/300 chars)`,
      value: customOutreach.linkedInConnectionNote ?? defaultConnect,
      maxLen: 300,
    },
    {
      field: "hiringManagerNote" as const,
      title: "Direct message to Hiring Manager / Recruiter",
      value: customOutreach.hiringManagerNote ?? customOutreach.recruiterDirectMessage ?? defaultDm,
    },
    {
      field: "followUpMessage" as const,
      title: "Gentle follow-up message",
      value: customOutreach.followUpMessage ?? defaultDay10,
    },
  ];

  return (
    <div className="ui-controls space-y-5">
      <div className="border-b border-[var(--ui-border)] pb-2">
        <h3 className="text-sm font-bold text-white">Application tracking</h3>
        <p className="text-xs text-slate-400">
          Manage pipeline status, manual CRM review summary, contact references, outreach drafts, and notes.
        </p>
      </div>

      {/* CRM Preparation & Activity Summary (#field-crm-preparation anchor) */}
      <div id="field-crm-preparation" tabIndex={-1} className="ui-panel bg-[var(--ui-surface)] border border-[var(--ui-border)] rounded-xl p-3.5 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="text-xs font-bold text-white block">Activity &amp; manual review</span>
            <p className="text-[11px] text-slate-300 mt-0.5">
              Review: <strong className={crmReviewed ? "text-emerald-300" : "text-amber-200"}>{crmReviewed ? "Confirmed" : "Pending"}</strong>
              {sentEvent ? ` · Submission logged: ${sentEvent.occurredOn}` : " · No submission logged in CRM"}
              {` · ${openActionsCount} ${openActionsCount === 1 ? "open action" : "open actions"}`}
            </p>
          </div>
          {onOpenCrmAction && (
            <button type="button" onClick={onOpenCrmAction} className="ui-button ui-button--secondary text-xs">
              Log submission / review
            </button>
          )}
        </div>
      </div>

      <fieldset className="grid grid-cols-1 gap-3 xl:grid-cols-3">
        <legend className="text-xs font-bold text-[#8db2d6] mb-1">Job posting details (confirmed data only)</legend>
        {([
          ["jobPostingUrl", "Job posting URL", "url"],
          ["jobPostingId", "Job posting ID", "text"],
          ["applicationDeadline", "Application deadline", "date"],
        ] as const).map(([field, label, type]) => (
          <div key={field}>
            <label htmlFor={`${fieldId}-offer-${field}`} className="text-xs text-slate-300 block mb-1">{label}</label>
            <input
              id={`${fieldId}-offer-${field}`}
              type={type}
              value={app[field] ?? ""}
              onChange={(e) => {
                const value = e.target.value.trim();
                const next = { ...app };
                // Empty means unknown: the field is removed rather than stored as "".
                if (value) next[field] = e.target.value; else delete next[field];
                setApp(next);
              }}
              className="min-w-0 w-full px-3 py-2 rounded-xl bg-[var(--ui-inset)] border border-[var(--ui-border)] text-white text-xs"
            />
          </div>
        ))}
      </fieldset>

      <div>
        <label htmlFor={`${fieldId}-1`} className="text-xs font-bold text-[#8db2d6] block mb-1">Application status</label>
        <select id={`${fieldId}-1`}
          value={app.status}
          onChange={(e) => {
            const nextStatus = e.target.value as Application["status"];
            setApp({ ...app, status: nextStatus });
            if (["applied", "interviewing", "offered"].includes(nextStatus)) {
              onTriggerAppliedCrm?.(nextStatus);
            }
          }}
          className="min-w-0 w-full px-3 py-2 rounded-xl bg-[var(--ui-inset)] border border-[var(--ui-border)] text-white text-xs cursor-pointer focus:border-[#6d8ead]"
        >
          <option value="draft">Draft</option>
          <option value="reviewed">Reviewed</option>
          <option value="exported">Exported</option>
          <option value="applied">Applied</option>
          <option value="interviewing">Interviewing</option>
          <option value="offered">Offer received</option>
          <option value="rejected">Rejected</option>
          <option value="archived">Archived</option>
        </select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor={`${fieldId}-2`} className="text-xs font-bold text-[#8db2d6] block mb-1">Interview date / reference (free text)</label>
          <input id={`${fieldId}-2`}
            type="text"
            placeholder="Date and time, if scheduled"
            value={app.interviewDate || ""}
            onChange={(e) => setApp({ ...app, interviewDate: e.target.value })}
            className="min-w-0 w-full px-3 py-2 rounded-xl bg-[var(--ui-inset)] border border-[var(--ui-border)] text-white text-xs focus:border-[#6d8ead]"
          />
        </div>
        <div>
          <label htmlFor={`${fieldId}-3`} className="text-xs font-bold text-[#8db2d6] block mb-1">Salary or offer details</label>
          <input id={`${fieldId}-3`}
            type="text"
            placeholder="Disclosed range or offer"
            value={app.salaryOffer || ""}
            onChange={(e) => setApp({ ...app, salaryOffer: e.target.value })}
            className="min-w-0 w-full px-3 py-2 rounded-xl bg-[var(--ui-inset)] border border-[var(--ui-border)] text-white text-xs focus:border-[#6d8ead]"
          />
        </div>
      </div>

      <div>
        <label htmlFor={`${fieldId}-4`} className="text-xs font-bold text-[#8db2d6] block mb-1">
          Recruiter / hiring contact
        </label>
        <input id={`${fieldId}-4`}
          type="text"
          placeholder="Name, email, or profile link"
          value={app.recruiterContact || ""}
          onChange={(e) => setApp({ ...app, recruiterContact: e.target.value })}
          className="min-w-0 w-full px-3 py-2 rounded-xl bg-[var(--ui-inset)] border border-[var(--ui-border)] text-white text-xs focus:border-[#6d8ead]"
        />
      </div>

      <div>
        <label htmlFor={`${fieldId}-5`} className="text-xs font-bold text-[#8db2d6] block mb-1">Notes &amp; call log</label>
        <textarea id={`${fieldId}-5`}
          rows={6}
          placeholder="Call notes, next steps, or questions to prepare"
          value={app.notes || ""}
          onChange={(e) => setApp({ ...app, notes: e.target.value })}
          className="min-w-0 w-full px-3 py-2 rounded-xl bg-[var(--ui-inset)] border border-[var(--ui-border)] text-white text-xs focus:border-[#6d8ead] leading-relaxed resize-y"
        />
      </div>

      <div className="border-t border-[var(--ui-border)] pt-4 mt-2 space-y-4">
        <div>
          <span className="text-xs font-bold text-[#8db2d6] block mb-1.5">
            Direct LinkedIn outreach (Hiring Manager &amp; Recruiting)
          </span>
          <p className="mb-2.5 text-xs text-slate-400">
            Customize these optional messages if you follow up directly after applying.
          </p>
          <div className="flex flex-wrap gap-2 mb-3">
            {([
              { label: "Find Recruiter / TA on LinkedIn", q: `${app.company} recruiter OR "talent acquisition"` },
              { label: "Find Hiring Manager", q: `${app.company} "${app.roleTitle}"` },
            ]).map((link) => (
              <a
                key={link.label}
                href={`https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(link.q)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="ui-button ui-button--secondary text-xs text-blue-300 hover:text-white"
              >
                {link.label} ↗
              </a>
            ))}
          </div>

          <div className="space-y-2.5 mb-4">
            {outreachRows.map((row) => (
              <div key={row.field} className="ui-inset bg-[var(--ui-inset)] border border-[var(--ui-border)] rounded-xl p-3 space-y-1.5">
                <div className="flex flex-wrap gap-2 justify-between items-center">
                  <label htmlFor={`${fieldId}-${row.field}`} className="text-xs font-bold text-emerald-300">{row.title}</label>
                  <CopyTextButton
                    label="Copy message"
                    successMessage="Outreach message copied."
                    getText={() => row.maxLen ? row.value.slice(0, row.maxLen) : row.value}
                    onNotify={onNotify}
                    className="ui-button ui-button--secondary text-xs"
                  />
                </div>
                <textarea
                  id={`${fieldId}-${row.field}`}
                  rows={row.maxLen ? 2 : 4}
                  maxLength={row.maxLen}
                  value={row.value}
                  onChange={(e) =>
                    setApp((prev) =>
                      prev
                        ? {
                            ...prev,
                            outreachMessages: {
                              ...(prev.outreachMessages || {}),
                              [row.field]: e.target.value,
                            },
                          }
                        : prev
                    )
                  }
                  className="min-w-0 w-full px-2.5 py-1.5 rounded bg-[var(--ui-surface)] border border-[var(--ui-border)] text-slate-200 text-xs leading-relaxed"
                />
              </div>
            ))}
          </div>
        </div>

        <span className="text-xs font-bold text-[#8db2d6] block mb-2">
          Follow-up email drafts
        </span>
        <p className="mb-3 text-xs text-slate-400">Review each draft and confirm your submission or conversation before copying. This app does not send emails.</p>
        <div className="space-y-2">
          {emailTemplates.map((tpl, i) => (
            <div key={tpl.key} className="ui-inset bg-[var(--ui-inset)] border border-[var(--ui-border)] rounded-xl p-3 space-y-2">
              <div className="flex flex-wrap gap-3 justify-between items-center">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold text-white">{tpl.title}</span>
                  {tpl.recommended && <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">Suggested</span>}
                </div>
                <CopyTextButton
                  label="Copy"
                  disabled={reviewedTemplates[i] !== `${tpl.subject}\n${tpl.body}`}
                  successMessage="Reviewed draft copied."
                  getText={() => `Subject: ${tpl.subject}\n\n${tpl.body}`}
                  onNotify={onNotify}
                  className="ui-button ui-button--secondary text-xs disabled:text-slate-600"
                />
              </div>
              <p className="text-xs text-slate-400 break-words font-mono">Subject: {tpl.subject}</p>
              <pre className="whitespace-pre-wrap [overflow-wrap:anywhere] text-xs leading-relaxed text-slate-300 font-sans">{tpl.body}</pre>
              <label htmlFor={`${fieldId}-6-${i}`} className="flex items-center gap-2 text-xs text-slate-300"><input id={`${fieldId}-6-${i}`} type="checkbox" checked={reviewedTemplates[i] === `${tpl.subject}\n${tpl.body}`} onChange={(event) => setReviewedTemplates((current) => ({ ...current, [i]: event.target.checked ? `${tpl.subject}\n${tpl.body}` : "" }))} />{tpl.reviewLabel || "I have sent this application and reviewed the draft."}</label>
            </div>
          ))}
        </div>
      </div>

      <SaveSectionButton label="Save tracking" saving={saving} onSave={onSave} />
    </div>
  );
}
