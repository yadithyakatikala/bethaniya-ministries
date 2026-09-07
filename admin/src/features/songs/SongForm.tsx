import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Box, Button, Paper, TextField, Typography } from '@mui/material';
import {
  createSong,
  updateSong,
  uploadSongCoverImage,
} from '../../services/firebase/songs';
import {
  hasValidationErrors,
  validateSongCoverImage,
  validateSongInput,
} from './validation';
import type { Song } from '../../types';

interface SongFormProps {
  mode: 'create' | 'edit';
  /** Required when mode === 'edit'. */
  song?: Song;
}

/**
 * Shared create/edit form -- per FINAL_ARCHITECTURE_SPECIFICATION.md's Day 6
 * plan, this collects title + artist + category + lyrics + an external
 * audio URL + an optional cover image. Song audio is always an external
 * URL (per storage.rules' own doc comment: "no audio files in Storage;
 * song audio is referenced by external URL") -- there is no audio file
 * upload control here, only a URL text field. The publish/unpublish
 * toggle is a separate list-page action (SongsListPage.tsx), not part of
 * this form -- a new song always starts unpublished, per createSong()'s
 * own contract, mirroring AnnouncementForm.tsx.
 */
export function SongForm({ mode, song }: SongFormProps) {
  const navigate = useNavigate();
  const [title, setTitle] = useState(song?.title ?? '');
  const [artist, setArtist] = useState(song?.artist ?? '');
  const [category, setCategory] = useState(song?.category ?? '');
  const [lyrics, setLyrics] = useState(song?.lyrics ?? '');
  const [audioUrl, setAudioUrl] = useState(song?.audioUrl ?? '');
  const [coverUrl] = useState<string | null>(song?.coverUrl ?? null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverError, setCoverError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    title?: string;
    artist?: string;
    category?: string;
    lyrics?: string;
    audioUrl?: string;
  }>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function handleCoverChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    if (!file) {
      setCoverFile(null);
      setCoverError(null);
      return;
    }
    const error = validateSongCoverImage(file);
    if (error) {
      setCoverError(error);
      setCoverFile(null);
      return;
    }
    setCoverError(null);
    setCoverFile(file);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitError(null);

    const errors = validateSongInput({ title, artist, category, lyrics, audioUrl });
    setFieldErrors(errors);
    if (hasValidationErrors(errors) || coverError) return;

    setSubmitting(true);
    try {
      let resolvedCoverUrl = coverUrl;
      if (coverFile) {
        resolvedCoverUrl = await uploadSongCoverImage(coverFile);
      }

      if (mode === 'create') {
        await createSong({
          title,
          artist,
          category,
          lyrics,
          audioUrl,
          coverUrl: resolvedCoverUrl,
        });
      } else if (song) {
        await updateSong(song.id, {
          title,
          artist,
          category,
          lyrics,
          audioUrl,
          coverUrl: resolvedCoverUrl,
        });
      }
      navigate('/songs');
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
          {mode === 'create' ? 'New Song' : 'Edit Song'}
        </Typography>

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
        <TextField
          label="Audio URL"
          fullWidth
          margin="normal"
          value={audioUrl}
          onChange={(e) => setAudioUrl(e.target.value)}
          error={Boolean(fieldErrors.audioUrl)}
          helperText={
            fieldErrors.audioUrl ??
            'Direct link to a playable audio file or stream (e.g. .mp3, .m4a, .wav, or an HLS .m3u8 URL), hosted elsewhere -- audio files are not uploaded to this app. A YouTube or Spotify page link will not play; those are webpages, not direct audio files.'
          }
          slotProps={{ htmlInput: { 'data-testid': 'song-audio-url-input' } }}
        />

        <Box sx={{ mt: 2, mb: 1 }}>
          <Typography variant="body2" gutterBottom>
            Cover image (optional)
          </Typography>
          <input
            type="file"
            accept="image/*"
            onChange={handleCoverChange}
            data-testid="song-cover-input"
          />
          {coverError ? (
            <Typography variant="body2" color="error" data-testid="song-cover-error">
              {coverError}
            </Typography>
          ) : null}
          {coverUrl && !coverFile ? (
            <Typography variant="body2" color="text.secondary">
              Current cover image is set. Choose a new file to replace it.
            </Typography>
          ) : null}
        </Box>

        <Button
          type="submit"
          variant="contained"
          sx={{ mt: 2 }}
          disabled={submitting}
          data-testid="song-form-submit"
        >
          {mode === 'create' ? 'Create' : 'Save changes'}
        </Button>
        <Button
          sx={{ mt: 2, ml: 1 }}
          onClick={() => navigate('/songs')}
          data-testid="song-form-cancel"
        >
          Cancel
        </Button>
      </Paper>
    </Box>
  );
}
