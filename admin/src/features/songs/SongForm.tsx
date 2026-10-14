import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Button, TextField } from '@mui/material';
import { createSong, updateSong } from '../../services/firebase/songs';
import {
  hasValidationErrors,
  validateSongCoverImage,
  validateSongInput,
} from './validation';
import type { Song } from '../../types';
import { SAVE_RETRY_MESSAGE } from '../../services/firebase/saveErrors';
import { AdminPageHeader } from '../../components/AdminPageHeader';
import { FormActions, FormCard, PageContainer } from '../../components/ui';
import { AudioField, ImageField } from '../../components/media';

interface SongFormProps {
  mode: 'create' | 'edit';
  /** Required when mode === 'edit'. */
  song?: Song;
}

/**
 * Shared create/edit form -- per FINAL_ARCHITECTURE_SPECIFICATION.md's Day 6
 * plan, this collects title + artist + category + lyrics + audio + an
 * optional cover image. The publish/unpublish toggle is a separate
 * list-page action (SongsListPage.tsx), not part of this form -- a new
 * song always starts unpublished, per createSong()'s own contract,
 * mirroring AnnouncementForm.tsx.
 *
 * AUDIO. A song's `audioUrl` is still just an https address -- that is
 * what the phone app plays and what firestore.rules checks. What changed
 * is how the address gets here: <AudioField> uploads an MP3, M4A, AAC or
 * WAV file to Cloudinary (with progress and a player to check it) and
 * fills the address in, or takes one from the media library, or accepts
 * a pasted link (including streams such as HLS, which nothing uploads).
 */
export function SongForm({ mode, song }: SongFormProps) {
  const navigate = useNavigate();
  const [title, setTitle] = useState(song?.title ?? '');
  const [artist, setArtist] = useState(song?.artist ?? '');
  const [category, setCategory] = useState(song?.category ?? '');
  const [lyrics, setLyrics] = useState(song?.lyrics ?? '');
  const [audioUrl, setAudioUrl] = useState(song?.audioUrl ?? '');
  const [coverUrl, setCoverUrl] = useState<string | null>(song?.coverUrl ?? null);
  const [audioBusy, setAudioBusy] = useState(false);
  const [coverBusy, setCoverBusy] = useState(false);
  const uploading = audioBusy || coverBusy;
  const [fieldErrors, setFieldErrors] = useState<{
    title?: string;
    artist?: string;
    category?: string;
    lyrics?: string;
    audioUrl?: string;
  }>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitError(null);

    const errors = validateSongInput({ title, artist, category, lyrics, audioUrl });
    setFieldErrors(errors);
    if (hasValidationErrors(errors) || uploading) return;

    setSubmitting(true);
    try {
      if (mode === 'create') {
        await createSong({ title, artist, category, lyrics, audioUrl, coverUrl });
      } else if (song) {
        await updateSong(song.id, { title, artist, category, lyrics, audioUrl, coverUrl });
      }
      navigate('/songs');
    } catch {
      setSubmitError(SAVE_RETRY_MESSAGE);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PageContainer width="narrow">
      <AdminPageHeader
        title={mode === 'create' ? 'New Song' : 'Edit Song'}
        breadcrumbs={[
          { label: 'Songs', to: '/songs' },
          { label: mode === 'create' ? 'New' : 'Edit' },
        ]}
      />
      <FormCard onSubmit={handleSubmit}>
        {submitError ? (
          <Alert severity="error" sx={{ mb: 2 }} data-testid="song-form-error">
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
          slotProps={{ htmlInput: { 'data-testid': 'song-title-input' } }}
        />
        <TextField
          label="Artist"
          fullWidth
          margin="normal"
          value={artist}
          onChange={(e) => setArtist(e.target.value)}
          error={Boolean(fieldErrors.artist)}
          helperText={fieldErrors.artist}
          slotProps={{ htmlInput: { 'data-testid': 'song-artist-input' } }}
        />
        <TextField
          label="Category"
          fullWidth
          margin="normal"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          error={Boolean(fieldErrors.category)}
          helperText={fieldErrors.category}
          slotProps={{ htmlInput: { 'data-testid': 'song-category-input' } }}
        />
        <TextField
          label="Lyrics"
          fullWidth
          multiline
          minRows={6}
          margin="normal"
          value={lyrics}
          onChange={(e) => setLyrics(e.target.value)}
          error={Boolean(fieldErrors.lyrics)}
          helperText={fieldErrors.lyrics}
          slotProps={{ htmlInput: { 'data-testid': 'song-lyrics-input' } }}
        />

        <AudioField
          label="Audio"
          value={audioUrl}
          onChange={setAudioUrl}
          category="song"
          testIdPrefix="song-audio"
          error={fieldErrors.audioUrl}
          onBusyChange={setAudioBusy}
        />

        <ImageField
          label="Cover image (optional)"
          value={coverUrl}
          onChange={setCoverUrl}
          category="cover"
          testIdPrefix="song-cover"
          validateFile={validateSongCoverImage}
          onBusyChange={setCoverBusy}
        />

        <FormActions>
          <Button
            type="submit"
            variant="contained"
            disabled={submitting || uploading}
            data-testid="song-form-submit"
          >
            {mode === 'create' ? 'Create' : 'Save changes'}
          </Button>
          <Button onClick={() => navigate('/songs')} data-testid="song-form-cancel">
            Cancel
          </Button>
        </FormActions>
      </FormCard>
    </PageContainer>
  );
}
