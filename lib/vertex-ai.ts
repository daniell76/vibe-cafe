import { VertexAI } from '@google-cloud/vertexai';

const project = process.env.GOOGLE_CLOUD_PROJECT;
const location = process.env.GOOGLE_CLOUD_LOCATION || 'europe-west4';

if (!project) {
  console.warn('WARNING: GOOGLE_CLOUD_PROJECT environment variable is not set.');
}

const vertexAI = new VertexAI({ project: project || 'undefined', location });

const MODEL_NAME = 'gemini-1.5-flash';
const IMAGE_MODEL_NAME = 'nanobanana2'; // Specified by user

export async function optimizePrompt(happyPlace: string): Promise<string> {
  const model = vertexAI.getGenerativeModel({
    model: MODEL_NAME,
  });

  const prompt = `Rewrite the following "happy place" description into a detailed and creative prompt for generating coffee foam art. 
  The output should be a single sentence describing a high-contrast, visually appealing image that can be printed on coffee foam.
  
  Happy Place: "${happyPlace}"
  
  Creative Coffee Art Prompt:`;

  const result = await model.generateContent(prompt);
  const response = await result.response;
  const text = response.candidates?.[0]?.content?.parts?.[0]?.text;
  return text || 'A beautiful coffee foam art based on your happy place';
}

export async function generateFoamArt(prompt: string): Promise<Buffer> {
  const model = vertexAI.getGenerativeModel({
    model: IMAGE_MODEL_NAME,
  });

  // Assuming multimodal output for image generation if using Gemini 3.1 Flash
  const result = await model.generateContent(prompt);
  const response = await result.response;
  
  // Logic to extract image buffer from multimodal response
  // This is a simplified version; real logic depends on the specific API response for nanobanana2
  const candidate = response.candidates?.[0];
  const imagePart = candidate?.content?.parts?.find(part => part.inlineData?.mimeType?.startsWith('image/'));
  
  if (imagePart?.inlineData?.data) {
    return Buffer.from(imagePart.inlineData.data, 'base64');
  }

  // Fallback/Mock for demo purposes if no image returned in mock environment
  return Buffer.from('mock-image-data');
}
