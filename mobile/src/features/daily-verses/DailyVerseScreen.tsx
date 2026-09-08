import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { useTheme } from '../../theme';
import { SectionHeader } from '../../theme/ui/SectionHeader';
import { EmptyState } from '../../theme/ui/EmptyState';
import {
  subscribeToDailyVerseArchive,
  subscribeToTodaysDailyVerse,
  todayDateString,
  type TodaysDailyVerse,
} from '../../services/firebase/dailyVerses';

function formatDate(dateString: string): string {
  const [year, month, day] = dateString.split('-').map(Number);
  if (!year || !month || !day) return dateString;
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Standalone Daily Verse screen -- fills the gap the UI audit flagged:
 * "Standalone Daily Verse screen -- card only, on Home." Today's verse
 * (the same real subscribeToTodaysDailyVerse() DailyVerseCard.tsx
 * already uses) gets a full-screen hero treatment; below it, every past
 * verse (subscribeToDailyVerseArchive() -- see
 * ../../services/firebase/dailyVerses.ts) is listed newest-first as the
 * archive-by-date the approved prototype calls for. No admin form or
 * navigation gains a new capability here -- this only reads collections
 * every signed-in role could already read.
 */
export function DailyVerseScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { colors, radii, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const [today, setToday] = useState<TodaysDailyVerse | null | undefined>(undefined);
  const [archive, setArchive] = useState<TodaysDailyVerse[] | undefined>(undefined);

  useEffect(() => subscribeToTodaysDailyVerse(setToday, () => setToday(null)), []);
  useEffect(() => subscribeToDailyVerseArchive(setArchive, () => setArchive([])), []);

  const pastVerses = archive?.filter((verse) => verse.date !== todayDateString()) ?? [];

  return (
    <ScrollView
      contentContainerStyle={[
        styles.container,
        { backgroundColor: colors.background, paddingTop: insets.top + 12 },
      ]}
      testID="daily-verse-screen"
    >
      <View style={styles.headerRow}>
        <Pressable
          testID="daily-verse-back-button"
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <View style={[styles.backChevron, { borderColor: colors.text }]} />
        </Pressable>
        <Text style={[styles.heading, { color: colors.text }]}>Daily Verse</Text>
      </View>

      {today === undefined ? (
        <ActivityIndicator testID="daily-verse-screen-loading" />
      ) : today === null ? (
        <EmptyState
          testID="daily-verse-screen-empty"
          title="No daily verse set for today"
          message="When your church posts today's verse, it will appear here."
        />
      ) : (
        <View
          style={[
            styles.todayCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderRadius: radii.card,
              padding: spacing.xl,
            },
          ]}
          testID="daily-verse-today-card"
        >
          {today.imageUrl ? (
            <Image
              source={{ uri: today.imageUrl }}
              style={[styles.todayImage, { borderRadius: radii.control }]}
              accessibilityIgnoresInvertColors
            />
          ) : null}
          <Text style={[styles.todayLabel, { color: colors.accent }]}>Today</Text>
          <Text style={[styles.verseText, { color: colors.text }]}>{today.text}</Text>
          <Text style={[styles.reference, { color: colors.accent }]}>
            {today.reference}
          </Text>
        </View>
      )}

      <View style={styles.archiveSection}>
        <SectionHeader title="Archive" />
        {archive === undefined ? (
          <ActivityIndicator testID="daily-verse-archive-loading" />
        ) : pastVerses.length === 0 ? (
          <EmptyState
            testID="daily-verse-archive-empty"
            title="No past verses yet"
            message="Verses will build up here day by day."
          />
        ) : (
          <View style={styles.archiveList} testID="daily-verse-archive-list">
            {pastVerses.map((verse) => (
              <View
                key={verse.id}
                style={[
                  styles.archiveItem,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    borderRadius: radii.card,
                    padding: spacing.md,
                  },
                ]}
                testID={`daily-verse-archive-item-${verse.id}`}
              >
                <Text style={[styles.archiveDate, { color: colors.secondaryText }]}>
                  {formatDate(verse.date)}
                </Text>
                <Text style={[styles.archiveText, { color: colors.text }]}>
                  {verse.text}
                </Text>
                <Text style={[styles.archiveReference, { color: colors.accent }]}>
                  {verse.reference}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 20, gap: 22 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  backButton: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  backChevron: {
    width: 10,
    height: 10,
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    transform: [{ rotate: '45deg' }],
  },
  heading: { fontSize: 28, fontWeight: '500' },
  todayCard: { borderWidth: StyleSheet.hairlineWidth, gap: 10 },
  todayImage: { width: '100%', aspectRatio: 16 / 9, marginBottom: 4 },
  todayLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  verseText: { fontSize: 20, lineHeight: 32 },
  reference: { fontSize: 14, fontWeight: '600' },
  archiveSection: { gap: 12 },
  archiveList: { gap: 10 },
  archiveItem: { borderWidth: StyleSheet.hairlineWidth, gap: 4 },
  archiveDate: {
    fontSize: 11.5,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  archiveText: { fontSize: 15, lineHeight: 22 },
  archiveReference: { fontSize: 13, fontWeight: '600' },
});
