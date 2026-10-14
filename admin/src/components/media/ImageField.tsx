import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Alert, Box, Button, LinearProgress, TextField, Typography } from '@mui/material';
import CloudUploadOutlined from '@mui/icons-material/CloudUploadOutlined';
import PhotoLibraryOutlined from '@mui/icons-material/PhotoLibraryOutlined';
import LinkOutlined from '@mui/icons-material/LinkOutlined';
import DeleteOutlined from '@mui/icons-material/DeleteOutlined';
import ImageOutlined from '@mui/icons-material/ImageOutlined';
import { adminColors, adminRadii } from '../../theme/tokens';
import {
  getCloudinaryConfig,
  isUploadAvailable,
} from '../../services/media/cloudinaryConfig';
import { acceptAttribute } from '../../services/media/uploadRules';
import type { MediaCategory } from '../../services/media/types';
import { mediaUrlProblem, MEDIA_URL_MESSAGES } from '../../features/media/validation';
import { MediaPicker } from './MediaPicker';
import { shortAddress } from './assetDisplay';
import { UploadSetupNotice } from './UploadSetupNotice';
import { useMediaUpload } from './useMediaUpload';

export interface ImageFieldProps {
  /** The stored address, or null for none. */
  value: string | null;
  onChange: (url: string | null) => void;
  label: string;
  /** Which library category an upload from this field is filed under. */
  category: MediaCategory;
  /** Prefix for the field's test ids: `${prefix}-input`, `${prefix}-error`, ... */
  testIdPrefix: string;
  helperText?: string;
  /** A feature's own file check; defaults to the shared upload rules. */
  validateFile?: (file: File) => string | null;
  /** The form's own message about this field, shown beneath it. */
  error?: string;
  /**
   * Told when an upload starts and ends, so the form can hold its Save
   * button until the address of the new image is known. Without this, a
   * Save pressed mid-upload would store the OLD image.
   */
  onBusyChange?: (busy: boolean) => void;
  disabled?: boolean;
}

/**
 * Choose, upload, preview, replace and remove ONE image.
 *
 * Three ways in, in this order of preference:
 *   1. UPLOAD a file from the computer -- checked in the browser, sent to
 *      Cloudinary with a progress bar, and recorded in the media library.
 *   2. CHOOSE one already in the library.
 *   3. USE A WEB ADDRESS -- an https link, for an image that already lives
 *      somewhere. Kept so existing content that was saved with a link can
 *      still be edited, and for the days before uploading is set up.
 *
 * When uploading is not configured the first option is replaced by a
 * plain-language setup notice instead of a button that cannot work; the
 * other two still do.
 *
 * Nothing is stored by this component. It reports the new address through
 * `onChange` and the form saves it with everything else, so "Replace" and
 * "Remove" change only what is about to be saved -- they never delete a
 * file, and an image the administrator walks away from stays harmlessly in
 * the library.
 */
