import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { AppButton } from '../../theme/ui/AppButton';
import { EmptyState } from '../../theme/ui/EmptyState';
import { GoldRule } from '../../theme/ui/GoldLine';
import { Icon } from '../../theme/ui/Icon';
import { IconButton } from '../../theme/ui/IconButton';
import { SectionHeader } from '../../theme/ui/SectionHeader';
import { Skeleton } from '../../theme/ui/Skeleton';
import { Tappable } from '../../theme/ui/Tappable';
import { contentFontFamily, useTheme } from '../../theme';
import {
  onPhoto,
  scriptureBilingualStyle,
  scriptureDisplayStyle,
} from '../../theme/tokens';
import { useTranslation } from '../../i18n';
import { formatIsoWeekdayDate } from '../../i18n/locale';
import { useVerseOfTheDay } from './useVerseOfTheDay';
import {
  buildVotdCopyText,
  buildVotdShareText,
  copyText,
  shareText,
} from './votdSharing';
import type { VotdBody, VotdContent, VotdReference } from './votdResolver';

/**
 * Today's verse -- the hero of Home, and of the Verse screen.
 *
 * It is the "open page" of the app: the date, a gold label with a hairline
 * under it, the verse set large in its own script's serif, the reference
 * in gold, and one primary action ("Read chapter") with Share and Copy
 * beside it. No box, no fill: the page itself is the card.
 *
 * WHAT IT RENDERS comes from ./useVerseOfTheDay.ts -- an administrator's
 * override first, then the church's pool, then a bundled verse when there
 * is no network at all -- so it is effectively never empty. All of the
 * deciding is in ./votdResolver.ts; the sharing is ./votdSharing.ts's.
 *
 * FOUR PROPS DECIDE WHAT IT OFFERS, so one component serves both screens:
 *   onSeeAll       Home passes it ("See all" opens the Verse screen); the
 *                  Verse screen does not, because it IS that screen.
 *   onReadChapter  opens the Bible at the verse's chapter. Offered only for
 *                  a verse whose place is known (`content.location`) -- an
 *                  administrator's override is typed text, and is shared
 *                  and copied but never "read in context".
 *   label          the gold word over the rule. Home's is "Verse of the
 *                  day"; the Verse screen, whose top bar already says that,
 *                  says "Today".
 *   imagePlacement where the church's picture goes, when it sent one. On
 *                  Home ('behind', the default) the verse is set ON it, under
 *                  a veil. On the Verse screen ('above') the picture is a
 *                  16:9 block over the date and the verse is set on the page.
 *
 * ---------------------------------------------------------------------
 * WHICH TYPEFACE, AND WHY IT DEPENDS ON WHERE THE TEXT CAME FROM
 * ---------------------------------------------------------------------
 *   POOL / FALLBACK   bundled corpus text: its language is known and it is
 *                     single-script, so it takes the matching scripture
 *                     serif -- the face the Bible reader uses.
 *   OVERRIDE          an administrator typed it. It takes the serif of the
 *                     script it is written in (English, or Telugu), and
 *                     the interface family -- which covers both -- only
 *                     when it MIXES scripts, because Noto Serif Telugu has
 *                     no Latin letters and Noto Serif no Telugu ones, so a
 *                     mixed line set in either would drop half its
 *                     characters to a substituted face mid-sentence. This
 *                     is the design's rule S5, in ../../theme/scriptFace.ts.
 *
 * ---------------------------------------------------------------------
 * A PICTURE FROM THE CHURCH
 * ---------------------------------------------------------------------
 * An override can carry a photograph. The verse is then set on it, white,
 * under a dark veil -- the one place the page becomes a card. The veil is
 * dark enough to hold white words over a white photograph (asserted in
 * ../../theme/__tests__/contrast.test.ts), and gold stays out of it except
 * as the hairline: gold small text cannot be guaranteed over a picture.
 */
