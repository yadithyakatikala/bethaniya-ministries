# Photos and songs: uploading from the admin site

The admin site can now **upload** pictures and songs from your computer, keep
them in a **Media Library**, and let you pick them again in any form. Videos
are added as **YouTube links**. Before this, every picture and song had to
already be on the internet so its web address could be pasted in.

Uploading works through **Cloudinary**, a free service that stores the files.
It is switched **off** until you connect your own Cloudinary account — this
page tells you exactly how, and exactly what to be careful about.

> **Nothing here creates an account, agrees to terms or enters payment details
> for you.** You make the Cloudinary account yourself, on the free plan, and
> you never enter a card. If any screen asks for payment to continue, stop.

---

## 1. What you need to give the site: three values

None of these is a secret. They are written into the published website, so
anyone who opens it could read them. That is how this kind of upload works,
and section 5 explains what it means.

| Setting | What it is | Where you find it | Looks like |
| --- | --- | --- | --- |
| `VITE_CLOUDINARY_CLOUD_NAME` | Your account's name | Cloudinary Console → the dashboard shows "Cloud name" | `my-church` |
| `VITE_CLOUDINARY_IMAGE_PRESET` | The name of an upload preset that accepts **only images** | You create it in step 3 below | `maranatha-images` |
| `VITE_CLOUDINARY_AUDIO_PRESET` | The name of an upload preset that accepts **only audio** | You create it in step 4 below | `maranatha-audio` |

You can leave either preset out to switch that kind of upload off (no audio
preset means pictures only, for example). With none set, every upload button
is replaced by a plain notice, and pasting a web address still works.

**Never** put your Cloudinary **API secret**, **API key** or the
`CLOUDINARY_URL` connection line anywhere in this website's settings, in git,
or in a chat. The site checks for them: if it finds a variable that looks like
one it refuses to turn uploading on and tells you to replace the secret.

---

## 2. Step by step (about ten minutes)

### Step 1 — Make a free Cloudinary account

Go to Cloudinary's website, sign up, and choose the **Free** plan. Do not add
payment details.

### Step 2 — Find your cloud name

On the Cloudinary Console's dashboard, copy the **Cloud name** (just the name,
like `my-church` — not a web address and not anything containing a `:` or `@`).

### Step 3 — Create the image preset

In the Console go to **Settings → Upload → Upload presets → Add upload
preset**. (Cloudinary rearranges its menus from time to time; if you cannot
find it, search its help for "unsigned upload preset".) Set:

| Setting | Value |
| --- | --- |
| Preset name | `maranatha-images` (or any name — it must match what you put in the site) |
| **Signing mode** | **Unsigned** — this is essential; a "Signed" preset will not work from the site |
| Folder | `maranatha/images` (keeps your files together and easy to review) |
| **Allowed formats** | `jpg,jpeg,png,webp,gif` |
| Overwrite | Off |
| Unique filename | On |
| Disallow public ID (if shown) | On — stops an uploader choosing file names |
| Incoming transformation (recommended) | limit pictures to 2000 × 2000 pixels, e.g. `c_limit,w_2000,h_2000` — keeps every file small |

### Step 4 — Create the audio preset

The same screen again, with:

| Setting | Value |
| --- | --- |
| Preset name | `maranatha-audio` |
| **Signing mode** | **Unsigned** |
| Folder | `maranatha/audio` |
| **Allowed formats** | `mp3,m4a,aac,wav` |
| Overwrite | Off |
| Unique filename | On |
| Disallow public ID (if shown) | On |

(Cloudinary files audio under its "video" type. The site already sends audio to
the right place; there is nothing to set.)

### Step 5 — Give the three values to the site

Create (or edit) the file `admin/.env.local` for your own computer, and
`admin/.env.production` for the live build, and add:

```
VITE_CLOUDINARY_CLOUD_NAME=my-church
VITE_CLOUDINARY_IMAGE_PRESET=maranatha-images
VITE_CLOUDINARY_AUDIO_PRESET=maranatha-audio
```

