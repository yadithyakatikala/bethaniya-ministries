import { useReducer, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Alert, Box, Button, Tab, Tabs, TextField } from '@mui/material';
import { AdminPageHeader } from '../../components/AdminPageHeader';
import { ConfirmDialog, PageContainer, useToast } from '../../components/ui';
import { useUnsavedChangesGuard } from '../../components/useUnsavedChangesGuard';
import { useAuthStore } from '../../store/authStore';
import {
  PlanConflictError,
  PlanIdTakenError,
  PlanMissingError,
  deletePlan,
  duplicatePlan,
  loadPlanDocument,
  loadPlanForEditing,
  newDayId,
  planIdExists,
  savePlan,
  setPlanStatus,
  type LoadedPlan,
} from '../../services/firebase/plans';
import { SAVE_RETRY_MESSAGE } from '../../services/firebase/saveErrors';
import { useNow } from '../prophet-verses/useNow';
import { DayDrawer } from './DayDrawer';
import { PlanDaysTab } from './PlanDaysTab';
import { PlanDetailsTab } from './PlanDetailsTab';
import { PlanPreviewTab } from './PlanPreviewTab';
import { PlanStatusBar } from './PlanStatusBar';
import { PublishDialog } from './PublishDialog';
import {
  editorReducer,
  loadedPlanState,
  newPlanState,
  type EditorState,
} from './planEditorState';
import {
  detailsForStorage,
  firstFreeId,
  slugify,
  validatePlanDetails,
  validatePlanId,
  type PlanDetailsForm,
} from './planDetails';
import {
  canSaveDraft,
  liveSaveProblem,
  planReadiness,
  type ReadinessIssue,
} from './planReadiness';
import {
  isGoingLive,
  isVisibleToMembers,
  planStatusOf,
  statusLabelFor,
  type PlanStatusChange,
} from './planStatus';

type TabId = 'details' | 'days' | 'preview';
const TABS: readonly TabId[] = ['details', 'days', 'preview'];

function parseTab(value: string | null): TabId {
  return TABS.includes(value as TabId) ? (value as TabId) : 'details';
}

type Dialog =
  | null
  | { kind: 'publish' }
  | { kind: 'schedule' }
  | { kind: 'status'; action: 'unpublish' | 'archive' | 'restore' }
  | { kind: 'delete' }
  | { kind: 'removeDay'; key: string }
  | { kind: 'duplicate' };

const LEAVE_MESSAGE =
  'This reading plan has changes that have not been saved. If you leave now they will be lost.';

/**
 * Where a reading plan is written: its details, its days, a preview, and
 * the actions that move it from draft to published.
 *
 * The whole plan lives in memory (see ./planEditorState.ts) and is written
 * together when the administrator saves, so the page shows one complete,
 * ordered plan and "unsaved changes" is a single fact. Everything that
 * touches Firestore goes through services/firebase/plans.ts; this component
 * decides WHEN, and turns what comes back into words.
 *
 * Roles: content administrators and above edit. A host can read every plan
 * (firestore.rules) so can open one here, but sees it read-only.
 */
