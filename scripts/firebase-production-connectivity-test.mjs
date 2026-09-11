#!/usr/bin/env node
/**
 * Firebase PRODUCTION connectivity test -- Tier 1 only: read-only, zero
 * side effects, no session or document ever created.
 *
 * Two checks, both plain HTTPS GET requests (no `firebase` SDK dependency,
 * nothing to install -- keeps this script genuinely standalone, matching
 * scripts/firebase-dev-setup.sh / firebase-production-setup.sh's existing
 * "no project-local dependency" convention):
 *
 *   1. Auth reachability: GET the public Identity Toolkit project-config
 *      discovery endpoint with the apiKey alone. This is the same public,
 *      unauthenticated endpoint Firebase's own client SDKs use to look up
 *      project sign-in config before any user interaction -- it creates no
 *      session, no user, nothing. A 200 response containing a projectId
 *      confirms the API key is real and belongs to a reachable project.
 *
 *   2. Firestore reachability + rules enforcement: GET a single document
 *      (`settings/church`) via the Firestore REST API, with NO
 *      Authorization header -- i.e. as a fully unauthenticated request.
 *      firestore.rules requires `isSignedIn()` for every collection in
 *      this project (verified directly, not assumed -- see
 *      PRODUCTION_READINESS.md's Firebase audit), so the *expected*,
 *      *correct* result is HTTP 403 / status PERMISSION_DENIED. That
 *      denial is the evidence: it proves the request actually reached the
 *      real production Firestore backend and was evaluated against real
 *      rules, not that the read succeeded. Any other outcome (200 with
 *      data, a network error, a different error code) is reported as a
 *      finding, not silently treated as failure or success.
 *
 * Explicitly NOT done here, on purpose:
 *   - No signInAnonymously() or any other sign-in -- Tier 2 from the
 *     proposed procedure, deliberately out of scope for this script.
 *   - No setDoc/addDoc/updateDoc/deleteDoc -- nothing is ever written.
 *   - No Firebase Admin SDK, no service-account key, no Blaze-gated
 *     service (Functions/Storage) is touched or required.
 *
 * This script is intentionally standalone -- not part of `npm test` in
 * any package, not referenced by any CI/test config, run manually and
 * only when you choose to.
 *
 * Usage:
 *   node scripts/firebase-production-connectivity-test.mjs mobile/.env.production
 *   node scripts/firebase-production-connectivity-test.mjs admin/.env.production
 *
 * Never prints the apiKey, appId, or any other config value -- only
 * PASS/FAIL/INFO lines and HTTP-level facts (status codes, error
 * "status" strings). The env file itself is never echoed.
 */

import { readFileSync } from 'node:fs';

const envPath = process.argv[2];
if (!envPath) {
  console.error('Usage: node scripts/firebase-production-connectivity-test.mjs <path-to-.env.production>');
  process.exit(2);
}

/**
 * Minimal KEY=VALUE parser -- deliberately not the `dotenv` package, to
 * keep this script's only "dependency" being Node itself. Ignores blank
 * lines and lines starting with `#`. Does not attempt to handle quoted
 * values or multi-line values -- every value in these two apps' env
 * templates is a plain, single-line string, so this is sufficient.
 */
function parseEnvFile(path) {
  const raw = readFileSync(path, 'utf8');
  const values = {};
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    values[key] = value;
  }
  return values;
}

const values = parseEnvFile(envPath);

// Auto-detect which app's env-var prefix this file uses -- mobile
// (EXPO_PUBLIC_FIREBASE_*) or admin (VITE_FIREBASE_*) -- rather than
// requiring a separate --app flag.
const prefix = 'EXPO_PUBLIC_FIREBASE_API_KEY' in values ? 'EXPO_PUBLIC_FIREBASE' : 'VITE_FIREBASE_API_KEY' in values ? 'VITE_FIREBASE' : null;

if (!prefix) {
  console.error(
    `Could not find EXPO_PUBLIC_FIREBASE_API_KEY or VITE_FIREBASE_API_KEY in ${envPath}. ` +
      'Is this really a mobile/.env.production or admin/.env.production file?'
  );
  process.exit(2);
}

const apiKey = values[`${prefix}_API_KEY`];
const projectId = values[`${prefix}_PROJECT_ID`];

if (!apiKey || !projectId) {
  console.error(`Missing ${prefix}_API_KEY or ${prefix}_PROJECT_ID in ${envPath}.`);
  process.exit(2);
}

console.log(`Testing production connectivity for: ${envPath}`);
console.log(`Detected app: ${prefix.startsWith('EXPO') ? 'mobile (Expo)' : 'admin (Vite)'}`);
console.log(`Project ID: ${projectId}`);
console.log('(API key and other config values are never printed by this script.)');
console.log('');

let failures = 0;

// ---- Check 1: Auth reachability (public discovery endpoint) -------------
console.log('== Check 1: Auth reachability ==');
try {
  const res = await fetch(
    `https://www.googleapis.com/identitytoolkit/v3/relyingparty/getProjectConfig?key=${encodeURIComponent(apiKey)}`
  );
  const body = await res.json().catch(() => null);
  if (res.status === 200 && body && typeof body.projectId === 'string') {
    console.log(`PASS: Auth project reachable (HTTP 200, projectId present).`);
    if (body.projectId !== projectId) {
      console.log(
        `WARNING: the project id this API key resolves to does not match ` +
          `${prefix}_PROJECT_ID in ${envPath}. This usually means the API ` +
          `key and project id were copied from different projects.`
      );
      failures++;
    }
  } else {
    console.log(`FAIL: unexpected response -- HTTP ${res.status}.`);
    if (body && body.error) {
      console.log(`  error.status: ${body.error.status ?? '(none)'}`);
      console.log(`  error.message: ${body.error.message ?? '(none)'}`);
    }
    failures++;
  }
} catch (err) {
  console.log(`FAIL: network error reaching Auth discovery endpoint -- ${err.message}`);
  failures++;
}

console.log('');

// ---- Check 2: Firestore reachability + rules enforcement ----------------
console.log('== Check 2: Firestore reachability (unauthenticated read of settings/church) ==');
try {
  const res = await fetch(
    `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/settings/church?key=${encodeURIComponent(apiKey)}`
  );
  const body = await res.json().catch(() => null);
  const status = body?.error?.status;

  if (res.status === 403 && status === 'PERMISSION_DENIED') {
    console.log(
      'PASS: HTTP 403 PERMISSION_DENIED, as expected -- the request reached ' +
        'the real production Firestore backend and firestore.rules correctly ' +
        'denied an unauthenticated read (every collection requires ' +
        'isSignedIn()). This is the expected, correct outcome, not an error.'
    );
  } else if (res.status === 200) {
    console.log(
      'FAIL -- SECURITY REGRESSION: an unauthenticated read succeeded (HTTP 200). ' +
        'firestore.rules should require isSignedIn() for every collection. ' +
        'Do not treat this as connectivity success -- investigate the deployed ' +
        'rules immediately.'
    );
    failures++;
  } else {
    console.log(`FAIL: unexpected response -- HTTP ${res.status}, status=${status ?? '(none)'}.`);
    if (body?.error?.message) console.log(`  error.message: ${body.error.message}`);
    failures++;
  }
} catch (err) {
  console.log(`FAIL: network error reaching Firestore -- ${err.message}`);
  failures++;
}

console.log('');
console.log(failures === 0 ? 'RESULT: all checks passed as expected.' : `RESULT: ${failures} check(s) did not match the expected outcome.`);
process.exit(failures === 0 ? 0 : 1);
