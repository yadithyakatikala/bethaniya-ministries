import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Divider,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
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
  validateMediaInput,
  type MediaValidationErrors,
} from './validation';
import { MediaPreview } from './MediaPreview';

/**
 * Create / edit a media post, with a live preview of what a member sees.
 *
 * =====================================================================
 * THE LINK FIELD IS NOT AN UPLOAD, AND SAYS SO
 * =====================================================================
 * There is no file picker here and there must not be. This project has
 * no Cloud Storage bucket (see ../../services/firebase/media.ts), so an
 * upload control would be a button that always fails. The field takes an
 * https web ADDRESS of something already online -- the same decision song
 * audio and the Prophet Verse image already made -- and the helper text
 * says that plainly, so nobody goes looking for the upload button.
 *
 * The address is validated as it is typed, with a sentence that names
 * the actual problem: an administrator who pastes a link they are sure
 * is fine needs to be told it is http rather than "invalid".
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
    if (hasMediaValidationErrors(next)) return;

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

  return (
    <Box sx={{ p: 4, maxWidth: 720 }} data-testid="media-form-page">
      <Paper
        sx={{ p: 4 }}
        component="form"
        onSubmit={(event) => void handleSubmit(event)}
      >
        <Typography variant="h5" component="h1" gutterBottom>
          {mode === 'create' ? 'New media post' : 'Edit media post'}
        </Typography>

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

        <TextField
          label="Media address"
          fullWidth
          margin="normal"
          value={mediaUrl}
          onChange={(event) => setMediaUrl(event.target.value)}
          error={Boolean(errors.mediaUrl ?? liveUrlProblem)}
          helperText={
            errors.mediaUrl ??
            (liveUrlProblem
              ? 'This address cannot be used — see the message after you save.'
              : 'A full https:// address of an image or video already on the web. There is no upload: the app loads this address directly.')
          }
          slotProps={{ htmlInput: { 'data-testid': 'media-url-input' } }}
        />

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

        <TextField
          label="Show from"
          type="datetime-local"
          fullWidth
          margin="normal"
          value={publishAt}
          onChange={(event) => setPublishAt(event.target.value)}
          error={Boolean(errors.publishAt)}
          helperText={
            errors.publishAt ??
            (scheduledForFuture
              ? 'Scheduled: once published, members will see it from this moment.'
              : 'Members will see it as soon as it is published.')
          }
          slotProps={{
            inputLabel: { shrink: true },
            htmlInput: { 'data-testid': 'media-publish-at-input' },
          }}
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

        <Stack direction="row" spacing={2} sx={{ mt: 3 }}>
          <Button
            type="submit"
            variant="contained"
            disabled={submitting}
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
        </Stack>
      </Paper>
    </Box>
  );
}
