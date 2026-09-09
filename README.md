# Bethaniya Ministries

Bethaniya Ministries is a church digital platform consisting of three parts:

- **Mobile app** — React Native + Expo (iOS + Android): home feed, Bible
  reader (real World English Bible text for English, Telugu still
  placeholder — see "Bible status" below), songs + audio, events with
  live-stream support, profile/preferences, and a local notification
  history/center.
- **Admin/host dashboard** — React + Vite web app for content management,
  role-based access control, and notification composition/logging.
- **Backend** — Firebase (Auth, Firestore, Storage, Cloud Functions), run
  entirely on the free Spark plan today (see "Cost constraint" below).

## Current checkpoint

- **Checkpoint:** Day 16 complete, followed by a Vespers visual-design-system
  pass across mobile + admin (commit `b0052a5`, "Implement Vespers design
  system across mobile and admin UI"), followed by this V1 completion
  sprint: real World English Bible text imported for English (Telugu
  licensing remains unresolved — see "Bible status" and
  [BIBLE_LICENSING.md](./BIBLE_LICENSING.md)), a documented Firestore
  offline-persistence investigation (not enabled — see "Offline behavior"
  below), navigation/config polish, and this documentation sync.
- **Next planned milestone:** not yet scoped — see
  [PRODUCTION_READINESS.md](./PRODUCTION_READINESS.md)'s requirements
  matrix for exactly what's left and why.

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
| Day 15 | Unit + integration tests, test coverage reporting | ✅ |
| Day 16 | Security hardening + final review | ✅ |
| Vespers | Visual design system across mobile + admin (theme tokens, tab bar, screen redesigns, admin shared components) | ✅ |
| V1 completion sprint | English Bible text import, licensing re-investigation, offline-persistence investigation, config/nav polish, documentation sync | ✅ partial — see "Bible status" and PRODUCTION_READINESS.md |
| Day 17 | Not started | ⏳ |

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
| Bible reader (books/chapters/verses navigation) | Implemented | English content is real (World English Bible); Telugu is still placeholder — see "Bible status". |
| English/Telugu language UI toggle | Implemented | English shows real WEB text; Telugu shows placeholder text pending a licensed source. |
| Bible Search | Implemented | Searches real WEB text for English, placeholder text/references for Telugu — see "Bible status". |
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
- **English now ships real World English Bible (WEB) text** — all 66
  books, all 1189 chapters, 31,102 verses, imported from
  `scrollmapper/bible_databases` (public domain, independently
  corroborated) via a direct, verbatim raw-file fetch. See
  [BIBLE_LICENSING.md](./BIBLE_LICENSING.md)'s "English: resolved and
  imported" section for the full source/method/verification writeup, and
  `mobile/src/features/bible/webBible.ts` for the code.
- **Telugu remains synthetic/local placeholder data** — no real Telugu
  scripture text, copyrighted or otherwise, exists anywhere in this
  repository. See `mobile/src/features/bible/placeholderData.ts`.
  Licensing was re-investigated this checkpoint and a specific, promising
  new candidate was found (a complete modern "IRV 2019" translation,
  copyright Bridge Connectivity Solutions, mirrored via an academic NLP
  corpus) but its exact license terms could not be confirmed — see
  BIBLE_LICENSING.md's "Telugu" section for the full writeup and exactly
  what would resolve it.
- **Bible Search** searches real WEB text for English and the same local
  placeholder dataset for Telugu, via the existing `getChapter()`
  data-source seam — no remote Bible API or network call is involved for
  either language.
- Telugu Bible text **must not be described as production-ready**
  anywhere in this project until BIBLE_LICENSING.md is updated to reflect
  a confirmed, usable source.
- [BIBLE_LICENSING.md](./BIBLE_LICENSING.md) remains the single source of
  truth for licensing status.

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

## Offline behavior & local build status

- **Bible chapters** work fully offline once viewed once — Books/Chapters/
  Reader all read through `mobile/src/features/bible/bibleCache.ts`
  (AsyncStorage), and English's real WEB text is bundled directly into
  the app (not fetched over the network at all), so it's available
  offline from first launch, unlike other content types.
- **Language and theme preferences** persist locally (AsyncStorage) and
  sync to Firestore when signed in — unaffected by this checkpoint.
- **Firestore's own offline persistence** (`initializeFirestore(...,
  { localCache: persistentLocalCache() })`) was investigated this
  checkpoint and **deliberately not enabled**: the SDK's React Native
  build still re-exports IndexedDB-backed persistence APIs from the same
  shared implementation the web build uses, with no React Native-specific
  storage backend found, and React Native's JS engine has no `indexedDB`
  global by default. Enabling it blind — with no real device available to
  verify behavior — risked crashing every Firestore-backed screen instead
  of just missing a nice-to-have. See the comment above `db`'s
  initialization in `mobile/src/services/firebase/app.ts` for the full
  reasoning. Announcements/Songs/Events/Daily Verses/Profile stay
  in-memory-only across app restarts while offline, same as before this
  checkpoint.
- **Local Android APK generation was investigated and is genuinely
  blocked in this development environment**, not by cost: this
  environment has Java 21 and Gradle installed, but no Android SDK, and
  `dl.google.com` (the Android SDK component download host) is blocked by
  the same network egress policy that blocks Firebase's own hosts —
  confirmed by a direct connection attempt, not assumed. Building a real
  APK/AAB requires a machine with the Android SDK (a real Mac/Linux dev
  machine, or a CI runner with it preinstalled) — see DEPLOYMENT.md for
  the exact `expo prebuild` + Gradle commands once that's available.
  `app.json`'s Android/iOS identifiers, versioning (`versionCode`/
  `buildNumber`), and icon/splash config keys are all in place and ready;
  only the actual build execution is blocked here.

## Testing status

Verified results as of the V1 completion sprint checkpoint (built on
commit `b0052a5`, the Vespers checkpoint, plus this sprint's uncommitted
changes at the time of this write-up — see git log for the actual commit
this landed in):

| Package | Result |
| --- | --- |
| Mobile — Jest | **44/44 suites, 284/284 tests passing** (+3 tests this checkpoint, from real WEB-text Bible test coverage) |
| Mobile — typecheck / lint / format | Clean |
| Admin — Vitest | **34/34 files, 249/249 tests passing** (unchanged — admin package untouched this checkpoint) |
| Admin — typecheck / lint / format / production build | Clean |
| Functions — typecheck / lint / build | Clean (untouched this checkpoint) |
| Functions — `healthCheck.test.ts` (the one functions suite that doesn't need the emulator) | **4/4 passing** |

**Not passing — genuinely unexecuted, not failing quietly:**

- **Functions emulator-backed tests** (`createUserProfile.test.ts`,
  `logAdminAction.test.ts`, `sendNotification.test.ts`, `updateUserRole.test.ts`)
  remain **unexecuted** because the Firebase Emulator Suite itself cannot
  start in this environment: re-verified this checkpoint by actually
  attempting `firebase emulators:start` (not just checking a single
  download URL) — it times out trying to reach
  `firebase-public.firebaseio.com` and `firebase.google.com`, both
  explicitly denied by this environment's egress proxy policy
  (`connect_rejected`, confirmed via the proxy's own status endpoint, not
  inferred). These tests are structurally/type sound (verified
  independently) but have not actually run in this environment.
- **The `firebase-tests/` security-rule suite**, including Day 15's new
  `announcement-lifecycle.test.ts` integration test, remains **blocked** by
  a pre-existing dependency conflict: `firebase@^12` (used by the app) vs.
  `@firebase/rules-unit-testing@^3.0.4`'s `peer firebase@^10.0.0`
  requirement. `node_modules` has never been installed for this package;
  the suite has never run.

These two are not described as "passing" anywhere in this project's
documentation, and no test-affecting code has been changed to manufacture
a passing result around them.

**Test coverage (`npm run test:coverage` in each package; mobile re-run
this checkpoint, admin/functions unchanged since Day 15):**

| Package | Statements | Branches | Functions | Lines |
| --- | --- | --- | --- | --- |
| Admin (Vitest, `@vitest/coverage-v8`) | 88.33% | 82.91% | 84.85% | 89.22% |
| Mobile (Jest, built-in) | 87.00% | 76.68% | 86.17% | 88.66% |
| Functions (Jest, built-in) | 22.77% | 0% | 0% | 23.46% |

Admin and Mobile both clear the spec's 60%+ target with real margin.
**Functions' number is not representative of the package's actual logic
coverage** — only `healthCheck.test.ts` can execute without the blocked
Firestore emulator, so the other four handler files (each fully covered by
their own emulator-backed test file, verified independently by reading
them) show as near-0% simply because their tests never ran, not because
they're untested code. The low-coverage files worth naming honestly in
both apps: mobile's `services/firebase/{app,config,googleAuthConfig}.ts`
(SDK initialization/config, mostly non-branching setup code) and
`useGoogleSignIn.ts` (native OAuth, already documented as unverified
against a real provider — see "Current V1 feature status"); admin's
`EditAnnouncementPage.tsx`/`EditDailyVersePage.tsx`/`EditEventPage.tsx`/
`EditSongPage.tsx` show 0% only because each is a thin route param →
props wrapper around its already-100%-covered `*Form.tsx` component (the
`*Form.tsx` file itself is what's actually tested).

**`npm audit` (re-run Day 16, unchanged since Day 14):** `admin` reports 0
vulnerabilities (including after Day 15's new `@vitest/coverage-v8`
devDependency). `mobile` reports 16 moderate-severity advisories and
`functions` reports 7, all transitive (Expo tooling / `@react-navigation`'s
`query-string` dependency chain, and a shared `uuid` advisory pulled in by
`firebase-admin`'s Google Cloud client chain in `functions` and by Expo's
config-plugins chain in `mobile`). None has a fix that isn't a breaking
downgrade: `npm audit fix --force` would downgrade `expo` to `46.0.21` in
`mobile` and `firebase-admin` to `10.3.0` in `functions`;
`decode-uri-component`'s advisory in `mobile` has no fix available at all
yet. None are exploitable through this project's own code paths (they're
build-tooling/SDK-internal dependencies, not runtime request-handling paths
this app's users can reach). Left unfixed rather than force-downgraded — a
package.json/lockfile change needs a deliberate, explicit decision. See
SECURITY.md's "Day 16" section for the full security review checklist this
result is part of.

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
for the honest result — nothing was force-fixed). This pass also found and
fixed a real bug in its own prior work: a Python string-replacement script
used to edit this README on Day 14 had a default-argument capture mistake
that silently dropped one of two edits in the same script, leaving the
"Current checkpoint" section above stuck on the stale Day 9+10 text even
after Day 14 was committed and pushed — caught during this Day 15+16
audit, not by the earlier review, and corrected here.

### Day 15

Unit + integration tests, test coverage reporting, per the spec's Day 15
plan. Most of the "unit tests: auth logic, input validators, data
transformers" ask was already satisfied by prior days' work; the two real
gaps closed this checkpoint:

- **Admin's Zustand stores (`authStore.ts`, `appStore.ts`) got direct unit
  tests** (`admin/src/store/__tests__/`) — previously only exercised
  indirectly through component tests like `App.test.tsx`. Both now show
  100% statement coverage.
- **A new integration test**, `firebase-tests/src/announcement-lifecycle.test.ts`,
  proves the literal "create announcement → verify Firestore → verify
  mobile" flow the spec names: a Content Admin creates a draft, it's
  confirmed unreadable by a mobile member, the Content Admin publishes it,
  and the same member session then reads the published data back
  successfully — using `@firebase/rules-unit-testing`'s real multi-session
  testing environment, the same pattern `firestore.rules.test.ts` already
  uses. Like every other `firebase-tests/` file, it has not actually
  executed in this environment (see "Testing status" above) — it's
  structurally sound and ready once either blocker clears.
- **Test coverage reporting** was added to all three packages
  (`npm run test:coverage`): admin needed one new devDependency,
  `@vitest/coverage-v8` (Vitest doesn't bundle a coverage provider);
  mobile and functions use Jest's built-in `--coverage`, no new dependency.
  See "Testing status" above for the actual numbers.

Sign-in flow "end-to-end" and security-rule integration tests were **not**
duplicated — both were already covered (App-level state-transition tests
in both apps; the existing `firestore.rules.test.ts`/`storage.rules.test.ts`
suite) before this checkpoint, and adding a second, heavier version (e.g. a
new browser-automation/e2e tool) wasn't justified by a gap that didn't
exist — see the spec's own "do not add unrelated improvements" principle.

### Day 16

Security hardening + final review, per the spec's Day 16 plan, run as an
explicit checklist against this repository's current state — see
SECURITY.md's new "Day 16" section for the full table (secrets scan,
`git log --all -S "FIREBASE"`, HTTPS verification, auth/authz review,
`npm audit`) and results.

**One line item could not be executed as literally specified**: "Enable
Firestore backups + monitoring." This repository has never had a live
Firebase project — `.firebaserc` is gitignored and has never existed, no
Cloud Function has ever been deployed — so there is nothing to enable
backups or monitoring *on*. Separately, Firestore's managed backup feature
is itself billed under Firebase's Blaze plan, which this project's ₹0
constraint rules out regardless. Rather than skip this silently or fake an
"enabled" state, SECURITY.md's "Backup & disaster recovery" section was
expanded into a concrete, actionable plan for whoever deploys this later
(including the Blaze-tier caveat, a possible free-tier-compatible manual
fallback worth verifying at deployment time, and that Performance
Monitoring/Crashlytics are Spark-compatible and could be enabled at ₹0
once a real project exists) — this is a deployment-time task, not
something Day 16 could do from this repository as it stands.

## Production readiness

**Not production ready — expected at this stage.** See
[PRODUCTION_READINESS.md](./PRODUCTION_READINESS.md) for the explicit
staged pipeline and exactly what's verified vs. still pending.
