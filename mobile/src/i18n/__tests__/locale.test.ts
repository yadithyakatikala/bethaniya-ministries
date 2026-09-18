import {
  formatDateTime,
  formatIsoDateString,
  formatLongDate,
  formatShortDate,
  formatsDatesInTelugu,
  localeFor,
} from '../locale';

/**
 * Dates follow the APP language, and never throw.
 *
 * Six screens used to format dates with no locale argument at all, which
 * means the DEVICE's locale: a phone set to US English printed
 * "9/20/2026, 9:30:00 AM" in the middle of an otherwise Telugu interface,
 * and nothing the member did in Settings could change it.
 *
 * The assertions below are deliberately about SHAPE and SAFETY rather
 * than exact wording. React Native's Hermes ships a trimmed ICU, and
 * Node's ICU build differs again, so pinning "18 September 2026" would
 * test the engine rather than this module. What must hold everywhere is
 * that a date comes back as a non-empty string, that a malformed stored
 * value is passed through instead of becoming "Invalid Date", and that no
 * call throws -- an event list must not blank out because the engine
 * lacks Telugu date data.
 */
const SAMPLE = new Date(2026, 8, 18, 9, 30);

describe('localeFor', () => {
  it('maps the two app languages to BCP 47 tags', () => {
    expect(localeFor('en')).toBe('en-US');
    // 'te-IN' rather than bare 'te': the regional form is what Android's
    // ICU data is keyed by in practice.
    expect(localeFor('te')).toBe('te-IN');
  });
});

describe('date formatting', () => {
  it('returns a non-empty string in both languages for every formatter', () => {
    for (const language of ['en', 'te'] as const) {
      expect(formatLongDate(SAMPLE, language).length).toBeGreaterThan(0);
      expect(formatShortDate(SAMPLE, language).length).toBeGreaterThan(0);
      expect(formatDateTime(SAMPLE, language).length).toBeGreaterThan(0);
    }
  });

  it('includes the year and day number whichever language is asked for', () => {
    for (const language of ['en', 'te'] as const) {
      const long = formatLongDate(SAMPLE, language);
      // Telugu uses Western digits for dates, so this holds in both.
      expect(long).toContain('2026');
      expect(long).toContain('18');
    }
  });

  it('spells the month out in the long form and abbreviates it in the short one', () => {
    // Compared against each other rather than against fixed wording, so
    // this states the difference between the two formatters without
    // pinning the engine's locale data.
    expect(formatLongDate(SAMPLE, 'en').length).toBeGreaterThan(
      formatShortDate(SAMPLE, 'en').length
    );
  });

  it('never throws, whatever the engine supports', () => {
    for (const language of ['en', 'te'] as const) {
      expect(() => formatLongDate(SAMPLE, language)).not.toThrow();
      expect(() => formatShortDate(SAMPLE, language)).not.toThrow();
      expect(() => formatDateTime(SAMPLE, language)).not.toThrow();
    }
  });
});

describe('formatIsoDateString', () => {
  it('formats the YYYY-MM-DD strings the daily-verse collection stores', () => {
    const formatted = formatIsoDateString('2026-09-18', 'en');
    expect(formatted).toContain('2026');
    expect(formatted).toContain('18');
    expect(formatted).not.toBe('2026-09-18');
  });

  it('returns a malformed value unchanged rather than rendering "Invalid Date"', () => {
    // A bad record in Firestore should show its raw value to whoever can
    // fix it, not a word that looks like a bug in the app.
    expect(formatIsoDateString('not-a-date', 'en')).toBe('not-a-date');
    expect(formatIsoDateString('', 'te')).toBe('');
  });
});

describe('formatsDatesInTelugu', () => {
  it('answers without throwing, so QA can tell a real Telugu date from a fallback', () => {
    // Diagnostic only -- nothing in the UI branches on it, and the answer
    // legitimately differs between Node here and Hermes on a device.
    expect(typeof formatsDatesInTelugu()).toBe('boolean');
  });
});
