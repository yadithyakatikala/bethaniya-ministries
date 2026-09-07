import { useEffect, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';
import { subscribeToAnnouncements } from '../../services/firebase/announcements';
import { AnnouncementForm } from './AnnouncementForm';
import type { Announcement } from '../../types';

/**
 * Resolves :id from the route to a specific Announcement and hands it to
 * the shared form in edit mode. Reuses subscribeToAnnouncements() (the
 * same real-time list the list page uses) rather than adding a separate
 * one-shot getDoc data-access pattern -- there's no V1-scale reason a
 * second read pattern is needed for this.
 */
export function EditAnnouncementPage() {
  const { id } = useParams<{ id: string }>();
  const [announcements, setAnnouncements] = useState<Announcement[] | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToAnnouncements(
      (next) => setAnnouncements(next),
      () => setAnnouncements([])
    );
    return unsubscribe;
  }, []);

  if (!announcements) {
    return (
      <Box
        sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}
        data-testid="edit-announcement-loading"
      >
        <CircularProgress />
      </Box>
    );
  }

  const announcement = announcements.find((a) => a.id === id);
  if (!announcement) {
    return <Navigate to="/announcements" replace />;
  }

  return <AnnouncementForm mode="edit" announcement={announcement} />;
}
