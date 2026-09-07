import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLanguagePreference, setLanguagePreference } from '../languagePreference';

describe('languagePreference', () => {
  afterEach(async () => {
    await AsyncStorage.clear();
  });

  it('defaults to English when nothing is stored', async () => {
    expect(await getLanguagePreference()).toBe('en');
  });

  it('persists and restores a Telugu selection', async () => {
    await setLanguagePreference('te');
    expect(await getLanguagePreference()).toBe('te');
  });

  it('persists and restores an English selection', async () => {
    await setLanguagePreference('te');
    await setLanguagePreference('en');
    expect(await getLanguagePreference()).toBe('en');
  });

  it('falls back to English for a corrupted/unexpected stored value', async () => {
    await AsyncStorage.setItem('bible_language_preference', 'fr');
    expect(await getLanguagePreference()).toBe('en');
  });
});
