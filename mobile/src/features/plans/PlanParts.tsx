import { useEffect, useRef, type ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GoldFill, Icon, Tappable, serifFor, useTheme } from '../../theme';
import { fontFamilies } from '../../theme/tokens';
import type { IconName } from '../../theme';
import { useTranslation } from '../../i18n';

/** A 3-point track with the gold thread filled to `percent`. Decorative: the words beside it say the same. */
export function PlanThread({ percent, testID }: { percent: number; testID?: string }) {
  const { colors } = useTheme();
  return (
    <View
      testID={testID}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.thread, { backgroundColor: colors.border }]}
    >
      <View style={{ width: `${Math.max(0, Math.min(100, percent))}%`, height: 3 }}>
        <GoldFill />
      </View>
    </View>
  );
}

/**
 * "Day 2 of 7" at the left and "14%" at the right, under a thread. With no
 * `right`, the one caption is centred -- as on "Plan complete", where "100%" would
 * only repeat a thread that is already full.
 */
export function PlanProgressLine({
  left,
  right,
  percent,
  testID,
}: {
  left: string;
  right?: string;
  percent: number;
  testID?: string;
}) {
  const { colors, type } = useTheme();
  return (
    <View testID={testID}>
      <PlanThread percent={percent} testID={testID ? `${testID}-thread` : undefined} />
      <View style={[styles.captions, right === undefined && styles.captionsCentred]}>
        <Text style={[type.caption, { color: colors.inkMuted }]}>{left}</Text>
        {right === undefined ? null : (
          <Text style={[type.caption, { color: colors.inkMuted }]}>{right}</Text>
        )}
      </View>
    </View>
  );
}

/**
 * The days of a plan as a strip of small tiles, each a number: a day that is
 * done carries a tick; the day the member is on has a heavy ink outline and "Next"
 * under its number; the days still to come are plain. The tick, the outline and
 * the word are what say which is which -- never only a colour. A tile opens that
 * day, and is announced "Day 3" (with "completed", if it is). It scrolls
 * sideways, and opens already scrolled to the current day.
 */
export function DayStrip({
  total,
  current,
  completed,
  onOpenDay,
}: {
  total: number;
  current: number;
  completed: readonly number[];
  onOpenDay: (day: number) => void;
}) {
  const { colors, radii } = useTheme();
  const { t } = useTranslation();
  const scroll = useRef<ScrollView>(null);

  // Open on the current day, so a long plan does not start at day 1.
  useEffect(() => {
    scroll.current?.scrollTo({ x: Math.max(0, (current - 2) * 64), animated: false });
  }, [current]);

  const days = Array.from({ length: total }, (_, index) => index + 1);
  return (
    <ScrollView
      ref={scroll}
      horizontal
      showsHorizontalScrollIndicator={false}
      testID="plan-day-strip"
      // Runs to the screen's edges, so the first and last tiles line up with the margin.
      style={styles.stripBleed}
      contentContainerStyle={styles.strip}
    >
      {days.map((day) => {
        const done = completed.includes(day);
        const isCurrent = day === current;
        return (
          <Tappable
            key={day}
            testID={`plan-strip-day-${day}`}
            accessibilityRole="button"
            accessibilityLabel={[
              `${t('plans.dayWord')} ${day}`,
              done ? t('plans.completed') : '',
              isCurrent ? t('bible.next') : '',
            ]
              .filter(Boolean)
              .join(', ')}
            accessibilityState={{ selected: isCurrent }}
            onPress={() => onOpenDay(day)}
            style={[
              styles.day,
              {
                borderRadius: radii.card - 2,
                borderColor: isCurrent ? colors.ink : colors.border,
                borderWidth: isCurrent ? 2 : 1,
                backgroundColor: isCurrent ? colors.primaryTint : colors.surface,
              },
            ]}
          >
            <Text
              style={[
                styles.dayNumber,
                {
                  color: done ? colors.inkMuted : colors.ink,
                  fontFamily: serifFor('en', 'semiBold'),
                },
              ]}
            >
              {day}
            </Text>
            <View style={styles.dayNote}>
              {done ? (
                <Icon name="check" size={14} color={colors.inkMuted} strokeWidth={2.4} />
              ) : isCurrent ? (
                <Text style={[styles.dayNext, { color: colors.ink }]}>
                  {t('bible.next')}
                </Text>
              ) : null}
            </View>
          </Tappable>
        );
      })}
    </ScrollView>
  );
}

/** One step of a day -- Read, Reflect, Pray -- as a row with its icon, its name and what it holds. */
export function StepRow({
  icon,
  title,
  detail,
  onPress,
  testID,
}: {
  icon: IconName;
  title: string;
  detail: string;
  onPress?: () => void;
  testID?: string;
}) {
  const { colors } = useTheme();
  const body = (
    <>
      <View style={[styles.stepIcon, { borderColor: colors.border }]}>
        <Icon name={icon} size={22} color={colors.ink} />
      </View>
      <View style={styles.stepText}>
        <Text style={[styles.stepTitle, { color: colors.ink }]}>{title}</Text>
        <Text numberOfLines={2} style={[styles.stepDetail, { color: colors.inkMuted }]}>
          {detail}
        </Text>
      </View>
      {onPress ? <Icon name="chev" size={20} color={colors.inkSubtle} /> : null}
    </>
  );
  return onPress ? (
    <Tappable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${detail}`}
      onPress={onPress}
      style={[styles.step, { borderBottomColor: colors.border }]}
    >
      {body}
    </Tappable>
  ) : (
    <View
      testID={testID}
      accessible
      accessibilityLabel={`${title}. ${detail}`}
      style={[styles.step, { borderBottomColor: colors.border }]}
    >
      {body}
    </View>
  );
}

/**
 * The bar fixed to the foot of a plan screen: the paper, a hairline above it,
 * and room beneath for the phone's home bar. What goes in it is the screen's one
 * way forward -- Start, Continue, Mark complete.
 */
export function BottomBar({
  children,
  testID,
}: {
  children: ReactNode;
  testID?: string;
}) {
  const { colors, layout } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      testID={testID}
      style={[
        styles.bar,
        {
          backgroundColor: colors.paper,
          borderTopColor: colors.border,
          paddingHorizontal: layout.screenMargin,
          paddingBottom: Math.max(insets.bottom, 16) + 8,
        },
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  thread: { height: 3, borderRadius: 2, overflow: 'hidden' },
  captions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 7 },
  captionsCentred: { justifyContent: 'center' },
  stripBleed: { marginHorizontal: -20, flexGrow: 0 },
  strip: { gap: 8, paddingHorizontal: 20, paddingVertical: 2 },
  day: {
    width: 56,
    height: 68,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  dayNumber: { fontWeight: '600', fontSize: 18, lineHeight: 22 },
  dayNote: { height: 14, justifyContent: 'center' },
  dayNext: {
    fontFamily: fontFamilies.interfaceBold,
    fontWeight: '700',
    fontSize: 11,
    lineHeight: 14,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: 64,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  stepIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: { flex: 1, minWidth: 0 },
  stepTitle: {
    fontFamily: fontFamilies.interfaceSemiBold,
    fontWeight: '600',
    fontSize: 16,
    lineHeight: 22,
  },
  stepDetail: {
    fontFamily: fontFamilies.interfaceRegular,
    fontSize: 13.5,
    lineHeight: 19,
  },
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 16,
    borderTopWidth: 1,
    gap: 12,
  },
});
