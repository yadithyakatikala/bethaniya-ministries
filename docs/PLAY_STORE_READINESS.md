# Google Play Store Readiness

Everything on this page is prepared, verified against the actual
repository/app behavior, and ready to use — **nothing here has been
submitted or published, and nothing will be without your explicit
go-ahead.** No privacy/data practice below is invented; each is derived
directly from what the app's code actually does (see the citation after
each claim).

## Real, unavoidable cost this phase surfaces

Registering a Google Play Console developer account costs a one-time,
non-refundable **$25 USD**, charged by Google directly. This is
separate from and unrelated to this project's Firebase Spark-plan ₹0
constraint — enabling it never touches Firebase/GCP billing. It is,
however, a real cost, and this project's own rules require flagging it
rather than assuming approval. **Do not create or pay for a Play
Console account until you say so explicitly.** Everything else on this
page — building the AAB, preparing every asset below, running real-
device QA — costs nothing.

## App identity

| Field | Value | Verified via |
| --- | --- | --- |
| App name | Maranatha | `mobile/app.json`'s `expo.name` (renamed in M0; the Play listing must use this, not the older "Bethaniya Ministries") |
| Package / Application ID | `com.bethaniyaministries.app` | `mobile/app.json`'s `expo.android.package` (matches `expo.ios.bundleIdentifier`) |
| Version name | 1.0.0 | `mobile/app.json`'s `expo.version` |
| Version code | 1 | `mobile/app.json`'s `expo.android.versionCode` — correct for a first submission; Play Console requires this to strictly increase on every future upload |
| Category | Lifestyle, or Communication (church community/reference apps commonly use either — no analytics/engagement data exists to argue for one over the other; pick whichever fits your Play Console account's own category list at submission time) | Not enforced anywhere in the codebase; a store-listing-only choice |

## App icon / launcher icon

Ready — see PRODUCTION_READINESS.md's "Real app icon / adaptive icon /
splash" row. All icon variants (standard icon, Android adaptive-icon
foreground/background/monochrome layers) are derived from the real
church logo at `assets/branding/church-logo.png`, verified via an actual
`expo prebuild` regenerating the native project correctly with them.

## Store listing assets — NOT yet prepared, need your input

These are marketing/content decisions this document cannot invent on
your behalf, since they describe the church/ministry itself, not
anything the code determines:

