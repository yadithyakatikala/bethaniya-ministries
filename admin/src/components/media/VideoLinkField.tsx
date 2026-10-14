import { useState } from 'react';
import { Alert, Box, Button, TextField, Typography } from '@mui/material';
import PhotoLibraryOutlined from '@mui/icons-material/PhotoLibraryOutlined';
import { describeVideoLinkProblem, parseYouTubeUrl } from '../../services/media/youtube';
import { MediaPicker } from './MediaPicker';
import { YouTubePreview } from './YouTubePreview';

export interface VideoLinkFieldProps {
  value: string;
  onChange: (url: string) => void;
  label: string;
  testIdPrefix: string;
  /** The form's own validation message for this field. */
  error?: string;
  helperText?: string;
  disabled?: boolean;
}

/**
 * A video is a LINK, and long video belongs on YouTube.
 *
 * Sermons, recordings, music videos and livestream replays are large; a
 * 100 MB file would use a free media account's bandwidth in a handful of
 * views, and YouTube already does the hard parts. So this field never
 * uploads video. It checks the address as it is typed, tidies any
 * YouTube address (watch, share, Shorts, mobile, music) to the one
 * standard form the phone app plays, and shows the video's own thumbnail.
 * "Play preview" loads YouTube's privacy-enhanced player on request, so
 * merely opening the form makes no request to YouTube's player.
 *
 * A link that is not YouTube is allowed, not rejected: existing posts use
 * them, and the form says how they will appear.
 */
export function VideoLinkField({
  value,
  onChange,
  label,
  testIdPrefix: p,
  error,
  helperText,
  disabled = false,
}: VideoLinkFieldProps) {
  const [pickerOpen, setPickerOpen] = useState(false);

  const trimmed = value.trim();
  const youtube = parseYouTubeUrl(trimmed);
  const liveProblem = trimmed ? describeVideoLinkProblem(trimmed) : null;

  return (
    <Box
      role="group"
      aria-labelledby={`${p}-label`}
      data-testid={`${p}-field`}
      sx={{ mt: 2, mb: 1 }}
    >
      <Typography id={`${p}-label`} variant="subtitle2" sx={{ mb: 1 }}>
        {label}
      </Typography>

      <TextField
        label="Video address"
        placeholder="https://www.youtube.com/watch?v=…"
        fullWidth
        value={value}
        disabled={disabled}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        onBlur={() => {
          // Store what the phone is guaranteed to play, not what was pasted.
          if (youtube && youtube.canonicalUrl !== trimmed) onChange(youtube.canonicalUrl);
        }}
        error={Boolean(error ?? liveProblem)}
        helperText={
          error ??
          liveProblem ??
          helperText ??
          'Paste a YouTube address, from the browser or the Share button. A YouTube link plays in the app. Any other link is shown as a picture.'
        }
        slotProps={{ htmlInput: { 'data-testid': `${p}-url-input` } }}
      />

      <Box sx={{ mt: 1 }}>
        <Button
          size="small"
          variant="outlined"
          startIcon={<PhotoLibraryOutlined />}
          disabled={disabled}
          onClick={() => setPickerOpen(true)}
          data-testid={`${p}-library-button`}
        >
          Choose from library
        </Button>
      </Box>

      {youtube ? (
        <Box sx={{ mt: 1.5 }}>
          <YouTubePreview
            key={youtube.videoId}
            videoId={youtube.videoId}
            title={`${label} preview`}
            testIdPrefix={p}
          />
        </Box>
      ) : trimmed && !liveProblem && !error ? (
        <Alert severity="info" sx={{ mt: 1.5 }} data-testid={`${p}-not-youtube`}>
          This is not a YouTube link. In the app it will be shown as a picture. Long video
          is best kept on YouTube.
        </Alert>
      ) : null}

      <MediaPicker
        open={pickerOpen}
        kinds={['video']}
        title={`Choose a video for ${label.toLowerCase()}`}
        onClose={() => setPickerOpen(false)}
        onSelect={(asset) => {
          setPickerOpen(false);
          onChange(asset.url);
        }}
        testIdPrefix={`${p}-picker`}
      />
    </Box>
  );
}
