import { useEffect, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';
import { subscribeToDailyVerses } from '../../services/firebase/dailyVerses';
import { DailyVerseForm } from './DailyVerseForm';
import type { DailyVerse } from '../../types';

/**
 * Resolves :id from the route to a specific DailyVerse and hands it to the
 * shared form in edit mode. Mirrors EditAnnouncementPage.tsx's reasoning
 * for reusing the real-time list subscription rather than a one-shot
 * getDoc.
 */
export function EditDailyVersePage() {
  const { id } = useParams<{ id: string }>();
  const [verses, setVerses] = useState<DailyVerse[] | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToDailyVerses(
      (next) => setVerses(next),
      () => setVerses([])
    );
    return unsubscribe;
  }, []);

  if (!verses) {
    return (
      <Box
        sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}
        data-testid="edit-daily-verse-loading"
      >
        <CircularProgress />
      </Box>
    );
  }

  const verse = verses.find((v) => v.id === id);
  if (!verse) {
    return <Navigate to="/daily-verses" replace />;
  }

  return <DailyVerseForm mode="edit" verse={verse} />;
}
