import { usePreferences } from '../context/PreferencesContext';
import { translate, type StringKey } from './strings';

/**
 * The app's only way to read a user-facing string.
 *
 * Reads the SAME `usePreferences().languagePreference` the Bible module
 * already used -- see strings.ts's header for why there is deliberately
 * no second language state. Because that value lives in React context,
 * calling `setLanguagePreference('te')` in Settings re-renders every
 * screen holding this hook immediately; there is no reload and no
 * restart. Persistence (AsyncStorage + Firestore) is likewise already
 * handled by PreferencesContext, so it survives an app restart.
 *
 *   const { t, language } = useTranslation();
 *   <Text>{t('home.verseOfTheDay')}</Text>
 *   <Text>{t('home.dayOf', { current: 3, total: 7 })}</Text>
 *
 * `language` is exposed for the callers that need the raw value rather
 * than a string -- chiefly the Bible screens, which pass it to
 * getBookName() and to the verse-data lookup.
 */
export function useTranslation() {
  const { languagePreference } = usePreferences();
  return {
    language: languagePreference,
    t: (key: StringKey, vars?: Record<string, string | number>) =>
      translate(languagePreference, key, vars),
  };
}
