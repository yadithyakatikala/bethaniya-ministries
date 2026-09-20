# Google Sign-In — the manual setup, exactly

**Status: the app's code is complete and tested. The configuration is
not, and cannot be done from this repository.**

Google Sign-In needs OAuth 2.0 client IDs that exist only in the Google
Cloud Console and the Firebase Console, tied to a signing certificate
fingerprint that only the person holding the keystore can produce.
Nothing in a repository can create them, and nothing here pretends to:
`mobile/.env.example` lists the four variables commented out, and the app
**hides the "Continue with Google" button entirely** when no client ID
resolves for the running platform, rather than showing a button that
cannot work.

This document is the checklist for the person who does have Console
access. Every value in it was read out of this repository, not guessed.

---

## What is already true in the code

Verified by reading the source, and covered by the test suite:

| Requirement | Where it lives | State |
| --- | --- | --- |
| The button, and its loading state | `mobile/src/features/auth/SignInScreen.tsx` | Done |
| The OAuth flow (authorization code + PKCE on native) | `mobile/src/features/auth/useGoogleSignIn.ts` | Done |
| Per-platform client-ID resolution | `mobile/src/services/firebase/googleAuthConfig.ts` | Done |
| Exchanging the Google ID token for a Firebase session | `mobile/src/services/firebase/authService.ts` | Done |
| **Cancellation is not an error** | `isUserCancellation()` in `authErrors.ts` — recognises `{type: 'cancel'}` and `{type: 'dismiss'}` and shows "Sign-in was cancelled." | Done |
| **An email account already using that address** | `auth/account-exists-with-different-credential` is mapped to a specific message in `authErrors.ts` | Done |
| Profile creation on first Google sign-in | `ensureOwnProfileExists()` in `userProfile.ts`, called from `AuthContext` | Done |
| Onboarding runs for a Google account too | `OnboardingGate` sits above the navigator and keys off `profileCompletedAt`, not off the provider | Done |
| The provider is recorded for the admin user list | `recordSignInActivity()` writes `authProvider: 'google.com'` | Done (M7) |
| Email and password sign-in still works | Unchanged; Google is an additional provider, never a replacement | Done |
| A release build with no client ID complains loudly | `console.error('[auth:google] RELEASE BUILD HAS NO GOOGLE OAUTH CLIENT ID …')` | Done |

**What is NOT done, and cannot be:** the Console steps below. This
environment has no credentials for the production Firebase project and no
network route to `accounts.google.com` or `console.cloud.google.com`.

---

## The identifiers these steps must match

Read from `mobile/app.json`. Use these exactly; a mismatch of one
character produces a `redirect_uri_mismatch` or a silent `DEVELOPER_ERROR`
at the moment a member taps the button.

```
Android package name   com.bethaniyaministries.app
iOS bundle identifier  com.bethaniyaministries.app
Expo slug              bethaniya-ministries
App name               Maranatha
URL schemes            bethaniyaministries
                       com.bethaniyaministries.app
```

The Firebase project is the one already configured in
`mobile/.env` / EAS secrets — see `ENVIRONMENT.md`. **Do not create a new
Firebase project for this.** The Google provider has to be enabled on the
project the app already signs in to, or accounts will be created in the
wrong place.

---

## Step 1 — Get the signing certificate fingerprints

Google matches an Android OAuth client by **package name + SHA-1
fingerprint**, so the fingerprint of the certificate that signed the APK
being tested must be registered. There are up to three:

**a) The debug keystore** — for local `expo run:android` builds. Every
machine has its own, so each developer's must be added.

```bash
keytool -list -v \
  -keystore ~/.android/debug.keystore \
  -alias androiddebugkey \
  -storepass android -keypass android
```

**b) The upload key** — the keystore you create for release builds.
`DEPLOYMENT.md` has the `keytool -genkeypair` command that makes it.

```bash
keytool -list -v -keystore <your-upload-key>.jks -alias <your-alias>
```

**c) The Play App Signing key** — if the app is distributed through Google
Play with Play App Signing enabled (the default), **Google re-signs the
app with its own key**, so the certificate on a member's phone is not
your upload key. Its fingerprints are in:

> Play Console → your app → **Test and release → Setup → App signing**

Copy **both** the "App signing key certificate" and the "Upload key
certificate" SHA-1 and SHA-256 values from that page.

> **This is the single most common reason Google Sign-In works in testing
> and fails in production.** Register the Play App Signing SHA-1 as well
> as your upload key's, or every Play-installed copy of the app will fail
> to sign in while your own test build succeeds.

Register **SHA-1** (required by the Android OAuth client) and **SHA-256**
(required by Firebase for App Links / Android App Links, and harmless to
add either way).

---

## Step 2 — Enable the Google provider in Firebase

> Firebase Console → your project → **Authentication → Sign-in method**

1. Add **Google** and enable it.
2. Set the **public-facing name** to `Maranatha`.
3. Set a **project support email**.
4. Save.

Enabling Google here automatically creates a **Web client ID** in the
linked Google Cloud project. Note it down — it is the value for
`EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`.

While you are here, decide the account-linking behaviour:

> Authentication → Settings → **User actions / Account linking**

