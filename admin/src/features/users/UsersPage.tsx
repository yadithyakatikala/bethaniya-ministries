import { useEffect, useState } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  Drawer,
  MenuItem,
  Select,
  type SelectChangeEvent,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  fetchAllUsers,
  restoreUserAccess,
  suspendUser,
  updateUserRole,
} from '../../services/firebase/users';
import {
  appLanguageLabel,
  authProviderLabel,
  filterUsers,
  genderLabel,
  lastActiveLabel,
  profileCompletionLabel,
} from './userSearch';
import { SuspendUserDialog } from './SuspendUserDialog';
import {
  SUSPENSION_STATE_LABELS,
  formatWhen,
  isSuspensionInForce,
  suspensionState,
  timeRemaining,
  type SuspensionRequest,
  type SuspensionState,
} from './suspension';
import { useAuthStore } from '../../store/authStore';
import { AdminEmptyState } from '../../components/AdminEmptyState';
import { AdminPageHeader } from '../../components/AdminPageHeader';
import { AdminTableCard } from '../../components/AdminTableCard';
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

/** Ascending-authority color coding for the role chip -- reuses the theme's existing palette entries (no new colors introduced) so Super Admin (evergreen) reads as the most privileged down through Member (neutral, uncolored). */
const ROLE_CHIP_COLOR: Record<UserRole, 'primary' | 'secondary' | 'warning' | 'default'> =
  {
    super_admin: 'primary',
    content_admin: 'secondary',
    host: 'warning',
    member: 'default',
  };

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

/**
 * M8. How each account state is coloured in the table.
 *
 * 'expired' is deliberately NOT a warning colour. The suspension is
 * over; the row is saying "this happened", not "this is happening", and
 * colouring it like an active restriction would have administrators
 * chasing members who are already back.
 */
const SUSPENSION_CHIP_COLOR: Record<
  SuspensionState,
  'default' | 'warning' | 'error'
> = {
  active: 'default',
  temporary: 'warning',
  permanent: 'error',
  expired: 'default',
};

/** One label-and-value line in the detail drawer. */
function DetailRow({
  label,
  value,
  testId,
}: {
  label: string;
  value: string;
  testId?: string;
}) {
  return (
    <Box>
      <Typography variant="overline" color="text.secondary">
        {label}
      </Typography>
      <Typography sx={{ wordBreak: 'break-all' }} data-testid={testId}>
        {value}
      </Typography>
    </Box>
  );
}

