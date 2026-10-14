# firebase-tests

Real, emulator-backed tests for `firestore.rules` and `storage.rules` using
`@firebase/rules-unit-testing`, plus a client-SDK connectivity smoke test
(see below). These tests connect to actual running Auth/Firestore/Storage
emulators and exercise the rules exactly as Firebase would evaluate them
in production -- they are not mocks and do not re-implement the rules
logic in JS.

## Why this package is separate

These tests exercise root-level `firestore.rules` / `storage.rules`, not any
one of `mobile/`, `admin/`, or `functions/`. Keeping them in their own
package avoids pulling emulator-testing devDependencies into app bundles.

## What's in here

- `firestore.rules.test.ts` / `storage.rules.test.ts` -- exhaustive
  authorized-vs-unauthorized RBAC coverage via `@firebase/rules-unit-testing`.
- `plans-end-to-end.test.ts` -- the reading-plan manager's whole path, with
  **no mocks**: it drives the admin site's real data layer
  (`admin/src/services/firebase/plans.ts`) and the phone's real data layer
  (`mobile/src/services/firebase/plans.ts`) against the Firestore emulator and
  the committed `firestore.rules`. An administrator saves, publishes,
  schedules, unpublishes and archives a plan; the phone, signed in as a member,
  then reads the library and each day. It asserts what a member can and cannot
  see, including a scheduled plan before and after its time, and that a draft is
  refused outright. It needs the same emulators as the others.
  (It is excluded from the package's own `tsc` pass because it imports the two
  apps' source; jest runs it as normal.)
- `media-assets-end-to-end.test.ts` -- the same idea for the media library:
  the admin site's real record builders and writer
  (`admin/src/services/firebase/mediaAssets.ts`) against the committed rules,
  signed in as a content admin, a host and a member. It proves the document the
  site actually builds -- every field, the nulls, the server timestamps, the
  closed field list -- is one the rules accept, for an image, an audio file, a
  YouTube link and a pasted link, and that a record built from an upload with
  odd reported details is still accepted. **No request is made to Cloudinary**;
  the "uploads" are the records a successful upload would hand over.
  (Also excluded from the package's own `tsc` pass; jest runs it as normal.)
- `client-emulator-smoke.test.ts` -- a different kind of check: it uses the
  plain `firebase` client SDK (`firebase/app`, `firebase/auth`,
  `firebase/firestore`, `firebase/storage`) to sign in through the Auth
  emulator and then read/write through the Firestore and Storage emulators
  under the real committed rules -- the exact same calls
  `mobile/src/services/firebase/app.ts` and
  `admin/src/services/firebase/app.ts` make at runtime. It proves the local
  development *workflow* is actually runnable end to end (an
  Auth-emulator-issued token is honored by Firestore/Storage), not just
  that the rules pass in isolation.

## Prerequisites

- Java 21+ on PATH (required by the Firebase Emulator Suite as of current
  firebase-tools versions).
- The two emulator binaries in `../.emulator-cache/` (see repository
  ENVIRONMENT.md for exact filenames/checksums and why they must be placed
  manually rather than auto-downloaded, in network environments that block
  `storage.googleapis.com`). Not needed if your network can reach Google's
  hosting directly -- in that case `firebase emulators:exec` downloads them
  automatically on first run and this cache can be omitted.

## Running

From the repository root:

```bash
npm --prefix firebase-tests install

FIRESTORE_EMULATOR_BINARY_PATH="$(pwd)/.emulator-cache/cloud-firestore-emulator-v1.22.0.jar" \
STORAGE_EMULATOR_BINARY_PATH="$(pwd)/.emulator-cache/cloud-storage-rules-runtime-v1.1.3.jar" \
npx firebase-tools emulators:exec --only auth,firestore,storage \
  "npm --prefix firebase-tests test"
```

### A note on time in these tests

`request.time` is what the rules compare a scheduled plan's `publishAt` with.
In the **emulator** it is fixed when a client's *connection* is opened, not
re-read on every request: a client that was already connected when a scheduled
moment passed keeps being judged by the time it connected, and stays refused
until it reconnects. So a test that waits for a moment to pass must make a
**new connection for every attempt** (as the schedule-boundary test in
`firestore.rules.test.ts` does). Whether the live database behaves the same
for a phone that stays open is not known; see "Scheduled plan arrives" in
`QA_CHECKLIST.md`.

Omit the two `*_BINARY_PATH` env vars entirely if your network can reach
`storage.googleapis.com` -- firebase-tools will download the binaries itself
on first run and cache them under `~/.cache/firebase/emulators`. The Auth
emulator needs no binary download at all -- it ships inside `firebase-tools`.
