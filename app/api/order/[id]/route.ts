import { NextRequest, NextResponse } from 'next/server';
import { updateOrderStatus } from '@/lib/firestore';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { status } = await req.json();

    if (!status) {
      return NextResponse.json({ error: 'Missing status' }, { status: 400 });
    }

    await updateOrderStatus(id, status);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('Update order error:', error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
