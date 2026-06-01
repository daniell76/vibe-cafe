import { NextRequest, NextResponse } from 'next/server';
import { getOrderAnalytics, getSettings } from '@/lib/firestore';
import { safeTz, startOfTodayUtc, startOfDayUtc, addLocalDaysUtc } from '@/lib/timezone';

// GET /api/admin/analytics
//   ?range=today | yesterday | all      (shortcut presets, default today)
//   ?from=YYYY-MM-DD&to=YYYY-MM-DD       (custom inclusive day range)
//
// Day boundaries follow the configured IANA timezone (settings.timezone,
// default UTC), so "today" is the operator's local calendar day, not the UTC
// day. The stored timestamps remain UTC.

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const range = sp.get('range');
    const fromParam = sp.get('from'); // YYYY-MM-DD (local to tz)
    const toParam = sp.get('to');     // YYYY-MM-DD (local to tz)

    const tz = safeTz((await getSettings()).timezone);

    let fromISO: string | null = null;
    let toISO: string | null = null;

    if (fromParam || toParam) {
      // Custom range. `to` is inclusive of the whole selected local day, so
      // the exclusive upper bound is the start of the day AFTER `to`.
      if (fromParam) fromISO = startOfDayUtc(tz, fromParam).toISOString();
      if (toParam) {
        const toStart = startOfDayUtc(tz, toParam);
        toISO = addLocalDaysUtc(tz, toStart, 1).toISOString();
      }
    } else if (range === 'all') {
      fromISO = null;
      toISO = null;
    } else if (range === 'yesterday') {
      const todayStart = startOfTodayUtc(tz);
      fromISO = addLocalDaysUtc(tz, todayStart, -1).toISOString();
      toISO = todayStart.toISOString();
    } else {
      // default: today
      fromISO = startOfTodayUtc(tz).toISOString();
      toISO = null;
    }

    const analytics = await getOrderAnalytics(fromISO, toISO);
    return NextResponse.json({ ...analytics, timezone: tz });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('Analytics query failed:', error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
