# You, Settings and Notifications, as built

**You** is the member's own corner: a header (a 72-point monogram, the name, the
email and whether it is verified, with the bell and the sliders at the right) over two
tabs, **Saved** and **Profile**. The bell opens Notifications and the sliders open
Settings. Saved is described in `NAVIGATION.md`; this page covers the rest.

## Profile (`features/profile/ProfileScreen.tsx`)

Rows -- a label, the value, and **Edit** in gold ink -- for **Name, Email, Phone
Number, Gender and Age**. A row with no value says "Not set" in a quiet colour and
still offers Edit.

* **Editing swaps that row for its field**, with Save and Cancel under it. One row at
  a time: starting another puts the first back, unsaved. A save closes the field and says
  "Saved." in a toast; a failed save keeps the field open with what was typed and says so
  under it. Cancel writes nothing.
* **Name** may not be empty. **Phone** is optional: an empty field withdraws a number
  the member gave, anything else must look like a phone number by the same rule
  onboarding uses (and is stored normalised). **Gender** is the two-part choice, opened on
  the member's answer (neither chosen if they gave none; Save then waits). **Age** is a
  whole number of years, 1 to 120 -- the rule `firestore.rules` enforces -- on a number pad
  of three digits at most. Nothing in the app reads the age to decide anything.
* **Email** is shown, never edited here (Firebase Auth owns it). Beside it a **Verified**
  badge, or **Not verified** with a "Resend verification email" button and its notice or
  its (mapped, non-generic) error. An account with no email address shows no status.
* **No photos** (decision H6): "Change photo" is gone, and with it the Storage upload.
  The member's picture is their initial.

**Deploy `firestore.rules` for the age field.** The rules in this repository allow `age`
(a whole number, 1 to 120) in a member's own profile update; the project's deployed rules
have to be updated by the church's administrator before Age can be saved from this screen
(or from onboarding). Nothing here deploys anything.

## Settings (`features/settings/SettingsScreen.tsx`)

Top bar; then groups between hairlines:

* **LANGUAGE** -- two value rows, "App language" and "Bible language", each with its
  value and chevron and **the sentence that says what it does not change**, shown in full.
  A row opens a sheet of its choices with the current one ticked and set bolder (the
  Bible's includes English + Telugu; the interface has no bilingual mode). Choosing closes
  the sheet. They are two settings on purpose: a shared label is how someone changes the
  wrong one.
* **THEME** -- a three-part pill: Light, Dark, System.
* **Notifications** -- one row with the switch (painted from the theme on a phone; the
  browser preview shows its own thumb).
* **ABOUT** -- Contact the church (the church's real support address, or "Not set yet"),
  Bible translations (the two names, opening their credits), Privacy policy, Terms of service.
* **Log Out** -- a red word with its icon, which **asks first** ("Log out of Maranatha?
  ... Nothing is deleted.") and signs out only on confirm.

A setting that saved on the phone but could not reach the member's account says so at the
top, politely (a warning notice), and the choice stands.

**Bible translations** (`BibleTranslationsScreen.tsx`) is the app's only licence notice: the
two names, "Public domain" for the English, and for the Telugu its copyright holder,
"Licensed under CC BY-SA 4.0", the licence's address and a **Read the licence** button. It
reads the same constants (`bible/translationCredits.ts`) the rest of the app uses.
Whether one tap deeper than before still counts as findable under that licence is a
question for the church's counsel.

## Notifications (`features/notifications/NotificationCenterScreen.tsx`)

The phone's own history (nothing is read from Firestore). One hairline row each: a small ink
dot while unread, the title (bold while unread), the message, and when it came -- "Today,
10:31 AM", "Yesterday, 4:15 PM", "6 Oct, 9:00 AM" by **calendar day** -- with a chevron only
where tapping goes somewhere. An unread row is announced "New. ..." in its spoken label, so
the title stays exactly what the church sent. Tapping any row marks it read.

## Where this differs from the stills

* The browser preview of the notifications switch and of Telugu clock times comes from the
  preview engine, not from a phone.
* "Not set" rows offer Edit exactly as the stills draw them; the old screen hid an empty
  phone row, which the design reverses.
