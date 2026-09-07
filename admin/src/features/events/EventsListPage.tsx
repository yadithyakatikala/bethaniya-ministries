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
  TextField,
  Typography,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import {
  deleteEvent,
  setEventLiveStream,
  setEventPublished,
  subscribeToEvents,
} from '../../services/firebase/events';
import { validateEventYouTubeUrl } from './validation';
import { useAuthStore } from '../../store/authStore';
import type { Event } from '../../types';

/** Matches firestore.rules' isContentAdminOrAbove() -- full event CRUD + publish/unpublish. Gating these buttons is a UX convenience only; the rules are the real boundary. */
function canManageEvents(role: string | null): boolean {
  return role === 'content_admin' || role === 'super_admin';
}

/** Matches firestore.rules' isHostOrAbove() event-update branch -- Host (and above) may set ONLY isLive/youtubeUrl via the Live Stream dialog below, nothing else. Gating this button is a UX convenience only; the rules are the real boundary. */
function canManageLiveStream(role: string | null): boolean {
  return role === 'host' || role === 'content_admin' || role === 'super_admin';
}

function formatStartsAt(date: Date | null): string {
  if (!date) return '--';
  return date.toLocaleString();
}

/**
 * Admin events list -- Day 7. Table of every event (admins/hosts can read
 * all, unlike members) with title/starts-at/publish status/live status.
 * Two independent action sets, per the RBAC decisions in
 * FINAL_ARCHITECTURE_SPECIFICATION.md's Day 7 section:
 *  - Content Admin/Super Admin: New Event, edit, delete, publish/unpublish
 *    (canManageEvents).
 *  - Host (and above): a Live Stream dialog that can set ONLY the
 *    youtubeUrl/isLive fields (canManageLiveStream) -- this is the first
 *    write access a Host role has ever had in this app.
 * Mirrors SongsListPage.tsx's structure, extended with the second action
 * set.
 */
