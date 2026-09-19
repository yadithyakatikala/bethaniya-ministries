import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconButton } from '../../../theme/ui/IconButton';
import { AppButton } from '../../../theme/ui/AppButton';
import { Tappable } from '../../../theme/ui/Tappable';
import { ChevronIcon } from '../../../theme/ui/FeatureIcons';
import { ReaderSettingsIcon } from '../../../theme/ui/ReaderIcons';
import { useTheme, useTypographyFor } from '../../../theme';
import { useTranslation } from '../../../i18n';
import type { BibleLanguage } from '../types';

/**
 * The reader's chrome: a top bar and a bottom bar, both OVERLAYS.
 *
 * WHY OVERLAYS AND NOT LAYOUT. The brief's rule is that chrome must not
 * permanently consume screen space. Two absolutely-positioned bars over
 * the scroll view mean the page is full height at all times and the
 * bars simply appear on top of it -- nothing reflows when they show or
 * hide, so the reader's place on the page never shifts under them. The
 * scroll view pads its content by the bars' height instead, so the first
 * and last verses are reachable whether the bars are showing or not.
 *
 * WHY CONDITIONAL RATHER THAN FADED OUT. A bar faded to zero opacity is
 * still a screen-reader stop and still takes taps unless every one of
 * those is disabled by hand. Unmounting it is the honest version of
 * hidden, and it is what makes "the chrome is not visible while reading"
 * something a test can assert.
 */
export function ReaderTopBar({
  reference,
  bookNameLanguage,
  onBack,
  onOpenSettings,
}: {
  /** "Genesis 1", already localized by the caller. */
  reference: string;
  /** The script `reference` is written in -- it contains a book name. */
  bookNameLanguage: BibleLanguage;
  onBack: () => void;
  onOpenSettings: () => void;
}) {
  const { colors, spacing } = useTheme();
  // The reference carries a BOOK NAME, so its type follows the book
  // name's language, not the interface's: Noto Serif has no Telugu
  // glyphs, and "దినవృత్తాంతములు మొదటి గ్రంథము" set in it falls apart into
  // per-glyph platform fallbacks. This was a real M3 defect.
  const referenceType = useTypographyFor(bookNameLanguage);
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <View
      testID="reader-top-bar"
      style={[
        styles.bar,
        styles.topBar,
        {
          backgroundColor: colors.surface,
          borderBottomColor: colors.border,
          paddingTop: insets.top + spacing.sm,
          paddingBottom: spacing.sm,
          paddingHorizontal: spacing.md,
        },
      ]}
    >
      <IconButton
        testID="reader-back-button"
        accessibilityLabel={t('common.back')}
        onPress={onBack}
      >
        <ChevronIcon color={colors.ink} direction="left" />
      </IconButton>
      <Text
        testID="reader-reference"
        style={[referenceType.title, styles.reference, { color: colors.ink }]}
        numberOfLines={2}
      >
        {reference}
      </Text>
      <IconButton
        testID="reader-settings-button"
        accessibilityLabel={t('bible.readingSettings')}
        onPress={onOpenSettings}
      >
        <ReaderSettingsIcon color={colors.ink} />
      </IconButton>
    </View>
  );
}

/**
 * Previous chapter, the chapter selector, next chapter.
 *
 * The selector in the MIDDLE is deliberate: it is the control a reader
 * reaches for least often and the one whose mis-tap costs most (it opens
 * a sheet over the page), so it sits away from the two thumb corners
 * where prev/next live.
 *
 * IT SHOWS THE CHAPTER NUMBER, NOT THE BOOK NAME. Visual QA caught the
 * reason: with the longest Telugu book name
 * ("దినవృత్తాంతములు మొదటి గ్రంథము") the selector grew wide enough to push
 * "Next" off the edge of the bar. The book is named in the top bar
 * directly above -- the two bars show and hide together -- so repeating
 * it here was redundant as well as fragile. The full reference is still
 * what a screen reader announces.
 */
export function ReaderBottomBar({
  chapterNumber,
  reference,
  isFirstChapter,
  isLastChapter,
  onPrevious,
  onNext,
  onOpenChapterPicker,
}: {
  chapterNumber: number;
  /** The full reference -- announced, not printed. */
  reference: string;
  isFirstChapter: boolean;
  isLastChapter: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onOpenChapterPicker: () => void;
}) {
  const { colors, radii, spacing, type, minTouchTarget } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <View
      testID="reader-bottom-bar"
      style={[
        styles.bar,
        styles.bottomBar,
        {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          paddingTop: spacing.sm,
          paddingBottom: Math.max(insets.bottom, spacing.sm),
          paddingHorizontal: spacing.md,
        },
      ]}
    >
      <View style={styles.navButton}>
        <AppButton
          title={t('bible.previous')}
          variant="secondary"
          fullWidth
          testID="previous-chapter-button"
          disabled={isFirstChapter}
          onPress={onPrevious}
        />
      </View>
      <Tappable
        testID="chapter-selector-button"
        accessibilityRole="button"
        accessibilityLabel={`${t('bible.chapterSelector')}. ${reference}`}
        onPress={onOpenChapterPicker}
        style={[
          styles.selector,
          {
            minHeight: minTouchTarget,
            borderRadius: radii.control,
            backgroundColor: colors.primaryTint,
            paddingHorizontal: spacing.md,
          },
        ]}
      >
        <Text
          style={[type.label, styles.selectorLabel, { color: colors.primary }]}
          numberOfLines={1}
        >
          {chapterNumber}
        </Text>
        <Text style={[type.caption, { color: colors.inkMuted }]} numberOfLines={1}>
          {t('bible.selectChapter')}
        </Text>
      </Tappable>
      <View style={styles.navButton}>
        <AppButton
          title={t('bible.next')}
          variant="secondary"
          fullWidth
          testID="next-chapter-button"
          disabled={isLastChapter}
          onPress={onNext}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  topBar: { top: 0, borderBottomWidth: StyleSheet.hairlineWidth },
  bottomBar: { bottom: 0, borderTopWidth: StyleSheet.hairlineWidth },
  // flex + two lines: a Telugu book name is about twice its English
  // length and must wrap rather than shove the settings control off the
  // row. See the M2 header fix this carries forward.
  reference: { flex: 1, textAlign: 'center' },
  // Equal thirds that can all shrink: a Telugu "మునుపటి"/"తదుపరి" pair is
  // wider than "Previous"/"Next", and nothing in this row may push a
  // control off the bar.
  navButton: { flex: 1, flexShrink: 1 },
  selector: { flexShrink: 1, alignItems: 'center', justifyContent: 'center' },
  selectorLabel: { textAlign: 'center' },
});
