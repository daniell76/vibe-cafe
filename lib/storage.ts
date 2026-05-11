import { Storage } from '@google-cloud/storage';

const project = process.env.GOOGLE_CLOUD_PROJECT || 'your-project-id';
const bucketName = process.env.VIBE_CAFE_BUCKET || 'vibe-cafe-images';

const storage = new Storage({ projectId: project });

export async function uploadToGCS(buffer: Buffer, filename: string): Promise<string> {
  const bucket = storage.bucket(bucketName);
  const file = bucket.file(filename);

  await file.save(buffer, {
    metadata: {
      contentType: 'image/png',
    },
    public: true,
  });

  return file.publicUrl();
}
