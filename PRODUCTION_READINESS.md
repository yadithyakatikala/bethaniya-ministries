# Production Readiness

**Current status: NOT PRODUCTION READY.** This document was last
substantially rewritten at the Day 1 checkpoint and had gone stale
(it still claimed "Day 2–16 NOT STARTED" after all of Days 2–16, the
Vespers UI pass, and a V1 completion sprint had actually happened) — this
rewrite brings it in line with the real, current state of the repository.
Nothing below should be read as a claim that this app is deployed or
usable by real church members today. It is not.

## The staged pipeline

```
DAY 1 FOUNDATION                    ← done
        │
        ▼
Days 2–16 implementation            ← done: auth, Bible/songs/events UI,
        │                             admin CRUD, notifications, live
        │                             streaming, profile, RBAC, security
        │                             hardening, test coverage
        ▼
Vespers visual design system        ← done: theme tokens, hand-rolled tab
        │                             bar, every mobile + admin screen
        │                             restyled, shared admin components
        ▼
V1 completion sprint                ← done, PARTIALLY: real English Bible
        │                             text imported; Telugu still blocked
        │                             by licensing; offline persistence
        │                             investigated, not enabled (real-
        │                             device-verification gap); local APK
        │                             build investigated, blocked by
        │                             environment (no Android SDK access)
        ▼
Real-device QA                      ← NOT STARTED. No physical device or
        │                             simulator has ever been available in
        │                             any development environment used for
        │                             this project.
        ▼
Telugu Bible licensing resolution   ← NOT STARTED (requires a human to
        │                             contact a rights holder and wait for
        │                             a reply — see BIBLE_LICENSING.md)
        ▼
Release preparation                 ← NOT STARTED. Store listings, EAS/
        │                             local builds actually produced and
        │                             installed, staging environment, real
        │                             church branding/content
        ▼
PRODUCTION READY
```

Nothing in this repository should be read as claiming a position further
down this pipeline than "V1 completion sprint (partial)."

## Final V1 requirements matrix

Legend: ✅ complete · 🟡 complete but needs configuration · 🔵 ready,
waiting on an external credential/account · 🟠 requires real-device
testing · 🔴 blocked by licensing · 💰 blocked by cost (would require
breaking the ₹0 constraint) · ❌ not complete.

