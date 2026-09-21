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
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import {
  deleteProphetVerse,
  setProphetVersePublished,
  subscribeToProphetVerses,
  type ProphetVerseRecord,
} from '../../services/firebase/prophetVerses';
import { useAuthStore } from '../../store/authStore';
import { AdminEmptyState } from '../../components/AdminEmptyState';
import { AdminPageHeader } from '../../components/AdminPageHeader';
import { AdminTableCard } from '../../components/AdminTableCard';
import { currentProphetVerseId, stateOf } from './state';
import { useNow } from './useNow';

/**
 * =====================================================================
 * PROPHET VERSE OF THE DAY -- ONE PAGE, AND ALWAYS HAS BEEN
 * =====================================================================
 * A content system of its own, listed and managed separately from the
 * Verse of the Day. The two are never mixed: a prophet verse is not a
 * candidate for the Verse of the Day, and the Verse of the Day is not a
 * prophet verse. What they share is a name and a place on the home
 * screen, which is exactly why the labels have to be explicit.
 *
 * THERE IS NO "PROPHET VERSE AUTOMATION" PAGE, and there never was --
 * the Verse of the Day had one and this did not. There is nothing for
 * such a page to configure: a prophet verse is a piece of writing
 * somebody publishes, with a date and time it should appear, not a
 * rotation over a pool. The two features are asymmetric on purpose.
 *
 * What this page was missing was not a second page. It was a straight
 * answer at the top: WHICH ONE IS THE CONGREGATION READING RIGHT NOW.
 * That fact lived in a chip inside a table row -- easy to miss, and
 * absent altogether when there are no records -- so it is now stated
 * before the table, in the words a pastor would use.
 *
 * ---------------------------------------------------------------------
 * THREE STATES, AND WHY EACH IS NAMED
 * ---------------------------------------------------------------------
 * A record is either a DRAFT (not published), SCHEDULED (published, but
 * its moment has not arrived) or SHOWING (published and due). Only the
 * third is visible to the congregation, and the difference between the
 * first two is invisible in the app -- which is exactly why the table
 * spells it out here. Each state is a labelled chip, never a colour
 * alone.
 *
 * Only ONE record shows at a time: the most recently scheduled one that
 * qualifies. The table marks it, because "why is last week's verse still
 * up" is otherwise a puzzle. The rule is documented in
 * mobile/src/services/firebase/prophetVerses.ts.
 *
 * RBAC: every dashboard role can view; a content admin or above can
 * write, publish and delete, matching firestore.rules' prophet_verses
 * rule. The gate is a convenience; the rules are the boundary.
 */
