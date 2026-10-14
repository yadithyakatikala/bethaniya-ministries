/**
 * What to tell an administrator when the media LIBRARY (the Firestore
 * collection of records) cannot be read or written -- as opposed to when
 * an UPLOAD fails, which is Cloudinary's business and is reported by
 * ../../services/media/cloudinaryUpload.ts.
 *
 * The two are independent on purpose. An upload that succeeded yields a
 * working address even if recording it in the library did not, and the
 * most likely reason is not a fault at all: the library's security rules
 * ship with the code and are only live once someone with access to the
 * Firebase project deploys them. Until then Firestore answers
 * `permission-denied` for the whole collection, and this says so plainly
 * instead of "Something went wrong".
 */
export const RULES_NOT_DEPLOYED_MESSAGE =
  'The media library needs the latest Firestore security rules to be deployed before it can list files. Uploading still works; the file just will not appear in the library yet.';

export function describeLibraryError(error: unknown): string {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code: unknown }).code)
      : '';
  if (code === 'permission-denied' || code === 'firestore/permission-denied') {
    return RULES_NOT_DEPLOYED_MESSAGE;
  }
  if (code === 'unavailable' || code === 'firestore/unavailable') {
    return 'The media library could not be reached. Check your internet connection.';
  }
  return 'The media library could not be updated. Please try again.';
}
