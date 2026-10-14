# Reading plans — writing, publishing, and what members see

A reading plan is a Bible reading for each day: a passage, and if you like a
devotional, a reflection question, an application and a prayer. This page
explains how to write one on the admin site, how to put it in front of the
congregation, and what happens on their phones when you do.

It is for Content Admins and Super Admins. A Host can open any plan and read
it, but cannot change one.

---

## The short version

1. **Reading Plans → New Plan.**
2. **Details** tab: give it a title, a description, a category. Optional: a
   subtitle, a language, a time estimate, an author, a cover picture.
3. **Days** tab: add a day for each day of the plan. Each needs a title and a
   passage. The devotional, reflection question, application, prayer and notes
   are optional.
4. **Preview** tab: read the plan card and any day the way a member will.
5. **Save changes.** It is saved as a **Draft** — nobody but administrators
   can see it yet.
6. **Publish** (or **Schedule** for a later time). The site checks the plan is
   complete first and lists anything missing.

Everything you type is kept on the page until you press **Save changes**. If
you try to leave with unsaved changes, the site asks first.

---

## The Details tab

| Field | Notes |
| --- | --- |
| **Title** | What members see in the library. Up to 200 characters. |
| **Plan ID** | A short unique name made from the title ("seven-days-in-the-psalms"). **It cannot be changed once the plan is saved**, because every member's progress is stored under it. Changing the title later is fine; the ID stays. |
| **Subtitle** | Optional. One line under the title. |
| **Description** | Required to publish. What the plan is about and who it is for. Up to 2,000 characters. |
| **Language** | English or Telugu. Decides the label on the plan's card, and which language of book names the passage picker offers. |
| **Category** | Choose an existing one or type your own ("Devotional", "Topical"…). |
| **Estimated time per day** | Optional, in minutes (1–240). |
| **Author** | Optional. |
| **Cover image** | Optional. Upload a picture, choose one from the Media Library, or paste a web address. A plan without one shows a plain placeholder — it is never an error. See [MEDIA_UPLOADS.md](./MEDIA_UPLOADS.md). |
| **Display order** | Plans are listed from the lowest number to the highest; plans with the same number are in alphabetical order. A plan with no number is treated as 0, so it comes first. |

## The Days tab

Each row is one day, in the order members read them. **Add day** adds one at
the end; **Add 7 blank days** adds a week of empty days to fill in. On each
row: edit, move earlier, move later, duplicate, delete.

A day has:

- **Title** (required to publish).
- **Passage** (required to publish) — one or more readings, such as
  `Psalm 23`, `John 3:16-21` or `Genesis 1:1-2:3`. **Add another passage**
  adds a box for a second reading.
- **Devotional**, **Reflection question**, **Application**, **Prayer** and
  **Notes for readers** (all optional). A section you leave empty simply does
  not appear in the app.

A plan can have up to 366 days.

### Passages are checked

A passage that looks right but does not exist ("John 3:99", "Psalm 151") would
give a day whose **Read** button quietly does nothing. So each passage is
checked against the 66 books and the real number of verses in every chapter,
as you type, and the box says why if it cannot be used.

- Write books the way the app prints them: **English** ("Song of Solomon",
  "1 Corinthians") or **Telugu**. Abbreviations ("Jn", "1 Cor") are refused with
  a sentence saying so, because the app would not know how to open them.
- **Choose from the Bible** offers a book, chapter and optional verses and
  always produces a passage the app can open.
- A good passage is rewritten the one standard way when you leave the box
  ("psalm 23" becomes "Psalm 23"). A Telugu plan keeps Telugu book names.
- When a day has several passages, the app's **Read** button opens the Bible at
  the **first** one.

## Statuses

| Status | Members see it? | Meaning |
| --- | --- | --- |
| **Draft** | No | Being written. The default for a new plan. |
| **Scheduled** | From the time you chose | Finished and waiting for its moment. |
| **Published** | Yes | Live now. |
| **Archived** | No | Retired but kept. Can be restored. |

From the plan list's **⋮** menu, or the buttons above the editor:

- **Publish** / **Schedule…** — runs the checklist first (below).
- **Unpublish** — back to Draft. Members stop seeing it, but their progress is
  kept, and comes back if you publish it again.
- **Archive** / **Restore** — retire a plan without deleting it.
- **Duplicate** — makes a copy (with all its days) as a new Draft, with its own
  Plan ID. Useful for a Telugu version or a new season.
- **Delete** — removes the plan and its days for good. Asks first; cannot be
  undone. Members' saved progress for it is not touched.

Every action that hides, retires or deletes a plan asks you to confirm.

### The checklist before a plan goes live

Saving a **draft** asks for very little (a title and a category). **Publishing
or scheduling** asks for everything a member will see:

- a description,
- at least one day,
- every day with a title and a passage that exists.

If something is missing, the dialog lists it and each item takes you to the
place to fix it. It also gives **warnings** that never block: no cover picture,
or a day that is only a passage.

