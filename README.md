# Bethaniya Ministries

A mobile app (iOS + Android) and admin/host web dashboard for Bethaniya
Ministries: home feed, Bible (English + Telugu), songs, events with live
stream support, push notifications, and role-based content management.

**Status:** Day 3 — authentication foundation + audit logging. Beyond Day
1's scaffolding and Day 2's sign-in flow, admin/host actions can now be
recorded in a tamper-resistant audit log; no content-management (CRUD)
screens are built yet. See "What Day 1/2/3 actually built" below.

## Tech stack

| Layer            | Choice                                                                                                 |
| ---------------- | ------------------------------------------------------------------------------------------------------ |
| Mobile app       | Expo + React Native + TypeScript (strict)                                                              |
| Admin dashboard  | React 18 + Vite + TypeScript (strict) + MUI                                                            |
| Backend          | Firebase (Auth, Firestore, Storage, Cloud Functions, FCM)                                              |
| State management | React Context (mobile) / Zustand (admin) — **not Redux**                                               |
| Testing          | Jest + React Native Testing Library (mobile), Vitest + React Testing Library (admin), Jest (functions) |

Full rationale for every choice — including why Redux was evaluated and
rejected — lives in [FINAL_ARCHITECTURE_SPECIFICATION.md](./FINAL_ARCHITECTURE_SPECIFICATION.md),
the approved baseline spec. [ARCHITECTURE.md](./ARCHITECTURE.md) explains how
the code on disk maps to that spec.

## Repository layout

```
bethaniya-ministries/
├── mobile/       Expo app (iOS + Android)
├── admin/        Admin/Host web dashboard (React + Vite)
├── functions/    Firebase Cloud Functions (Node.js + TypeScript)
├── firebase.json, firestore.rules, firestore.indexes.json, storage.rules
│                 Firebase project configuration (shared across dev/staging/prod)
├── firebase-tests/  Emulator-backed security rule tests (@firebase/rules-unit-testing)
├── FINAL_ARCHITECTURE_SPECIFICATION.md   Approved baseline spec
├── ARCHITECTURE.md    How this repo implements that spec
├── SECURITY.md        Security model, RBAC, what's enforced where, real test results
├── ENVIRONMENT.md      Manual setup: Firebase projects, env vars, tool versions
├── CONTRIBUTING.md    Code conventions, commit style, how to run checks
├── DEPLOYMENT.md      How to deploy each part
├── PRODUCTION_READINESS.md  Explicit staged pipeline; NOT production ready yet
└── BIBLE_LICENSING.md  What's confirmed, what's not, for English + Telugu
```

`mobile`, `admin`, and `functions` are three independent npm packages (no
monorepo tool, no workspaces) — each has its own `node_modules`,
`package.json`, and scripts. This was a deliberate Day 1 choice; see
ARCHITECTURE.md for why.

## Quick start

Requires Node.js 20+, npm 10+, and a Firebase project — see
[ENVIRONMENT.md](./ENVIRONMENT.md) for the full one-time setup (creating
Firebase projects, filling in `.env.local` files, etc). Until that setup is
done, each package still builds, lints, and tests — it just can't talk to a
real backend yet.

```bash
# Mobile
cd mobile && npm install
npm run typecheck && npm run lint && npm test
npm start                # opens Expo dev tools

# Admin dashboard
cd admin && npm install
npm run typecheck && npm run lint && npm test
npm run dev              # http://localhost:5173

# Cloud Functions
cd functions && npm install
npm run typecheck && npm run lint && npm test
npm run build
```

## What Day 1 actually built

- Three scaffolded, independently-verified packages (mobile/admin/functions)
  with TypeScript strict mode, ESLint, Prettier, and a passing test in each.
- Firestore and Storage security rules implementing the RBAC model from the
  spec (deny-by-default, four roles) — tested against real, running Firebase
  emulators (55 passing, 2 explicitly documented as unverified pending an
  emulator limitation; see SECURITY.md for the full results).
- `firebase.json`, indexes, and `.firebaserc.example` — ready for real
  Firebase project IDs once they exist.
- This documentation set.

