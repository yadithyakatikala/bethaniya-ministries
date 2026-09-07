import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
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
 */
export function AnnouncementsList() {
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
        <Text style={styles.message}>Could not load announcements.</Text>
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
        <Text style={styles.message}>No announcements yet.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container} testID="announcements-list">
      {announcements.map((announcement) => (
        <View
          key={announcement.id}
          style={styles.item}
          testID={`announcement-${announcement.id}`}
        >
          <Text style={styles.title}>{announcement.title}</Text>
          <Text style={styles.content}>{announcement.content}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%', padding: 16, gap: 12 },
  message: { color: '#666', textAlign: 'center' },
  item: {
    padding: 12,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
    gap: 4,
  },
  title: { fontWeight: '600', fontSize: 15 },
  content: { color: '#374151', fontSize: 14 },
});
