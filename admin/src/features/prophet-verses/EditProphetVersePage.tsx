import { useEffect, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';
import {
  subscribeToProphetVerses,
  type ProphetVerseRecord,
} from '../../services/firebase/prophetVerses';
import { ProphetVerseForm } from './ProphetVerseForm';

/**
 * Resolves :id from the route to a specific Prophet Verse and hands it to
 * the shared form in edit mode. Mirrors
 * ../community/EditCommunityPostPage.tsx exactly.
 */
export function EditProphetVersePage() {
  const { id } = useParams<{ id: string }>();
  const [verses, setVerses] = useState<ProphetVerseRecord[] | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToProphetVerses(
      (next) => setVerses(next),
      () => setVerses([])
    );
    return unsubscribe;
  }, []);

  if (!verses) {
    return (
      <Box
        sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}
        data-testid="edit-prophet-verse-loading"
      >
        <CircularProgress />
      </Box>
    );
  }

  const verse = verses.find((candidate) => candidate.id === id);
  if (!verse) {
    return <Navigate to="/prophet-verses" replace />;
  }

  return <ProphetVerseForm mode="edit" verse={verse} />;
}
