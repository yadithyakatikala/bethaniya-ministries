import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UsersPage } from '../UsersPage';
import { useAuthStore } from '../../../store/authStore';
import * as usersService from '../../../services/firebase/users';
import type { AdminUserSummary } from '../../../types';
import type { User } from 'firebase/auth';

vi.mock('../../../services/firebase/users');

function renderPage() {
  return render(<UsersPage />);
}

function asUser(uid: string): User {
  return { uid } as unknown as User;
}

/**
 * M7's fields, defaulted here so each fixture below states only what it
 * is actually about. `authProvider: null` and `lastActiveAt: null` are
 * the REAL shape of an account that has not signed in since M7 shipped,
 * which is every existing member on the day it does -- so this is the
 * common case, not a convenience.
 */
const M7_DEFAULTS = {
  gender: null,
  appLanguage: null,
  authProvider: null,
  lastActiveAt: null,
  profileCompletedAt: null,
  accountStatus: 'active',
  // M8. Null is both "never suspended" and the shape of an account
  // suspended before the terms existed -- see ../suspension.ts.
  suspension: null,
} satisfies Partial<AdminUserSummary>;

const OTHER_USER: AdminUserSummary = {
  uid: 'other-uid',
  displayName: 'Jane Doe',
  email: 'jane@example.com',
  phoneNumber: '+10000000000',
  role: 'member',
  createdAt: new Date('2026-01-01T00:00:00Z'),
  ...M7_DEFAULTS,
};

const SELF_USER: AdminUserSummary = {
  uid: 'own-uid',
  displayName: 'Self Admin',
  email: 'self@example.com',
  phoneNumber: null,
  role: 'super_admin',
  createdAt: new Date('2025-06-01T00:00:00Z'),
  ...M7_DEFAULTS,
};

