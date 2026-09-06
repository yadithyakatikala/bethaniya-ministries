# Security

This document tracks the actual, current state of security controls in this
repository — not the aspirational end state. When something is "written but
not verified," it says so. The full threat-model-level writeup is in
[FINAL_ARCHITECTURE_SPECIFICATION.md](./FINAL_ARCHITECTURE_SPECIFICATION.md)
Section D; this file is the living, repo-specific companion to it.

## Core principle: hiding a button is not security

The admin dashboard's `ProtectedRoute` component and any future
role-conditional UI (hiding an "Admin" button from non-admins, etc.) are
**UX conveniences only**. They prevent confusion, not attacks. The only
thing that actually stops an unauthorized read or write is:

1. Firebase Authentication (who you are), and
2. Firestore/Storage **security rules** (what you're allowed to do), which
   run server-side and cannot be bypassed by the client.

Any future code review should reject a PR that adds a privileged action
gated only by client-side UI logic.

## Roles (RBAC)

Four roles, stored on `/users/{uid}.role` in Firestore:

| Role            | Can do                                                        |
| --------------- | ------------------------------------------------------------- |
| `member`        | Read published content only                                   |
| `host`          | Toggle live-stream fields on events, send notifications       |
| `content_admin` | Full content CRUD (announcements, songs, events, daily verse) |
| `super_admin`   | Everything, including changing other users' roles             |

Enforced in `firestore.rules` via a `callerRole()` helper that reads the
caller's own user document. A user can never set their own `role` field —
`users/{uid}` update rules explicitly reject any request that changes
`role` unless the caller is a `super_admin`, which prevents self-elevation.

## Current rule coverage

`firestore.rules` and `storage.rules` implement deny-by-default rules for:
`users`, `announcements`, `daily_verses`, `songs`, `events`,
`notifications_log`, `audit_log`, `settings`, plus Storage paths for content
images and user profile photos.

**Status: tested against real, running Firebase emulators.** The
`firebase-tests/` package contains an emulator-backed test suite
(`@firebase/rules-unit-testing`) that connects to actual Firestore and
Storage emulator instances and exercises the rules exactly as Firebase
would evaluate them — it does not re-implement the rule logic in JS. Run it
with:

```bash
npm --prefix firebase-tests install
FIRESTORE_EMULATOR_BINARY_PATH=.emulator-cache/cloud-firestore-emulator-v1.22.0.jar \
STORAGE_EMULATOR_BINARY_PATH=.emulator-cache/cloud-storage-rules-runtime-v1.1.3.jar \
npx firebase-tools emulators:exec --only firestore,storage "npm --prefix firebase-tests test"
```

(the two `*_BINARY_PATH` overrides are only needed if your network can't
reach `storage.googleapis.com` to auto-download the emulator jars — see
`firebase-tests/README.md`.)

**Result as of the last run: 52 passed, 0 failed, 2 explicitly skipped
(documented below).** Coverage includes, for every collection: unauthenticated
denial, wrong-role denial, correct-role success, the `users.role`
self-elevation block (a member cannot set their own role, on create or
update), the super_admin-only + single-field-only role update rule, the
published/unpublished content-visibility split, the host's field-restricted
event update (`isLive`/`youtubeUrl` only, denied even when bundled with a
disallowed field), the `notifications_log`/`audit_log` client-write-always-false
rule, Storage's 5MB size cap and image-content-type check on both the
`content/` and per-user profile-photo paths, and users being unable to
write another user's profile path. Full test list: `firebase-tests/src/*.test.ts`.

**What remains unverified, and exactly why:** two Storage tests are
`it.skip`'d rather than deleted or faked green — an authorized
`content_admin`/`super_admin` write to `content/...` that should succeed.
Against the local Storage Rules Emulator (`cloud-storage-rules-runtime-v1.1.3.jar`),
this deterministically throws `EvaluationException: storage.rules line [22],
column [11]. Null value error` — `request.auth.uid` resolves to null inside
the cross-service `firestore.get()` call, but *only* on the code path that
leads to an allowed write. This is not a rule-logic bug: the identical role
check, using the identical cross-service `firestore.get()`, correctly
resolves `content_admin`/`super_admin` to true in the sibling tests right
next to the skipped ones (they still get denied, correctly, by the
size/type condition) — proving `callerRole()` itself works. Reproduced
identically with both the resumable (`put()`) and single-shot
(`uploadBytes()`) upload protocols, and independent of the demo project ID
used, which rules out a test-harness misconfiguration. This matches a known
class of Storage-emulator `request.auth`-propagation bugs on writes (see
e.g. [firebase/firebase-tools#3584](https://github.com/firebase/firebase-tools/issues/3584)).
**Unverified: whether a real, authorized content_admin/super_admin write to
`content/` actually completes end-to-end.** Confirming that needs either a
newer local emulator runtime build or a test against a real (non-emulated)
Firebase dev project — full detail and the exact reasoning is in a comment
block directly above those two tests in
`firebase-tests/src/storage.rules.test.ts`.

## Secrets

- No secrets are committed to this repository. `.gitignore` blocks `.env`,
  `.env.local`, `.env.*.local`, and common service-account-key filename
  patterns (`*serviceAccountKey*.json`, `google-services.json`,
  `GoogleService-Info.plist`, etc.).
- `.env.example` files (mobile, admin, functions) contain only placeholder
  values and are safe to commit.
- Firebase **client** config values (API key, project ID, etc.) in those
  `.env.example` files are not secrets by design — see ARCHITECTURE.md.
- Real secrets for Cloud Functions (third-party API keys, etc., if any are
  ever needed) go in Firebase Secret Manager (`firebase functions:secrets:set`),
  never in `.env` files or code.
- `.firebaserc` (real project IDs) is gitignored; `.firebaserc.example` is
  the committed template.

## Audit logging

Planned per spec: an immutable `audit_log` Firestore collection, written
only by Cloud Functions (never directly by clients — `storage.rules` and
`firestore.rules` both deny client writes to it), readable only by
`super_admin`. The collection's _rules_ exist now; the Cloud Function that
actually writes to it (`logAdminAction()`) is a Day 3 build task, not yet
implemented — see functions/src/index.ts's header comment for the current
scope.

## Backup & disaster recovery

Not yet configured — requires a real Firebase project. Plan (per spec
Section D): rely on Firebase's automatic daily Firestore backups
(30-day retention target), with an optional scheduled Cloud Function export
to Cloud Storage added later if faster recovery is needed. Documented here
so it isn't forgotten once a project exists; tracked as an
ENVIRONMENT.md/DEPLOYMENT.md follow-up.

## Reporting a concern

This is a small, non-production, pre-launch project — there is no formal
disclosure process yet. If you find a security issue in this repo, open an
issue or contact the maintainer directly rather than filing a public issue
with exploit details, until the app has real users.