| Area | Item | Status | Why |
| --- | --- | --- | --- |
| **Frontend (mobile)** | Vespers visual design system | ✅ | Theme tokens, tab bar, every screen restyled, verified via real react-native-web screenshots |
| | Navigation (all routes, back behavior, tab visibility) | ✅ | See AppNavigator.tsx; one stale doc-comment and one hardcoded safe-area constant found and fixed this checkpoint |
| | Loading/error/empty states | ✅ | Present on every async screen; verified by reading each screen's code |
| | Accessibility (labels, touch targets, contrast) | 🟡 | `accessibilityRole`/`accessibilityLabel`/`accessibilityState` present throughout; 44px touch targets used consistently; never verified with a real screen reader (VoiceOver/TalkBack) — requires a real device |
| **Frontend (admin)** | Vespers visual design system | ✅ | Sidebar, dashboard, shared `AdminPageHeader`/`AdminTableCard`/`AdminEmptyState` components across every CRUD page |
| | Responsive layout | 🟡 | CSS-only responsive drawer (documented reason: jsdom has no `matchMedia`); never viewed on a real narrow-viewport device |
| **Backend** | Firestore rules / RBAC | ✅ | Deny-by-default, four roles, unchanged and re-verified byte-identical across the Vespers + V1 sprint commits |
| | Cloud Functions (createUserProfile, logAdminAction, sendNotification, updateUserRole) | ✅ code / ❌ deployed | Reviewed, typechecked, built; never deployed (see "Deployment" below) |
| | Firestore emulator-backed rule tests | ❌ | Blocked: Firebase Emulator Suite cannot start in this environment — `firebase-public.firebaseio.com`/`firebase.google.com` are denied by network policy (re-confirmed this checkpoint by actually attempting `firebase emulators:start`, not just checking one URL) |
| | `firebase-tests/` integration suite | ❌ | Blocked by both the emulator issue above and a `firebase@^12` vs. `@firebase/rules-unit-testing@^3`'s `peer firebase@^10` dependency conflict |
| **Mobile functionality** | Auth (Google/Apple/Phone OTP), session persistence, sign-out | ✅ code / 🟠 unverified | Unit-tested against mocks only; never exercised against a real OAuth provider or real device |
| | Bible reader (English) | ✅ | Real World English Bible text, all 66 books, imported and verified this checkpoint |
| | Bible reader (Telugu) | 🔴 | Blocked by licensing — see BIBLE_LICENSING.md |
| | Songs/audio, Events/YouTube Live, Notifications, Profile, Settings | ✅ | Implemented, tested against mocked Firebase; never run against a real backend or device |
| **Bible** | English text | ✅ | See BIBLE_LICENSING.md |
| | Telugu text | 🔴 | Blocked by licensing; a specific, promising new lead is documented but unconfirmed |
| **RBAC** | Role matrix (member/host/content_admin/super_admin) | ✅ | Enforced server-side in rules, mirrored client-side for UX; self-demotion guard tested |
| **Notifications** | Composition, validation, history, local read/unread | ✅ | |
| | Real FCM push delivery | ❌ | No device has ever registered a push token in this project's history; nothing to make it work regardless of billing plan |
| **Live stream** | Host-managed YouTube URL/live-status toggle | ✅ | RBAC-gated, tested |
| **Testing** | Mobile unit/component tests | ✅ | 284/284 passing, 87.0% statement coverage |
| | Admin unit/component/RBAC tests | ✅ | 249/249 passing, 88.3% statement coverage |
| | Functions unit tests | 🟡 | Only `healthCheck.test.ts` runs (4/4); four emulator-backed handler test files are structurally sound but unexecuted (see Backend row above) |
| **Security** | Rules/RBAC audit | ✅ | Re-confirmed byte-identical to pre-Vespers baseline this checkpoint |
| | Secrets scan (source + git history) | ✅ | Clean — re-run this checkpoint, only `.env.example` files ever touched `.env*` paths in history |
| | `npm audit` | 🟡 | Admin: 0. Mobile: 16 moderate (transitive, Expo tooling). Functions: 7 moderate (transitive, `firebase-admin`'s GCP client chain). None exploitable via this app's own code paths; fixing requires breaking downgrades, left as a deliberate, documented decision |
| **Build/release (Android)** | App identity (name, package id, version, versionCode) | ✅ | `versionCode`/`buildNumber` added this checkpoint (previously missing) |
| | Real app icon / adaptive icon / splash | ❌ | **All five icon/splash PNG assets in `mobile/assets/` are literal 1×1-pixel placeholder files** — discovered this checkpoint. The app cannot look correct on a real home screen or app store listing until real artwork is supplied |
| | Local APK/AAB build | ❌ | Blocked: no Android SDK in this environment, and `dl.google.com` (the SDK download host) is denied by network policy — confirmed by direct attempt |
| **Build/release (iOS)** | Bundle identifier, build number | ✅ | |
| | TestFlight/App Store submission | 💰🔵 | Requires an Apple Developer Program membership (paid, $99/yr) — explicitly out of scope under the ₹0 constraint until you decide otherwise |
| **Production deployment** | Real Firebase project (staging/production) | 🔵 | Never created; requires your action (a free-tier Firebase project can be created at ₹0, but doing so is a deliberate step not taken automatically) |
| | Cloud Functions deployment | 💰 | Firebase requires the **Blaze** plan to deploy Functions at all, even at $0 actual usage — explicitly not attached, per the ₹0 constraint |
| | Firebase Hosting (admin) / EAS (mobile) | 🔵 | Documented in DEPLOYMENT.md, not yet executed — needs a real Firebase/EAS account, still free-tier-capable |
| **Documentation** | README/ARCHITECTURE/SECURITY/BIBLE_LICENSING/this file | ✅ | Synced to actual implementation state this checkpoint |
| | ADMIN_GUIDE.md | 🟡 | Field-accurate to the code, but has no real screenshots (needs a deployed instance to photograph) |

## What would change an item above from a real gap to ✅

- **Telugu Bible**: a human confirms a license (see BIBLE_LICENSING.md's
  "Action needed" section) — this alone unblocks the single largest
  remaining content gap.
- **Real-device testing**: a human runs the app on an actual iPhone/
  Android phone via Expo Go (see "Quick start" in README.md) or a real
  simulator — nothing in this repository can substitute for that.
- **App icon/splash**: the church supplies real logo/branding art files,
  which get dropped into `mobile/assets/` in place of the current 1×1
  placeholders — no code change needed beyond that.
- **Local APK build**: run from a real machine with the Android SDK
  installed (a developer's own Mac/Linux machine, or a CI runner) — the
  commands are already documented in DEPLOYMENT.md and `app.json` is
  already configured correctly.
- **Firestore offline persistence**: once real-device testing is
  possible, re-attempt `persistentLocalCache()` on an actual device and
  verify it doesn't crash before enabling it — see the reasoning
  documented above `db`'s initialization in
  `mobile/src/services/firebase/app.ts`.
- If a `.env.local` or key file were ever accidentally committed, `git
  log --all --full-history -- '*.env*' 'google-services.json'
  '*serviceAccountKey*'` would show it — re-checked clean this checkpoint.

## Explicitly not claimed

This document does not claim: that a staging or production Firebase
project exists (only the free-tier dev project does); that Cloud
Functions have ever been deployed; that Telugu Bible content is
licensed or usable; that any screen has been run on a real device or
against a real (non-emulator) Firebase backend; that an APK or IPA has
ever been built or installed; that real church branding assets (logo,
photos, support email) exist anywhere in this repository; or that
`npm audit`'s outstanding advisories have been fixed rather than
knowingly accepted. Each of those is tracked in its own document
(BIBLE_LICENSING.md, SECURITY.md, DEPLOYMENT.md) rather than summarized
away here.
