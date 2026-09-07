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
npx firebase-tools emulators:exec --only auth,firestore,storage "npm --prefix firebase-tests test"
```

(the two `*_BINARY_PATH` overrides are only needed if your network can't
reach `storage.googleapis.com` to auto-download the emulator jars — see
`firebase-tests/README.md`.)

**Result as of the last run: 55 passed, 0 failed, 2 explicitly skipped
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

**Also verified: the actual client-SDK connection path the apps use.**
`firebase-tests/src/client-emulator-smoke.test.ts` signs in through the Auth
emulator, then uses that real session against the Firestore and Storage
emulators the same way `mobile/src/services/firebase/app.ts` and
`admin/src/services/firebase/app.ts` do at runtime (plain `firebase/app`,
`firebase/auth`, `firebase/firestore`, `firebase/storage` client SDK calls,
not `@firebase/rules-unit-testing`) -- proving an Auth-emulator-issued token
is actually honored by the Firestore/Storage emulators under the real,
committed rules, not just that the rules pass in isolation.

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

## Day 2: Authentication

### Providers and where they run

| App    | Provider(s)                          | Implementation                                                                 |
| ------ | ------------------------------------- | ------------------------------------------------------------------------------- |
| Mobile | Google, Apple, Phone (OTP)            | Firebase Auth via the Firebase JS SDK (not `@react-native-firebase`)             |
| Admin  | Email + Password                      | Firebase Auth via the Firebase JS SDK; admin/host accounts are provisioned by a Super Admin, there is no self-signup |

Mobile has no email/password option by design (per
FINAL_ARCHITECTURE_SPECIFICATION.md's Authentication section) — OAuth/OTP
only, for simpler member UX. Admin has no OAuth by design — a small,
known set of staff accounts, provisioned deliberately.

### Google Sign-In

`mobile/src/features/auth/useGoogleSignIn.ts` uses `expo-auth-session`'s
generic OAuth/OIDC request machinery (`expo-auth-session/providers/google`'s
`useIdTokenAuthRequest`), not the deprecated `expo-google-app-auth` package.
It exchanges the resulting Google ID token for a Firebase credential via
`GoogleAuthProvider.credential()` + `signInWithCredential()`
(`mobile/src/services/firebase/authService.ts`).

**Blocked on real Google Cloud OAuth Client IDs**, which require the
Google Cloud/Firebase Console — every `accounts.google.com` /
`googleapis.com` endpoint is network-blocked in this sandbox (see
ENVIRONMENT.md), so these credentials cannot be created here. Until
`EXPO_PUBLIC_GOOGLE_CLIENT_ID` (and/or the per-platform variants) are set in
`mobile/.env.local`, the "Continue with Google" button renders but stays
disabled with an explanatory message (`useGoogleSignIn.ts`'s
`configured`/`canPrompt` flags) — pressing it cannot reach Google at all,
by construction, rather than failing unpredictably.

### Apple Sign-In

`mobile/src/services/firebase/appleSignIn.ts` uses `expo-apple-authentication`
(the native "Sign in with Apple" sheet), generates a random nonce, hashes it
with `expo-crypto` (SHA-256) for the native request, and exchanges the
resulting identity token + raw nonce for a Firebase credential via
`OAuthProvider('apple.com').credential()` + `signInWithCredential()`.
`mobile/app.json` was updated to add the `expo-apple-authentication` config
plugin (adds the Sign In with Apple entitlement to a native build).

**Blocked on**: a native/custom-dev-client build (this does not work in
Expo Go at all) and a real Apple Developer Program account with the
capability enabled for the app's bundle ID — neither exists yet, and
building one requires `eas-cli`/Apple credentials this environment cannot
create (see DEPLOYMENT.md's "Mobile app (EAS Build)" section, a
pre-existing, documented limitation). The button hides itself entirely on
platforms/devices where `expo-apple-authentication`'s own
`isAvailableAsync()` reports Apple Sign-In is unsupported, rather than
showing a button that can never work.

### Phone Authentication — the reCAPTCHA/verifier decision

`signInWithPhoneNumber()` requires an `ApplicationVerifier` (anti-abuse
challenge). The Firebase JS SDK's concrete implementation,
`RecaptchaVerifier`, is a browser-only DOM class — **it is not exported
from the React Native build at all** (confirmed by inspecting
`node_modules/@firebase/auth/dist/rn/index.js`'s actual exports: it has
`PhoneAuthProvider` and `signInWithPhoneNumber`, no `RecaptchaVerifier`).

The community package that normally fills this gap on Expo,
`expo-firebase-recaptcha`, was evaluated and **deliberately not used**: it
pulls in an outdated `expo-firebase-core` → nested `expo-constants` →
`{xmldom, semver, uuid, xml2js}` chain that added **4 high + 13 moderate**
real `npm audit` findings (XML injection, ReDoS, prototype pollution) when
test-installed, on top of this project's pre-existing 10 moderate,
unrelated `@expo/*`-tooling findings. `npm audit fix --force` could only
"fix" this by downgrading to an even older, still-vulnerable version. Given
the project's own "no unnecessary dependencies" / quality-over-speed
principles, and that this dependency would ship inside the real app bundle,
it was installed, audited, and then removed in the same session rather than
accepted.

Instead, `mobile/src/services/firebase/emulatorRecaptchaVerifier.ts`
implements a minimal, dependency-free `ApplicationVerifier` (the interface
is just `{ type: string; verify(): Promise<string> }`) for **emulator-only**
use. Reading `@firebase/auth`'s actual bundled source confirms `.verify()`
is only ever invoked when the connected project has reCAPTCHA Enterprise
phone-provider protection enabled server-side (a real-project Console
setting this repo's dev project does not have), and the Auth Emulator does
not enforce any reCAPTCHA check for phone sign-in at all — so this stub is
sufficient for genuine emulator-backed development and testing.
`getPhoneApplicationVerifier()` throws if called outside emulator mode, so
it can never accidentally reach a real backend.

**Blocked on**: real (non-emulator) Phone Authentication has no
implemented verifier at all — this is a known, deliberate gap, not an
oversight. Closing it needs either a maintained, dependency-clean
`RecaptchaVerifier`-equivalent for Expo/React Native (none was found as of
this writing) or enabling reCAPTCHA Enterprise for the real project. Do not
reach for `expo-firebase-recaptcha` to close this gap without re-running
`npm audit` and re-evaluating whether a fixed version exists.

### Role assignment: `createUserProfile()`

`functions/src/createUserProfile.ts` implements the Cloud Function named in
FINAL_ARCHITECTURE_SPECIFICATION.md ("`createUserProfile()` on first
sign-in"). It's a `functions.auth.user().onCreate()` trigger (v1 namespace —
there is no v2 equivalent that fires *after* user creation; v2's `identity`
triggers are pre-creation *blocking* functions requiring separate Console
configuration this project doesn't use).

Security properties, each covered by a real test against a running
Firestore emulator (`functions/src/__tests__/createUserProfile.test.ts`):

- **Runs only from the Auth system itself**, never from anything the
  mobile/admin client supplies — the client has no way to invoke this
  function directly or pass it arguments.
- **The client can never influence the assigned role.** The handler's
  input type (`AuthUserLike`) has no `role` field at all — there is nothing
  to trust or distrust, by construction, not by a runtime check that could
  be bypassed.
- **Default role is always `'member'`** (the lowest-privilege role) — the
  only value `MEMBER_ROLE` can be.
- **Idempotent**: wrapped in a Firestore transaction that checks for an
  existing document first. Cloud Functions background triggers have
  at-least-once delivery, so a retried invocation is a no-op rather than a
  duplicate write.
- **Never overwrites an existing profile** — including one whose `role` a
  Super Admin has since elevated. Tested explicitly: a pre-existing
  `super_admin` profile survives a `createUserProfile` invocation for that
  same uid unchanged.
- **Independently enforced twice.** `firestore.rules`'s own create rule
  (`allow create: if isOwner(userId) && request.resource.data.role ==
  'member'`) means even a hypothetical direct client write to
  `/users/{uid}` on create is rejected for any role other than `member` —
  this function and the rules enforce the same invariant from two
  unrelated code paths, deliberately, rather than relying on either alone.

Only the fields the Admin Users page actually needs are stored — `role`,
`displayName`, `email`, `phoneNumber`, `createdAt` — no field beyond what
FINAL_ARCHITECTURE_SPECIFICATION.md's Day 11 Admin Users page describes
(name, email, phone, role, join date). No unnecessary personal data is
collected.

### Admin/Host authorization boundary

`admin/src/routes/ProtectedRoute.tsx` distinguishes: unauthenticated (deny,
redirect to `/login`); authenticated with role `member` (deny, "Access
denied" message); authenticated with role `host`/`content_admin`/
`super_admin` (render the dashboard). The role is read from the signed-in
user's own `/users/{uid}` document (`admin/src/services/firebase/userProfile.ts`),
which `firestore.rules` already permits any authenticated user to read
(`allow read: if isOwner(userId) || isContentAdminOrAbove();`).

**This client-side check is explicitly a UX convenience, not the security
boundary** — consistent with this file's "hiding a button is not security"
principle above. A signed-in Member who somehow bypassed
`ProtectedRoute` (e.g. by disabling JavaScript checks) would still be
denied every actual Firestore/Storage read or write by `firestore.rules`
and `storage.rules`, evaluated server-side, unaffected by anything the
client renders. Day 2 does not add per-feature RBAC (e.g. "hosts can toggle
live-stream fields but not delete announcements") — only the coarse
authenticated/member/staff boundary; finer-grained UI gating is later V1
scope, and is not a security control either way, per the same principle.

### Session persistence

- **Mobile**: `initializeAuth(firebaseApp, { persistence:
  getReactNativePersistence(AsyncStorage) })` — Firebase Auth's own
  documented, SDK-provided React Native persistence mechanism, not a
  hand-rolled storage scheme. **Correction to
  FINAL_ARCHITECTURE_SPECIFICATION.md**: that document twice described this
  as "AsyncStorage (encrypted ...)" / "AsyncStorage (encrypted by OS)" —
  this was inaccurate. Plain `@react-native-async-storage/async-storage`
  does not encrypt its contents (plain SQLite on Android, plain files on
  iOS); OS-level full-disk encryption is not the same as app-level
  encryption of this specific storage. Both lines have been corrected in
  place in the spec. The actual mitigation is Firebase Auth's own standard
  mobile design: only a short-lived ID token and a long-lived, individually
  revocable refresh token are ever persisted — never a password — which is
  the same pattern Firebase's own official `getReactNativePersistence`
  helper implements and is the reason this project uses that helper instead
  of writing to AsyncStorage directly anywhere in the auth flow.
- **Admin (web)**: Firebase Auth's default web persistence
  (IndexedDB-backed `indexedDBLocalPersistence`, falling back automatically
  per Firebase's own SDK logic) — `admin/src/services/firebase/app.ts` calls
  plain `getAuth(firebaseApp)` without overriding persistence, so it uses
  whatever Firebase's SDK selects as the safe default for the current
  browser, per Firebase's own documentation. No admin code writes anything
  auth-related to `localStorage`/`sessionStorage` directly.

### Error handling

Both apps map every Firebase Auth error code to a short, user-facing
message and never render a raw Firebase error code or message
(`mobile/src/services/firebase/authErrors.ts`,
`admin/src/services/firebase/authErrors.ts`) — covering invalid/expired
OTP, cancelled Google/Apple sign-in (detected via provider-specific
cancellation shapes, not just Firebase error codes), network failure, and
(admin-only) an unauthorized-role message distinct from "wrong password."

### What's actually verified — Day 2 test levels

**Unit tested** (mocked Firebase SDK boundary, no real backend): the full
mobile auth state machine (`AuthContext`) across
loading/unauthenticated/authenticated/error and sign-out; `authService`'s
credential-exchange calls; the phone-OTP screen flow including error
display; the admin `authStore`/`ProtectedRoute`/`LoginPage` across the same
states plus the member-vs-staff authorization boundary; every
`authErrors.ts` mapping, for both apps. 47 mobile + 15 admin tests, all
passing (`mobile`: `npm test`, `admin`: `npm test`).

**Emulator tested** (real, running Firebase emulators, no mocks): the
`createUserProfile` Cloud Function's full security-property set, against a
real Firestore emulator (8/8 functions tests,
`firebase emulators:exec --only firestore "npm --prefix functions test"`);
the pre-existing `firestore.rules`/`storage.rules`/client-SDK-wiring suite,
re-run after all Day 2 changes with no regressions (55 passed, 2
pre-existing documented skips, unrelated to Day 2).

**NOT tested — do not claim otherwise:** Google Sign-In (blocked on real
OAuth Client IDs), Apple Sign-In (blocked on a native build + Apple
Developer account), and real (non-emulator) Phone Authentication (no
verifier implemented for that case) have **only been unit-tested against
mocks** — their actual provider integration has never executed against
Google, Apple, or a real Firebase backend, and no real device has run any
part of this app. "Implemented" and "actually verified" are different
claims throughout this section; where a provider says "blocked," treat it
as implemented-but-unverified, not working.

## Day 3: Audit Logging (`logAdminAction`)

### What Day 3 actually was

Per FINAL_ARCHITECTURE_SPECIFICATION.md's own day-by-day plan, "Day 3" is
titled "Firestore Security Rules + Database Design." Most of that content
was already completed and verified during this project's actual Day 1 work
(security rules for all 9 collections, the emulator-backed test suite, and
Firestore indexes for common queries — see "Current rule coverage" above).
The one item from the spec's Day 3 goals that remained unimplemented was
**`logAdminAction()`** ("Cloud Functions: `logAdminAction()` triggers on
writes (audit logging)"), so that is what Day 3's actual work consisted of.
Rules deployment to a real Firebase project remains intentionally undone —
see DEPLOYMENT.md ("Nothing in this repo is deployed anywhere yet"), a
pre-existing, deliberate project stance, not a Day 3 gap.

### Why `logAdminAction` is a callable function, not a Firestore trigger

The spec's own phrasing ("triggers on writes") suggests a Firestore
background trigger (`onDocumentWritten`/`functions.firestore.document().
onWrite`). That was evaluated and rejected: **Firestore background triggers
carry no caller-identity context at all** — no `request.auth`, unlike
Realtime Database triggers or callable functions. The spec's own Audit Log
Entry Format requires a trustworthy `admin_id`/`admin_email`, and this
project's established principle (`createUserProfile`, Day 2) is to never
trust a client-supplied identity value. A trigger-based design could only
get an admin's identity by trusting a `lastModifiedBy`-style field the
client itself wrote onto the document being changed — exactly the kind of
client-trusted identity this project avoids everywhere else.

`functions/src/logAdminAction.ts` is instead an HTTPS **callable** function
(`onCall`), which the admin client is expected to invoke immediately after
performing a Firestore write. `admin_id` and `admin_email` are read from
Firebase's own verified callable-auth context (`request.auth`), which the
client cannot forge — never from the request payload. See
`logAdminAction.ts`'s own header comment for the full reasoning, and
ARCHITECTURE.md for why the pure handler throws a local `AdminActionError`
instead of importing `firebase-functions/v2/https`'s `HttpsError` directly
(the same Jest/ESM constraint documented for `createUserProfile`/
`healthCheck` in Day 1–2).

### Security properties, each covered by a real test against a running Firestore emulator

(`functions/src/__tests__/logAdminAction.test.ts`, 11 tests)

- **Rejects unauthenticated calls** — `request.auth` absent → `unauthenticated`.
- **Rejects callers without an authorized role.** The caller's role is
  looked up server-side from their own `/users/{uid}` document (the same
  document `createUserProfile` writes and only a Super Admin can change);
  a caller with no profile, or role `member`, is rejected with
  `permission-denied`. A `member` never performs any of the actions this
  log records, matching the RBAC table's `audit_log: Member none` row.
- **`admin_id`/`admin_email` are always derived from verified auth, never
  from the client payload** — tested explicitly: a call whose data payload
  includes spoofed `admin_id`/`admin_email` fields still writes the real
  authenticated caller's identity, not the spoofed one.
- **Input validation**: `action` must be one of the spec's five values
  (`create`/`update`/`delete`/`publish`/`unpublish`); `collection` must be
  one of the six spec-listed audit subjects (`users`, `announcements`,
  `daily_verses`, `songs`, `events`, `settings`); `documentId` and
  `changeSummary` are required non-empty strings. Any violation is rejected
  with `invalid-argument` before anything is written.
- **`audit_log` remains write-protected at the rules layer regardless.**
  `firestore.rules`' existing `audit_log` rule (`allow write: if false`)
  is unchanged — `logAdminAction` can write only because Cloud Functions'
  Admin SDK bypasses Firestore rules entirely, the same trust boundary
  `createUserProfile` and `notifications_log` already rely on. A client
  attempting to write `/audit_log` directly is still denied unconditionally.

### What's NOT built as part of Day 3 (deliberately)

Nothing yet calls `logAdminAction` from a real admin action, because no
admin CRUD UI exists yet (announcements/songs/events management starts Day
4+, per the spec; Admin Users/role management starts Day 11). Wiring
`logAdminAction` into those flows is that later work's responsibility, not
Day 3's — Day 3 only had to make the function itself exist, secure, and
tested, which it now is.

### What's actually verified — Day 3 test levels

**Emulator tested** (real, running Firestore emulator, no mocks): all 11
`logAdminAction` tests above, plus 4 `healthCheck`/module-export tests, plus
the pre-existing 5 `createUserProfile` tests (20 functions tests total) and
the 55-passed/2-skipped `firestore.rules`/`storage.rules` suite, all re-run
after Day 3's changes with zero regressions (`firebase emulators:exec
--only firestore "npm --prefix functions test"` → 20/20; `firebase
emulators:exec --only auth,firestore,storage "npm --prefix firebase-tests
test"` → 55 passed / 2 documented skips, unchanged from Day 2).

**NOT tested — do not claim otherwise:** `logAdminAction` has never been
invoked from a real admin client (none exists yet) or deployed to a real
Firebase project (Cloud Functions deployment requires the Blaze plan, which
this project does not enable — see the ₹0 rule in ENVIRONMENT.md). Its
callable-auth behavior is exercised in tests by passing a plain mock
`CallerAuthContext` object directly to the handler, the same pattern
`createUserProfile.test.ts` uses for `AuthUserLike` — this proves the
handler's own logic is correct, not that Firebase's real callable-auth
plumbing (`onCall`'s `request.auth` population) behaves identically; that
remains unverified until a real deployed callable is exercised by a real
signed-in client.
