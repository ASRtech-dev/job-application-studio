import { z } from "zod";

export const CrmStatusSchema = z.enum(["draft", "applied", "interviewing", "offered", "rejected", "archived", "reviewed", "exported"]);
export const CrmPrioritySchema = z.enum(["normal", "high", "paused"]);
export const CrmDaySchema = z.iso.date();
const InstantSchema = z.iso.datetime({ offset: true });
const IdSchema = z.string().trim().min(1).max(100);
const NoteSchema = z.string().max(10000);
/** Opaque reference to an immutable export delivery (T03). Absent means the sent documents are unknown. */
export const CrmDeliveryIdSchema = z.string().min(1).max(128).regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/);

/** Delivery choices passed to the send dialog by the owner of the delivery store. */
export interface CrmDeliveryOption { id: string; label: string; exportedAt: string; files: string[] }

export const CrmEventSchema = z.object({
  id: IdSchema,
  type: z.enum(["application_sent", "contact_recorded", "response_recorded", "interview_scheduled", "status_changed", "action_scheduled", "action_completed", "preparation_reviewed", "priority_changed", "goals_updated", "contact_saved", "event_voided", "action_rescheduled", "action_cancelled"]),
  occurredOn: CrmDaySchema,
  registeredAt: InstantSchema,
  applicationId: IdSchema.optional(),
  contactId: IdSchema.optional(),
  note: NoteSchema.optional(),
  startsAt: InstantSchema.optional(),
  fromStatus: CrmStatusSchema.optional(),
  toStatus: CrmStatusSchema.optional(),
  commandId: IdSchema.optional(),
  commandFingerprint: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  voidedAt: InstantSchema.optional(),
  relatedEventId: IdSchema.optional(),
  /** Action audit entries: which action changed and, for a reschedule, its previous and new due day. */
  actionId: IdSchema.optional(),
  previousDueOn: CrmDaySchema.optional(),
  dueOn: CrmDaySchema.optional(),
  /** Only on application_sent: the delivery the user confirmed; absent = documents unknown, never reconstructed. */
  deliveryId: CrmDeliveryIdSchema.optional(),
});
export type CrmEvent = z.infer<typeof CrmEventSchema>;

export const CrmActionSchema = z.object({
  id: IdSchema,
  title: z.string().trim().min(1).max(250),
  dueOn: CrmDaySchema,
  status: z.enum(["open", "completed", "cancelled"]),
  kind: z.enum(["follow_up", "contact", "interview_prep", "review", "other"]).default("follow_up"),
  createdAt: InstantSchema,
  completedAt: InstantSchema.optional(),
  cancelledAt: InstantSchema.optional(),
  applicationId: IdSchema.optional(),
  contactId: IdSchema.optional(),
  note: NoteSchema.optional(),
});
export type CrmAction = z.infer<typeof CrmActionSchema>;

export const CrmContactSchema = z.object({
  id: IdSchema,
  name: z.string().trim().min(1).max(200),
  organization: z.string().max(250).optional(),
  agency: z.string().max(250).optional(),
  email: z.union([z.literal(""), z.email()]).optional(),
  linkedin: z.union([z.literal(""), z.url({ protocol: /^https?$/ })]).optional(),
  notes: NoteSchema.optional(),
});
export type CrmContact = z.infer<typeof CrmContactSchema>;

export const ApplicationCrmSchema = z.object({
  events: z.array(CrmEventSchema).default([]),
  actions: z.array(CrmActionSchema).default([]),
  preparation: z.object({ reviewed: z.boolean(), reviewedAt: InstantSchema.optional() }).optional(),
  priority: CrmPrioritySchema.optional(),
});
export type ApplicationCrm = z.infer<typeof ApplicationCrmSchema>;