- **Screenshots** (Play Console requires at least 2, phone-sized;
  recommended 4-8 covering the app's range). Cannot be captured until
  a real device build exists — see Phase 8 QA. Good candidates once
  available: Home, Bible reader, a Reading Plan day, Prayers, Community,
  and the admin dashboard is NOT eligible (Play Store screenshots must
  be of the app being submitted, i.e. mobile only).
- **Feature graphic** (1024×500 PNG/JPG, shown at the top of the Play
  Store listing) — a design asset, not something derivable from code;
  needs the church logo plus whatever tagline/imagery you want
  represented. Not fabricated here since it's a creative decision, not
  a factual one.
- **Short description** (max 80 characters) and **full description**
  (max 4000 characters) — marketing copy describing Bethaniya
  Ministries as a church, which only you can write accurately. A
  factual starting point, based purely on what the app does (edit
  freely):
  > Maranatha: Bible reading (English & Telugu), a verse for every day
  > of the year, reading plans, songs, events, live stream, prayer
  > requests, church chat, photos and videos — all in one app for our
  > congregation.

## Content rating

Google Play's content rating questionnaire is answered inside Play
Console itself (IARC questionnaire), not prepared here. Based on actual
app content (Bible text, church announcements/events/songs, a private
prayer journal, no ads, no in-app purchases) this app has no content that would
trigger a mature rating — expect "Everyone" once the questionnaire is
completed honestly.

**ANSWER THE USER-CONTENT QUESTIONS "YES".** Since M7 the app has
member-to-member content: a church-wide chat, shared prayer requests
(including anonymous ones), and comments on media. Play's questionnaire
asks about user-generated content and about whether it is moderated;
both answers are yes, and the moderation is real rather than claimed —
members can report any item (`mobile/src/features/moderation/`),
administrators review reports and remove content
(`admin/src/features/moderation/ReportsPage.tsx`), and a super admin can
suspend a member temporarily or permanently
(`admin/src/features/users/`). An earlier version of this document said
there was no user-to-user chat; that was true when it was written and is
not true now.

## Target audience

The app is a general-audience church-member app, not directed at
children specifically, and collects standard account information (see
Data Safety below) that would be inappropriate to collect from children
under 13 without verifiable parental consent under Play's Families
policy. Declare the target age range as "not designed for children" /
18+ or general audience per your congregation's actual makeup — this is
a policy declaration about who the app is *for*, not a technical
restriction the code enforces (there is no age gate in the app).

## Data Safety declaration — derived from actual code, not invented

Google Play's Data Safety form asks what data is collected, why, and
whether it's shared with third parties. Below is drawn directly from
what this app's code actually does — verify against the cited files
before submitting, since this document can go stale if the app changes
after this checkpoint.

**Data collected:**

| Data type | Collected? | Purpose | Where |
| --- | --- | --- | --- |
| Email address | Yes — required by both V1 sign-in methods (Email/Password and Google) | Account creation/authentication | Firebase Auth; `mobile/src/services/firebase/authService.ts` |
| Phone number | **Yes, optionally** — M6's onboarding asks for one and the member may skip it or later clear it. It is NOT an authentication factor: there is no OTP and no phone sign-in provider anywhere in the app, and the onboarding form says so. | So the church can reach a member | `users/{uid}.phoneNumber`; `mobile/src/features/onboarding/OnboardingScreen.tsx` |
| Name | Yes (display name, self-entered at sign-up or from Google) | Shown in-app (profile, "Welcome, ...") | `users/{uid}.displayName`; `mobile/src/features/profile/ProfileScreen.tsx` |
| Photos | Not stored BY this app on the current infrastructure — Cloud Storage needs the Blaze plan, which this project does not use, so the profile-photo upload path cannot complete. M6's media feed shows photos and videos the church publishes, but those are URLs an administrator pastes in, pointing at hosting the church already has; nothing is uploaded from a member's phone. Declare photo collection only once Storage is enabled. | Profile display; church media | Firebase Storage `users/{userId}/profile/{fileName}` (see `storage.rules`); `media_posts.mediaUrl` |
| User-generated content — private prayer journal | Yes | The member's own journal, never shown to anyone else | `users/{uid}/prayers/{id}`; `firestore.rules`' isOwner(userId)-only rule |
| User-generated content — shared, member to member | **Yes (M7)** | Church chat, shared prayer requests, media comments and abuse reports. Visible to other signed-in members. An ANONYMOUS prayer request carries no name or uid on the public document at all — the author's identity lives in a subdocument readable only by them and a super admin, and `firestore.rules` refuses a write that puts it anywhere else | `community_messages`, `prayer_requests` (+ `prayer_requests/{id}/private/author`), `reports`; see `firestore.rules` |
| Account status / moderation record | **Yes (M8)** | A suspension and its terms — kind, reason, dates and the administrator who acted — recorded so a church can answer "why is this account suspended". Visible to the member (their own document) and to super admins | `users/{uid}.accountStatus` and `users/{uid}.suspension` |
| App activity / analytics | **No** | No analytics or crash-reporting SDK is present anywhere in `mobile/package.json` — verified by direct inspection, not assumed | — |
| Location | **No** | No location permission is requested; no location API is used anywhere in the codebase | — |
| Precise identifiers (device ID, ad ID) | **No** | No advertising SDK, no device-fingerprinting library present | — |
| Audio | **No, despite a manifest permission** | `RECORD_AUDIO` appears in the generated `AndroidManifest.xml` (declared unconditionally by the `expo-audio` library, which this app uses only for **playback**, never recording) — no code path anywhere calls a recording API or requests the runtime permission. Declare "no audio data collected" truthfully; if Play's automated scan flags the manifest permission, the correct response is exactly this explanation, not removing the (harmless, unused) permission under submission pressure |

**Sharing:** None of the above is shared with any third party. Firebase
(Auth/Firestore/Storage) is this app's own backend, not a third-party
data broker or ad network — this is the standard "processor, not
recipient" framing Play's Data Safety form itself uses for a developer's
own backend infrastructure.

**Security practices to declare truthfully:** data is encrypted in
transit (Firebase SDKs use HTTPS/TLS exclusively — this is not
configurable and cannot be disabled); data is NOT encrypted at rest
beyond whatever Firebase's own infrastructure provides by default (no
app-level encryption is implemented); users can request account
deletion (there is no self-service "delete my account" button in the
app today — Profile allows editing but not deletion; a Super Admin can
delete a `/users/{uid}` doc via the Users page or Firebase Console,
which is a manual, admin-mediated path, not a self-service one. If Play
requires a self-service deletion path or a published deletion-request
process, note this as an honest current gap, not something to
misrepresent as implemented).

