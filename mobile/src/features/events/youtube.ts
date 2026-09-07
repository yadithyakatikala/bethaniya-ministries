/**
 * YouTube URL parsing for the in-app player (Day 7, Option B -- see
 * FINAL_ARCHITECTURE_SPECIFICATION.md's Day 7 section and the approved
 * implementation decisions). This is the AUTHORITATIVE parser: it decides
 * whether YouTubePlayerScreen.tsx can actually attempt playback, unlike
 * admin/src/features/events/validation.ts's validateEventYouTubeUrl(),
 * which is a lightweight admin-form UX hint only.
 *
 * Deliberately narrow: only extracts a plausible 11-character YouTube
 * video ID from a small set of known, standard YouTube URL shapes
 * (watch/short/live/embed links, on youtube.com, m.youtube.com, or
 * youtu.be). No YouTube/Google API call is made, nothing is downloaded,
 * proxied, or re-hosted -- the only thing built here is the official
 * https://www.youtube.com/embed/<id> URL, handed to react-native-webview
 * to load directly (YouTube's own player, running on YouTube's own
 * servers, inside the WebView).
 *
 * If a URL doesn't match a recognized shape, parseYouTubeVideoId returns
 * null rather than guessing -- YouTubePlayerScreen.tsx shows a clear
 * error instead of attempting to load a garbage embed URL.
 */

/** Conventional YouTube video ID shape. */
const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

/**
 * Extracts an 11-character YouTube video ID from a supported URL shape, or
 * returns null if the URL isn't a recognized YouTube link. Supported
 * shapes: youtube.com/watch?v=ID (and m.youtube.com), youtu.be/ID,
 * youtube.com/live/ID, youtube.com/embed/ID (and www./m. variants of all
 * of the above). Anything else (a channel URL, a playlist-only URL, a
 * non-YouTube host, malformed input) returns null.
 */
export function parseYouTubeVideoId(url: string): string | null {
  const trimmed = url.trim();
  if (trimmed.length === 0) return null;

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;

  const host = parsed.hostname.toLowerCase().replace(/^www\.|^m\./, '');

  if (host === 'youtu.be') {
    const id = parsed.pathname.replace(/^\//, '');
    return VIDEO_ID_PATTERN.test(id) ? id : null;
  }

  if (host === 'youtube.com') {
    if (parsed.pathname === '/watch') {
      const id = parsed.searchParams.get('v');
      return id && VIDEO_ID_PATTERN.test(id) ? id : null;
    }
    const liveMatch = parsed.pathname.match(/^\/live\/([^/]+)$/);
    if (liveMatch) {
      return VIDEO_ID_PATTERN.test(liveMatch[1]) ? liveMatch[1] : null;
    }
    const embedMatch = parsed.pathname.match(/^\/embed\/([^/]+)$/);
    if (embedMatch) {
      return VIDEO_ID_PATTERN.test(embedMatch[1]) ? embedMatch[1] : null;
    }
    return null;
  }

  return null;
}

/**
 * Builds YouTube's official embed player URL for a given video ID -- the
 * ONLY URL this app ever hands to react-native-webview for YouTube
 * playback. `playsinline=1` avoids an unexpected fullscreen takeover on
 * iOS; no autoplay is requested.
 */
export function buildYouTubeEmbedUrl(videoId: string): string {
  return `https://www.youtube.com/embed/${videoId}?playsinline=1`;
}

/**
 * Convenience: parses a YouTube URL directly to its official embed URL, or
 * null if the URL isn't a recognized/supported YouTube link.
 */
export function toYouTubeEmbedUrl(url: string): string | null {
  const videoId = parseYouTubeVideoId(url);
  return videoId ? buildYouTubeEmbedUrl(videoId) : null;
}
