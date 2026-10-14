/**
 * Client-side notification input validation -- same UX-convenience role as
 * ../announcements/validation.ts (the actual, server-enforced authority is
 * functions/src/sendNotification.ts's isValidInput(), which this file's
 * caps are kept in sync with by hand: TITLE 200 / MESSAGE 1000). Image
 * validation is the shared upload rule (../../services/media/uploadRules.ts).
 */

import { validateUploadFile } from '../../services/media/uploadRules';

export const NOTIFICATION_TITLE_MAX_LENGTH = 200;
export const NOTIFICATION_MESSAGE_MAX_LENGTH = 1000;

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
 * Whether this file may be uploaded as a notification image. It is the shared image
 * rule (../../services/media/uploadRules.ts) -- the same formats and
 * 5 MB ceiling for every picture -- so a mistake is caught in the browser
 * before an upload starts. A courtesy only: the limits that really apply
 * are set on the Cloudinary upload preset (docs/admin/MEDIA_UPLOADS.md).
 */
export function validateNotificationImage(file: File): string | null {
  return validateUploadFile(file, 'image');
}
