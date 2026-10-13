import { StyleSheet, Text, View } from 'react-native';
import { Icon } from '../../theme/ui/Icon';
import { Tappable } from '../../theme/ui/Tappable';
import { useTheme } from '../../theme';
import { fontFamilies, serifFor } from '../../theme/tokens';
import { useTranslation } from '../../i18n';
import {
  formatTimeOfDay,
  formatWeekdayDate,
  formatWeekdayShort,
} from '../../i18n/locale';
import type { PublishedEvent } from '../../services/firebase/events';

/**
 * The next event, as one row between two hairlines: a date block, the
 * title, "6:30 PM · Main hall", and a chevron.
 *
 * The date block is a 56 x 60 outlined square with the weekday in small gold
 * capitals over the day number in the serif -- the church calendar's own
 * shape. It is the app's own text (a weekday and a number), so it takes the
 * serif and the interface family it knows; the title and the place are
 * administrator-written and take the interface family, which covers both
 * scripts. An event with no start time (it can have none) simply has no
 * block: the row starts at the title.
 *
 * ONE button: the whole row opens the event.
 */
export function UpcomingEventRow({
  event,
  onPress,
  style,
}: {
  event: PublishedEvent;
  onPress: () => void;
  style?: object;
}) {
  const { colors, radii, type } = useTheme();
  const { appLanguage } = useTranslation();

  const startsAt = event.startsAt;
  const details = [startsAt ? formatTimeOfDay(startsAt, appLanguage) : '', event.location]
    .filter((part) => part.length > 0)
    .join(' · ');
  const spoken = [
    event.title,
    startsAt ? formatWeekdayDate(startsAt, appLanguage) : '',
    details,
  ]
    .filter((part) => part.length > 0)
    .join('. ');

  return (
    <Tappable
      testID="home-next-event"
      accessibilityRole="button"
      accessibilityLabel={spoken}
      onPress={onPress}
      style={[styles.row, { borderColor: colors.border }, style]}
    >
      {startsAt ? (
        <View
          style={[
            styles.date,
            { borderColor: colors.borderStrong, borderRadius: radii.control },
          ]}
        >
          <Text
            // Telugu keeps the overline's own size and tracking (12.5, almost
            // none): a weekday abbreviation there is still Telugu, and must
            // not be upper-cased or pulled apart. English steps down to 10.5.
            style={[
              type.overline,
              appLanguage === 'en' && styles.weekdayEnglish,
              { color: colors.accent },
            ]}
            numberOfLines={1}
          >
            {formatWeekdayShort(startsAt, appLanguage)}
          </Text>
          <Text
            style={[
              styles.day,
              { color: colors.ink, fontFamily: serifFor('en', 'semiBold') },
            ]}
          >
            {startsAt.getDate()}
          </Text>
        </View>
      ) : null}
      <View style={styles.text}>
        <Text
          style={[
            type.button,
            styles.title,
            { color: colors.ink, fontFamily: fontFamilies.interfaceSemiBold },
          ]}
          numberOfLines={2}
        >
          {event.title}
        </Text>
        {details ? (
          <Text style={[type.bodySmall, { color: colors.inkMuted }]} numberOfLines={2}>
            {details}
          </Text>
        ) : null}
      </View>
      <Icon name="chev" size={20} color={colors.inkMuted} />
    </Tappable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
  },
  date: {
    width: 56,
    height: 60,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
  },
  weekdayEnglish: { fontSize: 10.5, lineHeight: 12 },
  day: { fontSize: 22, lineHeight: 26, fontWeight: '600' },
  text: { flex: 1, minWidth: 0 },
  title: { fontSize: 16, lineHeight: 22 },
});
