import { Box, Button, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';

/**
 * Authenticated dashboard shell -- Day 2 proved the authenticated +
 * authorized state renders and sign-out works. Day 4 adds a link into the
 * one real content-management screen that exists so far (Announcements);
 * Day 5 adds a second link for Daily Verses; Day 6 adds a third for Songs;
 * Day 7 adds a fourth for Events.
 * A fuller nav/sidebar covering
 * the rest of FINAL_ARCHITECTURE_SPECIFICATION.md's "Dashboard Overview"
 * (stats, activity feed, quick actions) is later V1 scope, not built here.
 */
export function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const role = useAuthStore((s) => s.role);
  const signOut = useAuthStore((s) => s.signOut);

  return (
    <Box sx={{ p: 4 }} data-testid="dashboard-page">
      <Typography variant="h5" component="h1" gutterBottom>
        Welcome, {user?.email ?? 'Admin'}
      </Typography>
      <Typography color="text.secondary" gutterBottom>
        Role: {role}
      </Typography>
      <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
        <Button
          variant="contained"
          component={RouterLink}
          to="/announcements"
          data-testid="announcements-nav-link"
        >
          Manage Announcements
        </Button>
        <Button
          variant="contained"
          component={RouterLink}
          to="/daily-verses"
          data-testid="daily-verses-nav-link"
        >
          Manage Daily Verses
        </Button>
        <Button
          variant="contained"
          component={RouterLink}
          to="/songs"
          data-testid="songs-nav-link"
        >
          Manage Songs
        </Button>
        <Button
          variant="contained"
          component={RouterLink}
          to="/events"
          data-testid="events-nav-link"
        >
          Manage Events
        </Button>
        <Button
          variant="outlined"
          onClick={() => void signOut()}
          data-testid="sign-out-button"
        >
          Sign out
        </Button>
      </Stack>
    </Box>
  );
}
