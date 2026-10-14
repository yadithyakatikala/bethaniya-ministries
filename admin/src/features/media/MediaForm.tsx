import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Button, Divider, MenuItem, TextField } from '@mui/material';
import {
  createMediaPost,
  updateMediaPost,
  type MediaRecord,
  type MediaType,
} from '../../services/firebase/media';
import { useAuthStore } from '../../store/authStore';
import { parsePublishAt, toDateTimeLocalValue } from '../prophet-verses/validation';
import { useNow } from '../prophet-verses/useNow';
import {
  hasMediaValidationErrors,
  mediaUrlProblem,
  MEDIA_URL_MESSAGES,
  validateMediaInput,
  type MediaValidationErrors,
} from './validation';
import { MediaPreview } from './MediaPreview';
import { AdminPageHeader } from '../../components/AdminPageHeader';
import { DateTimeField, FormActions, FormCard, PageContainer } from '../../components/ui';
import { ImageField, VideoLinkField } from '../../components/media';

/**
 * Create / edit a media post, with a live preview of what a member sees.
 *
 * =====================================================================
 * PICTURES ARE UPLOADED; VIDEO IS A LINK
 * =====================================================================
 * An image post uses <ImageField>: upload a picture (to Cloudinary, with
 * progress and a preview), choose one already in the media library, or
 * paste the https address of one that is already online. Nothing goes to
 * Firebase -- this project has no Cloud Storage bucket -- and the post
 * stores only the resulting https address, exactly as before.
 *
 * A VIDEO post uses <VideoLinkField> and is never uploaded: a sermon is
 * far too large for a free media account, and YouTube already does the
 * hard parts. The field tidies a pasted YouTube address and shows its
 * thumbnail.
 *
 * Either way the address is checked against the same rules the server
 * and the phone apply (./validation.ts), with a sentence that names the
 * actual problem: an administrator who pastes a link they are sure is
 * fine needs to be told it is http rather than "invalid".
 *
 * =====================================================================
 * PUBLISHING IS NOT PART OF THIS FORM
 * =====================================================================
 * A new post always saves as a draft; publishing is a deliberate action
 * on the list, with its own audit entry. That is the same shape as
 * ../prophet-verses and ../community, and it is what stops a
 * half-finished post going live because somebody pressed Save.
 * `publishAt` here is the SCHEDULE -- when a published post becomes
 * visible -- which is a different decision, and the hint says which.
 */
interface MediaFormProps {
  mode: 'create' | 'edit';
  /** Required when mode === 'edit'. */
  post?: MediaRecord;
}

const MEDIA_TYPES: { value: MediaType; label: string; hint: string }[] = [
  { value: 'image', label: 'Image', hint: 'A photograph or a graphic.' },
  {
    value: 'video',
    label: 'Video',
    hint: 'A YouTube link plays in the app. Any other link is shown as a picture.',
  },
];

