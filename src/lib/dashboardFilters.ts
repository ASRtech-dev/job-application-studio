import type { ApplicationSummary } from "./schemas";

export type DashboardSortBy = "dateModified" | "fitScoreDesc" | "fitScoreAsc" | "companyAsc";

export type DashboardView =
  | "all"
  | "pendingReview"
  | "reviewedUnsent"
  | "sentWithoutNextAction"
  | "unconfirmedApplied"
  | "readyToSend"
  | "staleDrafts48h"
  | "sentWithoutContact"
  | "noResponse5d";

export interface DashboardFilterOptions {
  /** Read-only CRM view; when set, only these application ids are shown. */
  viewIds?: ReadonlySet<string> | null;
  searchQuery: string;
  statusFilter: string;
  languageFilter: string;
  roleTypeFilter: string;
  fitDecisionFilter: string;
  sortBy: DashboardSortBy;
}

/**
 * Filters and sorts Dashboard application summaries by pipeline status, language, role tier, fit decision, and search text.
 */
export function filterAndSortApplications(
  applications: ApplicationSummary[],
  options: DashboardFilterOptions
): ApplicationSummary[] {
  const query = options.searchQuery.trim().toLowerCase();

  const filtered = applications.filter((app) => {
    if (options.viewIds && !options.viewIds.has(app.id)) return false;
    if (options.statusFilter !== "all" && app.status !== options.statusFilter) {
      return false;
    }
    if (options.languageFilter !== "all" && app.language !== options.languageFilter) {
      return false;
    }
    if (
      options.roleTypeFilter !== "all" &&
      (app.roleClassification?.type || "coreTarget") !== options.roleTypeFilter
    ) {
      return false;
    }
    if (
      options.fitDecisionFilter !== "all" &&
      (app.fitAssessment?.applyOrSkip || "Apply selectively") !== options.fitDecisionFilter
    ) {
      return false;
    }
    if (query) {
      const haystack = [
        app.company,
        app.roleTitle,
        app.jobLocation || "",
        app.workModel || "",
        app.roleClassification?.roleFamily || "",
        app.notes || "",
        app.recruiterContact || "",
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(query)) {
        return false;
      }
    }
    return true;
  });

  return [...filtered].sort((a, b) => {
    const timeDiff = new Date(b.dateModified).getTime() - new Date(a.dateModified).getTime();

    if (options.sortBy === "fitScoreDesc") {
      const scoreA = a.fitAssessment?.scoreOutOf10 ?? -1;
      const scoreB = b.fitAssessment?.scoreOutOf10 ?? -1;
      if (scoreB !== scoreA) return scoreB - scoreA;
      return timeDiff;
    }
    if (options.sortBy === "fitScoreAsc") {
      const scoreA = a.fitAssessment?.scoreOutOf10 ?? 999;
      const scoreB = b.fitAssessment?.scoreOutOf10 ?? 999;
      if (scoreA !== scoreB) return scoreA - scoreB;
      return timeDiff;
    }
    if (options.sortBy === "companyAsc") {
      const cmp = (a.company || "").localeCompare(b.company || "");
      return cmp !== 0 ? cmp : timeDiff;
    }
    return timeDiff;
  });
}

export const DASHBOARD_FILTERS_KEY = "jas_dashboard_filters_v1";

export interface SavedDashboardFilters {
  view: DashboardView;
  searchQuery: string;
  statusFilter: string;
  languageFilter: string;
  roleTypeFilter: string;
  fitDecisionFilter: string;
  sortBy: DashboardSortBy;
}

export const DEFAULT_DASHBOARD_FILTERS: SavedDashboardFilters = {
  view: "all", searchQuery: "", statusFilter: "all", languageFilter: "all", roleTypeFilter: "all", fitDecisionFilter: "all", sortBy: "dateModified",
};

const VIEWS: DashboardView[] = [
  "all",
  "pendingReview",
  "reviewedUnsent",
  "sentWithoutNextAction",
  "unconfirmedApplied",
  "readyToSend",
  "staleDrafts48h",
  "sentWithoutContact",
  "noResponse5d",
];
const SORTS: DashboardSortBy[] = ["dateModified", "fitScoreDesc", "fitScoreAsc", "companyAsc"];
const STATUSES = ["all", "draft", "reviewed", "exported", "applied", "interviewing", "offered", "rejected", "archived"];
const LANGUAGES = ["all", "English", "German", "Spanish"];
const ROLE_TYPES = ["all", "coreTarget", "bridgeRole", "stretchRole", "stabilityRole", "alternativeRole"];
const DECISIONS = ["all", "Apply", "Apply selectively", "Skip"];

/** Restores saved filters; unknown or damaged values fall back to defaults field by field. */
export function parseSavedDashboardFilters(text: string | null): SavedDashboardFilters {
  let raw: Record<string, unknown> = {};
  try { const parsed = JSON.parse(text || "{}"); if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) raw = parsed; } catch { /* defaults */ }
  const pick = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T => typeof value === "string" && (allowed as readonly string[]).includes(value) ? value as T : fallback;
  return {
    view: pick(raw.view, VIEWS, "all"),
    searchQuery: typeof raw.searchQuery === "string" ? raw.searchQuery.slice(0, 200) : "",
    statusFilter: pick(raw.statusFilter, STATUSES, "all"),
    languageFilter: pick(raw.languageFilter, LANGUAGES, "all"),
    roleTypeFilter: pick(raw.roleTypeFilter, ROLE_TYPES, "all"),
    fitDecisionFilter: pick(raw.fitDecisionFilter, DECISIONS, "all"),
    sortBy: pick(raw.sortBy, SORTS, "dateModified"),
  };
}

