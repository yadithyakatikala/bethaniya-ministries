import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Box, Button, Paper, TextField, Typography } from '@mui/material';
import { createEvent, updateEvent } from '../../services/firebase/events';
import { hasValidationErrors, validateEventInput } from './validation';
import type { Event } from '../../types';

interface EventFormProps {
  mode: 'create' | 'edit';
  /** Required when mode === 'edit'. */
  event?: Event;
}

/** Formats a Date as the value a <input type="datetime-local"> expects (local time, no seconds, no timezone offset). */
function toDatetimeLocalValue(date: Date | null): string {
  if (!date) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

/**
 * Shared create/edit form -- per FINAL_ARCHITECTURE_SPECIFICATION.md's Day 7
 * plan, this collects title + location + description + startsAt only.
 * published/isLive/youtubeUrl are managed elsewhere (EventsListPage.tsx's
 * publish toggle and Live Stream dialog respectively) -- a new event
 * always starts unpublished/not-live/no-URL, per createEvent()'s own
 * contract, mirroring SongForm.tsx.
 */
export function EventForm({ mode, event }: EventFormProps) {
  const navigate = useNavigate();
  const [title, setTitle] = useState(event?.title ?? '');
  const [location, setLocation] = useState(event?.location ?? '');
  const [description, setDescription] = useState(event?.description ?? '');
  const [startsAt, setStartsAt] = useState(toDatetimeLocalValue(event?.startsAt ?? null));
  const [fieldErrors, setFieldErrors] = useState<{
    title?: string;
    location?: string;
    description?: string;
    startsAt?: string;
  }>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(formEvent: FormEvent) {
    formEvent.preventDefault();
    setSubmitError(null);

    const errors = validateEventInput({ title, location, description, startsAt });
    setFieldErrors(errors);
    if (hasValidationErrors(errors)) return;

    setSubmitting(true);
    try {
      const input = { title, location, description, startsAt };
      if (mode === 'create') {
        await createEvent(input);
      } else if (event) {
        await updateEvent(event.id, input);
      }
      navigate('/events');
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
          {mode === 'create' ? 'New Event' : 'Edit Event'}
        </Typography>

        {submitError ? (
          <Alert severity="error" sx={{ mb: 2 }} data-testid="event-form-error">
            {submitError}
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
          slotProps={{ htmlInput: { 'data-testid': 'event-title-input' } }}
        />
        <TextField
          label="Location"
          fullWidth
          margin="normal"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          error={Boolean(fieldErrors.location)}
          helperText={fieldErrors.location}
          slotProps={{ htmlInput: { 'data-testid': 'event-location-input' } }}
        />
        <TextField
          label="Description"
          fullWidth
          multiline
          minRows={4}
          margin="normal"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          error={Boolean(fieldErrors.description)}
          helperText={fieldErrors.description}
          slotProps={{ htmlInput: { 'data-testid': 'event-description-input' } }}
        />
        <TextField
          label="Starts At"
          type="datetime-local"
          fullWidth
          margin="normal"
          value={startsAt}
          onChange={(e) => setStartsAt(e.target.value)}
          error={Boolean(fieldErrors.startsAt)}
          helperText={fieldErrors.startsAt}
          slotProps={{
            inputLabel: { shrink: true },
            htmlInput: { 'data-testid': 'event-starts-at-input' },
          }}
        />

        <Button
          type="submit"
          variant="contained"
          sx={{ mt: 2 }}
          disabled={submitting}
          data-testid="event-form-submit"
        >
          {mode === 'create' ? 'Create' : 'Save changes'}
        </Button>
        <Button
          sx={{ mt: 2, ml: 1 }}
          onClick={() => navigate('/events')}
          data-testid="event-form-cancel"
        >
          Cancel
        </Button>
      </Paper>
    </Box>
  );
}
