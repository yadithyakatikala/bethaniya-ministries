import type { MediaAsset } from '../../services/firebase/mediaAssets';
import { MEDIA_KIND_LABELS } from '../../services/media/types';
import { formatBytes, formatDuration } from '../../services/media/uploadRules';

const SOURCE_LABELS: Record<MediaAsset['source'], string> = {
  cloudinary: 'Uploaded to Cloudinary',
  youtube: 'YouTube link',
  link: 'Web link',
};

function formatDate(date: Date | null): string {
  if (!date) return '—';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date);
}

/** The file's own details, as label/value pairs, skipping what is not known. */
export function assetFacts(asset: MediaAsset): { label: string; value: string }[] {
  const facts: { label: string; value: string | null }[] = [
    { label: 'Type', value: MEDIA_KIND_LABELS[asset.kind] },
    { label: 'Source', value: SOURCE_LABELS[asset.source] },
    { label: 'File name', value: asset.originalFilename },
    { label: 'Format', value: asset.format ? asset.format.toUpperCase() : null },
    { label: 'Size', value: asset.bytes !== null ? formatBytes(asset.bytes) : null },
    {
      label: 'Dimensions',
      value: asset.width && asset.height ? `${asset.width} × ${asset.height}` : null,
    },
    {
      label: 'Length',
      value:
        asset.durationSeconds !== null ? formatDuration(asset.durationSeconds) : null,
    },
    {
      label: 'Added',
      value: `${formatDate(asset.createdAt)}${asset.createdByName ? ` by ${asset.createdByName}` : ''}`,
    },
  ];
  return facts.filter(
    (f): f is { label: string; value: string } => f.value !== null && f.value !== ''
  );
}
