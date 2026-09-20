import { useEffect, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';
import { subscribeToMedia, type MediaRecord } from '../../services/firebase/media';
import { MediaForm } from './MediaForm';

/**
 * Resolves :id from the route to a specific media post and hands it to
 * the shared form in edit mode. Mirrors
 * ../prophet-verses/EditProphetVersePage.tsx exactly.
 */
export function EditMediaPage() {
  const { id } = useParams<{ id: string }>();
  const [posts, setPosts] = useState<MediaRecord[] | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToMedia(
      (next) => setPosts(next),
      () => setPosts([])
    );
    return unsubscribe;
  }, []);

  if (!posts) {
    return (
      <Box
        sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}
        data-testid="edit-media-loading"
      >
        <CircularProgress />
      </Box>
    );
  }

  const post = posts.find((candidate) => candidate.id === id);
  if (!post) {
    return <Navigate to="/media" replace />;
  }

  return <MediaForm mode="edit" post={post} />;
}
