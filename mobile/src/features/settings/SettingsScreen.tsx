import { Button, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { usePreferences } from '../../context/PreferencesContext';

/**
 * Settings screen -- Day 9 requirement (decision 8: "English/Telugu
 * toggle, Light/Dark toggle, Notifications on/off toggle, Logout.
 * Preferences persist across app restart. Authenticated changes sync to
 * Firestore. Offline/local fallback continues to work.").
 *
 * Every toggle here is a thin view over usePreferences() (see
 * ../../context/PreferencesContext.tsx) -- this screen holds no
 * preference state of its own, so persistence/sync/offline-fallback are
 * all already handled by that shared context, not re-implemented here.
 * Logout reuses useAuth().signOut(), the same sign-out call
 * ../auth/HomeScreen.tsx's "Sign out" button already uses.
 */
export function SettingsScreen() {
  const { signOut } = useAuth();
  const {
    languagePreference,
    themePreference,
    isDark,
    notificationsEnabled,
    setLanguagePreference,
    setThemePreference,
    setNotificationsEnabled,
  } = usePreferences();
  const colors = isDark ? darkColors : lightColors;

  async function handleToggleLanguage() {
    await setLanguagePreference(languagePreference === 'en' ? 'te' : 'en');
  }

  return (
    <ScrollView
      contentContainerStyle={[styles.container, { backgroundColor: colors.background }]}
      testID="settings-screen"
    >
      <View style={styles.row}>
        <Text style={[styles.label, { color: colors.text }]}>
          {`Language: ${languagePreference === 'te' ? 'Telugu' : 'English'}`}
        </Text>
        <Button
          title="Switch Language"
          onPress={() => void handleToggleLanguage()}
          testID="settings-language-toggle"
        />
      </View>

      <View style={styles.row}>
        <Text style={[styles.label, { color: colors.text }]}>
          {`Theme: ${themePreference === 'dark' ? 'Dark' : 'Light'}`}
        </Text>
        <Switch
          testID="settings-theme-switch"
          value={themePreference === 'dark'}
          onValueChange={(value) => void setThemePreference(value ? 'dark' : 'light')}
        />
      </View>

      <View style={styles.row}>
        <Text style={[styles.label, { color: colors.text }]}>Notifications</Text>
        <Switch
          testID="settings-notifications-switch"
          value={notificationsEnabled}
          onValueChange={(value) => void setNotificationsEnabled(value)}
        />
      </View>

      <Button
        title="Log Out"
        onPress={() => void signOut()}
        testID="settings-logout-button"
      />
    </ScrollView>
  );
}

const lightColors = {
  background: '#F9FAFB',
  text: '#111827',
};

const darkColors = {
  background: '#1F2937',
  text: '#F9FAFB',
};

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 16, gap: 20 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: { fontSize: 16 },
});
