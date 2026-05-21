import { NextRequest, NextResponse } from 'next/server';
import { deleteFromGCS } from '@/lib/storage';

const PROXY_PREFIX = '/api/image/';

function extractName(proxyUrl: string): string | null {
  const idx = proxyUrl.indexOf(PROXY_PREFIX);
  if (idx === -1) return null;
  const tail = proxyUrl.slice(idx + PROXY_PREFIX.length);
  try {
    return decodeURIComponent(tail);
  } catch {
    return tail;
  }
}

export async function POST(req: NextRequest) {
  try {
    const { urls } = await req.json();
    if (!Array.isArray(urls)) {
      return NextResponse.json({ error: 'urls must be an array' }, { status: 400 });
    }
    // Only delete files under the preview/ prefix — defensive against
    // a stray order URL ending up in this list.
    const names = urls
      .map(extractName)
      .filter((n): n is string => !!n && n.startsWith('preview/'));
    await Promise.allSettled(names.map((n) => deleteFromGCS(n)));
    return NextResponse.json({ deleted: names.length });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
