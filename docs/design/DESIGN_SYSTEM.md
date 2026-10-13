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
(under a field) · `caption` **12.5/17 (Telugu 13.5/20)** · `overline` **11.5/15
(Telugu 12.5, no capitals, almost no tracking: it has none to shout in, and wide
tracking pulls a conjunct apart)** ·
`scripture` 19/31 · `scriptureReference` 13/18 · **`wordmark` 19/24** (the Latin
word "Maranatha", Noto Serif in both languages).

The Home verse is `scriptureDisplayStyle(language, text)`: 28/40 up to 80
characters, 24/36 up to 160, 21/32 beyond; Telugu two points smaller with 12%
more leading. Church-written or member-typed text takes `contentFontFamily()`
(the approved script rule: one script takes its serif, mixed text takes Hind
Guntur). A verse shown in both languages is `scriptureBilingualStyle`: English
22/33, the Telugu beneath at 19/34 in quieter ink, two nodes.

## Components (`mobile/src/theme/ui/`, exported from `theme`)

| | |
|---|---|
| `AppButton` | Pill, five variants (primary ink · secondary 1.5 pt border · **text in gold ink** · destructive · **live**, the live-broadcast fill, only for the way into a stream that is on now). `compact`, `leadingIcon`, `trailingIcon`, `muted` (looks disabled, still presses and explains), `loading` (keeps its fill and its width, spinner on top, spoken name kept). One primary per screen. |
| `IconButton` | 44 round: `plain`, `outlined`, `tinted`. The accessibility label is **required**. |
| `Icon` | 50 glyphs on a 24 grid, 1.75 stroke, round caps: vector data (`iconShapes.ts`) drawn by react-native-svg, tinted in code. Decorative. `filled` is the selected look: stroke 2 and a 14% wash of its own colour inside every shape (a solid glyph stays solid). `heartf` is solid: a chosen favourite, never gold. `bookmarkf` is the solid ribbon a bookmarked verse wears in the gutter (drawn in gold ink, as the verse number is). |
| `Chip` | 36 pill; chosen = ink fill. `icon` puts an 18-point glyph before the words and `tall` makes it a full 44, for a chip that is a door (Community's shelf) rather than a filter. |
| `SegmentedChoice` | Two or three views of one thing: a pill track with a surface thumb. More than three become chips (still a radiogroup). |
| `UnderlineTabs` | Sections inside a screen: ink word + 2 pt ink underline; no gold. The tabs sit left to right at their own width, 24 apart, over one full-width hairline; each is at least 44 across and high. |
| `ListRow`, `ListGroup` | The one row (64/56), one button whose spoken label joins title, value and subtitle; hairlines between. A destructive row has no chevron. |
| `Badge` | 24 high pill, tint fill; `live` is the one loud red, with a dot. `info` is retired (S8) and paints neutral. |
| `TextField` | Label above (14/18), 48 high, 12 radius, help/error 13/18; an optional Show / Hide action in words. `error` outlines the field and says why under it; `invalid` outlines and announces it with **no** sentence of its own, for a screen whose sentence is a notice elsewhere (sign-in). |
| `Sheet`, `ChoiceSheet`, `ConfirmDialog` | Sheet: 22 top radius, a 36×4 handle, 44 close; `tall` fixes it at nine tenths of the screen (a sheet whose content changes under it), `scrim="light"` dims the page behind it 16% rather than 45% (a sheet that changes that page). `ChoiceSheet`: one setting's help sentence and a row per choice, the current one ticked, a choice closes it. Dialog: Cancel then the action; the buttons stack, action on top, when a label is long. |
| `EmptyState`, `ErrorState`, `LoadingState`, `Skeleton`, `SkeletonRows` | Say what is missing, once; never invent content. Skeletons pulse only when motion is allowed. |
| `NoticeBanner` | A notice that stays: a 20-point **mark** (an "i" for information, a triangle for a warning or an error), an optional semibold title and one sentence at 13.5/20, in a 12-radius box with no outline, and optionally one action. Three tones -- neutral (raised ground, page ink), warning and danger (the tone's colour on its tint, which clears 4.5:1 in both palettes). Announced politely. `messageTestID` names the sentence. |
| `SectionHeader` | A tracked overline over a group, muted or `tone="gold"` (the one brand label on a screen), with an optional "See all": a text link flush to the right margin in gold ink, a **real 44-high row** whose spoken name carries the section ("See all, Upcoming events"). `tone="photo"` is white, for a label over a photograph. |
| `GoldRule`, `GoldBar`, `GoldFill`, `GoldRibbon`, `GoldThread` | The places gold is drawn as a **line** (`GoldThread` is the loading screen's 132 × 2 line under the portrait, fading at both ends): the 24 × 4 ribbon that hangs from the tab bar over the selected tab, and a hairline that fades out to the right, a vertical bar (3 across; a Prophet Verse's is 2) beside a quoted block or a reading position, and the filled part of a 3-point progress line. The real five-stop metal as an SVG gradient; decorative. `GoldRule tone="photo"` takes the night metal whatever the theme. |
| `Avatar` | A monogram (26 to 96): the first letter **with its vowel signs** (`initialOf`). No photos anywhere. |
| `Toast`, `useToast` | A confirmation: a primary pill with a tick and a few words, floated above the content, taking no touches, announced politely, gone after 3.2 s. A failure is a `NoticeBanner`, never a toast. |
| `FloatingAction` | The one floating action on a screen: a primary pill with a glyph and a word, 20 from the right and 18 above the bottom; disabled paints the disabled pill and stays announced. |
| `ScreenTitle` | A top-level screen's own title: the headline (26/32) as a heading in a row at least 56 high, with room at the right for icon buttons. |
| `TopBar` (`features/common`) | The bar of a pushed screen: a 44-point round Back or Close, a centred title, room for one action. Drawn by the app so every pushed screen has the same bar. |
| `BrandFish` (`features/opening`) | The fish: gold gradient from 24 points up, flat gold ink below; or ink. |
| `BrandPortrait` (`features/common`) | The round portrait the opening ends on, as a mark: 96 on the loading screen, 72 and 44 on sign-in. A circle at any size; decorative (hidden from a screen reader); never placed beside words that do not belong to the person pictured. |

## The reader's sepia page (`ThemeScope`, `sepiaTokens`)

`useTheme()` answers for the app's light or dark. Wrapping a subtree in
`<ThemeScope palette="sepia">` sets it in the reader's third page instead -- colours,
verse highlights and gold, and `isDark` false -- with no component knowing; `palette={null}`
puts a subtree back in the app's own. The reader uses the pair so that its page and
chrome are sepia while its sheets (a `Modal` keeps the context of where it is written)
are not. The palette is `sepiaTokens` -- the light palette with the paper, ink, gold ink
and tints warmed, the five status hues unchanged -- and every text pair is in
`contrast.test.ts`. See `BIBLE.md` for what chooses it and where it is kept.

## Words over a photograph (`onPhoto`)

A church can attach a picture to a Verse of the Day. The picture is anyone's --
it can be white -- so the words on it sit under a dark veil (`onPhoto.veil`) that
holds **white** text above 4.5:1 even over a pure white photograph, and gold stays
out of it except as the hairline: gold small text cannot be guaranteed over a
picture. `onPhoto.base` is what shows if the picture never loads, so white words
are never left on a white page. Asserted in `contrast.test.ts`.

## Where this differs from the design sheets, and why

* **Icons are vector shapes, not bundled PNGs.** The approved decision (S3) was
  small PNGs tinted in code, "with no new dependency". `react-native-svg` is
  already a dependency (the opening needs it), so the same fifty glyphs are
  drawn as vectors: still bundled, still tinted in code, no new dependency, and
  crisp at every size.
* **A compact button's visual height is 40**, as drawn, with a 44-point touch
  target (`hitSlop`).
* **Row icons are ink, not gold.** The Home still draws the Together icons in
  gold; the written rule (S2: gold is never an icon colour) wins, so they are ink
  in a hairline circle, like every other row icon.
* **"See all" is 14/18 (`label`), and a 44-high row**, where the still shows 13.5
  at the label's own height: a 15-point-high link is not a target. The section
  above it takes the 14 points out of its margin so the gap still reads as 32.
* **A verse on a photograph is a 22-radius card with a 60% veil**, where the
  prototype used 28 and 42%: 22 is the system's largest radius, and 60% is what
  keeps white text readable on any picture (see above).

## Looking at it

`scripts/opening-fidelity/qa-design-system.mjs` renders the real components in
Chromium (through react-native-web) in light, dark and Telugu, for comparison with
the approved sheets; `qa-home.mjs` does the same for the real Home screen (see
`HOME.md`). They are a look, not React Native; see that folder's README.
