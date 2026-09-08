import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../../theme';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import {
  subscribeToPublishedAnnouncements,
  type PublishedAnnouncement,
} from '../../services/firebase/announcements';

/**
 * Published-announcements section -- Day 4 scope only (real-time listener +
 * loading/error/empty/list states). The full Home Screen (church branding,
 * daily verse card, tap-to-detail navigation) is Day 5+ scope per
 * FINAL_ARCHITECTURE_SPECIFICATION.md and is deliberately not built here;
 * see HomeScreen.tsx for where this is mounted today.
 *
 * Restyled onto the shared Vespers theme (mobile/src/theme/) so it's
 * genuinely dark-mode aware, matching every other screen already migrated
 * off a hardcoded palette -- it previously ignored dark mode entirely
 * (flagged in the UI audit's "Problems found" section). Reading
 * useTheme() means this now needs PreferencesProvider in its render
 * tree; AnnouncementsList.test.tsx wraps it the same way
 * DailyVerseCard.test.tsx already does, and every existing testID/text
 * assertion is unchanged.
 *
 * Each row is now tappable into AnnouncementDetailScreen (previously the
 * audit's "Announcements are unreachable beyond the Home preview" gap --
 * see that screen's doc comment), with a clamped two-line preview and a
 * thumbnail when the announcement has an image -- both real, previously
 * unused fields (`content`, `imageUrl`), nothing invented.
 */
export function AnnouncementsList() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { colors, radii, spacing } = useTheme();
  const [announcements, setAnnouncements] = useState<PublishedAnnouncement[] | null>(
    null
  );
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeToPublishedAnnouncements(
      (next) => {
        setAnnouncements(next);
        setHasError(false);
      },
      () => setHasError(true)
    );
    return unsubscribe;
  }, []);

  if (hasError) {
    return (
      <View style={styles.container} testID="announcements-error">
        <Text style={[styles.message, { color: colors.secondaryText }]}>
          Could not load announcements.
        </Text>
      </View>
    );
  }

  if (!announcements) {
    return (
      <View style={styles.container} testID="announcements-loading">
        <ActivityIndicator />
      </View>
    );
  }

  if (announcements.length === 0) {
    return (
      <View style={styles.container} testID="announcements-empty">
        <Text style={[styles.message, { color: colors.secondaryText }]}>
          No announcements yet.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container} testID="announcements-list">
      {announcements.map((announcement) => (
        <TouchableOpacity
          key={announcement.id}
          style={[
            styles.item,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderRadius: radii.card,
              padding: spacing.md,
            },
          ]}
          testID={`announcement-${announcement.id}`}
          onPress={() => navigation.navigate('AnnouncementDetail', { announcement })}
        >
          {announcement.imageUrl ? (
            <Image
              source={{ uri: announcement.imageUrl }}
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
            <Text style={[styles.title, { color: colors.text }]}>
              {announcement.title}
            </Text>
            <Text
              style={[styles.content, { color: colors.secondaryText }]}
              numberOfLines={2}
            >
              {announcement.content}
            </Text>
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%', gap: 10 },
  message: { textAlign: 'center' },
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
