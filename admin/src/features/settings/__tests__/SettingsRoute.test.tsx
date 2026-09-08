import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SettingsPage } from '../SettingsPage';
import { ProtectedRoute } from '../../../routes/ProtectedRoute';
import { useAuthStore } from '../../../store/authStore';
import * as settingsService from '../../../services/firebase/settings';
import type { ChurchSettings } from '../../../types';
import type { User } from 'firebase/auth';

vi.mock('../../../services/firebase/settings');

/**
 * Route-level access proof for /settings, requested as part of this
 * session's Day 13 RBAC re-verification: exercises the actual
 * ProtectedRoute boundary App.tsx wraps every admin route in (see that
 * file), not just SettingsPage.tsx's own internal role branching
 * (already covered by ./SettingsPage.test.tsx).
 *
 * Confirms the exact Day 13 RBAC decision this session made explicit:
 * FINAL_ARCHITECTURE_SPECIFICATION.md's Database Access Control table
 * gives `settings` a Member "Read" row too, but that row describes
 * direct Firestore access (what the *mobile* app does -- see
 * mobile/src/services/firebase/settings.ts), not the admin dashboard.
 * ProtectedRoute.tsx's boundary (host-or-above) applies uniformly to
 * every admin route regardless of a collection's own RBAC row -- the
 * same reason a Member never reaches AnnouncementsListPage or
 * EventsListPage either, despite also having "Read" access to those
 * collections. So: Super Admin/Content Admin/Host all reach Settings
 * (view-only for the latter two, per SettingsPage.tsx's own internal
 * gate), and a Member reaches none of it -- ProtectedRoute denies the
 * page entirely, the identical outcome as every other admin route,
 * verified here by never rendering SettingsPage as a real Firestore
 * subscriber (subscribeToChurchSettings must never even be called) for
 * a Member.
 */
function asUser(uid: string): User {
  return { uid } as unknown as User;
}

const EXISTING_SETTINGS: ChurchSettings = {
  churchName: 'Bethaniya Ministries',
  logoUrl: 'https://example.com/logo.png',
  description: 'A community of faith, worship, and fellowship.',
  supportEmail: 'support@example.com',
  updatedAt: null,
};

function mockSubscription() {
  vi.mocked(settingsService.subscribeToChurchSettings).mockImplementation((onNext) => {
    onNext(EXISTING_SETTINGS);
    return vi.fn();
  });
}

function renderSettingsRoute() {
  return render(
    <MemoryRouter initialEntries={['/settings']}>
      <ProtectedRoute>
        <SettingsPage />
      </ProtectedRoute>
    </MemoryRouter>
  );
}

describe('/settings route access', () => {
  afterEach(() => {
    vi.mocked(settingsService.subscribeToChurchSettings).mockReset();
  });

  it('lets a super_admin reach Settings with editable fields and a Save button', () => {
    useAuthStore.setState({
      status: 'authenticated',
      role: 'super_admin',
      roleLoaded: true,
      user: asUser('super-1'),
    });
    mockSubscription();
    renderSettingsRoute();

    expect(screen.getByTestId('settings-page')).toBeInTheDocument();
    expect(screen.getByTestId('church-name-input')).toBeEnabled();
    expect(screen.getByTestId('settings-save-button')).toBeInTheDocument();
    expect(screen.queryByTestId('settings-readonly-notice')).not.toBeInTheDocument();
  });

  it('lets a content_admin reach Settings, read-only (no Save button)', () => {
    useAuthStore.setState({
      status: 'authenticated',
      role: 'content_admin',
      roleLoaded: true,
      user: asUser('ca-1'),
    });
    mockSubscription();
    renderSettingsRoute();

    expect(screen.getByTestId('settings-page')).toBeInTheDocument();
    expect(screen.getByTestId('church-name-input')).toBeDisabled();
    expect(screen.getByTestId('settings-readonly-notice')).toBeInTheDocument();
    expect(screen.queryByTestId('settings-save-button')).not.toBeInTheDocument();
  });

  it('lets a host reach Settings, read-only (no Save button)', () => {
    useAuthStore.setState({
      status: 'authenticated',
      role: 'host',
      roleLoaded: true,
      user: asUser('host-1'),
    });
    mockSubscription();
    renderSettingsRoute();

    expect(screen.getByTestId('settings-page')).toBeInTheDocument();
    expect(screen.getByTestId('church-name-input')).toBeDisabled();
    expect(screen.getByTestId('settings-readonly-notice')).toBeInTheDocument();
    expect(screen.queryByTestId('settings-save-button')).not.toBeInTheDocument();
  });

  it('denies a member the admin Settings page entirely, same as every other admin route', () => {
    useAuthStore.setState({
      status: 'authenticated',
      role: 'member',
      roleLoaded: true,
      user: asUser('member-1'),
    });
    renderSettingsRoute();

    expect(screen.getByTestId('unauthorized-message')).toBeInTheDocument();
    expect(screen.queryByTestId('settings-page')).not.toBeInTheDocument();
    expect(settingsService.subscribeToChurchSettings).not.toHaveBeenCalled();
  });
});
