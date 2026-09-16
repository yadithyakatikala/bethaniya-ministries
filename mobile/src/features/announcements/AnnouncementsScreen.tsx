import { ScrollView, StyleSheet } from 'react-native';
import { useTheme } from '../../theme';
import { AnnouncementsList } from './AnnouncementsList';

/**
 * Announcements, as their own screen.
 *
 * WHY THIS EXISTS. Announcements used to be a content block on Home, and
 * the V1 tester's Home screenshot shows what that cost: a permanent
 * "ANNOUNCEMENTS / No announcements yet." section taking up the middle of
 * the screen even with nothing to show. The entry point moved to a
 * permanent icon in Home's top-right utility area, so the list needed a
 * destination of its own.
 *
 * This is a thin wrapper, deliberately: ./AnnouncementsList.tsx is
 * unchanged and keeps its own loading, empty and error states plus its
 * navigation to AnnouncementDetail. The announcements FEATURE -- the
 * Firestore collection, the admin screens, the detail screen -- is
 * untouched; only where a member reaches it from has changed.
 *
 * NOT the same thing as Notifications (see
 * ../notifications/NotificationCenterScreen.tsx). Announcements are
 * church-published content in Firestore; notifications are this device's
 * own local delivery history. They have separate screens, separate data
 * and separate icons on purpose.
 */
export function AnnouncementsScreen() {
  const { colors, spacing } = useTheme();
  return (
    <ScrollView
      testID="announcements-screen"
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[styles.container, { padding: spacing.lg }]}
    >
      <AnnouncementsList />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1 },
});
