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

If your network blocks both of those (this happened in the sandboxed dev
environment used to build this repo — `api.adoptium.net` and all
`storage.googleapis.com`-hosted downloads returned `403` from a network
allowlist), Adoptium's own GitHub Releases are a legitimate mirror of the
same official binaries: https://github.com/adoptium/temurin21-binaries/releases
— pick the `.tar.gz`/`.zip` for your OS/arch, verify its published checksum,
extract it anywhere, and point `JAVA_HOME`/`PATH` at it for the emulator
commands below. This is how Java 21 was actually obtained and verified
working (`java -version` → Temurin 21.0.12.1) to run the rule tests in
`firebase-tests/` — see SECURITY.md for those results.

## Firebase projects — what's CLI-doable vs. Console-only

This was verified against the installed `firebase-tools` CLI directly
(`firebase <command> --help` for every relevant namespace), not assumed.
Per the architecture spec, this project eventually needs **three** Firebase
projects (dev / staging / prod); **only dev is needed now.**

**Do NOT use production credentials or production infrastructure for Day
2 — create a dedicated `-dev` project and use only that.**

### CLI-doable (scripted for you in `scripts/firebase-dev-setup.sh`), free Spark tier

- Creating the GCP + Firebase project (`firebase projects:create`)
- Registering this repo's `development` alias (`firebase use --add`)
- Creating the Firestore database (`firebase firestore:databases:create`)
- Registering a Web app and fetching its SDK config
  (`firebase apps:create WEB`, `firebase apps:sdkconfig WEB`) — this repo
  uses the Firebase JS SDK on both mobile (Expo) and admin, not the native
  `@react-native-firebase` module, so one Web app's config serves both
- Deploying the committed `firestore.rules` and `firestore.indexes.json`
  (`firebase deploy --only firestore:rules,firestore:indexes`)

None of the above requires the Blaze plan or any billing information —
`scripts/firebase-dev-setup.sh` does all of it unconditionally.

### Blaze-gated (deferred — not required for current local-development work)

As of Firebase's October 2024 policy change, both of these require the
Blaze (pay-as-you-go) plan, even at zero usage:

1. **Enable/create the default Cloud Storage bucket**, and therefore
   deploying `storage.rules` (`firebase deploy --only storage` fails
   without the bucket). There is no CLI command to create the bucket
   itself — confirmed by listing every command namespace.
2. **Deploy Cloud Functions.** (This repo's setup script does not attempt
   a functions deploy at all; `functions/` is developed and tested locally
   via the emulator instead — see below.)

`scripts/firebase-dev-setup.sh` does not perform either of these and does
not pause waiting for them — it prints instructions for finishing them
later, when billing is actually attached. **We are intentionally not
upgrading to Blaze during current development** to avoid attaching billing
or incurring any charges; see "Developing without Blaze" below for how
Storage/Functions work is still verified in the meantime.

### Console-only, not Blaze-gated (deferred as Day 2 scope, not a billing issue)

- **Enable Apple and Phone sign-in.** `firebase deploy --only auth` only
  covers Email/Password, Google, and Anonymous providers (confirmed
  against Firebase's own CLI-auth-config documentation) — Apple and Phone
  (both named as member-auth requirements in the spec) have no CLI
  configuration path. Firebase Console → Build → Authentication →
  Sign-in method. Not needed until Day 2 auth work begins.

### Developing without Blaze (current phase)

The project stays on the free Spark plan for now — no billing attached, no
possibility of charges. This does not block rule-level development:

- **Firestore and Storage security rules** are verified against real,
  local Firestore/Storage emulators — no real project, bucket, or billing
  plan needed at all. This already works today; see
  `firebase-tests/README.md` and `SECURITY.md` for how to run it and the
  current pass/fail/skip counts.
- **Firestore data access** (once app code is wired to it) can be
  developed against the real dev project's Firestore database, which is
  fully usable on Spark.
- **Storage and Cloud Functions app-level work** will need either the
  local Firebase Emulator Suite (`firebase emulators:start` — already
  configured in `firebase.json` with `auth`, `functions`, `firestore`,
  `storage`, `hosting`, and `ui` emulator ports, all runnable with no
  billing plan at all) or, eventually, Blaze once you decide to attach it.
  Wiring the mobile/admin apps' Firebase SDK initialization to actually
  connect to these emulators is Day 2 scope (both apps' `firebase/config.ts`
  currently define the config shape only, by design — see the "Day 1 note"
  comment in each file) and hasn't been started.

### Running the setup

```bash
npm install -g firebase-tools   # if not already installed
./scripts/firebase-dev-setup.sh bethaniya-ministries-dev-58588
```

**The canonical existing development project is `bethaniya-ministries-dev-58588`
— reuse it, don't create a second dev project.** Firebase project IDs are
globally unique across every Google/Firebase customer, not just this
account: the first setup requested `bethaniya-ministries-dev`, that exact
string was already taken by someone else, and Firebase silently assigned
the suffixed id `bethaniya-ministries-dev-58588` instead — the display
name (`bethaniya-ministries-dev`) and the actual project id are different
strings, and the id is what matters for every CLI/config purpose. The
script detects whether the id you pass it already exists (via `firebase
projects:list`) before trying to create anything, so re-running it with an
existing project's real id continues setup on that same project instead of
creating a duplicate — this isn't specific to this one suffix, it works
for any project id you already have.

The script runs straight through every Spark-tier step with no manual
pause (there's nothing in that path that needs a Console action), then
prints instructions for the deferred Blaze-gated steps instead of waiting
for them. It prints the Firebase config values at the end — copy them into
`mobile/.env.local` and `admin/.env.local` (see below).

### Verifying the repo is actually wired to the right project

After running the script (or doing the steps by hand):

```bash
firebase use                       # should print the alias "development" -> your project id
cat .firebaserc                    # "development" should map to your -dev project id, not a placeholder
firebase deploy --only firestore:rules --dry-run --project development
```

A successful (non-error) dry-run deploy confirms the CLI, `.firebaserc`,
and `firebase.json` in this repo are all actually pointed at your real dev
project — not just that the files look right.

### Wiring the project IDs into this repo

```bash
cp .firebaserc.example .firebaserc
# edit .firebaserc — replace the placeholder project IDs with your real ones
# (scripts/firebase-dev-setup.sh does this "development" entry for you)
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
