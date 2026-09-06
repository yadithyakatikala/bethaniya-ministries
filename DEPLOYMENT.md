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

## Environments

Three Firebase projects are planned (dev/staging/production — see
ENVIRONMENT.md). Only `dev` needs to exist for Day 2+ work; staging and
production can be created later, right before they're actually needed
(Week 3 per the spec's 21-day plan). Each environment gets its own
`.firebaserc` target alias and its own `.env.local` values per app.

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
