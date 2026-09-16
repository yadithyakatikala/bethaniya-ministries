import { describe, expect, it } from 'vitest';
import {
  IMAGE_UPLOAD_UNAVAILABLE_MESSAGE,
  SAVE_RETRY_MESSAGE,
  describeSaveFailure,
  isStorageUnavailable,
} from '../storageErrors';

/**
 * See ../storageErrors.ts for why a missing Cloud Storage bucket must not
 * be reported to an administrator as "saving failed, please try again".
 */
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

describe('describeSaveFailure', () => {
  it('reports the accurate message and clears the image when Storage is unavailable', () => {
    expect(describeSaveFailure({ code: 'storage/unknown' })).toEqual({
      message: IMAGE_UPLOAD_UNAVAILABLE_MESSAGE,
      clearSelectedImage: true,
    });
  });

  it('does not invite a retry that cannot succeed', () => {
    expect(describeSaveFailure({ code: 'storage/unknown' }).message).not.toMatch(
      /try again/i
    );
  });

  it('does not blame the save, which never happened', () => {
    // The upload throws before the Firestore write.
    expect(describeSaveFailure({ code: 'storage/unknown' }).message).not.toMatch(
      /went wrong while saving/i
    );
  });

  it('tells the operator the content is still saveable without an image', () => {
    expect(describeSaveFailure({ code: 'storage/unknown' }).message).toMatch(
      /save without an image/i
    );
  });

  it('names the actual cause, since an operator can act on it', () => {
    expect(describeSaveFailure({ code: 'storage/unknown' }).message).toMatch(
      /Cloud Storage/
    );
  });

  it('still offers a retry, and keeps the image, for a transient failure', () => {
    expect(describeSaveFailure({ code: 'storage/retry-limit-exceeded' })).toEqual({
      message: SAVE_RETRY_MESSAGE,
      clearSelectedImage: false,
    });
  });

  it('treats an ordinary Firestore/permission failure as retryable', () => {
    // A rules rejection on the content write is NOT a Storage problem and
    // must keep the existing generic message.
    expect(describeSaveFailure({ code: 'permission-denied' })).toEqual({
      message: SAVE_RETRY_MESSAGE,
      clearSelectedImage: false,
    });
  });
});
