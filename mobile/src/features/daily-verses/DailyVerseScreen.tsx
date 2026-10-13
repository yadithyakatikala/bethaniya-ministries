import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import {
  EmptyState,
  ErrorState,
  SectionHeader,
  SkeletonRows,
  contentTextStyle,
  useTheme,
} from '../../theme';
import { useTranslation } from '../../i18n';
import { formatIsoDayMonth } from '../../i18n/locale';
import {
  subscribeToDailyVerseArchive,
  type TodaysDailyVerse,
} from '../../services/firebase/dailyVerses';
import { TopBar } from '../common/TopBar';
import { DailyVerseCard } from './DailyVerseCard';
import { useIndiaDateKey } from './useIndiaDateKey';

/**
 * The Verse of the Day, as a screen of its own.
 *
 * WHAT IT SHOWS IS WHAT HOME SHOWS (design question V1). It used to read only
 * the verse an administrator had written for today -- so on a day the church
 * wrote none, Home showed a verse and this screen said there was none, and it
 * had no Share or Copy, which Home has. Now the top of the screen IS Home's
 * verse card, from the same resolver (an administrator's verse, then the
 * automated one, then a bundled one), with the same Read chapter, Share and
 * Copy. See ./DailyVerseCard.tsx for what it renders and in which face.
 *
 * Three things differ from Home, all in how the card is asked to draw:
 *   * The gold label says "Today" -- the top bar already says "Verse of the
 *     day".
 *   * The church's picture, when it sent one, is a 16:9 block ABOVE the date
 *     and the verse is set on the page, instead of the verse being set on the
 *     picture.
 *   * There is no "See all": this is that screen.
 *
 * BELOW IT, "Previous verses": the verses the church wrote on EARLIER days,
 * newest first, each as a date, the verse in the serif of its script, and its
 * reference in gold ink. (The automated verses are not listed: nobody wrote
 * them for a day, they are worked out from it.) A verse dated TODAY is the
 * one above, and one dated in the FUTURE -- a church can write next week's in
 * advance -- is not a "previous" verse at all, so neither is listed. "Today"
 * is the canonical Indian date the verse card itself uses, not the phone's,
 * so the two can never disagree about which verse is today's.
 *
 * Reads the same collection with the same permission as the card
 * (firestore.rules lets any signed-in member read daily_verses). A list that
 * cannot be read says so and offers to try again -- it does not claim "no
 * previous verses yet", which would be untrue.
 */
export function DailyVerseScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { colors, layout, type } = useTheme();
  const { t, appLanguage } = useTranslation();
  const insets = useSafeAreaInsets();
  const todayKey = useIndiaDateKey();

  /** `null` while the first answer is in flight. */
  const [archive, setArchive] = useState<TodaysDailyVerse[] | 'error' | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    const stop = subscribeToDailyVerseArchive(
      (verses) => {
        if (live) setArchive(verses);
      },
      () => {
        if (live) setArchive('error');
      }
    );
    return () => {
      live = false;
      stop();
    };
  }, [attempt]);

  function retry() {
    setArchive(null);
    setAttempt((count) => count + 1);
  }

  // ISO dates compare correctly as strings.
  const past =
    archive !== null && archive !== 'error'
      ? archive.filter((verse) => verse.date < todayKey)
      : [];

  return (
    <ScrollView
      testID="daily-verse-screen"
      style={{ backgroundColor: colors.paper }}
      contentContainerStyle={{
        paddingTop: insets.top,
        paddingHorizontal: layout.screenMargin,
        paddingBottom: insets.bottom + 32,
      }}
    >
      <TopBar
        testID="daily-verse-top-bar"
        title={t('home.verseOfTheDay')}
        onBack={() => navigation.goBack()}
      />

      <View style={styles.hero}>
        <DailyVerseCard
          label={t('dailyVerse.today')}
          imagePlacement="above"
          onReadChapter={(place) =>
            navigation.navigate('BibleChapter', {
              bookId: place.bookId,
              chapterNumber: place.chapter,
              verse: place.verse,
            })
          }
        />
      </View>

      <View style={styles.archive}>
        <SectionHeader title={t('dailyVerse.archive')} />

        {archive === null ? (
          <View style={styles.state}>
            <SkeletonRows
              count={2}
              leading="none"
              label={t('common.loading')}
              testID="daily-verse-archive-loading"
            />
          </View>
        ) : archive === 'error' ? (
          <View style={styles.state}>
            <ErrorState
              testID="daily-verse-archive-error"
              message={t('dailyVerse.archiveError')}
              retryLabel={t('common.tryAgain')}
              onRetry={retry}
            />
          </View>
        ) : past.length === 0 ? (
          <View style={styles.state}>
            <EmptyState
              testID="daily-verse-archive-empty"
              title={t('dailyVerse.noPast')}
              message={t('dailyVerse.noPastMessage')}
            />
          </View>
        ) : (
          <View
            testID="daily-verse-archive-list"
            style={[styles.list, { borderTopColor: colors.border }]}
          >
            {past.map((verse) => (
              <View
                key={verse.id}
                testID={`daily-verse-archive-item-${verse.id}`}
                style={[styles.row, { borderBottomColor: colors.border }]}
              >
                <Text
                  style={[type.caption, { color: colors.inkSubtle, letterSpacing: 0.5 }]}
                >
                  {formatIsoDayMonth(verse.date, appLanguage)}
                </Text>
                {/* The church typed it, in either script or both: the serif
                    of its script, or the interface face when it mixes them. */}
                <Text
                  style={[
                    contentTextStyle(verse.text, {
                      size: 17,
                      line: 27,
                      teSize: 16,
                      teLine: 30,
                      fallback: appLanguage,
                    }),
                    { color: colors.ink },
                  ]}
                >
                  {verse.text}
                </Text>
                <Text style={[type.label, { color: colors.accent }]}>
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
  // The card's own 16 above its date, and this 8: the 24 the approved page has
  // between the top bar and the date.
  hero: { paddingTop: 8 },
  archive: { marginTop: 34 },
  state: { marginTop: 8 },
  list: { marginTop: 6, borderTopWidth: 1 },
  row: { paddingVertical: 16, borderBottomWidth: 1, gap: 6 },
});
