/**
 * The reading-plan editor, end to end through the screen.
 *
 * The plans service is replaced by an in-memory fake that behaves like it
 * (./fakePlansBackend.ts), so a test can walk a plan through its whole life
 * -- create, save, publish, unpublish, archive, delete -- and read each
 * result off the screen. What the service itself writes, and in what order,
 * is tested in services/firebase/__tests__/plans.test.ts; whether the rules
 * allow it, in firebase-tests/.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';

// Each test drives the whole editor through MUI; under a full parallel run they
// take several times longer than alone.
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
vi.mock('../../../services/media/cloudinaryUpload', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../services/media/cloudinaryUpload')>()),
  uploadToCloudinary: vi.fn(),
}));
vi.mock('../../../services/firebase/mediaAssets', () => ({
  createMediaAsset: vi.fn().mockResolvedValue('lib-1'),
  assetFromUpload: vi.fn((uploaded, details) => ({ uploaded, details })),
  subscribeToMediaAssets: vi.fn(() => vi.fn()),
}));

import * as plans from '../../../services/firebase/plans';
import { SAVE_RETRY_MESSAGE } from '../../../services/firebase/saveErrors';
import { getCloudinaryConfig } from '../../../services/media/cloudinaryConfig';
import { uploadToCloudinary } from '../../../services/media/cloudinaryUpload';
import type { UploadedAsset } from '../../../services/media/types';
import {
  MISSING,
  READY,
  UPLOADED_IMAGE,
  deferred,
  fileOf,
} from '../../../components/media/__tests__/helpers';
import { useAuthStore } from '../../../store/authStore';
import { useUnsavedChanges } from '../../../store/unsavedChangesStore';
import { PlanEditorPage } from '../PlanEditorPage';
import { installFakePlans, resetBackend, seedPlan, store } from './fakePlansBackend';
import { renderPlans } from './render';

const savePlan = vi.mocked(plans.savePlan);
const setPlanStatus = vi.mocked(plans.setPlanStatus);
const deletePlan = vi.mocked(plans.deletePlan);
const duplicatePlan = vi.mocked(plans.duplicatePlan);
const loadPlanForEditing = vi.mocked(plans.loadPlanForEditing);

const ID = 'seven-days-in-the-psalms';

function renderAt(path: string, role: 'content_admin' | 'super_admin' | 'host' = 'content_admin') {
  useAuthStore.setState({ user: { uid: 'admin-1', email: 'a@x.org' } as never, role });
  return renderPlans(
    <Routes>
      <Route path="/plans" element={<p data-testid="plans-list-stub">The plan list</p>} />
      <Route path="/plans/new" element={<PlanEditorPage mode="create" />} />
      <Route path="/plans/:id/edit" element={<PlanEditorPage mode="edit" />} />
    </Routes>,
    path
  );
}

/** Opens an existing plan and waits for the editor. */
async function openPlan(path = `/plans/${ID}/edit`, role?: Parameters<typeof renderAt>[1]) {
  const view = renderAt(path, role);
  await screen.findByTestId('plan-status-bar');
  return view;
}

/**
 * Puts a whole value into a field in one go. Typing it a character at a time
 * re-renders the whole editor for every key, which is slow and proves nothing
 * where what matters is the value the editor ends up holding.
 */
async function enter(
  user: ReturnType<typeof userEvent.setup>,
  element: HTMLElement,
  text: string
) {
  await user.click(element);
  await user.paste(text);
}

const location = () => screen.getByTestId('location');
const state = () => screen.getByTestId('plan-save-state');
const chip = () => screen.getByTestId('plan-status-chip');

async function chooseFromMenu(user: ReturnType<typeof userEvent.setup>, item: string) {
  await user.click(screen.getByTestId('plan-more'));
  await user.click(await screen.findByTestId(item));
}

beforeEach(() => {
  vi.clearAllMocks();
  resetBackend();
  installFakePlans(vi.mocked(plans));
  vi.mocked(getCloudinaryConfig).mockReturnValue(MISSING);
  useUnsavedChanges.setState({ message: null });
});

