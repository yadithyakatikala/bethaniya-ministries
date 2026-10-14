import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';

// Each test renders MUI pages; under a full parallel run they take far longer than alone.
vi.setConfig({ testTimeout: 30_000 });

vi.mock('../../../services/firebase/app', () => ({ db: {}, auth: {}, functions: {} }));
vi.mock('../../../services/firebase/plans', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../services/firebase/plans')>()),
  savePlan: vi.fn(),
  loadPlanForEditing: vi.fn(),
  loadPlanDocument: vi.fn(),
  planIdExists: vi.fn(),
  newDayId: vi.fn(),
  setPlanStatus: vi.fn(),
  deletePlan: vi.fn(),
  duplicatePlan: vi.fn(),
  subscribeToPlans: vi.fn(),
}));
vi.mock('../../../services/media/cloudinaryConfig', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../services/media/cloudinaryConfig')>()),
  getCloudinaryConfig: vi.fn(),
}));

import * as plans from '../../../services/firebase/plans';
import type { LoadedPlan } from '../../../services/firebase/plans';
import { getCloudinaryConfig } from '../../../services/media/cloudinaryConfig';
import { MISSING, deferred } from '../../../components/media/__tests__/helpers';
import { useAuthStore } from '../../../store/authStore';
import {
  LegacyDaysRedirect,
  LegacyEditDayRedirect,
  LegacyNewDayRedirect,
  PlanEditorPage,
} from '../PlanEditorPage';
import { installFakePlans, resetBackend, seedPlan } from './fakePlansBackend';
import { renderPlans } from './render';

const loadPlanForEditing = vi.mocked(plans.loadPlanForEditing);

function renderAt(path: string, role: 'content_admin' | 'host' = 'content_admin') {
  useAuthStore.setState({ user: { uid: 'admin-1', email: 'a@x.org' } as never, role });
  return renderPlans(
    <Routes>
      <Route path="/plans" element={<p data-testid="plans-list-stub">The plan list</p>} />
      <Route path="/plans/new" element={<PlanEditorPage mode="create" />} />
      <Route path="/plans/:id/edit" element={<PlanEditorPage mode="edit" />} />
      <Route path="/plans/:planId/days" element={<LegacyDaysRedirect />} />
      <Route path="/plans/:planId/days/new" element={<LegacyNewDayRedirect />} />
      <Route path="/plans/:planId/days/:dayId/edit" element={<LegacyEditDayRedirect />} />
    </Routes>,
    path
  );
}

const location = () => screen.getByTestId('location');

beforeEach(() => {
  vi.clearAllMocks();
  resetBackend();
  installFakePlans(vi.mocked(plans));
  vi.mocked(getCloudinaryConfig).mockReturnValue(MISSING);
});

