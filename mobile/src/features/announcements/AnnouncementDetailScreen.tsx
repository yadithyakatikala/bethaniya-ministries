import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { useTheme } from '../../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'AnnouncementDetail'>;

function formatDate(date: Date | null): string {
  if (!date) return '';
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Announcement detail -- receives the full announcement object as a
 * route param (same reasoning as SongDetail/EventDetail's route params:
 * AnnouncementsList already holds the complete, real-time list, so
 * passing the object avoids a redundant second Firestore subscription
 * for a screen this simple).
 *
 * Fills the gap the UI audit flagged: "Announcements are unreachable
 * beyond the Home preview -- long content is truncated by nothing and
 * never opens." This screen exists so long-form announcement content
 * can be read comfortably in full; see AnnouncementsList.tsx for the
 * tap-to-navigate wiring.
 */
export function AnnouncementDetailScreen({ route }: Props) {
  const { announcement } = route.params;
  const { colors, radii } = useTheme();

  return (
    <ScrollView
      contentContainerStyle={[styles.container, { backgroundColor: colors.background }]}
      testID="announcement-detail-screen"
    >
      {announcement.imageUrl ? (
        <Image
          source={{ uri: announcement.imageUrl }}
          style={[styles.image, { borderRadius: radii.card }]}
          testID="announcement-detail-image"
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
        {announcement.createdAt ? (
          <Text
            style={[styles.date, { color: colors.secondaryText }]}
            testID="announcement-detail-date"
          >
            {formatDate(announcement.createdAt)}
          </Text>
        ) : null}
        <Text
          style={[styles.title, { color: colors.text }]}
          testID="announcement-detail-title"
        >
          {announcement.title}
        </Text>
        <Text
          style={[styles.content, { color: colors.text }]}
          testID="announcement-detail-content"
        >
          {announcement.content}
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
