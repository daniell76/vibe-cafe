import { describe, it, expect, vi } from 'vitest';
import { saveOrder } from '../../lib/firestore';

// Mock Firestore SDK
vi.mock('@google-cloud/firestore', () => {
  const DocumentReference = vi.fn().mockImplementation(function (this: { id: string }) {
    this.id = 'test-doc-id';
  });
  const CollectionReference = vi.fn().mockImplementation(function (this: { add: (data: unknown) => Promise<unknown> }) {
    this.add = vi.fn().mockResolvedValue(new (DocumentReference as unknown as { new (): unknown })());
  });
  const Firestore = vi.fn().mockImplementation(function (this: { collection: (name: string) => unknown }) {
    this.collection = vi.fn().mockReturnValue(new (CollectionReference as unknown as { new (): unknown })());
  });
  return { Firestore };
});

describe('Firestore Service', () => {
  describe('saveOrder', () => {
    it('should save order metadata and return the document ID', async () => {
      const orderData = {
        name: 'John Doe',
        coffeeOrder: 'Latte',
        happyPlace: 'Beach',
        imageUrl: 'https://example.com/image.png'
      };
      
      const id = await saveOrder(orderData);
      
      expect(id).toBeDefined();
      expect(typeof id).toBe('string');
    });
  });
});
