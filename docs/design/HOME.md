# Home, as built ("Scripture First")

The first screen of the app opens like a page of a Bible: the date, today's verse
set large in the serif, and one gold thread. Everything else follows in a calm
order, each piece one glance and one tap. This is the approved direction "A";
`HomeScreen` (`mobile/src/features/auth/HomeScreen.tsx`) composes the pieces below
and holds only their subscriptions.

## The order

| | Piece | Where | What it reads |
|---|---|---|---|
| 1 | Header: the mark, "Welcome, {name}", the church's name, **Updates** | `features/home/HomeHeader.tsx` | `settings/church` (name, optional logo), the signed-in member |
| 2 | Live bar (only while an event is live) | `features/home/LiveBar.tsx` | published events with `isLive` |
| 3 | **Verse of the Day** (the hero): date, gold label + "See all", hairline, verse, reference, Read chapter · Share · Copy | `features/daily-verses/DailyVerseCard.tsx` | `useVerseOfTheDay` (override → pool → bundled fallback) |
| 4 | Continue reading | `features/bible/reader/ContinueReading.tsx` | the member's saved reading position |
| 5 | Reading plan (the only progress line on Home) | `features/home/ReadingPlanRow.tsx` | the member's most recent plan progress |
| 6 | Prophet Verse, held to four lines with "Read more" | `features/prophet-verses/ProphetVerseCard.tsx` | `useProphetVerse` |
| 7 | Upcoming event, with "See all" | `features/home/UpcomingEventRow.tsx` | the next published event |
| 8 | **Together**: Prayer requests · Church chat · Photos and videos | `features/home/TogetherSection.tsx` | the newest three media posts, for thumbnails |

Margins are 20 each side; 32 between pieces (24 above the plan). The measured
rhythm of the built screen is asserted by `scripts/opening-fidelity/qa-home.mjs`.

## Real data, and what each state looks like

Nothing on Home is a sample. A piece with nothing to show either says so or is
not there, and the whitespace is drawn as margins **on the pieces themselves**, so
a missing piece leaves no hole behind it.

| | Nothing yet |
|---|---|
| Verse of the Day | Never empty: an override, else the pool, else a bundled verse. While loading, four grey lines in the verse's own shape. |
| Continue reading | Not there until the member has read something in the current translation. |
| Reading plan | One line, "Start a Reading Plan", which opens the plans list. No bar, no percentage. |
| Prophet Verse | Always there: the labelled block, in quiet ink, saying there is none today (a church that has not published one yet is every church on day one). |
| Upcoming event | Not there, and neither is its label. |
| Photos and videos | The row is still there and still opens the feed; it just shows no thumbnails. A video draws a play tile (its address is a clip, not a picture). |

## Decisions a reader might trip over

* **"Read chapter" opens the Bible at the verse's own chapter.** The resolver now
  says where a verse is (`VotdContent.location`); an administrator's override is
  typed text that cannot be taken apart into a book and chapter, so it has no
  place and offers Share and Copy only.
* **The header has one button.** Profile belongs to "You" in the new navigation;
  Updates opens what the church is saying. The five-tile feature grid is gone:
  Together says the same three things in words, and Plans is the plan row.
* **A verse on a photograph** is the one place the page becomes a card; see
  "Words over a photograph" in `DESIGN_SYSTEM.md`.
* **Retired:** `HomeMediaSection` (a sideways strip of thumbnails that opened a
  post directly). The approved design makes the thumbnails part of the one
  "Photos and videos" row; posts are opened from the feed.
* **Telugu** strings added for Home are drafts, listed in `TELUGU_REVIEW.md`.

## Looking at it

`node scripts/opening-fidelity/qa-home.mjs` bundles the real screen with its real
children, contexts and services against an in-memory Firestore, and shoots it in
light, dark, Telugu, a new member with nothing yet, a live service, a verse on a
photograph (and on a white one), a long Prophet Verse, both languages at once, and
the two small phones. It also measures the gaps. It is a look, not React Native:
text metrics and the native animation driver differ on a phone.
