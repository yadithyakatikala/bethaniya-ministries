import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  EmptyState,
  ErrorState,
  GoldBar,
  SegmentedChoice,
  SkeletonRows,
  Tappable,
  serifFor,
  useTheme,
} from '../../theme';
import type { HighlightColor } from '../../theme';
import { useTranslation } from '../../i18n';
import { formatDayMonthShort } from '../../i18n/locale';
import { useMemberIdentity } from '../../context/useMemberIdentity';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { getChapter } from '../bible/dataSource';
import { getBookNameById } from '../bible/books';
import { TopBar } from '../common/TopBar';
import {
  subscribeToBookmarks,
  subscribeToHighlights,
  subscribeToVerseNotes,
  type VerseRef,
} from '../../services/firebase/readerAnnotations';

type Props = NativeStackScreenProps<RootStackParamList, 'SavedVerses'>;
export type SavedKind = 'notes' | 'highlights' | 'bookmarks';

/** One saved verse, whichever of the three it came from. */
interface SavedVerse {
  id: string;
  ref: VerseRef;
  date: Date | null;
  /** Notes only. */
  note?: string;
  /** Highlights only. */
  colour?: HighlightColor;
}

type ListState =
  { status: 'loading' } | { status: 'error' } | { status: 'ready'; items: SavedVerse[] };

/**
 * What the member has kept in the Bible, as lists: NOTES (a verse and what
 * they wrote beside it), HIGHLIGHTS (the verse, in the colour they chose) and
 * BOOKMARKS (just the verse), newest first, switched by a three-part pill.
 *
 * It is a pushed screen with its own top bar, reached from the Saved tab. A
 * row opens the Bible at that verse. The verse's words come from the Bible
 * bundled on the phone, in the translation the annotation was made in -- so
 * they read in that translation's serif and the book is named in its
 * language -- and a verse that cannot be found (it cannot happen with the
 * bundled text, but data is data) still shows its reference and its note.
 *
 * Each kind subscribes to ITS collection only, when it is shown.
 */
export function SavedVersesScreen({ navigation, route }: Props) {
  const { colors, layout } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [kind, setKind] = useState<SavedKind>(route.params?.kind ?? 'notes');

  return (
    <View
      testID="saved-verses-screen"
      style={[styles.screen, { backgroundColor: colors.paper, paddingTop: insets.top }]}
    >
      <View style={{ paddingHorizontal: layout.screenMargin }}>
        <TopBar title={t('you.tabSaved')} onBack={() => navigation.goBack()} />
        <SegmentedChoice
          testID="saved-kind"
          accessibilityLabel={t('you.tabSaved')}
          selected={kind}
          onSelect={setKind}
          options={[
            { value: 'notes', label: t('you.notes') },
            { value: 'highlights', label: t('you.highlights') },
            { value: 'bookmarks', label: t('you.bookmarks') },
          ]}
        />
      </View>
      <SavedVerseList
        key={kind}
        kind={kind}
        onOpen={(ref) =>
          navigation.navigate('BibleChapter', {
            bookId: ref.bookId,
            chapterNumber: ref.chapter,
            verse: ref.verse,
          })
        }
      />
    </View>
  );
}

