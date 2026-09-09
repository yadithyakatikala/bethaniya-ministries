# Deployment

**Nothing in this repo is deployed anywhere yet.** This document describes
how each part _will_ deploy once the prerequisites in ENVIRONMENT.md are
met — it's written ahead of need so the path is clear when Day 2+ work
reaches it, per the project's "quality over speed" principle.

## Cloud Functions

```bash
cd functions
npm run build
firebase deploy --only functions --project <dev|staging|production>
```

`firebase.json`'s `predeploy` hook already runs the build automatically, so
`firebase deploy --only functions` alone is sufficient once `firebase-tools`
is installed and you're logged in (`firebase login`). Requires the Blaze
plan on the target Firebase project (see ENVIRONMENT.md).

## Firestore / Storage rules

```bash
firebase deploy --only firestore:rules,firestore:indexes,storage --project <env>
```

**Do this before deploying anything that writes to Firestore/Storage** — an
empty database with deny-by-default rules is the safe starting state; never
deploy an app pointed at a project with no rules deployed yet.

## Admin dashboard

`firebase.json` is configured for Firebase Hosting (`public: "admin/dist"`),
chosen as the default over Vercel because it keeps everything in one
`firebase deploy` and one billing account — Vercel remains a fine
alternative if preferred later (per architecture spec, either is
acceptable; this is not a locked decision).

```bash
cd admin
npm run build
firebase deploy --only hosting --project <env>
```

If Vercel is preferred instead: connect the GitHub repo in the Vercel
dashboard, set root directory to `admin/`, build command `npm run build`,
output directory `dist`. Either path is fine; don't run both against the
same environment without a reason.

## Mobile app (EAS Build)

Not yet configured (Day 8 per the architecture spec's plan — needs real
device testing accounts first, see ENVIRONMENT.md). When that day arrives:

```bash
cd mobile
npx eas-cli login
npx eas-cli build:configure
npx eas-cli build --platform ios       # requires Apple Developer account
npx eas-cli build --platform android   # requires Google Play Developer account
```

`eas-cli` was verified installable via `npx` during Day 1 setup
(`eas-cli/23.2.0`) but is not configured with a project yet — no
`eas.json` exists in this repo yet, intentionally, since EAS project
configuration is tied to a real Expo/EAS account that doesn't exist yet.

### Local Android APK/AAB build (no EAS account needed)

An alternative to EAS Build that stays entirely local and needs no
external account — only a machine with the Android SDK installed
(Android Studio, or just the command-line tools + a platform/build-tools
version). This was investigated across two V1 completion sprints and is
genuinely **blocked in this repository's development environment**, at
two independent points, both confirmed by actually attempting the build
(not assumed):

1. `npx expo prebuild --platform android` **succeeds** — it generates a
   real, correctly-configured native `android/` project
   (`applicationId 'com.bethaniyaministries.app'`, `versionCode 1`,
   `versionName "1.0.0"`, matching `app.json`) without needing the
   Android SDK at all. This step works fine here.
2. `./gradlew assembleRelease` reaches Gradle itself (it downloads and
   starts Gradle 9.3.1 successfully — `services.gradle.org` is
   reachable), then fails at dependency resolution: React Native's
   Android Gradle plugin requires a **Java 17** toolchain, this
   environment only has **Java 21** installed
   (`/usr/lib/jvm/java-21-openjdk-amd64`, no JDK 17 present), and
   Gradle's automatic toolchain provisioner (`foojay-resolver`) —
   which would otherwise download a matching JDK 17 on the fly — is
   itself blocked: `Unable to tunnel through proxy. Proxy returns
   "HTTP/1.1 403 Forbidden"`. Even past that, the next step would need
   Android SDK platform/build-tools components, and `dl.google.com`
   (the host `sdkmanager` downloads those from) is separately denied by
   this environment's network egress policy — confirmed by a direct
   `curl` connection attempt (`CONNECT tunnel failed, response 403`),
   the same class of block as `firebase.google.com`.

Two independent, confirmed blockers, not a guess: a missing JDK 17
whose auto-provisioner is network-blocked, and a separately
network-blocked Android SDK component host. `app.json`'s
`android.versionCode`/`ios.buildNumber` were added during the first V1
completion sprint so the config is ready the moment a real build
environment is available — verified correct again this pass via an
actual (then-cleaned-up) `prebuild` run, not just by reading the file.

