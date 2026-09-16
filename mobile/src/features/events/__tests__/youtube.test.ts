import {
  buildYouTubeEmbedUrl,
  isAllowedPlayerNavigation,
  parseYouTubeVideoId,
  toYouTubeEmbedUrl,
} from '../youtube';

const VIDEO_ID = 'dQw4w9WgXcQ';

describe('parseYouTubeVideoId', () => {
  it('parses a youtube.com/watch?v= URL', () => {
    expect(parseYouTubeVideoId(`https://www.youtube.com/watch?v=${VIDEO_ID}`)).toBe(
      VIDEO_ID
    );
  });

  it('parses a bare (no www) youtube.com/watch URL', () => {
    expect(parseYouTubeVideoId(`https://youtube.com/watch?v=${VIDEO_ID}`)).toBe(VIDEO_ID);
  });

  it('parses an m.youtube.com/watch URL', () => {
    expect(parseYouTubeVideoId(`https://m.youtube.com/watch?v=${VIDEO_ID}`)).toBe(
      VIDEO_ID
    );
  });

  it('parses a youtu.be short URL', () => {
    expect(parseYouTubeVideoId(`https://youtu.be/${VIDEO_ID}`)).toBe(VIDEO_ID);
  });

  it('parses a youtube.com/live URL', () => {
    expect(parseYouTubeVideoId(`https://www.youtube.com/live/${VIDEO_ID}`)).toBe(
      VIDEO_ID
    );
  });

  it('parses a youtube.com/embed URL (passthrough)', () => {
    expect(parseYouTubeVideoId(`https://www.youtube.com/embed/${VIDEO_ID}`)).toBe(
      VIDEO_ID
    );
  });

  it('ignores extra query params on a watch URL', () => {
    expect(
      parseYouTubeVideoId(`https://www.youtube.com/watch?v=${VIDEO_ID}&t=42s&list=PL123`)
    ).toBe(VIDEO_ID);
  });

  it('returns null for a non-YouTube host', () => {
    expect(parseYouTubeVideoId('https://example.com/watch?v=dQw4w9WgXcQ')).toBeNull();
  });

  it('returns null for a YouTube channel URL (no video ID)', () => {
    expect(parseYouTubeVideoId('https://www.youtube.com/@SomeChannel')).toBeNull();
  });

  it('returns null for a watch URL missing the v param', () => {
    expect(parseYouTubeVideoId('https://www.youtube.com/watch')).toBeNull();
  });

  it('returns null for an unparseable/malformed URL', () => {
    expect(parseYouTubeVideoId('not a url at all')).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(parseYouTubeVideoId('')).toBeNull();
    expect(parseYouTubeVideoId('   ')).toBeNull();
  });

  it('returns null for a non-http(s) scheme', () => {
    expect(parseYouTubeVideoId(`ftp://youtube.com/watch?v=${VIDEO_ID}`)).toBeNull();
  });

  it('returns null when the extracted ID is not 11 characters', () => {
    expect(parseYouTubeVideoId('https://youtu.be/short')).toBeNull();
  });
});

describe('buildYouTubeEmbedUrl', () => {
  it('builds the official embed URL for a video ID', () => {
    expect(buildYouTubeEmbedUrl(VIDEO_ID)).toBe(
      `https://www.youtube.com/embed/${VIDEO_ID}?playsinline=1`
    );
  });
});

describe('toYouTubeEmbedUrl', () => {
  it('resolves a supported URL straight to its embed URL', () => {
    expect(toYouTubeEmbedUrl(`https://youtu.be/${VIDEO_ID}`)).toBe(
      `https://www.youtube.com/embed/${VIDEO_ID}?playsinline=1`
    );
  });

  it('returns null for an unsupported URL', () => {
    expect(toYouTubeEmbedUrl('https://example.com/video')).toBeNull();
  });
});

/**
 * Navigation allow-list for the in-app player WebView.
 *
 * That WebView previously had no restriction at all. YouTube's embed page
 * has tappable links ("Watch on YouTube", the channel name, end-screen
 * cards), so a member could be navigated to an arbitrary page inside a
 * chrome-less in-app browser with no URL bar and no sign they had left the
 * app. See isAllowedPlayerNavigation() in ../youtube.ts.
 */
describe('isAllowedPlayerNavigation', () => {
  it("allows YouTube's own player and playback infrastructure", () => {
    expect(isAllowedPlayerNavigation('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe(
      true
    );
    expect(isAllowedPlayerNavigation('https://youtube.com/embed/dQw4w9WgXcQ')).toBe(true);
    expect(isAllowedPlayerNavigation('https://i.ytimg.com/vi/x/hqdefault.jpg')).toBe(true);
    expect(
      isAllowedPlayerNavigation('https://r1---sn-x.googlevideo.com/videoplayback')
    ).toBe(true);
    expect(
      isAllowedPlayerNavigation('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ')
    ).toBe(true);
  });

  it("allows about:blank (the WebView's own startup navigation)", () => {
    expect(isAllowedPlayerNavigation('about:blank')).toBe(true);
  });

  it('refuses an unrelated host', () => {
    expect(isAllowedPlayerNavigation('https://evil.example.com/phish')).toBe(false);
  });

  it('refuses a lookalike host that merely contains an allowed name', () => {
    // A suffix check must not be satisfiable by appending the real domain
    // to an attacker-controlled one, or by prefixing it.
    expect(isAllowedPlayerNavigation('https://youtube.com.evil.example')).toBe(false);
    expect(isAllowedPlayerNavigation('https://notyoutube.com/embed/x')).toBe(false);
    expect(isAllowedPlayerNavigation('https://evilyoutube.com')).toBe(false);
  });

  it('refuses non-https schemes, including app deep links', () => {
    expect(isAllowedPlayerNavigation('http://www.youtube.com/embed/x')).toBe(false);
    expect(isAllowedPlayerNavigation('intent://www.youtube.com/#Intent;end')).toBe(false);
    expect(isAllowedPlayerNavigation('market://details?id=com.evil')).toBe(false);
    expect(isAllowedPlayerNavigation('javascript:alert(1)')).toBe(false);
  });

  it('refuses an unparseable or empty URL rather than throwing', () => {
    expect(isAllowedPlayerNavigation('not a url')).toBe(false);
    expect(isAllowedPlayerNavigation('')).toBe(false);
  });
});
