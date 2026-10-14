import { useRef, useState, type ChangeEvent } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  MenuItem,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import CloudUploadOutlined from '@mui/icons-material/CloudUploadOutlined';
import {
  getCloudinaryConfig,
  isUploadAvailable,
} from '../../services/media/cloudinaryConfig';
import {
  MEDIA_CATEGORIES,
  MEDIA_CATEGORY_LABELS,
  type MediaCategory,
} from '../../services/media/types';
import {
  acceptAttribute,
  formatBytes,
  validateUploadFile,
} from '../../services/media/uploadRules';
import { UploadSetupNotice } from '../../components/media/UploadSetupNotice';
import { useMediaUpload } from '../../components/media/useMediaUpload';
import { copyText } from '../../components/media/clipboard';
import { useToast } from '../../components/ui';
import { validateAssetDetails } from './validation';

/**
 * Add a file to the library from the library page.
 *
 * Fill in the name and category first (both optional -- the file's name
 * is used if the name is left empty), choose the file, then Upload. The
 * file is checked in the browser before anything is sent.
 *
 * Unlike the upload FIELDS in forms -- where a library record is a side
 * effect and may quietly fail -- adding to the library is this dialog's
 * whole purpose, so if the file uploads but the record cannot be written
 * (usually: the new security rules have not been deployed yet) it says so
 * and shows the address, rather than closing as if all were well.
 *
 * Mounted only while open, so every opening starts blank.
 */
export function UploadMediaDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      aria-labelledby="upload-media-title"
    >
      <DialogTitle id="upload-media-title">Upload a file</DialogTitle>
      <UploadBody onClose={onClose} />
    </Dialog>
  );
}

