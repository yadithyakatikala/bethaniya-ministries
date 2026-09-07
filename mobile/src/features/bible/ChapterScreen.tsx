import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Button,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { getBookById } from './books';
import { loadChapter } from './dataSource';
import { getLanguagePreference, setLanguagePreference } from './languagePreference';
import type { BibleChapter, BibleLanguage } from './types';

type Props = NativeStackScreenProps<RootStackParamList, 'BibleChapter'>;

/**
 * Chapter reader -- Day 8 requirement E. Book name/chapter number/verse
 * numbers/verse text/reference, Previous/Next navigation that correctly
 * handles the first/last chapter of a book, a placeholder-content banner
 * (both languages are placeholder today -- see dataSource.ts), and
 * light/dark-mode-aware colors via the same `useColorScheme()` pattern
 * as ../daily-verses/DailyVerseCard.tsx (requirement I -- no new theme
 * system).
 *
 * The language toggle (requirement F) lives here rather than on the
 * Books/Chapters screens, since it only affects chapter content;
 * ChapterScreen loads the saved preference on mount (restoring it when
 * the module is reopened) and persists any change via
 * languagePreference.ts, local-only (no Firestore) per Day 8 scope.
 */
type LoadResult = { key: string; chapter: BibleChapter | null };

export function ChapterScreen({ route, navigation }: Props) {
  const { bookId, chapterNumber } = route.params;
  const [language, setLanguage] = useState<BibleLanguage>('en');
  // requestKey identifies "which request a result/error belongs to".
  // chapter/hasError are DERIVED below by comparing this key against the
  // most recent settled result, rather than reset with an imperative
  // setState() at the top of the load effect (React's
  // react-hooks/set-state-in-effect rule flags synchronous setState calls
  // in an effect body -- see https://react.dev/learn/you-might-not-need-an-effect
  // for why: it causes an extra render pass). A stale/pending key
  // naturally reads as "loading" without ever needing to reset anything.
  const requestKey = `${bookId}:${chapterNumber}:${language}`;
  const [result, setResult] = useState<LoadResult | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const isDark = useColorScheme() === 'dark';
  const colors = isDark ? darkColors : lightColors;

  const book = getBookById(bookId);
  const chapter = result?.key === requestKey ? result.chapter : undefined;
  const hasError = errorKey === requestKey;

  useEffect(() => {
    let cancelled = false;
    void getLanguagePreference().then((saved) => {
      if (!cancelled) setLanguage(saved);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadChapter(bookId, chapterNumber, language)
      .then((loaded) => {
        if (!cancelled) setResult({ key: requestKey, chapter: loaded });
      })
      .catch(() => {
        if (!cancelled) setErrorKey(requestKey);
      });
    return () => {
      cancelled = true;
    };
  }, [bookId, chapterNumber, language, requestKey]);

  async function handleToggleLanguage() {
    const next: BibleLanguage = language === 'en' ? 'te' : 'en';
    await setLanguagePreference(next);
    setLanguage(next);
  }

  if (!book) {
    return (
      <View
        style={[styles.container, { backgroundColor: colors.background }]}
        testID="chapter-invalid-book"
      >
        <Text style={[styles.message, { color: colors.text }]}>Book not found.</Text>
      </View>
    );
  }

  const isFirstChapter = chapterNumber <= 1;
  const isLastChapter = chapterNumber >= book.chapterCount;

  return (
    <ScrollView
      contentContainerStyle={[styles.container, { backgroundColor: colors.background }]}
      testID="chapter-screen"
    >
      <View style={styles.languageRow}>
        <Text style={[styles.languageLabel, { color: colors.secondaryText }]}>
          {`Language: ${language === 'te' ? 'Telugu' : 'English'}`}
        </Text>
        <Button
          title="Switch Language"
          onPress={() => void handleToggleLanguage()}
          testID="language-toggle-button"
        />
      </View>

      <Text style={[styles.reference, { color: colors.text }]} testID="chapter-reference">
        {`${book.name} ${chapterNumber}`}
      </Text>

      {chapter?.isPlaceholder ? (
        <View style={styles.banner} testID="chapter-placeholder-banner">
          <Text style={styles.bannerText}>
            Development content — not a real Bible translation
          </Text>
        </View>
      ) : null}

      {chapter === undefined && !hasError ? (
        <ActivityIndicator testID="chapter-loading" />
      ) : null}

      {hasError ? (
        <Text style={[styles.message, { color: colors.text }]} testID="chapter-error">
          Could not load this chapter.
        </Text>
      ) : null}

      {chapter === null && !hasError ? (
        <Text style={[styles.message, { color: colors.text }]} testID="chapter-not-found">
          Chapter not found.
        </Text>
      ) : null}

      {chapter?.verses.map((verse) => (
        <View key={verse.number} style={styles.verseRow}>
          <Text style={[styles.verseNumber, { color: colors.secondaryText }]}>
            {verse.number}
          </Text>
          <Text style={[styles.verseText, { color: colors.text }]}>{verse.text}</Text>
        </View>
      ))}

      <View style={styles.navRow}>
        <Button
          title="Previous"
          onPress={() =>
            navigation.navigate('BibleChapter', {
              bookId,
              chapterNumber: chapterNumber - 1,
            })
          }
          disabled={isFirstChapter}
          testID="previous-chapter-button"
        />
        <Button
          title="Next"
          onPress={() =>
            navigation.navigate('BibleChapter', {
              bookId,
              chapterNumber: chapterNumber + 1,
            })
          }
          disabled={isLastChapter}
          testID="next-chapter-button"
        />
      </View>
    </ScrollView>
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
  container: { flexGrow: 1, padding: 16, gap: 12 },
  message: { textAlign: 'center' },
  languageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  languageLabel: { fontSize: 13 },
  reference: { fontSize: 20, fontWeight: '700' },
  banner: { backgroundColor: '#FEF3C7', padding: 12, borderRadius: 8 },
  bannerText: { color: '#92400E', fontWeight: '600', textAlign: 'center' },
  verseRow: { flexDirection: 'row', gap: 8 },
  verseNumber: { fontSize: 13, fontWeight: '600', minWidth: 20 },
  verseText: { flex: 1, fontSize: 16, lineHeight: 22 },
  navRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 12 },
});
