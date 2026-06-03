#!/usr/bin/env node
/**
 * Compare two vibe prompts (4K, 16:9) across multiple subjects.
 *
 *   node scripts/test-vibe-prompt.mjs
 *   node scripts/test-vibe-prompt.mjs "london bridge"          # just one subject
 *
 * Tests 3 subjects by default to cover both "no incidental people"
 * and "people-as-subject" behaviour:
 *
 *   - "london bridge"               (landmark — must have NO people)
 *   - "tulips in spring"            (item    — must have NO people)
 *   - "my grandma baking cookies"   (person  — MUST keep the person)
 *
 * Outputs land in tmp/vibe-test/foam-{subject}-{label}.png.
 */
import { execSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');

const PROJECT = process.env.GOOGLE_CLOUD_PROJECT || 'cs-poc-r09bfysmbhuoftvjja2mxk2';
const ACCOUNT = process.env.GCLOUD_ACCOUNT || 'daniel@danielxia.altostrat.com';
const OUT_DIR = process.env.OUT_DIR || join(REPO_ROOT, 'tmp', 'vibe-test');
const MODEL = 'gemini-3.1-flash-image';
const ENDPOINT =
  `https://aiplatform.googleapis.com/v1/projects/${PROJECT}` +
  `/locations/global/publishers/google/models/${MODEL}:generateContent`;

// --- prompts ---------------------------------------------------------------

const PROMPT_A_TEMPLATE =
  'A stunning, delightful, magazine-quality photograph capturing the essence of: {happyPlace}. ' +
  'Cinematic composition, warm and inviting natural lighting, rich texture and depth, professional photography, ' +
  'soothing and aesthetic atmosphere, sharp focus, full-bleed wallpaper-ready framing. ' +
  'No text, no watermark.';

// B (softened) — allow people when the description explicitly invokes a crowd/group
// activity; otherwise depopulate.
const PROMPT_B_TEMPLATE =
  'A stunning, delightful, magazine-quality photograph capturing the essence of: {happyPlace}. ' +
  'Cinematic composition, warm and inviting natural lighting, rich texture and depth, professional photography, ' +
  'soothing and aesthetic atmosphere, sharp focus, full-bleed wallpaper-ready framing. ' +
  '\n\n' +
  'People rule: include human figures ONLY when the description explicitly is about a person, a named individual, a group of people, ' +
  'or when it explicitly mentions a crowd, gathering, festival, parade, audience, concert, wedding, party, dance, performance, ' +
  'busy/bustling/crowded scene, shoppers, market vendors, players, dancers, performers, or similar group activity. ' +
  'For all other subjects — quiet places, landmarks, objects, plants, food, animals, vehicles, scenery, still life — render the scene ' +
  'completely free of incidental human figures: no bystanders, no pedestrians, no tiny crowd figures in the background, no silhouettes of people, no faces. ' +
  'The photograph should look as if captured during a perfect, deliberate moment. ' +
  '\n\n' +
  'No text, no watermark.';

const DEFAULT_SUBJECTS = [
  'a busy farmers market',          // explicit "busy" → should KEEP people
  'london bridge',                  // landmark, quiet → no people
  'a serene mountain lake at dawn', // scenery, quiet → no people
  'a vintage typewriter on an oak desk', // still life → no people
  'Michael Jackson on stage',       // celeb/performer → MUST keep the person
];

// --- runner ----------------------------------------------------------------

function getToken() {
  return execSync(`gcloud auth print-access-token --account=${ACCOUNT}`, { encoding: 'utf8' }).trim();
}

async function generate(subject, label, promptText) {
  const token = getToken();
  const body = {
    contents: [{ role: 'user', parts: [{ text: promptText }] }],
    generationConfig: { imageConfig: { aspectRatio: '16:9', imageSize: '4K' } },
  };
  const t0 = Date.now();
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`[${subject} ${label}] HTTP ${res.status}: ${txt.slice(0, 300)}`);
  }
  const data = await res.json();
  const parts = data?.candidates?.[0]?.content?.parts ?? [];
  const img = parts.find((p) => p?.inlineData?.mimeType?.startsWith('image/'));
  if (!img) {
    console.error(`[${subject} ${label}] no image. parts:`, JSON.stringify(parts).slice(0, 300));
    return;
  }
  const buf = Buffer.from(img.inlineData.data, 'base64');
  const safe = subject.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  const out = join(OUT_DIR, `vibe-${safe}-${label}.png`);
  writeFileSync(out, buf);
  console.log(`  ✓ ${subject.padEnd(28)} ${label.padEnd(10)} → ${out}  (${(buf.length / 1024 / 1024).toFixed(1)} MB, ${elapsed}s)`);
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const subjects = process.argv.length > 2 ? [process.argv.slice(2).join(' ')] : DEFAULT_SUBJECTS;
  console.log(`Subjects:   ${subjects.join(' | ')}`);
  console.log(`Out dir:    ${OUT_DIR}`);
  console.log(`Aspect:     16:9, Size: 4K`);
  console.log();

  const tasks = [];
  for (const subj of subjects) {
    const a = PROMPT_A_TEMPLATE.replaceAll('{happyPlace}', subj);
    const b = PROMPT_B_TEMPLATE.replaceAll('{happyPlace}', subj);
    tasks.push(generate(subj, 'A-current', a));
    tasks.push(generate(subj, 'B-nopeople', b));
  }
  const results = await Promise.allSettled(tasks);
  for (const r of results) if (r.status === 'rejected') console.error(' ✗', r.reason?.message ?? r.reason);
}

main().catch((e) => { console.error(e); process.exit(1); });