function UploadBody({ onClose }: { onClose: () => void }) {
  const config = getCloudinaryConfig();
  const imageOk = isUploadAvailable(config, 'image');
  const audioOk = isUploadAvailable(config, 'audio');
  const { notify } = useToast();

  const [kind, setKind] = useState<'image' | 'audio'>(
    imageOk || !audioOk ? 'image' : 'audio'
  );
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [altText, setAltText] = useState('');
  const [category, setCategory] = useState<MediaCategory>('general');
  const [detailErrors, setDetailErrors] = useState<
    ReturnType<typeof validateAssetDetails>
  >({});
  const [unrecorded, setUnrecorded] = useState<{ url: string; message: string } | null>(
    null
  );
  const inputRef = useRef<HTMLInputElement>(null);

  const { state, start, cancel, retry, dismiss } = useMediaUpload({
    kind,
    category,
    details: { title, altText },
    onUploaded: (result) => {
      if (result.libraryError) {
        setUnrecorded({ url: result.url, message: result.libraryError });
        return;
      }
      notify({ message: 'Added to the media library.', severity: 'success' });
      onClose();
    },
  });

  const available = kind === 'image' ? imageOk : audioOk;
  const uploading = state.phase === 'uploading';

  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const chosen = event.target.files?.[0] ?? null;
    event.target.value = '';
    dismiss();
    if (!chosen) {
      setFile(null);
      setFileError(null);
      return;
    }
    const problem = validateUploadFile(chosen, kind);
    setFileError(problem);
    setFile(problem ? null : chosen);
  }

  function handleUpload() {
    const found = validateAssetDetails({ title, altText }, false);
    setDetailErrors(found);
    if (Object.keys(found).length > 0 || !file) return;
    start(file);
  }

  if (unrecorded) {
    return (
      <>
        <DialogContent data-testid="upload-media-unrecorded">
          <Alert severity="warning">
            The file was uploaded to Cloudinary, but it could not be added to the library.{' '}
            {unrecorded.message}
          </Alert>
          <Typography variant="body2" sx={{ mt: 2 }}>
            Its address, so nothing is lost:
          </Typography>
          <Typography variant="body2" sx={{ overflowWrap: 'anywhere', fontWeight: 600 }}>
            {unrecorded.url}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => void copyText(unrecorded.url)}>Copy address</Button>
          <Button variant="contained" onClick={onClose} data-testid="upload-media-done">
            Close
          </Button>
        </DialogActions>
      </>
    );
  }

  return (
    <>
      <DialogContent dividers data-testid="upload-media-dialog">
        <ToggleButtonGroup
          exclusive
          size="small"
          value={kind}
          onChange={(_event, next: 'image' | 'audio' | null) => {
            if (!next) return;
            setKind(next);
            setFile(null);
            setFileError(null);
            dismiss();
          }}
          aria-label="What are you uploading?"
          disabled={uploading}
        >
          <ToggleButton value="image" data-testid="upload-media-kind-image">
            Image
          </ToggleButton>
          <ToggleButton value="audio" data-testid="upload-media-kind-audio">
            Audio
          </ToggleButton>
        </ToggleButtonGroup>

        {!available ? (
          <Box sx={{ mt: 2 }}>
            <UploadSetupNotice config={config} kind={kind} testId="upload-media-setup" />
          </Box>
        ) : (
          <>
            <TextField
              label="Name (optional)"
              fullWidth
              margin="normal"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              error={Boolean(detailErrors.title)}
              helperText={detailErrors.title ?? 'Leave empty to use the file name.'}
              disabled={uploading}
              slotProps={{ htmlInput: { 'data-testid': 'upload-media-title-input' } }}
            />
            {kind === 'image' ? (
              <TextField
                label="Description (optional)"
                fullWidth
                margin="normal"
                value={altText}
                onChange={(event) => setAltText(event.target.value)}
                error={Boolean(detailErrors.altText)}
                helperText={
                  detailErrors.altText ??
                  'What the picture shows, for people who cannot see it.'
                }
                disabled={uploading}
                slotProps={{ htmlInput: { 'data-testid': 'upload-media-alt-input' } }}
              />
            ) : null}
            <TextField
              select
              label="Category"
              fullWidth
              margin="normal"
              value={category}
              onChange={(event) => setCategory(event.target.value as MediaCategory)}
              disabled={uploading}
              slotProps={{ htmlInput: { 'data-testid': 'upload-media-category-input' } }}
            >
              {MEDIA_CATEGORIES.map((id) => (
                <MenuItem key={id} value={id}>
                  {MEDIA_CATEGORY_LABELS[id]}
                </MenuItem>
              ))}
            </TextField>

            <Box sx={{ mt: 2 }}>
              <Button
                variant="outlined"
                startIcon={<CloudUploadOutlined />}
                onClick={() => inputRef.current?.click()}
                disabled={uploading}
                data-testid="upload-media-choose"
              >
                {file
                  ? 'Choose a different file'
                  : `Choose ${kind === 'image' ? 'an image' : 'an audio file'}`}
              </Button>
              <input
                ref={inputRef}
                type="file"
                hidden
                accept={acceptAttribute(kind)}
                onChange={chooseFile}
                data-testid="upload-media-input"
              />
              {file ? (
                <Typography
                  variant="body2"
                  sx={{ mt: 1 }}
                  data-testid="upload-media-file"
                >
                  {file.name} · {formatBytes(file.size)}
                </Typography>
              ) : null}
            </Box>

            {fileError ? (
              <Alert
                severity="error"
                sx={{ mt: 1.5 }}
                data-testid="upload-media-file-error"
              >
                {fileError}
              </Alert>
            ) : null}

            {uploading ? (
              <Box
                sx={{ mt: 2 }}
                role="status"
                aria-live="polite"
                data-testid="upload-media-progress"
              >
                <Typography variant="body2" sx={{ mb: 0.75 }}>
                  Uploading {state.fileName}… {state.percent}%
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={state.percent}
                  aria-label="Upload progress"
                />
                <Button
                  size="small"
                  sx={{ mt: 1 }}
                  onClick={cancel}
                  data-testid="upload-media-cancel"
                >
                  Cancel upload
                </Button>
              </Box>
            ) : null}

            {state.error ? (
              <Alert
                severity="error"
                sx={{ mt: 1.5 }}
                data-testid="upload-media-error"
                action={
                  <Button
                    color="inherit"
                    size="small"
                    onClick={retry}
                    data-testid="upload-media-retry"
                  >
                    Try again
                  </Button>
                }
              >
                {state.error}
              </Alert>
            ) : null}
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={uploading} data-testid="upload-media-close">
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleUpload}
          disabled={!available || !file || uploading}
          data-testid="upload-media-submit"
        >
          Upload
        </Button>
      </DialogActions>
    </>
  );
}
