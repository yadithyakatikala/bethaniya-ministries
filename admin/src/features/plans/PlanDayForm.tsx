import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Alert, Box, Button, Paper, TextField, Typography } from '@mui/material';
import { createPlanDay, subscribeToPlans, updatePlanDay } from '../../services/firebase/plans';
import { hasValidationErrors, validatePlanDayInput } from './validation';
import type { Plan, PlanDay } from '../../types';

interface PlanDayFormProps {
  mode: 'create' | 'edit';
  /** Required when mode === 'edit'. */
  day?: PlanDay;
}

/**
 * Shared create/edit form for a single plan day. `:planId` comes from the
 * route (see App.tsx's /plans/:planId/days/new and .../:dayId/edit) --
 * the plan itself is looked up via subscribeToPlans() (same "reuse the
 * existing real-time list, no separate one-shot read pattern" reasoning
 * as ../announcements/EditAnnouncementPage.tsx) so this form can pass the
 * plan's title into createPlanDay/updatePlanDay's audit-log summary.
 */
export function PlanDayForm({ mode, day }: PlanDayFormProps) {
  const { planId } = useParams<{ planId: string }>();
  const navigate = useNavigate();
  const [plans, setPlans] = useState<Plan[] | null>(null);

  const [dayNumber, setDayNumber] = useState(String(day?.dayNumber ?? ''));
  const [title, setTitle] = useState(day?.title ?? '');
  const [scriptureReference, setScriptureReference] = useState(day?.scriptureReference ?? '');
  const [devotional, setDevotional] = useState(day?.devotional ?? '');
  const [prayerPrompt, setPrayerPrompt] = useState(day?.prayerPrompt ?? '');
  const [fieldErrors, setFieldErrors] = useState<ReturnType<typeof validatePlanDayInput>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeToPlans(
      (next) => setPlans(next),
      () => setPlans([])
    );
    return unsubscribe;
  }, []);

  const plan = plans?.find((p) => p.id === planId) ?? null;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitError(null);
    if (!planId || !plan) return;

    const parsedDayNumber = Number.parseInt(dayNumber, 10);
    const input = {
      dayNumber: Number.isFinite(parsedDayNumber) ? parsedDayNumber : NaN,
      title,
      scriptureReference,
      devotional,
      prayerPrompt,
    };
    const errors = validatePlanDayInput(input);
    setFieldErrors(errors);
    if (hasValidationErrors(errors)) return;

    setSubmitting(true);
    try {
      if (mode === 'create') {
        await createPlanDay(planId, plan.title, input);
      } else if (day) {
        await updatePlanDay(planId, plan.title, day.id, input);
      }
      navigate(`/plans/${planId}/days`);
    } catch {
      setSubmitError('Something went wrong while saving. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Box sx={{ p: 4, maxWidth: 640 }}>
      <Paper sx={{ p: 4 }} component="form" onSubmit={handleSubmit}>
        <Typography variant="h5" component="h1" gutterBottom>
          {mode === 'create' ? 'New Day' : 'Edit Day'}
          {plan ? ` — ${plan.title}` : ''}
        </Typography>

        {submitError ? (
          <Alert severity="error" sx={{ mb: 2 }} data-testid="plan-day-form-error">
            {submitError}
          </Alert>
        ) : null}

        <TextField
          label="Day number"
          type="number"
          fullWidth
          margin="normal"
          value={dayNumber}
          onChange={(e) => setDayNumber(e.target.value)}
          error={Boolean(fieldErrors.dayNumber)}
          helperText={fieldErrors.dayNumber}
          slotProps={{ htmlInput: { 'data-testid': 'plan-day-number-input' } }}
        />
        <TextField
          label="Title"
          fullWidth
          margin="normal"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          error={Boolean(fieldErrors.title)}
          helperText={fieldErrors.title}
          slotProps={{ htmlInput: { 'data-testid': 'plan-day-title-input' } }}
        />
        <TextField
          label="Scripture reference"
          fullWidth
          margin="normal"
          value={scriptureReference}
          onChange={(e) => setScriptureReference(e.target.value)}
          error={Boolean(fieldErrors.scriptureReference)}
          helperText={fieldErrors.scriptureReference || 'e.g. Philippians 4:4-7'}
          slotProps={{ htmlInput: { 'data-testid': 'plan-day-scripture-input' } }}
        />
        <TextField
          label="Devotional"
          fullWidth
          multiline
          minRows={4}
          margin="normal"
          value={devotional}
          onChange={(e) => setDevotional(e.target.value)}
          error={Boolean(fieldErrors.devotional)}
          helperText={fieldErrors.devotional}
          slotProps={{ htmlInput: { 'data-testid': 'plan-day-devotional-input' } }}
        />
        <TextField
          label="Prayer prompt (optional)"
          fullWidth
          multiline
          minRows={2}
          margin="normal"
          value={prayerPrompt}
          onChange={(e) => setPrayerPrompt(e.target.value)}
          error={Boolean(fieldErrors.prayerPrompt)}
          helperText={fieldErrors.prayerPrompt}
          slotProps={{ htmlInput: { 'data-testid': 'plan-day-prayer-prompt-input' } }}
        />

        <Button
          type="submit"
          variant="contained"
          sx={{ mt: 2 }}
          disabled={submitting || !plan}
          data-testid="plan-day-form-submit"
        >
          {mode === 'create' ? 'Create' : 'Save changes'}
        </Button>
        <Button
          sx={{ mt: 2, ml: 1 }}
          onClick={() => navigate(`/plans/${planId}/days`)}
          data-testid="plan-day-form-cancel"
        >
          Cancel
        </Button>
      </Paper>
    </Box>
  );
}
