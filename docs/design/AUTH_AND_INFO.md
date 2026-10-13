# Entry screens and information pages, as built

What a member sees **before** they are in the app (loading, sign-in, the suspension
notice) and the two **information** screens that stand a little apart from the tabs
(the Verse of the Day, and the Privacy Policy and Terms).

The first three are **states the app can be in, never routes**: `App.tsx` chooses
between them (`LoadingScreen` while Firebase reports who is signed in, then
`SuspensionGate` → `OnboardingGate` → the navigator for a signed-in member, or
`SignInScreen`), so there is no tab bar and no Back gesture behind any of them. That
is deliberate and is not changed here.

## Loading (`features/auth/LoadingScreen.tsx`)

The round portrait (96), a short gold thread (132 × 2, fading at **both** ends --
`GoldThread`), and "Loading…" in quiet ink, centred and lifted 36 above the middle.
It follows the opening, which ends on the same portrait.

* Themed from the first frame (`colors.background`); a cold start in dark mode never
  flashes white.
* **One announcement** for a screen reader -- a busy progress indicator named
  "Loading…" -- rather than a picture, a line and a sentence to swipe past. The
  portrait and the thread are hidden from it.

`features/common/BrandPortrait.tsx` is the portrait as a mark: the bundled 512-point crop
the opening uses, cut round by its own border radius, decorative, exempt from colour
inversion. It is used at 96 (here), 72 and 44 (sign-in). It is a face, so it is
**never placed beside words that do not belong to the person pictured** -- the word
MARANATHA under it names the app, and the suspension notice uses a pause mark instead.

## Sign-in (`features/auth/SignInScreen.tsx`)

A full screen, **in the order the app has always had** (design question D1: this is the
recommended default, taken because it changes nothing about when a member is asked to
sign in).

```
portrait 72
MARANATHA                       (English serif, 13/16, tracked wide, gold ink)
Sign in to Maranatha            (serif 26/32, a heading)
[ notice ]                      (only when there is one)
Email
[ you@example.com            ]
Password
[ Password              Show ]
( Sign in )                     (primary pill, full width)
   Forgot your password?        (gold text actions, centred)
   New here? Create an account
────────────
( Continue with Google )        (secondary pill; Apple on iPhone when available)
```

* **Three steps on one screen**: sign in, create an account (a name field and "At least
  6 characters" under the password), reset your password (email only). The title
  changes; the portrait and the word stay.
* **A label above every field, kept there** (`TextField`). Placeholders are examples,
  never the label. Show / Hide is a named text action inside the password box; the
  password goes back to hidden whenever the step changes.
* **While a request is out**, the fields dim and stop taking input, the primary button
  keeps its fill and shows a spinner (its spoken name stays "Sign in"), and the other
  actions are put down. A failure never leaves the button stuck.
* **When it does not work** the sentence is in a danger notice above the form
  (`NoticeBanner`, announced politely) **and** the field the failure is about is
  outlined (`TextField invalid`) -- never colour alone. A wrong email or password
  outlines the **password** box in every case, so the outline cannot reveal whether an
  address is registered; "already registered" and "not an email address" outline the
  email. A failure about neither (offline, throttled, cancelled) outlines nothing. A
  failed Apple sign-in is not about a field and outlines none. `fieldAtFault()` in
  `services/firebase/authErrors.ts` is the one place that decides.
* **With the keyboard up** the portrait shrinks to 44, the word goes and the title steps
  down to 22/28, so the form is not pushed off a short screen. (`useKeyboardVisible`;
  iOS also scrolls the focused field clear of the keyboard.) The provider buttons stay
  where they are, below the form.
* The portrait and the word are hidden from a screen reader: the title already says the
  name.

### What is not here, on purpose

* **Phone sign-in.** Not part of V1; the screen renders no phone UI at all.
* **A line about agreeing to the Terms and Privacy Policy** (design question L1). Whether
  the legal pages should open before an account exists is for the church's counsel, so
  no sentence presumes the answer. The pages are reachable from You → Settings.
* **The Google and Apple marks.** The approved stills draw a placeholder; both companies
  require their own artwork, used as their brand guidelines say, so the buttons are words
  until the church has set those providers up and has the assets. Google's button appears
  only when a client id exists for the running platform; Apple's only on an iPhone that
  supports it.

## The suspension notice (`features/account/SuspendedScreen.tsx`)

What a suspended member sees instead of the app. **Behaviour is unchanged**: the gate, the
timing, "closing the app does not get past it", and that a temporary suspension lets go by
itself are all `SuspensionGate`'s and are tested there. (Design question S1 -- whether
suspension should instead be "posting only" -- is **not decided here**; the notice still
replaces the whole app.)

