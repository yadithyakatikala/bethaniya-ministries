# Admin Guide

A step-by-step guide to the Bethaniya Ministries admin dashboard, written
for church staff — no programming knowledge required.

**A note on screenshots:** this guide describes every screen by its exact
field labels and button text so it can be followed without images, but it
does not include actual screenshots yet. Capturing real screenshots needs
a running dashboard connected to a real Firebase project and a browser to
photograph it in — neither exists yet in this development environment (see
"Before you can use this" below and README.md's "Production readiness").
Once the dashboard is deployed and someone can sign in, screenshots should
be added to this guide; until then, treat every "you'll see..." below as
an exact description of what the code renders, verified by reading the
source and its tests, not a picture of it.

## Before you can use this

The admin dashboard exists as reviewed, tested code, but **it is not
deployed anywhere yet** — there is no live web address for it, and no real
church data is in it. This project runs entirely on Firebase's free
("Spark") plan by deliberate policy (see README.md's "Cost constraint"),
and getting a real, running instance in front of church staff requires
someone with developer access to finish the deployment steps in
DEPLOYMENT.md first. Ask whoever manages this project's technical side
when that's ready — this guide will be accurate once it is.

## Signing in

1. Open the dashboard's web address in a browser (desktop or mobile both
   work — it's a normal website, not an app to install).
2. Enter the **Email** and **Password** your Super Admin gave you, and
   select the sign-in button.
3. If your email or password is wrong, you'll see a red error message
   above the form — check for typos and try again. If you don't have an
   account yet, ask your Super Admin to create one for you (see "Managing
   users" below); staff accounts are not self-service.

You'll land on the Dashboard, which shows your name and your role
(Host, Content Admin, or Super Admin). What you can do from here depends
on that role — see "Who can do what" below.

## The Dashboard

The first page after you sign in. It answers "what should I look at?" using
only what is really in the database — nothing is estimated or made up:

- **Count cards** for Announcements, Reading Plans, Songs, Upcoming Events and
  (for Content Admins and above) Open Reports. Each opens the page that holds
  them. While a number is still loading it shows a dash, never a zero.
- **Needs attention** — drafts you have started but not published, most
  recently touched first.
- **Coming up** — things scheduled to open (reading plans, photos and videos,
  Prophet verses), with when.
- **Recently updated** — what is published, most recently changed first.
- **Today's verse** — the verse the app is showing today, and where it came
  from (a day set by hand, your church's own list, or the app's built-in year).
- **Prophet verse** (Content Admin and above) — the one showing now.
- **Reading plans** by status, and the last notification sent.
- **Quick actions** — shortcuts to real pages, depending on your role.

If part of the page could not be read, it says which part, instead of showing
a number it could not check. A retired reading plan is never listed.

## Finding your way around

Every page shares the same navy sidebar down the left side (on a phone or
narrow window, tap the menu icon in the top-left corner to open it), in five
groups:

- **Dashboard**
- **Content** — Announcements, Songs, Events, Community, Photos & Videos
- **Bible** — Verse of the Day, Prophet Verse of the Day, Reading Plans
- **Library** — Media Library
- **People** — Notifications, Reports, Users, and Settings at the bottom

The page you're on is marked with a gold bar. Selecting any link takes you
straight there — nothing requires remembering a web address, and every address
that worked before still does.

To sign out, use **Sign out** at the foot of the sidebar (or the button at the
top of the Dashboard).

**Tables on a phone.** A wide table (Users, Reading Plans…) scrolls sideways
inside its own card — swipe it. The page itself never moves sideways.

**Dates** are written the same way everywhere: `14 Oct 2026, 18:10`, in the
time zone of the computer you are using.

## Who can do what

| You are a... | You can |
| --- | --- |
| **Host** | Manage the live-stream link/status on Events, and send notifications. Everything else below is view-only or hidden. |
| **Content Admin** | Everything a Host can do, plus create/edit/publish Announcements, Daily Verses, Songs, Events, Community posts, Photos & Videos, Prophet verses and Reading Plans, and use the Media Library. Settings are visible but not editable. |
| **Super Admin** | Everything, plus manage other users' accounts/roles and edit Settings. |

If a page or button isn't there for your role, that's expected — it isn't
missing, it's just not part of what your role does. If you believe your
role is wrong, ask another Super Admin to check the Users page.

## Announcements, Songs, and Daily Verses

These work the same way (Content Admin and Super Admin only):

1. From the sidebar, select the section you want.
2. You'll see a list of existing entries, each marked **Published** or
   **Draft** (a word and a small icon, not just a colour), with
   **Publish**/**Unpublish**, an edit (pencil) icon, and a delete (trash) icon
   on each row.
3. To add a new one, select the "New..." button at the top of the list.
   - **Announcements**: Title, Content (the message body), and an optional
     image.
   - **Songs**: Title, Artist, Category, Lyrics, a cover picture, and the song's
     audio — **upload** an audio file, **choose** one from the Media Library,
     or paste a link.
   - **Daily Verses** (a day you set by hand — see "Verse of the Day" below):
     Scripture Reference, Verse Text, and the Date it should appear on.
4. **Pictures and songs.** Wherever a form takes a picture or a song you can
   **upload** it from your computer, **choose from library** (anything uploaded
   before), or **use a web address**. Uploading needs the one-time setup in
   [docs/admin/MEDIA_UPLOADS.md](admin/MEDIA_UPLOADS.md); until that is
   done the form says so, and the other two ways still work. The form's save
   button waits while a file is uploading.
5. A new entry always starts as a **Draft** — it will not appear in the
   mobile app until you select **Publish** on its row in the list. This is
   deliberate: it lets you prepare content ahead of time and publish it
   exactly when you want it live.
6. Required fields are marked, and the form won't let you save until
   they're filled in correctly — an error message explains what's missing
   or wrong.
7. To change something later, select the pencil icon; to remove it
   entirely, select the trash icon (you'll be asked to confirm first —
   deletion cannot be undone).

## Events (and Live Streaming)

Events combine two separate sets of controls, for two different roles:

**Creating and editing events (Content Admin and Super Admin):** same
pattern as above — Title, Location, Description, and Starts At (date and
time), from a "New Event" button and the list's edit/delete icons. New
events also start as **Draft**; publish them from the list the same way as
Announcements/Songs.

**Managing the live stream (Host, and above):** on any event's row, select
the **Live Stream** control to open a dialog where you set the **YouTube
URL** and toggle whether the stream is currently **live**. This is
deliberately the *only* thing a Host can change about an event — a Host
cannot edit an event's title, description, or other details, only whether
it's live and where. When an event is live, its row shows a **LIVE**
label in the list so it's obvious at a glance which event (if any) is
currently streaming.

## Community (Content Admin and Super Admin)

Community posts (testimonies, church-family updates) work the same way as
Announcements: a list with **Published**/**Draft** status and
edit/delete/publish controls, a "New Post" button, and a form collecting
Title, Content, and an optional image. A new post always starts as a
**Draft** until you publish it. This is deliberately admin-authored
content only — members can read published posts in the mobile app, but
there is no way for a member to post here themselves.

## Reading Plans (Content Admin and Super Admin)

Reading Plans are multi-day Bible readings members browse and follow in the
app (**Bible → Plans**). The full guide — every field, the statuses, the
publish checklist, scheduling, and exactly what members see — is in
**[docs/admin/READING_PLANS.md](admin/READING_PLANS.md)**. In short:

1. **Reading Plans → New Plan.** On the **Details** tab give it a title,
   description and category (and, if you like, a subtitle, language, time per
   day, author and cover picture). The **Plan ID** is made from the title and
   **cannot be changed later**, because members' progress is stored under it.
2. On the **Days** tab add a day for each day of the plan: a title and a
   passage are required; a devotional, reflection question, application,
   prayer and notes are optional. Passages are **checked against the real
   Bible** as you type (a passage that does not exist is refused, with the
   reason), and **Choose from the Bible** builds one for you.
3. **Preview** shows the plan's card and any day as a member will see it.
4. **Save changes.** A new plan is saved as a **Draft** — administrators only.
5. **Publish** (live now) or **Schedule…** (live at a time you choose). The
   site first checks the plan is complete — a description, at least one day,
   and every day with a title and a real passage — and lists anything missing.
6. Other actions, from the list's **⋮** menu or the editor: **Unpublish**,
   **Archive** / **Restore**, **Duplicate**, **Delete** (each asks first).

Changing a plan members are already reading: their progress is saved **by day
number**, so moving or deleting a day changes which day they have finished.
Adding days at the end, and editing any day's words, is always safe.

A Host can open any plan and read it, but cannot change one.

**What needs approval before it works on phones:** the database rules and one
index that publishing relies on have not been deployed yet. See
[DEPLOYMENT.md](./DEPLOYMENT.md).

## Media Library, Photos & Videos

**Library → Media Library** is the catalogue of every picture, song and video
link you have uploaded or added. From it you can **search**, filter by type and
category, see previews, **copy a file's address**, **edit** its title,
description and category, and **remove** its record. Removing a record never
deletes the file itself, and never breaks anything that already uses it.

- **Upload file** — a picture or a song from your computer (needs the one-time
  setup in [docs/admin/MEDIA_UPLOADS.md](admin/MEDIA_UPLOADS.md)).
- **Add video or link** — a **YouTube** link (the right home for video — it is
  free), or an `https://` address of a picture or song that already lives
  elsewhere.

**Content → Photos & Videos** is the feed members scroll in the app — separate
from the library. Each post is a picture or a video with a caption (and
optionally a verse), saved as a draft until you publish it, and can be
scheduled for a later time.

If uploading is not set up, you will see a plain notice instead of an upload
button. If you are the person setting it up, the notice has a "For the person
setting it up" section naming exactly what is missing.

## Verse of the Day and Prophet Verse of the Day

**Bible → Verse of the Day** is one page with four tabs:

- **Today** — what the app is showing right now and *why* (set by hand, your
  church's own list, or the built-in year), and a preview of any other day.
- **Schedule** — which verse falls on which day, a year ahead.
- **Verses** — days you have set by hand, and your church's own verse list if
  you keep one.
- **How it works** — whether the rotation is running, and its two settings.

The app chooses a verse every day by itself; **nothing has to be done each
morning**. You step in only to make one day different ("Set a day by hand").

When you type a **Scripture reference** for a daily verse or a Prophet verse,
you can also press the book icon, **Choose from the Bible**, to pick the book,
chapter and verses instead — it fills the field with a correctly written
reference. Typing still works exactly as before.

**Bible → Prophet Verse of the Day** is a separate thing: a word your church
writes and publishes, with a date and time it should start showing. The page
opens with which one is on the home screen now.

A **Host** can look at the Verse of the Day; setting a day by hand, managing
the church's verse list and the Prophet verses are for Content Admins and
above.

## Notifications

Any Host, Content Admin, or Super Admin can send a notification:

1. From the sidebar, select **Notifications**.
2. Fill in a **Title** and **Message**.
3. Choose who receives it: **All Members** or **Admins Only**. (Content
   Admin and above can also attach an image.)
4. Select send. The notification is recorded in a permanent log below the
   form, showing exactly who sent what, when, and to how many people.

**Important — read this before sending anything:** sending a notification
here does **not** currently push an alert to anyone's phone. It computes a
real recipient count and records the attempt for the record, but actual
push delivery to real devices isn't built yet (see README.md's
"Notifications status" for the full detail). Use this for now as a
record-keeping tool, not as a way to actually reach people urgently.

## Managing users (Super Admin only)

1. From the sidebar, select **Users** (Host and Content Admin will see a
   message that they're not authorized for this page — that's expected,
   not a bug).
2. You'll see every person who has ever signed into the mobile app or
   admin dashboard: their name, email, phone, current role, and the date
   they joined.
3. To change someone's role, select the role dropdown on their row, choose
   the new role, and confirm in the dialog that appears. The change takes
   effect immediately and is permanently logged (who changed it, from what
   to what, and when).
4. **You cannot change your own role** — the dropdown on your own row is
   disabled. This is intentional: it stops anyone (including a Super
   Admin, by accident) from locking themselves out of the highest role
   with no one able to undo it. If you need your own role changed, ask
   another Super Admin.

## Settings

1. From the sidebar, select **Settings**.
2. **Super Admin** sees an editable form: Church Name, Church logo (upload
   one, choose it from the Media Library, or paste a web address),
   Description, and Support Email, plus a **Save** button. Saving shows a
   confirmation message, and the church's name/logo/description update in
   the mobile app almost immediately — there is no separate "publish"
   step, unlike Announcements/Songs/Events.
3. **Content Admin and Host** see the exact same information, but every
   field is read-only (greyed out) with a notice explaining that only a
   Super Admin can make changes. This lets everyone confirm what the
   church's public-facing info currently says without risking an
   accidental change.
4. Required fields and the logo address/Support Email formats are checked
   before saving — an error message explains anything that needs fixing.

## If something goes wrong

- **A red error banner appears**: read it — this project's error messages
  are written to say specifically what happened (a required field is
  empty, a URL/email is badly formatted, a save failed), not a generic
  "something went wrong."
- **A page says "not authorized"**: that's your role, correctly working as
  designed — see "Who can do what" above. It is not a bug to report unless
  you believe your role itself is wrong (ask a Super Admin to check).
- **Something looks broken that isn't covered here**: this project has not
  yet been tested on real phones/tablets or under a slow/unreliable
  connection (see HISTORY.md's "Days 11–13" section) — if you're on a real
  device and hit something unexpected, that's exactly the kind of report
  that testing phase needs. Note what you were doing, what device/browser
  you were using, and pass it along to whoever manages this project's
  technical side.

---

## Reports — reviewing what members have flagged

**Sidebar → Reports.** New in M7.

Members can report a media post, a comment on one, a chat message or a
prayer request. Each report lands here.

The page opens on **Open** reports only; switch to **All** to see what has
already been dealt with. Two administrators can work the queue at the
same time — it updates live, so a report somebody else has just closed
disappears from your list.

**Review** opens the report and fetches **the content itself**, so you can
read what was actually said before deciding. Three things you can do:

- **Remove content** — takes it down AND resolves the report in one
  action. A chat message and a prayer request are hidden behind "This
  message was removed"; a comment is deleted; a media post is
  unpublished.
- **Dismiss** — closes the report and leaves the content alone.
- **Cancel** — changes nothing.

The optional **note** stays on the report for whoever reads it next.

Two things to expect:

- **A prayer request posted anonymously shows "Anonymous".** That is not
  the page hiding it from you — the request genuinely carries no author,
  and only a Super Admin has any path to that information. You can remove
  an abusive request without knowing who wrote it.
- **"This has already been deleted by its author."** The author removed
  it between reporting and review. Dismiss the report; there is nothing
  left to remove.

Only Content Admins and Super Admins can open this page. Reporters
cannot read the queue at all, including their own reports — a queue a
reporter can read is one that tells them who else has reported the same
person.

## Users — the fuller view

**Sidebar → Users.** Super Admin only, as before.

**Search** matches a name, an email address, a phone number or a user ID.
A phone number is found with or without its spaces and country code, so
"9876543210" finds "+91 98765 43210".

**View** opens the member's full record: display name, email, phone,
gender, preferred app language, how they sign in, role, join date,
whether they finished onboarding, when they were last active, account
status and their user ID.

Two fields say **"Not recorded yet"** rather than guessing:

- **Signs in with** and **Last active** are written by the member's own
  app the next time they open it. An account that has not been opened
  since this release has neither, and the page says so instead of
  printing a plausible-looking default.

### Pausing somebody's posting

In the member's detail panel: **Pause posting**.

- They can no longer post chat messages, prayer requests, comments or
  reports. The app tells them why.
- **They can still read everything**, and they stay signed in. This is an
  app-level pause, not a deleted or disabled account — the app cannot
  disable a Firebase sign-in without a paid plan.
- It is reversible with the same button (**Allow posting again**).
- You cannot pause your own account.

Use it when somebody needs to be stopped now and spoken to afterwards.
For a permanent change, speak to whoever administers the Firebase
project.
