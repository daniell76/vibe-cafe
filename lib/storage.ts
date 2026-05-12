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
