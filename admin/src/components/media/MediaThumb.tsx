import { useState } from 'react';
import { Box } from '@mui/material';
import AudiotrackOutlined from '@mui/icons-material/AudiotrackOutlined';
import OndemandVideoOutlined from '@mui/icons-material/OndemandVideoOutlined';
import ImageOutlined from '@mui/icons-material/ImageOutlined';
import { adminColors, adminRadii } from '../../theme/tokens';
import { cloudinaryThumbUrl } from '../../services/media/delivery';
import type { MediaKind } from '../../services/media/types';

/**
 * A small picture standing for a media record: the image itself, a
 * YouTube still, or a tile with the kind's icon for audio.
 *
 * Images ask Cloudinary for a small copy first (see
 * ../../services/media/delivery.ts for why) and fall back to the original
 * address if that fails -- an account with strict transformations on
 * refuses the small copy but still serves the original. If neither loads
 * the tile shows the image icon rather than the browser's broken-picture
 * mark.
 */
export function MediaThumb({
  kind,
  url,
  thumbnailUrl,
  label,
  size = 96,
  testId,
}: {
  kind: MediaKind;
  url: string;
  thumbnailUrl?: string | null;
  label: string;
  size?: number | string;
  testId?: string;
}) {
  const [stage, setStage] = useState<'thumb' | 'original' | 'failed'>('thumb');

  const source =
    kind === 'audio'
      ? null
      : stage === 'thumb'
        ? (thumbnailUrl ?? (kind === 'image' ? cloudinaryThumbUrl(url) : null))
        : stage === 'original' && kind === 'image'
          ? url
          : null;

  // `titleAccess` is how MUI exposes an icon to assistive technology (it
  // otherwise hides every icon). An empty label means the tile is
  // decorative: the picker's card carries its own name.
  const Icon =
    kind === 'audio'
      ? AudiotrackOutlined
      : kind === 'video'
        ? OndemandVideoOutlined
        : ImageOutlined;

  return (
    <Box
      data-testid={testId}
      sx={{
        width: size,
        height: typeof size === 'number' ? size : undefined,
        aspectRatio: typeof size === 'number' ? undefined : '4 / 3',
        borderRadius: `${adminRadii.control}px`,
        overflow: 'hidden',
        bgcolor: adminColors.surfaceRaised,
        color: adminColors.inkSubtle,
        display: 'grid',
        placeItems: 'center',
        flexShrink: 0,
      }}
    >
      {source ? (
        <Box
          component="img"
          src={source}
          alt={label}
          loading="lazy"
          onError={() =>
            setStage(stage === 'thumb' && kind === 'image' ? 'original' : 'failed')
          }
          sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      ) : (
        <Icon titleAccess={label || undefined} />
      )}
    </Box>
  );
}
