import { MAX_MEDIA_URL_LENGTH, isValidMediaUrl, mediaUrlProblem } from '../mediaUrl';

/**
 * The link is the whole attack surface -- nothing is ever uploaded (see
 * ../mediaUrl.ts). These are the rules, stated as rules, and they are
 * mirrored in firestore.rules, which is the actual boundary.
 */
describe('links the app will load', () => {
  it('accepts an ordinary https image or video link', () => {
    expect(isValidMediaUrl('https://example.org/photo.jpg')).toBe(true);
    expect(isValidMediaUrl('https://cdn.example.org/a/b/c.png?w=800&sig=x')).toBe(true);
    expect(isValidMediaUrl('https://www.youtube.com/watch?v=abcdefghijk')).toBe(true);
    expect(isValidMediaUrl('https://example.org/video.mp4')).toBe(true);
  });

  it('accepts a link with no file extension at all', () => {
    // A CDN or a share link often has none, and that is not suspicious.
    expect(isValidMediaUrl('https://example.org/media/12345')).toBe(true);
  });

  it('ignores surrounding whitespace, because people paste', () => {
    expect(isValidMediaUrl('  https://example.org/photo.jpg  ')).toBe(true);
  });
});

describe('links the app refuses, and why', () => {
  it('refuses every scheme but https', () => {
    // An allowlist of one, not a blocklist: a scheme nobody thought of
    // cannot get past it.
    expect(mediaUrlProblem('http://example.org/photo.jpg')).toBe('notHttps');
    expect(mediaUrlProblem('ftp://example.org/photo.jpg')).toBe('notHttps');
    expect(mediaUrlProblem('file:///etc/passwd')).toBe('notHttps');
    expect(mediaUrlProblem('content://media/external/images/1')).toBe('notHttps');
  });

  it('refuses the schemes that would run something', () => {
    expect(mediaUrlProblem('javascript:alert(1)')).toBe('notHttps');
    expect(mediaUrlProblem('JavaScript:alert(1)')).toBe('notHttps');
    expect(
      mediaUrlProblem('data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==')
    ).toBe('notHttps');
    expect(mediaUrlProblem('blob:https://example.org/abc')).toBe('notHttps');
  });

  it('refuses credentials embedded in the URL', () => {
    // Parsers disagree about where the host ends when there is an '@',
    // and that disagreement is how a link that reads as one host loads
    // another.
    expect(mediaUrlProblem('https://user:pass@evil.example/photo.jpg')).toBe(
      'hasCredentials'
    );
    expect(mediaUrlProblem('https://user@evil.example/photo.jpg')).toBe('hasCredentials');
  });

  it('refuses executables and installers, however they are hosted', () => {
    for (const url of [
      'https://example.org/app.apk',
      'https://example.org/setup.exe',
      'https://example.org/run.sh',
      'https://example.org/thing.jar',
      'https://example.org/page.html',
      'https://example.org/script.js',
      'https://example.org/image.svg',
    ]) {
      expect(mediaUrlProblem(url)).toBe('executable');
    }
  });

  it('checks the path, not the query, for those extensions', () => {
    // A legitimate link whose query string happens to mention one is not
    // an executable.
    expect(isValidMediaUrl('https://example.org/photo.jpg?ref=page.html')).toBe(true);
  });

  it('is not fooled by capitalisation', () => {
    expect(mediaUrlProblem('https://example.org/APP.APK')).toBe('executable');
  });

  it('refuses nothing, whitespace and malformed text', () => {
    expect(mediaUrlProblem('')).toBe('empty');
    expect(mediaUrlProblem('   ')).toBe('empty');
    expect(mediaUrlProblem('not a url')).toBe('malformed');
    expect(mediaUrlProblem('example.org/photo.jpg')).toBe('malformed');
    expect(mediaUrlProblem('//example.org/photo.jpg')).toBe('malformed');
    expect(mediaUrlProblem('https://')).toBe('malformed');
  });

  it('refuses a URL long enough to be a payload rather than a link', () => {
    expect(
      mediaUrlProblem(`https://example.org/${'x'.repeat(MAX_MEDIA_URL_LENGTH)}`)
    ).toBe('tooLong');
  });

  it('says WHICH problem it found, so a form can explain itself', () => {
    // "Invalid URL" tells an administrator nothing about a link they are
    // sure is fine.
    expect(mediaUrlProblem('http://example.org/a.jpg')).not.toBe(
      mediaUrlProblem('https://example.org/a.apk')
    );
  });
});
