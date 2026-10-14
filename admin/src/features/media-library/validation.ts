/**
 * Checks for the media library's own forms: relabelling a record, and
 * adding a link. Client-side convenience only -- firestore.rules'
 * isValidMediaAsset() is the real boundary and enforces the same limits.
 */
import { mediaUrlProblem, MEDIA_URL_MESSAGES } from '../media/validation';
import {
  describeVideoLinkProblem,
  looksLikeYouTube,
  parseYouTubeUrl,
  type ParsedYouTube,
} from '../../services/media/youtube';
import type { MediaKind } from '../../services/media/types';

export const ASSET_TITLE_MAX_LENGTH = 200;
export const ASSET_ALT_MAX_LENGTH = 500;

export interface AssetDetailsErrors {
  title?: string;
  altText?: string;
}

/** `titleRequired` is true when editing (a record must be nameable), false at upload (the file name is used). */
export function validateAssetDetails(
  input: { title: string; altText: string },
  titleRequired = true
): AssetDetailsErrors {
  const errors: AssetDetailsErrors = {};
  const title = input.title.trim();
  if (titleRequired && title.length === 0) errors.title = 'A name is required.';
  else if (title.length > ASSET_TITLE_MAX_LENGTH) {
    errors.title = `The name must be ${ASSET_TITLE_MAX_LENGTH} characters or fewer.`;
  }
  if (input.altText.trim().length > ASSET_ALT_MAX_LENGTH) {
    errors.altText = `The description must be ${ASSET_ALT_MAX_LENGTH} characters or fewer.`;
  }
  return errors;
}

export type LinkCheck =
  | { ok: true; address: string; youtube: ParsedYouTube | null }
  | { ok: false; message: string };

/**
 * Whether a pasted address can be added to the library as `kind`.
 *
 * A video may be a YouTube address (tidied to the standard form, with its
 * id kept) or any other https link; an image or audio link must be https.
 * Everything goes through the same https-only, no-credentials,
 * no-executables check the congregation's feed uses.
 */
export function checkLink(kind: MediaKind, input: string): LinkCheck {
  const address = input.trim();
  if (kind === 'video') {
    const problem = describeVideoLinkProblem(address);
    if (problem) return { ok: false, message: problem };
    const youtube = parseYouTubeUrl(address);
    if (youtube) return { ok: true, address: youtube.canonicalUrl, youtube };
    if (looksLikeYouTube(address)) {
      return { ok: false, message: 'That YouTube address is not a single video.' };
    }
  }
  const problem = mediaUrlProblem(address);
  if (problem) return { ok: false, message: MEDIA_URL_MESSAGES[problem] };
  return { ok: true, address, youtube: null };
}
