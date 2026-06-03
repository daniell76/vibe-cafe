#!/usr/bin/env node
/**
 * Import a Vibe Café archive (from scripts/export-data.mjs) into a target
 * Firestore project via the Firestore REST API, authenticated with the active
 * gcloud CLI token (so it works even when ADC points at a different account).
 *
 * Usage:
 *   node scripts/import-data.mjs <archiveDir> --project <id> [--all] [--dry]
 *
 *   --all   import orders-all.json (default: orders-today.json)
 *   --dry   report only, no writes
 *
 * Orders keep their original doc IDs (idempotent). Config docs (settings +
 * counters) are written verbatim. All fields are JSON primitives / strings /
 * arrays / maps (the app stores createdAt as an ISO string, not a Timestamp),
 * so the value encoder below covers every case.
 */
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
const archiveDir = args.find((a) => !a.startsWith('--') && a !== args[args.indexOf('--project') + 1]);
const projectIdx = args.indexOf('--project');
const PROJECT = projectIdx >= 0 ? args[projectIdx + 1] : '';
const useAll = args.includes('--all');
const dry = args.includes('--dry');

if (!archiveDir || !PROJECT) {
  console.error('Usage: node scripts/import-data.mjs <archiveDir> --project <id> [--all] [--dry]');
  process.exit(1);
}
const COLLECTION = process.env.VIBE_CAFE_COLLECTION || 'orders';

function token() {
  return execSync('gcloud auth print-access-token', { encoding: 'utf8' }).trim();
}

// JS value → Firestore REST typed value.
function toValue(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'string') return { stringValue: v };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toValue) } };
  if (typeof v === 'object') return { mapValue: { fields: toFields(v) } };
  return { stringValue: String(v) };
}
function toFields(obj) {
  const f = {};
  for (const [k, val] of Object.entries(obj)) f[k] = toValue(val);
  return f;
}

const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;
const DOC_PREFIX = `projects/${PROJECT}/databases/(default)/documents`;

async function commit(writes, tok) {
  const res = await fetch(`${BASE}:commit`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ writes }),
  });
  if (!res.ok) throw new Error(`commit HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
}

async function main() {
  const config = JSON.parse(readFileSync(join(archiveDir, 'config.json'), 'utf8'));
  const ordersFile = useAll ? 'orders-all.json' : 'orders-today.json';
  const orders = JSON.parse(readFileSync(join(archiveDir, ordersFile), 'utf8'));

  console.log(`Target: ${PROJECT}  (collection: ${COLLECTION})`);
  console.log(`Archive: ${archiveDir}`);
  console.log(`Importing config (${config.length}) + ${orders.length} orders from ${ordersFile}`);
  if (dry) {
    console.log('DRY RUN — no writes.');
    console.log('  config docs:', config.map((c) => c.id).join(', '));
    console.log('  sample orders:', orders.slice(0, 3).map((o) => `#${o.data?.orderNumber} ${o.data?.name}`).join(' | '));
    return;
  }

  const tok = token();

  // Config docs.
  const configWrites = config.map((d) => ({
    update: { name: `${DOC_PREFIX}/config/${d.id}`, fields: toFields(d.data) },
  }));
  await commit(configWrites, tok);
  console.log(`  config written: ${config.map((c) => c.id).join(', ')}`);

  // Orders in batches of 200 (well under the 500-write commit cap).
  let done = 0;
  for (let i = 0; i < orders.length; i += 200) {
    const slice = orders.slice(i, i + 200);
    const writes = slice.map((o) => ({
      update: { name: `${DOC_PREFIX}/${COLLECTION}/${o.id}`, fields: toFields(o.data) },
    }));
    await commit(writes, token());
    done += slice.length;
    console.log(`  orders ${done}/${orders.length}`);
  }

  console.log('\nImport complete.');
}

main().catch((e) => { console.error(e); process.exit(1); });
