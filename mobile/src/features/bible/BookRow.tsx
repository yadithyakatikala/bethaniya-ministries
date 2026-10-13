import { StyleSheet, Text } from 'react-native';
import { Icon, Tappable, useTheme } from '../../theme';
import { fontFamilies } from '../../theme/tokens';
import { useTranslation } from '../../i18n';
import type { BibleBook } from './types';

/**
 * One book as a row: its name, how many chapters it has, a chevron. The book
 * the member is reading is set in bold -- not in gold: gold stays a thin line.
 *
 * Used by the Bible tab's list of books and by the reader's chapter picker, so
 * the two read as one list. `name` is passed in, already in the language the
 * Bible preference names its books in.
 */
export function BookRow({
  book,
  name,
  current,
  onPress,
  testID,
}: {
  book: BibleBook;
  name: string;
  current: boolean;
  onPress: () => void;
  testID: string;
}) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  return (
    <Tappable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${t('bible.chapterCount', { n: book.chapterCount })}`}
      onPress={onPress}
      style={[styles.book, { borderBottomColor: colors.border }]}
    >
      <Text
        numberOfLines={2}
        style={[styles.bookName, { color: colors.ink }, current && styles.bookCurrent]}
      >
        {name}
      </Text>
      <Text style={[styles.count, { color: colors.inkSubtle }]}>{book.chapterCount}</Text>
      <Icon name="chev" size={20} color={colors.inkSubtle} />
    </Tappable>
  );
}

const styles = StyleSheet.create({
  book: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    minHeight: 56,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  bookName: {
    flex: 1,
    minWidth: 0,
    fontFamily: fontFamilies.interfaceMedium,
    fontWeight: '500',
    fontSize: 17,
    lineHeight: 24,
  },
  bookCurrent: { fontFamily: fontFamilies.interfaceBold, fontWeight: '700' },
  count: { fontFamily: fontFamilies.interfaceMedium, fontSize: 13, lineHeight: 18 },
});
