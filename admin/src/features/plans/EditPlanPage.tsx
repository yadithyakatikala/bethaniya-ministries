import { useEffect, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';
import { subscribeToPlans } from '../../services/firebase/plans';
import { PlanForm } from './PlanForm';
import type { Plan } from '../../types';

/** Resolves :id from the route to a specific Plan and hands it to the shared form in edit mode. Mirrors ../announcements/EditAnnouncementPage.tsx. */
export function EditPlanPage() {
  const { id } = useParams<{ id: string }>();
  const [plans, setPlans] = useState<Plan[] | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToPlans(
      (next) => setPlans(next),
      () => setPlans([])
    );
    return unsubscribe;
  }, []);

  if (!plans) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }} data-testid="edit-plan-loading">
        <CircularProgress />
      </Box>
    );
  }

  const plan = plans.find((p) => p.id === id);
  if (!plan) {
    return <Navigate to="/plans" replace />;
  }

  return <PlanForm mode="edit" plan={plan} />;
}
