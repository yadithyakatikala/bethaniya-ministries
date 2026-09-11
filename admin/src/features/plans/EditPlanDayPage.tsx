import { useEffect, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';
import { subscribeToPlanDays } from '../../services/firebase/plans';
import { PlanDayForm } from './PlanDayForm';
import type { PlanDay } from '../../types';

/** Resolves :dayId (within :planId) to a specific PlanDay and hands it to the shared form in edit mode. */
export function EditPlanDayPage() {
  const { planId, dayId } = useParams<{ planId: string; dayId: string }>();
  const [days, setDays] = useState<PlanDay[] | null>(null);

  useEffect(() => {
    if (!planId) return;
    const unsubscribe = subscribeToPlanDays(
      planId,
      (next) => setDays(next),
      () => setDays([])
    );
    return unsubscribe;
  }, [planId]);

  if (!days) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }} data-testid="edit-plan-day-loading">
        <CircularProgress />
      </Box>
    );
  }

  const day = days.find((d) => d.id === dayId);
  if (!day) {
    return <Navigate to={`/plans/${planId}/days`} replace />;
  }

  return <PlanDayForm mode="edit" day={day} />;
}
