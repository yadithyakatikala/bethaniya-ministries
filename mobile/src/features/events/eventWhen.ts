import type { PublishedEvent } from '../../services/firebase/events';
import { formatEventWhen } from '../../i18n/locale';
import type { BibleLanguage } from '../bible/types';

/**
 * When an event starts, in words: "Today, 10:30 AM", "Wed 14 Oct, 6:30 PM", or
 * `unknown` ("Date and time to be announced") for one with no date yet. The
 * app's language decides the format, never the phone's.
 */
export function eventWhen(
  event: PublishedEvent,
  appLanguage: BibleLanguage,
  todayLabel: string,
  unknown: string
): string {
  return event.startsAt
    ? formatEventWhen(event.startsAt, appLanguage, todayLabel)
    : unknown;
}

/** The second line of an event's row: when, and where if it says. */
export function eventMeta(
  event: PublishedEvent,
  appLanguage: BibleLanguage,
  todayLabel: string,
  unknown: string
): string {
  const where = event.location.trim();
  const when = eventWhen(event, appLanguage, todayLabel, unknown);
  return where ? `${when} · ${where}` : when;
}
