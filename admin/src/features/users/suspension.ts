import type { AdminUserSummary, Suspension, SuspensionKind } from '../../types';

/**
 * =====================================================================
 * IS THIS MEMBER SUSPENDED RIGHT NOW?
 * =====================================================================
 * One function, because the question has one answer and it is not the
 * one stored on the document. `accountStatus` records what somebody
 * DECIDED. Whether that decision still binds depends on the clock, and
 * nothing rewrites the field when a temporary suspension runs out --
 * doing that on a schedule would need a Cloud Function, which needs
 * Blaze, which this project does not use.
 *
 * So the expiry is evaluated at read time. In three places, deliberately
 * the same way:
 *
 *   firestore.rules   suspensionIsInForce(), against request.time. THE
 *                     BOUNDARY -- it is what actually refuses a write,
 *                     and the only one the member cannot influence.
 *   this module       so the dashboard shows a church administrator
 *                     the truth rather than the stored field.
 *   the mobile app    so a suspended member is told, and is not left
 *                     tapping a composer that silently fails.
 *
 * The other two are honesty and courtesy. The rules are the security.
 *
 * ---------------------------------------------------------------------
 * WHY 'expired' IS A STATE AND NOT JUST 'active'
 * ---------------------------------------------------------------------
 * Because the record is still there and an administrator should see it.
 * "This member was suspended for a week in March and it ended" is a
 * different thing to say than "this member has never been suspended",
 * and a page that collapsed them would lose the only history this system
 * keeps.
 */
export type SuspensionState =
  /** No suspension has ever been recorded. */
  | 'active'
  /** Suspended, with an end date that has not arrived. */
  | 'temporary'
  /** Suspended until an administrator lifts it. */
  | 'permanent'
  /** A temporary suspension whose end date has passed. Not in force. */
  | 'expired';

/**
 * The state of one member's account at `now`.
 *
 * A suspension with no terms at all is PERMANENT, not expired. Accounts
 * suspended before the terms existed carry only `accountStatus`, and
 * reading a missing expiry as "over" would quietly reinstate every one
 * of them the day this shipped.
 */
export function suspensionState(
  user: Pick<AdminUserSummary, 'accountStatus' | 'suspension'>,
  now: Date = new Date()
): SuspensionState {
  if (user.accountStatus !== 'suspended') return 'active';

  const expiresAt = user.suspension?.expiresAt ?? null;
  if (expiresAt === null) return 'permanent';
  return expiresAt.getTime() > now.getTime() ? 'temporary' : 'expired';
}

/** True only while the member is actually barred from posting. */
export function isSuspensionInForce(
  user: Pick<AdminUserSummary, 'accountStatus' | 'suspension'>,
  now: Date = new Date()
): boolean {
  const state = suspensionState(user, now);
  return state === 'temporary' || state === 'permanent';
}

export const SUSPENSION_STATE_LABELS: Record<SuspensionState, string> = {
  active: 'Active',
  temporary: 'Suspended (temporary)',
  permanent: 'Suspended (permanent)',
  expired: 'Suspension expired',
};

/**
 * The durations offered in the dialog.
 *
 * Three, plus a date of the administrator's own choosing. A longer menu
 * would not help anyone decide; these are the ones a church actually
 * reaches for.
 */
export interface SuspensionDuration {
  id: string;
  label: string;
  days: number;
}

export const SUSPENSION_DURATIONS: readonly SuspensionDuration[] = [
  { id: '1d', label: '1 day', days: 1 },
  { id: '7d', label: '7 days', days: 7 },
  { id: '30d', label: '30 days', days: 30 },
];

/** Milliseconds in a day -- named, because `86400000` in an expression is not. */
const DAY_MS = 24 * 60 * 60 * 1000;

export function expiryAfterDays(days: number, from: Date = new Date()): Date {
  return new Date(from.getTime() + days * DAY_MS);
}

/**
 * The end of the chosen day, local time.
 *
 * A custom date is a DAY, not an instant: an administrator picking
 * "the 14th" means the suspension covers the 14th, so it ends when that
 * day does rather than at midnight as it begins.
 */
export function expiryAtEndOfDay(dateKey: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) return null;
  const [, year, month, day] = match;
  const date = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    23,
    59,
    59,
    999
  );
  // Rejects 2026-02-30 and friends, which Date would roll forward into
  // March rather than refuse.
  if (
    date.getFullYear() !== Number(year) ||
    date.getMonth() !== Number(month) - 1 ||
    date.getDate() !== Number(day)
  ) {
    return null;
  }
  return date;
}

/** What the administrator is about to do, ready to be written. */
export interface SuspensionRequest {
  kind: SuspensionKind;
  /** Required for 'temporary', and must be in the future. */
  expiresAt: Date | null;
  reason: string | null;
}

export interface SuspensionRequestErrors {
  expiresAt?: string;
  reason?: string;
}

export const MAX_REASON_LENGTH = 500;

/**
 * Checked here as well as in the rules, so a mistake is a sentence under
 * a field rather than a permission error the administrator cannot read.
 */
export function validateSuspensionRequest(
  request: SuspensionRequest,
  now: Date = new Date()
): SuspensionRequestErrors {
  const errors: SuspensionRequestErrors = {};

  if (request.kind === 'temporary') {
    if (!request.expiresAt) {
      errors.expiresAt = 'Choose when the suspension should end.';
    } else if (request.expiresAt.getTime() <= now.getTime()) {
      errors.expiresAt = 'That date has already passed. Choose a later one.';
    }
  }

  if (request.reason && request.reason.length > MAX_REASON_LENGTH) {
    errors.reason = `Keep the reason under ${MAX_REASON_LENGTH} characters.`;
  }

  return errors;
}

export function hasSuspensionErrors(errors: SuspensionRequestErrors): boolean {
  return Object.keys(errors).length > 0;
}

/** "7 days", "until 14 March 2026", "permanently" -- for the confirmation. */
export function describeSuspension(request: SuspensionRequest): string {
  if (request.kind === 'permanent') return 'until an admin restores access';
  if (!request.expiresAt) return 'for a period not yet chosen';
  return `until ${formatWhen(request.expiresAt)}`;
}

export function formatWhen(date: Date | null): string {
  if (!date) return '—';
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** How long is left, in words a person would use. Null once it is over. */
export function timeRemaining(
  suspension: Suspension | null,
  now: Date = new Date()
): string | null {
  const expiresAt = suspension?.expiresAt ?? null;
  if (!expiresAt) return null;
  const ms = expiresAt.getTime() - now.getTime();
  if (ms <= 0) return null;

  const days = Math.floor(ms / DAY_MS);
  if (days >= 1) return days === 1 ? '1 day left' : `${days} days left`;
  const hours = Math.floor(ms / (60 * 60 * 1000));
  if (hours >= 1) return hours === 1 ? '1 hour left' : `${hours} hours left`;
  const minutes = Math.max(1, Math.floor(ms / (60 * 1000)));
  return minutes === 1 ? '1 minute left' : `${minutes} minutes left`;
}
