#!/usr/bin/env node
/**
 * Seeds the five starter reading plans into Firestore.
 *
 * The plan DATA lives in mobile/src/features/plans/seedPlans.ts, beside
 * the PublishedPlan/PublishedPlanDay types it has to satisfy, so the
 * compiler checks it. This script only writes it.
 *
 * READ mobile/src/features/plans/seedPlans.ts's header and
 * /PLANS_SOURCES.md first: these are APP-CREATED generic plans, not
 * material authored by Bethaniya Ministries.
 *
 * IDEMPOTENT. Each plan uses a stable slug as its document id, so
 * re-running updates in place rather than creating duplicates. Day
 * documents use `day-<n>` for the same reason.
 *
 * SAFE BY DEFAULT. Runs against the Firestore EMULATOR unless
 * --production is passed, and refuses to touch production without
 * GOOGLE_APPLICATION_CREDENTIALS. It never deletes: a plan the church has
 * since edited keeps its edits for any field this script does not set,
 * and a plan the church deleted is not resurrected unless you pass
 * --force.
 *
 *   # against the emulator (default)
 *   firebase emulators:exec --only firestore "node scripts/seed-plans.mjs"
 *
 *   # against production, deliberately
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json \
 *     node scripts/seed-plans.mjs --production
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..');

const args = new Set(process.argv.slice(2));
const production = args.has('--production');
const force = args.has('--force');

/**
 * Reads the plans out of the TypeScript module without a build step.
 *
 * seedPlans.ts is deliberately plain data -- one interface, five object
 * literals and an array -- so stripping the type annotations is enough to
 * evaluate it. This avoids adding a TS build or a bundler to the repo for
 * a script that runs a handful of times. If seedPlans.ts ever grows real
 * logic, replace this with `tsx`/`esbuild` rather than extending the
 * regexes.
 */
function loadSeedPlans() {
  const source = readFileSync(
    join(repoRoot, 'mobile/src/features/plans/seedPlans.ts'),
    'utf8'
  );
  const stripped = source
    // type-only imports and the interface block
    .replace(/^import type .*$/gm, '')
    .replace(/export interface SeedPlan \{[\s\S]*?\n\}/m, '')
    // type annotations on the exported consts
    .replace(/: SeedPlan\[]/g, '')
    .replace(/: SeedPlan\b/g, '')
    .replace(/^export /gm, '');

  const factory = new Function(
    `${stripped}\nreturn { SEED_PLANS, APP_CREATED_NOTICE };`
  );
  const { SEED_PLANS, APP_CREATED_NOTICE } = factory();
  if (!Array.isArray(SEED_PLANS) || SEED_PLANS.length !== 5) {
    throw new Error(
      `expected exactly 5 seed plans, found ${SEED_PLANS?.length ?? 'none'}`
    );
  }
  if (!APP_CREATED_NOTICE) throw new Error('APP_CREATED_NOTICE missing');
  return SEED_PLANS;
}

async function main() {
  const plans = loadSeedPlans();

  if (production && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.error(
      '--production requires GOOGLE_APPLICATION_CREDENTIALS pointing at a service-account key.'
    );
    process.exit(1);
  }
  if (!production && !process.env.FIRESTORE_EMULATOR_HOST) {
    console.error(
      'No FIRESTORE_EMULATOR_HOST set. Run this inside `firebase emulators:exec`, or pass --production deliberately.'
    );
    process.exit(1);
  }

  const { initializeApp, applicationDefault } = await import('firebase-admin/app');
  const { getFirestore, FieldValue } = await import('firebase-admin/firestore');

  initializeApp(
    production
      ? { credential: applicationDefault() }
      : { projectId: process.env.GCLOUD_PROJECT ?? 'bethaniyaministries-production' }
  );
  const db = getFirestore();

  console.log(
    `Seeding ${plans.length} reading plans into ${production ? 'PRODUCTION' : 'the emulator'}…`
  );

  for (const { id, plan, days } of plans) {
    const ref = db.collection('plans').doc(id);
    const existing = await ref.get();

    if (existing.exists && !force) {
      console.log(`  = ${id} already exists, updating its fields in place`);
    } else if (!existing.exists) {
      console.log(`  + ${id}`);
    }

    await ref.set(
      {
        ...plan,
        // The admin app filters on this; a seeded plan is published so the
        // church can see it in the app immediately and decide.
        published: true,
        updatedAt: FieldValue.serverTimestamp(),
        ...(existing.exists ? {} : { createdAt: FieldValue.serverTimestamp() }),
      },
      { merge: true }
    );

    for (const day of days) {
      await ref
        .collection('days')
        .doc(`day-${day.dayNumber}`)
        .set({ ...day, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    }
    console.log(`    ${days.length} days`);
  }

  const total = await db.collection('plans').get();
  console.log(`Done. 'plans' now holds ${total.size} document(s).`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
