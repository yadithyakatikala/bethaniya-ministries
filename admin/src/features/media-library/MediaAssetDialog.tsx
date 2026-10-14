import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Link,
  MenuItem,
  TextField,
  Typography,
} from '@mui/material';
import ContentCopyOutlined from '@mui/icons-material/ContentCopyOutlined';
import OpenInNew from '@mui/icons-material/OpenInNew';
import { adminColors, adminRadii } from '../../theme/tokens';
import { updateMediaAsset, type MediaAsset } from '../../services/firebase/mediaAssets';
import {
  MEDIA_CATEGORIES,
  MEDIA_CATEGORY_LABELS,
  type MediaCategory,
} from '../../services/media/types';
import { YouTubePreview } from '../../components/media/YouTubePreview';
import { describeLibraryError } from '../../components/media/libraryErrors';
import { copyText } from '../../components/media/clipboard';
import { useToast } from '../../components/ui';
import { assetFacts } from './assetFacts';
import {
  ASSET_ALT_MAX_LENGTH,
  ASSET_TITLE_MAX_LENGTH,
  validateAssetDetails,
  type AssetDetailsErrors,
} from './validation';

/**
 * Look at one library record, and (for content admins) relabel it.
 *
 * Only the NAME, the DESCRIPTION and the CATEGORY can change. The file a
 * record points at never does -- the security rules refuse it too -- so
 * "this record" cannot start meaning a different file under content that
 * was filed against it. To use a different file, add a different record.
 *
 * Mounted fresh for each record (the page keys it by id), so its fields
 * always start from that record.
 */
