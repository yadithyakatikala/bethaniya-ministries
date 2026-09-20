import { Image, StyleSheet, Text, View } from 'react-native';
import { useTheme, useTypographyFor } from '../../theme';
import { useTranslation } from '../../i18n';
import { usePreferences } from '../../context/PreferencesContext';
import { Tappable } from '../../theme/ui/Tappable';
import {
  BookmarkIcon,
  CommentIcon,
  HeartIcon,
  PlayIcon,
  ShareIcon,
} from '../../theme/ui/MediaIcons';
import type { MediaPost } from '../../services/firebase/media';

/**
 * One post in the feed.
 *
 * =====================================================================
 * A VIDEO IS A POSTER AND A PLAY MARKER, NOT A PLAYER
 * =====================================================================
 * The card never mounts a player. A feed that autoplays -- or even just
 * prepares -- ten videos downloads ten videos, on a congregation's mobile
 * data, to show ten thumbnails. Tapping opens the detail screen, which is
 * where exactly one video is ever loaded. That is the whole of the
 * "don't download media unnecessarily" rule, and it is a structural
 * answer rather than a careful one.
 *
 * =====================================================================
 * THE CAPTION'S TYPEFACE IS NOT A GUESS
 * =====================================================================
 * A caption is text an administrator typed and may be English, Telugu or
 * both in one sentence. M3's rule for content of unknown script is the
 * INTERFACE family, never a serif: the Telugu serif has no Latin letters
 * and the Latin serif no Telugu ones, so a mixed caption in either would
 * lose half its characters to a substituted face. A quoted VERSE is
 * different -- it is scripture, and it gets the scripture treatment for
 * the Bible language the member reads.
 */
export function MediaCard({
  post,
  liked,
  saved,
  onOpen,
  onLike,
  onSave,
  onShare,
  onComment,
}: {
  post: MediaPost;
  liked: boolean;
  saved: boolean;
  onOpen: () => void;
  onLike: () => void;
  onSave: () => void;
  onShare: () => void;
  onComment: () => void;
}) {
  const { colors, radii, spacing, type } = useTheme();
  const { t } = useTranslation();
  const { appLanguage } = usePreferences();
  // Interface family for the caption -- see the header.
  const interfaceType = useTypographyFor(appLanguage);

  return (
    <View
      testID={`media-card-${post.id}`}
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderRadius: radii.card,
        },
      ]}
    >
      <Tappable
        testID={`media-open-${post.id}`}
        accessibilityRole="button"
        accessibilityLabel={t('media.openPost')}
        onPress={onOpen}
      >
        <View>
          <Image
            testID={`media-image-${post.id}`}
            source={{ uri: post.mediaUrl }}
            style={[
              styles.media,
              { borderTopLeftRadius: radii.card, borderTopRightRadius: radii.card },
            ]}
            accessibilityLabel={t('media.imageLabel')}
            resizeMode="cover"
          />
          {post.type === 'video' ? (
            <View
              testID={`media-play-${post.id}`}
              accessibilityLabel={t('media.playVideo')}
              // `primary`/`onPrimary` rather than a hardcoded black disc:
              // primary inverts between the palettes, so the marker stays
              // readable over both a bright and a dark photograph.
              style={[styles.playBadge, { backgroundColor: colors.primary }]}
            >
              <PlayIcon color={colors.onPrimary} size={28} />
            </View>
          ) : null}
        </View>
      </Tappable>

      <View style={{ padding: spacing.md, gap: spacing.xs }}>
        {post.caption.length > 0 ? (
          <Text
            testID={`media-caption-${post.id}`}
            style={[interfaceType.body, { color: colors.ink }]}
          >
            {post.caption}
          </Text>
        ) : null}

        {post.verseReference || post.verseText ? (
          <View
            testID={`media-verse-${post.id}`}
            style={[
              styles.verse,
              { borderLeftColor: colors.primary, paddingLeft: spacing.sm },
            ]}
          >
            {post.verseText ? (
              <Text style={[interfaceType.bodySmall, { color: colors.ink }]}>
                {post.verseText}
              </Text>
            ) : null}
            {post.verseReference ? (
              <Text style={[type.caption, { color: colors.inkMuted }]}>
                {post.verseReference}
              </Text>
            ) : null}
          </View>
        ) : null}

        {post.authorName.length > 0 ? (
          <Text style={[type.caption, { color: colors.inkMuted }]}>
            {post.authorName}
          </Text>
        ) : null}
      </View>

      <View
        style={[styles.actions, { borderTopColor: colors.border, padding: spacing.sm }]}
      >
        {/* Every action names its CURRENT state in its label, so a screen
            reader says "Liked" rather than leaving the state to a colour
            a screen reader cannot see. */}
        <Tappable
          testID={`media-like-${post.id}`}
          accessibilityRole="button"
          accessibilityState={{ selected: liked }}
          accessibilityLabel={liked ? t('media.liked') : t('media.like')}
          onPress={onLike}
          style={styles.action}
        >
          <HeartIcon color={liked ? colors.danger : colors.inkMuted} filled={liked} />
        </Tappable>

        <Tappable
          testID={`media-comment-${post.id}`}
          accessibilityRole="button"
          accessibilityLabel={t('media.comment')}
          onPress={onComment}
          style={styles.action}
        >
          <CommentIcon color={colors.inkMuted} />
        </Tappable>

        <Tappable
          testID={`media-share-${post.id}`}
          accessibilityRole="button"
          accessibilityLabel={t('media.share')}
          onPress={onShare}
          style={styles.action}
        >
          <ShareIcon color={colors.inkMuted} />
        </Tappable>

        <Tappable
          testID={`media-save-${post.id}`}
          accessibilityRole="button"
          accessibilityState={{ selected: saved }}
          accessibilityLabel={saved ? t('media.saved') : t('media.save')}
          onPress={onSave}
          style={styles.action}
        >
          <BookmarkIcon color={saved ? colors.primary : colors.inkMuted} filled={saved} />
        </Tappable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  // A fixed 4:3-ish band rather than the image's own ratio: a feed whose
  // rows jump to different heights as images load is unreadable to
  // scroll, and `cover` fills the band whatever the source shape is.
  media: { width: '100%', aspectRatio: 4 / 3 },
  playBadge: {
    position: 'absolute',
    alignSelf: 'center',
    top: '50%',
    marginTop: -28,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verse: { borderLeftWidth: 3, gap: 2 },
  actions: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth },
  // 44dp targets, spread evenly across the row.
  action: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
});
