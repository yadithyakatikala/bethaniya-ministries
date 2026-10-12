import { useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  ChoiceSheet,
  Icon,
  IconButton,
  ScreenTitle,
  SegmentedChoice,
  Tappable,
  UnderlineTabs,
  useTheme,
} from '../../theme';
import { fontFamilies } from '../../theme/tokens';
import { usePreferences } from '../../context/PreferencesContext';
import { useTranslation } from '../../i18n';
import { useRouteTab } from '../../navigation/useRouteTab';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { PlansView } from '../plans/PlansView';
import {
  NEW_TESTAMENT_BOOKS,
  OLD_TESTAMENT_BOOKS,
  getBookById,
  getBookName,
} from './books';
import { BookRow } from './BookRow';
import { ContinueReading } from './reader/ContinueReading';
import { useSavedReadingPosition } from './reader/useSavedReadingPosition';
import { bookNameLanguageFor, type BibleBook, type BibleMode } from './types';

type Props = NativeStackScreenProps<RootStackParamList, 'BibleBooks'>;
type Testament = 'OT' | 'NT';

/**
 * The Bible tab: **Read | Plans** under its title, with Search at the right.
 *
 * READ is the books. If the member has read before, "Continue reading" is first
 * (the saved place is an ENTRY POINT, never a redirect -- see
 * ./reader/ContinueReading.tsx). Then "Books" with the Bible's language at its
 * right (a pill that opens the one sheet for choosing it -- Telugu, English or
 * both), a two-part pill choosing the Old or the New Testament, and the books
 * of that testament as rows: the name, how many chapters, a chevron. The
 * testament the member was last reading is the one it opens on, and that book
 * is set in bold; with nothing read yet it opens on the Old.
 *
 * PLANS is the reading plans, sorted for the member (../plans/PlansView.tsx).
 * They used to be reached from the More tab and from Home; they live in the
 * Bible now, because a reading plan is Bible reading.
 *
 * Book names label scripture, so they follow the BIBLE preference, not the
 * interface language (see bookNameLanguageFor()). The testament rows are a
 * plain ScrollView of at most 39 rows -- small and fixed, with nothing to virtualise.
 */
export function BibleHomeScreen({ navigation, route }: Props) {
  const { colors, layout } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { appLanguage, bibleMode, setBibleMode } = usePreferences();
  const bookNameLanguage = bookNameLanguageFor(bibleMode, appLanguage);
  const [tab, setTab] = useRouteTab(route.params?.tab, 'read');
  const [choosingLanguage, setChoosingLanguage] = useState(false);

  const position = useSavedReadingPosition();
  const lastBook = position ? getBookById(position.bookId) : undefined;
  // Opens on the testament last read; the member's own choice, once made, wins.
  const [chosen, setChosen] = useState<Testament | null>(null);
  const testament: Testament = chosen ?? (lastBook?.testament === 'NT' ? 'NT' : 'OT');
  const books: BibleBook[] =
    testament === 'NT' ? NEW_TESTAMENT_BOOKS : OLD_TESTAMENT_BOOKS;

  const modeName = (mode: BibleMode) =>
    t(
      mode === 'te'
        ? 'bible.modeTelugu'
        : mode === 'en'
          ? 'bible.modeEnglish'
          : 'bible.modeBilingual'
    );

  const header = (
    <>
      <ScreenTitle
        title={t('nav.bible')}
        trailing={
          <IconButton
            testID="bible-search-nav-button"
            accessibilityLabel={t('common.search')}
            onPress={() => navigation.navigate('BibleSearch')}
          >
            <Icon name="search" size={24} />
          </IconButton>
        }
      />
      <UnderlineTabs
        testID="bible-tabs"
        selected={tab}
        onSelect={setTab}
        tabs={[
          { value: 'read', label: t('bible.tabRead') },
          { value: 'plans', label: t('bible.tabPlans') },
        ]}
      />
    </>
  );

  return (
    <View
      testID="bible-home"
      style={[styles.screen, { backgroundColor: colors.paper, paddingTop: insets.top }]}
    >
      {tab === 'plans' ? (
        <PlansView
          header={header}
          onOpenPlan={(plan) => navigation.navigate('PlanDetail', { plan })}
        />
      ) : (
        // A plain ScrollView, not a virtualised list, on purpose: the books are a small,
        // fixed set (at most 39 rows), so there is nothing to window, and every book
        // is reliably present -- for a test, for a screen reader, and for a fast scroll.
        <ScrollView
          testID="bible-books-list"
          contentContainerStyle={{ paddingBottom: 32 }}
        >
          <ReadHeader
            header={header}
            hasPosition={position !== null}
            testament={testament}
            onTestament={setChosen}
            languageLabel={modeName(bibleMode)}
            onChooseLanguage={() => setChoosingLanguage(true)}
            onContinue={(bookId, chapterNumber, verse) =>
              navigation.navigate('BibleChapter', { bookId, chapterNumber, verse })
            }
          />
          {books.map((book) => (
            <View key={book.id} style={{ paddingHorizontal: layout.screenMargin }}>
              <BookRow
                testID={`book-${book.id}`}
                book={book}
                name={getBookName(book, bookNameLanguage)}
                current={book.id === lastBook?.id}
                onPress={() => navigation.navigate('BibleChapters', { bookId: book.id })}
              />
            </View>
          ))}
        </ScrollView>
      )}

      <ChoiceSheet
        visible={choosingLanguage}
        testID="bible-language-sheet"
        title={t('settings.bibleLanguage')}
        help={t('settings.bibleLanguageHelp')}
        closeLabel={t('common.close')}
        options={[
          { value: 'te', label: t('bible.modeTelugu') },
          { value: 'en', label: t('bible.modeEnglish') },
          { value: 'bilingual', label: t('bible.modeBilingual') },
        ]}
        current={bibleMode}
        optionTestID={(value) => `bible-language-${value}`}
        onClose={() => setChoosingLanguage(false)}
        onChoose={(value) => {
          setChoosingLanguage(false);
          void setBibleMode(value as BibleMode);
        }}
      />
    </View>
  );
}