export function MediaAssetDialog({
  asset,
  canEdit,
  onClose,
}: {
  asset: MediaAsset;
  canEdit: boolean;
  onClose: () => void;
}) {
  const { notify } = useToast();
  const [title, setTitle] = useState(asset.title);
  const [altText, setAltText] = useState(asset.altText);
  const [category, setCategory] = useState<MediaCategory>(asset.category);
  const [errors, setErrors] = useState<AssetDetailsErrors>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const dirty =
    title.trim() !== asset.title ||
    altText.trim() !== asset.altText ||
    category !== asset.category;

  async function handleSave() {
    const found = validateAssetDetails({ title, altText });
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setSaving(true);
    setSaveError(null);
    try {
      await updateMediaAsset(asset.id, { title, altText, category });
      notify({ message: `Saved "${title.trim()}".`, severity: 'success' });
      onClose();
    } catch (error) {
      setSaveError(describeLibraryError(error));
    } finally {
      setSaving(false);
    }
  }

  async function handleCopy() {
    const ok = await copyText(asset.url);
    notify(
      ok
        ? { message: 'Address copied.', severity: 'success', durationMs: 2500 }
        : {
            message: 'Could not copy. Select the address and copy it by hand.',
            severity: 'warning',
          }
    );
  }

  const facts = assetFacts(asset);

  return (
    <Dialog
      open
      onClose={saving ? undefined : onClose}
      fullWidth
      maxWidth="sm"
      aria-labelledby="media-asset-title"
    >
      <DialogTitle id="media-asset-title">
        {canEdit ? 'Media details' : asset.title}
      </DialogTitle>
      <DialogContent dividers data-testid="media-asset-dialog">
        <Box
          sx={{
            mb: 2,
            borderRadius: `${adminRadii.control}px`,
            bgcolor: adminColors.surfaceRaised,
            display: 'grid',
            placeItems: 'center',
            p: asset.kind === 'image' ? 0 : 2,
            overflow: 'hidden',
          }}
        >
          {asset.kind === 'image' ? (
            <Box
              component="img"
              src={asset.url}
              alt={asset.altText || asset.title}
              data-testid="media-asset-preview"
              sx={{
                maxWidth: '100%',
                maxHeight: 320,
                objectFit: 'contain',
                display: 'block',
              }}
            />
          ) : asset.kind === 'audio' ? (
            <Box
              component="audio"
              controls
              preload="metadata"
              src={asset.url}
              aria-label={`${asset.title} preview`}
              data-testid="media-asset-player"
              sx={{ width: '100%' }}
            />
          ) : asset.youtubeId ? (
            <YouTubePreview
              videoId={asset.youtubeId}
              title={`${asset.title} preview`}
              testIdPrefix="media-asset-youtube"
              maxWidth={420}
            />
          ) : (
            <Typography color="text.secondary">Video link: open it to watch.</Typography>
          )}
        </Box>

        {canEdit ? (
          <Box
            component="form"
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              void handleSave();
            }}
          >
            <TextField
              label="Name"
              fullWidth
              margin="normal"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              error={Boolean(errors.title)}
              helperText={
                errors.title ??
                `Shown in the library and pickers. Up to ${ASSET_TITLE_MAX_LENGTH} characters.`
              }
              slotProps={{ htmlInput: { 'data-testid': 'media-asset-title-input' } }}
            />
            {asset.kind === 'image' ? (
              <TextField
                label="Description (for people who cannot see the picture)"
                fullWidth
                multiline
                minRows={2}
                margin="normal"
                value={altText}
                onChange={(event) => setAltText(event.target.value)}
                error={Boolean(errors.altText)}
                helperText={
                  errors.altText ??
                  `A short sentence saying what the picture shows. Up to ${ASSET_ALT_MAX_LENGTH} characters.`
                }
                slotProps={{ htmlInput: { 'data-testid': 'media-asset-alt-input' } }}
              />
            ) : null}
            <TextField
              select
              label="Category"
              fullWidth
              margin="normal"
              value={category}
              onChange={(event) => setCategory(event.target.value as MediaCategory)}
              slotProps={{ htmlInput: { 'data-testid': 'media-asset-category-input' } }}
            >
              {MEDIA_CATEGORIES.map((id) => (
                <MenuItem key={id} value={id}>
                  {MEDIA_CATEGORY_LABELS[id]}
                </MenuItem>
              ))}
            </TextField>
          </Box>
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Category: {MEDIA_CATEGORY_LABELS[asset.category]}
            {asset.altText ? ` · ${asset.altText}` : ''}
          </Typography>
        )}

        {saveError ? (
          <Alert severity="error" sx={{ mt: 1 }} data-testid="media-asset-error">
            {saveError}
          </Alert>
        ) : null}

        <Box
          component="dl"
          sx={{
            m: 0,
            mt: 2,
            display: 'grid',
            gridTemplateColumns: 'max-content 1fr',
            columnGap: 2,
            rowGap: 0.75,
          }}
        >
          {facts.map((fact) => (
            <Box key={fact.label} sx={{ display: 'contents' }}>
              <Typography component="dt" variant="body2" color="text.secondary">
                {fact.label}
              </Typography>
              <Typography
                component="dd"
                variant="body2"
                sx={{ m: 0, overflowWrap: 'anywhere' }}
              >
                {fact.value}
              </Typography>
            </Box>
          ))}
        </Box>

        <Box sx={{ mt: 2 }}>
          <Typography
            variant="overline"
            color="text.secondary"
            component="p"
            sx={{ m: 0 }}
          >
            Address
          </Typography>
          <Typography
            variant="body2"
            sx={{ overflowWrap: 'anywhere' }}
            data-testid="media-asset-address"
          >
            {asset.url}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
            <Button
              size="small"
              startIcon={<ContentCopyOutlined />}
              onClick={() => void handleCopy()}
              data-testid="media-asset-copy"
            >
              Copy address
            </Button>
            <Button
              size="small"
              component={Link}
              href={asset.url}
              target="_blank"
              rel="noopener noreferrer"
              startIcon={<OpenInNew />}
              data-testid="media-asset-open"
            >
              Open
            </Button>
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving} data-testid="media-asset-close">
          {canEdit ? 'Cancel' : 'Close'}
        </Button>
        {canEdit ? (
          <Button
            variant="contained"
            onClick={() => void handleSave()}
            disabled={saving || !dirty}
            data-testid="media-asset-save"
          >
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
        ) : null}
      </DialogActions>
    </Dialog>
  );
}