The default is *"Prevent creation of multiple accounts with the same email
address."* Keep it. The app's error mapping already speaks that language
(`auth/account-exists-with-different-credential` → a message telling the
member to sign in the way they signed up). Switching to "allow multiple
accounts" would let one person end up with two `/users/{uid}` documents,
two onboarding runs, and two sets of bookmarks.

---

## Step 3 — Register the Android app in Firebase

> Firebase Console → **Project settings → General → Your apps → Add app → Android**

- **Android package name:** `com.bethaniyaministries.app`
- **App nickname:** `Maranatha (Android)`
- **Debug signing certificate SHA-1:** from Step 1

Then add **every** remaining fingerprint from Step 1 under
*Project settings → General → Your apps → (the Android app) → Add
fingerprint*: the upload key's SHA-1 and SHA-256, and the Play App Signing
key's SHA-1 and SHA-256.

`google-services.json` is **not** used by this app — it reads its
configuration from `EXPO_PUBLIC_FIREBASE_*` environment variables (see
`ENVIRONMENT.md`). Registering the Android app is still required, because
that is what associates the package name and fingerprints with the
project.

---

## Step 4 — Create the OAuth client IDs

> Google Cloud Console → the **same** project → **APIs & Services → Credentials**

Create an **Android** client (this is the one Android actually needs):

- **Application type:** Android
- **Name:** `Maranatha Android`
- **Package name:** `com.bethaniyaministries.app`
- **SHA-1 certificate fingerprint:** the fingerprint of the build you are
  registering

An Android OAuth client accepts **one** SHA-1. Create a separate Android
client for each certificate you need to support — typically one for the
debug keystore and one for the Play App Signing key. They can all be used
by the same app; Google matches on package name and fingerprint together.

If iOS is ever built, also create an **iOS** client with bundle ID
`com.bethaniyaministries.app`.

The **Web** client already exists from Step 2.

---

## Step 5 — Put the client IDs where the app reads them

Set these for the build. Locally that is `mobile/.env`
(gitignored — see `mobile/.env.example`); for EAS builds they are EAS
secrets. See `ENVIRONMENT.md`.

```
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=<Android client ID from Step 4>
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=<Web client ID from Step 2>
# iOS only:
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=<iOS client ID from Step 4>
```

**These are not interchangeable.** `expo-auth-session` picks exactly one
by platform (`android` → ANDROID, `ios` → IOS, anything else → WEB) and
falls back to the generic `EXPO_PUBLIC_GOOGLE_CLIENT_ID` only if that
specific one is unset. Setting only the Web client ID — the value the
Firebase Console shows most prominently, and therefore the easiest one to
set on its own — leaves **Android with no usable client ID**. The app
detects this and hides the button rather than sending a broken request;
`mobile/src/services/firebase/googleAuthConfig.ts` documents the
resolution in full, and its tests pin it.

Client IDs are **not secrets**. They are paired with a server-side
allowlist of package name + SHA-1 + redirect URI, which is what actually
authorises the request. `EXPO_PUBLIC_` values are compiled into the app
bundle and are readable by anyone who has the APK; this is expected and
is how Google's native flows are designed.

---

## Step 6 — Verify it on a device

Not in an emulator with no Play Services, and not in Expo Go — the
redirect scheme is registered by the native project, so this needs a real
build (`expo run:android`, or an EAS/Play build).

Run through, in order:

1. **The button appears.** If it does not, no client ID resolved for the
   platform — check `adb logcat | grep auth:google` for the loud error.
2. **Tap it.** The Google account chooser opens.
3. **Cancel it** (back button, or tap outside). The app returns to the
   sign-in screen showing *"Sign-in was cancelled."* — **not** a generic
   error. Nothing is logged as a failure.
4. **Sign in with a new Google account.** You land in onboarding (name,
   phone, gender, language), then Home.
5. Check Firestore: `users/{uid}` exists with `role: 'member'`, your
   answers, `profileCompletedAt`, and `authProvider: 'google.com'`.
6. **Sign out and sign in again with the same account.** No second
   onboarding, no duplicate `/users` document, everything as you left it.
7. **Sign in with a Google account whose email already has an
   email/password account.** You get the "already have an account" message
   rather than a generic failure, and no second account is created.
8. **Check the admin dashboard → Users.** That member's detail shows
   *Signs in with: Google* and a *Last active* date.
9. **Email and password sign-in still works**, unchanged.

### If it fails

| What you see | Almost always means |
| --- | --- |
| Button missing | No client ID for this platform — see Step 5 |
| `DEVELOPER_ERROR` / immediate dismissal | SHA-1 not registered for this build's certificate — Step 1(c) is the usual culprit |
| `redirect_uri_mismatch` | Package name in the OAuth client does not match `com.bethaniyaministries.app` exactly |
| Works in debug, fails from Play | Play App Signing key's SHA-1 not registered (Step 1c) |
| `auth/operation-not-allowed` | Google provider not enabled in Firebase (Step 2) |

---

## What this repository can and cannot check

`mobile/src/features/auth/__tests__/` and
`mobile/src/services/firebase/__tests__/` cover the resolution logic, the
hidden-button behaviour, the cancellation path and the error mapping —
all of it without network access, because all of it is app logic.

The fingerprints, the OAuth clients and the provider toggle are Console
state. Nothing in this repository can verify them, and nothing here
claims to. Step 6 is the verification, and it has to be run by somebody
holding a device and the project.
