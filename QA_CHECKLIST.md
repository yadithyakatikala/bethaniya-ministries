# Real Android Device QA Checklist

**No physical Android device or emulator has ever been available in any
development environment used for this project — nothing below has been
executed.** This is a checklist for the owner (or anyone with a real
Android device) to work through against the **release APK/AAB, running
against real production Firebase**, not a report of results. See
PRODUCTION_READINESS.md for what has actually been verified (unit/
component tests against mocks, static config checks, emulator-backed
rule tests) versus what only this checklist can verify.

**This checklist targets PRODUCTION, deliberately — not dev/emulator.**
Earlier checkpoints of this project tested against
`bethaniya-ministries-dev-58588` or the local Emulator Suite; the "FINAL
V1 RELEASE" checkpoint's whole point is verifying the actual release
artifact against the actual project real users will hit
(`bethaniyaministries-production`). Test data created here is real
production data — see item 0 below before creating anything.

## Prerequisites

- A **signed** release APK, built per DEPLOYMENT.md's "Local Android
  APK/AAB build" section (`./gradlew assembleRelease` after the
  one-time signing setup) — not a debug build, not Expo Go. Confirm
  before installing:
  - `mobile/.env.production` has `EXPO_PUBLIC_USE_FIREBASE_EMULATORS=false`
    and `EXPO_PUBLIC_FIREBASE_PROJECT_ID=bethaniyaministries-production`.
  - The APK was built from a shell where `mobile/.env.production` (not
    `.env.local`) was the active env file for the bundle step — see
    DEPLOYMENT.md's note on `NODE_ENV`/Expo's env-file cascade.
- **Bootstrap the first production Super Admin, once, before anything
  else below.** `createUserProfile()` always assigns a brand-new user
  `role: 'member'` on first sign-in, and `updateUserRole()` requires the
  *caller* to already be `super_admin` — so the very first production
  admin account cannot be created through the app itself. Sign in once
  through the mobile app (creates the `/users/{uid}` doc as `member`),
  then in the Firebase Console → Firestore Database →
  `bethaniyaministries-production` → `users/{that uid}`, manually edit
  `role` to `super_admin`. This is a one-time Console action (bypasses
  client-side `firestore.rules` the same way any Console edit does — it
  doesn't require Blaze, Cloud Functions, or any billing), needed once
  per environment, not once per test run.
- At least one additional real account per remaining role (host,
  content_admin, and a plain member) — create these normally through
  the app/admin's own sign-up and have the Super Admin promote them via
  the Users page from here on, exactly as a real deployment would.
- Real content in each collection worth testing against (at least one
  announcement, daily verse, song, event, community post, and a reading
  plan with at least 2 days) — create these through the admin dashboard
  as part of this checklist (see items 21-23), not seeded any other way.

## Checklist

Record PASS / FAIL / N/A and a note for each. A FAIL should reference the
exact screen, action, and what happened instead of what was expected.

### Launch

1. **Fresh install** — install the APK on a device with no prior app
   data; the launcher shows the real church-logo icon and the name
   **Maranatha** (M0 renamed the product; the icon itself is unchanged);
   splash screen shows the real logo, not a blank/default screen; app
   launches without crashing.
1a. **The build is not stale** — M6. The native `android/` project is
   generated and gitignored, and a plain `expo prebuild` REUSES an
   existing one rather than regenerating it, so a project generated
   before M0 ships the old name and icons no matter what `app.json`
   says. Build the APK under test with `npx expo prebuild --platform
   android --clean` (see DEPLOYMENT.md). If the launcher shows the old
   name, that is the reason — it is not a runtime or theme problem.
1b. **The icon ignores the system theme** — M6 BUG 3. Turn on the
   launcher's themed-icons setting (Pixel: long-press home → Wallpaper &
   style → Themed icons), then switch the PHONE between light and dark.
   The icon must stay the full-colour church logo in both. It used to
   become a faint tinted outline, because the app declared a monochrome
   icon layer; that layer is gone.
2. **First launch** — Telugu is the default Bible language with no
   stale state from a previous install (if this device ever had a dev/
   emulator build installed before, uninstall it first — Android won't
   let two builds with different signing keys coexist under the same
   package id anyway, so this is enforced, not optional).

### Auth

