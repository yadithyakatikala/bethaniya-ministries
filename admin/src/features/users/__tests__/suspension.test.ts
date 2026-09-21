import { describe, expect, it } from 'vitest';
import {
  MAX_REASON_LENGTH,
  SUSPENSION_DURATIONS,
  describeSuspension,
  expiryAfterDays,
  expiryAtEndOfDay,
  hasSuspensionErrors,
  isSuspensionInForce,
  suspensionState,
  timeRemaining,
  validateSuspensionRequest,
} from '../suspension';
import type { AdminUserSummary, Suspension } from '../../../types';

/**
 * IS THIS MEMBER SUSPENDED RIGHT NOW?
 *
 * The answer is not the stored field, and these tests exist to keep it
 * from quietly becoming the stored field again. `accountStatus` records
 * a DECISION; whether that decision still binds depends on the clock,
 * and nothing rewrites it when a temporary suspension runs out -- a
 * scheduled job to do that would need a Cloud Function, which needs
 * Blaze, which this project does not use.
 *
 * `now` is passed in everywhere rather than read from the clock, so
 * "three days from now" is a fact in the test rather than a race.
 */
const NOW = new Date('2026-06-15T12:00:00Z');

function account(
  accountStatus: 'active' | 'suspended',
  suspension: Partial<Suspension> | null = null
): Pick<AdminUserSummary, 'accountStatus' | 'suspension'> {
  return {
    accountStatus,
    suspension: suspension
      ? {
          kind: 'temporary',
          reason: null,
          startedAt: new Date('2026-06-01T00:00:00Z'),
          expiresAt: null,
          byUid: 'super-1',
          byName: 'Pastor',
          ...suspension,
        }
      : null,
  };
}

describe('the state of an account', () => {
  it('is active when nobody has suspended it', () => {
    expect(suspensionState(account('active'), NOW)).toBe('active');
    expect(isSuspensionInForce(account('active'), NOW)).toBe(false);
  });

  it('is temporary while the end date is still ahead', () => {
    const user = account('suspended', {
      kind: 'temporary',
      expiresAt: new Date('2026-06-20T00:00:00Z'),
    });
    expect(suspensionState(user, NOW)).toBe('temporary');
    expect(isSuspensionInForce(user, NOW)).toBe(true);
  });

  it('is EXPIRED once that date has passed, with nothing rewritten', () => {
    // The stored field still says 'suspended'. The account is not.
    const user = account('suspended', {
      kind: 'temporary',
      expiresAt: new Date('2026-06-14T00:00:00Z'),
    });
    expect(user.accountStatus).toBe('suspended');
    expect(suspensionState(user, NOW)).toBe('expired');
    expect(isSuspensionInForce(user, NOW)).toBe(false);
  });

  it('flips at the instant of expiry, not a day either side', () => {
    const at = new Date('2026-06-15T12:00:00Z');
    const user = account('suspended', { kind: 'temporary', expiresAt: at });
    expect(suspensionState(user, new Date(at.getTime() - 1))).toBe('temporary');
    expect(suspensionState(user, at)).toBe('expired');
  });

  it('is permanent when there is no end date', () => {
    const user = account('suspended', { kind: 'permanent', expiresAt: null });
    expect(suspensionState(user, NOW)).toBe('permanent');
    expect(isSuspensionInForce(user, NOW)).toBe(true);
  });

  it('treats a suspension with NO TERMS AT ALL as permanent', () => {
    // Accounts suspended before the terms existed carry only the
    // status. Reading a missing expiry as "over" would reinstate every
    // one of them the day this shipped.
    const legacy = account('suspended');
    expect(suspensionState(legacy, NOW)).toBe('permanent');
    expect(isSuspensionInForce(legacy, NOW)).toBe(true);
  });

  it('ignores terms left on an account somebody restored', () => {
    // accountStatus is what says whether. Stale terms are history.
    const restored = account('active', {
      kind: 'permanent',
      expiresAt: null,
    });
    expect(suspensionState(restored, NOW)).toBe('active');
  });
});

