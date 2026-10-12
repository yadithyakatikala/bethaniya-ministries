import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppButton, useTheme } from '../../theme';
import { fontFamilies } from '../../theme/tokens';
import { useTranslation } from '../../i18n';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import {
  CC_BY_SA_URL,
  TRANSLATION_ATTRIBUTION,
  TRANSLATION_NAMES,
} from '../bible/translationCredits';
import { TopBar } from '../common/TopBar';

type Props = NativeStackScreenProps<RootStackParamList, 'BibleTranslations'>;

/**
 * Bible translations: who wrote the Bibles in this app and under what licence,
 * on a screen of their own, one tap from Settings.
 *
 * THIS IS THE APP'S ONLY LICENCE NOTICE. M6 removed the copyright block from
 * the share payload (see ../bible/reader/verseSharing.ts), so the CC BY-SA
 * attribution the Telugu text requires appears here and nowhere else. It is
 * read from ../bible/translationCredits.ts rather than typed here, so it
 * cannot drift from the values the rest of the app uses. (Whether one tap
 * deeper than before still counts as findable under that licence is a question
 * for the church's counsel; the licence's text and the link to it are both
 * here, in words, not behind an icon.)
 *
 * Each translation is a small-capitals language label, its name in bold, and
 * its terms as plain lines: the English one is public domain; the Telugu one
 * names its copyright holder, says it is licensed under CC BY-SA 4.0, shows the
 * licence's address, and has a button that opens it.
 *
 * The names are proper nouns and stay in English on a Telugu screen.
 */
export function BibleTranslationsScreen({ navigation }: Props) {
  const { colors, layout, type } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const teluguAttribution = TRANSLATION_ATTRIBUTION.te ?? '';
  // "© Bridge Connectivity Solutions, CC BY-SA 4.0" -> the holder, then the licence on its own
  // line. Split from the constant rather than typed, so the catalogues carry no licence text.
  const attributionParts = teluguAttribution.split(',');
  const licence =
    attributionParts.length > 1 ? (attributionParts.pop() ?? '').trim() : '';
  const holder = attributionParts.join(',').trim();

  return (
    <View
      testID="bible-translations-screen"
      style={[styles.screen, { backgroundColor: colors.paper, paddingTop: insets.top }]}
    >
      <View style={{ paddingHorizontal: layout.screenMargin }}>
        <TopBar
          title={t('settings.bibleTranslations')}
          onBack={() => navigation.goBack()}
        />
      </View>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: layout.screenMargin,
          paddingBottom: insets.bottom + 32,
        }}
      >
        <Text style={[type.body, { color: colors.inkMuted }]}>{t('credits.intro')}</Text>

        <View style={[styles.list, { borderTopColor: colors.border }]}>
          <View
            testID="credits-en"
            style={[styles.item, { borderBottomColor: colors.border }]}
          >
            <Text style={[type.overline, { color: colors.inkMuted }]}>
              {t('settings.languageEnglish')}
            </Text>
            <Text style={[styles.name, { color: colors.ink }]}>
              {TRANSLATION_NAMES.en}
            </Text>
            <Text style={[type.bodySmall, { color: colors.inkMuted }]}>
              {t('credits.publicDomain')}
            </Text>
          </View>

          <View
            testID="credits-te"
            style={[styles.item, { borderBottomColor: colors.border }]}
          >
            <Text style={[type.overline, { color: colors.inkMuted }]}>
              {t('settings.languageTelugu')}
            </Text>
            <Text style={[styles.name, { color: colors.ink }]}>
              {TRANSLATION_NAMES.te}
            </Text>
            <Text
              testID="credits-te-holder"
              style={[type.bodySmall, { color: colors.inkMuted }]}
            >
              {holder}
            </Text>
            <Text style={[type.bodySmall, { color: colors.inkMuted }]}>
              {t('credits.licensed', { licence })}
            </Text>
            <Text
              testID="credits-te-url"
              style={[type.bodySmall, { color: colors.inkMuted }]}
            >
              {CC_BY_SA_URL}
            </Text>
            <View style={styles.button}>
              <AppButton
                testID="credits-read-licence"
                title={t('credits.readLicence')}
                variant="secondary"
                compact
                leadingIcon="external"
                onPress={() => void Linking.openURL(CC_BY_SA_URL)}
              />
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  list: { marginTop: 20, borderTopWidth: 1 },
  item: { gap: 4, paddingVertical: 16, borderBottomWidth: 1 },
  name: {
    fontFamily: fontFamilies.interfaceSemiBold,
    fontWeight: '600',
    fontSize: 17,
    lineHeight: 24,
  },
  button: { marginTop: 8, alignItems: 'flex-start' },
});
