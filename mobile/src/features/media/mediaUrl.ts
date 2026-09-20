/**
 * What counts as a media URL this app will load.
 *
 * =====================================================================
 * WHY THE APP ONLY EVER HOLDS A URL
 * =====================================================================
 * This project runs on Firebase's free Spark plan, which has no Cloud
 * Storage bucket and no deployable Cloud Functions. Media is therefore
 * NEVER uploaded anywhere by this app: an administrator hosts the image
 * or video wherever they already do -- a church website, a photo host,
 * YouTube -- and pastes the link. The app stores the link and the
 * metadata around it, and nothing else. There is no upload path to
 * secure because there is no upload.
 *
 * That makes the link itself the entire attack surface, which is what
 * this module is about.
 *
 * =====================================================================
 * WHAT IS REJECTED, AND WHY EACH ONE
 * =====================================================================
 *  * ANYTHING BUT https. `http://` is rejected because Android blocks
 *    cleartext by default (it would render as a broken image anyway) and
 *    because a plain-text link can be rewritten in transit. `javascript:`,
 *    `data:`, `file:`, `blob:`, `content:` and every other scheme are
 *    rejected outright rather than filtered: an allowlist of one scheme
 *    cannot be got round by a scheme nobody thought of.
 *  * CREDENTIALS IN THE URL (`https://user:pass@host/…`). Some parsers
 *    read the host as everything after the '@' and some as everything
 *    before it, and that disagreement is how a link that looks like one
 *    host loads another.
 *  * EXECUTABLE AND INSTALLER FILE EXTENSIONS. A media post points at a
 *    picture or a video. A `.apk`, `.exe`, `.sh` or `.html` link in a
 *    church feed is either a mistake or an attack, and neither should be
 *    one tap away from a congregation.
 *
 * =====================================================================
 * WHAT IS NOT CLAIMED
 * =====================================================================
 * This does NOT verify that the link resolves, that it is really an
 * image, or that the host is trustworthy -- it cannot, without fetching
 * it, and fetching a URL to check it is its own problem. It is a
 * well-formedness and scheme gate. The real containment is that a video
 * plays inside a WebView pointed at the URL and an image goes to
 * <Image>, so nothing here ever becomes code the app runs.
 *
 * The same rules are enforced again in firestore.rules, because a client
 * check is a convenience and a server check is the boundary.
 */

/** The only scheme this app will load media over. */
const ALLOWED_PROTOCOL = 'https:';

/**
 * Extensions that have no business in a media post. Checked against the
 * URL's PATH only, so a query string mentioning one is not a false
 * positive.
 */
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
  '.svg', // can carry script when rendered as a document
  '.php',
  '.py',
];

/** Long enough for any real link, short enough not to be a payload. */
export const MAX_MEDIA_URL_LENGTH = 2000;

export type MediaUrlProblem =
  'empty' | 'tooLong' | 'malformed' | 'notHttps' | 'hasCredentials' | 'executable';

/**
 * Why this URL cannot be used, or `null` when it can.
 *
 * Returns the REASON rather than a boolean so the admin form can say
 * what is wrong instead of "invalid URL", which tells an administrator
 * nothing about a link they are sure is fine.
 */
export function mediaUrlProblem(input: string): MediaUrlProblem | null {
  const trimmed = input.trim();
  if (trimmed.length === 0) return 'empty';
  if (trimmed.length > MAX_MEDIA_URL_LENGTH) return 'tooLong';

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return 'malformed';
  }

  if (parsed.protocol !== ALLOWED_PROTOCOL) return 'notHttps';
  if (parsed.username.length > 0 || parsed.password.length > 0) return 'hasCredentials';
  if (parsed.hostname.length === 0) return 'malformed';

  const path = parsed.pathname.toLowerCase();
  if (FORBIDDEN_EXTENSIONS.some((extension) => path.endsWith(extension))) {
    return 'executable';
  }

  return null;
}

export function isValidMediaUrl(input: string): boolean {
  return mediaUrlProblem(input) === null;
}
