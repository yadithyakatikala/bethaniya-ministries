/**
 * Who each bundled translation belongs to.
 *
 * =====================================================================
 * WHERE THIS BELONGS, AND WHERE IT DOES NOT
 * =====================================================================
 * The Telugu text is the Indian Revised Version, licensed CC BY-SA 4.0,
 * and that licence conditions REDISTRIBUTION on attribution. The app
 * redistributes it by bundling it, so the credit has to be in the app --
 * visibly, permanently, and somewhere a person can find it. That place
 * is the Settings screen's "Bible translations" card, which reads these
 * constants so the legal text exists exactly once.
 *
 * IT IS NOT IN A SHARED MESSAGE. M6 removed it from there, because the
 * block made every shared verse read like a licence notice:
 *
 *     "యెహోవా నా కాపరి. నాకు ఏ లోటూ లేదు."
 *
 *     కీర్తనల గ్రంథము 23:1 (Indian Revised Version (IRV) 2019)
 *     © Bridge Connectivity Solutions, CC BY-SA 4.0
 *
 * A member sending a verse to their family is quoting scripture in a
 * chat, the same way they would from a printed Bible -- not publishing a
 * derivative work. Attribution stays in the app, where the obligation
 * actually sits; the message carries the verse and its reference.
 *
 * See /BIBLE_LICENSING.md for the full licensing writeup, and
 * ./reader/verseSharing.ts for what a share does contain.
 */
import type { BibleLanguage } from './types';

/**
 * The published titles of the two translations. NOT localized and NOT in
 * the i18n catalogue: a translation's title is a proper noun, not
 * interface copy. See ../../i18n/strings.ts's header ("WHAT IS NOT
 * HERE").
 */
export const TRANSLATION_NAMES: Record<BibleLanguage, string> = {
  en: 'World English Bible',
  te: 'Indian Revised Version (IRV) 2019',
};

/**
 * The copyright line each translation requires. `null` for the WEB,
 * which is public domain and requires none.
 */
export const TRANSLATION_ATTRIBUTION: Record<BibleLanguage, string | null> = {
  en: null,
  te: '© Bridge Connectivity Solutions, CC BY-SA 4.0',
};

/** Where the CC BY-SA 4.0 licence itself can be read. */
export const CC_BY_SA_URL = 'https://creativecommons.org/licenses/by-sa/4.0/';

/**
 * One translation's credit as a single sentence, for the Settings card.
 *
 * Built here rather than typed into the screen, so the licence text and
 * the translation's name cannot drift apart from the values the rest of
 * the app uses.
 */
export function translationCreditLine(language: BibleLanguage): string {
  const attribution = TRANSLATION_ATTRIBUTION[language];
  const name = TRANSLATION_NAMES[language];
  return attribution ? `${name}, ${attribution}` : `${name} (public domain)`;
}