function canManageProphetVerses(role: string | null): boolean {
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

export function ProphetVersesListPage() {
  const role = useAuthStore((s) => s.role);
  const canManage = canManageProphetVerses(role);

  const [verses, setVerses] = useState<ProphetVerseRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProphetVerseRecord | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToProphetVerses(
      (next) => {
        setVerses(next);
        setError(null);
      },
      () => setError('Could not load prophet verses. Please try again.')
    );
    return unsubscribe;
  }, []);

  // Read through a hook, not `new Date()` in the render: a scheduled
  // verse becomes due on its own, with no re-render to notice it. See
  // ./useNow.ts.
  const now = useNow();
  const currentId = verses ? currentProphetVerseId(verses, now) : null;
  const current = verses?.find((verse) => verse.id === currentId) ?? null;
  const scheduledCount =
    verses?.filter((verse) => stateOf(verse, now) === 'scheduled').length ?? 0;

  async function handleTogglePublished(verse: ProphetVerseRecord) {
    setBusyId(verse.id);
    setActionError(null);
    try {
      await setProphetVersePublished(verse.id, verse.title, !verse.published);
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
      await deleteProphetVerse(deleteTarget.id, deleteTarget.title);
    } catch {
      setActionError('Could not delete that. Please try again.');
    } finally {
      setBusyId(null);
      setDeleteTarget(null);
    }
  }

  return (
    <Box sx={{ p: 4 }} data-testid="prophet-verses-list-page">
      <AdminPageHeader
        title="Prophet Verse of the Day"
        action={
          canManage ? (
            <Button
              variant="contained"
              component={RouterLink}
              to="/prophet-verses/new"
              data-testid="new-prophet-verse-button"
            >
              New Prophet Verse
            </Button>
          ) : undefined
        }
      />

      <Typography color="text.secondary" sx={{ fontSize: 14, mt: -2, mb: 3 }}>
        {/* Said once, plainly, because the two features sit next to each
            other on the home screen and share most of their name. */}
        A word your church writes and publishes. This is not the Verse of the Day &mdash;
        that one the app chooses by itself from scripture, and it is managed on its own
        page. Nothing here happens automatically: a prophet verse appears when you
        publish it, and stays until another one is due.
      </Typography>

      {/* THE ANSWER FIRST. Only one shows at a time, and which one is
          not obvious from a list of dates. */}
      <Paper
        variant="outlined"
        sx={{ borderRadius: 3, p: 3, mb: 3 }}
        data-testid="prophet-verse-now-panel"
      >
        <Typography variant="h6" component="h2" sx={{ mb: 0.5 }}>
          On the home screen now
        </Typography>
        {!verses ? (
          <Typography color="text.secondary" sx={{ fontSize: 14 }}>
            Checking&hellip;
          </Typography>
        ) : current ? (
          <Stack spacing={0.5}>
            <Typography sx={{ fontSize: 20 }} data-testid="prophet-verse-now-title">
              {current.title}
            </Typography>
            <Typography color="text.secondary" sx={{ fontSize: 14 }}>
              {current.reference} &middot; showing since {formatWhen(current.publishAt)}
            </Typography>
          </Stack>
        ) : (
          <Typography color="text.secondary" sx={{ fontSize: 14 }} data-testid="prophet-verse-now-none">
            Nothing. The app simply leaves this section out until something is published
            and due &mdash; members are not shown an empty box.
          </Typography>
        )}
        {scheduledCount > 0 ? (
          <Typography color="text.secondary" sx={{ fontSize: 13, mt: 1.5 }}>
            {scheduledCount === 1
              ? '1 more is scheduled and will take over when its time comes.'
              : `${scheduledCount} more are scheduled; the latest one due takes over.`}
          </Typography>
        ) : null}
      </Paper>

      {error ? (
        <Alert severity="error" data-testid="prophet-verses-error">
          {error}
        </Alert>
      ) : null}
      {actionError ? (
        <Alert severity="error" sx={{ mb: 2 }} data-testid="prophet-verses-action-error">
          {actionError}
        </Alert>
      ) : null}

      {!verses && !error ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <CircularProgress data-testid="prophet-verses-loading" />
        </Box>
      ) : null}

      {verses && verses.length === 0 ? (
        <AdminEmptyState
          message="No prophet verses yet. Until there is one, the app simply does not show that section."
          testId="prophet-verses-empty"
        />
      ) : null}

      {verses && verses.length > 0 ? (
        <AdminTableCard>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Title</TableCell>
                  <TableCell>Reference</TableCell>
                  <TableCell>Show from</TableCell>
                  <TableCell>Status</TableCell>
                  {canManage ? <TableCell align="right">Actions</TableCell> : null}
                </TableRow>
              </TableHead>
              <TableBody>
                {verses.map((verse) => {
                  const state = stateOf(verse, now);
                  return (
                    <TableRow
                      key={verse.id}
                      data-testid={`prophet-verse-row-${verse.id}`}
                    >
                      <TableCell>{verse.title}</TableCell>
                      <TableCell>{verse.reference}</TableCell>
                      <TableCell>{formatWhen(verse.publishAt)}</TableCell>
                      <TableCell>
                        {/* Named, not coloured: "scheduled" and "draft" look
                            identical to a member, so the words have to carry it. */}
                        <Chip
                          size="small"
                          variant={state === 'showing' ? 'filled' : 'outlined'}
                          color={state === 'showing' ? 'success' : 'default'}
                          label={
                            state === 'draft'
                              ? 'Draft'
                              : state === 'scheduled'
                                ? 'Scheduled'
                                : 'Published'
                          }
                          data-testid={`prophet-verse-state-${verse.id}`}
                        />
                        {verse.id === currentId ? (
                          <Tooltip title="Only one prophet verse shows at a time: the most recently scheduled one that is due.">
                            <Chip
                              size="small"
                              color="primary"
                              label="Showing now"
                              sx={{ ml: 1 }}
                              data-testid={`prophet-verse-current-${verse.id}`}
                            />
                          </Tooltip>
                        ) : null}
                      </TableCell>
                      {canManage ? (
                        <TableCell align="right">
                          <Button
                            size="small"
                            onClick={() => void handleTogglePublished(verse)}
                            disabled={busyId === verse.id}
                            data-testid={`prophet-verse-toggle-${verse.id}`}
                          >
                            {verse.published ? 'Unpublish' : 'Publish'}
                          </Button>
                          <IconButton
                            component={RouterLink}
                            to={`/prophet-verses/${verse.id}/edit`}
                            aria-label={`Edit ${verse.title}`}
                            data-testid={`edit-prophet-verse-${verse.id}`}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                          <IconButton
                            aria-label={`Delete ${verse.title}`}
                            onClick={() => setDeleteTarget(verse)}
                            disabled={busyId === verse.id}
                            data-testid={`delete-prophet-verse-${verse.id}`}
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
        <DialogTitle>Delete this prophet verse?</DialogTitle>
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
            data-testid="prophet-verse-confirm-delete"
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