On a real machine with the Android SDK installed:

```bash
cd mobile
npx expo prebuild --platform android   # generates the android/ native project
cd android
./gradlew assembleRelease              # unsigned release APK, or:
./gradlew bundleRelease                # release AAB (Play Store upload format)
```

The resulting APK lands at
`android/app/build/outputs/apk/release/app-release-unsigned.apk`. It is
**unsigned** — installing it on a real device or submitting an AAB to
Play Console additionally requires generating a signing keystore
(`keytool -genkeypair ...`, entirely free/local, no account needed) and
configuring `android/app/build.gradle`'s `signingConfigs` before
`assembleRelease`/`bundleRelease` will produce something installable
outside of local testing. None of this requires Blaze, a paid Apple/
Google developer account, or any billing — only local tooling this
specific sandboxed environment happens not to have access to.

### Local iOS build

Requires a Mac with Xcode (`npx expo prebuild --platform ios`, then open
`ios/*.xcworkspace` in Xcode and archive/build). Running the app on a
physical iPhone, or distributing via TestFlight, additionally requires an
Apple Developer Program membership (**$99/year, a real cost** — out of
scope under this project's ₹0 constraint until explicitly approved). A
free personal Apple ID can build to the simulator or side-load to one's
own device for a 7-day period without that membership, which is the
farthest this project can go on iOS at ₹0.

## Environments

Three Firebase projects are planned (dev/staging/production — see
ENVIRONMENT.md). `dev` (`bethaniya-ministries-dev-58588`) and
`production` (`bethaniyaministries-production`) both exist today, both
on the free Spark plan; `staging` can be created later, when actually
needed. Each environment gets its own `.firebaserc` target alias
(`.firebaserc.example`'s `production` alias already points at the real
production project id) and its own env file per app (`.env.local` for
local dev, `.env.production` for production — never commit either;
both are gitignored by the root `.env*` pattern).

**Connecting the production project:** run
`./scripts/firebase-production-setup.sh bethaniyaministries-production` (mirrors the dev
script exactly — same free-Spark-tier-only steps: project creation or
reuse, Firestore database, Web app registration, rules/indexes deploy —
plus an explicit "yes" confirmation before touching anything, since
this is the real project real church member data will eventually live
in). It cannot be run from this development environment (no Google
account login is possible here); run it from a machine where you can
complete the `firebase login` browser flow — see ENVIRONMENT.md's
"Production project" section for the full walkthrough, including where
to copy its output. It intentionally does not touch Storage or Cloud
Functions (both require the Blaze plan) — the script's own output tells
you exactly what to do when you're ready to attach billing.

**Android production builds** pick up `mobile/.env.production`
automatically (Expo's built-in dotenv loading selects it in production
mode, no extra config in this repo) — once that file has the production
project's real config values and `EXPO_PUBLIC_USE_FIREBASE_EMULATORS=false`,
a release build (see "Local Android APK/AAB build" above) talks to
`bethaniyaministries-production`, not the dev project or the emulator.

## CI/CD

**Not set up in Day 1.** The architecture spec doesn't mandate it for V1,
and per "do not add tooling for its own sake," it wasn't added speculatively.
Recommended for later (not urgent): GitHub Actions running
`typecheck`/`lint`/`test` on every PR across all three packages, then
`firebase deploy` on merge to `main` for functions/rules/hosting. Revisit
once there's a staging environment worth protecting with a CI gate.

## Rollback

- **Cloud Functions / Hosting / Rules:** `firebase hosting:rollback` for
  Hosting; for Functions and Rules, redeploy the previous git commit
  (`git checkout <previous-sha> -- functions firestore.rules storage.rules
&& firebase deploy ...`) — there's no one-command rollback for those yet.
- **Firestore data:** relies on Firebase's automatic backups (see
  SECURITY.md's Backup & DR section) — restoring requires contacting Google
  Cloud Support per the architecture spec; this is not a self-service
  operation. Do not treat this as fast disaster recovery; it's a last
  resort.
- **Mobile app:** EAS/store rollback is store-review-gated (can't
  instantly revert a live app store release) — this is why the spec's
  Day 21 plan treats app store submission as one-way and gates it behind a
  quality checklist rather than "ship and iterate."
