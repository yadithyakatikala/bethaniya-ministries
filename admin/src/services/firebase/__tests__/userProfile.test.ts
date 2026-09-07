import { describe, expect, it, vi } from 'vitest';
import { getDoc } from 'firebase/firestore';
import { fetchOwnRole } from '../userProfile';

vi.mock('../app', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  getDoc: vi.fn(),
}));

describe('fetchOwnRole', () => {
  it('returns the role from the profile document when it exists', async () => {
    vi.mocked(getDoc).mockResolvedValue({
      exists: () => true,
      data: () => ({ role: 'content_admin' }),
    } as never);
    await expect(fetchOwnRole('uid-1')).resolves.toBe('content_admin');
  });

  it('returns null when the profile document does not exist', async () => {
    vi.mocked(getDoc).mockResolvedValue({ exists: () => false } as never);
    await expect(fetchOwnRole('uid-2')).resolves.toBeNull();
  });

  it('returns null rather than throwing when the role field is missing or malformed', async () => {
    vi.mocked(getDoc).mockResolvedValue({
      exists: () => true,
      data: () => ({}),
    } as never);
    await expect(fetchOwnRole('uid-3')).resolves.toBeNull();
  });
});
