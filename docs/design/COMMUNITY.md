# Songs, Events and Chat, as built

The three places the Community tab leads to besides its Updates feed. Songs and
Events are **pushed** from Community's shelf (they draw their own `TopBar`); the
chat is the **Chat** view of the Community tab (`CommunityChatScreen`, under the
hub's fixed title and tabs).

## Songs (`features/songs/`)

* **List.** Top bar, then two chips -- **All | Favourites**. One hairline row per
  song: a 56-point cover (the church's picture, or a quiet tile with a note --
  `SongCover`, which also falls back to the tile if a typed-in link is dead), the
  title (600 16.5/23) and who it is by (13.5/19, muted), a **solid ink heart** if the
  member favourited it, and a chevron. A row is announced "Title. Artist. Favourited".
  *Favourites* with none shows its own page ("No favourites yet -- Choose Favourite on a
  song to keep it here"), never "No songs yet", which is only for a church with no songs.
* **Favourites are the member's own, on this phone** (`favorites.ts`,
  AsyncStorage; nothing is sent anywhere). The list hears of a change made on a song's
  page while it waits underneath through `subscribeToFavoriteSongs`, so its hearts and
  its Favourites chip are current on return. A slow first read can never undo a change
  that landed before it.
* **Song.** The cover at 196 (radius 16), the title in the serif of its script (rule
  S5), the artist, a **Favourite pill** -- ink-filled with a solid heart and
  "Favourited" when chosen, outlined with an open heart and "Favourite" when not
  (never gold; the state is in words, the look, and `selected`) -- the player, and the
  lyrics under a "Lyrics" label at 17/29, a blank line being a new stanza.
* **Player** (`AudioPlayer`). A 4-point track filled in gold from the real position,
  the time played and the length at its two ends, a **Restart** pill (icon and word, 44
  high) and a **64-point round Play/Pause** whose spoken name says what pressing it does.
  The track is announced as a progress bar ("Song progress", "1:05 / 3:20"); it is not a
  scrubber. A song that will not load shows the error box.

## Events (`features/events/`)

* **List.** One row per event: a small **calendar tile** (weekday and month in gold
  ink around the day in the serif; 56x60, or 76 high in Telugu), the title (600 17/24)
  and "Wed 14 Oct, 6:30 PM · Main hall" -- "Today, 10:30 AM" for one that starts
  today (`formatEventWhen`). An event that is on now is lifted into a box with a 1.5
  red outline, a **LIVE NOW** badge (a word and a dot, not only a colour) and a
  red-tinted tile.
* **Event.** Back; the LIVE NOW badge when it is on; the title (serif of its script);
  between two hairlines, when it starts (calendar, in bold) and where (pin, the place
  in bold, and a small outlined **Open in Maps** under it) -- icons in ink, never gold;
  the description. A **live** event has a bar at the foot with one full-width red
  button, "Watch live on YouTube". No place: no place row and no Maps button. No
  description: no paragraph.
* **Live player.** The top bar carries the event's name (the event's page passes
  `title`); the video is 16:9 on black, edge to edge. A link that is not a supported
  YouTube address shows the error box with **Back to the event**, never a dead end.

## Chat (`features/community/`)

* **Runs.** The first message of a run by one person has their initial in a 28-point
  disc and their name in gold above the words; the rest of the run has a 28-point gap
  and nothing else. A member's own messages sit at the right, ink-filled, with no name
  and no disc (the screen reader still says "You said: ..."). A removed message is a
  quiet centred sentence, and ends a run.
* **A bubble** is at most 80% of the row; under the words, the time (or "Sending...")
  and **Report** (or **Delete**, for your own, hidden while it is still being sent) as a
  word with a 44-high target made by its slop. The name and the words are one spoken
  node; the time and the action are separate stops after it, so Report and Delete stay
  reachable by a screen reader.
* **Delete asks first**, in the app's own dialog (it used the platform alert).
* **The message box** is a 48-high field with a **Send** pill that waits until there is
  something to send; a failed send keeps every word and says so. A member whose
  posting is paused sees the warning notice in its place and can still read.
* **Earlier messages** are offered in gold ("Load earlier messages"), then "Loading
  earlier messages..." while they come.

## Where this differs from the stills

* **Covers are a neutral tile with a note**, not the stills' coloured placeholders: the
  church's own picture is used when it has one.
* **The chat's keyboard behaviour is unchanged** (a `KeyboardAvoidingView`); with the
  keyboard up the tab bar steps out of the way, as the design shows. Neither can be
  verified without a device, which this build environment does not have.
* **The Telugu clock** in a bubble or a row comes from the phone's ICU data; where an
  engine has none for Telugu it prints the English form.
