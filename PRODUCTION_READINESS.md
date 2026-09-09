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
V1 completion sprint (round 1)       ← done, PARTIALLY: real English Bible
        │                             text imported; Telugu blocked by
        │                             unverified licensing; offline
        │                             persistence investigated, not
        │                             enabled (real-device-verification
        │                             gap); local APK build investigated,
        │                             blocked by environment (no Android
        │                             SDK access)
        ▼
V1 completion sprint (round 2)       ← done, PARTIALLY: Telugu Bible
        │                             licensing resolved and imported
        │                             (IRV 2019, CC BY-SA 4.0) as the
        │                             default language, but NOT content-
        │                             complete -- 1187/1189 chapters real,
        │                             2 (Joel 3, Malachi 4) an exhaustively
        │                             investigated, unresolved gap (not a
        │                             mapping error, see BIBLE_LICENSING.md);
        │                             Android APK build re-attempted with
        │                             two more precise, confirmed blockers
        │                             found (JDK 17 + SDK download, both
        │                             network-blocked); a production
        │                             Firebase setup script added
        │                             (Spark-tier only, no billing)
        ▼
V1 completion sprint (round 3)       ← done: Telugu Bible formally
        │                             descoped from V1 by owner decision
        │                             (still shipped as-is, still the
        │                             default language, its exception-
        │                             free completeness test removed --
        │                             mobile suite is green again,
        │                             295/295); Android build re-attempted,
        │                             identical confirmed blockers; a real
        │                             church logo was requested at
        │                             assets/branding/church-logo.png but
        │                             the file does not exist anywhere in
        │                             this repo or environment -- no logo
        │                             was fabricated; a 20-point real-
        │                             device QA checklist added
        │                             (QA_CHECKLIST.md)
        ▼
Real-device QA                      ← NOT STARTED. No physical device or
        │                             simulator has ever been available in
        │                             any development environment used for
        │                             this project.
        ▼
Real production Firebase project    ← CREATED (bethaniyaministries-
        │                             production, Spark plan) but not yet
        │                             connected from this environment.
        │                             Requires a human to run
        │                             scripts/firebase-production-setup.sh
        │                             with their own Google account (this
        │                             environment cannot log into Google).
        ▼
Release preparation                 ← NOT STARTED. Store listings, EAS/
        │                             local builds actually produced and
        │                             installed, real church branding/
        │                             content
        ▼
