import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  ButtonBase,
  Chip,
  IconButton,
  InputAdornment,
  MenuItem,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import CloudUploadOutlined from '@mui/icons-material/CloudUploadOutlined';
import LinkOutlined from '@mui/icons-material/LinkOutlined';
import SearchOutlined from '@mui/icons-material/SearchOutlined';
import ContentCopyOutlined from '@mui/icons-material/ContentCopyOutlined';
import EditOutlined from '@mui/icons-material/EditOutlined';
import DeleteOutlined from '@mui/icons-material/DeleteOutlined';
import PhotoLibraryOutlined from '@mui/icons-material/PhotoLibraryOutlined';
import { adminColors, adminRadii } from '../../theme/tokens';
import { useAuthStore } from '../../store/authStore';
import {
  deleteMediaAsset,
  subscribeToMediaAssets,
  type MediaAsset,
} from '../../services/firebase/mediaAssets';
import {
  getCloudinaryConfig,
  isUploadAvailable,
} from '../../services/media/cloudinaryConfig';
import {
  MEDIA_CATEGORIES,
  MEDIA_CATEGORY_LABELS,
  MEDIA_KIND_LABELS,
} from '../../services/media/types';
import { AdminEmptyState } from '../../components/AdminEmptyState';
import { AdminPageHeader } from '../../components/AdminPageHeader';
import {
  ConfirmDialog,
  PageContainer,
  TableSkeleton,
  useToast,
} from '../../components/ui';
import { MediaThumb } from '../../components/media/MediaThumb';
import { UploadSetupNotice } from '../../components/media/UploadSetupNotice';
import { describeAsset } from '../../components/media/assetDisplay';
import { describeLibraryError } from '../../components/media/libraryErrors';
import { copyText } from '../../components/media/clipboard';
import { AddLinkDialog } from './AddLinkDialog';
import { MediaAssetDialog } from './MediaAssetDialog';
import { UploadMediaDialog } from './UploadMediaDialog';
import {
  INITIAL_FILTERS,
  KIND_TABS,
  PAGE_SIZE,
  countByKind,
  filterAssets,
  hasActiveFilters,
  type CategoryFilter,
  type KindFilter,
  type LibraryFilters,
} from './filters';

/** Matches firestore.rules' isContentAdminOrAbove() -- a UX convenience; the rules are the boundary. */
function canManageLibrary(role: string | null): boolean {
  return role === 'content_admin' || role === 'super_admin';
}

/**
 * The media library: every picture, song and video link an administrator
 * has uploaded or added, in one searchable place.
 *
 * This is where files come FROM. The upload fields inside the announcement,
 * song, plan and post forms put what they upload here, and their "Choose
 * from library" buttons pick from here, so a cover used once can be used
 * again without uploading it twice.
 *
 * What it does NOT do is manage the files on Cloudinary. Removing a
 * record here removes the record only -- the file stays online and
 * anything already using it keeps working -- because an unsigned upload
 * has no right to delete, and a file in use must not vanish because
 * somebody tidied a list. The delete confirmation says exactly that.
 *
 * Hosts can browse; only content admins and above add, rename and remove.
 */
