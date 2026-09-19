import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Divider,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  createProphetVerse,
  updateProphetVerse,
  type ProphetVerseRecord,
} from '../../services/firebase/prophetVerses';
import {
  hasProphetVerseErrors,
  isSafeImageUrl,
  parsePublishAt,
  toDateTimeLocalValue,
  validateProphetVerseInput,
  type ProphetVerseValidationErrors,
} from './validation';
import { useNow } from './useNow';

/**
 * Create / edit a Prophet Verse, with a live preview of what a member
 * will see.
 *
 * ---------------------------------------------------------------------
 * NO IMAGE UPLOAD, BY DESIGN
 * ---------------------------------------------------------------------
 * The image field takes an https web ADDRESS, not a file. There is no
 * Cloud Storage bucket on this project's plan (see
 * ../../services/firebase/prophetVerses.ts), so an upload control here
 * would be a button that always fails -- the same reason song audio is a
 * url. The field is optional, and a verse with no image is a complete
 * verse, not an unfinished one.
 *
 * ---------------------------------------------------------------------
 * PUBLISHING IS NOT PART OF THIS FORM
 * ---------------------------------------------------------------------
 * A new record always starts unpublished; publishing is a deliberate
 * action on the list page, with its own audit-log entry. Same shape as
 * ../community/CommunityPostForm.tsx. `publishAt` here is the SCHEDULE --
 * when a published record becomes visible -- which is a different
 * decision from whether it is published at all, and the preview says so.
 */
interface ProphetVerseFormProps {
  mode: 'create' | 'edit';
  /** Required when mode === 'edit'. */
  verse?: ProphetVerseRecord;
}

/** Default schedule for a new record: now, i.e. visible as soon as it is published. */
function defaultPublishAt(): string {
  return toDateTimeLocalValue(new Date());
}