3. **Sign in** — Email/Password (create an account, then sign in) and Google (whichever provider is
   enabled on the connected Firebase project) completes and lands on
   Home, against real production Auth (confirm in Firebase Console →
   Authentication → Users that the sign-in actually created/matched a
   **production** user, not a dev-project one).
4. **Invalid login** — a wrong password / cancelled Google sheet / declined
   Google prompt shows a clear error, not a silent hang or crash.
5. **Sign out** — Settings → Log Out returns to the sign-in screen; a
   subsequent app relaunch does not silently re-authenticate.
6. **Session persistence** — force-close the app after signing in,
   reopen it; still signed in, lands on Home without re-prompting.

### Home

7. **Home loads** — church branding (real logo, church name from
   Settings), Daily Verse card, and Announcements render without a
   loading spinner stuck indefinitely.
8. **Continue your plan card** — after starting a reading plan (see
   item 15), Home shows a "Continue your plan" card with the correct
   day number; tapping it opens that exact day.
9. **Quick-links grid** — Bible/Reading Plans/Prayers/Community/Profile
   all navigate correctly; **the bottom tab bar is still
   Home/Bible/Songs/Events/More** (confirm nothing regressed here).

### Bible

10. **Books → Chapters → Reading** — navigation works for both English
    and Telugu; verse text renders correctly (correct script, no
    mojibake in Telugu); language toggle persists across app restart.
11. **Offline Bible** — enable Airplane Mode, navigate Bible books/
    chapters already visited and not-yet-visited (both languages are
    fully bundled, not fetched) — verse text still renders with no
    network error.

### Songs

12. **Songs** — list loads (existing functionality, unchanged this
    checkpoint), audio playback starts/pauses/seeks correctly,
    returning to the list after playback doesn't lose scroll position.

### Events

13. **Events** — list loads (existing functionality, unchanged this
    checkpoint); event detail shows correct date/description; YouTube
    Live link opens correctly when a live event is marked live.

### New V1 features (Reading Plans, Prayers, Community)

14. **Reading Plans library** — list of published plans loads with
    correct cover/title/category/day-count; tapping one opens its
    detail screen.
15. **Start / continue a plan** — "Start Plan" creates progress and
    opens Day 1; completing a day advances to the next day and marks it
    completed in the day list; re-opening the plan later shows
    "Continue • Day N" with the right N.
16. **Plan day reader** — scripture reference, devotional text, and
    (when set) the prayer prompt all render; "Mark Complete" is
    disabled once a day is already completed.
17. **Prayers** — add a prayer request, confirm it appears in the list
    immediately; mark it answered and confirm the label updates; delete
    one and confirm it disappears. Sign in as a **second** account and
    confirm it sees none of the first account's prayers (private per
    owner, no exceptions — verify this deliberately, not just assume).
18. **Community** — published posts list and open correctly (image and
    no-image posts both); an unpublished post created in admin does
    **not** appear in the mobile list.

### Other existing V1 features

19. **Announcements** — list and detail screens load; content matches
    what was entered in the admin dashboard.
20. **Notifications** — permission prompt appears once; Notification
    Center shows history entries created via admin; read/unread state
    updates on tap. **Do not expect a real push notification to arrive
    while the app is closed** — that requires a Blaze-deployed Cloud
    Function, not implemented (see PRODUCTION_READINESS.md).
21. **Profile** — display name edit and profile photo upload both save
    and persist across app restart.
22. **Settings** — language toggle, theme toggle, and notifications
    on/off all persist across app restart and sync to Firestore.
23. **Dark mode** — toggle in Settings, and confirm it also follows the
    OS-level dark mode setting when no explicit choice has been made;
    check contrast/readability on the Bible reader specifically
    (longest-text screen). The final UI/UX pass fixed a set of dark-mode
    contrast failures that a light-mode-only check would miss, so look
    specifically at: the label on every filled button (it must be dark
    ink on the sage/coral fills, not white), the LIVE badge on Home and
    Events, the church monogram, the More avatar initial, and the audio
    player's Play/Pause button. Also confirm the **status bar icons stay
    legible when the app's theme disagrees with the phone's** — set the
    phone to Light and the app to Dark, and back.
23a. **Screen transitions** — pushing into a detail screen should slide
    in; switching bottom tabs should not. Every pushed screen's header
    must be the themed surface colour, never white-on-dark.
