import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Button, TextField } from '@mui/material';
import {
  createCommunityPost,
  updateCommunityPost,
} from '../../services/firebase/communityPosts';
import {
  hasValidationErrors,
  validateCommunityPostImage,
  validateCommunityPostInput,
} from './validation';
import type { CommunityPost } from '../../types';
import { SAVE_RETRY_MESSAGE } from '../../services/firebase/saveErrors';
import { AdminPageHeader } from '../../components/AdminPageHeader';
import { FormActions, FormCard, PageContainer } from '../../components/ui';
import { ImageField } from '../../components/media';

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
  const [imageUrl, setImageUrl] = useState<string | null>(post?.imageUrl ?? null);
  const [uploading, setUploading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ title?: string; content?: string }>(
    {}
  );
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitError(null);

    const errors = validateCommunityPostInput({ title, content });
    setFieldErrors(errors);
    if (hasValidationErrors(errors) || uploading) return;

    setSubmitting(true);
    try {
      if (mode === 'create') {
        await createCommunityPost({ title, content, imageUrl });
      } else if (post) {
        await updateCommunityPost(post.id, { title, content, imageUrl });
      }
      navigate('/community');
    } catch {
      setSubmitError(SAVE_RETRY_MESSAGE);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PageContainer width="narrow">
      <AdminPageHeader
        title={mode === 'create' ? 'New Community Post' : 'Edit Community Post'}
        breadcrumbs={[
          { label: 'Community', to: '/community' },
          { label: mode === 'create' ? 'New' : 'Edit' },
        ]}
      />
      <FormCard onSubmit={handleSubmit}>
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

        <ImageField
          label="Image (optional)"
          value={imageUrl}
          onChange={setImageUrl}
          category="general"
          testIdPrefix="community-post-image"
          validateFile={validateCommunityPostImage}
          onBusyChange={setUploading}
        />

        <FormActions>
          <Button
            type="submit"
            variant="contained"
            disabled={submitting || uploading}
            data-testid="community-post-form-submit"
          >
            {mode === 'create' ? 'Create' : 'Save changes'}
          </Button>
          <Button
            onClick={() => navigate('/community')}
            data-testid="community-post-form-cancel"
          >
            Cancel
          </Button>
        </FormActions>
      </FormCard>
    </PageContainer>
  );
}
