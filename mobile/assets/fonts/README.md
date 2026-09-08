# Fonts needed for the Vespers typography

This directory is where the mobile app's bundled font files go, once
supplied. Nothing is loaded from here yet — `mobile/src/theme/fonts.ts`
documents the wiring but is intentionally inert (no `require()` calls to
files that don't exist yet) until these land, so the app keeps building
and running on the system font in the meantime.

All three are free, open-license (SIL Open Font License) Google Fonts —
the same families the admin web app already loads and the approved
visual prototype uses. Please add exactly these files, named exactly
this way (case-sensitive):

| File                          | Family           | Weight | Style  |
| ----------------------------- | ---------------- | ------ | ------ |
| `Newsreader-Regular.ttf`      | Newsreader       | 400    | normal |
| `Newsreader-Medium.ttf`       | Newsreader       | 500    | normal |
| `Newsreader-SemiBold.ttf`     | Newsreader       | 600    | normal |
| `Newsreader-Italic.ttf`       | Newsreader       | 400    | italic |
| `Archivo-Regular.ttf`         | Archivo          | 400    | normal |
| `Archivo-Medium.ttf`          | Archivo          | 500    | normal |
| `Archivo-SemiBold.ttf`        | Archivo          | 600    | normal |
| `Archivo-Bold.ttf`            | Archivo          | 700    | normal |
| `NotoSansTelugu-Regular.ttf`  | Noto Sans Telugu | 400    | normal |
| `NotoSansTelugu-SemiBold.ttf` | Noto Sans Telugu | 600    | normal |

These are the static weights the approved Vespers type scale actually
uses (see `mobile/src/theme/tokens.ts`'s `typography` export and the UI
audit's "Typography" section) — headings/scripture in Newsreader,
interface text in Archivo, Telugu content in Noto Sans Telugu.

Once the files are here, wiring them up is a small, contained change:
uncomment the `FONT_ASSETS` map and `useAppFonts()` hook in
`mobile/src/theme/fonts.ts`, add `expo-font` as an explicit dependency
(it's already pulled in transitively by `expo` itself, so this adds no
new capability or cost — just makes it directly importable), and gate
`App.tsx`'s render behind `useAppFonts()` the same way a splash-screen
loading gate normally works in Expo. No other file needs to change:
`typography` in `tokens.ts` already has `fontFamily` fields ready to
receive the real family names.
