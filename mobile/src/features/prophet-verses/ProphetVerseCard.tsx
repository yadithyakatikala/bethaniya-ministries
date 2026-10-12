import { useState } from 'react';
import { Image, StyleSheet, Text, View, type TextStyle } from 'react-native';
import { GoldBar } from '../../theme/ui/GoldLine';
import { Skeleton } from '../../theme/ui/Skeleton';
import { Tappable } from '../../theme/ui/Tappable';
import { contentFontFamily, useTheme } from '../../theme';
import { useTranslation } from '../../i18n';
import { detectScriptLanguage } from '../daily-verses/votdResolver';
import { useProphetVerse } from './useProphetVerse';
import type { ProphetVerse } from '../../services/firebase/prophetVerses';

/**
 * The Prophet Verse, below the Verse of the Day and the reading position on
 * Home: a quote block under a quiet label.
 *
 * ---------------------------------------------------------------------
 * A QUOTATION, NOT A PROMOTION
 * ---------------------------------------------------------------------
 * This is a devotional passage from the church's leadership, so it gets no
 * badge, no fill, no box and no call to action. What marks it is the way a
 * printed page marks a quotation: a thin gold bar standing at its left, the
 * title in the serif, the reference in gold, the passage beneath.
 *
 * P1 -- FOUR LINES, THEN "READ MORE". A passage can be a sentence or a
 * page, and Home must stay a place you can scroll past in a second, so the
 * text is held to four lines with "Read more" under it when there is more
 * (and "Show less" once opened). Nothing is cut off for good: the whole
 * passage is one tap away, and a short one shows no control at all. How
 * many lines the text WOULD take is measured by an invisible twin that
 * lays the same text out unclamped -- the clamped copy cannot say how much
 * it hid, on both platforms the same way.
 *
 * ---------------------------------------------------------------------
 * IT USED TO RENDER NOTHING WHEN EMPTY. THAT WAS THE BUG.
 * ---------------------------------------------------------------------
 * M5 decided that a church with no prophet verse should simply not have
 * this section, so the empty state returned null. The reasoning was sound
 * for a church that has chosen not to use the feature; it was wrong for
 * every church that has not published one YET, which is all of them on
 * day one. A tester looked for "Prophet Verse of the Day" in the release
 * build and reported it missing -- the feature was complete and literally
 * invisible, indistinguishable from never having been built.
 *
 * So an empty prophet verse renders the same labelled block, in quiet ink,
 * saying there is none today. It is a SECOND, clearly labelled block under
 * the Verse of the Day, never a replacement for it. Nothing is invented to
 * fill the space; a FAILED READ renders the same empty block rather than an
 * error, because a member cannot act on a Firestore failure.
 *
 * THE IMAGE IS OPTIONAL AND COLLAPSES. With no image there is no empty
 * frame -- the quote simply starts under the label. The image is an
 * external https url loaded by the device's own image loader (there is no
 * Cloud Storage bucket on this project's plan; see
 * ../../services/firebase/prophetVerses.ts), and it is decorative: every
 * word a member needs is in the text.
 *
 * TYPEFACE. The words are administrator-written and of unknown script, so
 * they take the serif of the script they are written in, and the interface
 * family (which covers both) when they mix -- the design's rule S5, in
 * ../../theme/scriptFace.ts. See ../daily-verses/DailyVerseCard.tsx.
 */
export const PROPHET_CLAMP_LINES = 4;

export function ProphetVerseCard() {
  const state = useProphetVerse();
  const { t } = useTranslation();

  if (state.status === 'loading') {
    return (
      <View
        testID="prophet-verse-loading"
        accessibilityRole="progressbar"
        accessibilityLabel={t('common.loading')}
        accessibilityState={{ busy: true }}
      >
        <SectionLabel />
        <View style={styles.block}>
          <GoldBar width={2} />
          <View style={styles.skeleton}>
            <Skeleton width="48%" height={20} />
            <Skeleton width="30%" height={13} />
            <Skeleton height={17} />
            <Skeleton width="86%" height={17} />
          </View>
        </View>
      </View>
    );
  }
  if (state.status === 'empty') return <ProphetVerseEmpty />;

  // Keyed by the verse, so "Read more" does not stay open on tomorrow's.
  return <ProphetVerseBody key={state.verse.id} verse={state.verse} />;
}

/**
 * The block's label. It carries the heading role: a screen reader
 * navigating by heading should land on "Prophet Verse", then hear this
 * one's title. It lives with the block (not above it in Home) so a church
 * with no prophet verse has no orphan heading over nothing.
 */
function SectionLabel() {
  const { colors, type } = useTheme();
  const { t } = useTranslation();
  return (
    <Text
      testID="prophet-verse-section-title"
      accessibilityRole="header"
      style={[type.overline, styles.label, { color: colors.inkMuted }]}
    >
      {t('prophetVerse.title')}
    </Text>
  );
}

