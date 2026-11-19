/**
 * Client-side identity of CRM commands whose result is not yet known.
 *
 * The server deduplicates by commandId, so retrying the same operation must reuse the same ID,
 * even after the dialog was closed and reopened or the tab reloaded. An aborted or failed fetch
 * (or a 5xx) does not prove that the server did not commit, so such operations stay "uncertain".
 * Only a hash of the form content is stored (never notes, names or e-mails); sessionStorage keeps
 * it per tab and memory still protects retries when storage is blocked.
 */

export type CrmOperationState = "in_flight" | "uncertain" | "rejected";
export type CrmOperationOutcome = "saved" | "rejected" | "uncertain";

export interface CrmPendingOperation {
  scope: string;
  type: string;
  contentHash: string;
  commandId: string;
  state: CrmOperationState;
  updatedAt: number;
}

export interface CrmOperationDraft {
  scope: string;
  type: string;
  contentHash: string;
  commandId: string;
  /** True when an earlier attempt with identical content exists and its ID is reused. */
  reused: boolean;
  previousState?: CrmOperationState;
  /** Other in-flight/uncertain operations of the same scope and type, with different content. */
  otherUnresolved: CrmPendingOperation[];
  forceNew: boolean;
}

export interface CrmOperationSettledEvent {
  operation: CrmPendingOperation;
  outcome: CrmOperationOutcome;
  /** The form that started the operation was closed or replaced before the result arrived. */
  detached: boolean;
  status?: number;
}

export interface CrmOperationStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const CRM_PENDING_STORAGE_KEY = "job-app:crm-pending-operations:v1";
const DEFAULT_TTL_MS = 48 * 60 * 60 * 1000;
const MAX_ENTRIES = 100;

