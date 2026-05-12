import { NextRequest, NextResponse } from 'next/server';
import { getOrder, deleteOrder } from '@/lib/firestore';
import { deleteFromGCS } from '@/lib/storage';

export async function POST(req: NextRequest) {
  try {
    const { ids } = await req.json();

    if (!ids || !Array.isArray(ids)) {
      return NextResponse.json({ error: 'Missing or invalid order IDs' }, { status: 400 });
    }

    const results = await Promise.all(ids.map(async (id) => {
      try {
        // 1. Get order metadata to find the image filename
        const order = await getOrder(id);
        if (!order) return { id, success: false, reason: 'Not found' };

        // 2. Extract filename from imageUrl (format: /api/image/order-XXXX.png)
        const imageUrl = order.imageUrl as string;
        const filename = imageUrl.split('/').pop();

        if (filename) {
          // 3. Delete from GCS
          await deleteFromGCS(filename);
        }

        // 4. Delete from Firestore
        await deleteOrder(id);
        return { id, success: true };
      } catch (err) {
        console.error(`Error deleting order ${id}:`, err);
        return { id, success: false, error: String(err) };
      }
    }));

    return NextResponse.json({ results });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('Bulk delete error:', error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