export function UsersPage() {
  const role = useAuthStore((s) => s.role);
  const ownUid = useAuthStore((s) => s.user?.uid ?? null);
  const canManage = canManageUsers(role);

  const [users, setUsers] = useState<AdminUserSummary[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [search, setSearch] = useState('');
  // M7. The detail view -- the uid rather than the object, so the drawer
  // shows the CURRENT row after a refetch rather than a stale snapshot of
  // the member as they were when it was opened.
  const [selectedUid, setSelectedUid] = useState<string | null>(null);

  const [pendingChange, setPendingChange] = useState<PendingRoleChange | null>(null);
  /** The member the suspension dialogue is open for, if any. */
  const [suspendTarget, setSuspendTarget] = useState<AdminUserSummary | null>(null);
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

  /**
   * M8. Suspending a member, on the terms chosen in the dialogue.
   *
   * The dialogue asks first, unlike M7's single toggle. Not because the
   * action is irreversible -- restoring access is one button -- but
   * because "for how long" and "why" are part of the decision, and a
   * control that cannot express them quietly turns every suspension
   * into a permanent one that nobody wrote a reason for.
   */
  async function handleSuspend(user: AdminUserSummary, request: SuspensionRequest) {
    setSubmitting(true);
    setSubmitError(null);
    setSuccessMessage(null);
    try {
      await suspendUser(user.uid, request);
      setSuccessMessage(
        request.kind === 'permanent'
          ? `${userDisplayLabel(user)} is suspended until an admin restores access.`
          : `${userDisplayLabel(user)} is suspended until ${formatWhen(request.expiresAt)}.`
      );
      setSuspendTarget(null);
      setRefreshKey((k) => k + 1);
    } catch {
      setSubmitError('Could not suspend that account. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  /**
   * Restoring access, whatever kind of suspension it was.
   *
   * No confirmation: this is the direction that gives somebody their
   * church back, and making an administrator confirm it twice would
   * serve nobody.
   */
  async function handleRestore(user: AdminUserSummary) {
    setSubmitting(true);
    setSubmitError(null);
    setSuccessMessage(null);
    try {
      await restoreUserAccess(user.uid);
      setSuccessMessage(`${userDisplayLabel(user)} can post again.`);
      setRefreshKey((k) => k + 1);
    } catch {
      setSubmitError('Could not restore access. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const selected = (users ?? []).find((user) => user.uid === selectedUid) ?? null;
  const visible = users ? filterUsers(users, search) : [];

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
      <AdminPageHeader title="Users" />

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

      {users && users.length > 0 ? (
        <TextField
          fullWidth
          size="small"
          sx={{ mb: 2 }}
          label="Search"
          placeholder="Name, email, phone or user ID"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          helperText="A phone number is found with or without its spaces and country code."
          slotProps={{ htmlInput: { 'data-testid': 'users-search' } }}
        />
      ) : null}

      {users && users.length === 0 ? (
        <AdminEmptyState message="No users yet." testId="users-empty" />
      ) : null}

      {users && users.length > 0 && visible.length === 0 ? (
        <AdminEmptyState
          message={`Nobody matches "${search.trim()}".`}
          testId="users-no-matches"
        />
      ) : null}

      {visible.length > 0 ? (
        <AdminTableCard>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Phone</TableCell>
                  <TableCell>Role</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Joined</TableCell>
                  <TableCell align="right">Details</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {visible.map((user) => {
                  const isSelf = user.uid === ownUid;
                  return (
                    <TableRow key={user.uid} data-testid={`user-row-${user.uid}`}>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                          <Avatar
                            sx={{
                              width: 28,
                              height: 28,
                              fontSize: 13,
                              fontWeight: 700,
                              bgcolor: 'primary.light',
                              color: 'primary.dark',
                            }}
                          >
                            {(user.displayName ?? user.email ?? '?')
                              .charAt(0)
                              .toUpperCase()}
                          </Avatar>
                          <Box component="span">{user.displayName ?? '--'}</Box>
                          {isSelf ? (
                            <Chip
                              label="You"
                              size="small"
                              data-testid={`user-is-self-${user.uid}`}
                            />
                          ) : null}
                        </Box>
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
                              renderValue={(value) => (
                                <Chip
                                  label={ROLE_LABELS[value as UserRole]}
                                  color={ROLE_CHIP_COLOR[value as UserRole]}
                                  size="small"
                                />
                              )}
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
                      <TableCell>
                        {/* The state, not the stored field: a temporary
                            suspension that has run out is over, and the
                            table must not go on calling it a suspension
                            (see ./suspension.ts). */}
                        <Chip
                          size="small"
                          label={SUSPENSION_STATE_LABELS[suspensionState(user)]}
                          color={SUSPENSION_CHIP_COLOR[suspensionState(user)]}
                          variant={
                            suspensionState(user) === 'expired' ? 'outlined' : 'filled'
                          }
                          data-testid={`user-status-${user.uid}`}
                        />
                      </TableCell>
                      <TableCell>{formatJoinDate(user.createdAt)}</TableCell>
                      <TableCell align="right">
                        <Button
                          size="small"
                          onClick={() => setSelectedUid(user.uid)}
                          data-testid={`user-details-${user.uid}`}
                        >
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </AdminTableCard>
      ) : null}

      {/* M7. A drawer rather than a second page: looking a member up is
          something an administrator does WHILE working through the list,
          and a route change would lose the search they typed to find
          them. */}
      <Drawer
        anchor="right"
        open={Boolean(selected)}
        onClose={() => setSelectedUid(null)}
        slotProps={{ paper: { sx: { width: { xs: '100%', sm: 420 } } } }}
      >
        {selected ? (
          <Box sx={{ p: 3 }} data-testid="user-detail">
            <Typography variant="h6" gutterBottom>
              {userDisplayLabel(selected)}
            </Typography>

            <Stack spacing={2} sx={{ mt: 2 }}>
              <DetailRow
                label="Display name"
                value={selected.displayName ?? 'Not set'}
                testId="user-detail-name"
              />
              <DetailRow label="Email" value={selected.email ?? 'Not set'} />
              <DetailRow label="Phone" value={selected.phoneNumber ?? 'Not set'} />
              <DetailRow label="Gender" value={genderLabel(selected.gender)} />
              <DetailRow
                label="Preferred app language"
                value={appLanguageLabel(selected.appLanguage)}
              />
              <DetailRow
                label="Signs in with"
                value={authProviderLabel(selected.authProvider)}
                testId="user-detail-provider"
              />
              <DetailRow label="Role" value={ROLE_LABELS[selected.role]} />
              <DetailRow label="Joined" value={formatJoinDate(selected.createdAt)} />
              <DetailRow
                label="Profile"
                value={profileCompletionLabel(selected.profileCompletedAt)}
                testId="user-detail-profile-completion"
              />
              <DetailRow
                label="Last active"
                value={lastActiveLabel(selected.lastActiveAt)}
                testId="user-detail-last-active"
              />
              <DetailRow
                label="Account status"
                value={SUSPENSION_STATE_LABELS[suspensionState(selected)]}
                testId="user-detail-status"
              />
              {/* The uid is last, and shown in full: it is what a support
                  question or a log line is keyed by, and a truncated one
                  cannot be copied. */}
              <DetailRow label="User ID" value={selected.uid} testId="user-detail-uid" />
            </Stack>

            <Divider sx={{ my: 3 }} />

            {/* M8. The terms, whenever there are any. An administrator
                asked "why is this person suspended" should not have to
                go and ask a colleague. */}
            {selected.suspension || selected.accountStatus === 'suspended' ? (
              <Stack spacing={2} sx={{ mb: 3 }} data-testid="user-detail-suspension">
                <Typography variant="subtitle2">
                  {suspensionState(selected) === 'expired'
                    ? 'Last suspension'
                    : 'This suspension'}
                </Typography>
                <DetailRow
                  label="Kind"
                  value={
                    selected.suspension?.kind === 'temporary'
                      ? 'Temporary'
                      : 'Permanent'
                  }
                  testId="user-detail-suspension-kind"
                />
                <DetailRow
                  label="Reason"
                  value={selected.suspension?.reason ?? 'None recorded'}
                  testId="user-detail-suspension-reason"
                />
                <DetailRow
                  label="Started"
                  value={formatWhen(selected.suspension?.startedAt ?? null)}
                  testId="user-detail-suspension-started"
                />
                <DetailRow
                  label="Ends"
                  value={
                    selected.suspension?.expiresAt
                      ? `${formatWhen(selected.suspension.expiresAt)}${
                          timeRemaining(selected.suspension)
                            ? ` (${timeRemaining(selected.suspension)})`
                            : ' (already passed)'
                        }`
                      : 'Only when an admin restores access'
                  }
                  testId="user-detail-suspension-ends"
                />
                <DetailRow
                  label="Suspended by"
                  value={
                    selected.suspension?.byName ??
                    selected.suspension?.byUid ??
                    'Not recorded'
                  }
                  testId="user-detail-suspension-by"
                />
              </Stack>
            ) : null}

            <Typography variant="body2" color="text.secondary" gutterBottom>
              A suspended member cannot write anything new &mdash; chat messages, prayer
              requests, comments or reports. They can still read the app, and they stay
              signed in: this app cannot disable a Firebase sign-in, so the app shows them
              a notice instead and the server refuses their writes.
            </Typography>

            <Stack direction="row" spacing={1.5} sx={{ flexWrap: 'wrap', gap: 1.5 }}>
              <Tooltip
                title={selected.uid === ownUid ? 'You cannot suspend your own account.' : ''}
                disableHoverListener={selected.uid !== ownUid}
              >
                <span>
                  <Button
                    variant="outlined"
                    color="warning"
                    disabled={selected.uid === ownUid || submitting}
                    onClick={() => setSuspendTarget(selected)}
                    data-testid="user-detail-suspend"
                  >
                    {isSuspensionInForce(selected)
                      ? 'Change this suspension'
                      : 'Suspend user'}
                  </Button>
                </span>
              </Tooltip>

              {selected.accountStatus === 'suspended' ? (
                <Button
                  variant="contained"
                  disabled={submitting}
                  onClick={() => void handleRestore(selected)}
                  data-testid="user-detail-restore"
                >
                  Restore access
                </Button>
              ) : null}
            </Stack>
          </Box>
        ) : null}
      </Drawer>

      {suspendTarget ? (
        <SuspendUserDialog
          open
          memberName={userDisplayLabel(suspendTarget)}
          submitting={submitting}
          error={submitError}
          onCancel={() => setSuspendTarget(null)}
          onConfirm={(request) => void handleSuspend(suspendTarget, request)}
        />
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
