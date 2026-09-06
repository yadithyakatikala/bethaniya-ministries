#!/usr/bin/env bash
# Firebase DEVELOPMENT project setup -- CLI-doable, free-tier-first.
#
# This script does NOT touch production. It creates (or reuses -- see
# below) a single dedicated Firebase development project and wires this
# repo to it.
#
# Reusing an existing project: Firebase project IDs are globally unique
# across ALL Google/Firebase customers, not just your own account. If your
# requested id is already taken by anyone, Google silently assigns a
# suffixed id instead (e.g. requesting "bethaniya-ministries-dev" can
# yield "bethaniya-ministries-dev-58588"). This script handles that: it
# checks whether the given <project-id> already exists before trying to
# create it, so re-running with the ACTUAL id Firebase assigned continues
# setup on that same project rather than attempting to create a second
# one. This is not specific to any one project id/suffix -- it works for
# any existing project id you pass in.
#
# Free (Spark) tier vs. Blaze-gated steps:
# Firestore (database creation, rules/indexes deploy) and Web app
# registration all work on the free Spark plan -- no billing required.
# Cloud Storage (the default bucket, and therefore storage.rules deploy)
# and Cloud Functions both require the Blaze (pay-as-you-go) plan, per
# Firebase's Oct 2024 policy change, even at zero usage. This script does
# every Spark-tier step unconditionally and does NOT deploy storage.rules
# or attempt anything Functions-related -- so running it never requires
# you to attach billing. See the "Deferred" section it prints at the end
# for how to finish the Storage/Functions steps later, when you're ready.
#
# Usage: ./scripts/firebase-dev-setup.sh <project-id> [display-name]
#   <project-id> may be a NEW id to request, or the ACTUAL id of a project
#   that already exists (e.g. one Firebase previously created with a
#   suffix) -- either way this script does the right thing.
set -euo pipefail

PROJECT_ID="${1:?Usage: $0 <project-id> [display-name]}"
DISPLAY_NAME="${2:-Bethaniya Ministries Dev}"

command -v firebase >/dev/null 2>&1 || { echo "Install firebase-tools first: npm install -g firebase-tools"; exit 1; }

echo "== 1/6: Firebase login (opens a browser) =="
firebase login

echo "== 2/6: Create or reuse the Firebase dev project =="
if firebase projects:list --json 2>/dev/null | PROJECT_ID="$PROJECT_ID" node -e '
  const data = JSON.parse(require("fs").readFileSync(0, "utf8"));
  process.exit(data.result.some((p) => p.projectId === process.env.PROJECT_ID) ? 0 : 1);
'; then
  echo "  Project $PROJECT_ID already exists -- reusing it (not creating a second one)."
else
  echo "  Project $PROJECT_ID not found -- creating it now."
  firebase projects:create "$PROJECT_ID" --display-name "$DISPLAY_NAME"
fi

echo "== 3/6: Set it as the 'development' alias for this repo =="
if [ ! -f .firebaserc ]; then
  cp .firebaserc.example .firebaserc
fi
firebase use --add "$PROJECT_ID" --alias development

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
values printed above into:
  mobile/.env.local   (EXPO_PUBLIC_FIREBASE_*)
  admin/.env.local    (VITE_FIREBASE_*)
(see ENVIRONMENT.md "Wiring Firebase config into each app")

== Deferred (needs Blaze -- not done by this script) ==

storage.rules is intentionally NOT deployed here. As of Firebase's Oct
2024 policy, even enabling the default Cloud Storage bucket requires the
Blaze (pay-as-you-go) plan -- so this step is skipped until you decide to
attach billing. This does not block local development: Storage rule
*testing* already works with no real bucket and no Blaze plan at all (see
firebase-tests/README.md -- runs against a local emulator).

When you're ready to attach billing, do these in order:
  1. https://console.firebase.google.com/project/$PROJECT_ID/usage/details
     -> Modify plan -> Blaze.
  2. https://console.firebase.google.com/project/$PROJECT_ID/storage
     -> Get started (creates the default bucket -- no CLI command for this).
  3. firebase deploy --project $PROJECT_ID --only storage

Also out of scope for this script (unrelated to billing, not needed yet):
Apple/Phone sign-in providers (Console-only; Day 2 auth work) and Cloud
Functions (Blaze-gated; this script does not deploy functions).
EOF
