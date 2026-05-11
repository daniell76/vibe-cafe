import { describe, it, expect, vi } from 'vitest';
import { uploadToGCS } from '../../lib/storage';

// Mock GCS SDK
vi.mock('@google-cloud/storage', () => {
  const File = vi.fn().mockImplementation(function (this: { save: (data: unknown, options: unknown) => Promise<boolean>, publicUrl: () => string }) {
    this.save = vi.fn().mockResolvedValue(true);
    this.publicUrl = vi.fn().mockReturnValue('https://storage.googleapis.com/vibe-cafe-bucket/test-image.png');
  });
  const Bucket = vi.fn().mockImplementation(function (this: { file: (name: string) => unknown }) {
    this.file = vi.fn().mockReturnValue(new (File as unknown as { new (): unknown })());
  });
  const Storage = vi.fn().mockImplementation(function (this: { bucket: (name: string) => unknown }) {
    this.bucket = vi.fn().mockReturnValue(new (Bucket as unknown as { new (): unknown })());
  });
  return { Storage };
});

describe('Storage Service', () => {
  describe('uploadToGCS', () => {
    it('should upload a buffer and return the proxy URL', async () => {
      const buffer = Buffer.from('mock-image-data');
      const filename = 'test-image.png';
      const url = await uploadToGCS(buffer, filename);
      
      expect(url).toBe(`/api/image/${filename}`);
    });
  });
});
