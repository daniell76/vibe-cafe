#!/usr/bin/env node
/**
 * Export Vibe Café Firestore data to a local JSON archive for backup /
 * migration. Reads from the project in GOOGLE_CLOUD_PROJECT (or the active
 * gcloud project) using ADC.
 *
 * Writes to backups/<project>-<timestamp>/:
 *   config.json        — every doc in the `config` collection (settings + counters)
 *   orders-all.json    — every order document
 *   orders-today.json  — today's orders only (UTC day boundary)
 *   manifest.json      — counts, project, timestamp, image-URL references
 *
 * Usage:
 *   node scripts/export-data.mjs
 *   GOOGLE_CLOUD_PROJECT=other node scripts/export-data.mjs
 */
import { Firestore } from '@google-cloud/firestore';
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

function gcloud(cmd) {
  try { return execSync(`gcloud ${cmd}`, { encoding: 'utf8' }).trim(); } catch { return ''; }
}

const PROJECT = process.env.GOOGLE_CLOUD_PROJECT || gcloud('config get-value project 2>/dev/null');
if (!PROJECT) {
  console.error('No project. Set GOOGLE_CLOUD_PROJECT or a gcloud default project.');
  process.exit(1);
}
const COLLECTION = process.env.VIBE_CAFE_COLLECTION || 'orders';

// Stable timestamp for the folder name (Date.now is fine in a plain script).
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const outDir = join('backups', `${PROJECT}-${stamp}`);

const fs = new Firestore({ projectId: PROJECT, preferRest: true });

function startOfTodayUtcISO() {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

async function dumpCollection(name) {
  const snap = await fs.collection(name).get();
  return snap.docs.map((d) => ({ id: d.id, data: d.data() }));
}

async function main() {
  mkdirSync(outDir, { recursive: true });
  console.log(`Project: ${PROJECT}`);
  console.log(`Out dir: ${outDir}\n`);

  // 1. config collection (settings doc + counters doc).
  const config = await dumpCollection('config');
  writeFileSync(join(outDir, 'config.json'), JSON.stringify(config, null, 2));
  console.log(`config.json        ${config.length} doc(s): ${config.map((c) => c.id).join(', ')}`);

  // 2. all orders.
  const ordersAll = await dumpCollection(COLLECTION);
  writeFileSync(join(outDir, 'orders-all.json'), JSON.stringify(ordersAll, null, 2));
  console.log(`orders-all.json    ${ordersAll.length} order(s)`);

  // 3. today's orders (UTC).
  const cutoff = startOfTodayUtcISO();
  const ordersToday = ordersAll.filter((o) => String(o.data?.createdAt || '') >= cutoff);
  writeFileSync(join(outDir, 'orders-today.json'), JSON.stringify(ordersToday, null, 2));
  console.log(`orders-today.json  ${ordersToday.length} order(s) (since ${cutoff})`);

  // 4. manifest with image references so a later step can copy GCS objects.
  const imageRefs = [];
  for (const o of ordersAll) {
    if (typeof o.data?.imageUrl === 'string' && o.data.imageUrl) imageRefs.push(o.data.imageUrl);
    if (typeof o.data?.vibeImageUrl === 'string' && o.data.vibeImageUrl) imageRefs.push(o.data.vibeImageUrl);
  }
  const manifest = {
    project: PROJECT,
    collection: COLLECTION,
    exportedAt: new Date().toISOString(),
    todayCutoffUtc: cutoff,
    counts: { config: config.length, ordersAll: ordersAll.length, ordersToday: ordersToday.length },
    imageRefCount: imageRefs.length,
  };
  writeFileSync(join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  writeFileSync(join(outDir, 'image-refs.json'), JSON.stringify(imageRefs, null, 2));
  console.log(`manifest.json      written`);
  console.log(`image-refs.json    ${imageRefs.length} image URL(s)`);

  console.log(`\nArchive ready at ${outDir}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
