import { StyleSheet, Text, View } from 'react-native';
import { Tappable } from '../../theme/ui/Tappable';
import { useTheme } from '../../theme';
import { useTranslation } from '../../i18n';

/**
 * "LIVE NOW" -- a slim red bar under the header while a published event is
 * being streamed, and the only red on Home.
 *
 * 54 high: a dot, the word, the event's title (one line, cut with an
 * ellipsis -- the full title is a tap away), and a pill that says what the
 * tap does. The whole bar is ONE button that opens the event, whose own
 * screen holds the Watch Live action. Red is the live colour and the error
 * colour and nothing else.
 *
 * It replaces a 100-point card with its own headline. A service in
 * progress should be one glance and one tap, not a banner that pushes the
 * Verse of the Day off the first screen.
 */
export function LiveBar({ title, onPress }: { title: string; onPress: () => void }) {
  const { colors, radii, type } = useTheme();
  const { t } = useTranslation();
  return (
    <Tappable
      testID="home-live-banner"
      accessibilityRole="button"
      accessibilityLabel={`${t('common.liveNow')}. ${title}. ${t('home.watchLive')}`}
      onPress={onPress}
      style={[styles.bar, { backgroundColor: colors.live, borderRadius: radii.card }]}
    >
      <View style={[styles.dot, { backgroundColor: colors.onLive }]} />
      <Text style={[type.overline, { color: colors.onLive }]}>{t('common.liveNow')}</Text>
      <Text
        style={[type.button, styles.title, { color: colors.onLive }]}
        numberOfLines={1}
      >
        {title}
      </Text>
      <View
        style={[styles.cta, { backgroundColor: colors.onLive, borderRadius: radii.pill }]}
      >
        <Text style={[type.label, { color: colors.live }]}>{t('home.watchLive')}</Text>
      </View>
    </Tappable>
  );
}

const styles = StyleSheet.create({
  bar: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingLeft: 14,
    paddingRight: 12,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  title: { flex: 1, minWidth: 0 },
  cta: { paddingHorizontal: 12, paddingVertical: 8 },
});
