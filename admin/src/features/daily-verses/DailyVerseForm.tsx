import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Box, Button, Paper, TextField, Typography } from '@mui/material';
import {
  createDailyVerse,
  updateDailyVerse,
  uploadDailyVerseImage,
} from '../../services/firebase/dailyVerses';
import {
  hasValidationErrors,
  validateDailyVerseImage,
  validateDailyVerseInput,
} from './validation';
import type { DailyVerse } from '../../types';

interface DailyVerseFormProps {
  mode: 'create' | 'edit';
  /** Required when mode === 'edit'. */
  verse?: DailyVerse;
}

/**
 * Shared create/edit form -- per FINAL_ARCHITECTURE_SPECIFICATION.md's Day 5
 * plan: "scripture reference selector + verse text (auto-filled) + image
 * upload + date selector". No Bible API is wired up to auto-fill verse
 * text (Bible licensing/source is unresolved -- see
 * BIBLE_LICENSING.md/types/index.ts's DailyVerse doc comment); the admin
 * types the verse text directly, matching the spec's own documented
 * fallback ("else placeholder").
 *
 * The reference field is a plain text input, not a picker -- no Bible
 * source exists yet to populate a reference picker from either, and the
 * spec's Day 5 "Work" list doesn't require one beyond "selector" in the
 * loose sense of "the field where you enter the reference".
 */
export function DailyVerseForm({ mode, verse }: DailyVerseFormProps) {
  const navigate = useNavigate();
  const [reference, setReference] = useState(verse?.reference ?? '');
  const [text, setText] = useState(verse?.text ?? '');
  const [date, setDate] = useState(verse?.date ?? '');
  const [imageUrl] = useState<string | null>(verse?.imageUrl ?? null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    reference?: string;
    text?: string;
    date?: string;
  }>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function handleImageChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    if (!file) {
      setImageFile(null);
      setImageError(null);
      return;
    }
    const error = validateDailyVerseImage(file);
    if (error) {
      setImageError(error);
      setImageFile(null);
      return;
    }
    setImageError(null);
    setImageFile(file);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitError(null);

    const errors = validateDailyVerseInput({ reference, text, date });
    setFieldErrors(errors);
    if (hasValidationErrors(errors) || imageError) return;

    setSubmitting(true);
    try {
      let resolvedImageUrl = imageUrl;
      if (imageFile) {
        resolvedImageUrl = await uploadDailyVerseImage(imageFile);
      }

      if (mode === 'create') {
        await createDailyVerse({ reference, text, imageUrl: resolvedImageUrl, date });
      } else if (verse) {
        await updateDailyVerse(verse.id, {
          reference,
          text,
          imageUrl: resolvedImageUrl,
          date,
        });
      }
      navigate('/daily-verses');
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
          {mode === 'create' ? 'New Daily Verse' : 'Edit Daily Verse'}
        </Typography>

        {submitError ? (
          <Alert severity="error" sx={{ mb: 2 }} data-testid="daily-verse-form-error">
            {submitError}
          </Alert>
        ) : null}

        <TextField
          label="Scripture Reference"
          placeholder="e.g. John 3:16"
          fullWidth
          margin="normal"
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          error={Boolean(fieldErrors.reference)}
          helperText={fieldErrors.reference}
          slotProps={{ htmlInput: { 'data-testid': 'daily-verse-reference-input' } }}
        />
        <TextField
          label="Verse Text"
          fullWidth
          multiline
          minRows={4}
          margin="normal"
          value={text}
          onChange={(e) => setText(e.target.value)}
          error={Boolean(fieldErrors.text)}
          helperText={fieldErrors.text}
          slotProps={{ htmlInput: { 'data-testid': 'daily-verse-text-input' } }}
        />
        <TextField
          label="Date"
          type="date"
          fullWidth
          margin="normal"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          error={Boolean(fieldErrors.date)}
          helperText={fieldErrors.date}
          slotProps={{
            inputLabel: { shrink: true },
            htmlInput: { 'data-testid': 'daily-verse-date-input' },
          }}
        />

        <Box sx={{ mt: 2, mb: 1 }}>
          <Typography variant="body2" gutterBottom>
            Image (optional)
          </Typography>
          <input
            type="file"
            accept="image/*"
            onChange={handleImageChange}
            data-testid="daily-verse-image-input"
          />
          {imageError ? (
            <Typography
              variant="body2"
              color="error"
              data-testid="daily-verse-image-error"
            >
              {imageError}
            </Typography>
          ) : null}
          {imageUrl && !imageFile ? (
            <Typography variant="body2" color="text.secondary">
              Current image is set. Choose a new file to replace it.
            </Typography>
          ) : null}
        </Box>

        <Button
          type="submit"
          variant="contained"
          sx={{ mt: 2 }}
          disabled={submitting}
          data-testid="daily-verse-form-submit"
        >
          {mode === 'create' ? 'Create' : 'Save changes'}
        </Button>
        <Button
          sx={{ mt: 2, ml: 1 }}
          onClick={() => navigate('/daily-verses')}
          data-testid="daily-verse-form-cancel"
        >
          Cancel
        </Button>
      </Paper>
    </Box>
  );
}