/**
 * The section, named, with nothing in it yet. The same block as a real
 * verse -- so it reads as a distinct section rather than a second, broken
 * copy of the Verse of the Day above it -- in quiet ink.
 */
function ProphetVerseEmpty() {
  const { colors, type } = useTheme();
  const { t } = useTranslation();
  return (
    <View testID="prophet-verse-empty">
      <SectionLabel />
      <View style={styles.block}>
        <GoldBar width={2} />
        <View style={styles.quote}>
          <Text style={[type.title, styles.emptyTitle, { color: colors.inkMuted }]}>
            {t('prophetVerse.empty')}
          </Text>
          <Text style={[type.bodySmall, { color: colors.inkMuted }]}>
            {t('prophetVerse.emptyMessage')}
          </Text>
        </View>
      </View>
    </View>
  );
}

function ProphetVerseBody({ verse }: { verse: ProphetVerse }) {
  const { colors, radii, type } = useTheme();
  const { t, appLanguage } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  // `null` until the twin has been laid out; then how many lines the whole
  // passage takes at this width.
  const [lineCount, setLineCount] = useState<number | null>(null);
  const overflows = lineCount !== null && lineCount > PROPHET_CLAMP_LINES;

  const textLanguage = detectScriptLanguage(verse.text);
  const titleLanguage = detectScriptLanguage(verse.title);
  const textStyle: TextStyle = {
    fontFamily: contentFontFamily(verse.text, { fallback: appLanguage }),
    fontSize: textLanguage === 'te' ? 16 : 17,
    fontWeight: '400',
    lineHeight: textLanguage === 'te' ? 30 : 28,
    color: colors.ink,
  };
  const titleStyle: TextStyle = {
    fontFamily: contentFontFamily(verse.title, {
      weight: 'semiBold',
      fallback: appLanguage,
    }),
    fontSize: titleLanguage === 'te' ? 19 : 20,
    fontWeight: '600',
    lineHeight: titleLanguage === 'te' ? 32 : 28,
    color: colors.ink,
  };

  return (
    <View testID="prophet-verse-card">
      <SectionLabel />

      {verse.imageUrl ? (
        <Image
          source={{ uri: verse.imageUrl }}
          style={[styles.image, { borderRadius: radii.card }]}
          testID="prophet-verse-image"
          accessibilityIgnoresInvertColors
          accessible
          accessibilityRole="image"
          accessibilityLabel={t('prophetVerse.imageLabel')}
        />
      ) : null}

      <View style={styles.block}>
        <GoldBar width={2} />
        <View style={styles.quote}>
          <Text testID="prophet-verse-title" style={titleStyle}>
            {verse.title}
          </Text>
          {verse.reference ? (
            <Text
              testID="prophet-verse-reference"
              style={[type.label, styles.reference, { color: colors.accent }]}
            >
              {verse.reference}
            </Text>
          ) : null}

          <View style={styles.passage}>
            <Text
              testID="prophet-verse-text"
              style={textStyle}
              numberOfLines={expanded ? undefined : PROPHET_CLAMP_LINES}
            >
              {verse.text}
            </Text>
            {/* The invisible twin: the same words, unclamped, only to count lines. */}
            <Text
              testID="prophet-verse-measure"
              style={[textStyle, styles.measure]}
              onTextLayout={(event) => setLineCount(event.nativeEvent.lines.length)}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              pointerEvents="none"
            >
              {verse.text}
            </Text>
          </View>

          {overflows ? (
            <Tappable
              testID="prophet-verse-toggle"
              accessibilityRole="button"
              accessibilityState={{ expanded }}
              onPress={() => setExpanded((open) => !open)}
              style={styles.toggle}
            >
              <Text style={[type.label, { color: colors.accent }]}>
                {expanded ? t('prophetVerse.showLess') : t('prophetVerse.readMore')}
              </Text>
            </Tappable>
          ) : null}

          {verse.attribution ? (
            <Text
              testID="prophet-verse-attribution"
              style={[type.caption, styles.attribution, { color: colors.inkMuted }]}
            >
              {verse.attribution}
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { marginBottom: 12 },
  // A 3:2 image reads as a photograph of a person without cropping them
  // brutally, and does not read as the Verse of the Day's picture twice.
  image: { width: '100%', aspectRatio: 3 / 2, marginBottom: 16 },
  // The bar (2 across) and the quote beside it: 18 of air, as on a printed page.
  block: { flexDirection: 'row', gap: 18 },
  quote: { flex: 1, minWidth: 0, paddingVertical: 2, gap: 2 },
  skeleton: { flex: 1, gap: 10, paddingVertical: 2 },
  reference: { marginTop: 0 },
  passage: { marginTop: 8 },
  // Laid out exactly as the real text but never seen or touched.
  measure: { position: 'absolute', left: 0, right: 0, top: 0, opacity: 0 },
  toggle: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' },
  attribution: { marginTop: 4 },
  // The heading role, a size down and in quiet ink: there is nothing here to announce.
  emptyTitle: { fontSize: 17, lineHeight: 24 },
});
