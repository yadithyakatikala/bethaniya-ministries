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

const OTHER_USER: AdminUserSummary = {
  uid: 'other-uid',
  displayName: 'Jane Doe',
  email: 'jane@example.com',
  phoneNumber: '+10000000000',
  role: 'member',
  createdAt: new Date('2026-01-01T00:00:00Z'),
};

const SELF_USER: AdminUserSummary = {
  uid: 'own-uid',
  displayName: 'Self Admin',
  email: 'self@example.com',
  phoneNumber: null,
  role: 'super_admin',
  createdAt: new Date('2025-06-01T00:00:00Z'),
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
