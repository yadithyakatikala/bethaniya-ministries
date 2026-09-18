import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { useTheme } from '../../theme';
// This screen previously formatted its date with the DEVICE locale and
// never called useTranslation() at all -- see ../../i18n/locale.ts.
import { useTranslation } from '../../i18n';
import { formatLongDate } from '../../i18n/locale';

type Props = NativeStackScreenProps<RootStackParamList, 'AnnouncementDetail'>;



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
  const { colors, radii, type } = useTheme();
  const { appLanguage } = useTranslation();

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
            style={[type.overline, { color: colors.secondaryText }]}
            testID="announcement-detail-date"
          >
            {formatLongDate(announcement.createdAt, appLanguage)}
          </Text>
        ) : null}
        <Text
          style={[type.headline, { color: colors.text }]}
          testID="announcement-detail-title"
        >
          {announcement.title}
        </Text>
        <Text
          style={[type.bodyLarge, { color: colors.text }]}
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
});
