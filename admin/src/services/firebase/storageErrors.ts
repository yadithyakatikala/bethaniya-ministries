/**
 * Distinguishes "Cloud Storage is not available on this project at all"
 * from an ordinary, retryable failure, for the admin dashboard's six
 * optional-image upload paths.
 *
 * WHY THIS EXISTS. Firebase projects created after October 2024 have no
 * default Cloud Storage bucket until the project is upgraded to the Blaze
 * plan. This project deliberately stays on Spark, so every image upload
 * fails -- permanently, not intermittently.
 *
 * All six admin forms (announcements, songs, daily verses, plans,
 * community posts, notifications) wrap the optional image upload and the
 * Firestore write in ONE try/catch and reported any failure as
 * "Something went wrong while saving. Please try again." That was wrong in
 * three separate ways when the cause was a missing bucket:
 *
 *   1. It blamed the save, which had not even been attempted -- the upload
 *      throws first, so nothing was written.
 *   2. It invited a retry that can never succeed.
 *   3. It gave an operator -- the one person who CAN act on this -- no clue
 *      what was actually wrong.
 *
 * Found during the V1 production-readiness audit. The mobile app has the
 * same helper for its one member-facing upload
 * (mobile/src/services/firebase/storageErrors.ts); the wording differs on
 * purpose, because the audiences differ: a church member cannot act on
 * project configuration, an administrator can.
 *
 * WORDING. The message names Cloud Storage, because that is the accurate
 * and actionable fact for an operator, and deliberately does NOT mention
 * billing plans or pricing tiers -- that is a decision for whoever owns
 * the Firebase project, not something to surface in a content form.
 */

/**
 * Error codes the Firebase Storage SDK reports when the bucket itself
 * cannot be used, as opposed to a transient failure of a real upload.
 *
 * - `storage/unknown` is what a missing bucket surfaces as in practice
 *   (the backend returns an error the SDK cannot classify).
 * - `storage/bucket-not-found` / `storage/project-not-found` are the
 *   explicit forms.
 * - `storage/unauthorized` appears when there is no bucket for rules to be
 *   evaluated against at all.
 */
const UNAVAILABLE_STORAGE_CODES = [
  'storage/unknown',
  'storage/bucket-not-found',
  'storage/project-not-found',
  'storage/unauthorized',
];

export function isStorageUnavailable(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' && UNAVAILABLE_STORAGE_CODES.includes(code);
}

/** Shown when the image could not be attached and never will be. Tells the
 * operator the content itself is still saveable, which it is -- every one
 * of these six images is optional and nullable. */
export const IMAGE_UPLOAD_UNAVAILABLE_MESSAGE =
  'Image upload is unavailable: this project has no Cloud Storage bucket configured. ' +
  'The image was not attached and has been cleared — you can save without an image.';

/** The existing generic message, kept verbatim for genuinely transient
 * failures so a retry is still offered where retrying can actually work. */
export const SAVE_RETRY_MESSAGE = 'Something went wrong while saving. Please try again.';

export interface SaveFailure {
  /** Message to show the operator. */
  message: string;
  /** True when the cause was Storage being unavailable, so the caller
   * should clear the selected file -- the same thing these forms already
   * do when a chosen file fails validation. Saving again then succeeds
   * without an image, rather than hitting the identical wall twice. */
  clearSelectedImage: boolean;
}

/**
 * Single call that decides both what to tell the operator and whether the
 * pending image selection should be dropped.
 */
export function describeSaveFailure(error: unknown): SaveFailure {
  if (isStorageUnavailable(error)) {
    return { message: IMAGE_UPLOAD_UNAVAILABLE_MESSAGE, clearSelectedImage: true };
  }
  return { message: SAVE_RETRY_MESSAGE, clearSelectedImage: false };
}
