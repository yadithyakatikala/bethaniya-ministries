import { useEffect, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';
import { subscribeToSongs } from '../../services/firebase/songs';
import { SongForm } from './SongForm';
import type { Song } from '../../types';

/**
 * Resolves :id from the route to a specific Song and hands it to the
 * shared form in edit mode. Reuses subscribeToSongs() (the same
 * real-time list the list page uses) rather than adding a separate
 * one-shot getDoc data-access pattern, mirroring EditAnnouncementPage.tsx.
 */
export function EditSongPage() {
  const { id } = useParams<{ id: string }>();
  const [songs, setSongs] = useState<Song[] | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToSongs(
      (next) => setSongs(next),
      () => setSongs([])
    );
    return unsubscribe;
  }, []);

  if (!songs) {
    return (
      <Box
        sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}
        data-testid="edit-song-loading"
      >
        <CircularProgress />
      </Box>
    );
  }

  const song = songs.find((s) => s.id === id);
  if (!song) {
    return <Navigate to="/songs" replace />;
  }

  return <SongForm mode="edit" song={song} />;
}
