/**
 * Client-side daily-verse input validation, mirroring
 * ../announcements/validation.ts's shape and reasoning: this is a UX
 * convenience only. Server-enforced authority is storage.rules' existing
 * content/{imageType}/{fileName} rule for images (5 MB cap + image/* type,
 * unchanged from Day 4); daily_verses itself has no field-level Firestore
 * rules validation as of Day 5 -- see services/firebase/dailyVerses.ts's
 * header comment for why.
 */

export const DAILY_VERSE_REFERENCE_MAX_LENGTH = 200;
export const DAILY_VERSE_TEXT_MAX_LENGTH = 5000;
/** Matches storage.rules' content/{imageType}/{fileName} write rule's cap. */
export const DAILY_VERSE_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

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
 * Validates an image file before upload -- type and size only (matching
 * storage.rules' own checks), so a rejection is obvious immediately rather
 * than after a slow upload fails server-side.
 */
export function validateDailyVerseImage(file: File): string | null {
  if (!file.type.startsWith('image/')) {
    return 'Please choose an image file.';
  }
  if (file.size >= DAILY_VERSE_IMAGE_MAX_BYTES) {
    return 'Image must be smaller than 5 MB.';
  }
  return null;
}
