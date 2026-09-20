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
version). This was investigated across three V1 completion sprints, most
recently the "FINAL V1 RELEASE" checkpoint, which narrowed the blocker
down to exactly one remaining point (the other two are now solved):

1. `npx expo prebuild --platform android` **succeeds** — it generates a
   real, correctly-configured native `android/` project
   (`applicationId 'com.bethaniyaministries.app'`, `versionCode 1`,
   `versionName "1.0.0"`, matching `app.json`) without needing the
   Android SDK at all. Also verified this checkpoint: `compileSdk`/
   `targetSdk` resolve to `36`, `minSdk` to `24` (Expo SDK 57 defaults,
   comfortably meets Play Store's current target-API-level requirement).
2. **JDK 17 and `adb` are now both solvable without any network access
   to Google's own hosts** — this checkpoint found and verified that
   Ubuntu's own package archive (`archive.ubuntu.com`, not a Google
   host) carries both directly:
   ```bash
   sudo apt-get update
   sudo apt-get install -y openjdk-17-jdk-headless adb
   export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64   # or wherever it installed
   ```
   (On macOS, the equivalent is `brew install openjdk@17 android-platform-tools`,
   or Android Studio's own bundled JDK 17 + SDK Manager — either works;
   this repo doesn't require the sandbox's exact apt path, just *a* JDK
   17 and *an* `adb`.)
3. **The one remaining, confirmed-real blocker in this sandboxed
   environment**: the Android Gradle Plugin still can't compile,
   because it resolves `android.jar`, build-tools, and its own
   dependencies via Google's Maven repository — `maven.google.com`,
   which redirects to `dl.google.com` — and `dl.google.com` is denied
   by this sandbox's egress proxy under an **explicit organization
   policy** (not a generic timeout): confirmed three independent ways
   this checkpoint — a direct `curl` to `dl.google.com` (`403`), a
   `curl -L` follow of `maven.google.com`'s redirect landing on the
   same denied host, and a live `apt-get install` of Ubuntu's own
   `google-android-cmdline-tools` package, whose postinstall script
   itself tried to `wget` from `dl.google.com` and failed identically.
   No local mirror or alternate host fixes this — it's a named-host
   policy block, not a missing tool. **This is why the actual Gradle
   build has to run on your own machine**, not in this sandbox.

`app.json`'s `android.versionCode`/`ios.buildNumber` are ready; nothing
about the JS/TS side of this project is what's blocking a build.

