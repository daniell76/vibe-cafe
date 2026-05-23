#!/usr/bin/env node
// Phase B2 prompt test — universal abstract wallpaper inspired by ANY subject.
// Per PDF page 25-27: "Design an abstract 3D or 2D wallpaper inspired by, but
// not directly referencing X. Do not include words, people or logos."
//
//   node scripts/test-vibe-v2.mjs                     # default 5 diverse subjects
//   node scripts/test-vibe-v2.mjs "rock music"        # one custom subject

import { execSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');

const PROJECT = process.env.GOOGLE_CLOUD_PROJECT || 'cs-poc-r09bfysmbhuoftvjja2mxk2';
const ACCOUNT = process.env.GCLOUD_ACCOUNT || 'daniel@danielxia.altostrat.com';
const OUT_DIR = process.env.OUT_DIR || join(REPO_ROOT, 'tmp', 'vibe-v2');

const MODEL = 'gemini-3.1-flash-image-preview';
const ENDPOINT =
  `https://aiplatform.googleapis.com/v1/projects/${PROJECT}/locations/global/publishers/google/models/${MODEL}:generateContent`;

const VIBE_PROMPT = (happyPlace) =>
  `A stunning abstract wallpaper inspired by, but not directly referencing: ${happyPlace}. ` +
  `Non-figurative composition built from colors, textures, shapes, light, movement, and atmosphere that evokes the mood, energy, era, palette, and emotional tone of the subject without literally depicting it. ` +
  `Premium 4K wallpaper quality with cinematic depth, rich layered color, painterly brushwork or sculpted 3D rendering, generous negative space, designed to fill a large landscape screen and look beautiful at a distance. ` +
  `STRICTLY no people, no faces, no body parts, no recognizable buildings or landmarks, no animals, no text, no words, no letters, no numbers, no logos, no brand marks, no symbols, no representational objects. ` +
  `The image must read as pure abstract atmosphere — colors and forms only — never as a literal scene.`;

const DEFAULT_SUBJECTS = [
  'rock music and ozzy osbourne',          // music
  'arsenal football club',                 // sport
  'venice italy at sunset',                // place
  'my grandma baking cookies',             // person (literal depiction would break)
  'a vintage typewriter on an oak desk',   // object
];

function token() {
  return execSync(`gcloud auth print-access-token --account=${ACCOUNT}`, { encoding: 'utf8' }).trim();
}

async function render(subject) {
  const body = {
    contents: [{ role: 'user', parts: [{ text: VIBE_PROMPT(subject) }] }],
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
  console.log(`Out dir: ${OUT_DIR}\nSubjects: ${subjects.length}, aspect 16:9, 4K\n`);
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
