import { useState } from 'react';
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
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import { deleteDailyVerse } from '../../../services/firebase/dailyVerses';
import { useAuthStore } from '../../../store/authStore';
import { AdminEmptyState } from '../../../components/AdminEmptyState';
import { AdminTableCard } from '../../../components/AdminTableCard';
import type { DailyVerse } from '../../../types';

/**
 * DAYS SET BY HAND -- the intentional manual override.
 *
 * This was the Daily Verses page until the Verse of the Day was
 * consolidated. It is not a page any more, and that is the point: a
 * church administrator was being shown "Daily Verses" and "Verse
 * Automation" as two separate destinations in the sidebar, with no way
 * to tell from either which one the congregation was actually reading.
 * They were always one feature. Now they are one screen, and this is the
 * part of it that holds the exceptions.
 *
 * NOTHING ABOUT THE DATA CHANGED. These are the same daily_verses
 * documents, written by the same form, honoured by the app in the same
 * way: a verse set for a date beats the rotation on that date, and only
 * on that date. What changed is that the sentence above is now said
 * where an administrator can read it.
 *
 * A verse here carries the administrator's OWN TEXT -- it predates the
 * bundled Bible and may be a paraphrase, another translation, or a
 * range -- which is why the app renders it verbatim rather than looking
 * it up. See mobile/src/features/daily-verses/votdResolver.ts.
 *
 * RBAC: every dashboard role can read (the app's own rules make
 * daily_verses world-readable); a content admin or above can write.
 * The gate here is a convenience; firestore.rules is the boundary.
 */
function canManageDailyVerses(role: string | null): boolean {
  return role === 'content_admin' || role === 'super_admin';
}

export function OverridesPanel({
  verses,
  error,
}: {
  /** null while the first snapshot is still in flight. */
  verses: DailyVerse[] | null;
  error: string | null;
}) {
  const role = useAuthStore((s) => s.role);
  const canManage = canManageDailyVerses(role);

  const [deleteTarget, setDeleteTarget] = useState<DailyVerse | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

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
    <Paper
      variant="outlined"
      sx={{ borderRadius: 3, p: 3 }}
      data-testid="daily-verses-list-page"
    >
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        sx={{ justifyContent: 'space-between', alignItems: { sm: 'center' }, gap: 1.5, mb: 2 }}
      >
        <Box>
          <Typography variant="h6" component="h2" sx={{ mb: 0.5 }}>
            Days you set by hand
          </Typography>
          <Typography color="text.secondary" sx={{ fontSize: 14 }}>
            For a Sunday with a particular verse, or a verse in your own words. A day set
            here is what the church sees on that day, whatever the rotation would have
            chosen. Every other day looks after itself.
          </Typography>
        </Box>
        {canManage ? (
          <Button
            variant="contained"
            component={RouterLink}
            to="/daily-verses/new"
            sx={{ flexShrink: 0 }}
            data-testid="new-daily-verse-button"
          >
            Set a day by hand
          </Button>
        ) : null}
      </Stack>

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
        <AdminEmptyState
          message="No days set by hand. The app is choosing every day on its own, which is how it is meant to work."
          testId="daily-verses-empty"
        />
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
    </Paper>
  );
}
