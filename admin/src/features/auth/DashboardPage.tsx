import { Box, Button, Typography } from '@mui/material';
import { useAuthStore } from '../../store/authStore';

/**
 * Authenticated dashboard shell -- Day 2 proved the authenticated +
 * authorized state renders and sign-out works. Days 4-11 each added a
 * link into that day's new page via a plain button row on this page
 * (Announcements, Daily Verses, Songs, Events, Notifications, Users).
 *
 * Day 13 removes that button row: App.tsx now wraps every authenticated
 * route (including this one) in AdminLayout.tsx, a persistent sidebar
 * providing the exact same links -- see that file's doc comment for the
 * "Sidebar navigation, responsive layout" refinement this implements.
 * Keeping both would mean two navigation surfaces pointing at the same
 * places, which is what Day 13's "Admin dashboard polished" goal argues
 * against, not for. Sign out stays here (an account action on this
 * specific screen, not a navigation link the sidebar is responsible
 * for).
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
      <Button
        variant="outlined"
        onClick={() => void signOut()}
        data-testid="sign-out-button"
        sx={{ mt: 2 }}
      >
        Sign out
      </Button>
    </Box>
  );
}
