import { describe, expect, it } from 'vitest';
import {
  DAILY_VERSE_REFERENCE_MAX_LENGTH,
  DAILY_VERSE_TEXT_MAX_LENGTH,
  hasValidationErrors,
  validateDailyVerseImage,
  validateDailyVerseInput,
} from '../validation';

describe('validateDailyVerseInput', () => {
  it('returns no errors for valid input', () => {
    const errors = validateDailyVerseInput({
      reference: 'John 3:16',
      text: 'For God so loved the world...',
      date: '2026-09-07',
    });
    expect(hasValidationErrors(errors)).toBe(false);
  });

  it('requires a non-empty reference', () => {
    const errors = validateDailyVerseInput({
      reference: '   ',
      text: 'Some text',
      date: '2026-09-07',
    });
    expect(errors.reference).toBeDefined();
  });

  it('requires non-empty text', () => {
    const errors = validateDailyVerseInput({
      reference: 'John 3:16',
      text: '   ',
      date: '2026-09-07',
    });
    expect(errors.text).toBeDefined();
  });

  it('requires a date', () => {
    const errors = validateDailyVerseInput({
      reference: 'John 3:16',
      text: 'Some text',
      date: '',
    });
    expect(errors.date).toBeDefined();
  });

  it('rejects a malformed date', () => {
    const errors = validateDailyVerseInput({
      reference: 'John 3:16',
      text: 'Some text',
      date: 'not-a-date',
    });
    expect(errors.date).toBeDefined();
  });

  it('rejects a reference over the max length', () => {
    const errors = validateDailyVerseInput({
      reference: 'x'.repeat(DAILY_VERSE_REFERENCE_MAX_LENGTH + 1),
      text: 'valid text',
      date: '2026-09-07',
    });
    expect(errors.reference).toBeDefined();
  });

  it('rejects text over the max length', () => {
    const errors = validateDailyVerseInput({
      reference: 'valid reference',
      text: 'x'.repeat(DAILY_VERSE_TEXT_MAX_LENGTH + 1),
      date: '2026-09-07',
    });
    expect(errors.text).toBeDefined();
  });

  it('accepts a reference/text exactly at the max length', () => {
    const errors = validateDailyVerseInput({
      reference: 'x'.repeat(DAILY_VERSE_REFERENCE_MAX_LENGTH),
      text: 'x'.repeat(DAILY_VERSE_TEXT_MAX_LENGTH),
      date: '2026-09-07',
    });
    expect(hasValidationErrors(errors)).toBe(false);
  });
});

describe('validateDailyVerseImage', () => {
  it('accepts a small image file', () => {
    const file = new File(['a'], 'photo.jpg', { type: 'image/jpeg' });
    expect(validateDailyVerseImage(file)).toBeNull();
  });

  it('rejects a non-image file', () => {
    const file = new File(['a'], 'doc.pdf', { type: 'application/pdf' });
    expect(validateDailyVerseImage(file)).not.toBeNull();
  });

  it('rejects a file at/over the 5MB cap', () => {
    const file = new File([new Uint8Array(5 * 1024 * 1024)], 'big.jpg', {
      type: 'image/jpeg',
    });
    expect(validateDailyVerseImage(file)).not.toBeNull();
  });
});
