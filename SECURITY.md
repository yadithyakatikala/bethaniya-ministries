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

**Status: written, not yet tested.** The architecture spec's own Day 3 plan
calls for authorized-vs-unauthorized testing of every rule (can Super Admin
write? can a Member read unpublished content? etc.) using the Firestore
emulator. That testing has NOT happened yet, for a specific, disclosed
reason:

> `firebase-tools`' current emulator requires Java 21+. This development
> environment has OpenJDK 11, and the sandboxed network here blocks
> downloading a JDK from outside its allowlist (verified: a direct download
> attempt returned `403 Forbidden` from the network proxy). Rule testing
> requires either (a) a Java 21 environment, or (b) a real Firebase project
> to validate against via `firebase deploy --dry-run` (which doesn't need
> local Java) — both are Day 2/3 prerequisites already in the spec's plan.

**Do not treat these rules as verified until that testing happens.** They
are a careful first draft based on the spec's RBAC table, reviewed by
inspection, not proven by test.

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
