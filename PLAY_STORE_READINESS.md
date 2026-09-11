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
| App name | Bethaniya Ministries | `mobile/app.json`'s `expo.name` |
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
  > Bethaniya Ministries: Bible reading (English & Telugu), reading
  > plans, songs, events, live stream, prayers, and church community —
  > all in one app for our congregation.

## Content rating

Google Play's content rating questionnaire is answered inside Play
Console itself (IARC questionnaire), not prepared here. Based on actual
app content (Bible text, church announcements/events/songs, a private
prayer journal, no user-generated public content beyond admin-authored
posts, no ads, no in-app purchases, no user-to-user chat) this app has
no content that would trigger a mature rating — expect "Everyone" once
the questionnaire is completed honestly.

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
| Email address | Yes, if signing in with email/Google | Account creation/authentication | Firebase Auth; `mobile/src/services/firebase/authService.ts` |
| Phone number | Yes, if signing in with Phone OTP | Account creation/authentication | Firebase Auth |
| Name | Yes (display name, self-entered or from Google/Apple) | Shown in-app (profile, "Welcome, ...") | `users/{uid}.displayName`; `mobile/src/features/profile/ProfileScreen.tsx` |
| Photos | Yes, if the user uploads a profile photo | Profile display | Firebase Storage, `users/{userId}/profile/{fileName}` (see `storage.rules`) |
| User-generated content (prayers) | Yes | The app's own Prayers feature — private, never shown to anyone but the user who wrote it | `users/{uid}/prayers/{id}`; see `firestore.rules`' isOwner(userId)-only rule |
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
> create an account (email or phone number, and your name), an optional
> profile photo, and the private prayer requests you write in the app —
> which are visible only to you, never to church administrators or
> other members. We do not use analytics, advertising, or tracking
> technologies of any kind, and we do not share your information with
> any third party. Your data is stored using Google Firebase and
> transmitted using encrypted connections. To request changes to or
> deletion of your data, contact [church contact email].

## Release configuration / AAB

See PRODUCTION_READINESS.md's requirements matrix and DEPLOYMENT.md's
"Local Android APK/AAB build" section for exact status — as of this
checkpoint, the signing keystore and `.aab` have not yet been produced
(needs to happen on a real machine with the Android SDK; this sandbox
cannot compile against it — see DEPLOYMENT.md for exactly why). This
document will be updated once a real, tested, signed `.aab` exists.

## What is explicitly NOT done

- No Play Console account exists or has been created.
- Nothing has been submitted, published, or scheduled for release.
- No screenshots, feature graphic, or final store-listing copy have been
  produced (creative assets, not something to fabricate).
- No privacy policy is published at a real URL yet (draft text only,
  above).
- No self-service account-deletion flow exists in the app (noted
  honestly above, not hidden).

Nothing above proceeds to actual Play Console submission without your
explicit approval, per this project's own standing rule.
