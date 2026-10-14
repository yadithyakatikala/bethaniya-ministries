import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Chip,
  IconButton,
  InputAdornment,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
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
import AddOutlined from '@mui/icons-material/AddOutlined';
import ContentCopyOutlined from '@mui/icons-material/ContentCopyOutlined';
import DeleteOutlined from '@mui/icons-material/DeleteOutlined';
import EditOutlined from '@mui/icons-material/EditOutlined';
import ImageOutlined from '@mui/icons-material/ImageOutlined';
import Inventory2Outlined from '@mui/icons-material/Inventory2Outlined';
import MoreVertOutlined from '@mui/icons-material/MoreVertOutlined';
import RestoreOutlined from '@mui/icons-material/RestoreOutlined';
import ScheduleOutlined from '@mui/icons-material/ScheduleOutlined';
import SearchOutlined from '@mui/icons-material/SearchOutlined';
import VisibilityOffOutlined from '@mui/icons-material/VisibilityOffOutlined';
import VisibilityOutlined from '@mui/icons-material/VisibilityOutlined';
import MenuBookOutlined from '@mui/icons-material/MenuBookOutlined';
import { AdminEmptyState } from '../../components/AdminEmptyState';
import { AdminPageHeader } from '../../components/AdminPageHeader';
import { AdminTableCard } from '../../components/AdminTableCard';
import {
  ConfirmDialog,
  PageContainer,
  StatusChip,
  TableSkeleton,
  useToast,
} from '../../components/ui';
import { useAuthStore } from '../../store/authStore';
import {
  deletePlan,
  duplicatePlan,
  loadPlanForEditing,
  planIdExists,
  setPlanStatus,
  subscribeToPlans,
} from '../../services/firebase/plans';
import { SAVE_RETRY_MESSAGE } from '../../services/firebase/saveErrors';
import { adminColors, adminRadii } from '../../theme/tokens';
import type { Plan, PlanStatus } from '../../types';
import { useNow } from '../prophet-verses/useNow';
import { canManagePlans } from './planPermissions';
import { PublishDialog } from './PublishDialog';
import { dayFromDocument } from './planDays';
import { detailsFromPlan, firstFreeId, languageLabel, slugify } from './planDetails';
import {
  NO_FILTERS,
  STATUS_FILTERS,
  countByStatus,
  filterPlans,
  hasActiveFilters,
  type LanguageFilter,
  type PlanFilters,
  type StatusFilter,
} from './planFilters';
import { planReadiness, type ReadinessIssue } from './planReadiness';
import { planStatusOf, statusLabelFor, type PlanStatusChange } from './planStatus';

type Action =
  | null
  | {
      kind: 'publish' | 'schedule';
      plan: Plan;
      issues: ReadinessIssue[];
      dayCount: number;
    }
  | { kind: 'unpublish' | 'archive' | 'restore' | 'delete'; plan: Plan }
  | { kind: 'duplicate'; plan: Plan };

const DATE = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

/**
 * The reading plans: every plan, where it stands, and what can be done to it.
 *
 * Writing a plan happens in its own editor (./PlanEditor.tsx); this page is
 * for finding one and for the quick moves that do not need the editor --
 * publish, unpublish, archive, duplicate, delete. Publishing from here runs
 * the same readiness checks as the editor, over the plan as saved, so a plan
 * with a day missing its reading cannot be published from a shortcut either.
 *
 * Content administrators and above may change plans. A host reads the same
 * list (firestore.rules allows it) and gets "View" in place of the actions.
 */
