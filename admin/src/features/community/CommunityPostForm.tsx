import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Box, Button, Paper, TextField, Typography } from '@mui/material';
import {
  createCommunityPost,
  updateCommunityPost,
  uploadCommunityPostImage,
} from '../../services/firebase/communityPosts';
import {
  hasValidationErrors,
  validateCommunityPostImage,
  validateCommunityPostInput,
} from './validation';
import type { CommunityPost } from '../../types';

interface CommunityPostFormProps {
  mode: 'create' | 'edit';
  /** Required when mode === 'edit'. */
  post?: CommunityPost;
}

/**
 * Shared create/edit form for community posts -- mirrors
 * ../announcements/AnnouncementForm.tsx exactly. The publish/unpublish
 * toggle is a separate list-page action (CommunityPostsListPage.tsx), not
 * part of this form -- a new post always starts unpublished.
 */
export function CommunityPostForm({ mode, post }: CommunityPostFormProps) {
  const navigate = useNavigate();
  const [title, setTitle] = useState(post?.title ?? '');
  const [content, setContent] = useState(post?.content ?? '');
  const [imageUrl] = useState<string | null>(post?.imageUrl ?? null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ title?: string; content?: string }>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function handleImageChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    if (!file) {
      setImageFile(null);
      setImageError(null);
      return;
    }
    const error = validateCommunityPostImage(file);
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

    const errors = validateCommunityPostInput({ title, content });
    setFieldErrors(errors);
    if (hasValidationErrors(errors) || imageError) return;

    setSubmitting(true);
    try {
      let resolvedImageUrl = imageUrl;
      if (imageFile) {
        resolvedImageUrl = await uploadCommunityPostImage(imageFile);
      }

      if (mode === 'create') {
        await createCommunityPost({ title, content, imageUrl: resolvedImageUrl });
      } else if (post) {
        await updateCommunityPost(post.id, { title, content, imageUrl: resolvedImageUrl });
      }
      navigate('/community');
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
          {mode === 'create' ? 'New Community Post' : 'Edit Community Post'}
        </Typography>

        {submitError ? (
          <Alert severity="error" sx={{ mb: 2 }} data-testid="community-post-form-error">
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
          slotProps={{ htmlInput: { 'data-testid': 'community-post-title-input' } }}
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
          slotProps={{ htmlInput: { 'data-testid': 'community-post-content-input' } }}
        />

        <Box sx={{ mt: 2, mb: 1 }}>
          <Typography variant="body2" gutterBottom>
            Image (optional)
          </Typography>
          <input
            type="file"
            accept="image/*"
            onChange={handleImageChange}
            data-testid="community-post-image-input"
          />
          {imageError ? (
            <Typography variant="body2" color="error" data-testid="community-post-image-error">
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
          data-testid="community-post-form-submit"
        >
          {mode === 'create' ? 'Create' : 'Save changes'}
        </Button>
        <Button
          sx={{ mt: 2, ml: 1 }}
          onClick={() => navigate('/community')}
          data-testid="community-post-form-cancel"
        >
          Cancel
        </Button>
      </Paper>
    </Box>
  );
}
