import { describe, expect, it } from 'vitest';
import {
  SONG_ARTIST_MAX_LENGTH,
  SONG_CATEGORY_MAX_LENGTH,
  SONG_LYRICS_MAX_LENGTH,
  SONG_TITLE_MAX_LENGTH,
  hasValidationErrors,
  validateSongCoverImage,
  validateSongInput,
} from '../validation';

const VALID: Parameters<typeof validateSongInput>[0] = {
  title: 'Amazing Grace',
  artist: 'John Newton',
  category: 'Hymn',
  lyrics: 'Amazing grace, how sweet the sound...',
  audioUrl: 'https://example.com/amazing-grace.mp3',
};

describe('validateSongInput', () => {
  it('returns no errors for valid input', () => {
    expect(hasValidationErrors(validateSongInput(VALID))).toBe(false);
  });

  it('requires a non-empty title', () => {
    const errors = validateSongInput({ ...VALID, title: '   ' });
    expect(errors.title).toBeDefined();
  });

  it('requires a non-empty artist', () => {
    const errors = validateSongInput({ ...VALID, artist: '   ' });
    expect(errors.artist).toBeDefined();
  });

  it('requires a non-empty category', () => {
    const errors = validateSongInput({ ...VALID, category: '   ' });
    expect(errors.category).toBeDefined();
  });

  it('requires non-empty lyrics', () => {
    const errors = validateSongInput({ ...VALID, lyrics: '   ' });
    expect(errors.lyrics).toBeDefined();
  });

  it('requires a non-empty audio URL', () => {
    const errors = validateSongInput({ ...VALID, audioUrl: '   ' });
    expect(errors.audioUrl).toBeDefined();
  });

  it('rejects an audio URL that is not http(s)', () => {
    const errors = validateSongInput({ ...VALID, audioUrl: 'not-a-url' });
    expect(errors.audioUrl).toBeDefined();
  });

  it('accepts an http (not just https) audio URL', () => {
    const errors = validateSongInput({
      ...VALID,
      audioUrl: 'http://example.com/song.mp3',
    });
    expect(errors.audioUrl).toBeUndefined();
  });

  it('rejects a title over the max length', () => {
    const errors = validateSongInput({
      ...VALID,
      title: 'x'.repeat(SONG_TITLE_MAX_LENGTH + 1),
    });
    expect(errors.title).toBeDefined();
  });

  it('rejects an artist over the max length', () => {
    const errors = validateSongInput({
      ...VALID,
      artist: 'x'.repeat(SONG_ARTIST_MAX_LENGTH + 1),
    });
    expect(errors.artist).toBeDefined();
  });

  it('rejects a category over the max length', () => {
    const errors = validateSongInput({
      ...VALID,
      category: 'x'.repeat(SONG_CATEGORY_MAX_LENGTH + 1),
    });
    expect(errors.category).toBeDefined();
  });

  it('rejects lyrics over the max length', () => {
    const errors = validateSongInput({
      ...VALID,
      lyrics: 'x'.repeat(SONG_LYRICS_MAX_LENGTH + 1),
    });
    expect(errors.lyrics).toBeDefined();
  });
});

describe('validateSongCoverImage', () => {
  it('accepts a small image file', () => {
    const file = new File(['a'], 'cover.jpg', { type: 'image/jpeg' });
    expect(validateSongCoverImage(file)).toBeNull();
  });

  it('rejects a non-image file', () => {
    const file = new File(['a'], 'doc.pdf', { type: 'application/pdf' });
    expect(validateSongCoverImage(file)).not.toBeNull();
  });

  it('rejects a file at/over the 5MB cap', () => {
    const file = new File([new Uint8Array(5 * 1024 * 1024)], 'big.jpg', {
      type: 'image/jpeg',
    });
    expect(validateSongCoverImage(file)).not.toBeNull();
  });
});
