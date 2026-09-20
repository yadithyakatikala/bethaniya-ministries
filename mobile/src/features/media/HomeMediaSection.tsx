import { useEffect, useRef, useState } from 'react';
import { Image, ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../../theme';
import { useTranslation } from '../../i18n';
import { SectionHeader } from '../../theme/ui/SectionHeader';
import { Tappable } from '../../theme/ui/Tappable';
import { PlayIcon } from '../../theme/ui/MediaIcons';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { fetchMediaPage, type MediaPost } from '../../services/firebase/media';

/**
 * A short strip of the newest media on Home, and a way into the feed.
 *
 * =====================================================================
 * HOME DOES NOT BECOME A FEED
 * =====================================================================
 * Three thumbnails in a row that scrolls sideways, and a "See all". Not
 * ten cards with captions, actions and comments -- Home already carries
 * the Verse of the Day, the Prophet Verse, a reading plan and the next
 * event, and a full feed dropped into the middle of that would bury all
 * of them. The media EXPERIENCE is ../MediaFeedScreen.tsx; this is a
 * doorway to it.
 *
 * =====================================================================
 * IT COSTS ONE SMALL READ, AND NOTHING WHEN THERE IS NOTHING
 * =====================================================================
 * One query for three documents, fetched once per mount, no listener.
 * And when the church has posted nothing -- or the read fails -- this
 * renders NULL rather than an empty block: Home's container uses `gap`,
 * so an empty wrapper would still leave a band of unexplained
 * whitespace. The same rule, and the same reason, as ProphetVerseCard.
 */
const PREVIEW_COUNT = 3;

export function HomeMediaSection() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { colors, radii, spacing } = useTheme();
  const { t } = useTranslation();
  const [posts, setPosts] = useState<MediaPost[]>([]);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    void (async () => {
      try {
        const page = await fetchMediaPage({ pageSize: PREVIEW_COUNT });
        if (mountedRef.current) setPosts(page.posts);
      } catch (error) {
        // Home must not show an error panel for a secondary strip. The
        // section simply is not there, exactly as if nothing were posted.
        console.warn('[media] could not load the Home media strip:', error);
      }
    })();
    return () => {
      mountedRef.current = false;
    };
  }, []);

  if (posts.length === 0) return null;

  return (
    <View style={{ gap: spacing.sm }} testID="home-media-section">
      <SectionHeader
        title={t('media.sectionTitle')}
        actionLabel={t('common.seeAll')}
        onAction={() => navigation.navigate('MediaFeed')}
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: spacing.sm }}
      >
        {posts.map((post) => (
          <Tappable
            key={post.id}
            testID={`home-media-${post.id}`}
            accessibilityRole="button"
            accessibilityLabel={post.caption || t('media.openPost')}
            onPress={() => navigation.navigate('MediaDetail', { post })}
          >
            <View>
              <Image
                source={{ uri: post.mediaUrl }}
                style={[
                  styles.thumb,
                  { borderRadius: radii.card, borderColor: colors.border },
                ]}
                accessibilityLabel={t('media.imageLabel')}
                resizeMode="cover"
              />
              {post.type === 'video' ? (
                <View
                  style={[styles.playBadge, { backgroundColor: colors.primary }]}
                  accessibilityLabel={t('media.playVideo')}
                >
                  <PlayIcon color={colors.onPrimary} size={18} />
                </View>
              ) : null}
            </View>
          </Tappable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  // Fixed size: a strip whose tiles are each a different shape reads as
  // broken rather than as varied.
  thumb: { width: 140, height: 105, borderWidth: StyleSheet.hairlineWidth },
  playBadge: {
    position: 'absolute',
    top: 43,
    left: 61,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