describe('choosing how long', () => {
  it('offers one day, seven days and thirty', () => {
    expect(SUSPENSION_DURATIONS.map((duration) => duration.days)).toEqual([1, 7, 30]);
  });

  it('turns a number of days into a moment', () => {
    expect(expiryAfterDays(7, NOW).toISOString()).toBe('2026-06-22T12:00:00.000Z');
  });

  it('takes a chosen DATE to the END of that day', () => {
    // "The 14th" means the suspension covers the 14th. Midnight would
    // end it as the day began -- a whole day short of what was meant.
    const end = expiryAtEndOfDay('2026-06-14');
    expect(end).not.toBeNull();
    expect(end!.getHours()).toBe(23);
    expect(end!.getMinutes()).toBe(59);
    expect(end!.getDate()).toBe(14);
  });

  it('refuses a date the calendar does not have', () => {
    // Date would roll 30 February into March rather than refuse.
    expect(expiryAtEndOfDay('2026-02-30')).toBeNull();
    expect(expiryAtEndOfDay('2026-13-01')).toBeNull();
    expect(expiryAtEndOfDay('not-a-date')).toBeNull();
  });
});

describe('checking the request before it is sent', () => {
  it('accepts a temporary suspension ending in the future', () => {
    const errors = validateSuspensionRequest(
      { kind: 'temporary', expiresAt: new Date('2026-07-01'), reason: null },
      NOW
    );
    expect(hasSuspensionErrors(errors)).toBe(false);
  });

  it('asks for an end date on a temporary one', () => {
    const errors = validateSuspensionRequest(
      { kind: 'temporary', expiresAt: null, reason: null },
      NOW
    );
    expect(errors.expiresAt).toBeTruthy();
  });

  it('refuses a date that has already gone', () => {
    // The rules refuse it too. Catching it here makes it a sentence
    // under the field rather than a permission error.
    const errors = validateSuspensionRequest(
      { kind: 'temporary', expiresAt: new Date('2026-06-01'), reason: null },
      NOW
    );
    expect(errors.expiresAt).toMatch(/already passed/i);
  });

  it('needs no date for a permanent one', () => {
    const errors = validateSuspensionRequest(
      { kind: 'permanent', expiresAt: null, reason: null },
      NOW
    );
    expect(hasSuspensionErrors(errors)).toBe(false);
  });

  it('caps the reason at the length the rules cap it at', () => {
    const errors = validateSuspensionRequest(
      {
        kind: 'permanent',
        expiresAt: null,
        reason: 'x'.repeat(MAX_REASON_LENGTH + 1),
      },
      NOW
    );
    expect(errors.reason).toBeTruthy();
  });

  it('accepts no reason at all', () => {
    const errors = validateSuspensionRequest(
      { kind: 'permanent', expiresAt: null, reason: null },
      NOW
    );
    expect(hasSuspensionErrors(errors)).toBe(false);
  });
});

describe('saying it in words', () => {
  it('describes a permanent suspension without a date', () => {
    expect(describeSuspension({ kind: 'permanent', expiresAt: null, reason: null })).toBe(
      'until an admin restores access'
    );
  });

  it('describes a temporary one by when it ends', () => {
    const text = describeSuspension({
      kind: 'temporary',
      expiresAt: new Date('2026-06-20T10:00:00Z'),
      reason: null,
    });
    expect(text).toMatch(/^until /);
  });

  it('counts down in days, then hours, then minutes', () => {
    const base = (expiresAt: Date): Suspension => ({
      kind: 'temporary',
      reason: null,
      startedAt: NOW,
      expiresAt,
      byUid: 'super-1',
      byName: null,
    });
    expect(timeRemaining(base(new Date('2026-06-18T12:00:00Z')), NOW)).toBe('3 days left');
    expect(timeRemaining(base(new Date('2026-06-16T12:00:00Z')), NOW)).toBe('1 day left');
    expect(timeRemaining(base(new Date('2026-06-15T17:00:00Z')), NOW)).toBe('5 hours left');
    expect(timeRemaining(base(new Date('2026-06-15T12:30:00Z')), NOW)).toBe(
      '30 minutes left'
    );
  });

  it('counts down to nothing once it is over', () => {
    expect(
      timeRemaining(
        {
          kind: 'temporary',
          reason: null,
          startedAt: NOW,
          expiresAt: new Date('2026-06-14T12:00:00Z'),
          byUid: 'super-1',
          byName: null,
        },
        NOW
      )
    ).toBeNull();
  });

  it('has nothing to count down for a permanent suspension', () => {
    expect(
      timeRemaining(
        {
          kind: 'permanent',
          reason: null,
          startedAt: NOW,
          expiresAt: null,
          byUid: 'super-1',
          byName: null,
        },
        NOW
      )
    ).toBeNull();
  });
});
