import { NextRequest, NextResponse } from 'next/server';
import { optimizePrompt, generateFoamArt } from '@/lib/vertex-ai';
import { uploadToGCS, deleteFromGCS } from '@/lib/storage';
import { saveOrder, getNextOrderNumber, getSettings } from '@/lib/firestore';

const PROXY_PREFIX = '/api/image/';

function extractGcsName(proxyUrl: string | undefined): string | null {
  if (!proxyUrl) return null;
  const idx = proxyUrl.indexOf(PROXY_PREFIX);
  if (idx === -1) return null;
  const tail = proxyUrl.slice(idx + PROXY_PREFIX.length);
  try {
    return decodeURIComponent(tail);
  } catch {
    return tail;
  }
}

async function cleanupUnpicked(urls: string[] | undefined) {
  if (!Array.isArray(urls) || urls.length === 0) return;
  await Promise.allSettled(
    urls
      .map(extractGcsName)
      .filter((n): n is string => !!n)
      .map((name) => deleteFromGCS(name)),
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      name,
      coffeeOrder,
      milk,
      flavor,
      additions,
      extraShots,
      happyPlace,
      imageUrl: selectedImageUrl,
      vibeImageUrl,
      unpickedImageUrls,
      artLabel,
    } = body;

    if (!name || !coffeeOrder || !happyPlace) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    let imageUrl = selectedImageUrl as string | undefined;

    // Legacy path: no preselected art — generate on the fly.
    if (!imageUrl) {
      const settings = await getSettings().catch(() => null);
      const customPromptOverride = settings?.promptTemplate;
      const optimizedPrompt = await optimizePrompt(happyPlace);
      const imageBuffer = await generateFoamArt(optimizedPrompt, customPromptOverride || undefined);
      const filename = `order-${Date.now()}.png`;
      imageUrl = await uploadToGCS(imageBuffer, filename);
    }

    const orderNumber = await getNextOrderNumber();

    const orderId = await saveOrder({
      name,
      coffeeOrder,
      milk: milk || 'None',
      flavor: flavor || 'None',
      additions: Array.isArray(additions) ? additions : undefined,
      extraShots: typeof extraShots === 'number' && extraShots > 0 ? extraShots : undefined,
      artLabel: artLabel || undefined,
      happyPlace,
      imageUrl: imageUrl!,
      vibeImageUrl: vibeImageUrl || undefined,
      orderNumber,
    });

    // Best-effort cleanup of the 3 unpicked preview foams.
    cleanupUnpicked(unpickedImageUrls).catch((err) => console.warn('Cleanup failed:', err));

    return NextResponse.json({ orderId, orderNumber, imageUrl, vibeImageUrl }, { status: 201 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('Order processing error:', error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