export function crmStableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(crmStableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value).filter(([, item]) => item !== undefined).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([key, item]) => `${JSON.stringify(key)}:${crmStableJson(item)}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

function fnv1a(text: string, seed: number): string {
  let hash = seed >>> 0;
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

/**
 * Non-cryptographic content fingerprint. A collision can only make the server answer 409
 * ("command ID already used for a different operation"), never merge two different facts.
 */
export function crmContentHash(content: unknown): string {
  const json = crmStableJson(content);
  return `${fnv1a(json, 0x811c9dc5)}${fnv1a(json, 0x9747b28c)}${fnv1a(`${json.length}:${json}`, 0x01000193)}`;
}

/** 2xx = committed; 4xx = the server answered and refused; 5xx/network = unknown. */
export function classifyCrmStatus(status: number): CrmOperationOutcome {
  if (status >= 200 && status < 300) return "saved";
  if (status >= 400 && status < 500) return "rejected";
  return "uncertain";
}

export function collectCrmCommandIds(groups: ReadonlyArray<ReadonlyArray<{ commandId?: string }> | undefined>): Set<string> {
  const ids = new Set<string>();
  for (const group of groups) for (const item of group ?? []) if (item?.commandId) ids.add(item.commandId);
  return ids;
}

function isEntry(value: unknown): value is CrmPendingOperation {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return typeof item.scope === "string" && typeof item.type === "string" && typeof item.contentHash === "string"
    && typeof item.commandId === "string" && item.commandId.length > 0 && item.commandId.length <= 100
    && (item.state === "in_flight" || item.state === "uncertain" || item.state === "rejected")
    && typeof item.updatedAt === "number" && Number.isFinite(item.updatedAt);
}

function defaultId(): string {
  return globalThis.crypto.randomUUID();
}

export class CrmOperationRegistry {
  private entries: CrmPendingOperation[];
  private readonly listeners = new Set<(event: CrmOperationSettledEvent) => void>();
  private readonly storage: CrmOperationStorage | null;
  private readonly now: () => number;
  private readonly createId: () => string;
  private readonly ttlMs: number;

  constructor(options: { storage?: CrmOperationStorage | null; now?: () => number; createId?: () => string; ttlMs?: number } = {}) {
    this.storage = options.storage ?? null;
    this.now = options.now ?? Date.now;
    this.createId = options.createId ?? defaultId;
    this.ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
    this.entries = this.read();
  }

  /** In-flight entries from an earlier page are unresolved: their request may have committed. */
  private read(): CrmPendingOperation[] {
    let raw: string | null = null;
    try { raw = this.storage?.getItem(CRM_PENDING_STORAGE_KEY) ?? null; } catch { return []; }
    if (!raw) return [];
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      const limit = this.now() - this.ttlMs;
      return parsed.filter(isEntry).filter(item => item.updatedAt >= limit).map(item => ({ ...item, state: item.state === "in_flight" ? "uncertain" : item.state }));
    } catch { return []; }
  }

  private write(): void {
    const limit = this.now() - this.ttlMs;
    this.entries = this.entries.filter(item => item.updatedAt >= limit).slice(-MAX_ENTRIES);
    try {
      if (!this.entries.length) this.storage?.removeItem(CRM_PENDING_STORAGE_KEY);
      else this.storage?.setItem(CRM_PENDING_STORAGE_KEY, JSON.stringify(this.entries));
    } catch { /* Memory still protects retries in this page. */ }
  }

  list(): CrmPendingOperation[] {
    return this.entries.map(item => ({ ...item }));
  }

  /** Unresolved (in flight or uncertain) operations of a scope, optionally of one command type. */
  unresolved(scope: string, type?: string): CrmPendingOperation[] {
    return this.entries.filter(item => item.scope === scope && (!type || item.type === type) && item.state !== "rejected").map(item => ({ ...item }));
  }

  /** Same scope + type + content reuses the stored command ID unless the user declares a new activity. */
  prepare(scope: string, type: string, content: unknown, options: { forceNew?: boolean } = {}): CrmOperationDraft {
    const contentHash = crmContentHash(content);
    const existing = options.forceNew ? undefined : this.entries.find(item => item.scope === scope && item.type === type && item.contentHash === contentHash);
    const otherUnresolved = this.unresolved(scope, type).filter(item => item.contentHash !== contentHash);
    return {
      scope, type, contentHash,
      commandId: existing?.commandId ?? this.createId(),
      reused: Boolean(existing),
      ...(existing ? { previousState: existing.state } : {}),
      otherUnresolved,
      forceNew: options.forceNew === true,
    };
  }

  /** Persists the identity before the request leaves, so a closed dialog cannot lose it. */
  begin(draft: CrmOperationDraft): void {
    this.entries = this.entries.filter(item => item.commandId !== draft.commandId && !(item.scope === draft.scope && item.type === draft.type && item.contentHash === draft.contentHash));
    this.entries.push({ scope: draft.scope, type: draft.type, contentHash: draft.contentHash, commandId: draft.commandId, state: "in_flight", updatedAt: this.now() });
    this.write();
  }

  settle(commandId: string, outcome: CrmOperationOutcome, detail: { detached?: boolean; status?: number } = {}): void {
    const entry = this.entries.find(item => item.commandId === commandId);
    const operation: CrmPendingOperation = entry ? { ...entry } : { scope: "", type: "", contentHash: "", commandId, state: "in_flight", updatedAt: this.now() };
    if (entry) {
      if (outcome === "saved") this.entries = this.entries.filter(item => item !== entry);
      else { entry.state = outcome; entry.updatedAt = this.now(); }
      this.write();
    }
    const event: CrmOperationSettledEvent = { operation, outcome, detached: detail.detached === true, ...(detail.status !== undefined ? { status: detail.status } : {}) };
    for (const listener of [...this.listeners]) {
      try { listener(event); } catch { /* A listener failure must not change the recorded outcome. */ }
    }
  }

  /** Command IDs present in server history were committed: they are no longer uncertain. */
  reconcile(knownCommandIds: ReadonlySet<string>): CrmPendingOperation[] {
    const confirmed = this.entries.filter(item => knownCommandIds.has(item.commandId));
    if (confirmed.length) {
      this.entries = this.entries.filter(item => !knownCommandIds.has(item.commandId));
      this.write();
    }
    return confirmed.map(item => ({ ...item }));
  }

  subscribe(listener: (event: CrmOperationSettledEvent) => void): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }
}

export interface CrmSendResult {
  outcome: CrmOperationOutcome;
  commandId: string;
  status?: number;
  /** Parsed body of a 2xx response; undefined if it could not be read (the command still committed). */
  json?: unknown;
  /** Whether the starting form was still current when the result arrived. */
  attached: boolean;
}

type FetchLike = (input: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<{ status: number; json(): Promise<unknown> }>;

/**
 * Sends one CRM command. The registry, not the component, owns the outcome, so a dialog closed
 * during the request cannot lose its identity, and `isAttached` tells the caller whether it may
 * still touch the form that started it.
 */
export async function sendCrmCommand(registry: CrmOperationRegistry, draft: CrmOperationDraft, options: { endpoint: string; body: unknown; fetchImpl?: FetchLike; isAttached?: () => boolean }): Promise<CrmSendResult> {
  const fetchImpl: FetchLike = options.fetchImpl ?? ((input, init) => fetch(input, init));
  const attached = () => (options.isAttached ? options.isAttached() : true);
  registry.begin(draft);
  let response: { status: number; json(): Promise<unknown> };
  try {
    response = await fetchImpl(options.endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(options.body) });
  } catch {
    const isAttached = attached();
    registry.settle(draft.commandId, "uncertain", { detached: !isAttached });
    return { outcome: "uncertain", commandId: draft.commandId, attached: isAttached };
  }
  const outcome = classifyCrmStatus(response.status);
  let json: unknown;
  if (outcome === "saved") { try { json = await response.json(); } catch { json = undefined; } }
  const isAttached = attached();
  registry.settle(draft.commandId, outcome, { detached: !isAttached, status: response.status });
  return { outcome, commandId: draft.commandId, status: response.status, ...(json !== undefined ? { json } : {}), attached: isAttached };
}

/** Each opened form gets a token; closing or opening another form makes older tokens stale. */
export function createCrmFormGate() {
  let current = 0;
  let open = false;
  return {
    open(): number { current += 1; open = true; return current; },
    close(): void { current += 1; open = false; },
    isCurrent(token: number): boolean { return open && token === current; },
  };
}

/** Closing while a request is in flight needs an explicit confirmation; the identity is kept either way. */
export function crmCloseDecision(state: { saving: boolean; confirmed: boolean }): "close" | "confirm" {
  return state.saving && !state.confirmed ? "confirm" : "close";
}

export function crmApplicationScope(applicationId: string): string {
  return `app:${applicationId}`;
}
export const CRM_GLOBAL_SCOPE = "global";

let shared: CrmOperationRegistry | null = null;

/** Module-level registry shared by every CRM dialog in this tab. */
export function getCrmOperationRegistry(): CrmOperationRegistry {
  if (!shared) {
    let storage: CrmOperationStorage | null = null;
    try { storage = typeof window === "undefined" ? null : window.sessionStorage; } catch { storage = null; }
    shared = new CrmOperationRegistry({ storage });
  }
  return shared;
}

/** Commands that create a new fact or record; repeating them could duplicate history. */
export const CRM_FACT_COMMANDS: ReadonlySet<string> = new Set(["register_application", "record_contact", "record_response", "schedule_interview", "schedule_action", "save_contact"]);

export type CrmSubmissionGuard =
  | { kind: "proceed" }
  /** The same content was confirmed on the server in this session; repeating needs an explicit "distinct activity". */
  | { kind: "already_saved" }
  /** Another attempt of the same kind with different content is still unresolved; check before adding another fact. */
  | { kind: "unresolved_other"; count: number };

/**
 * Decides whether a submission may be sent. Retrying identical content is always allowed (it
 * reuses the command ID); the user can declare a distinct activity, which is never merged.
 */
export function guardCrmSubmission(draft: CrmOperationDraft, options: { confirmedHashes: ReadonlySet<string>; distinctHash?: string | null }): CrmSubmissionGuard {
  if (!CRM_FACT_COMMANDS.has(draft.type) || options.distinctHash === draft.contentHash) return { kind: "proceed" };
  if (!draft.reused && options.confirmedHashes.has(draft.contentHash)) return { kind: "already_saved" };
  if (!draft.reused && draft.otherUnresolved.length) return { kind: "unresolved_other", count: draft.otherUnresolved.length };
  return { kind: "proceed" };
}
