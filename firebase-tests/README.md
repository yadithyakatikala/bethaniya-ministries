# firebase-tests

Real, emulator-backed tests for `firestore.rules` and `storage.rules` using
`@firebase/rules-unit-testing`. These tests connect to actual running
Firestore/Storage emulators and exercise the rules exactly as Firebase would
evaluate them in production -- they are not mocks and do not re-implement
the rules logic in JS.

## Why this package is separate

These tests exercise root-level `firestore.rules` / `storage.rules`, not any
one of `mobile/`, `admin/`, or `functions/`. Keeping them in their own
package avoids pulling emulator-testing devDependencies into app bundles.

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
npx firebase-tools emulators:exec --only firestore,storage \
  "npm --prefix firebase-tests test"
```

Omit the two `*_BINARY_PATH` env vars entirely if your network can reach
`storage.googleapis.com` -- firebase-tools will download the binaries itself
on first run and cache them under `~/.cache/firebase/emulators`.
