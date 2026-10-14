/**
 * Reading YouTube links in the admin, and previewing them.
 *
 * Long video -- sermons, recordings, music videos, livestream replays --
 * belongs on YouTube, not in Cloudinary. A hundred-megabyte file would
 * use a free account's bandwidth in a handful of views, and YouTube
 * already does the hard parts (encoding, adaptive quality, captions). The
 * admin therefore stores a LINK, and this module is what makes a link
 * safe and pleasant to paste.
 *
 * THE ADMIN IS MORE FORGIVING THAN THE APP, ON PURPOSE. The phone's parser
 * (mobile/src/features/events/youtube.ts) accepts four shapes: watch,
 * youtu.be, live and embed. An administrator copying from a browser tab,
 * a phone's Share sheet or YouTube Music will meet others -- a Shorts
 * address, a music.youtube.com address, an `http://` one -- so this parser
 * accepts those too and then returns ONE canonical form,
 * `https://www.youtube.com/watch?v=<id>`, which the phone is guaranteed to
 * play. What is stored is always the canonical address, never what was
 * pasted.
 *
 * Parsed with `URL`, never with a pattern over the whole string, and the
 * host is compared EXACTLY against a short allowlist. A look-alike such
 * as `youtube.com.example.org` or `https://youtube.com@evil.example/` is
 * therefore not a YouTube link.
 */

/** A YouTube video id is exactly eleven of these characters. */
const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
]);

export interface ParsedYouTube {
  videoId: string;
  /** `https://www.youtube.com/watch?v=<id>` -- what gets stored. */
  canonicalUrl: string;
}

export function youTubeWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

/**
 * YouTube's privacy-enhanced player: it sets no tracking cookies until the
 * viewer plays the video. Used for the admin's preview only.
 */
export function youTubeEmbedUrl(videoId: string): string {
  return `https://www.youtube-nocookie.com/embed/${videoId}`;
}

/** The still picture YouTube keeps for a video. Same host the phone uses. */
export function youTubeThumbnailUrl(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

function idFromPath(pathname: string, prefix: string): string | null {
  if (!pathname.startsWith(prefix)) return null;
  const rest = pathname.slice(prefix.length);
  // Exactly one more segment, which may be followed by a trailing slash.
  const id = rest.replace(/\/$/, '');
  return VIDEO_ID_PATTERN.test(id) ? id : null;
}

/** The video behind a YouTube link, or null if it is not a single video. */
export function parseYouTubeUrl(input: string): ParsedYouTube | null {
  const trimmed = input.trim();
  if (trimmed.length === 0 || trimmed.length > 2000) return null;

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  // `https://youtube.com@evil.example/` has a username and a different host.
  if (url.username || url.password) return null;

  const host = url.hostname.toLowerCase();
  let videoId: string | null = null;

  if (host === 'youtu.be') {
    videoId = idFromPath(url.pathname, '/');
  } else if (YOUTUBE_HOSTS.has(host)) {
    if (url.pathname === '/watch') {
      const candidate = url.searchParams.get('v');
      videoId = candidate && VIDEO_ID_PATTERN.test(candidate) ? candidate : null;
    } else {
      videoId =
        idFromPath(url.pathname, '/embed/') ??
        idFromPath(url.pathname, '/live/') ??
        idFromPath(url.pathname, '/shorts/') ??
        idFromPath(url.pathname, '/v/');
    }
  }

  return videoId ? { videoId, canonicalUrl: youTubeWatchUrl(videoId) } : null;
}

/** Whether the text is a YouTube address of any shape (even a bad one). */
export function looksLikeYouTube(input: string): boolean {
  return /(^|[/.@])(youtube(-nocookie)?\.com|youtu\.be)(\/|$|:|\?)/i.test(input.trim());
}

/**
 * What to tell an administrator about a pasted video address, or null if
 * it is fine. A non-YouTube https link is NOT an error -- existing feed
 * posts use them, and the form says how they will be shown -- so this only
 * complains about things that cannot work.
 */
export function describeVideoLinkProblem(input: string): string | null {
  const trimmed = input.trim();
  if (trimmed.length === 0) return 'Paste the video address.';
  if (parseYouTubeUrl(trimmed)) return null;
  if (looksLikeYouTube(trimmed)) {
    return 'That YouTube address does not point at a single video. Open the video itself and copy its address from the browser, or use the Share button.';
  }
  return null;
}