export function EventsListPage() {
  const role = useAuthStore((s) => s.role);
  const canManage = canManageEvents(role);
  const canStream = canManageLiveStream(role);

  const [events, setEvents] = useState<Event[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Event | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [streamTarget, setStreamTarget] = useState<Event | null>(null);
  const [streamUrl, setStreamUrl] = useState('');
  const [streamUrlError, setStreamUrlError] = useState<string | null>(null);
  const [streamSubmitting, setStreamSubmitting] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeToEvents(
      (next) => {
        setEvents(next);
        setError(null);
      },
      () => {
        setError('Could not load events. Please try again.');
      }
    );
    return unsubscribe;
  }, []);

  async function handleTogglePublished(event: Event) {
    setBusyId(event.id);
    try {
      await setEventPublished(event.id, event.title, !event.published);
    } finally {
      setBusyId(null);
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setBusyId(deleteTarget.id);
    try {
      await deleteEvent(deleteTarget.id, deleteTarget.title);
    } finally {
      setBusyId(null);
      setDeleteTarget(null);
    }
  }

  function openStreamDialog(event: Event) {
    setStreamTarget(event);
    setStreamUrl(event.youtubeUrl);
    setStreamUrlError(null);
  }

  function closeStreamDialog() {
    setStreamTarget(null);
    setStreamUrl('');
    setStreamUrlError(null);
  }

  async function handleSaveStreamUrl() {
    if (!streamTarget) return;
    const urlError = validateEventYouTubeUrl(streamUrl);
    setStreamUrlError(urlError);
    if (urlError) return;

    setStreamSubmitting(true);
    try {
      await setEventLiveStream(streamTarget.id, streamTarget.title, {
        isLive: streamTarget.isLive,
        youtubeUrl: streamUrl.trim(),
      });
      closeStreamDialog();
    } finally {
      setStreamSubmitting(false);
    }
  }

  async function handleToggleLive() {
    if (!streamTarget) return;
    const urlError = validateEventYouTubeUrl(streamUrl);
    setStreamUrlError(urlError);
    if (urlError) return;

    setStreamSubmitting(true);
    try {
      await setEventLiveStream(streamTarget.id, streamTarget.title, {
        isLive: !streamTarget.isLive,
        youtubeUrl: streamUrl.trim(),
      });
      closeStreamDialog();
    } finally {
      setStreamSubmitting(false);
    }
  }

  return (
    <Box sx={{ p: 4 }} data-testid="events-list-page">
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 3,
        }}
      >
        <Typography variant="h5" component="h1">
          Events
        </Typography>
        {canManage ? (
          <Button
            variant="contained"
            component={RouterLink}
            to="/events/new"
            data-testid="new-event-button"
          >
            New Event
          </Button>
        ) : null}
      </Box>

      {error ? (
        <Alert severity="error" data-testid="events-error">
          {error}
        </Alert>
      ) : null}

      {!events && !error ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <CircularProgress data-testid="events-loading" />
        </Box>
      ) : null}

      {events && events.length === 0 ? (
        <Typography color="text.secondary" data-testid="events-empty">
          No events yet.
        </Typography>
      ) : null}

      {events && events.length > 0 ? (
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Title</TableCell>
                <TableCell>Starts At</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Live</TableCell>
                {canManage || canStream ? (
                  <TableCell align="right">Actions</TableCell>
                ) : null}
              </TableRow>
            </TableHead>
            <TableBody>
              {events.map((event) => (
                <TableRow key={event.id} data-testid={`event-row-${event.id}`}>
                  <TableCell>{event.title}</TableCell>
                  <TableCell>{formatStartsAt(event.startsAt)}</TableCell>
                  <TableCell>
                    <Chip
                      label={event.published ? 'Published' : 'Draft'}
                      color={event.published ? 'success' : 'default'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    {event.isLive ? (
                      <Chip
                        label="LIVE"
                        color="error"
                        size="small"
                        data-testid={`live-chip-${event.id}`}
                      />
                    ) : null}
                  </TableCell>
                  {canManage || canStream ? (
                    <TableCell align="right">
                      {canManage ? (
                        <Button
                          size="small"
                          onClick={() => void handleTogglePublished(event)}
                          disabled={busyId === event.id}
                          data-testid={`toggle-published-${event.id}`}
                        >
                          {event.published ? 'Unpublish' : 'Publish'}
                        </Button>
                      ) : null}
                      {canStream ? (
                        <Button
                          size="small"
                          onClick={() => openStreamDialog(event)}
                          data-testid={`live-stream-${event.id}`}
                        >
                          Live Stream
                        </Button>
                      ) : null}
                      {canManage ? (
                        <>
                          <IconButton
                            component={RouterLink}
                            to={`/events/${event.id}/edit`}
                            aria-label="Edit"
                            data-testid={`edit-event-${event.id}`}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                          <IconButton
                            aria-label="Delete"
                            onClick={() => setDeleteTarget(event)}
                            disabled={busyId === event.id}
                            data-testid={`delete-event-${event.id}`}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </>
                      ) : null}
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      ) : null}

      <Dialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)}>
        <DialogTitle>Delete event?</DialogTitle>
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

      <Dialog
        open={Boolean(streamTarget)}
        onClose={closeStreamDialog}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Live Stream -- {streamTarget?.title}</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            Only the YouTube URL and LIVE status are changed here. No other event field is
            touched by this dialog.
          </DialogContentText>
          <TextField
            label="YouTube URL"
            fullWidth
            margin="normal"
            value={streamUrl}
            onChange={(e) => setStreamUrl(e.target.value)}
            error={Boolean(streamUrlError)}
            helperText={
              streamUrlError ??
              'A youtube.com or youtu.be link (e.g. a watch, live, or short URL). Leave empty to clear it.'
            }
            slotProps={{ htmlInput: { 'data-testid': 'stream-url-input' } }}
          />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Currently: {streamTarget?.isLive ? 'LIVE NOW' : 'Not live'}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeStreamDialog}>Cancel</Button>
          <Button
            onClick={() => void handleSaveStreamUrl()}
            disabled={streamSubmitting}
            data-testid="save-stream-url-button"
          >
            Save URL
          </Button>
          <Button
            variant="contained"
            color={streamTarget?.isLive ? 'error' : 'success'}
            onClick={() => void handleToggleLive()}
            disabled={streamSubmitting}
            data-testid="toggle-live-button"
          >
            {streamTarget?.isLive ? 'End live stream' : 'Go LIVE NOW'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
