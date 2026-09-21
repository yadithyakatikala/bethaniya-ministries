import { useEffect } from 'react';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { theme } from './theme/theme';
import { AdminLayout } from './components/AdminLayout';
import { LoginPage } from './features/auth/LoginPage';
import { DashboardPage } from './features/auth/DashboardPage';
import { AnnouncementsListPage } from './features/announcements/AnnouncementsListPage';
import { AnnouncementForm } from './features/announcements/AnnouncementForm';
import { EditAnnouncementPage } from './features/announcements/EditAnnouncementPage';
import { CommunityPostsListPage } from './features/community/CommunityPostsListPage';
import { CommunityPostForm } from './features/community/CommunityPostForm';
import { EditCommunityPostPage } from './features/community/EditCommunityPostPage';
import { PlansListPage } from './features/plans/PlansListPage';
import { PlanForm } from './features/plans/PlanForm';
import { EditPlanPage } from './features/plans/EditPlanPage';
import { PlanDaysPage } from './features/plans/PlanDaysPage';
import { PlanDayForm } from './features/plans/PlanDayForm';
import { EditPlanDayPage } from './features/plans/EditPlanDayPage';
import { VerseOfTheDayPage } from './features/daily-verses/VerseOfTheDayPage';
import { DailyVerseForm } from './features/daily-verses/DailyVerseForm';
import { EditDailyVersePage } from './features/daily-verses/EditDailyVersePage';
import { ProphetVersesListPage } from './features/prophet-verses/ProphetVersesListPage';
import { ProphetVerseForm } from './features/prophet-verses/ProphetVerseForm';
import { EditProphetVersePage } from './features/prophet-verses/EditProphetVersePage';
import { MediaListPage } from './features/media/MediaListPage';
import { MediaForm } from './features/media/MediaForm';
import { EditMediaPage } from './features/media/EditMediaPage';
import { SongsListPage } from './features/songs/SongsListPage';
import { SongForm } from './features/songs/SongForm';
import { EditSongPage } from './features/songs/EditSongPage';
import { EventsListPage } from './features/events/EventsListPage';
import { EventForm } from './features/events/EventForm';
import { EditEventPage } from './features/events/EditEventPage';
import { NotificationsPage } from './features/notifications/NotificationsPage';
import { ReportsPage } from './features/moderation/ReportsPage';
import { UsersPage } from './features/users/UsersPage';
import { SettingsPage } from './features/settings/SettingsPage';
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
 * Day 5 adds /daily-verses* the same way (see VerseOfTheDayPage.tsx).
 * Day 6 adds /songs* the same way (see SongsListPage.tsx) -- songs has the
 * same publish-concept RBAC shape as announcements, unlike daily_verses.
 * Day 7 adds /events* the same way (see EventsListPage.tsx) -- events adds
 * a second, narrower write surface for the Host role (live-stream fields
 * only), on top of the same publish-concept shape.
 * Day 10 adds /notifications (see NotificationsPage.tsx) -- a single page,
 * not a list/new/edit trio like the others, since composing and sending is
 * a one-shot action rather than CRUD on persistent editable documents.
 * Day 11 adds /users (see UsersPage.tsx) -- also a single page (a table
 * with an inline role selector per row), Super-Admin-only.
 * M5 added /daily-verses/automation (the Verse of the Day rotation and
 * its pool) and /prophet-verses* (a separate content system with its own
 * list/new/edit trio -- see ProphetVersesListPage.tsx). Prophet verses
 * get a top-level path because they are not daily verses at all.
 *
 * The automation route is now a REDIRECT. It sat under /daily-verses
 * because it configured the same feature -- which turned out to be the
 * argument against its existing at all: two sidebar entries for one
 * feature left a church administrator unable to tell which of them the
 * congregation was reading. /daily-verses is a single tabbed page (see
 * VerseOfTheDayPage.tsx), and the old path lands on it so that anything
 * bookmarked still works.
 * Day 13 adds /settings (see SettingsPage.tsx) -- also a single page,
 * viewable by every dashboard role but editable Super-Admin-only (see
 * that file's own doc comment for the RBAC reasoning) -- and wraps every
 * route below in AdminLayout (see that file), the "Sidebar navigation,
 * responsive layout" refinement Day 13 also calls for. AdminLayout only
 * ever renders inside ProtectedRoute's authenticated+authorized branch,
 * so /login and the "Access denied" state never show a sidebar.
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
                <AdminLayout>
                  <DashboardPage />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/announcements"
            element={
              <ProtectedRoute>
                <AdminLayout>
                  <AnnouncementsListPage />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/announcements/new"
            element={
              <ProtectedRoute>
                <AdminLayout>
                  <AnnouncementForm mode="create" />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/announcements/:id/edit"
            element={
              <ProtectedRoute>
                <AdminLayout>
                  <EditAnnouncementPage />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/community"
            element={
              <ProtectedRoute>
                <AdminLayout>
                  <CommunityPostsListPage />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/community/new"
            element={
              <ProtectedRoute>
                <AdminLayout>
                  <CommunityPostForm mode="create" />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/community/:id/edit"
            element={
              <ProtectedRoute>
                <AdminLayout>
                  <EditCommunityPostPage />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/plans"
            element={
              <ProtectedRoute>
                <AdminLayout>
                  <PlansListPage />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/plans/new"
            element={
              <ProtectedRoute>
                <AdminLayout>
                  <PlanForm mode="create" />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/plans/:id/edit"
            element={
              <ProtectedRoute>
                <AdminLayout>
                  <EditPlanPage />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/plans/:planId/days"
            element={
              <ProtectedRoute>
                <AdminLayout>
                  <PlanDaysPage />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/plans/:planId/days/new"
            element={
              <ProtectedRoute>
                <AdminLayout>
                  <PlanDayForm mode="create" />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/plans/:planId/days/:dayId/edit"
            element={
              <ProtectedRoute>
                <AdminLayout>
                  <EditPlanDayPage />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/daily-verses"
            element={
              <ProtectedRoute>
                <AdminLayout>
                  <VerseOfTheDayPage />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/daily-verses/new"
            element={
              <ProtectedRoute>
                <AdminLayout>
                  <DailyVerseForm mode="create" />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/daily-verses/:id/edit"
            element={
              <ProtectedRoute>
                <AdminLayout>
                  <EditDailyVersePage />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          {/* The Verse of the Day is one page now. This path was its
              "Verse Automation" half and may well be bookmarked, so it
              still resolves -- to the tab it used to be. */}
          <Route
            path="/daily-verses/automation"
            element={<Navigate to="/daily-verses" replace />}
          />
          <Route
            path="/prophet-verses"
            element={
              <ProtectedRoute>
                <AdminLayout>
                  <ProphetVersesListPage />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/prophet-verses/new"
            element={
              <ProtectedRoute>
                <AdminLayout>
                  <ProphetVerseForm mode="create" />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/prophet-verses/:id/edit"
            element={
              <ProtectedRoute>
                <AdminLayout>
                  <EditProphetVersePage />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          {/* M6: the media feed. Same three-route shape as
              /prophet-verses -- list, new, edit -- and the same RBAC:
              every role reaches the page, firestore.rules decides who may
              write. */}
          <Route
            path="/media"
            element={
              <ProtectedRoute>
                <AdminLayout>
                  <MediaListPage />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/media/new"
            element={
              <ProtectedRoute>
                <AdminLayout>
                  <MediaForm mode="create" />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/media/:id/edit"
            element={
              <ProtectedRoute>
                <AdminLayout>
                  <EditMediaPage />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/songs"
            element={
              <ProtectedRoute>
                <AdminLayout>
                  <SongsListPage />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/songs/new"
            element={
              <ProtectedRoute>
                <AdminLayout>
                  <SongForm mode="create" />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/songs/:id/edit"
            element={
              <ProtectedRoute>
                <AdminLayout>
                  <EditSongPage />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/events"
            element={
              <ProtectedRoute>
                <AdminLayout>
                  <EventsListPage />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/events/new"
            element={
              <ProtectedRoute>
                <AdminLayout>
                  <EventForm mode="create" />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/events/:id/edit"
            element={
              <ProtectedRoute>
                <AdminLayout>
                  <EditEventPage />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/notifications"
            element={
              <ProtectedRoute>
                <AdminLayout>
                  <NotificationsPage />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          {/* M7. The moderation queue. Behind ProtectedRoute like every
              other admin screen; firestore.rules' /reports read rule
              (content admin or above) is the boundary that actually
              decides who can see anything, exactly as elsewhere. */}
          <Route
            path="/reports"
            element={
              <ProtectedRoute>
                <AdminLayout>
                  <ReportsPage />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/users"
            element={
              <ProtectedRoute>
                <AdminLayout>
                  <UsersPage />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <AdminLayout>
                  <SettingsPage />
                </AdminLayout>
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