export const CrmGoalsSchema = z.object({
  applications: z.number().int().min(0).max(100),
  contacts: z.number().int().min(0).max(100),
});
export const CrmStoreSchema = z.object({
  revision: z.number().int().nonnegative(),
  goals: CrmGoalsSchema,
  contacts: z.array(CrmContactSchema),
  events: z.array(CrmEventSchema),
  actions: z.array(CrmActionSchema),
});
export type CrmStore = z.infer<typeof CrmStoreSchema>;

const commandBase = { revision: z.number().int().nonnegative(), commandId: IdSchema };
const actionChange = {
  reschedule: { actionId: IdSchema, dueOn: CrmDaySchema, note: NoteSchema.optional() },
  cancel: { actionId: IdSchema, note: NoteSchema.optional() },
};
const actionInput = { title: z.string().trim().min(1).max(250), dueOn: CrmDaySchema, kind: CrmActionSchema.shape.kind.optional(), note: NoteSchema.optional() };
export const ApplicationCrmCommandSchema = z.discriminatedUnion("type", [
  z.object({ ...commandBase, type: z.literal("register_application"), sentOn: CrmDaySchema, deliveryId: CrmDeliveryIdSchema.optional() }).strict(),
  z.object({ ...commandBase, type: z.literal("record_contact"), occurredOn: CrmDaySchema, contactId: IdSchema.optional(), note: NoteSchema.optional() }).strict(),
  z.object({ ...commandBase, type: z.literal("record_response"), occurredOn: CrmDaySchema, note: NoteSchema.optional() }).strict(),
  z.object({ ...commandBase, type: z.literal("schedule_action"), ...actionInput, contactId: IdSchema.optional() }).strict(),
  z.object({ ...commandBase, type: z.literal("complete_action"), actionId: IdSchema }).strict(),
  z.object({ ...commandBase, type: z.literal("reschedule_action"), ...actionChange.reschedule }).strict(),
  z.object({ ...commandBase, type: z.literal("cancel_action"), ...actionChange.cancel }).strict(),
  z.object({ ...commandBase, type: z.literal("schedule_interview"), startsAt: InstantSchema, note: NoteSchema.optional() }).strict(),
  z.object({ ...commandBase, type: z.literal("set_preparation"), reviewed: z.boolean() }).strict(),
  z.object({ ...commandBase, type: z.literal("set_priority"), value: CrmPrioritySchema }).strict(),
  z.object({ ...commandBase, type: z.literal("change_status"), status: CrmStatusSchema }).strict(),
  z.object({ ...commandBase, type: z.literal("void_event"), eventId: IdSchema, note: z.string().trim().min(1).max(10000) }).strict(),
]);
export type ApplicationCrmCommand = z.infer<typeof ApplicationCrmCommandSchema>;

export const GlobalCrmCommandSchema = z.discriminatedUnion("type", [
  z.object({ ...commandBase, type: z.literal("update_goals"), goals: CrmGoalsSchema }).strict(),
  z.object({ ...commandBase, type: z.literal("save_contact"), contact: CrmContactSchema.omit({ id: true }).extend({ id: IdSchema.optional() }).strict() }).strict(),
  z.object({ ...commandBase, type: z.literal("record_contact"), occurredOn: CrmDaySchema, contactId: IdSchema.optional(), applicationId: IdSchema.optional(), note: NoteSchema.optional() }).strict(),
  z.object({ ...commandBase, type: z.literal("schedule_action"), ...actionInput, applicationId: IdSchema.optional(), contactId: IdSchema.optional() }).strict(),
  z.object({ ...commandBase, type: z.literal("complete_action"), actionId: IdSchema }).strict(),
  z.object({ ...commandBase, type: z.literal("reschedule_action"), ...actionChange.reschedule }).strict(),
  z.object({ ...commandBase, type: z.literal("cancel_action"), ...actionChange.cancel }).strict(),
  z.object({ ...commandBase, type: z.literal("void_event"), eventId: IdSchema, note: z.string().trim().min(1).max(10000) }).strict(),
]);
export type GlobalCrmCommand = z.infer<typeof GlobalCrmCommandSchema>;
