import { describe, expect, it } from 'vitest';
import {
  AUDIO_MAX_BYTES,
  CLOUDINARY_FREE_IMAGE_MAX_BYTES,
  CLOUDINARY_FREE_VIDEO_MAX_BYTES,
  IMAGE_MAX_BYTES,
  MB,
  acceptAttribute,
  fileExtension,
  formatBytes,
  formatDuration,
  validateUploadFile,
} from '../uploadRules';

/** A File of a given reported size, without allocating that many bytes. */
function fileOf(name: string, type: string, size = 1000): File {
  const file = new File(['x'], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
}

describe('image uploads', () => {
  it.each([
    ['photo.jpg', 'image/jpeg'],
    ['photo.JPEG', 'image/jpeg'],
    ['poster.png', 'image/png'],
    ['cover.webp', 'image/webp'],
    ['funny.gif', 'image/gif'],
  ])('accepts %s', (name, type) => {
    expect(validateUploadFile(fileOf(name, type), 'image')).toBeNull();
  });

  it.each([
    ['logo.svg', 'image/svg+xml'], // can carry script
    ['scan.bmp', 'image/bmp'],
    ['scan.tiff', 'image/tiff'],
    ['phone.heic', 'image/heic'],
    ['notes.pdf', 'application/pdf'],
    ['tool.exe', 'application/octet-stream'],
    ['noextension', 'image/jpeg'],
  ])('rejects %s', (name, type) => {
    expect(validateUploadFile(fileOf(name, type), 'image')).toMatch(
      /Please choose a JPEG, PNG, WebP or GIF image\./
    );
  });

  it('catches a file whose name lies about its contents', () => {
    expect(validateUploadFile(fileOf('photo.jpg', 'video/mp4'), 'image')).not.toBeNull();
    expect(validateUploadFile(fileOf('photo.jpg', 'text/html'), 'image')).not.toBeNull();
  });

  it('accepts a file with no reported MIME type, judging by its extension', () => {
    expect(validateUploadFile(fileOf('photo.png', ''), 'image')).toBeNull();
  });

  it('rejects an empty file', () => {
    expect(validateUploadFile(fileOf('photo.jpg', 'image/jpeg', 0), 'image')).toBe(
      'That image is empty.'
    );
  });

  it('keeps the original "smaller than 5 MB" boundary and wording', () => {
    expect(
      validateUploadFile(fileOf('a.jpg', 'image/jpeg', IMAGE_MAX_BYTES - 1), 'image')
    ).toBeNull();
    expect(
      validateUploadFile(fileOf('a.jpg', 'image/jpeg', IMAGE_MAX_BYTES), 'image')
    ).toBe('Image must be smaller than 5 MB.');
  });
});

describe('audio uploads', () => {
  it.each([
    ['hymn.mp3', 'audio/mpeg'],
    ['hymn.MP3', 'audio/mp3'],
    ['hymn.m4a', 'audio/mp4'],
    ['hymn.m4a', 'audio/x-m4a'],
    ['hymn.m4a', ''], // some browsers report nothing for .m4a
    ['hymn.m4a', 'video/mp4'], // others report the container
    ['hymn.aac', 'audio/aac'],
    ['hymn.wav', 'audio/wav'],
    ['hymn.wav', 'audio/x-wav'],
  ])('accepts %s reported as "%s"', (name, type) => {
    expect(validateUploadFile(fileOf(name, type), 'audio')).toBeNull();
  });

  it.each([
    ['hymn.ogg', 'audio/ogg'], // iOS will not play it
    ['hymn.opus', 'audio/opus'],
    ['hymn.flac', 'audio/flac'], // lossless: several times the size
    ['movie.mp4', 'video/mp4'], // a video, not a song
    ['photo.jpg', 'image/jpeg'],
  ])('rejects %s', (name, type) => {
    expect(validateUploadFile(fileOf(name, type), 'audio')).toMatch(
      /MP3, M4A, AAC or WAV/
    );
  });

  it('catches an audio name on a file that is not audio', () => {
    expect(validateUploadFile(fileOf('song.mp3', 'image/png'), 'audio')).toMatch(
      /does not look like an audio file/
    );
  });

  it('enforces the size cap and suggests the fix', () => {
    expect(
      validateUploadFile(fileOf('a.mp3', 'audio/mpeg', AUDIO_MAX_BYTES - 1), 'audio')
    ).toBeNull();
    expect(
      validateUploadFile(fileOf('a.wav', 'audio/wav', AUDIO_MAX_BYTES), 'audio')
    ).toBe('Audio must be smaller than 25 MB. Try saving it as an MP3.');
  });
});

describe('limits relative to the Cloudinary free plan', () => {
  it('stays under the published per-file ceilings', () => {
    expect(IMAGE_MAX_BYTES).toBeLessThan(CLOUDINARY_FREE_IMAGE_MAX_BYTES);
    expect(AUDIO_MAX_BYTES).toBeLessThan(CLOUDINARY_FREE_VIDEO_MAX_BYTES);
  });
});

describe('helpers', () => {
  it('builds an accept attribute with both extensions and MIME types', () => {
    const image = acceptAttribute('image');
    expect(image).toContain('image/jpeg');
    expect(image).toContain('.webp');
    expect(image).not.toContain('svg');
    const audio = acceptAttribute('audio');
    expect(audio).toContain('audio/mpeg');
    expect(audio).toContain('.m4a');
  });

  it('reads extensions case-insensitively and from the last dot', () => {
    expect(fileExtension('A.JPG')).toBe('jpg');
    expect(fileExtension('archive.tar.gz')).toBe('gz');
    expect(fileExtension('noext')).toBe('');
  });

  it('formats sizes for people', () => {
    expect(formatBytes(512)).toBe('1 KB');
    expect(formatBytes(1536)).toBe('2 KB');
    expect(formatBytes(1.5 * MB)).toBe('1.5 MB');
    expect(formatBytes(12 * MB)).toBe('12 MB');
    expect(formatBytes(-1)).toBe('');
    expect(formatBytes(Number.NaN)).toBe('');
  });

  it('formats durations for people', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(187)).toBe('3:07');
    expect(formatDuration(3729)).toBe('1:02:09');
    expect(formatDuration(-3)).toBe('');
    expect(formatDuration(Number.NaN)).toBe('');
  });
});
