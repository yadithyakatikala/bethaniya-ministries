/**
 * Client-side announcement input validation, per
 * FINAL_ARCHITECTURE_SPECIFICATION.md's "Client-Side (Mobile + Admin)"
 * validation checklist (trim whitespace, check required fields, validate
 * image size). This is a UX convenience only -- the actual, server-enforced
 * authority is firestore.rules' isValidAnnouncement() (title/content/
 * published shape), evaluated independently of whatever this function
 * returns. See SECURITY.md's "Day 4" section. The image is uploaded to
 * Cloudinary by <ImageField>; its real limits are set on the upload preset
 * (docs/admin/MEDIA_UPLOADS.md), not here.
 *
 * Field caps (200/5000 chars) mirror firestore.rules' isValidAnnouncement()
 * exactly, so a client-side rejection here matches what the server would
 * reject anyway, rather than the user discovering the real limit only after
 * a failed write.
 */

import { validateUploadFile } from '../../services/media/uploadRules';

export const ANNOUNCEMENT_TITLE_MAX_LENGTH = 200;
export const ANNOUNCEMENT_CONTENT_MAX_LENGTH = 5000;

export interface AnnouncementValidationInput {
  title: string;
  content: string;
}

export interface AnnouncementValidationErrors {
  title?: string;
  content?: string;
}

/** Validates title/content (trimmed). Returns an empty object when valid. */
export function validateAnnouncementInput(
  input: AnnouncementValidationInput
): AnnouncementValidationErrors {
  const errors: AnnouncementValidationErrors = {};

  const title = input.title.trim();
  if (title.length === 0) {
    errors.title = 'Title is required.';
  } else if (title.length > ANNOUNCEMENT_TITLE_MAX_LENGTH) {
    errors.title = `Title must be ${ANNOUNCEMENT_TITLE_MAX_LENGTH} characters or fewer.`;
  }

  const content = input.content.trim();
  if (content.length === 0) {
    errors.content = 'Content is required.';
  } else if (content.length > ANNOUNCEMENT_CONTENT_MAX_LENGTH) {
    errors.content = `Content must be ${ANNOUNCEMENT_CONTENT_MAX_LENGTH} characters or fewer.`;
  }

  return errors;
}

export function hasValidationErrors(errors: AnnouncementValidationErrors): boolean {
  return Object.keys(errors).length > 0;
}

/**
 * Whether this file may be uploaded as an announcement image. It is the shared image
 * rule (../../services/media/uploadRules.ts) -- the same formats and
 * 5 MB ceiling for every picture -- so a mistake is caught in the browser
 * before an upload starts. A courtesy only: the limits that really apply
 * are set on the Cloudinary upload preset (docs/admin/MEDIA_UPLOADS.md).
 */
export function validateAnnouncementImage(file: File): string | null {
  return validateUploadFile(file, 'image');
}
