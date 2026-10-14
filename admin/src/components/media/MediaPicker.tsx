import { useEffect, useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Alert,
  Box,
  ButtonBase,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  InputAdornment,
  Link,
  MenuItem,
  TextField,
  Typography,
  Button,
} from '@mui/material';
import SearchOutlined from '@mui/icons-material/SearchOutlined';
import PhotoLibraryOutlined from '@mui/icons-material/PhotoLibraryOutlined';
import { adminColors, adminRadii } from '../../theme/tokens';
import {
  subscribeToMediaAssets,
  type MediaAsset,
} from '../../services/firebase/mediaAssets';
import {
  MEDIA_CATEGORIES,
  MEDIA_CATEGORY_LABELS,
  type MediaCategory,
  type MediaKind,
} from '../../services/media/types';
import { AdminEmptyState } from '../AdminEmptyState';
import { TableSkeleton } from '../ui/TableSkeleton';
import { MediaThumb } from './MediaThumb';
import { describeAsset, matchesSearch } from './assetDisplay';
import { describeLibraryError } from './libraryErrors';

/**
 * Choose a file that is already in the media library.
 *
 * Opened from an upload field's "Choose from library", so an administrator
 * attaching a cover or a song can reuse something instead of uploading it
 * again. It lists only the kinds the field accepts (a cover wants images),
 * narrowed by a search box and a category, and a click hands the whole
 * record back to the field.
 *
 * The list is LIVE (a Firestore subscription), so a file uploaded in
 * another tab appears without reopening. It subscribes only while open.
 */
export function MediaPicker({
  open,
  kinds,
  title,
  onClose,
  onSelect,
  testIdPrefix = 'media-picker',
}: {
  open: boolean;
  kinds: MediaKind[];
  title: string;
  onClose: () => void;
  onSelect: (asset: MediaAsset) => void;
  testIdPrefix?: string;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="md"
      aria-labelledby={`${testIdPrefix}-title`}
    >
      <DialogTitle id={`${testIdPrefix}-title`}>{title}</DialogTitle>
      {/* Mounted only while the dialog is open (MUI unmounts a closed
          dialog's children), so the subscription, the search text and the
          category all start fresh each time it opens -- no effect has to
          reset them. */}
      <PickerBody
        kinds={kinds}
        onClose={onClose}
        onSelect={onSelect}
        testIdPrefix={testIdPrefix}
      />
    </Dialog>
  );
}

function PickerBody({
  kinds,
  onClose,
  onSelect,
  testIdPrefix,
}: {
  kinds: MediaKind[];
  onClose: () => void;
  onSelect: (asset: MediaAsset) => void;
  testIdPrefix: string;
}) {
  const [assets, setAssets] = useState<MediaAsset[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<MediaCategory | 'all'>('all');

  useEffect(
    () =>
      subscribeToMediaAssets(
        (next) => setAssets(next),
        (failure) => {
          setError(describeLibraryError(failure));
          setAssets([]);
        }
      ),
    []
  );

  const ofKind = useMemo(
    () => (assets ?? []).filter((asset) => kinds.includes(asset.kind)),
    [assets, kinds]
  );
  const visible = useMemo(
    () =>
      ofKind.filter(
        (asset) =>
          (category === 'all' || asset.category === category) &&
          matchesSearch(asset, search)
      ),
    [ofKind, category, search]
  );

  return (
    <>
      <DialogContent dividers data-testid={testIdPrefix}>
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mb: 2 }}>
          <TextField
            size="small"
            label="Search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            sx={{ flex: '1 1 220px' }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchOutlined fontSize="small" aria-hidden />
                  </InputAdornment>
                ),
              },
              htmlInput: { 'data-testid': `${testIdPrefix}-search` },
            }}
          />
          <TextField
            select
            size="small"
            label="Category"
            value={category}
            onChange={(event) => setCategory(event.target.value as MediaCategory | 'all')}
            sx={{ flex: '0 1 200px' }}
            slotProps={{ htmlInput: { 'data-testid': `${testIdPrefix}-category` } }}
          >
            <MenuItem value="all">All categories</MenuItem>
            {MEDIA_CATEGORIES.map((id) => (
              <MenuItem key={id} value={id}>
                {MEDIA_CATEGORY_LABELS[id]}
              </MenuItem>
            ))}
          </TextField>
        </Box>

        {error ? (
          <Alert severity="warning" sx={{ mb: 2 }} data-testid={`${testIdPrefix}-error`}>
            {error}
          </Alert>
        ) : null}

        {assets === null ? (
          <TableSkeleton
            rows={3}
            testId={`${testIdPrefix}-loading`}
            label="Loading the media library"
          />
        ) : ofKind.length === 0 ? (
          <AdminEmptyState
            testId={`${testIdPrefix}-empty`}
            icon={<PhotoLibraryOutlined />}
            title="Nothing here yet"
            message="Nothing of this kind has been added to the media library. Upload a file from the field, or add one in the Media Library."
            action={
              <Link component={RouterLink} to="/media-library" onClick={onClose}>
                Open the Media Library
              </Link>
            }
          />
        ) : visible.length === 0 ? (
          <Typography color="text.secondary" data-testid={`${testIdPrefix}-no-match`}>
            No files match that search.
          </Typography>
        ) : (
          <Box
            role="list"
            sx={{
              display: 'grid',
              gap: 1.5,
              gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
            }}
          >
            {visible.map((asset) => (
              <Box role="listitem" key={asset.id}>
                <ButtonBase
                  onClick={() => onSelect(asset)}
                  data-testid={`${testIdPrefix}-item-${asset.id}`}
                  aria-label={`Use ${asset.title}`}
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'stretch',
                    textAlign: 'left',
                    width: '100%',
                    gap: 0.75,
                    p: 1,
                    border: `1px solid ${adminColors.border}`,
                    borderRadius: `${adminRadii.control}px`,
                    bgcolor: adminColors.surface,
                    '&:hover': { borderColor: adminColors.borderStrong },
                  }}
                >
                  <MediaThumb
                    kind={asset.kind}
                    url={asset.url}
                    thumbnailUrl={asset.thumbnailUrl}
                    label=""
                    size="100%"
                  />
                  <Typography variant="subtitle2" noWrap title={asset.title}>
                    {asset.title}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" noWrap>
                    {describeAsset(asset) || MEDIA_CATEGORY_LABELS[asset.category]}
                  </Typography>
                </ButtonBase>
              </Box>
            ))}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} data-testid={`${testIdPrefix}-close`}>
          Cancel
        </Button>
      </DialogActions>
    </>
  );
}
