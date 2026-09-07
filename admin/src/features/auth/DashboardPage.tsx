import { Box, Button, Typography } from '@mui/material';
import { useAuthStore } from '../../store/authStore';

/**
 * Authenticated dashboard shell -- Day 2 only needs to prove the
 * authenticated + authorized state renders and sign-out works; the real
 * admin dashboard screens (content, users, notifications, ...) are later
 * V1 days' scope.
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
        Role: {role} — Day 2 foundation — dashboard is a placeholder
      </Typography>
      <Button
        variant="outlined"
        onClick={() => void signOut()}
        data-testid="sign-out-button"
      >
        Sign out
      </Button>
    </Box>
  );
}
