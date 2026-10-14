/**
 * Client-side community-post input validation. Mirrors
 * ../announcements/validation.ts exactly -- see that module's doc comment
 * for the full reasoning (this is a UX convenience only; the real,
 * server-enforced authority is firestore.rules' isValidCommunityPost()).
 * Images go to Cloudinary through <ImageField>; see
 * docs/admin/MEDIA_UPLOADS.md for the limits that really apply.
 */

import { validateUploadFile } from '../../services/media/uploadRules';

export const COMMUNITY_POST_TITLE_MAX_LENGTH = 200;
export const COMMUNITY_POST_CONTENT_MAX_LENGTH = 5000;

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
 * Whether this file may be uploaded as a community-post image. It is the shared image
 * rule (../../services/media/uploadRules.ts) -- the same formats and
 * 5 MB ceiling for every picture -- so a mistake is caught in the browser
 * before an upload starts. A courtesy only: the limits that really apply
 * are set on the Cloudinary upload preset (docs/admin/MEDIA_UPLOADS.md).
 */
export function validateCommunityPostImage(file: File): string | null {
  return validateUploadFile(file, 'image');
}
