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
  deleteSong,
  setSongPublished,
  subscribeToSongs,
} from '../../services/firebase/songs';
import { useAuthStore } from '../../store/authStore';
import { AdminEmptyState } from '../../components/AdminEmptyState';
import { AdminPageHeader } from '../../components/AdminPageHeader';
import { AdminTableCard } from '../../components/AdminTableCard';
import type { Song } from '../../types';

/** Matches firestore.rules'/storage.rules' isContentAdminOrAbove() -- Host can read all songs but not write any, per the RBAC table in FINAL_ARCHITECTURE_SPECIFICATION.md (songs has the same publish-concept shape as announcements). Gating these buttons is a UX convenience only; the rules are the real boundary. */
function canManageSongs(role: string | null): boolean {
  return role === 'content_admin' || role === 'super_admin';
}

/**
 * Admin songs list -- Day 6. Table of every song (admins can read all,
 * unlike members) with title/artist/category/publish status, and, for
 * Content Admin/Super Admin only, edit/delete/publish-toggle actions and
 * a "New Song" button. Host sees the same table read-only. Mirrors
 * AnnouncementsListPage.tsx's structure exactly, since songs has the
 * same publish-concept RBAC shape as announcements.
 */
export function SongsListPage() {
  const role = useAuthStore((s) => s.role);
  const canManage = canManageSongs(role);

  const [songs, setSongs] = useState<Song[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Song | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToSongs(
      (next) => {
        setSongs(next);
        setError(null);
      },
      () => {
        setError('Could not load songs. Please try again.');
      }
    );
    return unsubscribe;
  }, []);

  async function handleTogglePublished(song: Song) {
    setBusyId(song.id);
    try {
      await setSongPublished(song.id, song.title, !song.published);
    } finally {
      setBusyId(null);
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setBusyId(deleteTarget.id);
    try {
      await deleteSong(deleteTarget.id, deleteTarget.title);
    } finally {
      setBusyId(null);
      setDeleteTarget(null);
    }
  }

  return (
    <Box sx={{ p: 4 }} data-testid="songs-list-page">
      <AdminPageHeader
        title="Songs"
        action={
          canManage ? (
            <Button
              variant="contained"
              component={RouterLink}
              to="/songs/new"
              data-testid="new-song-button"
            >
              New Song
            </Button>
          ) : undefined
        }
      />

      {error ? (
        <Alert severity="error" data-testid="songs-error">
          {error}
        </Alert>
      ) : null}

      {!songs && !error ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <CircularProgress data-testid="songs-loading" />
        </Box>
      ) : null}

      {songs && songs.length === 0 ? (
        <AdminEmptyState message="No songs yet." testId="songs-empty" />
      ) : null}

      {songs && songs.length > 0 ? (
        <AdminTableCard>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Title</TableCell>
                  <TableCell>Artist</TableCell>
                  <TableCell>Category</TableCell>
                  <TableCell>Status</TableCell>
                  {canManage ? <TableCell align="right">Actions</TableCell> : null}
                </TableRow>
              </TableHead>
              <TableBody>
                {songs.map((song) => (
                  <TableRow key={song.id} data-testid={`song-row-${song.id}`}>
                    <TableCell>{song.title}</TableCell>
                    <TableCell>{song.artist}</TableCell>
                    <TableCell>{song.category}</TableCell>
                    <TableCell>
                      <Chip
                        label={song.published ? 'Published' : 'Draft'}
                        color={song.published ? 'success' : 'default'}
                        size="small"
                      />
                    </TableCell>
                    {canManage ? (
                      <TableCell align="right">
                        <Button
                          size="small"
                          onClick={() => void handleTogglePublished(song)}
                          disabled={busyId === song.id}
                          data-testid={`toggle-published-${song.id}`}
                        >
                          {song.published ? 'Unpublish' : 'Publish'}
                        </Button>
                        <IconButton
                          component={RouterLink}
                          to={`/songs/${song.id}/edit`}
                          aria-label="Edit"
                          data-testid={`edit-song-${song.id}`}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          aria-label="Delete"
                          onClick={() => setDeleteTarget(song)}
                          disabled={busyId === song.id}
                          data-testid={`delete-song-${song.id}`}
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
        <DialogTitle>Delete song?</DialogTitle>
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
