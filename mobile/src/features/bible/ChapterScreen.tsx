import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { usePreferences } from '../../context/PreferencesContext';
import { useTheme, type ThemeColors } from '../../theme';
import { useTranslation, type StringKey } from '../../i18n';
import { Tappable } from '../../theme/ui/Tappable';
import { AppButton } from '../../theme/ui/AppButton';
import { Badge } from '../../theme/ui/Badge';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { getBookById, getBookName } from './books';
import { getBilingualChapter, loadChapter } from './dataSource';
import type { BilingualPresentation } from './alignment';
import { primaryBibleLanguage } from '../../context/languagePreferences';
import { bookNameLanguageFor, type BibleChapter, type BibleMode } from './types';

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
 *
 * M2 made the Bible preference independent of the interface language and
 * added a third mode. This screen therefore reads
 * `usePreferences().bibleMode`, NOT the app language: a member reading a
 * Telugu Bible through an English interface is the product requirement.
 * In 'bilingual' mode the verses come from getBilingualChapter(), which
 * routes through the M1 alignment policy -- so a chapter whose two
 * traditions divide the text differently is shown as two separate
 * columns with a notice, never as mis-paired rows. The mode pill, which
 * used to read a hardcoded English "Language: Telugu", now cycles the
 * three modes with a translated label.
 */
type LoadResult = { key: string; chapter: BibleChapter | null };

