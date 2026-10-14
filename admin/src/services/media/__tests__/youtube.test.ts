import { describe, expect, it } from 'vitest';
import {
  describeVideoLinkProblem,
  looksLikeYouTube,
  parseYouTubeUrl,
  youTubeEmbedUrl,
  youTubeThumbnailUrl,
  youTubeWatchUrl,
} from '../youtube';

const ID = 'dQw4w9WgXcQ';

describe('parseYouTubeUrl', () => {
  it.each([
    [`https://www.youtube.com/watch?v=${ID}`],
    [`https://youtube.com/watch?v=${ID}`],
    [`https://m.youtube.com/watch?v=${ID}`],
    [`https://music.youtube.com/watch?v=${ID}`],
    [`https://www.youtube.com/watch?v=${ID}&t=42s&list=PLabc`],
    [`https://youtu.be/${ID}`],
    [`https://youtu.be/${ID}?si=abcdef`],
    [`https://www.youtube.com/embed/${ID}`],
    [`https://www.youtube-nocookie.com/embed/${ID}`],
    [`https://www.youtube.com/live/${ID}`],
    [`https://www.youtube.com/shorts/${ID}`],
    [`  https://www.youtube.com/watch?v=${ID}  `],
    [`http://www.youtube.com/watch?v=${ID}`],
  ])('reads %s', (input) => {
    expect(parseYouTubeUrl(input)).toEqual({
      videoId: ID,
      canonicalUrl: `https://www.youtube.com/watch?v=${ID}`,
    });
  });

  it('always returns the https canonical form the phone can play', () => {
    expect(parseYouTubeUrl(`http://youtu.be/${ID}`)?.canonicalUrl).toMatch(/^https:\/\//);
  });

  it.each([
    [''],
    ['not a url'],
    ['https://www.youtube.com/'],
    ['https://www.youtube.com/channel/UCabcdefghijklmnopqrstuv'],
    ['https://www.youtube.com/playlist?list=PLabcdefghijk'],
    ['https://www.youtube.com/watch?v=short'],
    ['https://www.youtube.com/watch?v=has spaces!'],
    [`https://vimeo.com/${ID}`],
    [`https://youtube.com.example.org/watch?v=${ID}`],
    [`https://notyoutube.com/watch?v=${ID}`],
    [`https://youtube.com@evil.example/watch?v=${ID}`],
    [`javascript:alert(1)//youtube.com/watch?v=${ID}`],
    [`ftp://www.youtube.com/watch?v=${ID}`],
    [`https://youtu.be/${ID}/extra`],
  ])('does not accept "%s"', (input) => {
    expect(parseYouTubeUrl(input)).toBeNull();
  });

  it('refuses an absurdly long input', () => {
    expect(
      parseYouTubeUrl(`https://www.youtube.com/watch?v=${ID}&x=${'a'.repeat(2100)}`)
    ).toBeNull();
  });
});

describe('addresses built from an id', () => {
  it('builds the watch, privacy-enhanced embed and thumbnail addresses', () => {
    expect(youTubeWatchUrl(ID)).toBe(`https://www.youtube.com/watch?v=${ID}`);
    expect(youTubeEmbedUrl(ID)).toBe(`https://www.youtube-nocookie.com/embed/${ID}`);
    expect(youTubeThumbnailUrl(ID)).toBe(`https://i.ytimg.com/vi/${ID}/hqdefault.jpg`);
  });
});

describe('describeVideoLinkProblem', () => {
  it('has no complaint about a valid YouTube video', () => {
    expect(describeVideoLinkProblem(`https://youtu.be/${ID}`)).toBeNull();
  });

  it('does not reject other https links: existing feed posts use them', () => {
    expect(describeVideoLinkProblem('https://example.org/clip.mp4')).toBeNull();
  });

  it('explains a YouTube address that is not a single video', () => {
    expect(
      describeVideoLinkProblem('https://www.youtube.com/channel/UCabcdefghijklmnopqrstuv')
    ).toMatch(/does not point at a single video/);
    expect(describeVideoLinkProblem('https://www.youtube.com/playlist?list=PLx')).toMatch(
      /single video/
    );
  });

  it('asks for an address when there is none', () => {
    expect(describeVideoLinkProblem('   ')).toBe('Paste the video address.');
  });

  it('recognises YouTube-looking text without being fooled by look-alikes', () => {
    expect(looksLikeYouTube('https://www.youtube.com/anything')).toBe(true);
    expect(looksLikeYouTube('youtu.be/abc')).toBe(true);
    expect(looksLikeYouTube('https://youtube.com.example.org/x')).toBe(false);
    expect(looksLikeYouTube('https://example.org/about-youtube')).toBe(false);
  });
});
