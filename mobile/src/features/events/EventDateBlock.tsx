import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme';
import { fontFamilies, serifFor } from '../../theme/tokens';
import { useTranslation } from '../../i18n';
import { formatMonthShort, formatWeekdayShort } from '../../i18n/locale';

/**
 * The date of an event as a small calendar tile: the weekday and month in
 * gold ink above and below the day number in the serif (56 across, 60 high;
 * 76 in Telugu, whose marks need the room, and which sets its short words
 * without capitals or tracking). A tile for an event that is on now wears the
 * live colours -- a red outline on the live tint -- and no gold.
 *
 * It repeats what the row's meta line says in words, so a screen reader skips
 * it. An event with no date yet draws a dash for the day and nothing around it.
 */
export function EventDateBlock({
  date,
  live,
  testID,
}: {
  date: Date | null;
  live: boolean;
  testID?: string;
}) {
  const { colors, radii } = useTheme();
  const { appLanguage } = useTranslation();
  const telugu = appLanguage === 'te';
  const small = [
    telugu ? styles.smallTe : styles.small,
    { color: live ? colors.live : colors.accent },
  ];
  return (
    <View
      testID={testID}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.block,
        telugu && styles.blockTe,
        {
          borderRadius: radii.control,
          borderColor: live ? colors.live : colors.borderStrong,
          backgroundColor: live ? colors.liveTint : 'transparent',
        },
      ]}
    >
      {date ? <Text style={small}>{formatWeekdayShort(date, appLanguage)}</Text> : null}
      <Text style={[styles.day, { color: colors.ink }]}>
        {date ? date.getDate() : '–'}
      </Text>
      {date ? <Text style={small}>{formatMonthShort(date, appLanguage)}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    width: 56,
    height: 60,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  blockTe: { height: 76 },
  small: {
    fontFamily: fontFamilies.interfaceSemiBold,
    fontWeight: '600',
    fontSize: 10.5,
    lineHeight: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  smallTe: {
    fontFamily: fontFamilies.interfaceSemiBold,
    fontWeight: '600',
    fontSize: 11.5,
    lineHeight: 20,
  },
  day: {
    fontFamily: serifFor('en', 'semiBold'),
    fontWeight: '600',
    fontSize: 21,
    lineHeight: 24,
  },
});
