import { Image, StyleSheet, Text, View } from 'react-native';
import { Tappable, contentTextStyle, useTheme } from '../../theme';
import { useTranslation } from '../../i18n';
import { formatDayMonthShort } from '../../i18n/locale';
import type { UpdateItem } from './updates';

/**
 * One item in the Updates feed: a kicker that says WHAT it is and when
 * ("ANNOUNCEMENT · 9 Oct"), the title, two lines of what it says, and -- only
 * when the church attached one -- a 76-point picture at the right. A row
 * between hairlines, not a card: the list is words, and a picture is a
 * thumbnail beside them, never a grey box standing in for one. (A row with no
 * picture has no chevron either, as drawn: it is a list of headlines.)
 *
 * The title is the church's own text, so it takes the serif of the script
 * it is written in (the design's rule S5); the preview under it is the first
 * paragraph of what it says, in the interface face. The whole row is ONE
 * button.
 */
export function UpdateRow({ item, onPress }: { item: UpdateItem; onPress: () => void }) {
  const { colors, radii, type } = useTheme();
  const { t, appLanguage } = useTranslation();

  const kind =
    item.kind === 'announcement'
      ? t('updates.announcement')
      : t('community.postsSection');
  const date = item.createdAt ? formatDayMonthShort(item.createdAt, appLanguage) : '';
  // The first paragraph only, on one line of text: the rest is for the detail.
  const preview = (item.content.split(/\n{2,}/)[0] ?? '')
    .replace(/\s*\n\s*/g, ' ')
    .trim();

  const testID = `${item.kind === 'announcement' ? 'announcement' : 'community-post'}-${item.id}`;

  return (
    <Tappable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={[kind, date, item.title].filter(Boolean).join('. ')}
      onPress={onPress}
      style={[styles.row, { borderBottomColor: colors.border }]}
    >
      <View style={styles.text}>
        <Text style={[type.overline, { color: colors.accent }]}>
          {kind}
          {date ? (
            // The date is not part of the label's tracking and capitals.
            <Text
              style={[styles.date, { color: colors.inkSubtle }]}
            >{`  ·  ${date}`}</Text>
          ) : null}
        </Text>
        <Text
          style={[
            contentTextStyle(item.title, {
              size: 17,
              line: 24,
              teSize: 16.5,
              teLine: 30,
              weight: 'semiBold',
              fallback: appLanguage,
            }),
            { color: colors.ink },
          ]}
          numberOfLines={3}
        >
          {item.title}
        </Text>
        <Text
          style={[
            type.body,
            styles.preview,
            // Telugu stacks marks above and below a letter: it needs the room.
            appLanguage === 'te' && styles.previewTe,
            { color: colors.inkMuted },
          ]}
          numberOfLines={2}
        >
          {preview}
        </Text>
      </View>
      {item.imageUrl ? (
        <Image
          testID={`${testID}-image`}
          source={{ uri: item.imageUrl }}
          style={[
            styles.image,
            { borderRadius: radii.control, backgroundColor: colors.surfaceRaised },
          ]}
          resizeMode="cover"
          accessibilityIgnoresInvertColors
        />
      ) : null}
    </Tappable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
    paddingVertical: 16,
    minHeight: 96,
    borderBottomWidth: 1,
  },
  text: { flex: 1, minWidth: 0, gap: 4 },
  date: { fontWeight: '500', letterSpacing: 0, textTransform: 'none' },
  // 14.5/21 muted, two lines: the preview is a taste, not the post.
  preview: { fontSize: 14.5, lineHeight: 21 },
  previewTe: { lineHeight: 24 },
  image: { width: 76, height: 76 },
});
