import { Button, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { AnnouncementsList } from '../announcements/AnnouncementsList';
import { DailyVerseCard } from '../daily-verses/DailyVerseCard';

/**
 * Static church branding block -- Day 5's Home Screen "Work" item
 * ("church branding + daily verse card + announcements list"). This is
 * deliberately static/hardcoded, not settings-driven: the admin Settings
 * page (church name input + logo URL + description textarea) is
 * explicitly Day 13 scope (FINAL_ARCHITECTURE_SPECIFICATION.md's "Day 13:
 * Admin Dashboard Completion (Settings + Refinement)"), and the
 * `settings` Firestore collection has no admin UI to write it until then
 * -- building a settings-driven version now would be implementing Day 13
 * early. Replace this with real data once Day 13 exists.
 */
function ChurchBranding() {
  return (
    <View style={styles.branding} testID="church-branding">
      <Text style={styles.churchName}>Bethaniya Ministries</Text>
      <Text style={styles.churchDescription}>
        A community of faith, worship, and fellowship.
      </Text>
    </View>
  );
}

/**
 * Authenticated home screen. Day 2 proved the authenticated state renders
 * and sign-out works; Day 4 added the real-time announcements section
 * (AnnouncementsList). Day 5 adds church branding (static -- see
 * ChurchBranding above) and the daily verse card (DailyVerseCard), per
 * the spec's "Home screen UI (church branding + daily verse card +
 * announcements list)" plan item. Tap-to-detail navigation for
 * announcements is later scope and still not built here.
 */
export function HomeScreen() {
  const { user, signOut } = useAuth();

  const displayLabel = user?.displayName || user?.email || user?.phoneNumber || 'Member';

  return (
    <ScrollView contentContainerStyle={styles.container} testID="home-screen">
      <View style={styles.header}>
        <Text style={styles.title}>Welcome, {displayLabel}</Text>
        <Button
          title="Sign out"
          onPress={() => void signOut()}
          testID="sign-out-button"
        />
      </View>
      <ChurchBranding />
      <DailyVerseCard />
      <AnnouncementsList />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    alignItems: 'center',
    paddingVertical: 24,
    gap: 16,
  },
  header: {
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 24,
  },
  title: { fontSize: 20, fontWeight: '600', textAlign: 'center' },
  branding: {
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 24,
  },
  churchName: { fontSize: 22, fontWeight: '700', textAlign: 'center' },
  churchDescription: { fontSize: 14, color: '#6B7280', textAlign: 'center' },
});
