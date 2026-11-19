import type { ApplicationCrm, CrmAction, CrmContact, CrmEvent, CrmStore } from "./crmSchemas";
import { getAppTimeZone } from "./timeZone";

/** The dashboard receives CRM summaries, not document or CV contents. */
export interface CrmApplicationSummary {
  id: string;
  company: string;
  roleTitle: string;
  status: NonNullable<CrmEvent["toStatus"]>;
  revision: number;
  crm?: ApplicationCrm;
  roleClassificationType?: string;
  fitScore?: number | null;
  eligibilityStatus?: "meets" | "uncertain" | "gaps";
  dateModified?: string;
}

export interface CrmViewData extends CrmStore {
  applications: CrmApplicationSummary[];
}

export interface CrmGoalProgress {
  count: number;
  goal: number;
  remaining: number;
}

export interface CrmDaySummary {
  date: string;
  timeZone: string;
  applications: CrmGoalProgress;
  contacts: CrmGoalProgress;
}

interface CrmItemContext {
  application?: CrmApplicationSummary;
  contact?: CrmContact;
}

export interface CrmQueuedAction extends CrmItemContext {
  action: CrmAction;
}

export interface CrmQueuedInterview extends CrmItemContext {
  event: CrmEvent;
  /** Interview calendar day in the active local timezone, derived only from a known startsAt instant. */
  date: string;
}

export interface CrmTodayQueue {
  date: string;
  overdueActions: CrmQueuedAction[];
  dueTodayActions: CrmQueuedAction[];
  upcomingActions: CrmQueuedAction[];
  upcomingInterviews: CrmQueuedInterview[];
  priorityDrafts: CrmApplicationSummary[];
}

/** CRM calendar dates are known local dates in the user's configured timezone. */
export const CRM_TIME_ZONE = getAppTimeZone();

export function isCalendarDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  return day <= [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
}

export function getLocalCrmDate(now: Date = new Date(), timeZone: string = getAppTimeZone()): string {
  if (!Number.isFinite(now.getTime())) throw new RangeError("Invalid CRM clock date.");
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone, calendar: "gregory", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(item => item.type === type)!.value;
  const date = `${part("year").padStart(4, "0")}-${part("month")}-${part("day")}`;
  if (!isCalendarDate(date)) throw new RangeError("CRM clock date is outside the supported calendar.");
  return date;
}

/** Backwards-compatible alias for getLocalCrmDate. */
export const getBerlinDate = getLocalCrmDate;

function checkedDay(today: string): string {
  if (!isCalendarDate(today)) throw new RangeError("CRM day must be a valid YYYY-MM-DD calendar date.");
  return today;
}

function itemContext(data: CrmViewData, item: { applicationId?: string; contactId?: string }, fallback?: CrmApplicationSummary): CrmItemContext {
  return {
    application: item.applicationId ? data.applications.find(app => app.id === item.applicationId) : fallback,
    contact: item.contactId ? data.contacts.find(contact => contact.id === item.contactId) : undefined,
  };
}

function eventsWithContext(data: CrmViewData): Array<CrmItemContext & { event: CrmEvent }> {
  const rows = new Map<string, CrmItemContext & { event: CrmEvent }>();
  const add = (event: CrmEvent, application?: CrmApplicationSummary) => {
    if (!event?.id || rows.has(event.id)) return;
    rows.set(event.id, { event, ...itemContext(data, event, application) });
  };
  for (const event of data.events) add(event);
  for (const application of data.applications) for (const event of application.crm?.events ?? []) add(event, application);
  return [...rows.values()];
}

/** First known valid sent event in persisted log order; re-registration is not a new application. */
function firstSubmissions(data: CrmViewData): Map<string, CrmEvent> {
  const submissions = new Map<string, CrmEvent>();
  for (const { event, application } of eventsWithContext(data)) {
    const applicationId = event.applicationId ?? application?.id;
    if (event.type === "application_sent" && !event.voidedAt && applicationId && isCalendarDate(event.occurredOn) && !submissions.has(applicationId)) {
      submissions.set(applicationId, event);
    }
  }
  return submissions;
}

