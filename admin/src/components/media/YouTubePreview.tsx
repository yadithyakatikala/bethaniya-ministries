import { useState } from 'react';
import { Box, Typography } from '@mui/material';
import PlayCircleOutlined from '@mui/icons-material/PlayCircleOutlined';
import { adminColors, adminRadii } from '../../theme/tokens';
import { youTubeEmbedUrl, youTubeThumbnailUrl } from '../../services/media/youtube';

/**
 * A YouTube video shown as its own thumbnail with a play button. The
 * player (YouTube's privacy-enhanced embed) is loaded only when the
 * button is pressed, so merely showing a list or opening a form makes no
 * request to YouTube's player.
 *
 * The frame is sandboxed to what the player needs (scripts, its own
 * origin, presentation) -- no popups, no top navigation, no forms.
 */
export function YouTubePreview({
  videoId,
  title,
  testIdPrefix,
  maxWidth = 480,
}: {
  videoId: string;
  /** Names the frame for assistive technology. */
  title: string;
  testIdPrefix: string;
  maxWidth?: number;
}) {
  const [playing, setPlaying] = useState(false);
  return (
    <Box
      data-testid={`${testIdPrefix}-preview`}
      sx={{
        border: `1px solid ${adminColors.border}`,
        borderRadius: `${adminRadii.control}px`,
        overflow: 'hidden',
        maxWidth,
        bgcolor: adminColors.surface,
      }}
    >
      {playing ? (
        <Box
          component="iframe"
          src={youTubeEmbedUrl(videoId)}
          title={title}
          allow="encrypted-media; picture-in-picture"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          sandbox="allow-scripts allow-same-origin allow-presentation"
          data-testid={`${testIdPrefix}-embed`}
          sx={{ width: '100%', aspectRatio: '16 / 9', border: 0, display: 'block' }}
        />
      ) : (
        <Box
          component="button"
          type="button"
          onClick={() => setPlaying(true)}
          aria-label="Play preview"
          data-testid={`${testIdPrefix}-play`}
          sx={{
            all: 'unset',
            cursor: 'pointer',
            position: 'relative',
            display: 'block',
            width: '100%',
            aspectRatio: '16 / 9',
            '&:focus-visible': {
              outline: `2px solid ${adminColors.accent}`,
              outlineOffset: -2,
            },
          }}
        >
          <Box
            component="img"
            src={youTubeThumbnailUrl(videoId)}
            alt=""
            data-testid={`${testIdPrefix}-thumbnail`}
            sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
          <Box
            aria-hidden
            sx={{
              position: 'absolute',
              inset: 0,
              display: 'grid',
              placeItems: 'center',
              color: adminColors.onPrimary,
              bgcolor: 'rgba(15, 27, 48, 0.35)',
            }}
          >
            <PlayCircleOutlined sx={{ fontSize: 56 }} />
          </Box>
        </Box>
      )}
      <Typography variant="caption" color="text.secondary" component="p" sx={{ p: 1 }}>
        YouTube video · {videoId}
      </Typography>
    </Box>
  );
}