export interface FunnelAnalyticsSummary {
  totalReal: number;
  appliedUnique: number;
  applied7d: number;
  withConfirmedSend: number;
  withOutreachOrContact: number;
  responsesOrInterviews: number;
  duplicateCompanies: Array<{ company: string; count: number }>;
  byLanguage: Array<{ language: string; total: number; applied: number }>;
}

/** Computes operational view filters not natively indexed in CrmOperationalViews. */
export function computeDashboardViewIds(
  applications: ApplicationSummary[],
  view: DashboardView,
  crmIds: ReadonlySet<string> | null,
  nowMs: number = Date.now()
): ReadonlySet<string> | null {
  if (view === "all") return null;
  if (view === "pendingReview" || view === "reviewedUnsent" || view === "sentWithoutNextAction") {
    return crmIds;
  }
  const DAY_MS = 24 * 60 * 60 * 1000;
  const ids = new Set<string>();
  for (const app of applications) {
    if (view === "readyToSend") {
      const score = app.fitAssessment?.scoreOutOf10 ?? 0;
      const type = app.roleClassification?.type;
      const isTarget = type === "coreTarget" || type === "bridgeRole";
      const meets = app.crmSummary?.eligibility === "meets" || app.crmSummary?.preparationReviewed === true;
      if (["draft", "reviewed", "exported"].includes(app.status) && isTarget && meets && score >= 7.5) {
        ids.add(app.id);
      }
    } else if (view === "staleDrafts48h") {
      const modMs = Date.parse(app.dateModified);
      if (["draft", "reviewed", "exported"].includes(app.status) && Number.isFinite(modMs) && nowMs - modMs > 2 * DAY_MS) {
        ids.add(app.id);
      }
    } else if (view === "sentWithoutContact") {
      if (["applied", "interviewing"].includes(app.status) && !app.recruiterContact?.trim()) {
        ids.add(app.id);
      }
    } else if (view === "noResponse5d") {
      const refDate = app.crmSummary?.sentOn ? Date.parse(`${app.crmSummary.sentOn}T12:00:00Z`) : Date.parse(app.dateModified);
      if (app.status === "applied" && Number.isFinite(refDate) && nowMs - refDate > 5 * DAY_MS) {
        ids.add(app.id);
      }
    } else if (view === "unconfirmedApplied") {
      if (["applied", "interviewing", "offered"].includes(app.status) && !app.crmSummary?.sentOn) {
        ids.add(app.id);
      }
    }
  }
  return ids;
}

/** Computes funnel conversion breakdown & company duplicate alerts from application summaries. */
export function computeDashboardFunnelAnalytics(applications: ApplicationSummary[], nowMs: number = Date.now()): FunnelAnalyticsSummary {
  const realApps = applications.filter((a) => a.status !== "archived");
  const activeOrSent = realApps.filter((a) => ["applied", "interviewing", "offered", "rejected"].includes(a.status));
  const companyMap = new Map<string, number>();
  for (const app of activeOrSent) {
    const key = `${app.company.trim().toLowerCase()}||${app.roleTitle.trim().toLowerCase()}`;
    companyMap.set(key, (companyMap.get(key) || 0) + 1);
  }
  const duplicateCompanies = [...companyMap.entries()]
    .filter(([, count]) => count > 1)
    .map(([key, count]) => ({ company: key.split("||")[0], count }));

  const DAY_MS = 24 * 60 * 60 * 1000;
  const applied7d = activeOrSent.filter((a) => {
    const ts = Date.parse(a.crmSummary?.sentOn ? `${a.crmSummary.sentOn}T12:00:00Z` : a.dateCreated);
    return Number.isFinite(ts) && nowMs - ts <= 7 * DAY_MS;
  }).length;
  const withConfirmedSend = activeOrSent.filter((a) => Boolean(a.crmSummary?.sentOn)).length;
  const withOutreachOrContact = activeOrSent.filter((a) => Boolean(a.recruiterContact?.trim())).length;
  const responsesOrInterviews = realApps.filter((a) => a.status === "interviewing" || a.status === "offered").length;

  const languageStats = new Map<string, { total: number; applied: number }>();
  for (const a of realApps) {
    const key = a.language || "English";
    const cur = languageStats.get(key) || { total: 0, applied: 0 };
    cur.total++;
    if (["applied", "interviewing", "offered"].includes(a.status)) cur.applied++;
    languageStats.set(key, cur);
  }
  const byLanguage = [...languageStats.entries()].map(([language, stats]) => ({ language, ...stats }));

  return {
    totalReal: realApps.length,
    appliedUnique: activeOrSent.length,
    applied7d,
    withConfirmedSend,
    withOutreachOrContact,
    responsesOrInterviews,
    duplicateCompanies,
    byLanguage,
  };
}
