import { GoogleGenAI, Type } from '@google/genai';

const LOCATION = 'global'; // Gemini 3.1 preview image models require the global endpoint

// Lazy client init so the module can be imported at build time (Next collects
// page data without a real GCP project). The first actual call will fail loud
// if GOOGLE_CLOUD_PROJECT isn't set.
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

const TRANSPARENT_1PX =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';

// ─── Foam art (Phase B1): brainstorm → render one icon per concept ────────────

export const DEFAULT_FOAM_BRAINSTORM = `You generate concept ideas for printable coffee-foam icons. Given a user's "happy place" description, return EXACTLY 4 distinct, simple, iconic objects or symbols inspired by — but not directly referencing — the subject. Each concept must be a single recognisable object that can be rendered as a clean black-and-white silhouette icon.

Rules:
- 4 distinct concepts, each a short noun phrase (max ~3 words).
- Avoid the subject's name itself, brand names, logos, or text.
- Avoid abstract concepts ("freedom", "joy") — pick concrete renderable objects.`;

export const DEFAULT_FOAM_ICON_TEMPLATE =
  'A simple, bold, black-on-white silhouette icon of: {concept}. ' +
  'Inspired by, but not directly referencing: {happyPlace}. ' +
  'Single isolated icon centered on a pure white square canvas with substantial empty white margins on all sides. ' +
  'Clean thick lines, high contrast, no text, no words, no logos, no faces, no people, no 3D shading, no photorealism, no background, no decorative frame or ring around the icon.';

/**
 * Brainstorm exactly 4 distinct concept nouns inspired by the user's happy place.
 * Returns the raw concept strings (e.g. ["flying bat", "electric guitar", …]).
 */
export async function brainstormIconConcepts(
  happyPlace: string,
  customInstructions?: string,
): Promise<string[]> {
  const instructions = customInstructions || DEFAULT_FOAM_BRAINSTORM;
  try {
    const response = await client().models.generateContent({
      model: TEXT_MODEL,
      contents: [{
        role: 'user',
        parts: [{ text: `${instructions}\n\nUser input: "${happyPlace}"` }],
      }],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            concepts: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              minItems: '4',
              maxItems: '4',
            },
          },
          required: ['concepts'],
        },
      },
    });
    const text = response.text || '{}';
    const parsed = JSON.parse(text);
    const concepts = Array.isArray(parsed?.concepts) ? parsed.concepts : [];
    if (concepts.length >= 4) return concepts.slice(0, 4);
    // Pad to 4 if the model under-delivered, using the original subject as fallback.
    while (concepts.length < 4) concepts.push(happyPlace);
    return concepts;
  } catch (err) {
    console.error('brainstorm error:', err);
    // Soft-fail: return the subject itself 4 times so the pipeline still produces art.
    return [happyPlace, happyPlace, happyPlace, happyPlace];
  }
}

// Finish reasons from Gemini that mean the model refused / blocked.
const BLOCK_REASONS = new Set([
  'SAFETY',
  'PROHIBITED_CONTENT',
  'IMAGE_SAFETY',
  'IMAGE_PROHIBITED_CONTENT',
  'BLOCKLIST',
  'SPII',
  'NO_IMAGE',
]);

// A real 1024×1024 foam icon is 60-200KB. A pure-color "placeholder" PNG
// compresses to under a few KB regardless of dimensions, so we use 5KB as
// the "this isn't a real image" threshold.
const MIN_GENUINE_ICON_BYTES = 5000;

export type FoamIconResult =
  | { ok: true; buf: Buffer }
  | { ok: false; reason: string };

/**
 * Render one foam icon for a given concept. Template supports {concept} and {happyPlace}.
 * Returns ok/failed so callers can decide on fallback behaviour. Failure modes:
 *   - Block finishReason (SAFETY etc.)
 *   - No image part in the response
 *   - Anomalously small image (model returned a flat-color placeholder; often pure green)
 *   - Thrown error
 */
