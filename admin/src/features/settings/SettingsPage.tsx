import { useEffect, useRef, useState, type FormEvent } from 'react';
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
  Paper,
  TextField,
} from '@mui/material';
import {
  saveChurchSettings,
  subscribeToChurchSettings,
} from '../../services/firebase/settings';
import {
  hasValidationErrors,
  validateSettingsInput,
  type SettingsValidationErrors,
} from './validation';
import { useAuthStore } from '../../store/authStore';
import { AdminPageHeader } from '../../components/AdminPageHeader';
import type { ChurchSettings } from '../../types';

/**
 * Admin Settings page -- Day 13, per
 * FINAL_ARCHITECTURE_SPECIFICATION.md's Day 13 plan: "Admin: Settings
 * page (church name input + logo URL + description textarea + support
 * email)", "Save button + confirmation", "Form validation (required
 * fields, URL validation)", "Error handling (network errors, validation
 * errors)", "Loading states (spinner while saving)", "Success messages
 * (confirmation toast)".
 *
 * RBAC (per this session's explicit Day 13 decision, matching
 * FINAL_ARCHITECTURE_SPECIFICATION.md's Database Access Control table's
 * `settings` row exactly -- Member/Host/Content Admin: Read, Super
 * Admin: Read + write): unlike UsersPage.tsx (Day 11, Super-Admin-only
 * even to view) or NotificationsPage.tsx (host-or-above to view, member
 * blocked entirely), every role that can reach the admin dashboard at
 * all (host-or-above, via ProtectedRoute.tsx) can VIEW this page --
 * there is no "not authorized" full-block state here. Only a Super
 * Admin sees editable fields and a Save button; Host/Content Admin see
 * the same fields rendered disabled/read-only, matching
 * firestore.rules' settings/{settingId} write rule
 * (`allow write: if isSuperAdmin();`, unchanged -- see
 * services/firebase/settings.ts's doc comment). As with every other
 * client-side gate in this app, this is a UX convenience, not the
 * actual security boundary -- a Host/Content Admin whose browser
 * somehow submitted a write would still be rejected server-side by that
 * same rule.
 *
 * Data loading: subscribeToChurchSettings() is a realtime listener (see
 * services/firebase/settings.ts's doc comment for why, unlike
 * UsersPage.tsx's one-time fetch). The editable inputs are seeded from
 * the first snapshot exactly once (seededRef below) -- not on every
 * snapshot -- so a save-triggered refresh, or another admin's concurrent
 * edit, never overwrites text this admin is still mid-edit on. Same
 * pattern as mobile/src/features/profile/ProfileScreen.tsx's
 * seededNameRef.
 */
function canEditSettings(role: string | null): boolean {
  return role === 'super_admin';
}

