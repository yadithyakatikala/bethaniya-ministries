import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Alert, Button, TextField } from '@mui/material';
import { createDailyVerse, updateDailyVerse } from '../../services/firebase/dailyVerses';
import {
  hasValidationErrors,
  validateDailyVerseImage,
  validateDailyVerseInput,
} from './validation';
import type { DailyVerse } from '../../types';
import { SAVE_RETRY_MESSAGE } from '../../services/firebase/saveErrors';
import { AdminPageHeader } from '../../components/AdminPageHeader';
import { FormActions, FormCard, PageContainer } from '../../components/ui';
import { ImageField } from '../../components/media';
import { ScriptureReferenceField } from '../scripture/ScriptureReferenceField';

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
 * The reference stays a text field, so anything already saved there stays
 * editable as written. Beside it is a "Choose from the Bible" button that
 * fills it with a reference checked against the 66 books and the real verse
 * count of every chapter (../scripture/ScriptureReferenceField.tsx). The
 * verse TEXT is still typed by hand: there is no Bible source in the admin
 * to fill it from.
 */
export function DailyVerseForm({ mode, verse }: DailyVerseFormProps) {
  const navigate = useNavigate();
  // The Verse of the Day page offers "set this day by hand" next to a
  // day it has just shown, so the date is already known by the time the
  // form opens. Read once, as the initial value only -- retyping the
  // date must not be undone by the URL it was reached through.
  const [searchParams] = useSearchParams();
  const [reference, setReference] = useState(verse?.reference ?? '');
  const [text, setText] = useState(verse?.text ?? '');
  const [date, setDate] = useState(
    verse?.date ?? (mode === 'create' ? (searchParams.get('date') ?? '') : '')
  );
  const [imageUrl, setImageUrl] = useState<string | null>(verse?.imageUrl ?? null);
  const [uploading, setUploading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{
    reference?: string;
    text?: string;
    date?: string;
  }>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitError(null);

    const errors = validateDailyVerseInput({ reference, text, date });
    setFieldErrors(errors);
    if (hasValidationErrors(errors) || uploading) return;

    setSubmitting(true);
    try {
      if (mode === 'create') {
        await createDailyVerse({ reference, text, imageUrl, date });
      } else if (verse) {
        await updateDailyVerse(verse.id, { reference, text, imageUrl, date });
      }
      navigate('/daily-verses');
    } catch {
      setSubmitError(SAVE_RETRY_MESSAGE);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PageContainer width="narrow">
      <AdminPageHeader
        title={mode === 'create' ? 'New Daily Verse' : 'Edit Daily Verse'}
        breadcrumbs={[
          { label: 'Daily Verses', to: '/daily-verses' },
          { label: mode === 'create' ? 'New' : 'Edit' },
        ]}
      />
      <FormCard onSubmit={handleSubmit}>
        {submitError ? (
          <Alert severity="error" sx={{ mb: 2 }} data-testid="daily-verse-form-error">
            {submitError}
          </Alert>
        ) : null}

        <ScriptureReferenceField
          label="Scripture Reference"
          placeholder="e.g. John 3:16"
          value={reference}
          onChange={setReference}
          error={Boolean(fieldErrors.reference)}
          helperText={fieldErrors.reference}
          testId="daily-verse-reference-input"
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

        <ImageField
          label="Image (optional)"
          value={imageUrl}
          onChange={setImageUrl}
          category="poster"
          testIdPrefix="daily-verse-image"
          validateFile={validateDailyVerseImage}
          onBusyChange={setUploading}
        />

        <FormActions>
          <Button
            type="submit"
            variant="contained"
            disabled={submitting || uploading}
            data-testid="daily-verse-form-submit"
          >
            {mode === 'create' ? 'Create' : 'Save changes'}
          </Button>
          <Button
            onClick={() => navigate('/daily-verses')}
            data-testid="daily-verse-form-cancel"
          >
            Cancel
          </Button>
        </FormActions>
      </FormCard>
    </PageContainer>
  );
}
