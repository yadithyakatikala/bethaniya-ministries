import {
  isSuspended,
  memberSuspensionState,
  msUntilSuspensionEnds,
  type MemberAccount,
} from '../suspension';

/**
 * AM I SUSPENDED RIGHT NOW?
 *
 * The answer is not the stored field, and these tests exist to stop it
 * quietly becoming the stored field again. `accountStatus` records what
 * an administrator decided; whether it still binds depends on the
 * clock, because a temporary suspension runs out with nothing rewriting
 * anything.
 *
 * The same rule is written three times -- here, in the dashboard, and in
 * firestore.rules. Only the last one restrains anybody; these two exist
 * so that what a person is shown matches what the server will do.
 */
const NOW = new Date('2026-06-15T12:00:00Z');

function account(
  accountStatus: 'active' | 'suspended',
  suspension: MemberAccount['suspension'] = null
): MemberAccount {
  return { accountStatus, suspension };
}

function terms(
  kind: 'temporary' | 'permanent',
  expiresAt: Date | null
): MemberAccount['suspension'] {
  return { kind, startedAt: new Date('2026-06-01T00:00:00Z'), expiresAt };
}

describe('the state of my account', () => {
  it('is active when nothing has been recorded', () => {
    expect(memberSuspensionState(account('active'), NOW)).toBe('active');
    expect(isSuspended(account('active'), NOW)).toBe(false);
  });

  it('is temporary while the end is still ahead', () => {
    const user = account('suspended', terms('temporary', new Date('2026-06-20T00:00:00Z')));
    expect(memberSuspensionState(user, NOW)).toBe('temporary');
    expect(isSuspended(user, NOW)).toBe(true);
  });

  it('is EXPIRED once it has passed, with the stored field unchanged', () => {
    const user = account('suspended', terms('temporary', new Date('2026-06-14T00:00:00Z')));
    expect(user.accountStatus).toBe('suspended');
    expect(memberSuspensionState(user, NOW)).toBe('expired');
    expect(isSuspended(user, NOW)).toBe(false);
  });

  it('flips exactly at the expiry, not a moment either side', () => {
    const at = new Date('2026-06-15T12:00:00Z');
    const user = account('suspended', terms('temporary', at));
    expect(isSuspended(user, new Date(at.getTime() - 1))).toBe(true);
    expect(isSuspended(user, at)).toBe(false);
  });

  it('is permanent when there is no end', () => {
    const user = account('suspended', terms('permanent', null));
    expect(memberSuspensionState(user, NOW)).toBe('permanent');
    expect(isSuspended(user, NOW)).toBe(true);
  });

  it('treats a suspension with NO TERMS as permanent, never expired', () => {
    // Accounts suspended before the terms existed carry only the
    // status. Reading a missing expiry as "over" would have let every
    // one of them straight back in on the day this shipped.
    const legacy = account('suspended');
    expect(memberSuspensionState(legacy, NOW)).toBe('permanent');
    expect(isSuspended(legacy, NOW)).toBe(true);
  });

  it('ignores terms left behind on a restored account', () => {
    expect(isSuspended(account('active', terms('permanent', null)), NOW)).toBe(false);
  });
});

describe('when to look again', () => {
  it('waits until a temporary suspension ends', () => {
    const user = account('suspended', terms('temporary', new Date('2026-06-15T12:01:00Z')));
    expect(msUntilSuspensionEnds(user, NOW)).toBe(60_000);
  });

  it('caps a long wait, so a wrong clock cannot strand anybody', () => {
    const user = account('suspended', terms('temporary', new Date('2026-07-15T12:00:00Z')));
    const wait = msUntilSuspensionEnds(user, NOW)!;
    expect(wait).toBeLessThanOrEqual(5 * 60 * 1000);
    expect(wait).toBeGreaterThan(0);
  });

  it('never returns zero, so nothing can spin on the boundary', () => {
    const user = account('suspended', terms('temporary', new Date('2026-06-15T12:00:00.100Z')));
    expect(msUntilSuspensionEnds(user, NOW)).toBeGreaterThanOrEqual(1000);
  });

  it('has nothing to wait for on a permanent suspension', () => {
    expect(msUntilSuspensionEnds(account('suspended', terms('permanent', null)), NOW)).toBeNull();
  });

  it('has nothing to wait for on an active account', () => {
    expect(msUntilSuspensionEnds(account('active'), NOW)).toBeNull();
  });

  it('has nothing to wait for once it has already expired', () => {
    const user = account('suspended', terms('temporary', new Date('2026-06-01T00:00:00Z')));
    expect(msUntilSuspensionEnds(user, NOW)).toBeNull();
  });
});
