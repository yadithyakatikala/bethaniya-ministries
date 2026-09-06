# Bethaniya Ministries

A mobile app (iOS + Android) and admin/host web dashboard for Bethaniya
Ministries: home feed, Bible (English + Telugu), songs, events with live
stream support, push notifications, and role-based content management.

**Status:** Day 1 — foundation only. No feature screens are built yet. See
"What Day 1 actually built" below.

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
├── FINAL_ARCHITECTURE_SPECIFICATION.md   Approved baseline spec
├── ARCHITECTURE.md    How this repo implements that spec
├── SECURITY.md        Security model, RBAC, what's enforced where
├── ENVIRONMENT.md      Manual setup: Firebase projects, env vars, tool versions
├── CONTRIBUTING.md    Code conventions, commit style, how to run checks
└── DEPLOYMENT.md      How to deploy each part
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
  spec (deny-by-default, four roles) — written but not yet emulator-tested
  (see SECURITY.md for why, and the Day 2/3 plan to close that gap).
- `firebase.json`, indexes, and `.firebaserc.example` — ready for real
  Firebase project IDs once they exist.
- This documentation set.

## What Day 1 deliberately did NOT build

Per project instructions, Day 1 is foundation only. No auth flows, no Bible
UI, no songs/events/notifications screens, no admin CRUD, no live streaming,
no store submission prep. Those start Day 2 onward — see
FINAL_ARCHITECTURE_SPECIFICATION.md Section E for the day-by-day plan.

## Bible content licensing

**Not yet resolved.** English and Telugu Bible text require verified
licensing before any real scripture text is added to this repo or app — see
FINAL_ARCHITECTURE_SPECIFICATION.md Section C. No copyrighted Bible text
exists anywhere in this codebase. Any Bible content added before licensing
is resolved must be clearly-labeled placeholder/synthetic data only.
