import { createHash, randomUUID } from "node:crypto";
import type { Application } from "./schemas";
import { ApplicationCrmCommandSchema, ApplicationCrmSchema, GlobalCrmCommandSchema, type ApplicationCrmCommand, type CrmAction, type CrmEvent, type CrmStore, type GlobalCrmCommand } from "./crmSchemas";
import { getDelivery } from "./deliveryRecords";
import { getLocalIsoDate } from "./timeZone";
import { loadApplications, loadCrmStore, updateApplication, updateCrmStore, mirrorApplicationJson, StorageError } from "./storage";

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value).filter(([, value]) => value !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${JSON.stringify(key)}:${stableJson(value)}`).join(",")}}`;
  return JSON.stringify(value) ?? "null";
}

function fingerprint(command: ApplicationCrmCommand | GlobalCrmCommand): string {
  const { revision: _revision, ...operation } = command;
  void _revision;
  return createHash("sha256").update(stableJson(operation)).digest("hex");
}

function localDay(instant: string): string {
  return getLocalIsoDate(new Date(instant));
}

function assertOccurred(day: string, registeredAt: string): void {
  if (day > localDay(registeredAt)) throw new StorageError("A completed activity cannot be dated in the future. Schedule an action instead.", 400);
}

function assertContact(store: CrmStore, id?: string): void {
  if (id && !store.contacts.some(contact => contact.id === id)) throw new StorageError("Contact not found.", 404);
}

function assertApplication(id?: string): void {
  if (id && !loadApplications().some(app => app.id === id)) throw new StorageError("Application not found.", 404);
}

function eventFor(command: ApplicationCrmCommand | GlobalCrmCommand, type: CrmEvent["type"], registeredAt: string, extra: Partial<CrmEvent> = {}): CrmEvent {
  return { id: randomUUID(), type, occurredOn: localDay(registeredAt), registeredAt, ...extra, commandId: command.commandId, commandFingerprint: fingerprint(command) };
}

function newAction(input: { title: string; dueOn: string; kind?: CrmAction["kind"]; note?: string; applicationId?: string; contactId?: string }, createdAt: string): CrmAction {
  return { id: randomUUID(), title: input.title, dueOn: input.dueOn, kind: input.kind || "follow_up", status: "open", createdAt, ...(input.note !== undefined ? { note: input.note } : {}), ...(input.applicationId ? { applicationId: input.applicationId } : {}), ...(input.contactId ? { contactId: input.contactId } : {}) };
}

function voidEvent(events: CrmEvent[], eventId: string, registeredAt: string): CrmEvent {
  const original = events.find(event => event.id === eventId);
  if (!original) throw new StorageError("Activity not found.", 404);
  if (!["application_sent", "contact_recorded", "response_recorded", "interview_scheduled"].includes(original.type)) throw new StorageError("This activity cannot be voided.", 400);
  if (original.voidedAt) throw new StorageError("This activity has already been voided.", 409);
  original.voidedAt = registeredAt;
  return original;
}

type ActionChangeCommand = Extract<ApplicationCrmCommand | GlobalCrmCommand, { type: "reschedule_action" | "cancel_action" }>;

/**
 * Reschedule/cancel keep the action and its history: nothing is deleted, completedAt is never
 * set, and the audit event records what changed. Only open actions can change.
 */
function changeAction(actions: CrmAction[], command: ActionChangeCommand, registeredAt: string): { action: CrmAction; type: CrmEvent["type"]; extra: Partial<CrmEvent> } {
  const action = actions.find(item => item.id === command.actionId);
  if (!action) throw new StorageError("Action not found.", 404);
  if (action.status !== "open") throw new StorageError("This action is already closed.", 409);
  const note = command.note?.trim() ? { note: command.note.trim() } : {};
  if (command.type === "cancel_action") {
    action.status = "cancelled";
    action.cancelledAt = registeredAt;
    return { action, type: "action_cancelled", extra: { actionId: action.id, ...note } };
  }
  if (command.dueOn === action.dueOn) throw new StorageError("The action already has this due date.", 400);
  const previousDueOn = action.dueOn;
  action.dueOn = command.dueOn;
  return { action, type: "action_rescheduled", extra: { actionId: action.id, previousDueOn, dueOn: command.dueOn, ...note } };
}

