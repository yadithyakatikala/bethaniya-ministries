import { describe, expect, it } from 'vitest';
import {
  MEDIA_CAPTION_MAX_LENGTH,
  MEDIA_URL_MAX_LENGTH,
  MEDIA_URL_MESSAGES,
  hasMediaValidationErrors,
  mediaUrlProblem,
  validateMediaInput,
} from '../validation';

/**
 * The link is the whole attack surface -- nothing is ever uploaded (see
 * ../../../services/firebase/media.ts).
 *
 * These cases are deliberately the SAME cases
 * mobile/src/features/media/__tests__/mediaUrl.test.ts asserts. The two
 * validators are duplicated because the packages share no module, so the
 * tests are what keep them from drifting: a rule relaxed on one side and
 * not the other shows up here as a failure rather than as a link one half
 * of the product accepts.
 */
function input(partial: Partial<Parameters<typeof validateMediaInput>[0]> = {}) {
  return {
    mediaUrl: 'https://example.org/photo.jpg',
    caption: 'Sunday worship',
    verseReference: '',
    verseText: '',
    publishAt: '2026-04-01T09:00',
    ...partial,
  };
}

describe('links the admin will accept', () => {
  it('accepts an ordinary https image or video link', () => {
    expect(mediaUrlProblem('https://example.org/photo.jpg')).toBeNull();
    expect(mediaUrlProblem('https://cdn.example.org/a/b.png?w=800&sig=x')).toBeNull();
    expect(mediaUrlProblem('https://www.youtube.com/watch?v=abcdefghijk')).toBeNull();
  });

  it('accepts a link with no extension, which a CDN often has', () => {
    expect(mediaUrlProblem('https://example.org/media/12345')).toBeNull();
  });

  it('ignores surrounding whitespace, because people paste', () => {
    expect(mediaUrlProblem('  https://example.org/photo.jpg  ')).toBeNull();
  });
});