export function DailyVerseCard({
  onSeeAll,
  onReadChapter,
  label,
  imagePlacement = 'behind',
}: {
  onSeeAll?: () => void;
  onReadChapter?: (location: VotdReference) => void;
  label?: string;
  imagePlacement?: 'behind' | 'above';
} = {}) {
  const state = useVerseOfTheDay();
  const { t } = useTranslation();

  if (state.status === 'loading') {
    return (
      <View
        testID="daily-verse-loading"
        accessibilityRole="progressbar"
        accessibilityLabel={t('dailyVerse.loading')}
        accessibilityState={{ busy: true }}
      >
        <VerseSkeleton />
      </View>
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

  return (
    <VerseBody
      content={state.content}
      dateKey={state.dateKey}
      onSeeAll={onSeeAll}
      onReadChapter={onReadChapter}
      label={label}
      imagePlacement={imagePlacement}
    />
  );
}

/** The verse's own shape, in grey: a date, a label, four lines, a reference, three controls. */
function VerseSkeleton() {
  const { layout } = useTheme();
  return (
    <View style={styles.card}>
      <Skeleton width={150} height={13} />
      <View style={[styles.labelRow, { height: layout.hit }]}>
        <Skeleton width={120} height={11} />
      </View>
      <Skeleton height={1} />
      <View style={styles.skeletonLines}>
        <Skeleton height={22} />
        <Skeleton width="96%" height={22} />
        <Skeleton width="90%" height={22} />
        <Skeleton width="54%" height={22} />
      </View>
      <View style={styles.skeletonRef}>
        <Skeleton width={90} height={14} />
      </View>
      <View style={styles.actions}>
        <View style={styles.primary}>
          <Skeleton height={layout.button} radius={layout.button / 2} />
        </View>
        <Skeleton width={layout.iconButton} height={layout.iconButton} radius={22} />
        <Skeleton width={layout.iconButton} height={layout.iconButton} radius={22} />
      </View>
    </View>
  );
}

function VerseBody({
  content,
  dateKey,
  onSeeAll,
  onReadChapter,
  label,
  imagePlacement,
}: {
  content: VotdContent;
  dateKey: string;
  onSeeAll?: () => void;
  onReadChapter?: (location: VotdReference) => void;
  label?: string;
  imagePlacement: 'behind' | 'above';
}) {
  const { colors, radii, type } = useTheme();
  const { t, appLanguage } = useTranslation();
  const [notice, setNotice] = useState<string | null>(null);

  // `photo` means "the verse is set ON a picture" -- white words, a veil.
  // A picture ABOVE the verse leaves the verse on the page, in page ink.
  const hasImage = content.imageUrl !== null;
  const photo = hasImage && imagePlacement === 'behind';
  const pictureAbove = hasImage && imagePlacement === 'above';
  // On a photograph every word is white (see the header); otherwise page ink.
  const ink = photo ? onPhoto.ink : colors.ink;
  const quietInk = photo ? onPhoto.ink : colors.inkMuted;
  const location = content.location;
  const canRead = Boolean(onReadChapter && location);

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
    <View
      testID="daily-verse-card"
      style={[
        styles.card,
        // A picture above the verse sits further under the top bar than a date does.
        pictureAbove && styles.cardWithPictureAbove,
        photo && {
          // Wider than the page's margins by 4 on each side, so the picture
          // reads as laid on the page rather than set inside it -- and 10
          // below the header, which the plain page does not need.
          marginTop: 10,
          marginHorizontal: -4,
          paddingHorizontal: 22,
          paddingTop: 20,
          paddingBottom: 22,
          borderRadius: radii.sheet,
          backgroundColor: onPhoto.base,
          overflow: 'hidden',
        },
      ]}
    >
      {content.imageUrl && photo ? (
        <>
          <Image
            source={{ uri: content.imageUrl }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
            testID="daily-verse-image"
            accessibilityIgnoresInvertColors
            accessible
            accessibilityRole="image"
            accessibilityLabel={t('dailyVerse.imageLabel')}
          />
          <View
            testID="daily-verse-veil"
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, { backgroundColor: onPhoto.veil }]}
          />
        </>
      ) : null}
      {content.imageUrl && pictureAbove ? (
        <Image
          source={{ uri: content.imageUrl }}
          style={[
            styles.pictureAbove,
            { borderRadius: radii.card, backgroundColor: colors.surfaceRaised },
          ]}
          resizeMode="cover"
          testID="daily-verse-image"
          accessibilityIgnoresInvertColors
          accessible
          accessibilityRole="image"
          accessibilityLabel={t('dailyVerse.imageLabel')}
        />
      ) : null}

      <Text testID="daily-verse-date" style={[type.bodySmall, { color: quietInk }]}>
        {formatIsoWeekdayDate(dateKey, appLanguage)}
      </Text>
      {/* 44 high with or without "See all", so the label sits at the same
          height on the Verse screen, which has none, as on Home. */}
      <View style={styles.labelRow}>
        <SectionHeader
          title={label ?? t('home.verseOfTheDay')}
          tone={photo ? 'photo' : 'gold'}
          actionLabel={onSeeAll ? t('common.seeAll') : undefined}
          onAction={onSeeAll}
          actionTestID="daily-verse-see-all"
        />
      </View>
      <GoldRule tone={photo ? 'photo' : 'page'} />

      <View style={styles.verse}>
        <VerseText
          body={content.body}
          isOverride={content.source === 'override'}
          ink={ink}
          quietInk={quietInk}
        />
      </View>

      {content.body.kind === 'englishOnly' ? (
        // Bilingual mode was asked for, but this verse cannot be paired.
        // WHICH of the two reasons it is matters: the Telugu Bible either
        // has no text here at all, or has it and divides the chapter
        // differently. Saying the wrong one is saying something false, so
        // the M1 policy's own notice picks the sentence. See
        // ../bible/alignment.ts.
        <Text
          testID="daily-verse-not-in-translation"
          style={[type.caption, styles.notice, { color: quietInk }]}
        >
          {content.body.notice === 'numberingDiffers'
            ? t('bible.numberingDiffers')
            : t('bible.notInTranslation')}
        </Text>
      ) : null}

      <Text
        testID="daily-verse-reference"
        style={[
          type.button,
          styles.reference,
          { color: photo ? onPhoto.ink : colors.accent },
        ]}
      >
        {content.reference}
      </Text>

      <View style={styles.actions}>
        {canRead ? (
          photo ? (
            <ReadChapterOnPhoto
              label={t('home.readChapter')}
              onPress={() => onReadChapter?.(location as VotdReference)}
            />
          ) : (
            <View style={styles.primary}>
              <AppButton
                title={t('home.readChapter')}
                trailingIcon="arrow"
                fullWidth
                onPress={() => onReadChapter?.(location as VotdReference)}
                testID="daily-verse-read"
              />
            </View>
          )
        ) : null}
        <IconButton
          variant="outlined"
          accessibilityLabel={t('bible.share')}
          onPress={() => void onShare()}
          testID="daily-verse-share"
          style={photo ? { borderColor: onPhoto.ring } : undefined}
        >
          <Icon name="share" size={20} color={photo ? onPhoto.ink : undefined} />
        </IconButton>
        <IconButton
          variant="outlined"
          accessibilityLabel={t('bible.copy')}
          onPress={() => void onCopy()}
          testID="daily-verse-copy"
          style={photo ? { borderColor: onPhoto.ring } : undefined}
        >
          <Icon name="copy" size={20} color={photo ? onPhoto.ink : undefined} />
        </IconButton>
      </View>

      {notice ? (
        // A live region, so a screen reader announces "Copied" instead of
        // the user having to go looking for the confirmation.
        <Text
          testID="daily-verse-notice"
          accessibilityLiveRegion="polite"
          style={[type.caption, styles.noticeLine, { color: quietInk }]}
        >
          {notice}
        </Text>
      ) : null}
    </View>
  );
}

