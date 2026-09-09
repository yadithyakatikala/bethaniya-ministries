# Real Android Device QA Checklist

**No physical Android device or emulator has ever been available in any
development environment used for this project — nothing below has been
executed.** This is a checklist for the owner (or anyone with a real
Android device) to work through once a build is installed, not a report
of results. See PRODUCTION_READINESS.md for what has actually been
verified (unit/component tests against mocks, static config checks) versus
what requires this checklist.

## Prerequisites

- A built, installed APK on a real Android device or emulator — see
  DEPLOYMENT.md's "Local Android APK/AAB build" section for exact build
  commands (blocked in this project's own sandboxed development
  environment; buildable on a real machine with Android Studio).
- Either the local Firebase Emulator Suite running (`firebase
  emulators:start`, points at safe placeholder data) or `mobile/.env.local`
  filled in with the dev project's real config
  (`bethaniya-ministries-dev-58588`) — **do not test against
  `bethaniyaministries-production` with throwaway data.**
- At least one test user per role (member, host, content_admin,
  super_admin) — create these in the dev/emulator project, never in
  production.

## Checklist

Record PASS / FAIL / N/A and a note for each. A FAIL should reference the
exact screen, action, and what happened instead of what was expected.

1. **Fresh install** — install the APK on a device with no prior app data;
   app launches without crashing; first-launch language is Telugu (Bible
   default), no stale state from a previous install.
2. **Sign in** — Google, Apple, and/or Phone OTP (whichever provider is
   enabled on the connected Firebase project) completes and lands on Home.
3. **Sign out** — Settings → Log Out returns to the sign-in screen; a
   subsequent app relaunch does not silently re-authenticate.
4. **Home** — church branding, daily verse, and any home-feed content
   render without a loading spinner stuck indefinitely.
5. **Bible** — Books → Chapters → Chapter navigation works for both
   English and Telugu; verse text renders correctly (correct script,
   no mojibake in Telugu); language toggle persists across app restart.
6. **Bible offline** — enable Airplane Mode, navigate Bible books/chapters
   already visited (and not-yet-visited, since the WEB/Telugu datasets are
   fully bundled, not fetched) — verse text still renders with no network
   error.
7. **Songs** — list loads, audio playback starts/pauses/seeks correctly,
   returning to the list after playback doesn't lose scroll position.
8. **Events** — list loads; event detail shows correct date/description;
   YouTube Live link opens correctly when a live event is marked live.
9. **Announcements** — list and detail screens load; content matches what
   was entered in the admin dashboard.
10. **YouTube Live** — when a host marks live status "live" in admin, the
    mobile Home/Events live indicator updates (may require a pull-to-refresh
    or app relaunch — note which).
11. **Notifications** — permission prompt appears once; Notification
    Center shows history entries created via admin; read/unread state
    updates on tap. **Do not expect a real push notification to arrive
    while the app is closed** — that requires a Blaze-deployed Cloud
    Function, not implemented (see PRODUCTION_READINESS.md).
12. **Profile** — display name edit and profile photo upload both save
    and persist across app restart.
13. **Settings** — language toggle, theme toggle, and notifications
    on/off all persist across app restart and (when signed in) sync to
    Firestore.
14. **Dark mode** — toggle in Settings, and confirm it also follows the
    OS-level dark mode setting when no explicit choice has been made;
    check contrast/readability on the Bible reader and admin-adjacent
    screens specifically (longest-text screens).
15. **Admin login** (separate app/URL, not the mobile app) — email/password
    sign-in succeeds; a member-role account is correctly refused entry.
16. **Admin role restrictions** — sign in as content_admin/host/member in
    turn; confirm each sees only the actions their role allows (e.g. only
    super_admin can change another user's role) — both that a restricted
    action's UI is hidden/disabled AND that attempting it via a direct
    API/console call is rejected server-side (the security rules'
    RBAC, not just the UI).
17. **Content creation/edit/delete** — create, edit, and delete an
    announcement/daily verse/song/event from admin; confirm each change
    reflects in the mobile app within a reasonable refresh.
18. **Live stream publish/unpublish** — toggle an event's live status from
    admin; confirm the mobile app reflects "live" and then correctly
    reflects "not live" after unpublishing.
19. **Logout** (admin) — Log Out returns to the admin sign-in screen and a
    direct URL to a protected admin route redirects back to sign-in.
20. **Network loss/recovery** — turn off Wi-Fi/data mid-session on both
    apps; confirm a clear error/retry state appears (not a silent hang or
    crash) for anything requiring a live connection, and that the app
    recovers cleanly (no stuck error banner) once connectivity returns.

## Reporting results

Do not mark any V1 requirement "verified on real device" without actually
completing this checklist on a physical device — a code review or
emulator-free static check is not a substitute (see the project's own
repeated ₹0/no-fabrication constraints in SECURITY.md and
PRODUCTION_READINESS.md). If only some items can be tested (e.g. no
Android device but an iOS one, or vice versa — though iOS is out of scope
for V1), record exactly which were and weren't, rather than a single
overall pass/fail.
