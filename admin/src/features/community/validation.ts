/**
 * Client-side community-post input validation. Mirrors
 * ../announcements/validation.ts exactly -- see that module's doc comment
 * for the full reasoning (this is a UX convenience only; the real,
 * server-enforced authority is firestore.rules' isValidCommunityPost() and
 * storage.rules' content/{imageType}/{fileName} rule).
 */

export const COMMUNITY_POST_TITLE_MAX_LENGTH = 200;
export const COMMUNITY_POST_CONTENT_MAX_LENGTH = 5000;
/** Matches storage.rules' content/{imageType}/{fileName} write rule's cap. */
export const COMMUNITY_POST_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

export interface CommunityPostValidationInput {
  title: string;
  content: string;
}

export interface CommunityPostValidationErrors {
  title?: string;
  content?: string;
}

/** Validates title/content (trimmed). Returns an empty object when valid. */
export function validateCommunityPostInput(
  input: CommunityPostValidationInput
): CommunityPostValidationErrors {
  const errors: CommunityPostValidationErrors = {};

  const title = input.title.trim();
  if (title.length === 0) {
    errors.title = 'Title is required.';
  } else if (title.length > COMMUNITY_POST_TITLE_MAX_LENGTH) {
    errors.title = `Title must be ${COMMUNITY_POST_TITLE_MAX_LENGTH} characters or fewer.`;
  }

  const content = input.content.trim();
  if (content.length === 0) {
    errors.content = 'Content is required.';
  } else if (content.length > COMMUNITY_POST_CONTENT_MAX_LENGTH) {
    errors.content = `Content must be ${COMMUNITY_POST_CONTENT_MAX_LENGTH} characters or fewer.`;
  }

  return errors;
}

export function hasValidationErrors(errors: CommunityPostValidationErrors): boolean {
  return Object.keys(errors).length > 0;
}

/**
 * Validates an image file before upload -- type and size only (matching
 * storage.rules' own checks), so a rejection is obvious immediately rather
 * than after a slow upload fails server-side.
 */
export function validateCommunityPostImage(file: File): string | null {
  if (!file.type.startsWith('image/')) {
    return 'Please choose an image file.';
  }
  if (file.size >= COMMUNITY_POST_IMAGE_MAX_BYTES) {
    return 'Image must be smaller than 5 MB.';
  }
  return null;
}