function progress(count: number, goal: number, fallback: number): CrmGoalProgress {
  const checkedGoal = Number.isInteger(goal) && goal >= 0 && goal <= 100 ? goal : fallback;
  return { count, goal: checkedGoal, remaining: Math.max(0, checkedGoal - count) };
}

/**
 * Only manually confirmed event types contribute to goals. Status, copied drafts,
 * exports, record timestamps and interview scheduling never imply an actual send.
 * Event IDs are deduplicated across global and application logs; applications are
 * additionally unique by application ID, on their first known effective sent day.
 */
export function getCrmDaySummary(data: CrmViewData, today: string = getLocalCrmDate()): CrmDaySummary {
  const date = checkedDay(today);
  const applications = [...firstSubmissions(data).values()].filter(event => event.occurredOn === date).length;
  const contacts = eventsWithContext(data).filter(({ event }) => event.type === "contact_recorded" && !event.voidedAt && isCalendarDate(event.occurredOn) && event.occurredOn === date).length;
  return {
    date,
    timeZone: getAppTimeZone(),
    applications: progress(applications, data.goals.applications, 6),
    contacts: progress(contacts, data.goals.contacts, 2),
  };
}

function isActive(application?: CrmApplicationSummary): boolean {
  return isOpenStatus(application) && application?.crm?.priority !== "paused";
}

function isOpenStatus(application?: CrmApplicationSummary): boolean {
  return !application || (application.status !== "rejected" && application.status !== "archived");
}

function priority(application?: CrmApplicationSummary): number {
  return application?.crm?.priority === "high" ? 0 : 1;
}

function compareId(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function interviewInstant(value: unknown): number | undefined {
  if (typeof value !== "string" || !isCalendarDate(value.slice(0, 10))) return undefined;
  // An explicit offset is essential: browser-local parsing must not change the agenda.
  if (!/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d+)?)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.test(value)) return undefined;
  const instant = Date.parse(value);
  return Number.isFinite(instant) ? instant : undefined;
}

/**
 * Calendar-day queue: interviews today remain visible throughout the day. Only
 * known scheduled instants are used, never legacy text or registration dates.
 * Pausing hides pending work, while preserving confirmed interview appointments
 * and the activity already recorded. A priority change is not a cancellation.
 */
export function getTodayQueue(data: CrmViewData, today: string = getBerlinDate()): CrmTodayQueue {
  const date = checkedDay(today);
  const actions = new Map<string, CrmQueuedAction>();
  const addAction = (action: CrmAction, fallback?: CrmApplicationSummary) => {
    if (!action?.id || actions.has(action.id)) return;
    actions.set(action.id, { action, ...itemContext(data, action, fallback) });
  };
  for (const action of data.actions) addAction(action);
  for (const application of data.applications) for (const action of application.crm?.actions ?? []) addAction(action, application);
  const pending = [...actions.values()]
    .filter(item => item.action.status === "open" && isCalendarDate(item.action.dueOn) && isActive(item.application))
    .sort((a, b) => compareId(a.action.dueOn, b.action.dueOn) || priority(a.application) - priority(b.application) || compareId(a.action.id, b.action.id));

  const interviews: Array<CrmQueuedInterview & { instant: number }> = [];
  for (const { event, ...context } of eventsWithContext(data)) {
    if (event.type !== "interview_scheduled" || event.voidedAt || !isOpenStatus(context.application) || !isCalendarDate(event.occurredOn)) continue;
    const instant = interviewInstant(event.startsAt);
    if (instant === undefined) continue;
    const interviewDay = getBerlinDate(new Date(instant));
    if (interviewDay >= date) interviews.push({ event, ...context, date: interviewDay, instant });
  }
  interviews.sort((a, b) => a.instant - b.instant || compareId(a.event.id, b.event.id));

  const eligibilityRank = (application: CrmApplicationSummary): number =>
    application.eligibilityStatus === "meets" ? 0 : application.eligibilityStatus === "gaps" ? 2 : 1;
  const roleTypeRank = (application: CrmApplicationSummary): number => {
    switch (application.roleClassificationType) {
      case "coreTarget": return 0;
      case "bridgeRole": return 1;
      case "stabilityRole": return 2;
      case "alternativeRole": return 3;
      case "stretchRole": return 4;
      default: return 1;
    }
  };
  const submitted = firstSubmissions(data);
  const priorityDrafts = data.applications
    .filter(application => ["draft", "reviewed", "exported"].includes(application.status) && isActive(application) && !submitted.has(application.id))
    .sort((a, b) =>
      priority(a) - priority(b) ||
      Number(b.crm?.preparation?.reviewed === true) - Number(a.crm?.preparation?.reviewed === true) ||
      eligibilityRank(a) - eligibilityRank(b) ||
      roleTypeRank(a) - roleTypeRank(b) ||
      (b.fitScore ?? -1) - (a.fitScore ?? -1) ||
      (b.dateModified || "").localeCompare(a.dateModified || "") ||
      compareId(a.id, b.id)
    );

  return {
    date,
    overdueActions: pending.filter(item => item.action.dueOn < date),
    dueTodayActions: pending.filter(item => item.action.dueOn === date),
    upcomingActions: pending.filter(item => item.action.dueOn > date),
    upcomingInterviews: interviews.map(item => ({ event: item.event, date: item.date, application: item.application, contact: item.contact })),
    priorityDrafts,
  };
}

