/**
 * How the admin site writes a date.
 *
 * Before this, each page chose for itself: some printed the browser's
 * default (`10/13/2026, 4:10:16 PM` on a US-set laptop, `13/10/2026` on an
 * Indian one), some spelled the month, and the same moment looked
 * different from one page to the next. The church is in India, where the
 * day comes first, so every page now says it the same way, with the month
 * spelled so nobody has to guess which number is which:
 *
 *   formatDate      14 Oct 2026
 *   formatDateTime  14 Oct 2026, 18:10
 *
 * The time shows in the viewer's own time zone, because that is the clock
 * they are looking at. A missing date is a dash, never the word "null".
 */

const DATE = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

const DATE_TIME = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

/** What a missing date reads as. */
export const NO_DATE = '—';

function usable(date: Date | null | undefined): date is Date {
  return date instanceof Date && !Number.isNaN(date.getTime());
}

export function formatDate(date: Date | null | undefined, fallback = NO_DATE): string {
  return usable(date) ? DATE.format(date) : fallback;
}

export function formatDateTime(
  date: Date | null | undefined,
  fallback = NO_DATE
): string {
  return usable(date) ? DATE_TIME.format(date) : fallback;
}
