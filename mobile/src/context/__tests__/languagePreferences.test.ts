import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  DEFAULT_APP_LANGUAGE,
  DEFAULT_BIBLE_MODE,
  migrateAndLoadLanguagePreferences,
  primaryBibleLanguage,
  setStoredAppLanguage,
  setStoredBibleMode,
} from '../languagePreferences';

/**
 * The V1 -> V2 language migration.
 *
 * WHAT COULD GO WRONG, and is therefore tested here rather than left to
 * the provider's integration tests:
 *
 *   1. A Telugu-Bible member gets a Telugu INTERFACE they never chose,
 *      because the migration reused one value for both preferences. That
 *      is the exact V1 conflation this milestone exists to undo.
 *   2. The migration runs again on the next launch and stamps over a
 *      choice the member has since made in V2. There is no migration
 *      flag -- the presence of the new keys IS the flag -- so "idempotent"
 *      has to be asserted by running it repeatedly with a V2 choice in
 *      place, not by checking a boolean.
 *   3. A V1 build installed over V2 finds nothing it understands under
 *      its own key, because V2 stopped writing it.
 *
 * The AsyncStorage keys are spelled out literally on purpose: they are a
 * persistence contract with installs already in the field, so a rename
 * must fail a test rather than silently reset everybody's preferences.
 */
const V1_KEY = 'bible_language_preference';
const APP_KEY = 'app_language_preference';
const MODE_KEY = 'bible_mode_preference';

describe('language preference defaults', () => {
  afterEach(async () => {
    await AsyncStorage.clear();
  });

  it('states the product defaults as English interface, Telugu Bible', () => {
    // Guards the requirement directly: the Bible defaulting to Telugu must
    // not drag the whole interface into Telugu with it.
    expect(DEFAULT_APP_LANGUAGE).toBe('en');
    expect(DEFAULT_BIBLE_MODE).toBe('te');
    expect(DEFAULT_APP_LANGUAGE).not.toBe(DEFAULT_BIBLE_MODE);
  });

  it('gives a fresh install appLanguage=en and bibleMode=te', async () => {
    const prefs = await migrateAndLoadLanguagePreferences();
    expect(prefs.appLanguage).toBe('en');
    expect(prefs.bibleMode).toBe('te');
  });

  it('writes both defaults through, so the next launch reads them back', async () => {
    await migrateAndLoadLanguagePreferences();
    expect(await AsyncStorage.getItem(APP_KEY)).toBe('en');
    expect(await AsyncStorage.getItem(MODE_KEY)).toBe('te');
  });

  it('ignores a stored value that is not a language', async () => {
    await AsyncStorage.setItem(APP_KEY, 'fr');
    await AsyncStorage.setItem(MODE_KEY, 'klingon');
    const prefs = await migrateAndLoadLanguagePreferences();
    expect(prefs.appLanguage).toBe('en');
    expect(prefs.bibleMode).toBe('te');
  });
});

describe('persistence', () => {
  afterEach(async () => {
    await AsyncStorage.clear();
  });

  it('reads back both preferences independently after they are set', async () => {
    await setStoredAppLanguage('te');
    await setStoredBibleMode('en');

    const prefs = await migrateAndLoadLanguagePreferences();
    expect(prefs.appLanguage).toBe('te');
    expect(prefs.bibleMode).toBe('en');
    // Nothing was migrated: both keys were already present.
    expect(prefs.migrated).toBe(false);
  });

  it('survives any number of reloads without drifting', async () => {
    await setStoredAppLanguage('te');
    await setStoredBibleMode('bilingual');

    for (let launch = 0; launch < 3; launch += 1) {
      const prefs = await migrateAndLoadLanguagePreferences();
      expect(prefs.appLanguage).toBe('te');
      expect(prefs.bibleMode).toBe('bilingual');
    }
  });

  it('keeps V1 key current for a single language so an older build still reads it', async () => {
    await setStoredBibleMode('en');
    expect(await AsyncStorage.getItem(V1_KEY)).toBe('en');
  });

  it('leaves the V1 key alone for bilingual rather than writing a value V1 would misread', async () => {
    await setStoredBibleMode('te');
    expect(await AsyncStorage.getItem(V1_KEY)).toBe('te');

    await setStoredBibleMode('bilingual');
    expect(await AsyncStorage.getItem(MODE_KEY)).toBe('bilingual');
    // Still the last single language -- not overwritten, not deleted.
    expect(await AsyncStorage.getItem(V1_KEY)).toBe('te');
  });

  it('never deletes the V1 key', async () => {
    await AsyncStorage.setItem(V1_KEY, 'te');
    await migrateAndLoadLanguagePreferences();
    expect(await AsyncStorage.getItem(V1_KEY)).toBe('te');
  });
});