## What Day 1 deliberately did NOT build

Per project instructions, Day 1 was foundation only. No auth flows, no Bible
UI, no songs/events/notifications screens, no admin CRUD, no live streaming,
no store submission prep. Auth started Day 2 (below); everything else
starts Day 3 onward — see FINAL_ARCHITECTURE_SPECIFICATION.md Section E for
the day-by-day plan.

## What Day 2 actually built

- **Mobile**: Google Sign-In, Apple Sign-In, and Phone OTP sign-in flows
  (Firebase Auth), a `loading | unauthenticated | authenticated | error`
  auth-state Context, basic sign-in/home screens, and Firebase's own
  React-Native session-persistence helper (not hand-rolled AsyncStorage
  code). 47 tests passing (`npm test` in `mobile/`).
- **Admin**: email/password sign-in, a Zustand auth store, a real
  `ProtectedRoute` enforcing the member/host/content_admin/super_admin
  boundary, and a basic login/dashboard UI. 15 tests passing (`npm test`
  in `admin/`).
- **Functions**: `createUserProfile`, a Cloud Function that creates each
  user's `/users/{uid}` Firestore profile on first sign-in with a
  server-assigned `member` role that the client can never influence or
  overwrite — 8 tests passing against a real Firestore emulator
  (`firebase emulators:exec --only firestore "npm --prefix functions test"`).
- A corrected `FINAL_ARCHITECTURE_SPECIFICATION.md` (an inaccurate claim
  about AsyncStorage being encrypted was fixed) and new "Day 2:
  Authentication" sections in SECURITY.md and ARCHITECTURE.md.

**Explicitly not verified against a real provider or device**: Google
Sign-In, Apple Sign-In, and non-emulator Phone Authentication are
implemented and unit-tested against mocks only — see SECURITY.md's "What's
actually verified — Day 2 test levels" for the exact breakdown and why
(network-blocked OAuth Console access; Apple Developer account + native
build requirements).

## What Day 3 actually built

- **`logAdminAction`**, a Cloud Function that writes an immutable
  `/audit_log` entry for an admin/host action, matching the spec's exact
  Audit Log Entry Format. It's a callable function rather than a Firestore
  background trigger — Firestore triggers don't carry caller identity, so
  they can't produce a trustworthy `admin_id`/`admin_email` — see
  SECURITY.md's "Day 3" section for the full reasoning. 11 new tests
  passing against a real Firestore emulator (20 functions tests total, all
  passing: `firebase emulators:exec --only firestore "npm --prefix
  functions test"`).
- Corrected two stale documentation claims discovered while working in this
  area: `firestore.rules`/`storage.rules`' own header comments still said
  rule testing was "a Day 3 task" not yet done, when it was actually
  completed and verified back on Day 1 — both now point at SECURITY.md's
  real, current test results instead.
- Nothing yet calls `logAdminAction` — no admin CRUD UI exists yet to call
  it from (that starts Day 4+). Day 3's job was to make the function exist,
  secure, and tested; wiring it into real admin actions is later work's
  responsibility.

**Not verified**: `logAdminAction` has never been invoked by a real admin
client or deployed to a real Firebase project (Cloud Functions deployment
requires the Blaze plan, which this project does not enable). See
SECURITY.md's "What's actually verified — Day 3 test levels" for the exact
breakdown.

## Bible content licensing

**`BIBLE CONTENT: BLOCKED FOR PRODUCTION — LICENSING UNVERIFIED`.** English
(World English Bible) is confirmed public domain and usable; Telugu has no
confirmed source yet. See [BIBLE_LICENSING.md](./BIBLE_LICENSING.md) for
what was investigated and what's still open. No copyrighted Bible text
exists anywhere in this codebase — the Bible screen
(`mobile/src/features/bible/`) renders clearly-labelled synthetic
placeholder verses only, per the spec's own sanctioned fallback.

## Production readiness

**Not production ready — expected at this stage.** See
[PRODUCTION_READINESS.md](./PRODUCTION_READINESS.md) for the explicit
staged pipeline and exactly what's verified vs. still pending.
