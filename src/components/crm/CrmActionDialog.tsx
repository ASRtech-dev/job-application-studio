"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ApplicationSchema, type Application } from "@/lib/schemas";
import { ApplicationCrmCommandSchema, type CrmContact, type CrmDeliveryOption } from "@/lib/crmSchemas";
import { collectCrmCommandIds, crmApplicationScope, crmCloseDecision, crmContentHash, getCrmOperationRegistry, guardCrmSubmission, sendCrmCommand, type CrmSubmissionGuard } from "@/lib/crmPendingOperations";
import { getLocalCrmDate } from "@/lib/crmView";
import { getAppTimeZone } from "@/lib/timeZone";
import { useDialogFocus } from "@/lib/useDialogFocus";

export const CRM_CONTROL_CLASS = "ui-inset w-full min-w-0 rounded-lg border border-slate-600 px-3 py-2 text-sm text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-300";
const buttonClass = "ui-button ui-button--secondary";

function addDaysIso(baseIso: string, offsetDays: number): string {
  const date = new Date(`${baseIso}T12:00:00Z`);
  if (!Number.isFinite(date.getTime())) return baseIso;
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

/** Shared dialog frame; callbacks may change while typing without resetting focus. */
export function CrmDialogFrame({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(dialogRef, true, onClose);
  useEffect(() => {
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
    };
  }, []);
  return (
    <div className="ui-controls fixed inset-0 z-[80] flex items-center justify-center bg-black/75 p-3 sm:p-4">
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} className="ui-panel max-h-[92vh] w-full min-w-0 max-w-xl overflow-y-auto rounded-xl p-4 text-slate-100 sm:p-5">
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 id={titleId} className="text-lg font-semibold">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close dialog" className={buttonClass}>Close</button>
        </div>
        {children}
      </div>
    </div>
  );
}

const actionLabels = {
  register_application: "Log sent application",
  record_contact: "Log completed outreach / contact",
  record_response: "Log received response",
  schedule_action: "Schedule next action",
  complete_action: "Complete an action",
  reschedule_action: "Reschedule an action",
  cancel_action: "Cancel an action",
  schedule_interview: "Schedule interview",
  set_preparation: "Document review status",
  set_priority: "Change priority",
  void_event: "Void a manual log entry",
} as const;
type ActionType = keyof typeof actionLabels;

const historyEventLabels: Record<string, string> = {
  application_sent: "Application sent",
  contact_recorded: "Contact recorded",
  response_recorded: "Response received",
  interview_scheduled: "Interview scheduled",
  action_scheduled: "Action scheduled",
  action_completed: "Action completed",
  action_rescheduled: "Action rescheduled",
  action_cancelled: "Action cancelled",
  event_voided: "Entry voided",
  preparation_updated: "Review updated",
  priority_changed: "Priority changed",
};

