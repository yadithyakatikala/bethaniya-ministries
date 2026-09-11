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
import { useTheme } from '../../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'CommunityList'>;

/**
 * Community -- a new V1 feature (per explicit owner decision; not part of
 * FINAL_ARCHITECTURE_SPECIFICATION.md's original scope -- see
 * PRODUCTION_READINESS.md). Admin-authored posts (testimonies,
 * church-family updates), NOT an open member-posting feed -- same
 * real-time-listener / loading-error-empty-list shape as
 * SongsListScreen.tsx / AnnouncementsList.tsx. Reached from the More tab
 * (existing Home/Bible/Songs/Events/More bottom navigation is kept
 * unchanged per explicit owner decision).
 */
export function CommunityListScreen({ navigation }: Props) {
  const { colors, radii, spacing } = useTheme();
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

  if (hasError) {
    return (
      <View
        style={[styles.container, { backgroundColor: colors.background }]}
        testID="community-error"
      >
        <Text style={[styles.message, { color: colors.secondaryText }]}>
          Could not load community posts.
        </Text>
      </View>
    );
  }

  if (!posts) {
    return (
      <View
        style={[styles.container, { backgroundColor: colors.background }]}
        testID="community-loading"
      >
        <ActivityIndicator />
      </View>
    );
  }

  if (posts.length === 0) {
    return (
      <View
        style={[styles.container, { backgroundColor: colors.background }]}
        testID="community-empty"
      >
        <Text style={[styles.message, { color: colors.secondaryText }]}>
          No community posts yet.
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      testID="community-list"
      data={posts}
      keyExtractor={(item) => item.id}
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.list}
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
            <Text style={[styles.title, { color: colors.text }]}>{item.title}</Text>
            <Text style={[styles.content, { color: colors.secondaryText }]} numberOfLines={2}>
              {item.content}
            </Text>
          </View>
        </TouchableOpacity>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  message: { textAlign: 'center' },
  list: { padding: 16, gap: 10 },
  item: {
    flexDirection: 'row',
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  thumbnail: { width: 56, height: 56 },
  thumbnailPlaceholder: { width: 56, height: 56 },
  textColumn: { flex: 1, gap: 3 },
  title: { fontWeight: '600', fontSize: 15 },
  content: { fontSize: 13.5, lineHeight: 19 },
});
