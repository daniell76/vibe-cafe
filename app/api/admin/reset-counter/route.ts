import { NextResponse } from 'next/server';
import { resetOrderCounter } from '@/lib/firestore';

export async function POST() {
  try {
    await resetOrderCounter();
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('Reset counter failed:', error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
