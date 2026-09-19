/**
 * Client-side Prophet Verse validation.
 *
 * Mirrors firestore.rules' isValidProphetVerse(), which is the real
 * boundary; this exists so a mistake is caught in the form rather than as
 * a permission error after Save.
 *
 * THE IMAGE URL IS THE ONE RULE WORTH READING TWICE. There is no Cloud
 * Storage bucket on this project's plan, so the image is an external
 * address the member's own device will load. It must be https: Android
 * blocks cleartext http by default, so an http:// url would render as a
 * broken image rather than failing loudly here. `javascript:` and
 * `data:` are refused for the obvious reason, which the https requirement
 * already covers but which is worth a test of its own.
 */
export const PROPHET_VERSE_TITLE_MAX_LENGTH = 200;
export const PROPHET_VERSE_REFERENCE_MAX_LENGTH = 200;
export const PROPHET_VERSE_TEXT_MAX_LENGTH = 5000;
export const PROPHET_VERSE_ATTRIBUTION_MAX_LENGTH = 200;
export const PROPHET_VERSE_IMAGE_URL_MAX_LENGTH = 2000;

export interface ProphetVerseValidationInput {
  title: string;
  reference: string;
  text: string;
  attribution: string;
  imageUrl: string;
  /** The value of a <input type="datetime-local">, or ''. */
  publishAt: string;
}

export interface ProphetVerseValidationErrors {
  title?: string;
  reference?: string;
  text?: string;
  attribution?: string;
  imageUrl?: string;
  publishAt?: string;
}

/**
 * Accepts only an absolute https url.
 *
 * Parsed with `URL` rather than matched with a regular expression: a
 * pattern that looks right ("starts with https://") also accepts
 * "https://" alone and "https:/example.org", and a member would see a
 * broken image for either.
 */
export function isSafeImageUrl(value: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return false;
  }
  return parsed.protocol === 'https:' && parsed.hostname.length > 0;
}

export function validateProphetVerseInput(
  input: ProphetVerseValidationInput
): ProphetVerseValidationErrors {
  const errors: ProphetVerseValidationErrors = {};

  const title = input.title.trim();
  if (title.length === 0) {
    errors.title = 'Title is required.';
  } else if (title.length > PROPHET_VERSE_TITLE_MAX_LENGTH) {
    errors.title = `Title must be ${PROPHET_VERSE_TITLE_MAX_LENGTH} characters or fewer.`;
  }

  const reference = input.reference.trim();
  if (reference.length === 0) {
    errors.reference = 'Scripture reference is required.';
  } else if (reference.length > PROPHET_VERSE_REFERENCE_MAX_LENGTH) {
    errors.reference = `Reference must be ${PROPHET_VERSE_REFERENCE_MAX_LENGTH} characters or fewer.`;
  }

  const text = input.text.trim();
  if (text.length === 0) {
    errors.text = 'Text is required.';
  } else if (text.length > PROPHET_VERSE_TEXT_MAX_LENGTH) {
    errors.text = `Text must be ${PROPHET_VERSE_TEXT_MAX_LENGTH} characters or fewer.`;
  }

  if (input.attribution.trim().length > PROPHET_VERSE_ATTRIBUTION_MAX_LENGTH) {
    errors.attribution = `Attribution must be ${PROPHET_VERSE_ATTRIBUTION_MAX_LENGTH} characters or fewer.`;
  }

  const imageUrl = input.imageUrl.trim();
  if (imageUrl.length > 0) {
    if (imageUrl.length > PROPHET_VERSE_IMAGE_URL_MAX_LENGTH) {
      errors.imageUrl = `Image address must be ${PROPHET_VERSE_IMAGE_URL_MAX_LENGTH} characters or fewer.`;
    } else if (!isSafeImageUrl(imageUrl)) {
      errors.imageUrl = 'Image address must be a full https:// web address.';
    }
  }

  if (input.publishAt.trim().length === 0) {
    errors.publishAt = 'A publish date and time is required.';
  } else if (Number.isNaN(new Date(input.publishAt).getTime())) {
    errors.publishAt = 'Publish date and time must be valid.';
  }

  return errors;
}

export function hasProphetVerseErrors(errors: ProphetVerseValidationErrors): boolean {
  return Object.keys(errors).length > 0;
}

/**
 * A `Date` for the browser's `<input type="datetime-local">` value, which
 * is a LOCAL wall-clock string with no zone ("2026-04-05T06:00").
 *
 * `new Date(value)` interprets it in the browser's own zone, which is
 * what an administrator means: they are scheduling for six in the morning
 * where they are. The stored Timestamp is the resulting instant, and the
 * app compares instants, so no zone is lost.
 */
export function parsePublishAt(value: string): Date | null {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** The inverse, for loading an existing record back into the form. */
export function toDateTimeLocalValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}
