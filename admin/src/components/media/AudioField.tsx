import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Alert, Box, Button, LinearProgress, TextField, Typography } from '@mui/material';
import CloudUploadOutlined from '@mui/icons-material/CloudUploadOutlined';
import PhotoLibraryOutlined from '@mui/icons-material/PhotoLibraryOutlined';
import { adminColors, adminRadii } from '../../theme/tokens';
import {
  getCloudinaryConfig,
  isUploadAvailable,
} from '../../services/media/cloudinaryConfig';
import {
  acceptAttribute,
  formatBytes,
  formatDuration,
} from '../../services/media/uploadRules';
import type { MediaCategory } from '../../services/media/types';
import { MediaPicker } from './MediaPicker';
import { UploadSetupNotice } from './UploadSetupNotice';
import { useMediaUpload } from './useMediaUpload';

export interface AudioFieldProps {
  /** The stored address, or '' for none. */
  value: string;
  onChange: (url: string) => void;
  label: string;
  category: MediaCategory;
  testIdPrefix: string;
  /** The form's own validation message for this field, shown beneath it. */
  error?: string;
  /** Told when an upload starts and ends, so the form can hold its Save button. */
  onBusyChange?: (busy: boolean) => void;
  helperText?: string;
  disabled?: boolean;
}

interface Details {
  name: string | null;
  format: string | null;
  bytes: number | null;
  durationSeconds: number | null;
}

/**
 * Choose, upload, play and replace ONE song or recording.
 *
 * The same three routes as ImageField -- upload, library, address -- but
 * the address box is always shown for audio. Existing songs were saved
 * with a link (including streams such as HLS `.m3u8` that nothing here
 * uploads), and the administrator editing one needs to see and change it.
 *
 * Whatever the address is, a player previews it, so "is this the right
 * song, and does it play?" is answered before saving. Its duration comes
 * from Cloudinary for an upload and from the player itself for a link.
 * `preload="metadata"` fetches only the start of the file: a 20 MB song
 * is not downloaded just because the form was opened.
 *
 * Audio is sent to Cloudinary as a VIDEO resource (see
 * ../../services/media/cloudinaryUpload.ts); this component does not need
 * to know that.
 */
