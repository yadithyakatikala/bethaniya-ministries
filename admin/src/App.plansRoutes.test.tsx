/**
 * The reading-plan routes, through the whole application: the real router,
 * the real route guard and layout, and the real pages. Only the Firebase SDK
 * and the plans service are replaced.
 *
 * The addresses matter more here than anywhere: the old one-day-at-a-time
 * pages (/plans/:planId/days, .../days/new, .../days/:dayId/edit) are in
 * bookmarks and old messages, and each must still land somewhere useful.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { onAuthStateChanged } from 'firebase/auth';
import { getDoc } from 'firebase/firestore';
import App from './App';

// The whole application is rendered for each test; under a full parallel run that is slow.
vi.setConfig({ testTimeout: 30_000 });

vi.mock('./services/firebase/app', () => ({
  auth: {},
  db: {},
  functions: {},
  usingFirebaseEmulators: true,
}));

vi.mock('firebase/functions', () => ({
  httpsCallable: vi.fn(() => vi.fn()),
}));

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: vi.fn(() => vi.fn()),
  signInWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  getDoc: vi.fn(),
  collection: vi.fn(),
  addDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  onSnapshot: vi.fn(() => vi.fn()),
  orderBy: vi.fn(),
  query: vi.fn(),
  serverTimestamp: vi.fn(),
  Timestamp: class MockTimestamp {},
}));

vi.mock('./services/firebase/plans', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./services/firebase/plans')>()),
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

vi.mock('./services/media/cloudinaryConfig', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./services/media/cloudinaryConfig')>()),
  getCloudinaryConfig: vi.fn(),
}));

import * as plans from './services/firebase/plans';
import { getCloudinaryConfig } from './services/media/cloudinaryConfig';
import { MISSING } from './components/media/__tests__/helpers';
import {
  installFakePlans,
  resetBackend,
  seedPlan,
} from './features/plans/__tests__/fakePlansBackend';

function signInAs(role: 'content_admin' | 'host' | 'member') {
  vi.mocked(onAuthStateChanged).mockImplementation((_auth, onNext) => {
    (onNext as (u: unknown) => void)({ uid: 'u-1', email: 'u@example.com' });
    return vi.fn();
  });
  vi.mocked(getDoc).mockResolvedValue({
    exists: () => true,
    data: () => ({ role }),
  } as never);
}

function open(path: string) {
  window.history.pushState({}, '', path);
  return render(<App />);
}

const here = () => window.location.pathname + window.location.search;

describe('the reading-plan routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetBackend();
    installFakePlans(vi.mocked(plans));
    vi.mocked(getCloudinaryConfig).mockReturnValue(MISSING);
    seedPlan();
  });

  afterEach(() => {
    window.history.pushState({}, '', '/');
  });

  it('shows the plan list at /plans', async () => {
    signInAs('content_admin');
    open('/plans');
    expect(await screen.findByTestId('plans-list-page')).toBeInTheDocument();
    expect(
      await screen.findByTestId('plan-row-seven-days-in-the-psalms')
    ).toBeInTheDocument();
  });

  it('shows a new, empty editor at /plans/new', async () => {
    signInAs('content_admin');
    open('/plans/new');
    expect(await screen.findByTestId('plan-editor-page')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 1, name: 'New Reading Plan' })
    ).toBeInTheDocument();
  });

  it('shows the plan in the editor at /plans/:id/edit', async () => {
    signInAs('content_admin');
    open('/plans/seven-days-in-the-psalms/edit');
    expect(await screen.findByTestId('plan-title')).toHaveValue(
      'Seven Days in the Psalms'
    );
  });

  it('keeps the plan section lit in the navigation while editing', async () => {
    signInAs('content_admin');
    open('/plans/seven-days-in-the-psalms/edit');
    await screen.findByTestId('plan-title');
    expect(screen.getAllByTestId('sidebar-plans-link')[0]).toHaveClass('Mui-selected');
  });

  it('sends the old days list to the Days tab of the plan', async () => {
    signInAs('content_admin');
    open('/plans/seven-days-in-the-psalms/days');
    expect(await screen.findByTestId('plan-days-tab')).toBeInTheDocument();
    expect(here()).toBe('/plans/seven-days-in-the-psalms/edit?tab=days');
  });

  it('sends the old "new day" address to a new day, open for writing', async () => {
    signInAs('content_admin');
    open('/plans/seven-days-in-the-psalms/days/new');
    expect(await screen.findByRole('dialog', { name: /Day 3 of 3/ })).toBeInTheDocument();
    expect(here()).toBe('/plans/seven-days-in-the-psalms/edit?tab=days&newDay=1');
  });

  it('sends the old "edit day" address to that day, open for editing', async () => {
    signInAs('content_admin');
    open('/plans/seven-days-in-the-psalms/days/day-2/edit');
    expect(await screen.findByRole('dialog', { name: /Day 2 of 2/ })).toBeInTheDocument();
    expect(screen.getByTestId('day-title')).toHaveValue('Out of the depths');
    expect(here()).toBe('/plans/seven-days-in-the-psalms/edit?tab=days&day=day-2');
  });

  it('sends a host who asks for the new-plan page to the list', async () => {
    signInAs('host');
    open('/plans/new');
    expect(await screen.findByTestId('plans-list-page')).toBeInTheDocument();
    await waitFor(() => expect(here()).toBe('/plans'));
  });

  it('lets a host read a plan but not change it', async () => {
    signInAs('host');
    open('/plans/seven-days-in-the-psalms/edit');
    expect(await screen.findByTestId('plan-read-only-note')).toBeInTheDocument();
    expect(screen.queryByTestId('plan-save')).not.toBeInTheDocument();
  });

  it('turns a member away from every plan page', async () => {
    signInAs('member');
    open('/plans/seven-days-in-the-psalms/edit');
    expect(await screen.findByTestId('unauthorized-message')).toBeInTheDocument();
    expect(screen.queryByTestId('plan-title')).not.toBeInTheDocument();
  });
});
