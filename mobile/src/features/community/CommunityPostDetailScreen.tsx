import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { useTheme } from '../../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'CommunityPostDetail'>;

function formatDate(date: Date | null): string {
  if (!date) return '';
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Community post detail -- new V1 feature, mirrors
 * ../announcements/AnnouncementDetailScreen.tsx exactly (same "pass the
 * full object as a route param" reasoning: CommunityListScreen already
 * holds the complete, real-time list).
 */
export function CommunityPostDetailScreen({ route }: Props) {
  const { post } = route.params;
  const { colors, radii } = useTheme();

  return (
    <ScrollView
      contentContainerStyle={[styles.container, { backgroundColor: colors.background }]}
      testID="community-post-detail-screen"
    >
      {post.imageUrl ? (
        <Image
          source={{ uri: post.imageUrl }}
          style={[styles.image, { borderRadius: radii.card }]}
          testID="community-post-detail-image"
          accessibilityIgnoresInvertColors
        />
      ) : (
        <View
          style={[
            styles.imagePlaceholder,
            { backgroundColor: colors.primaryTint, borderRadius: radii.card },
          ]}
        />
      )}

      <View style={styles.body}>
        {post.createdAt ? (
          <Text style={[styles.date, { color: colors.secondaryText }]} testID="community-post-detail-date">
            {formatDate(post.createdAt)}
          </Text>
        ) : null}
        <Text style={[styles.title, { color: colors.text }]} testID="community-post-detail-title">
          {post.title}
        </Text>
        <Text style={[styles.content, { color: colors.text }]} testID="community-post-detail-content">
          {post.content}
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, paddingBottom: 32 },
  image: { width: '100%', aspectRatio: 16 / 9 },
  imagePlaceholder: { width: '100%', aspectRatio: 16 / 9 },
  body: { padding: 20, gap: 10 },
  date: {
    fontSize: 12.5,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  title: { fontSize: 24, fontWeight: '600', lineHeight: 30 },
  content: { fontSize: 16, lineHeight: 25 },
});