export function PlanEditor({
  loaded,
  readOnly,
}: {
  /** The plan and its days, or null to start a new plan. */
  loaded: LoadedPlan | null;
  readOnly: boolean;
}) {
  const navigate = useNavigate();
  const toast = useToast();
  const now = useNow();
  const uid = useAuthStore((s) => s.user?.uid ?? '');
  const [params, setParams] = useSearchParams();
  const tab = parseTab(params.get('tab'));

  const [state, dispatch] = useReducer(editorReducer, undefined, (): EditorState => {
    const base = loaded ? loadedPlanState(loaded.plan, loaded.days) : newPlanState();
    // Deep links from the old one-day-at-a-time pages: open a saved day,
    // or start a new one.
    const dayId = params.get('day');
    const saved = dayId ? base.days.find((day) => day.id === dayId) : undefined;
    if (saved) return { ...base, selectedKey: saved.key };
    if (params.get('newDay') === '1' && !readOnly) {
      return editorReducer(base, { type: 'addDay' });
    }
    return base;
  });

  /** The plan as last loaded or saved. The base every save is checked against. */
  const [snapshot, setSnapshot] = useState<LoadedPlan | null>(loaded);
  /** Ids chosen for new days BEFORE the first save attempt, so a retry overwrites instead of duplicating. */
  const reservedIds = useRef(new Map<string, string>());

  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [idTaken, setIdTaken] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [missing, setMissing] = useState(false);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [copyTitle, setCopyTitle] = useState('');

  useUnsavedChangesGuard(state.dirty && !readOnly, LEAVE_MESSAGE);

  const isNew = state.mode === 'create';
  const plan = snapshot?.plan ?? null;
  const status = plan ? planStatusOf(plan, now) : 'draft';
  const statusLabel = plan ? statusLabelFor(plan, now) : undefined;
  const live = status === 'published' || status === 'scheduled';
  const visible = plan ? isVisibleToMembers(plan, now) : false;

  const detailErrors = validatePlanDetails(state.details);
  const idProblem = isNew ? validatePlanId(state.planId) : null;
  const readiness = planReadiness(state.details, state.days);
  const canSave =
    canSaveDraft(state.details, state.days) &&
    (!isNew || (idProblem === null && !idTaken));

  const selectedIndex = state.days.findIndex((day) => day.key === state.selectedKey);
  const selectedDay = selectedIndex >= 0 ? (state.days[selectedIndex] ?? null) : null;
  const issueCount = readiness.filter((issue) => issue.severity === 'error').length;

  function setTab(next: TabId) {
    const copy = new URLSearchParams(params);
    copy.set('tab', next);
    copy.delete('day');
    copy.delete('newDay');
    setParams(copy, { replace: true });
  }

  function setDetail(field: keyof PlanDetailsForm, value: string | null) {
    dispatch({ type: 'setDetail', field, value });
    if (field === 'title') setIdTaken(null);
  }

  function changePlanId(value: string) {
    setIdTaken(null);
    dispatch({ type: 'setPlanId', value });
  }

  // ---- Saving -----------------------------------------------------------

  /** Reads the plan back after a save, so the editor holds real ids and a fresh `updatedAt`. */
  async function refresh(planId: string): Promise<boolean> {
    try {
      const fresh = await loadPlanForEditing(planId);
      if (!fresh) return false;
      setSnapshot(fresh);
      reservedIds.current.clear();
      dispatch({ type: 'loaded', plan: fresh.plan, days: fresh.days });
      return true;
    } catch {
      return false;
    }
  }

  function describeFailure(error: unknown): string {
    if (error instanceof PlanIdTakenError) {
      setIdTaken(error.planId);
      setTab('details');
      return `The ID "${error.planId}" is already used by another plan. Choose a different ID on the Details tab.`;
    }
    if (error instanceof PlanConflictError) {
      setConflict(true);
      return 'Someone else saved this plan while you were editing it. Reload to see their version before you save again.';
    }
    if (error instanceof PlanMissingError) {
      setMissing(true);
      return 'This plan no longer exists. It may have been deleted by someone else.';
    }
    return SAVE_RETRY_MESSAGE;
  }

  /** Saves the details and every day, applying a status change in the same write. */
  async function persist(change: PlanStatusChange | null): Promise<boolean> {
    setShowErrors(true);
    if (!canSave) {
      setSaveError(
        'Some things need fixing before this can be saved. They are marked on the Details and Days tabs.'
      );
      return false;
    }
    // A plan that is, or will be, published or scheduled must keep a
    // description and a day. The days are written before the plan, so this has
    // to be refused here: refused by the rules it would be too late, with the
    // last day already deleted. See liveSaveProblem().
    const liveProblem = (change === null ? live : isGoingLive(change))
      ? liveSaveProblem(state.details, state.days)
      : null;
    if (liveProblem) {
      setSaveError(
        `${liveProblem.message} A published or scheduled plan has to keep both a description and a day. To empty it out, unpublish it (or cancel its schedule) first.`
      );
      setTab(liveProblem.tab);
      return false;
    }
    setSaving(true);
    setSaveError(null);
    setDialogError(null);
    try {
      const days = state.days.map((day) => {
        const id =
          day.id ??
          reservedIds.current.get(day.key) ??
          (() => {
            const fresh = newDayId(state.planId);
            reservedIds.current.set(day.key, fresh);
            return fresh;
          })();
        return { ...day, id };
      });
      await savePlan({
        mode: state.mode,
        planId: state.planId,
        details: detailsForStorage(state.details),
        days,
        loaded: snapshot,
        status: change,
        uid,
      });
    } catch (error) {
      const message = describeFailure(error);
      setSaveError(message);
      setDialogError(message);
      setSaving(false);
      return false;
    }

    const refreshed = await refresh(state.planId);
    setSaving(false);
    setShowErrors(false);
    if (!refreshed) {
      setSaveError(
        'Saved, but the plan could not be read back. Reload the page before you edit it again.'
      );
      setConflict(true);
    }
    toast.notify({
      severity: 'success',
      message:
        change?.to === 'published'
          ? 'Published. Members can see the plan now.'
          : change?.to === 'scheduled'
            ? 'Scheduled. The plan will appear for members at the time you chose.'
            : 'Plan saved.',
    });
    if (isNew) {
      navigate(`/plans/${state.planId}/edit?tab=${tab}`, { replace: true });
    }
    return true;
  }

  async function runStatusChange(change: PlanStatusChange, success: string) {
    if (!plan) return;
    setSaving(true);
    setSaveError(null);
    setDialogError(null);
    try {
      await setPlanStatus(plan, change);
      const fresh = await loadPlanDocument(plan.id);
      // Only the plan document changed; the days the editor holds are still right.
      if (fresh && snapshot) setSnapshot({ plan: fresh, days: snapshot.days });
      setDialog(null);
      toast.notify({ severity: 'success', message: success });
    } catch (error) {
      const message = describeFailure(error);
      setSaveError(message);
      setDialogError(message);
    } finally {
      setSaving(false);
    }
  }

  async function confirmStatus(action: 'unpublish' | 'archive' | 'restore') {
    if (action === 'unpublish') {
      await runStatusChange(
        { to: 'draft' },
        'Unpublished. Members can no longer see the plan.'
      );
    } else if (action === 'archive') {
      await runStatusChange({ to: 'archived' }, 'Archived. The plan is hidden but kept.');
    } else {
      await runStatusChange({ to: 'draft' }, 'Restored as a draft.');
    }
  }

  async function confirmDelete() {
    if (!plan) return;
    setSaving(true);
    try {
      const { leftoverDays } = await deletePlan(plan.id, plan.title);
      setDialog(null);
      toast.notify({
        severity: leftoverDays > 0 ? 'warning' : 'success',
        message:
          leftoverDays > 0
            ? `Deleted "${plan.title}". ${leftoverDays} of its days could not be removed; they are hidden and harmless.`
            : `Deleted "${plan.title}".`,
      });
      navigate('/plans');
    } catch {
      setDialogError(SAVE_RETRY_MESSAGE);
    } finally {
      setSaving(false);
    }
  }

  async function confirmDuplicate() {
    if (!plan) return;
    const title = copyTitle.trim();
    if (!title) return;
    setSaving(true);
    setDialogError(null);
    try {
      const id = await firstFreeId(slugify(title), planIdExists);
      await duplicatePlan({ sourceId: plan.id, newId: id, newTitle: title, uid });
      setDialog(null);
      toast.notify({ severity: 'success', message: `Copied as a draft: "${title}".` });
      navigate(`/plans/${id}/edit`);
    } catch (error) {
      setDialogError(describeFailure(error));
    } finally {
      setSaving(false);
    }
  }

  function openDialog(next: Dialog) {
    setDialogError(null);
    if (next?.kind === 'duplicate') {
      setCopyTitle(`${state.details.title.trim()} (copy)`);
    }
    setDialog(next);
  }

  function fix(issue: ReadinessIssue) {
    setDialog(null);
    setShowErrors(true);
    setTab(issue.tab);
    if (issue.dayKey) dispatch({ type: 'selectDay', key: issue.dayKey });
  }

  // ---- Render -----------------------------------------------------------

  const removing =
    dialog?.kind === 'removeDay'
      ? state.days.find((day) => day.key === dialog.key)
      : undefined;
  const removingNumber = removing ? state.days.indexOf(removing) + 1 : 0;

  return (
    <PageContainer width="wide" testId="plan-editor-page">
      <AdminPageHeader
        eyebrow={isNew ? undefined : 'Reading plan'}
        title={
          isNew
            ? 'New Reading Plan'
            : state.details.title.trim() || plan?.title || 'Reading Plan'
        }
        breadcrumbs={[
          { label: 'Reading Plans', to: '/plans' },
          { label: isNew ? 'New' : 'Edit' },
        ]}
      />

      {conflict ? (
        <Alert
          severity="warning"
          sx={{ mb: 2 }}
          data-testid="plan-conflict"
          action={
            <Button color="inherit" size="small" onClick={() => window.location.reload()}>
              Reload
            </Button>
          }
        >
          {saveError ??
            'This plan was changed somewhere else. Reload to see the latest before you save again.'}
        </Alert>
      ) : missing ? (
        <Alert severity="error" sx={{ mb: 2 }} data-testid="plan-missing">
          {saveError}
        </Alert>
      ) : saveError ? (
        <Alert severity="error" sx={{ mb: 2 }} data-testid="plan-save-error">
          {saveError}
        </Alert>
      ) : null}

      <PlanStatusBar
        status={status}
        statusLabel={statusLabel}
        isNew={isNew}
        dirty={state.dirty}
        saving={saving}
        uploading={uploading}
        readOnly={readOnly}
        onSave={() => void persist(null)}
        onPublish={() => {
          setShowErrors(true);
          openDialog({ kind: 'publish' });
        }}
        onSchedule={() => {
          setShowErrors(true);
          openDialog({ kind: 'schedule' });
        }}
        onUnpublish={() => openDialog({ kind: 'status', action: 'unpublish' })}
        onArchive={() => openDialog({ kind: 'status', action: 'archive' })}
        onRestore={() => openDialog({ kind: 'status', action: 'restore' })}
        onDuplicate={() => openDialog({ kind: 'duplicate' })}
        onDelete={() => openDialog({ kind: 'delete' })}
      />

      <Tabs
        value={tab}
        onChange={(_event, value: TabId) => setTab(value)}
        aria-label="Plan sections"
        variant="scrollable"
        scrollButtons="auto"
        sx={{ mb: 3 }}
      >
        <Tab
          value="details"
          label="Details"
          id="plan-tab-details"
          aria-controls="plan-panel-details"
          data-testid="plan-tab-details"
        />
        <Tab
          value="days"
          label={`Days (${state.days.length})`}
          id="plan-tab-days"
          aria-controls="plan-panel-days"
          data-testid="plan-tab-days"
        />
        <Tab
          value="preview"
          label="Preview"
          id="plan-tab-preview"
          aria-controls="plan-panel-preview"
          data-testid="plan-tab-preview"
        />
      </Tabs>

      {showErrors && issueCount > 0 && !readOnly ? (
        <Alert severity="info" sx={{ mb: 2 }} data-testid="plan-issue-summary">
          {issueCount} {issueCount === 1 ? 'thing needs' : 'things need'} attention before
          this plan can be published.
        </Alert>
      ) : null}

      {/* Inert while a save is in flight: the plan is read back afterwards,
          and anything typed in between would be replaced by what was saved. */}
      <Box
        role="tabpanel"
        id={`plan-panel-${tab}`}
        aria-labelledby={`plan-tab-${tab}`}
        aria-busy={saving}
        inert={saving}
        tabIndex={0}
        sx={{ '&:focus': { outline: 'none' }, opacity: saving ? 0.6 : 1 }}
      >
        {tab === 'details' ? (
          <Box sx={{ maxWidth: 760 }}>
            <PlanDetailsTab
              details={state.details}
              errors={detailErrors}
              planId={state.planId}
              mode={state.mode}
              idError={
                idTaken ? `The ID "${idTaken}" is already used by another plan.` : null
              }
              readOnly={readOnly}
              showErrors={showErrors}
              onChange={setDetail}
              onChangePlanId={changePlanId}
              onUploadingChange={setUploading}
            />
          </Box>
        ) : null}

        {tab === 'days' ? (
          <PlanDaysTab
            days={state.days}
            selectedKey={state.selectedKey}
            live={live && !readOnly}
            readOnly={readOnly}
            showErrors={showErrors}
            onAdd={() => dispatch({ type: 'addDay' })}
            onAddSeveral={(count) => dispatch({ type: 'addDays', count })}
            onOpen={(key) => dispatch({ type: 'selectDay', key })}
            onMove={(key, direction) => dispatch({ type: 'moveDay', key, direction })}
            onDuplicate={(key) => dispatch({ type: 'duplicateDay', key })}
            onRemove={(key) => openDialog({ kind: 'removeDay', key })}
          />
        ) : null}

        {tab === 'preview' ? (
          <PlanPreviewTab
            details={state.details}
            days={state.days}
            visibleToMembers={visible}
          />
        ) : null}
      </Box>

      <DayDrawer
        open={selectedDay !== null}
        day={selectedDay}
        dayNumber={selectedIndex + 1}
        dayCount={state.days.length}
        language={state.details.language}
        readOnly={readOnly}
        showErrors={showErrors}
        onChange={(patch) => {
          if (selectedDay) dispatch({ type: 'updateDay', key: selectedDay.key, patch });
        }}
        onClose={() => dispatch({ type: 'selectDay', key: null })}
        onPrevious={() => {
          const previous = state.days[selectedIndex - 1];
          if (previous) dispatch({ type: 'selectDay', key: previous.key });
        }}
        onNext={() => {
          const next = state.days[selectedIndex + 1];
          if (next) dispatch({ type: 'selectDay', key: next.key });
        }}
      />

      <PublishDialog
        key={dialog?.kind === 'schedule' ? 'schedule' : 'publish'}
        open={dialog?.kind === 'publish' || dialog?.kind === 'schedule'}
        mode={dialog?.kind === 'schedule' ? 'schedule' : 'publish'}
        planTitle={state.details.title.trim()}
        dayCount={state.days.length}
        issues={readiness}
        busy={saving}
        error={dialogError}
        now={now}
        onClose={() => setDialog(null)}
        onConfirm={(change) => {
          void persist(change).then((done) => {
            if (done) setDialog(null);
          });
        }}
        onFix={fix}
      />

      <ConfirmDialog
        open={dialog?.kind === 'status'}
        title={
          dialog?.kind === 'status'
            ? dialog.action === 'unpublish'
              ? 'Unpublish this plan?'
              : dialog.action === 'archive'
                ? 'Archive this plan?'
                : 'Restore this plan as a draft?'
            : ''
        }
        confirmLabel={
          dialog?.kind === 'status'
            ? dialog.action === 'unpublish'
              ? 'Unpublish'
              : dialog.action === 'archive'
                ? 'Archive'
                : 'Restore'
            : 'Confirm'
        }
        destructive={dialog?.kind === 'status' && dialog.action !== 'restore'}
        busy={saving}
        onCancel={() => setDialog(null)}
        onConfirm={() => {
          if (dialog?.kind === 'status') void confirmStatus(dialog.action);
        }}
        confirmTestId="plan-status-confirm"
      >
        {dialog?.kind === 'status' && dialog.action === 'restore'
          ? 'It becomes a draft again. Members still cannot see it until you publish it.'
          : 'Members will no longer see this plan in the app. Their saved progress is kept, and you can publish it again at any time.'}
        {dialogError ? (
          <Alert severity="error" sx={{ mt: 2 }}>
            {dialogError}
          </Alert>
        ) : null}
      </ConfirmDialog>

      <ConfirmDialog
        open={dialog?.kind === 'delete'}
        title="Delete this plan?"
        confirmLabel="Delete plan"
        destructive
        busy={saving}
        onCancel={() => setDialog(null)}
        onConfirm={() => void confirmDelete()}
        confirmTestId="plan-delete-confirm"
      >
        “{plan?.title}” and its {plan?.dayCount ?? 0} days will be deleted for good.
        Members will no longer see it, and anyone part-way through it will lose their
        place in the plan list. This cannot be undone. If you only want to hide it,
        archive it instead.
        {dialogError ? (
          <Alert severity="error" sx={{ mt: 2 }}>
            {dialogError}
          </Alert>
        ) : null}
      </ConfirmDialog>

      <ConfirmDialog
        open={dialog?.kind === 'removeDay'}
        title={`Delete day ${removingNumber}?`}
        confirmLabel="Delete day"
        destructive
        onCancel={() => setDialog(null)}
        onConfirm={() => {
          if (dialog?.kind === 'removeDay')
            dispatch({ type: 'removeDay', key: dialog.key });
          setDialog(null);
        }}
        confirmTestId="plan-day-delete-confirm"
      >
        {removing?.title.trim() ? `“${removing.title.trim()}” ` : 'This day '}
        will be removed from the plan when you save. The days after it move up one place
        {live ? ', which changes which day members have finished' : ''}.
      </ConfirmDialog>

      <ConfirmDialog
        open={dialog?.kind === 'duplicate'}
        title="Duplicate this plan?"
        confirmLabel="Make a copy"
        busy={saving}
        onCancel={() => setDialog(null)}
        onConfirm={() => void confirmDuplicate()}
        confirmTestId="plan-duplicate-confirm"
      >
        <>
          A copy of the saved plan and all its days is made as a new draft. Members cannot
          see it until you publish it.
          <TextField
            label="Title of the copy"
            fullWidth
            margin="normal"
            value={copyTitle}
            onChange={(event) => setCopyTitle(event.target.value)}
            slotProps={{ htmlInput: { 'data-testid': 'plan-duplicate-title' } }}
          />
          {dialogError ? <Alert severity="error">{dialogError}</Alert> : null}
        </>
      </ConfirmDialog>
    </PageContainer>
  );
}
