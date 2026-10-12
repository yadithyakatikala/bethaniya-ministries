# Photos and videos, as built

The church's photographs and videos: a feed, one post with its comments, and the
member's saved list. All three are pushed screens with the app's own top bar
(`features/common/TopBar.tsx`); the platform header is off.

## The feed (`features/media/MediaFeedScreen.tsx`, `MediaCard.tsx`)

* **Top bar:** Back, "Photos and videos", and at the right a bookmark that opens
  the member's saved posts.
* **A post is a row, not a card.** The picture runs edge to edge (4:3); then, in a
  20-point margin, the caption (16/24 in the interface face), the verse it quotes (a
  thin gold bar, the words in the serif of their script, the reference in gold ink),
  who and when ("Church office · Posted 5 Oct" -- the day before the month, and a year
  only when it is not this one); then four 44-point icon buttons: like, comment, share,
  save. A hairline ends the post.
* **What is on is ink.** A liked post has a solid heart, a saved one a solid ribbon, in the
  primary ink; the rest are the quiet ink. Never red (red is for a live service and for
  errors) and never gold. Each action names its current state ("Liked", "Saved") for a
  screen reader.
* **A video is a poster and a play marker.** The card never mounts a player: opening a
  post is where exactly one video is ever loaded. For a **YouTube** link the poster is the
  still YouTube keeps for the video (`i.ytimg.com`, the host the player already loads from);
  for any other video link there is no still the app can show, so the card keeps its neutral
  4:3 block with the marker on it -- the link itself is never handed to an image.
  (Before, a video's address was given to the image, which drew nothing and cost a request.)
* **Waiting** is the shape of what is coming -- a picture-shaped block and two lines --
  announced as busy; "loading more" is a quiet line at the foot. A feed that cannot be read
  says so with Try again, and keeps its top bar. A notice -- "Sign in to like, comment or
  save." (neutral) or "That did not save." (danger) -- sits above the first post.
* Paginated and pulled to refresh, not subscribed: a church feed does not need to rearrange
  itself under a thumb, and a listener over a collection that only grows spends the free
  plan's daily reads on nothing. Signed out, the feed is complete; like, comment and save
  explain once that an account is needed; share needs none.

## One post (`MediaDetailScreen.tsx`)

* **Top bar** with Back only. The picture, the player or the link card sits in a 16-radius
  frame; then the caption (17/26), the verse, who posted it, **three outlined pills** -- like,
  share, save, the one that is on in ink with a firmer outline -- a quiet **Report** (a word,
  not a glyph, and only for a signed-in member), **Comments**, and the comments as rows.
* **A YouTube video** plays in YouTube's own embed in a WebView, loaded only here.
* **Any other video link is a link card:** the caption as its title, "This video plays outside
  the app.", and an **Open video** button that hands the address to the system. The button is
  offered only for an https address; anything else is shown without it. (Before, the video's
  address was handed to an image, which drew nothing.)
* **Comments** are the one live listener in the feature, only while the screen is open. They
  are rows: the name, the words (interface face: a comment's script is unknown), and a small
  Report -- or Delete for one's own. If they cannot be read the screen says "Comments could not
  be loaded." with **Try again**, which listens again.
* **The comment box is fixed to the foot:** a field and Post. A draft is cleared only after the
  write is accepted; a failed post keeps the draft and says so above the field. Signed out
  there is no box, only the sentence that says why.

## Saved (`SavedMediaScreen.tsx`)

Rows of a 72-point rounded thumbnail (a small play marker on a video's), the caption in up to
three lines, and a chevron; "Saved media" in the top bar. One query: a save carries a small
copy of the post. Opening one re-reads the real post. A post that has been deleted or
unpublished says "This post is no longer available." -- which is not the same as a read that
failed ("Could not load"), and the two are told apart.

## Where this differs from the stills

* The play marker on a saved thumbnail is a small ink disc with the triangle, not the bare
  glyph, so it stays visible on any picture.
* A video post's poster is YouTube's still where there is one; the stills show grey
  placeholders for every picture.
