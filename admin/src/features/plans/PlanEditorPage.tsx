import { useEffect, useState } from 'react';
import { Link as RouterLink, Navigate, useParams } from 'react-router-dom';
import { Alert, Box, Button, CircularProgress } from '@mui/material';
import { AdminPageHeader } from '../../components/AdminPageHeader';
import { PageContainer } from '../../components/ui';
import { useAuthStore } from '../../store/authStore';
import { loadPlanForEditing, type LoadedPlan } from '../../services/firebase/plans';
import { PlanEditor } from './PlanEditor';
import { canManagePlans } from './planPermissions';

type Load =
  | { state: 'loading' }
  | { state: 'missing' }
  | { state: 'error' }
  | { state: 'ready'; loaded: LoadedPlan };

/**
 * The route for /plans/new and /plans/:id/edit.
 *
 * A new plan needs nothing loaded. An existing one is read once, with all its
 * days, and handed to the editor, which then owns it: the editor does NOT
 * subscribe to live updates, because a plan being edited must not change
 * underneath the person editing it. (If someone else saves meanwhile, the
 * next save says so rather than overwriting them -- see PlanConflictError.)
 */
export function PlanEditorPage({ mode }: { mode: 'create' | 'edit' }) {
  const role = useAuthStore((s) => s.role);
  const readOnly = !canManagePlans(role);
  const { id } = useParams<{ id: string }>();

  if (mode === 'create') {
    if (readOnly) return <Navigate to="/plans" replace />;
    return <PlanEditor key="new" loaded={null} readOnly={false} />;
  }
  // Keyed by id: opening a different plan is a different editor.
  return <ExistingPlan key={id} planId={id ?? ''} readOnly={readOnly} />;
}

function ExistingPlan({ planId, readOnly }: { planId: string; readOnly: boolean }) {
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    loadPlanForEditing(planId)
      .then((loaded) => {
        if (cancelled) return;
        setLoad(loaded ? { state: 'ready', loaded } : { state: 'missing' });
      })
      .catch(() => {
        if (!cancelled) setLoad({ state: 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, [planId, attempt]);

  if (load.state === 'ready') {
    return <PlanEditor loaded={load.loaded} readOnly={readOnly} />;
  }

  return (
    <PageContainer width="narrow" testId="plan-editor-page">
      <AdminPageHeader
        title="Reading Plan"
        breadcrumbs={[{ label: 'Reading Plans', to: '/plans' }, { label: 'Edit' }]}
      />
      {load.state === 'loading' ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}>
          <CircularProgress
            aria-label="Loading the plan"
            data-testid="plan-editor-loading"
          />
        </Box>
      ) : null}
      {load.state === 'missing' ? (
        <Alert
          severity="warning"
          data-testid="plan-editor-missing"
          action={
            <Button color="inherit" size="small" component={RouterLink} to="/plans">
              Back to plans
            </Button>
          }
        >
          There is no reading plan with the ID “{planId}”. It may have been deleted.
        </Alert>
      ) : null}
      {load.state === 'error' ? (
        <Alert
          severity="error"
          data-testid="plan-editor-error"
          action={
            <Button
              color="inherit"
              size="small"
              onClick={() => {
                setLoad({ state: 'loading' });
                setAttempt((n) => n + 1);
              }}
            >
              Try again
            </Button>
          }
        >
          This plan could not be loaded. Check your connection and try again.
        </Alert>
      ) : null}
    </PageContainer>
  );
}

/**
 * The old one-day-at-a-time pages are gone -- the days are edited inside the
 * plan now -- but their addresses are still in bookmarks and old messages.
 * Each redirects to the same place in the new editor.
 */
export function LegacyDaysRedirect() {
  const { planId } = useParams<{ planId: string }>();
  return <Navigate to={`/plans/${planId ?? ''}/edit?tab=days`} replace />;
}

export function LegacyNewDayRedirect() {
  const { planId } = useParams<{ planId: string }>();
  return <Navigate to={`/plans/${planId ?? ''}/edit?tab=days&newDay=1`} replace />;
}

export function LegacyEditDayRedirect() {
  const { planId, dayId } = useParams<{ planId: string; dayId: string }>();
  return (
    <Navigate
      to={`/plans/${planId ?? ''}/edit?tab=days&day=${encodeURIComponent(dayId ?? '')}`}
      replace
    />
  );
}
