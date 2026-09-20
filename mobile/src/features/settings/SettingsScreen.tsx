import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../../context/AuthContext';
import { usePreferences } from '../../context/PreferencesContext';
import { useTheme } from '../../theme';
import { useTranslation } from '../../i18n';
import { CC_BY_SA_URL, translationCreditLine } from '../bible/translationCredits';
import { Tappable } from '../../theme/ui/Tappable';
import { SegmentedChoice } from '../../theme/ui/SegmentedChoice';
import { Divider } from '../../theme/ui/Divider';
import { subscribeToChurchSettings } from '../../services/firebase/settings';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import type { ThemePreference } from '../../services/firebase/userProfile';
import type { BibleLanguage, BibleMode } from '../bible/types';

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
    appLanguage,
    bibleMode,
    themePreference,
    notificationsEnabled,
    syncFailed,
    setAppLanguage,
    setBibleMode,
    setThemePreference,
    setNotificationsEnabled,
  } = usePreferences();
  const { colors, radii, spacing, type } = useTheme();
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

  return (
    <ScrollView
      contentContainerStyle={[styles.container, { backgroundColor: colors.background }]}
      testID="settings-screen"
    >
      {/* M6: a preference that saved locally but could not reach the
          member's account says so. Before this, such a write was denied by
          firestore.rules and the rejection was swallowed (see
          ../../context/PreferencesContext.tsx's "WHEN A SYNC FAILS"), so
          BUG 1 and BUG 2 presented as the app forgetting the setting. Not
          colour-only, and announced politely rather than as an alert: the
          local value is in effect, so there is nothing for the member to
          do. */}
      {syncFailed ? (
        <View
          testID="settings-sync-failed"
          accessibilityLiveRegion="polite"
          style={[
            styles.notice,
            {
              backgroundColor: colors.surface,
              borderColor: colors.danger,
              borderRadius: radii.card,
              padding: spacing.md,
            },
          ]}
        >
          <Text style={[type.bodySmall, { color: colors.ink }]}>
            {t('settings.syncFailed')}
          </Text>
        </View>
      ) : null}

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
        {/* TWO settings, not one toggle.
            V1 had a single "Language: Telugu / Switch" row, because a
            single preference drove both the interface and the Bible. They
            are independent now, and a shared label is exactly how someone
            ends up changing the wrong one -- so each gets its own row,
            its own name, and a sentence saying what it does NOT affect.
            Segmented choices rather than a toggle: with three Bible modes
            a two-state switch cannot express the options, and naming every
            option is clearer than asking the user to cycle to find it. */}
        <View style={[styles.pickerRow, { padding: spacing.md }]}>
          <Text style={[type.label, { color: colors.ink }]}>
            {t('settings.appLanguage')}
          </Text>
          <Text style={[type.bodySmall, { color: colors.inkMuted }]}>
            {t('settings.appLanguageHelp')}
          </Text>
          <SegmentedChoice
            testID="settings-app-language"
            accessibilityLabel={t('settings.appLanguage')}
            options={[
              { value: 'en' as BibleLanguage, label: t('settings.languageEnglish') },
              { value: 'te' as BibleLanguage, label: t('settings.languageTelugu') },
            ]}
            selected={appLanguage}
            onSelect={(value) => void setAppLanguage(value)}
          />
        </View>

        <Divider />
        <View style={[styles.pickerRow, { padding: spacing.md }]}>
          <Text style={[type.label, { color: colors.ink }]}>
            {t('settings.bibleLanguage')}
          </Text>
          <Text style={[type.bodySmall, { color: colors.inkMuted }]}>
            {t('settings.bibleLanguageHelp')}
          </Text>
          <SegmentedChoice
            testID="settings-bible-language"
            accessibilityLabel={t('settings.bibleLanguage')}
            options={[
              { value: 'te' as BibleMode, label: t('bible.modeTelugu') },
              { value: 'en' as BibleMode, label: t('bible.modeEnglish') },
              { value: 'bilingual' as BibleMode, label: t('bible.modeBilingual') },
            ]}
            selected={bibleMode}
            onSelect={(value) => void setBibleMode(value)}
          />
        </View>

        <Divider />
        {/* Three values, so no longer a Switch.
            M4's reader offers Light / Dark / System and drives THIS one
            preference rather than keeping a reader-only theme, so the
            third option has to be selectable here too -- a two-state
            switch cannot express it. Same SegmentedChoice the two
            language rows above use, so the screen reads consistently. */}
        <View style={[styles.pickerRow, { padding: spacing.md }]}>
          <Text style={[type.label, { color: colors.ink }]}>{t('settings.theme')}</Text>
          <SegmentedChoice
            testID="settings-theme"
            accessibilityLabel={t('settings.theme')}
            options={[
              { value: 'light' as ThemePreference, label: t('settings.themeLight') },
              { value: 'dark' as ThemePreference, label: t('settings.themeDark') },
              { value: 'system' as ThemePreference, label: t('settings.themeSystem') },
            ]}
            selected={themePreference}
            onSelect={(value) => void setThemePreference(value)}
          />
        </View>

        <Divider />
        <View style={[styles.row, { padding: spacing.md }]}>
          <Text style={[type.label, { color: colors.ink }]}>
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
            <Text style={[type.label, { color: colors.ink }]}>
              {t('settings.contactChurch')}
            </Text>
            <Text style={[type.bodySmall, { color: colors.inkMuted }]}>
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
            <Text style={[type.label, { color: colors.ink }]}>
              {t('settings.bibleTranslations')}
            </Text>
            {/* Read from ../bible/translationCredits.ts rather than typed
                here. THIS CARD IS NOW THE APP'S ONLY LICENCE NOTICE: M6
                removed the copyright block from the share payload (see
                ../bible/reader/verseSharing.ts), so the CC BY-SA
                attribution appears here and nowhere else, and it must not
                be able to drift from the values the app uses elsewhere. */}
            <Text
              testID="settings-credit-en"
              style={[type.bodySmall, { color: colors.inkMuted }]}
            >
              English: {translationCreditLine('en')}.
            </Text>
            <Text
              testID="settings-credit-te"
              style={[type.bodySmall, { color: colors.inkMuted }]}
            >
              Telugu: {translationCreditLine('te')}, licensed under CC BY-SA 4.0 (
              {CC_BY_SA_URL}).
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
          <Text style={[type.label, { color: colors.ink }]}>
            {t('settings.privacyPolicy')}
          </Text>
          <Text style={[type.label, { color: colors.primary }]}>
            {t('settings.view')}
          </Text>
        </Tappable>

        <Divider />
        <Tappable
          testID="settings-terms-row"
          accessibilityRole="button"
          onPress={() => navigation.navigate('Terms')}
          style={[styles.row, { padding: spacing.md }]}
        >
          <Text style={[type.label, { color: colors.ink }]}>{t('settings.terms')}</Text>
          <Text style={[type.label, { color: colors.primary }]}>
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
        <Text style={[type.label, { color: colors.danger }]}>{t('settings.logOut')}</Text>
      </Tappable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 20, gap: 16 },
  card: { borderWidth: StyleSheet.hairlineWidth },
  // A full-weight border, not the hairline the cards use: this one is
  // carrying meaning, so it has to read as a distinct band rather than as
  // another settings card.
  notice: { borderWidth: 1.5 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  // A picker row stacks label / explanation / choices, so unlike the
  // switch rows it is a column rather than a space-between row.
  pickerRow: { gap: 8 },
  logoutButton: {
    minHeight: 48,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