/** Ordinary document saves cannot replace, delete or inject command-owned history. */
export function assertCrmUnchanged(current: Application, body: Record<string, unknown>): void {
  if (Object.hasOwn(body, "crm") && stableJson(body.crm) !== stableJson(current.crm)) {
    throw new StorageError("Use the CRM activity controls to change tracking history, actions or priorities.", 400);
  }
}

export function getCrmOverview(store = loadCrmStore()) {
  return {
    ...store,
    applications: loadApplications().map(app => ({
      id: app.id,
      company: app.company,
      roleTitle: app.roleTitle,
      status: app.status,
      revision: app.revision ?? 0,
      roleClassificationType: app.roleClassification?.type,
      fitScore: app.fitAssessment?.scoreOutOf10 ?? null,
      eligibilityStatus: app.jobAnalysis?.eligibility?.status,
      dateModified: app.dateModified,
      ...(app.crm ? { crm: app.crm } : {}),
    })),
  };
}

export function runApplicationCrmCommand(applicationId: string, input: unknown): Application {
  const command = ApplicationCrmCommandSchema.parse(input);
  const commandHash = fingerprint(command);
  const saved = updateApplication(applicationId, command.revision, current => {
    const registeredAt = new Date().toISOString();
    const crm = ApplicationCrmSchema.parse(current.crm || {});
    let event: CrmEvent;
    switch (command.type) {
      case "register_application":
        assertOccurred(command.sentOn, registeredAt);
        if (crm.events.some(item => item.type === "application_sent" && !item.voidedAt)) throw new StorageError("This application already has a confirmed send date. No duplicate was added.", 409);
        // A linked delivery must be a frozen export of this same application; unknown stays unknown.
        if (command.deliveryId && getDelivery(command.deliveryId)?.applicationId !== current.id) {
          throw new StorageError("The selected delivery does not belong to this application.", 400);
        }
        if (["draft", "reviewed", "exported"].includes(current.status)) current.status = "applied";
        event = eventFor(command, "application_sent", registeredAt, { occurredOn: command.sentOn, ...(command.deliveryId ? { deliveryId: command.deliveryId } : {}) });
        break;
      case "record_contact":
        assertOccurred(command.occurredOn, registeredAt);
        assertContact(loadCrmStore(), command.contactId);
        event = eventFor(command, "contact_recorded", registeredAt, { occurredOn: command.occurredOn, ...(command.contactId ? { contactId: command.contactId } : {}), ...(command.note !== undefined ? { note: command.note } : {}) });
        break;
      case "record_response":
        assertOccurred(command.occurredOn, registeredAt);
        event = eventFor(command, "response_recorded", registeredAt, { occurredOn: command.occurredOn, ...(command.note !== undefined ? { note: command.note } : {}) });
        break;
      case "schedule_action": {
        const action = newAction({ ...command, applicationId }, registeredAt);
        crm.actions.push(action);
        event = eventFor(command, "action_scheduled", registeredAt, { actionId: action.id, note: action.title });
        break;
      }
      case "complete_action": {
        const action = crm.actions.find(item => item.id === command.actionId);
        if (!action) throw new StorageError("Action not found.", 404);
        if (action.status !== "open") throw new StorageError("This action is already closed.", 409);
        action.status = "completed";
        action.completedAt = registeredAt;
        event = eventFor(command, "action_completed", registeredAt, { actionId: action.id, note: action.title });
        break;
      }
      case "reschedule_action":
      case "cancel_action": {
        const change = changeAction(crm.actions, command, registeredAt);
        event = eventFor(command, change.type, registeredAt, change.extra);
        break;
      }
      case "schedule_interview":
        event = eventFor(command, "interview_scheduled", registeredAt, { occurredOn: localDay(command.startsAt), startsAt: command.startsAt, ...(command.note !== undefined ? { note: command.note } : {}) });
        if (["draft", "reviewed", "exported", "applied"].includes(current.status)) current.status = "interviewing";
        break;
      case "set_preparation":
        crm.preparation = command.reviewed ? { reviewed: true, reviewedAt: registeredAt } : { reviewed: false };
        event = eventFor(command, "preparation_reviewed", registeredAt, { note: command.reviewed ? "Documents reviewed" : "Documents need review" });
        break;
      case "set_priority":
        crm.priority = command.value;
        event = eventFor(command, "priority_changed", registeredAt, { note: command.value });
        break;
      case "change_status":
        if (command.status === current.status) throw new StorageError("The application already has this status.", 409);
        event = eventFor(command, "status_changed", registeredAt, { fromStatus: current.status, toStatus: command.status });
        current.status = command.status;
        break;
      case "void_event": {
        const original = voidEvent(crm.events, command.eventId, registeredAt);
        event = eventFor(command, "event_voided", registeredAt, { relatedEventId: original.id, note: command.note });
        break;
      }
    }
    crm.events.push({ ...event, applicationId });
    current.crm = crm;
    return current;
  }, { commandId: command.commandId, fingerprint: commandHash });
  if (!saved) throw new StorageError("Application was not saved.");
  mirrorApplicationJson(saved);
  return saved;
}