(Use your own values.) These files are **ignored by git** and must stay that
way — never commit them. `admin/.env.example` shows the shape with the values
left blank.

### Step 6 — Start (or rebuild) the site

The values are baked into the site when it starts or is built, so they take
effect after you restart `npm run dev`, or after the next `npm run build`
(which is then deployed — see [DEPLOYMENT.md](../../DEPLOYMENT.md); deploying
needs your approval and is not part of this change).

### Step 7 — Check it works

Open **Media Library → Upload file**, choose a small picture, and watch the
progress bar. When it finishes it appears in the library. Then open any form
with an image (for example **Announcements → New**): you should see **Upload
image**, **Choose from library** and **Use a web address**.

Remove your test picture from the library afterwards (section 4 explains that
this does not delete the file at Cloudinary; delete it there too if you wish).

---

## 3. Using it

**In any form** (announcements, songs, reading-plan covers, Prophet and daily
verses, community posts, photos & videos, notifications, Settings logo):

- **Upload image** / **Upload audio** — pick a file; a progress bar shows;
  a preview appears when it is done. The file is also added to the Media
  Library.
- **Choose from library** — pick something already uploaded.
- **Use a web address** — paste an `https://` link to a picture or song that
  already lives somewhere. Links that are not `https://` are refused, because
  the phone could not show them.
- **Replace** / **Remove** change only what is about to be saved. They never
  delete a file.
- A form's **Save** button waits while an upload is running, so you can never
  save an old picture by mistake.

**The Media Library** (sidebar → Library → Media Library) is the catalogue of
everything: search by title, file name or description; filter by type (images,
audio, videos) and by category (Posters, Covers, Thumbnails, Songs & worship,
Videos, General); thumbnails and previews; copy a file's address; **edit** its
title, description and category; **remove** its record. Pictures load a small
copy for the thumbnail so a screen of pictures stays quick.

**Videos** are **not uploaded**. Put the video on your church's YouTube channel
(free) and use **Add video or link** in the library, or the video field in
**Photos & Videos**. The site tidies the YouTube address into the one form the
phone plays and shows its thumbnail so you can confirm it is the right video.
Cloudinary's free allowance is a poor fit for video, and YouTube costs nothing
to host or to play.

### What may be uploaded

Checked in your browser before anything is sent:

| | Types | Largest |
| --- | --- | --- |
| Pictures | JPEG, PNG, WebP, GIF | 5 MB |
| Songs | MP3, M4A, AAC, WAV | 25 MB |

(SVG, HEIC, TIFF and BMP pictures are left out on purpose: SVG can carry code,
and Android cannot show the others. OGG and FLAC audio are left out because
iPhones will not play OGG and lossless files are far larger than a hymn needs.)

These limits are **a courtesy, not a defence**: they catch a mistake in a
second, but anyone sending files straight to Cloudinary skips them. The limits
that really apply are the ones on your Cloudinary presets and on your plan.

---

## 4. Removing things

**Remove** on a library record removes the record from the library — **not**
the file at Cloudinary, and not the picture from any announcement or song that
already uses it (those keep their own copy of the address, so nothing in the
app breaks).

The site **never deletes anything from Cloudinary**. That would need your
secret key, which the site does not have and must never have. To free space,
delete files in the Cloudinary Console yourself (by folder or by date).

---

## 5. Is it safe? The honest answer

**What the admin login protects:** who can use the upload *buttons* on this
site, and who can write to the church's database (that part is enforced by the
database's own rules).

**What it does not protect:** Cloudinary's upload address. That belongs to
Cloudinary, not to this site. Hiding the buttons behind a login does **not**
make that address private. An *unsigned* preset exists so that a browser can
upload without a password, which means anyone who learns your cloud name and
preset name — both visible in the site's code — can send a file to it.

### What a stranger could do

