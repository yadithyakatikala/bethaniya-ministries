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
 * ---------------------------------------------------------------------
 * IT USED TO RENDER NOTHING WHEN EMPTY. THAT WAS THE BUG.
 * ---------------------------------------------------------------------
 * M5 decided that a church with no prophet verse should simply not have
 * this section, so the empty state returned null. The reasoning was
 * sound for a church that has chosen not to use the feature; it was
 * wrong for every church that has not published one YET, which is all of
 * them on day one. A tester looked for "Prophet Verse of the Day" in the
 * release build and reported it missing -- the feature was complete and
 * literally invisible, indistinguishable from never having been built.
 *
 * So an empty prophet verse now renders a quiet card that names the
 * section and says there is none today. It is a SECOND, clearly labelled
 * block under the Verse of the Day, never a replacement for it: the
 * verse above keeps its own bundled fallback and is untouched by
 * anything here.
 *
 * Nothing is invented to fill the space. The card says the church has
 * not shared one; it does not manufacture a devotional, for the same
 * reason ../plans/seedPlans.ts marks its own text as app-created.
 *
 * A FAILED READ still renders the same empty card rather than an error:
 * a member cannot act on a Firestore failure, and the Verse of the Day
 * above is unaffected either way.
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
  if (state.status === 'empty') return <ProphetVerseEmpty />;

  return <ProphetVerseBody verse={state.verse} />;
}

/**
 * The section, named, with nothing in it yet.
 *
 * Carries the same overline as a real prophet verse, so a member can see
 * that this is a distinct block from the Verse of the Day above it
 * rather than a second, broken copy of it.
 */
function ProphetVerseEmpty() {
  const { colors, spacing, type } = useTheme();
  const { t } = useTranslation();
  return (
    <Card testID="prophet-verse-empty">
      <View style={{ gap: spacing.xs }}>
        <Text style={[type.overline, { color: colors.accent }]}>
          {t('prophetVerse.title')}
        </Text>
        <Text style={[type.title, { color: colors.ink }]}>{t('prophetVerse.empty')}</Text>
        <Text style={[type.bodySmall, { color: colors.inkMuted }]}>
          {t('prophetVerse.emptyMessage')}
        </Text>
      </View>
    </Card>
  );
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
