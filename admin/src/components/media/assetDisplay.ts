import type { MediaAsset } from '../../services/firebase/mediaAssets';
import { formatBytes, formatDuration } from '../../services/media/uploadRules';

/** One line of detail under a record's title: "JPG · 1600×900 · 2.1 MB". */
export function describeAsset(asset: MediaAsset): string {
  const parts: string[] = [];
  if (asset.source === 'youtube') parts.push('YouTube');
  else if (asset.source === 'link') parts.push('Link');
  if (asset.format) parts.push(asset.format.toUpperCase());
  if (asset.width && asset.height) parts.push(`${asset.width}×${asset.height}`);
  if (asset.durationSeconds !== null) parts.push(formatDuration(asset.durationSeconds));
  if (asset.bytes !== null) parts.push(formatBytes(asset.bytes));
  return parts.join(' · ');
}

/** Whether a record matches what was typed: title, file name and description. */
export function matchesSearch(asset: MediaAsset, search: string): boolean {
  const needle = search.trim().toLowerCase();
  if (!needle) return true;
  return [asset.title, asset.originalFilename ?? '', asset.altText].some((field) =>
    field.toLowerCase().includes(needle)
  );
}

const SHORT_ADDRESS_MAX = 60;

function clip(text: string): string {
  return text.length > SHORT_ADDRESS_MAX ? `${text.slice(0, SHORT_ADDRESS_MAX - 1)}…` : text;
}

/**
 * "res.cloudinary.com › easter.jpg" -- enough to recognise, short enough to
 * read. Never longer than one line of the form: a file name, or a pasted
 * address that is not a tidy URL at all, is cut with an ellipsis rather than
 * being allowed to wrap down the page.
 */
export function shortAddress(url: string): string {
  try {
    const parsed = new URL(url);
    const last = parsed.pathname.split('/').filter(Boolean).pop() ?? '';
    return clip(last && parsed.hostname ? `${parsed.hostname} › ${last}` : parsed.hostname || url);
  } catch {
    return clip(url);
  }
}
