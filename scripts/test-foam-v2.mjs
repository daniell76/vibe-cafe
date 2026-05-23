#!/usr/bin/env node
// Phase B1 prompt test — brainstorm 4 distinct concepts, then render one
// simple black-and-white icon per concept. Matches PDF page 25-27 examples.
//
//   STITCH_API_KEY=... node scripts/test-foam-v2.mjs                # default 3 PDF subjects
//   node scripts/test-foam-v2.mjs "rock music and ozzy osbourne"    # custom subject

import { execSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');

const PROJECT = process.env.GOOGLE_CLOUD_PROJECT || 'cs-poc-r09bfysmbhuoftvjja2mxk2';
const ACCOUNT = process.env.GCLOUD_ACCOUNT || 'daniel@danielxia.altostrat.com';
const OUT_DIR = process.env.OUT_DIR || join(REPO_ROOT, 'tmp', 'foam-v2');

const TEXT_MODEL = 'gemini-3.1-flash-lite';
const IMAGE_MODEL = 'gemini-3.1-flash-image-preview';
const ENDPOINT = (model) =>
  `https://aiplatform.googleapis.com/v1/projects/${PROJECT}/locations/global/publishers/google/models/${model}:generateContent`;

// PDF sample subjects (pp.25-27).
const DEFAULT_SUBJECTS = [
  'I really like rock music and anything by ozzy osbourne',
  'I like football and I support Arsenal football club',
  'I love Italy and specifically venice',
];

const BRAINSTORM_INSTRUCTIONS = `
You generate concept ideas for printable coffee-foam icons. Given a user's
"happy place" description, return EXACTLY 4 distinct, simple, iconic objects
or symbols inspired by — but not directly referencing — the subject. Each
concept must be a single recognisable object that can be rendered as a clean
black-and-white silhouette icon (e.g. for "Ozzy Osbourne rock music":
"bat", "electric guitar", "rocker hand sign", "round sunglasses").

Rules:
- 4 distinct concepts, each a short noun phrase (max ~3 words).
- Avoid the subject's name itself, brand names, logos, or text.
- Avoid abstract concepts ("freedom", "joy") — pick concrete renderable objects.

Return JSON only, no prose, in this exact shape:
{"concepts": ["concept1", "concept2", "concept3", "concept4"]}
`.trim();

const ICON_PROMPT = (concept, happyPlace) =>
  `A simple, bold, black-on-white silhouette icon of: ${concept}. ` +
  `Inspired by, but not directly referencing: ${happyPlace}. ` +
  `Single isolated icon centered on a pure white square canvas with substantial empty white margins on all sides. ` +
  `Clean thick lines, high contrast, no text, no words, no logos, no faces, no people, no 3D shading, no photorealism, no background, no decorative frame or ring around the icon.`;

function token() {
  return execSync(`gcloud auth print-access-token --account=${ACCOUNT}`, { encoding: 'utf8' }).trim();
}

async function brainstorm(subject) {
  const body = {
    contents: [{ role: 'user', parts: [{ text: `${BRAINSTORM_INSTRUCTIONS}\n\nUser input: "${subject}"` }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: {
          concepts: { type: 'ARRAY', items: { type: 'STRING' }, minItems: 4, maxItems: 4 },
        },
        required: ['concepts'],
      },
    },
  };
  const res = await fetch(ENDPOINT(TEXT_MODEL), {
    method: 'POST',
    headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`brainstorm HTTP ${res.status}: ${(await res.text()).slice(0,200)}`);
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
  const parsed = JSON.parse(text);
  const concepts = parsed.concepts || [];
  if (concepts.length !== 4) throw new Error(`brainstorm returned ${concepts.length} concepts, expected 4`);
  return concepts;
}

async function renderIcon(concept, happyPlace, label) {
  const body = {
    contents: [{ role: 'user', parts: [{ text: ICON_PROMPT(concept, happyPlace) }] }],
    generationConfig: { imageConfig: { aspectRatio: '1:1', imageSize: '1K' } },
  };
  const res = await fetch(ENDPOINT(IMAGE_MODEL), {
    method: 'POST',
    headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`render ${label} HTTP ${res.status}: ${(await res.text()).slice(0,200)}`);
  const data = await res.json();
  const part = data?.candidates?.[0]?.content?.parts?.find((p) => p?.inlineData?.mimeType?.startsWith('image/'));
  if (!part) throw new Error(`render ${label}: no image in response`);
  return Buffer.from(part.inlineData.data, 'base64');
}

async function runSubject(subject) {
  const safe = subject.replace(/[^a-z0-9]+/gi, '-').toLowerCase().slice(0, 40);
  console.log(`\n=== "${subject}"`);
  const t0 = Date.now();
  const concepts = await brainstorm(subject);
  const tBrainstorm = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`  concepts (${tBrainstorm}s): ${concepts.join(' | ')}`);

  const t1 = Date.now();
  const buffers = await Promise.all(
    concepts.map((c, i) => renderIcon(c, subject, `${i + 1} ${c}`))
  );
  const tImages = ((Date.now() - t1) / 1000).toFixed(1);
  for (let i = 0; i < concepts.length; i++) {
    const concept = concepts[i];
    const conceptSafe = concept.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    const out = join(OUT_DIR, `${safe}__${i + 1}-${conceptSafe}.png`);
    writeFileSync(out, buffers[i]);
    console.log(`  ✓ ${concept.padEnd(28)} → ${out}  (${(buffers[i].length / 1024).toFixed(0)}KB)`);
  }
  console.log(`  total images: ${tImages}s`);
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const subjects = process.argv.length > 2 ? [process.argv.slice(2).join(' ')] : DEFAULT_SUBJECTS;
  console.log(`Out dir: ${OUT_DIR}\nSubjects: ${subjects.length}`);
  for (const s of subjects) {
    try { await runSubject(s); }
    catch (e) { console.error(`  ✗ ${e.message}`); }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
