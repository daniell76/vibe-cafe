import { NextRequest, NextResponse, after } from 'next/server';
import { optimizePrompt, generateFoamArt, generateVibeImage } from '@/lib/vertex-ai';
import { uploadToGCS } from '@/lib/storage';
import { getSettings } from '@/lib/firestore';

const ART_STYLES = [
  'Quantum Swirl — bold geometric flowing curves',
  'Nebula Bloom — organic floral bloom shapes',
  'Data Node — fine constellation lattice pattern',
  'Void Pulse — minimal high-contrast silhouette',
];

export async function POST(req: NextRequest) {
  try {
    const { happyPlace } = await req.json();

    if (!happyPlace) {
      return NextResponse.json({ error: 'Missing happyPlace' }, { status: 400 });
    }

    const settings = await getSettings().catch(() => null);
    const customFoamPrompt = settings?.promptTemplate;
    const vibeAspect = settings?.vibeImageAspect ?? '16:9';
    const vibeTemplate = settings?.vibePromptTemplate;

    const optimized = await optimizePrompt(happyPlace);

    const sessionStamp = Date.now();

    // 1. Await foam previews — these are what the UI needs immediately.
    const options = await Promise.all(
      ART_STYLES.map(async (style, i) => {
        const styled = `${optimized}. Style direction: ${style}.`;
        const buffer = await generateFoamArt(styled, customFoamPrompt || undefined);
        const filename = `preview/foam-${sessionStamp}-${i}.png`;
        const imageUrl = await uploadToGCS(buffer, filename);
        return {
          id: `opt-${i}`,
          label: style.split('—')[0].trim(),
          description: style.split('—')[1]?.trim() ?? '',
          imageUrl,
        };
      })
    );

    // 2. Predict the vibe image URL and fire its generation as background work.
    //    Cloud Run keeps the container's CPU allocated (cpu_idle=false) so the
    //    after() task reliably runs to completion. The big-screen page polls
    //    this URL until the file lands in GCS.
    const vibeFilename = `preview/vibe-${sessionStamp}.png`;
    const vibeImageUrl = `/api/image/${vibeFilename}`;

    after(async () => {
      try {
        const buffer = await generateVibeImage(happyPlace, vibeAspect, vibeTemplate || undefined);
        await uploadToGCS(buffer, vibeFilename);
      } catch (err) {
        console.error('Background vibe gen failed:', err);
      }
    });

    return NextResponse.json({ options, vibeImageUrl, optimizedPrompt: optimized });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('Preview generation error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
