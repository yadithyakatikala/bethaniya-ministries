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
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
