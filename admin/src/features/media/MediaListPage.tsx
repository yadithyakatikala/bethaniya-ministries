import { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import {
  deleteMediaPost,
  setMediaPublished,
  subscribeToMedia,
  type MediaRecord,
} from '../../services/firebase/media';
import { useAuthStore } from '../../store/authStore';
import { AdminEmptyState } from '../../components/AdminEmptyState';
import { AdminPageHeader } from '../../components/AdminPageHeader';
import { AdminTableCard } from '../../components/AdminTableCard';
import { useNow } from '../prophet-verses/useNow';
import { mediaUrlProblem } from './validation';
import { MEDIA_STATE_LABELS, labelFor, stateOf } from './state';

/**
 * The media feed, as an administrator manages it.
 *
 * =====================================================================
 * THE STATE COLUMN IS THE POINT OF THIS PAGE
 * =====================================================================
 * A post is a DRAFT, SCHEDULED or PUBLISHED, and the first two are both
 * invisible to the congregation -- which is exactly why the difference
 * has to be spelled out here rather than left to a colour. Each state is
 * a labelled chip.
 *
 * =====================================================================
 * IT FLAGS A LINK THAT WILL NOT WORK
 * =====================================================================
 * Nothing is uploaded -- a post is an external address (see
 * ../../services/firebase/media.ts) -- so a link that has rotted, or was
 * pasted as http, is a post that shows a broken image to the whole
 * congregation and looks fine in this table. The row says so, and it
 * says so on published posts too, because that is when it matters most.
 *
 * RBAC: every dashboard role can view; a content admin or above can
 * write, publish and delete, matching firestore.rules' media rule. The
 * gate here is a convenience; the rules are the boundary.
 */
function canManageMedia(role: string | null): boolean {
  return role === 'content_admin' || role === 'super_admin';
}

function formatWhen(date: Date | null): string {
  if (!date) return '—';
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function MediaListPage() {
  const role = useAuthStore((s) => s.role);
  const canManage = canManageMedia(role);

  const [posts, setPosts] = useState<MediaRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MediaRecord | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToMedia(
      (next) => {
        setPosts(next);
        setError(null);
      },
      () => setError('Could not load media. Please try again.')
    );
    return unsubscribe;
  }, []);

  // Read through a hook, not `new Date()` in the render: a scheduled post
  // becomes due on its own, with no re-render to notice it. See
  // ../prophet-verses/useNow.ts.
  const now = useNow();

  async function handleTogglePublished(post: MediaRecord) {
    setBusyId(post.id);
    setActionError(null);
    try {
      await setMediaPublished(post.id, post.caption, !post.published);
    } catch {
      setActionError('Could not change that. Please try again.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setBusyId(deleteTarget.id);
    try {
      await deleteMediaPost(deleteTarget.id, deleteTarget.caption);
    } catch {
      setActionError('Could not delete that. Please try again.');
    } finally {
      setBusyId(null);
      setDeleteTarget(null);
    }
  }

  return (
    <Box sx={{ p: 4 }} data-testid="media-list-page">
      <AdminPageHeader
        title="Media"
        action={
          canManage ? (
            <Button
              variant="contained"
              component={RouterLink}
              to="/media/new"
              data-testid="new-media-button"
            >
              New media post
            </Button>
          ) : undefined
        }
      />

      {error ? (
        <Alert severity="error" data-testid="media-error">
          {error}
        </Alert>
      ) : null}
      {actionError ? (
        <Alert severity="error" sx={{ mb: 2 }} data-testid="media-action-error">
          {actionError}
        </Alert>
      ) : null}

      {!posts && !error ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <CircularProgress data-testid="media-loading" />
        </Box>
      ) : null}

      {posts && posts.length === 0 ? (
        <AdminEmptyState
          message="No media yet. Until there is some, the app simply does not show that section."
          testId="media-empty"
        />
      ) : null}

      {posts && posts.length > 0 ? (
        <AdminTableCard>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Caption</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Show from</TableCell>
                  <TableCell>Status</TableCell>
                  {canManage ? <TableCell align="right">Actions</TableCell> : null}
                </TableRow>
              </TableHead>
              <TableBody>
                {posts.map((post) => {
                  const state = stateOf(post, now);
                  const urlProblem = mediaUrlProblem(post.mediaUrl);
                  return (
                    <TableRow key={post.id} data-testid={`media-row-${post.id}`}>
                      <TableCell>{labelFor(post)}</TableCell>
                      <TableCell>
                        {post.type === 'video' ? 'Video' : 'Image'}
                        {urlProblem ? (
                          <Tooltip title="This address is not one the app will load, so members see nothing. Edit the post and paste an https:// link to an image or video.">
                            <Chip
                              size="small"
                              color="warning"
                              label="Link problem"
                              sx={{ ml: 1 }}
                              data-testid={`media-url-problem-${post.id}`}
                            />
                          </Tooltip>
                        ) : null}
                      </TableCell>
                      <TableCell>{formatWhen(post.publishAt)}</TableCell>
                      <TableCell>
                        {/* Named, not coloured: "scheduled" and "draft" look
                            identical to a member, so the words carry it. */}
                        <Chip
                          size="small"
                          variant={state === 'published' ? 'filled' : 'outlined'}
                          color={state === 'published' ? 'success' : 'default'}
                          label={MEDIA_STATE_LABELS[state]}
                          data-testid={`media-state-${post.id}`}
                        />
                      </TableCell>
                      {canManage ? (
                        <TableCell align="right">
                          <Button
                            size="small"
                            onClick={() => void handleTogglePublished(post)}
                            disabled={busyId === post.id}
                            data-testid={`media-toggle-${post.id}`}
                          >
                            {post.published ? 'Unpublish' : 'Publish'}
                          </Button>
                          <IconButton
                            component={RouterLink}
                            to={`/media/${post.id}/edit`}
                            aria-label={`Edit ${labelFor(post)}`}
                            data-testid={`edit-media-${post.id}`}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                          <IconButton
                            aria-label={`Delete ${labelFor(post)}`}
                            onClick={() => setDeleteTarget(post)}
                            disabled={busyId === post.id}
                            data-testid={`delete-media-${post.id}`}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      ) : null}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </AdminTableCard>
      ) : null}

      <Dialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)}>
        <DialogTitle>Delete this media post?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {deleteTarget
              ? `"${labelFor(deleteTarget)}" will be permanently deleted. This cannot be undone. Comments on it are deleted with it.`
              : null}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button
            color="error"
            onClick={() => void handleConfirmDelete()}
            data-testid="media-confirm-delete"
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
