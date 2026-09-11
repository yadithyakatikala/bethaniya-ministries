import { useEffect, useState } from 'react';
import { Link as RouterLink, useParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
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
  Typography,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import { deletePlanDay, subscribeToPlanDays, subscribeToPlans } from '../../services/firebase/plans';
import { useAuthStore } from '../../store/authStore';
import { AdminEmptyState } from '../../components/AdminEmptyState';
import { AdminPageHeader } from '../../components/AdminPageHeader';
import { AdminTableCard } from '../../components/AdminTableCard';
import type { Plan, PlanDay } from '../../types';

function canManagePlans(role: string | null): boolean {
  return role === 'content_admin' || role === 'super_admin';
}

/**
 * Manages one plan's days -- a separate page from PlansListPage.tsx since
 * a plan can have many days and this table already carries one row per
 * day. `:planId` is the route param (see App.tsx's /plans/:planId/days).
 */
export function PlanDaysPage() {
  const { planId } = useParams<{ planId: string }>();
  const role = useAuthStore((s) => s.role);
  const canManage = canManagePlans(role);

  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [days, setDays] = useState<PlanDay[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PlanDay | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToPlans(
      (next) => setPlans(next),
      () => setPlans([])
    );
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!planId) return;
    const unsubscribe = subscribeToPlanDays(
      planId,
      (next) => {
        setDays(next);
        setError(null);
      },
      () => setError('Could not load days. Please try again.')
    );
    return unsubscribe;
  }, [planId]);

  const plan = plans?.find((p) => p.id === planId) ?? null;

  async function handleConfirmDelete() {
    if (!deleteTarget || !planId || !plan) return;
    setBusyId(deleteTarget.id);
    try {
      await deletePlanDay(planId, plan.title, deleteTarget.id, deleteTarget.dayNumber);
    } finally {
      setBusyId(null);
      setDeleteTarget(null);
    }
  }

  return (
    <Box sx={{ p: 4 }} data-testid="plan-days-page">
      <AdminPageHeader
        title={plan ? `${plan.title} — Days` : 'Plan Days'}
        action={
          canManage ? (
            <Button
              variant="contained"
              component={RouterLink}
              to={`/plans/${planId}/days/new`}
              data-testid="new-plan-day-button"
            >
              New Day
            </Button>
          ) : undefined
        }
      />

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        <RouterLink to="/plans">Back to Reading Plans</RouterLink>
      </Typography>

      {error ? (
        <Alert severity="error" data-testid="plan-days-error">
          {error}
        </Alert>
      ) : null}

      {!days && !error ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <CircularProgress data-testid="plan-days-loading" />
        </Box>
      ) : null}

      {days && days.length === 0 ? (
        <AdminEmptyState message="No days added yet." testId="plan-days-empty" />
      ) : null}

      {days && days.length > 0 ? (
        <AdminTableCard>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Day</TableCell>
                  <TableCell>Title</TableCell>
                  <TableCell>Scripture</TableCell>
                  {canManage ? <TableCell align="right">Actions</TableCell> : null}
                </TableRow>
              </TableHead>
              <TableBody>
                {days.map((day) => (
                  <TableRow key={day.id} data-testid={`plan-day-row-${day.id}`}>
                    <TableCell>{day.dayNumber}</TableCell>
                    <TableCell>{day.title}</TableCell>
                    <TableCell>{day.scriptureReference}</TableCell>
                    {canManage ? (
                      <TableCell align="right">
                        <IconButton
                          component={RouterLink}
                          to={`/plans/${planId}/days/${day.id}/edit`}
                          aria-label="Edit"
                          data-testid={`edit-plan-day-${day.id}`}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          aria-label="Delete"
                          onClick={() => setDeleteTarget(day)}
                          disabled={busyId === day.id}
                          data-testid={`delete-plan-day-${day.id}`}
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
        <DialogTitle>Delete day?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {deleteTarget ? `Day ${deleteTarget.dayNumber} ("${deleteTarget.title}") will be permanently deleted.` : null}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button color="error" onClick={() => void handleConfirmDelete()} data-testid="confirm-delete-day-button">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
