import React from 'react';
import { Button, Text, View } from 'react-native';
import { act, cleanup, render, waitFor, fireEvent } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { onAuthStateChanged } from 'firebase/auth';
import { onSnapshot, updateDoc } from 'firebase/firestore';
import useColorScheme from 'react-native/Libraries/Utilities/useColorScheme';
import * as Notifications from 'expo-notifications';
import { AuthProvider } from '../AuthContext';
import { PreferencesProvider, usePreferences } from '../PreferencesContext';

jest.mock('../../services/firebase/app');
jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: jest.fn(() => 'light'),
}));

function Probe() {
  const prefs = usePreferences();
  return (
    <View>
      <Text testID="appLanguage">{prefs.appLanguage}</Text>
      <Text testID="bibleMode">{prefs.bibleMode}</Text>
      <Text testID="theme">{prefs.themePreference}</Text>
      <Text testID="isDark">{String(prefs.isDark)}</Text>
      <Text testID="notifications">{String(prefs.notificationsEnabled)}</Text>
      <Text testID="isLoaded">{String(prefs.isLoaded)}</Text>
      <Text testID="syncFailed">{String(prefs.syncFailed)}</Text>
      <Button
        title="app-te"
        testID="set-app-language-te"
        onPress={() => void prefs.setAppLanguage('te')}
      />
      <Button
        title="bible-en"
        testID="set-bible-mode-en"
        onPress={() => void prefs.setBibleMode('en')}
      />
      <Button
        title="bible-bilingual"
        testID="set-bible-mode-bilingual"
        onPress={() => void prefs.setBibleMode('bilingual')}
      />
      <Button
        title="set-dark"
        testID="set-theme-dark"
        onPress={() => void prefs.setThemePreference('dark')}
      />
      <Button
        title="toggle-notifications"
        testID="disable-notifications"
        onPress={() => void prefs.setNotificationsEnabled(false)}
      />
      <Button
        title="enable-notifications"
        testID="enable-notifications"
        onPress={() => void prefs.setNotificationsEnabled(true)}
      />
    </View>
  );
}

async function renderProbe() {
  return render(
    <AuthProvider>
      <PreferencesProvider>
        <Probe />
      </PreferencesProvider>
    </AuthProvider>
  );
}

function mockSignedIn(uid: string) {
  (onAuthStateChanged as jest.Mock).mockImplementation((_auth, onNext) => {
    onNext({ uid, displayName: null, email: null, phoneNumber: null });
    return jest.fn();
  });
  (onSnapshot as jest.Mock).mockImplementation((_ref, next) => {
    next({ exists: () => false });
    return jest.fn();
  });
}