export function ChapterScreen({ route, navigation }: Props) {
  const { bookId, chapterNumber } = route.params;
  const { appLanguage, bibleMode, setBibleMode } = usePreferences();
  // Which single translation to load when not pairing. Book names and
  // labels follow bookNameLanguageFor() -- see types.ts.
  const language = primaryBibleLanguage(bibleMode);
  const bookNameLanguage = bookNameLanguageFor(bibleMode, appLanguage);
  const { colors, radii, spacing } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  // requestKey identifies "which request a result/error belongs to".
  // chapter/hasError are DERIVED below by comparing this key against the
  // most recent settled result, rather than reset with an imperative
  // setState() at the top of the load effect (React's
  // react-hooks/set-state-in-effect rule flags synchronous setState calls
  // in an effect body -- see https://react.dev/learn/you-might-not-need-an-effect
  // for why: it causes an extra render pass). A stale/pending key
  // naturally reads as "loading" without ever needing to reset anything.
  const requestKey = `${bookId}:${chapterNumber}:${bibleMode}`;
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

  /**
   * The paired view. Synchronous and cheap (both datasets are bundled),
   * so it needs no loading state of its own -- it is derived, not
   * fetched, and only computed when the reader is actually in bilingual
   * mode.
   */
  const bilingual = useMemo(
    () => (bibleMode === 'bilingual' ? getBilingualChapter(bookId, chapterNumber) : null),
    [bibleMode, bookId, chapterNumber]
  );

  /** Cycles Telugu -> English -> bilingual. Settings has the explicit pickers. */
  async function handleCycleMode() {
    const order: BibleMode[] = ['te', 'en', 'bilingual'];
    const next = order[(order.indexOf(bibleMode) + 1) % order.length];
    await setBibleMode(next);
  }

  if (!book) {
    return (
      <View
        style={[styles.container, { backgroundColor: colors.background }]}
        testID="chapter-invalid-book"
      >
        <Text style={[styles.message, { color: colors.text }]}>
          {t('bible.bookNotFound')}
        </Text>
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
          <Tappable
            testID="chapter-back-button"
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <View style={[styles.backChevron, { borderColor: colors.text }]} />
          </Tappable>
          <Text
            style={[styles.reference, { color: colors.text }]}
            numberOfLines={2}
            testID="chapter-reference"
          >
            {`${getBookName(book, bookNameLanguage)} ${chapterNumber}`}
          </Text>
          <Tappable
            testID="language-toggle-button"
            accessibilityRole="button"
            accessibilityLabel={t('bible.switchLanguage')}
            onPress={() => void handleCycleMode()}
            style={[
              styles.languagePill,
              { backgroundColor: colors.primaryTint, borderRadius: radii.control },
            ]}
          >
            <Text style={[styles.languagePillText, { color: colors.primary }]}>
              {t(
                bibleMode === 'bilingual'
                  ? 'bible.modeBilingual'
                  : bibleMode === 'te'
                    ? 'bible.modeTelugu'
                    : 'bible.modeEnglish'
              )}
            </Text>
          </Tappable>
        </View>
        {/* V1 showed a "development content" badge above GENERATED verse
            text for the chapters its Telugu data lacked. Nothing is
            generated any more, so this now reports an honest absence --
            see dataSource.ts. Bilingual mode is excluded because the
            paired body carries its own notice for the same fact, beside
            the English text that IS available. */}
        {bibleMode !== 'bilingual' && chapter?.unavailableInTranslation ? (
          <View testID="chapter-unavailable-banner">
            <Badge label={t('bible.notInTranslation')} variant="warning" />
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
            {t('bible.chapterLoadError')}
          </Text>
        ) : null}

        {chapter === null && !hasError ? (
          <Text
            style={[styles.message, { color: colors.text }]}
            testID="chapter-not-found"
          >
            {t('bible.chapterNotFound')}
          </Text>
        ) : null}

        {/* --- Bilingual: paired only where the M1 policy allows it ---- */}
        {bibleMode === 'bilingual' && bilingual ? (
          <BilingualChapterBody
            presentation={bilingual.presentation}
            colors={colors}
            t={t}
          />
        ) : null}

        {/* An empty chapter would otherwise render as a blank page. The
            badge in the header already states the fact, so this says what
            the reader can DO about it rather than repeating the sentence
            verbatim a few points lower. */}
        {bibleMode !== 'bilingual' && chapter?.unavailableInTranslation ? (
          <Text
            style={[styles.message, { color: colors.secondaryText }]}
            testID="chapter-unavailable-message"
          >
            {t('bible.notInTranslationHelp')}
          </Text>
        ) : null}

        {bibleMode !== 'bilingual' &&
          chapter?.verses.map((verse) => (
            <View key={verse.number} style={styles.verseRow}>
              {/* "39-40" for a merged range, so no verse number silently
                  disappears the way it did in V1. */}
              <Text style={[styles.verseNumber, { color: colors.accent }]}>
                {verse.endNumber ? `${verse.number}-${verse.endNumber}` : verse.number}
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
          title={t('bible.previous')}
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
          title={t('bible.next')}
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
  // flex + two lines because Telugu book names are long: "1 Chronicles"
  // is "దినవృత్తాంతములు మొదటి గ్రంథము", 29 characters against 12, and the
  // mode pill beside it reads "ఇంగ్లీష్ + తెలుగు" in bilingual mode. Without
  // this the heading pushed the pill off the row.
  reference: { flex: 1, fontSize: 20, fontWeight: '600' },
  // The pill names the translation being read -- it must never be the
  // thing that gets squeezed.
  languagePill: { flexShrink: 0, paddingHorizontal: 12, paddingVertical: 7 },
  languagePillText: { fontSize: 12.5, fontWeight: '600' },
  container: { flexGrow: 1, padding: 20, gap: 16 },
  message: { textAlign: 'center' },
  verseRow: { flexDirection: 'row', gap: 10, alignItems: 'baseline' },
  // 34, not 18: a merged range prints as "39-40" and must not
  // shove the verse text out of alignment with its neighbours.
  verseNumber: { fontSize: 12.5, fontWeight: '600', minWidth: 34 },
  verseText: { flex: 1, fontSize: 19, lineHeight: 31 },
  // Bilingual: the two translations stack under one shared verse number,
  // the second slightly smaller so the pair reads as one unit rather than
  // two competing paragraphs.
  bilingualList: { gap: 16 },
  bilingualRow: { flexDirection: 'row', gap: 10, alignItems: 'baseline' },
  bilingualTexts: { flex: 1, gap: 4 },
  verseTextSecondary: { fontSize: 17.5, lineHeight: 29 },
  bilingualDivider: { height: StyleSheet.hairlineWidth, marginVertical: 8 },
  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});

/**
 * The bilingual body.
 *
 * Renders whichever of the three presentations the M1 alignment policy
 * returned, and nothing else -- it has no opinion about pairing, which is
 * the whole point. See ./alignment.ts.
 *
 *   paired         English above Telugu per verse, sharing one number.
 *   chapterLevel   The two traditions divide this chapter's text
 *                  differently, so the sides are shown one after the
 *                  other with their own numbering and a visible notice.
 *                  Forcing them into rows would mis-pair scripture.
 *   englishOnly    Telugu has no text for this chapter (Malachi 4).
 */
function BilingualChapterBody({
  presentation,
  colors,
  t,
}: {
  presentation: BilingualPresentation;
  colors: ThemeColors;
  t: (key: StringKey, vars?: Record<string, string | number>) => string;
}) {
  if (presentation.kind === 'paired') {
    return (
      <View style={styles.bilingualList} testID="bilingual-paired">
        {presentation.rows.map((row) => (
          <View key={row.start} style={styles.bilingualRow}>
            <Text style={[styles.verseNumber, { color: colors.accent }]}>{row.label}</Text>
            <View style={styles.bilingualTexts}>
              <Text style={[styles.verseText, { color: colors.text }]}>{row.english}</Text>
              <Text style={[styles.verseTextSecondary, { color: colors.text }]}>
                {row.telugu}
              </Text>
            </View>
          </View>
        ))}
      </View>
    );
  }

  if (presentation.kind === 'englishOnly') {
    return (
      <View style={styles.bilingualList} testID="bilingual-english-only">
        <Badge label={t('bible.notInTranslation')} variant="warning" />
        {presentation.english.map((verse) => (
          <View key={verse.number} style={styles.verseRow}>
            <Text style={[styles.verseNumber, { color: colors.accent }]}>
              {verse.number}
            </Text>
            <Text style={[styles.verseText, { color: colors.text }]}>{verse.text}</Text>
          </View>
        ))}
      </View>
    );
  }

  return (
    <View style={styles.bilingualList} testID="bilingual-chapter-level">
      <Badge label={t('bible.numberingDiffers')} variant="warning" />
      {presentation.english.map((verse) => (
        <View key={`en-${verse.number}`} style={styles.verseRow}>
          <Text style={[styles.verseNumber, { color: colors.accent }]}>
            {verse.number}
          </Text>
          <Text style={[styles.verseText, { color: colors.text }]}>{verse.text}</Text>
        </View>
      ))}
      <View style={[styles.bilingualDivider, { backgroundColor: colors.border }]} />
      {presentation.telugu.map((span) => (
        <View key={`te-${span.start}`} style={styles.verseRow}>
          <Text style={[styles.verseNumber, { color: colors.accent }]}>
            {span.end > span.start ? `${span.start}-${span.end}` : span.start}
          </Text>
          <Text style={[styles.verseText, { color: colors.text }]}>{span.text}</Text>
        </View>
      ))}
    </View>
  );
}
