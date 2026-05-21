import { GoogleGenAI } from '@google/genai';

const LOCATION = 'global'; // Gemini 3.1 preview image models require the global endpoint

// Lazy client init so the module can be imported at build time (Next collects
// page data without a real GCP project). The first actual call will fail loud
// if GOOGLE_CLOUD_PROJECT isn't set — better than silently calling the wrong
// account because of a hard-coded fallback.
let _client: GoogleGenAI | null = null;
function client(): GoogleGenAI {
  if (_client) return _client;
  const project = process.env.GOOGLE_CLOUD_PROJECT;
  if (!project) {
    throw new Error(
      'GOOGLE_CLOUD_PROJECT env var is required (set it in your shell for local dev, ' +
        'or in Cloud Run env config via terraform).',
    );
  }
  _client = new GoogleGenAI({ vertexai: true, project, location: LOCATION });
  return _client;
}

const TEXT_MODEL = 'gemini-3.1-flash-lite';
const IMAGE_MODEL = 'gemini-3.1-flash-image-preview';

export async function optimizePrompt(happyPlace: string, customInstructions?: string): Promise<string> {
  const instructions = customInstructions || `Rewrite the following "happy place" description into a detailed and creative prompt for generating coffee foam art.
The output should be a single sentence describing a simple, abstracted, high-contrast design suitable for printing on coffee foam.
Avoid fine details as the foam machine cannot render them cleanly.
Focus only on the main subject. Do NOT include a mug, cup, or any background.`;

  const response = await client().models.generateContent({
    model: TEXT_MODEL,
    contents: [{
      role: 'user',
      parts: [{
        text: `${instructions}\n\nHappy Place: "${happyPlace}"\n\nCreative Coffee Art Prompt:`,
      }],
    }],
  });

  return response.text || 'A beautiful coffee foam art based on your happy place';
}

export async function generateFoamArt(prompt: string, templateOverride?: string): Promise<Buffer> {
  try {
    const defaultTemplate = `${prompt}. High-contrast sepia color pattern, simple abstract minimalist style optimized for foam printing, minimal fine details. Isolated subject on pure white background, 1:1 aspect ratio square dimension. Strictly no mug, no cup.`;
    const finalPromptText = templateOverride
      ? templateOverride.replace('{happyPlace}', prompt).replace('{prompt}', prompt)
      : defaultTemplate;

    const response = await client().models.generateContent({
      model: IMAGE_MODEL,
      contents: [{
        role: 'user',
        parts: [{ text: finalPromptText }],
      }],
      config: {
        imageConfig: {
          aspectRatio: '1:1',
          imageSize: '1K',
        },
      },
    });

    const imagePart = response.candidates?.[0]?.content?.parts?.find(
      (part) => part.inlineData?.mimeType?.startsWith('image/')
    );

    if (imagePart?.inlineData?.data) {
      return Buffer.from(imagePart.inlineData.data, 'base64');
    }

    console.warn('No image found in AI response. Response structure:', JSON.stringify(response.candidates?.[0]?.content?.parts));

  } catch (error) {
    console.error('Image generation error:', error);
  }

  const transparentPixel = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
  return Buffer.from(transparentPixel, 'base64');
}

const DEFAULT_VIBE_TEMPLATE =
  'A stunning, delightful, magazine-quality photograph capturing the essence of: {happyPlace}. Cinematic composition, warm and inviting natural lighting, rich texture and depth, professional photography, soothing and aesthetic atmosphere, sharp focus, full-bleed wallpaper-ready framing. No text, no watermark.';

export async function generateVibeImage(
  happyPlace: string,
  aspectRatio: '16:9' | '4:3' = '16:9',
  templateOverride?: string,
): Promise<Buffer> {
  try {
    const template = templateOverride || DEFAULT_VIBE_TEMPLATE;
    const finalPromptText = template
      .replace('{happyPlace}', happyPlace)
      .replace('{prompt}', happyPlace);

    const response = await client().models.generateContent({
      model: IMAGE_MODEL,
      contents: [{
        role: 'user',
        parts: [{ text: finalPromptText }],
      }],
      config: {
        imageConfig: {
          aspectRatio,
          imageSize: '4K',
        },
      },
    });

    const imagePart = response.candidates?.[0]?.content?.parts?.find(
      (part) => part.inlineData?.mimeType?.startsWith('image/')
    );

    if (imagePart?.inlineData?.data) {
      return Buffer.from(imagePart.inlineData.data, 'base64');
    }

    console.warn('No vibe image found in AI response.');
  } catch (error) {
    console.error('Vibe image generation error:', error);
  }

  const transparentPixel = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
  return Buffer.from(transparentPixel, 'base64');
}
