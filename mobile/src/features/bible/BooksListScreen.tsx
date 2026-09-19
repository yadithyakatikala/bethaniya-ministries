import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../theme';
import { usePreferences } from '../../context/PreferencesContext';
import { Tappable } from '../../theme/ui/Tappable';
import { useTranslation } from '../../i18n';
import type { StringKey } from '../../i18n';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { NEW_TESTAMENT_BOOKS, OLD_TESTAMENT_BOOKS, getBookName } from './books';
import { ContinueReading } from './reader/ContinueReading';
import { bookNameLanguageFor, type BibleBook } from './types';

type Props = NativeStackScreenProps<RootStackParamList, 'BibleBooks'>;

/**
 * `id` is a stable, NEVER-LOCALIZED key: it is what the section's testID
 * is built from, so the testID cannot shift when the language does.
 * `titleKey` is what the user actually reads.
 */
const SECTIONS: { id: string; titleKey: StringKey; data: BibleBook[] }[] = [
  { id: 'Old Testament', titleKey: 'bible.oldTestament', data: OLD_TESTAMENT_BOOKS },
  { id: 'New Testament', titleKey: 'bible.newTestament', data: NEW_TESTAMENT_BOOKS },
];

/**
 * All 66 books, Old/New Testament clearly separated -- Day 8 requirement
 * C. Tapping a book navigates to BibleChapters. A plain ScrollView (not
 * a virtualized list) is used deliberately: the book list is a small,
 * fixed 66-item set (unlike Songs/Events, which are unbounded real-time
 * Firestore data), so there's no windowing/performance reason to
 * virtualize it, and it keeps every book reliably present for tests and
 * for fast scrolling alike.
 *
 * Restyled onto the shared Vespers theme -- the search entry point is
 * now a prominent, search-field-styled bar (the UI audit's "Bible search
 * sits behind a small 'Search' button" finding) rather than a bare
 * platform Button, still navigating to the same BibleSearch screen.
 * Every testID is unchanged.
 */
export function BooksListScreen({ navigation }: Props) {
  const { colors, radii, type } = useTheme();
  const { t } = useTranslation();
  // Book names label scripture, so they follow the BIBLE preference --
  // not the interface language. See bookNameLanguageFor().
  const { appLanguage, bibleMode } = usePreferences();
  const bookNameLanguage = bookNameLanguageFor(bibleMode, appLanguage);

  return (
    <ScrollView
      testID="bible-books-list"
      style={[styles.list, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.listContent}
    >
      <View style={styles.searchRow}>
        {/* M4: the saved reading position, OFFERED here rather than
            imposed by the reader -- see ./reader/ContinueReading.tsx.
            Renders nothing until the member has read something. */}
        <ContinueReading
          onOpen={(bookId, chapterNumber, verse) =>
            navigation.navigate('BibleChapter', { bookId, chapterNumber, verse })
          }
        />
        <Tappable
          testID="bible-search-nav-button"
          accessibilityRole="button"
          onPress={() => navigation.navigate('BibleSearch')}
          style={[
            styles.searchField,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderRadius: radii.control,
            },
          ]}
        >
          <View style={[styles.searchIcon, { borderColor: colors.secondaryText }]} />
          <Text style={[type.body, { color: colors.secondaryText }]}>
            {t('bible.searchPlaceholder')}
          </Text>
        </Tappable>
      </View>
      {SECTIONS.map((section) => (
        <View key={section.id}>
          <View
            style={[styles.sectionHeader, { backgroundColor: colors.primaryTint }]}
            testID={`bible-section-${section.id}`}
          >
            <Text style={[type.overline, { color: colors.primaryPressed }]}>
              {t(section.titleKey)}
            </Text>
          </View>
          {section.data.map((book) => (
            <TouchableOpacity
              key={book.id}
              style={[styles.item, { borderColor: colors.border }]}
              testID={`book-${book.id}`}
              onPress={() => navigation.navigate('BibleChapters', { bookId: book.id })}
            >
              {/* getBookName(), not book.name: reading the English field
                  directly is what made this screen list 66 English book
                  names while the Telugu Bible was selected and Telugu
                  verse text rendered underneath. */}
              <Text style={[type.bodyLarge, { color: colors.text }]}>
                {getBookName(book, bookNameLanguage)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  list: { flex: 1 },
  listContent: { paddingBottom: 24 },
  searchRow: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 16, gap: 12 },
  searchField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 46,
    paddingHorizontal: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  searchIcon: { width: 13, height: 13, borderRadius: 7, borderWidth: 1.6 },
  sectionHeader: { paddingHorizontal: 20, paddingVertical: 8 },
  item: {
    paddingHorizontal: 20,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
