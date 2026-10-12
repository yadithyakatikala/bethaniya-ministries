/**
 * Date and time formatting that follows the APP language.
 *
 * ---------------------------------------------------------------------
 * THE BUG THIS FIXES
 * ---------------------------------------------------------------------
 * Six screens formatted dates with `toLocaleDateString()` /
 * `toLocaleString()` and no locale argument, which means the DEVICE's
 * locale. So a phone set to US English showed "9/20/2026, 9:30:00 AM" on
 * an otherwise fully Telugu interface, and there was no way for the app
 * language to affect it. Two of those screens (announcement and community
 * post detail) never called `useTranslation()` at all.
 *
 * ---------------------------------------------------------------------
 * WHY EVERY CALL IS WRAPPED
 * ---------------------------------------------------------------------
 * React Native's JS engine does not guarantee full ICU data. Hermes on
 * Android ships a trimmed `Intl`, and asking for a locale it cannot
 * resolve can throw a RangeError rather than falling back quietly. A
 * church member's event list must not blank out because their engine
 * lacks Telugu date data, so every format goes through `safely()`: try
 * the requested locale, fall back to the engine default, and if even that
 * fails return an ISO-ish string rather than throwing.
 *
 * That fallback is a real possibility, not defensive paranoia, which is
 * why `formatsDatesInTelugu()` exists -- it reports whether the running
 * engine actually produced a Telugu-localized month name, so a test or a
 * QA pass can tell "Telugu dates work here" from "we silently got
 * English". Nothing in the UI branches on it.
 */
import type { BibleLanguage } from '../features/bible/types';

/**
 * BCP 47 tags for the two supported app languages. 'te-IN' rather than
 * bare 'te' because the regional form is what Android's ICU data is
 * keyed by in practice.
 */
const LOCALES: Record<BibleLanguage, string> = {
  en: 'en-US',
  te: 'te-IN',
};

export function localeFor(appLanguage: BibleLanguage): string {
  return LOCALES[appLanguage];
}

function safely(format: (locale?: string) => string, fallback: () => string): string {
  try {
    return format(undefined);
  } catch {
    try {
      return fallback();
    } catch {
      return '';
    }
  }
}

/** A date with its month spelled out -- "18 September 2026". */
export function formatLongDate(date: Date, appLanguage: BibleLanguage): string {
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  };
  return safely(
    () => date.toLocaleDateString(localeFor(appLanguage), options),
    () => date.toLocaleDateString(undefined, options)
  );
}

/** A compact date -- "18 Sep 2026". Used where space is tight. */
export function formatShortDate(date: Date, appLanguage: BibleLanguage): string {
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  };
  return safely(
    () => date.toLocaleDateString(localeFor(appLanguage), options),
    () => date.toLocaleDateString(undefined, options)
  );
}

/**
 * The day and the abbreviated month, for a row in a list -- "9 Oct" -- with
 * the year added only when it is not this one ("9 Oct 2025"): a date in the
 * current year needs no year, and an older one must not read as recent.
 *
 * Built from the day number and the month name rather than one Intl pattern,
 * so the day comes BEFORE the month in both languages (the en-US pattern
 * would give "Oct 9"), the way the approved lists show it. `now` is a
 * parameter, not a call to the clock, so this stays pure and a test can pin
 * the year boundary.
 */
export function formatDayMonthShort(
  date: Date,
  appLanguage: BibleLanguage,
  now: Date = new Date()
): string {
  const locale = localeFor(appLanguage);
  const options: Intl.DateTimeFormatOptions = { month: 'short' };
  const month = safely(
    () => date.toLocaleDateString(locale, options),
    () => date.toLocaleDateString(undefined, options)
  );
  const base = `${date.getDate()} ${month}`;
  return date.getFullYear() === now.getFullYear()
    ? base
    : `${base} ${date.getFullYear()}`;
}

/**
 * The day, as Home's date line says it -- "Sunday, 11 October".
 *
 * Built from the weekday, the day number and the month name rather than one
 * Intl pattern, so the day comes BEFORE the month in both languages (the
 * en-US pattern would give "Sunday, October 11"), and so a Telugu engine
 * that lacks one part still produces the others.
 */
export function formatWeekdayDate(date: Date, appLanguage: BibleLanguage): string {
  const locale = localeFor(appLanguage);
  const part = (options: Intl.DateTimeFormatOptions): string =>
    safely(
      () => date.toLocaleDateString(locale, options),
      () => date.toLocaleDateString(undefined, options)
    );
  const weekday = part({ weekday: 'long' });
  const month = part({ month: 'long' });
  return `${weekday}, ${date.getDate()} ${month}`;
}

/** The month abbreviated -- "Oct". For the date block on an event row. */
export function formatMonthShort(date: Date, appLanguage: BibleLanguage): string {
  const options: Intl.DateTimeFormatOptions = { month: 'short' };
  return safely(
    () => date.toLocaleDateString(localeFor(appLanguage), options),
    () => date.toLocaleDateString(undefined, options)
  );
}