## Permissions declared in the app

From the generated `AndroidManifest.xml` (verified via an actual `expo
prebuild` run, not assumed):

| Permission | Why | Used at runtime? |
| --- | --- | --- |
| `INTERNET` | Every Firebase call | Yes, constantly |
| `READ_EXTERNAL_STORAGE` / `WRITE_EXTERNAL_STORAGE` (maxSdk 32 only) | Profile photo picker (`expo-image-picker`) | Yes, when a user uploads a profile photo |
| `VIBRATE` | Notification feedback (`expo-notifications`) | Yes, on local notification delivery |
| `RECORD_AUDIO` | Declared unconditionally by `expo-audio` (playback library) | **No** — never requested or used by any app code path |
| `SYSTEM_ALERT_WINDOW` | Declared by a transitive React Native dev-tooling dependency | **No** — not used in release behavior |

The last two are real findings from this checkpoint's audit, not new
additions — they're pre-existing side effects of the audio-playback and
React Native libraries this app already depended on, not anything this
project added deliberately. Removing them would require adding a new
dependency (`expo-build-properties`, to explicitly block them at build
time) that wasn't added without your sign-off, since it's a new
dependency for a cosmetic Play Console review concern, not a functional
fix. Play Console does not reject apps for an unused, correctly-
undeclared-as-collecting-data permission; if you'd like them removed
anyway, say so and it's a small, isolated follow-up.

## Privacy policy — required, not yet published

Play Console requires a **publicly reachable URL** to a privacy policy
before submission, covering exactly the Data Safety declarations above
(the two must match — Play checks for consistency). This project does
not have a published privacy policy or a website to host one on. A
factual draft, based purely on the Data Safety table above, is provided
below as a starting point — this still needs an actual URL to live at
(e.g., a page on the church's website, or a free static host like
GitHub Pages, both ₹0) before submission can proceed:

> **Bethaniya Ministries — Privacy Policy (draft)**
>
> Bethaniya Ministries collects the information you provide when you
> create an account (your email address, and your name), an optional
> profile photo, and the private prayer requests you write in the app —
> which are visible only to you, never to church administrators or
> other members. We do not use analytics, advertising, or tracking
> technologies of any kind, and we do not share your information with
> any third party. Your data is stored using Google Firebase and
> transmitted using encrypted connections. To request changes to or
> deletion of your data, contact [church contact email].

## Release configuration — technical audit (M8)

Every row below was checked against the repository during the M8 pass,
not carried over from a previous one.