PRODUCTION READY
```

Nothing in this repository should be read as claiming a position further
down this pipeline than "V1 completion sprint (round 2)."

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
| | Bible reader (English) | ✅ | Real World English Bible text, all 66 books, 1189 chapters, 31,102 verses |
| | Bible reader (Telugu, default language, OUT OF V1 SCOPE) | ✅ | Not a V1 requirement (owner decision). Ships as-is: real IRV 2019 text (CC BY-SA 4.0), all 66 books, 1187/1189 chapters real — 2 chapters (Joel 3, Malachi 4) fall back to the labeled placeholder — see BIBLE_LICENSING.md |
| | Songs/audio, Events/YouTube Live, Notifications, Profile, Settings | ✅ | Implemented, tested against mocked Firebase; never run against a real backend or device |
| **Bible** | English text | ✅ | See BIBLE_LICENSING.md |
| | Telugu text (OUT OF V1 SCOPE) | ✅ | Not required for V1. Licensing resolved (CC BY-SA 4.0, confirmed via BibleNLP/ebible's `metadata/licences.tsv`); 1187/1189 chapters real, ships as the default language regardless of the 2-chapter gap — see BIBLE_LICENSING.md |
| **RBAC** | Role matrix (member/host/content_admin/super_admin) | ✅ | Enforced server-side in rules, mirrored client-side for UX; self-demotion guard tested |
| **Notifications** | Composition, validation, history, local read/unread | ✅ | |
| | Real FCM push delivery | ❌ | No device has ever registered a push token in this project's history; nothing to make it work regardless of billing plan |
| **Live stream** | Host-managed YouTube URL/live-status toggle | ✅ | RBAC-gated, tested |
| **Testing** | Mobile unit/component tests | ✅ | 295/295 passing, 45/45 suites (Telugu's exception-free completeness test was removed along with Telugu leaving V1 scope — see "Bible" rows above). 87.1% statement coverage |
| | Admin unit/component/RBAC tests | ✅ | 249/249 passing, 87.8% statement coverage |
| | Functions unit tests | 🟡 | Only `healthCheck.test.ts` runs (4/4); four emulator-backed handler test files are structurally sound but unexecuted (see Backend row above) |
| **Security** | Rules/RBAC audit | ✅ | Re-confirmed byte-identical to pre-Vespers baseline this checkpoint |
| | Secrets scan (source + git history) | ✅ | Clean — re-run this checkpoint, only `.env.example` files ever touched `.env*` paths in history |
| | `npm audit` | 🟡 | Admin: 0. Mobile: 16 moderate (transitive, Expo tooling). Functions: 7 moderate (transitive, `firebase-admin`'s GCP client chain). None exploitable via this app's own code paths; fixing requires breaking downgrades, left as a deliberate, documented decision |
| **Build/release (Android)** | App identity (name, package id, version, versionCode) | ✅ | `applicationId 'com.bethaniyaministries.app'`, `versionCode 1` — verified again this checkpoint via an actual `expo prebuild` run |
| | Real app icon / adaptive icon / splash | ❌ | **All six icon/splash PNG assets in `mobile/assets/` are literal 1×1-pixel placeholder files.** A real church logo was requested at `assets/branding/church-logo.png` this checkpoint but **the file does not exist anywhere in this repository or development environment** — checked directly, not assumed. No logo was fabricated in its place, per this project's own hard rule. The app cannot look correct on a real home screen or app store listing until the actual logo file is supplied and this integration is redone |
| | Local APK/AAB build | ❌ | `expo prebuild` succeeds (native project generates correctly); `gradlew assembleRelease` then fails at two independent, confirmed points: no JDK 17 (only JDK 21 present) and its auto-provisioner is network-blocked, and separately `dl.google.com` (the Android SDK download host) is denied by network policy — see DEPLOYMENT.md |
| **Build/release (iOS)** | Bundle identifier, build number | ✅ | |
| | TestFlight/App Store submission | 💰🔵 | Requires an Apple Developer Program membership (paid, $99/yr) — explicitly out of scope under the ₹0 constraint until you decide otherwise |
| **Production deployment** | Real Firebase project (production) | 🔵 | **Created** (`bethaniyaministries-production`, Spark plan). Not yet connected/deployed from this environment — running `scripts/firebase-production-setup.sh bethaniyaministries-production` (Firestore database, Web app registration, rules/indexes deploy, all Spark-tier) requires your own Google account login, which this environment cannot perform |
| | Cloud Functions deployment | 💰 | Firebase requires the **Blaze** plan to deploy Functions at all, even at $0 actual usage — explicitly not attached, per the ₹0 constraint |
| | Firebase Hosting (admin) / EAS (mobile) | 🔵 | Documented in DEPLOYMENT.md, not yet executed — needs a real Firebase/EAS account, still free-tier-capable |
| **Documentation** | README/ARCHITECTURE/SECURITY/BIBLE_LICENSING/this file | ✅ | Synced to actual implementation state this checkpoint |
| | QA_CHECKLIST.md | ✅ new | 20-point real-Android-device checklist added this checkpoint; explicitly not executed (no device available) |
| | ADMIN_GUIDE.md | 🟡 | Field-accurate to the code, but has no real screenshots (needs a deployed instance to photograph) |

## What would change an item above from a real gap to ✅

- **Real-device testing**: a human runs the app on an actual iPhone/
  Android phone via Expo Go (see "Quick start" in README.md) or a real
  simulator — nothing in this repository can substitute for that.
- **App icon/splash**: the church supplies real logo/branding art files,
  which get dropped into `mobile/assets/` in place of the current 1×1
  placeholders — no code change needed beyond that.
- **Local APK build**: run from a real machine with Android Studio
  installed (it bundles a compatible JDK and the Android SDK, resolving
  both blockers found this checkpoint) — the commands are already
  documented in DEPLOYMENT.md and `app.json` is already configured
  correctly (verified again this checkpoint via an actual `prebuild` run).
- **Production Firebase project**: the project itself now exists
  (`bethaniyaministries-production`) — run
  `scripts/firebase-production-setup.sh bethaniyaministries-production`
  with your own Google account to actually connect this repo to it
  (Firestore database, Web app registration, rules/indexes deploy);
  everything it does stays on the free Spark plan.
- **Firestore offline persistence**: once real-device testing is
  possible, re-attempt `persistentLocalCache()` on an actual device and
  verify it doesn't crash before enabling it — see the reasoning
  documented above `db`'s initialization in
  `mobile/src/services/firebase/app.ts`.
- If a `.env.local` or key file were ever accidentally committed, `git
  log --all --full-history -- '*.env*' 'google-services.json'
  '*serviceAccountKey*'` would show it — re-checked clean this checkpoint.

## Explicitly not claimed

This document does not claim: that the Telugu Bible (shipped but out of
V1 scope) is content-complete (1187/1189 chapters; 2 remain an
unresolved, investigated gap, not an accepted substitute for real text
— just no longer a V1 requirement); that the official church logo has
been integrated anywhere (the file `assets/branding/church-logo.png`
does not exist in this repository or anywhere in this development
environment — every screen listed in the branding request still shows
the same placeholder assets it always has; see "Branding" below); that
this repository is actually *connected* to the production Firebase
project (the project itself exists — `bethaniyaministries-production`,
Spark plan — but running the setup script to wire this repo to it, and
filling in `mobile/.env.production`/`admin/.env.production`, is your
action, since it needs your Google account login); that Cloud Functions
have ever been deployed; that any screen has been run on a real device
or against a real (non-emulator) Firebase backend; that an APK or IPA
has ever been built or installed; or that `npm audit`'s outstanding
advisories have been fixed rather than knowingly accepted. Each of
those is tracked in its own document (BIBLE_LICENSING.md, SECURITY.md,
DEPLOYMENT.md) rather than summarized away here.