export function ImageField({
  value,
  onChange,
  label,
  category,
  testIdPrefix: p,
  helperText,
  validateFile,
  error,
  onBusyChange,
  disabled = false,
}: ImageFieldProps) {
  const config = getCloudinaryConfig();
  const uploadAvailable = isUploadAvailable(config, 'image');

  const inputRef = useRef<HTMLInputElement>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [showUrl, setShowUrl] = useState(false);
  const [urlDraft, setUrlDraft] = useState('');
  const [urlError, setUrlError] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  const { state, start, cancel, retry, dismiss } = useMediaUpload({
    kind: 'image',
    category,
    validateFile,
    onUploaded: (result) => {
      setLoadFailed(false);
      setShowUrl(false);
      onChange(result.url);
    },
  });

  const uploading = state.phase === 'uploading';
  const shownUrl = uploading ? state.previewUrl : value;

  const onBusyChangeRef = useRef(onBusyChange);
  useEffect(() => {
    onBusyChangeRef.current = onBusyChange;
  });
  useEffect(() => {
    onBusyChangeRef.current?.(uploading);
    // Leaving the page mid-upload cancels it (see useMediaUpload), so the
    // form must not stay "busy" for a field that no longer exists.
    return () => onBusyChangeRef.current?.(false);
  }, [uploading]);
  // With no upload set up the address box is the only way in, so it is
  // simply shown; otherwise it waits behind a button. A field that cannot be
  // edited (a role with read-only access) offers neither the box nor the
  // setup notice: the notice is for the person who can act on it.
  const urlVisible = !disabled && (showUrl || (!uploadAvailable && !value));

  function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Cleared so choosing the same file again still fires a change.
    event.target.value = '';
    if (file) start(file);
  }

  function applyUrl() {
    const problem = mediaUrlProblem(urlDraft);
    if (problem) {
      setUrlError(MEDIA_URL_MESSAGES[problem]);
      return;
    }
    setUrlError(null);
    setLoadFailed(false);
    onChange(urlDraft.trim());
    setUrlDraft('');
    setShowUrl(false);
  }

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

      <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <Box
          sx={{
            width: 168,
            height: 126,
            borderRadius: `${adminRadii.control}px`,
            border: `1px ${shownUrl ? 'solid' : 'dashed'} ${adminColors.borderStrong}`,
            bgcolor: adminColors.surfaceRaised,
            display: 'grid',
            placeItems: 'center',
            overflow: 'hidden',
            flexShrink: 0,
            color: adminColors.inkSubtle,
          }}
        >
          {shownUrl ? (
            <Box
              component="img"
              src={shownUrl}
              alt={`${label} preview`}
              data-testid={`${p}-preview`}
              onError={() => setLoadFailed(true)}
              onLoad={() => setLoadFailed(false)}
              sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          ) : (
            <Box sx={{ textAlign: 'center', px: 1 }}>
              <ImageOutlined aria-hidden />
              <Typography variant="caption" component="p">
                No image
              </Typography>
            </Box>
          )}
        </Box>

        <Box sx={{ flex: '1 1 260px', minWidth: 0 }}>
          {uploading ? (
            <Box data-testid={`${p}-progress`} role="status" aria-live="polite">
              <Typography variant="body2" noWrap sx={{ mb: 0.75 }}>
                Uploading {state.fileName}… {state.percent}%
              </Typography>
              <LinearProgress
                variant="determinate"
                value={state.percent}
                aria-label={`Uploading ${state.fileName ?? 'image'}`}
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
            <>
              {value ? (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  noWrap
                  title={value}
                  sx={{ mb: 1 }}
                  data-testid={`${p}-address`}
                >
                  {shortAddress(value)}
                </Typography>
              ) : null}

              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {uploadAvailable ? (
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<CloudUploadOutlined />}
                    disabled={disabled}
                    onClick={() => inputRef.current?.click()}
                    data-testid={`${p}-upload-button`}
                  >
                    {value ? 'Replace image' : 'Upload image'}
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
                {uploadAvailable ? (
                  <Button
                    size="small"
                    startIcon={<LinkOutlined />}
                    disabled={disabled}
                    onClick={() => setShowUrl((shown) => !shown)}
                    data-testid={`${p}-url-toggle`}
                  >
                    Use a web address
                  </Button>
                ) : null}
                {value ? (
                  <Button
                    size="small"
                    color="error"
                    startIcon={<DeleteOutlined />}
                    disabled={disabled}
                    onClick={() => {
                      setLoadFailed(false);
                      onChange(null);
                    }}
                    data-testid={`${p}-remove`}
                  >
                    Remove
                  </Button>
                ) : null}
              </Box>
            </>
          )}
        </Box>
      </Box>

      {uploadAvailable ? (
        <input
          ref={inputRef}
          type="file"
          hidden
          accept={acceptAttribute('image')}
          onChange={handleFile}
          data-testid={`${p}-input`}
        />
      ) : disabled ? null : (
        <Box sx={{ mt: 1.5 }}>
          <UploadSetupNotice config={config} kind="image" testId={`${p}-setup`} />
        </Box>
      )}

      {urlVisible ? (
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', mt: 1.5 }}>
          <TextField
            size="small"
            fullWidth
            label="Web address of the image"
            placeholder="https://"
            value={urlDraft}
            onChange={(event) => setUrlDraft(event.target.value)}
            error={Boolean(urlError)}
            helperText={
              urlError ?? 'A full https:// address of a picture already on the web.'
            }
            slotProps={{ htmlInput: { 'data-testid': `${p}-url-input` } }}
          />
          <Button
            variant="outlined"
            onClick={applyUrl}
            disabled={disabled || urlDraft.trim().length === 0}
            sx={{ flexShrink: 0, whiteSpace: 'nowrap', height: 40 }}
            data-testid={`${p}-url-apply`}
          >
            Use address
          </Button>
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
          The image was uploaded and is ready to use. {state.libraryWarning}
        </Alert>
      ) : null}

      {loadFailed && value && !uploading ? (
        <Alert severity="warning" sx={{ mt: 1.5 }} data-testid={`${p}-load-failed`}>
          This address could not be shown as a picture. Check that it is correct, or
          choose a different image.
        </Alert>
      ) : null}

      {error ? (
        <Typography
          variant="body2"
          color="error"
          role="alert"
          sx={{ mt: 1 }}
          data-testid={`${p}-field-error`}
        >
          {error}
        </Typography>
      ) : null}

      {helperText ? (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          {helperText}
        </Typography>
      ) : null}

      <MediaPicker
        open={pickerOpen}
        kinds={['image']}
        title={`Choose an image for ${label.toLowerCase()}`}
        onClose={() => setPickerOpen(false)}
        onSelect={(asset) => {
          setPickerOpen(false);
          setLoadFailed(false);
          setShowUrl(false);
          onChange(asset.url);
        }}
        testIdPrefix={`${p}-picker`}
      />
    </Box>
  );
}
