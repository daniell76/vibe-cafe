#!/usr/bin/env node
// Style experiment for vibe big-screen image generation.
//
// Goal: match the brief pp.25-27 aesthetic — sharp 3D sculptural forms or
// bold 2D editorial illustration. The current production prompt biases hard
// toward "painterly brushwork" → looks like oil painting.
//
// Method: keep the existing mood-extraction step intact (it correctly hides
// the subject noun from the image model). Then render the SAME extracted
// mood through 4 style variants per subject. Compare in tmp/vibe-style/.
//
// Subjects mirror the brief examples so the output can be compared
// like-for-like against the reference images on pp.25, 26, 27.

import { execSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');

const PROJECT = process.env.GOOGLE_CLOUD_PROJECT || 'nth-canto-497114-g3';
const OUT_DIR = process.env.OUT_DIR || join(REPO_ROOT, 'tmp', 'vibe-style');

const TEXT_MODEL = 'gemini-3.1-flash-lite';
const IMAGE_MODEL = 'gemini-3.1-flash-image';
const ENDPOINT = (model) =>
  `https://aiplatform.googleapis.com/v1/projects/${PROJECT}/locations/global/publishers/google/models/${model}:generateContent`;

const EXTRACT_INSTRUCTIONS = `
Given a user's "happy place" description, extract its emotional ATMOSPHERE
into a short, evocative paragraph (60-80 words). Describe colors, light,
texture, energy, mood, era, time of day, weather — anything that captures
the FEELING of the subject without naming the subject itself.

Strictly do NOT mention:
- The original subject's name, nouns, people, places, brands, instruments,
  objects, animals, body parts, buildings, vehicles, food items.

DO use:
- Color palette words ("warm amber", "deep crimson and gold", "soft sage")
- Light/atmosphere words ("dappled afternoon sun", "neon haze", "candlelight glow")
- Texture words ("velvet", "rough plaster", "molten metal")
- Energy/mood words ("urgent", "languid", "exuberant", "contemplative")

Return JSON only: {"mood": "your 60-80 word paragraph"}
`.trim();

// ─── Render variants ─────────────────────────────────────────────────────────

const STYLES = {
  // V0 — current production prompt (oil-painting bias, the bug)
  V0_painterly: (mood) =>
    `A purely abstract painterly wallpaper that captures this atmosphere: ${mood} ` +
    `Render entirely with non-figurative brushwork, color gradients, light, textures, particles, and abstract flowing forms. ` +
    `Premium 4K wallpaper quality, cinematic depth, rich layered color, generous negative space, designed to fill a large landscape screen. ` +
    `Strictly no text, no words, no letters, no people, no faces, no recognizable objects, no buildings, no logos.`,

  // V1 — brief-literal: minimal styling, let the model interpret 3D or 2D
  V1_brief_neutral: (mood) =>
    `Design an abstract 3D or 2D wallpaper that captures this atmosphere: ${mood} ` +
    `Premium magazine-cover art quality, designed to fill a large landscape screen. ` +
    `Do not include words, people, faces, logos, or any recognisable objects.`,

  // V2 — force sharp 3D sculptural aesthetic (matches brief pp.25-26)
  V2_3d_sculptural: (mood) =>
    `An abstract 3D sculptural wallpaper that captures this atmosphere: ${mood} ` +
    `Render as a crisp digital 3D composition of intersecting geometric planes, crystalline shards, ` +
    `metallic and translucent surfaces with sharp edges and sculptural depth. Strong directional light, ` +
    `high contrast, cinematic, magazine-cover quality, designed to fill a large landscape screen. ` +
    `Do not include words, people, faces, logos, or any recognisable objects.`,

  // V3 — force bold 2D editorial illustration (matches brief p.27)
  V3_2d_editorial: (mood) =>
    `A bold abstract 2D editorial illustration wallpaper that captures this atmosphere: ${mood} ` +
    `Stylised vector-style forms, flat or lightly gradient colour fields, confident graphic shapes, ` +
    `rhythmic flowing lines, generous negative space, designer-magazine cover quality. Vivid colour palette. ` +
    `Designed to fill a large landscape screen. Do not include words, people, faces, logos, or any recognisable objects.`,

  // V4 — hybrid: tell the model to choose 3D OR 2D based on the mood
  V4_hybrid_choose: (mood) =>
    `An abstract wallpaper that captures this atmosphere: ${mood} ` +
    `Choose ONE of two visual languages based on what best fits the mood: ` +
    `(A) crisp 3D sculptural composition — intersecting geometric planes, crystalline shards, metallic or translucent surfaces, ` +
    `sharp edges, strong directional light; OR ` +
    `(B) bold 2D editorial illustration — stylised vector forms, flat colour fields, confident graphic shapes, ` +
    `rhythmic flowing lines. ` +
    `Magazine-cover quality, high contrast, cinematic, designed to fill a large landscape screen. ` +
    `Do not include words, people, faces, logos, or any recognisable objects.`,
};

// Mirror brief pp.25-27 examples plus one extra to test hybrid robustness.
const DEFAULT_SUBJECTS = [
  'rock music and ozzy osbourne',
  'arsenal football club',
  'venice italy at sunset',
];

function token() {
  return execSync('gcloud auth print-access-token', { encoding: 'utf8' }).trim();
}

async function extractMood(subject) {
  const body = {
    contents: [{ role: 'user', parts: [{ text: `${EXTRACT_INSTRUCTIONS}\n\nUser input: "${subject}"` }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: { mood: { type: 'STRING' } },
        required: ['mood'],
      },
    },
  };
  const res = await fetch(ENDPOINT(TEXT_MODEL), {
    method: 'POST',
    headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`extract HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
  return JSON.parse(text).mood;
}

async function render(promptText) {
  const body = {
    contents: [{ role: 'user', parts: [{ text: promptText }] }],
    generationConfig: { imageConfig: { aspectRatio: '16:9', imageSize: '4K' } },
  };
  const t0 = Date.now();
  const res = await fetch(ENDPOINT(IMAGE_MODEL), {
    method: 'POST',
    headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const dt = ((Date.now() - t0) / 1000).toFixed(1);
  if (!res.ok) throw new Error(`render HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const part = data?.candidates?.[0]?.content?.parts?.find((p) => p?.inlineData?.mimeType?.startsWith('image/'));
  if (!part) throw new Error('no image in response');
  return { buf: Buffer.from(part.inlineData.data, 'base64'), dt };
}

async function runSubject(subject) {
  const safe = subject.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  console.log(`\n=== "${subject}"`);
  const mood = await extractMood(subject);
  console.log(`  mood: ${mood}`);

  const variantNames = Object.keys(STYLES);
  await Promise.all(
    variantNames.map(async (variant) => {
      try {
        const promptText = STYLES[variant](mood);
        const { buf, dt } = await render(promptText);
        const out = join(OUT_DIR, `${safe}__${variant}.png`);
        writeFileSync(out, buf);
        console.log(`  ✓ ${variant} (${dt}s, ${(buf.length / 1024 / 1024).toFixed(1)}MB) → ${out}`);
      } catch (e) {
        console.error(`  ✗ ${variant}: ${e.message}`);
      }
    }),
  );
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const subjects = process.argv.length > 2 ? [process.argv.slice(2).join(' ')] : DEFAULT_SUBJECTS;
  console.log(`Project: ${PROJECT}`);
  console.log(`Out dir: ${OUT_DIR}`);
  console.log(`Subjects: ${subjects.length}, variants: ${Object.keys(STYLES).length} ⇒ ${subjects.length * Object.keys(STYLES).length} images\n`);
  for (const s of subjects) await runSubject(s); // sequential per subject so logs stay readable
  console.log(`\nAll done. Eyeball with: ls ${OUT_DIR} | sort`);
}

main().catch((e) => { console.error(e); process.exit(1); });
