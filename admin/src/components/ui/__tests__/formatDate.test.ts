import { describe, expect, it } from 'vitest';
import { NO_DATE, formatDate, formatDateTime } from '..';

// Built from local-time parts, so the answer does not depend on the time
// zone of the machine running the tests (the formatter shows local time).
const MOMENT = new Date(2026, 9, 14, 18, 10, 16);

describe('formatDate', () => {
  it('puts the day first and spells the month', () => {
    expect(formatDate(MOMENT)).toBe('14 Oct 2026');
  });

  it('is the same wherever the browser is set to the United States', () => {
    // The old pages printed toLocaleString(), which is 10/14/2026 there and
    // 14/10/2026 here -- the same day, written two ways.
    expect(formatDate(MOMENT)).not.toMatch(/\d\/\d/);
  });

  it('reads a missing or broken date as a dash, never "null" or "Invalid Date"', () => {
    expect(formatDate(null)).toBe(NO_DATE);
    expect(formatDate(undefined)).toBe(NO_DATE);
    expect(formatDate(new Date('not a date'))).toBe(NO_DATE);
  });

  it('lets a page say something other than a dash', () => {
    expect(formatDate(null, 'Unknown')).toBe('Unknown');
  });
});

describe('formatDateTime', () => {
  it('adds the time on a 24-hour clock, to the minute', () => {
    expect(formatDateTime(MOMENT)).toBe('14 Oct 2026, 18:10');
  });

  it('shows a morning time with its leading zero', () => {
    expect(formatDateTime(new Date(2026, 10, 4, 6, 5))).toBe('4 Nov 2026, 06:05');
  });

  it('reads a missing or broken moment as the fallback', () => {
    expect(formatDateTime(null)).toBe(NO_DATE);
    expect(formatDateTime(new Date(Number.NaN), 'Unknown')).toBe('Unknown');
  });
});