describe('UsersPage', () => {
  afterEach(() => {
    vi.mocked(usersService.fetchAllUsers).mockReset();
    vi.mocked(usersService.updateUserRole).mockReset();
  });

  it('shows an unauthorized message for a content_admin', () => {
    useAuthStore.setState({ role: 'content_admin', user: asUser('ca-uid') });
    renderPage();
    expect(screen.getByTestId('users-unauthorized')).toBeInTheDocument();
    expect(vi.mocked(usersService.fetchAllUsers)).not.toHaveBeenCalled();
  });

  it('shows an unauthorized message for a host', () => {
    useAuthStore.setState({ role: 'host', user: asUser('host-uid') });
    renderPage();
    expect(screen.getByTestId('users-unauthorized')).toBeInTheDocument();
  });

  it('shows a loading state before the fetch resolves', () => {
    useAuthStore.setState({ role: 'super_admin', user: asUser('own-uid') });
    vi.mocked(usersService.fetchAllUsers).mockImplementation(() => new Promise(() => {}));
    renderPage();
    expect(screen.getByTestId('users-loading')).toBeInTheDocument();
  });

  it('shows an error state when the fetch fails', async () => {
    useAuthStore.setState({ role: 'super_admin', user: asUser('own-uid') });
    vi.mocked(usersService.fetchAllUsers).mockRejectedValue(
      new Error('permission-denied')
    );
    renderPage();
    expect(await screen.findByTestId('users-error')).toBeInTheDocument();
  });

  it('shows an empty state when there are no users', async () => {
    useAuthStore.setState({ role: 'super_admin', user: asUser('own-uid') });
    vi.mocked(usersService.fetchAllUsers).mockResolvedValue([]);
    renderPage();
    expect(await screen.findByTestId('users-empty')).toBeInTheDocument();
  });

  it('renders every user with name/email/phone/role/joined', async () => {
    useAuthStore.setState({ role: 'super_admin', user: asUser('own-uid') });
    vi.mocked(usersService.fetchAllUsers).mockResolvedValue([OTHER_USER]);
    renderPage();

    expect(await screen.findByTestId('user-row-other-uid')).toBeInTheDocument();
    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
    expect(screen.getByText('jane@example.com')).toBeInTheDocument();
    expect(screen.getByText('+10000000000')).toBeInTheDocument();
  });

  // --- Self-demotion guard (UI half) --------------------------------------

  it("disables the role selector on the signed-in Super Admin's own row", async () => {
    useAuthStore.setState({ role: 'super_admin', user: asUser('own-uid') });
    vi.mocked(usersService.fetchAllUsers).mockResolvedValue([SELF_USER, OTHER_USER]);
    renderPage();

    await screen.findByTestId('user-row-own-uid');
    expect(screen.getByTestId('user-is-self-own-uid')).toBeInTheDocument();
    const selfSelect = screen.getByTestId('role-select-own-uid').querySelector('input');
    expect(selfSelect).toBeDisabled();
  });

  it("does not disable another user's role selector", async () => {
    useAuthStore.setState({ role: 'super_admin', user: asUser('own-uid') });
    vi.mocked(usersService.fetchAllUsers).mockResolvedValue([SELF_USER, OTHER_USER]);
    renderPage();

    await screen.findByTestId('user-row-other-uid');
    const otherSelect = screen
      .getByTestId('role-select-other-uid')
      .querySelector('input');
    expect(otherSelect).not.toBeDisabled();
  });

  // --- Role change flow ----------------------------------------------------

  it('opens a confirmation dialog when a new role is selected for another user', async () => {
    useAuthStore.setState({ role: 'super_admin', user: asUser('own-uid') });
    vi.mocked(usersService.fetchAllUsers).mockResolvedValue([OTHER_USER]);
    renderPage();
    await screen.findByTestId('user-row-other-uid');

    const user = userEvent.setup();
    await user.click(
      within(screen.getByTestId('role-select-other-uid')).getByRole('combobox')
    );
    await user.click(await screen.findByRole('option', { name: 'Host' }));

    expect(await screen.findByTestId('confirm-role-change-button')).toBeInTheDocument();
    expect(
      screen.getByText(/Change Jane Doe's role from Member to Host\?/)
    ).toBeInTheDocument();
    expect(usersService.updateUserRole).not.toHaveBeenCalled();
  });

  it('calls updateUserRole and refetches on confirm', async () => {
    useAuthStore.setState({ role: 'super_admin', user: asUser('own-uid') });
    vi.mocked(usersService.fetchAllUsers).mockResolvedValue([OTHER_USER]);
    vi.mocked(usersService.updateUserRole).mockResolvedValue({
      uid: 'other-uid',
      role: 'host',
    });
    renderPage();
    await screen.findByTestId('user-row-other-uid');

    const user = userEvent.setup();
    await user.click(
      within(screen.getByTestId('role-select-other-uid')).getByRole('combobox')
    );
    await user.click(await screen.findByRole('option', { name: 'Host' }));
    await user.click(await screen.findByTestId('confirm-role-change-button'));

    await waitFor(() =>
      expect(usersService.updateUserRole).toHaveBeenCalledWith('other-uid', 'host')
    );
    expect(await screen.findByTestId('role-change-success')).toBeInTheDocument();
    // Once on mount, once more after the successful change.
    await waitFor(() =>
      expect(vi.mocked(usersService.fetchAllUsers)).toHaveBeenCalledTimes(2)
    );
  });

  it('shows an error alert when updateUserRole is rejected (e.g. by the self-demotion guard server-side)', async () => {
    useAuthStore.setState({ role: 'super_admin', user: asUser('own-uid') });
    vi.mocked(usersService.fetchAllUsers).mockResolvedValue([OTHER_USER]);
    vi.mocked(usersService.updateUserRole).mockRejectedValue(
      new Error('permission-denied')
    );
    renderPage();
    await screen.findByTestId('user-row-other-uid');

    const user = userEvent.setup();
    await user.click(
      within(screen.getByTestId('role-select-other-uid')).getByRole('combobox')
    );
    await user.click(await screen.findByRole('option', { name: 'Host' }));
    await user.click(await screen.findByTestId('confirm-role-change-button'));

    expect(await screen.findByTestId('role-change-error')).toBeInTheDocument();
  });

  it('does not call updateUserRole when the dialog is cancelled', async () => {
    useAuthStore.setState({ role: 'super_admin', user: asUser('own-uid') });
    vi.mocked(usersService.fetchAllUsers).mockResolvedValue([OTHER_USER]);
    renderPage();
    await screen.findByTestId('user-row-other-uid');

    const user = userEvent.setup();
    await user.click(
      within(screen.getByTestId('role-select-other-uid')).getByRole('combobox')
    );
    await user.click(await screen.findByRole('option', { name: 'Host' }));
    await user.click(await screen.findByText('Cancel'));

    await waitFor(() =>
      expect(screen.queryByTestId('confirm-role-change-button')).not.toBeInTheDocument()
    );
    expect(usersService.updateUserRole).not.toHaveBeenCalled();
  });
});

/**
 * SUSPENDING A MEMBER -- for how long, why, and by whom.
 *
 * M7 had a single toggle. It could say "suspended" and nothing else,
 * which meant every suspension was permanent, none had a recorded
 * reason, and a church administrator looking at an account a month
 * later had no way to find out what had happened or when it would end.
 *
 * These tests are about the three things that were missing: the terms
 * going in, the terms coming back out, and a temporary suspension
 * ending by itself without anybody rewriting anything.
 */
const SUSPENDED_TEMPORARILY: AdminUserSummary = {
  ...OTHER_USER,
  uid: 'paused-uid',
  displayName: 'Paused Member',
  accountStatus: 'suspended',
  suspension: {
    kind: 'temporary',
    reason: 'Repeated abusive messages in the church chat',
    startedAt: new Date('2026-06-01T09:00:00Z'),
    // Far enough out that the test is not racing the clock.
    expiresAt: new Date('2099-01-01T00:00:00Z'),
    byUid: 'own-uid',
    byName: 'Self Admin',
  },
};

const SUSPENDED_PERMANENTLY: AdminUserSummary = {
  ...OTHER_USER,
  uid: 'banned-uid',
  displayName: 'Banned Member',
  accountStatus: 'suspended',
  suspension: {
    kind: 'permanent',
    reason: null,
    startedAt: new Date('2026-06-01T09:00:00Z'),
    expiresAt: null,
    byUid: 'own-uid',
    byName: 'Self Admin',
  },
};

const SUSPENSION_EXPIRED: AdminUserSummary = {
  ...OTHER_USER,
  uid: 'expired-uid',
  displayName: 'Back Again',
  accountStatus: 'suspended',
  suspension: {
    kind: 'temporary',
    reason: 'A week off',
    startedAt: new Date('2026-05-01T09:00:00Z'),
    expiresAt: new Date('2026-05-08T09:00:00Z'),
    byUid: 'own-uid',
    byName: 'Self Admin',
  },
};

async function openDetail(uid: string) {
  const user = userEvent.setup();
  await screen.findByTestId(`user-row-${uid}`);
  await user.click(screen.getByTestId(`user-details-${uid}`));
  await screen.findByTestId('user-detail');
  return user;
}

describe('the account status column', () => {
  it('names the kind of suspension, not just "suspended"', async () => {
    useAuthStore.setState({ role: 'super_admin', user: asUser('own-uid') });
    vi.mocked(usersService.fetchAllUsers).mockResolvedValue([
      SUSPENDED_TEMPORARILY,
      SUSPENDED_PERMANENTLY,
    ]);
    renderPage();

    expect(await screen.findByTestId('user-status-paused-uid')).toHaveTextContent(
      'Suspended (temporary)'
    );
    expect(screen.getByTestId('user-status-banned-uid')).toHaveTextContent(
      'Suspended (permanent)'
    );
  });

  it('stops calling an EXPIRED suspension a suspension', async () => {
    // Nothing rewrote accountStatus -- it still says 'suspended'. The
    // column must not repeat that at a church administrator as though
    // the member were still barred.
    useAuthStore.setState({ role: 'super_admin', user: asUser('own-uid') });
    vi.mocked(usersService.fetchAllUsers).mockResolvedValue([SUSPENSION_EXPIRED]);
    renderPage();

    expect(await screen.findByTestId('user-status-expired-uid')).toHaveTextContent(
      'Suspension expired'
    );
  });
});

describe('the suspension dialogue', () => {
  it('offers temporary durations and a permanent option', async () => {
    useAuthStore.setState({ role: 'super_admin', user: asUser('own-uid') });
    vi.mocked(usersService.fetchAllUsers).mockResolvedValue([OTHER_USER, SELF_USER]);
    renderPage();
    const user = await openDetail('other-uid');

    await user.click(screen.getByTestId('user-detail-suspend'));
    await screen.findByTestId('suspend-confirm');

    expect(screen.getByRole('radio', { name: '1 day' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '7 days' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '30 days' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Until a date I choose' })).toBeInTheDocument();
    expect(
      screen.getByRole('radio', {
        name: 'Permanently, until an admin restores access',
      })
    ).toBeInTheDocument();
  });

  it('suspends for seven days, carrying the reason through', async () => {
    useAuthStore.setState({ role: 'super_admin', user: asUser('own-uid') });
    vi.mocked(usersService.fetchAllUsers).mockResolvedValue([OTHER_USER, SELF_USER]);
    vi.mocked(usersService.suspendUser).mockResolvedValue(undefined);
    renderPage();
    const user = await openDetail('other-uid');

    await user.click(screen.getByTestId('user-detail-suspend'));
    await screen.findByTestId('suspend-confirm');
    await user.click(screen.getByRole('radio', { name: '7 days' }));
    await user.type(screen.getByTestId('suspend-reason'), 'Abusive messages');
    await user.click(screen.getByTestId('suspend-confirm'));

    await waitFor(() => expect(usersService.suspendUser).toHaveBeenCalled());
    const [uid, request] = vi.mocked(usersService.suspendUser).mock.calls[0]!;
    expect(uid).toBe('other-uid');
    expect(request.kind).toBe('temporary');
    expect(request.reason).toBe('Abusive messages');
    // Seven days out, give or take the second the test took to run.
    const days = (request.expiresAt!.getTime() - Date.now()) / (24 * 60 * 60 * 1000);
    expect(days).toBeGreaterThan(6.9);
    expect(days).toBeLessThan(7.1);
  });

  it('suspends permanently, with no end date at all', async () => {
    useAuthStore.setState({ role: 'super_admin', user: asUser('own-uid') });
    vi.mocked(usersService.fetchAllUsers).mockResolvedValue([OTHER_USER, SELF_USER]);
    vi.mocked(usersService.suspendUser).mockResolvedValue(undefined);
    renderPage();
    const user = await openDetail('other-uid');

    await user.click(screen.getByTestId('user-detail-suspend'));
    await screen.findByTestId('suspend-confirm');
    await user.click(
      screen.getByRole('radio', {
        name: 'Permanently, until an admin restores access',
      })
    );
    await user.click(screen.getByTestId('suspend-confirm'));

    await waitFor(() => expect(usersService.suspendUser).toHaveBeenCalled());
    const [, request] = vi.mocked(usersService.suspendUser).mock.calls[0]!;
    expect(request.kind).toBe('permanent');
    expect(request.expiresAt).toBeNull();
  });

  it('asks for a date when "until a date I choose" is picked, and refuses to send without one', async () => {
    useAuthStore.setState({ role: 'super_admin', user: asUser('own-uid') });
    vi.mocked(usersService.fetchAllUsers).mockResolvedValue([OTHER_USER, SELF_USER]);
    renderPage();
    const user = await openDetail('other-uid');

    await user.click(screen.getByTestId('user-detail-suspend'));
    await screen.findByTestId('suspend-confirm');
    await user.click(screen.getByRole('radio', { name: 'Until a date I choose' }));
    expect(await screen.findByTestId('suspend-custom-date')).toBeInTheDocument();

    await user.click(screen.getByTestId('suspend-confirm'));
    expect(
      await screen.findByText('Choose when the suspension should end.')
    ).toBeInTheDocument();
    expect(usersService.suspendUser).not.toHaveBeenCalled();
  });

  it('refuses a date that has already passed', async () => {
    useAuthStore.setState({ role: 'super_admin', user: asUser('own-uid') });
    vi.mocked(usersService.fetchAllUsers).mockResolvedValue([OTHER_USER, SELF_USER]);
    renderPage();
    const user = await openDetail('other-uid');

    await user.click(screen.getByTestId('user-detail-suspend'));
    await screen.findByTestId('suspend-confirm');
    await user.click(screen.getByRole('radio', { name: 'Until a date I choose' }));
    const field = await screen.findByTestId('suspend-custom-date');
    await user.clear(field);
    await user.type(field, '2020-01-01');
    await user.click(screen.getByTestId('suspend-confirm'));

    expect(await screen.findByText(/already passed/i)).toBeInTheDocument();
    expect(usersService.suspendUser).not.toHaveBeenCalled();
  });

  it('writes nothing when the dialogue is cancelled', async () => {
    useAuthStore.setState({ role: 'super_admin', user: asUser('own-uid') });
    vi.mocked(usersService.fetchAllUsers).mockResolvedValue([OTHER_USER, SELF_USER]);
    renderPage();
    const user = await openDetail('other-uid');

    await user.click(screen.getByTestId('user-detail-suspend'));
    await screen.findByTestId('suspend-confirm');
    await user.click(screen.getByText('Cancel'));

    await waitFor(() =>
      expect(screen.queryByTestId('suspend-confirm')).not.toBeInTheDocument()
    );
    expect(usersService.suspendUser).not.toHaveBeenCalled();
  });

  it('says so when the write is refused', async () => {
    useAuthStore.setState({ role: 'super_admin', user: asUser('own-uid') });
    vi.mocked(usersService.fetchAllUsers).mockResolvedValue([OTHER_USER, SELF_USER]);
    vi.mocked(usersService.suspendUser).mockRejectedValue(new Error('denied'));
    renderPage();
    const user = await openDetail('other-uid');

    await user.click(screen.getByTestId('user-detail-suspend'));
    await screen.findByTestId('suspend-confirm');
    await user.click(screen.getByTestId('suspend-confirm'));

    expect(await screen.findByTestId('suspend-error')).toBeInTheDocument();
  });
});

describe('the terms, read back', () => {
  it('shows why, when it started, when it ends and who did it', async () => {
    useAuthStore.setState({ role: 'super_admin', user: asUser('own-uid') });
    vi.mocked(usersService.fetchAllUsers).mockResolvedValue([SUSPENDED_TEMPORARILY]);
    renderPage();
    await openDetail('paused-uid');

    expect(screen.getByTestId('user-detail-suspension-kind')).toHaveTextContent(
      'Temporary'
    );
    expect(screen.getByTestId('user-detail-suspension-reason')).toHaveTextContent(
      'Repeated abusive messages in the church chat'
    );
    expect(screen.getByTestId('user-detail-suspension-started')).not.toHaveTextContent(
      '—'
    );
    expect(screen.getByTestId('user-detail-suspension-by')).toHaveTextContent(
      'Self Admin'
    );
  });

  it('says a permanent suspension ends only when an admin says so', async () => {
    useAuthStore.setState({ role: 'super_admin', user: asUser('own-uid') });
    vi.mocked(usersService.fetchAllUsers).mockResolvedValue([SUSPENDED_PERMANENTLY]);
    renderPage();
    await openDetail('banned-uid');

    expect(screen.getByTestId('user-detail-suspension-ends')).toHaveTextContent(
      'Only when an admin restores access'
    );
  });

  it('admits when no reason was written down', async () => {
    useAuthStore.setState({ role: 'super_admin', user: asUser('own-uid') });
    vi.mocked(usersService.fetchAllUsers).mockResolvedValue([SUSPENDED_PERMANENTLY]);
    renderPage();
    await openDetail('banned-uid');

    expect(screen.getByTestId('user-detail-suspension-reason')).toHaveTextContent(
      'None recorded'
    );
  });
});

describe('restoring access', () => {
  it('is offered for a suspended member, and clears the suspension', async () => {
    useAuthStore.setState({ role: 'super_admin', user: asUser('own-uid') });
    vi.mocked(usersService.fetchAllUsers).mockResolvedValue([SUSPENDED_TEMPORARILY]);
    vi.mocked(usersService.restoreUserAccess).mockResolvedValue(undefined);
    renderPage();
    const user = await openDetail('paused-uid');

    await user.click(screen.getByTestId('user-detail-restore'));
    await waitFor(() =>
      expect(usersService.restoreUserAccess).toHaveBeenCalledWith('paused-uid')
    );
  });

  it('is still offered once a temporary suspension has expired', async () => {
    // The record is stale, and clearing it is how an administrator
    // tidies the account up.
    useAuthStore.setState({ role: 'super_admin', user: asUser('own-uid') });
    vi.mocked(usersService.fetchAllUsers).mockResolvedValue([SUSPENSION_EXPIRED]);
    renderPage();
    await openDetail('expired-uid');

    expect(screen.getByTestId('user-detail-restore')).toBeInTheDocument();
  });

  it('is not offered for a member nobody suspended', async () => {
    useAuthStore.setState({ role: 'super_admin', user: asUser('own-uid') });
    vi.mocked(usersService.fetchAllUsers).mockResolvedValue([OTHER_USER, SELF_USER]);
    renderPage();
    await openDetail('other-uid');

    expect(screen.queryByTestId('user-detail-restore')).not.toBeInTheDocument();
  });
});

describe('suspending yourself', () => {
  it('is not possible from this page', async () => {
    // The rules refuse it too. This is the half that stops an
    // administrator locking the church out of its own dashboard by
    // accident.
    useAuthStore.setState({ role: 'super_admin', user: asUser('own-uid') });
    vi.mocked(usersService.fetchAllUsers).mockResolvedValue([SELF_USER, OTHER_USER]);
    renderPage();
    await openDetail('own-uid');

    expect(screen.getByTestId('user-detail-suspend')).toBeDisabled();
  });
});

describe('what the page tells an administrator a suspension does', () => {
  it('does not claim the sign-in has been disabled', async () => {
    // It has not been, and it cannot be on this plan. Saying otherwise
    // would have a church believe somebody had been locked out when
    // they had not.
    useAuthStore.setState({ role: 'super_admin', user: asUser('own-uid') });
    vi.mocked(usersService.fetchAllUsers).mockResolvedValue([OTHER_USER, SELF_USER]);
    renderPage();
    await openDetail('other-uid');

    expect(screen.getByText(/they stay signed in/i)).toBeInTheDocument();
    expect(screen.getByText(/cannot disable a Firebase sign-in/i)).toBeInTheDocument();
  });
});
