/**
 * The three states a Prophet Verse can be in, and which one the app is
 * actually showing.
 *
 * In its own module rather than beside the list page, because both are
 * pure functions worth testing directly -- and because a file that
 * exports components and helpers together breaks Fast Refresh.
 *
 * ---------------------------------------------------------------------
 * WHY THERE ARE THREE STATES AND NOT TWO
 * ---------------------------------------------------------------------
 * DRAFT and SCHEDULED look identical to a member: neither is visible. But
 * they are very different to an administrator -- one still needs
 * publishing, the other is already done and simply waiting. Collapsing
 * them into "not visible" would leave a pastor unable to tell whether
 * Sunday's word is ready.
 */
import type { ProphetVerseRecord } from '../../services/firebase/prophetVerses';

export type ProphetVerseState = 'draft' | 'scheduled' | 'showing';

export function stateOf(verse: ProphetVerseRecord, now: Date): ProphetVerseState {
  if (!verse.published) return 'draft';
  if (!verse.publishAt || verse.publishAt.getTime() > now.getTime()) return 'scheduled';
  return 'showing';
}

/**
 * Which record the app is currently showing: among those published AND
 * due, the one with the latest `publishAt`.
 *
 * Ties fall to the document id DESCENDING, because that is Firestore's
 * own implicit `__name__` ordering for the app's query (it follows the
 * direction of the last explicit orderBy). Mirroring the tie-break is
 * what keeps this page from marking a different record than the app
 * shows; the rule is documented in
 * mobile/src/services/firebase/prophetVerses.ts.
 */
export function currentProphetVerseId(
  verses: ProphetVerseRecord[],
  now: Date
): string | null {
  const due = verses.filter((verse) => stateOf(verse, now) === 'showing');
  if (due.length === 0) return null;
  const best = due.reduce((winner, candidate) => {
    const winnerAt = winner.publishAt?.getTime() ?? 0;
    const candidateAt = candidate.publishAt?.getTime() ?? 0;
    if (candidateAt > winnerAt) return candidate;
    if (candidateAt < winnerAt) return winner;
    return candidate.id > winner.id ? candidate : winner;
  });
  return best.id;
}