export function PlansListPage() {
  const role = useAuthStore((s) => s.role);
  const uid = useAuthStore((s) => s.user?.uid ?? '');
  const canManage = canManagePlans(role);
  const navigate = useNavigate();
  const toast = useToast();
  const now = useNow();

  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<PlanFilters>(NO_FILTERS);
  const [menu, setMenu] = useState<{ anchor: HTMLElement; plan: Plan } | null>(null);
  const [action, setAction] = useState<Action>(null);
  const [copyTitle, setCopyTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToPlans(
      (next) => {
        setPlans(next);
        setError(null);
      },
      () => setError('Could not load reading plans. Please try again.')
    );
    return unsubscribe;
  }, []);

  const shown = useMemo(
    () => (plans ? filterPlans(plans, filters, now) : []),
    [plans, filters, now]
  );
  const counts = useMemo(() => (plans ? countByStatus(plans, now) : null), [plans, now]);

  function begin(next: Action) {
    setActionError(null);
    setAction(next);
  }

  /** Loads the saved plan and checks it is ready to go live before offering to. */
  async function startGoingLive(plan: Plan, kind: 'publish' | 'schedule') {
    setMenu(null);
    setBusy(true);
    try {
      const loaded = await loadPlanForEditing(plan.id);
      if (!loaded) {
        toast.notify({ severity: 'error', message: 'That plan no longer exists.' });
        return;
      }
      const issues = planReadiness(
        detailsFromPlan(loaded.plan),
        loaded.days.map((day) => dayFromDocument(`saved-${day.id}`, day))
      );
      begin({ kind, plan: loaded.plan, issues, dayCount: loaded.days.length });
    } catch {
      toast.notify({
        severity: 'error',
        message: 'Could not check the plan. Please try again.',
      });
    } finally {
      setBusy(false);
    }
  }

  async function apply(plan: Plan, change: PlanStatusChange, success: string) {
    setBusy(true);
    setActionError(null);
    try {
      await setPlanStatus(plan, change);
      setAction(null);
      toast.notify({ severity: 'success', message: success });
    } catch {
      setActionError(SAVE_RETRY_MESSAGE);
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete(plan: Plan) {
    setBusy(true);
    setActionError(null);
    try {
      const { leftoverDays } = await deletePlan(plan.id, plan.title);
      setAction(null);
      toast.notify({
        severity: leftoverDays > 0 ? 'warning' : 'success',
        message:
          leftoverDays > 0
            ? `Deleted "${plan.title}". ${leftoverDays} of its days could not be removed; they are hidden and harmless.`
            : `Deleted "${plan.title}".`,
      });
    } catch {
      setActionError(SAVE_RETRY_MESSAGE);
    } finally {
      setBusy(false);
    }
  }

  async function confirmDuplicate(plan: Plan) {
    const title = copyTitle.trim();
    if (!title) return;
    setBusy(true);
    setActionError(null);
    try {
      const id = await firstFreeId(slugify(title), planIdExists);
      await duplicatePlan({ sourceId: plan.id, newId: id, newTitle: title, uid });
      setAction(null);
      toast.notify({ severity: 'success', message: `Copied as a draft: "${title}".` });
      navigate(`/plans/${id}/edit`);
    } catch {
      setActionError(SAVE_RETRY_MESSAGE);
    } finally {
      setBusy(false);
    }
  }

  function fix(issue: ReadinessIssue) {
    const plan = action && 'plan' in action ? action.plan : null;
    setAction(null);
    if (!plan) return;
    const dayId = issue.dayKey?.replace(/^saved-/, '');
    navigate(
      `/plans/${plan.id}/edit?tab=${issue.tab}${dayId ? `&day=${encodeURIComponent(dayId)}` : ''}`
    );
  }

  return (
    <PageContainer testId="plans-list-page">
      <AdminPageHeader
        title="Reading Plans"
        subtitle="Write Bible reading plans, check how they will look, and publish them for the congregation."
        action={
          canManage ? (
            <Button
              variant="contained"
              component={RouterLink}
              to="/plans/new"
              startIcon={<AddOutlined />}
              data-testid="new-plan-button"
            >
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
        <TableSkeleton testId="plans-loading" label="Loading plans" />
      ) : null}

      {plans && plans.length === 0 ? (
        <AdminEmptyState
          testId="plans-empty"
          icon={<MenuBookOutlined />}
          title="No reading plans yet"
          message={
            canManage
              ? 'A plan is a Bible reading for each day, with a devotional, a question and a prayer if you like. Start one, and publish it when it is ready.'
              : 'No reading plans have been created yet.'
          }
          action={
            canManage ? (
              <Button
                variant="contained"
                component={RouterLink}
                to="/plans/new"
                startIcon={<AddOutlined />}
              >
                Create the first plan
              </Button>
            ) : undefined
          }
        />
      ) : null}

      {plans && plans.length > 0 ? (
        <>
          <Box
            sx={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 2,
              alignItems: 'center',
              mb: 2,
            }}
          >
            <TextField
              size="small"
              placeholder="Search plans"
              value={filters.query}
              onChange={(event) => setFilters({ ...filters, query: event.target.value })}
              sx={{ minWidth: { xs: '100%', sm: 280 } }}
              slotProps={{
                htmlInput: {
                  'aria-label': 'Search plans',
                  'data-testid': 'plans-search',
                },
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchOutlined fontSize="small" />
                    </InputAdornment>
                  ),
                },
              }}
            />
            <Stack
              direction="row"
              spacing={1}
              useFlexGap
              role="group"
              aria-label="Filter by status"
              sx={{ flexWrap: 'wrap' }}
            >
              {STATUS_FILTERS.map((option) => (
                <Chip
                  key={option.value}
                  label={`${option.label}${counts ? ` · ${counts[option.value]}` : ''}`}
                  clickable
                  color={filters.status === option.value ? 'primary' : 'default'}
                  variant={filters.status === option.value ? 'filled' : 'outlined'}
                  aria-pressed={filters.status === option.value}
                  onClick={() =>
                    setFilters({ ...filters, status: option.value as StatusFilter })
                  }
                  data-testid={`plans-filter-${option.value}`}
                />
              ))}
            </Stack>
            <TextField
              select
              size="small"
              label="Language"
              value={filters.language}
              onChange={(event) =>
                setFilters({ ...filters, language: event.target.value as LanguageFilter })
              }
              sx={{ minWidth: 140 }}
              slotProps={{ htmlInput: { 'data-testid': 'plans-language-filter' } }}
            >
              <MenuItem value="all">All languages</MenuItem>
              <MenuItem value="en">English</MenuItem>
              <MenuItem value="te">Telugu</MenuItem>
            </TextField>
          </Box>

          {shown.length === 0 ? (
            <AdminEmptyState
              testId="plans-no-results"
              message="No plans match what you chose."
              action={
                hasActiveFilters(filters) ? (
                  <Button onClick={() => setFilters(NO_FILTERS)}>Clear filters</Button>
                ) : undefined
              }
            />
          ) : (
            <AdminTableCard>
              <TableContainer>
                <Table size="medium">
                  <TableHead>
                    <TableRow>
                      <TableCell>Plan</TableCell>
                      <TableCell>About</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>
                        Updated
                      </TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {shown.map((plan) => {
                      const status = planStatusOf(plan, now);
                      return (
                        <TableRow key={plan.id} hover data-testid={`plan-row-${plan.id}`}>
                          <TableCell>
                            <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
                              <Box
                                sx={{
                                  width: 56,
                                  height: 40,
                                  flexShrink: 0,
                                  borderRadius: `${adminRadii.control}px`,
                                  overflow: 'hidden',
                                  bgcolor: adminColors.surfaceRaised,
                                  display: 'grid',
                                  placeItems: 'center',
                                  color: adminColors.inkSubtle,
                                }}
                              >
                                {plan.coverImageUrl ? (
                                  <Box
                                    component="img"
                                    src={plan.coverImageUrl}
                                    alt=""
                                    sx={{
                                      width: '100%',
                                      height: '100%',
                                      objectFit: 'cover',
                                    }}
                                  />
                                ) : (
                                  <ImageOutlined fontSize="small" aria-hidden />
                                )}
                              </Box>
                              <Box sx={{ minWidth: 0 }}>
                                <Typography
                                  sx={{ fontWeight: 600, overflowWrap: 'anywhere' }}
                                >
                                  {plan.title || 'Untitled plan'}
                                </Typography>
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                  sx={{
                                    fontFamily: 'monospace',
                                    overflowWrap: 'anywhere',
                                  }}
                                >
                                  {plan.id}
                                </Typography>
                              </Box>
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">
                              {plan.category}
                              {plan.language ? ` · ${languageLabel(plan.language)}` : ''}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {plan.dayCount} {plan.dayCount === 1 ? 'day' : 'days'}
                              {plan.estimatedMinutes
                                ? ` · ${plan.estimatedMinutes} min a day`
                                : ''}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <StatusChip
                              status={status}
                              label={statusLabelFor(plan, now)}
                              testId={`plan-status-${plan.id}`}
                            />
                          </TableCell>
                          <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>
                            <Typography variant="body2" color="text.secondary">
                              {plan.updatedAt ? DATE.format(plan.updatedAt) : '—'}
                            </Typography>
                          </TableCell>
                          <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                            <Button
                              size="small"
                              component={RouterLink}
                              to={`/plans/${plan.id}/edit`}
                              startIcon={<EditOutlined fontSize="small" />}
                              data-testid={`edit-plan-${plan.id}`}
                            >
                              {canManage ? 'Edit' : 'View'}
                            </Button>
                            {canManage ? (
                              <Tooltip title="More actions">
                                <IconButton
                                  aria-label={`More actions for ${plan.title || plan.id}`}
                                  aria-haspopup="menu"
                                  onClick={(event) =>
                                    setMenu({ anchor: event.currentTarget, plan })
                                  }
                                  disabled={busy}
                                  data-testid={`plan-actions-${plan.id}`}
                                >
                                  <MoreVertOutlined fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            ) : null}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            </AdminTableCard>
          )}
        </>
      ) : null}

      <Menu anchorEl={menu?.anchor} open={menu !== null} onClose={() => setMenu(null)}>
        {menu
          ? rowActions(planStatusOf(menu.plan, now)).map((item) => (
              <MenuItem
                key={item.id}
                onClick={() => {
                  const plan = menu.plan;
                  setMenu(null);
                  if (item.id === 'publish' || item.id === 'schedule') {
                    void startGoingLive(plan, item.id);
                  } else if (item.id === 'duplicate') {
                    setCopyTitle(`${plan.title.trim()} (copy)`);
                    begin({ kind: 'duplicate', plan });
                  } else {
                    begin({ kind: item.id, plan });
                  }
                }}
                data-testid={`plan-action-${item.id}-${menu.plan.id}`}
                sx={item.id === 'delete' ? { color: adminColors.danger } : undefined}
              >
                <ListItemIcon sx={{ color: 'inherit' }}>{item.icon}</ListItemIcon>
                <ListItemText>{item.label}</ListItemText>
              </MenuItem>
            ))
          : null}
      </Menu>

      <PublishDialog
        key={action?.kind === 'schedule' ? 'schedule' : 'publish'}
        open={action?.kind === 'publish' || action?.kind === 'schedule'}
        mode={action?.kind === 'schedule' ? 'schedule' : 'publish'}
        planTitle={action && 'plan' in action ? action.plan.title : ''}
        dayCount={action && 'dayCount' in action ? action.dayCount : 0}
        issues={action && 'issues' in action ? action.issues : []}
        busy={busy}
        error={actionError}
        now={now}
        onClose={() => setAction(null)}
        onConfirm={(change) => {
          if (action && 'plan' in action) {
            void apply(
              action.plan,
              change,
              change.to === 'published'
                ? 'Published. Members can see the plan now.'
                : 'Scheduled. The plan will appear for members at the time you chose.'
            );
          }
        }}
        onFix={fix}
      />

      <ConfirmDialog
        open={
          action?.kind === 'unpublish' ||
          action?.kind === 'archive' ||
          action?.kind === 'restore'
        }
        title={
          action?.kind === 'unpublish'
            ? 'Unpublish this plan?'
            : action?.kind === 'archive'
              ? 'Archive this plan?'
              : 'Restore this plan as a draft?'
        }
        confirmLabel={
          action?.kind === 'unpublish'
            ? 'Unpublish'
            : action?.kind === 'archive'
              ? 'Archive'
              : 'Restore'
        }
        destructive={action?.kind !== 'restore'}
        busy={busy}
        onCancel={() => setAction(null)}
        onConfirm={() => {
          if (!action || !('plan' in action)) return;
          if (action.kind === 'unpublish') {
            void apply(
              action.plan,
              { to: 'draft' },
              'Unpublished. Members can no longer see the plan.'
            );
          } else if (action.kind === 'archive') {
            void apply(
              action.plan,
              { to: 'archived' },
              'Archived. The plan is hidden but kept.'
            );
          } else if (action.kind === 'restore') {
            void apply(action.plan, { to: 'draft' }, 'Restored as a draft.');
          }
        }}
        confirmTestId="plan-confirm-status"
      >
        “{action && 'plan' in action ? action.plan.title : ''}”{' '}
        {action?.kind === 'restore'
          ? 'becomes a draft again. Members still cannot see it until you publish it.'
          : 'will no longer be visible to members. Their saved progress is kept, and you can publish it again at any time.'}
        {actionError ? (
          <Alert severity="error" sx={{ mt: 2 }}>
            {actionError}
          </Alert>
        ) : null}
      </ConfirmDialog>

      <ConfirmDialog
        open={action?.kind === 'delete'}
        title="Delete this plan?"
        confirmLabel="Delete plan"
        destructive
        busy={busy}
        onCancel={() => setAction(null)}
        onConfirm={() => {
          if (action?.kind === 'delete') void confirmDelete(action.plan);
        }}
        confirmTestId="confirm-delete-button"
      >
        “{action && 'plan' in action ? action.plan.title : ''}” and its{' '}
        {action && 'plan' in action ? action.plan.dayCount : 0} days will be deleted for
        good. Members will no longer see it. This cannot be undone. If you only want to
        hide it, archive it instead.
        {actionError ? (
          <Alert severity="error" sx={{ mt: 2 }}>
            {actionError}
          </Alert>
        ) : null}
      </ConfirmDialog>

      <ConfirmDialog
        open={action?.kind === 'duplicate'}
        title="Duplicate this plan?"
        confirmLabel="Make a copy"
        busy={busy}
        onCancel={() => setAction(null)}
        onConfirm={() => {
          if (action?.kind === 'duplicate') void confirmDuplicate(action.plan);
        }}
        confirmTestId="plan-confirm-duplicate"
      >
        <>
          A copy of the plan and all its days is made as a new draft. Members cannot see
          it until you publish it.
          <TextField
            label="Title of the copy"
            fullWidth
            margin="normal"
            value={copyTitle}
            onChange={(event) => setCopyTitle(event.target.value)}
            slotProps={{ htmlInput: { 'data-testid': 'plan-copy-title' } }}
          />
          {actionError ? <Alert severity="error">{actionError}</Alert> : null}
        </>
      </ConfirmDialog>
    </PageContainer>
  );
}

interface RowAction {
  id:
    'publish' | 'schedule' | 'unpublish' | 'archive' | 'restore' | 'duplicate' | 'delete';
  label: string;
  icon: ReactNode;
}

const ICON = {
  publish: <VisibilityOutlined fontSize="small" />,
  schedule: <ScheduleOutlined fontSize="small" />,
  unpublish: <VisibilityOffOutlined fontSize="small" />,
  archive: <Inventory2Outlined fontSize="small" />,
  restore: <RestoreOutlined fontSize="small" />,
  duplicate: <ContentCopyOutlined fontSize="small" />,
  delete: <DeleteOutlined fontSize="small" />,
} as const;

/**
 * The quick actions that make sense for a plan in this status -- a published
 * plan is offered Unpublish and never Publish, an archived one only Restore.
 */
function rowActions(status: PlanStatus): RowAction[] {
  const item = (id: RowAction['id'], label: string): RowAction => ({
    id,
    label,
    icon: ICON[id],
  });
  switch (status) {
    case 'draft':
      return [
        item('publish', 'Publish…'),
        item('schedule', 'Schedule…'),
        item('archive', 'Archive…'),
        item('duplicate', 'Duplicate…'),
        item('delete', 'Delete…'),
      ];
    case 'scheduled':
      return [
        item('publish', 'Publish now…'),
        item('schedule', 'Change schedule…'),
        item('unpublish', 'Cancel schedule…'),
        item('archive', 'Archive…'),
        item('duplicate', 'Duplicate…'),
        item('delete', 'Delete…'),
      ];
    case 'published':
      return [
        item('unpublish', 'Unpublish…'),
        item('archive', 'Archive…'),
        item('duplicate', 'Duplicate…'),
        item('delete', 'Delete…'),
      ];
    case 'archived':
      return [
        item('restore', 'Restore as draft'),
        item('duplicate', 'Duplicate…'),
        item('delete', 'Delete…'),
      ];
  }
}
