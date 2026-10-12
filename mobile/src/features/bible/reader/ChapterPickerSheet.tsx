import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  Icon,
  IconButton,
  SegmentedChoice,
  Sheet,
  Tappable,
  useTheme,
} from '../../../theme';
import { fontFamilies } from '../../../theme/tokens';
import { useTranslation } from '../../../i18n';
import {
  NEW_TESTAMENT_BOOKS,
  OLD_TESTAMENT_BOOKS,
  getBookById,
  getBookName,
} from '../books';
import { BookRow } from '../BookRow';
import type { BibleLanguage } from '../types';

type Testament = 'OT' | 'NT';

/**
 * Jump to any chapter, in two taps.
 *
 * TWO PANES, ONE SHEET, AT ONE HEIGHT. Choosing a book and then a chapter is two
 * decisions, so the sheet shows the book list, then the chosen book's chapter
 * grid with a way back. A single flat list of 1189 chapters would technically be
 * "no navigation confusion" and completely unusable. The sheet is a fixed, tall
 * one (see `Sheet`'s `tall`) so it does not change height as the panes change.
 *
 *   books      Old | New Testament, then the books of that testament as the
 *              Bible tab lists them (../BookRow.tsx): name, chapters, chevron.
 *              It opens on the testament of the book being read.
 *   chapters   a panel with Back, the book's name and "21 chapters", then the
 *              chapters as a grid of pills, five across; the one being read
 *              has a heavy ink ring and a tint, and is bolder.
 *
 * NO DUPLICATED CANON DATA. The books and their chapter counts come from
 * ../books.ts, the same module the Bible tab's list screens read -- this
 * component holds no table of its own. Book NAMES are resolved through
 * getBookName() for the label language the reader is using; `book.id` stays the
 * identifier, never the display name.
 */
export function ChapterPickerSheet({
  visible,
  onClose,
  bookId,
  chapterNumber,
  bookNameLanguage,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  bookId: string;
  chapterNumber: number;
  bookNameLanguage: BibleLanguage;
  onSelect: (bookId: string, chapterNumber: number) => void;
}) {
  const { t } = useTranslation();
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={t('bible.chapterSelector')}
      closeLabel={t('common.close')}
      testID="chapter-picker-sheet"
      tall
    >
      {/* Mounted when the sheet opens and keyed by the book being read, so
          it always opens on that book without an effect reaching in to
          reset which pane is showing. */}
      {visible ? (
        <ChapterPickerBody
          key={bookId}
          bookId={bookId}
          chapterNumber={chapterNumber}
          bookNameLanguage={bookNameLanguage}
          onSelect={onSelect}
        />
      ) : null}
    </Sheet>
  );
}

function ChapterPickerBody({
  bookId,
  chapterNumber,
  bookNameLanguage,
  onSelect,
}: {
  bookId: string;
  chapterNumber: number;
  bookNameLanguage: BibleLanguage;
  onSelect: (bookId: string, chapterNumber: number) => void;
}) {
  const { colors, radii } = useTheme();
  const { t } = useTranslation();

  // Opens on the book currently being read, so "next chapter of this
  // book" is one tap rather than a scroll through 66 books.
  const [pickedBookId, setPickedBookId] = useState(bookId);
  const pickedBook = getBookById(pickedBookId);
  const readingBook = getBookById(bookId);
  const [testament, setTestament] = useState<Testament>(
    readingBook?.testament === 'NT' ? 'NT' : 'OT'
  );

  if (pickedBook) {
    return (
      <View style={styles.pane}>
        <View
          style={[
            styles.bookHeader,
            { backgroundColor: colors.surfaceRaised, borderRadius: radii.control },
          ]}
        >
          <IconButton
            testID="chapter-picker-back-to-books"
            accessibilityLabel={t('bible.selectBook')}
            onPress={() => setPickedBookId('')}
          >
            <Icon name="back" size={22} />
          </IconButton>
          <Text numberOfLines={2} style={[styles.bookTitle, { color: colors.ink }]}>
            {getBookName(pickedBook, bookNameLanguage)}
          </Text>
          <Text style={[styles.bookCount, { color: colors.inkMuted }]}>
            {t('bible.chapterCount', { n: pickedBook.chapterCount })}
          </Text>
        </View>

        <View style={styles.grid} testID="chapter-picker-chapters">
          {Array.from({ length: pickedBook.chapterCount }, (_, index) => index + 1).map(
            (number) => {
              const current = pickedBook.id === bookId && number === chapterNumber;
              return (
                <View key={number} style={styles.cell}>
                  <Tappable
                    testID={`chapter-picker-chapter-${number}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected: current }}
                    accessibilityLabel={`${t('bible.selectChapter')} ${number}`}
                    onPress={() => onSelect(pickedBook.id, number)}
                    style={[
                      styles.chapter,
                      current ? styles.chapterCurrent : styles.chapterIdle,
                      {
                        borderColor: current ? colors.ink : colors.border,
                        backgroundColor: current ? colors.primaryTint : 'transparent',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.chapterNumber,
                        { color: colors.ink },
                        current && styles.chapterNumberCurrent,
                      ]}
                    >
                      {number}
                    </Text>
                  </Tappable>
                </View>
              );
            }
          )}
        </View>
      </View>
    );
  }

  const books = testament === 'NT' ? NEW_TESTAMENT_BOOKS : OLD_TESTAMENT_BOOKS;
  return (
    <View style={styles.pane} testID="chapter-picker-books">
      <SegmentedChoice
        testID="chapter-picker-testament"
        accessibilityLabel={t('bible.chapterSelector')}
        options={[
          { value: 'OT' as Testament, label: t('bible.oldTestament') },
          { value: 'NT' as Testament, label: t('bible.newTestament') },
        ]}
        selected={testament}
        onSelect={setTestament}
      />
      <View>
        {books.map((book) => (
          <BookRow
            key={book.id}
            testID={`chapter-picker-book-${book.id}`}
            book={book}
            name={getBookName(book, bookNameLanguage)}
            current={book.id === bookId}
            onPress={() => setPickedBookId(book.id)}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pane: { gap: 12 },
  bookHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 56,
    paddingLeft: 4,
    paddingRight: 14,
  },
  bookTitle: {
    flex: 1,
    minWidth: 0,
    fontFamily: fontFamilies.interfaceSemiBold,
    fontWeight: '600',
    fontSize: 17,
    lineHeight: 24,
  },
  bookCount: {
    fontFamily: fontFamilies.interfaceRegular,
    fontSize: 13,
    lineHeight: 18,
  },
  // Five across: each chapter in a fifth of the row, its pill centred in it.
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingTop: 8 },
  cell: { width: '20%', alignItems: 'center', marginBottom: 10 },
  chapter: {
    width: 56,
    height: 48,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chapterIdle: { borderWidth: 1 },
  chapterCurrent: { borderWidth: 2 },
  chapterNumber: {
    fontFamily: fontFamilies.interfaceMedium,
    fontWeight: '500',
    fontSize: 16,
    lineHeight: 20,
  },
  chapterNumberCurrent: { fontFamily: fontFamilies.interfaceBold, fontWeight: '700' },
});