| Check | Status | Where |
| --- | --- | --- |
| `applicationId` | `com.bethaniyaministries.app`, unchanged, and equal to the iOS bundle id | `mobile/app.json` |
| App name | `Maranatha` | `mobile/app.json` |
| `versionName` | `1.0.0` — **unchanged on purpose.** Nothing has been published, so there is no released version for a first submission to supersede. Raising it would only make the first listing claim a history the app does not have | `mobile/app.json` |
| `versionCode` | `1` — likewise unchanged, and valid for a first upload. Play requires it to strictly increase on every subsequent upload | `mobile/app.json` |
| Release signing | Configured, **credentials absent** — see below | `mobile/plugins/withReleaseSigning.js` |
| Production Firebase config | Read from `EXPO_PUBLIC_FIREBASE_*`. **No `.env.production` exists in the repo**, by design — those values are yours to supply | `mobile/src/services/firebase/config.ts`, `.env.example` |
| Emulator config in a release build | **Off unless explicitly turned on.** The default is build-type dependent: emulators on in a dev build, off in a release bundle, because a release build silently talking to `10.0.2.2` was a real outage once. A release build that somehow still has them on logs an explicit error | `mobile/src/services/firebase/app.ts`'s `isEmulatorEnabled()` and `assertProductionConfigSane()` |
| Release build with no real project config | Logs an explicit error naming the empty `projectId` rather than failing silently | `assertProductionConfigSane()` |
| Google Sign-In | Resolved PER PLATFORM, matching what `expo-auth-session` actually does, so a build carrying only the web client id reports itself unconfigured on Android instead of sending a placeholder to Google. Android OAuth client + SHA-1/SHA-256 are Console steps | `mobile/src/services/firebase/googleAuthConfig.ts`, `GOOGLE_SIGN_IN_SETUP.md` |
| Debug logging | **None.** Zero `console.log` calls in `mobile/src` outside tests (the remaining `console.warn`/`console.error` are deliberate failure diagnostics) | grep over `mobile/src` |
| Launcher + adaptive icon | Present, from the real church logo, all layers | `mobile/assets/` |
| Splash screen | Configured, with a dark variant | `mobile/app.json` |
| Permissions | No new permission added in this pass. `RECORD_AUDIO` and `SYSTEM_ALERT_WINDOW` are already blocked in config | `mobile/app.json`'s `android.blockedPermissions` |
| Orientation | Portrait | `mobile/app.json` |

### Signing: what exists, and what is missing

`mobile/plugins/withReleaseSigning.js` gives the Android `release` build
type a real signing configuration instead of Expo's template default of
`signingConfig signingConfigs.debug`. It reads four Gradle properties
that live in the developer's OWN `~/.gradle/gradle.properties`, outside
this repository:

```
BETHANIYA_UPLOAD_STORE_FILE=/absolute/path/to/upload-keystore.jks
BETHANIYA_UPLOAD_STORE_PASSWORD=...
BETHANIYA_UPLOAD_KEY_ALIAS=upload
BETHANIYA_UPLOAD_KEY_PASSWORD=...
```

**No keystore and no credentials exist in this repository, and none were
invented.** When those properties are absent the build falls back to the
debug keystore AND LOGS A WARNING SAYING SO, which keeps a local smoke
build working while making a debug-signed artifact impossible to ship by
accident — Play rejects one outright, and the warning names the reason
before you get there.

**What you must provide before a release AAB can be signed:**

1. An upload keystore, created ONCE on your own machine and backed up
   somewhere you will still have in five years (losing it means you can
   never update the app unless Play App Signing is enabled and Google
   holds the app signing key):

   ```
   keytool -genkeypair -v -keystore upload-keystore.jks \
     -alias upload -keyalg RSA -keysize 2048 -validity 10000
   ```

2. The four Gradle properties above in `~/.gradle/gradle.properties`.
   Never in this repository, never in `mobile/android/`, never in an
   environment file that gets committed.

3. The production Firebase values in `mobile/.env.production`, and the
   Google OAuth client ids (see `GOOGLE_SIGN_IN_SETUP.md`).

### The AAB was NOT built, and why

**No `.aab` and no `.apk` were produced in this pass.** Two independent
blockers, both environmental and neither fixable from here:

- **No Android SDK.** `ANDROID_HOME` and `ANDROID_SDK_ROOT` are unset;
  only `platform-tools` is present. There is no `android/` directory
  either — it is generated by `expo prebuild` and gitignored.
- **The Android Gradle Plugin cannot be downloaded.** `dl.google.com`
  does not resolve from this environment (connection failure, not a
  404), and `maven.google.com` 301-redirects to it. Gradle therefore
  cannot resolve `com.android.tools.build:gradle` at all.

This is a property of the build environment, not of the project's
configuration. Everything a build needs from the repository is in place;
what is missing is a machine with the Android SDK, the upload keystore,
and the production environment values.

To build on such a machine:

```
cd mobile
npx expo prebuild --platform android --clean
cd android
./gradlew :app:bundleRelease
```

The bundle lands at
`mobile/android/app/build/outputs/bundle/release/app-release.aab`.

**Verify it is not debug-signed before uploading:**

```
unzip -p app-release.aab META-INF/*.RSA | keytool -printcert
```

A debug-signed artifact prints `CN=Android Debug`. If you see that, the
Gradle properties did not reach the build — re-read the warning in the
build log rather than uploading.

