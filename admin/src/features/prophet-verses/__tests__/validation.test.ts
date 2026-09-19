import { describe, expect, it } from 'vitest';
import {
  hasProphetVerseErrors,
  isSafeImageUrl,
  parsePublishAt,
  toDateTimeLocalValue,
  validateProphetVerseInput,
} from '../validation';

function input(partial: Partial<Parameters<typeof validateProphetVerseInput>[0]> = {}) {
  return {
    title: 'A word for the church',
    reference: 'Isaiah 43:19',
    text: 'Behold, I will do a new thing.',
    attribution: '',
    imageUrl: '',
    publishAt: '2026-04-05T06:00',
    ...partial,
  };
}

describe('the image address', () => {
  it('accepts a full https address', () => {
    expect(isSafeImageUrl('https://example.org/word.jpg')).toBe(true);
    expect(isSafeImageUrl('https://cdn.example.org/a/b/c.png?v=2')).toBe(true);
  });

  it('refuses http, which Android blocks and would render as a broken image', () => {
    expect(isSafeImageUrl('http://example.org/word.jpg')).toBe(false);
  });

  it('refuses a scheme that is not the web at all', () => {
    expect(isSafeImageUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeImageUrl('data:image/png;base64,AAAA')).toBe(false);
    expect(isSafeImageUrl('gs://bucket/word.jpg')).toBe(false);
  });

  it('refuses the shapes a "starts with https://" check would let through', () => {
    // Which is why this is parsed rather than pattern-matched: "https://"
    // alone passes that check and loads nothing.
    expect(isSafeImageUrl('https://')).toBe(false);
    expect(isSafeImageUrl('/local/word.jpg')).toBe(false);
    expect(isSafeImageUrl('example.org/word.jpg')).toBe(false);
    expect(isSafeImageUrl('')).toBe(false);
  });

  it('accepts a slightly malformed address the URL parser repairs', () => {
    // "https:/host/path" normalises to "https://host/path" under the URL
    // standard, which is also how a browser and the phone's image loader
    // will read it -- so accepting it is correct, not lax.
    expect(isSafeImageUrl('https:/example.org/word.jpg')).toBe(true);
  });
});

describe('validating the form', () => {
  it('accepts a complete record', () => {
    expect(validateProphetVerseInput(input())).toEqual({});
  });

  it('requires the words it is going to show', () => {
    expect(validateProphetVerseInput(input({ title: '  ' })).title).toBeDefined();
    expect(validateProphetVerseInput(input({ text: '' })).text).toBeDefined();
    expect(validateProphetVerseInput(input({ reference: '' })).reference).toBeDefined();
  });

  it('caps the long fields where the rules cap them', () => {
    expect(
      validateProphetVerseInput(input({ text: 'x'.repeat(5001) })).text
    ).toBeDefined();
    expect(
      validateProphetVerseInput(input({ title: 'x'.repeat(201) })).title
    ).toBeDefined();
    expect(
      validateProphetVerseInput(input({ attribution: 'x'.repeat(201) })).attribution
    ).toBeDefined();
  });

  it('treats the image and the attribution as genuinely optional', () => {
    expect(validateProphetVerseInput(input({ imageUrl: '', attribution: '' }))).toEqual(
      {}
    );
  });

  it('rejects an unusable image address', () => {
    expect(
      validateProphetVerseInput(input({ imageUrl: 'http://example.org/a.jpg' })).imageUrl
    ).toBe('Image address must be a full https:// web address.');
  });

  it('requires a valid publish moment', () => {
    expect(validateProphetVerseInput(input({ publishAt: '' })).publishAt).toBeDefined();
    expect(
      validateProphetVerseInput(input({ publishAt: 'sometime soon' })).publishAt
    ).toBeDefined();
  });

  it('allows a publish moment in the past or the future -- scheduling is not validation', () => {
    expect(validateProphetVerseInput(input({ publishAt: '1999-01-01T00:00' }))).toEqual(
      {}
    );
    expect(validateProphetVerseInput(input({ publishAt: '2099-01-01T00:00' }))).toEqual(
      {}
    );
  });

  it('reports whether anything was wrong', () => {
    expect(hasProphetVerseErrors({})).toBe(false);
    expect(hasProphetVerseErrors({ title: 'Title is required.' })).toBe(true);
  });
});

describe('the publish moment', () => {
  it('round-trips through the browser’s local datetime format', () => {
    const value = '2026-04-05T06:00';
    const parsed = parsePublishAt(value);
    expect(parsed).not.toBeNull();
    expect(toDateTimeLocalValue(parsed!)).toBe(value);
  });

  it('is read in the administrator’s own zone, which is what they meant', () => {
    // "Six in the morning" means six where the person typing it is.
    const parsed = parsePublishAt('2026-04-05T06:00')!;
    expect(parsed.getHours()).toBe(6);
    expect(parsed.getMinutes()).toBe(0);
  });

  it('returns null rather than an Invalid Date', () => {
    expect(parsePublishAt('not a time')).toBeNull();
    expect(parsePublishAt('')).toBeNull();
  });

  it('pads single-digit months, days, hours and minutes', () => {
    expect(toDateTimeLocalValue(new Date(2026, 0, 2, 3, 4))).toBe('2026-01-02T03:04');
  });
});