describe('links the admin refuses, and why', () => {
  it('refuses every scheme but https', () => {
    expect(mediaUrlProblem('http://example.org/a.jpg')).toBe('notHttps');
    expect(mediaUrlProblem('ftp://example.org/a.jpg')).toBe('notHttps');
    expect(mediaUrlProblem('file:///etc/passwd')).toBe('notHttps');
    expect(mediaUrlProblem('content://media/external/images/1')).toBe('notHttps');
  });

  it('refuses the schemes that would run something', () => {
    expect(mediaUrlProblem('javascript:alert(1)')).toBe('notHttps');
    expect(mediaUrlProblem('JavaScript:alert(1)')).toBe('notHttps');
    expect(mediaUrlProblem('data:text/html;base64,PHNjcmlwdD4=')).toBe('notHttps');
    expect(mediaUrlProblem('blob:https://example.org/abc')).toBe('notHttps');
  });

  it('refuses credentials in the URL', () => {
    expect(mediaUrlProblem('https://user:pass@evil.example/a.jpg')).toBe(
      'hasCredentials'
    );
    expect(mediaUrlProblem('https://user@evil.example/a.jpg')).toBe('hasCredentials');
  });

  it('refuses executables, installers and documents', () => {
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

  it('checks the path, not the query', () => {
    expect(mediaUrlProblem('https://example.org/photo.jpg?ref=page.html')).toBeNull();
  });

  it('is not fooled by capitalisation', () => {
    expect(mediaUrlProblem('https://example.org/APP.APK')).toBe('executable');
  });

  it('refuses nothing, whitespace and malformed text', () => {
    expect(mediaUrlProblem('')).toBe('empty');
    expect(mediaUrlProblem('   ')).toBe('empty');
    expect(mediaUrlProblem('not a url')).toBe('malformed');
    expect(mediaUrlProblem('example.org/a.jpg')).toBe('malformed');
    expect(mediaUrlProblem('https://')).toBe('malformed');
  });

  it('refuses a URL long enough to be a payload', () => {
    expect(
      mediaUrlProblem(`https://example.org/${'x'.repeat(MEDIA_URL_MAX_LENGTH)}`)
    ).toBe('tooLong');
  });
});

/**
 * ADMIN SIDE ONLY. These are not among the cases the phone's validator shares
 * (see the note at the top): they exist because firestore.rules is STRICTER
 * than the URL parser. A media post and a library record must match
 * `^https://[^\s]+$` -- a lower-case scheme and no whitespace at all -- while
 * `new URL()` lower-cases `HTTPS://` for you and quietly encodes a space. A
 * link like these used to pass the form and then fail on Save, with a message
 * that said nothing about the link. A stored document can never contain one,
 * so the phone has nothing to catch.
 */
describe('links the Firestore rules would refuse', () => {
  it('asks for a lower-case https:// at the start', () => {
    expect(mediaUrlProblem('HTTPS://example.org/a.jpg')).toBe('notHttps');
    expect(mediaUrlProblem('Https://example.org/a.jpg')).toBe('notHttps');
  });

  it('asks for the two slashes', () => {
    // The URL parser repairs this one into a valid address; the rule does not.
    expect(mediaUrlProblem('https:/example.org/a.jpg')).toBe('notHttps');
  });

  it('refuses a space, a tab or a line break inside the link', () => {
    expect(mediaUrlProblem('https://example.org/my photo.jpg')).toBe('hasSpaces');
    expect(mediaUrlProblem('https://example.org/my\tphoto.jpg')).toBe('hasSpaces');
    expect(mediaUrlProblem('https://example.org/my\nphoto.jpg')).toBe('hasSpaces');
  });

  it('still accepts a space that has been encoded', () => {
    expect(mediaUrlProblem('https://example.org/my%20photo.jpg')).toBeNull();
  });

  it('still ignores whitespace around the link, which is not part of it', () => {
    expect(mediaUrlProblem('\n  https://example.org/photo.jpg \t')).toBeNull();
  });

  it('reports the more serious problem first', () => {
    expect(mediaUrlProblem('javascript:alert(1)')).toBe('notHttps');
    expect(mediaUrlProblem('https://user:pw@example.org/my photo.jpg')).toBe(
      'hasCredentials'
    );
    expect(mediaUrlProblem('https://example.org/my app.apk')).toBe('executable');
  });

  it('says what to do about a space', () => {
    expect(MEDIA_URL_MESSAGES.hasSpaces).toMatch(/spaces/i);
    expect(MEDIA_URL_MESSAGES.hasSpaces).toMatch(/%20/);
  });

  it('is what a media post reports on Save', () => {
    expect(
      validateMediaInput(input({ mediaUrl: 'HTTPS://example.org/a.jpg' })).mediaUrl
    ).toBe(MEDIA_URL_MESSAGES.notHttps);
    expect(
      validateMediaInput(input({ mediaUrl: 'https://example.org/my photo.jpg' })).mediaUrl
    ).toBe(MEDIA_URL_MESSAGES.hasSpaces);
  });
});

describe('the rest of a post', () => {
  it('accepts a complete one', () => {
    expect(hasMediaValidationErrors(validateMediaInput(input()))).toBe(false);
  });

  it('REQUIRES a caption, so an incomplete post cannot be saved as finished', () => {
    // A picture with nothing to say looks finished in the list and says
    // nothing in the feed.
    expect(validateMediaInput(input({ caption: '' })).caption).toBeDefined();
    expect(validateMediaInput(input({ caption: '   ' })).caption).toBeDefined();
  });

  it('caps the caption', () => {
    expect(
      validateMediaInput(input({ caption: 'x'.repeat(MEDIA_CAPTION_MAX_LENGTH + 1) }))
        .caption
    ).toBeDefined();
  });

  it('REQUIRES a publish time, because the read rule compares against it', () => {
    // A post without one is invisible to members and looks like a
    // publishing bug rather than a missing field.
    expect(validateMediaInput(input({ publishAt: '' })).publishAt).toBeDefined();
    expect(validateMediaInput(input({ publishAt: 'whenever' })).publishAt).toBeDefined();
  });

  it('treats the verse as optional, and its two halves independently', () => {
    expect(
      hasMediaValidationErrors(
        validateMediaInput(input({ verseReference: '', verseText: '' }))
      )
    ).toBe(false);
    expect(
      hasMediaValidationErrors(
        validateMediaInput(input({ verseReference: 'John 3:16', verseText: '' }))
      )
    ).toBe(false);
  });

  it('reports the bad link as a sentence, not as "invalid"', () => {
    const errors = validateMediaInput(input({ mediaUrl: 'http://example.org/a.jpg' }));
    expect(errors.mediaUrl).toContain('https://');
  });
});