function SavedVerseList({
  kind,
  onOpen,
}: {
  kind: SavedKind;
  onOpen: (ref: VerseRef) => void;
}) {
  const { colors, layout } = useTheme();
  const { t } = useTranslation();
  const { uid } = useMemberIdentity();
  const [state, setState] = useState<ListState>({ status: 'loading' });

  useEffect(() => {
    if (!uid) return undefined;
    const fail = () => setState({ status: 'error' });
    const done = (items: SavedVerse[]) =>
      setState({
        status: 'ready',
        items: [...items].sort(
          (a, b) => (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0)
        ),
      });
    if (kind === 'notes') {
      return subscribeToVerseNotes(
        uid,
        (notes) =>
          done(
            notes.map((note) => ({
              id: note.id,
              ref: note,
              date: note.updatedAt ?? note.createdAt,
              note: note.text,
            }))
          ),
        fail
      );
    }
    if (kind === 'highlights') {
      return subscribeToHighlights(
        uid,
        (highlights) =>
          done(
            highlights.map((highlight) => ({
              id: highlight.id,
              ref: highlight,
              date: highlight.createdAt,
              colour: highlight.colour,
            }))
          ),
        fail
      );
    }
    return subscribeToBookmarks(
      uid,
      (bookmarks) =>
        done(
          bookmarks.map((bookmark) => ({
            id: bookmark.id,
            ref: bookmark,
            date: bookmark.createdAt,
          }))
        ),
      fail
    );
  }, [uid, kind]);

  const pad = { paddingHorizontal: layout.screenMargin };

  if (state.status === 'loading') {
    return (
      <View style={[pad, styles.below]}>
        <SkeletonRows
          count={3}
          leading="none"
          label={t('common.loading')}
          testID="saved-verses-loading"
        />
      </View>
    );
  }
  if (state.status === 'error') {
    return (
      <View style={pad}>
        <ErrorState
          testID="saved-verses-error"
          message={t('you.loadError')}
          retryLabel={t('common.tryAgain')}
        />
      </View>
    );
  }
  if (state.items.length === 0) {
    const empty = EMPTY[kind];
    return (
      <View style={pad}>
        <View style={styles.below}>
          <EmptyState
            testID="saved-verses-empty"
            title={t(empty.title)}
            message={t(empty.message)}
          />
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      testID="saved-verses-list"
      contentContainerStyle={[pad, styles.list, { borderTopColor: colors.border }]}
    >
      <View style={[styles.rule, { borderTopColor: colors.border }]} />
      {state.items.map((item) => (
        <SavedVerseRow key={item.id} item={item} onPress={() => onOpen(item.ref)} />
      ))}
    </ScrollView>
  );
}

const EMPTY = {
  notes: { title: 'you.noNotes', message: 'you.noNotesMessage' },
  highlights: { title: 'you.noHighlights', message: 'you.noHighlightsMessage' },
  bookmarks: { title: 'you.noBookmarks', message: 'you.noBookmarksMessage' },
} as const;

function SavedVerseRow({ item, onPress }: { item: SavedVerse; onPress: () => void }) {
  const { colors, highlights, type } = useTheme();
  const { appLanguage } = useTranslation();
  const language = item.ref.translationId;
  const book = getBookNameById(item.ref.bookId, language) ?? item.ref.bookId;
  const reference = `${book} ${item.ref.chapter}:${item.ref.verse}`;
  const verse = getChapter(item.ref.bookId, item.ref.chapter, language)?.verses.find(
    (v) => v.number === item.ref.verse
  );
  const date = item.date ? formatDayMonthShort(item.date, appLanguage) : '';
  const note = item.note !== undefined;
  // The verse in the serif of the Bible it was saved in: 17/26, or 16/30 in Telugu, whose
  // marks need the room. (The reader's own scale is a setting; a list is not the reader.)
  const verseFace =
    language === 'te'
      ? { fontFamily: serifFor('te', 'regular'), fontSize: 16, lineHeight: 30 }
      : { fontFamily: serifFor('en', 'regular'), fontSize: 17, lineHeight: 26 };

  return (
    <Tappable
      testID={`saved-verse-${item.id}`}
      accessibilityRole="button"
      accessibilityLabel={[reference, date].filter(Boolean).join('. ')}
      onPress={onPress}
      style={[styles.row, { borderBottomColor: colors.border }]}
    >
      <View style={styles.head}>
        <Text style={[type.scriptureReference, { color: colors.accent }]}>
          {reference}
        </Text>
        {date ? (
          <Text style={[type.caption, { color: colors.inkSubtle }]}>{date}</Text>
        ) : null}
      </View>
      {verse ? (
        <Text
          testID={`saved-verse-text-${item.id}`}
          numberOfLines={note ? 2 : item.colour ? 4 : 3}
          style={[
            verseFace,
            // A note keeps its verse quiet: the member's own words are the point.
            note
              ? {
                  color: colors.inkMuted,
                  ...(language === 'te' ? null : { fontSize: 15, lineHeight: 23 }),
                }
              : { color: colors.ink },
            item.colour ? styles.highlight : null,
            item.colour ? { backgroundColor: highlights[item.colour] } : null,
          ]}
        >
          {verse.text}
        </Text>
      ) : null}
      {item.note ? (
        <View style={styles.noteRow}>
          <GoldBar width={2} />
          <Text
            testID={`saved-note-${item.id}`}
            // The member's own words, in the interface face (it covers both scripts) -- the
            // verse above is the serif; the note is plain.
            style={[type.body, styles.noteText, { color: colors.ink }]}
          >
            {item.note}
          </Text>
        </View>
      ) : null}
    </Tappable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  below: { marginTop: 12 },
  list: { paddingBottom: 32, marginTop: 12 },
  rule: { borderTopWidth: 1 },
  row: { gap: 8, paddingVertical: 16, borderBottomWidth: 1 },
  head: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 12,
  },
  // A highlight is the verse on its tint, a little wider than the text so the
  // letters do not touch the edge of the colour.
  highlight: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginHorizontal: -8,
    borderRadius: 4,
  },
  noteRow: { flexDirection: 'row', gap: 14 },
  noteText: { flex: 1, minWidth: 0, paddingVertical: 1 },
});
