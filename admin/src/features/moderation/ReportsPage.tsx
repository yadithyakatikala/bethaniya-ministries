import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { AdminEmptyState } from '../../components/AdminEmptyState';
import { AdminPageHeader } from '../../components/AdminPageHeader';
import { AdminTableCard } from '../../components/AdminTableCard';
import { useAuthStore } from '../../store/authStore';
import {
  REPORT_REASON_LABELS,
  REPORT_TARGET_LABELS,
  fetchReportedContent,
  removeReportedContent,
  resolveReport,
  subscribeToReports,
  type ReportRecord,
  type ReportStatus,
  type ReportedContent,
} from '../../services/firebase/reports';

/**
 * The moderation queue -- M7.
 *
 * =====================================================================
 * THIS PAGE SHOWS THE CONTENT, NOT JUST THE COMPLAINT
 * =====================================================================
 * A queue of "someone reported a chat message" with an id and a reason is
 * a queue nobody can act on: the administrator would have to go and find
 * the message in the app to know what was said. Opening a report fetches
 * the reported words and shows them, which is the only thing that makes
 * "remove it" or "dismiss this" a decision rather than a guess.
 *
 * It is fetched ON OPEN, not for every row. A queue of forty reports
 * would otherwise be forty extra document reads to render a table.
 *
 * =====================================================================
 * AN ANONYMOUS AUTHOR STAYS ANONYMOUS HERE TOO
 * =====================================================================
 * A reported prayer request shows its words and "Anonymous" -- the
 * document carries no author to show, and this page has no privileged
 * lookup. firestore.rules opens the private author record to a SUPER
 * admin only, deliberately, and nothing on this page reads it. A content
 * admin can remove an abusive request without ever learning that it was
 * written by the member sitting three rows in front of them.
 *
 * =====================================================================
 * LIVE, UNLIKE THE OTHER ADMIN LISTS
 * =====================================================================
 * ../../services/firebase/users.ts explains why the Users page is a
 * one-time fetch. A moderation queue is the opposite case: two
 * administrators working through it at once should not each be reviewing
 * a report the other has just closed.
 */
type Filter = 'open' | 'all';

