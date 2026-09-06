# Architecture

This document explains how the code in this repository implements
[FINAL_ARCHITECTURE_SPECIFICATION.md](./FINAL_ARCHITECTURE_SPECIFICATION.md)
(the approved baseline) and records Day-1-specific decisions that spec didn't
already pin down. When the two disagree, the spec is the source of truth for
_what_ to build; this file is the source of truth for _how the repo on disk
is organized_ to build it.

## Why three independent packages instead of a monorepo tool

`mobile/`, `admin/`, and `functions/` are three separate npm packages, each
with its own `node_modules`. No npm/yarn workspaces, no Turborepo/Nx.

This was a deliberate Day 1 call, not an oversight. Reasons:

1. **React Native + npm workspaces is a known source of fragile Metro
   bundler configuration** (`watchFolders`, `nodeModulesPaths`, symlink
   resolution) that's easy to get subtly wrong and hard to debug, especially
   for a solo/beginner-led project. The project principles explicitly say
   "do not add unnecessary dependencies" and "quality over speed."
2. Admin (Vite/browser) and Functions (Node/server) have no real code-sharing
   need with Mobile at this stage — no shared component library, no shared
   business logic layer defined in the spec.
3. If genuine code sharing needs emerge later (e.g. shared TypeScript types
   for Firestore documents), the fix is a small local `shared/` package
   published via `file:` reference or npm workspaces introduced _then_, with
   a concrete reason — not speculatively on Day 1.

If this becomes painful (e.g., duplicating Firestore document types three
times), revisit — but don't add the complexity until it's earned.

## State management: Context/Zustand, not Redux

Per the spec's own evaluation (Section A): mobile app state falls into four
categories (server state via Firestore listeners, local UI state, user
preferences in AsyncStorage, and auth session state), none of which need
Redux's centralized store + reducer/action boilerplate. Admin dashboard uses
Zustand for the same reason, minus even the Context boilerplate. This is
called out explicitly because it's a common default a future contributor
might reach for out of habit — don't, unless you can name a concrete state
problem Context/Zustand can't solve.

## Firebase: config module pattern

Both `mobile/src/services/firebase/config.ts` and
`admin/src/services/firebase/config.ts` currently only define _config
shape_ + env var reading (with a console warning on missing values, not a
hard crash — there's no real Firebase project yet). Day 2 adds the actual
`initializeApp`/`getAuth`/`getFirestore` calls once real project credentials
exist. Both files are intentionally near-identical in structure — if a
shared package gets introduced later, this is the first candidate to move
into it.

Firebase web/client config values (API key, project ID, etc.) are **not
secrets** — they identify which Firebase project to talk to. Real access
control is Firestore/Storage security rules + Firebase Auth. See
SECURITY.md.

## Firestore/Storage security rules

`firestore.rules` and `storage.rules` at the repo root implement the RBAC
table in the spec (Section D): four roles (`super_admin`, `content_admin`,
`host`, `member`), deny-by-default. A user's role lives on their own
`/users/{uid}` document; rules read it via `get()` to authorize other
collection access. Known cost/perf tradeoff: this `get()` call happens on
every rule evaluation that needs a role check, which counts against
Firestore read quotas. Acceptable at V1 scale (spec's own cost estimates
target ≤10k users); if it becomes a real cost or latency issue, the standard
fix is moving role into a Firebase Auth custom claim instead of a Firestore
read.

**These rules are written but not yet tested against the emulator** — see
SECURITY.md for the exact blocker and the plan to close it.

## Cloud Functions: one file so far

`functions/src/index.ts` currently exports one placeholder (`healthCheck`)
plus the initialized Admin SDK app instance (`adminApp`), which future
function modules should import rather than each calling `initializeApp()`
separately. Real functions (`createUserProfile`, `logAdminAction`,
`sendNotification`) are added Day 2+ per the spec's day-by-day plan — this
file is intentionally minimal until then.

## Bundle identifiers / app IDs

`mobile/app.json` sets `ios.bundleIdentifier` and `android.package` to
`com.bethaniyaministries.app` as a placeholder. **Confirm or change this**
before it matters (Apple Developer / Google Play account setup, EAS build
config) — it's a naming choice, not a technical constraint, and cheap to
change now, expensive to change after store submission.

## What's explicitly deferred (and where it's tracked)

- Real Firebase SDK initialization → Day 2, once Firebase projects exist
  (ENVIRONMENT.md has the manual steps).
- Firestore/Storage rules emulator testing → blocked on Java 21 or a real
  Firebase project (SECURITY.md).
- Bible content and its licensing decision → FINAL_ARCHITECTURE_SPECIFICATION.md
  Section C. No Bible text of any kind exists in this repo yet.
- Everything else in the spec's Day 2–21 plan.
