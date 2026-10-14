import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
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

import * as plans from '../../../services/firebase/plans';
import { SAVE_RETRY_MESSAGE } from '../../../services/firebase/saveErrors';
import { useAuthStore } from '../../../store/authStore';
import { PlansListPage } from '../PlansListPage';
import { installFakePlans, resetBackend, seedPlan, store } from './fakePlansBackend';
import { renderPlans } from './render';

const setPlanStatus = vi.mocked(plans.setPlanStatus);
const deletePlan = vi.mocked(plans.deletePlan);
const duplicatePlan = vi.mocked(plans.duplicatePlan);
const loadPlanForEditing = vi.mocked(plans.loadPlanForEditing);
const subscribeToPlans = vi.mocked(plans.subscribeToPlans);

type Role = 'content_admin' | 'super_admin' | 'host';

function renderList(role: Role = 'content_admin') {
  useAuthStore.setState({ user: { uid: 'admin-1', email: 'a@x.org' } as never, role });
  return renderPlans(
    <Routes>
      <Route path="/plans" element={<PlansListPage />} />
      <Route path="/plans/new" element={<p data-testid="new-plan-stub">New plan</p>} />
      <Route path="/plans/:id/edit" element={<p data-testid="editor-stub">Editor</p>} />
    </Routes>,
    '/plans'
  );
}

/** One plan in each state an administrator meets. */
function seedLibrary() {
  seedPlan({
    id: 'seven-days',
    title: 'Seven Days in the Psalms',
    status: 'draft',
    order: 1,
  });
  seedPlan({
    id: 'gospel-of-john',
    title: 'Gospel of John',
    category: 'Book study',
    status: 'published',
    published: true,
    order: 2,
  });
  seedPlan({
    id: 'advent-hope',
    title: 'Advent Hope',
    language: 'te',
    status: 'scheduled',
    published: false,
    publishAt: new Date('2099-12-01T06:00:00Z'),
    order: 3,
  });
  seedPlan({
    id: 'old-plan',
    title: 'An Old Plan',
    status: null,
    published: true,
    language: null,
    author: '',
    order: 4,
  });
  seedPlan({ id: 'lent', title: 'Lent', status: 'archived', published: false, order: 5 });
}

const row = (id: string) => screen.getByTestId(`plan-row-${id}`);
const statusOf = (id: string) => screen.getByTestId(`plan-status-${id}`);

async function openActions(user: ReturnType<typeof userEvent.setup>, id: string) {
  await user.click(screen.getByTestId(`plan-actions-${id}`));
}

beforeEach(() => {
  vi.clearAllMocks();
  resetBackend();
  installFakePlans(vi.mocked(plans));
});