export function ReportsPage() {
  const adminUid = useAuthStore((s) => s.user?.uid ?? null);

  const [reports, setReports] = useState<ReportRecord[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('open');

  const [reviewing, setReviewing] = useState<ReportRecord | null>(null);
  const [content, setContent] = useState<ReportedContent | null>(null);
  const [contentError, setContentError] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToReports(
      (next) => {
        setReports(next);
        setLoadError(null);
      },
      () => setLoadError('Could not load reports. Please try again.')
    );
    return unsubscribe;
  }, []);

  // The reported words, fetched when a report is opened and not before.
  //
  // The effect only FETCHES. Clearing the previous report's content
  // happens in openReview() below, which is an event handler -- an
  // effect that sets state in its body causes the cascading render the
  // hooks lint rule rejects, and every setState here happens after the
  // await.
  useEffect(() => {
    if (!reviewing) return undefined;
    let cancelled = false;
    void fetchReportedContent(reviewing)
      .then((next) => {
        if (!cancelled) setContent(next);
      })
      .catch(() => {
        if (!cancelled) setContentError('Could not load the reported content.');
      });
    return () => {
      cancelled = true;
    };
  }, [reviewing]);

  /** The only path that opens a report, so the only place that has to
   *  clear the last one's content. */
  function openReview(report: ReportRecord) {
    setContent(null);
    setContentError(null);
    setNote('');
    setActionError(null);
    setReviewing(report);
  }

  function closeReview() {
    setReviewing(null);
    setContent(null);
    setContentError(null);
    setNote('');
    setActionError(null);
  }

  async function handleRemove() {
    if (!reviewing || !adminUid) return;
    setBusy(true);
    setActionError(null);
    try {
      await removeReportedContent(reviewing, adminUid);
      // Removing the content resolves the report in the same action:
      // leaving it open afterwards would put it back in front of the next
      // administrator with nothing left to decide.
      await resolveReport(reviewing.id, adminUid, 'resolved', note);
      setMessage('The content was removed and the report resolved.');
      closeReview();
    } catch {
      setActionError('That did not work. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function handleResolve(status: ReportStatus) {
    if (!reviewing || !adminUid || status === 'open') return;
    setBusy(true);
    setActionError(null);
    try {
      await resolveReport(reviewing.id, adminUid, status, note);
      setMessage(status === 'resolved' ? 'Report resolved.' : 'Report dismissed.');
      closeReview();
    } catch {
      setActionError('That did not work. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  const visible = (reports ?? []).filter((report) =>
    filter === 'open' ? report.status === 'open' : true
  );

  return (
    <Box sx={{ p: 4 }} data-testid="reports-page">
      <AdminPageHeader
        title="Reports"
        action={
          <ToggleButtonGroup
            size="small"
            exclusive
            value={filter}
            onChange={(_event, next: Filter | null) => {
              if (next) setFilter(next);
            }}
            data-testid="reports-filter"
          >
            <ToggleButton value="open" data-testid="reports-filter-open">
              Open
            </ToggleButton>
            <ToggleButton value="all" data-testid="reports-filter-all">
              All
            </ToggleButton>
          </ToggleButtonGroup>
        }
      />

      {message ? (
        <Alert severity="success" sx={{ mb: 2 }} data-testid="reports-message">
          {message}
        </Alert>
      ) : null}
      {loadError ? (
        <Alert severity="error" data-testid="reports-error">
          {loadError}
        </Alert>
      ) : null}

      {!reports && !loadError ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <CircularProgress data-testid="reports-loading" />
        </Box>
      ) : null}

      {reports && visible.length === 0 ? (
        <AdminEmptyState
          message={
            filter === 'open'
              ? 'No open reports. Nothing needs attention.'
              : 'No reports have been filed.'
          }
          testId="reports-empty"
        />
      ) : null}

      {visible.length > 0 ? (
        <AdminTableCard>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>What</TableCell>
                  <TableCell>Reason</TableCell>
                  <TableCell>Reported</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Review</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {visible.map((report) => (
                  <TableRow key={report.id} data-testid={`report-row-${report.id}`}>
                    <TableCell>{REPORT_TARGET_LABELS[report.targetType]}</TableCell>
                    <TableCell>{REPORT_REASON_LABELS[report.reason]}</TableCell>
                    <TableCell>
                      {report.createdAt ? report.createdAt.toLocaleString() : '--'}
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={report.status}
                        color={
                          report.status === 'open'
                            ? 'warning'
                            : report.status === 'resolved'
                              ? 'success'
                              : 'default'
                        }
                        data-testid={`report-status-${report.id}`}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Button
                        size="small"
                        onClick={() => openReview(report)}
                        data-testid={`report-review-${report.id}`}
                      >
                        Review
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </AdminTableCard>
      ) : null}

      <Dialog open={Boolean(reviewing)} onClose={closeReview} fullWidth maxWidth="sm">
        <DialogTitle>Review report</DialogTitle>
        <DialogContent>
          {reviewing ? (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Box>
                <Typography variant="overline" color="text.secondary">
                  Reported as
                </Typography>
                <Typography>{REPORT_REASON_LABELS[reviewing.reason]}</Typography>
              </Box>

              {reviewing.details ? (
                <Box>
                  <Typography variant="overline" color="text.secondary">
                    What the reporter added
                  </Typography>
                  <Typography data-testid="report-details">{reviewing.details}</Typography>
                </Box>
              ) : null}

              <Box>
                <Typography variant="overline" color="text.secondary">
                  {REPORT_TARGET_LABELS[reviewing.targetType]}
                </Typography>
                {contentError ? (
                  <Alert severity="error" data-testid="report-content-error">
                    {contentError}
                  </Alert>
                ) : !content ? (
                  <CircularProgress size={20} data-testid="report-content-loading" />
                ) : content.missing ? (
                  <Typography color="text.secondary" data-testid="report-content-missing">
                    This has already been deleted by its author. There is nothing left to
                    remove.
                  </Typography>
                ) : (
                  <Stack spacing={0.5}>
                    <Typography variant="body2" color="text.secondary">
                      {/* A prayer request written anonymously carries no
                          author at all -- see this file's header. */}
                      {content.authorName ?? 'Anonymous'}
                    </Typography>
                    <Typography
                      data-testid="report-content-text"
                      sx={{ whiteSpace: 'pre-wrap' }}
                    >
                      {content.text}
                    </Typography>
                    {content.removed ? (
                      <Chip
                        size="small"
                        color="success"
                        label="Already removed"
                        data-testid="report-content-removed"
                      />
                    ) : null}
                  </Stack>
                )}
              </Box>

              <TextField
                label="Note (optional)"
                fullWidth
                multiline
                minRows={2}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                helperText="Kept on the report, for whoever reads it next."
                slotProps={{ htmlInput: { 'data-testid': 'report-note' } }}
              />

              {actionError ? (
                <Alert severity="error" data-testid="report-action-error">
                  {actionError}
                </Alert>
              ) : null}
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeReview} disabled={busy}>
            Cancel
          </Button>
          <Button
            onClick={() => void handleResolve('dismissed')}
            disabled={busy}
            data-testid="report-dismiss"
          >
            Dismiss
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => void handleRemove()}
            // Nothing to remove when the document is gone or already
            // taken down -- the report is still dismissable.
            disabled={busy || !content || content.missing || content.removed}
            data-testid="report-remove"
          >
            Remove content
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
