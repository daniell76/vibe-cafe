import { describe, it, expect, vi } from 'vitest';
import { POST } from '../../app/api/order/route';

// Mock all internal services
vi.mock('../../lib/vertex-ai', () => ({
  optimizePrompt: vi.fn().mockResolvedValue('optimized prompt'),
  generateFoamArt: vi.fn().mockResolvedValue(Buffer.from('mock-image'))
}));

vi.mock('../../lib/storage', () => ({
  uploadToGCS: vi.fn().mockResolvedValue('https://storage.com/image.png')
}));

vi.mock('../../lib/firestore', () => ({
  saveOrder: vi.fn().mockResolvedValue('test-order-id'),
  getSettings: vi.fn().mockResolvedValue(null),
  getNextOrderNumber: vi.fn().mockResolvedValue(42)
}));

describe('Order API', () => {
  it('should process an order and return the image URL', async () => {
    const payload = {
      name: 'Jane Doe',
      coffeeOrder: 'Cappuccino',
      happyPlace: 'Mountain'
    };
    
    const request = new Request('http://localhost:3000/api/order', {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const response = await POST(request);
    const data = await response.json();
    
    expect(response.status).toBe(201);
    expect(data.imageUrl).toBe('https://storage.com/image.png');
    expect(data.orderId).toBe('test-order-id');
  });

  it('should return 400 if required fields are missing', async () => {
    const request = new Request('http://localhost:3000/api/order', {
      method: 'POST',
      body: JSON.stringify({ name: 'Jane' }),
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const response = await POST(request);
    expect(response.status).toBe(400);
  });
});
