import { useEffect, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';
import { subscribeToCommunityPosts } from '../../services/firebase/communityPosts';
import { CommunityPostForm } from './CommunityPostForm';
import type { CommunityPost } from '../../types';

/**
 * Resolves :id from the route to a specific CommunityPost and hands it to
 * the shared form in edit mode. Mirrors
 * ../announcements/EditAnnouncementPage.tsx exactly.
 */
export function EditCommunityPostPage() {
  const { id } = useParams<{ id: string }>();
  const [posts, setPosts] = useState<CommunityPost[] | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToCommunityPosts(
      (next) => setPosts(next),
      () => setPosts([])
    );
    return unsubscribe;
  }, []);

  if (!posts) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }} data-testid="edit-community-post-loading">
        <CircularProgress />
      </Box>
    );
  }

  const post = posts.find((p) => p.id === id);
  if (!post) {
    return <Navigate to="/community" replace />;
  }

  return <CommunityPostForm mode="edit" post={post} />;
}
