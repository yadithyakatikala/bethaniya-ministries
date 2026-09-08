import { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
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
  deleteDailyVerse,
  subscribeToDailyVerses,
} from '../../services/firebase/dailyVerses';
import { useAuthStore } from '../../store/authStore';
import { AdminEmptyState } from '../../components/AdminEmptyState';
import { AdminPageHeader } from '../../components/AdminPageHeader';
import { AdminTableCard } from '../../components/AdminTableCard';
import type { DailyVerse } from '../../types';

/** Matches firestore.rules'/storage.rules' isContentAdminOrAbove(). Gating these buttons is a UX convenience only; the rules are the real boundary. */
function canManageDailyVerses(role: string | null): boolean {
  return role === 'content_admin' || role === 'super_admin';
}

/**
 * Admin daily verses list -- Day 5. Table of every daily verse (every
 * role reads all, per the RBAC table's unconditional daily_verses "Read"
 * -- there is no admin-only read branch or publish status column here,
 * unlike AnnouncementsListPage.tsx) with, for Content Admin/Super Admin
 * only, edit/delete actions and a "New Daily Verse" button.
 */
export function DailyVersesListPage() {
  const role = useAuthStore((s) => s.role);
  const canManage = canManageDailyVerses(role);

  const [verses, setVerses] = useState<DailyVerse[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DailyVerse | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToDailyVerses(
      (next) => {
        setVerses(next);
        setError(null);
      },
      () => {
        setError('Could not load daily verses. Please try again.');
      }
    );
    return unsubscribe;
  }, []);

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setBusyId(deleteTarget.id);
    try {
      await deleteDailyVerse(deleteTarget.id, deleteTarget.reference);
    } finally {
      setBusyId(null);
      setDeleteTarget(null);
    }
  }

  return (
    <Box sx={{ p: 4 }} data-testid="daily-verses-list-page">
      <AdminPageHeader
        title="Daily Verses"
        action={
          canManage ? (
            <Button
              variant="contained"
              component={RouterLink}
              to="/daily-verses/new"
              data-testid="new-daily-verse-button"
            >
              New Daily Verse
            </Button>
          ) : undefined
        }
      />

      {error ? (
        <Alert severity="error" data-testid="daily-verses-error">
          {error}
        </Alert>
      ) : null}

      {!verses && !error ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <CircularProgress data-testid="daily-verses-loading" />
        </Box>
      ) : null}

      {verses && verses.length === 0 ? (
        <AdminEmptyState message="No daily verses yet." testId="daily-verses-empty" />
      ) : null}

      {verses && verses.length > 0 ? (
        <AdminTableCard>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>Reference</TableCell>
                  {canManage ? <TableCell align="right">Actions</TableCell> : null}
                </TableRow>
              </TableHead>
              <TableBody>
                {verses.map((verse) => (
                  <TableRow key={verse.id} data-testid={`daily-verse-row-${verse.id}`}>
                    <TableCell>{verse.date}</TableCell>
                    <TableCell>{verse.reference}</TableCell>
                    {canManage ? (
                      <TableCell align="right">
                        <IconButton
                          component={RouterLink}
                          to={`/daily-verses/${verse.id}/edit`}
                          aria-label="Edit"
                          data-testid={`edit-daily-verse-${verse.id}`}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          aria-label="Delete"
                          onClick={() => setDeleteTarget(verse)}
                          disabled={busyId === verse.id}
                          data-testid={`delete-daily-verse-${verse.id}`}
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
        <DialogTitle>Delete daily verse?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {deleteTarget
              ? `"${deleteTarget.reference}" will be permanently deleted. This cannot be undone.`
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
