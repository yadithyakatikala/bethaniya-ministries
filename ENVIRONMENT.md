# Environment Setup

Everything in this file is a **manual step** — things Claude cannot do for
you (account creation, clicking "accept" on terms of service, generating
credentials tied to your identity). Nothing in this repo depends on Claude
to build, test, or run; it depends on the accounts and values below existing.

## Development tools (verified present, Day 1)

Confirmed on the current dev machine:

| Tool           | Version                                                         |
| -------------- | --------------------------------------------------------------- |
| Node.js        | v22.23.2                                                        |
| npm            | 10.9.8                                                          |
| git            | 2.34.1                                                          |
| TypeScript     | 6.0.x (per-package)                                             |
| Java (OpenJDK) | 11 — **too old** for the Firestore/Storage emulators (need 21+) |

Not installed / not attempted: `firebase-tools` (CLI), `eas-cli` is
resolvable via `npx` but not installed globally, `watchman` (optional,
improves Metro file-watching performance on large projects — not required
at current project size).

### Java 21 (needed for local Firebase emulators)

The Firestore/Storage/Auth emulators (`firebase emulators:start`) require
Java 21+. Install one of:

- macOS: `brew install openjdk@21`
- Or download Temurin 21 from https://adoptium.net

This could not be installed automatically from the dev sandbox (its network
egress allowlist blocked the download). Install it directly on your machine,
then re-run emulator commands from `functions/README` or `DEPLOYMENT.md`.

## Firebase projects (required — nothing backend-related works without this)

Per the architecture spec, this project needs **up to three** Firebase
projects (dev is required now; staging/production can wait):

1. Go to https://console.firebase.google.com
2. Create a project named e.g. `bethaniya-ministries-dev`
3. Repeat for `bethaniya-ministries-staging` and `bethaniya-ministries-prod`
   when you're ready for them (not required for Day 2)
4. In each project, enable:
   - **Authentication** → Sign-in method → enable Google, Apple, and Phone
     (member auth) and Email/Password (admin auth)
   - **Firestore Database** → Create database (start in production mode —
     the rules in this repo are deny-by-default already)
   - **Storage** → Get started
   - **Cloud Functions** → requires the Blaze (pay-as-you-go) plan even at
     zero usage; the free tier covers V1-scale usage per the spec's cost
     estimates, but the plan itself must be Blaze to deploy Functions at all
5. For each Firebase project, add a **Web app** (</> icon in project
   settings) to get the config values for `mobile/.env.local` and
   `admin/.env.local` (see below)

### Wiring the project IDs into this repo

```bash
cp .firebaserc.example .firebaserc
# edit .firebaserc — replace the placeholder project IDs with your real ones
```

`.firebaserc` is gitignored on purpose (project IDs aren't secret, but
there's no reason to force every environment to use the same one).

### Wiring Firebase config into each app

```bash
cp mobile/.env.example mobile/.env.local
cp admin/.env.example admin/.env.local
```

Fill in both from Firebase Console → Project Settings → General → "Your
apps" → the web app you registered → SDK setup and configuration → Config.
These values are not secret (see SECURITY.md) but `.env.local` is gitignored
regardless, to keep each developer's/environment's config independent.

## Apple Developer account (needed before real device testing / TestFlight)

- https://developer.apple.com/programs/ — $99/year
- Not needed for Day 1–7 (simulator/Expo Go development); needed starting
  around Day 8 per the spec's plan for real-device builds

## Google Play Developer account (needed before Play Store internal testing)

- https://play.google.com/console/signup — $25 one-time (spec's ₹750
  estimate was outdated at spec-writing time; verify current price)
- Same timing as Apple: not needed for Day 1–7

## GitHub

Already set up as of Day 1 — this repo. SSH access from the dev machine was
configured during Day 1 setup (a dev-machine-specific SSH key was generated
and added to your GitHub account's SSH keys). If you set up a new
development machine later, generate a new key there and add it the same way
— don't copy the private key between machines.

## Content & branding (needed before Day 5, not urgent now)

Per the spec (Section F): church logo (PNG/SVG, 512×512+), primary/secondary
brand colors (currently placeholder `#2563EB` / `#7C3AED` in
`admin/src/theme/theme.ts`), church name/description/support email, and
sample test content (a few announcements, daily verse images, songs with
audio URLs, events). None of this blocks Day 1–4 work.

## Bible content licensing (see FINAL_ARCHITECTURE_SPECIFICATION.md Section C)

Not resolved. Requires your decision + outreach (API.Bible, Bible Society of
India, or open-source alternatives) before any real English or Telugu
scripture text is added. Does not block most of Day 1–7.
