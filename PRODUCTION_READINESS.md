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
New V1 features checkpoint          ← done: Reading Plans, Prayers,
        │                             Community added (owner decision,
        │                             beyond the original spec), official
        │                             church logo integrated into every
        │                             icon/splash asset, this sandbox's
        │                             network policy changed and every
        │                             emulator-backed test suite that was
        │                             previously "blocked" now actually
        │                             runs and passes
        ▼
FINAL V1 RELEASE PHASE checkpoint   ← done, PARTIALLY: full audit +
        │                             re-verification of everything above
        │                             (still green); JDK 17 + adb SOLVED in
        │                             this sandbox (Ubuntu's own apt
        │                             archive, no Google host needed);
        │                             the Android Gradle Plugin itself
        │                             confirmed genuinely blocked by an
        │                             EXPLICIT organization-policy denial
        │                             of dl.google.com/maven.google.com
        │                             (verified 3 independent ways, not a
        │                             generic timeout); release-signing
        │                             gap found and documented with exact
        │                             fix (DEPLOYMENT.md); Play Store
        │                             readiness audited end-to-end
        │                             (PLAY_STORE_READINESS.md) with every
        │                             declaration derived from actual app
        │                             behavior; a real, unapproved $25
        │                             Play Console fee flagged, not
        │                             assumed-and-proceeded-past
        ▼
Real-device QA                      ← NOT STARTED. No physical device or
        │                             simulator has ever been available in
        │                             any development environment used for
        │                             this project. QA_CHECKLIST.md
        │                             rewritten this checkpoint to target
        │                             the release APK against PRODUCTION
        │                             Firebase specifically (not dev/
        │                             emulator, per this checkpoint's
        │                             explicit instruction).
        ▼
Real production Firebase project    ← CREATED (bethaniyaministries-
        │                             production, Spark plan). Connectivity
        │                             independently confirmed reachable by
        │                             the owner from their own machine
        │                             (Auth + Firestore both reachable,
        │                             unauthenticated access correctly
        │                             denied) — this environment still
        │                             cannot log into Google itself to
        │                             verify it directly.
        ▼