/** The weekday abbreviated -- "Wed". For the date block on an event row. */
export function formatWeekdayShort(date: Date, appLanguage: BibleLanguage): string {
  const options: Intl.DateTimeFormatOptions = { weekday: 'short' };
  return safely(
    () => date.toLocaleDateString(localeFor(appLanguage), options),
    () => date.toLocaleDateString(undefined, options)
  );
}

/**
 * When an event starts, as its row and its page say it -- "Wed 14 Oct, 6:30 PM",
 * or "Today, 10:30 AM" for one that starts today (`todayLabel` is the word, in
 * the app's language: this module owns no strings). The year is added only when
 * it is not this one, like formatDayMonthShort. The day comes before the month
 * in both languages, and each part is built on its own so an engine that lacks
 * one of them (Telugu month names on a trimmed Hermes) still prints the rest.
 * `now` is a parameter so a test can pin "today".
 */
export function formatEventWhen(
  date: Date,
  appLanguage: BibleLanguage,
  todayLabel: string,
  now: Date = new Date()
): string {
  const time = formatTimeOfDay(date, appLanguage);
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  if (sameDay) return `${todayLabel}, ${time}`;
  const day = `${formatWeekdayShort(date, appLanguage)} ${formatDayMonthShort(
    date,
    appLanguage,
    now
  )}`;
  return `${day}, ${time}`;
}

/**
 * When a notification arrived, as the Notifications list says it -- "Today,
 * 10:31 AM", "Yesterday, 4:15 PM", "6 Oct, 9:00 AM" -- with the year added only
 * when it is not this one. The two day words are passed in (this module owns no
 * strings). A day is a calendar day in the phone's own zone, so a notification
 * from 11:50 pm last night is "Yesterday" at 12:10 am, not "Today". `now` is a
 * parameter so a test can pin the day.
 */
export function formatNotificationWhen(
  date: Date,
  appLanguage: BibleLanguage,
  labels: { today: string; yesterday: string },
  now: Date = new Date()
): string {
  const time = formatTimeOfDay(date, appLanguage);
  const startOfDay = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);
  if (days === 0) return `${labels.today}, ${time}`;
  if (days === 1) return `${labels.yesterday}, ${time}`;
  return `${formatDayMonthShort(date, appLanguage, now)}, ${time}`;
}

/** Just the clock -- "9:14 am". For a chat, where the day is context. */
export function formatTimeOfDay(date: Date, appLanguage: BibleLanguage): string {
  const options: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' };
  return safely(
    () => date.toLocaleTimeString(localeFor(appLanguage), options),
    () => date.toLocaleTimeString(undefined, options)
  );
}

/**
 * The timestamp on a chat message -- M7.
 *
 * A time alone for TODAY's messages, because the day is obvious from the
 * conversation; the date as well for anything older, because "9:14 am"
 * on a message from last week is worse than no timestamp at all. `now`
 * is a parameter rather than a call to the clock, so this stays pure and
 * a test can pin the boundary.
 */
export function formatMessageTimestamp(
  date: Date,
  appLanguage: BibleLanguage,
  now: Date = new Date()
): string {
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  const time = formatTimeOfDay(date, appLanguage);
  return sameDay ? time : `${formatShortDate(date, appLanguage)} · ${time}`;
}

/** A date and time together -- for events and notification timestamps. */
export function formatDateTime(date: Date, appLanguage: BibleLanguage): string {
  return safely(
    () => date.toLocaleString(localeFor(appLanguage)),
    () => date.toLocaleString()
  );
}

/**
 * Parses the `YYYY-MM-DD` strings the daily-verse collection stores and
 * formats them. Returns the input unchanged if it is not that shape, so a
 * malformed record shows its raw value rather than "Invalid Date".
 */
export function formatIsoDateString(
  dateString: string,
  appLanguage: BibleLanguage
): string {
  const [year, month, day] = dateString.split('-').map(Number);
  if (!year || !month || !day) return dateString;
  return formatLongDate(new Date(year, month - 1, day), appLanguage);
}

/**
 * "Sunday, 11 October" for a `YYYY-MM-DD` key -- Home's date line over the
 * Verse of the Day, which is keyed by the canonical Indian date.
 *
 * The key names a CALENDAR day, so it is read as that day in the phone's own
 * zone (at noon, which no daylight-saving step can move to another day)
 * rather than as an instant: parsing "2026-10-11" as UTC midnight would
 * print Saturday on a phone west of Greenwich. A malformed key comes back
 * unchanged, like formatIsoDateString.
 */
export function formatIsoWeekdayDate(
  dateString: string,
  appLanguage: BibleLanguage
): string {
  const [year, month, day] = dateString.split('-').map(Number);
  if (!year || !month || !day) return dateString;
  return formatWeekdayDate(new Date(year, month - 1, day, 12), appLanguage);
}

/**
 * Whether this JS engine can actually localize a month name into the
 * given language. Diagnostic only -- see this module's header.
 */
export function formatsDatesInTelugu(): boolean {
  try {
    const sample = new Date(2026, 8, 18).toLocaleDateString('te-IN', { month: 'long' });
    // Any Telugu output contains characters in the Telugu block.
    return /[ఀ-౿]/.test(sample);
  } catch {
    return false;
  }
}
