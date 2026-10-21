# Maranatha

**Maranatha** is the church app of Bethaniya Ministries. It has three
parts:

- a **phone app** for members (Android and iOS, built with Expo / React
  Native),
- an **admin website** where church staff publish content and look after
  members (React + Vite),
- a **Firebase backend** (Authentication and Cloud Firestore), kept on
  Firebase's free plan.

> **Naming note.** `Maranatha` is the product name people see. Every
> technical identifier keeps its original name for good, because changing
> one would break existing installs, accounts and data: the Android/iOS id
> `com.bethaniyaministries.app`, the Expo slug `bethaniya-ministries`, the
> Firebase project ids (`bethaniya-ministries-dev-58588`,
> `bethaniyaministries-production`), the release-signing property names and
> every Firestore collection and field. The product name is defined once per
> app, in `mobile/src/theme/brand.ts` and `admin/src/theme/brand.ts`. The
> church's own name is content an administrator edits (`settings/church`).

## What it does

**Phone app** — five tabs:

| Tab       | What members do there                                                                                                                                            |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Home      | Today's Verse of the Day and Prophet Verse, the reading plan they are on, upcoming events, and quick ways into prayer, chat and photos                           |
| Bible     | Read the Telugu (IRV 2019) and English (World English Bible) Bibles, side by side if they like; search, highlight, bookmark and take notes; follow reading plans |
| Prayers   | Keep a private prayer journal, and ask the church to pray on the shared prayer wall (optionally anonymously)                                                     |
| Community | Church updates and group chat, plus events (with live streams), songs with audio, and photos and videos                                                          |
| You       | Profile, saved verses and media, settings, notification history                                                                                                  |

Members sign in with email and password, Google (once its client IDs are
configured) or Apple (iOS). A first-time member answers a short onboarding
questionnaire.

**Admin website** — for the church's staff, by role:

| Area    | Pages                                                                                                               |
| ------- | ------------------------------------------------------------------------------------------------------------------- |
| Content | Announcements, Songs, Events (including live streams), Community posts, Photos & Videos                             |
| Bible   | Verse of the Day, Prophet Verse of the Day, Reading Plans (draft, publish, schedule, unpublish)                     |
| Library | Media Library: upload pictures and songs (through Cloudinary), add YouTube videos and links, reuse them in any form |
| People  | Notifications, Reports (moderation), Users (roles and suspensions), Settings                                        |

Roles are `super_admin`, `content_admin`, `host` and `member`. The rules in
[`firestore.rules`](./firestore.rules) decide who may read or change what;
the website's buttons only reflect them. See [SECURITY.md](./docs/SECURITY.md).

## Where things stand

As of 21 October 2026:

|                                                        | Status                                                                                                                                                                                                   |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Development project (`bethaniya-ministries-dev-58588`) | Firestore database, security rules and indexes deployed. Email/Password and Google sign-in switched on. The admin website runs locally against it.                                                       |
| Production project (`bethaniyaministries-production`)  | Exists. The current rules and indexes have **not** been deployed there yet.                                                                                                                              |
| Picture and song uploads                               | Built and tested against a pretend Cloudinary; switched off until a free Cloudinary account is connected — see [MEDIA_UPLOADS.md](./docs/admin/MEDIA_UPLOADS.md). Pasting a web address works meanwhile. |
| Still to check on a real phone                         | A scheduled reading plan appearing at its time — see [QA_CHECKLIST.md](./docs/QA_CHECKLIST.md)                                                                                                           |
| Not available on the free plan                         | Cloud Functions, so the admin audit log records nothing and the admin Notifications page cannot send (see "Notifications status")                                                                        |
| Store release                                          | Not started — see [PRODUCTION_READINESS.md](./docs/PRODUCTION_READINESS.md)                                                                                                                              |

## Notifications status

The admin website's Notifications page sends through a Cloud Function
(`sendNotification`), which records each notification and how many people it
was for. Cloud Functions cannot be deployed on the free plan, so **sending
does not work yet**. The phone app keeps each member's own notification
history. **Delivering a push notification to phones is not built at all**:
it would also need device-token registration.

## Cost constraint

- **No billing, anywhere.** The Firebase projects stay on the free Spark
  plan; Blaze is not enabled and no payment method is attached.
- Nothing that needs a paid plan is part of the design unless the owner
  explicitly approves it. Cloud Functions are written and tested locally but
  **not deployed**, because deploying them needs Blaze.
- Pictures and songs go to **Cloudinary's free plan**; videos go on
  **YouTube**. Firebase Storage is not used.

## Run it on your computer

You need Node.js 22, npm, Java 21 (for the local Firebase emulators) and
`firebase-tools`. [ENVIRONMENT.md](./docs/ENVIRONMENT.md) has the full setup.

**Against the local emulators** (the default — no Firebase account needed):

```bash
firebase emulators:start --only auth,firestore,storage,functions   # repository root
cd admin && npm ci && npm run dev                                  # http://localhost:5173
cd mobile && npm ci && npm start                                   # Expo
```

**Against the development project:** copy `admin/.env.example` to
`admin/.env.development.local`, fill in the development web app's config and
set `VITE_USE_FIREBASE_EMULATORS=false`, then `npm run dev` in `admin/`.
These files are ignored by git and must never be committed. A production
build reads `admin/.env.production` instead — see
[DEPLOYMENT.md](./docs/DEPLOYMENT.md).

