import {
  Button,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { usePreferences } from '../../context/PreferencesContext';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { NEW_TESTAMENT_BOOKS, OLD_TESTAMENT_BOOKS } from './books';
import type { BibleBook } from './types';

type Props = NativeStackScreenProps<RootStackParamList, 'BibleBooks'>;

const SECTIONS: { title: string; data: BibleBook[] }[] = [
  { title: 'Old Testament', data: OLD_TESTAMENT_BOOKS },
  { title: 'New Testament', data: NEW_TESTAMENT_BOOKS },
];

/**
 * All 66 books, Old/New Testament clearly separated -- Day 8 requirement
 * C. Tapping a book navigates to BibleChapters. A plain ScrollView (not
 * a virtualized list) is used deliberately: the book list is a small,
 * fixed 66-item set (unlike Songs/Events, which are unbounded real-time
 * Firestore data), so there's no windowing/performance reason to
 * virtualize it, and it keeps every book reliably present for tests and
 * for fast scrolling alike.
 */
export function BooksListScreen({ navigation }: Props) {
  const { isDark } = usePreferences();
  const colors = isDark ? darkColors : lightColors;

  return (
    <ScrollView
      testID="bible-books-list"
      style={[styles.list, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.listContent}
    >
      <View style={styles.searchRow}>
        <Button
          title="Search"
          onPress={() => navigation.navigate('BibleSearch')}
          testID="bible-search-nav-button"
        />
      </View>
      {SECTIONS.map((section) => (
        <View key={section.title}>
          <View
            style={[styles.sectionHeader, { backgroundColor: colors.sectionHeaderBg }]}
            testID={`bible-section-${section.title}`}
          >
            <Text style={[styles.sectionHeaderText, { color: colors.text }]}>
              {section.title}
            </Text>
          </View>
          {section.data.map((book) => (
            <TouchableOpacity
              key={book.id}
              style={[styles.item, { borderColor: colors.border }]}
              testID={`book-${book.id}`}
              onPress={() => navigation.navigate('BibleChapters', { bookId: book.id })}
            >
              <Text style={[styles.bookName, { color: colors.text }]}>{book.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

const lightColors = {
  background: '#F9FAFB',
  text: '#111827',
  border: '#E5E7EB',
  sectionHeaderBg: '#E5E7EB',
};

const darkColors = {
  background: '#1F2937',
  text: '#F9FAFB',
  border: '#374151',
  sectionHeaderBg: '#111827',
};

const styles = StyleSheet.create({
  list: { flex: 1 },
  listContent: { paddingBottom: 24 },
  searchRow: { padding: 16 },
  sectionHeader: { paddingHorizontal: 16, paddingVertical: 8 },
  sectionHeaderText: { fontWeight: '700', fontSize: 14 },
  item: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  bookName: { fontSize: 15 },
});