export function ProphetVerseForm({ mode, verse }: ProphetVerseFormProps) {
  const navigate = useNavigate();
  const [title, setTitle] = useState(verse?.title ?? '');
  const [reference, setReference] = useState(verse?.reference ?? '');
  const [text, setText] = useState(verse?.text ?? '');
  const [attribution, setAttribution] = useState(verse?.attribution ?? '');
  const [imageUrl, setImageUrl] = useState(verse?.imageUrl ?? '');
  const [publishAt, setPublishAt] = useState(
    verse?.publishAt ? toDateTimeLocalValue(verse.publishAt) : defaultPublishAt()
  );
  const [errors, setErrors] = useState<ProphetVerseValidationErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitError(null);

    const next = validateProphetVerseInput({
      title,
      reference,
      text,
      attribution,
      imageUrl,
      publishAt,
    });
    setErrors(next);
    if (hasProphetVerseErrors(next)) return;

    const parsedPublishAt = parsePublishAt(publishAt);
    if (!parsedPublishAt) {
      setErrors({ publishAt: 'Publish date and time must be valid.' });
      return;
    }

    setSubmitting(true);
    try {
      const input = {
        title,
        reference,
        text,
        attribution: attribution.trim() ? attribution : null,
        imageUrl: imageUrl.trim() ? imageUrl : null,
        // Never flipped by an edit: publishing is the list page's action.
        published: mode === 'edit' ? (verse?.published ?? false) : false,
        publishAt: parsedPublishAt,
      };
      if (mode === 'create') {
        await createProphetVerse(input);
      } else if (verse) {
        await updateProphetVerse(verse.id, input);
      }
      navigate('/prophet-verses');
    } catch {
      setSubmitError('Could not save. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  // Through ./useNow.ts rather than `Date.now()` in the render: reading
  // the clock while rendering is impure, and a form left open across the
  // scheduled moment should stop calling it "scheduled".
  const now = useNow();
  const parsedPublishAtForHint = parsePublishAt(publishAt);
  const scheduledForFuture =
    parsedPublishAtForHint !== null && parsedPublishAtForHint.getTime() > now.getTime();

  return (
    <Box sx={{ p: 4, maxWidth: 720 }} data-testid="prophet-verse-form-page">
      <Paper
        sx={{ p: 4 }}
        component="form"
        onSubmit={(event) => void handleSubmit(event)}
      >
        <Typography variant="h5" component="h1" gutterBottom>
          {mode === 'create' ? 'New Prophet Verse' : 'Edit Prophet Verse'}
        </Typography>

        {submitError ? (
          <Alert severity="error" sx={{ mb: 2 }} data-testid="prophet-verse-form-error">
            {submitError}
          </Alert>
        ) : null}

        <TextField
          label="Title"
          fullWidth
          margin="normal"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          error={Boolean(errors.title)}
          helperText={errors.title}
          slotProps={{ htmlInput: { 'data-testid': 'prophet-verse-title-input' } }}
        />

        <TextField
          label="Scripture reference"
          fullWidth
          margin="normal"
          value={reference}
          onChange={(event) => setReference(event.target.value)}
          error={Boolean(errors.reference)}
          helperText={errors.reference ?? 'For example, Isaiah 43:19.'}
          slotProps={{ htmlInput: { 'data-testid': 'prophet-verse-reference-input' } }}
        />

        <TextField
          label="Text"
          fullWidth
          multiline
          minRows={5}
          margin="normal"
          value={text}
          onChange={(event) => setText(event.target.value)}
          error={Boolean(errors.text)}
          helperText={errors.text}
          slotProps={{ htmlInput: { 'data-testid': 'prophet-verse-text-input' } }}
        />

        <TextField
          label="Attribution (optional)"
          fullWidth
          margin="normal"
          value={attribution}
          onChange={(event) => setAttribution(event.target.value)}
          error={Boolean(errors.attribution)}
          helperText={
            errors.attribution ?? 'Who this came through, if you want it shown.'
          }
          slotProps={{ htmlInput: { 'data-testid': 'prophet-verse-attribution-input' } }}
        />

        <TextField
          label="Image address (optional)"
          fullWidth
          margin="normal"
          value={imageUrl}
          onChange={(event) => setImageUrl(event.target.value)}
          error={Boolean(errors.imageUrl)}
          helperText={
            errors.imageUrl ??
            'A full https:// address of an image already on the web. There is no upload — the app loads the address directly.'
          }
          slotProps={{ htmlInput: { 'data-testid': 'prophet-verse-image-url-input' } }}
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
            htmlInput: { 'data-testid': 'prophet-verse-publish-at-input' },
          }}
        />

        {mode === 'create' ? (
          <Alert
            severity="info"
            sx={{ mt: 2 }}
            data-testid="prophet-verse-unpublished-note"
          >
            Saved as a draft. Publish it from the list when it is ready.
          </Alert>
        ) : null}

        <Divider sx={{ my: 3 }} />
        <ProphetVersePreview
          title={title}
          reference={reference}
          text={text}
          attribution={attribution}
          imageUrl={imageUrl}
        />

        <Stack direction="row" spacing={2} sx={{ mt: 3 }}>
          <Button
            type="submit"
            variant="contained"
            disabled={submitting}
            data-testid="prophet-verse-form-submit"
          >
            {submitting ? 'Saving…' : 'Save'}
          </Button>
          <Button
            onClick={() => navigate('/prophet-verses')}
            disabled={submitting}
            data-testid="prophet-verse-form-cancel"
          >
            Cancel
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}

/**
 * What a member will see, laid out the way the app lays it out.
 *
 * Deliberately plain: this is a legibility check on the administrator's
 * own words, not a phone mock-up. It renders the image only when the
 * address is a valid https one, so a half-typed address shows nothing
 * rather than a broken-image icon -- and an invalid one is already
 * flagged on the field itself.
 */
export function ProphetVersePreview({
  title,
  reference,
  text,
  attribution,
  imageUrl,
}: {
  title: string;
  reference: string;
  text: string;
  attribution: string;
  imageUrl: string;
}) {
  const showImage = imageUrl.trim().length > 0 && isSafeImageUrl(imageUrl.trim());

  return (
    <Box data-testid="prophet-verse-preview">
      <Typography variant="overline" color="text.secondary">
        Preview
      </Typography>
      <Paper variant="outlined" sx={{ borderRadius: 3, p: 3, mt: 1 }}>
        {showImage ? (
          <Box
            component="img"
            src={imageUrl.trim()}
            alt=""
            data-testid="prophet-verse-preview-image"
            sx={{
              width: '100%',
              aspectRatio: '3 / 2',
              objectFit: 'cover',
              borderRadius: 2,
              mb: 2,
              display: 'block',
            }}
          />
        ) : null}
        <Typography variant="overline" color="text.secondary">
          Prophet Verse
        </Typography>
        <Typography variant="h6" component="p" data-testid="prophet-verse-preview-title">
          {title.trim() || 'Untitled'}
        </Typography>
        {reference.trim() ? (
          <Typography
            color="primary"
            sx={{ fontSize: 14, mb: 1 }}
            data-testid="prophet-verse-preview-reference"
          >
            {reference.trim()}
          </Typography>
        ) : null}
        <Typography
          sx={{ whiteSpace: 'pre-wrap' }}
          data-testid="prophet-verse-preview-text"
        >
          {text.trim() || 'The text will appear here.'}
        </Typography>
        {attribution.trim() ? (
          <Typography
            color="text.secondary"
            sx={{ fontSize: 13, mt: 1.5 }}
            data-testid="prophet-verse-preview-attribution"
          >
            {attribution.trim()}
          </Typography>
        ) : null}
      </Paper>
    </Box>
  );
}
