#!/usr/bin/env node
/**
 * Compare two prompts against the foam-art model.
 *
 *   node scripts/test-foam-prompt.mjs "london bridge"
 *
 * Optional env:
 *   GOOGLE_CLOUD_PROJECT   defaults to cs-poc-r09bfysmbhuoftvjja2mxk2
 *   GCLOUD_ACCOUNT         defaults to daniel@danielxia.altostrat.com
 *   OUT_DIR                defaults to /tmp/foam-test
 *
 * Auth: pulls a fresh OAuth token via `gcloud auth print-access-token`,
 * skips ADC entirely.
 */
import { execSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');

const PROJECT = process.env.GOOGLE_CLOUD_PROJECT || 'cs-poc-r09bfysmbhuoftvjja2mxk2';
const ACCOUNT = process.env.GCLOUD_ACCOUNT || 'daniel@danielxia.altostrat.com';
const OUT_DIR = process.env.OUT_DIR || join(REPO_ROOT, 'tmp', 'foam-test');
const MODEL = 'gemini-3.1-flash-image-preview';
const ENDPOINT =
  `https://aiplatform.googleapis.com/v1/projects/${PROJECT}` +
  `/locations/global/publishers/google/models/${MODEL}:generateContent`;

const HAPPY_PLACE = process.argv[2] || 'london bridge';

// Prompt A: the current live prompt (control).
const PROMPT_A_TEMPLATE =
  'A flat vector graphic of {happyPlace}, minimalist logo style, high contrast sepia color pattern, central composition. ' +
  'The entire artwork must be completely isolated on a solid, pure white background. ' +
  'The subject must be entirely contained within a tight circular safe zone in the absolute center of the square canvas, ' +
  'leaving wide, empty white margins in all four corners. ' +
  'Strictly no coffee cups, no mugs, no porcelain rings, no outer borders, and no 3D photorealistic shadows. ' +
  'Clean edges, bold lines, highly graphic, optimized for printing.';

// Prompt B: the new proposed prompt — stencil/sticker language, no shape words.
const PROMPT_B_TEMPLATE =
  'A flat, single-layer high-contrast sepia-on-white stencil illustration of {happyPlace}. ' +
  'Render the subject as a single isolated shape — or a small group of clearly disconnected shapes — drifting on an empty pure-white square canvas. ' +
  'The subject occupies roughly the middle 50% of the canvas. ' +
  'The entire outer 25% margin on every side — and especially all four corners — is uniform RGB(255,255,255) pure-white empty pixels with no marks, no shading, no gradient, no texture. ' +
  'Absolutely nothing surrounds the subject: no enclosing shape, no border, no frame, no medallion, no badge, no emblem, no coin, no disc, no plate, no roundel, no halo, no aura, no glow, no vignette, no decorative scrollwork, no leaves around the subject, no background scenery, no coffee cup, no saucer. ' +
  'Clean bold edges, highly graphic, no 3D shading, no photorealism.';

function getToken() {
  return execSync(`gcloud auth print-access-token --account=${ACCOUNT}`, { encoding: 'utf8' }).trim();
}

async function generate(label, promptText) {
  const token = getToken();
  const body = {
    contents: [{ role: 'user', parts: [{ text: promptText }] }],
    generationConfig: {
      imageConfig: { aspectRatio: '1:1', imageSize: '1K' },
    },
  };
  const t0 = Date.now();
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`[${label}] HTTP ${res.status}: ${txt.slice(0, 500)}`);
  }
  const data = await res.json();
  const parts = data?.candidates?.[0]?.content?.parts ?? [];
  const imgPart = parts.find((p) => p?.inlineData?.mimeType?.startsWith('image/'));
  if (!imgPart) {
    console.error(`[${label}] no image in response. parts:`, JSON.stringify(parts).slice(0, 400));
    return null;
  }
  const buf = Buffer.from(imgPart.inlineData.data, 'base64');
  const safeHappy = HAPPY_PLACE.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  const outPath = join(OUT_DIR, `foam-${safeHappy}-${label}.png`);
  writeFileSync(outPath, buf);
  console.log(`  ✓ ${label.padEnd(12)} → ${outPath}  (${buf.length} bytes, ${elapsed}s)`);
  return outPath;
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  console.log(`Happy place: "${HAPPY_PLACE}"`);
  console.log(`Out dir:     ${OUT_DIR}`);
  console.log(`Project:     ${PROJECT}`);
  console.log(`Account:     ${ACCOUNT}`);
  console.log(`Model:       ${MODEL}`);
  console.log();
  console.log('Generating in parallel…');

  const promptA = PROMPT_A_TEMPLATE.replaceAll('{happyPlace}', HAPPY_PLACE);
  const promptB = PROMPT_B_TEMPLATE.replaceAll('{happyPlace}', HAPPY_PLACE);

  const results = await Promise.allSettled([
    generate('A-current', promptA),
    generate('B-stencil', promptB),
  ]);

  console.log();
  for (const r of results) {
    if (r.status === 'rejected') console.error(' ✗', r.reason?.message ?? r.reason);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
