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

/** "res.cloudinary.com › easter.jpg" -- enough to recognise, short enough to read. */
export function shortAddress(url: string): string {
  try {
    const parsed = new URL(url);
    const last = parsed.pathname.split('/').filter(Boolean).pop() ?? '';
    return last ? `${parsed.hostname} › ${last}` : parsed.hostname;
  } catch {
    return url;
  }
}
