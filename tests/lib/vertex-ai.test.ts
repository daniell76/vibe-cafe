import { describe, it, expect, vi } from 'vitest';
import { optimizePrompt, generateFoamArt } from '../../lib/vertex-ai';

// Mock the new Gen AI SDK
vi.mock('@google/genai', () => {
  const GoogleGenAI = vi.fn().mockImplementation(function (this: { models: unknown }) {
    this.models = {
      generateContent: vi.fn().mockResolvedValue({
        text: 'A beautiful coffee foam art of a sunny beach with palm trees',
        candidates: [
          {
            content: {
              parts: [
                { text: 'A beautiful coffee foam art of a sunny beach with palm trees' }
              ]
            }
          }
        ]
      })
    };
  });
  return { GoogleGenAI };
});

describe('Gen AI Service', () => {
  describe('optimizePrompt (deprecated passthrough)', () => {
    it('returns the input unchanged (B1 pipeline replaced this with brainstormIconConcepts)', async () => {
      const input = 'a sunny beach';
      const result = await optimizePrompt(input);
      expect(result).toBe(input);
    });
  });

  describe('generateFoamArt', () => {
    it('should return an image buffer for a given prompt', async () => {
      const prompt = 'A beautiful coffee foam art of a sunny beach';
      const buffer = await generateFoamArt(prompt);
      
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });
  });
});
