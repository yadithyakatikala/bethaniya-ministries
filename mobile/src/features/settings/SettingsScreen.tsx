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
    setAppLanguage,
    setBibleMode,
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
          <Text style={[styles.label, { color: colors.text }]}>
            {t('settings.appLanguage')}
          </Text>
          <Text style={[styles.help, { color: colors.secondaryText }]}>
            {t('settings.appLanguageHelp')}
          </Text>
          <SegmentedChoice
            testID="settings-app-language"
            options={[
              { value: 'en', label: t('settings.languageEnglish') },
              { value: 'te', label: t('settings.languageTelugu') },
            ]}
            selected={appLanguage}
            onSelect={(value) => void setAppLanguage(value as BibleLanguage)}
          />
        </View>

        <View
          style={[
            styles.pickerRow,
            styles.divider,
            { borderTopColor: colors.border, padding: spacing.md },
          ]}
        >
          <Text style={[styles.label, { color: colors.text }]}>
            {t('settings.bibleLanguage')}
          </Text>
          <Text style={[styles.help, { color: colors.secondaryText }]}>
            {t('settings.bibleLanguageHelp')}
          </Text>
          <SegmentedChoice
            testID="settings-bible-language"
            options={[
              { value: 'te', label: t('bible.modeTelugu') },
              { value: 'en', label: t('bible.modeEnglish') },
              { value: 'bilingual', label: t('bible.modeBilingual') },
            ]}
            selected={bibleMode}
            onSelect={(value) => void setBibleMode(value as BibleMode)}
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
  // A picker row stacks label / explanation / choices, so unlike the
  // switch rows it is a column rather than a space-between row.
  pickerRow: { gap: 8 },
  help: { fontSize: 12.5, lineHeight: 18 },
  segment: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 2 },
  segmentOption: {
    minHeight: 44,
    paddingHorizontal: 14,
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  segmentLabel: { fontSize: 14, fontWeight: '600' },
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

/**
 * A row of named choices, one selected.
 *
 * Deliberately not a Switch: the Bible has three modes, and a two-state
 * control cannot express three. Selection is shown by fill AND border AND
 * weight, never by colour alone, matching the Badge and tab-bar rules
 * already established in this app. Each option is a 44dp target.
 */
function SegmentedChoice({
  testID,
  options,
  selected,
  onSelect,
}: {
  testID: string;
  options: { value: string; label: string }[];
  selected: string;
  onSelect: (value: string) => void;
}) {
  const { colors, radii } = useTheme();
  return (
    <View style={styles.segment} testID={testID} accessibilityRole="radiogroup">
      {options.map((option) => {
        const active = option.value === selected;
        return (
          <Tappable
            key={option.value}
            testID={`${testID}-${option.value}`}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            accessibilityLabel={option.label}
            onPress={() => onSelect(option.value)}
            style={[
              styles.segmentOption,
              {
                borderRadius: radii.control,
                backgroundColor: active ? colors.primaryTint : 'transparent',
                borderColor: active ? colors.primary : colors.border,
              },
            ]}
          >
            <Text
              style={[
                styles.segmentLabel,
                { color: active ? colors.primaryPressed : colors.secondaryText },
              ]}
            >
              {option.label}
            </Text>
          </Tappable>
        );
      })}
    </View>
  );
}
