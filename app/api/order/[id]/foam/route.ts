import { NextRequest, NextResponse } from 'next/server';
import { Storage } from '@google-cloud/storage';
import { getOrder } from '@/lib/firestore';

const project = process.env.GOOGLE_CLOUD_PROJECT;
const bucketName = process.env.VIBE_CAFE_BUCKET || 'vibe-cafe-images';

const storage = new Storage({ projectId: project });

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

function inferContentType(name: string): { mime: string; ext: string } {
  const lower = name.toLowerCase();
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return { mime: 'image/jpeg', ext: 'jpg' };
  if (lower.endsWith('.webp')) return { mime: 'image/webp', ext: 'webp' };
  return { mime: 'image/png', ext: 'png' };
}

// Replace path-unsafe characters and trim whitespace.
function safeName(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[^A-Za-z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64) || 'guest';
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const order = await getOrder(id);
    if (!order) return new NextResponse('Order not found', { status: 404 });

    const gcsName = extractName(order.imageUrl as string);
    if (!gcsName) return new NextResponse('Order has no foam image', { status: 404 });

    const file = storage.bucket(bucketName).file(gcsName);
    const [exists] = await file.exists();
    if (!exists) return new NextResponse('Foam image missing in storage', { status: 404 });

    const [buffer] = await file.download();
    const { mime, ext } = inferContentType(gcsName);
    const num = order.orderNumber ? String(order.orderNumber).padStart(3, '0') : 'unknown';
    const name = safeName(String(order.name || 'guest'));
    const downloadName = `${num}-${name}.${ext}`;

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': mime,
        'Content-Disposition': `attachment; filename="${downloadName}"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    console.error('Foam download error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
