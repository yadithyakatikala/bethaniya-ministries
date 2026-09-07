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
  const { languagePreference, isDark } = usePreferences();
  const colors = isDark ? darkColors : lightColors;
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
        <Text style={styles.highlight}>{match}</Text>
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
        style={[styles.input, { color: colors.text, borderColor: colors.border }]}
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
              style={[styles.resultItem, { borderColor: colors.border }]}
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

const lightColors = {
  background: '#F9FAFB',
  text: '#111827',
  secondaryText: '#6B7280',
  border: '#E5E7EB',
};

const darkColors = {
  background: '#1F2937',
  text: '#F9FAFB',
  secondaryText: '#9CA3AF',
  border: '#374151',
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 12 },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
  },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 32 },
  message: { textAlign: 'center', fontSize: 14 },
  resultsContent: { gap: 8, paddingBottom: 24 },
  resultItem: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    padding: 12,
    gap: 4,
  },
  highlight: { backgroundColor: '#FEF08A', fontWeight: '700' },
});
