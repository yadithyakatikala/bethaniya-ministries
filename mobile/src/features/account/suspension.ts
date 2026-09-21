import type { AccountStatus, MemberSuspension } from '../../services/firebase/userProfile';

/**
 * =====================================================================
 * AM I SUSPENDED RIGHT NOW?
 * =====================================================================
 * The stored `accountStatus` records what an administrator DECIDED.
 * Whether it still binds depends on the clock, because a temporary
 * suspension expires without anything being rewritten -- there is no job
 * to flip the field back, and there cannot be one on this project's
 * Firebase plan.
 *
 * So the comparison is made wherever the question is asked. Three
 * places, all the same way:
 *
 *   firestore.rules   suspensionIsInForce(), against request.time.
 *                     THE BOUNDARY. It is what actually refuses a write,
 *                     and the only one the phone cannot influence.
 *   the admin         admin/src/features/users/suspension.ts.
 *   here              so a suspended member is TOLD, rather than left
 *                     tapping a composer that silently fails.
 *
 * =====================================================================
 * WHAT THIS MODULE IS AND IS NOT
 * =====================================================================
 * It is not security. A modified client could ignore every line of it,
 * which is precisely why the rules exist and why they do not depend on
 * it. What it does is make the app HONEST: it stops the member at the
 * door with an explanation instead of letting them write a prayer
 * request that the server will throw away.
 *
 * It is also not bypassable by restarting the app, which is a separate
 * claim and a real one. The check runs against the profile snapshot on
 * every launch and every return from the background -- there is no
 * locally cached "I am allowed" to reuse, and closing the app clears
 * nothing that would help.
 *
 * ---------------------------------------------------------------------
 * A MISSING EXPIRY IS PERMANENT, NEVER EXPIRED
 * ---------------------------------------------------------------------
 * Accounts suspended before the terms existed carry only the status.
 * Reading a missing expiry as "over" would have reinstated every one of
 * them on the day this shipped.
 */
export type MemberSuspensionState =
  /** Nothing recorded. */
  | 'active'
  /** Suspended, with an end that has not arrived. */
  | 'temporary'
  /** Suspended until an administrator lifts it. */
  | 'permanent'
  /** A temporary suspension whose end has passed. NOT in force. */
  | 'expired';

export interface MemberAccount {
  accountStatus: AccountStatus;
  suspension: MemberSuspension | null;
}

export function memberSuspensionState(
  account: MemberAccount,
  now: Date = new Date()
): MemberSuspensionState {
  if (account.accountStatus !== 'suspended') return 'active';

  const expiresAt = account.suspension?.expiresAt ?? null;
  if (expiresAt === null) return 'permanent';
  return expiresAt.getTime() > now.getTime() ? 'temporary' : 'expired';
}

/** True only while the member is actually barred. */
export function isSuspended(account: MemberAccount, now: Date = new Date()): boolean {
  const state = memberSuspensionState(account, now);
  return state === 'temporary' || state === 'permanent';
}

/**
 * When the app should look again, in milliseconds, or null if there is
 * nothing to wait for.
 *
 * THIS IS WHY A TEMPORARY SUSPENSION LETS GO BY ITSELF. Without it a
 * member whose suspension ends at four o'clock would sit on the notice
 * until they thought to force-quit the app, which is exactly the kind of
 * "it says I am still blocked" that makes software feel punitive.
 *
 * Clamped at both ends: at least a second, so a clock that has just
 * crossed the boundary cannot spin, and at most a few minutes, so a
 * device whose clock was wrong -- or that was asleep across the expiry --
 * still rechecks soon after waking. The app also rechecks on every
 * return from the background, which is the common case; this timer is
 * for the member who is holding the phone and watching.
 */
const MIN_RECHECK_MS = 1_000;
const MAX_RECHECK_MS = 5 * 60 * 1000;

export function msUntilSuspensionEnds(
  account: MemberAccount,
  now: Date = new Date()
): number | null {
  if (memberSuspensionState(account, now) !== 'temporary') return null;
  const expiresAt = account.suspension?.expiresAt;
  if (!expiresAt) return null;
  const remaining = expiresAt.getTime() - now.getTime();
  return Math.min(Math.max(remaining, MIN_RECHECK_MS), MAX_RECHECK_MS);
}
