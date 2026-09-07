import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { Box, CircularProgress, Typography } from '@mui/material';
import { useAuthStore } from '../store/authStore';
import { canAccessAdminDashboard } from '../types';
import { UNAUTHORIZED_ADMIN_MESSAGE } from '../services/firebase/authErrors';

/**
 * Real route guard, replacing Day 1's unconditional pass-through placeholder.
 *
 * Distinguishes: Unauthenticated (redirect to /login) / role fetch still in
 * flight (loading) / Member (DENY -- "Access denied" message) / Host,
 * Content Admin, Super Admin (render children).
 *
 * IMPORTANT, same as the Day 1 placeholder said: this is a UX convenience,
 * not the actual authorization boundary. A rejected client-side check here
 * only prevents rendering a dashboard shell that would otherwise fill up
 * with permission-denied errors -- the real, enforced boundary is
 * /firestore.rules (`callerRole()` / `hasRole()`), evaluated server-side on
 * every read and write regardless of what this component renders. See
 * SECURITY.md.
 */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const status = useAuthStore((s) => s.status);
  const role = useAuthStore((s) => s.role);
  const roleLoaded = useAuthStore((s) => s.roleLoaded);

  if (status === 'loading') {
    return <LoadingState />;
  }

  if (status === 'unauthenticated' || status === 'error') {
    return <Navigate to="/login" replace />;
  }

  // status === 'authenticated' from here on.
  if (!roleLoaded) {
    // The /users/{uid} role read is still in flight -- treat the same as
    // loading rather than flashing "access denied" before we actually know.
    return <LoadingState />;
  }

  if (!canAccessAdminDashboard(role)) {
    return (
      <Box sx={{ p: 4 }} data-testid="unauthorized-message">
        <Typography variant="h6">Access denied</Typography>
        <Typography color="text.secondary">{UNAUTHORIZED_ADMIN_MESSAGE}</Typography>
      </Box>
    );
  }

  return <>{children}</>;
}

function LoadingState() {
  return (
    <Box
      data-testid="protected-route-loading"
      sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}
    >
      <CircularProgress />
    </Box>
  );
}
