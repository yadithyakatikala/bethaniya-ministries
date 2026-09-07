import { useEffect } from 'react';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { theme } from './theme/theme';
import { LoginPage } from './features/auth/LoginPage';
import { DashboardPage } from './features/auth/DashboardPage';
import { AnnouncementsListPage } from './features/announcements/AnnouncementsListPage';
import { AnnouncementForm } from './features/announcements/AnnouncementForm';
import { EditAnnouncementPage } from './features/announcements/EditAnnouncementPage';
import { DailyVersesListPage } from './features/daily-verses/DailyVersesListPage';
import { DailyVerseForm } from './features/daily-verses/DailyVerseForm';
import { EditDailyVersePage } from './features/daily-verses/EditDailyVersePage';
import { SongsListPage } from './features/songs/SongsListPage';
import { SongForm } from './features/songs/SongForm';
import { EditSongPage } from './features/songs/EditSongPage';
import { EventsListPage } from './features/events/EventsListPage';
import { EventForm } from './features/events/EventForm';
import { EditEventPage } from './features/events/EditEventPage';
import { NotificationsPage } from './features/notifications/NotificationsPage';
import { ProtectedRoute } from './routes/ProtectedRoute';
import { subscribeToAuthChanges } from './store/authStore';

/**
 * Root component.
 *
 * Day 1 built the static placeholder scaffold; Day 2 adds the real
 * authentication foundation (see store/authStore.ts): /login for
 * email/password sign-in, and / behind ProtectedRoute for the dashboard
 * shell, gated on the real Firebase Auth + role state instead of always
 * rendering unconditionally. Day 4 adds /announcements* (also behind
 * ProtectedRoute -- the same authenticated/authorized boundary applies to
 * every admin screen, not just the dashboard shell; write actions within
 * those screens are further gated by role, see AnnouncementsListPage.tsx).
 * Day 5 adds /daily-verses* the same way (see DailyVersesListPage.tsx).
 * Day 6 adds /songs* the same way (see SongsListPage.tsx) -- songs has the
 * same publish-concept RBAC shape as announcements, unlike daily_verses.
 * Day 7 adds /events* the same way (see EventsListPage.tsx) -- events adds
 * a second, narrower write surface for the Host role (live-stream fields
 * only), on top of the same publish-concept shape.
 * Day 10 adds /notifications (see NotificationsPage.tsx) -- a single page,
 * not a list/new/edit trio like the others, since composing and sending is
 * a one-shot action rather than CRUD on persistent editable documents.
 */
function App() {
  useEffect(() => subscribeToAuthChanges(), []);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/announcements"
            element={
              <ProtectedRoute>
                <AnnouncementsListPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/announcements/new"
            element={
              <ProtectedRoute>
                <AnnouncementForm mode="create" />
              </ProtectedRoute>
            }
          />
          <Route
            path="/announcements/:id/edit"
            element={
              <ProtectedRoute>
                <EditAnnouncementPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/daily-verses"
            element={
              <ProtectedRoute>
                <DailyVersesListPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/daily-verses/new"
            element={
              <ProtectedRoute>
                <DailyVerseForm mode="create" />
              </ProtectedRoute>
            }
          />
          <Route
            path="/daily-verses/:id/edit"
            element={
              <ProtectedRoute>
                <EditDailyVersePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/songs"
            element={
              <ProtectedRoute>
                <SongsListPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/songs/new"
            element={
              <ProtectedRoute>
                <SongForm mode="create" />
              </ProtectedRoute>
            }
          />
          <Route
            path="/songs/:id/edit"
            element={
              <ProtectedRoute>
                <EditSongPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/events"
            element={
              <ProtectedRoute>
                <EventsListPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/events/new"
            element={
              <ProtectedRoute>
                <EventForm mode="create" />
              </ProtectedRoute>
            }
          />
          <Route
            path="/events/:id/edit"
            element={
              <ProtectedRoute>
                <EditEventPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/notifications"
            element={
              <ProtectedRoute>
                <NotificationsPage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
