import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Box, Button, Paper, TextField, Typography } from '@mui/material';
import {
  createAnnouncement,
  updateAnnouncement,
  uploadAnnouncementImage,
} from '../../services/firebase/announcements';
import {
  hasValidationErrors,
  validateAnnouncementImage,
  validateAnnouncementInput,
} from './validation';
import type { Announcement } from '../../types';

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
 */
export function AnnouncementForm({ mode, announcement }: AnnouncementFormProps) {
  const navigate = useNavigate();
  const [title, setTitle] = useState(announcement?.title ?? '');
  const [content, setContent] = useState(announcement?.content ?? '');
  const [imageUrl] = useState<string | null>(announcement?.imageUrl ?? null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ title?: string; content?: string }>(
    {}
  );
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function handleImageChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    if (!file) {
      setImageFile(null);
      setImageError(null);
      return;
    }
    const error = validateAnnouncementImage(file);
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

    const errors = validateAnnouncementInput({ title, content });
    setFieldErrors(errors);
    if (hasValidationErrors(errors) || imageError) return;

    setSubmitting(true);
    try {
      let resolvedImageUrl = imageUrl;
      if (imageFile) {
        resolvedImageUrl = await uploadAnnouncementImage(imageFile);
      }

      if (mode === 'create') {
        await createAnnouncement({ title, content, imageUrl: resolvedImageUrl });
      } else if (announcement) {
        await updateAnnouncement(announcement.id, {
          title,
          content,
          imageUrl: resolvedImageUrl,
        });
      }
      navigate('/announcements');
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
          {mode === 'create' ? 'New Announcement' : 'Edit Announcement'}
        </Typography>

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

        <Box sx={{ mt: 2, mb: 1 }}>
          <Typography variant="body2" gutterBottom>
            Image (optional)
          </Typography>
          <input
            type="file"
            accept="image/*"
            onChange={handleImageChange}
            data-testid="announcement-image-input"
          />
          {imageError ? (
            <Typography
              variant="body2"
              color="error"
              data-testid="announcement-image-error"
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
          data-testid="announcement-form-submit"
        >
          {mode === 'create' ? 'Create' : 'Save changes'}
        </Button>
        <Button
          sx={{ mt: 2, ml: 1 }}
          onClick={() => navigate('/announcements')}
          data-testid="announcement-form-cancel"
        >
          Cancel
        </Button>
      </Paper>
    </Box>
  );
}
