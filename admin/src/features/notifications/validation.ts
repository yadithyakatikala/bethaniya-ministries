/**
 * Client-side notification input validation -- same UX-convenience role as
 * ../announcements/validation.ts (the actual, server-enforced authority is
 * functions/src/sendNotification.ts's isValidInput(), which this file's
 * caps are kept in sync with by hand: TITLE 200 / MESSAGE 1000). Image
 * validation mirrors announcements' own (5 MB cap, image/* content type),
 * matching storage.rules' content/{imageType}/{fileName} write rule.
 */

export const NOTIFICATION_TITLE_MAX_LENGTH = 200;
export const NOTIFICATION_MESSAGE_MAX_LENGTH = 1000;
/** Matches storage.rules' content/{imageType}/{fileName} write rule's cap. */
export const NOTIFICATION_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

export interface NotificationValidationInput {
  title: string;
  message: string;
}

export interface NotificationValidationErrors {
  title?: string;
  message?: string;
}

/** Validates title/message (trimmed). Returns an empty object when valid. */
export function validateNotificationInput(
  input: NotificationValidationInput
): NotificationValidationErrors {
  const errors: NotificationValidationErrors = {};

  const title = input.title.trim();
  if (title.length === 0) {
    errors.title = 'Title is required.';
  } else if (title.length > NOTIFICATION_TITLE_MAX_LENGTH) {
    errors.title = `Title must be ${NOTIFICATION_TITLE_MAX_LENGTH} characters or fewer.`;
  }

  const message = input.message.trim();
  if (message.length === 0) {
    errors.message = 'Message is required.';
  } else if (message.length > NOTIFICATION_MESSAGE_MAX_LENGTH) {
    errors.message = `Message must be ${NOTIFICATION_MESSAGE_MAX_LENGTH} characters or fewer.`;
  }

  return errors;
}

export function hasValidationErrors(errors: NotificationValidationErrors): boolean {
  return Object.keys(errors).length > 0;
}

/**
 * Validates an image file before upload -- type and size only (matching
 * storage.rules' own checks), so a rejection is obvious immediately rather
 * than after a slow upload fails server-side.
 */
export function validateNotificationImage(file: File): string | null {
  if (!file.type.startsWith('image/')) {
    return 'Please choose an image file.';
  }
  if (file.size >= NOTIFICATION_IMAGE_MAX_BYTES) {
    return 'Image must be smaller than 5 MB.';
  }
  return null;
}
