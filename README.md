# Bethaniya Ministries

Bethaniya Ministries is a church digital platform consisting of three parts:

- **Mobile app** — React Native + Expo (iOS + Android): home feed, Bible
  reader (English + Telugu, foundation only — see "Bible status" below),
  songs + audio, events with live-stream support, profile/preferences, and
  a local notification history/center.
- **Admin/host dashboard** — React + Vite web app for content management,
  role-based access control, and notification composition/logging.
- **Backend** — Firebase (Auth, Firestore, Storage, Cloud Functions), run
  entirely on the free Spark plan today (see "Cost constraint" below).

## Current checkpoint

- **Checkpoint:** Day 9 + Day 10 complete.
- **Git commit:** `b4c251e` (`feat(mobile): complete day 9-10 profile search notifications`)
- **GitHub `main`:** synchronized with this commit.
- **Working tree at last checkpoint:** clean.
- **Next planned milestone:** Day 11 (not started — see "Do NOT start Day 11" constraints throughout this project's working process).

## Current development status

| Day | Focus | Status |
| --- | --- | --- |
| Day 1 | Foundation (three scaffolded packages, security rules, docs) | ✅ |
| Day 2 | Authentication / Firebase foundation | ✅ |
| Day 3 | Security / audit-log foundation | ✅ |
| Day 4 | Announcements CRUD | ✅ |
| Day 5 | Daily Verse / Home | ✅ |
| Day 6 | Songs / Audio | ✅ |
| Day 7 | Events / YouTube Live | ✅ |
| Day 8 | Bible foundation (books/chapters/verses) + language/theme foundation | ✅ |
| Day 9 | Profile, Preferences, Bible Search | ✅ |
| Day 10 | Notification architecture, Admin Notifications, Notification Center | ✅ |
| Day 11 | Admin Users page (list, view, Super-Admin-only role changes) | ✅ |
| Day 12 | Real device testing + bug fixes | ⚠️ Static/code-level QA audit only — see "Days 11–13" below; real-device/slow-network/offline testing still pending |
| Day 13 | Admin dashboard completion (Settings page + sidebar/responsive refinement) | ✅ |
| Day 14 | Documentation + code review | ✅ |
| Day 15 | Not started | ⏳ |

"✅" here means the day's planned scope was implemented and reviewed, not
that the feature is production-complete — see "Current V1 feature status",
"Bible status", and "Notifications status" below for what is and isn't
actually production-ready within each of these.

## Current V1 feature status

| Area | Status | Notes |
| --- | --- | --- |
| Authentication (mobile: Google/Apple/Phone OTP; admin: email/password) | Implemented | Google/Apple/non-emulator Phone Auth are unit-tested against mocks only — never verified against a real provider/device (network-blocked OAuth Console access, Apple Developer account requirements). See SECURITY.md. |
| Announcements (admin CRUD, mobile read) | Implemented | |
| Daily Verse (admin CRUD, mobile home feed) | Implemented | |
| Songs + audio playback | Implemented | |
| Events | Implemented | |
| YouTube Live (host-managed live-stream URL/status) | Implemented | |
| Bible reader foundation (books/chapters/verses navigation) | Implemented | Content is placeholder data — see "Bible status". |
| English/Telugu language UI toggle | Implemented | Governs which placeholder text set is shown; not a translation of real scripture yet. |
| Bible Search (over the current local placeholder dataset) | Implemented | See "Bible status" — searches placeholder text/references only. |
| Profile (view/edit display name, upload profile photo, view email/phone) | Implemented | |
| Settings / preferences (language, theme, notifications toggle) | Implemented | Two-tier persistence: AsyncStorage always; Firestore sync when signed in. |
| Notification Center (on-device notification history) | Implemented | Local history only — see "Notifications status". |
| Admin notification composition/logging | Implemented | Records to an immutable log and computes a real recipient count — does **not** deliver a real push notification. See "Notifications status". |
| Admin Users page (list all users, Super-Admin-only role changes) | Implemented | `updateUserRole` Cloud Function enforces caller-is-Super-Admin and a self-demotion guard server-side, independent of the UI; see SECURITY.md's "Day 11" section. |
| Admin Settings page (church name, logo URL, description, support email) | Implemented | Super Admin can edit + save; Content Admin/Host see the same data read-only; Member cannot reach the admin route at all. Saved settings drive the mobile app's church-branding header in real time. See SECURITY.md's "Day 13" section. |
| Admin dashboard sidebar navigation (responsive) | Implemented | Replaces the earlier per-page dashboard nav-button row; same routes, same `ProtectedRoute` gate. |
| Firestore security rules / RBAC foundation | Implemented | Deny-by-default, four roles (member/host/content_admin/super_admin); emulator-tested where the emulator is reachable (see "Testing status"). |
| Real push notification delivery (FCM device tokens) | **Not implemented** | No token registration exists anywhere in this project. |
| Store submission / production deployment prep | **Not started** | |

## Bible status

- The Bible reader **architecture** (book list → chapter list → chapter
  view, language toggle, search) is implemented and working.
- **Current Bible content is synthetic/local placeholder data** — no real
  scripture text, copyrighted or otherwise, exists anywhere in this
  repository. See `mobile/src/features/bible/placeholderData.ts`.
- **Bible Search** (added Day 9) searches that same local placeholder
  dataset only, via the existing `getChapter()` data-source seam — no
  remote Bible API or network call is involved.
- **English (World English Bible / WEB)** was investigated and confirmed
  public domain — a usable real-text candidate once real content is
  sourced.
- **Telugu licensing/source remains unresolved.** No Telugu source has
  been confirmed usable; several candidates were investigated and
  dead-ended (see BIBLE_LICENSING.md for the full list and why).
- Real Bible text — English or Telugu — **must not be described as
  production-ready** anywhere in this project until BIBLE_LICENSING.md is
  updated to reflect a confirmed, usable source.
- [BIBLE_LICENSING.md](./BIBLE_LICENSING.md) remains the single source of
  truth for licensing status; its `BLOCKED FOR PRODUCTION` marker is
  unchanged by Day 9/10 work.

## Notifications status

- **expo-notifications integration is implemented**: permission requests,
  foreground/background handler configuration, and receive/tap listeners
  (`mobile/src/services/notifications/notificationService.ts`).
- **Notification history and navigation architecture are implemented**: a
  local, on-device, AsyncStorage-backed history (`notificationHistory.ts`)
  and payload-driven in-app navigation (`notificationNavigation.ts`),
  surfaced via the mobile Notification Center screen.
- **Admin notification composition and logging are implemented**: the
  admin dashboard's Notifications page lets an authorized role compose a
  title/message/recipient group (and, for Content Admin+, an image),
  computes a real recipient count, and writes an immutable entry to the
  `notifications_log` Firestore collection.
- **`sendNotification`** is a real, tested Cloud Function that
  authenticates the caller, checks their role server-side, computes the
  recipient count from live Firestore data, and writes the log entry — but
  this is **local/emulator architecture only**; it has never been deployed
  (see "Cost constraint").
- **Real FCM device-token registration and actual production push
  delivery are NOT implemented.** No device in this project has ever
  registered a push token, and nothing in this codebase can currently
  deliver a notification to a real phone.
- **Sending a notification from the Admin dashboard today does not push
  anything to a real device.** It validates the request, computes the real
  recipient count, and records the attempt in the notification log — the
  admin UI itself now says this explicitly (an info banner and the
  confirmation/success text were corrected during the Day 9+10 review to
  stop implying real delivery).

## Testing status

Verified results as of the Day 14 checkpoint (built on commit `c2bd5fd`):

| Package | Result |
| --- | --- |
| Mobile — Jest | **40/40 suites, 251/251 tests passing** |
| Mobile — typecheck / lint / format | Clean |
| Admin — Vitest | **32/32 files, 238/238 tests passing** |
| Admin — typecheck / lint / format / production build | Clean |
| Functions — typecheck / lint / build | Clean |
| Functions — `healthCheck.test.ts` (the one functions suite that doesn't need the emulator) | **4/4 passing** |

**Not passing — genuinely unexecuted, not failing quietly:**

- **Functions emulator-backed tests** (`createUserProfile.test.ts`,
  `logAdminAction.test.ts`, `sendNotification.test.ts`, `updateUserRole.test.ts`)
  remain **unexecuted** because the Firestore emulator binary download
  (`storage.googleapis.com`) is blocked by the current development
  environment's network allowlist (still `403 Forbidden` /
  `X-Proxy-Error: blocked-by-allowlist` as of the Day 14 re-check). These
  tests are structurally/type sound (verified independently) but have not
  actually run in this environment.
- **The `firebase-tests/` security-rule suite** remains **blocked** by a
  pre-existing dependency conflict: `firebase@^12` (used by the app) vs.
  `@firebase/rules-unit-testing@^3.0.4`'s `peer firebase@^10.0.0`
  requirement. `node_modules` has never been installed for this package;
  the suite has never run.

These two are not described as "passing" anywhere in this project's
documentation, and no test-affecting code has been changed to manufacture
a passing result around them.

**`npm audit` (Day 14):** `admin` reports 0 vulnerabilities. `mobile`
reports 16 moderate-severity advisories and `functions` reports 7, all
transitive (Expo tooling / `@react-navigation`'s `query-string` dependency
chain, and a shared `uuid` advisory pulled in by `firebase-admin`'s Google
Cloud client chain in `functions` and by Expo's config-plugins chain in
`mobile`). None has a fix that isn't a breaking downgrade: `npm audit fix
--force` would downgrade `expo` to `46.0.21` in `mobile` and
`firebase-admin` to `10.3.0` in `functions`; `decode-uri-component`'s
advisory in `mobile` has no fix available at all yet. None are exploitable
through this project's own code paths (they're build-tooling/SDK-internal
dependencies, not runtime request-handling paths this app's users can
reach). Left unfixed rather than force-downgraded — a package.json/lockfile
change needs a deliberate, explicit decision, not an automatic `--force`
run during a documentation pass.

## Cost constraint

- **₹0 / no-billing is a hard constraint for both development and the
  intended production architecture** — not just a development-time
  convenience.
- **Firebase Blaze is NOT enabled.** No billing account and no payment
  method have been added to any Firebase project used by this repository.
- **Production architecture must not depend on any service that requires
  billing unless explicitly approved** — this includes Cloud Functions
  deployment, which requires Blaze to deploy (not just to write/test
  locally).
- **Cloud Functions are currently local/emulator architecture only and
  are NOT deployed.** There is no `.firebaserc` and no live Firebase
  project wired up for this repository; every Cloud Function
  (`createUserProfile`, `logAdminAction`, `sendNotification`) exists as
  reviewed, type-checked, built TypeScript source that has only ever run
  against a local Firestore emulator (where that emulator was reachable).

## Development workflow

- **GitHub is the canonical source of truth** for this project's code —
  not any local working copy.
- **Development happens in `~/Developer/bethaniya-ministries`.** A
  separate, iCloud-synced copy of this project exists on
  `~/Desktop/bethaniya-ministries` on at least one developer machine; it
  has known sync-induced corruption and **must never be used for
  development, reads, or any git operation.**
- Work on each unit of scope follows the same disciplined sequence:

  ```
  AUDIT → IMPLEMENT → TEST → REVIEW → STAGE → REVIEW STAGING → COMMIT → REVIEW COMMIT → PUSH
  ```

  Staging, committing, and pushing only happen after an explicit review
  step confirms the change is scoped correctly, contains no secrets or
  unrelated files, and is backed by real (not manufactured) test results.

## Tech stack

| Layer            | Choice                                                                                                 |
| ---------------- | ------------------------------------------------------------------------------------------------------ |
| Mobile app       | Expo + React Native + TypeScript (strict)                                                              |
| Admin dashboard  | React 18 + Vite + TypeScript (strict) + MUI                                                            |
| Backend          | Firebase (Auth, Firestore, Storage, Cloud Functions, FCM) — Spark (free) plan only, see "Cost constraint" |
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
├── firebase-tests/  Emulator-backed security rule tests (@firebase/rules-unit-testing) — currently blocked, see "Testing status"
├── FINAL_ARCHITECTURE_SPECIFICATION.md   Approved baseline spec
├── ARCHITECTURE.md    How this repo implements that spec
├── SECURITY.md        Security model, RBAC, what's enforced where, real test results
├── ADMIN_GUIDE.md      Step-by-step dashboard guide for church staff (non-programmers)
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

## Development history

Day-by-day detail on what was actually built, and what was explicitly
deferred, for the earliest days of this project:

### What Day 1 actually built

- Three scaffolded, independently-verified packages (mobile/admin/functions)
  with TypeScript strict mode, ESLint, Prettier, and a passing test in each.
- Firestore and Storage security rules implementing the RBAC model from the
  spec (deny-by-default, four roles) — tested against real, running Firebase
  emulators (55 passing, 2 explicitly documented as unverified pending an
  emulator limitation; see SECURITY.md for the full results).
- `firebase.json`, indexes, and `.firebaserc.example` — ready for real
  Firebase project IDs once they exist.
- This documentation set.

Per project instructions, Day 1 was foundation only: no auth flows, no
Bible UI, no songs/events/notifications screens, no admin CRUD, no live
streaming, no store submission prep.

### What Day 2 actually built

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

### What Day 3 actually built

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

### Days 4–8

Announcements CRUD (Day 4), the Daily Verse/Home feed (Day 5), Songs +
audio playback (Day 6), Events + YouTube Live (Day 7), and the Bible
reader foundation with an English/Telugu language toggle and the
placeholder-data theme system (Day 8) were each implemented and tested in
turn — see "Current V1 feature status" and "Bible status" above for their
current, accurate status, and SECURITY.md/ARCHITECTURE.md for
implementation detail. Per-day narrative write-ups for this range were not
maintained in this README; the cumulative, currently-verified test results
for everything through Day 10 are in "Testing status" above.

### Days 9–10

See "Current V1 feature status", "Bible status", "Notifications status",
and "Testing status" above for exactly what Day 9 (Profile, Preferences,
Bible Search) and Day 10 (notification architecture, Admin Notifications,
Notification Center) built and what remains deferred. This work was
committed and pushed as `b4c251e` after a full review against a 10-point
checklist (security rules, notification honesty, preferences race
conditions, Bible Search scope, profile-photo constraints, test quality,
and more) — one bug was found and fixed during that review (admin
Notifications UI wording that implied real push delivery) before the
commit was made.

### Days 11–13

- **Day 11** added the Admin Users page: every user's name/email/phone/role/
  join date, and a role-change control restricted to Super Admin both in the
  UI and, independently, server-side — the `updateUserRole` Cloud Function
  checks the caller's own role from Firestore before writing, and refuses to
  let a Super Admin demote themselves (no accidental-lockout path). See
  SECURITY.md's "Day 11" section for the full security write-up.
- **Day 12** was, per this project's explicit process, a real-device testing
  day — TestFlight/Play Store installs, actively exercising the app on
  physical iPhone/Android hardware. That isn't possible in this development
  environment (no device access), so Day 12 here means a **thorough static/
  code-level QA audit** against the same testing matrix instead: reading
  every screen's code for the failure modes real-device testing would catch
  (loading/error/empty states, form validation, navigation edge cases,
  RBAC boundaries). The one concrete finding: **mobile's Firestore client is
  initialized with `getFirestore()`, not `initializeFirestore(..., {
  localCache: persistentLocalCache() })`**, so there is no configured
  persistent offline cache — documented as a pending finding, not fixed,
  since verifying whether it actually needs fixing requires real-device
  testing under a real network to observe first. **Physical-device testing,
  slow-network testing, and offline-behavior verification remain pending**
  and are not claimed as done anywhere in this project's documentation.
- **Day 13** completed the admin dashboard: a Settings page (church name,
  logo URL, description, support email) with Save, required-field/URL
  validation, loading/error states, and a success confirmation — Super Admin
  can edit and save, Content Admin/Host see the same data read-only, Member
  cannot reach the admin route at all (the pre-existing `ProtectedRoute`
  host-or-above gate, unchanged, and confirmed to apply to `/settings`
  exactly like every other admin route). No Firestore rules change was
  needed — the Day 3 `settings/{settingId}` rule already matched the RBAC
  table exactly. Every admin route was also wrapped in a new responsive
  sidebar (`AdminLayout`), replacing the old per-page nav-button row on the
  dashboard. Mobile's `ChurchBranding` now subscribes to the real
  `/settings/church` document instead of showing static text, falling back
  to the same default name/description when no settings document has been
  saved yet.

This work was committed and pushed as `c2bd5fd`, after the same
audit → implement → test → review discipline as every prior checkpoint —
including a targeted follow-up review specifically re-verifying that the
Settings route's RBAC matched the spec's table exactly and didn't
accidentally over- or under-expose the admin dashboard (see
`SettingsRoute.test.tsx`, which proves all four role outcomes directly).

### Day 14

Documentation + code review, per the spec's Day 14 plan: this README,
ARCHITECTURE.md, and SECURITY.md were brought up to date through Day 13
(they had drifted since the Day 9+10 checkpoint); [ADMIN_GUIDE.md](./ADMIN_GUIDE.md)
was written from scratch (it didn't exist before); a code review pass
looked for secrets, debug statements, error-handling gaps, and
accessibility issues across `admin/src`, `mobile/src`, and `functions/src`
(one real finding: the new Day 13 sidebar's mobile menu button was missing
an `aria-label`, unlike every other icon button in the codebase — fixed);
and `npm audit` was run in all three packages (see "Testing status" above
for the honest result — nothing was force-fixed).

## Production readiness

**Not production ready — expected at this stage.** See
[PRODUCTION_READINESS.md](./PRODUCTION_READINESS.md) for the explicit
staged pipeline and exactly what's verified vs. still pending.
