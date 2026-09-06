# Contributing

This is currently a solo project built with Claude as primary
developer/tech lead, but this file is written as if a second developer or
agency could pick it up cold — because per the project's own principles,
they should be able to.

## Code conventions

- **TypeScript strict mode everywhere.** All three packages
  (`mobile`, `admin`, `functions`) have `"strict": true`. Don't weaken it.
- **No Redux.** State is React Context (mobile) or Zustand (admin). See
  ARCHITECTURE.md for why, if tempted to reach for Redux.
- **ESLint + Prettier are the formatting authority.** Don't hand-format
  against them; run `npm run format` before committing.
- **No dynamic `process.env[...]` access in the mobile app** — Expo/Metro
  needs static `process.env.EXPO_PUBLIC_X` references to inline env vars at
  build time (enforced by `expo/no-dynamic-env-var` lint rule).
- **Comments explain _why_, not _what_,** especially for anything that looks
  like it could be simplified but can't be (see the rule-of-thumb: if you'd
  ask "why is this here?" in review, it needs a comment).

## Before every commit

Run the full check suite for whichever package(s) you touched:

```bash
cd <mobile|admin|functions>
npm run typecheck
npm run lint
npm test
```

For `admin`, also run `npm run build` (Vite build catches some type errors
`tsc --noEmit` alone can miss in edge cases). CI is not set up yet
(Day 1 didn't include it — see DEPLOYMENT.md for the plan) — these checks
are currently a manual discipline, not an automated gate.

## Commit style

Logical, scoped commits — not one giant commit per day. Prefix with the
affected area when it's not obvious from context:
`feat(mobile): ...`, `fix(admin): ...`, `chore: ...`, `docs: ...`. Explain
_why_ a change was made in the body when it isn't obvious, especially for
architecture decisions (see the Day 1 commit history for examples — several
commits explain a specific tradeoff or workaround in the body).

## Branching

Day 1 work landed directly on `main` (acceptable for solo, pre-launch,
foundation-only work with no deployed users yet). Once there's a deployed
staging environment people rely on, switch to feature branches + PRs even
for a solo developer — it gives you a review pass against your own past
decisions and a clean revert point.

## Secrets — non-negotiable

Never commit `.env`, `.env.local`, service account JSON files, or any file
matching the patterns in `.gitignore`'s secrets section. If you accidentally
commit one: **rotating the credential is mandatory** even after removing it
from history — assume anything pushed to a remote, even briefly, is
compromised. `git log --all -S "<credential fragment>"` to check if
something leaked historically.

## Adding a dependency

Ask first (of yourself, or of Claude): does the approved architecture spec
already assume this, or is there a concrete technical reason this specific
problem can't be solved with what's already installed? "It's popular" or
"I'm used to it" isn't sufficient justification per the project's own
non-negotiable principles (no unnecessary dependencies, no unjustified
architectural changes).

## Questions this file doesn't answer

Check FINAL_ARCHITECTURE_SPECIFICATION.md first (product scope, feature
list, timeline), then ARCHITECTURE.md (why the code is organized this way),
then SECURITY.md (what's enforced where). If none of those answer it, it's
probably a genuine open decision — write it down rather than guessing
silently.
