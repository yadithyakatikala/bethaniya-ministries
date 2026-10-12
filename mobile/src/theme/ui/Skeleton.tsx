import { useEffect, useState } from 'react';
import { Animated, StyleSheet, View, type DimensionValue } from 'react-native';
import { useTheme } from '../useTheme';
import { useReducedMotion } from '../motion';

/**
 * A placeholder block in the shape of what is coming.
 *
 * For lists and verses a spinner says nothing about what is loading;
 * a skeleton does. Blocks are the secondary background, static -- and,
 * only when the phone allows motion, a slow 0.6 -> 1 opacity pulse. With
 * "reduce motion" on it simply sits there, which is the honest reading of
 * "remove animations".
 *
 * Decorative: it is hidden from the accessibility tree. The container
 * that holds the skeletons (LoadingState / SkeletonRows) is what says
 * "busy".
 */
export function Skeleton({
  width = '100%',
  height = 14,
  radius = 6,
  testID,
}: {
  width?: DimensionValue;
  height?: number;
  radius?: number;
  testID?: string;
}) {
  const { colors } = useTheme();
  const reducedMotion = useReducedMotion();
  const [pulse] = useState(() => new Animated.Value(1));

  useEffect(() => {
    if (reducedMotion) {
      pulse.setValue(1);
      return undefined;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.6, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [reducedMotion, pulse]);

  return (
    <Animated.View
      testID={testID}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width,
        height,
        borderRadius: radius,
        backgroundColor: colors.surfaceRaised,
        opacity: pulse,
      }}
    />
  );
}

/**
 * Rows waiting for their content: a thumbnail-or-icon circle, a title
 * line and a shorter detail line, `count` times, between hairlines --
 * the same rhythm as a ListRow so nothing jumps when the real ones arrive.
 */
export function SkeletonRows({
  count = 4,
  label,
  testID,
  leading = 'circle',
}: {
  count?: number;
  /** Spoken as the busy state of the whole group. */
  label?: string;
  testID?: string;
  leading?: 'circle' | 'thumbnail' | 'none';
}) {
  const { colors } = useTheme();
  return (
    <View
      testID={testID}
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityState={{ busy: true }}
    >
      {Array.from({ length: count }, (_, index) => (
        <View
          key={index}
          style={[
            styles.row,
            index > 0 && { borderTopColor: colors.border, borderTopWidth: 1 },
          ]}
        >
          {leading === 'circle' ? <Skeleton width={40} height={40} radius={20} /> : null}
          {leading === 'thumbnail' ? (
            <Skeleton width={56} height={56} radius={12} />
          ) : null}
          <View style={styles.lines}>
            <Skeleton width="62%" height={14} />
            <Skeleton width="38%" height={12} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    minHeight: 64,
    paddingVertical: 12,
  },
  lines: { flex: 1, gap: 8 },
});
