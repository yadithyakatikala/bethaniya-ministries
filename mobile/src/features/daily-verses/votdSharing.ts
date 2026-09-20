/**
 * Sharing and copying the Verse of the Day.
 *
 * THERE IS NO SHARING LOGIC HERE. M4 already decided what a shared verse
 * looks like -- quoted text, the reference, the translation's published
 * name, and the IRV's CC BY-SA attribution, which a share into a chat
 * legally requires (see ../bible/reader/verseSharing.ts and
 * /BIBLE_LICENSING.md). This module only maps a VotdContent onto those
 * builders and picks the right one.
 *
 * THE ONE CASE M4 CANNOT COVER is an administrator's override. Its
 * reference is a string a person typed -- "Isaiah 53:5 (NIV)", or a range
 * -- so it cannot be taken apart into book/chapter/label, and its
 * translation is unknown, so no translation name or licence line can
 * honestly be attached. That share is therefore the reference as written
 * and the text as written, and nothing invented.
 */
import {
  buildBilingualCopyText,
  buildBilingualShareText,
  buildCopyText,
  buildShareText,
  copyText,
  shareText,
} from '../bible/reader/verseSharing';
import type { VotdBody, VotdContent } from './votdResolver';

export { copyText, shareText };

/** One string for a body that has no paired form to share. An override is
 *  always `text`; the other arms are here so this is total. */
function singleTextOf(body: VotdBody): string {
  return body.kind === 'text' ? body.text : body.english;
}

export function buildVotdShareText(content: VotdContent): string {
  const { citation, body } = content;
  if (!citation) {
    // An override: quoted, referenced, and nothing claimed about which
    // translation it came from.
    return `"${singleTextOf(body).trim()}"\n\n${content.reference}`;
  }

  if (body.kind === 'paired') {
    return buildBilingualShareText({
      ...citation,
      english: body.english,
      telugu: body.telugu,
    });
  }
  if (body.kind === 'englishOnly') {
    return buildShareText({ ...citation, text: body.english });
  }
  return buildShareText({ ...citation, text: body.text });
}

export function buildVotdCopyText(content: VotdContent): string {
  const { citation, body } = content;
  if (!citation) return `${content.reference}\n${singleTextOf(body).trim()}`;

  if (body.kind === 'paired') {
    return buildBilingualCopyText({
      ...citation,
      english: body.english,
      telugu: body.telugu,
    });
  }
  return buildCopyText({ ...citation, text: singleTextOf(body) });
}
