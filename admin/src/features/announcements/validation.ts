/**
 * Client-side announcement input validation, per
 * FINAL_ARCHITECTURE_SPECIFICATION.md's "Client-Side (Mobile + Admin)"
 * validation checklist (trim whitespace, check required fields, validate
 * image size). This is a UX convenience only -- the actual, server-enforced
 * authority is firestore.rules' isValidAnnouncement() (title/content/
 * published shape) and storage.rules' content/{imageType}/{fileName} rule
 * (5 MB cap + image/* content type), both evaluated independently of
 * whatever this function returns. See SECURITY.md's "Day 4" section.
 *
 * Field caps (200/5000 chars) mirror firestore.rules' isValidAnnouncement()
 * exactly, so a client-side rejection here matches what the server would
 * reject anyway, rather than the user discovering the real limit only after
 * a failed write.
 */

export const ANNOUNCEMENT_TITLE_MAX_LENGTH = 200;
export const ANNOUNCEMENT_CONTENT_MAX_LENGTH = 5000;
/** Matches storage.rules' content/{imageType}/{fileName} write rule's cap. */
export const ANNOUNCEMENT_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

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
 * Validates an image file before upload -- type and size only (matching
 * storage.rules' own checks), so a rejection is obvious immediately rather
 * than after a slow upload fails server-side.
 */
export function validateAnnouncementImage(file: File): string | null {
  if (!file.type.startsWith('image/')) {
    return 'Please choose an image file.';
  }
  if (file.size >= ANNOUNCEMENT_IMAGE_MAX_BYTES) {
    return 'Image must be smaller than 5 MB.';
  }
  return null;
}
