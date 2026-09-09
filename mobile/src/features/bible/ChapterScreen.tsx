import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { usePreferences } from '../../context/PreferencesContext';
import { useTheme } from '../../theme';
import { AppButton } from '../../theme/ui/AppButton';
import { Badge } from '../../theme/ui/Badge';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { getBookById } from './books';
import { loadChapter } from './dataSource';
import type { BibleChapter, BibleLanguage } from './types';

type Props = NativeStackScreenProps<RootStackParamList, 'BibleChapter'>;

/**
 * Chapter reader -- Day 8 requirement E. Book name/chapter number/verse
 * numbers/verse text/reference, Previous/Next navigation that correctly
 * handles the first/last chapter of a book, a placeholder-content banner
 * (shown only for still-placeholder Telugu content -- English now renders
 * real WEB text, see dataSource.ts), and
 * light/dark-mode-aware colors via the shared usePreferences().isDark
 * (Day 9 -- see ../../context/PreferencesContext.tsx; Day 8 originally
 * used useColorScheme() directly here, same as
 * ../daily-verses/DailyVerseCard.tsx).
 *
 * The language toggle (requirement F) lives here rather than on the
 * Books/Chapters screens, since it only affects chapter content. Day 8
 * persisted the choice locally only, via languagePreference.ts directly;
 * Day 9 routes it through usePreferences().setLanguagePreference()
 * instead, so the same choice also syncs to Firestore when signed in and
 * stays consistent with the language shown anywhere else preferences are
 * read (languagePreference.ts itself is unchanged and still does the
 * actual local-storage read/write, just now called from
 * PreferencesContext instead of from this screen).
 *
 * Restyled onto the shared Vespers theme as the app's most carefully
 * designed screen, per the approved prototype: hanging verse numbers in
 * the accent color, a sticky prev/next bar (the AppButton primitive,
 * whose own `disabled` prop already sets accessibilityState.disabled --
 * see ChapterScreen.test.tsx's disabled-state assertions), and the
 * placeholder-content banner promoted to the shared Badge primitive.
 * Every testID and the exact "Language: English/Telugu" text are
 * unchanged.
 */
type LoadResult = { key: string; chapter: BibleChapter | null };

export function ChapterScreen({ route, navigation }: Props) {
  const { bookId, chapterNumber } = route.params;
  const { languagePreference: language, setLanguagePreference } = usePreferences();
  const { colors, radii, spacing } = useTheme();
  const insets = useSafeAreaInsets();
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

  const book = getBookById(bookId);
  const chapter = result?.key === requestKey ? result.chapter : undefined;
  const hasError = errorKey === requestKey;

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
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          { borderBottomColor: colors.border, paddingTop: insets.top + 8 },
        ]}
      >
        <View style={styles.headerTop}>
          <Pressable
            testID="chapter-back-button"
            accessibilityRole="button"
            accessibilityLabel="Back"
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <View style={[styles.backChevron, { borderColor: colors.text }]} />
          </Pressable>
          <Text
            style={[styles.reference, { color: colors.text }]}
            testID="chapter-reference"
          >
            {`${book.name} ${chapterNumber}`}
          </Text>
          <Pressable
            testID="language-toggle-button"
            accessibilityRole="button"
            onPress={() => void handleToggleLanguage()}
            style={[
              styles.languagePill,
              { backgroundColor: colors.primaryTint, borderRadius: radii.control },
            ]}
          >
            <Text style={[styles.languagePillText, { color: colors.primary }]}>
              {`Language: ${language === 'te' ? 'Telugu' : 'English'}`}
            </Text>
          </Pressable>
        </View>
        {chapter?.isPlaceholder ? (
          <View testID="chapter-placeholder-banner">
            <Badge
              label="Development content — not a real Bible translation"
              variant="warning"
            />
          </View>
        ) : null}
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.container,
          { backgroundColor: colors.background, paddingBottom: 100 },
        ]}
        testID="chapter-screen"
      >
        {chapter === undefined && !hasError ? (
          <ActivityIndicator testID="chapter-loading" />
        ) : null}

        {hasError ? (
          <Text style={[styles.message, { color: colors.text }]} testID="chapter-error">
            Could not load this chapter.
          </Text>
        ) : null}

        {chapter === null && !hasError ? (
          <Text
            style={[styles.message, { color: colors.text }]}
            testID="chapter-not-found"
          >
            Chapter not found.
          </Text>
        ) : null}

        {chapter?.verses.map((verse) => (
          <View key={verse.number} style={styles.verseRow}>
            <Text style={[styles.verseNumber, { color: colors.accent }]}>
              {verse.number}
            </Text>
            <Text style={[styles.verseText, { color: colors.text }]}>{verse.text}</Text>
          </View>
        ))}
      </ScrollView>

      <View
        style={[
          styles.navRow,
          {
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
            padding: spacing.md,
            paddingBottom: Math.max(insets.bottom, spacing.md),
          },
        ]}
      >
        <AppButton
          title="Previous"
          variant="secondary"
          onPress={() =>
            navigation.navigate('BibleChapter', {
              bookId,
              chapterNumber: chapterNumber - 1,
            })
          }
          disabled={isFirstChapter}
          testID="previous-chapter-button"
        />
        <AppButton
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
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 14,
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  backButton: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  backChevron: {
    width: 10,
    height: 10,
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    transform: [{ rotate: '45deg' }],
  },
  reference: { fontSize: 20, fontWeight: '600' },
  languagePill: { paddingHorizontal: 12, paddingVertical: 7 },
  languagePillText: { fontSize: 12.5, fontWeight: '600' },
  container: { flexGrow: 1, padding: 20, gap: 16 },
  message: { textAlign: 'center' },
  verseRow: { flexDirection: 'row', gap: 10, alignItems: 'baseline' },
  verseNumber: { fontSize: 12.5, fontWeight: '600', minWidth: 18 },
  verseText: { flex: 1, fontSize: 19, lineHeight: 31 },
  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
