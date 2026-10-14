import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItem,
  ListItemText,
  Typography,
} from '@mui/material';
import ErrorOutlineOutlined from '@mui/icons-material/ErrorOutlineOutlined';
import WarningAmberOutlined from '@mui/icons-material/WarningAmberOutlined';
import { DateTimeField } from '../../components/ui';
import { adminColors } from '../../theme/tokens';
import { parsePublishAt, toDateTimeLocalValue } from '../prophet-verses/validation';
import {
  defaultScheduleValue,
  formatScheduleTime,
  type PlanStatusChange,
} from './planStatus';
import { blockingIssues, type ReadinessIssue } from './planReadiness';

/**
 * The last step before a plan reaches members -- or is set to reach them.
 *
 * It does two jobs. If the plan is not ready, it says exactly what is
 * missing, each item with a way to go and fix it, and offers no way
 * forward. If it is ready, it says what is about to happen in plain words
 * and asks once.
 *
 * Scheduling adds the moment, in the administrator's own time zone (named
 * in the field), and refuses one that has already passed.
 */
export function PublishDialog({
  open,
  mode,
  planTitle,
  dayCount,
  issues,
  busy,
  error,
  now,
  onClose,
  onConfirm,
  onFix,
}: {
  open: boolean;
  mode: 'publish' | 'schedule';
  planTitle: string;
  dayCount: number;
  issues: readonly ReadinessIssue[];
  busy: boolean;
  error: string | null;
  now: Date;
  onClose: () => void;
  onConfirm: (change: PlanStatusChange) => void;
  onFix: (issue: ReadinessIssue) => void;
}) {
  const [when, setWhen] = useState(() => defaultScheduleValue(now));
  const blocking = blockingIssues(issues);
  const warnings = issues.filter((issue) => issue.severity === 'warning');
  const scheduledFor = mode === 'schedule' ? parsePublishAt(when) : null;
  const timeProblem =
    mode !== 'schedule'
      ? null
      : scheduledFor === null
        ? 'Choose a date and time.'
        : scheduledFor.getTime() <= now.getTime()
          ? 'Choose a time in the future.'
          : null;

  const verb = mode === 'publish' ? 'publish' : 'schedule';
  const ready = blocking.length === 0;

  function confirm() {
    if (mode === 'publish') onConfirm({ to: 'published' });
    else if (scheduledFor && !timeProblem)
      onConfirm({ to: 'scheduled', publishAt: scheduledFor });
  }

  return (
    <Dialog
      open={open}
      onClose={busy ? undefined : onClose}
      fullWidth
      maxWidth="sm"
      aria-labelledby="publish-dialog-title"
    >
      <DialogTitle id="publish-dialog-title">
        {ready
          ? mode === 'publish'
            ? 'Publish this plan?'
            : 'Schedule this plan?'
          : `Not ready to ${verb} yet`}
      </DialogTitle>
      <DialogContent>
        {ready ? (
          <>
            <Typography sx={{ mb: 2 }} data-testid="publish-summary">
              {mode === 'publish' ? (
                <>
                  <strong>{planTitle || 'This plan'}</strong> ({dayCount}{' '}
                  {dayCount === 1 ? 'day' : 'days'}) will appear in the plan library for
                  every member as soon as you publish it.
                </>
              ) : (
                <>
                  <strong>{planTitle || 'This plan'}</strong> ({dayCount}{' '}
                  {dayCount === 1 ? 'day' : 'days'}) will stay hidden from members until
                  the time you choose, and then appear on its own.
                </>
              )}
            </Typography>

            {mode === 'schedule' ? (
              <DateTimeField
                label="Appears for members at"
                value={when}
                onChange={setWhen}
                error={Boolean(timeProblem)}
                helperText={
                  timeProblem ??
                  (scheduledFor
                    ? `That is ${formatScheduleTime(scheduledFor)}.`
                    : undefined)
                }
                testId="publish-schedule-time"
                min={toDateTimeLocalValue(now)}
              />
            ) : null}

            {warnings.length > 0 ? (
              <Box sx={{ mt: 2 }} data-testid="publish-warnings">
                <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                  Worth a look, but not a problem
                </Typography>
                <List dense disablePadding>
                  {warnings.map((issue) => (
                    <ListItem
                      key={issue.id}
                      disableGutters
                      sx={{ alignItems: 'flex-start' }}
                    >
                      <WarningAmberOutlined
                        fontSize="small"
                        sx={{ color: adminColors.warning, mr: 1, mt: 0.25 }}
                        aria-hidden
                      />
                      <ListItemText primary={issue.message} />
                    </ListItem>
                  ))}
                </List>
              </Box>
            ) : null}
          </>
        ) : (
          <>
            <Typography sx={{ mb: 1 }}>
              Fix {blocking.length === 1 ? 'this' : 'these'} first. Members would
              otherwise see something missing or broken.
            </Typography>
            <List dense disablePadding data-testid="publish-blockers">
              {blocking.map((issue) => (
                <ListItem
                  key={issue.id}
                  disableGutters
                  sx={{ alignItems: 'flex-start', gap: 1 }}
                  secondaryAction={
                    <Button
                      size="small"
                      onClick={() => onFix(issue)}
                      data-testid={`publish-fix-${issue.id}`}
                    >
                      Fix
                    </Button>
                  }
                >
                  <ErrorOutlineOutlined
                    fontSize="small"
                    sx={{ color: adminColors.danger, mt: 0.25 }}
                    aria-hidden
                  />
                  <ListItemText primary={issue.message} sx={{ pr: 6 }} />
                </ListItem>
              ))}
            </List>
          </>
        )}

        {error ? (
          <Alert severity="error" sx={{ mt: 2 }} data-testid="publish-error">
            {error}
          </Alert>
        ) : null}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy} data-testid="publish-cancel">
          {ready ? 'Cancel' : 'Close'}
        </Button>
        {ready ? (
          <Button
            variant="contained"
            onClick={confirm}
            disabled={busy || Boolean(timeProblem)}
            data-testid="publish-confirm"
          >
            {busy ? 'Working…' : mode === 'publish' ? 'Publish now' : 'Schedule'}
          </Button>
        ) : null}
      </DialogActions>
    </Dialog>
  );
}
