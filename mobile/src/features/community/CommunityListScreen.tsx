import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  subscribeToPublishedCommunityPosts,
  type PublishedCommunityPost,
} from '../../services/firebase/communityPosts';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { Tappable, useTheme } from '../../theme';
import { SectionHeader } from '../../theme/ui/SectionHeader';
import { useTranslation } from '../../i18n';

type Props = NativeStackScreenProps<RootStackParamList, 'CommunityList'>;

/**
 * One of the two named places this area leads to.
 *
 * Defined at module scope, not inside the screen: a component declared
 * during render is a new component type on every render, so React
 * remounts it and loses whatever state it held. Nothing here holds state
 * today, which is exactly why it is worth fixing before something does.
 */
function Destination({
  testID,
  label,
  hint,
  onPress,
}: {
  testID: string;
  label: string;
  hint: string;
  onPress: () => void;
}) {
  const { colors, radii, spacing, type, minTouchTarget } = useTheme();
  return (
    <Tappable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      onPress={onPress}
      style={[
        styles.destination,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderRadius: radii.card,
          padding: spacing.md,
          minHeight: minTouchTarget,
        },
      ]}
    >
      <View style={styles.textColumn}>
        <Text style={[type.label, { color: colors.ink }]}>{label}</Text>
        <Text style={[type.bodySmall, { color: colors.inkMuted }]}>{hint}</Text>
      </View>
      <View style={[styles.chevron, { borderColor: colors.inkMuted }]} />
    </Tappable>
  );
}

/**
 * Community -- the church's social AREA, not a single list.
 *
 * =====================================================================
 * WHY THIS IS A PLACE AND NOT JUST THE POSTS
 * =====================================================================
 * This screen and ./CommunityChatScreen.tsx have always been different
 * features over different collections -- `community` here (posts an
 * administrator writes: testimonies, church-family updates) and
 * `community_messages` there (the congregation talking to each other).
 * They share no code and no data.
 *
 * To a member they were still indistinguishable, and the reason is
 * simple: a church that has just installed the app has published no
 * posts and sent no messages, so BOTH screens were a centred sentence on
 * an empty background. Two Home buttons, two empty screens, no way to
 * tell what either was for. A tester reported them as the same feature,
 * and from the outside they were.
 *
 * The fix is not a rename. Community is now the area it was always meant
 * to be: it says what it is, it carries the church's posts, and it
 * offers the two other social places -- the chat and the photo and video
 * feed -- as named destinations with a sentence each. Empty of posts, it
 * is still a screen that tells a member where the church family is.
 *
 * NO NEW INFRASTRUCTURE. The links navigate to screens that already
 * exist; the posts come from the same subscription as before; moderation
 * and reporting are untouched, and live where the content lives (a
 * reported chat message is reported in the chat, a reported media post in
 * the feed).
 */
export function CommunityListScreen({ navigation }: Props) {
  const { colors, radii, spacing, type } = useTheme();
  const { t } = useTranslation();
  const [posts, setPosts] = useState<PublishedCommunityPost[] | null>(null);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeToPublishedCommunityPosts(
      (next) => {
        setPosts(next);
        setHasError(false);
      },
      () => setHasError(true)
    );
    return unsubscribe;
  }, []);

  const header = (
    <View style={{ gap: spacing.md, marginBottom: spacing.md }}>
      <Text style={[type.bodySmall, { color: colors.inkMuted }]}>
        {t('community.introMessage')}
      </Text>

      <Destination
        testID="community-open-chat"
        label={t('community.goToChat')}
        hint={t('community.goToChatHint')}
        onPress={() => navigation.navigate('CommunityChat')}
      />
      <Destination
        testID="community-open-media"
        label={t('community.goToMedia')}
        hint={t('community.goToMediaHint')}
        onPress={() => navigation.navigate('MediaFeed')}
      />

      <SectionHeader title={t('community.postsSection')} />

      {hasError ? (
        <Text style={[type.bodySmall, { color: colors.danger }]} testID="community-error">
          {t('community.loadErrorShort')}
        </Text>
      ) : null}

      {/* The posts load underneath the destinations rather than instead
          of them, so the area is usable while they are still arriving --
          and remains usable if the church never writes one. */}
      {!posts && !hasError ? <ActivityIndicator testID="community-loading" /> : null}

      {posts && posts.length === 0 && !hasError ? (
        <Text
          style={[type.bodySmall, { color: colors.inkMuted }]}
          testID="community-empty"
        >
          {t('community.emptyShort')}
        </Text>
      ) : null}
    </View>
  );

  return (
    <FlatList
      testID="community-list"
      data={posts ?? []}
      keyExtractor={(item) => item.id}
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.list}
      ListHeaderComponent={header}
      renderItem={({ item }) => (
        <TouchableOpacity
          style={[
            styles.item,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderRadius: radii.card,
              padding: spacing.md,
            },
          ]}
          testID={`community-post-${item.id}`}
          onPress={() => navigation.navigate('CommunityPostDetail', { post: item })}
        >
          {item.imageUrl ? (
            <Image
              source={{ uri: item.imageUrl }}
              style={[styles.thumbnail, { borderRadius: radii.control }]}
              accessibilityIgnoresInvertColors
            />
          ) : (
            <View
              style={[
                styles.thumbnailPlaceholder,
                { backgroundColor: colors.primaryTint, borderRadius: radii.control },
              ]}
            />
          )}
          <View style={styles.textColumn}>
            <Text style={[type.label, { color: colors.text }]}>{item.title}</Text>
            <Text
              style={[type.bodySmall, { color: colors.secondaryText }]}
              numberOfLines={2}
            >
              {item.content}
            </Text>
          </View>
        </TouchableOpacity>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, gap: 10, flexGrow: 1 },
  item: {
    flexDirection: 'row',
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  destination: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  thumbnail: { width: 56, height: 56 },
  thumbnailPlaceholder: { width: 56, height: 56 },
  textColumn: { flex: 1, gap: 3 },
  chevron: {
    width: 8,
    height: 8,
    borderRightWidth: 1.5,
    borderTopWidth: 1.5,
    transform: [{ rotate: '45deg' }],
  },
});
