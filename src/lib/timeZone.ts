/**
 * Local-time helpers that honor an optional APP_TIMEZONE / TZ override and
 * otherwise use the runtime's local system timezone — never hardcoded to one city.
 */
export function getAppTimeZone(): string {
  const configured =
    (typeof process !== "undefined" && (process.env?.APP_TIMEZONE || process.env?.TZ)) || "";
  if (configured.trim()) {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: configured.trim() }).format(new Date());
      return configured.trim();
    } catch {
      // Fall through to runtime default timezone if env value is invalid.
    }
  }
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/**
 * Returns YYYY-MM-DD in the active local timezone (avoids UTC off-by-one mismatches).
 */
export function getLocalIsoDate(now: Date = new Date(), timeZone: string = getAppTimeZone()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/**
 * Formats an ISO timestamp or Date in English (en-US by default) using the active timezone.
 */
export function formatLocalDateTime(
  value: Date | string,
  locale = "en-US",
  timeZone: string = getAppTimeZone()
): string {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}
