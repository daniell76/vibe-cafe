import { NextRequest, NextResponse } from 'next/server';
import { listImagesUnderPrefixes } from '@/lib/storage';

// Lists images from GCS for the admin Gallery section (feedback item #10).
// Default scope: today only — pass ?all=1 to include the full bucket history.
export async function GET(req: NextRequest) {
  try {
    const showAll = req.nextUrl.searchParams.get('all') === '1';
    const images = await listImagesUnderPrefixes(['orders/', 'vibes/', 'preview/']);
    if (showAll) return NextResponse.json({ images });

    const startOfTodayUtc = new Date();
    startOfTodayUtc.setUTCHours(0, 0, 0, 0);
    const cutoff = startOfTodayUtc.toISOString();
    const todayOnly = images.filter((img) => img.createdAt >= cutoff);
    return NextResponse.json({ images: todayOnly });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('Gallery list failed:', error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