export function AudioField({
  value,
  onChange,
  label,
  category,
  testIdPrefix: p,
  error,
  onBusyChange,
  helperText,
  disabled = false,
}: AudioFieldProps) {
  const config = getCloudinaryConfig();
  const uploadAvailable = isUploadAvailable(config, 'audio');

  const inputRef = useRef<HTMLInputElement>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [details, setDetails] = useState<Details | null>(null);
  const [playerDuration, setPlayerDuration] = useState<number | null>(null);
  const [playFailed, setPlayFailed] = useState(false);

  const { state, start, cancel, retry, dismiss } = useMediaUpload({
    kind: 'audio',
    category,
    onUploaded: ({ url, uploaded }) => {
      setPlayFailed(false);
      setPlayerDuration(null);
      setDetails({
        name: uploaded.originalFilename,
        format: uploaded.format,
        bytes: uploaded.bytes,
        durationSeconds: uploaded.durationSeconds,
      });
      onChange(url);
    },
  });

  const uploading = state.phase === 'uploading';

  const onBusyChangeRef = useRef(onBusyChange);
  useEffect(() => {
    onBusyChangeRef.current = onBusyChange;
  });
  useEffect(() => {
    onBusyChangeRef.current?.(uploading);
    return () => onBusyChangeRef.current?.(false);
  }, [uploading]);

  const trimmed = value.trim();
  const playable = /^https?:\/\/\S+$/i.test(trimmed);
  const duration = details?.durationSeconds ?? playerDuration;

  function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) start(file);
  }

  const facts = [
    details?.name,
    details?.format?.toUpperCase(),
    details?.bytes != null ? formatBytes(details.bytes) : null,
    duration !== null ? formatDuration(duration) : null,
  ].filter(Boolean);

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

      {uploading ? (
        <Box
          data-testid={`${p}-progress`}
          role="status"
          aria-live="polite"
          sx={{ mb: 1.5 }}
        >
          <Typography variant="body2" noWrap sx={{ mb: 0.75 }}>
            Uploading {state.fileName}… {state.percent}%
          </Typography>
          <LinearProgress
            variant="determinate"
            value={state.percent}
            aria-label={`Uploading ${state.fileName ?? 'audio'}`}
          />
          <Button
            size="small"
            sx={{ mt: 1 }}
            onClick={cancel}
            data-testid={`${p}-cancel`}
          >
            Cancel upload
          </Button>
        </Box>
      ) : (
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1.5 }}>
          {uploadAvailable ? (
            <Button
              variant="outlined"
              size="small"
              startIcon={<CloudUploadOutlined />}
              disabled={disabled}
              onClick={() => inputRef.current?.click()}
              data-testid={`${p}-upload-button`}
            >
              {trimmed ? 'Replace audio' : 'Upload audio'}
            </Button>
          ) : null}
          <Button
            variant="outlined"
            size="small"
            startIcon={<PhotoLibraryOutlined />}
            disabled={disabled}
            onClick={() => setPickerOpen(true)}
            data-testid={`${p}-library-button`}
          >
            Choose from library
          </Button>
        </Box>
      )}

      {uploadAvailable ? (
        <input
          ref={inputRef}
          type="file"
          hidden
          accept={acceptAttribute('audio')}
          onChange={handleFile}
          data-testid={`${p}-input`}
        />
      ) : disabled ? null : (
        <Box sx={{ mb: 1.5 }}>
          <UploadSetupNotice config={config} kind="audio" testId={`${p}-setup`} />
        </Box>
      )}

      <TextField
        label="Audio address"
        placeholder="https://"
        fullWidth
        value={value}
        disabled={disabled}
        onChange={(event) => {
          setDetails(null);
          setPlayerDuration(null);
          setPlayFailed(false);
          onChange(event.target.value);
        }}
        error={Boolean(error)}
        helperText={
          error ??
          helperText ??
          'Filled in for you when you upload. You can also paste a direct link to an audio file or stream (.mp3, .m4a, .wav, or an HLS .m3u8). A YouTube or Spotify page link will not play: those are web pages, not audio files.'
        }
        slotProps={{ htmlInput: { 'data-testid': `${p}-url-input` } }}
      />

      {playable ? (
        <Box
          sx={{
            mt: 1.5,
            p: 1.5,
            border: `1px solid ${adminColors.border}`,
            borderRadius: `${adminRadii.control}px`,
            bgcolor: adminColors.surfaceRaised,
          }}
          data-testid={`${p}-preview`}
        >
          <Box
            component="audio"
            controls
            preload="metadata"
            src={trimmed}
            data-testid={`${p}-player`}
            aria-label={`${label} preview`}
            onLoadedMetadata={(event: React.SyntheticEvent<HTMLAudioElement>) => {
              const seconds = event.currentTarget.duration;
              if (Number.isFinite(seconds)) setPlayerDuration(seconds);
              setPlayFailed(false);
            }}
            onError={() => setPlayFailed(true)}
            sx={{ width: '100%' }}
          />
          {facts.length > 0 ? (
            <Typography
              variant="caption"
              color="text.secondary"
              component="p"
              sx={{ mt: 0.5 }}
              data-testid={`${p}-facts`}
            >
              {facts.join(' · ')}
            </Typography>
          ) : null}
          {playFailed ? (
            <Alert severity="warning" sx={{ mt: 1 }} data-testid={`${p}-play-failed`}>
              This address could not be played as audio. It must be a direct link to an
              audio file or stream.
            </Alert>
          ) : null}
        </Box>
      ) : null}

      {state.error ? (
        <Alert
          severity="error"
          sx={{ mt: 1.5 }}
          data-testid={`${p}-error`}
          action={
            state.phase === 'error' ? (
              <Button
                color="inherit"
                size="small"
                onClick={retry}
                data-testid={`${p}-retry`}
              >
                Try again
              </Button>
            ) : (
              <Button color="inherit" size="small" onClick={dismiss}>
                Dismiss
              </Button>
            )
          }
        >
          {state.error}
        </Alert>
      ) : null}

      {state.libraryWarning ? (
        <Alert severity="warning" sx={{ mt: 1.5 }} data-testid={`${p}-library-warning`}>
          The audio was uploaded and is ready to use. {state.libraryWarning}
        </Alert>
      ) : null}

      <MediaPicker
        open={pickerOpen}
        kinds={['audio']}
        title={`Choose audio for ${label.toLowerCase()}`}
        onClose={() => setPickerOpen(false)}
        onSelect={(asset) => {
          setPickerOpen(false);
          setPlayFailed(false);
          setPlayerDuration(null);
          setDetails({
            name: asset.originalFilename ?? asset.title,
            format: asset.format,
            bytes: asset.bytes,
            durationSeconds: asset.durationSeconds,
          });
          onChange(asset.url);
        }}
        testIdPrefix={`${p}-picker`}
      />
    </Box>
  );
}
