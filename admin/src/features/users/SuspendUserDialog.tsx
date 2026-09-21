import { useState, type FormEvent } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  FormLabel,
  Radio,
  RadioGroup,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  MAX_REASON_LENGTH,
  SUSPENSION_DURATIONS,
  describeSuspension,
  expiryAfterDays,
  expiryAtEndOfDay,
  hasSuspensionErrors,
  validateSuspensionRequest,
  type SuspensionRequest,
  type SuspensionRequestErrors,
} from './suspension';

/**
 * SUSPEND A MEMBER -- for how long, and why.
 *
 * ---------------------------------------------------------------------
 * WHY THIS IS A DIALOGUE AND THE OLD CONTROL WAS A TOGGLE
 * ---------------------------------------------------------------------
 * M7 had one button that flipped a member between posting and not
 * posting. That is the right shape for something reversible and
 * momentary, and the wrong shape for what a church actually decides: a
 * pause until Sunday is not the same act as barring somebody
 * indefinitely, and neither is safe to do without writing down why.
 *
 * So the four choices are on one screen, in the order a person thinks
 * about them: how long, and then the reason. Nothing is nested, nothing
 * is behind an "advanced" disclosure, and the button at the bottom says
 * what it will do rather than "OK".
 *
 * ---------------------------------------------------------------------
 * A CUSTOM DATE IS A DAY, NOT AN INSTANT
 * ---------------------------------------------------------------------
 * An administrator choosing "the 14th" means the suspension covers the
 * 14th. Taking that date at midnight would end it as the day begins --
 * a whole day short of what they meant -- so ./suspension.ts resolves it
 * to the end of that day. The summary line states the resulting moment,
 * so nobody has to take that on trust.
 */
type Choice = '1d' | '7d' | '30d' | 'custom' | 'permanent';

export function SuspendUserDialog({
  open,
  memberName,
  submitting,
  error,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  memberName: string;
  submitting: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: (request: SuspensionRequest) => void;
}) {
  const [choice, setChoice] = useState<Choice>('7d');
  const [customDate, setCustomDate] = useState('');
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<SuspensionRequestErrors>({});

  function buildRequest(): SuspensionRequest {
    if (choice === 'permanent') {
      return { kind: 'permanent', expiresAt: null, reason: reason.trim() || null };
    }
    const expiresAt =
      choice === 'custom'
        ? expiryAtEndOfDay(customDate)
        : expiryAfterDays(
            SUSPENSION_DURATIONS.find((duration) => duration.id === choice)?.days ?? 7
          );
    return { kind: 'temporary', expiresAt, reason: reason.trim() || null };
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const request = buildRequest();
    const next = validateSuspensionRequest(request);
    setErrors(next);
    if (hasSuspensionErrors(next)) return;
    onConfirm(request);
  }

  const preview = buildRequest();

  return (
    <Dialog open={open} onClose={submitting ? undefined : onCancel} fullWidth maxWidth="sm">
      <form onSubmit={handleSubmit} noValidate>
        <DialogTitle>Suspend {memberName}</DialogTitle>
        <DialogContent>
          {error ? (
            <Alert severity="error" sx={{ mb: 2 }} data-testid="suspend-error">
              {error}
            </Alert>
          ) : null}

          <Typography color="text.secondary" sx={{ fontSize: 14, mb: 2 }}>
            While suspended, this member cannot post anything &mdash; no chat messages, no
            prayer requests, no comments, no reports. They can still read the app, and the
            app tells them they are suspended and until when.
          </Typography>

          <FormControl sx={{ mb: 2 }}>
            <FormLabel id="suspend-duration-label">How long</FormLabel>
            <RadioGroup
              aria-labelledby="suspend-duration-label"
              value={choice}
              onChange={(event) => setChoice(event.target.value as Choice)}
            >
              {/* Each option is found by its label rather than a test id:
                  the label is what an administrator reads, and a test
                  that clicks "7 days" is checking the thing that
                  matters. */}
              {SUSPENSION_DURATIONS.map((duration) => (
                <FormControlLabel
                  key={duration.id}
                  value={duration.id}
                  control={<Radio />}
                  label={duration.label}
                />
              ))}
              <FormControlLabel
                value="custom"
                control={<Radio />}
                label="Until a date I choose"
              />
              <FormControlLabel
                value="permanent"
                control={<Radio />}
                label="Permanently, until an admin restores access"
              />
            </RadioGroup>
          </FormControl>

          <Stack spacing={2}>
            {choice === 'custom' ? (
              <TextField
                label="Last day of the suspension"
                type="date"
                value={customDate}
                onChange={(event) => setCustomDate(event.target.value)}
                error={Boolean(errors.expiresAt)}
                helperText={
                  errors.expiresAt ?? 'The suspension ends at the end of this day.'
                }
                slotProps={{
                  inputLabel: { shrink: true },
                  htmlInput: { 'data-testid': 'suspend-custom-date' },
                }}
              />
            ) : null}

            <TextField
              label="Reason (optional)"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              error={Boolean(errors.reason)}
              helperText={
                errors.reason ??
                'Recorded on the account so whoever looks next knows what happened. The member does not see it.'
              }
              multiline
              minRows={2}
              fullWidth
              slotProps={{
                htmlInput: {
                  'data-testid': 'suspend-reason',
                  maxLength: MAX_REASON_LENGTH,
                },
              }}
            />

            {/* Says what is about to happen, in the same words the
                account will show afterwards. */}
            <Typography color="text.secondary" sx={{ fontSize: 14 }} data-testid="suspend-summary">
              {memberName} will not be able to post {describeSuspension(preview)}.
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onCancel} disabled={submitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            color="warning"
            disabled={submitting}
            data-testid="suspend-confirm"
          >
            {submitting ? 'Suspending…' : 'Suspend'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