- Upload files of the **types your preset allows**, up to your Cloudinary plan's
  own file-size limits, filling your free storage and using up your monthly
  allowance (storage and delivery are counted together, in "credits"). A preset
  limits *what kind* of file; check in the Console whether your account offers
  any further size limit, because the site's 5 MB / 25 MB are not one.
- Make a mess in your Cloudinary account.

### What a stranger could not do

- Read, list, change or delete the files you already have, or touch your
  account. All of that needs your **API secret**, and the secret is not in the
  site.
- Put anything in the church app. The app shows only addresses that an
  **administrator saved into the church's database**. A file uploaded by a
  stranger is not in any announcement, song or plan, so no member ever sees it.

### How to keep the risk small

1. **Set Allowed formats** on both presets, exactly as in the steps above.
2. **Use a folder** per preset so uploads are easy to review and clear out.
3. **Set an incoming transformation** on the image preset so pictures stay small.
4. **Keep the free plan's allowance in view.** Look at the Cloudinary Console's
   usage figures now and then (monthly is plenty for a church), and turn on any
   usage email alerts Cloudinary offers.
5. **Look at the Console's own Media Library** from time to time. Anything in
   `maranatha/images` or `maranatha/audio` that your team did not upload is
   somebody else's — delete it.
6. **Prefer YouTube for video**, so the heaviest files never touch Cloudinary.

### If you think it is being abused

1. In Cloudinary, delete (or disable) the preset being abused.
2. Create a new preset with a **new name** and the same safe settings.
3. Change `VITE_CLOUDINARY_IMAGE_PRESET` / `…_AUDIO_PRESET` to the new name and
   rebuild the site.
4. Delete the junk files in the Console.

If the allowance is used up, Cloudinary may stop accepting uploads or serving
files until the next month, or ask you to upgrade. The site then says
"Cloudinary is not accepting uploads right now". **Do not upgrade to fix it**
unless you decide to; this project is meant to stay free. Everything that is
already in the church app keeps working from its saved address unless the
files themselves stop being served.

### The stronger design, and why it was not built

The proper fix is **signed uploads**: the site asks a small server to sign each
upload using the secret, so only logged-in administrators can upload. That
needs somewhere to run code that holds the secret. On this project's free
Firebase plan Cloud Functions are not available (they need the paid plan), and
the secret must never be placed in the website or the phone app. So this was
**not** built — and nothing pretends to be: there is no fake "signed" upload in
this site. If abuse ever becomes real, the options are (a) a small free server
somewhere else, (b) accepting the plan's allowance as the limit, or (c) YouTube
and pasted addresses only. Any of these changes how the project is built, so
the decision is yours; it will not be made for you.

---

## 6. Messages you might see, and what they mean

| The site says | What it means | What to do |
| --- | --- | --- |
| "Image upload is not set up yet." | The three values are not in the site's settings. | Follow section 2. |
| "…switched off because the Cloudinary settings are wrong." | A value is malformed, or a secret was found. | Open "For the person setting it up" in the notice: it names the setting. If a secret was exposed, **create a new API secret** in Cloudinary. |
| "Cloudinary does not know the upload preset…" | The preset name does not match one in your account. | Compare the name with Settings → Upload → Upload presets. |
| "The upload preset is set to 'Signed'…" | The preset is not Unsigned. | Edit the preset; set Signing mode to Unsigned. |
| "Cloudinary does not recognise the cloud name…" | The cloud name is wrong. | Copy it again from the dashboard. |
| "That file is larger than Cloudinary will accept…" | Over your plan's size limit. | Choose a smaller file. |
| "Cloudinary would not accept that kind of file." | Not allowed by the preset's Allowed formats. | Use a normal picture / audio file. |
| "Cloudinary is not accepting uploads right now…" | Free allowance used up, or a rate limit. | Check usage in the Console; try later. |
| "Could not reach Cloudinary." | No internet connection, or a blocker. | Check the connection; try again. |
| "The upload took too long and was stopped." | A slow connection, or a big file. | Try again, or choose a smaller file. |

