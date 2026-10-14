/**
 * Client-side daily-verse input validation, mirroring
 * ../announcements/validation.ts's shape and reasoning: this is a UX
 * convenience only. Images are uploaded to Cloudinary by <ImageField>
 * (docs/admin/MEDIA_UPLOADS.md); daily_verses itself has no field-level
 * Firestore rules validation as of Day 5 -- see
 * services/firebase/dailyVerses.ts's header comment for why.
 */

import { validateUploadFile } from '../../services/media/uploadRules';

export const DAILY_VERSE_REFERENCE_MAX_LENGTH = 200;
export const DAILY_VERSE_TEXT_MAX_LENGTH = 5000;

/** YYYY-MM-DD, matching <input type="date">'s native value format. */
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export interface DailyVerseValidationInput {
  reference: string;
  text: string;
  date: string;
}

export interface DailyVerseValidationErrors {
  reference?: string;
  text?: string;
  date?: string;
}

/** Validates reference/text/date (trimmed where applicable). Returns an empty object when valid. */
export function validateDailyVerseInput(
  input: DailyVerseValidationInput
): DailyVerseValidationErrors {
  const errors: DailyVerseValidationErrors = {};

  const reference = input.reference.trim();
  if (reference.length === 0) {
    errors.reference = 'Scripture reference is required.';
  } else if (reference.length > DAILY_VERSE_REFERENCE_MAX_LENGTH) {
    errors.reference = `Reference must be ${DAILY_VERSE_REFERENCE_MAX_LENGTH} characters or fewer.`;
  }

  const text = input.text.trim();
  if (text.length === 0) {
    errors.text = 'Verse text is required.';
  } else if (text.length > DAILY_VERSE_TEXT_MAX_LENGTH) {
    errors.text = `Verse text must be ${DAILY_VERSE_TEXT_MAX_LENGTH} characters or fewer.`;
  }

  if (input.date.length === 0) {
    errors.date = 'Date is required.';
  } else if (!DATE_PATTERN.test(input.date)) {
    errors.date = 'Date must be a valid date.';
  }

  return errors;
}

export function hasValidationErrors(errors: DailyVerseValidationErrors): boolean {
  return Object.keys(errors).length > 0;
}

/**
 * Whether this file may be uploaded as a daily-verse image. It is the shared image
 * rule (../../services/media/uploadRules.ts) -- the same formats and
 * 5 MB ceiling for every picture -- so a mistake is caught in the browser
 * before an upload starts. A courtesy only: the limits that really apply
 * are set on the Cloudinary upload preset (docs/admin/MEDIA_UPLOADS.md).
 */
export function validateDailyVerseImage(file: File): string | null {
  return validateUploadFile(file, 'image');
}
