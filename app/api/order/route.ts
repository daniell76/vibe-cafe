import { NextRequest, NextResponse } from 'next/server';
import { optimizePrompt, generateFoamArt } from '@/lib/vertex-ai';
import { uploadToGCS } from '@/lib/storage';
import { saveOrder } from '@/lib/firestore';

export async function POST(req: NextRequest) {
  try {
    const { name, coffeeOrder, happyPlace } = await req.json();

    if (!name || !coffeeOrder || !happyPlace) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 1. Optimize Prompt
    const optimizedPrompt = await optimizePrompt(happyPlace);

    // 2. Generate Image
    const imageBuffer = await generateFoamArt(optimizedPrompt);

    // 3. Upload to GCS
    const filename = `order-${Date.now()}.png`;
    const imageUrl = await uploadToGCS(imageBuffer, filename);

    // 4. Save to Firestore
    const orderId = await saveOrder({
      name,
      coffeeOrder,
      happyPlace,
      imageUrl,
    });

    return NextResponse.json({ orderId, imageUrl }, { status: 201 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('Order processing error:', error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
