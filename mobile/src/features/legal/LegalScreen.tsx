import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, useTheme } from '../../theme';
import { fontFamilies } from '../../theme/tokens';
import { useTranslation } from '../../i18n';
import { TopBar } from '../common/TopBar';

/**
 * The Privacy Policy and the Terms of Service: one screen, two documents.
 *
 * Added during the V1 production-readiness audit after
 * FINAL_ARCHITECTURE_SPECIFICATION.md's Profile+Settings requirement
 * ("Privacy policy + terms (links)") was found completely missing from the
 * app. SettingsScreen.tsx links to two Stack.Screen registrations of this
 * component (see AppNavigator.tsx's "PrivacyPolicy"/"Terms" routes).
 *
 * THE TEXT IS A REAL PLACEHOLDER, NOT A DECORATIVE ONE. It accurately
 * describes what this app actually does (the auth methods it uses, that
 * Firestore/Firebase Auth hold the data, that no data is sold) without
 * inventing legal language a lawyer hasn't reviewed. This mirrors this
 * codebase's established pattern for anything not yet fully resolved (e.g.
 * BIBLE_LICENSING.md's placeholder-verse labeling) -- ship something honest
 * and clearly provisional rather than nothing, or something fabricated. A
 * church deploying this app for real should have its own counsel review and
 * replace this text before launch.
 *
 * THE LOOK. A top bar with Back and no title (the document's own title is
 * the first thing on the page), the title in the serif at 28/36, a
 * warning-tinted line saying the text is provisional, then the document as
 * HEADED SECTIONS -- a heading in the serif at 18/26, its paragraph beneath
 * in 16/26.
 *
 * THE HEADINGS ARE REAL HEADINGS (`accessibilityRole="header"`), so a screen
 * reader can jump from one section to the next instead of reading a wall of
 * text from the top.
 *
 * LANGUAGE. The title and the provisional line follow the app language; the
 * text itself is English only, until the church's counsel has approved a
 * Telugu version. In a Telugu interface the provisional line says so, and the
 * English text is marked as English for VoiceOver (`accessibilityLanguage`)
 * so it is not read out in a Telugu voice.
 */
export type LegalKind = 'privacy' | 'terms';

export interface LegalSection {
  /** `null` for the opening paragraph of a document, which has no heading. */
  heading: string | null;
  text: string;
}

export const PRIVACY_POLICY_SECTIONS: LegalSection[] = [
  {
    heading: 'What we collect',
    text: 'When you create an account or sign in (with an email address and password, or with Google), Firebase Authentication creates an account record containing your email address and, if you provide one, your name. Your profile (display name, photo, language and theme preference, and whether notifications are enabled) is stored in our Firestore database, tied to your account.',
  },
  {
    heading: 'What we don’t do',
    text: 'We do not sell your data, and we do not share it with advertisers. We do not collect your location, your contacts, or the contents of your device. Content you create in the app (such as prayer requests) is private to your account unless this app’s documentation says otherwise for a specific feature.',
  },
  {
    heading: 'Who can see what',
    text: 'Church administrators can see your name, email address, and role, as needed to run the app. Firestore security rules restrict what each administrator role can access.',
  },
  {
    heading: 'Deleting your data',
    text: 'Contact the church using the support email in Settings to request account deletion.',
  },
];

export const TERMS_SECTIONS: LegalSection[] = [
  {
    heading: null,
    text: 'By using this app, you agree to use it respectfully and only for its intended purpose: staying connected with this church’s announcements, events, songs, Bible reading, and community features.',
  },
  {
    heading: 'Content',
    text: 'Announcements, events, songs, and Bible text are provided by the church and its licensors. Do not copy or redistribute copyrighted content from this app without permission.',
  },
  {
    heading: 'Accounts',
    text: 'You’re responsible for keeping your sign-in method secure. The church may suspend accounts that misuse the app’s features (for example, posting inappropriate content where the app allows user posts).',
  },
  {
    heading: 'Availability',
    text: 'This app is provided as-is, without warranty. Features may change or be temporarily unavailable.',
  },
  {
    heading: 'Contact',
    text: 'For questions about these terms, use the support email in Settings.',
  },
];

export function LegalScreen({ kind, onBack }: { kind: LegalKind; onBack?: () => void }) {
  const { colors, layout, type } = useTheme();
  const { t, appLanguage } = useTranslation();
  const insets = useSafeAreaInsets();

  const title = t(kind === 'terms' ? 'settings.terms' : 'settings.privacyPolicy');
  const sections = kind === 'terms' ? TERMS_SECTIONS : PRIVACY_POLICY_SECTIONS;
  // The text is English only. A Telugu reader is told so, rather than left
  // to wonder why the page changed language under a Telugu title.
  const provisional =
    appLanguage === 'te'
      ? `${t('legal.provisional')} ${t('legal.englishOnly')}`
      : t('legal.provisional');

  return (
    <View
      testID="legal-screen"
      style={[styles.screen, { backgroundColor: colors.paper, paddingTop: insets.top }]}
    >
      {onBack ? (
        <View style={{ paddingHorizontal: layout.screenMargin }}>
          <TopBar onBack={onBack} />
        </View>
      ) : null}
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: layout.screenMargin,
          paddingTop: 2,
          paddingBottom: insets.bottom + 32,
        }}
      >
        <Text
          accessibilityRole="header"
          textBreakStrategy="balanced"
          testID="legal-screen-title"
          style={[
            type.headline,
            appLanguage === 'te' ? styles.titleTe : styles.titleEn,
            { color: colors.ink },
          ]}
        >
          {title}
        </Text>

        <View
          testID="legal-screen-provisional"
          style={[styles.provisional, { backgroundColor: colors.warningTint }]}
        >
          <View style={styles.provisionalMark}>
            <Icon name="info" size={16} color={colors.warning} />
          </View>
          <Text style={[type.help, styles.provisionalText, { color: colors.warning }]}>
            {provisional}
          </Text>
        </View>

        <View testID="legal-screen-body">
          {sections.map((section, index) => (
            <View
              key={section.heading ?? `section-${index}`}
              testID={`legal-section-${index}`}
            >
              {section.heading ? (
                <Text
                  accessibilityRole="header"
                  accessibilityLanguage="en"
                  style={[styles.heading, { color: colors.ink }]}
                >
                  {section.heading}
                </Text>
              ) : null}
              <Text
                accessibilityLanguage="en"
                style={[
                  styles.paragraph,
                  section.heading ? styles.paragraphAfterHeading : null,
                  { color: colors.ink },
                ]}
              >
                {section.text}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  titleEn: { fontSize: 28, lineHeight: 36 },
  titleTe: { fontSize: 25, lineHeight: 40 },
  provisional: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 12,
    marginBottom: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  provisionalMark: { marginTop: 1 },
  provisionalText: { flex: 1, minWidth: 0 },
  // English, always: the document is English only until counsel has approved
  // a Telugu one, so these name their faces rather than following the
  // interface language.
  heading: {
    fontFamily: fontFamilies.serifEnSemiBold,
    fontWeight: '600',
    fontSize: 18,
    lineHeight: 26,
    marginTop: 24,
    marginBottom: 6,
  },
  paragraph: {
    fontFamily: fontFamilies.interfaceRegular,
    fontWeight: '400',
    fontSize: 16,
    lineHeight: 26,
    marginTop: 12,
  },
  paragraphAfterHeading: { marginTop: 0 },
});
