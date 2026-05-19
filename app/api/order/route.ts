import { NextRequest, NextResponse } from 'next/server';
import { optimizePrompt, generateFoamArt } from '@/lib/vertex-ai';
import { uploadToGCS } from '@/lib/storage';
import { saveOrder, getNextOrderNumber, getSettings } from '@/lib/firestore';

export async function POST(req: NextRequest) {
  try {
    const { name, coffeeOrder, milk, flavor, happyPlace } = await req.json();

    if (!name || !coffeeOrder || !happyPlace) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const settings = await getSettings().catch(() => null);
    const customPromptOverride = settings?.promptTemplate;

    // 1. Optimize Prompt
    const optimizedPrompt = await optimizePrompt(happyPlace);

    // 2. Generate Image
    const imageBuffer = await generateFoamArt(optimizedPrompt, customPromptOverride || undefined);

    // 3. Upload to GCS
    const filename = `order-${Date.now()}.png`;
    const imageUrl = await uploadToGCS(imageBuffer, filename);

    // 4. Generate Short Sequence Number
    const orderNumber = await getNextOrderNumber();

    // 5. Save to Firestore
    const orderId = await saveOrder({
      name,
      coffeeOrder,
      milk: milk || 'None',
      flavor: flavor || 'None',
      happyPlace,
      imageUrl,
      orderNumber,
    });

    return NextResponse.json({ orderId, orderNumber, imageUrl }, { status: 201 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('Order processing error:', error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