describe('creating a plan', () => {
  async function fillTitleAndDescription(user: ReturnType<typeof userEvent.setup>) {
    await enter(user, screen.getByTestId('plan-title'), 'Seven Days in the Psalms');
    fireEvent.change(screen.getByTestId('plan-description'), {
      target: { value: 'A week of psalms.' },
    });
  }

  async function addFirstDay(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByTestId('plan-tab-days'));
    await user.click(screen.getByRole('button', { name: 'Add the first day' }));
    const drawer = await screen.findByRole('dialog', { name: /Day 1/ });
    await enter(user, within(drawer).getByTestId('day-title'), 'The Lord is my shepherd');
    await enter(user, within(drawer).getByTestId('day-passage-0'), 'psalm 23');
    await user.click(within(drawer).getByTestId('day-drawer-done'));
  }

  it('starts empty and unsaved, and the ID follows the title', async () => {
    const user = userEvent.setup();
    renderAt('/plans/new');
    expect(screen.getByRole('heading', { level: 1, name: 'New Reading Plan' })).toBeInTheDocument();
    expect(state()).toHaveTextContent('Not saved yet');
    expect(chip()).toHaveTextContent('Draft');
    await enter(user, screen.getByTestId('plan-title'), 'Seven Days in the Psalms');
    expect(screen.getByTestId('plan-id')).toHaveValue(ID);
  });

  it('stops following the title once the ID has been typed over', async () => {
    const user = userEvent.setup();
    renderAt('/plans/new');
    await enter(user, screen.getByTestId('plan-title'), 'Psalms');
    fireEvent.change(screen.getByTestId('plan-id'), { target: { value: 'my-own-id' } });
    await enter(user, screen.getByTestId('plan-title'), ' for a week');
    expect(screen.getByTestId('plan-id')).toHaveValue('my-own-id');
  });

  it('saves a draft: details, the day with its reading, no status change, and the author', async () => {
    const user = userEvent.setup();
    renderAt('/plans/new');
    await fillTitleAndDescription(user);
    await addFirstDay(user);
    await user.click(screen.getByTestId('plan-save'));

    await waitFor(() => expect(savePlan).toHaveBeenCalledTimes(1));
    const input = savePlan.mock.calls[0]![0];
    expect(input).toMatchObject({
      mode: 'create',
      planId: ID,
      loaded: null,
      status: null,
      uid: 'admin-1',
    });
    expect(input.details).toMatchObject({
      title: 'Seven Days in the Psalms',
      description: 'A week of psalms.',
      category: 'Devotional',
      language: 'en',
      order: 0,
      coverImageUrl: null,
      estimatedMinutes: null,
    });
    expect(input.days).toHaveLength(1);
    expect(input.days[0]).toMatchObject({
      id: `${ID}-day-1`,
      title: 'The Lord is my shepherd',
      // Tidied to the one canonical spelling when the box lost focus.
      passages: ['Psalm 23'],
    });
  });

  it('reopens as the saved plan, with the ID fixed, once it is saved', async () => {
    const user = userEvent.setup();
    renderAt('/plans/new');
    await fillTitleAndDescription(user);
    await addFirstDay(user);
    await user.click(screen.getByTestId('plan-save'));

    await waitFor(() => expect(location()).toHaveTextContent(`/plans/${ID}/edit?tab=days`));
    expect(await screen.findByText('Plan saved.')).toBeInTheDocument();
    await screen.findByTestId('plan-status-bar');
    expect(state()).toHaveTextContent('All changes saved');
    expect(chip()).toHaveTextContent('Draft');
    expect(screen.getByRole('heading', { level: 1, name: 'Seven Days in the Psalms' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Days (1)' })).toBeInTheDocument();
    // What is stored is what is shown, never published by saving.
    expect(store.get(ID)!.plan).toMatchObject({ status: 'draft', published: false, dayCount: 1 });
  });

  it('will not save a plan that is missing what a draft needs, and says what', async () => {
    const user = userEvent.setup();
    renderAt('/plans/new');
    await user.click(screen.getByTestId('plan-save'));
    expect(savePlan).not.toHaveBeenCalled();
    expect(screen.getByTestId('plan-save-error')).toHaveTextContent(
      'Some things need fixing before this can be saved.'
    );
    expect(screen.getByText('Give the plan a title.')).toBeInTheDocument();
  });

  it('will not save a day that has no reading', async () => {
    const user = userEvent.setup();
    renderAt('/plans/new');
    await fillTitleAndDescription(user);
    await user.click(screen.getByTestId('plan-tab-days'));
    await user.click(screen.getByRole('button', { name: 'Add the first day' }));
    const drawer = await screen.findByRole('dialog', { name: /Day 1/ });
    await enter(user, within(drawer).getByTestId('day-title'), 'No reading yet');
    await user.click(within(drawer).getByTestId('day-drawer-done'));
    await user.click(screen.getByTestId('plan-save'));
    expect(savePlan).not.toHaveBeenCalled();
    expect(screen.getByTestId('plan-day-problem-1')).toBeInTheDocument();
  });

  it('will not save a plan with an ID that cannot work', async () => {
    const user = userEvent.setup();
    renderAt('/plans/new');
    await fillTitleAndDescription(user);
    fireEvent.change(screen.getByTestId('plan-id'), { target: { value: 'New' } });
    await user.click(screen.getByTestId('plan-save'));
    expect(savePlan).not.toHaveBeenCalled();
    expect(screen.getByText(/"new" is reserved/)).toBeInTheDocument();
  });

  it('can save a draft with no days at all', async () => {
    const user = userEvent.setup();
    renderAt('/plans/new');
    await fillTitleAndDescription(user);
    await user.click(screen.getByTestId('plan-save'));
    await waitFor(() => expect(savePlan).toHaveBeenCalledTimes(1));
    expect(savePlan.mock.calls[0]![0].days).toEqual([]);
  });

  it('refuses an ID that someone else took, and sends the administrator to fix it', async () => {
    const user = userEvent.setup();
    seedPlan({ id: ID });
    renderAt('/plans/new');
    await fillTitleAndDescription(user);
    await user.click(screen.getByTestId('plan-save'));

    expect(await screen.findByTestId('plan-save-error')).toHaveTextContent(
      `The ID "${ID}" is already used by another plan.`
    );
    expect(screen.getByTestId('plan-id')).toHaveAttribute('aria-invalid', 'true');
    // Back to the tab with the ID on it, whichever tab the save was started from.
    await waitFor(() => expect(location()).toHaveTextContent('/plans/new?tab=details'));
  });

  it('keeps the work and says to try again when saving fails, then succeeds on the retry with the same day ids', async () => {
    const user = userEvent.setup();
    renderAt('/plans/new');
    await fillTitleAndDescription(user);
    await addFirstDay(user);

    savePlan.mockRejectedValueOnce(new Error('network down'));
    await user.click(screen.getByTestId('plan-save'));
    expect(await screen.findByTestId('plan-save-error')).toHaveTextContent(SAVE_RETRY_MESSAGE);
    expect(location()).toHaveTextContent('/plans/new');
    await user.click(screen.getByTestId('plan-tab-details'));
    expect(screen.getByTestId('plan-title')).toHaveValue('Seven Days in the Psalms');
    expect(state()).toHaveTextContent('Not saved yet');

    await user.click(screen.getByTestId('plan-save'));
    await waitFor(() => expect(savePlan).toHaveBeenCalledTimes(2));
    // A retry overwrites the first attempt's days; it must not create new ones.
    expect(savePlan.mock.calls[1]![0].days.map((d) => d.id)).toEqual(
      savePlan.mock.calls[0]![0].days.map((d) => d.id)
    );
    await waitFor(() => expect(location()).toHaveTextContent(`/plans/${ID}/edit`));
  });

  it('locks the form while saving, so nothing typed is lost to the read-back', async () => {
    const user = userEvent.setup();
    renderAt('/plans/new');
    await fillTitleAndDescription(user);
    const pending = deferred<void>();
    savePlan.mockReturnValueOnce(pending.promise);
    await user.click(screen.getByTestId('plan-save'));

    await waitFor(() => expect(screen.getByRole('tabpanel')).toHaveAttribute('aria-busy', 'true'));
    expect(screen.getByRole('tabpanel')).toHaveAttribute('inert');
    expect(screen.getByTestId('plan-save')).toBeDisabled();
    expect(state()).toHaveTextContent('Not saved yet');

    await act(async () => {
      pending.resolve();
    });
  });
});

describe('the pieces of the editor', () => {
  it('keeps what was typed when switching between tabs', async () => {
    const user = userEvent.setup();
    renderAt('/plans/new');
    await enter(user, screen.getByTestId('plan-title'), 'Kept');
    await user.click(screen.getByTestId('plan-tab-days'));
    expect(location()).toHaveTextContent('tab=days');
    await user.click(screen.getByTestId('plan-tab-details'));
    expect(screen.getByTestId('plan-title')).toHaveValue('Kept');
  });

  it('opens on the tab named in the address, and on Details when it is not one', async () => {
    seedPlan();
    const { unmount } = await openPlan(`/plans/${ID}/edit?tab=days`);
    expect(screen.getByTestId('plan-days-tab')).toBeInTheDocument();
    unmount();
    await openPlan(`/plans/${ID}/edit?tab=nonsense`);
    expect(screen.getByTestId('plan-details-tab')).toBeInTheDocument();
  });

  it('previews unsaved changes', async () => {
    const user = userEvent.setup();
    seedPlan();
    await openPlan();
    fireEvent.change(screen.getByTestId('plan-title'), { target: { value: 'A brand new title' } });
    await user.click(screen.getByTestId('plan-tab-preview'));
    expect(screen.getByTestId('plan-preview-title')).toHaveTextContent('A brand new title');
    expect(screen.getByTestId('plan-preview-day-title')).toHaveTextContent('The Lord is my shepherd');
  });

  it('shows the days with their readings and counts them in the tab', async () => {
    seedPlan();
    await openPlan(`/plans/${ID}/edit?tab=days`);
    expect(screen.getByRole('tab', { name: 'Days (2)' })).toBeInTheDocument();
    expect(screen.getByTestId('plan-day-row-2')).toHaveTextContent('Out of the depths');
    expect(screen.getByTestId('plan-day-row-2')).toHaveTextContent('Psalm 130');
  });

  describe('editing the days', () => {
    it('moves a day, which renumbers the others and marks the plan unsaved', async () => {
      const user = userEvent.setup();
      seedPlan();
      await openPlan(`/plans/${ID}/edit?tab=days`);
      expect(state()).toHaveTextContent('All changes saved');
      await user.click(screen.getByTestId('plan-day-up-2'));
      expect(screen.getByTestId('plan-day-title-1')).toHaveTextContent('Out of the depths');
      expect(screen.getByTestId('plan-day-title-2')).toHaveTextContent('The Lord is my shepherd');
      expect(state()).toHaveTextContent('Unsaved changes');
    });

    it('saves the new order', async () => {
      const user = userEvent.setup();
      seedPlan();
      await openPlan(`/plans/${ID}/edit?tab=days`);
      await user.click(screen.getByTestId('plan-day-up-2'));
      await user.click(screen.getByTestId('plan-save'));
      await waitFor(() => expect(savePlan).toHaveBeenCalledTimes(1));
      expect(savePlan.mock.calls[0]![0].days.map((d) => d.id)).toEqual(['day-2', 'day-1']);
      await waitFor(() => expect(state()).toHaveTextContent('All changes saved'));
      expect(store.get(ID)!.days.map((d) => [d.id, d.dayNumber])).toEqual([
        ['day-2', 1],
        ['day-1', 2],
      ]);
    });

    it('asks before deleting a day, and renumbers after it goes', async () => {
      const user = userEvent.setup();
      seedPlan();
      await openPlan(`/plans/${ID}/edit?tab=days`);
      await user.click(screen.getByTestId('plan-day-delete-1'));
      const dialog = await screen.findByRole('dialog', { name: 'Delete day 1?' });
      expect(dialog).toHaveTextContent('The Lord is my shepherd');
      // Nothing is removed until it is confirmed.
      expect(screen.getByTestId('plan-day-row-2')).toBeInTheDocument();
      await user.click(screen.getByTestId('plan-day-delete-confirm'));
      await waitFor(() => expect(screen.queryByTestId('plan-day-row-2')).not.toBeInTheDocument());
      expect(screen.getByTestId('plan-day-title-1')).toHaveTextContent('Out of the depths');
      expect(state()).toHaveTextContent('Unsaved changes');
    });

    it('can change its mind about deleting a day', async () => {
      const user = userEvent.setup();
      seedPlan();
      await openPlan(`/plans/${ID}/edit?tab=days`);
      await user.click(screen.getByTestId('plan-day-delete-1'));
      await user.click(await screen.findByRole('button', { name: 'Cancel' }));
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(screen.getByTestId('plan-day-row-2')).toBeInTheDocument();
      expect(state()).toHaveTextContent('All changes saved');
    });

    it('warns that deleting a day moves where members are, once members can see the plan', async () => {
      const user = userEvent.setup();
      seedPlan({ status: 'published', published: true });
      await openPlan(`/plans/${ID}/edit?tab=days`);
      expect(screen.getByTestId('plan-days-live-warning')).toBeInTheDocument();
      await user.click(screen.getByTestId('plan-day-delete-1'));
      expect(await screen.findByRole('dialog', { name: 'Delete day 1?' })).toHaveTextContent(
        'which changes which day members have finished'
      );
    });

    it('duplicates a day straight after the original and opens the copy', async () => {
      const user = userEvent.setup();
      seedPlan();
      await openPlan(`/plans/${ID}/edit?tab=days`);
      await user.click(screen.getByTestId('plan-day-duplicate-1'));
      expect(screen.getByTestId('plan-day-title-2')).toHaveTextContent(
        'The Lord is my shepherd (copy)'
      );
      expect(await screen.findByRole('dialog', { name: /Day 2/ })).toBeInTheDocument();
    });

    it('adds a week of blank days at once', async () => {
      const user = userEvent.setup();
      seedPlan();
      await openPlan(`/plans/${ID}/edit?tab=days`);
      await user.click(screen.getByTestId('plan-add-seven-days'));
      expect(screen.getByRole('tab', { name: 'Days (9)' })).toBeInTheDocument();
      expect(screen.getByTestId('plan-day-title-9')).toHaveTextContent('Untitled day');
    });

    it('edits a day in the drawer and pages between days without closing it', async () => {
      const user = userEvent.setup();
      seedPlan();
      await openPlan(`/plans/${ID}/edit?tab=days`);
      await user.click(screen.getByTestId('plan-day-open-1'));
      const drawer = await screen.findByRole('dialog', { name: /Day 1/ });
      fireEvent.change(within(drawer).getByTestId('day-devotional'), {
        target: { value: 'Rest in him.' },
      });
      await user.click(within(drawer).getByTestId('day-drawer-next'));
      expect(await screen.findByRole('dialog', { name: /Day 2/ })).toBeInTheDocument();
      expect(screen.getByTestId('day-title')).toHaveValue('Out of the depths');
      await user.click(screen.getByTestId('day-drawer-previous'));
      expect(screen.getByTestId('day-devotional')).toHaveValue('Rest in him.');
      expect(state()).toHaveTextContent('Unsaved changes');
    });
  });

  describe('the old one-day-at-a-time addresses', () => {
    it('opens the day named in the address', async () => {
      seedPlan();
      await openPlan(`/plans/${ID}/edit?tab=days&day=day-2`);
      const drawer = await screen.findByRole('dialog', { name: /Day 2/ });
      expect(within(drawer).getByTestId('day-title')).toHaveValue('Out of the depths');
    });

    it('starts a new day when the address asks for one', async () => {
      seedPlan();
      await openPlan(`/plans/${ID}/edit?tab=days&newDay=1`);
      expect(await screen.findByRole('dialog', { name: /Day 3 of 3/ })).toBeInTheDocument();
      // The page behind an open drawer is hidden from assistive technology.
      expect(screen.getByRole('tab', { name: 'Days (3)', hidden: true })).toBeInTheDocument();
    });

    it('does not start a new day for someone who cannot change the plan', async () => {
      seedPlan();
      await openPlan(`/plans/${ID}/edit?tab=days&newDay=1`, 'host');
      expect(screen.getByRole('tab', { name: 'Days (2)' })).toBeInTheDocument();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });
});

describe('publishing', () => {
  it('publishes a ready draft after one confirmation', async () => {
    const user = userEvent.setup();
    seedPlan();
    await openPlan();
    expect(chip()).toHaveTextContent('Draft');

    await user.click(screen.getByTestId('plan-publish'));
    const dialog = await screen.findByRole('dialog', { name: 'Publish this plan?' });
    expect(dialog).toHaveTextContent('Seven Days in the Psalms (2 days)');
    // Nothing has happened to members yet.
    expect(savePlan).not.toHaveBeenCalled();

    await user.click(within(dialog).getByTestId('publish-confirm'));
    await waitFor(() => expect(savePlan).toHaveBeenCalledTimes(1));
    expect(savePlan.mock.calls[0]![0]).toMatchObject({
      mode: 'edit',
      planId: ID,
      status: { to: 'published' },
    });
    expect(await screen.findByText('Published. Members can see the plan now.')).toBeInTheDocument();
    await waitFor(() => expect(chip()).toHaveTextContent('Published'));
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Publish this plan?' })).not.toBeInTheDocument()
    );
    // The action offered now is the opposite one.
    expect(screen.queryByTestId('plan-publish')).not.toBeInTheDocument();
    expect(screen.getByTestId('plan-unpublish')).toBeInTheDocument();
    expect(store.get(ID)!.plan).toMatchObject({ status: 'published', published: true });
  });

  it('publishes together with the changes made since the last save', async () => {
    const user = userEvent.setup();
    seedPlan();
    await openPlan();
    fireEvent.change(screen.getByTestId('plan-title'), { target: { value: 'Retitled' } });
    await user.click(screen.getByTestId('plan-publish'));
    await user.click(await screen.findByTestId('publish-confirm'));
    await waitFor(() => expect(savePlan).toHaveBeenCalledTimes(1));
    expect(savePlan.mock.calls[0]![0].details.title).toBe('Retitled');
    expect(store.get(ID)!.plan.title).toBe('Retitled');
  });

  it('lists what is missing instead of publishing, and takes the administrator to it', async () => {
    const user = userEvent.setup();
    seedPlan({ description: '' }, []);
    await openPlan();
    await user.click(screen.getByTestId('plan-publish'));
    const dialog = await screen.findByRole('dialog', { name: 'Not ready to publish yet' });
    expect(dialog).toHaveTextContent('Write a short description');
    expect(dialog).toHaveTextContent('Add at least one day');
    expect(within(dialog).queryByTestId('publish-confirm')).not.toBeInTheDocument();

    await user.click(within(dialog).getByTestId('publish-fix-no-days'));
    await waitFor(() => expect(location()).toHaveTextContent('tab=days'));
    expect(screen.getByTestId('plan-days-empty')).toBeInTheDocument();
    expect(screen.getByTestId('plan-issue-summary')).toHaveTextContent('2 things need attention');
    expect(savePlan).not.toHaveBeenCalled();
  });

  it('takes the administrator to the exact day that has the problem', async () => {
    const user = userEvent.setup();
    seedPlan({}, [
      { id: 'day-1', title: 'Fine', scriptureReference: 'Psalm 23' },
      { id: 'day-2', title: 'Broken', scriptureReference: 'Psalm 999' },
    ]);
    await openPlan();
    await user.click(screen.getByTestId('plan-publish'));
    const dialog = await screen.findByRole('dialog', { name: 'Not ready to publish yet' });
    expect(dialog).toHaveTextContent('Day 2 ("Broken")');
    await user.click(within(dialog).getByTestId('publish-fix-saved-day-2-passages'));
    const drawer = await screen.findByRole('dialog', { name: /Day 2/ });
    expect(within(drawer).getByTestId('day-title')).toHaveValue('Broken');
  });

  it('does not nag about the cover, but mentions it before publishing', async () => {
    const user = userEvent.setup();
    seedPlan({ coverImageUrl: null });
    await openPlan();
    await user.click(screen.getByTestId('plan-publish'));
    expect(await screen.findByTestId('publish-warnings')).toHaveTextContent('There is no cover image');
    expect(screen.getByTestId('publish-confirm')).toBeEnabled();
  });

  it('shows the reason inside the dialog when publishing fails, and stays open', async () => {
    const user = userEvent.setup();
    seedPlan();
    await openPlan();
    savePlan.mockRejectedValueOnce(new Error('offline'));
    await user.click(screen.getByTestId('plan-publish'));
    await user.click(await screen.findByTestId('publish-confirm'));
    expect(await screen.findByTestId('publish-error')).toHaveTextContent(SAVE_RETRY_MESSAGE);
    expect(screen.getByRole('dialog', { name: 'Publish this plan?' })).toBeInTheDocument();
    expect(chip()).toHaveTextContent('Draft');
  });

  it('can be cancelled without publishing', async () => {
    const user = userEvent.setup();
    seedPlan();
    await openPlan();
    await user.click(screen.getByTestId('plan-publish'));
    await user.click(await screen.findByTestId('publish-cancel'));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(savePlan).not.toHaveBeenCalled();
    expect(chip()).toHaveTextContent('Draft');
  });

  it('publishes a brand-new, complete plan in one go', async () => {
    const user = userEvent.setup();
    renderAt('/plans/new');
    await enter(user, screen.getByTestId('plan-title'), 'Seven Days in the Psalms');
    fireEvent.change(screen.getByTestId('plan-description'), { target: { value: 'A week.' } });
    await user.click(screen.getByTestId('plan-tab-days'));
    await user.click(screen.getByRole('button', { name: 'Add the first day' }));
    const drawer = await screen.findByRole('dialog', { name: /Day 1/ });
    await enter(user, within(drawer).getByTestId('day-title'), 'Day one');
    await enter(user, within(drawer).getByTestId('day-passage-0'), 'John 3:16');
    await user.click(within(drawer).getByTestId('day-drawer-done'));

    await user.click(screen.getByTestId('plan-publish'));
    await user.click(await screen.findByTestId('publish-confirm'));
    await waitFor(() => expect(savePlan).toHaveBeenCalledTimes(1));
    expect(savePlan.mock.calls[0]![0]).toMatchObject({
      mode: 'create',
      status: { to: 'published' },
    });
    await waitFor(() => expect(location()).toHaveTextContent(`/plans/${ID}/edit`));
    await waitFor(() => expect(chip()).toHaveTextContent('Published'));
  });

  describe('scheduling', () => {
    it('schedules for a later time, which keeps the plan hidden until then', async () => {
      const user = userEvent.setup();
      seedPlan();
      await openPlan();
      await chooseFromMenu(user, 'plan-menu-schedule');
      const dialog = await screen.findByRole('dialog', { name: 'Schedule this plan?' });
      const when = within(dialog).getByTestId('publish-schedule-time') as HTMLInputElement;
      // Tomorrow at 06:00 by default.
      expect(when.value).toMatch(/T06:00$/);
      fireEvent.change(when, { target: { value: '2099-01-01T09:30' } });
      await user.click(within(dialog).getByTestId('publish-confirm'));

      await waitFor(() => expect(savePlan).toHaveBeenCalledTimes(1));
      const status = savePlan.mock.calls[0]![0].status;
      expect(status?.to).toBe('scheduled');
      expect(status?.to === 'scheduled' && status.publishAt).toEqual(new Date(2099, 0, 1, 9, 30));
      expect(await screen.findByText(/Scheduled\. The plan will appear/)).toBeInTheDocument();
      await waitFor(() => expect(chip()).toHaveTextContent(/Scheduled · 1 Jan 2099/));
      expect(store.get(ID)!.plan).toMatchObject({ status: 'scheduled', published: false });
    });

    it('lets a scheduled plan be published now or have its schedule cancelled', async () => {
      const user = userEvent.setup();
      seedPlan({ status: 'scheduled', published: false, publishAt: new Date('2099-01-01T09:30:00Z') });
      await openPlan();
      expect(screen.getByTestId('plan-publish')).toHaveTextContent('Publish now…');

      await chooseFromMenu(user, 'plan-menu-unpublish');
      await user.click(await screen.findByTestId('plan-status-confirm'));
      await waitFor(() => expect(setPlanStatus).toHaveBeenCalledTimes(1));
      expect(setPlanStatus.mock.calls[0]![1]).toEqual({ to: 'draft' });
      await waitFor(() => expect(chip()).toHaveTextContent('Draft'));
    });

    it('treats a scheduled plan whose time has come as published', async () => {
      seedPlan({ status: 'scheduled', published: false, publishAt: new Date('2020-01-01T00:00:00Z') });
      await openPlan();
      expect(chip()).toHaveTextContent('Published');
      expect(screen.getByTestId('plan-unpublish')).toBeInTheDocument();
    });
  });
});

describe('taking a plan back', () => {
  it('unpublishes after a confirmation that says what members will lose, and what they keep', async () => {
    const user = userEvent.setup();
    seedPlan({ status: 'published', published: true });
    await openPlan();
    await user.click(screen.getByTestId('plan-unpublish'));
    const dialog = await screen.findByRole('dialog', { name: 'Unpublish this plan?' });
    expect(dialog).toHaveTextContent('Their saved progress is kept');
    expect(setPlanStatus).not.toHaveBeenCalled();

    await user.click(within(dialog).getByTestId('plan-status-confirm'));
    await waitFor(() => expect(setPlanStatus).toHaveBeenCalledTimes(1));
    expect(setPlanStatus.mock.calls[0]![0]).toMatchObject({ id: ID });
    expect(setPlanStatus.mock.calls[0]![1]).toEqual({ to: 'draft' });
    expect(await screen.findByText('Unpublished. Members can no longer see the plan.')).toBeInTheDocument();
    await waitFor(() => expect(chip()).toHaveTextContent('Draft'));
    expect(screen.getByTestId('plan-publish')).toBeInTheDocument();
    expect(store.get(ID)!.plan).toMatchObject({ status: 'draft', published: false });
  });

  it('archives and restores', async () => {
    const user = userEvent.setup();
    seedPlan({ status: 'published', published: true });
    await openPlan();
    await chooseFromMenu(user, 'plan-menu-archive');
    expect(await screen.findByRole('dialog', { name: 'Archive this plan?' })).toBeInTheDocument();
    await user.click(screen.getByTestId('plan-status-confirm'));
    await waitFor(() => expect(chip()).toHaveTextContent('Archived'));
    expect(setPlanStatus.mock.calls[0]![1]).toEqual({ to: 'archived' });

    await user.click(screen.getByTestId('plan-restore'));
    expect(await screen.findByRole('dialog', { name: 'Restore this plan as a draft?' })).toBeInTheDocument();
    await user.click(screen.getByTestId('plan-status-confirm'));
    await waitFor(() => expect(chip()).toHaveTextContent('Draft'));
    expect(setPlanStatus.mock.calls[1]![1]).toEqual({ to: 'draft' });
  });

  it('keeps the dialog open and says why when the change fails', async () => {
    const user = userEvent.setup();
    seedPlan({ status: 'published', published: true });
    await openPlan();
    setPlanStatus.mockRejectedValueOnce(new Error('offline'));
    await user.click(screen.getByTestId('plan-unpublish'));
    await user.click(await screen.findByTestId('plan-status-confirm'));
    const dialog = await screen.findByRole('dialog', { name: 'Unpublish this plan?' });
    await waitFor(() => expect(dialog).toHaveTextContent(SAVE_RETRY_MESSAGE));
    expect(chip()).toHaveTextContent('Published');
  });

  it('can be cancelled', async () => {
    const user = userEvent.setup();
    seedPlan({ status: 'published', published: true });
    await openPlan();
    await user.click(screen.getByTestId('plan-unpublish'));
    await user.click(await screen.findByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(setPlanStatus).not.toHaveBeenCalled();
  });
});

describe('deleting and duplicating', () => {
  it('deletes only after a confirmation that names the plan, then goes back to the list', async () => {
    const user = userEvent.setup();
    seedPlan();
    await openPlan();
    await chooseFromMenu(user, 'plan-menu-delete');
    const dialog = await screen.findByRole('dialog', { name: 'Delete this plan?' });
    expect(dialog).toHaveTextContent('“Seven Days in the Psalms” and its 2 days will be deleted for good.');
    expect(dialog).toHaveTextContent('archive it instead');
    expect(deletePlan).not.toHaveBeenCalled();

    await user.click(within(dialog).getByTestId('plan-delete-confirm'));
    await waitFor(() => expect(deletePlan).toHaveBeenCalledWith(ID, 'Seven Days in the Psalms'));
    await waitFor(() => expect(location()).toHaveTextContent(/^\/plans$/));
    expect(screen.getByTestId('plans-list-stub')).toBeInTheDocument();
    expect(await screen.findByText('Deleted "Seven Days in the Psalms".')).toBeInTheDocument();
    expect(store.has(ID)).toBe(false);
  });

  it('says how many days could not be removed instead of hiding it', async () => {
    const user = userEvent.setup();
    seedPlan();
    await openPlan();
    deletePlan.mockResolvedValueOnce({ leftoverDays: 3 });
    await chooseFromMenu(user, 'plan-menu-delete');
    await user.click(await screen.findByTestId('plan-delete-confirm'));
    expect(await screen.findByText(/3 of its days could not be removed/)).toBeInTheDocument();
  });

  it('stays on the plan, with the reason, when the delete fails', async () => {
    const user = userEvent.setup();
    seedPlan();
    await openPlan();
    deletePlan.mockRejectedValueOnce(new Error('offline'));
    await chooseFromMenu(user, 'plan-menu-delete');
    await user.click(await screen.findByTestId('plan-delete-confirm'));
    const dialog = await screen.findByRole('dialog', { name: 'Delete this plan?' });
    await waitFor(() => expect(dialog).toHaveTextContent(SAVE_RETRY_MESSAGE));
    expect(location()).toHaveTextContent(`/plans/${ID}/edit`);
    expect(store.has(ID)).toBe(true);
  });

  it('copies a plan as a draft under a new ID and opens the copy', async () => {
    const user = userEvent.setup();
    seedPlan({ status: 'published', published: true });
    await openPlan();
    await chooseFromMenu(user, 'plan-menu-duplicate');
    const dialog = await screen.findByRole('dialog', { name: 'Duplicate this plan?' });
    const title = within(dialog).getByTestId('plan-duplicate-title');
    expect(title).toHaveValue('Seven Days in the Psalms (copy)');
    fireEvent.change(title, { target: { value: 'Psalms, Again' } });
    await user.click(within(dialog).getByTestId('plan-duplicate-confirm'));

    await waitFor(() => expect(duplicatePlan).toHaveBeenCalledTimes(1));
    expect(duplicatePlan).toHaveBeenCalledWith({
      sourceId: ID,
      newId: 'psalms-again',
      newTitle: 'Psalms, Again',
      uid: 'admin-1',
    });
    await waitFor(() => expect(location()).toHaveTextContent('/plans/psalms-again/edit'));
    // The copy is a draft, even though the original is live.
    await waitFor(() => expect(chip()).toHaveTextContent('Draft'));
    expect(await screen.findByRole('heading', { level: 1, name: 'Psalms, Again' })).toBeInTheDocument();
  });

  it('finds a free ID when the obvious one is taken', async () => {
    const user = userEvent.setup();
    seedPlan();
    seedPlan({ id: 'psalms-again' }, []);
    await openPlan();
    await chooseFromMenu(user, 'plan-menu-duplicate');
    fireEvent.change(await screen.findByTestId('plan-duplicate-title'), {
      target: { value: 'Psalms, Again' },
    });
    await user.click(screen.getByTestId('plan-duplicate-confirm'));
    await waitFor(() => expect(duplicatePlan).toHaveBeenCalledTimes(1));
    expect(duplicatePlan.mock.calls[0]![0].newId).toBe('psalms-again-2');
  });

  it('will not make a copy with no title', async () => {
    const user = userEvent.setup();
    seedPlan();
    await openPlan();
    await chooseFromMenu(user, 'plan-menu-duplicate');
    fireEvent.change(await screen.findByTestId('plan-duplicate-title'), { target: { value: '  ' } });
    await user.click(screen.getByTestId('plan-duplicate-confirm'));
    expect(duplicatePlan).not.toHaveBeenCalled();
  });
});

describe('when something else has happened to the plan', () => {
  it('says so, and offers a reload, if someone saved while this was open', async () => {
    const user = userEvent.setup();
    seedPlan();
    await openPlan();
    fireEvent.change(screen.getByTestId('plan-title'), { target: { value: 'Mine' } });
    savePlan.mockRejectedValueOnce(new plans.PlanConflictError(ID));
    await user.click(screen.getByTestId('plan-save'));
    const alert = await screen.findByTestId('plan-conflict');
    expect(alert).toHaveTextContent('Someone else saved this plan while you were editing it.');
    expect(within(alert).getByRole('button', { name: 'Reload' })).toBeInTheDocument();
    // What the administrator typed is still on screen.
    expect(screen.getByTestId('plan-title')).toHaveValue('Mine');
  });

  it('says so if the plan was deleted while this was open', async () => {
    const user = userEvent.setup();
    seedPlan();
    await openPlan();
    fireEvent.change(screen.getByTestId('plan-title'), { target: { value: 'Mine' } });
    savePlan.mockRejectedValueOnce(new plans.PlanMissingError(ID));
    await user.click(screen.getByTestId('plan-save'));
    expect(await screen.findByTestId('plan-missing')).toHaveTextContent(
      'This plan no longer exists. It may have been deleted by someone else.'
    );
  });

  it('warns rather than hiding it when the plan was saved but could not be read back', async () => {
    const user = userEvent.setup();
    seedPlan();
    await openPlan();
    fireEvent.change(screen.getByTestId('plan-title'), { target: { value: 'Mine' } });
    // The first load was the page opening; fail the read-back that follows the save.
    loadPlanForEditing.mockRejectedValueOnce(new Error('offline'));
    await user.click(screen.getByTestId('plan-save'));
    expect(await screen.findByTestId('plan-conflict')).toHaveTextContent(
      'Saved, but the plan could not be read back. Reload the page before you edit it again.'
    );
  });
});

describe('a cover that is still uploading', () => {
  it('holds Save until the upload finishes, then keeps the new cover', async () => {
    vi.mocked(getCloudinaryConfig).mockReturnValue(READY);
    const pending = deferred<UploadedAsset>();
    vi.mocked(uploadToCloudinary).mockReturnValue(pending.promise);
    URL.createObjectURL = vi.fn(() => 'blob:local-preview');
    URL.revokeObjectURL = vi.fn();
    const user = userEvent.setup({ applyAccept: false });
    seedPlan();
    await openPlan();
    fireEvent.change(screen.getByTestId('plan-title'), { target: { value: 'Retitled' } });
    expect(screen.getByTestId('plan-save')).toBeEnabled();

    await user.upload(screen.getByTestId('plan-cover-input'), fileOf('cover.jpg', 'image/jpeg'));
    await waitFor(() => expect(state()).toHaveTextContent('Uploading…'));
    expect(screen.getByTestId('plan-save')).toBeDisabled();
    expect(screen.getByTestId('plan-publish')).toBeDisabled();

    await act(async () => {
      pending.resolve(UPLOADED_IMAGE);
    });
    await waitFor(() => expect(screen.getByTestId('plan-save')).toBeEnabled());
    await user.click(screen.getByTestId('plan-save'));
    await waitFor(() => expect(savePlan).toHaveBeenCalledTimes(1));
    expect(savePlan.mock.calls[0]![0].details.coverImageUrl).toBe(UPLOADED_IMAGE.url);
  });
});

describe('who can change a plan', () => {
  it.each(['content_admin', 'super_admin'] as const)('lets a %s edit and publish', async (role) => {
    seedPlan();
    await openPlan(`/plans/${ID}/edit`, role);
    expect(screen.getByTestId('plan-publish')).toBeInTheDocument();
    expect(screen.queryByTestId('plan-read-only-note')).not.toBeInTheDocument();
    expect(screen.getByTestId('plan-title')).toBeEnabled();
  });

  it('lets a host read a plan and nothing else', async () => {
    const user = userEvent.setup();
    seedPlan();
    await openPlan(`/plans/${ID}/edit?tab=days`, 'host');
    expect(screen.getByTestId('plan-read-only-note')).toBeInTheDocument();
    for (const id of ['plan-save', 'plan-publish', 'plan-unpublish', 'plan-more', 'plan-add-day', 'plan-day-delete-1', 'plan-day-up-2']) {
      expect(screen.queryByTestId(id)).not.toBeInTheDocument();
    }
    // They can still open a day and read it.
    await user.click(screen.getByRole('button', { name: 'View day 1' }));
    const drawer = await screen.findByRole('dialog', { name: /Day 1/ });
    expect(within(drawer).getByTestId('day-title')).toBeDisabled();
    await user.click(within(drawer).getByTestId('day-drawer-done'));
    await user.click(screen.getByTestId('plan-tab-details'));
    expect(screen.getByTestId('plan-title')).toBeDisabled();
    expect(savePlan).not.toHaveBeenCalled();
  });

  it('never marks a host\'s look at the plan as unsaved work', async () => {
    seedPlan();
    await openPlan(`/plans/${ID}/edit`, 'host');
    expect(useUnsavedChanges.getState().message).toBeNull();
  });
});

describe('unsaved work', () => {
  it('is announced to the shell while there is any, and withdrawn once it is saved', async () => {
    const user = userEvent.setup();
    seedPlan();
    await openPlan();
    expect(useUnsavedChanges.getState().message).toBeNull();

    fireEvent.change(screen.getByTestId('plan-title'), { target: { value: 'Changed' } });
    await waitFor(() =>
      expect(useUnsavedChanges.getState().message).toMatch(/changes that have not been saved/)
    );

    await user.click(screen.getByTestId('plan-save'));
    await waitFor(() => expect(useUnsavedChanges.getState().message).toBeNull());
  });

  it('is withdrawn when the editor goes away', async () => {
    seedPlan();
    const { unmount } = await openPlan();
    fireEvent.change(screen.getByTestId('plan-title'), { target: { value: 'Changed' } });
    await waitFor(() => expect(useUnsavedChanges.getState().message).not.toBeNull());
    unmount();
    expect(useUnsavedChanges.getState().message).toBeNull();
  });

  it('makes the browser ask before the tab is closed, only while there is any', async () => {
    seedPlan();
    await openPlan();
    const clean = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(clean);
    expect(clean.defaultPrevented).toBe(false);

    fireEvent.change(screen.getByTestId('plan-title'), { target: { value: 'Changed' } });
    await waitFor(() => {
      const dirty = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(dirty);
      expect(dirty.defaultPrevented).toBe(true);
    });
  });
});
