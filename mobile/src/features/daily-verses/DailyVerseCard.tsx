import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { AppButton } from '../../theme/ui/AppButton';
import { Card } from '../../theme/ui/Card';
import { EmptyState } from '../../theme/ui/EmptyState';
import { LoadingState } from '../../theme/ui/LoadingState';
import { useTheme, useTypographyFor } from '../../theme';
import { scriptureStyle } from '../../theme/tokens';
import { useTranslation } from '../../i18n';
import { useVerseOfTheDay } from './useVerseOfTheDay';
import {
  buildVotdCopyText,
  buildVotdShareText,
  copyText,
  shareText,
} from './votdSharing';
import type { VotdBody, VotdContent } from './votdResolver';

/**
 * Today's verse, on the Home screen.
 *
 * WHAT CHANGED IN M5. The card used to read one Firestore document and
 * render whatever it found, so a day no administrator had filled in was
 * an empty card. It now renders whatever ./useVerseOfTheDay.ts resolves
 * -- an administrator's override first, then the automated pool, then a
 * bundled verse when there is no network at all -- so the card is
 * effectively never empty. Same testIDs, same place on the Home screen:
 * this is the existing experience upgraded, not a second one beside it.
 *
 * The card also drops the deprecated `colors.background/text/
 * secondaryText` aliases and its own hardcoded padding and radius, which
 * pre-dated M3's design system, and gains the M4 share/copy actions
 * rather than a second sharing implementation (see ./votdSharing.ts).
 *
 * ---------------------------------------------------------------------
 * WHICH TYPEFACE, AND WHY IT DEPENDS ON WHERE THE TEXT CAME FROM
 * ---------------------------------------------------------------------
 * ../../theme/tokens.ts states the rule: Firestore content is of UNKNOWN
 * script and must use an interface role, never a serif one, because Noto
 * Serif Telugu contains no Latin letters and Noto Serif no Telugu ones --
 * so a mixed-script string set in either drops half its characters to a
 * substituted face mid-sentence.
 *
 * M5 splits that rule, because the two paths genuinely differ:
 *
 *   POOL / FALLBACK   the text came from the BUNDLED corpus, so its
 *                     language is known and it is single-script. It gets
 *                     the matching scripture serif -- the same face the
 *                     Bible reader sets it in.
 *   OVERRIDE          an administrator typed it. It may be Telugu, or
 *                     English, or Telugu with an English name in it, so
 *                     it gets the interface family (which covers both
 *                     scripts) at the detected script's leading.
 *
 * That is the honest form of the rule, not a relaxation of it.
 */
export function DailyVerseCard() {
  const state = useVerseOfTheDay();
  const { t } = useTranslation();

  if (state.status === 'loading') {
    return (
      <Card testID="daily-verse-loading">
        <LoadingState label={t('dailyVerse.loading')} compact />
      </Card>
    );
  }

  if (state.status === 'empty') {
    // Reached only if even the bundled fallback could not be resolved --
    // which a test guards against. Nothing is invented to fill the gap.
    return (
      <EmptyState
        testID="daily-verse-empty"
        title={t('dailyVerse.title')}
        message={t('dailyVerse.unavailable')}
      />
    );
  }

  return <VerseBody content={state.content} />;
}

function VerseBody({ content }: { content: VotdContent }) {
  const { colors, spacing, radii, type } = useTheme();
  const { t } = useTranslation();
  const [notice, setNotice] = useState<string | null>(null);

  async function onShare() {
    // A dismissed share and a failed one are both "nothing happened";
    // only a failure says anything. See ../bible/reader/verseSharing.ts.
    const ok = await shareText(buildVotdShareText(content));
    setNotice(ok ? null : t('bible.shareFailed'));
  }

  async function onCopy() {
    const ok = await copyText(buildVotdCopyText(content));
    setNotice(ok ? t('bible.copied') : t('bible.copyFailed'));
  }

  return (
    <Card testID="daily-verse-card" style={{ gap: spacing.md }}>
      {content.imageUrl ? (
        <Image
          source={{ uri: content.imageUrl }}
          style={[styles.image, { borderRadius: radii.chip }]}
          testID="daily-verse-image"
          accessibilityIgnoresInvertColors
          accessible
          accessibilityRole="image"
          accessibilityLabel={t('dailyVerse.imageLabel')}
        />
      ) : null}

      <VerseText body={content.body} isOverride={content.citation === null} />

      {content.body.kind === 'englishOnly' ? (
        // Bilingual mode was asked for, but this verse cannot be paired.
        // WHICH of the two reasons it is matters: the Telugu Bible either
        // has no text here at all, or has it and divides the chapter
        // differently. Saying the wrong one is saying something false, so
        // the M1 policy's own notice picks the sentence. See
        // ../bible/alignment.ts.
        <Text
          testID="daily-verse-not-in-translation"
          style={[type.caption, styles.notice, { color: colors.inkMuted }]}
        >
          {content.body.notice === 'numberingDiffers'
            ? t('bible.numberingDiffers')
            : t('bible.notInTranslation')}
        </Text>
      ) : null}

      <Text
        testID="daily-verse-reference"
        style={[type.scriptureReference, { color: colors.accent }]}
      >
        {content.reference}
      </Text>

      <View style={[styles.actions, { gap: spacing.sm }]}>
        <AppButton
          title={t('bible.share')}
          variant="text"
          onPress={() => void onShare()}
          testID="daily-verse-share"
        />
        <AppButton
          title={t('bible.copy')}
          variant="text"
          onPress={() => void onCopy()}
          testID="daily-verse-copy"
        />
      </View>

      {notice ? (
        // A live region, so a screen reader announces "Copied" instead of
        // the user having to go looking for the confirmation.
        <Text
          testID="daily-verse-notice"
          accessibilityLiveRegion="polite"
          style={[type.caption, { color: colors.inkMuted }]}
        >
          {notice}
        </Text>
      ) : null}
    </Card>
  );
}

/**
 * The verse itself. A paired bilingual verse is TWO Text nodes, each in
 * its own language's face -- never one node carrying both scripts, for
 * the reason in this file's header.
 */
function VerseText({ body, isOverride }: { body: VotdBody; isOverride: boolean }) {
  const { colors, spacing } = useTheme();
  // Hooks cannot be called conditionally, so this resolves for every body
  // kind and is used only for an override.
  const overrideType = useTypographyFor(body.kind === 'text' ? body.language : 'en');

  if (body.kind === 'paired') {
    return (
      <View style={{ gap: spacing.md }}>
        <Text
          testID="daily-verse-english"
          style={[scriptureStyle('en'), { color: colors.ink }]}
        >
          {body.english}
        </Text>
        <Text
          testID="daily-verse-telugu"
          style={[scriptureStyle('te'), { color: colors.ink }]}
        >
          {body.telugu}
        </Text>
      </View>
    );
  }

  if (body.kind === 'englishOnly') {
    return (
      <Text
        testID="daily-verse-english"
        style={[scriptureStyle('en'), { color: colors.ink }]}
      >
        {body.english}
      </Text>
    );
  }

  return (
    <Text
      testID="daily-verse-text"
      style={[
        isOverride ? overrideType.bodyLarge : scriptureStyle(body.language),
        { color: colors.ink },
      ]}
    >
      {body.text}
    </Text>
  );
}

const styles = StyleSheet.create({
  image: { width: '100%', aspectRatio: 16 / 9 },
  notice: { fontStyle: 'italic' },
  actions: { flexDirection: 'row', alignItems: 'center' },
});