## Testing status

```bash
cd mobile && npm run typecheck && npm run lint && npm test
cd admin && npm run typecheck && npm run lint && npm test
cd functions && npm run typecheck && npm run lint && npm run build

# Security rules and end-to-end tests, against the emulators (repository root)
firebase emulators:exec --only auth,firestore,storage --project demo-no-project "npm --prefix firebase-tests test"
firebase emulators:exec --only firestore,auth,functions --project demo-no-project "npm --prefix functions test"
```

Last full run, 21 October 2026:

| Package                                   | Result                                                                      |
| ----------------------------------------- | --------------------------------------------------------------------------- |
| Phone app (Jest)                          | 155 suites, 2,663 tests passed                                              |
| Admin website (Vitest)                    | 91 files, 1,689 tests passed                                                |
| Security rules and end-to-end (emulators) | 7 suites: 533 tests passed, 2 skipped (a known Storage-emulator limitation) |
| Cloud Functions (emulators)               | 5 suites, 50 tests passed                                                   |

No test contacts a real Firebase project or a real Cloudinary account.

## Repository layout

```
bethaniya-ministries/
├── mobile/           Phone app (Expo / React Native)
├── admin/            Admin website (React + Vite + MUI)
├── functions/        Cloud Functions (written and tested; not deployed)
├── firebase-tests/   Emulator tests for the security rules, plus end-to-end tests
├── scripts/          Setup, seeding and data-import scripts
├── docs/             Every guide (listed below)
├── firebase.json, firestore.rules, firestore.indexes.json, storage.rules
│                     Firebase configuration — kept here, where the Firebase tools expect it
└── assets/           The church logo
```

`mobile`, `admin`, `functions` and `firebase-tests` are separate npm
packages, each with its own `package.json` and `node_modules`.

## Guides

| Guide                                                                                                                        | For                                                                       |
| ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| [ADMIN_GUIDE.md](./docs/ADMIN_GUIDE.md)                                                                                      | Church staff using the admin website, step by step                        |
| [admin/MEDIA_UPLOADS.md](./docs/admin/MEDIA_UPLOADS.md)                                                                      | Connecting Cloudinary for uploads, and what is and is not safe about it   |
| [admin/READING_PLANS.md](./docs/admin/READING_PLANS.md)                                                                      | Writing, scheduling and publishing reading plans                          |
| [ENVIRONMENT.md](./docs/ENVIRONMENT.md)                                                                                      | One-time setup: tools, Firebase projects, environment files               |
| [DEPLOYMENT.md](./docs/DEPLOYMENT.md)                                                                                        | Deploying rules, indexes, the website and the phone app                   |
| [SECURITY.md](./docs/SECURITY.md)                                                                                            | Who can do what, how it is enforced, and how it is tested                 |
| [QA_CHECKLIST.md](./docs/QA_CHECKLIST.md)                                                                                    | Checks to run on a real phone                                             |
| [PRODUCTION_READINESS.md](./docs/PRODUCTION_READINESS.md)                                                                    | What is left before a public release                                      |
| [GOOGLE_SIGN_IN_SETUP.md](./docs/GOOGLE_SIGN_IN_SETUP.md)                                                                    | Setting up Google sign-in                                                 |
| [PLAY_STORE_READINESS.md](./docs/PLAY_STORE_READINESS.md)                                                                    | Preparing the Play Store listing                                          |
| [BIBLE_LICENSING.md](./docs/BIBLE_LICENSING.md)                                                                              | Where the Bible texts come from and their licences                        |
| [PLANS_SOURCES.md](./docs/PLANS_SOURCES.md)                                                                                  | Where the built-in reading plans come from                                |
| [TELUGU_REVIEW.md](./docs/TELUGU_REVIEW.md)                                                                                  | Every Telugu string in the app, for review by a native speaker            |
| [ARCHITECTURE.md](./docs/ARCHITECTURE.md), [FINAL_ARCHITECTURE_SPECIFICATION.md](./docs/FINAL_ARCHITECTURE_SPECIFICATION.md) | How the code is organised, and the original approved specification        |
| [design/](./docs/design/)                                                                                                    | The approved app design, screen by screen                                 |
| [CONTRIBUTING.md](./docs/CONTRIBUTING.md)                                                                                    | Code conventions and checks                                               |
| [HISTORY.md](./docs/HISTORY.md)                                                                                              | How the project was built, checkpoint by checkpoint (the previous README) |

## Production readiness

Not production-ready yet. Before a public release: deploy the rules and
indexes to the production project, run [QA_CHECKLIST.md](./docs/QA_CHECKLIST.md)
on real phones against production, and work through
[PRODUCTION_READINESS.md](./docs/PRODUCTION_READINESS.md). Nothing is
deployed to production without the owner's approval.

## Development workflow

- **GitHub is the source of truth** for the code, not any one computer's
  copy.
- **Work happens in `~/Developer/bethaniya-ministries`.** An iCloud-synced
  copy on `~/Desktop/bethaniya-ministries` exists on at least one machine and
  has sync damage: never use it.
- Changes go on a branch, are tested and reviewed, and are merged into
  `main` only once approved. Secrets and environment files are never
  committed.
