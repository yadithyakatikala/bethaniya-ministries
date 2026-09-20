import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { usePreferences } from '../../../context/PreferencesContext';
import { useReadingPreferences } from '../../../context/ReadingPreferencesContext';
import { useTheme } from '../../../theme';
import { Tappable } from '../../../theme/ui/Tappable';
import { LoadingState } from '../../../theme/ui/LoadingState';
import { ErrorState } from '../../../theme/ui/ErrorState';
import { EmptyState } from '../../../theme/ui/EmptyState';
import { useTranslation } from '../../../i18n';
import { primaryBibleLanguage } from '../../../context/languagePreferences';
import type { RootStackParamList } from '../../../navigation/AppNavigator';
import type {
  TranslationId,
  VerseRef,
} from '../../../services/firebase/readerAnnotations';
import type { HighlightColor } from '../../../theme/tokens';
import { getBookById, getBookName } from '../books';
import { getBilingualChapter, loadChapter } from '../dataSource';
import { bookNameLanguageFor, type BibleChapter } from '../types';
import { ReaderBottomBar, ReaderTopBar } from './ReaderChrome';
import { BilingualBody, ScriptureBody, type VerseHandlers } from './ScriptureBody';
import { VerseActionSheet } from './VerseActionSheet';
import { NoteEditor } from './NoteEditor';
import { ReaderSettingsSheet } from './ReaderSettingsSheet';
import { ChapterPickerSheet } from './ChapterPickerSheet';
import { useVerseAnnotations } from './useVerseAnnotations';
import { useReadingPosition } from './useReadingPosition';
import {
  buildBilingualCopyText,
  buildBilingualShareText,
  buildCopyText,
  buildShareText,
  copyText,
  shareText,
} from './verseSharing';

type Props = NativeStackScreenProps<RootStackParamList, 'BibleChapter'>;

/**
 * Room the overlay bars need at the top and bottom of the scroll
 * content, so the first and last verses are reachable while the chrome
 * is showing. Constants rather than measured heights: the bars are
 * overlays, so this is padding on the PAGE, and a measured value would
 * make the content reflow every time the chrome appeared -- which is
 * exactly what the overlay design exists to avoid.
 */
const TOP_CHROME_SPACE = 62;
const BOTTOM_CHROME_SPACE = 84;

/** How long a "copied"/"could not save" notice stays on screen. */
const NOTICE_MS = 2600;

/**
 * The immersive Bible reader.
 *
 * =====================================================================
 * WHAT MAKES IT A READER AND NOT A SCREEN WITH VERSES ON IT
 * =====================================================================
 * The page is full-height and the chrome is two overlays that tap away,
 * so nothing but scripture holds the screen while you read. The type,
 * its size, its leading and the width of the column are the member's own
 * saved settings. The place they reached is remembered. Everything else
 * -- highlighting, bookmarking, a note, sharing -- is one tap on the
 * verse itself.
 *
 * TWO TAP TARGETS, ONE SURFACE. A tap on a VERSE selects that verse and
 * opens its actions; a tap anywhere else on the page toggles the chrome.
 * That works because a Pressable child consumes the touch before its
 * Pressable parent sees it, so the two never fight -- and it is why
 * neither gesture can trigger navigation by accident.
 *
 * THE CHROME STAYS VISIBLE FOR A SCREEN READER. Auto-hiding chrome is a
 * visual affordance: a TalkBack user's double-tap lands on the verse
 * under their finger, so hiding the bars would leave them no way to get
 * the controls back. `AccessibilityInfo` is read (and watched) and the
 * bars stay mounted whenever a screen reader is running.
 *
 * NAVIGATION IS UNCHANGED. This is the same `BibleChapter` route the
 * Bible tab and the search screen already push, registered with
 * `headerShown: false`, and outside the five tab routes -- so the bottom
 * tab bar is already absent here (see
 * ../../../navigation/AppNavigator.tsx's TAB_ROUTE_NAMES). M4 replaces
 * what the route renders, not the navigation architecture.
 */
type LoadResult = { key: string; chapter: BibleChapter | null };

