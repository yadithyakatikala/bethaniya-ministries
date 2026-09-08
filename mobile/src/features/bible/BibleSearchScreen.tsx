import { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { usePreferences } from '../../context/PreferencesContext';
import { useTheme } from '../../theme';
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
 */
export function BibleSearchScreen({ navigation }: Props) {
  const { languagePreference } = usePreferences();
  const { colors, radii, spacing } = useTheme();
  const [query, setQuery] = useState('');

  const trimmedQuery = query.trim();
  const results: BibleSearchResult[] =
    trimmedQuery.length > 0 ? searchBible(query, languagePreference) : [];

  function renderHighlightedText(result: BibleSearchResult, field: 'text' | 'reference') {
    const value = field === 'text' ? result.text : result.reference;
    if (result.matchSource !== field || result.matchStart < 0) {
      return <Text style={{ color: colors.text }}>{value}</Text>;
    }
    const before = value.slice(0, result.matchStart);
    const match = value.slice(result.matchStart, result.matchStart + result.matchLength);
    const after = value.slice(result.matchStart + result.matchLength);
    return (
      <Text style={{ color: colors.text }}>
        {before}
        <Text
          style={[
            styles.highlight,
            { backgroundColor: colors.primaryTint, color: colors.text },
          ]}
        >
          {match}
        </Text>
        {after}
      </Text>
    );
  }

  return (
    <View
      style={[styles.container, { backgroundColor: colors.background }]}
      testID="bible-search-screen"
    >
      <TextInput
        style={[
          styles.input,
          {
            color: colors.text,
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderRadius: radii.control,
          },
        ]}
        value={query}
        onChangeText={setQuery}
        placeholder="Search the Bible"
        placeholderTextColor={colors.secondaryText}
        testID="bible-search-input"
        autoFocus
      />

      {trimmedQuery.length === 0 ? (
        <View style={styles.centered} testID="bible-search-empty-query">
          <Text style={[styles.message, { color: colors.secondaryText }]}>
            Enter a search term to find a passage.
          </Text>
        </View>
      ) : results.length === 0 ? (
        <View style={styles.centered} testID="bible-search-no-results">
          <Text style={[styles.message, { color: colors.secondaryText }]}>
            No results found for &quot;{trimmedQuery}&quot;.
          </Text>
        </View>
      ) : (
        <ScrollView
          testID="bible-search-results"
          contentContainerStyle={styles.resultsContent}
        >
          {results.map((result) => (
            <TouchableOpacity
              key={`${result.bookId}-${result.chapterNumber}-${result.verseNumber}`}
              style={[
                styles.resultItem,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  borderRadius: radii.card,
                  padding: spacing.md,
                },
              ]}
              testID={`search-result-${result.bookId}-${result.chapterNumber}-${result.verseNumber}`}
              onPress={() =>
                navigation.navigate('BibleChapter', {
                  bookId: result.bookId,
                  chapterNumber: result.chapterNumber,
                })
              }
            >
              <View testID="search-result-reference">
                {renderHighlightedText(result, 'reference')}
              </View>
              <View testID="search-result-text">
                {renderHighlightedText(result, 'text')}
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, gap: 14 },
  input: {
    height: 46,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    fontSize: 15,
  },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 32 },
  message: { textAlign: 'center', fontSize: 14 },
  resultsContent: { gap: 10, paddingBottom: 24 },
  resultItem: {
    borderWidth: StyleSheet.hairlineWidth,
    gap: 4,
  },
  highlight: { fontWeight: '700', borderRadius: 3 },
});