function formatExportedAt(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: getAppTimeZone(),
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

/** Shows which documents a send used, without reconstructing unknown deliveries. */
export function CrmDeliveryNote({ deliveryId, deliveries }: { deliveryId?: string; deliveries?: CrmDeliveryOption[] }) {
  if (!deliveryId) return <>Sent documents: unknown</>;
  const match = deliveries?.find((item) => item.id === deliveryId);
  return <>Linked export: {match ? `${match.label} · ${formatExportedAt(match.exportedAt)}` : deliveryId}</>;
}

type Fields = { fields: Record<string, unknown> } | { error: string };

export function CrmActionDialog({ applicationId, onClose, onSaved, contacts = [], initialEventId, initialActionType, initialDeliveryId, deliveries }: {
  applicationId: string; onClose: () => void; onSaved: (updatedApp?: Application) => void; contacts?: CrmContact[]; initialEventId?: string;
  initialActionType?: ActionType;
  initialDeliveryId?: string;
  /** Immutable exported deliveries of this application (T03). Empty/undefined: sent documents stay unknown. */
  deliveries?: CrmDeliveryOption[];
}) {
  const [application, setApplication] = useState<Application | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [conflict, setConflict] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [closeWarning, setCloseWarning] = useState(false);
  const [guard, setGuard] = useState<CrmSubmissionGuard["kind"] | null>(null);
  const [distinctHash, setDistinctHash] = useState<string | null>(null);
  const [confirmedHashes, setConfirmedHashes] = useState<ReadonlySet<string>>(() => new Set());
  const [reloadKey, setReloadKey] = useState(0);
  const [type, setType] = useState<ActionType>(initialEventId ? "void_event" : (initialActionType || "register_application"));
  const [eventId, setEventId] = useState(initialEventId || "");
  const [day, setDay] = useState(getLocalCrmDate);
  const [note, setNote] = useState("");
  const [title, setTitle] = useState("");
  const [actionKind, setActionKind] = useState<"follow_up" | "contact" | "interview_prep">("follow_up");
  const [contactId, setContactId] = useState("");
  const [actionId, setActionId] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [reviewed, setReviewed] = useState(false);
  const [priority, setPriority] = useState<"normal" | "high" | "paused">("normal");
  const [deliveryId, setDeliveryId] = useState(initialDeliveryId || "");
  const [scheduleFollowUpOnSend, setScheduleFollowUpOnSend] = useState(false);
  const [followUpDate, setFollowUpDate] = useState(() => addDaysIso(getLocalCrmDate(), 4));
  const loadedId = useRef<string | null>(null);
  /** False once this dialog is closed: a late response must not touch it or its parent. */
  const attached = useRef(true);
  /** Parents that reuse this instance for another application must not receive the old result. */
  const currentApplication = useRef(applicationId);
  const formId = useId();
  const scope = crmApplicationScope(applicationId);
  useEffect(() => {
    attached.current = true;
    return () => { attached.current = false; };
  }, []);
  useEffect(() => { currentApplication.current = applicationId; }, [applicationId]);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      try {
        const response = await fetch(`/api/applications/${encodeURIComponent(applicationId)}`, { signal: controller.signal });
        if (!response.ok) throw new Error(response.status === 404 ? "This application is no longer available." : "Could not load the application. You can try again.");
        const parsed = ApplicationSchema.safeParse(await response.json());
        if (!parsed.success) throw new Error("Could not read this application record. Retry before logging changes.");
        if (controller.signal.aborted) return;
        setApplication(parsed.data);
        if (loadedId.current !== applicationId) {
          loadedId.current = applicationId;
          setReviewed(parsed.data.crm?.preparation?.reviewed ?? false);
          setPriority(parsed.data.crm?.priority ?? "normal");
          const hasSend = Boolean(parsed.data.crm?.events?.some((ev) => ev.type === "application_sent" && !ev.voidedAt));
          if (!initialEventId && !initialActionType && hasSend) {
            setType("schedule_action");
          }
        }
        // Uncertain earlier attempts that the server history contains were committed.
        const confirmed = getCrmOperationRegistry().reconcile(collectCrmCommandIds([parsed.data.crm?.events])).filter((item) => item.scope === crmApplicationScope(applicationId));
        if (confirmed.length) {
          setConfirmedHashes((current) => new Set([...current, ...confirmed.map((item) => item.contentHash)]));
          setNotice("An earlier entry with an uncertain status was saved on the server. No need to submit it again.");
        }
        setError("");
        setConflict(false);
      } catch (failure) { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "Could not load the application."); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }
    void load();
    return () => controller.abort();
  }, [applicationId, reloadKey, initialEventId, initialActionType]);
  const openActions = application?.crm?.actions.filter((action) => action.status === "open") || [];
  const manualEvents = application?.crm?.events.filter((event) => !event.voidedAt && ["application_sent", "contact_recorded", "response_recorded", "interview_scheduled"].includes(event.type)) || [];
  const currentSend = application?.crm?.events.find((event) => event.type === "application_sent" && !event.voidedAt);
  const deliveryChoices = deliveries ?? [];
  const selectedDelivery = deliveryChoices.find((item) => item.id === deliveryId);
  const selectedAction = openActions.find((action) => action.id === actionId);
  const appTimeZone = getAppTimeZone();
  const browserZone = Intl.DateTimeFormat().resolvedOptions().timeZone || appTimeZone;
  const interviewDate = startsAt ? new Date(startsAt) : null;
  const validInterview = interviewDate && Number.isFinite(interviewDate.getTime());
  const interviewPreview = validInterview
    ? new Intl.DateTimeFormat("en-US", { timeZone: appTimeZone, dateStyle: "medium", timeStyle: "short" }).format(interviewDate)
    : "";
  const dated = ["register_application", "record_contact", "record_response", "schedule_action", "reschedule_action"].includes(type);

  function buildFields(): Fields {
    if (type === "register_application") return { fields: { sentOn: day, ...(selectedDelivery ? { deliveryId: selectedDelivery.id } : {}) } };
    if (type === "record_contact") return { fields: { occurredOn: day, ...(contactId ? { contactId } : {}), ...(note.trim() ? { note: note.trim() } : {}) } };
    if (type === "record_response") return { fields: { occurredOn: day, ...(note.trim() ? { note: note.trim() } : {}) } };
    if (type === "schedule_action") return { fields: { title: title.trim(), dueOn: day, kind: actionKind, ...(contactId ? { contactId } : {}), ...(note.trim() ? { note: note.trim() } : {}) } };
    if (type === "complete_action") return { fields: { actionId } };
    if (type === "reschedule_action") {
      if (selectedAction && selectedAction.dueOn === day) return { error: "This action is already scheduled for that date. Choose a different date to reschedule." };
      return { fields: { actionId, dueOn: day, ...(note.trim() ? { note: note.trim() } : {}) } };
    }
    if (type === "cancel_action") return { fields: { actionId, ...(note.trim() ? { note: note.trim() } : {}) } };
    if (type === "void_event") return { fields: { eventId, note: note.trim() } };
    if (type === "schedule_interview") {
      if (!validInterview) return { error: "Enter a valid date and time for the interview." };
      const expected = startsAt.replace("T", " ");
      const actual = `${interviewDate.getFullYear()}-${String(interviewDate.getMonth() + 1).padStart(2, "0")}-${String(interviewDate.getDate()).padStart(2, "0")} ${String(interviewDate.getHours()).padStart(2, "0")}:${String(interviewDate.getMinutes()).padStart(2, "0")}`;
      if (expected !== actual) return { error: "That time does not exist in your local timezone. Choose another time." };
      return { fields: { startsAt: interviewDate.toISOString(), ...(note.trim() ? { note: note.trim() } : {}) } };
    }
    if (type === "set_preparation") return { fields: { reviewed } };
    return { fields: { value: priority } };
  }
  const built = buildFields();
  const contentHash = "fields" in built ? crmContentHash(built.fields) : null;
  const retriesUncertain = contentHash !== null && distinctHash !== contentHash && getCrmOperationRegistry().unresolved(scope, type).some((item) => item.contentHash === contentHash);

  function requestClose() {
    if (crmCloseDecision({ saving, confirmed: false }) === "confirm") { setCloseWarning(true); return; }
    onClose();
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!application || loading || saving) return;
    if ("error" in built) { setError(built.error); return; }
    const registry = getCrmOperationRegistry();
    const draft = registry.prepare(scope, type, built.fields, { forceNew: distinctHash !== null && distinctHash === contentHash });
    const check = guardCrmSubmission(draft, { confirmedHashes, distinctHash });
    if (check.kind !== "proceed") { setGuard(check.kind); return; }
    const parsed = ApplicationCrmCommandSchema.safeParse({ revision: application.revision ?? 0, commandId: draft.commandId, type, ...built.fields });
    if (!parsed.success) { setError("Please check the dates and fields before saving."); return; }
    setSaving(true);
    setError("");
    setUncertain(false);
    setNotice("");
    setGuard(null);
    const result = await sendCrmCommand(registry, draft, { endpoint: `/api/applications/${encodeURIComponent(applicationId)}/crm`, body: parsed.data, isAttached: () => attached.current && currentApplication.current === applicationId });
    // A closed dialog stays closed: the registry keeps the outcome and notifies its listeners.
    if (!result.attached) return;
    setSaving(false);
    setCloseWarning(false);
    setDistinctHash(null);
    if (result.outcome === "saved") {
      const savedParsed = ApplicationSchema.safeParse(result.json);
      let latestApp = savedParsed.success ? savedParsed.data : undefined;
      if (type === "register_application" && scheduleFollowUpOnSend && result.json && typeof result.json === "object") {
        const nextRev = Number((result.json as { revision?: number }).revision ?? (application.revision ?? 0) + 1);
        const targetFollowDate = /^\d{4}-\d{2}-\d{2}$/.test(followUpDate) ? followUpDate : addDaysIso(day, 4);
        const followFields = { title: `Follow-up · ${application.company}`, dueOn: targetFollowDate, kind: "follow_up" as const };
        const followDraft = registry.prepare(scope, "schedule_action", followFields);
        const followParsed = ApplicationCrmCommandSchema.safeParse({ revision: nextRev, commandId: followDraft.commandId, type: "schedule_action", ...followFields });
        if (followParsed.success) {
          const followResult = await sendCrmCommand(registry, followDraft, {
            endpoint: `/api/applications/${encodeURIComponent(applicationId)}/crm`,
            body: followParsed.data,
            isAttached: () => attached.current && currentApplication.current === applicationId,
          });
          if (!followResult.attached) return;
          if (followResult.outcome === "saved") {
            const followSavedParsed = ApplicationSchema.safeParse(followResult.json);
            if (followSavedParsed.success) latestApp = followSavedParsed.data;
          } else {
            if (latestApp) setApplication(latestApp);
            onSaved(latestApp);
            setError("The submission was logged, but scheduling the follow-up reminder failed. You can add it now under 'Schedule next action'.");
            return;
          }
        }
      }
      onSaved(latestApp);
      onClose();
      return;
    }
    if (result.outcome === "rejected" && result.status === 409) { setConflict(true); setError("This application changed in another tab or the entry already exists. Your form was preserved — reload the latest revision and verify before retrying."); return; }
    if (result.outcome === "rejected") { setError(result.status === 404 ? "The requested item was not found. Reload the latest revision before retrying." : "Could not save this action. Check the date and details."); return; }
    setUncertain(true);
    setError("Could not confirm whether the entry was saved because the server did not respond properly. Your form was preserved; retrying with the same data reuses the same command ID and will not duplicate it.");
  }

  return (
    <CrmDialogFrame title="Log application activity" onClose={requestClose}>
      {loading && <p role="status" className="mb-3 text-sm">Loading latest revision…</p>}
      {application && <p className="mb-4 text-sm text-slate-300">{application.company} · {application.roleTitle}</p>}
      {application && currentSend && <p className="mb-4 text-xs text-slate-300">Logged submission: {currentSend.occurredOn} · <CrmDeliveryNote deliveryId={currentSend.deliveryId} deliveries={deliveries} /></p>}
      {closeWarning && saving && (
        <div role="alert" className="mb-4 rounded-lg border border-amber-500/40 p-3 text-sm text-amber-100">
          <p>This entry is still saving. If you close now, the result will be tracked in the background; retrying with the same data will not create a duplicate.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" className={buttonClass} onClick={() => setCloseWarning(false)}>Keep waiting</button>
            <button type="button" className={buttonClass} onClick={onClose}>Close anyway</button>
          </div>
        </div>
      )}
      {notice && <p role="status" className="mb-4 text-sm text-emerald-300">{notice}</p>}
      {error && (
        <div role="alert" className="mb-4 rounded-lg border border-amber-500/40 p-3 text-sm text-amber-100">
          <p>{error}</p>
          {(conflict || uncertain || !application) && (
            <button type="button" className="mt-2 underline" onClick={() => setReloadKey((value) => value + 1)}>
              Reload revision without clearing form
            </button>
          )}
        </div>
      )}
      {guard && contentHash && (
        <div role="alert" className="mb-4 rounded-lg border border-amber-500/40 p-3 text-sm text-amber-100">
          <p>{guard === "already_saved" ? "This exact entry was already confirmed on the server. Saving it again will log a new activity." : "Another submission of this type is still unconfirmed. Reload the revision first to check whether it succeeded before creating another entry."}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" className={buttonClass} onClick={() => { setGuard(null); setReloadKey((value) => value + 1); }}>Check again</button>
            <button type="button" className={buttonClass} onClick={() => { setDistinctHash(contentHash); setGuard(null); }}>It is a separate activity</button>
          </div>
        </div>
      )}
      {retriesUncertain && !guard && (
        <div className="mb-4 rounded-lg border border-slate-600 p-3 text-xs text-slate-200">
          <p>An earlier attempt with these exact details could not be confirmed. Saving will retry with the same command ID to prevent duplicates.</p>
          <button type="button" className="mt-2 underline" onClick={() => setDistinctHash(contentHash)}>This is a separate activity: log it as new</button>
        </div>
      )}
      {distinctHash !== null && distinctHash === contentHash && (
        <p className="mb-4 text-xs text-amber-100">
          Will be logged as a new, distinct activity. <button type="button" className="underline" onClick={() => setDistinctHash(null)}>Undo</button>
        </p>
      )}
      <form onSubmit={submit} className="space-y-4">
        <fieldset disabled={saving} className="m-0 min-w-0 space-y-4 border-0 p-0">
          <div>
            <label htmlFor={`${formId}-type`} className="mb-1 block text-sm">Action</label>
            <select id={`${formId}-type`} value={type} onChange={(event) => { setType(event.target.value as ActionType); setGuard(null); }} className={CRM_CONTROL_CLASS}>
              {Object.entries(actionLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>
          {type === "register_application" && (
            <p className="text-xs text-slate-300">Log a submission only after you have actually submitted via the job portal or email. Saving, copying, or exporting documents does not count as sending an application.</p>
          )}
          {type === "register_application" && application && !currentSend && (
            <p className="text-xs text-amber-100">Submission date unknown. The current status does not confirm when this application was sent.</p>
          )}
          {type === "register_application" && (
            deliveryChoices.length ? (
              <div>
                <label htmlFor={`${formId}-delivery`} className="mb-1 block text-sm">Sent documents (optional)</label>
                <select id={`${formId}-delivery`} value={selectedDelivery ? deliveryId : ""} onChange={(event) => setDeliveryId(event.target.value)} className={CRM_CONTROL_CLASS}>
                  <option value="">Unknown / not selected</option>
                  {deliveryChoices.map((item) => <option key={item.id} value={item.id}>{item.label} · {formatExportedAt(item.exportedAt)}</option>)}
                </select>
                <p className="mt-1 text-xs text-slate-300">
                  {selectedDelivery ? `Files: ${selectedDelivery.files.join(", ") || "no files recorded"}` : "Select the exported packet you sent. If unsure, it will be logged with unknown documents."}
                </p>
              </div>
            ) : (
              <p className="text-xs text-slate-300">Sent documents: unknown. No exported packets are available to link; the submission will be logged without attached files.</p>
            )
          )}
          {type === "register_application" && (
            <div className="space-y-2 rounded-lg border border-[var(--ui-border)] bg-[var(--ui-inset)] p-2.5">
              <label className="flex items-start gap-2 text-xs text-slate-200 cursor-pointer">
                <input type="checkbox" checked={scheduleFollowUpOnSend} onChange={(e) => setScheduleFollowUpOnSend(e.target.checked)} className="mt-0.5" />
                Also schedule a manual follow-up reminder
              </label>
              {scheduleFollowUpOnSend && (
                <div className="pl-5 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {[4, 5, 7].map((offset) => {
                      const target = addDaysIso(day, offset);
                      return (
                        <button key={offset} type="button" onClick={() => setFollowUpDate(target)} className="px-2 py-0.5 rounded border border-slate-600 text-[11px] text-blue-200 hover:bg-slate-800">
                          +{offset} days ({target})
                        </button>
                      );
                    })}
                  </div>
                  <input type="date" aria-label="Follow-up reminder date" value={followUpDate} onChange={(e) => setFollowUpDate(e.target.value)} className={CRM_CONTROL_CLASS} />
                </div>
              )}
            </div>
          )}
          {type === "void_event" && (
            <>
              <p className="text-xs text-slate-300">The entry remains visible in history as voided and stops counting toward activity. Application status does not revert automatically. You can log the corrected entry afterward.</p>
              <label className="block text-sm">
                Entry to void
                <select value={eventId} onChange={(event) => setEventId(event.target.value)} required className={`${CRM_CONTROL_CLASS} mt-1`}>
                  <option value="">Select an entry</option>
                  {manualEvents.map((event) => (
                    <option key={event.id} value={event.id}>
                      {event.occurredOn} · {event.type === "application_sent" ? "Application sent" : event.type === "contact_recorded" ? "Contact recorded" : event.type === "response_recorded" ? "Response received" : "Interview"}{event.note ? ` · ${event.note}` : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                Reason for voiding
                <textarea value={note} onChange={(event) => setNote(event.target.value)} required maxLength={10000} rows={3} className={`${CRM_CONTROL_CLASS} mt-1`} />
              </label>
            </>
          )}
          {["complete_action", "reschedule_action", "cancel_action"].includes(type) && (
            <div>
              <label htmlFor={`${formId}-action`} className="mb-1 block text-sm">Open action</label>
              <select id={`${formId}-action`} value={actionId} onChange={(event) => setActionId(event.target.value)} required className={CRM_CONTROL_CLASS}>
                <option value="">Select an action</option>
                {openActions.map((action) => <option key={action.id} value={action.id}>{action.title} · {action.dueOn}</option>)}
              </select>
              {!openActions.length && <p className="mt-1 text-xs text-slate-400">This application has no open scheduled actions.</p>}
            </div>
          )}
          {type === "reschedule_action" && <p className="text-xs text-slate-300">Rescheduling updates only the due date. The action is not counted as completed and the change stays in history.</p>}
          {type === "cancel_action" && <p className="text-xs text-slate-300">Cancelling does not mark the action as completed: it removes it from pending tasks and keeps it in history as cancelled.</p>}
          {dated && (
            <div>
              <label htmlFor={`${formId}-day`} className="mb-1 block text-sm">
                {type === "schedule_action" ? "Next action due date" : type === "reschedule_action" ? "New action date" : "Actual activity date"}
              </label>
              <input id={`${formId}-day`} type="date" value={day} onChange={(event) => setDay(event.target.value)} required className={CRM_CONTROL_CLASS} />
              {type === "schedule_action" && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {[2, 4, 7, 10].map((offset) => {
                    const iso = addDaysIso(getLocalCrmDate(), offset);
                    return (
                      <button key={offset} type="button" onClick={() => setDay(iso)} className="px-2 py-0.5 rounded border border-slate-600 text-[11px] text-blue-200 hover:bg-slate-800">
                        +{offset} days ({iso})
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
          {type === "schedule_action" && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor={`${formId}-kind`} className="mb-1 block text-sm">Type</label>
                  <select id={`${formId}-kind`} value={actionKind} onChange={(e) => setActionKind(e.target.value as "follow_up" | "contact" | "interview_prep")} className={CRM_CONTROL_CLASS}>
                    <option value="follow_up">Follow-up</option>
                    <option value="contact">Outreach / Contact</option>
                    <option value="interview_prep">Interview prep</option>
                  </select>
                </div>
                {contacts.length > 0 && (
                  <div>
                    <label htmlFor={`${formId}-action-contact`} className="mb-1 block text-sm">Contact (optional)</label>
                    <select id={`${formId}-action-contact`} value={contactId} onChange={(e) => setContactId(e.target.value)} className={CRM_CONTROL_CLASS}>
                      <option value="">No contact linked</option>
                      {contacts.map((c) => <option key={c.id} value={c.id}>{c.name}{c.agency ? ` · ${c.agency}` : ""}</option>)}
                    </select>
                  </div>
                )}
              </div>
              <div>
                <label htmlFor={`${formId}-title`} className="mb-1 block text-sm">What will you do?</label>
                <input id={`${formId}-title`} value={title} onChange={(event) => setTitle(event.target.value)} required maxLength={250} placeholder="e.g., Check in with hiring manager" className={CRM_CONTROL_CLASS} />
              </div>
            </>
          )}
          {type === "record_contact" && contacts.length > 0 && (
            <div>
              <label htmlFor={`${formId}-contact`} className="mb-1 block text-sm">Person or agency (optional)</label>
              <select id={`${formId}-contact`} value={contactId} onChange={(event) => setContactId(event.target.value)} className={CRM_CONTROL_CLASS}>
                <option value="">No saved contact</option>
                {contacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.name}{contact.agency ? ` · ${contact.agency}` : ""}</option>)}
              </select>
            </div>
          )}
          {type === "schedule_interview" && (
            <div>
              <label htmlFor={`${formId}-interview`} className="mb-1 block text-sm">Interview date & time · {browserZone}</label>
              <input id={`${formId}-interview`} type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} required className={CRM_CONTROL_CLASS} />
              <p className="mt-2 text-xs text-slate-300">
                Input uses your browser timezone. {interviewPreview ? `In ${appTimeZone}: ${interviewPreview}. UTC timestamp: ${interviewDate!.toISOString()}.` : `Verify the time in ${appTimeZone} before saving.`}
              </p>
            </div>
          )}
          {type === "set_preparation" && (
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" checked={reviewed} onChange={(event) => setReviewed(event.target.checked)} className="mt-1" />
              I have reviewed the job requirements, CV, and cover letter for this application. This checkbox does not certify eligibility or log a submission.
            </label>
          )}
          {type === "set_priority" && (
            <div>
              <label htmlFor={`${formId}-priority`} className="mb-1 block text-sm">Manual priority</label>
              <select id={`${formId}-priority`} value={priority} onChange={(event) => setPriority(event.target.value as typeof priority)} className={CRM_CONTROL_CLASS}>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="paused">Paused</option>
              </select>
            </div>
          )}
          {["record_contact", "record_response", "schedule_action", "schedule_interview"].includes(type) && (
            <div>
              <label htmlFor={`${formId}-note`} className="mb-1 block text-sm">Note (optional)</label>
              <textarea id={`${formId}-note`} value={note} onChange={(event) => setNote(event.target.value)} maxLength={10000} rows={3} className={CRM_CONTROL_CLASS} />
            </div>
          )}
          {["reschedule_action", "cancel_action"].includes(type) && (
            <div>
              <label htmlFor={`${formId}-reason`} className="mb-1 block text-sm">Reason (optional)</label>
              <textarea id={`${formId}-reason`} value={note} onChange={(event) => setNote(event.target.value)} maxLength={10000} rows={2} className={CRM_CONTROL_CLASS} />
            </div>
          )}
        </fieldset>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={requestClose} className={buttonClass}>Cancel</button>
          <button type="submit" disabled={!application || loading || saving || conflict} className="ui-button ui-button--primary">
            {saving ? "Saving…" : "Save entry"}
          </button>
        </div>
      </form>
      {application && (application.crm?.events?.length || 0) > 0 && (
        <details className="mt-4 border-t border-[var(--ui-border)] pt-3 text-xs">
          <summary className="cursor-pointer font-semibold text-slate-300">Manual activity log ({application.crm!.events.length})</summary>
          <ul className="mt-2 space-y-1.5 max-h-48 overflow-y-auto">
            {[...application.crm!.events].reverse().map((ev) => {
              const voidEntry = ev.voidedAt ? application.crm!.events.find((other) => other.type === "event_voided" && other.relatedEventId === ev.id) : undefined;
              return (
                <li key={ev.id} className="rounded border border-slate-700/70 bg-[var(--ui-inset)] p-2 text-slate-300">
                  <span className="font-semibold text-white">{ev.occurredOn} · {historyEventLabels[ev.type] || ev.type}{ev.voidedAt ? " (Voided)" : ""}</span>
                  {ev.note && <p className="text-slate-400 mt-0.5">{ev.note}</p>}
                  {ev.voidedAt && <p className="text-amber-300 mt-0.5">Voided: {ev.voidedAt.slice(0, 10)}{voidEntry?.note ? ` · Reason: ${voidEntry.note}` : ""}</p>}
                </li>
              );
            })}
          </ul>
        </details>
      )}
    </CrmDialogFrame>
  );
}
