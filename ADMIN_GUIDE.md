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

## Finding your way around

Every page shares the same sidebar down the left side (on a phone or
narrow window, tap the menu icon in the top-left corner to open it): links
to the Dashboard, Announcements, Daily Verses, Songs, Events, Notifications,
Users, and Settings. The page you're currently on is highlighted. Selecting
any link takes you straight there — nothing here requires remembering a
web address.

To sign out, go back to the Dashboard and select **Sign out**.

## Who can do what

| You are a... | You can |
| --- | --- |
| **Host** | Manage the live-stream link/status on Events, and send notifications. Everything else below is view-only or hidden. |
| **Content Admin** | Everything a Host can do, plus create/edit/publish Announcements, Daily Verses, Songs, and Events. Settings are visible but not editable. |
| **Super Admin** | Everything, plus manage other users' accounts/roles and edit Settings. |

If a page or button isn't there for your role, that's expected — it isn't
missing, it's just not part of what your role does. If you believe your
role is wrong, ask another Super Admin to check the Users page.

## Announcements, Daily Verses, and Songs

These three work the same way (Content Admin and Super Admin only):

1. From the sidebar, select the section you want.
2. You'll see a list of existing entries, each marked **Published** (green)
   or **Draft** (grey), with **Publish**/**Unpublish**, an edit (pencil)
   icon, and a delete (trash) icon on each row.
3. To add a new one, select the "New..." button at the top of the list.
   - **Announcements**: Title, Content (the message body), and an optional
     image.
   - **Daily Verses**: Scripture Reference (e.g. "John 3:16"), Verse Text,
     and the Date it should appear on.
   - **Songs**: Title, Artist, Category, Lyrics, and an Audio URL (a link
     to the song's audio file).
4. A new entry always starts as a **Draft** — it will not appear in the
   mobile app until you select **Publish** on its row in the list. This is
   deliberate: it lets you prepare content ahead of time and publish it
   exactly when you want it live.
5. Required fields are marked, and the form won't let you save until
   they're filled in correctly — an error message explains what's missing
   or wrong (for example, an invalid URL).
6. To change something later, select the pencil icon; to remove it
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
2. **Super Admin** sees an editable form: Church Name, Logo URL,
   Description, and Support Email, plus a **Save** button. Saving shows a
   confirmation message, and the church's name/logo/description update in
   the mobile app almost immediately — there is no separate "publish"
   step, unlike Announcements/Songs/Events.
3. **Content Admin and Host** see the exact same information, but every
   field is read-only (greyed out) with a notice explaining that only a
   Super Admin can make changes. This lets everyone confirm what the
   church's public-facing info currently says without risking an
   accidental change.
4. Required fields and the Logo URL/Support Email formats are checked
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
  connection (see README.md's "Day 12" section) — if you're on a real
  device and hit something unexpected, that's exactly the kind of report
  that testing phase needs. Note what you were doing, what device/browser
  you were using, and pass it along to whoever manages this project's
  technical side.
