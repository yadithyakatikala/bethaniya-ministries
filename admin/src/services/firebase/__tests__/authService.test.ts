import { describe, expect, it, vi } from 'vitest';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { signInWithEmail, signOutUser } from '../authService';

vi.mock('../app', () => ({ auth: {} }));
vi.mock('firebase/auth', () => ({
  signInWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
}));

describe('authService', () => {
  it('signs in with email and password against the wired Auth instance', async () => {
    vi.mocked(signInWithEmailAndPassword).mockResolvedValue({
      user: { uid: 'u1' },
    } as never);
    await signInWithEmail('host@example.com', 'secret123');
    expect(signInWithEmailAndPassword).toHaveBeenCalledWith(
      expect.anything(),
      'host@example.com',
      'secret123'
    );
  });

  it('signs the user out', async () => {
    vi.mocked(signOut).mockResolvedValue(undefined);
    await signOutUser();
    expect(signOut).toHaveBeenCalled();
  });
});
