"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { z } from "zod";
import { ApplicationCrmCommandSchema, ApplicationCrmSchema, CrmStatusSchema, CrmStoreSchema, GlobalCrmCommandSchema, type CrmAction, type CrmContact, type CrmDeliveryOption } from "@/lib/crmSchemas";
import { getLocalCrmDate, getCrmDaySummary, getTodayQueue, type CrmViewData, type CrmQueuedAction } from "@/lib/crmView";
import { getAppTimeZone } from "@/lib/timeZone";
import { collectCrmCommandIds, createCrmFormGate, crmApplicationScope, crmCloseDecision, crmContentHash, CRM_GLOBAL_SCOPE, getCrmOperationRegistry, guardCrmSubmission, sendCrmCommand, type CrmSubmissionGuard } from "@/lib/crmPendingOperations";
import { deliveriesToOptions } from "@/lib/deliveryOptions";
import { CrmActionDialog, CrmDeliveryNote, CrmDialogFrame, CRM_CONTROL_CLASS } from "./CrmActionDialog";

const SnapshotSchema = CrmStoreSchema.extend({ applications: z.array(z.object({
  id: z.string(), company: z.string(), roleTitle: z.string(), status: CrmStatusSchema,
  revision: z.number().int().nonnegative().default(0), crm: ApplicationCrmSchema.optional(),
  roleClassificationType: z.string().optional(),
  fitScore: z.number().nullable().optional(),
  eligibilityStatus: z.enum(["meets", "uncertain", "gaps"]).optional(),
  dateModified: z.string().optional(),
})) });
const buttonClass = "ui-button ui-button--secondary";
type FormMode = "goals" | "contact" | "contact_event" | "action" | "void_event" | "reschedule_action" | "cancel_action";
const manualLabels: Record<string, string> = {
  application_sent: "Application sent",
  contact_recorded: "Contact recorded",
  response_recorded: "Response received",
  interview_scheduled: "Interview scheduled",
};
/** Audit entries shown in the history; they cannot be voided and never count as done. */
const auditLabels: Record<string, string> = {
  action_rescheduled: "Action rescheduled",
  action_cancelled: "Action cancelled",
};