describe('PreferencesContext', () => {
  afterEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
    (onAuthStateChanged as jest.Mock).mockImplementation(() => jest.fn());
    (onSnapshot as jest.Mock).mockImplementation(() => jest.fn());
  });

  it('defaults to an English interface, a Telugu Bible, the system color scheme, and notifications on', async () => {
    const { getByTestId } = await renderProbe();
    await waitFor(() => expect(getByTestId('isLoaded').props.children).toBe('true'));
    expect(getByTestId('appLanguage').props.children).toBe('en');
    expect(getByTestId('bibleMode').props.children).toBe('te');
    // 'system' is the literal default from M4 on. Following the device was
    // already the no-stored-preference behaviour; naming it means a scheme
    // change while the app is open is picked up live rather than frozen at
    // whatever the scheme was on mount.
    expect(getByTestId('theme').props.children).toBe('system');
    expect(getByTestId('isDark').props.children).toBe('false');
    expect(getByTestId('notifications').props.children).toBe('true');
  });

  it('falls back to the system dark color scheme when no theme is stored', async () => {
    (useColorScheme as jest.Mock).mockReturnValue('dark');
    const { getByTestId } = await renderProbe();
    expect(getByTestId('isDark').props.children).toBe('true');
  });

  it('loads previously stored local preferences before any sign-in', async () => {
    await AsyncStorage.setItem('app_language_preference', 'te');
    await AsyncStorage.setItem('bible_mode_preference', 'bilingual');
    await AsyncStorage.setItem('theme_preference', 'dark');
    await AsyncStorage.setItem('notifications_enabled_preference', 'false');

    const { getByTestId } = await renderProbe();
    await waitFor(() => expect(getByTestId('appLanguage').props.children).toBe('te'));
    expect(getByTestId('bibleMode').props.children).toBe('bilingual');
    expect(getByTestId('theme').props.children).toBe('dark');
    expect(getByTestId('notifications').props.children).toBe('false');
  });

  it('persists a preference change to AsyncStorage and does not call Firestore while signed out', async () => {
    const { getByTestId } = await renderProbe();
    await waitFor(() => expect(getByTestId('isLoaded').props.children).toBe('true'));

    await fireEvent.press(getByTestId('set-theme-dark'));

    await waitFor(() => expect(getByTestId('theme').props.children).toBe('dark'));
    expect(await AsyncStorage.getItem('theme_preference')).toBe('dark');
    expect(updateDoc).not.toHaveBeenCalled();
  });

  it('disabling notifications persists locally and syncs when signed in', async () => {
    mockSignedIn('user-3');

    const { getByTestId } = await renderProbe();
    await waitFor(() => expect(getByTestId('isLoaded').props.children).toBe('true'));

    await fireEvent.press(getByTestId('disable-notifications'));

    await waitFor(() =>
      expect(getByTestId('notifications').props.children).toBe('false')
    );
    expect(await AsyncStorage.getItem('notifications_enabled_preference')).toBe('false');
    expect(updateDoc).toHaveBeenCalledWith(expect.anything(), {
      notificationsEnabled: false,
    });
  });

  it('requests OS notification permission when the user turns notifications on', async () => {
    // Regression test for the V1 production-readiness audit finding: this
    // toggle used to only flip a stored boolean and never actually call
    // requestNotificationPermissionsAsync() (services/notifications/
    // notificationService.ts), so the OS prompt the user needs to see to
    // ever receive anything never fired.
    await AsyncStorage.setItem('notifications_enabled_preference', 'false');
    const { getByTestId } = await renderProbe();
    await waitFor(() =>
      expect(getByTestId('notifications').props.children).toBe('false')
    );

    await fireEvent.press(getByTestId('enable-notifications'));

    await waitFor(() => expect(getByTestId('notifications').props.children).toBe('true'));
    await waitFor(() => expect(Notifications.getPermissionsAsync).toHaveBeenCalled());
  });

  it('does not request OS notification permission when turning notifications off', async () => {
    const { getByTestId } = await renderProbe();
    await waitFor(() => expect(getByTestId('isLoaded').props.children).toBe('true'));

    await fireEvent.press(getByTestId('disable-notifications'));

    await waitFor(() =>
      expect(getByTestId('notifications').props.children).toBe('false')
    );
    expect(Notifications.getPermissionsAsync).not.toHaveBeenCalled();
  });
});

/**
 * The whole point of the milestone: two preferences that do not move each
 * other. Each direction is asserted separately, because a regression is
 * far more likely to re-couple them one way (a shared setter, a shared
 * storage key) than both.
 */
