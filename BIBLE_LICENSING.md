# Bible Content Licensing

**Status: `BIBLE CONTENT: BLOCKED FOR PRODUCTION — LICENSING UNVERIFIED`**

This is a real, active V1 requirement per
[FINAL_ARCHITECTURE_SPECIFICATION.md](./FINAL_ARCHITECTURE_SPECIFICATION.md)
Section C ("English + Telugu Bible, exactly") — it has not been dropped or
downgraded. This document exists so that requirement isn't quietly lost:
it records exactly what was investigated, what's confirmed, what isn't, and
what has to happen before any real Bible text can go into this app or
repository.

**No Bible text — real or copyrighted — has been added to this repository.**
The Bible screen described below (`mobile/src/features/bible/`) uses a
handful of clearly-labelled synthetic placeholder verses so the UI can be
built and tested now, per the spec's own "Option 3" fallback. Swapping in a
real, licensed source later is a data change, not an architecture change.

## Why this can't be resolved from a research pass alone

Per the spec's explicit instruction and this project's own non-negotiable
principles: a translation being *readable* on a public website, or an API
being *publicly reachable*, is not the same as this app having the right to
cache it offline, index it for search, let users copy/share verses, and
ship it inside an App Store / Play Store product. Every candidate below is
evaluated against those specific permissions, not just "can it be read."
Several leads below dead-ended at exactly this gap: a source exists and is
technically accessible, but its redistribution terms for a third-party app
were not found or not confirmed, which is precisely the "publicly
accessible ≠ redistribution rights" trap the spec warns against — so they
stay unresolved rather than being assumed clear.

## English Bible

| Candidate | Rights holder | Status |
| --- | --- | --- |
| **World English Bible (WEB)** | Public domain (no rights holder) | ✅ **Confirmed usable** |
| King James Version (KJV) | Crown copyright (UK only) / public domain elsewhere | ⚠️ Usable outside the UK; see caveat |
| API.Bible (NIV, ESV, etc.) | Individual publishers, via Digital Bible Society | ❌ Not verified / likely costs money |

**World English Bible — the recommended default.** Confirmed public domain
worldwide (a modern, deliberately-public-domain translation maintained by
eBible.org / Michael Paul Johnson specifically so it carries no copyright
restriction). This satisfies every permission the spec's requirement lists:
redistribution, offline caching, search indexing, copy/share, and
commercial or non-commercial App Store distribution, all without needing a
license agreement from anyone. The only restriction found is a trademark
(not copyright) one: the name "World English Bible" is protected for
*substantially altered* derivative texts, which doesn't apply to using the
text as-is with attribution. Source text: https://ebible.org/web/ (also
mirrored via get.bible's public-domain data sets).
**Evidence:** en.wikipedia.org/wiki/World_English_Bible (license section);
https://ebible.org/web/; https://get.bible/bible-data-sets/ (lists WEB
under public-domain entries).

**King James Version — usable, with one caveat.** Public domain in the US
and most of the world, but the UK Crown holds a perpetual Letters Patent
copyright over KJV printing *within the United Kingdom* specifically. Since
this app is not UK-specific and WEB already satisfies the requirement
cleanly, there's no reason to take on this caveat — noted here only so it
isn't independently "discovered" and mistaken for a blocker on WEB.
**Evidence:** widely documented UK Crown Copyright status; not independently
re-verified against a primary UK government source in this pass.

