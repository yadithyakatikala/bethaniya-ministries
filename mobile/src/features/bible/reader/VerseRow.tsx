import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { Tappable } from '../../../theme/ui/Tappable';
import { Icon, useTheme } from '../../../theme';
import type { VerseAnnotation } from './useVerseAnnotations';

/** The indicator glyphs sit in the number gutter, so they must be small. */
const INDICATOR_SIZE = 14;

/**
 * One verse: its number, its text, and whatever the member has done
 * to it.
 *
 * SELECTION IS NEVER COLOUR ALONE. A selected verse gets a left rule as
 * well as a tint -- a 3dp bar is visible without colour vision, and the
 * row reports `accessibilityState.selected` so a screen reader says so.
 * The same rule applies to the highlight and note indicators: they are
 * distinct SHAPES in the gutter (a ribbon, a page) and each contributes
 * a spoken word to the row's accessibility label, so nothing about a
 * verse's state is carried by hue.
 *
 * IT IS A BUTTON, not a text block with a tap handler. That is what
 * makes it a stop for a screen reader and what makes "tap a verse to act
 * on it" discoverable rather than a hidden gesture.
 *
 * The children are the verse TEXT -- one Text for a single translation,
 * two for a paired bilingual row. This component deliberately knows
 * nothing about which, so there is one definition of what a verse row
 * looks like rather than two that drift.
 */
export function VerseRow({
  label,
  annotation,
  selected,
  onPress,
  stateLabels,
  textForAccessibility,
  numberLineHeight = 20,
  onLayout,
  children,
  testID,
}: {
  /** "16", or "39-40" for a merged Telugu range. */
  label: string;
  annotation: VerseAnnotation;
  selected: boolean;
  onPress: () => void;
  /** Translated words for highlighted / bookmarked / has-a-note. */
  stateLabels: string[];
  textForAccessibility: string;
  /**
   * The line height of the verse's text, which the number is set on too: its
   * line box is as tall as the text's, so the number sits on the first line
   * (at the size of the text, with Telugu's extra leading) instead of riding
   * above it.
   */
  numberLineHeight?: number;
  onLayout?: (event: LayoutChangeEvent) => void;
  children: ReactNode;
  testID?: string;
}) {
  const { colors, spacing, type, highlights, reading } = useTheme();

  const highlightTint = annotation.highlight ? highlights[annotation.highlight] : null;

  return (
    <Tappable
      testID={testID}
      onLayout={onLayout}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      // The number first, then the text, then the states: a screen
      // reader should say which verse this is before reading it.
      accessibilityLabel={[label, textForAccessibility, ...stateLabels].join('. ')}
      onPress={onPress}
      style={[
        styles.row,
        {
          // A few points, not none: the column is only wide enough for "39-40"
          // (see readingScale.verseNumberColumn), and a merged range must not
          // touch the first word.
          gap: 4,
          // Nearly square, as the approved page draws a highlight band.
          borderRadius: 2,
          // Negative margin against the padding, so a highlighted row's
          // tint extends past the text column rather than inset from it
          // -- a highlight that stops short of the words reads as a box.
          paddingVertical: spacing.xs,
          paddingHorizontal: spacing.sm,
          marginHorizontal: -spacing.sm,
          backgroundColor:
            highlightTint ?? (selected ? colors.primaryTint : 'transparent'),
          borderLeftWidth: selected ? 3 : 0,
          borderLeftColor: colors.primary,
          paddingLeft: selected ? spacing.sm - 3 : spacing.sm,
        },
      ]}
    >
      <View style={[styles.gutter, { width: reading.verseNumberColumn }]}>
        <Text
          style={[
            type.scriptureReference,
            { color: colors.accent, lineHeight: numberLineHeight },
          ]}
        >
          {label}
        </Text>
        {annotation.bookmarked || annotation.note ? (
          <View style={styles.indicators}>
            {annotation.bookmarked ? (
              <Icon name="bookmarkf" color={colors.accent} size={INDICATOR_SIZE} />
            ) : null}
            {annotation.note ? (
              <Icon name="note" color={colors.accent} size={INDICATOR_SIZE} />
            ) : null}
          </View>
        ) : null}
      </View>
      <View style={styles.body}>{children}</View>
    </Tappable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  // flex-start rather than baseline: the gutter now holds indicators
  // under the number, so the two columns align at their tops.
  gutter: { alignItems: 'flex-start', gap: 2 },
  indicators: { flexDirection: 'row', gap: 2 },
  body: { flex: 1, gap: 4 },
});
