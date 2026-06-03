import { NextRequest, NextResponse } from 'next/server';
import { getOrder, getSettings, updateOrderFields } from '@/lib/firestore';
import { generateVibeImage } from '@/lib/vertex-ai';
import { deleteFromGCS, uploadToGCS } from '@/lib/storage';

const PROXY_PREFIX = '/api/image/';

function extractName(proxyUrl: string | undefined): string | null {
  if (!proxyUrl) return null;
  const idx = proxyUrl.indexOf(PROXY_PREFIX);
  if (idx === -1) return null;
  try {
    return decodeURIComponent(proxyUrl.slice(idx + PROXY_PREFIX.length));
  } catch {
    return proxyUrl.slice(idx + PROXY_PREFIX.length);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const order = await getOrder(id);
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const happyPlace = String(order.happyPlace || '');
    if (!happyPlace) {
      return NextResponse.json({ error: 'Order has no happyPlace' }, { status: 400 });
    }

    const settings = await getSettings().catch(() => null);
    const aspect = settings?.vibeImageAspect ?? '16:9';
    const renderTemplate = settings?.vibePromptTemplate || undefined;
    const moodTemplate = settings?.vibeMoodTemplate || undefined;

    // Fail-fast model fallback inside generateVibeImage means this returns
    // quickly even during a 429 outage (no SDK retry, no backoff). Throws on
    // total failure, so we never overwrite the existing vibe with a blank.
    const buffer = await generateVibeImage(happyPlace, aspect, renderTemplate, moodTemplate);
    const filename = `vibes/order-${id}-${Date.now()}.png`;
    const newUrl = await uploadToGCS(buffer, filename);

    const oldUrl = order.vibeImageUrl as string | undefined;
    await updateOrderFields(id, { vibeImageUrl: newUrl });

    // Best-effort cleanup of the previous vibe file.
    const oldName = extractName(oldUrl);
    if (oldName) {
      deleteFromGCS(oldName).catch((err) => console.warn('Old vibe cleanup failed:', err));
    }

    return NextResponse.json({ vibeImageUrl: newUrl });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('Regenerate vibe error:', error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
