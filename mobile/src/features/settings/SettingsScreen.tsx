import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { usePreferences } from '../../context/PreferencesContext';
import { useTheme } from '../../theme';
import { subscribeToChurchSettings } from '../../services/firebase/settings';

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
 *
 * Restyled onto the shared Vespers theme as grouped rows in a card, plus
 * a real "Contact the church" row reading the church's actual
 * `settings.supportEmail` (subscribeToChurchSettings -- the same
 * subscription HomeScreen.tsx's ChurchBranding already uses), matching
 * the UI audit's flagged "free win" (previously stored but never shown
 * anywhere). Shows a clearly-labelled "Not set yet" placeholder rather
 * than inventing an address when the church hasn't configured one. Every
 * existing testID and the exact "Language: .../Theme: ..." label text
 * are unchanged -- see SettingsScreen.test.tsx.
 */
export function SettingsScreen() {
  const { signOut } = useAuth();
  const {
    languagePreference,
    themePreference,
    notificationsEnabled,
    setLanguagePreference,
    setThemePreference,
    setNotificationsEnabled,
  } = usePreferences();
  const { colors, radii, spacing } = useTheme();
  const [supportEmail, setSupportEmail] = useState<string | null>(null);

  useEffect(
    () =>
      subscribeToChurchSettings(
        (settings) => setSupportEmail(settings?.supportEmail || ''),
        () => setSupportEmail('')
      ),
    []
  );

  async function handleToggleLanguage() {
    await setLanguagePreference(languagePreference === 'en' ? 'te' : 'en');
  }

  return (
    <ScrollView
      contentContainerStyle={[styles.container, { backgroundColor: colors.background }]}
      testID="settings-screen"
    >
      <View
        style={[
          styles.card,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderRadius: radii.card,
          },
        ]}
      >
        <View style={[styles.row, { padding: spacing.md }]}>
          <Text style={[styles.label, { color: colors.text }]}>
            {`Language: ${languagePreference === 'te' ? 'Telugu' : 'English'}`}
          </Text>
          <Pressable
            testID="settings-language-toggle"
            accessibilityRole="button"
            onPress={() => void handleToggleLanguage()}
          >
            <Text style={[styles.action, { color: colors.primary }]}>Switch</Text>
          </Pressable>
        </View>

        <View
          style={[
            styles.row,
            styles.divider,
            { borderTopColor: colors.border, padding: spacing.md },
          ]}
        >
          <Text style={[styles.label, { color: colors.text }]}>
            {`Theme: ${themePreference === 'dark' ? 'Dark' : 'Light'}`}
          </Text>
          <Switch
            testID="settings-theme-switch"
            value={themePreference === 'dark'}
            onValueChange={(value) => void setThemePreference(value ? 'dark' : 'light')}
          />
        </View>

        <View
          style={[
            styles.row,
            styles.divider,
            { borderTopColor: colors.border, padding: spacing.md },
          ]}
        >
          <Text style={[styles.label, { color: colors.text }]}>Notifications</Text>
          <Switch
            testID="settings-notifications-switch"
            value={notificationsEnabled}
            onValueChange={(value) => void setNotificationsEnabled(value)}
          />
        </View>
      </View>

      <View
        style={[
          styles.card,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderRadius: radii.card,
          },
        ]}
      >
        <View style={[styles.row, { padding: spacing.md }]} testID="settings-support-row">
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[styles.label, { color: colors.text }]}>Contact the church</Text>
            <Text style={[styles.supportEmail, { color: colors.secondaryText }]}>
              {supportEmail === null ? '' : supportEmail || 'Not set yet'}
            </Text>
          </View>
        </View>
      </View>

      <Pressable
        testID="settings-logout-button"
        accessibilityRole="button"
        onPress={() => void signOut()}
        style={[
          styles.logoutButton,
          { borderColor: colors.liveTint, borderRadius: radii.control },
        ]}
      >
        <Text style={[styles.logoutLabel, { color: colors.danger }]}>Log Out</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 20, gap: 16 },
  card: { borderWidth: StyleSheet.hairlineWidth },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  divider: { borderTopWidth: StyleSheet.hairlineWidth },
  label: { fontSize: 15, fontWeight: '500' },
  action: { fontSize: 14, fontWeight: '600' },
  supportEmail: { fontSize: 13 },
  logoutButton: {
    minHeight: 48,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutLabel: { fontSize: 15, fontWeight: '600' },
});
