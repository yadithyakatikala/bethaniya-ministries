/**
 * Client-side event input validation, mirroring ../songs/validation.ts's
 * shape and reasoning: this is a UX convenience only. Server-enforced
 * authority is firestore.rules' isValidEvent().
 *
 * `startsAt` here is the raw string from a <input type="datetime-local">
 * field; validity means "parses to a real Date", not any particular
 * calendar rule. The Live Stream URL field's "looks like a YouTube URL"
 * check is a lightweight UX hint only -- it is NOT the authoritative
 * parser. The authoritative parser (which extracts a video ID and builds
 * the official https://www.youtube.com/embed/<id> URL used for actual
 * playback) lives in mobile/src/features/events/youtube.ts and is what
 * decides whether the mobile app can actually play a given URL.
 */

export const EVENT_TITLE_MAX_LENGTH = 200;
export const EVENT_LOCATION_MAX_LENGTH = 200;
export const EVENT_DESCRIPTION_MAX_LENGTH = 2000;
/** Matches firestore.rules' isValidEvent() youtubeUrl length cap. */
export const EVENT_YOUTUBE_URL_MAX_LENGTH = 2000;

const HTTP_URL_PATTERN = /^https?:\/\/.+/i;
/** Loose "is this a youtube.com/youtu.be link" check -- see the module doc comment above. */
const YOUTUBE_HOST_PATTERN = /^https?:\/\/(www\.|m\.)?(youtube\.com|youtu\.be)\//i;

export interface EventValidationInput {
  title: string;
  location: string;
  description: string;
  /** Raw <input type="datetime-local"> value, e.g. "2026-09-20T18:30". */
  startsAt: string;
}

export interface EventValidationErrors {
  title?: string;
  location?: string;
  description?: string;
  startsAt?: string;
}

/** Validates title/location/description/startsAt (trimmed). Returns an empty object when valid. */
export function validateEventInput(input: EventValidationInput): EventValidationErrors {
  const errors: EventValidationErrors = {};

  const title = input.title.trim();
  if (title.length === 0) {
    errors.title = 'Title is required.';
  } else if (title.length > EVENT_TITLE_MAX_LENGTH) {
    errors.title = `Title must be ${EVENT_TITLE_MAX_LENGTH} characters or fewer.`;
  }

  const location = input.location.trim();
  if (location.length === 0) {
    errors.location = 'Location is required.';
  } else if (location.length > EVENT_LOCATION_MAX_LENGTH) {
    errors.location = `Location must be ${EVENT_LOCATION_MAX_LENGTH} characters or fewer.`;
  }

  const description = input.description.trim();
  if (description.length === 0) {
    errors.description = 'Description is required.';
  } else if (description.length > EVENT_DESCRIPTION_MAX_LENGTH) {
    errors.description = `Description must be ${EVENT_DESCRIPTION_MAX_LENGTH} characters or fewer.`;
  }

  const startsAt = input.startsAt.trim();
  if (startsAt.length === 0) {
    errors.startsAt = 'Start date/time is required.';
  } else if (Number.isNaN(new Date(startsAt).getTime())) {
    errors.startsAt = 'Start date/time must be a valid date.';
  }

  return errors;
}

export function hasValidationErrors(errors: EventValidationErrors): boolean {
  return Object.keys(errors).length > 0;
}

/**
 * Validates a Live Stream Manager YouTube URL entry. An empty string is
 * valid -- it means "no stream URL set yet" (matches isValidEvent()'s
 * youtubeUrl-may-be-empty rule). This is a UX hint only; see the module
 * doc comment for why it can't be the authoritative check.
 */
export function validateEventYouTubeUrl(youtubeUrl: string): string | null {
  const url = youtubeUrl.trim();
  if (url.length === 0) {
    return null;
  }
  if (url.length > EVENT_YOUTUBE_URL_MAX_LENGTH) {
    return `YouTube URL must be ${EVENT_YOUTUBE_URL_MAX_LENGTH} characters or fewer.`;
  }
  if (!HTTP_URL_PATTERN.test(url)) {
    return 'YouTube URL must be a valid http(s) URL.';
  }
  if (!YOUTUBE_HOST_PATTERN.test(url)) {
    return 'This does not look like a youtube.com or youtu.be URL.';
  }
  return null;
}