describe('opening a plan', () => {
  it('shows that it is loading, then the editor', async () => {
    const pending = deferred<LoadedPlan | null>();
    loadPlanForEditing.mockReturnValueOnce(pending.promise);
    const loaded = seedPlan();
    renderAt('/plans/seven-days-in-the-psalms/edit');
    expect(screen.getByTestId('plan-editor-loading')).toBeInTheDocument();
    expect(screen.queryByTestId('plan-status-bar')).not.toBeInTheDocument();

    await act(async () => {
      pending.resolve(loaded);
    });
    expect(await screen.findByTestId('plan-status-bar')).toBeInTheDocument();
    expect(screen.queryByTestId('plan-editor-loading')).not.toBeInTheDocument();
    expect(screen.getByTestId('plan-title')).toHaveValue('Seven Days in the Psalms');
    expect(loadPlanForEditing).toHaveBeenCalledWith('seven-days-in-the-psalms');
  });

  it('says plainly when there is no such plan, and links back to the list', async () => {
    renderAt('/plans/no-such-plan/edit');
    const alert = await screen.findByTestId('plan-editor-missing');
    expect(alert).toHaveTextContent(
      'There is no reading plan with the ID “no-such-plan”.'
    );
    expect(screen.getByRole('link', { name: 'Back to plans' })).toHaveAttribute(
      'href',
      '/plans'
    );
    expect(screen.queryByTestId('plan-status-bar')).not.toBeInTheDocument();
  });

  it('says so when the plan cannot be read, and tries again on request', async () => {
    const user = userEvent.setup();
    seedPlan();
    loadPlanForEditing.mockRejectedValueOnce(new Error('offline'));
    renderAt('/plans/seven-days-in-the-psalms/edit');
    expect(await screen.findByTestId('plan-editor-error')).toHaveTextContent(
      'This plan could not be loaded. Check your connection and try again.'
    );

    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByTestId('plan-status-bar')).toBeInTheDocument();
    expect(loadPlanForEditing).toHaveBeenCalledTimes(2);
  });

  it('opens a plan written before the manager, with no status, language or author', async () => {
    seedPlan({
      id: 'old-plan',
      title: 'Old plan',
      status: null,
      published: true,
      language: null,
      author: '',
      subtitle: '',
      estimatedMinutes: null,
      createdBy: null,
      coverImageUrl: null,
    });
    renderAt('/plans/old-plan/edit');
    await screen.findByTestId('plan-status-bar');
    // It is live, and says so.
    expect(screen.getByTestId('plan-status-chip')).toHaveTextContent('Published');
    // Read as English, the language the app starts in.
    expect(screen.getByRole('combobox', { name: /Language/ })).toHaveTextContent(
      'English'
    );
    expect(screen.getByTestId('plan-author')).toHaveValue('');
  });

  it('loads a different plan when the address changes to one', async () => {
    seedPlan({ id: 'first-plan', title: 'First plan' });
    seedPlan({ id: 'second-plan', title: 'Second plan' });
    const first = renderAt('/plans/first-plan/edit');
    expect(await screen.findByTestId('plan-title')).toHaveValue('First plan');
    first.unmount();
    renderAt('/plans/second-plan/edit');
    await waitFor(() =>
      expect(screen.getByTestId('plan-title')).toHaveValue('Second plan')
    );
  });
});

describe('who can start a new plan', () => {
  it('shows the editor to a content administrator', () => {
    renderAt('/plans/new');
    expect(screen.getByTestId('plan-editor-page')).toBeInTheDocument();
    expect(screen.getByTestId('plan-save')).toBeInTheDocument();
  });

  it('sends a host back to the list rather than showing a form they cannot save', () => {
    renderAt('/plans/new', 'host');
    expect(location()).toHaveTextContent(/^\/plans$/);
    expect(screen.getByTestId('plans-list-stub')).toBeInTheDocument();
  });
});

describe('the addresses of the old one-day-at-a-time pages', () => {
  it('sends the days list to the Days tab of the plan', async () => {
    seedPlan();
    renderAt('/plans/seven-days-in-the-psalms/days');
    await waitFor(() =>
      expect(location()).toHaveTextContent(
        '/plans/seven-days-in-the-psalms/edit?tab=days'
      )
    );
    expect(await screen.findByTestId('plan-days-tab')).toBeInTheDocument();
  });

  it('sends "new day" to a new day, open for writing', async () => {
    seedPlan();
    renderAt('/plans/seven-days-in-the-psalms/days/new');
    await waitFor(() =>
      expect(location()).toHaveTextContent(
        '/plans/seven-days-in-the-psalms/edit?tab=days&newDay=1'
      )
    );
    expect(await screen.findByRole('dialog', { name: /Day 3 of 3/ })).toBeInTheDocument();
  });

  it('sends "edit day" to that day, open for editing', async () => {
    seedPlan();
    renderAt('/plans/seven-days-in-the-psalms/days/day-2/edit');
    await waitFor(() =>
      expect(location()).toHaveTextContent(
        '/plans/seven-days-in-the-psalms/edit?tab=days&day=day-2'
      )
    );
    expect(await screen.findByRole('dialog', { name: /Day 2 of 2/ })).toBeInTheDocument();
    expect(screen.getByTestId('day-title')).toHaveValue('Out of the depths');
  });

  it('carries an unusual day ID through intact', async () => {
    seedPlan({}, [{ id: 'a b&c', dayNumber: 1, title: 'Odd id' }]);
    renderAt('/plans/seven-days-in-the-psalms/days/a%20b%26c/edit');
    expect(await screen.findByRole('dialog', { name: /Day 1 of 1/ })).toBeInTheDocument();
    expect(screen.getByTestId('day-title')).toHaveValue('Odd id');
  });

  it('shows the not-found message for an old address that names a plan that is gone', async () => {
    renderAt('/plans/gone/days');
    expect(await screen.findByTestId('plan-editor-missing')).toBeInTheDocument();
  });
});
