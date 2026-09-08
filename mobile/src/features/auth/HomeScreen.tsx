import { useEffect, useState } from 'react';
import { Button, Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../../context/AuthContext';
import { AnnouncementsList } from '../announcements/AnnouncementsList';
import { DailyVerseCard } from '../daily-verses/DailyVerseCard';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import {
  subscribeToChurchSettings,
  type ChurchSettings,
} from '../../services/firebase/settings';

const DEFAULT_CHURCH_NAME = 'Bethaniya Ministries';
const DEFAULT_CHURCH_DESCRIPTION = 'A community of faith, worship, and fellowship.';

/**
 * Church branding block -- Day 5 built this static/hardcoded ("the admin
 * Settings page... is explicitly Day 13 scope... Replace this with real
 * data once Day 13 exists"). Day 13 does exactly that: it now reads the
 * real /settings/church document via subscribeToChurchSettings (see
 * ../../services/firebase/settings.ts), per
 * FINAL_ARCHITECTURE_SPECIFICATION.md's Day 13 plan ("Mobile app
 * displays updated church info") and P0 feature #17 ("Save button
 * (syncs to mobile app display)").
 *
 * Falls back to the exact same default name/description Day 5 hardcoded
 * whenever no settings document has ever been saved (a brand-new
 * deployment before any Super Admin has visited
 * admin/src/features/settings/SettingsPage.tsx), while the very first
 * snapshot is still in flight, or on a read error -- there is
 * deliberately no separate loading/error UI for this decorative header
 * block; a sensible default is friendlier than a spinner or error
 * message for something this low-stakes, and firestore.rules' settings
 * read rule (isSignedIn()) never denies a signed-in member anyway (see
 * ../../services/firebase/settings.ts's doc comment). The logo only
 * renders once a settings document with a non-empty logoUrl has actually
 * loaded -- there is no default/placeholder logo image.
 */
function ChurchBranding() {
  const [settings, setSettings] = useState<ChurchSettings | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToChurchSettings(
      (next) => setSettings(next),
      () => setSettings(null)
    );
    return unsubscribe;
  }, []);

  const churchName = settings?.churchName || DEFAULT_CHURCH_NAME;
  const description = settings?.description || DEFAULT_CHURCH_DESCRIPTION;

  return (
    <View style={styles.branding} testID="church-branding">
      {settings?.logoUrl ? (
        <Image
          source={{ uri: settings.logoUrl }}
          style={styles.logo}
          testID="church-logo"
          accessibilityIgnoresInvertColors
        />
      ) : null}
      <Text style={styles.churchName}>{churchName}</Text>
      <Text style={styles.churchDescription}>{description}</Text>
    </View>
  );
}

/**
 * Authenticated home screen. Day 2 proved the authenticated state renders
 * and sign-out works; Day 4 added the real-time announcements section
 * (AnnouncementsList). Day 5 adds church branding (see ChurchBranding
 * above -- settings-driven since Day 13) and the daily verse card
 * (DailyVerseCard), per the spec's "Home screen UI (church branding +
 * daily verse card + announcements list)" plan item. Day 6 adds a
 * "Songs" entry point into the real navigation introduced this day (see
 * AppNavigator.tsx) -- HomeScreen is itself the "Home" screen registered
 * in that stack, so `useNavigation()` is how it reaches "SongsList"
 * rather than a prop. Tap-to-detail navigation for announcements is
 * later scope and still not built here. Day 7 adds an "Events" entry
 * point the same way. Day 8 adds a "Bible" entry point identically, into
 * BibleBooks. Day 9/10 add "Profile" and "Notifications" entry points
 * the same way -- Settings is reached from Profile (not from Home
 * directly) and Bible Search is reached from the Bible books list (not
 * from Home directly either), per the decision to keep Home from
 * accumulating an entry point for every new screen.
 */
export function HomeScreen() {
  const { user, signOut } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

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
      <Button
        title="Songs"
        onPress={() => navigation.navigate('SongsList')}
        testID="songs-nav-button"
      />
      <Button
        title="Events"
        onPress={() => navigation.navigate('EventsList')}
        testID="events-nav-button"
      />
      <Button
        title="Bible"
        onPress={() => navigation.navigate('BibleBooks')}
        testID="bible-nav-button"
      />
      <Button
        title="Profile"
        onPress={() => navigation.navigate('Profile')}
        testID="profile-nav-button"
      />
      <Button
        title="Notifications"
        onPress={() => navigation.navigate('NotificationCenter')}
        testID="notifications-nav-button"
      />
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
  logo: { width: 96, height: 96, borderRadius: 8, marginBottom: 4 },
  churchName: { fontSize: 22, fontWeight: '700', textAlign: 'center' },
  churchDescription: { fontSize: 14, color: '#6B7280', textAlign: 'center' },
});