A pause mark in a 1.5-point ring, the title in the serif at 28/36 (a heading), one plain
sentence ("…will unlock by itself when the time is up", or "…once an administrator restores
access"), and for a temporary suspension the date it ends in a **warning-tinted box**:
"Until 14 October 2026, 6:30 PM" (day first, in the app's language). Two quieter sentences
(nothing is deleted; speak to someone at church). **Sign out** sits apart at the foot.

* **New: the church's contact.** When the church has set a support email it is shown as
  **plain text** under "Contact the church", which a member can press and hold to copy.
  It is not a link: this app has no support inbox, and a button that opened a blank mail
  composer addressed to nobody would be worse than none. With none set, or if the settings
  cannot be read, the row is absent. (Any signed-in member may read `/settings`, and a
  suspension stops writes, not reads, so this works for a suspended member.)
* It is **announced** when it appears (a polite live region around the words; the contact
  row is outside it, so the email arriving a moment later does not re-announce the notice).
* **It never says why.** The reason an administrator recorded is a note for the next
  administrator, not a message to the member; and a permanent suspension shows no date.
* **A fix:** the date used to be drawn in the label colour for a *solid* warning fill
  (white), on the pale warning tint -- all but invisible in the light palette. It now uses
  the warning colour, which clears 4.5:1 on its tint in both palettes.

## The Verse of the Day (`features/daily-verses/DailyVerseScreen.tsx`)

**Design question V1, default taken: the screen shows what Home shows.** It used to read
only the verse an administrator had written for today, so on a day the church wrote none Home
showed a verse and this screen said there was none, and it had no Share or Copy.

* **Top:** a top bar ("Verse of the day"), then **Home's own verse card**
  (`DailyVerseCard`, from `useVerseOfTheDay`: an administrator's verse, then the automated
  one, then a bundled one) with the same Read chapter · Share · Copy. Three things differ,
  all in how the card is asked to draw: the gold label says **Today**; the church's picture,
  when it sent one, is a 16:9 block **above** the date with the verse on the page (on Home
  the verse is set on the picture under a veil); and there is no "See all".
* **"Read chapter"** opens the Bible at the verse's own place. An administrator's typed
  verse has no known place (it is free text), so it is shared and copied but never offers
  it -- including when it carries a picture.
* **Below, "Previous verses":** the verses the church wrote on **earlier** days, newest
  first -- a date ("9 Oct", with the year when it is not this one), the verse in the serif
  of its script (the interface face when it mixes scripts), and its reference in gold ink,
  between hairlines. The automated verses are not listed: nobody wrote them for a day.
  A verse dated **today** is the one above; one dated in the **future** (a church can write
  next week's in advance) is not a "previous" verse -- neither is listed. "Today" is the
  canonical Indian date the card uses, not the phone's.
* **States:** the card's own loading shape and empty state; a list that is waiting (two
  placeholder rows), empty ("No past verses yet"), or **could not be read** ("Earlier verses
  could not be loaded." with Try again -- it does not claim there are none).

## Privacy policy and Terms (`features/legal/LegalScreen.tsx`)

One screen, two documents (`kind="privacy" | "terms"`, from You → Settings). A top bar with
Back and no title (the document's title is the first thing on the page); the title in the
serif at 28/36 (Telugu 25/40); a **warning-tinted line** with a mark saying the text is
provisional; then the document as **headed sections** -- a heading in the serif at 18/26, its
paragraph beneath at 16/26.

* **The headings are real headings** (`accessibilityRole="header"`), so a screen reader can
  jump from section to section instead of reading a wall of text.
* **The text is the same text** -- split into the headed sections it already had, with
  typographic apostrophes. The one sentence dropped is the old first paragraph ("not yet
  reviewed by counsel -- the church operating this app should replace this text before public
  launch"), which was advice to whoever deploys the app, not to a member; its first half is
  now the localised provisional line above.
* **Still English only**, because the church's counsel has not approved a Telugu text. Under
  a Telugu interface the title and the provisional line are Telugu, and the line says the text
  is English only for now; the English text is marked English (`accessibilityLanguage`) so
  VoiceOver does not read it in a Telugu voice. Nothing here is legal advice; the text is
  provisional and a church deploying the app should replace it.

## Where this differs from the stills

* **The provider marks are absent** (see above).
* **No keyboard is drawn** in a keyboard-up state of the browser preview; the layout change is
  what is checked.
* **A balanced title** ("Create your / Maranatha account") is the browser's `text-wrap:
  balance`; React Native has no such thing on iOS, so a wrapping title breaks greedily there
  (Android's `textBreakStrategy="balanced"` is set).
* **The Verse screen's "Read chapter" is absent on a day with a typed verse**, including the
  picture variant the still draws it on (see above).
* **Provider buttons dim in the browser preview**, because the preview's Google auth request
  never becomes ready; on a phone the button is live once the request is.
