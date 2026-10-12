import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppButton, Icon, IconButton, Tappable, useTheme } from '../../../theme';
import { fontFamilies, serifFor } from '../../../theme/tokens';
import { useTranslation } from '../../../i18n';
import type { BibleLanguage } from '../types';

/**
 * The reader's chrome: a top bar and a floating pair of chapter buttons, all
 * OVERLAYS.
 *
 * WHY OVERLAYS AND NOT LAYOUT. The brief's rule is that chrome must not
 * permanently consume screen space. Absolutely-positioned controls over the
 * scroll view mean the page is full height at all times and the controls
 * simply appear on top of it -- nothing reflows when they show or hide, so the
 * reader's place on the page never shifts under them. The scroll view pads its
 * content by the clearances below instead, so the first and last verses are
 * reachable whether the controls are showing or not.
 *
 * WHY CONDITIONAL RATHER THAN FADED OUT. A control faded to zero opacity is
 * still a screen-reader stop and still takes taps unless every one of those is
 * disabled by hand. Unmounting it is the honest version of hidden, and it is
 * what makes "the chrome is not visible while reading" something a test can
 * assert.
 *
 * WHAT THE TOP BAR HOLDS (approved design): Back; the place -- "John 3", which
 * is also the way to another chapter, so it carries a chevron; the Bible's
 * language as a small code ("EN", "తె", "EN + తె") with its own chevron, which
 * opens the one sheet where that is chosen; then Search and the text settings.
 * Previous and next chapter are not in a bar at all: two round buttons float at
 * the foot, one at each thumb, and a plan's chip sits above them.
 */

/** How far below the status bar the page's first line starts: the bar, and air. */
export const TOP_CHROME_SPACE = 74;

const FAB = 48;
const FAB_TO_CHIP = 14;
const CHIP = 64;

/** Where the floating chapter buttons sit above the bottom of the screen. */
export function floatingBottom(insetBottom: number): number {
  return Math.max(insetBottom - 4, 16);
}

/**
 * Room the page keeps beneath its last line, so the final verse can scroll
 * clear of the floating controls (and of a plan's chip, when there is one).
 */
export function bottomClearance(insetBottom: number, withPlanChip: boolean): number {
  return floatingBottom(insetBottom) + FAB + 72 + (withPlanChip ? CHIP + FAB_TO_CHIP : 0);
}

/** Where a notice floats from: just above the controls it must not cover. */
export function noticeBottom(insetBottom: number, withPlanChip: boolean): number {
  return (
    floatingBottom(insetBottom) +
    FAB +
    FAB_TO_CHIP +
    (withPlanChip ? CHIP + FAB_TO_CHIP : 0)
  );
}

export function ReaderTopBar({
  reference,
  bookNameLanguage,
  languageCode,
  languageName,
  onBack,
  onOpenChapters,
  onOpenLanguage,
  onOpenSearch,
  onOpenSettings,
}: {
  /** "Genesis 1", already localized by the caller. */
  reference: string;
  /** The script `reference` is written in -- it contains a book name. */
  bookNameLanguage: BibleLanguage;
  /** What the language pill prints: "EN", "తె", "EN + తె". */
  languageCode: string;
  /** What it means, for a screen reader: "English". */
  languageName: string;
  onBack: () => void;
  onOpenChapters: () => void;
  onOpenLanguage: () => void;
  onOpenSearch: () => void;
  onOpenSettings: () => void;
}) {
  const { colors, radii } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  // A Telugu book name needs more leading than Latin at the same size, or its
  // vowel signs clip -- and it is set in the interface family, which covers
  // both scripts ("1 దినవృత్తాంతములు" has a digit in it).
  const lineHeight = bookNameLanguage === 'te' ? 24 : 18;

  return (
    <View
      testID="reader-top-bar"
      style={[
        styles.topBar,
        {
          backgroundColor: colors.surface,
          borderBottomColor: colors.border,
          paddingTop: insets.top + 6,
        },
      ]}
    >
      <IconButton
        testID="reader-back-button"
        accessibilityLabel={t('common.back')}
        onPress={onBack}
      >
        <Icon name="back" size={24} />
      </IconButton>

      <View
        style={[
          styles.place,
          { backgroundColor: colors.surfaceRaised, borderRadius: radii.pill },
        ]}
      >
        <Tappable
          testID="chapter-selector-button"
          accessibilityRole="button"
          accessibilityLabel={`${t('bible.chapterSelector')}. ${reference}`}
          onPress={onOpenChapters}
          style={styles.placeButton}
        >
          <Text
            testID="reader-reference"
            numberOfLines={1}
            style={[styles.placeText, { color: colors.ink, lineHeight }]}
          >
            {reference}
          </Text>
          <Icon name="chevd" size={16} color={colors.inkMuted} />
        </Tappable>
        <View style={[styles.placeDivider, { backgroundColor: colors.border }]} />
        <Tappable
          testID="reader-language-button"
          accessibilityRole="button"
          accessibilityLabel={`${t('settings.bibleLanguage')}: ${languageName}`}
          onPress={onOpenLanguage}
          style={styles.languageButton}
        >
          <Text numberOfLines={1} style={[styles.languageText, { color: colors.ink }]}>
            {languageCode}
          </Text>
          <Icon name="chevd" size={14} color={colors.inkMuted} />
        </Tappable>
      </View>

      <View style={styles.spacer} />

      <IconButton
        testID="reader-search-button"
        accessibilityLabel={t('common.search')}
        onPress={onOpenSearch}
      >
        <Icon name="search" size={24} />
      </IconButton>
      <IconButton
        testID="reader-settings-button"
        accessibilityLabel={t('bible.readingSettings')}
        onPress={onOpenSettings}
      >
        {/* "Aa": a large A and a small a -- the text-settings mark. Drawn as
            type rather than as an icon, as in the design. */}
        <Text style={[styles.aa, { color: colors.ink }]}>
          A<Text style={styles.aaSmall}>a</Text>
        </Text>
      </IconButton>
    </View>
  );
}

