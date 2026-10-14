import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import { useAuthStore } from '../../store/authStore';
import {
  assetFromLink,
  assetFromYouTube,
  createMediaAsset,
} from '../../services/firebase/mediaAssets';
import {
  MEDIA_CATEGORIES,
  MEDIA_CATEGORY_LABELS,
  type MediaCategory,
  type MediaKind,
} from '../../services/media/types';
import { YouTubePreview } from '../../components/media/YouTubePreview';
import { describeLibraryError } from '../../components/media/libraryErrors';
import { useToast } from '../../components/ui';
import { checkLink, validateAssetDetails } from './validation';

/**
 * Add a link to the library: a YouTube video (the right home for long
 * video), or an https address of an image, a song or a clip that already
 * lives somewhere else.
 *
 * Nothing is uploaded or copied. A YouTube address is tidied to the
 * standard form the phone plays and shown with its own thumbnail so the
 * right video is confirmed before it is saved.
 *
 * Mounted only while open, so every opening starts blank.
 */
export function AddLinkDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      aria-labelledby="add-link-title"
    >
      <DialogTitle id="add-link-title">Add a video or link</DialogTitle>
      <LinkBody onClose={onClose} />
    </Dialog>
  );
}

function LinkBody({ onClose }: { onClose: () => void }) {
  const { notify } = useToast();
  const user = useAuthStore((s) => s.user);
  const [kind, setKind] = useState<MediaKind>('video');
  const [address, setAddress] = useState('');
  const [title, setTitle] = useState('');
  const [altText, setAltText] = useState('');
  const [category, setCategory] = useState<MediaCategory>('video');
  const [problem, setProblem] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const live = address.trim() ? checkLink(kind, address) : null;

  async function handleSave() {
    const checked = checkLink(kind, address);
    if (!checked.ok) {
      setProblem(checked.message);
      return;
    }
    const details = validateAssetDetails({ title, altText }, false);
    if (details.title || details.altText) {
      setProblem(details.title ?? details.altText ?? null);
      return;
    }
    setProblem(null);
    setSaving(true);
    setSaveError(null);
    try {
      const detail = { title, altText, category };
      const record = checked.youtube
        ? assetFromYouTube(checked.youtube, detail)
        : assetFromLink(checked.address, kind, detail);
      await createMediaAsset(record, {
        uid: user?.uid ?? '',
        name: user?.displayName || user?.email || '',
      });
      notify({ message: 'Added to the media library.', severity: 'success' });
      onClose();
    } catch (error) {
      setSaveError(describeLibraryError(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <DialogContent dividers data-testid="add-link-dialog">
        <ToggleButtonGroup
          exclusive
          size="small"
          value={kind}
          onChange={(_event, next: MediaKind | null) => {
            if (!next) return;
            setKind(next);
            setCategory(
              next === 'video' ? 'video' : next === 'audio' ? 'song' : 'general'
            );
            setProblem(null);
          }}
          aria-label="What kind of link?"
          disabled={saving}
        >
          <ToggleButton value="video" data-testid="add-link-kind-video">
            Video
          </ToggleButton>
          <ToggleButton value="image" data-testid="add-link-kind-image">
            Image
          </ToggleButton>
          <ToggleButton value="audio" data-testid="add-link-kind-audio">
            Audio
          </ToggleButton>
        </ToggleButtonGroup>

        <TextField
          label={kind === 'video' ? 'Video address' : 'Web address'}
          placeholder={
            kind === 'video' ? 'https://www.youtube.com/watch?v=…' : 'https://'
          }
          fullWidth
          margin="normal"
          value={address}
          onChange={(event) => {
            setAddress(event.target.value);
            setProblem(null);
          }}
          error={Boolean(problem) || (live !== null && !live.ok)}
          helperText={
            problem ??
            (live && !live.ok
              ? live.message
              : kind === 'video'
                ? 'A YouTube address from the browser or the Share button, or any other https video link.'
                : 'A full https:// address.')
          }
          disabled={saving}
          slotProps={{ htmlInput: { 'data-testid': 'add-link-address-input' } }}
        />

        {live && live.ok && live.youtube ? (
          <Box sx={{ mb: 1 }}>
            <YouTubePreview
              key={live.youtube.videoId}
              videoId={live.youtube.videoId}
              title="Video preview"
              testIdPrefix="add-link-youtube"
              maxWidth={360}
            />
          </Box>
        ) : null}

        <TextField
          label="Name (optional)"
          fullWidth
          margin="normal"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          helperText={
            kind === 'video'
              ? 'For example, “Sunday sermon, 12 October”.'
              : 'Shown in the library and pickers.'
          }
          disabled={saving}
          slotProps={{ htmlInput: { 'data-testid': 'add-link-title-input' } }}
        />
        {kind === 'image' ? (
          <TextField
            label="Description (optional)"
            fullWidth
            margin="normal"
            value={altText}
            onChange={(event) => setAltText(event.target.value)}
            helperText="What the picture shows, for people who cannot see it."
            disabled={saving}
            slotProps={{ htmlInput: { 'data-testid': 'add-link-alt-input' } }}
          />
        ) : null}
        <TextField
          select
          label="Category"
          fullWidth
          margin="normal"
          value={category}
          onChange={(event) => setCategory(event.target.value as MediaCategory)}
          disabled={saving}
          slotProps={{ htmlInput: { 'data-testid': 'add-link-category-input' } }}
        >
          {MEDIA_CATEGORIES.map((id) => (
            <MenuItem key={id} value={id}>
              {MEDIA_CATEGORY_LABELS[id]}
            </MenuItem>
          ))}
        </TextField>

        {saveError ? (
          <Alert severity="error" sx={{ mt: 1 }} data-testid="add-link-error">
            {saveError}
          </Alert>
        ) : null}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving} data-testid="add-link-close">
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={() => void handleSave()}
          disabled={saving || address.trim().length === 0}
          data-testid="add-link-submit"
        >
          {saving ? 'Adding…' : 'Add to library'}
        </Button>
      </DialogActions>
    </>
  );
}
