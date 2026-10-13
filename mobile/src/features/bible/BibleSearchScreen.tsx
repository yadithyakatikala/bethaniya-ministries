import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { usePreferences } from '../../context/PreferencesContext';
import { primaryBibleLanguage } from '../../context/languagePreferences';
import { Icon, IconButton, Tappable, useTheme } from '../../theme';
import { fontFamilies } from '../../theme/tokens';
import { useTranslation } from '../../i18n';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { type BibleSearchResult, searchBible } from './search';

type Props = NativeStackScreenProps<RootStackParamList, 'BibleSearch'>;

/**
 * Bible Search screen -- Day 9 decision 9: search input, local search,
 * partial matching, case-insensitive matching, result reference,
 * matching text, highlighted matching text, empty query state,
 * no-results state, navigation from result to the relevant Bible
 * chapter. All of the actual matching lives in ./search.ts (Option A per
 * decision 1); this screen is presentation + navigation only.
 *
 * Search runs on every keystroke rather than being debounced or
 * submit-only: searchBible() is a synchronous, in-memory scan (no
 * network, no dependency -- see search.ts's doc comment) over a bounded
 * dataset (1189 chapters), so there's no real cost to searching live,
 * and it matches how every other list in this app (Songs/Events/Bible
 * books) already behaves -- immediate, not gated behind a button.
 *
 * THE LOOK. A row at the top: a round Back, then the search field -- 48 high,
 * a strong 1.5 border, a magnifier, the words, and a clear button once there are
 * some. Under it "42 results" (muted), then one hairline row per hit: the
 * reference in gold small text, and the verse's words (two lines at most) with the
 * matched words in bold. Before anything is typed the prompt is one quiet line,
 * and a search with no hits says so, with what was searched for.
 */
export function BibleSearchScreen({ navigation }: Props) {
  const { bibleMode, appLanguage } = usePreferences();
  // Search reads ONE translation. In bilingual mode that is the primary
  // Bible (Telugu) -- searching both and merging results is a separate
  // feature, not something to fake here.
  const searchLanguage = primaryBibleLanguage(bibleMode);
  const { colors, layout, radii, type } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const telugu = appLanguage === 'te' || searchLanguage === 'te';

  const trimmedQuery = query.trim();
  const results: BibleSearchResult[] =
    trimmedQuery.length > 0 ? searchBible(query, searchLanguage) : [];

  /** A reference or a verse with the matched words in bold (no wash: the page stays plain). */
  function renderHighlightedText(result: BibleSearchResult, field: 'text' | 'reference') {
    const value = field === 'text' ? result.text : result.reference;
    if (result.matchSource !== field || result.matchStart < 0) return value;
    const before = value.slice(0, result.matchStart);
    const match = value.slice(result.matchStart, result.matchStart + result.matchLength);
    const after = value.slice(result.matchStart + result.matchLength);
    return (
      <>
        {before}
        <Text style={styles.match}>{match}</Text>
        {after}
      </>
    );
  }

  return (
    <View
      style={[
        styles.screen,
        {
          backgroundColor: colors.paper,
          paddingTop: insets.top,
          paddingHorizontal: layout.screenMargin,
        },
      ]}
      testID="bible-search-screen"
    >
      <View style={styles.top}>
        <IconButton
          testID="bible-search-back"
          accessibilityLabel={t('common.back')}
          onPress={() => navigation.goBack()}
        >
          <Icon name="back" size={24} />
        </IconButton>
        <View
          style={[
            styles.field,
            {
              backgroundColor: colors.surface,
              borderColor: colors.borderStrong,
              borderRadius: radii.control,
            },
          ]}
        >
          <Icon name="search" size={20} color={colors.inkMuted} />
          <TextInput
            style={[styles.input, { color: colors.ink }]}
            value={query}
            onChangeText={setQuery}
            placeholder={t('bible.searchPlaceholder')}
            placeholderTextColor={colors.inkSubtle}
            accessibilityLabel={t('bible.searchPlaceholder')}
            testID="bible-search-input"
            returnKeyType="search"
            autoFocus
          />
          {query.length > 0 ? (
            <Tappable
              testID="bible-search-clear"
              accessibilityRole="button"
              accessibilityLabel={t('common.close')}
              onPress={() => setQuery('')}
              style={styles.clear}
            >
              <Icon name="close" size={18} color={colors.inkMuted} />
            </Tappable>
          ) : null}
        </View>
      </View>

      {trimmedQuery.length === 0 ? (
        <Text
          testID="bible-search-empty-query"
          style={[type.body, styles.message, { color: colors.inkMuted }]}
        >
          {t('bible.searchPrompt')}
        </Text>
      ) : results.length === 0 ? (
        <Text
          testID="bible-search-no-results"
          accessibilityLiveRegion="polite"
          style={[type.body, styles.message, { color: colors.inkMuted }]}
        >
          {t('bible.noResults', { query: trimmedQuery })}
        </Text>
      ) : (
        <ScrollView
          testID="bible-search-results"
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          // The search field keeps focus while results are showing, so
          // without this the first tap on a result is consumed dismissing
          // the keyboard -- see SignInScreen.tsx.
          keyboardShouldPersistTaps="handled"
        >
          <Text
            testID="bible-search-count"
            accessibilityLiveRegion="polite"
            style={[type.bodySmall, styles.count, { color: colors.inkMuted }]}
          >
            {t('bible.resultsCount', { n: results.length })}
          </Text>
          {results.map((result) => (
            <Tappable
              key={`${result.bookId}-${result.chapterNumber}-${result.verseNumber}`}
              testID={`search-result-${result.bookId}-${result.chapterNumber}-${result.verseNumber}`}
              accessibilityRole="button"
              accessibilityLabel={`${result.reference}. ${result.text}`}
              style={[styles.hit, { borderBottomColor: colors.border }]}
              onPress={() =>
                navigation.navigate('BibleChapter', {
                  bookId: result.bookId,
                  chapterNumber: result.chapterNumber,
                  // M4: the reader opens AT the matched verse rather than
                  // at the top of the chapter, so a result for Psalm
                  // 119:105 does not land the reader 104 verses away
                  // from what they searched for.
                  verse: result.verseNumber,
                })
              }
            >
              <Text
                testID="search-result-reference"
                style={[type.scriptureReference, { color: colors.accent }]}
              >
                {renderHighlightedText(result, 'reference')}
              </Text>
              <Text
                testID="search-result-text"
                numberOfLines={2}
                style={[
                  styles.hitText,
                  telugu && styles.hitTextTe,
                  { color: colors.ink },
                ]}
              >
                {renderHighlightedText(result, 'text')}
              </Text>
            </Tappable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  // The Back's glyph lines up with the margin, not its 44-point target.
  top: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: -10,
  },
  field: {
    flex: 1,
    minWidth: 0,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 14,
    paddingRight: 6,
    borderWidth: 1.5,
  },
  input: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 8,
    fontFamily: fontFamilies.interfaceRegular,
    fontSize: 15.5,
    lineHeight: 23,
  },
  clear: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  message: { marginTop: 20 },
  count: { marginTop: 6, marginBottom: 4 },
  hit: { paddingVertical: 14, gap: 3, borderBottomWidth: 1 },
  hitText: { fontFamily: fontFamilies.interfaceRegular, fontSize: 15.5, lineHeight: 23 },
  hitTextTe: { lineHeight: 27 },
  match: { fontFamily: fontFamilies.interfaceBold, fontWeight: '700' },
});
