/**
 * Addresses for SHOWING media in the admin, as opposed to storing it.
 *
 * WHAT IS STORED IS ALWAYS THE ORIGINAL. The address saved on an
 * announcement, a song or a plan cover is exactly the `secure_url`
 * Cloudinary returned. Nothing here changes it, and nothing here is used
 * to build it. That is deliberate: a transformed address (one with extra
 * path segments asking for a smaller or re-encoded copy) only works while
 * the Cloudinary account allows on-the-fly transformations. An account
 * with "Strict transformations" switched on answers a transformed address
 * with an error -- and if that address were the one a member's phone
 * loads, every picture in the app would break at once. The original
 * address cannot fail that way.
 *
 * THE LIBRARY'S THUMBNAILS DO ASK FOR A SMALL COPY, because a screen of
 * twenty-four 4 MB pictures is a screen of ninety megabytes (and the free
 * plan's bandwidth is the same pool of credits as its storage). Each
 * thumbnail is one transformation, counted once per picture and then
 * cached -- twenty-four pictures is about 0.024 of a credit. When the
 * thumbnail cannot be had, the screen falls back to the original (see
 * the `onError` handlers), so a strict account loses nothing but speed.
 */

const CLOUDINARY_DELIVERY = 'https://res.cloudinary.com/';
const IMAGE_UPLOAD_MARKER = '/image/upload/';

/** Whether this is an address on Cloudinary's standard delivery host. */
export function isCloudinaryUrl(url: string): boolean {
  return url.startsWith(CLOUDINARY_DELIVERY);
}

/**
 * The address of a small, cropped, optimised copy of an uploaded image, or
 * the address unchanged if it is not a Cloudinary image address (a pasted
 * link, a YouTube thumbnail, an audio file).
 */
export function cloudinaryThumbUrl(url: string, width = 320, height = 240): string {
  if (!isCloudinaryUrl(url)) return url;
  const at = url.indexOf(IMAGE_UPLOAD_MARKER);
  if (at < 0) return url;
  const head = url.slice(0, at + IMAGE_UPLOAD_MARKER.length);
  const tail = url.slice(at + IMAGE_UPLOAD_MARKER.length);
  return `${head}c_fill,w_${width},h_${height},q_auto,f_auto/${tail}`;
}
