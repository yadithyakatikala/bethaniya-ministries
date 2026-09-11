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

**Status correction (Day 2):** this line previously said the rules were
"written but not yet tested against the emulator" — that became inaccurate
as of the Day 1 commit that added `firebase-tests/` (real
`@firebase/rules-unit-testing` emulator-backed tests, 55 passed / 2
documented skips as of Day 2). See SECURITY.md's "Current rule coverage"
section for the actual, current test status and the two remaining skips.

## Cloud Functions

`functions/src/index.ts` exports the initialized Admin SDK app instance
(`adminApp`), which every function module imports rather than each calling
`initializeApp()` separately, plus three functions: `healthCheck` (v2,
HTTPS, Day 1 placeholder), `createUserProfile` (v1, Auth `onCreate`
trigger, added Day 2), and `logAdminAction` (v2, HTTPS callable, added Day
3) — see the Day 2/Day 3 sections below and SECURITY.md for what each does
and why. `sendNotification` is added later (Day 10) per the spec's
day-by-day plan.

## Bundle identifiers / app IDs

`mobile/app.json` sets `ios.bundleIdentifier` and `android.package` to
`com.bethaniyaministries.app` as a placeholder. **Confirm or change this**
before it matters (Apple Developer / Google Play account setup, EAS build
config) — it's a naming choice, not a technical constraint, and cheap to
change now, expensive to change after store submission.

## What's explicitly deferred (and where it's tracked)

- Bible content and its licensing decision → FINAL_ARCHITECTURE_SPECIFICATION.md
  Section C. No Bible text of any kind exists in this repo yet.
- Real Google/Apple OAuth credentials and a native mobile build → SECURITY.md's
  "Day 2: Authentication" section has the exact blockers (network-blocked
  Console access; Apple Developer account + `eas-cli` native build).
- A production-capable Phone Authentication verifier (the current one is
  emulator-only by design) → SECURITY.md, same section.
