# Maranatha brand imagery

**Status: waiting on one source file.** The Maranatha rename (M0) shipped
without it — every *textual* reference now says Maranatha, but the launcher
icon, the splash image and the adaptive-icon layers are still the V1
church-logo assets in `mobile/assets/`. They are the only V1 branding left
in the app, and they cannot be regenerated without the source.

## What to commit

```
mobile/assets/brand/maranatha-portrait.png
```

The black-and-white portrait supplied for the Maranatha identity.

| Requirement | Why |
|---|---|
| **≥ 1024 × 1024 px** | Play Store needs a 512×512 icon and Android's adaptive icon is authored at 1080×1080; anything smaller upscales and softens the face. |
| **PNG, no alpha** | The launcher icon must be fully opaque. A JPEG source is fine to start from — convert it once, here, rather than converting at build time. |
| Face roughly centred, with headroom | See the crop note below. |
| Unretouched otherwise | It is a photograph of a person; grading or sharpening it is not ours to do. |

A JPEG may be committed as `maranatha-portrait-source.jpg` alongside the
PNG if it is useful to keep the original bytes.

## What gets generated from it

Nothing is generated yet. Once the source lands, these are the derived
assets to produce **from that one file**, so they never drift apart:

| Asset | Size | Notes |
|---|---|---|
| `../icon.png` | 1024×1024 | Square. iOS and the Expo manifest's `icon`. |
| `../android-icon-foreground.png` | 1080×1080 | **Only the centre 66% is guaranteed visible** — Android masks the adaptive icon to a circle, squircle or rounded square depending on the launcher. The face must sit inside a 713×713 centre safe zone or the launcher will crop the chin and forehead. |
| `../android-icon-background.png` | 1080×1080 | Flat. Black or white per the identity — **not** the V1 `#273456` navy. |
| `../android-icon-monochrome.png` | 1080×1080 | Android 13+ themed icons. A single-channel silhouette; a photographic portrait does not reduce to one well, so this needs a deliberate decision (see below). |
| `../splash-icon.png` | ~1200 wide | Drawn at `imageWidth: 240` by the splash plugin. |
| `../favicon.png` | 48×48 | Admin/web. |

## The adaptive-icon constraint, stated plainly

At launcher size the icon renders around **48 dp** — roughly 4 mm. A
portrait photograph carries its meaning in fine detail (eyes, expression,
hair), and that detail is gone at that size; what survives is the overall
light/dark shape. Cropping tightly to the face keeps it recognisable at
the cost of looking cropped; framing loosely keeps the composition at the
cost of legibility.

The owner has decided the portrait **is** the identity and asked for a
careful crop rather than a substitute mark. So the crop should:

- fill the 66% safe zone with the head and shoulders,
- keep both eyes and the moustache inside the safe zone,
- sit on a flat black or white field so the mask edge looks intentional,
- and be checked **on a real launcher**, at small size, before release —
  not judged from a 1024px preview, where everything looks fine.

The monochrome layer is the one place a photograph genuinely cannot go.
Options, for the owner to pick: ship a high-contrast two-tone reduction of
the portrait, or use a simple `M` monogram for that layer only. Themed
icons are opt-in per launcher, so this affects a minority of devices.

## Where the portrait is used in-app

Also pending the source file:

- **Splash** — `app.json`'s `expo-splash-screen` plugin block still points
  at `splash-icon.png` on `#273456`. Both the image and the background
  colour should change together; changing only the colour would put the
  old church logo on a new background, which is worse than leaving it.
- **Sign In** — currently a letter monogram derived from the product name
  (`mobile/src/features/auth/SignInScreen.tsx`). The portrait could
  replace it.
- **Home** — the header already prefers the church's own `logoUrl` from
  Firestore settings and falls back to a monogram
  (`mobile/src/features/auth/HomeScreen.tsx`). That is church content, not
  product branding, and should keep working as it does.

Nothing in this list is blocked on code — only on the image.
