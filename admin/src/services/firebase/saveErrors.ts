/**
 * The one sentence every admin form shows when a save fails.
 *
 * It used to share a file with a check for a missing Cloud Storage bucket,
 * because every form uploaded its image to Firebase Storage inside the same
 * try/catch as the Firestore write. Images now go to Cloudinary from the
 * upload field itself, before Save is pressed, and report their own errors
 * beside the picture (see components/media/ImageField.tsx). A failure that
 * reaches a form's catch block is therefore the Firestore write, and a
 * retry is the right advice.
 */
export const SAVE_RETRY_MESSAGE = 'Something went wrong while saving. Please try again.';
