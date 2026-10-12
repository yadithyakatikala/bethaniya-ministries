import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Has this device already played the onboarding chapter?
 *
 * The full chapter is five seconds and is worth seeing once. Somebody who
 * comes back to finish a half-answered profile gets the two-second version
 * instead. It is a single flag -- not an answer, not personal data -- so
 * device storage is the right place for it; anything the member TYPED is
 * held in memory and never written here.
 *
 * A read that fails resolves to "not seen": showing the chapter twice is a
 * smaller wrong than hiding it from somebody who has never seen it.
 */
const KEY = 'onboarding_chapter_seen';

export async function hasSeenChapter(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(KEY)) === '1';
  } catch {
    return false;
  }
}

export async function markChapterSeen(): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, '1');
  } catch {
    // Not worth interrupting anyone for: they will simply see it again.
  }
}
