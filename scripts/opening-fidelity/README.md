# Opening animation fidelity

Proves that the app's opening (`mobile/src/features/opening/`) is the film the
owner approved. It is development tooling: it is not part of the app, the app's
tests, or CI, and nothing here is bundled.

```sh
cd scripts/opening-fidelity
npm install          # playwright, esbuild, react-native-web (dev only)
# Playwright needs a Chromium; if yours is not installed:  npx playwright install chromium

npm run numbers      # every number of 108 frames, app engine vs approved engine
npm run pixels       # the real OpeningCanvas vs the approved engine, 2x, light + dark
npm run golden       # regenerate the jest fixture (only if the approved film changes)
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

The approved exported film itself is `docs/design/opening/maranatha-opening-approved.mp4`.

## Last run

```
numbers  worst per-frame differences: fish 0.005 units / 0.014 deg, motes 0.10 (one-decimal rounding),
         opacities 0.0005, particle tables identical, path length 810.784 vs 810.784
pixels   worst mean difference 0.156/255 (light), 0.152/255 (dark); 0.0003 % of pixels differ by > 64
```
