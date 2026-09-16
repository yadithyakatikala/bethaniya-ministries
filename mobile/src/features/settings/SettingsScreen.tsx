import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../../context/AuthContext';
import { usePreferences } from '../../context/PreferencesContext';
import { useTheme } from '../../theme';
import { useTranslation } from '../../i18n';
import { Tappable } from '../../theme/ui/Tappable';
import { subscribeToChurchSettings } from '../../services/firebase/settings';
import type { RootStackParamList } from '../../navigation/AppNavigator';

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
 *
 * The "Bible translations" card is required, non-decorative attribution:
 * the Telugu text is licensed CC BY-SA 4.0, which conditions
 * redistribution on attribution to the copyright holder -- see
 * /BIBLE_LICENSING.md and teluguBible.ts's doc comment for the full
 * source/license writeup this card summarizes.
 */
export function SettingsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
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
  const { t } = useTranslation();

  /**
   * React Native's Switch ships with the platform's own accent (iOS green,
   * Android's Material teal) regardless of the app's palette -- the two
   * switches on this screen were the only controls in the app not painted
   * from the theme. `thumbColor` and the Android track are set explicitly;
   * `ios_backgroundColor` covers the off track on iOS.
   */
  const switchColors = {
    trackColor: { false: colors.border, true: colors.primary },
    thumbColor: colors.surface,
    ios_backgroundColor: colors.border,
  };
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
            {`${t('settings.language')}: ${
              languagePreference === 'te'
                ? t('settings.languageTelugu')
                : t('settings.languageEnglish')
            }`}
          </Text>
          <Tappable
            testID="settings-language-toggle"
            accessibilityRole="button"
            // "Switch" alone does not say what it switches.
            accessibilityLabel={`${t('settings.switchTo')} ${
              languagePreference === 'te'
                ? t('settings.languageEnglish')
                : t('settings.languageTelugu')
            }`}
            // A bare 13px label is an ~18dp tap target; 44 is the minimum.
            hitSlop={{ top: 14, bottom: 14, left: 14, right: 8 }}
            onPress={() => void handleToggleLanguage()}
          >
            <Text style={[styles.action, { color: colors.primary }]}>
              {t('settings.switchTo')}
            </Text>
          </Tappable>
        </View>

        <View
          style={[
            styles.row,
            styles.divider,
            { borderTopColor: colors.border, padding: spacing.md },
          ]}
        >
          <Text style={[styles.label, { color: colors.text }]}>
            {`${t('settings.theme')}: ${
              themePreference === 'dark'
                ? t('settings.themeDark')
                : t('settings.themeLight')
            }`}
          </Text>
          <Switch
            testID="settings-theme-switch"
            // A Switch is its own focus stop for TalkBack, so without a
            // label it announces only "switch, on" -- the "Theme:" text
            // beside it is a separate element and is not read with it.
            accessibilityLabel={t('settings.themeDark')}
            value={themePreference === 'dark'}
            onValueChange={(value) => void setThemePreference(value ? 'dark' : 'light')}
            {...switchColors}
          />
        </View>

        <View
          style={[
            styles.row,
            styles.divider,
            { borderTopColor: colors.border, padding: spacing.md },
          ]}
        >
          <Text style={[styles.label, { color: colors.text }]}>
            {t('settings.notifications')}
          </Text>
          <Switch
            testID="settings-notifications-switch"
            accessibilityLabel={t('settings.notifications')}
            value={notificationsEnabled}
            onValueChange={(value) => void setNotificationsEnabled(value)}
            {...switchColors}
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
            <Text style={[styles.label, { color: colors.text }]}>
              {t('settings.contactChurch')}
            </Text>
            <Text style={[styles.supportEmail, { color: colors.secondaryText }]}>
              {supportEmail === null ? '' : supportEmail || t('settings.notSetYet')}
            </Text>
          </View>
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
        testID="settings-bible-attribution"
      >
        <View style={[styles.row, { padding: spacing.md }]}>
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={[styles.label, { color: colors.text }]}>
              {t('settings.bibleTranslations')}
            </Text>
            <Text style={[styles.attributionText, { color: colors.secondaryText }]}>
              English: World English Bible (public domain).
            </Text>
            <Text style={[styles.attributionText, { color: colors.secondaryText }]}>
              Telugu: Indian Revised Version (IRV) 2019, © Bridge Connectivity Solutions,
              licensed under CC BY-SA 4.0 (creativecommons.org/licenses/by-sa/4.0/).
            </Text>
          </View>
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
        <Tappable
          testID="settings-privacy-policy-row"
          accessibilityRole="button"
          onPress={() => navigation.navigate('PrivacyPolicy')}
          style={[styles.row, { padding: spacing.md }]}
        >
          <Text style={[styles.label, { color: colors.text }]}>
            {t('settings.privacyPolicy')}
          </Text>
          <Text style={[styles.action, { color: colors.primary }]}>
            {t('settings.view')}
          </Text>
        </Tappable>

        <Tappable
          testID="settings-terms-row"
          accessibilityRole="button"
          onPress={() => navigation.navigate('Terms')}
          style={[
            styles.row,
            styles.divider,
            { borderTopColor: colors.border, padding: spacing.md },
          ]}
        >
          <Text style={[styles.label, { color: colors.text }]}>
            {t('settings.terms')}
          </Text>
          <Text style={[styles.action, { color: colors.primary }]}>
            {t('settings.view')}
          </Text>
        </Tappable>
      </View>

      <Tappable
        testID="settings-logout-button"
        accessibilityRole="button"
        onPress={() => void signOut()}
        style={[
          styles.logoutButton,
          { borderColor: colors.liveTint, borderRadius: radii.control },
        ]}
      >
        <Text style={[styles.logoutLabel, { color: colors.danger }]}>
          {t('settings.logOut')}
        </Text>
      </Tappable>
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
  attributionText: { fontSize: 12.5, lineHeight: 18 },
  logoutButton: {
    minHeight: 48,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutLabel: { fontSize: 15, fontWeight: '600' },
});