function ActionList({
  items,
  heading,
  isOverdue = false,
  disabled,
  onOpenApplication,
  onReschedule,
  onCancel,
  onComplete,
}: {
  items: CrmQueuedAction[];
  heading: string;
  isOverdue?: boolean;
  disabled: boolean;
  onOpenApplication: (id: string) => void;
  onReschedule: (item: CrmQueuedAction) => void;
  onCancel: (item: CrmQueuedAction) => void;
  onComplete: (item: CrmQueuedAction) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-300">{heading}</h3>
      <ul className="space-y-1.5">
        {items.map((item) => (
          <li
            key={`${item.application?.id || "global"}-${item.action.id}`}
            className={`flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm ${
              isOverdue ? "border-amber-500/35 bg-amber-500/5" : "border-slate-800/80 bg-[#0b1222]"
            }`}
          >
            <div className="min-w-0 flex-1 basis-40">
              <p className="break-words text-[13px] font-medium text-white">{item.action.title}</p>
              <p className="break-words text-xs text-slate-400">
                {item.action.dueOn}
                {item.application ? ` · ${item.application.company}` : ""}
                {item.contact ? ` · ${item.contact.name}` : ""}
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {item.application && (
                <button type="button" onClick={() => onOpenApplication(item.application!.id)} className={buttonClass}>
                  Activity
                </button>
              )}
              <button type="button" onClick={() => onReschedule(item)} disabled={disabled} className={buttonClass}>
                Reschedule
              </button>
              <button type="button" onClick={() => onCancel(item)} disabled={disabled} className={buttonClass}>
                Cancel action
              </button>
              <button type="button" onClick={() => onComplete(item)} disabled={disabled} className="ui-button ui-button--primary">
                Complete
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function CrmDashboard({ onApplicationsChanged, refreshToken, deliveriesByApplication, onContactsLoaded }: {
  onApplicationsChanged: () => void; refreshToken?: string;
  /** Optional T03 deliveries per application id, passed to the send dialog. */
  deliveriesByApplication?: Record<string, CrmDeliveryOption[]>;
  onContactsLoaded?: (contacts: CrmContact[]) => void;
}) {
  const [data, setData] = useState<CrmViewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [today, setToday] = useState(getLocalCrmDate);
  const [message, setMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const [selectedApplication, setSelectedApplication] = useState("");
  const [applicationDialog, setApplicationDialog] = useState<string | null>(null);
  const [initialEventId, setInitialEventId] = useState<string | undefined>();
  const [initialAppActionType, setInitialAppActionType] = useState<"register_application" | "schedule_action" | undefined>();
  const [fetchedDeliveriesByApp, setFetchedDeliveriesByApp] = useState<Record<string, CrmDeliveryOption[]>>({});
  const [eventId, setEventId] = useState("");
  const [mode, setMode] = useState<FormMode | null>(null);
  const [saving, setSaving] = useState(false);
  const inFlight = useRef(false);
  /** Saving state of the open form only; a closed form keeps its request in the operation registry. */
  const [formSaving, setFormSaving] = useState(false);
  const formInFlight = useRef(false);
  /** Identifies the open form; a response for a closed or replaced form never touches the new one. */
  const gate = useRef(createCrmFormGate());
  const formToken = useRef(0);
  const [formError, setFormError] = useState("");
  const [conflict, setConflict] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [closeWarning, setCloseWarning] = useState(false);
  const [guard, setGuard] = useState<CrmSubmissionGuard["kind"] | null>(null);
  const [distinctHash, setDistinctHash] = useState<string | null>(null);
  const [confirmedHashes, setConfirmedHashes] = useState<ReadonlySet<string>>(() => new Set());
  const [actionTarget, setActionTarget] = useState<CrmQueuedAction | null>(null);
  const changedRef = useRef(onApplicationsChanged);
  useEffect(() => { changedRef.current = onApplicationsChanged; }, [onApplicationsChanged]);
  const contactsLoadedRef = useRef(onContactsLoaded);
  useEffect(() => { contactsLoadedRef.current = onContactsLoaded; }, [onContactsLoaded]);
  const [goalApplications, setGoalApplications] = useState(6);
  const [goalContacts, setGoalContacts] = useState(2);
  const [contact, setContact] = useState({ id: "", name: "", organization: "", agency: "", email: "", linkedin: "", notes: "" });
  const [contactId, setContactId] = useState("");
  const [relatedApplication, setRelatedApplication] = useState("");
  const [day, setDay] = useState(getLocalCrmDate);
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const formId = useId();
  const appTimeZone = getAppTimeZone();

  useEffect(() => {
    const clock = setInterval(() => setToday(getLocalCrmDate()), 60000);
    return () => clearInterval(clock);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setLoadError("");
      try {
        const response = await fetch("/api/crm", { signal: controller.signal });
        if (!response.ok) throw new Error("Could not load your schedule. The rest of the dashboard remains available.");
        const parsed = SnapshotSchema.safeParse(await response.json());
        if (!parsed.success) throw new Error("Could not read schedule data. Retry without affecting your applications.");
        if (controller.signal.aborted) return;
        setData(parsed.data);
        contactsLoadedRef.current?.(parsed.data.contacts);
        setConflict(false);
        const confirmed = getCrmOperationRegistry().reconcile(collectCrmCommandIds([parsed.data.events, ...parsed.data.applications.map((app) => app.crm?.events)]));
        if (confirmed.length) {
          setConfirmedHashes((current) => new Set([...current, ...confirmed.map((item) => item.contentHash)]));
          setMessage("An entry whose outcome was uncertain was saved on the server. No need to submit it again.");
        }
      } catch (failure) { if (!controller.signal.aborted) setLoadError(failure instanceof Error ? failure.message : "Could not load your schedule."); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }
    void load();
    return () => controller.abort();
  }, [refreshKey, refreshToken]);
  const daily = useMemo(() => data ? getCrmDaySummary(data, today) : null, [data, today]);
  const queue = useMemo(() => data ? getTodayQueue(data, today) : null, [data, today]);
  const recentEvents = useMemo(() => {
    if (!data) return [];
    const items = [...data.events.map((event) => ({ event, application: undefined as CrmViewData["applications"][number] | undefined })), ...data.applications.flatMap((application) => (application.crm?.events || []).map((event) => ({ event, application })))];
    return items.filter((item, index) => (manualLabels[item.event.type] || auditLabels[item.event.type]) && items.findIndex((other) => other.event.id === item.event.id) === index).sort((a, b) => b.event.registeredAt.localeCompare(a.event.registeredAt)).slice(0, 20);
  }, [data]);
  const actionTitles = useMemo(() => {
    const titles = new Map<string, CrmAction>();
    for (const action of data?.actions ?? []) titles.set(action.id, action);
    for (const app of data?.applications ?? []) for (const action of app.crm?.actions ?? []) titles.set(action.id, action);
    return titles;
  }, [data]);
  const refresh = () => setRefreshKey((value) => value + 1);
  // Results that arrive after their dialog was closed refresh the agenda without touching any open form.
  useEffect(() => getCrmOperationRegistry().subscribe((event) => {
    if (!event.detached) return;
    if (event.outcome === "saved") {
      setMessage("An entry submitted before closing the form was saved.");
      setRefreshKey((value) => value + 1);
      changedRef.current();
    } else if (event.outcome === "uncertain") setActionError("Could not confirm an entry submitted before closing the form. Retrying with the same data will not duplicate it.");
    else setActionError("An entry submitted before closing the form was not saved. You can submit it again.");
  }), []);
  const openApplication = (id: string, event?: string, actionType?: "register_application" | "schedule_action") => {
    setInitialEventId(event);
    setInitialAppActionType(actionType);
    setApplicationDialog(id);
    if (!deliveriesByApplication?.[id] && !fetchedDeliveriesByApp[id]) {
      fetch(`/api/applications/${encodeURIComponent(id)}/deliveries`)
        .then((res) => (res.ok ? res.json() : null))
        .then((raw) => {
          if (Array.isArray(raw)) {
            setFetchedDeliveriesByApp((prev) => ({ ...prev, [id]: deliveriesToOptions(raw) }));
          }
        })
        .catch(() => { /* optional delivery choices */ });
    }
  };
  const sentWithoutNextAction = useMemo(() => {
    if (!data) return [];
    const interviewAppIds = new Set(queue?.upcomingInterviews.map((item) => item.application?.id).filter(Boolean));
    return data.applications.filter((app) => {
      if (app.status === "rejected" || app.status === "archived" || app.crm?.priority === "paused") return false;
      const hasSend = Boolean(app.crm?.events?.some((ev) => ev.type === "application_sent" && !ev.voidedAt));
      const hasOpenAction = Boolean(app.crm?.actions?.some((act) => act.status === "open"));
      return hasSend && !hasOpenAction && !interviewAppIds.has(app.id);
    });
  }, [data, queue]);
  const unconfirmedApplied = useMemo(() => {
    if (!data) return [];
    return data.applications.filter((app) => {
      if (!["applied", "interviewing", "offered"].includes(app.status)) return false;
      return !app.crm?.events?.some((ev) => ev.type === "application_sent" && !ev.voidedAt);
    });
  }, [data]);

  function openForm(next: FormMode, existingContact?: CrmContact, target?: CrmQueuedAction) {
    formToken.current = gate.current.open();
    setFormError("");
    setConflict(false);
    setUncertain(false);
    setCloseWarning(false);
    setGuard(null);
    setDistinctHash(null);
    setActionTarget(target ?? null);
    setDay(target ? target.action.dueOn : today);
    setNote("");
    setTitle("");
    setRelatedApplication("");
    setContactId(existingContact?.id || "");
    if (next === "goals" && data) { setGoalApplications(data.goals.applications); setGoalContacts(data.goals.contacts); }
    if (next === "contact") setContact(existingContact ? { id: existingContact.id, name: existingContact.name, organization: existingContact.organization || "", agency: existingContact.agency || "", email: existingContact.email || "", linkedin: existingContact.linkedin || "", notes: existingContact.notes || "" } : { id: "", name: "", organization: "", agency: "", email: "", linkedin: "", notes: "" });
    setMode(next);
  }

  function closeForm(force = false) {
    if (!force && crmCloseDecision({ saving: formSaving, confirmed: false }) === "confirm") { setCloseWarning(true); return; }
    gate.current.close();
    // The request of a closed form continues in the operation registry; the next form starts idle.
    formInFlight.current = false;
    setFormSaving(false);
    setCloseWarning(false);
    setMode(null);
    setActionTarget(null);
  }

  const targetIsGlobal = (item: CrmQueuedAction) => !item.application || Boolean(data?.actions.some((action) => action.id === item.action.id));

  function buildCommand(): Record<string, unknown> | null {
    if (!mode) return null;
    if (mode === "goals") return { type: "update_goals", goals: { applications: goalApplications, contacts: goalContacts } };
    if (mode === "contact") return { type: "save_contact", contact: { ...(contact.id ? { id: contact.id } : {}), name: contact.name.trim(), organization: contact.organization.trim(), agency: contact.agency.trim(), email: contact.email.trim(), linkedin: contact.linkedin.trim(), notes: contact.notes.trim() } };
    if (mode === "void_event") return { type: "void_event", eventId, note: note.trim() };
    if (mode === "reschedule_action") return actionTarget ? { type: "reschedule_action", actionId: actionTarget.action.id, dueOn: day, ...(note.trim() ? { note: note.trim() } : {}) } : null;
    if (mode === "cancel_action") return actionTarget ? { type: "cancel_action", actionId: actionTarget.action.id, ...(note.trim() ? { note: note.trim() } : {}) } : null;
    return {
      type: mode === "contact_event" ? "record_contact" : "schedule_action",
      ...(mode === "contact_event" ? { occurredOn: day } : { title: title.trim(), dueOn: day }),
      ...(contactId ? { contactId } : {}), ...(relatedApplication ? { applicationId: relatedApplication } : {}), ...(note.trim() ? { note: note.trim() } : {}),
    };
  }
  const currentCommand = buildCommand();
  const applicationTarget = actionTarget && !targetIsGlobal(actionTarget) ? actionTarget.application : undefined;
  const formScope = applicationTarget ? crmApplicationScope(applicationTarget.id) : CRM_GLOBAL_SCOPE;
  const currentHash = currentCommand ? crmContentHash(currentCommand) : null;
  const retriesUncertain = currentCommand !== null && currentHash !== distinctHash && getCrmOperationRegistry().unresolved(formScope, String(currentCommand.type)).some((item) => item.contentHash === currentHash);

  async function submitGlobal(event: React.FormEvent) {
    event.preventDefault();
    if (!data || !mode || formInFlight.current || loading || !currentCommand || !currentHash) return;
    const submittedMode = mode;
    const token = formToken.current;
    if (mode === "reschedule_action" && actionTarget?.action.dueOn === day) { setFormError("This action is already scheduled for that date. Choose another date to reschedule."); return; }
    const { type, ...content } = currentCommand;
    const registry = getCrmOperationRegistry();
    const draft = registry.prepare(formScope, String(type), currentCommand, { forceNew: distinctHash !== null && distinctHash === currentHash });
    const check = guardCrmSubmission(draft, { confirmedHashes, distinctHash });
    if (check.kind !== "proceed") { setGuard(check.kind); return; }
    const parsed = applicationTarget
      ? ApplicationCrmCommandSchema.safeParse({ type, ...content, revision: applicationTarget.revision, commandId: draft.commandId })
      : GlobalCrmCommandSchema.safeParse({ type, ...content, revision: data.revision, commandId: draft.commandId });
    if (!parsed.success) { setFormError("Please check the date and form fields. If adding an email or profile URL, use a valid format."); return; }
    formInFlight.current = true;
    setFormSaving(true);
    setFormError("");
    setUncertain(false);
    setGuard(null);
    const endpoint = applicationTarget ? `/api/applications/${encodeURIComponent(applicationTarget.id)}/crm` : "/api/crm";
    try {
      const result = await sendCrmCommand(registry, draft, { endpoint, body: parsed.data, isAttached: () => gate.current.isCurrent(token) });
      // A closed or replaced form is left alone; the registry subscription refreshes the agenda.
      if (!result.attached) return;
      setDistinctHash(null);
      setCloseWarning(false);
      if (result.outcome === "rejected") {
        if (result.status === 409) { setConflict(true); setFormError("Your schedule changed in another tab or the entry already exists. Your form was preserved — reload the latest data before retrying."); }
        else setFormError(result.status === 404 ? "The requested item was not found. Reload your schedule before retrying." : "Could not save this entry. Check the date and details.");
        return;
      }
      if (result.outcome === "uncertain") { setUncertain(true); setFormError("Could not confirm whether this entry was saved. Your form was preserved; retrying reuses the same command ID and will not duplicate it."); return; }
      const snapshot = applicationTarget ? null : SnapshotSchema.safeParse(result.json);
      if (snapshot?.success) setData(snapshot.data); else refresh();
      if (applicationTarget || submittedMode === "reschedule_action" || submittedMode === "cancel_action") onApplicationsChanged();
      closeForm(true);
      setMessage(
        submittedMode === "goals"
          ? "Daily goals updated."
          : submittedMode === "contact"
            ? "Contact saved."
            : submittedMode === "contact_event"
              ? "Contact logged."
              : submittedMode === "void_event"
                ? "Entry voided. History preserved."
                : submittedMode === "reschedule_action"
                  ? "Action rescheduled. History preserved."
                  : submittedMode === "cancel_action"
                    ? "Action cancelled. Not counted as completed."
                    : "Next action saved."
      );
      setActionError("");
    } finally { if (gate.current.isCurrent(token)) { formInFlight.current = false; setFormSaving(false); } }
  }

  async function completeAction(item: CrmQueuedAction) {
    if (!data || inFlight.current) return;
    inFlight.current = true;
    setSaving(true);
    setActionError("");
    const isGlobal = data.actions.some((action) => action.id === item.action.id);
    const endpoint = !isGlobal && item.application ? `/api/applications/${encodeURIComponent(item.application.id)}/crm` : "/api/crm";
    const command = { type: "complete_action", actionId: item.action.id };
    const registry = getCrmOperationRegistry();
    const draft = registry.prepare(!isGlobal && item.application ? crmApplicationScope(item.application.id) : CRM_GLOBAL_SCOPE, command.type, command);
    try {
      const result = await sendCrmCommand(registry, draft, { endpoint, body: { ...command, revision: isGlobal ? data.revision : item.application?.revision ?? data.revision, commandId: draft.commandId } });
      if (result.outcome === "uncertain") throw new Error("Could not confirm whether the action was completed. Retrying will not duplicate it.");
      if (result.outcome === "rejected") throw new Error(result.status === 409 ? "This action changed in another tab. Reload the schedule before completing it." : "Could not complete this action. Please try again.");
      setMessage("Action marked as completed.");
      refresh();
      if (!isGlobal && item.application) onApplicationsChanged();
    } catch (failure) { setActionError(failure instanceof Error ? failure.message : "Could not complete this action."); }
    finally { inFlight.current = false; setSaving(false); }
  }

  const formTitle =
    mode === "reschedule_action"
      ? "Reschedule action"
      : mode === "cancel_action"
        ? "Cancel open action"
        : mode === "goals"
          ? "Daily goals"
          : mode === "contact"
            ? (contact.id ? "Edit contact or agency" : "Add contact or agency")
            : mode === "contact_event"
              ? "Log completed outreach / contact"
              : mode === "void_event"
                ? "Void manual log entry"
                : "Schedule next action";
  const appGoalPct = daily?.applications.goal ? Math.min(100, Math.round((daily.applications.count / daily.applications.goal) * 100)) : 0;
  const contactGoalPct = daily?.contacts.goal ? Math.min(100, Math.round((daily.contacts.count / daily.contacts.goal) * 100)) : 0;
  const hasQueueItems = Boolean(
    queue &&
      (queue.overdueActions.length ||
        queue.dueTodayActions.length ||
        queue.upcomingActions.length ||
        queue.upcomingInterviews.length ||
        queue.priorityDrafts.length)
  );

  return (
    <section aria-labelledby="crm-dashboard-title" className="ui-controls mx-auto w-full max-w-7xl px-4 pt-4 sm:px-6">
      <div className="ui-panel rounded-2xl p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-baseline gap-2.5">
            <h2 id="crm-dashboard-title" className="text-lg font-semibold tracking-tight text-white">Today&apos;s job search</h2>
            <span className="rounded-md bg-[#0a101e] px-2 py-0.5 text-xs text-slate-400 border border-slate-800/80">{today} · {appTimeZone}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {data && (
              <button type="button" onClick={() => openForm("goals")} className={buttonClass}>
                Edit goals
              </button>
            )}
            <button type="button" onClick={refresh} disabled={loading} className={buttonClass}>
              Refresh schedule
            </button>
          </div>
        </div>

        {loadError && (
          <div role="alert" className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
            <p>{loadError}</p>
            <button type="button" onClick={refresh} className="mt-1 underline">Retry schedule</button>
          </div>
        )}
        {loading && <p role="status" className="mt-2.5 text-sm text-slate-300">Loading schedule…</p>}

        {data && daily && queue && (
          <>
            <div className="mt-3.5 grid grid-cols-1 gap-4 lg:grid-cols-12">
              {/* Left: compact daily goals + 3 action buttons */}
              <div className="space-y-3 lg:col-span-5">
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="ui-inset rounded-xl p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs text-slate-300">Applications sent today</p>
                    </div>
                    <p className="mt-1 text-xl font-semibold tabular-nums text-white">{daily.applications.count} / {daily.applications.goal}</p>
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                      <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${appGoalPct}%` }} />
                    </div>
                    <p className="mt-1.5 text-xs text-slate-400">{daily.applications.goal ? `${daily.applications.remaining} left for today's goal` : "No goal set"}</p>
                  </div>
                  <div className="ui-inset rounded-xl p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs text-slate-300">Contacts reached today</p>
                    </div>
                    <p className="mt-1 text-xl font-semibold tabular-nums text-white">{daily.contacts.count} / {daily.contacts.goal}</p>
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                      <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${contactGoalPct}%` }} />
                    </div>
                    <p className="mt-1.5 text-xs text-slate-400">{daily.contacts.goal ? `${daily.contacts.remaining} left for today's goal` : "No goal set"}</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => openForm("contact_event")} className={buttonClass}>Log contact</button>
                  <button type="button" onClick={() => openForm("action")} className={buttonClass}>Schedule action</button>
                  <button type="button" onClick={() => openForm("contact")} className={buttonClass}>Add contact / agency</button>
                </div>
                <p className="text-xs leading-relaxed text-slate-400">
                  Confirmed activity only. Past applications without a logged send date do not count until recorded. Saving, copying, or exporting never adds activity.
                </p>
              </div>

              {/* Right: proportioned activity logger + today's queue */}
              <div className="flex flex-col justify-between space-y-3 lg:col-span-7">
                <div className="ui-inset rounded-xl p-3 space-y-3">
                  <div className="flex flex-wrap items-end gap-2">
                    <label className="min-w-0 flex-1 basis-52 text-[13px] text-slate-300">
                      Application
                      <select
                        value={selectedApplication}
                        onChange={(event) => setSelectedApplication(event.target.value)}
                        className={`${CRM_CONTROL_CLASS} mt-1`}
                      >
                        <option value="">Select an application</option>
                        {data.applications.map((app) => (
                          <option key={app.id} value={app.id}>{app.company} · {app.roleTitle}</option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="button"
                      disabled={!selectedApplication}
                      onClick={() => openApplication(selectedApplication)}
                      className={buttonClass}
                    >
                      Log application activity
                    </button>
                  </div>

                  {(sentWithoutNextAction.length > 0 || unconfirmedApplied.length > 0) && (
                    <div className="flex flex-wrap gap-2 text-xs">
                      {sentWithoutNextAction.length > 0 && (
                        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-sky-500/30 bg-sky-500/10 px-2.5 py-1.5 text-sky-100">
                          <span>{sentWithoutNextAction.length} sent with no next action</span>
                          <button
                            type="button"
                            onClick={() => openApplication(sentWithoutNextAction[0].id, undefined, "schedule_action")}
                            className="underline font-semibold text-white hover:text-blue-200"
                          >
                            Schedule ({sentWithoutNextAction[0].company})
                          </button>
                        </div>
                      )}
                      {unconfirmedApplied.length > 0 && (
                        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-amber-100">
                          <span>{unconfirmedApplied.length} marked applied/interviewing with no send date</span>
                          <button
                            type="button"
                            onClick={() => openApplication(unconfirmedApplied[0].id, undefined, "register_application")}
                            className="underline font-semibold text-white hover:text-amber-200"
                          >
                            Log submission ({unconfirmedApplied[0].company})
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {hasQueueItems ? (
                    <div className="space-y-2.5 pt-1">
                      <ActionList
                        items={queue.overdueActions}
                        heading="Overdue actions"
                        isOverdue
                        disabled={saving || loading}
                        onOpenApplication={(id) => openApplication(id)}
                        onReschedule={(item) => openForm("reschedule_action", undefined, item)}
                        onCancel={(item) => openForm("cancel_action", undefined, item)}
                        onComplete={(item) => void completeAction(item)}
                      />
                      <ActionList
                        items={queue.dueTodayActions}
                        heading="Due today"
                        disabled={saving || loading}
                        onOpenApplication={(id) => openApplication(id)}
                        onReschedule={(item) => openForm("reschedule_action", undefined, item)}
                        onCancel={(item) => openForm("cancel_action", undefined, item)}
                        onComplete={(item) => void completeAction(item)}
                      />
                      {queue.upcomingInterviews.length > 0 && (
                        <div>
                          <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-300">Upcoming interviews</h3>
                          <ul className="space-y-1.5">
                            {queue.upcomingInterviews.map((item) => (
                              <li key={item.event.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-sm text-slate-200">
                                <div className="min-w-0 flex-1 break-words">
                                  <p className="font-medium text-white">{item.application?.company || item.contact?.name || "Interview"}</p>
                                  <p className="text-xs text-slate-400">
                                    {item.event.startsAt
                                      ? new Intl.DateTimeFormat("en-US", { timeZone: appTimeZone, dateStyle: "medium", timeStyle: "short" }).format(new Date(item.event.startsAt))
                                      : item.date} · {appTimeZone}
                                  </p>
                                </div>
                                {item.application && (
                                  <div className="flex flex-wrap gap-1.5">
                                    <button type="button" onClick={() => openApplication(item.application!.id)} className={buttonClass}>
                                      Activity
                                    </button>
                                    <Link href={`/applications/${item.application.id}?tab=strategy&preview=prep`} className="ui-button ui-button--primary">Interview prep</Link>
                                  </div>
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      <ActionList
                        items={queue.upcomingActions}
                        heading="Upcoming actions"
                        disabled={saving || loading}
                        onOpenApplication={(id) => openApplication(id)}
                        onReschedule={(item) => openForm("reschedule_action", undefined, item)}
                        onCancel={(item) => openForm("cancel_action", undefined, item)}
                        onComplete={(item) => void completeAction(item)}
                      />
                      {queue.priorityDrafts.length > 0 && (
                        <div>
                          <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-300">Drafts to review</h3>
                          <ul className="flex flex-wrap gap-1.5">
                            {queue.priorityDrafts.slice(0, 5).map((app) => (
                              <li key={app.id}>
                                <Link href={`/applications/${app.id}`} className={`max-w-full whitespace-normal text-left text-xs ${buttonClass}`}>
                                  {app.company} · {app.roleTitle}
                                  {typeof app.fitScore === "number" ? ` · AI ${app.fitScore}/10` : ""}
                                  {app.eligibilityStatus === "meets" ? " · meets criteria" : ""}
                                  {app.crm?.priority === "high" ? " · high priority" : ""}
                                  {app.crm?.preparation?.reviewed ? " · docs reviewed" : " · review pending"}
                                </Link>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs leading-relaxed text-slate-400">
                      No dated actions or interviews scheduled yet. Plan your next step — we never fabricate follow-up dates for older applications.
                    </p>
                  )}
                </div>

                {message && <p role="status" className="text-xs font-medium text-emerald-300">{message}</p>}
                {actionError && (
                  <p role="alert" className="text-xs text-amber-200">
                    {actionError} <button type="button" onClick={refresh} className="underline">Reload schedule</button>
                  </p>
                )}
              </div>
            </div>

            <div className="mt-3.5 grid grid-cols-1 gap-3 border-t border-slate-800/80 pt-3 sm:grid-cols-2">
              <details className="rounded-xl bg-[#0a101e]/70 px-3 py-2 border border-slate-800/70">
                <summary className="cursor-pointer text-xs font-semibold text-slate-200">Recent activity</summary>
                <p className="mt-2 text-xs text-slate-400">Latest 20 manual log entries. Voiding preserves history and does not revert statuses automatically.</p>
                {!recentEvents.length ? (
                  <p className="mt-2 text-xs text-slate-300">No manual activity logged yet.</p>
                ) : (
                  <ul className="mt-2 space-y-1.5">
                    {recentEvents.map(({ event, application }) => {
                      const voidNote = event.voidedAt
                        ? (application?.crm?.events || data.events).find((other) => other.type === "event_voided" && other.relatedEventId === event.id)?.note
                        : undefined;
                      return (
                        <li key={event.id} className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-800 p-2.5 text-xs">
                          <div className="min-w-0 flex-1 break-words">
                            <p className="text-slate-100">{manualLabels[event.type] || auditLabels[event.type]}{event.voidedAt ? " · Voided" : ""}</p>
                            <p className="text-slate-400">
                              {event.occurredOn}
                              {application ? ` · ${application.company}` : ""}
                              {event.actionId && actionTitles.get(event.actionId) ? ` · ${actionTitles.get(event.actionId)!.title}` : ""}
                              {event.type === "action_rescheduled" && event.previousDueOn && event.dueOn ? ` · ${event.previousDueOn} → ${event.dueOn}` : ""}
                              {event.note ? ` · ${event.note}` : ""}
                            </p>
                            {event.type === "application_sent" && (
                              <p className="text-slate-400">
                                <CrmDeliveryNote deliveryId={event.deliveryId} deliveries={application ? (deliveriesByApplication?.[application.id] ?? fetchedDeliveriesByApp[application.id]) : undefined} />
                              </p>
                            )}
                            {event.voidedAt && (
                              <p className="text-amber-300">
                                Voided on {event.voidedAt.slice(0, 10)}{voidNote ? ` · Reason: ${voidNote}` : ""}
                              </p>
                            )}
                          </div>
                          {!event.voidedAt && manualLabels[event.type] && (
                            <button
                              type="button"
                              className="ui-button ui-button--danger"
                              onClick={() => { if (application) openApplication(application.id, event.id); else { openForm("void_event"); setEventId(event.id); } }}
                            >
                              Void entry
                            </button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </details>

              <details className="rounded-xl bg-[#0a101e]/70 px-3 py-2 border border-slate-800/70">
                <summary className="cursor-pointer text-xs font-semibold text-slate-200">Contacts & agencies ({data.contacts.length})</summary>
                {!data.contacts.length ? (
                  <p className="mt-2 text-xs text-slate-400">Add people or recruiting agencies you want to follow up with. Saving a contact card does not count as completed outreach.</p>
                ) : (
                  <ul className="mt-2 space-y-1.5">
                    {data.contacts.map((item) => (
                      <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-800 p-2.5 text-xs">
                        <div className="min-w-0 flex-1 break-words text-slate-100">
                          {item.name}
                          <p className="text-slate-400">{[item.organization, item.agency].filter(Boolean).join(" · ")}</p>
                          {(item.email || item.linkedin || item.notes) && (
                            <p className="mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-slate-300">
                              {item.email && <a href={`mailto:${item.email}`} className="text-[#8db2d6] hover:underline">{item.email}</a>}
                              {item.linkedin && <a href={item.linkedin} target="_blank" rel="noopener noreferrer" className="text-[#8db2d6] hover:underline">Professional profile ↗</a>}
                              {item.notes && <span className="text-slate-400 truncate max-w-[260px]">{item.notes}</span>}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          <button type="button" onClick={() => openForm("contact", item)} className={buttonClass}>Edit contact</button>
                          <button type="button" onClick={() => openForm("contact_event", item)} className={buttonClass}>Log contact</button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </details>
            </div>
          </>
        )}
      </div>
      {applicationDialog && (
        <CrmActionDialog
          key={applicationDialog}
          applicationId={applicationDialog}
          deliveries={deliveriesByApplication?.[applicationDialog] ?? fetchedDeliveriesByApp[applicationDialog]}
          initialEventId={initialEventId}
          initialActionType={initialAppActionType}
          contacts={data?.contacts}
          onClose={() => { setApplicationDialog(null); setInitialEventId(undefined); setInitialAppActionType(undefined); }}
          onSaved={() => { refresh(); onApplicationsChanged(); }}
        />
      )}
      {mode && data && (
        <CrmDialogFrame title={formTitle} onClose={() => closeForm()}>
          <form onSubmit={submitGlobal} className="space-y-4">
            {closeWarning && formSaving && (
              <div role="alert" className="rounded-lg border border-amber-500/40 p-3 text-sm text-amber-100">
                <p>This entry is still saving. If you close now, the result will be checked in the background; retrying with the same data will not create a duplicate.</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" className={buttonClass} onClick={() => setCloseWarning(false)}>Keep waiting</button>
                  <button type="button" className={buttonClass} onClick={() => closeForm(true)}>Close anyway</button>
                </div>
              </div>
            )}
            {guard && currentHash && (
              <div role="alert" className="rounded-lg border border-amber-500/40 p-3 text-sm text-amber-100">
                <p>{guard === "already_saved" ? "This exact entry was already confirmed on the server. Saving it again will create a new activity." : "Another attempt of this type is still unconfirmed. Reload your schedule first to check whether it succeeded before logging another entry."}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" className={buttonClass} onClick={() => { setGuard(null); refresh(); }}>Check again</button>
                  <button type="button" className={buttonClass} onClick={() => { setDistinctHash(currentHash); setGuard(null); }}>It is a separate activity</button>
                </div>
              </div>
            )}
            {retriesUncertain && !guard && (
              <div className="rounded-lg border border-slate-600 p-3 text-xs text-slate-200">
                <p>An earlier attempt with these exact details could not be confirmed. Saving will retry with the same command ID to prevent duplicates.</p>
                <button type="button" className="mt-2 underline" onClick={() => setDistinctHash(currentHash)}>This is a separate activity: log it as new</button>
              </div>
            )}
            {distinctHash !== null && distinctHash === currentHash && (
              <p className="text-xs text-amber-100">
                Will be logged as a new, distinct activity. <button type="button" className="underline" onClick={() => setDistinctHash(null)}>Undo</button>
              </p>
            )}
            {formError && (
              <div role="alert" className="rounded-lg border border-amber-500/40 p-3 text-sm text-amber-100">
                <p>{formError}</p>
                {(conflict || uncertain) && <button type="button" onClick={refresh} className="mt-2 underline">Reload data without clearing form</button>}
              </div>
            )}
            {loadError && (
              <p role="alert" className="text-sm text-amber-200">
                {loadError} <button type="button" onClick={refresh} className="underline">Retry loading</button>
              </p>
            )}
            <fieldset disabled={formSaving} className="m-0 min-w-0 space-y-4 border-0 p-0">
              {(mode === "reschedule_action" || mode === "cancel_action") && actionTarget && (
                <>
                  <p className="text-sm text-slate-100">
                    {actionTarget.action.title}
                    <span className="block text-xs text-slate-400">
                      Due date: {actionTarget.action.dueOn}{actionTarget.application ? ` · ${actionTarget.application.company}` : ""}
                    </span>
                  </p>
                  <p className="text-xs text-slate-300">
                    {mode === "reschedule_action"
                      ? "Rescheduling updates only the due date. The action is not counted as completed and the change stays in history."
                      : "Cancelling does not mark the action as completed: it removes it from pending tasks and keeps it in history as cancelled."}
                  </p>
                  {mode === "reschedule_action" && (
                    <div>
                      <label className="block text-sm">
                        New action date
                        <input type="date" required value={day} onChange={(event) => setDay(event.target.value)} className={`${CRM_CONTROL_CLASS} mt-1`} />
                      </label>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {[2, 5, 7].map((offset) => {
                          const d = new Date(`${today}T12:00:00Z`);
                          d.setUTCDate(d.getUTCDate() + offset);
                          const iso = d.toISOString().slice(0, 10);
                          return (
                            <button key={offset} type="button" onClick={() => setDay(iso)} className="px-2 py-0.5 rounded border border-slate-600 text-[11px] text-blue-200 hover:bg-slate-800">
                              +{offset} days ({iso})
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  <label className="block text-sm">
                    Reason (optional)
                    <textarea rows={2} maxLength={10000} value={note} onChange={(event) => setNote(event.target.value)} className={`${CRM_CONTROL_CLASS} mt-1`} />
                  </label>
                </>
              )}
              {mode === "void_event" && (
                <>
                  <p className="text-xs text-slate-300">The entry will stop counting as activity and remain in your history as voided.</p>
                  <label className="block text-sm">
                    Reason for voiding
                    <textarea required rows={3} maxLength={10000} value={note} onChange={(event) => setNote(event.target.value)} className={`${CRM_CONTROL_CLASS} mt-1`} />
                  </label>
                </>
              )}
              {mode === "goals" && (
                <>
                  <p className="text-xs text-slate-300">These are personal activity targets, not guarantees of interviews. Adjust them anytime or set them to zero.</p>
                  <label className="block text-sm">
                    Applications per day
                    <input type="number" min={0} max={100} required value={goalApplications} onChange={(event) => setGoalApplications(Number(event.target.value))} className={`${CRM_CONTROL_CLASS} mt-1`} />
                  </label>
                  <label className="block text-sm">
                    Contacts per day
                    <input type="number" min={0} max={100} required value={goalContacts} onChange={(event) => setGoalContacts(Number(event.target.value))} className={`${CRM_CONTROL_CLASS} mt-1`} />
                  </label>
                </>
              )}
              {mode === "contact" && (
                <>
                  <p className="text-xs text-slate-300">Store only the contact details you need for follow-up. No messages are sent automatically.</p>
                  {([
                    ["name", "Name", true],
                    ["organization", "Company or organization", false],
                    ["agency", "Recruiting agency", false],
                    ["email", "Email", false],
                    ["linkedin", "Profile URL", false],
                  ] as const).map(([field, label, required]) => (
                    <label key={field} className="block text-sm">
                      {label}
                      <input
                        type={field === "email" ? "email" : field === "linkedin" ? "url" : "text"}
                        required={required}
                        maxLength={field === "name" ? 200 : undefined}
                        value={contact[field]}
                        onChange={(event) => setContact((current) => ({ ...current, [field]: event.target.value }))}
                        className={`${CRM_CONTROL_CLASS} mt-1`}
                      />
                    </label>
                  ))}
                  <label className="block text-sm">
                    Contact notes
                    <textarea rows={3} maxLength={10000} value={contact.notes} onChange={(event) => setContact((current) => ({ ...current, notes: event.target.value }))} className={`${CRM_CONTROL_CLASS} mt-1`} />
                  </label>
                </>
              )}
              {(mode === "contact_event" || mode === "action") && (
                <>
                  {mode === "contact_event" && (
                    <p className="text-xs text-slate-300">Log only a conversation or message you have already sent. Drafting or copying outreach text does not count as completed outreach.</p>
                  )}
                  {mode === "action" && (
                    <label className="block text-sm">
                      What will you do?
                      <input value={title} onChange={(event) => setTitle(event.target.value)} required maxLength={250} className={`${CRM_CONTROL_CLASS} mt-1`} />
                    </label>
                  )}
                  <div>
                    <label className="block text-sm">
                      {mode === "contact_event" ? "Actual contact date" : "Next action due date"}
                      <input type="date" required value={day} onChange={(event) => setDay(event.target.value)} className={`${CRM_CONTROL_CLASS} mt-1`} />
                    </label>
                    {mode === "action" && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {[2, 5, 7].map((offset) => {
                          const d = new Date(`${today}T12:00:00Z`);
                          d.setUTCDate(d.getUTCDate() + offset);
                          const iso = d.toISOString().slice(0, 10);
                          return (
                            <button key={offset} type="button" onClick={() => setDay(iso)} className="px-2 py-0.5 rounded border border-slate-600 text-[11px] text-blue-200 hover:bg-slate-800">
                              +{offset} days ({iso})
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <label className="block text-sm">
                    Person or agency (optional)
                    <select value={contactId} onChange={(event) => setContactId(event.target.value)} className={`${CRM_CONTROL_CLASS} mt-1`}>
                      <option value="">No contact linked</option>
                      {data.contacts.map((item) => <option key={item.id} value={item.id}>{item.name}{item.agency ? ` · ${item.agency}` : ""}</option>)}
                    </select>
                  </label>
                  <label className="block text-sm">
                    Related application (optional)
                    <select value={relatedApplication} onChange={(event) => setRelatedApplication(event.target.value)} className={`${CRM_CONTROL_CLASS} mt-1`}>
                      <option value="">No application linked</option>
                      {data.applications.map((app) => <option key={app.id} value={app.id}>{app.company} · {app.roleTitle}</option>)}
                    </select>
                  </label>
                  <label htmlFor={`${formId}-note`} className="block text-sm">
                    Note (optional)
                    <textarea id={`${formId}-note`} rows={3} maxLength={10000} value={note} onChange={(event) => setNote(event.target.value)} className={`${CRM_CONTROL_CLASS} mt-1`} />
                  </label>
                </>
              )}
            </fieldset>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => closeForm()} className={buttonClass}>Cancel</button>
              <button type="submit" disabled={formSaving || loading || conflict} className="ui-button ui-button--primary">
                {formSaving ? "Saving…" : mode === "cancel_action" ? "Confirm cancellation" : "Save entry"}
              </button>
            </div>
          </form>
        </CrmDialogFrame>
      )}
    </section>
  );
}
