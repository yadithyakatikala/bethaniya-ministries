# Prayers, as built

One tab, two views, under the title **Prayers**: **Requests** (the church's wall)
and **My journal** (private to the member). They used to be two tiles and then two
entries on More, and a tester reported them as one feature listed twice.

`PrayersHubScreen` (`features/prayers/`) owns the tabs and hands the title and the
tabs to the view as the **header of its list**, so they scroll away with it as
designed and are drawn in every state (loading, error, empty).

## Requests (`features/prayer-wall/PrayerWallScreen.tsx`)

A request is a hairline **row**, not a card (`PrayerRequestRow`):

* who and when on one line (the name bold, the date quiet, "9 Oct");
* the subject (17/24 semibold) and the words (16/24), in the interface face;
* the badges -- **Praying** or **Answered** (success tint with a tick) and the
  category, both neutral (a category is not a status) -- with **Report** as a plain
  word at the right edge, 44 high;
* **your own** carries a thin gold thread down its left edge, "Your request" in gold
  ink, and its three actions as words -- Edit, Mark answered (or "Still praying"),
  Delete in the error colour -- each 44 high;
* a removed request is a **tombstone** (a quiet raised box), not a gap.

Above the list: the **All | Yours** chips. "Yours" is built on the member's own index
(`users/{uid}/prayerRequests`): it shows their requests among those loaded and, when
chosen, reads further pages until every request in the index has turned up (or the wall
ends, or ten pages have been read), showing a skeleton -- never a false "You have not
asked for prayer yet" -- while it looks.

**Ask for prayer** floats over the list (disabled, with the suspended notice saying why,
for a member whose posting is paused). Where a state carries its own button (an empty
wall, or "Yours" with none) the floating one is not drawn, and where there is nothing yet
to add to (loading, error) there is none. A new request confirms with a toast, "Your
request was shared". Deleting asks first, in the app's own dialog.

The wall is **paginated and pulled, not subscribed** (a listener over a collection that
only grows costs a read for every change): pages of 15, pull to refresh, "Loading more…"
as plain words under the list.

### The sheet (`PrayerRequestForm`)

Subject, Details, the Category as a wrap of chips (No category and the six), **Post
anonymously** with the switch in a 48-high row and the privacy sentence under it, then
**Share request**. A failed send keeps every word. An **edit** never offers the switch:
it says, with a lock, that whether the request shows the member's name cannot be changed.

### Anonymity, which every part of this protects

An anonymous request carries **no identity at all** (`prayerRequests.ts`; `firestore.rules`
refuses a write that does). The row renders the word "Anonymous" and nothing else, and its
tests sweep the whole rendered tree -- text, test ids, accessibility labels -- for the
author. The sentence under the switch states exactly who can and cannot see a name: other
members and the church team cannot; the church's main administrator can look it up, only to
deal with a report.

### Reporting (`features/moderation/ReportSheet.tsx`)

One sheet for a request, a chat message, a media post and a comment. **No reason is
assumed**: the seven reasons are a wrap of chips with none chosen and **Send report** waits
for one (it used to open on "Spam or advertising", so tapping straight through reported a
testimony as an advertisement). The report names the content and never its author. A failure
keeps the reason and the words; success replaces the form with "Thank you".

## My journal (`features/prayers/PrayersScreen.tsx`)

"Only you can see this", then entries as hairline rows: the words (16.5/25), the date, a
tick and "Answered" if it was, and two actions as words (Mark answered / Mark unanswered,
Delete). **New entry** floats over the list -- and over the empty page, where it is how the
first entry is added -- and opens a **full-screen writing page** (`NewJournalEntry`): a Close
at the top, the privacy line, an open space to write in (18/28, the keyboard open at once),
and one **Add Prayer** button fixed at the foot above the keyboard. What was typed survives
a failure to save. Adding confirms with "Added to your journal"; deleting asks first.

Both modal surfaces (the sheets, the dialogs, the writing page) appear without animation when
the phone's "reduce motion" is on.

## Where this differs from the stills

* **"Yours" is the member's requests among those loaded**, then further pages up to a bound;
  the still draws a complete list. A request more than ten pages (150 requests) deep on a very
  busy wall would not appear under "Yours" until scrolled to under "All".
* **Category chips are 44 high**, where the sheet draws them 40: every target is at least 44.
