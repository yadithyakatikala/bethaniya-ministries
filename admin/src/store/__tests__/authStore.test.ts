import { afterEach, describe, expect, it, vi } from 'vitest';
import { subscribeToAuthChanges, useAuthStore } from '../authStore';
import { onAuthStateChanged } from 'firebase/auth';
import { signInWithEmail, signOutUser } from '../../services/firebase/authService';
import { toFriendlyAuthMessage } from '../../services/firebase/authErrors';
import { fetchOwnRole } from '../../services/firebase/userProfile';

vi.mock('../../services/firebase/app', () => ({ auth: {} }));
vi.mock('../../services/firebase/authService', () => ({
  signInWithEmail: vi.fn(),
  signOutUser: vi.fn(),
}));
vi.mock('../../services/firebase/authErrors', () => ({
  toFriendlyAuthMessage: vi.fn(() => 'Something went wrong. Please try again.'),
}));
vi.mock('../../services/firebase/userProfile', () => ({
  fetchOwnRole: vi.fn(),
}));
vi.mock('firebase/auth', () => ({
  onAuthStateChanged: vi.fn(() => vi.fn()),
}));

const INITIAL_STATE = {
  status: 'loading' as const,
  user: null,
  role: null,
  roleLoaded: false,
  authErrorMessage: null,
};

/**
 * Day 15 -- direct unit tests of the authStore Zustand slice itself
 * (state transitions, subscribeToAuthChanges' branches), distinct from
 * App.test.tsx's existing coverage, which only proves the *rendered*
 * outcome of a couple of these states through the full component tree.
 * useAuthStore is a real module-level singleton (see authStore.ts's own
 * doc comment on why -- test isolation requires per-test control of the
 * onAuthStateChanged subscription itself, not the store), so every test
 * resets it to a known state first rather than relying on creation order.
 */
describe('authStore', () => {
  afterEach(() => {
    useAuthStore.setState(INITIAL_STATE);
    vi.mocked(signInWithEmail).mockReset();
    vi.mocked(signOutUser).mockReset();
    vi.mocked(fetchOwnRole).mockReset();
    vi.mocked(onAuthStateChanged)
      .mockReset()
      .mockImplementation(() => vi.fn());
  });

  describe('signIn', () => {
    it('clears any previous error and delegates to signInWithEmail on success', async () => {
      useAuthStore.setState({ authErrorMessage: 'stale error from a previous attempt' });
      vi.mocked(signInWithEmail).mockResolvedValue(undefined as never);

      await useAuthStore.getState().signIn('host@example.com', 'correct-password');

      expect(signInWithEmail).toHaveBeenCalledWith(
        'host@example.com',
        'correct-password'
      );
      expect(useAuthStore.getState().authErrorMessage).toBeNull();
    });

    it('sets a friendly error message and rethrows when signInWithEmail rejects', async () => {
      const rawError = new Error('auth/wrong-password');
      vi.mocked(signInWithEmail).mockRejectedValue(rawError);

      await expect(
        useAuthStore.getState().signIn('host@example.com', 'wrong-password')
      ).rejects.toThrow(rawError);

      expect(toFriendlyAuthMessage).toHaveBeenCalledWith(rawError);
      expect(useAuthStore.getState().authErrorMessage).toBe(
        'Something went wrong. Please try again.'
      );
    });
  });

  describe('signOut', () => {
    it('delegates to signOutUser', async () => {
      vi.mocked(signOutUser).mockResolvedValue(undefined);
      await useAuthStore.getState().signOut();
      expect(signOutUser).toHaveBeenCalled();
    });
  });

  describe('clearAuthError', () => {
    it('resets authErrorMessage to null', () => {
      useAuthStore.setState({ authErrorMessage: 'some error' });
      useAuthStore.getState().clearAuthError();
      expect(useAuthStore.getState().authErrorMessage).toBeNull();
    });
  });

  describe('subscribeToAuthChanges', () => {
    it('sets status unauthenticated and clears user/role when Firebase reports no user', () => {
      useAuthStore.setState({
        status: 'authenticated',
        user: { uid: 'old-uid' } as never,
        role: 'super_admin',
        roleLoaded: true,
      });
      vi.mocked(onAuthStateChanged).mockImplementation((_auth, onNext) => {
        (onNext as (u: unknown) => void)(null);
        return vi.fn();
      });

      subscribeToAuthChanges();

      expect(useAuthStore.getState()).toMatchObject({
        status: 'unauthenticated',
        user: null,
        role: null,
        roleLoaded: false,
      });
    });

    it('sets status authenticated immediately, then fills in role once fetchOwnRole resolves', async () => {
      const user = { uid: 'host-1' } as never;
      vi.mocked(onAuthStateChanged).mockImplementation((_auth, onNext) => {
        (onNext as (u: unknown) => void)(user);
        return vi.fn();
      });
      let resolveRole!: (role: 'host') => void;
      vi.mocked(fetchOwnRole).mockReturnValue(
        new Promise((resolve) => {
          resolveRole = resolve;
        })
      );

      subscribeToAuthChanges();

      // Role fetch is in flight -- authenticated, but not yet roleLoaded.
      expect(useAuthStore.getState()).toMatchObject({
        status: 'authenticated',
        user,
        role: null,
        roleLoaded: false,
      });

      resolveRole('host');
      await vi.waitFor(() => expect(useAuthStore.getState().roleLoaded).toBe(true));
      expect(useAuthStore.getState().role).toBe('host');
    });

    it('sets a friendly error and roleLoaded=true when fetchOwnRole rejects', async () => {
      const user = { uid: 'host-1' } as never;
      vi.mocked(onAuthStateChanged).mockImplementation((_auth, onNext) => {
        (onNext as (u: unknown) => void)(user);
        return vi.fn();
      });
      const rawError = new Error('permission-denied');
      vi.mocked(fetchOwnRole).mockRejectedValue(rawError);

      subscribeToAuthChanges();

      await vi.waitFor(() => expect(useAuthStore.getState().roleLoaded).toBe(true));
      expect(toFriendlyAuthMessage).toHaveBeenCalledWith(rawError);
      expect(useAuthStore.getState().authErrorMessage).toBe(
        'Something went wrong. Please try again.'
      );
    });

    it('sets status error with a friendly message when the Auth subsystem itself errors', () => {
      const rawError = new Error('network-request-failed');
      vi.mocked(onAuthStateChanged).mockImplementation((_auth, _onNext, onError) => {
        (onError as (e: unknown) => void)(rawError);
        return vi.fn();
      });

      subscribeToAuthChanges();

      expect(toFriendlyAuthMessage).toHaveBeenCalledWith(rawError);
      expect(useAuthStore.getState()).toMatchObject({
        status: 'error',
        authErrorMessage: 'Something went wrong. Please try again.',
      });
    });

    it('returns the unsubscribe function onAuthStateChanged provides', () => {
      const unsubscribe = vi.fn();
      vi.mocked(onAuthStateChanged).mockReturnValue(unsubscribe);
      expect(subscribeToAuthChanges()).toBe(unsubscribe);
    });
  });
});