**API.Bible — not pursued further.** Its free/Open-Access tier covers
public-domain and Creative Commons translations (which WEB already covers
more simply), and its paid "Express Licensing" tier is for translations
like NIV/ESV that are explicitly excluded from V1 scope decisions here —
also, no confirmed Telugu offering was found in their catalog (see below),
so it wouldn't solve the harder half of this requirement anyway. Its usage
model also requires a "Fair Use Management System" (FUMS) client-side
tracker embedded in the app, which is a real integration cost even on the
free tier. Not ruled out for a future translation upgrade, just not needed
to unblock V1. **Evidence:** api.bible pricing/licensing pages (fetched
during research; catalog itself is JS-rendered and could not be
enumerated by an automated fetch — this is a gap, not a "checked, none
found" result).

## Telugu Bible

**No source was found and confirmed for Telugu.** This is the actual,
unresolved half of the requirement — the honest state, not a placeholder
for "will get to it."

| Candidate | Status | Why it didn't resolve |
| --- | --- | --- |
| Bible Society of India (BSI) "OV" | ❌ Unresolved | Traditional/most-used Telugu translation; no license terms found publicly; likely requires direct contact per the spec's own Option 1 |
| eBible.org Telugu entry (`tel2010`, "హోలీ బైబిల్") | ❌ Unresolved | Entry exists in eBible's catalog (which is predominantly public-domain/CC works), but its specific license details page failed to load on every fetch attempt in this pass (a JS-rendering issue, not a "checked and it's restricted" finding) |
| Wikimedia Commons `Telugu_Bible.pdf` | ❌ Unresolved | Commons only hosts public-domain/free-licensed files in principle, which makes this a promising lead, but the file's page itself could not be fetched (cache-only error) to confirm which translation/edition it actually is |
| Lyman Jewett's 1880s translation | ❌ Unresolved | Old enough to plausibly be public domain by age, but no source was found distributing Jewett's original text directly (as opposed to BSI's possibly-derived-and-separately-copyrighted "OV" edition) |
| "Free Bibles India" | ❌ Unresolved | Referenced as a Telugu source in secondary listings; no primary page with explicit license terms was reached |
| Telugu Easy-to-Read Version (Bible League Intl., 1992) | ❌ Ruled out | Bible League International's own site describes a formal license-agreement process for its translations — not a self-serve open license |
| API.Bible | ❌ Ruled out | No Telugu translation found in searchable results; catalog is JS-rendered and couldn't be fully enumerated |

**What would actually resolve this:** either (a) direct written contact
with the Bible Society of India confirming redistribution/offline/search
permissions for their OV translation (the spec's own recommended Option 1
— realistically a multi-day turnaround, not something resolvable from a
research pass), or (b) a human manually opening the eBible.org `tel2010`
and Wikimedia Commons `Telugu_Bible.pdf` pages in a real browser (both
resisted automated fetching in this pass) to read their stated terms
directly.

## Day 8 status: WEB text import attempted, not completed

Day 8 (Bible Reader implementation) set out to import the World English
Bible's actual verse text now that its license is confirmed above. That
import was **not completed** — the license is not in question, but the
exact source bytes for the text itself could not be safely obtained in
this sandboxed development environment:

- The environment's web-fetch tooling does not return raw page/file
  bytes — it fetches a page and runs the content through a small AI model
  that summarizes/answers about it, rather than returning verbatim text.
  That means even a successful fetch cannot be trusted to reproduce
  scripture text byte-for-byte, which fails this project's own
  licensing-safety bar for importing scripture (verified source content
  only, never reconstructed or paraphrased).
- Fetches against `https://ebible.org/web/`,
  `https://ebible.org/find/details.php?id=eng-web`, and `get.bible`'s
  data-sets/`eng-web` pages did not surface a concrete, directly
  downloadable structured (USFM/plain-text) data file through that
  tooling.
- Bulk-downloading a zip/USFM archive via `curl`/`wget`/a script instead
  of the sanctioned fetch tooling is disallowed in this environment.
  Adding an npm package that bundles Bible text was ruled out (no new
  dependencies). Reconstructing WEB text from memory was explicitly ruled
  out as unverifiable guessing, not a safe import.

**Net effect:** the WEB *license* is confirmed usable (see above,
unchanged), but the WEB *text dataset* has not been imported into this
repository. English therefore ships the same clearly-labeled synthetic
placeholder content as Telugu today — see "What ships now instead" below.
A real WEB dataset, once obtained through a verified, human-reviewed
channel (someone downloading the actual USFM/text files from ebible.org
and adding them to the repo directly, outside this sandboxed fetch path),
is a swap of the Bible module's data source — `getChapter()` in
`mobile/src/features/bible/dataSource.ts` — not a change to the Bible
screens, navigation, or app architecture.

## What ships now instead

Per the spec's own explicitly-sanctioned fallback ("Option 3: Hardcoded
Sample Data," Section C) and its Day 8 instruction to "Use 100-200
placeholder verses + clear labeling" when the source isn't verified, the
mobile app's Bible screens (`mobile/src/features/bible/`) use a bounded
pool of 150 synthetic, sequentially-numbered placeholder verse entries per
language (`PLACEHOLDER_POOL_SIZE` in
`mobile/src/features/bible/placeholderData.ts`), deterministically
distributed across all 66 books' real chapter structure so navigation
shows different placeholder text per chapter. Every entry is explicitly
labeled "Development placeholder ... Not scripture" in the data itself,
and the UI shows a persistent banner reading "Development content — not a
real Bible translation." This is enough to build and test the Bible
screens' full navigation, caching, and layout now, without the app ever
having shipped or cached real copyrighted text under an unverified
license or an unverified source. Swapping in WEB (English) once its text
is safely obtained, and a confirmed Telugu source once one exists, is a
data-layer change to `dataSource.ts` — not a rebuild of the screens or
navigation.

## Action needed (from you, not from further research)

1. Decide whether to pursue BSI directly for Telugu now (spec's Option A)
   or accept placeholder Telugu through V2 (spec's Option C) — this is
   the same decision point the spec already flagged as "Decision Required
   FROM YOU" and it's still open.
2. If pursuing BSI: the contact/negotiation itself needs a human (this
   cannot be automated or assumed).
3. Optionally: open the two dead-end URLs above
   (`https://ebible.org/find/details.php?id=tel2010` and
   `https://commons.wikimedia.org/wiki/File:Telugu_Bible.pdf`) in a regular
   browser — they may resolve the Telugu question with five minutes of
   direct reading; they simply didn't render for this pass's fetch tooling.