export function MediaLibraryPage() {
  const role = useAuthStore((s) => s.role);
  const canManage = canManageLibrary(role);
  const { notify } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  // The upload dialog's open state lives in the address (`?upload=1`), so the
  // dashboard's "Upload media" shortcut can open it directly.
  const uploadOpen = canManage && searchParams.get('upload') === '1';

  const [assets, setAssets] = useState<MediaAsset[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<LibraryFilters>(INITIAL_FILTERS);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [linkOpen, setLinkOpen] = useState(false);
  const [selected, setSelected] = useState<MediaAsset | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MediaAsset | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(
    () =>
      subscribeToMediaAssets(
        (next) => {
          setAssets(next);
          setError(null);
        },
        (failure) => {
          setError(describeLibraryError(failure));
          setAssets([]);
        }
      ),
    []
  );

  const counts = useMemo(() => countByKind(assets ?? []), [assets]);
  const filtered = useMemo(() => filterAssets(assets ?? [], filters), [assets, filters]);
  const visible = filtered.slice(0, limit);

  function changeFilters(next: Partial<LibraryFilters>) {
    setFilters((current) => ({ ...current, ...next }));
    setLimit(PAGE_SIZE);
  }

  function setUploadOpen(open: boolean) {
    setSearchParams(open ? { upload: '1' } : {}, { replace: true });
  }

  async function handleCopy(asset: MediaAsset) {
    const ok = await copyText(asset.url);
    notify(
      ok
        ? { message: 'Address copied.', severity: 'success', durationMs: 2500 }
        : {
            message: 'Could not copy. Open the item and copy the address by hand.',
            severity: 'warning',
          }
    );
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteMediaAsset(deleteTarget.id, deleteTarget.title);
      notify({
        message: `Removed "${deleteTarget.title}" from the library.`,
        severity: 'success',
      });
      setDeleteTarget(null);
    } catch (failure) {
      notify({ message: describeLibraryError(failure), severity: 'error' });
    } finally {
      setDeleting(false);
    }
  }

  const config = getCloudinaryConfig();
  const imageReady = isUploadAvailable(config, 'image');
  const audioReady = isUploadAvailable(config, 'audio');

  return (
    <PageContainer testId="media-library-page" width="wide">
      <AdminPageHeader
        title="Media Library"
        eyebrow="Library"
        subtitle="Every picture, song and video you have uploaded or linked. Choose from here when you create an announcement, a song, a post or a reading plan."
        action={
          canManage ? (
            <>
              <Button
                variant="outlined"
                startIcon={<LinkOutlined />}
                onClick={() => setLinkOpen(true)}
                data-testid="media-library-add-link-button"
              >
                Add video or link
              </Button>
              <Button
                variant="contained"
                startIcon={<CloudUploadOutlined />}
                onClick={() => setUploadOpen(true)}
                data-testid="media-library-upload-button"
              >
                Upload file
              </Button>
            </>
          ) : undefined
        }
      />

      {canManage && (!imageReady || !audioReady) ? (
        <Box sx={{ mb: 3 }}>
          <UploadSetupNotice
            config={config}
            kind={imageReady ? 'audio' : 'image'}
            testId="media-library-setup"
          />
        </Box>
      ) : null}

      {error ? (
        <Alert severity="warning" sx={{ mb: 3 }} data-testid="media-library-error">
          {error}
        </Alert>
      ) : null}

      <Box
        sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center', mb: 2 }}
      >
        <TextField
          label="Search"
          size="small"
          value={filters.search}
          onChange={(event) => changeFilters({ search: event.target.value })}
          sx={{ flex: '1 1 260px', maxWidth: 420 }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchOutlined fontSize="small" aria-hidden />
                </InputAdornment>
              ),
            },
            htmlInput: { 'data-testid': 'media-library-search' },
          }}
        />
        <TextField
          select
          label="Category"
          size="small"
          value={filters.category}
          onChange={(event) =>
            changeFilters({ category: event.target.value as CategoryFilter })
          }
          sx={{ minWidth: 200 }}
          slotProps={{ htmlInput: { 'data-testid': 'media-library-category' } }}
        >
          <MenuItem value="all">All categories</MenuItem>
          {MEDIA_CATEGORIES.map((id) => (
            <MenuItem key={id} value={id}>
              {MEDIA_CATEGORY_LABELS[id]}
            </MenuItem>
          ))}
        </TextField>
      </Box>

      <Tabs
        value={filters.kind}
        onChange={(_event, kind: KindFilter) => changeFilters({ kind })}
        aria-label="Filter by type"
        variant="scrollable"
        scrollButtons="auto"
        sx={{ mb: 3 }}
      >
        {KIND_TABS.map((tab) => (
          <Tab
            key={tab.value}
            value={tab.value}
            label={`${tab.label} (${counts[tab.value]})`}
            data-testid={`media-library-tab-${tab.value}`}
          />
        ))}
      </Tabs>

      {assets === null ? (
        <TableSkeleton
          rows={4}
          testId="media-library-loading"
          label="Loading the media library"
        />
      ) : assets.length === 0 && !error ? (
        <AdminEmptyState
          testId="media-library-empty"
          icon={<PhotoLibraryOutlined />}
          title="Your library is empty"
          message={
            canManage
              ? 'Upload a picture or a song, or add a YouTube link. It will be here to reuse whenever you create an announcement, a song, a post or a reading plan.'
              : 'Nothing has been added to the library yet.'
          }
          action={
            canManage ? (
              <Button variant="contained" onClick={() => setUploadOpen(true)}>
                Upload your first file
              </Button>
            ) : undefined
          }
        />
      ) : filtered.length === 0 && assets.length > 0 ? (
        <AdminEmptyState
          testId="media-library-no-match"
          icon={<SearchOutlined />}
          message="Nothing in the library matches those filters."
          action={
            hasActiveFilters(filters) ? (
              <Button
                onClick={() => changeFilters(INITIAL_FILTERS)}
                data-testid="media-library-clear"
              >
                Clear filters
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <Box
            role="list"
            sx={{
              display: 'grid',
              gap: 2,
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            }}
          >
            {visible.map((asset) => (
              <Box
                role="listitem"
                key={asset.id}
                data-testid={`media-library-card-${asset.id}`}
                sx={{
                  border: `1px solid ${adminColors.border}`,
                  borderRadius: `${adminRadii.card}px`,
                  bgcolor: adminColors.surface,
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <ButtonBase
                  onClick={() => setSelected(asset)}
                  aria-label={`Open ${asset.title}`}
                  data-testid={`media-library-open-${asset.id}`}
                  sx={{ display: 'block', width: '100%' }}
                >
                  <MediaThumb
                    kind={asset.kind}
                    url={asset.url}
                    thumbnailUrl={asset.thumbnailUrl}
                    label=""
                    size="100%"
                  />
                </ButtonBase>
                <Box sx={{ p: 1.5, flex: 1, minWidth: 0 }}>
                  <Typography variant="subtitle2" noWrap title={asset.title}>
                    {asset.title}
                  </Typography>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    component="p"
                    noWrap
                  >
                    {describeAsset(asset) || MEDIA_KIND_LABELS[asset.kind]}
                  </Typography>
                  <Chip
                    size="small"
                    variant="outlined"
                    label={MEDIA_CATEGORY_LABELS[asset.category]}
                    sx={{ mt: 0.75 }}
                  />
                </Box>
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    px: 0.5,
                    pb: 0.5,
                    borderTop: `1px solid ${adminColors.border}`,
                  }}
                >
                  <Tooltip title="Copy address">
                    <IconButton
                      size="small"
                      aria-label={`Copy address of ${asset.title}`}
                      onClick={() => void handleCopy(asset)}
                      data-testid={`media-library-copy-${asset.id}`}
                    >
                      <ContentCopyOutlined fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  {canManage ? (
                    <>
                      <Tooltip title="Edit details">
                        <IconButton
                          size="small"
                          aria-label={`Edit ${asset.title}`}
                          onClick={() => setSelected(asset)}
                          data-testid={`media-library-edit-${asset.id}`}
                        >
                          <EditOutlined fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Remove from library">
                        <IconButton
                          size="small"
                          aria-label={`Remove ${asset.title} from the library`}
                          onClick={() => setDeleteTarget(asset)}
                          data-testid={`media-library-delete-${asset.id}`}
                        >
                          <DeleteOutlined fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </>
                  ) : null}
                </Box>
              </Box>
            ))}
          </Box>

          {filtered.length > visible.length ? (
            <Box sx={{ textAlign: 'center', mt: 3 }}>
              <Button
                variant="outlined"
                onClick={() => setLimit((current) => current + PAGE_SIZE)}
                data-testid="media-library-more"
              >
                Show more ({filtered.length - visible.length} left)
              </Button>
            </Box>
          ) : null}
        </>
      )}

      <UploadMediaDialog open={uploadOpen} onClose={() => setUploadOpen(false)} />
      <AddLinkDialog open={linkOpen && canManage} onClose={() => setLinkOpen(false)} />
      {selected ? (
        <MediaAssetDialog
          key={selected.id}
          asset={selected}
          canEdit={canManage}
          onClose={() => setSelected(null)}
        />
      ) : null}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Remove from the library?"
        confirmLabel="Remove"
        destructive
        busy={deleting}
        onConfirm={() => void handleConfirmDelete()}
        onCancel={() => setDeleteTarget(null)}
        confirmTestId="media-library-confirm-delete"
        cancelTestId="media-library-cancel-delete"
      >
        {deleteTarget ? (
          <>
            “{deleteTarget.title}” will be removed from this list.{' '}
            <strong>The file itself is not deleted</strong>, and anything that already
            uses it (a cover, a song, a post) keeps working. You can add it again later
            from its address.
          </>
        ) : null}
      </ConfirmDialog>
    </PageContainer>
  );
}
