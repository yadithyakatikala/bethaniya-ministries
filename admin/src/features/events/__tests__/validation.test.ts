import { describe, expect, it } from 'vitest';
import {
  EVENT_DESCRIPTION_MAX_LENGTH,
  EVENT_LOCATION_MAX_LENGTH,
  EVENT_TITLE_MAX_LENGTH,
  EVENT_YOUTUBE_URL_MAX_LENGTH,
  hasValidationErrors,
  validateEventInput,
  validateEventYouTubeUrl,
} from '../validation';

const VALID: Parameters<typeof validateEventInput>[0] = {
  title: 'Sunday Service',
  location: '123 Main St, Springfield',
  description: 'Weekly gathering with worship and teaching.',
  startsAt: '2026-09-20T18:30',
};

describe('validateEventInput', () => {
  it('returns no errors for valid input', () => {
    expect(hasValidationErrors(validateEventInput(VALID))).toBe(false);
  });

  it('requires a non-empty title', () => {
    const errors = validateEventInput({ ...VALID, title: '   ' });
    expect(errors.title).toBeDefined();
  });

  it('requires a non-empty location', () => {
    const errors = validateEventInput({ ...VALID, location: '   ' });
    expect(errors.location).toBeDefined();
  });

  it('requires a non-empty description', () => {
    const errors = validateEventInput({ ...VALID, description: '   ' });
    expect(errors.description).toBeDefined();
  });

  it('requires a non-empty startsAt', () => {
    const errors = validateEventInput({ ...VALID, startsAt: '   ' });
    expect(errors.startsAt).toBeDefined();
  });

  it('rejects an unparseable startsAt', () => {
    const errors = validateEventInput({ ...VALID, startsAt: 'not-a-date' });
    expect(errors.startsAt).toBeDefined();
  });

  it('rejects a title over the max length', () => {
    const errors = validateEventInput({
      ...VALID,
      title: 'x'.repeat(EVENT_TITLE_MAX_LENGTH + 1),
    });
    expect(errors.title).toBeDefined();
  });

  it('rejects a location over the max length', () => {
    const errors = validateEventInput({
      ...VALID,
      location: 'x'.repeat(EVENT_LOCATION_MAX_LENGTH + 1),
    });
    expect(errors.location).toBeDefined();
  });

  it('rejects a description over the max length', () => {
    const errors = validateEventInput({
      ...VALID,
      description: 'x'.repeat(EVENT_DESCRIPTION_MAX_LENGTH + 1),
    });
    expect(errors.description).toBeDefined();
  });
});

describe('validateEventYouTubeUrl', () => {
  it('accepts an empty string (no stream set yet)', () => {
    expect(validateEventYouTubeUrl('')).toBeNull();
    expect(validateEventYouTubeUrl('   ')).toBeNull();
  });

  it('accepts a youtube.com/watch URL', () => {
    expect(
      validateEventYouTubeUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
    ).toBeNull();
  });

  it('accepts a youtu.be short URL', () => {
    expect(validateEventYouTubeUrl('https://youtu.be/dQw4w9WgXcQ')).toBeNull();
  });

  it('accepts a youtube.com/live URL', () => {
    expect(
      validateEventYouTubeUrl('https://www.youtube.com/live/dQw4w9WgXcQ')
    ).toBeNull();
  });

  it('rejects a non-http(s) value', () => {
    expect(validateEventYouTubeUrl('not-a-url')).not.toBeNull();
  });

  it('rejects a non-YouTube http(s) URL', () => {
    expect(validateEventYouTubeUrl('https://example.com/video')).not.toBeNull();
  });

  it('rejects a URL over the max length', () => {
    const longUrl =
      'https://www.youtube.com/watch?v=' + 'x'.repeat(EVENT_YOUTUBE_URL_MAX_LENGTH);
    expect(validateEventYouTubeUrl(longUrl)).not.toBeNull();
  });
});