describe('the two language preferences are independent', () => {
  afterEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
    (onAuthStateChanged as jest.Mock).mockImplementation(() => jest.fn());
    (onSnapshot as jest.Mock).mockImplementation(() => jest.fn());
  });

  it('changing the app language leaves the Bible mode where it was', async () => {
    const { getByTestId } = await renderProbe();
    await waitFor(() => expect(getByTestId('isLoaded').props.children).toBe('true'));

    await fireEvent.press(getByTestId('set-app-language-te'));

    await waitFor(() => expect(getByTestId('appLanguage').props.children).toBe('te'));
    expect(getByTestId('bibleMode').props.children).toBe('te');
    expect(await AsyncStorage.getItem('app_language_preference')).toBe('te');
    // The Bible's own stored value was not touched by an interface change.
    expect(await AsyncStorage.getItem('bible_mode_preference')).toBe('te');
  });

  it('changing the Bible mode leaves the app language where it was', async () => {
    const { getByTestId } = await renderProbe();
    await waitFor(() => expect(getByTestId('isLoaded').props.children).toBe('true'));

    await fireEvent.press(getByTestId('set-bible-mode-en'));

    await waitFor(() => expect(getByTestId('bibleMode').props.children).toBe('en'));
    expect(getByTestId('appLanguage').props.children).toBe('en');
    expect(await AsyncStorage.getItem('bible_mode_preference')).toBe('en');
    expect(await AsyncStorage.getItem('app_language_preference')).toBe('en');
  });

  it('supports the combination V1 could not express: English interface, Telugu Bible', async () => {
    await AsyncStorage.setItem('app_language_preference', 'en');
    await AsyncStorage.setItem('bible_mode_preference', 'te');

    const { getByTestId } = await renderProbe();
    await waitFor(() => expect(getByTestId('isLoaded').props.children).toBe('true'));
    expect(getByTestId('appLanguage').props.children).toBe('en');
    expect(getByTestId('bibleMode').props.children).toBe('te');
  });

  it('supports the opposite combination too: Telugu interface, English Bible', async () => {
    await AsyncStorage.setItem('app_language_preference', 'te');
    await AsyncStorage.setItem('bible_mode_preference', 'en');

    const { getByTestId } = await renderProbe();
    await waitFor(() => expect(getByTestId('isLoaded').props.children).toBe('true'));
    expect(getByTestId('appLanguage').props.children).toBe('te');
    expect(getByTestId('bibleMode').props.children).toBe('en');
  });

  it('keeps both choices across a remount, which is what "restart" means here', async () => {
    const first = await renderProbe();
    await waitFor(() =>
      expect(first.getByTestId('isLoaded').props.children).toBe('true')
    );

    await fireEvent.press(first.getByTestId('set-app-language-te'));
    await fireEvent.press(first.getByTestId('set-bible-mode-bilingual'));
    await waitFor(() =>
      expect(first.getByTestId('bibleMode').props.children).toBe('bilingual')
    );
    // cleanup() rather than first.unmount(): the library's own teardown
    // also runs after this test, and unmounting a tree twice leaves its
    // internals in a state that breaks later renders in this file.
    await cleanup();

    const second = await renderProbe();
    await waitFor(() =>
      expect(second.getByTestId('appLanguage').props.children).toBe('te')
    );
    expect(second.getByTestId('bibleMode').props.children).toBe('bilingual');
  });
});