"The image was uploaded and is ready to use…" with a warning means the file
reached Cloudinary but could not be added to the Media Library list. The
picture is still usable in the form; re-add it later from **Add video or link**
if you want it in the library.

---

## 7. For developers

| | |
| --- | --- |
| Settings reader and guard | `admin/src/services/media/cloudinaryConfig.ts` — validates the three variables, refuses to enable uploads if a variable *name* looks like a Cloudinary secret/key, never echoes a value |
| The upload | `admin/src/services/media/cloudinaryUpload.ts` — one `multipart/form-data` POST (`file` + `upload_preset`) to `https://api.cloudinary.com/v1_1/<cloud>/<image\|video>/upload` with XHR progress; the reply is validated (https `secure_url`, `public_id`, the right `resource_type`) |
| Browser-side file checks | `admin/src/services/media/uploadRules.ts` |
| Thumbnails | `admin/src/services/media/delivery.ts` — only for library thumbnails; the **stored** address is always Cloudinary's original `secure_url`, so a strict account cannot break the app |
| The library records | `admin/src/services/firebase/mediaAssets.ts` → Firestore `media_assets` (not Cloudinary's Admin API) |
| Fields in forms | `admin/src/components/media/` — `ImageField`, `AudioField`, `VideoLinkField`, `MediaPicker` |
| The library page | `admin/src/features/media-library/` |
| Rules | `firestore.rules` → `media_assets`: admins and hosts read; content admins and above create, relabel, remove; the shape is **closed** (`keys().hasOnly`), addresses must be `https://`, a record's file identity is immutable, Cloudinary files are never "video" |
| Tests | `admin/src/services/media/__tests__/`, `admin/src/components/media/__tests__/`, `admin/src/features/media-library/__tests__/`, and the `media_assets` cases in `firebase-tests/src/firestore.rules.test.ts` |

Cloudinary's Admin API is deliberately not used. Anything that lists, renames or
deletes remote files needs the secret.

### What has been tested — and what has not

| What | How it is tested | Real Cloudinary? |
| --- | --- | --- |
| The upload request (the two form fields, the address it posts to, progress, timeouts, the reply check, each error message) | `cloudinaryUpload.test.ts` runs the **real** upload code against a **pretend** browser request (a fake `XMLHttpRequest`) that is told what Cloudinary "replies" | **No** |
| The upload buttons, progress bar, preview and errors in every form | Screen tests that **replace** the upload function altogether | **No** |
| The settings guard (what it accepts, what it refuses, that it never prints a value) | Unit tests over many variable names | Not applicable |
| The library records the site writes, and who may read or write them | `firebase-tests/src/media-assets-end-to-end.test.ts` and the `media_assets` cases in `firestore.rules.test.ts`: the **real** record builders and the **real** security rules, in the Firebase emulator | **No** — the "uploads" are records a successful upload would produce, including odd ones |

**No test in this project has ever contacted Cloudinary.** No Cloudinary account
exists for it, and the automated tests never need one. So:

- The first **real** upload is a manual check — section 2, step 7. Do it once
  before relying on uploads, with a small picture and a short song.
- Cloudinary's real replies may differ from the ones the tests use in small ways.
  The code is written not to depend on that: it checks only the address, the
  file's id and the kind of file, and it leaves out any detail (size, width,
  duration, name) that the library record cannot hold rather than failing to
  record a file that uploaded fine.
- Nothing here proves your preset is set up safely. That is a settings page in
  Cloudinary's Console, and only you can check it (section 5).

The numbers in section 3 (5 MB, 25 MB) are this site's own. They sit well under
Cloudinary's free-plan ceilings **as published when they were chosen** (10 MB
per image, 100 MB per video — audio counts as video). Cloudinary changes its
plans: check its pricing page rather than trusting these.
