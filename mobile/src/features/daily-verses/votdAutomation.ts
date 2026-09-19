/**
 * Loading the automated selection's two inputs, in the order that costs
 * the fewest Firestore reads.
 *
 *   1. The configuration document -- always, one read.
 *   2. The pool -- only if automation is ENABLED, and only if the device
 *      does not already have this `poolVersion` cached for today.
 *
 * Checking `enabled` before fetching the pool is worth the extra line: a
 * church that has switched automation off and curates every date by hand
 * pays one read per app open for the whole feature.
 *
 * Throws whatever Firestore threw. The caller treats a failure as "no
 * automation available", which resolves to the bundled fallback rather
 * than to an error -- see ./votdResolver.ts.
 */
import {
  fetchVersePool,
  fetchVotdConfig,
  type VotdAutomation,
} from '../../services/firebase/votd';
import { getCachedVersePool, setCachedVersePool } from './votdPoolCache';

export type { VotdAutomation };

export async function loadVotdAutomation(dateKey: string): Promise<VotdAutomation> {
  const config = await fetchVotdConfig();
  if (!config.enabled) return { config, pool: [] };

  const cached = await getCachedVersePool(config.poolVersion, dateKey);
  if (cached) return { config, pool: cached };

  const pool = await fetchVersePool();
  // Best-effort, and deliberately not awaited into the result: a device
  // that cannot write its cache should still get today's verse. The
  // .catch() is not redundant -- ./votdPoolCache.ts swallows its own
  // failures, but an unhandled rejection here would take the app down for
  // a full disk, so this does not depend on that.
  void setCachedVersePool(config.poolVersion, dateKey, pool).catch(() => {});
  return { config, pool };
}
