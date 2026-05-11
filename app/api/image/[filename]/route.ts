import { NextRequest, NextResponse } from 'next/server';
import { Storage } from '@google-cloud/storage';

const project = process.env.GOOGLE_CLOUD_PROJECT;
const bucketName = process.env.VIBE_CAFE_BUCKET || 'vibe-cafe-images';

const storage = new Storage({ projectId: project });

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await params;
    const bucket = storage.bucket(bucketName);
    const file = bucket.file(filename);

    const [exists] = await file.exists();
    if (!exists) {
      return new NextResponse('Image not found', { status: 404 });
    }

    const [buffer] = await file.download();

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    console.error('Proxy image error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
