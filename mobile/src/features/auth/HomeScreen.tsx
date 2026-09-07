import { Button, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { AnnouncementsList } from '../announcements/AnnouncementsList';

/**
 * Authenticated home screen. Day 2 proved the authenticated state renders
 * and sign-out works; Day 4 adds the real-time announcements section
 * (AnnouncementsList) here since this is the only authenticated screen
 * that exists yet -- the full Home Screen (church branding, daily verse
 * card, tap-to-detail navigation) is Day 5+ scope and deliberately not
 * built here.
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
});
