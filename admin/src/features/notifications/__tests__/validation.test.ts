import { describe, expect, it } from 'vitest';
import {
  NOTIFICATION_MESSAGE_MAX_LENGTH,
  NOTIFICATION_TITLE_MAX_LENGTH,
  hasValidationErrors,
  validateNotificationImage,
  validateNotificationInput,
} from '../validation';

describe('validateNotificationInput', () => {
  it('returns no errors for valid input', () => {
    const errors = validateNotificationInput({
      title: 'Sunday Service Reminder',
      message: 'Join us this Sunday at 10am.',
    });
    expect(hasValidationErrors(errors)).toBe(false);
  });

  it('requires a non-empty title', () => {
    const errors = validateNotificationInput({ title: '   ', message: 'Some message' });
    expect(errors.title).toBeDefined();
  });

  it('requires a non-empty message', () => {
    const errors = validateNotificationInput({ title: 'Title', message: '   ' });
    expect(errors.message).toBeDefined();
  });

  it('rejects a title over the max length', () => {
    const errors = validateNotificationInput({
      title: 'x'.repeat(NOTIFICATION_TITLE_MAX_LENGTH + 1),
      message: 'valid message',
    });
    expect(errors.title).toBeDefined();
  });

  it('rejects a message over the max length', () => {
    const errors = validateNotificationInput({
      title: 'valid title',
      message: 'x'.repeat(NOTIFICATION_MESSAGE_MAX_LENGTH + 1),
    });
    expect(errors.message).toBeDefined();
  });

  it('accepts a title/message exactly at the max length', () => {
    const errors = validateNotificationInput({
      title: 'x'.repeat(NOTIFICATION_TITLE_MAX_LENGTH),
      message: 'x'.repeat(NOTIFICATION_MESSAGE_MAX_LENGTH),
    });
    expect(hasValidationErrors(errors)).toBe(false);
  });
});

describe('validateNotificationImage', () => {
  it('accepts a small image file', () => {
    const file = new File(['a'], 'photo.jpg', { type: 'image/jpeg' });
    expect(validateNotificationImage(file)).toBeNull();
  });

  it('rejects a non-image file', () => {
    const file = new File(['a'], 'doc.pdf', { type: 'application/pdf' });
    expect(validateNotificationImage(file)).not.toBeNull();
  });

  it('rejects a file at/over the 5MB cap', () => {
    const file = new File([new Uint8Array(5 * 1024 * 1024)], 'big.jpg', {
      type: 'image/jpeg',
    });
    expect(validateNotificationImage(file)).not.toBeNull();
  });
});
