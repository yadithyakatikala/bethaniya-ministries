# Maranatha brand imagery

**Status: delivered.** Every launcher, splash and icon asset is derived
from one source photograph by `scripts/generate-brand-assets.py`.

## The source

```
maranatha-portrait-source.jpg
  sha256 7607cbbd5d2cb2a928de5b505a59ebb934f96dcb470cfc357ff40d95f594ee54
  1136 × 1385, JPEG, black-and-white studio portrait
```

These are the **exact bytes the owner uploaded** (originally committed to
the repository root as `WhatsApp Image 2026-09-17 at 16.36.02.jpeg` and
moved here with `git mv`, so the content is bit-identical). The generator
asserts that hash on every run and refuses to proceed if it changes, so
the identity cannot drift without somebody deliberately updating the
expected hash.

The JPEG is the only copy kept. A lossless PNG of the same photograph was
generated at first and then dropped: it weighed 561 KB beside a 96 KB
source, React Native loads JPEG perfectly well, and nothing referenced it.

**The photograph is never retouched** — no grading, no sharpening, no
skin work. Every derived asset is a crop, a resize, an alpha mask, or (for
the Android monochrome layer alone) a documented threshold.

## Regenerating

```sh
python3 scripts/generate-brand-assets.py          # write the assets
python3 scripts/generate-brand-assets.py --check  # verify presence only
```

Needs Pillow. Idempotent: same source in, same bytes out.

## What is generated

| Asset | Size | Treatment |
|---|---|---|
| `../icon.png` | 1024² | Full-bleed square, head and shoulders, opaque. iOS + the Expo manifest. |
| `../android-icon-foreground.png` | 1080² | **Circular** portrait, 713px across, centred, on transparency. |
| `../android-icon-background.png` | 1080² | Flat black. |
| `../android-icon-monochrome.png` | 1080² | High-contrast reduction, as alpha, for Android 13+ themed icons. |
| `../splash-icon.png` | 720² | Circular portrait on transparency; drawn at `imageWidth: 240`. |
| `maranatha-portrait-crop-512.jpg` | 512² | The same circular crop as the splash icon, kept square and opaque (≈50 KB). The opening animation clips it to a circle itself. |
| `splash-blank.png` | 288² | Fully transparent. The native splash screen shows only a ground colour; see **Splash**. |
| `../favicon.png` | 48² | The Expo web target. |
| `../../../admin/public/favicon.png` | 64² | The admin dashboard's browser tab. Replaces the generic purple Vite starter mark, which was neither Maranatha nor black-and-white. |

## Why the Android foreground is a circle

An adaptive icon is authored at 1080×1080, but launchers mask it to a
circle, squircle or rounded square and **only the centre 66% — a 713×713
region — is guaranteed visible**. A rectangular photo crop pasted into
that canvas reads as a grey square with a face in it once masked, and
risks the mask cutting the chin or forehead.

So the foreground is a circular portrait exactly 713px across. Under a
circular mask it fills the icon edge to edge; under a squircle or rounded
square it sits as a deliberate disc on the flat black background. Either
way the face is never clipped.

Verified by compositing the two layers and applying all three mask shapes,
then rendering at 48px — roughly launcher size on a phone. The face stays
recognisable at that size, which was the whole test.

## Geometry, measured rather than guessed

Read off the source by sampling luminance against the per-column studio
backdrop:

| | |
|---|---|
| head spans | x 257–894 (width 637, centred on x = 575) |
| hair top | y 145 |
| neck shadow | y ≈ 988 — so the head box is ≈ 637 × 815 |
| backdrop | L 121–136 (slight left-to-right gradient) |
| face | L 169–205 — **brighter** than the backdrop |
| hair / eyes | L 94–109 — **darker** than the backdrop |

The circular crop is a 905px square centred on the head, so the 815px-tall
head fills ~90% of the circle's diameter: any tighter clips the hair, any
looser and the face is too small to read at launcher size.

## The monochrome layer, and its honest limit

That last pair of measurements is why this layer needed care. The backdrop
sits *between* the face and the hair in luminance, so thresholding on
darkness alone turns part of the backdrop into ink. The generator instead
inks "differs from the backdrop by more than 26", which captures the
bright face **and** the dark hair while leaving the backdrop clear. Eyes,
brows and the moustache shadow fall close to the backdrop's own value and
so read as gaps in the tinted shape — which is what makes it legible as a
face rather than a blob.

**It degrades at launcher size.** Tinted at full resolution it reads as a
clean stencil portrait; at 48px it becomes a noisy head-shaped mass. This
is inherent: a photograph does not reduce to a single colour. Thresholds
of 22, 26 and 32 were rendered at 48, 72 and 144px and compared; all three
behave similarly and 26 keeps the most hair detail without speckling the
jaw.

Android 13+ themed icons are **opt-in per launcher**, so this affects a
minority of devices, and the normal (non-themed) icon is unaffected. If
the owner would rather have something that stays crisp at any size, an `M`
monogram for this one layer is the alternative — it would not change any
other asset.

## Splash

The native splash screen is **a plain ground colour**: `#FAFAF8` in light
mode and `#0E0F11` in dark, the app's own paper. It carries a fully
transparent image (`splash-blank.png`) because the plugin requires one.

The portrait is deliberately *not* on it. The opening animation
(`mobile/src/features/opening/`) is the app's first moment, and it begins
by fading the portrait in over that same ground. A portrait baked into the
native splash would sit at a different size and place than the animation's,
and the two would jump when they met. `App.tsx` keeps the native splash up
until the animation has painted its own first frame on the same ground, so
the swap is invisible.

`splash-icon.png` is still generated (it is the approved portrait at 720²
and the reference the animation was designed against) but nothing in
`app.json` points at it any more. The V1 navy `#273456`, which belonged to
the previous church logo, is gone from the project.

## The opening animation's assets

| What | Where | Notes |
|---|---|---|
| Portrait | `maranatha-portrait-crop-512.jpg` | Generated from the source by `scripts/generate-brand-assets.py`. Never retouched. |
| MARANATHA wordmark | `mobile/src/features/opening/engine/wordmarkGlyphs.ts` | Glyph outlines of the bundled Noto Serif SemiBold, generated by `scripts/generate-wordmark-glyphs.py`. Vector data, so the animation does not wait for fonts. |
| The fish | `mobile/src/features/opening/engine/constants.ts` (`FISH_*_STEPS`) | Two Bézier arcs, nose toward +x, drawn at 0.58 scale. **There is no separate fish image file:** the approved film defined the fish as this outline, and the app uses exactly those coordinates. |
| The approved film | `docs/design/opening/maranatha-opening-approved.mp4` | Reference only; not bundled in the app. |

## Where the portrait is *not* used

- **Home's header** still prefers the church's own `logoUrl` from
  Firestore settings and falls back to a letter monogram. That is church
  content, not product branding, and is deliberately left alone.
- **Sign In** does not show the portrait yet. The approved redesign puts the
  portrait and wordmark there, in the positions the onboarding chapter
  begins from, so the chapter continues the same picture; until the sign-in
  screen is restyled, the chapter's first frame (portrait over the word)
  simply appears when the first question screen mounts.
