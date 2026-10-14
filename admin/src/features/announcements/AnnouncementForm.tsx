import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Button, TextField } from '@mui/material';
import {
  createAnnouncement,
  updateAnnouncement,
} from '../../services/firebase/announcements';
import {
  hasValidationErrors,
  validateAnnouncementImage,
  validateAnnouncementInput,
} from './validation';
import type { Announcement } from '../../types';
import { SAVE_RETRY_MESSAGE } from '../../services/firebase/saveErrors';
import { AdminPageHeader } from '../../components/AdminPageHeader';
import { FormActions, FormCard, PageContainer } from '../../components/ui';
import { ImageField } from '../../components/media';

interface AnnouncementFormProps {
  mode: 'create' | 'edit';
  /** Required when mode === 'edit'. */
  announcement?: Announcement;
}

/**
 * Shared create/edit form -- per FINAL_ARCHITECTURE_SPECIFICATION.md's Day 4
 * plan, this collects only title + content + image ("New announcement
 * form (title + content textarea + image upload)"). The publish/unpublish
 * toggle is a separate list-page action (AnnouncementsListPage.tsx), not
 * part of this form -- a new announcement always starts unpublished, per
 * createAnnouncement()'s own contract.
 *
 * The image is chosen, uploaded and previewed by <ImageField>, which hands
 * back the https address to store. Nothing about the picture happens at
 * Save time any more: by then it is just a string, like the title.
 */
export function AnnouncementForm({ mode, announcement }: AnnouncementFormProps) {
  const navigate = useNavigate();
  const [title, setTitle] = useState(announcement?.title ?? '');
  const [content, setContent] = useState(announcement?.content ?? '');
  const [imageUrl, setImageUrl] = useState<string | null>(announcement?.imageUrl ?? null);
  const [uploading, setUploading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ title?: string; content?: string }>(
    {}
  );
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitError(null);

    const errors = validateAnnouncementInput({ title, content });
    setFieldErrors(errors);
    if (hasValidationErrors(errors) || uploading) return;

    setSubmitting(true);
    try {
      if (mode === 'create') {
        await createAnnouncement({ title, content, imageUrl });
      } else if (announcement) {
        await updateAnnouncement(announcement.id, { title, content, imageUrl });
      }
      navigate('/announcements');
    } catch {
      setSubmitError(SAVE_RETRY_MESSAGE);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PageContainer width="narrow">
      <AdminPageHeader
        title={mode === 'create' ? 'New Announcement' : 'Edit Announcement'}
        breadcrumbs={[
          { label: 'Announcements', to: '/announcements' },
          { label: mode === 'create' ? 'New' : 'Edit' },
        ]}
      />
      <FormCard onSubmit={handleSubmit}>
        {submitError ? (
          <Alert severity="error" sx={{ mb: 2 }} data-testid="announcement-form-error">
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
          slotProps={{ htmlInput: { 'data-testid': 'announcement-title-input' } }}
        />
        <TextField
          label="Content"
          fullWidth
          multiline
          minRows={4}
          margin="normal"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          error={Boolean(fieldErrors.content)}
          helperText={fieldErrors.content}
          slotProps={{ htmlInput: { 'data-testid': 'announcement-content-input' } }}
        />

        <ImageField
          label="Image (optional)"
          value={imageUrl}
          onChange={setImageUrl}
          category="poster"
          testIdPrefix="announcement-image"
          validateFile={validateAnnouncementImage}
          onBusyChange={setUploading}
        />

        <FormActions>
          <Button
            type="submit"
            variant="contained"
            disabled={submitting || uploading}
            data-testid="announcement-form-submit"
          >
            {mode === 'create' ? 'Create' : 'Save changes'}
          </Button>
          <Button
            onClick={() => navigate('/announcements')}
            data-testid="announcement-form-cancel"
          >
            Cancel
          </Button>
        </FormActions>
      </FormCard>
    </PageContainer>
  );
}
