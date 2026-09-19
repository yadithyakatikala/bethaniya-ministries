import { Image, StyleSheet, Text, View } from 'react-native';
import { Card } from '../../theme/ui/Card';
import { LoadingState } from '../../theme/ui/LoadingState';
import { useTheme, useTypographyFor } from '../../theme';
import { useTranslation } from '../../i18n';
import { detectScriptLanguage } from '../daily-verses/votdResolver';
import { useProphetVerse } from './useProphetVerse';
import type { ProphetVerse } from '../../services/firebase/prophetVerses';

/**
 * The Prophet Verse, below the Verse of the Day on the Home screen.
 *
 * ---------------------------------------------------------------------
 * RESTRAINT IS THE DESIGN
 * ---------------------------------------------------------------------
 * This is a devotional passage from the church's leadership, not a
 * promotion, so it gets no badge, no accent fill, no call to action and
 * no ribbon. What distinguishes it from the verse above is a quiet
 * overline and a slightly different rhythm -- the same Card surface, the
 * same hairline border as everything else on the screen.
 *
 * WHEN THERE IS NOTHING TO SHOW, NOTHING IS SHOWN. No empty state, no
 * placeholder, no heading standing over a blank card: a church that has
 * not published a prophet verse should simply not have this section, and
 * a member should not have to scroll past an explanation of a feature
 * they are not using. That is also why a failed read renders nothing
 * rather than an error -- the Verse of the Day above has its own bundled
 * fallback and is unaffected.
 *
 * THE IMAGE IS OPTIONAL AND COLLAPSES. With no image there is no empty
 * frame and no reserved space -- the text simply starts at the top of the
 * card. The image is an external https url loaded by the device's own
 * image loader (there is no Cloud Storage bucket on this project's plan;
 * see ../../services/firebase/prophetVerses.ts), and it is decorative:
 * every word a member needs is in the text, so a broken or blocked image
 * costs nothing but the picture.
 */
export function ProphetVerseCard() {
  const state = useProphetVerse();

  if (state.status === 'loading') {
    return (
      <Card testID="prophet-verse-loading">
        <LoadingState compact />
      </Card>
    );
  }
  // Deliberately nothing at all -- see this file's header.
  if (state.status === 'empty') return null;

  return <ProphetVerseBody verse={state.verse} />;
}

function ProphetVerseBody({ verse }: { verse: ProphetVerse }) {
  const { colors, spacing, radii, type } = useTheme();
  const { t } = useTranslation();
  // The text is administrator-written and of unknown script, so it takes
  // an INTERFACE role (which covers Telugu and Latin) at the detected
  // script's leading -- never a serif role. See
  // ../daily-verses/DailyVerseCard.tsx's header for the full rule.
  const contentType = useTypographyFor(detectScriptLanguage(verse.text));

  return (
    <Card testID="prophet-verse-card" style={{ gap: spacing.md }}>
      {verse.imageUrl ? (
        <Image
          source={{ uri: verse.imageUrl }}
          style={[styles.image, { borderRadius: radii.chip }]}
          testID="prophet-verse-image"
          accessibilityIgnoresInvertColors
          accessible
          accessibilityRole="image"
          accessibilityLabel={t('prophetVerse.imageLabel')}
        />
      ) : null}

      <View style={{ gap: spacing.xs }}>
        {/*
          The section's own label lives INSIDE the card, not as a
          SectionHeader above it, so that a church with no prophet verse
          published has no orphan heading standing over nothing. It
          carries the heading role: a screen reader navigating by heading
          should land on "Prophet Verse", then hear this one's title.
        */}
        <Text
          testID="prophet-verse-section-title"
          accessibilityRole="header"
          style={[type.overline, { color: colors.inkMuted }]}
        >
          {t('prophetVerse.title')}
        </Text>
        <Text testID="prophet-verse-title" style={[type.title, { color: colors.ink }]}>
          {verse.title}
        </Text>
        {verse.reference ? (
          <Text
            testID="prophet-verse-reference"
            style={[type.scriptureReference, { color: colors.accent }]}
          >
            {verse.reference}
          </Text>
        ) : null}
      </View>

      <Text
        testID="prophet-verse-text"
        style={[contentType.bodyLarge, { color: colors.ink }]}
      >
        {verse.text}
      </Text>

      {verse.attribution ? (
        <Text
          testID="prophet-verse-attribution"
          style={[type.caption, { color: colors.inkMuted }]}
        >
          {verse.attribution}
        </Text>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  // 3:2 rather than the verse card's 16:9 -- a portrait-ish photograph of
  // a person crops less brutally at 3:2, and the two cards then do not
  // read as the same thing twice.
  image: { width: '100%', aspectRatio: 3 / 2 },
});
