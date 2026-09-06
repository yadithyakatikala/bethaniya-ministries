#!/usr/bin/env bash
# Firebase DEVELOPMENT project setup -- CLI-doable steps only.
#
# This script does NOT touch production. It creates/configures a single
# dedicated Firebase development project and wires this repo to it.
#
# What this script does NOT do (Console-only -- see ENVIRONMENT.md for why):
#   - Upgrade the project to the Blaze billing plan
#   - Enable/create the default Cloud Storage bucket
#   - Enable Apple or Phone sign-in providers
# You must do those three in the Firebase Console BEFORE running the parts
# of this script marked [after Console setup] below, or Cloud Functions /
# Storage rule deploys will fail.
#
# Usage: ./scripts/firebase-dev-setup.sh <project-id> [display-name]
set -euo pipefail

PROJECT_ID="${1:?Usage: $0 <project-id> [display-name]}"
DISPLAY_NAME="${2:-Bethaniya Ministries Dev}"

command -v firebase >/dev/null 2>&1 || { echo "Install firebase-tools first: npm install -g firebase-tools"; exit 1; }

echo "== 1/6: Firebase login (opens a browser) =="
firebase login

echo "== 2/6: Create the Firebase dev project =="
firebase projects:create "$PROJECT_ID" --display-name "$DISPLAY_NAME"

echo "== 3/6: Set it as the 'development' alias for this repo =="
if [ ! -f .firebaserc ]; then
  cp .firebaserc.example .firebaserc
fi
firebase use --add "$PROJECT_ID" --alias development

cat <<EOF

== STOP: manual Console steps required before continuing ==

Go to https://console.firebase.google.com/project/$PROJECT_ID and:

  1. Settings -> Usage and billing -> Modify plan -> upgrade to Blaze
     (pay-as-you-go). Required for Cloud Functions. Free tier quota still
     applies at V1 scale (see FINAL_ARCHITECTURE_SPECIFICATION.md Section D
     for the cost estimate) -- Blaze only removes the hard cap, it does not
     mean you'll be charged from usage alone at this scale.
  2. Build -> Storage -> Get started, to create the default bucket. There
     is no CLI command for this step.
  3. Build -> Authentication -> Get started, then Sign-in method -> enable
     Email/Password (admin auth) at minimum. Apple and Phone sign-in
     (member auth, per the spec) can ONLY be enabled here -- the CLI
     (firebase deploy --only auth) can configure Email/Password, Google,
     and Anonymous, but not Apple or Phone.

Re-run this script with the same project id and it will pick up from
step 4 (steps 1-3 above are idempotent to skip if already done).

EOF

read -p "Press Enter once the three Console steps above are done... " _

echo "== 4/6: Create the Firestore database =="
firebase firestore:databases:create "(default)" --project "$PROJECT_ID" --location=nam5 --type=firestore-native || \
  echo "  (already exists or needs a different --location for your region -- see: firebase firestore:databases:list --project $PROJECT_ID)"

echo "== 5/6: Register a Web app and fetch its SDK config =="
APP_ID=$(firebase apps:create WEB "$DISPLAY_NAME" --project "$PROJECT_ID" --json | node -pe "JSON.parse(require('fs').readFileSync(0)).result.appId")
echo "Web app created: $APP_ID"
firebase apps:sdkconfig WEB "$APP_ID" --project "$PROJECT_ID"

echo "== 6/6: Deploy this repo's committed rules/indexes to the new project =="
firebase deploy --project "$PROJECT_ID" --only firestore:rules,firestore:indexes,storage

cat <<EOF

Done. Copy the config values printed above into:
  mobile/.env.local   (EXPO_PUBLIC_FIREBASE_*)
  admin/.env.local    (VITE_FIREBASE_*)
(see ENVIRONMENT.md "Wiring Firebase config into each app")

Optional: run 'firebase init auth' to declaratively configure Email/Password
and/or Google sign-in, then 'firebase deploy --only auth' to apply it.
EOF
