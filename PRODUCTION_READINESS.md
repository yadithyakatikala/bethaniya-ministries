# Production Readiness

**Current status: NOT PRODUCTION READY. This is expected and correct at
this stage — do not read anything in this repo as a production-readiness
claim.** What Day 1 and this corrections pass verify is that the repo is
*structured* so production deployment can happen cleanly later, once the
actual feature work (Day 2–16 per the architecture spec) and a real
security/testing pass are done.

## The staged pipeline

```
DAY 1 FOUNDATION              ← done, corrected, and verified (this repo, now)
        │
        ▼
Development verified          ← in progress: dev Firebase project exists
        │                       (bethaniya-ministries-dev-58588, free Spark
        │                       tier — Blaze intentionally not attached, see
        │                       ENVIRONMENT.md "Developing without Blaze");
        │                       emulator-backed rule tests done (SECURITY.md);
        │                       mobile/admin Firebase SDK wired to the local
        │                       Emulator Suite (Auth/Firestore/Storage) and
        │                       proven end-to-end by
        │                       firebase-tests/client-emulator-smoke.test.ts
        ▼
Day 2–16 implementation       ← NOT STARTED. Auth flows, Bible/songs/events
        │                       UI, admin CRUD, notifications, live streaming,
        │                       profile, content management (spec Section E)
        ▼
Security + testing            ← NOT STARTED. Full app-level QA, not just the
        │                       rule-level tests done so far
        ▼
Release preparation           ← NOT STARTED. Store listings, EAS builds,
        │                       staging environment, final content/branding
        ▼
PRODUCTION READY
```

Nothing in this repository should be read as claiming a position further
down this pipeline than "Development verified (partial)."

## Checklist: is the repo *structured* for a clean eventual production deploy?

This checks structure and documentation, not that production deployment has
happened — none of this creates or requires a production Firebase project.

| Requirement | Status | Where |
| --- | --- | --- |
| Dev/staging/prod clearly separated | ✅ | `.firebaserc.example` defines separate `development`/`staging`/`production` project aliases; `firebase deploy --project <alias>` always targets one explicitly, never "whatever's active" by accident |
| Production secrets not in Git | ✅ | `.gitignore` blocks `.env*` (except `.env.example`) and all known service-account-key filename patterns; verified no such file is tracked (`git ls-files \| grep -iE 'env\|serviceAccount\|adminsdk'` returns only `.env.example` files) |
| Env vars documented | ✅ | `ENVIRONMENT.md` + one `.env.example` per app (`mobile`, `admin`, `functions`) listing every variable with a comment on what it's for |
| Firebase config documented | ✅ | `ENVIRONMENT.md` "Firebase projects" section — CLI-doable vs. Console-only steps, verified against the installed CLI, not assumed |
| Deployment steps documented | ✅ | `DEPLOYMENT.md` — one section per deployable piece (Functions, rules, Hosting, mobile/EAS), each with exact commands |
| Security rules version-controlled | ✅ | `firestore.rules`, `storage.rules` committed at repo root, referenced from `firebase.json` |
| DB indexes version-controlled | ✅ | `firestore.indexes.json` committed, referenced from `firebase.json` |
| Cloud Functions version-controlled | ✅ | `functions/src/` committed; `functions/package.json` pins Node 22 and all dependency versions |
| Admin deployment documented | ✅ | `DEPLOYMENT.md` "Admin dashboard" section (Firebase Hosting primary path, Vercel alternative documented) |
| Mobile build/release config documented | ⚠️ Partial | `DEPLOYMENT.md` "Mobile app (EAS Build)" documents the exact commands and states plainly that `eas.json` doesn't exist yet and why (no Expo/EAS account tied to this project yet — a Day 8 spec prerequisite, not an oversight) |
| Another developer could reproduce the environment from docs alone | ✅, with one caveat | `README.md` → `CONTRIBUTING.md` → `ENVIRONMENT.md` walk through clone → install → env setup → Firebase project → run, in that order, with no undocumented step found in this pass. Caveat: this hasn't been tested by an actual second person following the docs cold — it's a documentation-completeness check, not a dry-run confirmation |

## What would change an item above from ✅ to a real gap

- If a `.env.local` or key file were ever accidentally committed, `git log
  --all --full-history -- '*.env*' 'google-services.json' '*serviceAccountKey*'`
  would show it — checked clean as of this pass, re-check before any future
  release.
- If `firebase.json`'s emulator/deploy config or the rules files are edited
  without updating both the rules AND their tests in `firebase-tests/` in
  the same change, the "version-controlled" checkmarks above stop meaning
  "verified" and go back to meaning only "committed."

## Explicitly not claimed

This document does not claim: that the staging or production Firebase
projects exist (only dev — `bethaniya-ministries-dev-58588` — does, and it
stays on the free Spark plan by design, see `ENVIRONMENT.md` "Developing
without Blaze"); that any app screen beyond the Day 1 placeholder and the
placeholder Bible screen has been built (the Firebase SDK/emulator wiring
in `mobile/src/services/firebase/app.ts` and
`admin/src/services/firebase/app.ts` is plumbing, not a screen or auth
flow); that Storage rules' allow-path has been end-to-end verified against
a real Firebase project (see SECURITY.md's documented emulator limitation —
the client-SDK smoke test proves the emulator path, not the real backend);
or that Bible content licensing is resolved (see `BIBLE_LICENSING.md`).
Each of those is tracked in its own document rather than summarized away
here.
