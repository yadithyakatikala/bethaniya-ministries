import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SettingsPage } from '../SettingsPage';
import { useAuthStore } from '../../../store/authStore';
import * as settingsService from '../../../services/firebase/settings';
import type { ChurchSettings } from '../../../types';
import type { User } from 'firebase/auth';

vi.mock('../../../services/firebase/settings');

function renderPage() {
  return render(<SettingsPage />);
}

function asUser(uid: string): User {
  return { uid } as unknown as User;
}

const EXISTING_SETTINGS: ChurchSettings = {
  churchName: 'Bethaniya Ministries',
  logoUrl: 'https://example.com/logo.png',
  description: 'A community of faith, worship, and fellowship.',
  supportEmail: 'support@example.com',
  updatedAt: new Date('2026-01-01T00:00:00Z'),
};

/** Fires `onNext` synchronously with the given settings (or null), matching
 * how the real Firestore SDK's onSnapshot callback fires. */
function mockSubscription(settings: ChurchSettings | null) {
  vi.mocked(settingsService.subscribeToChurchSettings).mockImplementation((onNext) => {
    onNext(settings);
    return vi.fn();
  });
}

describe('SettingsPage', () => {
  afterEach(() => {
    vi.mocked(settingsService.subscribeToChurchSettings).mockReset();
    vi.mocked(settingsService.saveChurchSettings).mockReset();
  });

  it('shows a loading state before the first snapshot arrives', () => {
    useAuthStore.setState({ role: 'super_admin', user: asUser('own-uid') });
    vi.mocked(settingsService.subscribeToChurchSettings).mockImplementation(() =>
      vi.fn()
    );
    renderPage();
    expect(screen.getByTestId('settings-loading')).toBeInTheDocument();
  });

  it('shows an error state when the subscription fails', () => {
    useAuthStore.setState({ role: 'super_admin', user: asUser('own-uid') });
    vi.mocked(settingsService.subscribeToChurchSettings).mockImplementation(
      (_onNext, onError) => {
        onError({ code: 'permission-denied' } as never);
        return vi.fn();
      }
    );
    renderPage();
    expect(screen.getByTestId('settings-load-error')).toBeInTheDocument();
  });

  it('seeds the form with the existing settings document', () => {
    useAuthStore.setState({ role: 'super_admin', user: asUser('own-uid') });
    mockSubscription(EXISTING_SETTINGS);
    renderPage();
    expect(screen.getByTestId('church-name-input')).toHaveValue('Bethaniya Ministries');
    expect(screen.getByTestId('logo-url-input')).toHaveValue(
      'https://example.com/logo.png'
    );
    expect(screen.getByTestId('support-email-input')).toHaveValue('support@example.com');
  });

  it('renders empty fields when no settings document exists yet', () => {
    useAuthStore.setState({ role: 'super_admin', user: asUser('own-uid') });
    mockSubscription(null);
    renderPage();
    expect(screen.getByTestId('church-name-input')).toHaveValue('');
  });

  it('shows a read-only notice and disabled fields, no Save button, for a content_admin', () => {
    useAuthStore.setState({ role: 'content_admin', user: asUser('ca-uid') });
    mockSubscription(EXISTING_SETTINGS);
    renderPage();
    expect(screen.getByTestId('settings-readonly-notice')).toBeInTheDocument();
    expect(screen.getByTestId('church-name-input')).toBeDisabled();
    expect(screen.queryByTestId('settings-save-button')).not.toBeInTheDocument();
  });

  it('shows a read-only notice and disabled fields, no Save button, for a host', () => {
    useAuthStore.setState({ role: 'host', user: asUser('host-uid') });
    mockSubscription(EXISTING_SETTINGS);
    renderPage();
    expect(screen.getByTestId('settings-readonly-notice')).toBeInTheDocument();
    expect(screen.getByTestId('logo-url-input')).toBeDisabled();
    expect(screen.queryByTestId('settings-save-button')).not.toBeInTheDocument();
  });

  it('shows editable fields and a Save button for a super_admin, with no read-only notice', () => {
    useAuthStore.setState({ role: 'super_admin', user: asUser('own-uid') });
    mockSubscription(EXISTING_SETTINGS);
    renderPage();
    expect(screen.queryByTestId('settings-readonly-notice')).not.toBeInTheDocument();
    expect(screen.getByTestId('church-name-input')).toBeEnabled();
    expect(screen.getByTestId('settings-save-button')).toBeInTheDocument();
  });

  it('blocks the confirm dialog and shows a field error when church name is cleared', async () => {
    const user = userEvent.setup();
    useAuthStore.setState({ role: 'super_admin', user: asUser('own-uid') });
    mockSubscription(EXISTING_SETTINGS);
    renderPage();

    await user.clear(screen.getByTestId('church-name-input'));
    await user.click(screen.getByTestId('settings-save-button'));

    expect(screen.getByText('Church name is required.')).toBeInTheDocument();
    expect(screen.queryByTestId('confirm-save-settings-button')).not.toBeInTheDocument();
    expect(settingsService.saveChurchSettings).not.toHaveBeenCalled();
  });

  it('blocks the confirm dialog and shows a field error for an invalid logo URL', async () => {
    const user = userEvent.setup();
    useAuthStore.setState({ role: 'super_admin', user: asUser('own-uid') });
    mockSubscription(EXISTING_SETTINGS);
    renderPage();

    await user.clear(screen.getByTestId('logo-url-input'));
    await user.type(screen.getByTestId('logo-url-input'), 'not-a-url');
    await user.click(screen.getByTestId('settings-save-button'));

    expect(screen.getByText('Logo URL must be a valid http(s) URL.')).toBeInTheDocument();
    expect(settingsService.saveChurchSettings).not.toHaveBeenCalled();
  });

  it('saves successfully: opens the confirm dialog, calls saveChurchSettings, shows success', async () => {
    const user = userEvent.setup();
    useAuthStore.setState({ role: 'super_admin', user: asUser('own-uid') });
    mockSubscription(EXISTING_SETTINGS);
    vi.mocked(settingsService.saveChurchSettings).mockResolvedValue(undefined);
    renderPage();

    await user.click(screen.getByTestId('settings-save-button'));
    expect(await screen.findByTestId('confirm-save-settings-button')).toBeInTheDocument();

    await user.click(screen.getByTestId('confirm-save-settings-button'));

    await waitFor(() =>
      expect(settingsService.saveChurchSettings).toHaveBeenCalledWith({
        churchName: 'Bethaniya Ministries',
        logoUrl: 'https://example.com/logo.png',
        description: 'A community of faith, worship, and fellowship.',
        supportEmail: 'support@example.com',
      })
    );
    expect(await screen.findByTestId('settings-form-success')).toBeInTheDocument();
  });

  it('does not call saveChurchSettings when the confirm dialog is cancelled', async () => {
    const user = userEvent.setup();
    useAuthStore.setState({ role: 'super_admin', user: asUser('own-uid') });
    mockSubscription(EXISTING_SETTINGS);
    renderPage();

    await user.click(screen.getByTestId('settings-save-button'));
    expect(await screen.findByTestId('confirm-save-settings-button')).toBeInTheDocument();

    await user.click(screen.getByText('Cancel'));

    await waitFor(() =>
      expect(screen.queryByTestId('confirm-save-settings-button')).not.toBeInTheDocument()
    );
    expect(settingsService.saveChurchSettings).not.toHaveBeenCalled();
  });

  it('shows a form error when the save fails', async () => {
    const user = userEvent.setup();
    useAuthStore.setState({ role: 'super_admin', user: asUser('own-uid') });
    mockSubscription(EXISTING_SETTINGS);
    vi.mocked(settingsService.saveChurchSettings).mockRejectedValue(new Error('network'));
    renderPage();

    await user.click(screen.getByTestId('settings-save-button'));
    await user.click(await screen.findByTestId('confirm-save-settings-button'));

    expect(await screen.findByTestId('settings-form-error')).toBeInTheDocument();
  });
});