export function ReaderScreen({ route, navigation }: Props) {
  const { bookId, chapterNumber, verse: targetVerse } = route.params;
  const { appLanguage, bibleMode } = usePreferences();
  const { font, size, lineHeight, width, layout } = useReadingPreferences();
  const { colors, radii, spacing, type, reading } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  /** Which single translation to read when not pairing. */
  const language = primaryBibleLanguage(bibleMode);
  const bookNameLanguage = bookNameLanguageFor(bibleMode, appLanguage);
  const book = getBookById(bookId);

  // --- chapter data -------------------------------------------------
  // requestKey identifies "which request a result belongs to", so
  // `chapter` is DERIVED by comparing it against the last settled
  // result rather than reset with a setState inside the load effect.
  const requestKey = `${bookId}:${chapterNumber}:${bibleMode}`;
  const [result, setResult] = useState<LoadResult | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const chapter = result?.key === requestKey ? result.chapter : undefined;
  const hasError = errorKey === requestKey;

  useEffect(() => {
    let cancelled = false;
    loadChapter(bookId, chapterNumber, language)
      .then((loaded) => {
        if (!cancelled) setResult({ key: requestKey, chapter: loaded });
      })
      .catch(() => {
        if (!cancelled) setErrorKey(requestKey);
      });
    return () => {
      cancelled = true;
    };
  }, [bookId, chapterNumber, language, requestKey]);

  /** Synchronous and cheap -- both corpora are bundled, so no loading state. */
  const bilingual = useMemo(
    () => (bibleMode === 'bilingual' ? getBilingualChapter(bookId, chapterNumber) : null),
    [bibleMode, bookId, chapterNumber]
  );

  // --- chrome -------------------------------------------------------
  /**
   * Which chapter the reader last hid the chrome FOR, rather than a plain
   * boolean.
   *
   * Derived state, so nothing has to reset it from an effect: the chrome
   * is showing unless this names the chapter on screen, which means a
   * chapter turn brings the controls back on the very render that turns
   * the page. A reader who has just navigated needs the controls, and
   * leaving them hidden after a chapter turn is how a reader gets lost.
   */
  const [hiddenForChapter, setHiddenForChapter] = useState<string | null>(null);
  const chapterKey = `${bookId}:${chapterNumber}`;
  const chromeVisible = hiddenForChapter !== chapterKey;
  const [screenReaderOn, setScreenReaderOn] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void AccessibilityInfo.isScreenReaderEnabled()
      .then((enabled) => {
        if (!cancelled) setScreenReaderOn(enabled);
      })
      // A platform that cannot answer is treated as "no screen reader":
      // the reader must open either way.
      .catch(() => undefined);
    const subscription = AccessibilityInfo.addEventListener(
      'screenReaderChanged',
      setScreenReaderOn
    );
    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, []);

  const showChrome = chromeVisible || screenReaderOn;

  // --- annotations --------------------------------------------------
  const {
    canAnnotate,
    annotationFor,
    setVerseHighlight,
    toggleVerseBookmark,
    setVerseNote,
    removeVerseNote,
  } = useVerseAnnotations();

  const [selected, setSelected] = useState<{
    translationId: TranslationId;
    verse: number;
  } | null>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(null), NOTICE_MS);
    return () => clearTimeout(timer);
  }, [notice]);

  const selectedRef: VerseRef | null = selected
    ? {
        translationId: selected.translationId,
        bookId,
        chapter: chapterNumber,
        verse: selected.verse,
      }
    : null;
  const selectedAnnotation = selected
    ? annotationFor(selected.translationId, bookId, chapterNumber, selected.verse)
    : { highlight: null, bookmarked: false, note: null };

  // --- scroll bookkeeping -------------------------------------------
  // Offsets are recorded per verse as the rows lay out, so the reader
  // can both scroll TO a verse (a search result) and work out which
  // verse is at the top (the saved reading position). They are the row's
  // offset within its list plus the list's own offset, which for a
  // chapter carrying a notice badge is a few points optimistic -- near
  // enough for both uses, and cheaper than measuring against the scroll
  // view on every row.
  const scrollRef = useRef<ScrollView | null>(null);
  const verseOffsets = useRef(new Map<number, number>());
  const bodyOffset = useRef(0);
  const scrolledForRef = useRef<string | null>(null);

  const { reportVisibleVerse } = useReadingPosition({
    translationId: language,
    bookId,
    chapter: chapterNumber,
  });

  useEffect(() => {
    verseOffsets.current.clear();
  }, [requestKey]);

  const onVerseLayout = useCallback((verse: number, y: number) => {
    verseOffsets.current.set(verse, y);
  }, []);

  /**
   * Scrolls to the verse the route asked for -- a search result, or a
   * restored position -- once that row has actually laid out. Runs once
   * per request, so a later scroll by the reader is never undone.
   */
  useEffect(() => {
    if (!targetVerse || scrolledForRef.current === requestKey) return undefined;
    const timer = setTimeout(() => {
      const offset = verseOffsets.current.get(targetVerse);
      if (offset === undefined) return;
      scrolledForRef.current = requestKey;
      scrollRef.current?.scrollTo({
        y: Math.max(0, bodyOffset.current + offset - spacing.lg),
        animated: true,
      });
    }, 120);
    return () => clearTimeout(timer);
  }, [targetVerse, requestKey, chapter, bilingual, spacing.lg]);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = event.nativeEvent.contentOffset.y - bodyOffset.current;
      let topmost: number | null = null;
      let bestOffset = -Infinity;
      for (const [verse, offset] of verseOffsets.current) {
        if (offset <= y + 1 && offset > bestOffset) {
          bestOffset = offset;
          topmost = verse;
        }
      }
      reportVisibleVerse(topmost ?? 1);
    },
    [reportVisibleVerse]
  );

  // --- verse actions ------------------------------------------------
  const bookName = book ? getBookName(book, bookNameLanguage) : '';
  const reference = `${bookName} ${chapterNumber}`;

  /**
   * What the selected verse actually says, and the LABEL it is printed
   * under -- "39-40" for a merged Telugu range, so a shared reference
   * matches what the reader saw.
   *
   * `single` of null means a paired bilingual row, which has two texts.
   * The lookup is ordered by MODE first: in bilingual mode the single
   * translation's chapter is also loaded (it backs the settings sample),
   * and searching that first would hand back the Telugu verse 7 for a
   * tapped English verse 7 in a chapter where the two are not the same
   * verse at all.
   */
  const selectedVerseText = useMemo((): {
    label: string;
    single: string | null;
    english: string;
    telugu: string;
  } | null => {
    if (!selected) return null;
    if (bibleMode === 'bilingual' && bilingual) {
      const presentation = bilingual.presentation;
      if (presentation.kind === 'paired') {
        const row = presentation.rows.find((r) => r.start === selected.verse);
        return row
          ? { label: row.label, single: null, english: row.english, telugu: row.telugu }
          : null;
      }
      if (selected.translationId === 'en') {
        const found = presentation.english.find((v) => v.number === selected.verse);
        return found
          ? { label: String(found.number), single: found.text, english: '', telugu: '' }
          : null;
      }
      if (presentation.kind === 'chapterLevel') {
        const span = presentation.telugu.find((s) => s.start === selected.verse);
        return span
          ? {
              label:
                span.end > span.start ? `${span.start}-${span.end}` : `${span.start}`,
              single: span.text,
              english: '',
              telugu: '',
            }
          : null;
      }
      return null;
    }
    const found = chapter?.verses.find((v) => v.number === selected.verse);
    return found
      ? {
          label: found.endNumber
            ? `${found.number}-${found.endNumber}`
            : String(found.number),
          single: found.text,
          english: '',
          telugu: '',
        }
      : null;
  }, [selected, bibleMode, bilingual, chapter]);

  const selectedReference = selectedVerseText
    ? `${reference}:${selectedVerseText.label}`
    : reference;

  async function handleShare() {
    if (!selectedVerseText) return;
    const { label, single, english, telugu } = selectedVerseText;
    const payload =
      single === null
        ? buildBilingualShareText({
            bookName,
            chapter: chapterNumber,
            label,
            english,
            telugu,
          })
        : buildShareText({
            bookName,
            chapter: chapterNumber,
            label,
            text: single,
          });
    const ok = await shareText(payload);
    setSelected(null);
    if (!ok) setNotice(t('bible.shareFailed'));
  }

  async function handleCopy() {
    if (!selectedVerseText) return;
    const { label, single, english, telugu } = selectedVerseText;
    const payload =
      single === null
        ? buildBilingualCopyText({
            bookName,
            chapter: chapterNumber,
            label,
            english,
            telugu,
          })
        : buildCopyText({ bookName, chapter: chapterNumber, label, text: single });
    const ok = await copyText(payload);
    setSelected(null);
    setNotice(ok ? t('bible.copied') : t('bible.copyFailed'));
  }

  /** Announces a failed write where the member took the action. */
  async function announceIfFailed(write: Promise<boolean>) {
    if (!(await write)) setNotice(t('bible.saveFailed'));
  }

  function handleSelectHighlight(colour: HighlightColor | null) {
    if (selectedRef) void announceIfFailed(setVerseHighlight(selectedRef, colour));
    setSelected(null);
  }

  function handleToggleBookmark() {
    if (selectedRef) void announceIfFailed(toggleVerseBookmark(selectedRef));
    setSelected(null);
  }

  function goToChapter(nextBookId: string, nextChapter: number) {
    setSelected(null);
    setPickerOpen(false);
    navigation.navigate('BibleChapter', {
      bookId: nextBookId,
      chapterNumber: nextChapter,
    });
  }

  if (!book) {
    return (
      <View
        style={[styles.screen, styles.centred, { backgroundColor: colors.paper }]}
        testID="chapter-invalid-book"
      >
        <Text style={[type.body, { color: colors.inkMuted }]}>
          {t('bible.bookNotFound')}
        </Text>
      </View>
    );
  }

  const handlers: VerseHandlers = {
    size,
    density: lineHeight,
    font,
    bookId,
    chapter: chapterNumber,
    selectedVerse: selected?.verse ?? null,
    annotationFor,
    onSelectVerse: (translationId, verse) => setSelected({ translationId, verse }),
    onVerseLayout,
  };

  return (
    <View
      testID="reader-screen"
      style={[styles.screen, { backgroundColor: colors.paper }]}
    >
      <ScrollView
        ref={scrollRef}
        testID="reader-scroll"
        onScroll={handleScroll}
        scrollEventThrottle={96}
        contentContainerStyle={[
          styles.content,
          {
            paddingHorizontal: spacing.screen,
            paddingTop: insets.top + TOP_CHROME_SPACE,
            paddingBottom: insets.bottom + BOTTOM_CHROME_SPACE,
          },
        ]}
      >
        {/* The page background. A tap here toggles the chrome; a tap on a
            verse inside is consumed by that verse's own Pressable.
            accessible={false} keeps the whole page from collapsing into
            one screen-reader node -- which is also why the chrome stays
            mounted while a screen reader is running. */}
        <Tappable
          accessible={false}
          accessibilityLabel={t('bible.toggleControls')}
          testID="reader-scripture-surface"
          onPress={() => setHiddenForChapter(chromeVisible ? chapterKey : null)}
          onLayout={(event) => {
            bodyOffset.current = event.nativeEvent.layout.y;
          }}
          style={[styles.measure, { maxWidth: reading.measure[width] }]}
        >
          {chapter === undefined && !bilingual && !hasError ? (
            <LoadingState testID="chapter-loading" label={t('common.loading')} />
          ) : null}

          {hasError ? (
            <ErrorState
              testID="chapter-error"
              message={t('bible.chapterLoadError')}
              retryLabel={t('common.tryAgain')}
              onRetry={() => setErrorKey(null)}
            />
          ) : null}

          {/* Defensive: prev/next are bounded by the book's chapter count
              and the picker only offers chapters that exist, so an
              out-of-range reference can now only arrive from a bad deep
              link. It still has to say something rather than paint a
              blank page. */}
          {chapter === null && !bilingual && !hasError ? (
            <ErrorState testID="chapter-not-found" message={t('bible.chapterNotFound')} />
          ) : null}

          {bibleMode === 'bilingual' && bilingual ? (
            <BilingualBody
              presentation={bilingual.presentation}
              layout={layout}
              primaryTranslation={language}
              handlers={handlers}
            />
          ) : null}

          {/* An empty chapter would otherwise be a blank page. The
              wording says what the reader can DO about it rather than
              repeating the fact -- see ../../../i18n/strings.ts. */}
          {bibleMode !== 'bilingual' && chapter?.unavailableInTranslation ? (
            <EmptyState
              testID="chapter-unavailable"
              title={t('bible.notInTranslation')}
              message={t('bible.notInTranslationHelp')}
            />
          ) : null}

          {bibleMode !== 'bilingual' && chapter && chapter.verses.length > 0 ? (
            <ScriptureBody
              verses={chapter.verses}
              language={language}
              handlers={handlers}
            />
          ) : null}
        </Tappable>
      </ScrollView>

      {showChrome ? (
        <>
          <ReaderTopBar
            reference={reference}
            bookNameLanguage={bookNameLanguage}
            onBack={() => navigation.goBack()}
            onOpenSettings={() => setSettingsOpen(true)}
          />
          <ReaderBottomBar
            chapterNumber={chapterNumber}
            reference={reference}
            isFirstChapter={chapterNumber <= 1}
            isLastChapter={chapterNumber >= book.chapterCount}
            onPrevious={() => goToChapter(bookId, chapterNumber - 1)}
            onNext={() => goToChapter(bookId, chapterNumber + 1)}
            onOpenChapterPicker={() => setPickerOpen(true)}
          />
        </>
      ) : null}

      {notice ? (
        <View
          pointerEvents="none"
          style={[
            styles.noticeLayer,
            { bottom: insets.bottom + BOTTOM_CHROME_SPACE + spacing.md },
          ]}
        >
          <View
            testID="reader-notice"
            accessibilityLiveRegion="polite"
            style={[
              styles.notice,
              {
                backgroundColor: colors.surfaceRaised,
                borderColor: colors.border,
                borderRadius: radii.control,
                paddingHorizontal: spacing.lg,
                paddingVertical: spacing.md,
              },
            ]}
          >
            <Text style={[type.bodySmall, { color: colors.ink }]}>{notice}</Text>
          </View>
        </View>
      ) : null}

      <VerseActionSheet
        visible={selected !== null && !noteOpen}
        onClose={() => setSelected(null)}
        reference={selectedReference}
        annotation={selectedAnnotation}
        canAnnotate={canAnnotate}
        onSelectHighlight={handleSelectHighlight}
        onToggleBookmark={handleToggleBookmark}
        onEditNote={() => setNoteOpen(true)}
        onShare={() => void handleShare()}
        onCopy={() => void handleCopy()}
      />

      <NoteEditor
        visible={noteOpen}
        onClose={() => setNoteOpen(false)}
        reference={selectedReference}
        initialText={selectedAnnotation.note?.text ?? ''}
        onSave={(text) => {
          if (selectedRef) void announceIfFailed(setVerseNote(selectedRef, text));
          setNoteOpen(false);
          setSelected(null);
        }}
        onDelete={() => {
          if (selectedRef) void announceIfFailed(removeVerseNote(selectedRef));
          setNoteOpen(false);
          setSelected(null);
        }}
      />

      <ReaderSettingsSheet
        visible={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        bilingual={bibleMode === 'bilingual'}
        sampleLanguage={language}
        // Real scripture from the open chapter, in the script being
        // read, so the size and leading being chosen are visible in the
        // face they will actually be set in. Falls back to the reference
        // for the one chapter with no Telugu text.
        sampleText={chapter?.verses[0]?.text.slice(0, 64) ?? reference}
      />

      <ChapterPickerSheet
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        bookId={bookId}
        chapterNumber={chapterNumber}
        bookNameLanguage={bookNameLanguage}
        onSelect={goToChapter}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  centred: { alignItems: 'center', justifyContent: 'center', padding: 20 },
  content: { flexGrow: 1, alignItems: 'center' },
  // The reading measure. A line running the full width of a tablet
  // passes the ~60-75 characters an eye tracks comfortably, which is the
  // single biggest difference between a page of text and a reading
  // experience. Adjustable from the settings sheet.
  measure: { width: '100%', alignSelf: 'center' },
  // A centring layer, so the pill sits in the middle of the screen
  // rather than wherever `alignSelf` would put an absolute child.
  // pointerEvents none: a transient notice must never eat a tap meant
  // for the page.
  noticeLayer: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  notice: { borderWidth: StyleSheet.hairlineWidth, maxWidth: '86%' },
});