export async function generateFoamIcon(
  concept: string,
  happyPlace: string,
  templateOverride?: string,
): Promise<FoamIconResult> {
  try {
    const template = templateOverride || DEFAULT_FOAM_ICON_TEMPLATE;
    const finalPromptText = template
      .replace(/\{concept\}/g, concept)
      .replace(/\{happyPlace\}/g, happyPlace)
      .replace(/\{prompt\}/g, concept);

    const response = await client().models.generateContent({
      model: IMAGE_MODEL,
      contents: [{ role: 'user', parts: [{ text: finalPromptText }] }],
      config: { imageConfig: { aspectRatio: '1:1', imageSize: '1K' } },
    });

    const candidate = response.candidates?.[0];
    const finishReason = String(candidate?.finishReason ?? '');
    if (finishReason && BLOCK_REASONS.has(finishReason)) {
      console.warn(`[foam] concept="${concept}" blocked: ${finishReason}`);
      return { ok: false, reason: `blocked:${finishReason}` };
    }
    const imagePart = candidate?.content?.parts?.find(
      (p) => p.inlineData?.mimeType?.startsWith('image/'),
    );
    if (!imagePart?.inlineData?.data) {
      console.warn(`[foam] concept="${concept}" no image part (finishReason=${finishReason})`);
      return { ok: false, reason: 'no_image' };
    }
    const buf = Buffer.from(imagePart.inlineData.data, 'base64');
    if (buf.length < MIN_GENUINE_ICON_BYTES) {
      console.warn(`[foam] concept="${concept}" suspiciously small (${buf.length}B) — likely placeholder; finishReason=${finishReason}`);
      return { ok: false, reason: `tiny:${buf.length}` };
    }
    return { ok: true, buf };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[foam] concept="${concept}" threw:`, msg);
    return { ok: false, reason: `error:${msg}` };
  }
}

// ─── Legacy passthroughs (kept so the order route's fallback path still compiles) ───

/** @deprecated Use brainstormIconConcepts + generateFoamIcon. */
export async function optimizePrompt(happyPlace: string): Promise<string> {
  return happyPlace;
}
/** @deprecated Use generateFoamIcon(concept, happyPlace, template). */
export async function generateFoamArt(
  prompt: string,
  templateOverride?: string,
): Promise<Buffer> {
  const r = await generateFoamIcon(prompt, prompt, templateOverride);
  return r.ok ? r.buf : Buffer.from(TRANSPARENT_1PX, 'base64');
}

// ─── Vibe image (Phase B2): extract mood → render abstract wallpaper ─────────

export const DEFAULT_VIBE_MOOD_TEMPLATE = `Given a user's "happy place" description, extract its emotional ATMOSPHERE into a short, evocative paragraph (60-80 words). Describe colors, light, texture, energy, mood, era, time of day, weather — anything that captures the FEELING of the subject without naming the subject itself.

Strictly do NOT mention:
- The original subject's name, nouns, people, places, brands, instruments, objects, animals, body parts, buildings, vehicles, food items.
- Verbs of action involving people or things.

DO use:
- Color palette words ("warm amber", "deep crimson and gold", "soft sage")
- Light/atmosphere words ("dappled afternoon sun", "neon haze", "candlelight glow")
- Texture words ("velvet", "rough plaster", "molten metal")
- Energy/mood words ("urgent", "languid", "exuberant", "contemplative")`;

export const DEFAULT_VIBE_RENDER_TEMPLATE =
  'An abstract wallpaper that captures this atmosphere: {mood} ' +
  'Choose ONE of two visual languages based on what best fits the mood: ' +
  '(A) crisp 3D sculptural composition — intersecting geometric planes, crystalline shards, metallic or translucent surfaces, sharp edges, strong directional light; ' +
  'OR (B) bold 2D editorial illustration — stylised vector forms, flat colour fields, confident graphic shapes, rhythmic flowing lines. ' +
  'Magazine-cover quality, high contrast, cinematic, premium 4K, designed to fill a large landscape screen. ' +
  'Do not include words, letters, people, faces, logos, or any recognisable objects.';

/**
 * Stage 1 of the vibe pipeline: extract a mood/palette paragraph that NEVER
 * names the subject. The image model sees only this paragraph, so it can't
 * render the subject literally.
 */
async function extractVibeMood(
  happyPlace: string,
  customInstructions?: string,
): Promise<string> {
  const instructions = customInstructions || DEFAULT_VIBE_MOOD_TEMPLATE;
  try {
    const response = await client().models.generateContent({
      model: TEXT_MODEL,
      contents: [{
        role: 'user',
        parts: [{ text: `${instructions}\n\nUser input: "${happyPlace}"\n\nReturn only the paragraph, no preamble.` }],
      }],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: { mood: { type: Type.STRING } },
          required: ['mood'],
        },
      },
    });
    const text = response.text || '{}';
    const parsed = JSON.parse(text);
    if (typeof parsed?.mood === 'string' && parsed.mood.trim()) return parsed.mood.trim();
  } catch (err) {
    console.error('vibe mood extraction failed:', err);
  }
  // Fallback: feed the raw input as a "mood" string. Image model may render
  // something literal, but the pipeline still produces output.
  return happyPlace;
}

/**
 * Two-stage vibe image: mood extraction (text) → abstract render (4K image).
 * Optional templates override both stages independently.
 */
export async function generateVibeImage(
  happyPlace: string,
  aspectRatio: '16:9' | '4:3' = '16:9',
  renderTemplateOverride?: string,
  moodTemplateOverride?: string,
): Promise<Buffer> {
  const mood = await extractVibeMood(happyPlace, moodTemplateOverride);
  try {
    const renderTemplate = renderTemplateOverride || DEFAULT_VIBE_RENDER_TEMPLATE;
    const finalPromptText = renderTemplate
      .replace(/\{mood\}/g, mood)
      .replace(/\{happyPlace\}/g, happyPlace)
      .replace(/\{prompt\}/g, mood);

    const response = await client().models.generateContent({
      model: IMAGE_MODEL,
      contents: [{ role: 'user', parts: [{ text: finalPromptText }] }],
      config: { imageConfig: { aspectRatio, imageSize: '4K' } },
    });

    const imagePart = response.candidates?.[0]?.content?.parts?.find(
      (p) => p.inlineData?.mimeType?.startsWith('image/'),
    );
    if (imagePart?.inlineData?.data) return Buffer.from(imagePart.inlineData.data, 'base64');
    console.warn('No vibe image in AI response.');
  } catch (err) {
    console.error('vibe render error:', err);
  }
  return Buffer.from(TRANSPARENT_1PX, 'base64');
}
