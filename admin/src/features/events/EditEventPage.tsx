import { useEffect, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';
import { subscribeToEvents } from '../../services/firebase/events';
import { EventForm } from './EventForm';
import type { Event } from '../../types';

/**
 * Resolves :id from the route to a specific Event and hands it to the
 * shared form in edit mode. Reuses subscribeToEvents() (the same
 * real-time list the list page uses) rather than adding a separate
 * one-shot getDoc data-access pattern, mirroring EditSongPage.tsx.
 */
export function EditEventPage() {
  const { id } = useParams<{ id: string }>();
  const [events, setEvents] = useState<Event[] | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToEvents(
      (next) => setEvents(next),
      () => setEvents([])
    );
    return unsubscribe;
  }, []);

  if (!events) {
    return (
      <Box
        sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}
        data-testid="edit-event-loading"
      >
        <CircularProgress />
      </Box>
    );
  }

  const event = events.find((e) => e.id === id);
  if (!event) {
    return <Navigate to="/events" replace />;
  }

  return <EventForm mode="edit" event={event} />;
}
