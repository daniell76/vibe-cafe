import { NextResponse } from 'next/server';
import { getOrders } from '@/lib/firestore';

export async function GET() {
  try {
    const orders = await getOrders(20);
    return NextResponse.json(orders);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('Fetch orders error:', error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
