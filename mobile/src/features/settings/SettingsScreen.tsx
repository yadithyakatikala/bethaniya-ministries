import { useEffect, useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../../context/AuthContext';
import { usePreferences } from '../../context/PreferencesContext';
import {
  ConfirmDialog,
  Icon,
  ChoiceSheet,
  ListGroup,
  ListRow,
  NoticeBanner,
  SegmentedChoice,
  Tappable,
  useTheme,
} from '../../theme';
import { useTranslation } from '../../i18n';
import { TRANSLATION_NAMES } from '../bible/translationCredits';
import { subscribeToChurchSettings } from '../../services/firebase/settings';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import type { ThemePreference } from '../../services/firebase/userProfile';
import type { BibleLanguage, BibleMode } from '../bible/types';
import { TopBar } from '../common/TopBar';

type Chooser = 'app' | 'bible';

/**
 * Settings -- Day 9 requirement (decision 8: "English/Telugu toggle,
 * Light/Dark toggle, Notifications on/off toggle, Logout. Preferences persist
 * across app restart. Authenticated changes sync to Firestore.
 * Offline/local fallback continues to work.").
 *
 * Every control here is a thin view over usePreferences() (see
 * ../../context/PreferencesContext.tsx) -- this screen holds no preference
 * state of its own, so persistence, sync and the offline fallback are all
 * already handled by that shared context, not re-implemented here. Log out
 * reuses useAuth().signOut(), the same call ../auth/HomeScreen.tsx used.
 *
 * THE LOOK. A top bar with Back, then grouped rows between hairlines:
 *
 *   LANGUAGE   two value rows -- "App language" and "Bible language" -- each
 *              with its value and chevron, and under its name the sentence that
 *              says what it does NOT change. They are TWO settings (V1 had one
 *              "Language" row, because one preference drove both, and a shared
 *              label is how someone changes the wrong one), and the sentence is
 *              the reason they are not mistaken. A row opens a sheet of its
 *              choices (the Bible's has the third, English + Telugu; the
 *              interface has no bilingual mode -- the app renders one language),
 *              the current one ticked; choosing one closes the sheet.
 *   THEME      a three-part pill: Light, Dark, System.
 *              (The reader's Page choice -- Light, Sepia, Dark -- drives this one
 *              preference for Light and Dark; Sepia is the reader's alone.)
 *   Notifications   one row with the switch.
 *   ABOUT      Contact the church (its real support address from the church's
 *              settings, or "Not set yet" -- never an invented one), Bible
 *              translations (the names, opening their credits), Privacy policy
 *              and Terms of service.
 *   Log Out    a red word with its icon, which ASKS before it does anything.
 *
 * A preference that saved on this phone but could not reach the member's
 * account says so at the top (M6: such a write used to be refused by
 * firestore.rules and swallowed, so it looked like the app forgetting the
 * setting). Not colour alone, and announced politely rather than as an alert:
 * the local value is in effect, so there is nothing for the member to do.
 *
 * The full Bible licence notice is on its own screen, one tap from here
 * (./BibleTranslationsScreen.tsx).
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
  const { colors, layout, type } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [supportEmail, setSupportEmail] = useState<string | null>(null);
  const [chooser, setChooser] = useState<Chooser | null>(null);
  const [confirmingLogOut, setConfirmingLogOut] = useState(false);

  useEffect(
    () =>
      subscribeToChurchSettings(
        (settings) => setSupportEmail(settings?.supportEmail || ''),
        () => setSupportEmail('')
      ),
    []
  );

  /**
   * React Native's Switch ships with the platform's own accent (iOS green,
   * Android's Material teal) regardless of the app's palette. The thumb and
   * the Android track are set explicitly; `ios_backgroundColor` covers the off
   * track on iOS.
   */
  const switchColors = {
    trackColor: { false: colors.border, true: colors.primary },
    thumbColor: colors.surface,
    ios_backgroundColor: colors.border,
  };

  const languageName = (language: BibleLanguage) =>
    t(language === 'te' ? 'settings.languageTelugu' : 'settings.languageEnglish');
  const bibleModeName = (mode: BibleMode) =>
    t(
      mode === 'te'
        ? 'bible.modeTelugu'
        : mode === 'en'
          ? 'bible.modeEnglish'
          : 'bible.modeBilingual'
    );

  const pad = { paddingHorizontal: layout.screenMargin };

  /** A group: its small capital label, then its rows between hairlines. */
  const group = (label: string | null, children: ReactNode, testID?: string) => (
    <View style={styles.group} testID={testID}>
      {label ? (
        <Text
          accessibilityRole="header"
          style={[type.overline, styles.groupLabel, { color: colors.inkMuted }]}
        >
          {label}
        </Text>
      ) : null}
      <View style={[styles.rule, { borderTopColor: colors.border }]} />
      {children}
      <View style={[styles.rule, { borderTopColor: colors.border }]} />
    </View>
  );

  return (
    <View
      testID="settings-screen"
      style={[styles.screen, { backgroundColor: colors.paper, paddingTop: insets.top }]}
    >
      <View style={pad}>
        <TopBar title={t('settings.title')} onBack={() => navigation.goBack()} />
      </View>

      <ScrollView
        contentContainerStyle={[pad, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {syncFailed ? (
          <View style={styles.notice}>
            <NoticeBanner
              testID="settings-sync-failed"
              tone="warning"
              message={t('settings.syncFailed')}
            />
          </View>
        ) : null}

        {group(
          t('settings.language'),
          <ListGroup>
            <ListRow
              testID="settings-app-language"
              title={t('settings.appLanguage')}
              subtitle={t('settings.appLanguageHelp')}
              subtitleLines={4}
              value={languageName(appLanguage)}
              onPress={() => setChooser('app')}
            />
            <ListRow
              testID="settings-bible-language"
              title={t('settings.bibleLanguage')}
              subtitle={t('settings.bibleLanguageHelp')}
              subtitleLines={4}
              value={bibleModeName(bibleMode)}
              onPress={() => setChooser('bible')}
            />
          </ListGroup>
        )}

        <View style={styles.group}>
          <Text
            accessibilityRole="header"
            style={[type.overline, styles.groupLabel, { color: colors.inkMuted }]}
          >
            {t('settings.theme')}
          </Text>
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

        {group(
          null,
          <View style={styles.switchRow}>
            <Text
              style={[type.button, styles.switchLabel, { color: colors.ink }]}
              accessible={false}
            >
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
        )}

        {group(
          t('settings.about'),
          <ListGroup>
            <ListRow
              testID="settings-support-row"
              title={t('settings.contactChurch')}
              subtitle={
                supportEmail === null ? ' ' : supportEmail || t('settings.notSetYet')
              }
            />
            <ListRow
              testID="settings-bible-translations-row"
              title={t('settings.bibleTranslations')}
              subtitle={`${TRANSLATION_NAMES.en} · ${TRANSLATION_NAMES.te}`}
              onPress={() => navigation.navigate('BibleTranslations')}
            />
            <ListRow
              testID="settings-privacy-policy-row"
              title={t('settings.privacyPolicy')}
              onPress={() => navigation.navigate('PrivacyPolicy')}
            />
            <ListRow
              testID="settings-terms-row"
              title={t('settings.terms')}
              onPress={() => navigation.navigate('Terms')}
            />
          </ListGroup>
        )}

        <Tappable
          testID="settings-logout-button"
          accessibilityRole="button"
          accessibilityLabel={t('settings.logOut')}
          onPress={() => setConfirmingLogOut(true)}
          style={styles.logOut}
        >
          <Icon name="logout" size={20} color={colors.danger} />
          <Text style={[type.button, { color: colors.danger }]}>
            {t('settings.logOut')}
          </Text>
        </Tappable>
      </ScrollView>

      <ChoiceSheet
        visible={chooser === 'app'}
        testID="settings-app-language-sheet"
        title={t('settings.appLanguage')}
        help={t('settings.appLanguageHelp')}
        closeLabel={t('common.close')}
        options={[
          { value: 'en', label: t('settings.languageEnglish') },
          { value: 'te', label: t('settings.languageTelugu') },
        ]}
        current={appLanguage}
        optionTestID={(value) => `settings-app-language-${value}`}
        onClose={() => setChooser(null)}
        onChoose={(value) => {
          setChooser(null);
          void setAppLanguage(value as BibleLanguage);
        }}
      />
      <ChoiceSheet
        visible={chooser === 'bible'}
        testID="settings-bible-language-sheet"
        title={t('settings.bibleLanguage')}
        help={t('settings.bibleLanguageHelp')}
        closeLabel={t('common.close')}
        options={[
          { value: 'te', label: t('bible.modeTelugu') },
          { value: 'en', label: t('bible.modeEnglish') },
          { value: 'bilingual', label: t('bible.modeBilingual') },
        ]}
        current={bibleMode}
        optionTestID={(value) => `settings-bible-language-${value}`}
        onClose={() => setChooser(null)}
        onChoose={(value) => {
          setChooser(null);
          void setBibleMode(value as BibleMode);
        }}
      />

      <ConfirmDialog
        visible={confirmingLogOut}
        testID="settings-logout-dialog"
        title={t('settings.logOutConfirmTitle')}
        message={t('settings.logOutConfirmMessage')}
        cancelLabel={t('common.cancel')}
        confirmLabel={t('settings.logOut')}
        onCancel={() => setConfirmingLogOut(false)}
        onConfirm={() => {
          setConfirmingLogOut(false);
          void signOut();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  notice: { marginTop: 8 },
  group: { marginTop: 24, gap: 0 },
  groupLabel: { marginBottom: 8 },
  rule: { borderTopWidth: 1 },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    minHeight: 56,
    paddingVertical: 8,
  },
  switchLabel: { flex: 1, minWidth: 0 },
  logOut: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 48,
    marginTop: 20,
    alignSelf: 'flex-start',
  },
});
