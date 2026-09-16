# Reading plan sources

**The five reading plans shipped with V1 are APP-CREATED GENERIC Bible
reading plans. They are NOT authored, reviewed or endorsed by Bethaniya
Ministries.**

This document exists so nobody — a reviewer, a future developer, or a
member of the congregation — can mistake them for the church's own
material.

## Why they are app-created

The V1 tester asked for five reading plans, and the brief was to prefer
actual church-provided material and to research the church's online
presence first. That research was done and found nothing usable.

| Source checked | Method | Result |
| --- | --- | --- |
| `"Bethania Ministries" Ventrapragada church` | web search | No match. Results were unrelated organisations in Texas, Kerala, Wales and Guatemala. |
| `Ventrapragada village church Andhra Pradesh Bethaniya Ministries Telugu` | web search | Confirmed **Ventrapragada** is a village and mandal headquarters in Pedaparupudi mandal, Gudivada revenue division, Krishna district, Andhra Pradesh; official language Telugu. **No church or ministry page.** |
| `"Bethaniya" OR "Bethania" Ministries Ventrapragada YouTube Facebook Telugu 2026` | web search | No YouTube channel, no Facebook page, no church site. |
| `bethaniya.com` | web search + fetch attempt | **A different organisation.** Bethania Retreat Centre of the Thamarassery Diocese — Kerala, Syro-Malabar Catholic, Malayalam-speaking. Not this church. (The domain is also blocked by this environment's network policy, so nothing was taken from it.) |
| `github.com/yadithyakatikala/bethaniya-ministries` | web search | The project's own repository. Not a content source. |

The church's own logo reads **"Since 2026"**, which is consistent with a
congregation founded this year not yet having an established web
presence.

**Conclusion:** there was no official Bethaniya Ministries devotional or
reading-plan material to adapt. Rather than invent plans and present them
as the church's, all five are clearly labelled as included-with-the-app
generic plans that the church is expected to edit or replace.

## What is and is not sourced

| Element | Sourced? | Notes |
| --- | --- | --- |
| Scripture **references** (book, chapter, verse range) | Yes — real and checkable | Validated in `mobile/src/features/plans/__tests__/seedPlans.test.ts` against the canon metadata in `mobile/src/features/bible/books.ts`: every cited book exists and every cited chapter is within that book's chapter count. |
| Scripture **text** | Not reproduced at all | The plan screens show only the reference. Verses come from the app's own licensed datasets — see `BIBLE_LICENSING.md`. No verse text appears in the seed data, and a test asserts this. |
| Plan titles, day titles, devotional paragraphs, prayer prompts | **App-created original text** | Written during this pass. Deliberately short, plain and doctrinally neutral so the church can rewrite them in its own voice. |
| Cover images | None | `coverImageUrl` is `null` for all five. Inventing church imagery is not this script's job; admins can upload their own. |

Each plan's description ends with the same sentence, so a member can tell
at a glance:

> *A general Bible reading plan included with the app. Your church can
> edit or replace it.*

The church removes that sentence when it adopts or rewrites a plan.

## The five plans

### 1. Seven Days in the Psalms
- **Duration:** 7 days
- **Category:** Devotional
- **References:** Psalm 1 · Psalm 23 · Psalm 130 · Psalm 139:1-18 · Psalm 51:1-17 · Psalm 46 · Psalm 150
- **Content basis:** App-created. The selection deliberately moves through trust → lament → praise so the plan does not imply that faith is only celebratory. No external devotional was used.

### 2. The Life of Christ in Luke
- **Duration:** 14 days
- **Category:** Gospels
- **References:** Luke 1:1-25 · 1:26-56 · 2:1-20 · 4:1-13 · 4:14-30 · 5:1-11 · 6:17-38 · 7:36-50 · 10:25-37 · 11:1-13 · 15 · 22:14-30 · 23:32-49 · 24:13-35
- **Content basis:** App-created. A straightforward walk through Luke's own narrative order, from his stated method to the road to Emmaus. Passage selection is editorial, not from any published plan.

### 3. Foundations of Faith in Romans
- **Duration:** 10 days
- **Category:** Epistles
- **References:** Romans 1:1-17 · 3:9-26 · 4:1-12 · 5:1-11 · 6:1-14 · 7:14-25 · 8:1-17 · 8:28-39 · 12:1-13 · 13:8-14
- **Content basis:** App-created. Follows the letter's own argument in order rather than a thematic rearrangement.

### 4. Names of God
- **Duration:** 7 days
- **Category:** Topical
- **References:** Exodus 3:1-15 · Genesis 22:1-14 · Psalm 23 with John 10:11-18 · Isaiah 9:2-7 · Isaiah 7:14 with Matthew 1:18-25 · John 6:32-40 · Revelation 21:1-7
- **Content basis:** App-created. Each day pairs a name with the passage that gives it; the two double references pair an Old Testament name with its New Testament use.

### 5. Peace in Anxiety
- **Duration:** 5 days
- **Category:** Topical
- **References:** Matthew 6:25-34 · 1 Peter 5:6-11 · Philippians 4:4-9 · Psalm 56 · Matthew 11:28-30
- **Content basis:** App-created. Deliberately the shortest plan, and written so as not to present scripture as a substitute for medical care — it says plainly it is "not a cure".

Durations were chosen to spread usefully: 5, 7, 7, 10 and 14 days, so
someone with a spare week and someone with a spare fortnight each have
something. A test pins that spread.

## Editable by administrators

The plans are seeded as ordinary Firestore documents in the `plans`
collection with their days in `plans/{id}/days`, exactly the shape the
admin app already manages (`admin/src/features/plans/`). Once seeded,
a `content_admin` or `super_admin` can:

- edit any plan's title, description, category or cover image;
- edit any day's title, scripture reference, devotional or prayer prompt;
- add, remove or reorder days;
- unpublish or delete a plan entirely.

Nothing is hardcoded into a screen. The mobile app reads whatever is in
Firestore.

## Seeding

Plan data lives in `mobile/src/features/plans/seedPlans.ts` — beside the
`PublishedPlan` / `PublishedPlanDay` types it must satisfy, so the
compiler checks every field. The writer is `scripts/seed-plans.mjs`.

```bash
# Against the emulator (the default; refuses to run without one)
firebase emulators:exec --only firestore "node scripts/seed-plans.mjs"

# Against production, deliberately
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json \
  node scripts/seed-plans.mjs --production
```

The script is **idempotent** (stable slug ids, `merge: true`) so
re-running updates in place rather than creating duplicates, and it
**never deletes** — a plan the church has edited keeps its edits to any
field the script does not set, and a plan the church deleted is not
resurrected unless `--force` is passed.

**Not yet run against production.** Seeding production is a deliberate
act requiring a service-account key, and is left to the church's
operator.

## If the church later provides real material

Replace the content in `seedPlans.ts` (or simply edit the plans in the
admin app), remove the `APP_CREATED_NOTICE` sentence from the affected
descriptions, and update this document's table to record the real source.
The tests in `seedPlans.test.ts` will keep checking that every scripture
reference is valid.
