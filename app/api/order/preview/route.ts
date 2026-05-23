import { NextRequest, NextResponse, after } from 'next/server';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  brainstormIconConcepts,
  generateFoamIcon,
  generateVibeImage,
  type FoamIconResult,
} from '@/lib/vertex-ai';
import { uploadToGCS } from '@/lib/storage';
import { getSettings } from '@/lib/firestore';

// Static backups bundled in public/backup-icons. Used to fill failed slots so
// the customer always sees 4 cards. We copy them to GCS at preview time so the
// downstream pipeline (Barista download, order doc) treats them uniformly.
const BACKUP_SLUGS = ['coffee-cup', 'teapot', 'coffee-beans', 'tea-leaves'] as const;
type BackupSlug = (typeof BACKUP_SLUGS)[number];

const BACKUP_LABEL: Record<BackupSlug, string> = {
  'coffee-cup': 'coffee cup',
  'teapot': 'teapot',
  'coffee-beans': 'coffee beans',
  'tea-leaves': 'tea leaves',
};

function shuffle<T>(arr: readonly T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

async function loadBackupBuffer(slug: BackupSlug): Promise<Buffer> {
  const path = join(process.cwd(), 'public', 'backup-icons', `${slug}.png`);
  return readFile(path);
}

interface BatchOutcome {
  concepts: string[];
  // Per-slot generation result (before backup substitution).
  results: FoamIconResult[];
}

async function generateBatch(
  happyPlace: string,
  brainstormTemplate: string | undefined,
  iconTemplate: string | undefined,
): Promise<BatchOutcome> {
  const concepts = await brainstormIconConcepts(happyPlace, brainstormTemplate);
  const results = await Promise.all(
    concepts.map((c) => generateFoamIcon(c, happyPlace, iconTemplate)),
  );
  return { concepts, results };
}

export async function POST(req: NextRequest) {
  try {
    const { happyPlace } = await req.json();

    if (!happyPlace) {
      return NextResponse.json({ error: 'Missing happyPlace' }, { status: 400 });
    }

    const settings = await getSettings().catch(() => null);
    const foamBrainstorm = settings?.foamBrainstormTemplate;
    const foamIconTemplate = settings?.promptTemplate;
    const vibeAspect = settings?.vibeImageAspect ?? '16:9';
    const vibeMoodTemplate = settings?.vibeMoodTemplate;
    const vibeRenderTemplate = settings?.vibePromptTemplate;

    const sessionStamp = Date.now();

    // Attempt 1: brainstorm + render 4.
    let batch = await generateBatch(happyPlace, foamBrainstorm || undefined, foamIconTemplate || undefined);
    let okCount = batch.results.filter((r) => r.ok).length;

    // If the whole batch failed, retry once with a fresh brainstorm.
    if (okCount === 0) {
      console.warn(`[preview] all 4 icons failed for "${happyPlace}" — retrying`);
      batch = await generateBatch(happyPlace, foamBrainstorm || undefined, foamIconTemplate || undefined);
      okCount = batch.results.filter((r) => r.ok).length;
      if (okCount === 0) {
        console.error(`[preview] all 8 icons failed for "${happyPlace}" — giving up`);
        return NextResponse.json(
          {
            error: 'generation_failed',
            message:
              "We couldn't generate art for that input. Try a different favourite item — something more specific like a place, hobby, or musician usually works well.",
          },
          { status: 422 },
        );
      }
    }

    // Pick backups (random, no dupes) for the failed slots.
    const failedSlotIndices: number[] = [];
    batch.results.forEach((r, i) => { if (!r.ok) failedSlotIndices.push(i); });
    const backups = shuffle(BACKUP_SLUGS).slice(0, failedSlotIndices.length);

    // Build the 4 cards. Successful slots get the freshly-generated icon; failed
    // slots get a backup PNG copied to GCS under the same naming scheme so the
    // downstream cleanup / download / order-save code treats them uniformly.
    const options = await Promise.all(
      batch.results.map(async (r, i) => {
        const filename = `preview/foam-${sessionStamp}-${i}.png`;
        if (r.ok) {
          const imageUrl = await uploadToGCS(r.buf, filename);
          return {
            id: `opt-${i}`,
            label: batch.concepts[i] ?? '',
            description: '',
            imageUrl,
          };
        }
        // Substitute a backup.
        const slotIdx = failedSlotIndices.indexOf(i);
        const slug = backups[slotIdx];
        const buf = await loadBackupBuffer(slug);
        const imageUrl = await uploadToGCS(buf, filename);
        return {
          id: `opt-${i}`,
          label: BACKUP_LABEL[slug],
          description: '',
          imageUrl,
        };
      }),
    );

    // Vibe image: fire-and-forget background gen (unchanged from before).
    const vibeFilename = `preview/vibe-${sessionStamp}.png`;
    const vibeImageUrl = `/api/image/${vibeFilename}`;
    after(async () => {
      try {
        const buffer = await generateVibeImage(
          happyPlace,
          vibeAspect,
          vibeRenderTemplate || undefined,
          vibeMoodTemplate || undefined,
        );
        await uploadToGCS(buffer, vibeFilename);
      } catch (err) {
        console.error('Background vibe gen failed:', err);
      }
    });

    return NextResponse.json({
      options,
      vibeImageUrl,
      concepts: batch.concepts,
      backupCount: failedSlotIndices.length,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('Preview generation error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