export function runGlobalCrmCommand(input: unknown) {
  const command = GlobalCrmCommandSchema.parse(input);
  const store = updateCrmStore(command.revision, { commandId: command.commandId, fingerprint: fingerprint(command) }, current => {
    const registeredAt = new Date().toISOString();
    let event: CrmEvent;
    switch (command.type) {
      case "update_goals":
        current.goals = command.goals;
        event = eventFor(command, "goals_updated", registeredAt);
        break;
      case "save_contact": {
        const id = command.contact.id || randomUUID();
        const index = current.contacts.findIndex(contact => contact.id === id);
        if (command.contact.id && index < 0) throw new StorageError("Contact not found.", 404);
        const contact = { ...(index >= 0 ? current.contacts[index] : {}), ...command.contact, id };
        if (index >= 0) current.contacts[index] = contact;
        else current.contacts.push(contact);
        event = eventFor(command, "contact_saved", registeredAt, { contactId: id });
        break;
      }
      case "record_contact":
        assertOccurred(command.occurredOn, registeredAt);
        assertContact(current, command.contactId);
        assertApplication(command.applicationId);
        event = eventFor(command, "contact_recorded", registeredAt, { occurredOn: command.occurredOn, ...(command.contactId ? { contactId: command.contactId } : {}), ...(command.applicationId ? { applicationId: command.applicationId } : {}), ...(command.note !== undefined ? { note: command.note } : {}) });
        break;
      case "schedule_action": {
        assertContact(current, command.contactId);
        assertApplication(command.applicationId);
        const action = newAction(command, registeredAt);
        current.actions.push(action);
        event = eventFor(command, "action_scheduled", registeredAt, { ...(command.applicationId ? { applicationId: command.applicationId } : {}), actionId: action.id, note: action.title });
        break;
      }
      case "complete_action": {
        const action = current.actions.find(item => item.id === command.actionId);
        if (!action) throw new StorageError("Action not found.", 404);
        if (action.status !== "open") throw new StorageError("This action is already closed.", 409);
        action.status = "completed";
        action.completedAt = registeredAt;
        event = eventFor(command, "action_completed", registeredAt, { ...(action.applicationId ? { applicationId: action.applicationId } : {}), actionId: action.id, note: action.title });
        break;
      }
      case "reschedule_action":
      case "cancel_action": {
        const change = changeAction(current.actions, command, registeredAt);
        event = eventFor(command, change.type, registeredAt, { ...(change.action.applicationId ? { applicationId: change.action.applicationId } : {}), ...(change.action.contactId ? { contactId: change.action.contactId } : {}), ...change.extra });
        break;
      }
      case "void_event": {
        const original = voidEvent(current.events, command.eventId, registeredAt);
        event = eventFor(command, "event_voided", registeredAt, { relatedEventId: original.id, note: command.note, ...(original.applicationId ? { applicationId: original.applicationId } : {}), ...(original.contactId ? { contactId: original.contactId } : {}) });
        break;
      }
    }
    current.events.push(event);
    return current;
  });
  return getCrmOverview(store);
}
