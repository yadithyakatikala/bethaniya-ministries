import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
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
  FormControl,
  FormControlLabel,
  Paper,
  Radio,
  RadioGroup,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import {
  estimateRecipientCount,
  sendNotification,
  subscribeToNotificationLog,
  uploadNotificationImage,
} from '../../services/firebase/notifications';
import {
  hasValidationErrors,
  validateNotificationImage,
  validateNotificationInput,
} from './validation';
import { useAuthStore } from '../../store/authStore';
import type { NotificationLogEntry, NotificationRecipientGroup } from '../../types';

/**
 * Admin Notifications page -- Day 10, per
 * FINAL_ARCHITECTURE_SPECIFICATION.md's Notifications section: "Compose
 * notification: title + message + optional image", "Recipient selector:
 * All Members / Admins Only", "Send button + confirmation", "Notification
 * log (view past sent)".
 *
 * "All Members" broadcasts to every registered /users document -- admins
 * are members of the congregation too, this isn't a filter on the
 * `member` role literal. "Admins Only" narrows to the same host/
 * content_admin/super_admin role set that may send at all, for internal/
 * staff-only notices. functions/src/sendNotification.ts's header comment
 * states the identical interpretation server-side.
 *
 * Role gating: matches functions/src/sendNotification.ts's ALLOWED_ROLES
 * exactly (host/content_admin/super_admin may send; a member sees an
 * "unauthorized" message instead of the composer -- UI convenience only,
 * the real boundary is the callable's own server-side role check). The
 * optional image field is additionally hidden for a Host caller: storage.
 * rules' content/{imageType}/{fileName} write rule is
 * isContentAdminOrAbove(), which does NOT include host, so a Host who
 * tried to attach an image would hit a Storage permission error on
 * upload -- hiding the control avoids ever presenting that dead end,
 * matching the RBAC table's "Client-side: Admin UI hides disallowed
 * actions" principle. This is a pre-existing rule this page reuses
 * unchanged, not something loosened for notifications.
 *
 * Confirmation dialog recipient count: a Host caller cannot list /users
 * directly (firestore.rules' users/{userId} read rule is isOwner(userId)
 * || isContentAdminOrAbove(), which -- like the Storage rule above --
 * excludes host), so estimateRecipientCount() can only ever return a
 * number for Content Admin/Super Admin; for a Host it resolves to null,
 * and the dialog below says so plainly instead of showing a wrong or
 * stuck count. Either way, the actual, authoritative recipient count is
 * always computed server-side by the sendNotification callable itself
 * and is what's stored in (and later shown from) the notification log.
 *
 * HONESTLY DISCLOSED LIMITATION -- sending here does NOT deliver a real
 * FCM push notification to any device. See
 * functions/src/sendNotification.ts's header comment for the full
 * disclosure: this project has never registered a push token from any
 * device (mobile/src/services/notifications/notificationService.ts
 * discloses the identical limitation from the client side), so there is
 * nothing for a real send to deliver to regardless of billing plan. What
 * this page and its callable DO faithfully do is everything else Day 10
 * asked for and that's actually testable at ₹0: authenticate, authorize,
 * validate, compute a real recipient count, and record an immutable log
 * entry of what was sent and to how many people.
 */

function canSendNotifications(role: string | null): boolean {
  return role === 'host' || role === 'content_admin' || role === 'super_admin';
}

/** Mirrors storage.rules' content/{imageType} write rule (isContentAdminOrAbove()) -- see header comment above. */
function canAttachImage(role: string | null): boolean {
  return role === 'content_admin' || role === 'super_admin';
}

const RECIPIENT_LABELS: Record<NotificationRecipientGroup, string> = {
  all_members: 'All Members',
  admins_only: 'Admins Only',
};

function formatSentAt(date: Date | null): string {
  return date ? date.toLocaleString() : 'Unknown';
}

