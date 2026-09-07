import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';
import { usePreferences } from '../../context/PreferencesContext';
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
  const { isDark } = usePreferences();
  const colors = isDark ? darkColors : lightColors;

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
        style={[styles.container, { backgroundColor: colors.background }]}
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
        style={[styles.container, { backgroundColor: colors.background }]}
        testID="daily-verse-loading"
      >
        <ActivityIndicator />
      </View>
    );
  }

  if (verse === null) {
    return (
      <View
        style={[styles.container, { backgroundColor: colors.background }]}
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
      <Text style={[styles.reference, { color: colors.secondaryText }]}>
        {verse.reference}
      </Text>
    </View>
  );
}

const lightColors = {
  background: '#F9FAFB',
  text: '#111827',
  secondaryText: '#6B7280',
};

const darkColors = {
  background: '#1F2937',
  text: '#F9FAFB',
  secondaryText: '#9CA3AF',
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  image: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 8,
  },
  text: { fontSize: 16, fontStyle: 'italic', lineHeight: 22 },
  reference: { fontSize: 14, fontWeight: '600' },
  message: { textAlign: 'center' },
});
