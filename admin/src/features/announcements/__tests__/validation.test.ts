import { describe, expect, it } from 'vitest';
import {
  ANNOUNCEMENT_CONTENT_MAX_LENGTH,
  ANNOUNCEMENT_TITLE_MAX_LENGTH,
  hasValidationErrors,
  validateAnnouncementImage,
  validateAnnouncementInput,
} from '../validation';

describe('validateAnnouncementInput', () => {
  it('returns no errors for valid input', () => {
    const errors = validateAnnouncementInput({
      title: 'Sunday Service',
      content: 'Join us at 10am.',
    });
    expect(hasValidationErrors(errors)).toBe(false);
  });

  it('requires a non-empty title', () => {
    const errors = validateAnnouncementInput({ title: '   ', content: 'Some content' });
    expect(errors.title).toBeDefined();
  });

  it('requires non-empty content', () => {
    const errors = validateAnnouncementInput({ title: 'Title', content: '   ' });
    expect(errors.content).toBeDefined();
  });

  it('rejects a title over the max length', () => {
    const errors = validateAnnouncementInput({
      title: 'x'.repeat(ANNOUNCEMENT_TITLE_MAX_LENGTH + 1),
      content: 'valid content',
    });
    expect(errors.title).toBeDefined();
  });

  it('rejects content over the max length', () => {
    const errors = validateAnnouncementInput({
      title: 'valid title',
      content: 'x'.repeat(ANNOUNCEMENT_CONTENT_MAX_LENGTH + 1),
    });
    expect(errors.content).toBeDefined();
  });

  it('accepts a title/content exactly at the max length', () => {
    const errors = validateAnnouncementInput({
      title: 'x'.repeat(ANNOUNCEMENT_TITLE_MAX_LENGTH),
      content: 'x'.repeat(ANNOUNCEMENT_CONTENT_MAX_LENGTH),
    });
    expect(hasValidationErrors(errors)).toBe(false);
  });
});

describe('validateAnnouncementImage', () => {
  it('accepts a small image file', () => {
    const file = new File(['a'], 'photo.jpg', { type: 'image/jpeg' });
    expect(validateAnnouncementImage(file)).toBeNull();
  });

  it('rejects a non-image file', () => {
    const file = new File(['a'], 'doc.pdf', { type: 'application/pdf' });
    expect(validateAnnouncementImage(file)).not.toBeNull();
  });

  it('rejects a file at/over the 5MB cap', () => {
    const file = new File([new Uint8Array(5 * 1024 * 1024)], 'big.jpg', {
      type: 'image/jpeg',
    });
    expect(validateAnnouncementImage(file)).not.toBeNull();
  });
});
