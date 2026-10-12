import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { contentTextStyle, useTheme } from '../../theme';
import { useTranslation } from '../../i18n';
import { formatLongDate, formatWeekdayDate } from '../../i18n/locale';
import { TopBar } from '../common/TopBar';
import type { UpdateKind } from './updates';

/**
 * One update in full: an announcement or a church post -- the SAME screen,
 * because to a member it is the same thing (see ./updates.ts).
 *
 * A top bar with Back; the church's picture, if it attached one, at 16:9
 * (and nothing at all if it did not -- no grey box); a gold kicker saying
 * what this is and when; the title; the words in paragraphs.
 *
 * The title and the paragraphs are the church's own text, so they take the
 * serif of the script they are written in, and the interface face when they
 * mix scripts (the design's rule S5): a Telugu title with a Latin name in it
 * does not lose half its letters. Blank lines in the text are paragraph
 * breaks; single line breaks are kept.
 *
 * `testPrefix` is the prefix its testIDs have always had, one per kind, so
 * each kind's tests and any end-to-end script keep finding what they look for.
 */
export function UpdateDetail({
  kind,
  title,
  content,
  imageUrl,
  createdAt,
  onBack,
  testPrefix,
}: {
  kind: UpdateKind;
  title: string;
  content: string;
  imageUrl: string | null;
  createdAt: Date | null;
  onBack: () => void;
  testPrefix: 'announcement-detail' | 'community-post-detail';
}) {
  const { colors, layout, radii, type } = useTheme();
  const { t, appLanguage } = useTranslation();
  const insets = useSafeAreaInsets();

  const label =
    kind === 'announcement' ? t('updates.announcement') : t('community.postsSection');
  const when = createdAt ? updateDate(createdAt, appLanguage) : '';
  const paragraphs = content
    .split(/\n{2,}/)
    .filter((paragraph) => paragraph.trim().length > 0);

  return (
    <ScrollView
      testID={`${testPrefix}-screen`}
      style={{ backgroundColor: colors.paper }}
      contentContainerStyle={[
        styles.container,
        { paddingTop: insets.top, paddingHorizontal: layout.screenMargin },
      ]}
    >
      <TopBar onBack={onBack} />

      {imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          style={[
            styles.image,
            { borderRadius: radii.card, backgroundColor: colors.surfaceRaised },
          ]}
          testID={`${testPrefix}-image`}
          resizeMode="cover"
          accessibilityIgnoresInvertColors
        />
      ) : null}

      <Text
        testID={`${testPrefix}-date`}
        style={[type.overline, styles.kicker, { color: colors.accent }]}
      >
        {label}
        {when ? (
          <Text style={[styles.when, { color: colors.inkSubtle }]}>{`  ·  ${when}`}</Text>
        ) : null}
      </Text>

      <Text
        accessibilityRole="header"
        testID={`${testPrefix}-title`}
        style={[
          contentTextStyle(title, {
            size: 26,
            line: 33,
            teSize: 24,
            teLine: 40,
            weight: 'semiBold',
            fallback: appLanguage,
          }),
          styles.heading,
          { color: colors.ink },
        ]}
      >
        {title}
      </Text>

      <View testID={`${testPrefix}-content`} style={styles.body}>
        {paragraphs.map((paragraph, index) => (
          <Text
            key={index}
            style={[
              contentTextStyle(paragraph, {
                size: 17,
                line: 28,
                teSize: 16.5,
                teLine: 34,
                fallback: appLanguage,
              }),
              { color: colors.ink },
            ]}
          >
            {paragraph.trim()}
          </Text>
        ))}
      </View>
    </ScrollView>
  );
}

/**
 * "Friday, 9 October" for something from this year, with the year spelt out
 * for anything older -- a testimony from two years ago should not read as
 * though it were from last week.
 */
export function updateDate(
  date: Date,
  appLanguage: 'en' | 'te',
  now: Date = new Date()
): string {
  return date.getFullYear() === now.getFullYear()
    ? formatWeekdayDate(date, appLanguage)
    : formatLongDate(date, appLanguage);
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, paddingBottom: 40 },
  image: { width: '100%', aspectRatio: 16 / 9, marginTop: 4 },
  kicker: { marginTop: 18 },
  when: { fontWeight: '500', letterSpacing: 0, textTransform: 'none' },
  heading: { marginTop: 6 },
  body: { gap: 14, marginTop: 14 },
});
