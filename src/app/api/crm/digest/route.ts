import { NextResponse } from "next/server";
import { guardApiRequest } from "@/lib/requestSecurity";
import { apiError } from "@/lib/apiErrors";
import { getCrmOverview } from "@/lib/crmServer";
import { getCrmDaySummary, getCrmOperationalViews, getLocalCrmDate, getSentWithoutNextAction, getTodayQueue } from "@/lib/crmView";
import { getAppTimeZone } from "@/lib/timeZone";

/** Local-only daily CRM digest for follow-up notifications (read-only). */
export async function GET(request: Request) {
  const denied = guardApiRequest(request); if (denied) return denied;
  try {
    const timeZone = getAppTimeZone();
    const today = getLocalCrmDate(new Date(), timeZone);
    const overview = getCrmOverview();
    const daily = getCrmDaySummary(overview, today);
    const queue = getTodayQueue(overview, today);
    const views = getCrmOperationalViews(overview, today);
    const unconfirmedApplied = overview.applications.filter(
      (app) => ["applied", "interviewing", "offered"].includes(app.status) && !(app.crm?.events || []).some((e) => e.type === "application_sent" && !e.voidedAt)
    );
    return NextResponse.json({
      date: today,
      timeZone,
      daily,
      overdueCount: queue.overdueActions.length,
      dueTodayCount: queue.dueTodayActions.length,
      upcomingInterviewsCount: queue.upcomingInterviews.length,
      sentWithoutNextActionCount: getSentWithoutNextAction(overview, today).length,
      unconfirmedAppliedCount: unconfirmedApplied.length,
      topDrafts: queue.priorityDrafts.slice(0, 5),
      overdueActions: queue.overdueActions,
      dueTodayActions: queue.dueTodayActions,
      sentWithoutNextAction: views.sentWithoutNextAction,
      unconfirmedApplied,
    });
  } catch (err) {
    return apiError(err);
  }
}