23b. **First tap works** — with the keyboard open, ONE tap on Sign in,
    on Profile's Save, on a Bible search result, and on a prayer's
    Mark answered / Delete must act, not merely dismiss the keyboard.
23c. **Press feedback** — every tappable surface (Home quick links and
    live banner, More and Settings rows, Bible reader controls, audio
    transport, favourite toggle) must visibly dim while held.

### V1 tester-feedback fixes (verify these specifically)

23d. **Telugu actually changes the UI** — Settings → Language → Switch.
    Every screen's own text must change, not just the Bible: the bottom
    tab labels, Home's section headings, More's rows, Settings' own
    labels, the sign-in form, empty and error states. Then force-quit and
    reopen: the choice must persist.
23e. **Telugu Bible book names** — with Telugu selected, the Bible tab
    must list Telugu book names (ఆదికాండము, నిర్గమకాండము, …), the
    Old/New Testament headings must be Telugu, chapter text must be
    Telugu, and search must return Telugu verses. Switch back to English
    and confirm all four revert.
23f. **Home is not a navigation menu** — Home must have NO Songs, Bible,
    Events or Profile cards, and NO sign-out. It should show the header,
    verse of the day, announcements, the live banner when live, your
    reading plan, upcoming events, and only Plans/Prayers/Community as
    discovery.
23g. **Log out lives in Settings** — More → Settings → Log Out signs out
    and returns to the sign-in screen.
23h. **Bottom tab icons** — all five tabs show an icon above the label.
    The selected tab must be distinguishable by its filled icon and bold
    label, not colour alone. Check both light and dark mode.
23i. **Five reading plans** — More → Reading Plans lists exactly five.
    Open one, start it, mark a day complete, and confirm Home's "your
    reading plan" card then shows the right day.

### Round-2 tester feedback (verify these specifically)

23j. **Home header** — shows exactly two lines of text: "Welcome, <name>"
    and the church name. There must be NO third tagline line.
23k. **Home top-right** — two clearly visible icon buttons: a person
    (Profile) and a speech bubble (Announcements). Both must be plainly
    visible in light AND dark mode — the old build showed an almost
    invisible dot here. Tap each: Profile opens Profile, Announcements
    opens the announcements list.
23l. **No announcements block on Home** — the "ANNOUNCEMENTS / No
    announcements yet." section must be gone from Home's content. The
    feature still works via the header icon.
23m. **Reading-plan card** — with an active plan it shows the plan title,
    "Day X of Y", a filled progress bar, a percentage, and Continue;
    tapping it opens the current day. With no active plan it shows a
    compact "Start a Reading Plan" that opens the plans list, and NO
    progress bar or percentage anywhere.
23n. **Three icon tiles** — Prayers, Reading Plans and Community appear
    as compact square icon tiles, not long cards or list rows. No
    percentages or descriptions inside them.
23o. **DARK MODE, EVERY SCREEN** — this is the regression that shipped.
    With Dark selected, walk EVERY screen and confirm the HEADER BAR is
    dark, not white: Bible, Bible chapters, Bible reader, Bible search,
    Songs, Song detail, Events, Event detail, YouTube player, More,
    Profile, Settings, Notifications, Announcements, Reading Plans, Plan
    detail, Plan day, Prayers, Community, Community post, Daily Verse,
    Privacy Policy, Terms of Service. The white-header bug affected all
    of them at once.
23p. **Theme round-trip** — switch Light -> Dark -> Light in Settings
    without restarting; every open screen must follow immediately. Then
    force-quit and reopen: the last choice must still apply.
23q. **Device font** — the round-2 screenshots showed mangled letters
    ("Welcvme", "Cvmmunity"). The app sets no fontFamily, so it inherits
    the phone's system font; that device had a decorative font installed.
    Confirm on a phone with the default system font, and see the note in
    mobile/assets/fonts/README.md about bundling the intended faces.
23r. **Theme changes nothing but the interface** — M6 BUG 2. After the
    round-trip in 23p, check that NONE of these moved: the launcher name
    and icon (leave the app, look at the home screen), the Bible language
    selector, the app-language selector, your profile details, the Bible
    text itself. Theme is one preference and touches one thing.
23s. **Bible language sticks** — M6 BUG 1. Set Bible language to English,
    confirm the reader shows English, then force-quit and reopen: still
    English. Repeat for Telugu and for English + Telugu. Do this while
    SIGNED IN, on an account whose profile has no display name — that is
    the case that used to fail, silently, every time.
