import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme';
import {
  subscribeToTodaysDailyVerse,
  type TodaysDailyVerse,
} from '../../services/firebase/dailyVerses';

/**
 * Today's-verse card -- Day 5. Loading/error/empty/populated states, same
 * shape as ../announcements/AnnouncementsList.tsx, plus an image (when
 * set) and explicit light/dark-mode-aware colors (per the spec's Day 5
 * testing bar: "Verse text renders in dark/light mode"). There is no
 * app-wide theme system: usePreferences().isDark (see
 * ../../context/PreferencesContext.tsx), added in Day 9, which is what
 * ultimately backs an explicit Settings-screen theme choice.
 */
export function DailyVerseCard() {
  const [verse, setVerse] = useState<TodaysDailyVerse | null | undefined>(undefined);
  const [hasError, setHasError] = useState(false);
  const { colors } = useTheme();

  useEffect(() => {
    const unsubscribe = subscribeToTodaysDailyVerse(
      (next) => {
        setVerse(next);
        setHasError(false);
      },
      () => setHasError(true)
    );
    return unsubscribe;
  }, []);

  if (hasError) {
    return (
      <View
        style={[
          styles.container,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
        testID="daily-verse-error"
      >
        <Text style={[styles.message, { color: colors.secondaryText }]}>
          Could not load today&apos;s verse.
        </Text>
      </View>
    );
  }

  if (verse === undefined) {
    return (
      <View
        style={[
          styles.container,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
        testID="daily-verse-loading"
      >
        <ActivityIndicator />
      </View>
    );
  }

  if (verse === null) {
    return (
      <View
        style={[
          styles.container,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
        testID="daily-verse-empty"
      >
        <Text style={[styles.message, { color: colors.secondaryText }]}>
          No daily verse set for today.
        </Text>
      </View>
    );
  }

  return (
    <View
      style={[styles.container, { backgroundColor: colors.background }]}
      testID="daily-verse-card"
    >
      {verse.imageUrl ? (
        <Image
          source={{ uri: verse.imageUrl }}
          style={styles.image}
          testID="daily-verse-image"
          accessibilityIgnoresInvertColors
        />
      ) : null}
      <Text style={[styles.text, { color: colors.text }]}>{verse.text}</Text>
      <Text style={[styles.reference, { color: colors.accent }]}>{verse.reference}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    padding: 20,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  image: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 8,
  },
  text: { fontSize: 18, lineHeight: 29 },
  reference: { fontSize: 14, fontWeight: '600' },
  message: { textAlign: 'center' },
});
