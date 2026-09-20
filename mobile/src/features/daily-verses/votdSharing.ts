/**
 * Sharing and copying the Verse of the Day.
 *
 * THERE IS NO SHARING LOGIC HERE. ../bible/reader/verseSharing.ts decides
 * what a shared verse looks like -- the quoted text and its reference,
 * and nothing else. This module only maps a VotdContent onto those
 * builders and picks the right one.
 *
 * NO TRANSLATION NAME AND NO LICENCE LINE. This header used to say a
 * shared verse carried the translation's published title and the IRV's
 * CC BY-SA copyright line; M6 removed both from the payload and left this
 * comment describing the old behaviour. It is corrected here rather than
 * deleted, because "the docs said the opposite" is how the removal would
 * get undone. The attribution obligation is met, permanently, by the
 * Settings screen's "Bible translations" card -- see
 * ../bible/translationCredits.ts and /BIBLE_LICENSING.md.
 *
 * THE ONE CASE THE SHARED BUILDERS CANNOT COVER is an administrator's
 * override. Its reference is a string a person typed -- "Isaiah 53:5
 * (NIV)", or a range -- so it cannot be taken apart into
 * book/chapter/label. That share is therefore the reference as written
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
