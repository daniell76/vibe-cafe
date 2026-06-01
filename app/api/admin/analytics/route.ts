import { NextRequest, NextResponse } from 'next/server';
import { getOrderAnalytics } from '@/lib/firestore';

// GET /api/admin/analytics
//   ?range=today | yesterday | all      (shortcut presets, default today)
//   ?from=YYYY-MM-DD&to=YYYY-MM-DD       (custom inclusive day range)
//
// All day math is in UTC, consistent with getOrders()'s today scope. For the
// europe-west4 deployment that means the "day" rolls over at 01:00/02:00 local
// CET — acceptable for normal cafe hours.

function startOfUtcDay(d: Date): Date {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const range = sp.get('range');
    const fromParam = sp.get('from'); // YYYY-MM-DD
    const toParam = sp.get('to');     // YYYY-MM-DD

    let fromISO: string | null = null;
    let toISO: string | null = null;

    if (fromParam || toParam) {
      // Custom range. `to` is inclusive of the whole selected day, so the
      // exclusive upper bound is the start of the day AFTER `to`.
      if (fromParam) fromISO = `${fromParam}T00:00:00.000Z`;
      if (toParam) {
        const toDay = new Date(`${toParam}T00:00:00.000Z`);
        toDay.setUTCDate(toDay.getUTCDate() + 1);
        toISO = toDay.toISOString();
      }
    } else if (range === 'all') {
      fromISO = null;
      toISO = null;
    } else if (range === 'yesterday') {
      const todayStart = startOfUtcDay(new Date());
      const yesterdayStart = new Date(todayStart);
      yesterdayStart.setUTCDate(yesterdayStart.getUTCDate() - 1);
      fromISO = yesterdayStart.toISOString();
      toISO = todayStart.toISOString();
    } else {
      // default: today
      fromISO = startOfUtcDay(new Date()).toISOString();
      toISO = null;
    }

    const analytics = await getOrderAnalytics(fromISO, toISO);
    return NextResponse.json(analytics);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('Analytics query failed:', error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
