import { Box, Paper, Typography } from '@mui/material';
import { mediaUrlProblem, MEDIA_URL_MESSAGES } from './validation';
import type { MediaType } from '../../services/firebase/media';

/**
 * What a member will see, shown beside the form.
 *
 * =====================================================================
 * THE PREVIEW IS THE URL CHECK PEOPLE ACTUALLY READ
 * =====================================================================
 * An administrator pasting a link cannot tell from the text whether it
 * points at the right picture. So the preview loads it -- and when the
 * address is one this app refuses, it says WHY, in the same sentence the
 * form will use, instead of showing a broken image icon that could mean
 * anything.
 *
 * It deliberately does NOT render a video player. A YouTube link plays
 * on the phone through YouTube's own embed; here it is named as a video
 * with its address, because loading a player into an admin form to
 * preview one field is a lot of machinery for a link check, and the
 * thing worth checking -- that the address is the right one -- is
 * readable without it.
 *
 * Nothing here is `dangerouslySetInnerHTML`, and no part of the post is
 * ever treated as markup: a caption is text in a <Typography>, and the
 * address only ever becomes an <img src>.
 */
export function MediaPreview({
  type,
  mediaUrl,
  caption,
  verseReference,
  verseText,
}: {
  type: MediaType;
  mediaUrl: string;
  caption: string;
  verseReference: string;
  verseText: string;
}) {
  const trimmedUrl = mediaUrl.trim();
  const problem = trimmedUrl.length > 0 ? mediaUrlProblem(trimmedUrl) : null;

  return (
    <Box data-testid="media-preview">
      <Typography variant="overline" color="text.secondary">
        Preview
      </Typography>
      <Paper variant="outlined" sx={{ p: 2, mt: 1 }}>
        {trimmedUrl.length === 0 ? (
          <Typography
            variant="body2"
            color="text.secondary"
            data-testid="media-preview-empty"
          >
            Paste a media address to see it here.
          </Typography>
        ) : problem ? (
          <Typography variant="body2" color="error" data-testid="media-preview-problem">
            {MEDIA_URL_MESSAGES[problem]}
          </Typography>
        ) : type === 'video' ? (
          <Box data-testid="media-preview-video">
            <Typography variant="body2" color="text.secondary">
              Video
            </Typography>
            <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
              {trimmedUrl}
            </Typography>
          </Box>
        ) : (
          <Box
            component="img"
            src={trimmedUrl}
            alt="Media preview"
            data-testid="media-preview-image"
            sx={{ width: '100%', maxHeight: 320, objectFit: 'cover', borderRadius: 1 }}
          />
        )}

        {caption.trim().length > 0 ? (
          <Typography variant="body1" sx={{ mt: 2 }} data-testid="media-preview-caption">
            {caption}
          </Typography>
        ) : null}

        {verseText.trim().length > 0 || verseReference.trim().length > 0 ? (
          <Box
            data-testid="media-preview-verse"
            sx={{ mt: 2, pl: 2, borderLeft: 3, borderColor: 'primary.main' }}
          >
            {verseText.trim().length > 0 ? (
              <Typography variant="body2">{verseText}</Typography>
            ) : null}
            {verseReference.trim().length > 0 ? (
              <Typography variant="caption" color="text.secondary">
                {verseReference}
              </Typography>
            ) : null}
          </Box>
        ) : null}
      </Paper>
    </Box>
  );
}