/** "Read chapter" as a white pill, for the card laid over a photograph. */
function ReadChapterOnPhoto({ label, onPress }: { label: string; onPress: () => void }) {
  const { layout, radii, type } = useTheme();
  return (
    <Tappable
      testID="daily-verse-read"
      accessibilityRole="button"
      onPress={onPress}
      style={[
        styles.primary,
        styles.photoPill,
        {
          minHeight: layout.button,
          borderRadius: radii.pill,
          backgroundColor: onPhoto.button,
        },
      ]}
    >
      <Text style={[type.button, styles.photoPillLabel, { color: onPhoto.onButton }]}>
        {label}
      </Text>
      <Icon name="arrow" size={18} color={onPhoto.onButton} />
    </Tappable>
  );
}

/**
 * The verse itself. A paired bilingual verse is TWO Text nodes, each in its
 * own language's face -- never one node carrying both scripts, for the
 * reason in this file's header -- with the English at 22/33 and the Telugu
 * beneath it at 19/34 in quieter ink.
 */
function VerseText({
  body,
  isOverride,
  ink,
  quietInk,
}: {
  body: VotdBody;
  isOverride: boolean;
  ink: string;
  quietInk: string;
}) {
  const { appLanguage } = useTranslation();

  if (body.kind === 'paired') {
    return (
      <View style={styles.pair}>
        <Text
          testID="daily-verse-english"
          style={[scriptureBilingualStyle('en'), { color: ink }]}
        >
          {body.english}
        </Text>
        <Text
          testID="daily-verse-telugu"
          style={[scriptureBilingualStyle('te'), { color: quietInk }]}
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
        style={[scriptureDisplayStyle('en', body.english), { color: ink }]}
      >
        {body.english}
      </Text>
    );
  }

  const display = scriptureDisplayStyle(body.language, body.text);
  return (
    <Text
      testID="daily-verse-text"
      style={[
        display,
        // An administrator's own text: the serif of the script it is written in.
        isOverride
          ? { fontFamily: contentFontFamily(body.text, { fallback: appLanguage }) }
          : null,
        { color: ink },
      ]}
    >
      {body.text}
    </Text>
  );
}

const styles = StyleSheet.create({
  card: { paddingTop: 16 },
  // 22 here and the Verse screen's own 8 above the card: 30 under the top bar.
  cardWithPictureAbove: { paddingTop: 22 },
  // 16:9, over the date, with 18 between it and the date.
  pictureAbove: { width: '100%', aspectRatio: 16 / 9, marginBottom: 18 },
  labelRow: { minHeight: 44, justifyContent: 'center' },
  verse: { marginTop: 24 },
  pair: { gap: 10 },
  notice: { fontStyle: 'italic', marginTop: 12 },
  reference: { marginTop: 16 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 24 },
  primary: { flex: 1, minWidth: 0 },
  photoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 24,
  },
  photoPillLabel: { flexShrink: 1, textAlign: 'center' },
  noticeLine: { marginTop: 12 },
  skeletonLines: { gap: 14, marginTop: 24 },
  skeletonRef: { marginTop: 16 },
});
