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
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import {
  deleteCommunityPost,
  setCommunityPostPublished,
  subscribeToCommunityPosts,
} from '../../services/firebase/communityPosts';
import { useAuthStore } from '../../store/authStore';
import { AdminEmptyState } from '../../components/AdminEmptyState';
import { AdminPageHeader } from '../../components/AdminPageHeader';
import { AdminTableCard } from '../../components/AdminTableCard';
import type { CommunityPost } from '../../types';

/** Matches firestore.rules'/storage.rules' isContentAdminOrAbove() -- Host can read all posts but not write any. Gating these buttons is a UX convenience only; the rules are the real boundary. */
function canManageCommunityPosts(role: string | null): boolean {
  return role === 'content_admin' || role === 'super_admin';
}

/**
 * Admin community posts list -- a new V1 feature (see
 * ../../types/index.ts's CommunityPost doc comment for provenance).
 * Mirrors ../announcements/AnnouncementsListPage.tsx exactly.
 */
export function CommunityPostsListPage() {
  const role = useAuthStore((s) => s.role);
  const canManage = canManageCommunityPosts(role);

  const [posts, setPosts] = useState<CommunityPost[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CommunityPost | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToCommunityPosts(
      (next) => {
        setPosts(next);
        setError(null);
      },
      () => {
        setError('Could not load community posts. Please try again.');
      }
    );
    return unsubscribe;
  }, []);

  async function handleTogglePublished(post: CommunityPost) {
    setBusyId(post.id);
    try {
      await setCommunityPostPublished(post.id, post.title, !post.published);
    } finally {
      setBusyId(null);
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setBusyId(deleteTarget.id);
    try {
      await deleteCommunityPost(deleteTarget.id, deleteTarget.title);
    } finally {
      setBusyId(null);
      setDeleteTarget(null);
    }
  }

  return (
    <Box sx={{ p: 4 }} data-testid="community-list-page">
      <AdminPageHeader
        title="Community"
        action={
          canManage ? (
            <Button
              variant="contained"
              component={RouterLink}
              to="/community/new"
              data-testid="new-community-post-button"
            >
              New Post
            </Button>
          ) : undefined
        }
      />

      {error ? (
        <Alert severity="error" data-testid="community-error">
          {error}
        </Alert>
      ) : null}

      {!posts && !error ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <CircularProgress data-testid="community-loading" />
        </Box>
      ) : null}

      {posts && posts.length === 0 ? (
        <AdminEmptyState message="No community posts yet." testId="community-empty" />
      ) : null}

      {posts && posts.length > 0 ? (
        <AdminTableCard>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Title</TableCell>
                  <TableCell>Status</TableCell>
                  {canManage ? <TableCell align="right">Actions</TableCell> : null}
                </TableRow>
              </TableHead>
              <TableBody>
                {posts.map((post) => (
                  <TableRow key={post.id} data-testid={`community-row-${post.id}`}>
                    <TableCell>{post.title}</TableCell>
                    <TableCell>
                      <Chip
                        label={post.published ? 'Published' : 'Draft'}
                        color={post.published ? 'success' : 'default'}
                        size="small"
                      />
                    </TableCell>
                    {canManage ? (
                      <TableCell align="right">
                        <Button
                          size="small"
                          onClick={() => void handleTogglePublished(post)}
                          disabled={busyId === post.id}
                          data-testid={`toggle-published-${post.id}`}
                        >
                          {post.published ? 'Unpublish' : 'Publish'}
                        </Button>
                        <IconButton
                          component={RouterLink}
                          to={`/community/${post.id}/edit`}
                          aria-label="Edit"
                          data-testid={`edit-community-post-${post.id}`}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          aria-label="Delete"
                          onClick={() => setDeleteTarget(post)}
                          disabled={busyId === post.id}
                          data-testid={`delete-community-post-${post.id}`}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </AdminTableCard>
      ) : null}

      <Dialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)}>
        <DialogTitle>Delete community post?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {deleteTarget
              ? `"${deleteTarget.title}" will be permanently deleted. This cannot be undone.`
              : null}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button
            color="error"
            onClick={() => void handleConfirmDelete()}
            data-testid="confirm-delete-button"
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
