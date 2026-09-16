/**
 * Distinguishes "Cloud Storage is not available on this project at all"
 * from an ordinary, retryable upload failure.
 *
 * WHY THIS MATTERS. Firebase projects created after October 2024 have no
 * default Cloud Storage bucket until the project is upgraded to the Blaze
 * plan. This project deliberately stays on Spark (the ₹0 constraint), so
 * every upload fails -- permanently, not intermittently. ProfileScreen
 * previously reported that as "Could not upload your photo. Please try
 * again.", which invites a member to retry something that can never
 * succeed. Found during the V1 production-readiness audit, the same class
 * of misleading-retry message as the admin dashboard's notification send
 * (see admin/src/services/firebase/notifications.ts's
 * CloudFunctionsUnavailableError).
 *
 * The wording deliberately does not blame the member or their connection,
 * and does not mention billing plans -- that is an operator concern, not
 * something a church member can act on. It simply says the feature is
 * unavailable, which is the truth.
 */

/**
 * Error codes the Firebase Storage SDK reports when the bucket itself
 * cannot be used, as opposed to a transient failure of a real upload.
 *
 * - `storage/unknown` is what a missing bucket surfaces as in practice
 *   (the backend returns a non-specific error the SDK cannot classify).
 * - `storage/bucket-not-found` / `storage/project-not-found` are the
 *   explicit forms.
 * - `storage/unauthorized` appears when no bucket exists for rules to be
 *   evaluated against.
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

export const STORAGE_UNAVAILABLE_MESSAGE =
  'Photo uploads aren’t available in this version of the app yet.';

export const STORAGE_RETRY_MESSAGE = 'Could not upload your photo. Please try again.';

/**
 * The message to show for a failed upload: an honest "not available"
 * when Storage cannot work at all, and the ordinary retry prompt
 * otherwise.
 */
export function toFriendlyUploadMessage(error: unknown): string {
  return isStorageUnavailable(error)
    ? STORAGE_UNAVAILABLE_MESSAGE
    : STORAGE_RETRY_MESSAGE;
}
