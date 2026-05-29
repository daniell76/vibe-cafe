import { Storage } from '@google-cloud/storage';

const project = process.env.GOOGLE_CLOUD_PROJECT;
const bucketName = process.env.VIBE_CAFE_BUCKET || 'vibe-cafe-images';

const storage = new Storage({ projectId: project });

export async function uploadToGCS(buffer: Buffer, filename: string): Promise<string> {
  const bucket = storage.bucket(bucketName);
  const file = bucket.file(filename);

  await file.save(buffer, {
    metadata: {
      contentType: 'image/png',
    },
  });

  return `/api/image/${filename}`;
}

export async function deleteFromGCS(filename: string): Promise<void> {
  const bucket = storage.bucket(bucketName);
  const file = bucket.file(filename);
  const [exists] = await file.exists();
  if (exists) {
    await file.delete();
  }
}

// Delete every object under the given prefixes ("" matches the whole bucket).
// Returns the number of objects deleted.
export async function deleteAllUnderPrefixes(prefixes: string[]): Promise<number> {
  const bucket = storage.bucket(bucketName);
  let total = 0;
  for (const prefix of prefixes) {
    const [files] = await bucket.getFiles({ prefix });
    if (files.length === 0) continue;
    await Promise.allSettled(files.map((f) => f.delete()));
    total += files.length;
  }
  return total;
}

export interface ListedImage {
  name: string;          // GCS object name e.g. "orders/order-XYZ-123.png"
  url: string;           // proxy URL e.g. "/api/image/orders/order-XYZ-123.png"
  size: number;          // bytes
  createdAt: string;     // ISO timestamp
}

// List image objects under the given prefixes, newest first. Used by the
// admin Gallery view (feedback item #10). Returns up to `limit` items total.
export async function listImagesUnderPrefixes(
  prefixes: string[],
  limit = 500,
): Promise<ListedImage[]> {
  const bucket = storage.bucket(bucketName);
  const out: ListedImage[] = [];
  for (const prefix of prefixes) {
    const [files] = await bucket.getFiles({ prefix });
    for (const f of files) {
      const name = f.name;
      if (!/\.(png|jpe?g|webp)$/i.test(name)) continue;
      const created = f.metadata?.timeCreated;
      out.push({
        name,
        url: `/api/image/${name}`,
        size: Number(f.metadata?.size ?? 0),
        createdAt: typeof created === 'string' ? created : '',
      });
    }
  }
  out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return out.slice(0, limit);
}
