import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../theme';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { getBookById } from './books';

type Props = NativeStackScreenProps<RootStackParamList, 'BibleChapters'>;

/**
 * Chapter numbers for the selected book -- Day 8 requirement D. Tapping
 * a chapter navigates to BibleChapter. A plain ScrollView with a wrapped
 * row of buttons is used for the same reason as BooksListScreen.tsx: a
 * fixed, bounded, at-most-150-item local list, not real-time data, so
 * virtualization buys nothing and only risks windowing chapters out of
 * both the UI and tests.
 *
 * Restyled onto the shared Vespers theme -- themed surface cells at the
 * 44px touch minimum. Every testID is unchanged.
 */
export function ChaptersListScreen({ route, navigation }: Props) {
  const { bookId } = route.params;
  const { colors, radii } = useTheme();
  const book = getBookById(bookId);

  if (!book) {
    return (
      <View
        style={[styles.container, { backgroundColor: colors.background }]}
        testID="chapters-invalid-book"
      >
        <Text style={[styles.message, { color: colors.text }]}>Book not found.</Text>
      </View>
    );
  }

  const chapterNumbers = Array.from(
    { length: book.chapterCount },
    (_, index) => index + 1
  );

  return (
    <ScrollView
      testID="bible-chapters-list"
      style={[styles.list, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.grid}
    >
      {chapterNumbers.map((chapterNumber) => (
        <TouchableOpacity
          key={chapterNumber}
          style={[
            styles.chapterItem,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderRadius: radii.control,
            },
          ]}
          testID={`chapter-${chapterNumber}`}
          onPress={() =>
            navigation.navigate('BibleChapter', { bookId: book.id, chapterNumber })
          }
        >
          <Text style={{ color: colors.text, fontWeight: '600', fontSize: 15 }}>
            {chapterNumber}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  message: { textAlign: 'center' },
  list: { flex: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', padding: 16, gap: 8 },
  chapterItem: {
    width: 56,
    height: 48,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
