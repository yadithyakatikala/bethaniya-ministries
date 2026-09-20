/**
 * Client-side media-post validation -- M6.
 *
 * Mirrors firestore.rules' isValidMediaPost(), which is the real
 * boundary; this exists so a mistake is caught in the form, with a
 * sentence that says what is wrong, rather than as a permission error
 * after Save that says nothing.
 *
 * =====================================================================
 * THE MEDIA URL IS THE WHOLE POINT OF THIS FILE
 * =====================================================================
 * Nothing is uploaded anywhere -- this project has no Cloud Storage
 * bucket (see ../../services/firebase/media.ts) -- so a media post is a
 * link, and the link is the entire attack surface.
 *
 * The rules, and why each one:
 *  * HTTPS ONLY, as an allowlist of one rather than a list of banned
 *    schemes. http:// would be blocked by Android's cleartext policy and
 *    render as a broken image; javascript:, data:, file: and blob: are
 *    refused by the same rule without having to be enumerated, and so is
 *    any scheme nobody has thought of.
 *  * NO CREDENTIALS IN THE URL. Parsers disagree about where the host
 *    ends when there is an '@', and that disagreement is how a link that
 *    reads as one host loads another.
 *  * NO EXECUTABLE OR DOCUMENT EXTENSIONS. A media post points at a
 *    picture or a video; an .apk or .html link in a church feed is either
 *    a mistake or an attack, and neither should be one tap from a
 *    congregation.
 *
 * The same list, with the same reasoning, is enforced on the phone in
 * mobile/src/features/media/mediaUrl.ts. It is duplicated rather than
 * shared because the two packages have no common module and inventing
 * one for six rules would couple a browser build to a React Native one
 * -- the same call ./events' validateEventYouTubeUrl already made. The
 * tests on both sides assert the same cases, so a divergence shows up as
 * a failure rather than as a link that one half accepts.
 */
export const MEDIA_URL_MAX_LENGTH = 2000;
export const MEDIA_CAPTION_MAX_LENGTH = 2000;
export const MEDIA_VERSE_REFERENCE_MAX_LENGTH = 200;
export const MEDIA_VERSE_TEXT_MAX_LENGTH = 2000;

/** Refused in a media post's path. Matched case-insensitively. */
const FORBIDDEN_EXTENSIONS = [
  '.apk',
  '.exe',
  '.msi',
  '.dmg',
  '.bat',
  '.cmd',
  '.com',
  '.scr',
  '.jar',
  '.sh',
  '.bash',
  '.ps1',
  '.vbs',
  '.js',
  '.mjs',
  '.html',
  '.htm',
  '.svg',
  '.php',
  '.py',
];

export type MediaUrlProblem =
  'empty' | 'tooLong' | 'malformed' | 'notHttps' | 'hasCredentials' | 'executable';

/**
 * Why this URL cannot be used, or `null` when it can.
 *
 * Returns the REASON rather than a boolean, so the form can say what is
 * wrong: "invalid URL" tells an administrator nothing about a link they
 * are sure is fine.
 *
 * Parsed with `URL` rather than matched with a regular expression -- a
 * pattern that looks right ("starts with https://") also accepts
 * "https://" alone and "https:/example.org".
 */
export function mediaUrlProblem(input: string): MediaUrlProblem | null {
  const trimmed = input.trim();
  if (trimmed.length === 0) return 'empty';
  if (trimmed.length > MEDIA_URL_MAX_LENGTH) return 'tooLong';

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return 'malformed';
  }

  if (parsed.protocol !== 'https:') return 'notHttps';
  if (parsed.username.length > 0 || parsed.password.length > 0) return 'hasCredentials';
  if (parsed.hostname.length === 0) return 'malformed';

  const path = parsed.pathname.toLowerCase();
  if (FORBIDDEN_EXTENSIONS.some((extension) => path.endsWith(extension))) {
    return 'executable';
  }
  return null;
}

/** The sentence an administrator sees for each problem. */
export const MEDIA_URL_MESSAGES: Record<MediaUrlProblem, string> = {
  empty: 'A media link is required.',
  tooLong: `The link must be ${MEDIA_URL_MAX_LENGTH} characters or fewer.`,
  malformed: 'That is not a complete web address. It should start with https://',
  notHttps: 'The link must start with https:// — other kinds of link are not allowed.',
  hasCredentials: 'The link must not contain a username or password.',
  executable:
    'That link points at a file this app will not open. Use a link to an image or a video.',
};

export interface MediaValidationInput {
  mediaUrl: string;
  caption: string;
  verseReference: string;
  verseText: string;
  /** The value of an <input type="datetime-local">, or ''. */
  publishAt: string;
}

export interface MediaValidationErrors {
  mediaUrl?: string;
  caption?: string;
  verseReference?: string;
  verseText?: string;
  publishAt?: string;
}

export function validateMediaInput(input: MediaValidationInput): MediaValidationErrors {
  const errors: MediaValidationErrors = {};

  const urlProblem = mediaUrlProblem(input.mediaUrl);
  if (urlProblem) errors.mediaUrl = MEDIA_URL_MESSAGES[urlProblem];

  // A CAPTION IS REQUIRED. A post with a picture and nothing to say is
  // the thing "do not allow accidental publishing of incomplete media
  // posts" is about: it looks finished in the list and says nothing in
  // the feed.
  const caption = input.caption.trim();
  if (caption.length === 0) {
    errors.caption = 'A caption is required.';
  } else if (caption.length > MEDIA_CAPTION_MAX_LENGTH) {
    errors.caption = `The caption must be ${MEDIA_CAPTION_MAX_LENGTH} characters or fewer.`;
  }

  // The verse is optional, and its two halves are independently optional
  // -- a post may cite "John 3:16" without quoting it.
  if (input.verseReference.trim().length > MEDIA_VERSE_REFERENCE_MAX_LENGTH) {
    errors.verseReference = `The reference must be ${MEDIA_VERSE_REFERENCE_MAX_LENGTH} characters or fewer.`;
  }
  if (input.verseText.trim().length > MEDIA_VERSE_TEXT_MAX_LENGTH) {
    errors.verseText = `The verse must be ${MEDIA_VERSE_TEXT_MAX_LENGTH} characters or fewer.`;
  }

  // REQUIRED, not optional. The read rule compares publishAt to the
  // server clock, so a post without one is invisible to members and
  // looks like a publishing bug rather than a missing field.
  if (input.publishAt.trim().length === 0) {
    errors.publishAt = 'A publish date and time is required.';
  } else if (Number.isNaN(new Date(input.publishAt).getTime())) {
    errors.publishAt = 'That date and time could not be read.';
  }

  return errors;
}

export function hasMediaValidationErrors(errors: MediaValidationErrors): boolean {
  return Object.keys(errors).length > 0;
}
