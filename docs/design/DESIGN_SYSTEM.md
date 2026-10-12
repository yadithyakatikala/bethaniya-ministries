# The Maranatha design system, as built

This is the approved design system (colour, type, spacing, marks and icons,
components) as it exists in `mobile/src/theme/`. The tokens and components are
the source of truth; this page says where things are and what the rules are, so
a screen can be built without re-deriving them. Every rule below is asserted by
a test in `mobile/src/theme/__tests__/` unless it says otherwise.

## The rules, in one place

* **Rows before cards. Pills for actions. Gold only as a thread.**
* Gold is brand: the fish, the metallic word, a hairline, a small mark, a
  reference, a text link. It is **never a fill, a background or an icon colour**
  (S2). A chosen thing is marked in **ink**, never in gold.
* Body text in gold is `accent` (#8F5A26 on paper, #DCA766 at night); the bright
  stops (`brandGold`) decorate and never carry words.
* No shadows, except the 45% backdrop behind a sheet or a dialog.
* Telugu labels can be twice as long as English: components **wrap and grow**,
  nothing is cut off. Nothing is solved by shrinking Telugu.
* Every target is at least 44; chips (36) and compact buttons (40) get a hit area.
* Selection and state are never colour alone: weight, a tick, an underline or a
  word says it too. An error is a sentence and an outline.

## Sizes (`layout` in `tokens.ts`, also `useTheme().layout`)

| | |
|---|---|
| Screen margin | 20 |
| Between sections / label to content / items in a group / tight pair | 32 / 12 / 16 / 8 |
| Card padding / empty-state padding | 16 / 24 |
| Rows | 64 for two lines, 56 for one; 12 above and below; a hairline between |
| Buttons | 48 (40 compact); text button 44; icon button 44 round; field 48 (96 multi-line); chip 36 (44 hit area); badge 24 |
| Radii | pill for actions and chips; 12 fields and thumbnails; 16 cards and media; 22 sheets and dialogs |
| Tab bar | 52 pt items, 8 above them, plus the bottom inset |

## Type (`typographyFor(language)`; the reader's own scale is unchanged)

`display` 32/38 · `headline` 26/32 · `title` 20/26 (serif for English, Hind Guntur
for Telugu) · `bodyLarge` 17/26 · `body` 15.5/23 · `bodySmall` 13.5/20 · `label`
14/18 (tabs, field labels, compact buttons) · **`button` 15/20** · `help` 13/18
(under a field) · `caption` **12.5/17 (Telugu 13.5/20)** · `overline` 11.5/15 ·
`scripture` 19/31 · `scriptureReference` 13/18 · **`wordmark` 19/24** (the Latin
word "Maranatha", Noto Serif in both languages).

The Home verse is `scriptureDisplayStyle(language, text)`: 28/40 up to 80
characters, 24/36 up to 160, 21/32 beyond; Telugu two points smaller with 12%
more leading. Church-written or member-typed text takes `contentFontFamily()`
(the approved script rule: one script takes its serif, mixed text takes Hind
Guntur).

## Components (`mobile/src/theme/ui/`, exported from `theme`)

| | |
|---|---|
| `AppButton` | Pill, four variants (primary ink · secondary 1.5 pt border · **text in gold ink** · destructive). `compact`, `trailingIcon`, `muted` (looks disabled, still presses and explains), `loading` (keeps its fill and its width, spinner on top, spoken name kept). One primary per screen. |
| `IconButton` | 44 round: `plain`, `outlined`, `tinted`. The accessibility label is **required**. |
| `Icon` | 49 glyphs on a 24 grid, 1.75 stroke, round caps: vector data (`iconShapes.ts`) drawn by react-native-svg, tinted in code. Decorative. |
| `Chip` | 36 pill; chosen = ink fill. |
| `SegmentedChoice` | Two or three views of one thing: a pill track with a surface thumb. More than three become chips (still a radiogroup). |
| `UnderlineTabs` | Sections inside a screen: ink word + 2 pt ink underline; no gold. |
| `ListRow`, `ListGroup` | The one row (64/56), one button whose spoken label joins title, value and subtitle; hairlines between. A destructive row has no chevron. |
| `Badge` | 24 high pill, tint fill; `live` is the one loud red, with a dot. `info` is retired (S8) and paints neutral. |
| `TextField` | Label above (14/18), 48 high, 12 radius, help/error 13/18; an optional Show / Hide action in words. |
| `Sheet`, `ConfirmDialog` | Sheet: 22 top radius, a 36×4 handle, 44 close. Dialog: Cancel then the action; the buttons stack, action on top, when a label is long. |
| `EmptyState`, `ErrorState`, `LoadingState`, `Skeleton`, `SkeletonRows`, `NoticeBanner` | Say what is missing, once; never invent content. Skeletons pulse only when motion is allowed. |
| `Avatar` | A monogram (26 to 96): the first letter **with its vowel signs** (`initialOf`). No photos anywhere. |
| `BrandFish` (`features/opening`) | The fish: gold gradient from 24 points up, flat gold ink below; or ink. |

## Where this differs from the design sheets, and why

* **Icons are vector shapes, not bundled PNGs.** The approved decision (S3) was
  small PNGs tinted in code, "with no new dependency". `react-native-svg` is
  already a dependency (the opening needs it), so the same forty-nine glyphs are
  drawn as vectors: still bundled, still tinted in code, no new dependency, and
  crisp at every size.
* **A compact button's visual height is 40**, as drawn, with a 44-point touch
  target (`hitSlop`).

## Looking at it

`scripts/opening-fidelity/qa-design-system.mjs` renders the real components in
Chromium (through react-native-web) in light, dark and Telugu, for comparison with
the approved sheets. It is a look, not React Native; see that folder's README.