export function NotificationsPage() {
  const role = useAuthStore((s) => s.role);
  const canSend = canSendNotifications(role);
  const canImage = canAttachImage(role);

  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [recipientGroup, setRecipientGroup] =
    useState<NotificationRecipientGroup>('all_members');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ title?: string; message?: string }>(
    {}
  );
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [recipientPreviewCount, setRecipientPreviewCount] = useState<number | null>(null);
  const [recipientPreviewLoading, setRecipientPreviewLoading] = useState(false);

  const [log, setLog] = useState<NotificationLogEntry[] | null>(null);
  const [logError, setLogError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToNotificationLog(
      (next) => {
        setLog(next);
        setLogError(null);
      },
      () => setLogError('Could not load the notification log. Please try again.')
    );
    return unsubscribe;
  }, []);

  function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    if (!file) {
      setImageFile(null);
      setImageError(null);
      return;
    }
    const error = validateNotificationImage(file);
    if (error) {
      setImageError(error);
      setImageFile(null);
      return;
    }
    setImageError(null);
    setImageFile(file);
  }

  async function handleOpenConfirm(event: FormEvent) {
    event.preventDefault();
    setSubmitError(null);
    setSuccessMessage(null);

    const errors = validateNotificationInput({ title, message });
    setFieldErrors(errors);
    if (hasValidationErrors(errors) || imageError) return;

    setConfirmOpen(true);
    setRecipientPreviewLoading(true);
    const count = await estimateRecipientCount(recipientGroup);
    setRecipientPreviewCount(count);
    setRecipientPreviewLoading(false);
  }

  async function handleConfirmSend() {
    setSubmitting(true);
    setSubmitError(null);
    try {
      let resolvedImageUrl: string | null = null;
      if (imageFile) {
        resolvedImageUrl = await uploadNotificationImage(imageFile);
      }
      const { recipientCount } = await sendNotification({
        title: title.trim(),
        message: message.trim(),
        imageUrl: resolvedImageUrl,
        recipientGroup,
      });
      setSuccessMessage(
        `Recorded in the notification log for ${recipientCount} recipient${
          recipientCount === 1 ? '' : 's'
        } (${RECIPIENT_LABELS[recipientGroup]}). No real push notification was sent -- ` +
          `device delivery isn't implemented yet (see the note above).`
      );
      setTitle('');
      setMessage('');
      setImageFile(null);
      setRecipientGroup('all_members');
      setConfirmOpen(false);
    } catch {
      setSubmitError('Something went wrong while sending. Please try again.');
      setConfirmOpen(false);
    } finally {
      setSubmitting(false);
    }
  }

  if (!canSend) {
    return (
      <Box sx={{ p: 4 }} data-testid="notifications-page">
        <Typography color="text.secondary" data-testid="notifications-unauthorized">
          You are not authorized to send notifications.
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 4 }} data-testid="notifications-page">
      <Typography variant="h5" component="h1" gutterBottom>
        Notifications
      </Typography>

      <Alert
        severity="info"
        sx={{ mb: 3, maxWidth: 640 }}
        data-testid="notification-no-push-disclosure"
      >
        Sending here validates the request, computes the real recipient count, and records
        an entry in the notification log below. It does not deliver a real push
        notification to any device yet -- this app has no push-token registration, so
        there is nothing for a real send to reach.
      </Alert>

      <Paper
        sx={{ p: 4, maxWidth: 640, mb: 4 }}
        component="form"
        onSubmit={(e) => void handleOpenConfirm(e)}
      >
        {submitError ? (
          <Alert severity="error" sx={{ mb: 2 }} data-testid="notification-form-error">
            {submitError}
          </Alert>
        ) : null}
        {successMessage ? (
          <Alert
            severity="success"
            sx={{ mb: 2 }}
            data-testid="notification-form-success"
          >
            {successMessage}
          </Alert>
        ) : null}

        <TextField
          label="Title"
          fullWidth
          margin="normal"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          error={Boolean(fieldErrors.title)}
          helperText={fieldErrors.title}
          slotProps={{ htmlInput: { 'data-testid': 'notification-title-input' } }}
        />
        <TextField
          label="Message"
          fullWidth
          multiline
          minRows={3}
          margin="normal"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          error={Boolean(fieldErrors.message)}
          helperText={fieldErrors.message}
          slotProps={{ htmlInput: { 'data-testid': 'notification-message-input' } }}
        />

        <FormControl sx={{ mt: 2, display: 'block' }}>
          <Typography variant="body2" gutterBottom>
            Recipients
          </Typography>
          <RadioGroup
            value={recipientGroup}
            onChange={(e) =>
              setRecipientGroup(e.target.value as NotificationRecipientGroup)
            }
          >
            <FormControlLabel
              value="all_members"
              control={<Radio data-testid="recipient-all-members" />}
              label="All Members"
            />
            <FormControlLabel
              value="admins_only"
              control={<Radio data-testid="recipient-admins-only" />}
              label="Admins Only"
            />
          </RadioGroup>
        </FormControl>

        {canImage ? (
          <Box sx={{ mt: 2, mb: 1 }}>
            <Typography variant="body2" gutterBottom>
              Image (optional)
            </Typography>
            <input
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              data-testid="notification-image-input"
            />
            {imageError ? (
              <Typography
                variant="body2"
                color="error"
                data-testid="notification-image-error"
              >
                {imageError}
              </Typography>
            ) : null}
          </Box>
        ) : null}

        <Button
          type="submit"
          variant="contained"
          sx={{ mt: 2 }}
          disabled={submitting}
          data-testid="notification-form-submit"
        >
          Send
        </Button>
      </Paper>

      <Typography variant="h6" component="h2" gutterBottom>
        Notification Log
      </Typography>

      {logError ? (
        <Alert severity="error" data-testid="notification-log-error">
          {logError}
        </Alert>
      ) : null}

      {!log && !logError ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
          <CircularProgress data-testid="notification-log-loading" />
        </Box>
      ) : null}

      {log && log.length === 0 ? (
        <Typography color="text.secondary" data-testid="notification-log-empty">
          No notifications sent yet.
        </Typography>
      ) : null}

      {log && log.length > 0 ? (
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Sent</TableCell>
                <TableCell>Title</TableCell>
                <TableCell>Recipients</TableCell>
                <TableCell align="right">Count</TableCell>
                <TableCell>Sent By</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {log.map((entry) => (
                <TableRow key={entry.id} data-testid={`notification-log-row-${entry.id}`}>
                  <TableCell>{formatSentAt(entry.sentAt)}</TableCell>
                  <TableCell>{entry.title}</TableCell>
                  <TableCell>
                    <Chip
                      label={RECIPIENT_LABELS[entry.recipientGroup]}
                      size="small"
                      color={
                        entry.recipientGroup === 'admins_only' ? 'warning' : 'default'
                      }
                    />
                  </TableCell>
                  <TableCell align="right">{entry.recipientCount}</TableCell>
                  <TableCell>{entry.sentByEmail ?? entry.sentBy}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      ) : null}

      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <DialogTitle>Record this notification?</DialogTitle>
        <DialogContent>
          <DialogContentText component="div">
            <Typography gutterBottom>
              This will be recorded for:{' '}
              <strong>{RECIPIENT_LABELS[recipientGroup]}</strong>
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              No real push notification is sent -- see the note on the page.
            </Typography>
            {recipientPreviewLoading ? (
              <Typography
                variant="body2"
                color="text.secondary"
                data-testid="recipient-count-loading"
              >
                Counting recipients…
              </Typography>
            ) : recipientPreviewCount !== null ? (
              <Typography variant="body2" data-testid="recipient-count-preview">
                Approximately {recipientPreviewCount} recipient
                {recipientPreviewCount === 1 ? '' : 's'}.
              </Typography>
            ) : (
              <Typography
                variant="body2"
                color="text.secondary"
                data-testid="recipient-count-unavailable"
              >
                Recipient count isn't available to preview for your role -- it will be
                shown in the notification log below after sending.
              </Typography>
            )}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={() => void handleConfirmSend()}
            disabled={submitting}
            data-testid="confirm-send-button"
          >
            Send
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