export function SettingsPage() {
  const role = useAuthStore((s) => s.role);
  const canEdit = canEditSettings(role);

  const [settings, setSettings] = useState<ChurchSettings | null | undefined>(undefined);
  const [loadError, setLoadError] = useState<string | null>(null);
  const seededRef = useRef(false);

  const [churchName, setChurchName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [description, setDescription] = useState('');
  const [supportEmail, setSupportEmail] = useState('');

  const [fieldErrors, setFieldErrors] = useState<SettingsValidationErrors>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToChurchSettings(
      (next) => {
        setSettings(next);
        setLoadError(null);
        if (!seededRef.current) {
          setChurchName(next?.churchName ?? '');
          setLogoUrl(next?.logoUrl ?? '');
          setDescription(next?.description ?? '');
          setSupportEmail(next?.supportEmail ?? '');
          seededRef.current = true;
        }
      },
      () => setLoadError('Could not load settings. Please try again.')
    );
    return unsubscribe;
  }, []);

  function handleOpenConfirm(event: FormEvent) {
    event.preventDefault();
    setSubmitError(null);
    setSuccessMessage(null);
    const errors = validateSettingsInput({
      churchName,
      logoUrl,
      description,
      supportEmail,
    });
    setFieldErrors(errors);
    if (hasValidationErrors(errors)) return;
    setConfirmOpen(true);
  }

  async function handleConfirmSave() {
    setSubmitting(true);
    setSubmitError(null);
    try {
      await saveChurchSettings({ churchName, logoUrl, description, supportEmail });
      setSuccessMessage('Settings saved.');
      setConfirmOpen(false);
    } catch {
      setSubmitError('Something went wrong while saving. Please try again.');
      setConfirmOpen(false);
    } finally {
      setSubmitting(false);
    }
  }

  const isLoading = settings === undefined && !loadError;

  return (
    <Box sx={{ p: 4 }} data-testid="settings-page">
      <AdminPageHeader title="Settings" />

      {!canEdit ? (
        <Alert
          severity="info"
          sx={{ mb: 2, maxWidth: 640 }}
          data-testid="settings-readonly-notice"
        >
          You can view these settings, but only a Super Admin can edit and save them.
        </Alert>
      ) : null}

      {loadError ? (
        <Alert
          severity="error"
          sx={{ mb: 2, maxWidth: 640 }}
          data-testid="settings-load-error"
        >
          {loadError}
        </Alert>
      ) : null}

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <CircularProgress data-testid="settings-loading" />
        </Box>
      ) : null}

      {!isLoading && !loadError ? (
        <Paper
          sx={{ p: 4, maxWidth: 640 }}
          component="form"
          onSubmit={(e) => void handleOpenConfirm(e)}
        >
          {submitError ? (
            <Alert severity="error" sx={{ mb: 2 }} data-testid="settings-form-error">
              {submitError}
            </Alert>
          ) : null}
          {successMessage ? (
            <Alert severity="success" sx={{ mb: 2 }} data-testid="settings-form-success">
              {successMessage}
            </Alert>
          ) : null}

          <TextField
            label="Church Name"
            fullWidth
            margin="normal"
            value={churchName}
            onChange={(e) => setChurchName(e.target.value)}
            disabled={!canEdit}
            error={Boolean(fieldErrors.churchName)}
            helperText={fieldErrors.churchName}
            slotProps={{ htmlInput: { 'data-testid': 'church-name-input' } }}
          />
          <TextField
            label="Logo URL"
            fullWidth
            margin="normal"
            value={logoUrl}
            onChange={(e) => setLogoUrl(e.target.value)}
            disabled={!canEdit}
            error={Boolean(fieldErrors.logoUrl)}
            helperText={fieldErrors.logoUrl}
            slotProps={{ htmlInput: { 'data-testid': 'logo-url-input' } }}
          />
          <TextField
            label="Description"
            fullWidth
            multiline
            minRows={3}
            margin="normal"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={!canEdit}
            error={Boolean(fieldErrors.description)}
            helperText={fieldErrors.description}
            slotProps={{ htmlInput: { 'data-testid': 'description-input' } }}
          />
          <TextField
            label="Support Email"
            fullWidth
            margin="normal"
            value={supportEmail}
            onChange={(e) => setSupportEmail(e.target.value)}
            disabled={!canEdit}
            error={Boolean(fieldErrors.supportEmail)}
            helperText={fieldErrors.supportEmail}
            slotProps={{ htmlInput: { 'data-testid': 'support-email-input' } }}
          />

          {canEdit ? (
            <Button
              type="submit"
              variant="contained"
              sx={{ mt: 2 }}
              disabled={submitting}
              data-testid="settings-save-button"
            >
              Save
            </Button>
          ) : null}
        </Paper>
      ) : null}

      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <DialogTitle>Save these settings?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This updates the church info shown in the mobile app for every member.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={() => void handleConfirmSave()}
            disabled={submitting}
            data-testid="confirm-save-settings-button"
          >
            {submitting ? (
              <CircularProgress size={20} data-testid="settings-saving" />
            ) : (
              'Save'
            )}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
