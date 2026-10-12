# Navigation, as built ("Shape A")

Five tabs -- **Home · Bible · Prayers · Community · You** -- each one destination
with its views inside it. This is the approved "Shape A"; the old fifth tab,
**More**, is retired because everything on it now has a home.

The structure lives in `mobile/src/navigation/` (`AppNavigator.tsx`,
`TabBar.tsx`, `useRouteTab.ts`); the screens it opens are listed below.

## The bar

`TabBar.tsx` is a hand-rolled bar (an explicit decision to add no navigation
dependency) shown only while the current route is one of the five.

* **Selected is marked three ways, never by colour alone**: a 24 × 4 **gold
  ribbon** hangs from the bar's top edge over the tab, its glyph takes a heavier
  stroke (2) and a 14% wash of its own colour (`Icon filled`), and its label goes
  bold. Gold stays a thin line -- it is the ribbon, never a fill behind the tab.
* **You is the member**: a 24-point circle with their initial (its vowel signs
  kept, in the serif of its script). Selected, the circle fills. With no name to
  take an initial from it falls back to the person glyph, never a "?". No photos
  anywhere (decision H6).
* Labels are 11.5/14 (Telugu 12.5/16), one line each, so no tab is taller than
  the rest. Each tab is 52 high, 76 across on a 390 phone, plus the bottom inset.
* A tablist of tabs, each with a selected state, so TalkBack says "tab 3 of 5".

**Switching tabs pops, not pushes.** `navigate(route, undefined, { pop: true })`
goes back to a tab already below in the stack instead of stacking a second copy;
Home, Bible, Home, Bible would otherwise be four screens deep with Back replaying
them.

## The five, and what is inside

| Tab | Route | Views | Notes |
|---|---|---|---|
| Home | `Home` | -- | See `HOME.md`. |
| Bible | `BibleBooks` | **Read** (the books) · **Plans** | See `BIBLE.md`. The immersive reader (`BibleChapter`) keeps its full-screen page and is still outside the bar. |
| Prayers | `PrayersHub` | **Requests** (the church's wall) · **My journal** (private) | One feature, not two tiles. |
| Community | `CommunityHub` | **Updates** (announcements and church posts as one feed, with a shelf to Events · Songs · Photos and videos) · **Chat** | |
| You | `You` | **Saved** · **Profile**, with the bell (Notifications) and the sliders (Settings) beside the member's name | |

A hub chooses its inner view from the route's `tab` param (`useRouteTab`): Saved's
"Prayer journal" row opens `PrayersHub { tab: 'journal' }`; Home's "Church chat"
row opens `CommunityHub { tab: 'chat' }`; a notification can open `You { tab:
'profile' }`. A tap changes the view; a later navigation with a *different* `tab`
moves a hub that is already open; a navigation with *no* `tab` keeps the member's
own choice. The change is made while rendering, so the old view is never painted
for a frame.

## Where everything went

| Before | Now |
|---|---|
| More tab | retired |
| Profile screen | You → **Profile** tab |
| Settings, Notifications | the sliders and the bell on **You** |
| Announcements list + Community list | Community → **Updates** (one feed, each item labelled) |
| Church chat | Community → **Chat** |
| Prayer wall | Prayers → **Requests** |
| Prayers (journal) | Prayers → **My journal** |
| Songs, Events (they were tabs) | pushed from Community's **shelf**; Home opens Events directly |
| Photos and videos | Community's shelf, Home's Together row; saved ones under You → Saved |
| Reading plans (a screen of their own) | Bible → **Plans**; Home's plan row and You → Saved open it there |

## Pushed screens and the app's own top bar

Screens that are not tabs are pushed and hide the bar. The redesigned ones draw
their own `TopBar` (`features/common/TopBar.tsx`: a 44-point round Back or Close,
a centred title, room for one action) with the platform header off, so every
screen has the same bar in both themes and both languages. Not-yet-redesigned
screens keep the themed native header until they are rebuilt.

Songs, Events (a list, an event, and the live player) are pushed from Community's
shelf and are redesigned the same way; see `COMMUNITY.md`. The tab bar steps out of
the way while the keyboard is up (`navigation/useKeyboardVisible.ts`), as the design
shows for the chat's message box.

`AnnouncementDetail` and `CommunityPostDetail` are **one screen**
(`features/updates/UpdateDetail.tsx`) labelled for what it is; `SavedVerses`
(`features/you/SavedVersesScreen.tsx`) lists notes, highlights or bookmarks, each
row opening the reader at that verse.

## Notifications

`notificationNavigation.ts` resolves a notification's `data.screen`. The five tab
routes are accepted, and the retired name **`Profile`** still works -- a
notification already delivered, or sent by an unchanged church tool, lands on
**You → Profile** rather than nowhere. No other retired name was ever accepted, so
none is carried over.

## Where this differs from the stills

* **Prayers, Community and You are tabs of the app's own `Stack`**, not a
  `bottom-tabs` navigator, so a tab's inner state (a scrolled list, a typed
  draft) is not kept when the member switches away. They reload from Firestore's
  local cache.
* **The detail kicker reads "Friday, 9 October"** (with the comma Home's date line
  uses), where the still's sample text has none.