describe('before there is anything to show', () => {
  it('shows that it is loading', () => {
    subscribeToPlans.mockImplementation(() => () => undefined);
    renderList();
    expect(screen.getByTestId('plans-loading')).toBeInTheDocument();
  });

  it('says when the plans could not be loaded', async () => {
    subscribeToPlans.mockImplementation((_onNext, onError) => {
      onError({ code: 'permission-denied' } as never);
      return () => undefined;
    });
    renderList();
    expect(await screen.findByTestId('plans-error')).toHaveTextContent(
      'Could not load reading plans. Please try again.'
    );
    expect(screen.queryByTestId('plans-loading')).not.toBeInTheDocument();
  });

  it('invites the first plan when there are none', () => {
    renderList();
    expect(screen.getByTestId('plans-empty')).toHaveTextContent('No reading plans yet');
    expect(screen.getByRole('link', { name: 'Create the first plan' })).toHaveAttribute(
      'href',
      '/plans/new'
    );
  });

  it('only says there are none to someone who cannot create one', () => {
    renderList('host');
    expect(screen.getByTestId('plans-empty')).toHaveTextContent(
      'No reading plans have been created yet.'
    );
    expect(
      screen.queryByRole('link', { name: 'Create the first plan' })
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId('new-plan-button')).not.toBeInTheDocument();
  });

  it('stops listening when the page goes away', () => {
    const unsubscribe = vi.fn();
    subscribeToPlans.mockImplementation(() => unsubscribe);
    const view = renderList();
    view.unmount();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});

describe('the list', () => {
  beforeEach(() => {
    seedLibrary();
  });

  it('shows each plan with what an administrator scans for', () => {
    renderList();
    expect(row('seven-days')).toHaveTextContent('Seven Days in the Psalms');
    expect(row('seven-days')).toHaveTextContent('seven-days');
    expect(row('seven-days')).toHaveTextContent('Devotional · English');
    expect(row('seven-days')).toHaveTextContent('2 days · 10 min a day');
    expect(row('advent-hope')).toHaveTextContent('Devotional · Telugu');
    expect(row('gospel-of-john')).toHaveTextContent('Book study');
  });

  it('shows where each stands as members are concerned', () => {
    renderList();
    expect(statusOf('seven-days')).toHaveTextContent('Draft');
    expect(statusOf('gospel-of-john')).toHaveTextContent('Published');
    expect(statusOf('advent-hope')).toHaveTextContent(/Scheduled · 1 Dec 2099/);
    expect(statusOf('lent')).toHaveTextContent('Archived');
  });

  it('shows a plan from before the manager as published, without a language', () => {
    renderList();
    expect(statusOf('old-plan')).toHaveTextContent('Published');
    expect(row('old-plan')).toHaveTextContent('Devotional');
    expect(row('old-plan')).not.toHaveTextContent('English');
  });

  it('shows a scheduled plan whose time has passed as published, because members can read it', () => {
    seedPlan({
      id: 'due',
      title: 'Due already',
      status: 'scheduled',
      published: false,
      publishAt: new Date('2020-01-01T00:00:00Z'),
      order: 6,
    });
    renderList();
    expect(statusOf('due')).toHaveTextContent('Published');
  });

  it('shows a plan without a cover as a placeholder, not a broken picture', () => {
    seedPlan({ id: 'bare', title: 'Bare', coverImageUrl: null, order: 7 });
    renderList();
    expect(within(row('bare')).queryByRole('img')).not.toBeInTheDocument();
    expect(
      within(row('seven-days')).getByRole('presentation', { hidden: true })
    ).toBeInTheDocument();
  });

  it('lists plans in library order', () => {
    renderList();
    const ids = screen
      .getAllByTestId(/^plan-row-/)
      .map((element) => element.getAttribute('data-testid'));
    expect(ids).toEqual([
      'plan-row-seven-days',
      'plan-row-gospel-of-john',
      'plan-row-advent-hope',
      'plan-row-old-plan',
      'plan-row-lent',
    ]);
  });

  it('opens a plan in the editor', async () => {
    const user = userEvent.setup();
    renderList();
    await user.click(screen.getByTestId('edit-plan-gospel-of-john'));
    expect(screen.getByTestId('location')).toHaveTextContent(
      '/plans/gospel-of-john/edit'
    );
  });

  it('starts a new plan', async () => {
    const user = userEvent.setup();
    renderList();
    await user.click(screen.getByTestId('new-plan-button'));
    expect(screen.getByTestId('new-plan-stub')).toBeInTheDocument();
  });

  describe('finding a plan', () => {
    it('counts the plans in each status', () => {
      renderList();
      expect(screen.getByTestId('plans-filter-all')).toHaveTextContent('All · 5');
      expect(screen.getByTestId('plans-filter-draft')).toHaveTextContent('Drafts · 1');
      expect(screen.getByTestId('plans-filter-published')).toHaveTextContent(
        'Published · 2'
      );
      expect(screen.getByTestId('plans-filter-scheduled')).toHaveTextContent(
        'Scheduled · 1'
      );
      expect(screen.getByTestId('plans-filter-archived')).toHaveTextContent(
        'Archived · 1'
      );
    });

    it('shows only the plans in the chosen status', async () => {
      const user = userEvent.setup();
      renderList();
      await user.click(screen.getByTestId('plans-filter-published'));
      expect(screen.getByTestId('plans-filter-published')).toHaveAttribute(
        'aria-pressed',
        'true'
      );
      expect(screen.getAllByTestId(/^plan-row-/)).toHaveLength(2);
      expect(screen.queryByTestId('plan-row-seven-days')).not.toBeInTheDocument();
      expect(screen.getByTestId('plan-row-old-plan')).toBeInTheDocument();
    });

    it('searches titles, IDs and categories', async () => {
      const user = userEvent.setup();
      renderList();
      await user.type(screen.getByTestId('plans-search'), 'john');
      expect(screen.getAllByTestId(/^plan-row-/)).toHaveLength(1);
      expect(row('gospel-of-john')).toBeInTheDocument();

      await user.clear(screen.getByTestId('plans-search'));
      await user.type(screen.getByTestId('plans-search'), 'book study');
      expect(row('gospel-of-john')).toBeInTheDocument();
    });

    it('shows only the plans in the chosen language', async () => {
      const user = userEvent.setup();
      renderList();
      await user.click(screen.getByRole('combobox', { name: 'Language' }));
      await user.click(screen.getByRole('option', { name: 'Telugu' }));
      expect(screen.getAllByTestId(/^plan-row-/)).toHaveLength(1);
      expect(row('advent-hope')).toBeInTheDocument();
    });

    it('says nothing matches, and clears the filters', async () => {
      const user = userEvent.setup();
      renderList();
      await user.type(screen.getByTestId('plans-search'), 'zzzz');
      expect(screen.getByTestId('plans-no-results')).toHaveTextContent(
        'No plans match what you chose.'
      );
      await user.click(screen.getByRole('button', { name: 'Clear filters' }));
      expect(screen.getAllByTestId(/^plan-row-/)).toHaveLength(5);
      expect(screen.getByTestId('plans-search')).toHaveValue('');
    });
  });

  describe('for someone who cannot change plans', () => {
    it('lets them look and nothing else', () => {
      renderList('host');
      expect(screen.getByTestId('edit-plan-seven-days')).toHaveTextContent('View');
      expect(screen.queryByTestId('plan-actions-seven-days')).not.toBeInTheDocument();
      expect(screen.queryByTestId('new-plan-button')).not.toBeInTheDocument();
    });
  });

  describe('the quick actions follow the status', () => {
    const labels = async (user: ReturnType<typeof userEvent.setup>, id: string) => {
      await openActions(user, id);
      const names = (await screen.findAllByRole('menuitem')).map(
        (item) => item.textContent
      );
      await user.keyboard('{Escape}');
      await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
      return names;
    };

    it('offers a draft: publish, schedule, archive, duplicate, delete', async () => {
      const user = userEvent.setup();
      renderList();
      expect(await labels(user, 'seven-days')).toEqual([
        'Publish…',
        'Schedule…',
        'Archive…',
        'Duplicate…',
        'Delete…',
      ]);
    });

    it('offers a published plan unpublishing and never publishing', async () => {
      const user = userEvent.setup();
      renderList();
      const names = await labels(user, 'gospel-of-john');
      expect(names).toEqual(['Unpublish…', 'Archive…', 'Duplicate…', 'Delete…']);
    });

    it('offers a scheduled plan: publish now, reschedule, cancel the schedule', async () => {
      const user = userEvent.setup();
      renderList();
      expect(await labels(user, 'advent-hope')).toEqual([
        'Publish now…',
        'Change schedule…',
        'Cancel schedule…',
        'Archive…',
        'Duplicate…',
        'Delete…',
      ]);
    });

    it('offers an archived plan only to be restored, copied or deleted', async () => {
      const user = userEvent.setup();
      renderList();
      expect(await labels(user, 'lent')).toEqual([
        'Restore as draft',
        'Duplicate…',
        'Delete…',
      ]);
    });
  });

  describe('publishing from the list', () => {
    it('checks the saved plan first and publishes it after a confirmation', async () => {
      const user = userEvent.setup();
      renderList();
      await openActions(user, 'seven-days');
      await user.click(screen.getByTestId('plan-action-publish-seven-days'));

      const dialog = await screen.findByRole('dialog', { name: 'Publish this plan?' });
      expect(loadPlanForEditing).toHaveBeenCalledWith('seven-days');
      expect(dialog).toHaveTextContent('Seven Days in the Psalms (2 days)');
      expect(setPlanStatus).not.toHaveBeenCalled();

      await user.click(within(dialog).getByTestId('publish-confirm'));
      await waitFor(() => expect(setPlanStatus).toHaveBeenCalledTimes(1));
      expect(setPlanStatus.mock.calls[0]![0]).toMatchObject({ id: 'seven-days' });
      expect(setPlanStatus.mock.calls[0]![1]).toEqual({ to: 'published' });
      expect(
        await screen.findByText('Published. Members can see the plan now.')
      ).toBeInTheDocument();
      // The list follows the change.
      await waitFor(() => expect(statusOf('seven-days')).toHaveTextContent('Published'));
    });

    it('will not publish a plan that is not ready, and says exactly what is wrong', async () => {
      const user = userEvent.setup();
      seedPlan({ id: 'rough', title: 'Rough', description: '', order: 0 }, [
        { id: 'r1', title: 'Fine', scriptureReference: 'Psalm 23' },
        { id: 'r2', title: '', scriptureReference: 'Psalm 999' },
      ]);
      renderList();
      await openActions(user, 'rough');
      await user.click(screen.getByTestId('plan-action-publish-rough'));

      const dialog = await screen.findByRole('dialog', {
        name: 'Not ready to publish yet',
      });
      expect(dialog).toHaveTextContent('Write a short description');
      expect(dialog).toHaveTextContent('Day 2: Give this day a title.');
      expect(within(dialog).queryByTestId('publish-confirm')).not.toBeInTheDocument();
      expect(setPlanStatus).not.toHaveBeenCalled();
    });

    it('takes the administrator to the day that needs fixing', async () => {
      const user = userEvent.setup();
      seedPlan({ id: 'rough', title: 'Rough', order: 0 }, [
        { id: 'r1', title: 'Fine', scriptureReference: 'Psalm 23' },
        { id: 'r2', title: 'Broken', scriptureReference: 'Psalm 999' },
      ]);
      renderList();
      await openActions(user, 'rough');
      await user.click(screen.getByTestId('plan-action-publish-rough'));
      await user.click(await screen.findByTestId('publish-fix-saved-r2-passages'));
      await waitFor(() =>
        expect(screen.getByTestId('location')).toHaveTextContent(
          '/plans/rough/edit?tab=days&day=r2'
        )
      );
    });

    it('schedules from the list', async () => {
      const user = userEvent.setup();
      renderList();
      await openActions(user, 'seven-days');
      await user.click(screen.getByTestId('plan-action-schedule-seven-days'));
      const dialog = await screen.findByRole('dialog', { name: 'Schedule this plan?' });
      fireEvent.change(within(dialog).getByTestId('publish-schedule-time'), {
        target: { value: '2099-03-04T07:15' },
      });
      await user.click(within(dialog).getByTestId('publish-confirm'));
      await waitFor(() => expect(setPlanStatus).toHaveBeenCalledTimes(1));
      const change = setPlanStatus.mock.calls[0]![1];
      expect(change.to).toBe('scheduled');
      expect(change.to === 'scheduled' && change.publishAt).toEqual(
        new Date(2099, 2, 4, 7, 15)
      );
      await waitFor(() =>
        expect(statusOf('seven-days')).toHaveTextContent(/Scheduled · 4 Mar 2099/)
      );
    });

    it('says the plan has gone if it was deleted since the list loaded', async () => {
      const user = userEvent.setup();
      renderList();
      loadPlanForEditing.mockResolvedValueOnce(null);
      await openActions(user, 'seven-days');
      await user.click(screen.getByTestId('plan-action-publish-seven-days'));
      expect(await screen.findByText('That plan no longer exists.')).toBeInTheDocument();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('says the plan could not be checked if it could not be read', async () => {
      const user = userEvent.setup();
      renderList();
      loadPlanForEditing.mockRejectedValueOnce(new Error('offline'));
      await openActions(user, 'seven-days');
      await user.click(screen.getByTestId('plan-action-publish-seven-days'));
      expect(
        await screen.findByText('Could not check the plan. Please try again.')
      ).toBeInTheDocument();
    });

    it('stays open with the reason when publishing fails', async () => {
      const user = userEvent.setup();
      renderList();
      setPlanStatus.mockRejectedValueOnce(new Error('offline'));
      await openActions(user, 'seven-days');
      await user.click(screen.getByTestId('plan-action-publish-seven-days'));
      await user.click(await screen.findByTestId('publish-confirm'));
      expect(await screen.findByTestId('publish-error')).toHaveTextContent(
        SAVE_RETRY_MESSAGE
      );
      expect(statusOf('seven-days')).toHaveTextContent('Draft');
    });
  });

  describe('taking a plan back, or out of sight', () => {
    it('unpublishes after a confirmation', async () => {
      const user = userEvent.setup();
      renderList();
      await openActions(user, 'gospel-of-john');
      await user.click(screen.getByTestId('plan-action-unpublish-gospel-of-john'));
      const dialog = await screen.findByRole('dialog', { name: 'Unpublish this plan?' });
      expect(dialog).toHaveTextContent('“Gospel of John”');
      expect(dialog).toHaveTextContent('Their saved progress is kept');
      expect(setPlanStatus).not.toHaveBeenCalled();

      await user.click(screen.getByTestId('plan-confirm-status'));
      await waitFor(() => expect(setPlanStatus).toHaveBeenCalledTimes(1));
      expect(setPlanStatus.mock.calls[0]![1]).toEqual({ to: 'draft' });
      await waitFor(() => expect(statusOf('gospel-of-john')).toHaveTextContent('Draft'));
      expect(
        await screen.findByText('Unpublished. Members can no longer see the plan.')
      ).toBeInTheDocument();
    });

    it('archives, and restores as a draft', async () => {
      const user = userEvent.setup();
      renderList();
      await openActions(user, 'gospel-of-john');
      await user.click(screen.getByTestId('plan-action-archive-gospel-of-john'));
      await user.click(await screen.findByTestId('plan-confirm-status'));
      await waitFor(() =>
        expect(statusOf('gospel-of-john')).toHaveTextContent('Archived')
      );
      expect(setPlanStatus.mock.calls[0]![1]).toEqual({ to: 'archived' });

      await openActions(user, 'lent');
      await user.click(screen.getByTestId('plan-action-restore-lent'));
      expect(
        await screen.findByRole('dialog', { name: 'Restore this plan as a draft?' })
      ).toBeInTheDocument();
      await user.click(screen.getByTestId('plan-confirm-status'));
      await waitFor(() => expect(statusOf('lent')).toHaveTextContent('Draft'));
    });

    it('can be cancelled', async () => {
      const user = userEvent.setup();
      renderList();
      await openActions(user, 'gospel-of-john');
      await user.click(screen.getByTestId('plan-action-unpublish-gospel-of-john'));
      await user.click(await screen.findByRole('button', { name: 'Cancel' }));
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(setPlanStatus).not.toHaveBeenCalled();
      expect(statusOf('gospel-of-john')).toHaveTextContent('Published');
    });

    it('keeps the dialog open and says why when the change fails', async () => {
      const user = userEvent.setup();
      renderList();
      setPlanStatus.mockRejectedValueOnce(new Error('offline'));
      await openActions(user, 'gospel-of-john');
      await user.click(screen.getByTestId('plan-action-unpublish-gospel-of-john'));
      await user.click(await screen.findByTestId('plan-confirm-status'));
      const dialog = await screen.findByRole('dialog', { name: 'Unpublish this plan?' });
      await waitFor(() => expect(dialog).toHaveTextContent(SAVE_RETRY_MESSAGE));
    });
  });

  describe('deleting', () => {
    it('names what will be lost, and deletes only on confirmation', async () => {
      const user = userEvent.setup();
      renderList();
      await openActions(user, 'seven-days');
      await user.click(screen.getByTestId('plan-action-delete-seven-days'));
      const dialog = await screen.findByRole('dialog', { name: 'Delete this plan?' });
      expect(dialog).toHaveTextContent(
        '“Seven Days in the Psalms” and its 2 days will be deleted for good.'
      );
      expect(dialog).toHaveTextContent('archive it instead');
      expect(deletePlan).not.toHaveBeenCalled();

      await user.click(screen.getByTestId('confirm-delete-button'));
      await waitFor(() =>
        expect(deletePlan).toHaveBeenCalledWith('seven-days', 'Seven Days in the Psalms')
      );
      await waitFor(() =>
        expect(screen.queryByTestId('plan-row-seven-days')).not.toBeInTheDocument()
      );
      expect(store.has('seven-days')).toBe(false);
      expect(
        await screen.findByText('Deleted "Seven Days in the Psalms".')
      ).toBeInTheDocument();
    });

    it('says how many days could not be removed', async () => {
      const user = userEvent.setup();
      renderList();
      deletePlan.mockResolvedValueOnce({ leftoverDays: 2 });
      await openActions(user, 'seven-days');
      await user.click(screen.getByTestId('plan-action-delete-seven-days'));
      await user.click(await screen.findByTestId('confirm-delete-button'));
      expect(
        await screen.findByText(/2 of its days could not be removed/)
      ).toBeInTheDocument();
    });

    it('keeps the plan and says why when it cannot be deleted', async () => {
      const user = userEvent.setup();
      renderList();
      deletePlan.mockRejectedValueOnce(new Error('offline'));
      await openActions(user, 'seven-days');
      await user.click(screen.getByTestId('plan-action-delete-seven-days'));
      await user.click(await screen.findByTestId('confirm-delete-button'));
      const dialog = await screen.findByRole('dialog', { name: 'Delete this plan?' });
      await waitFor(() => expect(dialog).toHaveTextContent(SAVE_RETRY_MESSAGE));
      expect(screen.getByTestId('plan-row-seven-days')).toBeInTheDocument();
    });
  });

  describe('duplicating', () => {
    it('copies a plan as a draft and opens the copy', async () => {
      const user = userEvent.setup();
      renderList();
      await openActions(user, 'gospel-of-john');
      await user.click(screen.getByTestId('plan-action-duplicate-gospel-of-john'));
      const title = await screen.findByTestId('plan-copy-title');
      expect(title).toHaveValue('Gospel of John (copy)');
      fireEvent.change(title, { target: { value: 'John, again' } });
      await user.click(screen.getByTestId('plan-confirm-duplicate'));

      await waitFor(() => expect(duplicatePlan).toHaveBeenCalledTimes(1));
      expect(duplicatePlan).toHaveBeenCalledWith({
        sourceId: 'gospel-of-john',
        newId: 'john-again',
        newTitle: 'John, again',
        uid: 'admin-1',
      });
      await waitFor(() =>
        expect(screen.getByTestId('location')).toHaveTextContent('/plans/john-again/edit')
      );
      expect(store.get('john-again')!.plan).toMatchObject({
        status: 'draft',
        published: false,
      });
    });

    it('will not copy without a title', async () => {
      const user = userEvent.setup();
      renderList();
      await openActions(user, 'gospel-of-john');
      await user.click(screen.getByTestId('plan-action-duplicate-gospel-of-john'));
      fireEvent.change(await screen.findByTestId('plan-copy-title'), {
        target: { value: ' ' },
      });
      await user.click(screen.getByTestId('plan-confirm-duplicate'));
      expect(duplicatePlan).not.toHaveBeenCalled();
    });

    it('says why when the copy fails', async () => {
      const user = userEvent.setup();
      renderList();
      duplicatePlan.mockRejectedValueOnce(new Error('offline'));
      await openActions(user, 'gospel-of-john');
      await user.click(screen.getByTestId('plan-action-duplicate-gospel-of-john'));
      await user.click(await screen.findByTestId('plan-confirm-duplicate'));
      const dialog = await screen.findByRole('dialog', { name: 'Duplicate this plan?' });
      await waitFor(() => expect(dialog).toHaveTextContent(SAVE_RETRY_MESSAGE));
    });
  });
});
