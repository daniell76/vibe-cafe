import { NextResponse } from 'next/server';
import { deleteAllOrders } from '@/lib/firestore';
import { deleteAllUnderPrefixes } from '@/lib/storage';

export async function POST() {
  try {
    // 1) Wipe all order docs + reset the order counter.
    const { deletedOrders } = await deleteAllOrders();

    // 2) Wipe every image object in GCS (foam previews, vibe images, any legacy
    //    flat-named files at the root). Passing "" matches the whole bucket.
    const deletedFiles = await deleteAllUnderPrefixes(['preview/', 'vibes/', 'orders/', '']);

    return NextResponse.json({ deletedOrders, deletedFiles });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('Nuke failed:', error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
