import { describe, expect, it, vi } from 'vitest';

const { mockCallable } = vi.hoisted(() => ({ mockCallable: vi.fn() }));

vi.mock('../app', () => ({ functions: {} }));
vi.mock('firebase/functions', () => ({
  httpsCallable: vi.fn(() => mockCallable),
}));

import { logAdminAction } from '../auditLog';

// NOTE: this only asserts on `mockCallable` (the function httpsCallable()
// resolves to), not on `httpsCallable` itself -- 'firebase/functions'
// resolves to two separate mocked instances under Vitest depending on
// which file's import triggers the factory (a module-resolution quirk of
// the same general kind documented for 'firebase/auth' under Jest in
// mobile/__mocks__/firebase/auth.js), so httpsCallable's own call history
// as observed from this file is not reliable, even though the function it
// returns (mockCallable, shared via vi.hoisted) behaves correctly either way.
describe('logAdminAction', () => {
  it('calls the logAdminAction callable with the given input', async () => {
    mockCallable.mockResolvedValue({ data: { logged: true } });
    await logAdminAction({
      action: 'create',
      collection: 'announcements',
      documentId: 'a1',
      changeSummary: 'Created announcement "Test"',
    });
    expect(mockCallable).toHaveBeenCalledWith({
      action: 'create',
      collection: 'announcements',
      documentId: 'a1',
      changeSummary: 'Created announcement "Test"',
    });
  });

  it('does not throw when the callable fails -- a failed audit log must not block the caller', async () => {
    mockCallable.mockRejectedValue(new Error('functions emulator unreachable'));
    await expect(
      logAdminAction({
        action: 'delete',
        collection: 'announcements',
        documentId: 'a2',
        changeSummary: 'Deleted announcement "Test"',
      })
    ).resolves.toBeUndefined();
  });
});
