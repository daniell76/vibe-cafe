#!/usr/bin/env node
/**
 * Prune old Cloud Run revisions, keeping the latest N (default 5).
 *
 * Usage:
 *   node scripts/prune-revisions.mjs                 # keep 5, delete the rest
 *   KEEP=3 node scripts/prune-revisions.mjs          # keep the latest 3
 *   DRY_RUN=1 node scripts/prune-revisions.mjs       # show what would happen, don't delete
 *
 * Safety:
 *   - Refuses to delete any revision currently receiving traffic, even if it's
 *     older than the cutoff (covers pinned-canary cases).
 *   - Refuses to delete the LATEST revision (Cloud Run requires at least one).
 *
 * Env:
 *   PROJECT    project id        (default: active gcloud project)
 *   REGION     Cloud Run region  (default: europe-west4)
 *   SERVICE    service name      (default: vibe-cafe)
 *   ACCOUNT    gcloud account    (default: active gcloud account)
 *   KEEP       revisions to keep (default: 5)
 *   DRY_RUN    "1" to skip deletes
 */
import { execSync } from 'node:child_process';

function gcloud(cmd) {
  return execSync(`gcloud ${cmd}`, { encoding: 'utf8' }).trim();
}

const PROJECT = process.env.PROJECT || gcloud('config get-value project 2>/dev/null') || '';
const REGION = process.env.REGION || 'europe-west4';
const SERVICE = process.env.SERVICE || 'vibe-cafe';
// Default to whatever account gcloud has active rather than hard-coding one.
const ACCOUNT = process.env.ACCOUNT || gcloud('config get-value account 2>/dev/null') || '';
if (!PROJECT) {
  console.error('PROJECT not set. Either export PROJECT=<id> or set the active gcloud project.');
  process.exit(1);
}
const KEEP = Math.max(1, parseInt(process.env.KEEP || '5', 10));
const DRY_RUN = process.env.DRY_RUN === '1';

const BASE = `https://run.googleapis.com/v2/projects/${PROJECT}/locations/${REGION}/services/${SERVICE}`;

function token() {
  const flag = ACCOUNT ? `--account=${ACCOUNT}` : '';
  return execSync(`gcloud auth print-access-token ${flag}`, { encoding: 'utf8' }).trim();
}

async function api(path, init = {}) {
  const res = await fetch(BASE + path, {
    ...init,
    headers: { Authorization: `Bearer ${token()}`, ...(init.headers || {}) },
  });
  if (!res.ok) throw new Error(`${init.method || 'GET'} ${path} → HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  if (res.status === 204) return null;
  const txt = await res.text();
  return txt ? JSON.parse(txt) : null;
}

async function main() {
  console.log(`Service: ${SERVICE} (${REGION}, project ${PROJECT})`);
  console.log(`Keep: ${KEEP}  Dry-run: ${DRY_RUN ? 'YES' : 'no'}`);
  console.log();

  // Revisions referenced by the service's current traffic — never delete these.
  const service = await api('');
  const pinned = new Set(
    (service.traffic || [])
      .map((t) => t.revision)
      .filter(Boolean), // empty when type is LATEST
  );
  if (pinned.size > 0) {
    console.log('Pinned by traffic (never deleted):');
    for (const p of pinned) console.log(`  - ${p}`);
    console.log();
  }

  const list = await api('/revisions');
  const revs = (list.revisions || []).slice().sort(
    (a, b) => (b.createTime || '').localeCompare(a.createTime || ''),
  );

  console.log(`Found ${revs.length} revision(s). Showing newest first:`);
  const toDelete = [];
  for (let i = 0; i < revs.length; i++) {
    const r = revs[i];
    const name = r.name.split('/').pop();
    const ct = (r.createTime || '').slice(0, 19);
    const isLatest = i === 0;
    const isPinned = pinned.has(name);
    const withinKeep = i < KEEP;

    let verdict;
    if (isLatest) verdict = 'KEEP (latest)';
    else if (isPinned) verdict = 'KEEP (pinned traffic)';
    else if (withinKeep) verdict = 'KEEP (within latest N)';
    else { verdict = 'DELETE'; toDelete.push(name); }

    console.log(`  ${String(i + 1).padStart(2)}. ${name.padEnd(28)} ${ct}  → ${verdict}`);
  }
  console.log();

  if (toDelete.length === 0) {
    console.log('Nothing to delete.');
    return;
  }

  if (DRY_RUN) {
    console.log(`Dry-run: would delete ${toDelete.length} revision(s).`);
    return;
  }

  console.log(`Deleting ${toDelete.length} revision(s)…`);
  for (const name of toDelete) {
    try {
      await api(`/revisions/${name}`, { method: 'DELETE' });
      console.log(`  ✓ ${name}`);
    } catch (err) {
      console.error(`  ✗ ${name}: ${err.message}`);
    }
  }
  console.log('Done.');
}

main().catch((e) => { console.error(e); process.exit(1); });
