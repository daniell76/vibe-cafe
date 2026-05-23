#!/usr/bin/env node
// B2 v3 — two-stage pipeline. Step 1: text model extracts a mood/palette
// description (NEVER mentioning the original subject by name). Step 2: image
// model renders abstract wallpaper from the mood description ALONE. The image
// model never sees concrete nouns like "typewriter", so it can't render one.

import { execSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');

const PROJECT = process.env.GOOGLE_CLOUD_PROJECT || 'cs-poc-r09bfysmbhuoftvjja2mxk2';
const ACCOUNT = process.env.GCLOUD_ACCOUNT || 'daniel@danielxia.altostrat.com';
const OUT_DIR = process.env.OUT_DIR || join(REPO_ROOT, 'tmp', 'vibe-v3');

const TEXT_MODEL = 'gemini-3.1-flash-lite';
const IMAGE_MODEL = 'gemini-3.1-flash-image-preview';
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
- Verbs of action involving people or things.

DO use:
- Color palette words ("warm amber", "deep crimson and gold", "soft sage")
- Light/atmosphere words ("dappled afternoon sun", "neon haze", "candlelight glow")
- Texture words ("velvet", "rough plaster", "molten metal")
- Energy/mood words ("urgent", "languid", "exuberant", "contemplative")

Return JSON only: {"mood": "your 60-80 word paragraph"}
`.trim();

const RENDER_PROMPT = (mood) =>
  `A purely abstract painterly wallpaper that captures this atmosphere: ${mood} ` +
  `Render entirely with non-figurative brushwork, color gradients, light, textures, particles, and abstract flowing forms. ` +
  `Premium 4K wallpaper quality, cinematic depth, rich layered color, generous negative space, designed to fill a large landscape screen. ` +
  `Strictly no text, no words, no letters, no people, no faces, no recognizable objects, no buildings, no logos.`;

const DEFAULT_SUBJECTS = [
  'rock music and ozzy osbourne',
  'arsenal football club',
  'venice italy at sunset',
  'my grandma baking cookies',
  'a vintage typewriter on an oak desk',
];

function token() {
  return execSync(`gcloud auth print-access-token --account=${ACCOUNT}`, { encoding: 'utf8' }).trim();
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
  if (!res.ok) throw new Error(`extract HTTP ${res.status}: ${(await res.text()).slice(0,200)}`);
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
  return JSON.parse(text).mood;
}

async function render(mood) {
  const body = {
    contents: [{ role: 'user', parts: [{ text: RENDER_PROMPT(mood) }] }],
    generationConfig: { imageConfig: { aspectRatio: '16:9', imageSize: '4K' } },
  };
  const t0 = Date.now();
  const res = await fetch(ENDPOINT(IMAGE_MODEL), {
    method: 'POST',
    headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const dt = ((Date.now() - t0) / 1000).toFixed(1);
  if (!res.ok) throw new Error(`render HTTP ${res.status}: ${(await res.text()).slice(0,200)}`);
  const data = await res.json();
  const part = data?.candidates?.[0]?.content?.parts?.find((p) => p?.inlineData?.mimeType?.startsWith('image/'));
  if (!part) throw new Error('no image');
  return { buf: Buffer.from(part.inlineData.data, 'base64'), dt };
}

async function runSubject(subject) {
  const safe = subject.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  try {
    const t0 = Date.now();
    const mood = await extractMood(subject);
    const tMood = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`\n=== "${subject}"`);
    console.log(`  mood (${tMood}s): ${mood.slice(0, 200)}…`);
    const { buf, dt } = await render(mood);
    const out = join(OUT_DIR, `vibe-${safe}.png`);
    writeFileSync(out, buf);
    console.log(`  ✓ image (${dt}s) → ${out}  (${(buf.length / 1024 / 1024).toFixed(1)}MB)`);
  } catch (e) {
    console.error(`  ✗ ${subject}: ${e.message}`);
  }
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const subjects = process.argv.length > 2 ? [process.argv.slice(2).join(' ')] : DEFAULT_SUBJECTS;
  console.log(`Out dir: ${OUT_DIR}\nSubjects: ${subjects.length}, two-stage extract→render\n`);
  await Promise.all(subjects.map(runSubject));
}

main().catch((e) => { console.error(e); process.exit(1); });
