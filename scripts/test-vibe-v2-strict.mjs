#!/usr/bin/env node
// Strict B2 variant — adds explicit "if subject names an object, ABSTRACT it,
// never depict" directive to fix cases where the model renders a literal scene
// (e.g. typewriter → piano).

import { execSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');

const PROJECT = process.env.GOOGLE_CLOUD_PROJECT || 'cs-poc-r09bfysmbhuoftvjja2mxk2';
const ACCOUNT = process.env.GCLOUD_ACCOUNT || 'daniel@danielxia.altostrat.com';
const OUT_DIR = process.env.OUT_DIR || join(REPO_ROOT, 'tmp', 'vibe-v2-strict');

const MODEL = 'gemini-3.1-flash-image-preview';
const ENDPOINT =
  `https://aiplatform.googleapis.com/v1/projects/${PROJECT}/locations/global/publishers/google/models/${MODEL}:generateContent`;

const VIBE_PROMPT_STRICT = (happyPlace) =>
  `A purely abstract painterly atmosphere inspired by, but never literally depicting: ${happyPlace}. ` +
  `Render the SENSATION of the subject — its mood, era, light, energy, and color palette — as if the viewer had their eyes closed. ` +
  `Build the image entirely from non-figurative brushwork, color gradients, light, textures, particles, and flowing organic forms. ` +
  `Premium 4K wallpaper quality, cinematic depth, rich layered color, generous negative space, designed to fill a large landscape screen.\n\n` +
  `STRICT EXCLUSIONS — the image must contain NONE of these:\n` +
  `- No identifiable objects (no furniture, no instruments, no machines, no vehicles, no tools, no buildings, no devices, no plants, no food).\n` +
  `- No people, no faces, no body parts, no creatures.\n` +
  `- No text, words, letters, numbers, logos, symbols.\n` +
  `- No specific scenes that read as real places (no rooms, no landscapes, no horizons, no architecture).\n` +
  `- No representational imagery at all.\n\n` +
  `If the subject names a concrete object, place, person, or animal, EXTRACT only its color palette and emotional texture — never depict the thing itself.`;

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

async function render(subject) {
  const body = {
    contents: [{ role: 'user', parts: [{ text: VIBE_PROMPT_STRICT(subject) }] }],
    generationConfig: { imageConfig: { aspectRatio: '16:9', imageSize: '4K' } },
  };
  const t0 = Date.now();
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const dt = ((Date.now() - t0) / 1000).toFixed(1);
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0,200)}`);
  const data = await res.json();
  const part = data?.candidates?.[0]?.content?.parts?.find((p) => p?.inlineData?.mimeType?.startsWith('image/'));
  if (!part) throw new Error('no image in response');
  return { buf: Buffer.from(part.inlineData.data, 'base64'), dt };
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const subjects = process.argv.length > 2 ? [process.argv.slice(2).join(' ')] : DEFAULT_SUBJECTS;
  console.log(`Out dir: ${OUT_DIR}\nSubjects: ${subjects.length}, aspect 16:9, 4K, STRICT variant\n`);
  await Promise.all(subjects.map(async (subj) => {
    try {
      const { buf, dt } = await render(subj);
      const safe = subj.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
      const out = join(OUT_DIR, `vibe-${safe}.png`);
      writeFileSync(out, buf);
      console.log(`  ✓ ${subj.padEnd(40)} → ${out}  (${(buf.length / 1024 / 1024).toFixed(1)}MB, ${dt}s)`);
    } catch (e) {
      console.error(`  ✗ ${subj}: ${e.message}`);
    }
  }));
}

main().catch((e) => { console.error(e); process.exit(1); });
