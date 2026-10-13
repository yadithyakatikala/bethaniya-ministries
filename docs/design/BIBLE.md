# The Bible tab, reading plans and the reader, as built

The **Bible** tab is **Read | Plans** under its title, with Search at the right. The
reader (`BibleChapter`) is still outside the tab bar -- a full-screen page that owns its
chrome.

## Read (`features/bible/BibleHomeScreen.tsx`)

* **Continue reading** first, when the member has read before: a thin gold bar, the place
  ("John 3") in the serif. It is an entry point, never a redirect.
* **Books**, with the Bible's language at the right as a small gold pill. The pill opens
  the **one sheet** where that is chosen -- Telugu, English or both -- the same choice the
  reader's language pill and Settings have, and the same preference.
* **Old | New Testament** as a two-part pill. It opens on the testament the member was
  last reading (the Old with nothing read yet); the book last read is **bold**, not gold.
* A book is a row: name, how many chapters, a chevron (`features/bible/BookRow.tsx`,
  shared with the reader's chapter picker). It opens the book's chapters
  (`ChaptersListScreen`: the chapter numbers as a grid of pills).
* Book names label scripture, so they follow the **Bible** language, not the interface's.
* A plain `ScrollView`, not a virtualised list: at most 39 rows, and every book is
  reliably present.

## Search (`features/bible/BibleSearchScreen.tsx`)

A back control and a field with the magnifier, "N results", then each hit as a gold
reference over its text with the matched word in bold. Unchanged in behaviour.

## Plans (`features/plans/`)

Plans moved into the Bible (decision N1): a reading plan is Bible reading. The old plans
list screen is gone; Home's plan row and You → Saved open `BibleBooks { tab: 'plans' }`.

* **`PlansView`** -- three chips: **My plans** (started, not finished; most recently read
  first), **Find plans** (not started) and **Completed**. A plan is *completed* when every
  one of its days is marked, not when `currentDay` has run past the end (`planGroups.ts`):
  `currentDay` advances when the *current* day is marked, so it can pass the length while
  an earlier day was skipped. A plan with no days can never be completed.
* A plan is a **text row with a gold thread** at the member's progress, or with a cover
  when the church attached one. A started plan says "Day 2 of 7 · 14%".
* **Language (Q6 a).** A plan follows the app language. A plan the church has not yet
  written in the member's language is still shown, in the language it has, and says so:
  "· English" in a Telugu app (`planIsEnglishInTeluguApp`, used by the list and the plan's
  own kicker).
* **`PlanDetailScreen`** -- the plan's title, a thread with "Day 2 of 7 · 14%", a strip of
  tiles (a tick for a day done, a heavy ink ring and "Next" on the current one), the
  current day's three steps -- **Read · Reflect · Pray** -- and **Continue · Day 2** in a
  bar at the foot. A plan not started shows its first sentence and every day, and **Start
  Plan**.
* **`PlanDayScreen`** -- the reference, the day's title, the Read step (which opens the
  Bible at the passage), the reflection by paragraph, the prayer prompt beside a thin gold
  line, and **Mark Complete** (or Completed, with a link to the next day). Marking the last
  day not yet done opens **Plan complete**.
* **`PlanDoneScreen`** -- the fish, a gold rule, "Plan complete", the thread full and
  "Day 7 of 7"; **Choose another plan** (to Bible › Plans) and **Done**.

**Not built:** the approved plan screens show an overflow (…) in the top bar. Nothing in
the design says what it holds, and the app has no restart or leave-a-plan feature, so it
is left out rather than shipped doing nothing.

## The reader (`features/bible/reader/`)

The Kindle-like immersive reader is kept: the page is full height, the chrome is overlays
that tap away, a tap on a **verse** opens its actions and a tap anywhere else toggles the
chrome, the place reached is remembered, and the **reading scale is unchanged** (sizes,
leading, measure, gaps, the 34-point number column).

### Chrome (`ReaderChrome.tsx`)

* **Top bar:** Back; **the place** ("John 3 ⌄", which opens the chapter picker); **the
  language** as a small code -- `EN`, `తె`, `EN + తె` -- with its own chevron, opening the
  Bible-language sheet; Search; and **Aa**, the reading settings. The place and the
  language are one pill with a hairline between; it shrinks and ellipsizes before
  anything beside it moves, so a long Telugu book name never pushes Search off the bar.
