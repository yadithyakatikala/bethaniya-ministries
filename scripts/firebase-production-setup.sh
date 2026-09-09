#!/usr/bin/env bash
# Firebase PRODUCTION project setup -- CLI-doable, free-tier-first.
#
# Mirrors scripts/firebase-dev-setup.sh exactly, aimed at the "production"
# alias instead of "development". Read that script's own header first if
# you haven't already -- the project-id-reuse behavior, and the Spark
# (free) vs. Blaze (billing) split, are identical here. This script does
# NOT touch the existing dev project (bethaniya-ministries-dev-58588) or
# any staging project.
#
# Free (Spark) tier vs. Blaze-gated steps:
# Firestore (database creation, rules/indexes deploy), Auth, and Web app
# registration all work on the free Spark plan -- no billing required.
# Cloud Storage (the default bucket, and therefore storage.rules deploy)
# and Cloud Functions both require the Blaze (pay-as-you-go) plan, per
# Firebase's Oct 2024 policy change, even at zero usage. This script does
# every Spark-tier step unconditionally and does NOT deploy storage.rules
# or attempt anything Functions-related -- so running it never requires
# you to attach billing, and never asks you to. See the "Deferred"
# section it prints at the end for how to finish those steps later, when
# you decide to.
#
# This creates a REAL production Firebase project that real church
# members' data will eventually live in -- unlike the dev script, this
# one asks for an explicit "yes" before doing anything, even though every
# individual step it runs stays on the free plan.
#
# Usage: ./scripts/firebase-production-setup.sh <project-id> [display-name]
#   <project-id> may be a NEW id to request, or the ACTUAL id of a project
#   that already exists (e.g. one Firebase previously created with a
#   suffix) -- either way this script does the right thing.
#
#   The real production project already exists:
#     ./scripts/firebase-production-setup.sh bethaniyaministries-production "BethaniyaMinistries Production"
#   Since it already exists, step 2/6 below detects that and reuses it
#   rather than trying to create a second one.
set -euo pipefail

PROJECT_ID="${1:?Usage: $0 <project-id> [display-name]}"
DISPLAY_NAME="${2:-Bethaniya Ministries}"

command -v firebase >/dev/null 2>&1 || { echo "Install firebase-tools first: npm install -g firebase-tools"; exit 1; }

echo "This will set up a PRODUCTION Firebase project: $PROJECT_ID"
echo "Every step below stays on the free Spark plan -- nothing here enables"
echo "billing or requires a card. Type 'yes' to continue, anything else to abort."
read -r CONFIRM
if [ "$CONFIRM" != "yes" ]; then
  echo "Aborted -- nothing was changed."
  exit 1
fi

echo "== 1/6: Firebase login (opens a browser) =="
firebase login

echo "== 2/6: Create or reuse the Firebase production project =="
if firebase projects:list --json 2>/dev/null | PROJECT_ID="$PROJECT_ID" node -e '
  const data = JSON.parse(require("fs").readFileSync(0, "utf8"));
  process.exit(data.result.some((p) => p.projectId === process.env.PROJECT_ID) ? 0 : 1);
'; then
  echo "  Project $PROJECT_ID already exists -- reusing it (not creating a second one)."
else
  echo "  Project $PROJECT_ID not found -- creating it now."
  firebase projects:create "$PROJECT_ID" --display-name "$DISPLAY_NAME"
fi

echo "== 3/6: Set it as the 'production' alias for this repo =="
if [ ! -f .firebaserc ]; then
  cp .firebaserc.example .firebaserc
fi
firebase use --add "$PROJECT_ID" --alias production

echo "== 4/6: Create the Firestore database (free Spark tier) =="
firebase firestore:databases:create "(default)" --project "$PROJECT_ID" --location=nam5 --type=firestore-native || \
  echo "  (already exists or needs a different --location for your region -- see: firebase firestore:databases:list --project $PROJECT_ID)"

echo "== 5/6: Register a Web app and fetch its SDK config (free Spark tier) =="
APP_ID=$(firebase apps:create WEB "$DISPLAY_NAME" --project "$PROJECT_ID" --json | node -pe "JSON.parse(require('fs').readFileSync(0)).result.appId")
echo "Web app created: $APP_ID"
firebase apps:sdkconfig WEB "$APP_ID" --project "$PROJECT_ID"

echo "== 6/6: Deploy this repo's committed Firestore rules/indexes (free Spark tier) =="
firebase deploy --project "$PROJECT_ID" --only firestore:rules,firestore:indexes

cat <<EOF

Done with everything that works on the free Spark plan. Copy the config
values printed above into a PRODUCTION-only env file for each app -- do
NOT put production credentials in mobile/.env.local or admin/.env.local
(those stay pointed at the dev project for everyday local development):
  mobile/.env.production   (EXPO_PUBLIC_FIREBASE_*, EXPO_PUBLIC_APP_ENV=production, EXPO_PUBLIC_USE_FIREBASE_EMULATORS=false)
  admin/.env.production    (VITE_FIREBASE_*, VITE_APP_ENV=production, VITE_USE_FIREBASE_EMULATORS=false)
(see ENVIRONMENT.md "Wiring Firebase config into each app")

Also still needed before real church members can sign in, all Console-only,
free, no CLI command exists for these:
  - https://console.firebase.google.com/project/$PROJECT_ID/authentication/providers
    -> enable Google / Apple / Phone sign-in (whichever this app uses)
  - For Phone auth specifically: add your app's SHA-1 (Android) / bundle id
    (iOS) under Project Settings -> Your apps, and set up reCAPTCHA/App
    Check per Firebase's current phone-auth requirements.

== Deferred (needs Blaze -- not done by this script, not asked for) ==

storage.rules is intentionally NOT deployed here, and Cloud Functions are
intentionally NOT deployed here. As of Firebase's Oct 2024 policy, even
enabling the default Cloud Storage bucket requires the Blaze (pay-as-you-go)
plan -- so these steps are skipped until you decide to attach billing.
Church songs (audio) and any Storage-backed feature will not work in
production until this is done; every other feature (Bible, announcements,
daily verses, events, notifications history, live stream link, admin CRUD)
does not depend on Storage or Functions and works today.

When you're ready to attach billing, do these in order:
  1. https://console.firebase.google.com/project/$PROJECT_ID/usage/details
     -> Modify plan -> Blaze.
  2. https://console.firebase.google.com/project/$PROJECT_ID/storage
     -> Get started (creates the default bucket -- no CLI command for this).
  3. firebase deploy --project $PROJECT_ID --only storage
  4. cd functions && npm run build && firebase deploy --project $PROJECT_ID --only functions
EOF
