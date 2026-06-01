// Timezone-aware day-boundary helpers.
//
// The backend always stores UTC ISO timestamps (createdAt). These helpers
// compute the UTC instants that bracket a *calendar day in a configured IANA
// timezone*, so "today" means the operator's local day, not the UTC day.
// With the default tz of "UTC" every function is a no-op vs the old behaviour,
// so existing deployments are unaffected until an operator sets a zone.
//
// No date library — we lean on Intl.DateTimeFormat, which ships with Node and
// every browser and handles DST correctly.

// How far `tz` is ahead of UTC, in ms, at the given instant (DST-aware).
function tzOffsetMs(tz: string, at: Date): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const p = Object.fromEntries(dtf.formatToParts(at).map((x) => [x.type, x.value]));
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return asUtc - at.getTime();
}

// UTC instant of local midnight for the calendar day (y, m=1-12, d) in tz.
// Date.UTC normalises out-of-range d (e.g. 32 → next month) so callers can
// add/subtract days freely.
function zonedMidnightUtc(tz: string, y: number, m: number, d: number): Date {
  const guess = Date.UTC(y, m - 1, d, 0, 0, 0);
  const offset = tzOffsetMs(tz, new Date(guess));
  return new Date(guess - offset);
}

// The local calendar Y-M-D in tz for a given instant.
function localYmd(tz: string, at: Date): { y: number; m: number; d: number } {
  const dtf = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
  });
  const p = Object.fromEntries(dtf.formatToParts(at).map((x) => [x.type, x.value]));
  return { y: +p.year, m: +p.month, d: +p.day };
}

export function isValidTimeZone(tz: string): boolean {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

// Falls back to 'UTC' for missing/invalid input so callers never throw.
export function safeTz(tz: string | undefined | null): string {
  return tz && isValidTimeZone(tz) ? tz : 'UTC';
}

// Start of "today" (local to tz) as a UTC Date.
export function startOfTodayUtc(tz: string, now = new Date()): Date {
  const { y, m, d } = localYmd(tz, now);
  return zonedMidnightUtc(tz, y, m, d);
}

// Start of the local day `dayYmd` (YYYY-MM-DD) as a UTC Date.
export function startOfDayUtc(tz: string, dayYmd: string): Date {
  const [y, m, d] = dayYmd.split('-').map(Number);
  return zonedMidnightUtc(tz, y, m, d);
}

// Shift a UTC instant by n local days (n may be negative), returning the UTC
// instant of that local midnight.
export function addLocalDaysUtc(tz: string, base: Date, n: number): Date {
  const { y, m, d } = localYmd(tz, base);
  return zonedMidnightUtc(tz, y, m, d + n);
}