**On your own machine** (Mac, Linux, or a CI runner — anywhere with
outbound access to Google's Maven/SDK hosts), once JDK 17 + the Android
SDK (via Android Studio's SDK Manager, or `sdkmanager` directly) are
installed:

#### One-time: generate a release signing key

Play Store rejects debug-signed builds outright, and the native project
Expo generates (`android/`) is **not committed to this repo**.

> **Corrected in M6.** This section used to say to run `prebuild` exactly
> once and never again, because the signing configuration was a hand-edit
> to `android/app/build.gradle` that a regeneration would wipe. It is no
> longer a hand-edit — `mobile/plugins/withReleaseSigning.js` applies it on
> every prebuild — and following the old instruction caused a real bug.
> A plain `expo prebuild` **does not overwrite an existing `android/`**, so
> a native project generated before the M0 rename kept the old launcher
> label and the old icons in its `res/` folder and shipped them in every
> later build. That is what "the app's name went back to the old one"
> was: stale generated metadata, not a runtime or theme problem. See
> `mobile/src/__tests__/appIdentity.test.ts`.
>
> **Always regenerate with `--clean` before a release build**, so the
> native project matches `app.json`.

```bash
cd mobile
# --clean is not optional: without it an existing android/ is reused as-is,
# app name and icons included.
npx expo prebuild --platform android --clean

# Generate a real release keystore (entirely free/local, no account
# needed, never expires by default with -validity 10000 ~= 27 years).
# Keep the resulting file and both passwords somewhere safe outside git
# -- losing them means you can NEVER publish an update to the same Play
# Store listing again, Google cannot recover or reset this for you.
mkdir -p android-signing
keytool -genkeypair -v \
  -keystore android-signing/release.keystore \
  -alias bethaniya-release \
  -keyalg RSA -keysize 2048 -validity 10000
# (prompts for a keystore password, then organization/name details, then
#  a key password -- you can reuse the same password for both)

cat > android-signing/keystore.properties <<'EOF'
storeFile=../android-signing/release.keystore
storePassword=REPLACE_WITH_YOUR_KEYSTORE_PASSWORD
keyAlias=bethaniya-release
keyPassword=REPLACE_WITH_YOUR_KEY_PASSWORD
EOF
```

`mobile/.gitignore` already excludes `*.keystore` and
`keystore.properties` anywhere in the project, so neither can be
accidentally committed.

Now edit `android/app/build.gradle` (inside the `android { }` block) —
this is the standard, official React Native signing pattern
(reactnative.dev/docs/signed-apk-android), applied once:

```diff
     signingConfigs {
         debug {
             storeFile file('debug.keystore')
             storePassword 'android'
             keyAlias 'androiddebugkey'
             keyPassword 'android'
         }
+        release {
+            def keystorePropertiesFile = rootProject.file('../android-signing/keystore.properties')
+            def keystoreProperties = new Properties()
+            keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
+            storeFile rootProject.file(keystoreProperties['storeFile'])
+            storePassword keystoreProperties['storePassword']
+            keyAlias keystoreProperties['keyAlias']
+            keyPassword keystoreProperties['keyPassword']
+        }
     }
     buildTypes {
         debug {
             signingConfig signingConfigs.debug
         }
         release {
-            // Caution! In production, you need to generate your own keystore file.
-            // see https://reactnative.dev/docs/signed-apk-android.
-            signingConfig signingConfigs.debug
+            signingConfig signingConfigs.release
             def enableShrinkResources = ...
```

#### Every build after that

```bash
cd mobile
export JAVA_HOME=/path/to/jdk-17          # must be 17, not 21 or newer
export ANDROID_HOME=/path/to/android/sdk  # wherever Android Studio installed it

# Confirm the release build targets PRODUCTION Firebase, not the emulator:
grep EXPO_PUBLIC_USE_FIREBASE_EMULATORS .env.production   # must read "false"
grep EXPO_PUBLIC_FIREBASE_PROJECT_ID .env.production      # must read bethaniyaministries-production

cd android
./gradlew assembleRelease   # -> app/build/outputs/apk/release/app-release.apk
./gradlew bundleRelease     # -> app/build/outputs/bundle/release/app-release.aab
```

Both commands now produce **signed**, installable, Play-Store-ready
artifacts — `assembleRelease` an APK for direct device install/testing,
`bundleRelease` the `.aab` Play Console actually requires for
submission. **Building and side-loading either one for real-device QA
costs nothing** — no Blaze, no paid Apple/Google developer account, no
billing of any kind.

**Flagging a real, unavoidable cost, separate from this project's ₹0
Firebase constraint, that needs your explicit decision before Phase
11/submission, not something to wave through:** actually *submitting*
to the Google Play Store requires a Google Play Console developer
account, which carries a one-time, non-refundable **$25 USD**
registration fee charged by Google directly (a Play Console account
fee, unrelated to Firebase/GCP billing — enabling it never touches this
project's Firebase project or its Spark-plan status). This has been
true of Play Console for years and isn't something this project can
build around technically. Building the AAB, installing/testing the
APK, and preparing every Play Store listing asset all cost nothing; the
$25 is specifically for the Play Console account needed to click
"submit." Do not pay this, or create/use a Play Console account, without
saying so explicitly first — everything through Phase 10 (signed AAB in
hand) is achievable at true ₹0.

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
