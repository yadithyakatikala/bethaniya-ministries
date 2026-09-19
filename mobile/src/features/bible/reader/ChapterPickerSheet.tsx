import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Sheet } from '../../../theme/ui/Sheet';
import { Tappable } from '../../../theme/ui/Tappable';
import { SectionHeader } from '../../../theme/ui/SectionHeader';
import { useTheme, useTypographyFor } from '../../../theme';
import { useTranslation } from '../../../i18n';
import {
  NEW_TESTAMENT_BOOKS,
  OLD_TESTAMENT_BOOKS,
  getBookById,
  getBookName,
} from '../books';
import type { BibleBook, BibleLanguage } from '../types';

/**
 * Jump to any chapter, in two taps.
 *
 * TWO PANES, ONE SHEET. Choosing a book and then a chapter is two
 * decisions, so the sheet shows the book list, then the chosen book's
 * chapter grid with a way back. A single flat list of 1189 chapters
 * would technically be "no navigation confusion" and completely
 * unusable.
 *
 * NO DUPLICATED CANON DATA. The books and their chapter counts come
 * from ../books.ts, the same module the Bible tab's list screens read --
 * this component holds no table of its own. Book NAMES are resolved
 * through getBookName() for the label language the reader is using;
 * `book.id` stays the identifier, never the display name.
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
  const { colors, radii, spacing, type, minTouchTarget } = useTheme();
  // Book names are set in the face that covers THEIR script, not the
  // interface's -- the M3 defect this fixed elsewhere was a Telugu book
  // name rendered in a Latin-only serif. See ../../../theme/tokens.ts.
  const bookType = useTypographyFor(bookNameLanguage);
  const { t } = useTranslation();

  // Opens on the book currently being read, so "next chapter of this
  // book" is one tap rather than a scroll through 66 books.
  const [pickedBookId, setPickedBookId] = useState(bookId);
  const pickedBook = getBookById(pickedBookId);

  return (
    <>
      {pickedBook ? (
        <View style={{ gap: spacing.md }}>
          <Tappable
            testID="chapter-picker-back-to-books"
            accessibilityRole="button"
            accessibilityLabel={t('bible.selectBook')}
            onPress={() => setPickedBookId('')}
            style={[
              styles.bookHeader,
              {
                minHeight: minTouchTarget,
                borderRadius: radii.control,
                backgroundColor: colors.surfaceRaised,
                paddingHorizontal: spacing.md,
              },
            ]}
          >
            <Text style={[bookType.label, { color: colors.ink }]} numberOfLines={2}>
              {getBookName(pickedBook, bookNameLanguage)}
            </Text>
            <Text style={[type.caption, { color: colors.inkMuted }]}>
              {t('bible.selectBook')}
            </Text>
          </Tappable>

          <View style={styles.chapterGrid} testID="chapter-picker-chapters">
            {Array.from({ length: pickedBook.chapterCount }, (_, index) => index + 1).map(
              (number) => {
                const current = pickedBook.id === bookId && number === chapterNumber;
                return (
                  <Tappable
                    key={number}
                    testID={`chapter-picker-chapter-${number}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected: current }}
                    accessibilityLabel={`${t('bible.selectChapter')} ${number}`}
                    onPress={() => onSelect(pickedBook.id, number)}
                    style={[
                      styles.chapterCell,
                      {
                        minWidth: minTouchTarget,
                        minHeight: minTouchTarget,
                        borderRadius: radii.control,
                        backgroundColor: current ? colors.primaryTint : 'transparent',
                        borderColor: current ? colors.primary : colors.border,
                        borderWidth: current ? 1.5 : 1,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        current ? type.label : type.body,
                        { color: current ? colors.primary : colors.ink },
                      ]}
                    >
                      {number}
                    </Text>
                  </Tappable>
                );
              }
            )}
          </View>
        </View>
      ) : (
        <View style={{ gap: spacing.md }} testID="chapter-picker-books">
          <BookGroup
            title={t('bible.oldTestament')}
            books={OLD_TESTAMENT_BOOKS}
            bookNameLanguage={bookNameLanguage}
            onPick={setPickedBookId}
          />
          <BookGroup
            title={t('bible.newTestament')}
            books={NEW_TESTAMENT_BOOKS}
            bookNameLanguage={bookNameLanguage}
            onPick={setPickedBookId}
          />
        </View>
      )}
    </>
  );
}

function BookGroup({
  title,
  books,
  bookNameLanguage,
  onPick,
}: {
  title: string;
  books: BibleBook[];
  bookNameLanguage: BibleLanguage;
  onPick: (bookId: string) => void;
}) {
  const { colors, radii, spacing, minTouchTarget } = useTheme();
  const bookType = useTypographyFor(bookNameLanguage);
  return (
    <View style={{ gap: spacing.sm }}>
      <SectionHeader title={title} />
      {books.map((book) => (
        <Tappable
          key={book.id}
          testID={`chapter-picker-book-${book.id}`}
          accessibilityRole="button"
          onPress={() => onPick(book.id)}
          style={[
            styles.bookRow,
            {
              minHeight: minTouchTarget,
              borderRadius: radii.control,
              borderColor: colors.border,
              paddingHorizontal: spacing.md,
            },
          ]}
        >
          <Text style={[bookType.body, { color: colors.ink }]} numberOfLines={2}>
            {getBookName(book, bookNameLanguage)}
          </Text>
        </Tappable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bookHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  bookRow: {
    justifyContent: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  chapterGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chapterCell: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
});