/**
 * Previous chapter and next chapter: two round buttons, one at each side of the
 * foot of the screen. A button with nowhere to go (the first chapter of a book,
 * the last) stays where it is, in the muted ink and announced as unavailable --
 * the pair does not rearrange.
 */
export function ReaderFloatingNav({
  isFirstChapter,
  isLastChapter,
  onPrevious,
  onNext,
}: {
  isFirstChapter: boolean;
  isLastChapter: boolean;
  onPrevious: () => void;
  onNext: () => void;
}) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const button = (
    testID: string,
    label: string,
    icon: 'back' | 'chev',
    disabled: boolean,
    onPress: () => void
  ) => (
    <Tappable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.fab,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <Icon name={icon} size={24} color={disabled ? colors.inkSubtle : colors.ink} />
    </Tappable>
  );

  return (
    // box-none: the row itself takes no touches, so a tap between the two
    // buttons still reaches the page and hides the chrome.
    <View
      testID="reader-bottom-bar"
      pointerEvents="box-none"
      style={[styles.fabRow, { bottom: floatingBottom(insets.bottom) }]}
    >
      {button(
        'previous-chapter-button',
        t('bible.previous'),
        'back',
        isFirstChapter,
        onPrevious
      )}
      {button('next-chapter-button', t('bible.next'), 'chev', isLastChapter, onNext)}
    </View>
  );
}

/**
 * The plan a reading was opened from: which day, which plan, and the one thing
 * to do when the passage has been read -- Mark Complete. It sits above the
 * chapter buttons and goes with the rest of the chrome when the page is tapped.
 */
export function ReaderPlanChip({
  title,
  progress,
  completed,
  busy,
  onMarkComplete,
}: {
  title: string;
  /** "Day 2 of 7". */
  progress: string;
  /** The day is already marked: the button gives way to a tick and the word. */
  completed: boolean;
  busy: boolean;
  onMarkComplete: () => void;
}) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <View
      testID="reader-plan-chip"
      style={[
        styles.chip,
        {
          bottom: floatingBottom(insets.bottom) + FAB + FAB_TO_CHIP,
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
      ]}
    >
      <View
        accessible
        accessibilityLabel={`${progress}. ${title}`}
        style={styles.chipText}
      >
        <Text style={[styles.chipOverline, { color: colors.accent }]} numberOfLines={1}>
          {progress}
        </Text>
        <Text style={[styles.chipTitle, { color: colors.ink }]} numberOfLines={1}>
          {title}
        </Text>
      </View>
      {completed ? (
        <View style={styles.chipDone} testID="reader-plan-completed">
          <Icon name="check" size={18} color={colors.ink} />
          <Text style={[styles.chipDoneText, { color: colors.ink }]}>
            {t('plans.completed')}
          </Text>
        </View>
      ) : (
        <AppButton
          testID="reader-plan-complete-button"
          title={t('plans.markComplete')}
          compact
          loading={busy}
          onPress={onMarkComplete}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    minHeight: 60,
    paddingBottom: 6,
    paddingLeft: 4,
    paddingRight: 8,
    borderBottomWidth: 1,
  },
  // The place and the language, as one pill with a hairline between them. It
  // shrinks before anything else does: a Telugu book name ellipsizes rather than
  // pushing Search or the text settings off the row.
  place: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    paddingHorizontal: 4,
    marginLeft: 2,
    flexShrink: 1,
    minWidth: 0,
  },
  placeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
    paddingLeft: 12,
    paddingRight: 10,
    flexShrink: 1,
    minWidth: 0,
  },
  placeText: {
    flexShrink: 1,
    fontFamily: fontFamilies.interfaceSemiBold,
    fontWeight: '600',
    fontSize: 15,
  },
  placeDivider: { width: 1, height: 20 },
  languageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 44,
    paddingHorizontal: 10,
  },
  languageText: {
    fontFamily: fontFamilies.interfaceSemiBold,
    fontWeight: '600',
    fontSize: 14,
    lineHeight: 20,
  },
  spacer: { flex: 1 },
  aa: { fontFamily: serifFor('en', 'semiBold'), fontWeight: '600', fontSize: 19 },
  aaSmall: { fontSize: 13 },
  fabRow: {
    position: 'absolute',
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fab: {
    width: FAB,
    height: FAB,
    borderRadius: FAB / 2,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chip: {
    position: 'absolute',
    left: 20,
    right: 20,
    minHeight: CHIP,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingLeft: 16,
    paddingRight: 10,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipText: { flex: 1, minWidth: 0 },
  chipOverline: {
    fontFamily: fontFamilies.interfaceSemiBold,
    fontWeight: '600',
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  chipTitle: {
    fontFamily: fontFamilies.interfaceSemiBold,
    fontWeight: '600',
    fontSize: 14,
    lineHeight: 20,
  },
  chipDone: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8 },
  chipDoneText: {
    fontFamily: fontFamilies.interfaceSemiBold,
    fontWeight: '600',
    fontSize: 14,
    lineHeight: 20,
  },
});
