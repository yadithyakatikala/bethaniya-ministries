import { Image, StyleSheet, Text, View } from 'react-native';
import { Icon, Tappable, useTheme } from '../../theme';
import { fontFamilies } from '../../theme/tokens';
import { useTranslation } from '../../i18n';
import { formatDayMonthShort } from '../../i18n/locale';
import { usePreferences } from '../../context/PreferencesContext';
import type { MediaPost } from '../../services/firebase/media';
import { posterFor } from './mediaUrl';
import { PlayMarker, PostVerse } from './MediaParts';

/**
 * One post in the feed.
 *
 * THE LOOK. The picture runs edge to edge (4:3), then the church's words in
 * a 20-point margin -- the caption, the verse it quotes (a thin gold bar,
 * the words in the serif of their script, the reference in gold ink), who
 * and when -- and a row of four 44-point icon buttons: like, comment, share,
 * save. A hairline ends the post. No card, no shadow: rows before cards.
 * What is on is **ink** -- a solid heart, a solid ribbon -- never red and
 * never gold.
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
 * different -- it is scripture, and it takes the serif of its script.
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
  const { colors, type } = useTheme();
  const { t } = useTranslation();
  const { appLanguage } = usePreferences();
  const poster = posterFor(post);

  /** One of the four icon buttons: muted until it is on, then ink. */
  const action = (
    testID: string,
    label: string,
    icon: 'heart' | 'heartf' | 'comment' | 'share' | 'bookmark' | 'bookmarkf',
    on: boolean,
    onPress: () => void,
    selected?: boolean
  ) => (
    <Tappable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={selected === undefined ? undefined : { selected }}
      accessibilityLabel={label}
      onPress={onPress}
      style={styles.action}
    >
      <Icon name={icon} size={24} color={on ? colors.ink : colors.inkMuted} />
    </Tappable>
  );

  const meta = [
    post.authorName.length > 0 ? post.authorName : null,
    post.publishAt
      ? t('media.publishedOn', { date: formatDayMonthShort(post.publishAt, appLanguage) })
      : null,
  ]
    .filter((part): part is string => part !== null)
    .join(' · ');

  return (
    <View
      testID={`media-card-${post.id}`}
      style={[styles.post, { borderBottomColor: colors.border }]}
    >
      <Tappable
        testID={`media-open-${post.id}`}
        accessibilityRole="button"
        accessibilityLabel={t('media.openPost')}
        onPress={onOpen}
      >
        <View>
          {poster ? (
            <Image
              testID={`media-image-${post.id}`}
              source={{ uri: poster }}
              style={[styles.media, { backgroundColor: colors.surfaceRaised }]}
              accessibilityLabel={t('media.imageLabel')}
              resizeMode="cover"
            />
          ) : (
            // A video with no still to show: the same 4:3 block, so the feed's
            // rhythm does not change, with the play marker on it.
            <View
              testID={`media-image-${post.id}`}
              style={[styles.media, { backgroundColor: colors.surfaceRaised }]}
            />
          )}
          {post.type === 'video' ? (
            <View style={styles.play} pointerEvents="none">
              <PlayMarker testID={`media-play-${post.id}`} label={t('media.playVideo')} />
            </View>
          ) : null}
        </View>
      </Tappable>

      <View style={styles.body}>
        {post.caption.length > 0 ? (
          <Text
            testID={`media-caption-${post.id}`}
            style={[
              styles.caption,
              appLanguage === 'te' && styles.captionTe,
              { color: colors.ink },
            ]}
          >
            {post.caption}
          </Text>
        ) : null}

        {post.verseReference || post.verseText ? (
          <PostVerse
            testID={`media-verse-${post.id}`}
            text={post.verseText}
            reference={post.verseReference}
          />
        ) : null}

        {/* M7: the author AND the publication date. A feed without dates
            reads as though everything happened at once, and "is this this
            Sunday's service or last year's?" is the first question a
            member has about a photograph. The date shown is `publishAt` --
            when the church chose to show it -- not when the document was
            written, because those differ for a scheduled post and the
            first one is the one that means anything to a reader. */}
        {meta.length > 0 ? (
          <Text
            testID={`media-meta-${post.id}`}
            style={[type.caption, { color: colors.inkMuted }]}
          >
            {meta}
          </Text>
        ) : null}
      </View>

      <View style={styles.actions}>
        {/* Every action names its CURRENT state in its label, so a screen
            reader says "Liked" rather than leaving the state to a mark a
            screen reader cannot see. */}
        {action(
          `media-like-${post.id}`,
          liked ? t('media.liked') : t('media.like'),
          liked ? 'heartf' : 'heart',
          liked,
          onLike,
          liked
        )}
        {action(
          `media-comment-${post.id}`,
          t('media.comment'),
          'comment',
          false,
          onComment
        )}
        {action(`media-share-${post.id}`, t('media.share'), 'share', false, onShare)}
        {action(
          `media-save-${post.id}`,
          saved ? t('media.saved') : t('media.save'),
          saved ? 'bookmarkf' : 'bookmark',
          saved,
          onSave,
          saved
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  post: { borderBottomWidth: 1, paddingBottom: 2 },
  // A fixed 4:3 band rather than the image's own ratio: a feed whose
  // rows jump to different heights as images load is unreadable to
  // scroll, and `cover` fills the band whatever the source shape is.
  media: { width: '100%', aspectRatio: 4 / 3 },
  play: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { paddingHorizontal: 20, paddingTop: 14, gap: 10 },
  caption: {
    fontFamily: fontFamilies.interfaceRegular,
    fontSize: 16,
    lineHeight: 24,
  },
  captionTe: { lineHeight: 29 },
  // 44-point targets, spread evenly across the row.
  actions: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 2 },
  action: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
});