23t. **App language and Bible language are separate** — M6. Set the app
    language to Telugu and the Bible to English. The menus must be Telugu
    and the scripture English. Change one; the other must not move.
23u. **A newly published Prophet Verse arrives** — M6 BUG 4. With the app
    open on Home, publish or edit a Prophet Verse in the admin dashboard.
    Switch to another app, wait a few seconds, and come back. The new
    verse must appear without force-quitting the app.

### Admin (deployed admin website, tested separately from the APK)

24. **Admin login** — email/password sign-in succeeds against
    production Auth; a member-role account is correctly refused entry.
25. **Admin role restrictions** — sign in as content_admin/host/member
    in turn; confirm each sees only the actions their role allows (e.g.
    only super_admin can change another user's role) — both that a
    restricted action's UI is hidden/disabled AND that attempting it via
    a direct API/console call is rejected server-side (the security
    rules' RBAC, not just the UI).
26. **Content creation/edit/delete/publish** — create, edit, publish,
    and delete one item in each of: Announcements, Daily Verses, Songs,
    Events, **Community**, and a **Reading Plan with its days**; confirm
    each published change reflects in the mobile app within a
    reasonable refresh, and an unpublished one does not appear at all.
27. **Live stream publish/unpublish** — toggle an event's live status
    from admin; confirm the mobile app reflects "live" and then
    correctly reflects "not live" after unpublishing.
28. **Admin logout** — Log Out returns to the admin sign-in screen and a
    direct URL to a protected admin route redirects back to sign-in.

### Android-specific behavior

29. **Back button** — Android hardware/gesture back button navigates
    back through the stack correctly on every screen (Bible reader,
    plan day, prayer form, admin-adjacent screens); it never exits the
    app unexpectedly from a non-root screen, and it does exit cleanly
    from Home.
30. **Keyboard** — text inputs (sign-in, prayer composer, profile name,
    admin forms if tested on a tablet) don't get obscured by the
    on-screen keyboard; the keyboard dismisses appropriately on submit/
    tap-outside.
31. **Scrolling** — long lists (Bible chapters, plan days, prayers,
    community posts) scroll smoothly with no visible jank or clipped
    content at the top/bottom edges.
32. **Loading states** — every async screen shows a visible
    loading indicator, never a blank frozen screen, while its first
    Firestore snapshot is in flight.
33. **Error states** — trigger at least one real error (e.g. sign-in
    with a wrong password) and confirm a clear, readable error message
    appears, not a raw stack trace or silent failure.
34. **Slow network** — use Android's Developer Options network
    throttling (or a similar tool) to simulate a slow connection;
    confirm the app still becomes usable (loading states resolve
    eventually) rather than hanging indefinitely.
35. **Temporary network failure / recovery** — turn off Wi-Fi/data
    mid-session; confirm a clear error/retry state appears (not a
    silent hang or crash) for anything requiring a live connection, and
    that the app recovers cleanly (no stuck error banner) once
    connectivity returns.
36. **Screen transitions** — navigating between screens has no visible
    flash of unstyled content, no dropped frames severe enough to be
    obviously janky, and no leftover UI from the previous screen
    briefly visible.
37. **No clipped/overlapping UI** — check text and buttons near
    notches/status bars/gesture-navigation areas on whatever device is
    used; nothing is cut off or overlapping, especially on the Bible
    reader and admin-adjacent long-text screens.
38. **No obvious crashes** — across the entire session above, note any
    crash, ANR ("app not responding"), or forced-close, with the exact
    screen/action that triggered it.

## Reporting results

Do not mark any V1 requirement "verified on real device" without actually
completing this checklist on a physical device — a code review or
emulator-free static check is not a substitute (see the project's own
repeated ₹0/no-fabrication constraints in SECURITY.md and
PRODUCTION_READINESS.md). If only some items can be tested (e.g. no
Android device but an iOS one, or vice versa — though iOS is out of scope
for V1), record exactly which were and weren't, rather than a single
overall pass/fail. Every FAIL found here should be fixed, the relevant
automated test suite re-run, the APK rebuilt, and this checklist run
again on the rebuilt APK before calling V1 done — see PRODUCTION_READINESS.md's
"FINAL V1 DEFINITION OF DONE" section.
