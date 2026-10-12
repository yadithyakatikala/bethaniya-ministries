# The Maranatha opening — the approved film

> The fish is carrying golden wind to Maranatha, and that golden wind becomes Maranatha.

`maranatha-opening-approved.mp4` is the exported film the owner approved
(1080 × 2228, 60 fps, H.264 + AAC, **5.4 s**, 750 503 bytes, sha256
`66e52ac6…b8d003`). It is a reference, not an app asset: the app draws the
same film live, natively, and plays no audio.

## What the app ships

| | |
|---|---|
| Where | `mobile/src/features/opening/` |
| How | A TypeScript port of the approved engine (`engine/`), one pure function from a time to a frame, drawn by `react-native-svg` (`OpeningCanvas.tsx`). No web view, no video file, no new service. |
| Plays | Once per launch, over the app while it loads underneath; one tap (or Android back) skips it. |
| Reduced motion | The film does not play. The closing still — portrait over the gold wordmark — fades in, rests, and fades out. |
| Light and dark | Both. The ground is the app's own paper and the fish its own ink, so the hand-off to the first screen is a cross-fade between two identical surfaces. |
| Size | One 51 KB portrait, ~8 KB of glyph and geometry data, and `react-native-svg` (MIT, bundled with Expo). |

## Timing — a decision for the owner

The original brief asked for roughly 3.8–4 s. The film that was *approved* is
the same sequence played 1.34× slower: 4.02 "animation seconds" × 1.34 =
**5.39 s**, which is the length of the exported video. The app ships the
approved film exactly, because the brief also says to preserve the approved
composition and timing.

If 4 s is what is wanted after all, change `SPEED` in
`mobile/src/features/opening/engine/constants.ts` from `1.34` to `1.0`. Every
beat scales with it and nothing else needs to move. (`engine.test.ts` pins the
approved value; update it in the same change.)

## The fish

There is no separate fish image file. In the approved film the fish *is* a
two-arc outline defined in code, and the app uses exactly those coordinates
(`FISH_START`, `FISH_A_STEPS`, `FISH_B_STEPS` in `engine/constants.ts`). If a
different fish artwork was meant, it needs to be supplied as a file and the
two arcs replaced — the flight, the heading, the particles that dissolve from
its outline and the onboarding school all read those same two constants.

## The onboarding chapter — the story continues

> The word turns back into the fish, the fish carries the wind to a school of
> its own kind and joins it, and the school settles above the first question.

A new member's first questionnaire begins where the opening ends: the
portrait and the gold wordmark, then the same gold that made the letters
releases them and re-forms the fish. It swims off carrying golden wind round
the portrait (which recedes), a school of thirteen fish resolves out of the
paper, the arriving fish slows into its place at the tail, the gold passes
through the whole school, and the school settles into a slim band. The first
question rises under it.

| | |
|---|---|
| Where | `mobile/src/features/opening/` (`engine/chapter.ts`, `ChapterCanvas.tsx`, `SchoolBand.tsx`, `stage.ts`) and `mobile/src/features/onboarding/` (the screen that hosts it) |
| Length | **5.0 s** for a member who has never seen it. The first question starts to rise at about 3.5 s and can be used by about 4.3 s, with the school still settling behind it. |
| Returning | A device that has already played it plays the **last two seconds** (the school arrives with a 0.3 s fade, then the question), so somebody coming back to finish a half-answered profile is not made to watch the whole story again. The only thing remembered is one flag on the device (`onboarding_chapter_seen`); nothing the member types is ever stored on the device. |
| Skip | A tap anywhere on the scene goes straight to the question, until the question has risen. The form is untouchable until then, so a tap cannot fall on a button nobody can see yet. |
| Reduced motion | There is no chapter. The question fades in over a still school. |
| Keyboard | The school tucks into one row of seven fish (a 44 pt strip) above the question and the quiet link steps aside; Continue floats 10 pt above the keyboard. |
| After it | The same school, swaying slowly, sits above every question (the sway runs at 20 fps, not 60). On leaving for Home it swims out to the right. |

Like the opening it is a port of an approved prototype
(`scripts/opening-fidelity/reference/onboarding-chapter.js`, unmodified) with
every frame a pure function of time, checked against that prototype
numerically and by pixels (below). **One honest caveat:** in the design
review the owner's verdict on the onboarding continuation (question "ANIM")
was still open. It is built as shown there; if the story should change, the
timeline is `CHAPTER_T` in `engine/chapter.ts`, and `RESUME_START` is where the
short version begins.

## How we know it is the same film

`scripts/opening-fidelity/` runs the approved engine (`reference/anim2.js`,
unmodified) in a browser beside the app's code and compares them:

* **numbers** — every opacity, position, heading, ribbon path and mote of 108
  frames agree to the rounding the approved engine itself applies;
* **pixels** — the app's actual `OpeningCanvas`, rendered through
  `react-native-svg`'s web build, against the approved engine's DOM, at 2×, in
  light and dark: mean difference 0.16 / 255, and 0.0003 % of pixels differ by
  more than 64 (the portrait's anti-aliased edge).

The chapter is checked the same way (20 frames and the settled band, every
fish's position, heading, scale, opacity, rim and ribbon: worst differences
0.005 px, 0.005°, 0.0004 opacity; and the real `ChapterCanvas` / `SchoolBand`
against the prototype's DOM at 2×, light and dark: mean difference 0.16 / 255,
at most 0.004 % of pixels differing by more than 64).

`mobile/src/features/opening/__tests__/` pins a sample of both engines'
output as golden fixtures, so `npm test` guards the same property without a
browser.

What this does **not** prove is how it feels on a particular phone. Frame rate
on a low-end Android device has to be judged on that device; see
`QA_CHECKLIST.md`.
