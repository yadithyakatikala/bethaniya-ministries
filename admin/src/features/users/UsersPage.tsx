import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  MenuItem,
  Select,
  type SelectChangeEvent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import { fetchAllUsers, updateUserRole } from '../../services/firebase/users';
import { useAuthStore } from '../../store/authStore';
import {
  ASSIGNABLE_ROLES,
  ROLE_LABELS,
  type AdminUserSummary,
  type UserRole,
} from '../../types';

/**
 * Admin Users page -- Day 11, per FINAL_ARCHITECTURE_SPECIFICATION.md's
 * Day 11 plan: "Super Admin can view all users", "Super Admin can assign
 * roles (Super Admin / Content Admin / Host / Member)", "Roles enforced
 * by security rules (not just UI)".
 *
 * Role gating: Super Admin only -- deliberately narrower than
 * ProtectedRoute.tsx's host-or-above dashboard gate (the spec's own
 * testing bar explicitly requires "Content Admin cannot access users
 * page"), matching functions/src/updateUserRole.ts's ALLOWED_CALLER_ROLES
 * exactly. Same "hiding is UX, not security" principle as every other
 * role gate in this app: firestore.rules' users/{userId} update rule
 * independently enforces super_admin-only role changes at the database
 * level regardless of what this page renders, and the updateUserRole
 * callable independently re-checks the caller's role server-side too.
 *
 * Data loading: a one-time fetchAllUsers() on mount (and again after a
 * successful role change), NOT a realtime onSnapshot subscription -- see
 * services/firebase/users.ts's header comment for why a live listener
 * would be unnecessary overhead for this admin-only, rarely-changing
 * view.
 *
 * SELF-DEMOTION GUARD: the role Select for the signed-in Super Admin's
 * own row is disabled (with an explanatory tooltip) so they cannot even
 * attempt to change their own role from this UI. This is the UX half of
 * the guard only -- the updateUserRole callable independently rejects a
 * caller targeting their own uid, unconditionally, regardless of what
 * this page does or doesn't render (see that file's header comment). A
 * disabled control here is not itself a security boundary.
 */
function canManageUsers(role: string | null): boolean {
  return role === 'super_admin';
}

function formatJoinDate(date: Date | null): string {
  return date ? date.toLocaleDateString() : 'Unknown';
}

function userDisplayLabel(user: AdminUserSummary): string {
  return user.displayName ?? user.email ?? user.uid;
}

interface PendingRoleChange {
  user: AdminUserSummary;
  newRole: UserRole;
}

export function UsersPage() {
  const role = useAuthStore((s) => s.role);
  const ownUid = useAuthStore((s) => s.user?.uid ?? null);
  const canManage = canManageUsers(role);

  const [users, setUsers] = useState<AdminUserSummary[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const [pendingChange, setPendingChange] = useState<PendingRoleChange | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!canManage) return undefined;
    let cancelled = false;
    void fetchAllUsers()
      .then((next) => {
        if (!cancelled) {
          setUsers(next);
          setLoadError(null);
        }
      })
      .catch(() => {
        if (!cancelled) setLoadError('Could not load users. Please try again.');
      });
    return () => {
      cancelled = true;
    };
    // refreshKey exists solely to re-trigger this effect after a
    // successful role change (see handleConfirmRoleChange below) --
    // the one-time-fetch-plus-refetch approach this page deliberately
    // uses instead of a realtime listener.
  }, [canManage, refreshKey]);

  function handleRoleSelect(user: AdminUserSummary, event: SelectChangeEvent) {
    const newRole = event.target.value as UserRole;
    if (newRole === user.role) return;
    setSubmitError(null);
    setSuccessMessage(null);
    setPendingChange({ user, newRole });
  }

  async function handleConfirmRoleChange() {
    if (!pendingChange) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await updateUserRole(pendingChange.user.uid, pendingChange.newRole);
      setSuccessMessage(
        `${userDisplayLabel(pendingChange.user)}'s role is now ${ROLE_LABELS[pendingChange.newRole]}.`
      );
      setPendingChange(null);
      setRefreshKey((k) => k + 1);
    } catch {
      setSubmitError('Something went wrong while changing the role. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (!canManage) {
    return (
      <Box sx={{ p: 4 }} data-testid="users-page">
        <Typography color="text.secondary" data-testid="users-unauthorized">
          You are not authorized to view or manage users.
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 4 }} data-testid="users-page">
      <Typography variant="h5" component="h1" gutterBottom>
        Users
      </Typography>

      {submitError ? (
        <Alert severity="error" sx={{ mb: 2 }} data-testid="role-change-error">
          {submitError}
        </Alert>
      ) : null}
      {successMessage ? (
        <Alert severity="success" sx={{ mb: 2 }} data-testid="role-change-success">
          {successMessage}
        </Alert>
      ) : null}

      {loadError ? (
        <Alert severity="error" data-testid="users-error">
          {loadError}
        </Alert>
      ) : null}

      {!users && !loadError ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <CircularProgress data-testid="users-loading" />
        </Box>
      ) : null}

      {users && users.length === 0 ? (
        <Typography color="text.secondary" data-testid="users-empty">
          No users yet.
        </Typography>
      ) : null}

      {users && users.length > 0 ? (
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Phone</TableCell>
                <TableCell>Role</TableCell>
                <TableCell>Joined</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.map((user) => {
                const isSelf = user.uid === ownUid;
                return (
                  <TableRow key={user.uid} data-testid={`user-row-${user.uid}`}>
                    <TableCell>
                      {user.displayName ?? '--'}
                      {isSelf ? (
                        <Chip
                          label="You"
                          size="small"
                          sx={{ ml: 1 }}
                          data-testid={`user-is-self-${user.uid}`}
                        />
                      ) : null}
                    </TableCell>
                    <TableCell>{user.email ?? '--'}</TableCell>
                    <TableCell>{user.phoneNumber ?? '--'}</TableCell>
                    <TableCell>
                      <Tooltip
                        title={isSelf ? 'You cannot change your own role.' : ''}
                        disableHoverListener={!isSelf}
                      >
                        <span>
                          <Select
                            size="small"
                            value={user.role}
                            onChange={(event) => handleRoleSelect(user, event)}
                            disabled={isSelf || submitting}
                            data-testid={`role-select-${user.uid}`}
                          >
                            {ASSIGNABLE_ROLES.map((assignableRole) => (
                              <MenuItem key={assignableRole} value={assignableRole}>
                                {ROLE_LABELS[assignableRole]}
                              </MenuItem>
                            ))}
                          </Select>
                        </span>
                      </Tooltip>
                    </TableCell>
                    <TableCell>{formatJoinDate(user.createdAt)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      ) : null}

      <Dialog open={Boolean(pendingChange)} onClose={() => setPendingChange(null)}>
        <DialogTitle>Change role?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {pendingChange
              ? `Change ${userDisplayLabel(pendingChange.user)}'s role from ` +
                `${ROLE_LABELS[pendingChange.user.role]} to ` +
                `${ROLE_LABELS[pendingChange.newRole]}?`
              : null}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPendingChange(null)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={() => void handleConfirmRoleChange()}
            disabled={submitting}
            data-testid="confirm-role-change-button"
          >
            Change Role
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
