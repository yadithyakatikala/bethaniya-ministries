import { usePreferences } from '../context/PreferencesContext';
import { translate, type StringKey } from './strings';

/**
 * The app's only way to read a user-facing string.
 *
 * Reads `usePreferences().appLanguage` -- the INTERFACE language, which
 * is a different setting from the Bible translation. Because that value
 * lives in React context, calling `setAppLanguage('te')` in Settings
 * re-renders every screen holding this hook immediately; there is no
 * reload and no restart. Persistence (AsyncStorage + Firestore) is
 * likewise already handled by PreferencesContext, so it survives an app
 * restart.
 *
 *   const { t, appLanguage } = useTranslation();
 *   <Text>{t('home.verseOfTheDay')}</Text>
 *   <Text>{t('home.dayOf', { current: 3, total: 7 })}</Text>
 *
 * `appLanguage` is exposed for the callers that need the raw value
 * rather than a string -- date formatting, mainly (see ./locale.ts).
 *
 * IT IS DELIBERATELY NOT NAMED `language`. V1 had a single preference and
 * the Bible screens read it from here to pick which TRANSLATION to load.
 * Those are now two different settings, so a Bible screen reading the
 * interface language would silently show the wrong scripture -- exactly
 * the class of bug M2 exists to remove. Bible data lookups take
 * `usePreferences().bibleMode`; book names and other labels go through
 * bookNameLanguageFor() in ../features/bible/types.ts.
 */
export function useTranslation() {
  const { appLanguage } = usePreferences();
  return {
    appLanguage,
    t: (key: StringKey, vars?: Record<string, string | number>) =>
      translate(appLanguage, key, vars),
  };
}
