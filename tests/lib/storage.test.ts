import { describe, it, expect, vi } from 'vitest';
import { uploadToGCS } from '../../lib/storage';

// Mock GCS SDK
vi.mock('@google-cloud/storage', () => {
  const File = vi.fn().mockImplementation(function (this: any) {
    this.save = vi.fn().mockResolvedValue(true);
    this.publicUrl = vi.fn().mockReturnValue('https://storage.googleapis.com/vibe-cafe-bucket/test-image.png');
  });
  const Bucket = vi.fn().mockImplementation(function (this: any) {
    this.file = vi.fn().mockReturnValue(new (File as any)());
  });
  const Storage = vi.fn().mockImplementation(function (this: any) {
    this.bucket = vi.fn().mockReturnValue(new (Bucket as any)());
  });
  return { Storage };
});

describe('Storage Service', () => {
  describe('uploadToGCS', () => {
    it('should upload a buffer and return the public URL', async () => {
      const buffer = Buffer.from('mock-image-data');
      const filename = 'test-image.png';
      const url = await uploadToGCS(buffer, filename);
      
      expect(url).toContain('storage.googleapis.com');
      expect(url).toContain(filename);
    });
  });
});
