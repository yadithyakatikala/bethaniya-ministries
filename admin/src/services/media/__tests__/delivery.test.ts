import { describe, expect, it } from 'vitest';
import { cloudinaryThumbUrl, isCloudinaryUrl } from '../delivery';

const IMAGE =
  'https://res.cloudinary.com/my-church/image/upload/v1700/maranatha/easter.jpg';

describe('cloudinaryThumbUrl', () => {
  it('asks Cloudinary for a small, cropped, optimised copy of an uploaded image', () => {
    expect(cloudinaryThumbUrl(IMAGE)).toBe(
      'https://res.cloudinary.com/my-church/image/upload/c_fill,w_320,h_240,q_auto,f_auto/v1700/maranatha/easter.jpg'
    );
  });

  it('takes the size asked for', () => {
    expect(cloudinaryThumbUrl(IMAGE, 96, 96)).toContain(
      '/c_fill,w_96,h_96,q_auto,f_auto/'
    );
  });

  it('leaves everything else exactly as it was', () => {
    for (const url of [
      'https://example.org/poster.png',
      'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
      // Audio is a "video" resource: there is no picture to crop.
      'https://res.cloudinary.com/my-church/video/upload/v1/hymn.mp3',
      '',
    ]) {
      expect(cloudinaryThumbUrl(url)).toBe(url);
    }
  });

  it('does not touch an address that only mentions Cloudinary', () => {
    const lookalike = 'https://evil.example/res.cloudinary.com/x/image/upload/a.jpg';
    expect(cloudinaryThumbUrl(lookalike)).toBe(lookalike);
  });

  it('never changes the original: the thumbnail is a separate address', () => {
    const thumb = cloudinaryThumbUrl(IMAGE);
    expect(thumb).not.toBe(IMAGE);
    expect(IMAGE).toBe(
      'https://res.cloudinary.com/my-church/image/upload/v1700/maranatha/easter.jpg'
    );
  });

  it('knows a Cloudinary delivery address when it sees one', () => {
    expect(isCloudinaryUrl(IMAGE)).toBe(true);
    expect(isCloudinaryUrl('https://example.org/a.jpg')).toBe(false);
  });
});