Release preparation                 ← PARTIALLY STARTED. Signing/build
        │                             runbook and Play Store metadata
        │                             audited and documented; the actual
        │                             signed APK/AAB have not been built
        │                             anywhere (needs a real machine —
        │                             see above), and no store listing
        │                             creative assets (screenshots,
        │                             feature graphic, final copy) exist.
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
| **Backend** | Firestore rules / RBAC | ✅ | Deny-by-default, five roles' worth of collections now including `community`/`plans`/per-owner `prayers`/`planProgress` — see "New V1 features" in README.md |
| | Cloud Functions (createUserProfile, logAdminAction, sendNotification, updateUserRole) | ✅ code / ❌ deployed | Reviewed, typechecked, built, and — this checkpoint — actually run under a real emulator (see below); never deployed to a live project (see "Deployment" below) |
| | Firestore emulator-backed rule tests | ✅ | **This sandbox's network policy changed this checkpoint** — the Firebase Emulator Suite now starts successfully (previously blocked; see prior checkpoints' notes, left below for history). Run via `firebase emulators:exec --only firestore,storage,auth "npm --prefix firebase-tests test"`: 129/131 passing (2 intentionally skipped) |
| | `firebase-tests/` integration suite | 🟡 | Runs now (see row above). `firestore.rules.test.ts` (114/114, includes every new Prayers/Community/Plans case) and `storage.rules.test.ts` pass fully; one pre-existing, unrelated suite (`announcement-lifecycle.test.ts`) fails to compile against the currently-installed `firebase`/`@firebase/rules-unit-testing` versions — predates this checkpoint, untouched here, left as a known issue. Requires `npm install --legacy-peer-deps` in `firebase-tests/` first (its own pre-existing peer-dependency conflict) |
| **Mobile functionality** | Auth (Email/Password + Google), session persistence, sign-out | ✅ code / 🟠 unverified | Phone OTP was removed from V1 scope entirely; Apple is not an Android/Play requirement. Unit-tested against mocks only; never exercised against a real OAuth provider or real device |
| | Bible reader (English) | ✅ | Real World English Bible text, all 66 books, 1189 chapters, 31,102 verses |
| | Bible reader (Telugu, default language, OUT OF V1 SCOPE) | ✅ | Not a V1 requirement (owner decision). Ships as-is: real IRV 2019 text (CC BY-SA 4.0), all 66 books, 1187/1189 chapters real — 2 chapters (Joel 3, Malachi 4) fall back to the labeled placeholder — see BIBLE_LICENSING.md |
| | Songs/audio, Events/YouTube Live, Notifications, Profile, Settings | ✅ | Implemented, tested against mocked Firebase; never run against a real backend or device |
| | Reading Plans (new V1 feature) | ✅ code / 🟠 unverified | Library, plan detail, day reader, per-owner progress tracking (`users/{uid}/planProgress`), Home "Continue your plan" card; tested against mocked Firebase, never run against a real backend or device |
| | Prayers (new V1 feature) | ✅ code / 🟠 unverified | Fully private per-owner journal (`users/{uid}/prayers`); same unverified-against-real-backend caveat as above |
| | Community (new V1 feature) | ✅ code / 🟠 unverified | Admin-authored posts, publish-gated member read (mirrors Announcements); same caveat |
| **Bible** | English text | ✅ | See BIBLE_LICENSING.md |
| | Telugu text (OUT OF V1 SCOPE) | ✅ | Not required for V1. Licensing resolved (CC BY-SA 4.0, confirmed via BibleNLP/ebible's `metadata/licences.tsv`); 1187/1189 chapters real, ships as the default language regardless of the 2-chapter gap — see BIBLE_LICENSING.md |
| **RBAC** | Role matrix (member/host/content_admin/super_admin) | ✅ | Enforced server-side in rules, mirrored client-side for UX; self-demotion guard tested |
| **Notifications** | Composition, validation, history, local read/unread | ✅ | |
| | Real FCM push delivery | ❌ | No device has ever registered a push token in this project's history; nothing to make it work regardless of billing plan |
| **Live stream** | Host-managed YouTube URL/live-status toggle | ✅ | RBAC-gated, tested |
| **Testing** | Mobile unit/component tests | ✅ | 314/314 passing, 48/48 suites (adds Prayers/Community/Plans service tests and updated navigation tests this checkpoint) |
| | Admin unit/component/RBAC tests | ✅ | 263/263 passing, 36/36 files (adds Community/Plans admin service tests this checkpoint) |
| | Functions unit tests | ✅ | All 5 suites now genuinely run under a real emulator, not just `healthCheck.test.ts`: 49/49 passing (see Backend row above) |
| **Security** | Rules/RBAC audit | ✅ | Re-confirmed byte-identical to pre-Vespers baseline this checkpoint |
| | Secrets scan (source + git history) | ✅ | Clean — re-run this checkpoint, only `.env.example` files ever touched `.env*` paths in history |
| | `npm audit` | 🟡 | Admin: 0. Mobile: 16 moderate (transitive, Expo tooling). Functions: 7 moderate (transitive, `firebase-admin`'s GCP client chain). None exploitable via this app's own code paths; fixing requires breaking downgrades, left as a deliberate, documented decision |
| **Build/release (Android)** | App identity (name, package id, version, versionCode) | ✅ | `applicationId 'com.bethaniyaministries.app'`, `versionCode 1` — verified again this checkpoint via an actual `expo prebuild` run |
| | Real app icon / adaptive icon / splash | ✅ | The owner supplied the real church logo at `assets/branding/church-logo.png`. All six icon/splash PNGs in `mobile/assets/` are now derived from it (icon, Android adaptive-icon foreground/background/monochrome layers, splash icon, web favicon), with `app.json`'s `backgroundColor`/`expo-splash-screen` config wired to match — verified via `expo prebuild` regenerating the native project correctly |
| | Local APK/AAB build | ❌ | Re-verified this checkpoint with genuinely new findings, not a repeat: **JDK 17 and `adb` are now solved** in this sandbox — installed via `apt` from Ubuntu's own archive (`archive.ubuntu.com`), no Google host needed. The Android Gradle Plugin itself is still blocked, but more precisely characterized now: it resolves `android.jar`/build-tools/its own dependencies via `maven.google.com` (redirects to `dl.google.com`), and `dl.google.com` is denied under an **explicit organization policy** at this sandbox's proxy — confirmed 3 independent ways (direct `curl`, following `maven.google.com`'s redirect, and a live `apt-get install` of Ubuntu's own `google-android-cmdline-tools` package whose own postinstall `wget` failed identically). Not a missing-tool problem anymore — a named-host policy block only your own machine can get past. See DEPLOYMENT.md for the exact runbook |
| | Release signing configuration | ❌ new finding | The native project's generated `android/app/build.gradle` currently signs **release** builds with the **debug** keystore (template default — no keystore has ever been generated). Play Store rejects debug-signed uploads outright. Exact fix (keystore generation + a 3-line `build.gradle` edit, the standard `reactnative.dev`-documented pattern) is now in DEPLOYMENT.md; `mobile/.gitignore` was extended to cover `*.keystore`/`keystore.properties` before any such file could ever be created near a commit |
| **Build/release (iOS)** | Bundle identifier, build number | ✅ | |
| | TestFlight/App Store submission | 💰🔵 | Requires an Apple Developer Program membership (paid, $99/yr) — explicitly out of scope under the ₹0 constraint until you decide otherwise |
| **Production deployment** | Real Firebase project (production) | 🔵 | **Created** (`bethaniyaministries-production`, Spark plan). Connectivity independently confirmed reachable from the owner's own machine this checkpoint (Auth + Firestore reachable, unauthenticated access correctly denied) — running `scripts/firebase-production-setup.sh` end-to-end still requires your own Google account login, which this environment cannot perform |
| | Cloud Functions deployment | 💰 | Firebase requires the **Blaze** plan to deploy Functions at all, even at $0 actual usage — explicitly not attached, per the ₹0 constraint |
| | Firebase Hosting (admin) / EAS (mobile) | 🔵 | Documented in DEPLOYMENT.md, not yet executed — needs a real Firebase/EAS account, still free-tier-capable |
| **Play Store** | Readiness audit (app identity, permissions, Data Safety, privacy policy draft) | 🟡 new | PLAY_STORE_READINESS.md added this checkpoint — every declaration derived from actual app behavior (verified: no analytics/crash SDK, no location, no ad tracking; real: auth identifiers, profile photo, private prayer text). Store creative assets (screenshots, feature graphic, final listing copy) and a published privacy-policy URL still need your input — not something to fabricate |
| | Play Console account / actual submission | 💰🔵 | **Real, unapproved cost**: one-time $25 USD Play Console registration fee, charged by Google directly — separate from and unrelated to the Firebase ₹0 constraint, but flagged rather than assumed. Not created; nothing submitted; will not proceed without your explicit approval |
| **Documentation** | README/ARCHITECTURE/SECURITY/BIBLE_LICENSING/this file | ✅ | Synced to actual implementation state this checkpoint |
| | QA_CHECKLIST.md | ✅ rewritten | Re-targeted this checkpoint to test the release APK against **production** Firebase specifically (previous version targeted dev/emulator) — 38 items now, including every new V1 feature and a dedicated Android-specific-behavior section (back button, keyboard, scrolling, slow/lost network, screen transitions); explicitly not executed (no device available here) |
| | PLAY_STORE_READINESS.md | ✅ new | See "Play Store" row above |
| | DEPLOYMENT.md | ✅ | "Local Android APK/AAB build" section rewritten this checkpoint with the exact, verified-current runbook (JDK17/adb install, signing setup, production-env verification, build commands) |
| | ADMIN_GUIDE.md | 🟡 | Field-accurate to the code, but has no real screenshots (needs a deployed instance to photograph) |

## What would change an item above from a real gap to ✅

- **Real-device testing**: a human runs the signed release APK on an
  actual Android phone — QA_CHECKLIST.md's 38 items, against production
  Firebase specifically. Nothing in this repository (or this sandboxed
  session) can substitute for that.
- **App icon/splash**: done — the church supplied the real logo, and
  every icon/splash asset in `mobile/assets/` is derived from it.
- **Local APK/AAB build + signing**: run from a real machine with
  Android Studio installed (it bundles a compatible JDK and the Android
  SDK, resolving the one remaining blocker — this sandbox's `dl.google.com`
  policy block doesn't apply to your own network) — the exact commands,
  including the one-time keystore/signing setup this checkpoint added,
  are in DEPLOYMENT.md; `app.json` is already configured correctly
  (verified again this checkpoint via an actual `prebuild` run).
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
— just no longer a V1 requirement); that this repository is actually
*connected* to the production Firebase project from this environment
(the project exists and is independently confirmed reachable from your
own machine — see the "Production deployment" row above — but this
sandboxed session has never held real production credentials and cannot
verify it directly); that Cloud Functions have ever been deployed; that
any screen — including Reading Plans, Prayers, and Community — has been
run on a real device or against real production data; that a release
keystore has been generated or an APK/AAB has ever been built anywhere
(a working, verified runbook exists in DEPLOYMENT.md — the artifacts
themselves do not yet exist); that a Play Console account exists or
that anything has been submitted to the Play Store; that a privacy
policy is published at a real URL (a factual draft exists in
PLAY_STORE_READINESS.md, not yet hosted); or that `npm audit`'s
outstanding advisories have been fixed rather than knowingly accepted.
Each of those is tracked in its own document (BIBLE_LICENSING.md,
SECURITY.md, DEPLOYMENT.md, PLAY_STORE_READINESS.md, QA_CHECKLIST.md)
rather than summarized away here.

The official church logo **has** been integrated: the owner supplied
`assets/branding/church-logo.png`, and every icon/splash asset in
`mobile/assets/` is derived from it — see the requirements matrix's
"Real app icon / adaptive icon / splash" row above. **JDK 17 and `adb`
are also now solved** in this sandbox specifically (a prior checkpoint's
framing of "needs Android Studio" as the only path is now out of date
for those two pieces) — only the Android Gradle Plugin's dependency on
the explicitly policy-blocked `dl.google.com` remains, and that
specifically requires your own machine's network, not more local
tooling.