describe('Firestore sync of the two language preferences', () => {
  afterEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
    (onAuthStateChanged as jest.Mock).mockImplementation(() => jest.fn());
    (onSnapshot as jest.Mock).mockImplementation(() => jest.fn());
  });

  it('writes only appLanguage when the interface language changes', async () => {
    mockSignedIn('user-1');
    const { getByTestId } = await renderProbe();
    await waitFor(() => expect(getByTestId('isLoaded').props.children).toBe('true'));

    await fireEvent.press(getByTestId('set-app-language-te'));

    await waitFor(() => expect(getByTestId('appLanguage').props.children).toBe('te'));
    expect(updateDoc).toHaveBeenCalledWith(expect.anything(), {
      appLanguage: 'te',
    });
  });

  it('mirrors a single-language Bible mode to V1 field so an older client still reads it', async () => {
    mockSignedIn('user-2');
    const { getByTestId } = await renderProbe();
    await waitFor(() => expect(getByTestId('isLoaded').props.children).toBe('true'));

    await fireEvent.press(getByTestId('set-bible-mode-en'));

    await waitFor(() => expect(getByTestId('bibleMode').props.children).toBe('en'));
    expect(updateDoc).toHaveBeenCalledWith(expect.anything(), {
      bibleMode: 'en',
      languagePreference: 'en',
    });
  });

  it('does not mirror bilingual to V1 field, which V1 would misread', async () => {
    mockSignedIn('user-2b');
    const { getByTestId } = await renderProbe();
    await waitFor(() => expect(getByTestId('isLoaded').props.children).toBe('true'));

    await fireEvent.press(getByTestId('set-bible-mode-bilingual'));

    await waitFor(() =>
      expect(getByTestId('bibleMode').props.children).toBe('bilingual')
    );
    expect(updateDoc).toHaveBeenCalledWith(expect.anything(), {
      bibleMode: 'bilingual',
    });
  });

  it('adopts both synced language fields once a snapshot arrives', async () => {
    (onAuthStateChanged as jest.Mock).mockImplementation((_auth, onNext) => {
      onNext({ uid: 'user-4', displayName: null, email: null, phoneNumber: null });
      return jest.fn();
    });
    (onSnapshot as jest.Mock).mockImplementation((_ref, next) => {
      next({
        exists: () => true,
        id: 'user-4',
        data: () => ({
          role: 'member',
          themePreference: 'dark',
          appLanguage: 'te',
          bibleMode: 'bilingual',
          notificationsEnabled: false,
        }),
      });
      return jest.fn();
    });

    const { getByTestId } = await renderProbe();
    await waitFor(() => expect(getByTestId('theme').props.children).toBe('dark'));
    expect(getByTestId('appLanguage').props.children).toBe('te');
    expect(getByTestId('bibleMode').props.children).toBe('bilingual');
    expect(getByTestId('notifications').props.children).toBe('false');
  });

  it('lets a V1 profile seed the Bible mode but never the interface language', async () => {
    // The server-side half of the migration. A member whose account was
    // last written by V1 has only `languagePreference`; treating that as
    // the app language would hand a Telugu-Bible reader a Telugu
    // interface they never asked for.
    (onAuthStateChanged as jest.Mock).mockImplementation((_auth, onNext) => {
      onNext({ uid: 'user-5', displayName: null, email: null, phoneNumber: null });
      return jest.fn();
    });
    (onSnapshot as jest.Mock).mockImplementation((_ref, next) => {
      next({
        exists: () => true,
        id: 'user-5',
        data: () => ({ role: 'member', languagePreference: 'te' }),
      });
      return jest.fn();
    });

    const { getByTestId } = await renderProbe();
    await waitFor(() => expect(getByTestId('bibleMode').props.children).toBe('te'));
    expect(getByTestId('appLanguage').props.children).toBe('en');
  });

  it('prefers the V2 Bible field over V1 when a profile carries both', async () => {
    (onAuthStateChanged as jest.Mock).mockImplementation((_auth, onNext) => {
      onNext({ uid: 'user-6', displayName: null, email: null, phoneNumber: null });
      return jest.fn();
    });
    (onSnapshot as jest.Mock).mockImplementation((_ref, next) => {
      next({
        exists: () => true,
        id: 'user-6',
        data: () => ({
          role: 'member',
          languagePreference: 'en',
          bibleMode: 'bilingual',
        }),
      });
      return jest.fn();
    });

    const { getByTestId } = await renderProbe();
    await waitFor(() =>
      expect(getByTestId('bibleMode').props.children).toBe('bilingual')
    );
  });

  /**
   * M6 BUG 1 + BUG 2 REGRESSION.
   *
   * The denial itself lived in firestore.rules (a member with no
   * displayName could not write any preference -- see
   * firebase-tests/src/firestore.rules.test.ts), but what the member SAW
   * was produced here: the Firestore SDK applies a write to its local
   * cache and emits a snapshot for it, then, when the server rejects it,
   * rolls the cache back and emits ANOTHER snapshot carrying the old
   * document. This provider's snapshot handler writes through to state and
   * to AsyncStorage, so that second snapshot silently undid the member's
   * choice on both tiers. The toggle moved and moved back, and the
   * rejection went nowhere because the callers press these setters as
   * `void setBibleMode(v)`.
   *
   * These cases drive that exact sequence -- rejected write, then a
   * rollback snapshot carrying the pre-write document -- so the behaviour
   * is pinned independently of whichever rule happens to reject a write
   * next.
   */
  describe('M6: a rejected profile write must not undo the choice', () => {
    /** Signs a member in and hands back a way to push snapshots by hand,
     *  so a test can emit the SDK's rollback snapshot itself. */
    function mockSignedInWithManualSnapshots(uid: string) {
      (onAuthStateChanged as jest.Mock).mockImplementation((_auth, onNext) => {
        onNext({ uid, displayName: null, email: null, phoneNumber: null });
        return jest.fn();
      });
      let emit: ((data: Record<string, unknown>) => void) | null = null;
      (onSnapshot as jest.Mock).mockImplementation((_ref, next) => {
        emit = (data) => next({ exists: () => true, id: uid, data: () => data });
        return jest.fn();
      });
      return {
        // Wrapped in act(): a snapshot is React state arriving from
        // outside the component tree, exactly as it is on a device.
        emit: async (data: Record<string, unknown>) => {
          if (!emit) throw new Error('no snapshot listener was registered');
          const deliver = emit;
          await act(async () => {
            deliver(data);
          });
        },
      };
    }

    it('keeps the new Bible mode when the rollback snapshot carries the old one (BUG 1)', async () => {
      const server = mockSignedInWithManualSnapshots('user-7');
      (updateDoc as jest.Mock).mockRejectedValue(
        Object.assign(new Error('Missing or insufficient permissions.'), {
          code: 'permission-denied',
        })
      );

      const { getByTestId } = await renderProbe();
      // The profile as the server holds it: a Telugu Bible.
      await server.emit({ role: 'member', bibleMode: 'te' });
      await waitFor(() => expect(getByTestId('bibleMode').props.children).toBe('te'));

      await fireEvent.press(getByTestId('set-bible-mode-en'));
      await waitFor(() => expect(getByTestId('syncFailed').props.children).toBe('true'));

      // The rollback: the SDK re-emits the document as the server still
      // has it. This is the snapshot that used to revert the choice.
      await server.emit({ role: 'member', bibleMode: 'te' });

      await waitFor(() => expect(getByTestId('bibleMode').props.children).toBe('en'));
      expect(await AsyncStorage.getItem('bible_mode_preference')).toBe('en');
    });

    it('keeps the new theme when the rollback snapshot carries the old one (BUG 2)', async () => {
      const server = mockSignedInWithManualSnapshots('user-8');
      (updateDoc as jest.Mock).mockRejectedValue(new Error('permission-denied'));

      const { getByTestId } = await renderProbe();
      await server.emit({ role: 'member', themePreference: 'light' });
      await waitFor(() => expect(getByTestId('theme').props.children).toBe('light'));

      await fireEvent.press(getByTestId('set-theme-dark'));
      await waitFor(() => expect(getByTestId('syncFailed').props.children).toBe('true'));

      await server.emit({ role: 'member', themePreference: 'light' });

      await waitFor(() => expect(getByTestId('theme').props.children).toBe('dark'));
      expect(getByTestId('isDark').props.children).toBe('true');
      expect(await AsyncStorage.getItem('theme_preference')).toBe('dark');
    });

    it('does not make the rejection an unhandled promise rejection', async () => {
      // The setters are pressed as `void set...(value)` throughout the app,
      // so a rejection they re-throw is reported by nothing and crashes
      // nothing -- it simply disappears. Awaiting the setter directly here
      // is the assertion: it must resolve.
      mockSignedIn('user-9');
      (updateDoc as jest.Mock).mockRejectedValue(new Error('offline'));

      let resolved = false;
      function AwaitProbe() {
        const { setThemePreference } = usePreferences();
        return (
          <Button
            title="await"
            testID="await-set-theme"
            onPress={() => {
              void setThemePreference('dark').then(() => {
                resolved = true;
              });
            }}
          />
        );
      }
      const { getByTestId } = await render(
        <AuthProvider>
          <PreferencesProvider>
            <AwaitProbe />
          </PreferencesProvider>
        </AuthProvider>
      );

      await fireEvent.press(getByTestId('await-set-theme'));
      await waitFor(() => expect(resolved).toBe(true));
    });

    it('goes back to trusting the server once a write succeeds', async () => {
      // The guard that ignores snapshots must not be permanent: a member
      // who changes a setting on another device should still see it here.
      const server = mockSignedInWithManualSnapshots('user-10');
      (updateDoc as jest.Mock).mockResolvedValue(undefined);

      const { getByTestId } = await renderProbe();
      await server.emit({ role: 'member', bibleMode: 'te' });
      await waitFor(() => expect(getByTestId('bibleMode').props.children).toBe('te'));

      await fireEvent.press(getByTestId('set-bible-mode-en'));
      await waitFor(() => expect(getByTestId('bibleMode').props.children).toBe('en'));
      expect(getByTestId('syncFailed').props.children).toBe('false');

      // Another device switches the account to bilingual.
      await server.emit({ role: 'member', bibleMode: 'bilingual' });
      await waitFor(() =>
        expect(getByTestId('bibleMode').props.children).toBe('bilingual')
      );
    });

    it('leaves the other preferences free to sync -- one failure is not a blanket freeze', async () => {
      const server = mockSignedInWithManualSnapshots('user-11');
      (updateDoc as jest.Mock).mockRejectedValue(new Error('permission-denied'));

      const { getByTestId } = await renderProbe();
      await server.emit({ role: 'member', bibleMode: 'te', appLanguage: 'en' });
      await waitFor(() => expect(getByTestId('bibleMode').props.children).toBe('te'));

      await fireEvent.press(getByTestId('set-bible-mode-en'));
      await waitFor(() => expect(getByTestId('syncFailed').props.children).toBe('true'));

      // The member never touched the interface language, so a remote change
      // to THAT field is still adopted -- the guard is per-field.
      await server.emit({ role: 'member', bibleMode: 'te', appLanguage: 'te' });
      await waitFor(() => expect(getByTestId('appLanguage').props.children).toBe('te'));
      expect(getByTestId('bibleMode').props.children).toBe('en');
    });
  });
});
