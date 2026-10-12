import {
  formatDateTime,
  formatDayMonthShort,
  formatEventWhen,
  formatIsoDateString,
  formatLongDate,
  formatMonthShort,
  formatNotificationWhen,
  formatShortDate,
  formatIsoWeekdayDate,
  formatWeekdayDate,
  formatWeekdayShort,
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

describe('the weekday formats on Home and on an event row', () => {
  // 11 October 2026 is a Sunday.
  const SUNDAY = new Date(2026, 9, 11, 9, 30);

  it('puts the day before the month, the way Home reads "Sunday, 11 October"', () => {
    const text = formatWeekdayDate(SUNDAY, 'en');
    expect(text).toMatch(/^[A-Za-z]+, 11 [A-Za-z]+$/);
  });

  it('returns a non-empty weekday date and abbreviation in both languages, whatever the engine', () => {
    for (const language of ['en', 'te'] as const) {
      expect(formatWeekdayDate(SUNDAY, language)).toContain('11');
      expect(formatWeekdayShort(SUNDAY, language).length).toBeGreaterThan(0);
    }
  });

  it('abbreviates the weekday', () => {
    expect(formatWeekdayShort(SUNDAY, 'en').length).toBeLessThanOrEqual(4);
  });
});

describe('formatDayMonthShort', () => {
  const NOW = new Date(2026, 9, 12, 12, 0);

  it('is the day then the abbreviated month for a date in this year', () => {
    expect(formatDayMonthShort(new Date(2026, 9, 9, 12, 0), 'en', NOW)).toBe('9 Oct');
    expect(formatDayMonthShort(new Date(2026, 8, 29, 12, 0), 'en', NOW)).toBe('29 Sep');
    expect(formatDayMonthShort(new Date(2026, 0, 1, 12, 0), 'en', NOW)).toBe('1 Jan');
  });

  it('adds the year for any other year, so an old date does not read as recent', () => {
    expect(formatDayMonthShort(new Date(2025, 11, 31, 12, 0), 'en', NOW)).toBe(
      '31 Dec 2025'
    );
    expect(formatDayMonthShort(new Date(2027, 0, 1, 12, 0), 'en', NOW)).toBe(
      '1 Jan 2027'
    );
  });

  it('puts the day before the month in Telugu too, and carries a Telugu month name', () => {
    const text = formatDayMonthShort(new Date(2026, 9, 9, 12, 0), 'te', NOW);
    expect(text.startsWith('9 ')).toBe(true);
    // A Telugu month where the engine has Telugu data; the English one where it does not.
    expect(text.length).toBeGreaterThan(2);
    if (formatsDatesInTelugu()) expect(text).toMatch(/[ఀ-౿]/u);
  });

  it('uses the clock only when it is not given one', () => {
    const today = new Date();
    expect(formatDayMonthShort(today, 'en')).toMatch(/^\d{1,2} [A-Za-z]+$/);
  });

  it('never throws and is never empty, whatever the engine supports', () => {
    for (const language of ['en', 'te'] as const) {
      expect(formatDayMonthShort(SAMPLE, language, NOW).length).toBeGreaterThan(0);
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

describe('formatIsoWeekdayDate', () => {
  it("names the calendar day a key stands for, in the phone's own zone", () => {
    // 2026-10-11 was a Sunday. A key is a CALENDAR day: it must not slide to
    // Saturday on a phone west of Greenwich, which is what reading it as UTC
    // midnight would do.
    expect(formatIsoWeekdayDate('2026-10-11', 'en')).toMatch(/^Sunday, 11 October$/);
  });

  it('works for the first and last day of a month and of a year', () => {
    expect(formatIsoWeekdayDate('2026-01-01', 'en')).toMatch(/^Thursday, 1 January$/);
    expect(formatIsoWeekdayDate('2026-12-31', 'en')).toMatch(/^Thursday, 31 December$/);
    expect(formatIsoWeekdayDate('2028-02-29', 'en')).toMatch(/^Tuesday, 29 February$/);
  });

  it('gives a Telugu reader a non-empty line that still carries the day number', () => {
    const text = formatIsoWeekdayDate('2026-10-11', 'te');
    expect(text.length).toBeGreaterThan(0);
    expect(text).toContain('11');
  });

  it('returns a malformed key unchanged rather than "Invalid Date"', () => {
    expect(formatIsoWeekdayDate('not-a-date', 'en')).toBe('not-a-date');
    expect(formatIsoWeekdayDate('', 'te')).toBe('');
  });
});

describe('formatsDatesInTelugu', () => {
  it('answers without throwing, so QA can tell a real Telugu date from a fallback', () => {
    // Diagnostic only -- nothing in the UI branches on it, and the answer
    // legitimately differs between Node here and Hermes on a device.
    expect(typeof formatsDatesInTelugu()).toBe('boolean');
  });
});

describe('formatEventWhen', () => {
  const NOW = new Date(2026, 9, 11, 8, 0);

  it('names the day for a later event and the time after a comma', () => {
    const text = formatEventWhen(new Date(2026, 9, 14, 18, 30), 'en', 'Today', NOW);
    expect(text).toMatch(/^Wed 14 Oct, /);
    expect(text).toMatch(/6:30\s?PM$/i);
  });

  it('says Today, in the word it is given, for an event starting today', () => {
    const text = formatEventWhen(new Date(2026, 9, 11, 10, 30), 'en', 'Today', NOW);
    expect(text).toMatch(/^Today, 10:30\s?AM$/i);
    expect(formatEventWhen(new Date(2026, 9, 11, 23, 59), 'en', 'ఈరోజు', NOW)).toMatch(
      /^ఈరోజు, /
    );
  });

  it('does not call yesterday or tomorrow "Today"', () => {
    expect(formatEventWhen(new Date(2026, 9, 10, 10, 0), 'en', 'Today', NOW)).not.toMatch(
      /^Today/
    );
    expect(formatEventWhen(new Date(2026, 9, 12, 10, 0), 'en', 'Today', NOW)).not.toMatch(
      /^Today/
    );
  });

  it('adds the year only when the event is not in this one', () => {
    expect(formatEventWhen(new Date(2027, 0, 3, 9, 0), 'en', 'Today', NOW)).toMatch(
      /^Sun 3 Jan 2027, /
    );
    // The same calendar day in another year is not today.
    expect(formatEventWhen(new Date(2027, 9, 11, 9, 0), 'en', 'Today', NOW)).not.toMatch(
      /^Today/
    );
  });

  it('puts the day before the month in Telugu too and never throws', () => {
    const text = formatEventWhen(new Date(2026, 9, 14, 18, 30), 'te', 'ఈరోజు', NOW);
    expect(text).toMatch(/ 14 /);
    expect(text.includes(', ')).toBe(true);
    expect(text.indexOf('14')).toBeLessThan(text.indexOf(','));
  });
});

describe('formatMonthShort', () => {
  it('is the abbreviated month alone, in either language, and never empty', () => {
    expect(formatMonthShort(new Date(2026, 9, 14, 12), 'en')).toBe('Oct');
    expect(formatMonthShort(new Date(2026, 9, 14, 12), 'te').length).toBeGreaterThan(0);
  });
});

describe('formatNotificationWhen', () => {
  const NOW = new Date(2026, 9, 12, 0, 10);
  const labels = { today: 'Today', yesterday: 'Yesterday' };

  it('says Today and Yesterday by CALENDAR day, so 11:50 pm last night is Yesterday at ten past midnight', () => {
    expect(
      formatNotificationWhen(new Date(2026, 9, 12, 0, 5), 'en', labels, NOW)
    ).toMatch(/^Today, /);
    expect(
      formatNotificationWhen(new Date(2026, 9, 11, 23, 50), 'en', labels, NOW)
    ).toMatch(/^Yesterday, /);
  });

  it('is the day and month, then the time, for anything older in this year', () => {
    expect(formatNotificationWhen(new Date(2026, 9, 6, 9, 0), 'en', labels, NOW)).toMatch(
      /^6 Oct, 9:00\s?AM$/i
    );
  });

  it('adds the year for another year', () => {
    expect(
      formatNotificationWhen(new Date(2025, 11, 31, 9, 0), 'en', labels, NOW)
    ).toMatch(/^31 Dec 2025, /);
  });

  it('uses the day words it is given, so a Telugu screen says them in Telugu', () => {
    expect(
      formatNotificationWhen(
        new Date(2026, 9, 12, 0, 5),
        'te',
        { today: 'ఈరోజు', yesterday: 'నిన్న' },
        NOW
      )
    ).toMatch(/^ఈరోజు, /);
  });

  it('does not call a time in the future yesterday', () => {
    const text = formatNotificationWhen(new Date(2026, 9, 13, 9, 0), 'en', labels, NOW);
    expect(text).not.toMatch(/^(Today|Yesterday)/);
  });
});
