import {
  INDIA_UTC_OFFSET_MINUTES,
  addDays,
  daysSinceEpoch,
  indiaDateKey,
  isDateKey,
} from '../votdDate';

/**
 * The canonical date, checked at the minute boundaries that decide which
 * verse a congregation sees.
 *
 * WHY THIS MATTERS. Until M5 the app asked the DEVICE what day it was,
 * so which verse you saw depended on where you were standing. These
 * tests pin the opposite: one Indian calendar date, the same for
 * everyone, whatever the phone thinks.
 */
describe('the canonical Indian date', () => {
  it('is UTC+05:30', () => {
    expect(INDIA_UTC_OFFSET_MINUTES).toBe(330);
  });

  it('rolls over at 00:00 IST, not at midnight UTC', () => {
    // 18:29:59 UTC is 23:59:59 IST -- still the 14th in India.
    expect(indiaDateKey(new Date('2026-03-14T18:29:59.000Z'))).toBe('2026-03-14');
    // One second later is 00:00:00 IST on the 15th.
    expect(indiaDateKey(new Date('2026-03-14T18:30:00.000Z'))).toBe('2026-03-15');
  });

  it('is already tomorrow in India while it is still today in UTC', () => {
    // 23:59 UTC on the 14th is 05:29 IST on the 15th.
    expect(indiaDateKey(new Date('2026-03-14T23:59:00.000Z'))).toBe('2026-03-15');
    // And midnight UTC on the 15th is 05:30 IST, still the 15th.
    expect(indiaDateKey(new Date('2026-03-15T00:00:00.000Z'))).toBe('2026-03-15');
  });

  it('is unaffected by the device timezone', () => {
    // getUTCFullYear() and friends never consult the host zone; the
    // point of this test is that swapping TZ changes nothing.
    const instant = new Date('2026-03-14T20:00:00.000Z');
    const original = process.env.TZ;
    const seen = new Set<string>();
    for (const zone of [
      'UTC',
      'America/Los_Angeles',
      'Pacific/Kiritimati',
      'Asia/Kolkata',
    ]) {
      process.env.TZ = zone;
      seen.add(indiaDateKey(instant));
    }
    process.env.TZ = original;
    expect([...seen]).toEqual(['2026-03-15']);
  });

  it('agrees with Intl where the runtime actually has a timezone database', () => {
    // The fixed-offset shortcut is verified, not merely asserted. Skipped
    // rather than failed on a build without full ICU -- which is exactly
    // the case the shortcut exists for.
    let intlDate: string;
    try {
      intlDate = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date('2026-03-14T18:30:00.000Z'));
    } catch {
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(intlDate)) return;
    expect(indiaDateKey(new Date('2026-03-14T18:30:00.000Z'))).toBe(intlDate);
  });

  it('handles a year boundary', () => {
    expect(indiaDateKey(new Date('2025-12-31T18:29:59.000Z'))).toBe('2025-12-31');
    expect(indiaDateKey(new Date('2025-12-31T18:30:00.000Z'))).toBe('2026-01-01');
  });

  it('handles a leap day', () => {
    expect(indiaDateKey(new Date('2028-02-28T18:30:00.000Z'))).toBe('2028-02-29');
    expect(indiaDateKey(new Date('2028-02-29T18:30:00.000Z'))).toBe('2028-03-01');
  });
});

describe('date keys', () => {
  it('accepts a well-formed key and rejects everything else', () => {
    expect(isDateKey('2026-03-14')).toBe(true);
    for (const bad of [
      '2026-3-14',
      '14-03-2026',
      '2026/03/14',
      '',
      'today',
      null,
      20260314,
    ]) {
      expect(isDateKey(bad)).toBe(false);
    }
  });

  it('counts days from the epoch without consulting the device zone', () => {
    expect(daysSinceEpoch('1970-01-01')).toBe(0);
    expect(daysSinceEpoch('1970-01-02')).toBe(1);
    expect(daysSinceEpoch('2026-03-15')! - daysSinceEpoch('2026-03-14')!).toBe(1);
  });

  it('counts backwards before the epoch rather than wrapping', () => {
    expect(daysSinceEpoch('1969-12-31')).toBe(-1);
  });

  it('refuses a date that does not exist, instead of rolling it over', () => {
    // Date.UTC(2026, 1, 30) would silently become 2 March.
    expect(daysSinceEpoch('2026-02-30')).toBeNull();
    expect(daysSinceEpoch('2026-13-01')).toBeNull();
    expect(daysSinceEpoch('not-a-date')).toBeNull();
  });

  it('steps forward and back across month and year ends', () => {
    expect(addDays('2026-03-14', 1)).toBe('2026-03-15');
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2025-12-31', 1)).toBe('2026-01-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(addDays('nonsense', 1)).toBeNull();
  });
});