describe('migrating a V1 install', () => {
  afterEach(async () => {
    await AsyncStorage.clear();
  });

  it('seeds the Bible mode from the V1 value and the interface from the V2 default', async () => {
    // A V1 member reading the Telugu Bible. Their Bible choice is real and
    // must be kept; it says nothing about what language they want the
    // buttons in.
    await AsyncStorage.setItem(V1_KEY, 'te');

    const prefs = await migrateAndLoadLanguagePreferences();
    expect(prefs.migrated).toBe(true);
    expect(prefs.bibleMode).toBe('te');
    expect(prefs.appLanguage).toBe('en');
  });

  it('keeps a V1 member who chose the English Bible on the English Bible', async () => {
    // The other direction matters just as much: V2's Bible default is
    // Telugu, so a migration that ignored the stored value would silently
    // switch this member's scripture.
    await AsyncStorage.setItem(V1_KEY, 'en');

    const prefs = await migrateAndLoadLanguagePreferences();
    expect(prefs.bibleMode).toBe('en');
    expect(prefs.appLanguage).toBe('en');
  });

  it('is idempotent: a later V2 choice is never re-migrated away', async () => {
    await AsyncStorage.setItem(V1_KEY, 'te');
    const first = await migrateAndLoadLanguagePreferences();
    expect(first.migrated).toBe(true);

    // The member then deliberately switches the interface to Telugu and
    // the Bible to bilingual. V1's key still says 'te'.
    await setStoredAppLanguage('te');
    await setStoredBibleMode('bilingual');

    for (let launch = 0; launch < 5; launch += 1) {
      const prefs = await migrateAndLoadLanguagePreferences();
      expect(prefs.migrated).toBe(false);
      expect(prefs.appLanguage).toBe('te');
      expect(prefs.bibleMode).toBe('bilingual');
    }
  });

  it('does not rewrite storage once the migration has happened', async () => {
    await AsyncStorage.setItem(V1_KEY, 'te');
    await migrateAndLoadLanguagePreferences();

    // The community AsyncStorage mock is already a jest.fn carrying this
    // file's earlier calls, so clear it rather than spying on it afresh.
    const setItem = AsyncStorage.setItem as jest.Mock;
    setItem.mockClear();

    await migrateAndLoadLanguagePreferences();

    expect(setItem).not.toHaveBeenCalled();
  });

  it('completes a half-written migration without disturbing the half that exists', async () => {
    // Interrupted between the two writes (process killed, storage error).
    await AsyncStorage.setItem(V1_KEY, 'en');
    await AsyncStorage.setItem(APP_KEY, 'te');

    const prefs = await migrateAndLoadLanguagePreferences();
    expect(prefs.appLanguage).toBe('te');
    expect(prefs.bibleMode).toBe('en');
    expect(await AsyncStorage.getItem(MODE_KEY)).toBe('en');
  });

  it('treats a bilingual V2 choice as authoritative over V1 disagreeing', async () => {
    await AsyncStorage.setItem(V1_KEY, 'en');
    await AsyncStorage.setItem(APP_KEY, 'en');
    await AsyncStorage.setItem(MODE_KEY, 'bilingual');

    const prefs = await migrateAndLoadLanguagePreferences();
    expect(prefs.bibleMode).toBe('bilingual');
    expect(prefs.migrated).toBe(false);
  });
});

describe('primaryBibleLanguage', () => {
  it('resolves bilingual to Telugu, the product primary', () => {
    // Search and the single-column fallback can only read one dataset.
    expect(primaryBibleLanguage('bilingual')).toBe('te');
  });

  it('is the identity for a single language', () => {
    expect(primaryBibleLanguage('te')).toBe('te');
    expect(primaryBibleLanguage('en')).toBe('en');
  });
});
