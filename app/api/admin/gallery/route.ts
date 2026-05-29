import { NextRequest, NextResponse } from 'next/server';
import { listImagesUnderPrefixes } from '@/lib/storage';
import { getOrders } from '@/lib/firestore';

// GET /api/admin/gallery
//   ?view=foam | vibe | grouped     (default: foam)
//   ?offset=0 & limit=24             (server-side pagination, max limit 60)
//   ?all=1                           (foam/vibe views only — skip today filter)
//
// Returns { view, total, offset, limit, items } so the client can render a
// "Load more" CTA. We never return more than `limit` items per request, and
// we only return metadata (name/url/size/timestamps) — no image bytes — so
// even a 1000-order session stays cheap.

const MAX_LIMIT = 60;
const DEFAULT_LIMIT = 24;

interface FlatItem {
  name: string;
  url: string;
  size: number;
  createdAt: string;
}

interface GroupedItem {
  orderId: string;
  orderNumber?: number;
  customerName: string;
  createdAt: string;
  foamUrl?: string;
  vibeUrl?: string;
}

function intParam(value: string | null, fallback: number): number {
  const n = parseInt(value || '', 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function todayCutoffISO(): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const view = (sp.get('view') || 'foam') as 'foam' | 'vibe' | 'grouped';
    const offset = intParam(sp.get('offset'), 0);
    const limit = Math.min(MAX_LIMIT, intParam(sp.get('limit'), DEFAULT_LIMIT));
    const showAll = sp.get('all') === '1';

    if (view === 'grouped') {
      // Orders already today-scoped by getOrders().
      const orders = await getOrders();
      const items: GroupedItem[] = orders.map((o) => ({
        orderId: String(o.id ?? ''),
        orderNumber: typeof o.orderNumber === 'number' ? o.orderNumber : undefined,
        customerName: String(o.name ?? ''),
        createdAt: String(o.createdAt ?? ''),
        foamUrl: typeof o.imageUrl === 'string' && o.imageUrl ? o.imageUrl : undefined,
        vibeUrl: typeof o.vibeImageUrl === 'string' && o.vibeImageUrl ? o.vibeImageUrl : undefined,
      }));
      // Newest order first.
      items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      return NextResponse.json({
        view,
        total: items.length,
        offset,
        limit,
        items: items.slice(offset, offset + limit),
      });
    }

    // foam | vibe flat views — list from GCS by prefix.
    const prefixes = view === 'vibe'
      ? ['vibes/', 'preview/vibe-']
      : ['orders/', 'preview/foam-'];
    let images: FlatItem[] = await listImagesUnderPrefixes(prefixes, 5000);

    if (!showAll) {
      const cutoff = todayCutoffISO();
      images = images.filter((img) => img.createdAt >= cutoff);
    }

    return NextResponse.json({
      view,
      total: images.length,
      offset,
      limit,
      items: images.slice(offset, offset + limit),
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('Gallery list failed:', error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
