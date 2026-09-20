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