/** Statuses in which an application is still being prepared (not a confirmed send). */
const PREPARATION_STATUSES: ReadonlySet<string> = new Set(["draft", "reviewed", "exported"]);

function byId(a: CrmApplicationSummary, b: CrmApplicationSummary): number {
  return compareId(a.id, b.id);
}

/**
 * Preparation statuses without a confirmed send and without the CRM review mark.
 * The CRM mark (crm.preparation.reviewed) is the authority because document or offer edits
 * reset it; the legacy "reviewed" status alone is not proof of a current review.
 */
export function getPendingReviewApplications(data: CrmViewData): CrmApplicationSummary[] {
  const submitted = firstSubmissions(data);
  return data.applications
    .filter(app => PREPARATION_STATUSES.has(app.status) && !submitted.has(app.id) && app.crm?.preparation?.reviewed !== true)
    .sort(byId);
}

/**
 * Reviewed in the CRM, still in preparation and without a confirmed send event. Legacy
 * applied/interviewing records without a send date are excluded: their status is neither
 * turned into a send nor treated as "not sent".
 */
export function getReviewedUnsentApplications(data: CrmViewData): CrmApplicationSummary[] {
  const submitted = firstSubmissions(data);
  return data.applications
    .filter(app => PREPARATION_STATUSES.has(app.status) && !submitted.has(app.id) && app.crm?.preparation?.reviewed === true)
    .sort(byId);
}

/**
 * Applications with a confirmed (non-voided) send event, still open, that have no open action
 * (application or global, linked by applicationId) and no interview from today onwards.
 * Historical statuses without a send event never appear here.
 */
export function getSentWithoutNextAction(data: CrmViewData, today: string = getBerlinDate()): CrmApplicationSummary[] {
  const date = checkedDay(today);
  const submitted = firstSubmissions(data);
  const withNextStep = new Set<string>();
  for (const action of data.actions) if (action.status === "open" && action.applicationId) withNextStep.add(action.applicationId);
  for (const application of data.applications) {
    if ((application.crm?.actions ?? []).some(action => action.status === "open")) withNextStep.add(application.id);
  }
  for (const { event, application } of eventsWithContext(data)) {
    const applicationId = event.applicationId ?? application?.id;
    if (!applicationId || event.type !== "interview_scheduled" || event.voidedAt) continue;
    const instant = interviewInstant(event.startsAt);
    if (instant !== undefined && getBerlinDate(new Date(instant)) >= date) withNextStep.add(applicationId);
  }
  return data.applications
    .filter(app => submitted.has(app.id) && isOpenStatus(app) && !withNextStep.has(app.id))
    .sort(byId);
}

export interface CrmOperationalViews {
  pendingReview: CrmApplicationSummary[];
  reviewedUnsent: CrmApplicationSummary[];
  sentWithoutNextAction: CrmApplicationSummary[];
}

/** Read-only derived views; the input is never mutated. */
export function getCrmOperationalViews(data: CrmViewData, today: string = getBerlinDate()): CrmOperationalViews {
  return {
    pendingReview: getPendingReviewApplications(data),
    reviewedUnsent: getReviewedUnsentApplications(data),
    sentWithoutNextAction: getSentWithoutNextAction(data, today),
  };
}