## Play Console: what is done in code, and what only you can do

**DONE IN CODE — nothing further is needed from the repository:**

- applicationId, app name, versionName, versionCode
- release signing CONFIGURATION (the key itself is yours to create)
- production Firebase wiring, with a release build that refuses to
  silently use emulators
- Google Sign-In wiring, resolved per platform
- launcher icon, adaptive icon, splash screen
- permissions, with the two unused ones already blocked
- no debug logging, no analytics SDK, no ad SDK, no tracking

**MUST BE DONE MANUALLY IN PLAY CONSOLE — none of it from here, and
none of it without your explicit go-ahead:**

1. Create the Play Console developer account (one-time **$25 USD**,
   charged by Google — see the top of this document).
2. Create the app; set the default language and the app name
   (`Maranatha`).
3. Choose the app category.
4. Store listing: short description (80 chars), full description
   (4000 chars), app icon, feature graphic (1024×500), at least two
   phone screenshots.
5. Publish a privacy policy at a real, public URL and paste that URL in.
6. Complete the **Data Safety** form to match the table above — including
   the member-to-member content rows, which an earlier version of this
   document got wrong.
7. Complete the **content rating** (IARC) questionnaire, answering YES
   to the user-generated-content questions.
8. Declare the target audience.
9. Provide app-access instructions: the app shows nothing without a
   sign-in, so Play's reviewers need a working test account (email and
   password) or they will reject it as unreviewable.
10. Declare that the app contains no ads.
11. Enable **Play App Signing** (strongly recommended: Google holds the
    app signing key, and losing your upload key stops being fatal).
12. Upload the AAB to an **internal testing** track first, install it
    from the Play link on a real device, and work through the QA list
    below.
13. Only then promote to production.

## Real-device QA, once a signed AAB exists

Do not publish on the strength of this list being written down; work
through it on a real phone, on the internal testing track.

- [ ] The app launches from a cold start
- [ ] Registration with an email address
- [ ] Sign in with email and password
- [ ] Sign in with Google
- [ ] Sign out
- [ ] Profile: name, phone, language, theme all save and survive a restart
- [ ] Bible: book list, chapter list, reader, search; English, Telugu
      and bilingual
- [ ] Verse of the Day appears on Home, and is the SAME verse on a
      second device
- [ ] Prophet Verse of the Day appears when the church has published
      one, and the section explains itself when it has not
- [ ] Reading plans: all five are there without an administrator
      creating anything, and a day can be completed
- [ ] Community: opens its own screen, with routes to chat and media
- [ ] Church chat: send, receive, delete your own message
- [ ] Prayers: the shared feed, "Ask for prayer", and an anonymous
      request showing no name
- [ ] Media: the feed, a post, and saving one
- [ ] Navigation: pushes slide, tabs cross-fade, sheets slide up, the
      Android back button and back gesture behave
- [ ] Turn on the phone's "remove animations" setting: nothing moves,
      and everything still works
- [ ] Suspension: suspend a test account from the dashboard, confirm the
      app shows the notice, confirm force-quitting and reopening does
      not get past it, confirm posting is refused, then restore access
      and confirm the app comes back
- [ ] Dark mode, including the headers and the status bar

## What is explicitly NOT done

- No Play Console account exists or has been created.
- Nothing has been submitted, published, or scheduled for release.
- No screenshots, feature graphic, or final store-listing copy have been
  produced (creative assets, not something to fabricate).
- No privacy policy is published at a real URL yet (draft text only,
  above).
- No self-service account-deletion flow exists in the app (noted
  honestly above, not hidden).
- **No `.aab` and no `.apk` have been built.** This environment has no
  Android SDK and cannot reach `dl.google.com`, so the Android Gradle
  Plugin cannot even be resolved — see the release-configuration
  section for both blockers and for the exact commands to run on a
  machine that has them.
- No upload keystore exists, and none was invented. The signing
  configuration is in place and reads credentials from outside the
  repository; the key itself is yours to create.

**This app is therefore NOT "Play Store ready" yet.** The code is
prepared and verified; what is missing is a signed release bundle,
which cannot be produced here.

Nothing above proceeds to actual Play Console submission without your
explicit approval, per this project's own standing rule.
