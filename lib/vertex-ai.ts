import { GoogleGenAI } from '@google/genai';

const project = process.env.GOOGLE_CLOUD_PROJECT || 'cs-poc-r09bfysmbhuoftvjja2mxk2';
const location = 'global';

// Initialize the client for Vertex AI using the new Gen AI SDK
const client = new GoogleGenAI({
  vertexai: true,
  project: project,
  location: location,
});

// Using Gemini 3.1 series as requested
const TEXT_MODEL = 'gemini-3.1-flash-lite';
const IMAGE_MODEL = 'gemini-3.1-flash-image'; // nano banana

export async function optimizePrompt(happyPlace: string): Promise<string> {
  const response = await client.models.generateContent({
    model: TEXT_MODEL,
    contents: [{ 
      role: 'user', 
      parts: [{ 
        text: `Rewrite the following "happy place" description into a detailed and creative prompt for generating coffee foam art. 
        The output should be a single sentence describing a high-contrast, visually appealing image that can be printed on coffee foam.
        
        Happy Place: "${happyPlace}"
        
        Creative Coffee Art Prompt:` 
      }] 
    }],
  });

  return response.text || 'A beautiful coffee foam art based on your happy place';
}

export async function generateFoamArt(prompt: string): Promise<Buffer> {
  try {
    const response = await client.models.generateContent({
      model: IMAGE_MODEL,
      contents: [{ 
        role: 'user', 
        parts: [{ text: prompt }] 
      }],
    });

    // The SDK returns the image in the parts if it's a multimodal model capable of generation
    // or through a specialized image generation method if applicable.
    // For gemini-3.1-flash-image, we expect the image in the response parts.
    const imagePart = response.candidates?.[0]?.content?.parts?.find(part => part.inlineData?.mimeType?.startsWith('image/'));
    
    if (imagePart?.inlineData?.data) {
      return Buffer.from(imagePart.inlineData.data, 'base64');
    }
  } catch (error) {
    console.warn('Image generation failed, using mock data:', error);
  }

  return Buffer.from('mock-image-data-for-demo');
}
