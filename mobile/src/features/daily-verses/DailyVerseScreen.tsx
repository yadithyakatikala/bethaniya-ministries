import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
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
import { useTranslation } from '../../i18n';
import { formatIsoDateString } from '../../i18n/locale';
import { Tappable } from '../../theme/ui/Tappable';
import { SectionHeader } from '../../theme/ui/SectionHeader';
import { EmptyState } from '../../theme/ui/EmptyState';
import {
  subscribeToDailyVerseArchive,
  subscribeToTodaysDailyVerse,
  todayDateString,
  type TodaysDailyVerse,
} from '../../services/firebase/dailyVerses';



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
  const { colors, radii, spacing, type } = useTheme();
  const { t, appLanguage } = useTranslation();
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
        <Tappable
          testID="daily-verse-back-button"
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <View style={[styles.backChevron, { borderColor: colors.text }]} />
        </Tappable>
        <Text style={[type.headline, { color: colors.text }]}>{t('dailyVerse.title')}</Text>
      </View>

      {today === undefined ? (
        <ActivityIndicator testID="daily-verse-screen-loading" />
      ) : today === null ? (
        <EmptyState
          testID="daily-verse-screen-empty"
          title={t('dailyVerse.noneToday')}
          message={t('dailyVerse.noneTodayMessage')}
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
          <Text style={[type.overline, { color: colors.accent }]}>{t('dailyVerse.today')}</Text>
          <Text style={[type.bodyLarge, { color: colors.text }]}>{today.text}</Text>
          <Text style={[type.scriptureReference, { color: colors.accent }]}>
            {today.reference}
          </Text>
        </View>
      )}

      <View style={styles.archiveSection}>
        <SectionHeader title={t('dailyVerse.archive')} />
        {archive === undefined ? (
          <ActivityIndicator testID="daily-verse-archive-loading" />
        ) : pastVerses.length === 0 ? (
          <EmptyState
            testID="daily-verse-archive-empty"
            title={t('dailyVerse.noPast')}
            message={t('dailyVerse.noPastMessage')}
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
                <Text style={[type.overline, { color: colors.secondaryText }]}>
                  {formatIsoDateString(verse.date, appLanguage)}
                </Text>
                <Text style={[type.body, { color: colors.text }]}>
                  {verse.text}
                </Text>
                <Text style={[type.scriptureReference, { color: colors.accent }]}>
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
  todayCard: { borderWidth: StyleSheet.hairlineWidth, gap: 10 },
  todayImage: { width: '100%', aspectRatio: 16 / 9, marginBottom: 4 },
  archiveSection: { gap: 12 },
  archiveList: { gap: 10 },
  archiveItem: { borderWidth: StyleSheet.hairlineWidth, gap: 4 },
});
