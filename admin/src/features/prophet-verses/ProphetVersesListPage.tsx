import { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
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
  Typography,
} from '@mui/material';
import AddOutlined from '@mui/icons-material/AddOutlined';
import DeleteOutlined from '@mui/icons-material/DeleteOutlined';
import EditOutlined from '@mui/icons-material/EditOutlined';
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
import {
  PageContainer,
  SectionCard,
  StatusChip,
  TableSkeleton,
  ToneChip,
  formatDateTime,
} from '../../components/ui';
import { adminFonts } from '../../theme/tokens';
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
    <PageContainer testId="prophet-verses-list-page">
      <AdminPageHeader
        title="Prophet Verse of the Day"
        subtitle={
          // Said once, plainly, because the two features sit next to each
          // other on the home screen and share most of their name.
          'A word your church writes and publishes. This is not the Verse of the Day — that one the app chooses by itself from scripture, and it is managed on its own page. Nothing here happens automatically: a prophet verse appears when you publish it, and stays until another one is due.'
        }
        action={
          canManage ? (
            <Button
              variant="contained"
              component={RouterLink}
              to="/prophet-verses/new"
              startIcon={<AddOutlined />}
              data-testid="new-prophet-verse-button"
            >
              New Prophet Verse
            </Button>
          ) : undefined
        }
      />

      {/* THE ANSWER FIRST. Only one shows at a time, and which one is
          not obvious from a list of dates. */}
      <Box sx={{ mb: 3 }}>
        <SectionCard title="On the home screen now" accent testId="prophet-verse-now-panel">
          {!verses ? (
            <Typography color="text.secondary" variant="body2">
              Checking&hellip;
            </Typography>
          ) : current ? (
            <>
              <Typography
                sx={{
                  fontFamily: adminFonts.heading,
                  fontSize: '1.25rem',
                  fontWeight: 600,
                  lineHeight: 1.3,
                  overflowWrap: 'anywhere',
                }}
                data-testid="prophet-verse-now-title"
              >
                {current.title}
              </Typography>
              <Typography color="text.secondary" variant="body2" sx={{ mt: 0.5 }}>
                {current.reference} &middot; showing since{' '}
                {formatDateTime(current.publishAt)}
              </Typography>
            </>
          ) : (
            <Typography
              color="text.secondary"
              variant="body2"
              data-testid="prophet-verse-now-none"
            >
              Nothing. The app simply leaves this section out until something is
              published and due &mdash; members are not shown an empty box.
            </Typography>
          )}
          {scheduledCount > 0 ? (
            <Typography color="text.secondary" variant="body2" sx={{ mt: 1.5 }}>
              {scheduledCount === 1
                ? '1 more is scheduled and will take over when its time comes.'
                : `${scheduledCount} more are scheduled; the latest one due takes over.`}
            </Typography>
          ) : null}
        </SectionCard>
      </Box>

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
        <TableSkeleton testId="prophet-verses-loading" label="Loading prophet verses" />
      ) : null}

      {verses && verses.length === 0 ? (
        <AdminEmptyState
          title="No prophet verses yet"
          message="Until there is one, the app simply does not show that section."
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
                      <TableCell>
                        <Typography sx={{ fontWeight: 600, overflowWrap: 'break-word' }}>
                          {verse.title}
                        </Typography>
                      </TableCell>
                      <TableCell>{verse.reference}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        {formatDateTime(verse.publishAt)}
                      </TableCell>
                      <TableCell>
                        {/* Named, not coloured: "scheduled" and "draft" look
                            identical to a member, so the words have to carry it. */}
                        <StatusChip
                          status={state === 'showing' ? 'published' : state}
                          testId={`prophet-verse-state-${verse.id}`}
                        />
                        {verse.id === currentId ? (
                          <Tooltip title="Only one prophet verse shows at a time: the most recently scheduled one that is due.">
                            <Box component="span" sx={{ ml: 1, display: 'inline-block' }}>
                              <ToneChip
                                tone="navy"
                                label="Showing now"
                                testId={`prophet-verse-current-${verse.id}`}
                              />
                            </Box>
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
                            <EditOutlined fontSize="small" />
                          </IconButton>
                          <IconButton
                            aria-label={`Delete ${verse.title}`}
                            onClick={() => setDeleteTarget(verse)}
                            disabled={busyId === verse.id}
                            data-testid={`delete-prophet-verse-${verse.id}`}
                          >
                            <DeleteOutlined fontSize="small" />
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
    </PageContainer>
  );
}