* **Previous and next chapter** are two round buttons floating at the foot, one at each
  thumb. A button with nowhere to go stays where it is in the muted ink and is announced as
  unavailable. The row takes no touches between the buttons.
* **The plan chip**, when the reading was opened from a plan day: "DAY 2 OF 7", the plan's
  title and **Mark Complete**, above the chapter buttons. It carries across chapters
  (`fromPlan` on the route) and goes with the chrome when the page is tapped. Once the day
  is marked it says Completed with a tick. For a plan not yet started, marking from here
  starts it first. A failed save says so in a notice and leaves the button to try again.
  Shown for a signed-in member only. Marking the last day not yet done replaces the reader
  with Plan complete.
* The chrome stays mounted while a screen reader runs: a double-tap lands on the verse
  under the finger, so hiding the controls would leave no way to bring them back.

### Notices

A confirmation ("Copied to the clipboard.") is the design system's **Toast**. A failure
(could not copy, share or save) is not a confirmation: it is a warning **NoticeBanner**,
in words and in the warning wash, floating where the toast would.

### Sheets

| Sheet | What it is |
|---|---|
| **Verse** | The reference as its title; **Highlight** with the four named colours (the one in force ringed in heavy ink) and a plain "Remove highlight" beneath when there is one; then four rows -- Bookmark, Add note, Share, Copy -- each an icon and its word. Signed out: one sentence and Share and Copy only. |
| **Reading settings** | Short, over a page that stays visible (a 16% scrim, because the page is the sample): **Text size** (a stepper round a small "Aa" and the size in points), **Line spacing**, **Page** (Light, Sepia, Dark, each drawn as a small page), and a **More settings** row that opens the sheet out to the typeface, the Bible's language and the column width -- and, on a tablet in bilingual mode, how the two languages sit. It opens short again next time. |
| **Chapter picker** | A fixed tall sheet in two panes: **books** (Old | New Testament, the books as rows) and **chapters** (Back, the book's name and "21 chapters", then a grid of pills five across; the one being read has a heavy ring and a tint). It opens on the book being read. |
| **Bible language** | One sheet -- the help sentence, then Telugu, English and "English + Telugu" with the current one ticked; a choice closes it. |

A chapter the Telugu Bible lacks (Malachi 4) says so, and its button -- **Switch
language** -- opens the same language sheet.

### Verse rows

Verse numbers, and the bookmark and note markers, are in **gold** (the gold *ink*, never a
fill). A bookmark is a solid ribbon (`bookmarkf`); a note is the page outline. The number's
line box is as tall as the verse's, so it sits on the first line, with Telugu's extra
leading. A highlight is a nearly square band running past the text column.

### The sepia page

A third reading page, for the reader only (decision B1). It is applied to the page and its
chrome through `ThemeScope` (`theme/ThemeScope.tsx`) and not to the sheets over it: a
`Modal` keeps the context of where it is written, so the sheets are rendered outside the
scope, in the app's own light or dark. On a dark app the status bar is asked for dark icons
while a sepia page is up.

* **Page** offers Light, Sepia and Dark. **Light and Dark are the app's own theme** -- one
  theme preference in the app, not two that can disagree -- and choosing either ends a sepia
  page. **Sepia is the reader's**, and is kept **on this phone only**
  (`reader_page_preference` in local storage). It is not a value of `themePreference`, and
  it is not in the synced `readingPrefs` document: `firestore.rules` validates both against
  closed sets, and a reading comfort is not worth a rules deployment.
* Choosing the page already in force does nothing, so a member whose app follows their
  phone's theme is not moved off "System" by tapping the card that already shows it.
* Palette (`theme/tokens.ts`, `sepiaTokens`): paper `#F2E8D5`, surface `#F8F0E0`, ink
  `#2E2418`, gold ink `#7A4A1C` (a step darker than on paper so verse numbers keep 4.5:1).
  Every text pair is run through `contrast.test.ts`, as for light and dark.

## Where this differs from the stills

* **"Continue · Day 2"** has a capital D (the app's `plans.day` is "Day"; the still's is
  lower-case).
* The sheet **title** is the app's `type.title`; its metrics are the design system's.
* The bilingual reading rows keep one tappable row per verse, with the English line over
  the Telugu, rather than the still's ruled pair rows.
* **Verse numbers** sit 4 points from their text, not 0: the column is only wide enough for
  "39-40", and a merged range must not touch the first word.
