import { NextResponse } from 'next/server';
import { getOrders } from '@/lib/firestore';

export async function GET() {
  try {
    const orders = await getOrders(20);
    return NextResponse.json(orders);
  } catch (error: any) {
    console.error('Fetch orders error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
