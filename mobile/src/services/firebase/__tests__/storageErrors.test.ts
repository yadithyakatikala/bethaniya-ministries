/**
 * Tests for ../storageErrors.ts -- see that module for why a missing
 * Cloud Storage bucket must not be reported to a member as "please try
 * again".
 */
import {
  STORAGE_RETRY_MESSAGE,
  STORAGE_UNAVAILABLE_MESSAGE,
  isStorageUnavailable,
  toFriendlyUploadMessage,
} from '../storageErrors';

describe('isStorageUnavailable', () => {
  it.each([
    'storage/unknown',
    'storage/bucket-not-found',
    'storage/project-not-found',
    'storage/unauthorized',
  ])('treats %s as Storage being unavailable', (code) => {
    expect(isStorageUnavailable({ code })).toBe(true);
  });

  it.each(['storage/retry-limit-exceeded', 'storage/canceled', 'storage/quota-exceeded'])(
    'treats %s as an ordinary, retryable failure',
    (code) => {
      expect(isStorageUnavailable({ code })).toBe(false);
    }
  );

  it('handles a non-Firebase error without throwing', () => {
    expect(isStorageUnavailable(new Error('network'))).toBe(false);
    expect(isStorageUnavailable(null)).toBe(false);
    expect(isStorageUnavailable(undefined)).toBe(false);
    expect(isStorageUnavailable('storage/unknown')).toBe(false);
  });
});

describe('toFriendlyUploadMessage', () => {
  it('does NOT tell the member to retry something that can never succeed', () => {
    const message = toFriendlyUploadMessage({ code: 'storage/unknown' });
    expect(message).toBe(STORAGE_UNAVAILABLE_MESSAGE);
    expect(message).not.toMatch(/try again/i);
  });

  it('still offers a retry for a genuinely transient failure', () => {
    expect(toFriendlyUploadMessage({ code: 'storage/retry-limit-exceeded' })).toBe(
      STORAGE_RETRY_MESSAGE
    );
  });

  it('never mentions billing plans -- not something a member can act on', () => {
    expect(toFriendlyUploadMessage({ code: 'storage/unknown' })).not.toMatch(
      /blaze|billing|plan|spark/i
    );
  });
});
