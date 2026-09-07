import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { onAuthStateChanged } from 'firebase/auth';
import { getDoc } from 'firebase/firestore';
import App from './App';

vi.mock('./services/firebase/app', () => ({
  auth: {},
  db: {},
  storage: {},
  usingFirebaseEmulators: true,
}));

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: vi.fn(() => vi.fn()),
  signInWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  getDoc: vi.fn(),
}));

/**
 * Day 2 replaces the Day 1 static-placeholder smoke test with real coverage
 * of the three states an unauthenticated / authenticated-but-unauthorized /
 * authenticated-and-authorized visitor sees, driven through the actual
 * authStore + ProtectedRoute + router wiring -- only the underlying Firebase
 * SDK calls are mocked.
 */
describe('App', () => {
  const mockedOnAuthStateChanged = vi.mocked(onAuthStateChanged);
  const mockedGetDoc = vi.mocked(getDoc);

  afterEach(() => {
    mockedOnAuthStateChanged.mockReset();
    mockedGetDoc.mockReset();
  });

  it('redirects an unauthenticated visitor to the login page', async () => {
    mockedOnAuthStateChanged.mockImplementation((_auth, onNext) => {
      (onNext as (u: unknown) => void)(null);
      return vi.fn();
    });
    render(<App />);
    await waitFor(() =>
      expect(screen.getByTestId('login-submit-button')).toBeInTheDocument()
    );
  });

  it('denies dashboard access to a signed-in Member', async () => {
    mockedOnAuthStateChanged.mockImplementation((_auth, onNext) => {
      (onNext as (u: unknown) => void)({ uid: 'member-1', email: 'member@example.com' });
      return vi.fn();
    });
    mockedGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ role: 'member' }),
    } as never);

    render(<App />);
    await waitFor(() =>
      expect(screen.getByTestId('unauthorized-message')).toBeInTheDocument()
    );
  });

  it('shows the dashboard shell to a signed-in Host', async () => {
    mockedOnAuthStateChanged.mockImplementation((_auth, onNext) => {
      (onNext as (u: unknown) => void)({ uid: 'host-1', email: 'host@example.com' });
      return vi.fn();
    });
    mockedGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ role: 'host' }),
    } as never);

    render(<App />);
    await waitFor(() => expect(screen.getByTestId('dashboard-page')).toBeInTheDocument());
    expect(screen.getByText('Welcome, host@example.com')).toBeInTheDocument();
  });
});