The same two things must stay true **after** a plan is live. A published or
scheduled plan cannot be saved without a description or without a day: if you
clear the description, or delete the last day, **Save changes** says so and
writes nothing. If you really mean to empty a plan, **Unpublish** it first (or
**Cancel schedule**, for a scheduled one) — it becomes a draft, and a draft may be
saved half-built. (Without this check, the
site would delete the last day first and only then find that the plan may not be
saved, leaving members a live plan with nothing in it.)

A day's text must also be within its limit before anything is saved (a
devotional is up to 5,000 characters, a reflection question or prayer 1,000, an
application 2,000, notes 3,000). The Days tab marks the day and the box shows
the count.

### Changing a plan members are already reading

Members' progress is saved **by day number**. If you move or delete a day in a
plan that is published, someone who finished "Day 3" has now finished a
different day. The editor says so beside the days. **Adding days at the end is
always safe**, and so is editing the words of any day.

### Scheduling

**Schedule…** asks for a date and time in **your own time zone** (the field
names it). The plan becomes readable by members at that time, judged by the
server's clock, not your computer's. Nothing has to happen at that moment: on
the free Firebase plan there is no background job, so the plan is stored as
Scheduled and simply becomes readable when its time arrives. The admin site
then shows it as Published.

---

## What happens on members' phones

Nothing needs to be installed or sent. The app reads plans straight from the
same database the admin site writes to.

1. You publish (or the schedule arrives).
2. The app's **Bible → Plans** list shows the plan on its next refresh — at
   once for a published plan. A **scheduled** plan appears when the app next
   asks for plans whose time has come — it asks for those that came due at least
   a minute earlier, so a phone whose clock runs a little fast is not refused:
   whenever the app is opened, and then every five minutes while it stays open.
   If a phone has had the app open
   since *before* the scheduled time and the plan still has not appeared ten
   minutes after it, closing and reopening the app brings it in.
   (That last point is what the local test setup showed: there, a connection is
   judged by the time it was opened, so a phone already connected when the time
   passed needs a new connection. It has **not yet been checked on a real phone
   against the live database** — see "Scheduled plan arrives" in
   [QA_CHECKLIST.md](../../QA_CHECKLIST.md).)
3. Opening it shows your title, description, cover, language, time estimate and
   day count; each day shows the passage with a **Read** button, then whichever
   of devotional, reflection question, application and prayer you filled in.
4. A member's place is saved under the plan's ID: they can stop and carry on
   later, on any day.

**Drafts, archived plans and scheduled plans before their time are never sent
to a member's phone** — the database refuses to hand them over, whatever the app
asks for.

### Plans the app already had

The app ships with five starter plans, used only until the church publishes a
plan of its own. As soon as there is one real plan, members see the church's
library instead. A member who had already started a starter plan keeps it,
under "My plans", with their progress; it is never offered to anyone who has
not started it.

Plans written before this manager existed (no language, author or order) still
work exactly as before.

---

## What protects it

- Only **Content Admins and Super Admins** can create, change or delete plans
  and days — enforced by the database's security rules, not just by the buttons
  you can see. A Host can read; a member can read only what is live.
- The rules also refuse to make a plan live without a description and a day,
  and refuse a plan whose "published" flag and status disagree.
- A day can only be read when its plan can.

Those rules are in `firestore.rules`, with tests in
`firebase-tests/src/firestore.rules.test.ts`, and a full end-to-end test
(`firebase-tests/src/plans-end-to-end.test.ts`) that publishes a plan through
the admin code and reads it back the way the phone does.

## Going live — what needs your approval

This change adds one **Firestore index** (on a plan's status and publish time)
and changes the plan rules. **Neither has been deployed.** Until they are,
against the rules currently in production:

- a **draft with an empty description**, or a day **without a devotional**, is
  refused when you press Save (the old rules required both);
- a **scheduled** plan is not readable by phones, so it would not appear when
  its time came;
- a plan that is simply **published**, with a description and a devotional on
  every day, still reaches phones as before.

Deploying the new rules and the index is free (no plan upgrade) and is
described in [DEPLOYMENT.md](../../DEPLOYMENT.md#pending-the-admin-cms-changes-to-the-rules-and-indexes-not-deployed).
Nothing is deployed without your say-so.

## If something looks wrong

- **"Someone else saved this plan while you were editing it."** Another
  administrator saved first. Reload the plan to see their version, then redo
  your changes — the site will not overwrite theirs.
- **A day's passage is marked red.** Read the sentence beside it; it says what
  to change.
- **"A published or scheduled plan has to keep both a description and a day."**
  You tried to save a live plan with its description cleared or its last day
  deleted. Put the description or a day back — or **Unpublish** the plan first
  (**Cancel schedule**, if it is scheduled) if you mean to empty it.
- **The plan is Published but a phone does not show it.** Check the phone is
  online, that the rules and index have been deployed, and wait a moment; then
  see the troubleshooting list in [QA_CHECKLIST.md](../../QA_CHECKLIST.md).
- **You cannot change the Plan ID.** That is deliberate (see above). To use a
  different ID, **Duplicate** the plan and choose a new one.
