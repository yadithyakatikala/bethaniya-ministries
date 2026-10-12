import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Tappable, useTheme } from '../../theme';
import { fontFamilies } from '../../theme/tokens';
import { usePreferences } from '../../context/PreferencesContext';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { TopBar } from '../common/TopBar';
import { getBookById, getBookName } from './books';
import { bookNameLanguageFor } from './types';
import { useTranslation } from '../../i18n';

type Props = NativeStackScreenProps<RootStackParamList, 'BibleChapters'>;

/** Five tiles to a row, whatever the phone: the grid is centred, not stretched. */
const COLUMNS = 5;

/**
 * The chapters of one book as a grid of numbers -- a top bar with Back and the
 * book's name (in the BIBLE's language, like every book name: it labels
 * scripture), "21 chapters" under it, then a tile for each chapter, five to a
 * row, each opening the reader there. A tile is a pill 56 across and 48 high,
 * with the number in the middle, and is announced as "Chapter 3".
 *
 * A book id the app does not have is said so, in words, under the same top bar.
 */
export function ChaptersListScreen({ route, navigation }: Props) {
  const { bookId } = route.params;
  const { colors, layout, type } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { appLanguage, bibleMode } = usePreferences();
  const book = getBookById(bookId);
  const pad = { paddingHorizontal: layout.screenMargin };
  const bar = (title?: string) => (
    <View style={pad}>
      <TopBar title={title} onBack={() => navigation.goBack()} />
    </View>
  );

  if (!book) {
    return (
      <View
        style={[styles.screen, { backgroundColor: colors.paper, paddingTop: insets.top }]}
        testID="chapters-invalid-book"
      >
        {bar()}
        <View style={pad}>
          <Text style={[type.body, { color: colors.inkMuted }]}>
            {t('bible.bookNotFound')}
          </Text>
        </View>
      </View>
    );
  }

  const chapterNumbers = Array.from(
    { length: book.chapterCount },
    (_, index) => index + 1
  );
  const name = getBookName(book, bookNameLanguageFor(bibleMode, appLanguage));
  const rows: number[][] = [];
  for (let i = 0; i < chapterNumbers.length; i += COLUMNS) {
    rows.push(chapterNumbers.slice(i, i + COLUMNS));
  }

  return (
    <ScrollView
      testID="bible-chapters-list"
      style={[styles.screen, { backgroundColor: colors.paper }]}
      contentContainerStyle={{
        paddingTop: insets.top,
        paddingBottom: insets.bottom + 32,
      }}
    >
      {bar(name)}
      <Text style={[type.bodySmall, styles.count, pad, { color: colors.inkMuted }]}>
        {t('bible.chapterCount', { n: book.chapterCount })}
      </Text>
      <View style={[styles.grid, pad]}>
        {rows.map((row, index) => (
          <View key={index} style={styles.row}>
            {row.map((chapterNumber) => (
              <Tappable
                key={chapterNumber}
                testID={`chapter-${chapterNumber}`}
                accessibilityRole="button"
                accessibilityLabel={`${t('bible.chapter')} ${chapterNumber}`}
                onPress={() =>
                  navigation.navigate('BibleChapter', { bookId: book.id, chapterNumber })
                }
                style={[styles.tile, { borderColor: colors.border }]}
              >
                <Text style={[styles.number, { color: colors.ink }]}>
                  {chapterNumber}
                </Text>
              </Tappable>
            ))}
            {/* The last row is filled out with empty slots so its tiles sit in the same columns. */}
            {Array.from({ length: COLUMNS - row.length }, (_, spacer) => (
              <View key={`spacer-${spacer}`} style={styles.spacer} />
            ))}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  count: { marginTop: 2 },
  grid: { marginTop: 16, gap: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  spacer: { width: 56, height: 48 },
  tile: {
    width: 56,
    height: 48,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  number: {
    fontFamily: fontFamilies.interfaceMedium,
    fontWeight: '500',
    fontSize: 16,
    lineHeight: 20,
  },
});
