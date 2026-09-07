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
`initializeApp()` separately, plus two functions: `healthCheck` (v2, HTTPS,
Day 1 placeholder) and `createUserProfile` (v1, Auth `onCreate` trigger,
added Day 2 — see below and SECURITY.md for what it does and why). Further
functions (`logAdminAction`, `sendNotification`) are added later per the
spec's day-by-day plan.

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
