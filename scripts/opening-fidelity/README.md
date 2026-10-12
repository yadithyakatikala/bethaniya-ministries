# Opening animation fidelity

Proves that the app's opening and the onboarding chapter that continues it
(`mobile/src/features/opening/`) are the films the owner approved, and lets
the real onboarding screen be looked at in a browser. It is development
tooling: it is not part of the app, the app's tests, or CI, and nothing here
is bundled.

```sh
cd scripts/opening-fidelity
npm install          # playwright, esbuild, react-native-web (dev only)
# Playwright needs a Chromium; if yours is not installed:  npx playwright install chromium

# the opening
npm run numbers      # every number of 108 frames, app engine vs approved engine
npm run pixels       # the real OpeningCanvas vs the approved engine, 2x, light + dark
npm run golden       # regenerate the jest fixture (only if the approved film changes)

# the onboarding chapter (the story that follows the opening)
npm run chapter-numbers   # every number of 20 frames + the settled band, port vs prototype
npm run chapter-pixels    # the real ChapterCanvas and SchoolBand vs the prototype, 2x, light + dark
npm run chapter-golden    # regenerate the chapter's jest fixture (only if the prototype changes)

# the onboarding screen itself, in a browser (a look, not a proof -- see below)
npm run screen-qa         # chapter, five questions, Telugu, dark, small phones, keyboard, tablet
npm run design-qa         # the shared components, light / dark / Telugu (out/qa-shots/ds-*)
npm run home-qa           # the real Home screen: light, dark, Telugu, new member, live, photo ... (out/qa-shots/home-*)
python3 contact-sheets.py # joins the screenshots into one sheet per scenario
```

Output (screenshots, bundles) goes to `out/`, which is git-ignored.

## What is in here

| | |
|---|---|
| `reference/anim2.js` | The approved engine, **unmodified**. The harness appends a one-line debug export to a copy of it so its internal tables can be read. |
| `lib.mjs` | Builds the reference page (the approved engine + the bundled Noto Serif + the app's portrait), bundles the app's engine, and bundles the app's real `OpeningCanvas` for a browser through `react-native-web`. |
| `compare-numbers.mjs` | Opacities, positions, headings, ribbon paths and mote positions, frame by frame. Fails beyond the rounding the approved engine applies to the attributes it writes. |
| `compare-pixels.mjs` | Screenshots both, at 2×, and fails if the mean difference exceeds 0.5/255 or more than 0.05 % of pixels differ by over 64. |
| `capture-golden.mjs` | Rewrites `mobile/src/features/opening/__tests__/fixtures/openingGolden.json` from the approved engine. |

| `reference/onboarding-chapter.js` | The approved onboarding chapter prototype, **unmodified** (a copy of it with a debug export is what the harness runs). |
| `compare-chapter.mjs` | The chapter's frames and the settled band: every fish's position, heading, scale, opacity, rim and ribbon, plus the particle counts. |
| `compare-chapter-pixels.mjs` | The real `ChapterCanvas` and `SchoolBand` against the prototype's DOM, 13 chapter times and 4 sway times, light and dark. Same thresholds as the opening. |
| `capture-chapter-golden.mjs` | Rewrites `mobile/src/features/opening/__tests__/fixtures/chapterGolden.json`. |
| `qa-onboarding-screen.mjs` | Bundles the app's **real** `OnboardingScreen` (every component, the real chapter, band and theme) for Chromium through `react-native-web`, stubbing only what a browser cannot give it (the Firebase contexts, safe-area insets, AsyncStorage, the keyboard events, the font loader), and drives it on a fake clock that stops, so "the frame at 2.8 s" is exact. Writes screenshots to `out/onboarding-shots/`. |
| `qa-lib.mjs`, `qa-fakes.mjs` | The shared plumbing for the browser QA scripts: bundle any React Native entry for Chromium, with an in-memory Firestore, a fake Auth and stubs for the native modules (notifications, clipboard, audio, webview ...) so the app's REAL contexts, services and screens run against seeded data. |
| `qa-design-system.mjs` | The real shared components (`mobile/src/theme/ui`) in light, dark and Telugu, for comparison with the approved component sheets. |
| `qa-home.mjs` | The real `HomeScreen`, with its real children, contexts and services, against a seeded in-memory Firestore: light, dark, Telugu (and dark Telugu), a new member with nothing yet, a live service, a verse on a photograph and on a white one, a long Prophet Verse, both languages at once, and the two small phones. Measures the gaps between the pieces and the targets, and reports console errors. See `docs/design/HOME.md`. |
| `qa-shell.mjs` | The navigation shell: the real five-tab `TabBar` (gold ribbon, the member's monogram, Telugu labels) with the real Community Updates feed and shelf, the You hub (Saved and Profile), the Saved verses lists and the shared update detail, against a seeded in-memory Firestore, in light, dark and Telugu. Measures the bar and the avatar and reports console errors. See `docs/design/NAVIGATION.md`. |
| `contact-sheets.py`, `compare-approved.py` | Join the screenshots into sheets; put an approved still beside the built screen. |

The approved exported film itself is `docs/design/opening/maranatha-opening-approved.mp4`.

### What the screen QA is, and is not

It found real defects the unit tests could not (the form layer covering the
chapter's skip target, so a tap never reached it; a Telugu label set in a
Latin-only typeface), because it hit-tests and paints. It is **not** React
Native: `KeyboardAvoidingView`, the native animation driver, text metrics and
the soft keyboard itself all differ, and the keyboard is only simulated (the
form is padded by the keyboard's height; no keyboard is drawn). Frame rate and
keyboard behaviour still have to be judged on a phone.

## Last run

```
numbers          worst per-frame differences: fish 0.005 units / 0.014 deg, motes 0.10 (one-decimal rounding),
                 opacities 0.0005, particle tables identical, path length 810.784 vs 810.784
pixels           worst mean difference 0.156/255 (light), 0.152/255 (dark); 0.0003 % of pixels differ by > 64
chapter-numbers  worst: position 0.005 px, heading 0.005 deg, scale 0.00002, opacity 0.0004, rim 0.0005,
                 ribbon paths identical, ribbon opacity 0.0005
chapter-pixels   worst mean difference 0.156/255 (dark t=0.15); worst 0.0038 % of pixels differ by > 64
                 (the settled band at sway 30.5 s)
```
