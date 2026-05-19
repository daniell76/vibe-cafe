import { GoogleGenAI } from '@google/genai';

const project = process.env.GOOGLE_CLOUD_PROJECT || 'cs-poc-r09bfysmbhuoftvjja2mxk2';
const location = 'global'; // Gemini 3.1 Preview models require global endpoint

// Initialize the client for Vertex AI using the new Gen AI SDK
const client = new GoogleGenAI({
  vertexai: true,
  project: project,
  location: location,
});

// Verified Model IDs for May 2026
const TEXT_MODEL = 'gemini-3.1-flash-lite';
const IMAGE_MODEL = 'gemini-3.1-flash-image-preview';

export async function optimizePrompt(happyPlace: string, customInstructions?: string): Promise<string> {
  const instructions = customInstructions || `Rewrite the following "happy place" description into a detailed and creative prompt for generating coffee foam art. 
The output should be a single sentence describing a simple, abstracted, high-contrast design suitable for printing on coffee foam.
Avoid fine details as the foam machine cannot render them cleanly.
Focus only on the main subject. Do NOT include a mug, cup, or any background.`;

  const response = await client.models.generateContent({
    model: TEXT_MODEL,
    contents: [{ 
      role: 'user', 
      parts: [{ 
        text: `${instructions}\n\nHappy Place: "${happyPlace}"\n\nCreative Coffee Art Prompt:` 
      }] 
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

    // 1. Attempt image generation with the requested model
    const response = await client.models.generateContent({
      model: IMAGE_MODEL,
      contents: [{ 
        role: 'user', 
        parts: [{ text: finalPromptText }] 
      }],
    });

    // 2. Try to extract image from standard multimodal response
    const imagePart = response.candidates?.[0]?.content?.parts?.find(part => part.inlineData?.mimeType?.startsWith('image/'));
    
    if (imagePart?.inlineData?.data) {
      return Buffer.from(imagePart.inlineData.data, 'base64');
    }

    // 3. If no image found, log the response structure for debugging
    console.warn('No image found in AI response. Response structure:', JSON.stringify(response.candidates?.[0]?.content?.parts));
    
  } catch (error) {
    console.error('Image generation error:', error);
  }

  // 4. Final Fallback: Valid 1x1 Transparent PNG (to avoid broken image icons)
  const transparentPixel = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
  return Buffer.from(transparentPixel, 'base64');
}
