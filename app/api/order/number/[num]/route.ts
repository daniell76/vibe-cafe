import { NextRequest, NextResponse } from 'next/server';
import { getOrderByNumber } from '@/lib/firestore';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ num: string }> }
) {
  try {
    const { num } = await params;
    const orderNumber = parseInt(num, 10);

    if (isNaN(orderNumber)) {
      return NextResponse.json({ error: 'Invalid order sequence format' }, { status: 400 });
    }

    const order = await getOrderByNumber(orderNumber);

    if (!order) {
      return NextResponse.json({ error: 'Order sequence reference not found' }, { status: 404 });
    }

    return NextResponse.json(order);
  } catch (error) {
    console.error('Lookup sequence handler exception:', error);
    return NextResponse.json({ error: 'Internal server mapping error' }, { status: 500 });
  }
}