export function MediaForm({ mode, post }: MediaFormProps) {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  const [type, setType] = useState<MediaType>(post?.type ?? 'image');
  const [mediaUrl, setMediaUrl] = useState(post?.mediaUrl ?? '');
  const [caption, setCaption] = useState(post?.caption ?? '');
  const [verseReference, setVerseReference] = useState(post?.verseReference ?? '');
  const [verseText, setVerseText] = useState(post?.verseText ?? '');
  const [publishAt, setPublishAt] = useState(
    post?.publishAt
      ? toDateTimeLocalValue(post.publishAt)
      : toDateTimeLocalValue(new Date())
  );
  const [errors, setErrors] = useState<MediaValidationErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitError(null);

    const next = validateMediaInput({
      mediaUrl,
      caption,
      verseReference,
      verseText,
      publishAt,
    });
    setErrors(next);
    if (hasMediaValidationErrors(next) || uploading) return;

    const parsedPublishAt = parsePublishAt(publishAt);
    if (!parsedPublishAt) {
      setErrors({ publishAt: 'That date and time could not be read.' });
      return;
    }

    setSubmitting(true);
    try {
      const input = {
        type,
        mediaUrl,
        caption,
        verseReference: verseReference.trim() ? verseReference : null,
        verseText: verseText.trim() ? verseText : null,
        // Never flipped by an edit: publishing is the list's action.
        published: mode === 'edit' ? (post?.published ?? false) : false,
        publishAt: parsedPublishAt,
        // Denormalized onto the post, because firestore.rules does not
        // let a member read another member's profile -- a lookup at read
        // time would not merely be slow, it would be denied. See
        // mobile/src/services/firebase/media.ts.
        authorName: post?.authorName || (user?.displayName ?? ''),
        authorUid: post?.authorUid || (user?.uid ?? ''),
      };
      if (mode === 'create') {
        await createMediaPost(input);
      } else if (post) {
        await updateMediaPost(post.id, input);
      }
      navigate('/media');
    } catch {
      setSubmitError('Could not save. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  // Through ../prophet-verses/useNow.ts rather than `new Date()` in the
  // render: reading the clock while rendering is impure, and a form left
  // open across the scheduled moment should stop calling it "scheduled".
  const now = useNow();
  const parsedForHint = parsePublishAt(publishAt);
  const scheduledForFuture =
    parsedForHint !== null && parsedForHint.getTime() > now.getTime();

  // Live, so a bad paste is caught before Save rather than after it.
  const liveUrlProblem = mediaUrl.trim().length > 0 ? mediaUrlProblem(mediaUrl) : null;
  const addressError =
    errors.mediaUrl ?? (liveUrlProblem ? MEDIA_URL_MESSAGES[liveUrlProblem] : undefined);

  return (
    <PageContainer width="narrow" testId="media-form-page">
      <AdminPageHeader
        title={mode === 'create' ? 'New media post' : 'Edit media post'}
        breadcrumbs={[
          { label: 'Media', to: '/media' },
          { label: mode === 'create' ? 'New' : 'Edit' },
        ]}
      />
      <FormCard onSubmit={(event) => void handleSubmit(event)}>
        {submitError ? (
          <Alert severity="error" sx={{ mb: 2 }} data-testid="media-form-error">
            {submitError}
          </Alert>
        ) : null}

        <TextField
          select
          label="Type"
          fullWidth
          margin="normal"
          value={type}
          onChange={(event) => setType(event.target.value as MediaType)}
          helperText={MEDIA_TYPES.find((option) => option.value === type)?.hint}
          slotProps={{ htmlInput: { 'data-testid': 'media-type-input' } }}
        >
          {MEDIA_TYPES.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </TextField>

        {type === 'image' ? (
          <ImageField
            label="Picture"
            value={mediaUrl.trim() ? mediaUrl : null}
            onChange={(url) => setMediaUrl(url ?? '')}
            category="general"
            testIdPrefix="media-image"
            error={addressError}
            onBusyChange={setUploading}
          />
        ) : (
          <VideoLinkField
            label="Video"
            value={mediaUrl}
            onChange={setMediaUrl}
            testIdPrefix="media-video"
            error={addressError}
          />
        )}

        <TextField
          label="Caption"
          fullWidth
          multiline
          minRows={3}
          margin="normal"
          value={caption}
          onChange={(event) => setCaption(event.target.value)}
          error={Boolean(errors.caption)}
          helperText={errors.caption ?? 'What this post says. Required.'}
          slotProps={{ htmlInput: { 'data-testid': 'media-caption-input' } }}
        />

        <TextField
          label="Verse reference (optional)"
          fullWidth
          margin="normal"
          value={verseReference}
          onChange={(event) => setVerseReference(event.target.value)}
          error={Boolean(errors.verseReference)}
          helperText={errors.verseReference ?? 'For example, John 3:16.'}
          slotProps={{ htmlInput: { 'data-testid': 'media-verse-reference-input' } }}
        />

        <TextField
          label="Verse text (optional)"
          fullWidth
          multiline
          minRows={2}
          margin="normal"
          value={verseText}
          onChange={(event) => setVerseText(event.target.value)}
          error={Boolean(errors.verseText)}
          helperText={errors.verseText ?? 'Leave empty to show the reference on its own.'}
          slotProps={{ htmlInput: { 'data-testid': 'media-verse-text-input' } }}
        />

        <DateTimeField
          label="Show from"
          value={publishAt}
          onChange={setPublishAt}
          error={Boolean(errors.publishAt)}
          helperText={
            errors.publishAt ??
            (scheduledForFuture
              ? 'Scheduled: once published, members will see it from this moment.'
              : 'Members will see it as soon as it is published.')
          }
          testId="media-publish-at-input"
        />

        {mode === 'create' ? (
          <Alert severity="info" sx={{ mt: 2 }} data-testid="media-unpublished-note">
            Saved as a draft. Publish it from the list when it is ready.
          </Alert>
        ) : null}

        <Divider sx={{ my: 3 }} />
        <MediaPreview
          type={type}
          mediaUrl={mediaUrl}
          caption={caption}
          verseReference={verseReference}
          verseText={verseText}
        />

        <FormActions>
          <Button
            type="submit"
            variant="contained"
            disabled={submitting || uploading}
            data-testid="media-form-submit"
          >
            {submitting ? 'Saving…' : 'Save'}
          </Button>
          <Button
            onClick={() => navigate('/media')}
            disabled={submitting}
            data-testid="media-form-cancel"
          >
            Cancel
          </Button>
        </FormActions>
      </FormCard>
    </PageContainer>
  );
}
