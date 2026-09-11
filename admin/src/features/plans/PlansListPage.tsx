import { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
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
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import ViewListIcon from '@mui/icons-material/ViewList';
import { deletePlan, setPlanPublished, subscribeToPlans } from '../../services/firebase/plans';
import { useAuthStore } from '../../store/authStore';
import { AdminEmptyState } from '../../components/AdminEmptyState';
import { AdminPageHeader } from '../../components/AdminPageHeader';
import { AdminTableCard } from '../../components/AdminTableCard';
import type { Plan } from '../../types';

/** Matches firestore.rules' isContentAdminOrAbove() -- Host can read all plans but not write any. Gating these buttons is a UX convenience only; the rules are the real boundary. */
function canManagePlans(role: string | null): boolean {
  return role === 'content_admin' || role === 'super_admin';
}

/**
 * Admin reading plans list -- a new V1 feature (see
 * ../../types/index.ts's Plan doc comment for provenance). Same
 * table/publish-toggle/delete shape as
 * ../announcements/AnnouncementsListPage.tsx, plus a "Days" link into
 * PlanDaysPage.tsx (managing a plan's days is a separate page, not this
 * one -- a plan can have many days, and this table already carries one
 * row per plan).
 */
export function PlansListPage() {
  const role = useAuthStore((s) => s.role);
  const canManage = canManagePlans(role);

  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Plan | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToPlans(
      (next) => {
        setPlans(next);
        setError(null);
      },
      () => setError('Could not load plans. Please try again.')
    );
    return unsubscribe;
  }, []);

  async function handleTogglePublished(plan: Plan) {
    setBusyId(plan.id);
    try {
      await setPlanPublished(plan.id, plan.title, !plan.published);
    } finally {
      setBusyId(null);
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setBusyId(deleteTarget.id);
    try {
      await deletePlan(deleteTarget.id, deleteTarget.title);
    } finally {
      setBusyId(null);
      setDeleteTarget(null);
    }
  }

  return (
    <Box sx={{ p: 4 }} data-testid="plans-list-page">
      <AdminPageHeader
        title="Reading Plans"
        action={
          canManage ? (
            <Button variant="contained" component={RouterLink} to="/plans/new" data-testid="new-plan-button">
              New Plan
            </Button>
          ) : undefined
        }
      />

      {error ? (
        <Alert severity="error" data-testid="plans-error">
          {error}
        </Alert>
      ) : null}

      {!plans && !error ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <CircularProgress data-testid="plans-loading" />
        </Box>
      ) : null}

      {plans && plans.length === 0 ? (
        <AdminEmptyState message="No reading plans yet." testId="plans-empty" />
      ) : null}

      {plans && plans.length > 0 ? (
        <AdminTableCard>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Title</TableCell>
                  <TableCell>Category</TableCell>
                  <TableCell>Days</TableCell>
                  <TableCell>Status</TableCell>
                  {canManage ? <TableCell align="right">Actions</TableCell> : null}
                </TableRow>
              </TableHead>
              <TableBody>
                {plans.map((plan) => (
                  <TableRow key={plan.id} data-testid={`plan-row-${plan.id}`}>
                    <TableCell>{plan.title}</TableCell>
                    <TableCell>{plan.category}</TableCell>
                    <TableCell>{plan.dayCount}</TableCell>
                    <TableCell>
                      <Chip
                        label={plan.published ? 'Published' : 'Draft'}
                        color={plan.published ? 'success' : 'default'}
                        size="small"
                      />
                    </TableCell>
                    {canManage ? (
                      <TableCell align="right">
                        <Button
                          size="small"
                          onClick={() => void handleTogglePublished(plan)}
                          disabled={busyId === plan.id}
                          data-testid={`toggle-published-${plan.id}`}
                        >
                          {plan.published ? 'Unpublish' : 'Publish'}
                        </Button>
                        <IconButton
                          component={RouterLink}
                          to={`/plans/${plan.id}/days`}
                          aria-label="Manage days"
                          data-testid={`manage-days-${plan.id}`}
                        >
                          <ViewListIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          component={RouterLink}
                          to={`/plans/${plan.id}/edit`}
                          aria-label="Edit"
                          data-testid={`edit-plan-${plan.id}`}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          aria-label="Delete"
                          onClick={() => setDeleteTarget(plan)}
                          disabled={busyId === plan.id}
                          data-testid={`delete-plan-${plan.id}`}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </AdminTableCard>
      ) : null}

      <Dialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)}>
        <DialogTitle>Delete plan?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {deleteTarget
              ? `"${deleteTarget.title}" and its days will be permanently deleted. This cannot be undone.`
              : null}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button color="error" onClick={() => void handleConfirmDelete()} data-testid="confirm-delete-button">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