/** What sits above the book rows on the Read tab: the hub header, where you left off, the Books label with the language pill, and the testament choice. */
function ReadHeader({
  header,
  hasPosition,
  testament,
  onTestament,
  languageLabel,
  onChooseLanguage,
  onContinue,
}: {
  header: ReactNode;
  hasPosition: boolean;
  testament: Testament;
  onTestament: (testament: Testament) => void;
  languageLabel: string;
  onChooseLanguage: () => void;
  onContinue: (bookId: string, chapter: number, verse: number) => void;
}) {
  const { colors, layout, type } = useTheme();
  const { t } = useTranslation();
  const pad = { paddingHorizontal: layout.screenMargin };
  return (
    <View>
      <View style={pad}>{header}</View>
      <View style={pad}>
        <ContinueReading style={styles.continue} onOpen={onContinue} />
        <View style={[styles.booksHead, hasPosition ? styles.booksHeadAfter : null]}>
          <Text
            accessibilityRole="header"
            style={[type.overline, { color: colors.inkMuted }]}
          >
            {t('bible.booksLabel')}
          </Text>
          <Tappable
            testID="bible-language-pill"
            accessibilityRole="button"
            accessibilityLabel={`${t('settings.bibleLanguage')}: ${languageLabel}`}
            onPress={onChooseLanguage}
            style={styles.pill}
          >
            <Text style={[styles.pillText, { color: colors.accent }]}>
              {languageLabel}
            </Text>
            <Icon name="chevd" size={16} color={colors.accent} />
          </Tappable>
        </View>
        <SegmentedChoice
          testID="bible-testament"
          accessibilityLabel={t('bible.booksLabel')}
          options={[
            { value: 'OT' as Testament, label: t('bible.oldTestament') },
            { value: 'NT' as Testament, label: t('bible.newTestament') },
          ]}
          selected={testament}
          onSelect={onTestament}
        />
        <View style={[styles.rule, { borderTopColor: colors.border }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  continue: { marginTop: 20 },
  booksHead: {
    marginTop: 20,
    marginBottom: 4,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  booksHeadAfter: { marginTop: 28 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44 },
  pillText: {
    fontFamily: fontFamilies.interfaceSemiBold,
    fontWeight: '600',
    fontSize: 13.5,
    lineHeight: 20,
  },
  rule: { borderTopWidth: 1, marginTop: 12 },
});
