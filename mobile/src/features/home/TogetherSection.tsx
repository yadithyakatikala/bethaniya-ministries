import { Image, StyleSheet, View } from 'react-native';
import { Icon } from '../../theme/ui/Icon';
import { ListGroup, ListRow } from '../../theme/ui/ListRow';
import { SectionHeader } from '../../theme/ui/SectionHeader';
import { useTheme } from '../../theme';
import { useTranslation } from '../../i18n';
import { useLatestMedia } from '../media/useLatestMedia';
import type { MediaPost } from '../../services/firebase/media';

/** How many pictures the Photos row shows beside its title. */
const THUMBNAILS = 3;

/**
 * "Together": the three things a member does WITH the church, as three rows
 * between hairlines -- ask for prayer, talk in the church chat, see the
 * pictures. Each is one button into the real thing; none carries data, so
 * none can show a number that is wrong.
 *
 * Rows before tiles. The five-tile grid this replaces gave Plans and
 * Community a square each beside three others, and two of those pairs
 * landed in the same place; these are three different places, said in
 * words, with a line of what each is for.
 *
 * Their glyphs are ink in a hairline circle -- gold stays out of icons --
 * as everywhere else in the app.
 */
export function TogetherSection({
  onOpenPrayers,
  onOpenChat,
  onOpenMedia,
  style,
}: {
  onOpenPrayers: () => void;
  onOpenChat: () => void;
  onOpenMedia: () => void;
  style?: object;
}) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const posts = useLatestMedia(THUMBNAILS);

  return (
    <View testID="home-together" style={style}>
      <View style={styles.header}>
        <SectionHeader title={t('home.together')} />
      </View>
      <View
        style={[
          styles.list,
          { borderTopColor: colors.border, borderBottomColor: colors.border },
        ]}
      >
        <ListGroup>
          <ListRow
            testID="prayers-nav-button"
            leadingIcon="prayer"
            title={t('prayerWall.title')}
            subtitle={t('home.askPray')}
            onPress={onOpenPrayers}
          />
          <ListRow
            testID="chat-nav-button"
            leadingIcon="msg"
            title={t('chat.title')}
            subtitle={t('community.goToChatHint')}
            onPress={onOpenChat}
          />
          <ListRow
            testID="media-nav-button"
            leadingIcon="photo"
            title={t('community.goToMedia')}
            subtitle={t('community.goToMediaHint')}
            onPress={onOpenMedia}
            trailing={<MediaPeek posts={posts} />}
          />
        </ListGroup>
      </View>
    </View>
  );
}

/**
 * Up to three overlapping 34-point thumbnails, then the row's chevron. They
 * are a hint of what is inside, not controls: the row is the one button, so
 * they are hidden from a screen reader, which hears the row's own words. A
 * video has no still the app can fetch (its address is a clip, not a
 * picture), so it is drawn as a quiet tile with a play mark.
 */
function MediaPeek({ posts }: { posts: MediaPost[] }) {
  const { colors } = useTheme();
  return (
    <View style={styles.peek}>
      {posts.length > 0 ? (
        <View
          testID="home-media-thumbnails"
          style={styles.thumbs}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {posts.slice(0, THUMBNAILS).map((post, index) => (
            <View
              key={post.id}
              testID={`home-media-${post.id}`}
              style={[
                styles.thumb,
                index > 0 && styles.overlap,
                { borderColor: colors.paper, backgroundColor: colors.surfaceRaised },
              ]}
            >
              {post.type === 'image' ? (
                <Image
                  testID={`home-media-image-${post.id}`}
                  source={{ uri: post.mediaUrl }}
                  style={styles.image}
                  resizeMode="cover"
                  accessibilityIgnoresInvertColors
                />
              ) : (
                <View testID={`home-media-play-${post.id}`} style={styles.play}>
                  <Icon name="play" size={14} color={colors.inkMuted} />
                </View>
              )}
            </View>
          ))}
        </View>
      ) : null}
      <Icon name="chev" size={20} color={colors.inkMuted} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { marginBottom: 12 },
  list: { borderTopWidth: 1, borderBottomWidth: 1 },
  peek: { flexDirection: 'row', alignItems: 'center', gap: 12, flexShrink: 0 },
  thumbs: { flexDirection: 'row', alignItems: 'center' },
  thumb: { width: 34, height: 34, borderRadius: 9, borderWidth: 2, overflow: 'hidden' },
  overlap: { marginLeft: -9 },
  image: { width: '100%', height: '100%' },
  play: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
