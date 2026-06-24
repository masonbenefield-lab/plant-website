// Day-boundary helpers for the care schedule. The server runs in UTC, but care
// "due dates" are date-only and must be evaluated against the user's local day,
// not UTC — otherwise US users see the schedule roll over a day early each
// evening. We compute "today" as a YYYY-MM-DD string in the user's IANA zone.

// Fallback when a user's timezone hasn't been captured yet. US-centric since the
// marketplace is US-only; far better than UTC for the brief pre-capture window.
export const DEFAULT_TZ = "America/Chicago";

/** Current hour (0–23) in the given IANA timezone. */
export function hourInTz(timezone: string | null | undefined): number {
  const tz = timezone || DEFAULT_TZ;
  try {
    const h = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "2-digit", hour12: false }).format(new Date());
    return parseInt(h, 10) % 24;
  } catch {
    return new Date().getUTCHours();
  }
}

/** Today's date as "YYYY-MM-DD" in the given IANA timezone. */
export function todayStrInTz(timezone: string | null | undefined): string {
  const tz = timezone || DEFAULT_TZ;
  try {
    // en-CA formats as YYYY-MM-DD.
    return new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());
  } catch {
    return new Intl.DateTimeFormat("en-CA", { timeZone: DEFAULT_TZ }).format(new Date());
  }
}

/**
 * A Date pinned to local-midnight of `dateStr` (date-only). Date-only math
 * (due-date diffs) anchors every date string to the same midnight frame, so
 * day differences come out correct regardless of server zone.
 */
export function midnight(dateStr: string): Date {
  const d = new Date(dateStr + "T00:00:00");
  d.setHours(0, 0, 0, 0);
  return d;
}