- Per-feature RBAC beyond the coarse member/host/content_admin/super_admin
  boundary (e.g. "hosts can toggle live-stream fields but not delete
  announcements") → later V1 scope per the spec's day-by-day plan.
- Everything else in the spec's Day 3+ plan.

## Day 2: Authentication — code patterns

This section documents *how the auth code is organized*, at the same level
as the sections above. For *why* each provider decision was made and what
security properties are actually enforced, see SECURITY.md's "Day 2:
Authentication" section — this section doesn't repeat that content.

### Mobile: auth state as a Context, not a global store

`mobile/src/context/AuthContext.tsx` exposes one `AuthStatus` union —
`'loading' | 'unauthenticated' | 'authenticated' | 'error'` — via a plain
`AuthProvider`/`useAuth()` React Context, subscribing once to Firebase's
`onAuthStateChanged` inside a `useEffect`. This mirrors the "Context/Zustand,
not Redux" call already made on Day 1 (see above): auth session state is
exactly the kind of state that section named as not needing a centralized
store, and a Context is the smaller of the two remaining tools for a value
every screen needs to read. `mobile/App.tsx` renders `LoadingScreen` /
`SignInScreen` / `HomeScreen` purely by switching on `status` — no
navigation library was introduced for this (out of scope for Day 2; a real
navigator is a later V1 concern once there's more than one authenticated
screen).

### Admin: why the auth subscription lives in a `useEffect`, not in `create()`

`admin/src/store/authStore.ts` splits into two exports: the Zustand store
itself (`useAuthStore`) and a standalone `subscribeToAuthChanges()`
function that wires `onAuthStateChanged` to `useAuthStore.setState(...)`.
`subscribeToAuthChanges()` is called from `admin/src/App.tsx`'s
`useEffect(() => subscribeToAuthChanges(), [])`, not from inside
`create()`'s initializer.

This split exists for a concrete, discovered reason, not stylistic
preference: an earlier version of this file called
`onAuthStateChanged(auth, ...)` directly inside `create()`. Since a
Zustand store created with `create()` is a module-level singleton, that
subscription fired exactly once, at first import, for the lifetime of the
process — including the lifetime of a test run. Per-test mock
reconfiguration (`vi.mocked(onAuthStateChanged).mockImplementation(...)`)
had no effect, because the one real call had already happened before any
test-specific mock was set. Moving the subscription into a function invoked
from a component's `useEffect` fixed this: React Testing Library's
`render()` mounts a fresh component tree per test (with automatic
`cleanup()` between tests), so the effect — and the mocked
`onAuthStateChanged` call it makes — genuinely re-runs for every test,
restoring per-test control. `admin/src/App.test.tsx` exercises all three
`ProtectedRoute` states (loading, unauthenticated, unauthorized-role,
authorized) this way, each with its own mock behavior.

### `createUserProfile`: handler logic kept separate from the trigger wrapper

`functions/src/createUserProfile.ts` exports the actual logic
(`createUserProfileHandler`, a plain `async (user: AuthUserLike) =>
Promise<void>` function) separately from the one-line trigger wrapper
(`functionsV1.auth.user().onCreate(createUserProfileHandler)`, in
`functions/src/index.ts`). This follows the same pattern Day 1 already
established for `healthCheck`/`adminApp` in this file: keep the pure logic
independently unit-testable (here, against a real Firestore emulator via
`FIRESTORE_EMULATOR_HOST`, with a plain object standing in for a
`UserRecord` — see `AuthUserLike`) without needing a Cloud Functions test
harness, and keep `firebase-functions`' own v1/v2 import surface isolated
to as few files as practical, since mixing those imports carelessly is
what caused the ESM/`jose` Jest-parsing crash documented for `healthCheck`
on Day 1. `functions.auth.user().onCreate()` only exists in the v1
namespace (there is no v2 "fires after creation" equivalent — v2's
`identity` triggers are pre-creation *blocking* functions requiring
separate Console configuration this project doesn't use), so this one
function intentionally uses v1 imports alongside `healthCheck`'s v2 ones;
`firebase-functions` supports mixing both from the same package deployment.

### Phone-auth verifier: emulator-only by construction, not by convention

`mobile/src/services/firebase/emulatorRecaptchaVerifier.ts`'s
`getPhoneApplicationVerifier()` throws if
`mobile/src/services/firebase/app.ts`'s `usingFirebaseEmulators` flag is
false, rather than silently returning a verifier that would be wrong (and
insecure) against a real backend. This means the phone sign-in code path
has exactly one verifier implementation today, and it is structurally
inert outside emulator mode — there is no runtime branch a future change
could accidentally leave pointed at the stub against a real project. A real
verifier for production Phone Authentication is unimplemented; see
SECURITY.md for what closing that gap requires.

### Where Day 2 code lives

- `mobile/src/services/firebase/{authService,authErrors,googleAuthConfig,
  appleSignIn,emulatorRecaptchaVerifier}.ts`, `mobile/src/context/AuthContext.tsx`,
  `mobile/src/features/auth/{useGoogleSignIn,LoadingScreen,SignInScreen,
  HomeScreen}.tsx`.
- `admin/src/services/firebase/{authService,authErrors,userProfile}.ts`,
  `admin/src/store/authStore.ts`, `admin/src/routes/ProtectedRoute.tsx`,
  `admin/src/features/auth/{LoginPage,DashboardPage}.tsx`,
  `admin/src/types/index.ts` (the `UserRole`/`canAccessAdminDashboard` shared
  type — the closest thing to a cross-cutting type Day 2 needed; still
  small enough not to justify a shared package per the "Why three
  independent packages" reasoning above).
- `functions/src/createUserProfile.ts`, wired from `functions/src/index.ts`.

## Day 3: `logAdminAction` — a callable, not a trigger

`functions/src/logAdminAction.ts` follows the same "pure handler in its own
file, thin wrapper in `index.ts`" pattern as `createUserProfile` (see
above), for the same reason: keep the logic independently unit-testable
against a real Firestore emulator without a Cloud Functions test harness,
and keep `firebase-functions`' import surface out of files that don't need
it.

It goes one step further than `createUserProfile` on that second point:
`logAdminAction.ts` doesn't import anything from `firebase-functions` at
all, not even `HttpsError`. `firebase-functions/v2/https` transitively
pulls in `firebase-admin`'s auth token-verification code
(`jwks-rsa` → `jose`, an ESM-only package), which crashes Jest's CommonJS
parser the same way `firebase-functions/v1` did for `healthCheck` — this
was discovered when the handler's own `HttpsError` import caused exactly
that crash. The fix: `logAdminAction.ts` defines its own tiny
`AdminActionError` class (`{ code, message }`, no Firebase dependency at
all); only `index.ts`'s `onCall` wrapper — which Jest never actually
executes (see `healthCheck.test.ts`'s mocks) — catches `AdminActionError`
and converts it to a real `HttpsError` for actual callable clients.

**Why callable, not a Firestore-triggered function**, even though the spec
says "triggers on writes": Firestore background triggers don't receive
caller-identity context (no `request.auth`), so they cannot produce a
trustworthy `admin_id`/`admin_email` without trusting a client-written
field on the document itself — see SECURITY.md's "Day 3" section for the
full reasoning and the security properties this design gives.

### Where Day 3 code lives

- `functions/src/logAdminAction.ts`, wired from `functions/src/index.ts` as
  the `logAdminAction` callable.
- No mobile or admin changes — nothing calls `logAdminAction` yet, since no
  admin CRUD UI exists to call it from (that starts Day 4+).

## Day 11: Admin Users page — code patterns

This section documents *how* the Users page code is organized, at the same
level as the Day 2/Day 3 sections above. For *why* the RBAC boundary is
enforced the way it is and what's actually verified, see SECURITY.md's
"Day 11" section — this section doesn't repeat that content.

### A stricter, page-local role check on top of the route-level gate

`admin/src/features/users/UsersPage.tsx` has its own `canManageUsers(role)`
check (`role === 'super_admin'`), evaluated inside the component itself,
in addition to — not instead of — `ProtectedRoute`'s existing host-or-above
gate that every admin route already goes through. This is a deliberate
two-layer pattern specific to this page: `ProtectedRoute` answers "can this
role reach the admin dashboard at all", while `canManageUsers` answers a
narrower question ("can this specific role manage other users' roles") that
only this one page needs to ask, because Users management is Super-Admin-
only per the spec while most other admin routes are host-or-above. Adding
a third role tier to `ProtectedRoute` itself for one page would have made
every other route's gate check a page it doesn't need to know about; a
local check keeps that narrowing where it's actually needed.

### `updateUserRole`: one Cloud Function, two writes, one invocation

`functions/src/updateUserRole.ts` follows the same handler-in-its-own-file
pattern as `logAdminAction.ts` (see "Day 3" above) — same plain-`Error`-
subclass-not-`HttpsError` reasoning, same `index.ts` `onCall` wrapper. It
does the role write and the audit-log write in one handler invocation
rather than two separate calls, so a client can never end up with a role
change that has no matching audit entry (or vice versa) because of a
dropped second network call.

### Where Day 11 code lives

- `admin/src/features/users/{UsersPage,__tests__/UsersPage.test.tsx}`,
  `admin/src/services/firebase/users.ts` (the one-time-fetch data layer —
  see that file's own header comment for why this page fetches once rather
  than subscribing, unlike almost every other admin list page).
- `functions/src/updateUserRole.ts`, wired from `functions/src/index.ts` as
  the `updateUserRole` callable.

## Day 13: Settings + AdminLayout — code patterns

This section documents *how* the Day 13 code is organized. For the RBAC
verification and the read-vs-admin-access distinction it re-confirms, see
SECURITY.md's "Day 13" section.

### Seed-once-from-first-snapshot, not `useState` on every snapshot

`SettingsPage.tsx`'s form fields are seeded from the settings document's
*first* real-time snapshot only (`useRef(false)`, not `useState`, so the
seeding doesn't re-run on every effect re-invocation), the same pattern
`mobile/src/features/profile/ProfileScreen.tsx` already established for
its own display-name field. Without this, a Super Admin mid-edit would have
their in-progress form text overwritten every time the `onSnapshot`
listener fires again — including from their own save completing, or from
another admin saving concurrently.

### `AdminLayout`: a CSS-only responsive drawer, not `useMediaQuery`

`admin/src/components/AdminLayout.tsx` wraps every authenticated route
(see `App.tsx`) in a sidebar using MUI's documented "responsive drawer"
recipe: two `<Drawer>` elements are always both rendered, and which one is
visible is controlled purely by each one's own `sx.display` breakpoint
object (a CSS media query), not by `useMediaQuery()`/`window.matchMedia()`
in JavaScript. This was a deliberate choice, not the only option: jsdom
(which `admin/src/test/setup.ts` configures for every Vitest run, including
`App.test.tsx`, which renders the whole app) doesn't implement
`window.matchMedia` by default, and adding a polyfill just for this one
component would have been a new test-setup dependency for a purely
cosmetic breakpoint decision. The CSS-only recipe sidesteps that entirely —
`AdminLayout.test.tsx` verifies both drawers render and the active route's
nav item gets MUI's `Mui-selected` class, without needing any
`matchMedia` mock at all.

### `settings.ts`: `setDoc(..., { merge: true })`, not `updateDoc`

`admin/src/services/firebase/settings.ts`'s `saveChurchSettings` uses
`setDoc` with `merge: true` rather than `updateDoc`, because
`/settings/church` may not exist yet the first time any Super Admin ever
saves — `updateDoc` throws on a document that's never been created,
`setDoc(..., { merge: true })` creates it if absent and leaves any other
future `settings/{settingId}` document alone. Followed by a `logAdminAction`
call, the same client-write-then-log pattern every other admin write module
in this project already uses (`announcements.ts`, `songs.ts`, `events.ts`,
`dailyVerses.ts`).

### Where Day 13 code lives

- `admin/src/components/{AdminLayout,__tests__/AdminLayout.test.tsx}`.
- `admin/src/features/settings/{SettingsPage,validation,__tests__/*}.ts(x)`,
  `admin/src/services/firebase/{settings,__tests__/settings.test.ts}.ts`.
- `admin/src/features/auth/DashboardPage.tsx` (the old per-page nav-button
  row removed — see that file's own doc comment).
- `mobile/src/features/auth/HomeScreen.tsx` (`ChurchBranding`, rewritten
  from static text to a live subscription), `mobile/src/services/firebase/{settings,__tests__/settings.test.ts}.ts`.

## New V1 features: Reading Plans, Prayers, Community — code patterns

Added at a later checkpoint than everything above, per an explicit owner
decision (see PRODUCTION_READINESS.md's "New V1 features" note) — not
part of this project's original day-by-day plan. Each follows an
existing pattern from the sections above rather than inventing a new one:

### Community mirrors Announcements exactly

`admin/src/services/firebase/communityPosts.ts` and
`mobile/src/services/firebase/communityPosts.ts` are structural clones of
`announcements.ts` (same converter/subscribe/create/update/delete/
setPublished shape, same `logAdminAction` call after every admin write,
same `where('published', '==', true)` mobile-side query). Deliberately
**not** an open member-posting feed — there is no client code path for a
member to write to `community/{id}` at all, enforced by
`firestore.rules`' `isContentAdminOrAbove()` write gate.

### Plans: a subcollection, not an array field, for days

`plans/{id}` holds metadata only; each day is its own document at
`plans/{id}/days/{id}`. This lets an admin add, edit, or remove a single
day (`admin/src/features/plans/PlanDaysPage.tsx`) without reading and
rewriting the entire plan document — the same reasoning behind every
other subcollection-shaped feature in this project. The tradeoff:
`plans/{id}.dayCount` can't be validated against the real number of
`days` documents by a Firestore rule alone (rules can't count a
subcollection without an unbounded read), so
`admin/src/services/firebase/plans.ts` recomputes and writes it after
every day create/delete (`syncPlanDayCount`) instead. A day's read
visibility follows its *parent* plan's `published` flag via a `get()` in
`firestore.rules` (`plans/{planId}/days/{dayId}`'s rule), rather than
duplicating a `published` field onto every day — one extra read per rule
evaluation, the same tradeoff `callerRole()` already accepts elsewhere in
this file.

### Prayers and plan progress: private-per-owner, no admin path at all

`users/{uid}/prayers/{id}` and `users/{uid}/planProgress/{planId}` are
both gated purely on `isOwner(userId)` in `firestore.rules` — unlike
every other collection in this project, there is **no**
`isContentAdminOrAbove()` read branch on either one. An admin cannot read
another member's prayers or plan progress through this app, by design
(verified in `firebase-tests/src/firestore.rules.test.ts`). Both live as
subcollections under the existing `/users/{userId}` document rather than
top-level collections, reusing that document's existing
authorization boundary instead of introducing a new one.

### Where this code lives

- Rules/indexes: `firestore.rules` (new `isValidPrayer`/
  `isValidCommunityPost`/`isValidPlan`/`isValidPlanDay`/
  `isValidPlanProgress` validators and match blocks),
  `firestore.indexes.json` (`community`, `plans` composite indexes).
- Admin: `admin/src/services/firebase/{communityPosts,plans}.ts`,
  `admin/src/features/{community,plans}/*`, `admin/src/types/index.ts`
  (`CommunityPost`, `Plan`, `PlanDay` + form-input types).
- Mobile: `mobile/src/services/firebase/{prayers,communityPosts,plans}.ts`,
  `mobile/src/features/{prayers,community,plans}/*`, wired into
  `mobile/src/navigation/AppNavigator.tsx`, `mobile/src/features/more/MoreScreen.tsx`,
  and `mobile/src/features/auth/HomeScreen.tsx` (a "Continue your plan"
  card). The existing `Home/Bible/Songs/Events/More` bottom tab bar is
  unchanged — these are reached via More and Home's quick-links grid, not
  new bottom-tab destinations.
