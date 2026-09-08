import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../theme';
import { SectionHeader } from '../../theme/ui/SectionHeader';
import type { RootStackParamList } from '../../navigation/AppNavigator';

/**
 * The "More" tab -- the fifth destination in the hand-rolled tab bar
 * (see ../../navigation/TabBar.tsx), aggregating the screens that don't
 * get their own tab: Profile, Notifications, Settings. All three already
 * existed as routes (reachable from Home's quick links / notification
 * bell, and Settings from Profile) -- this adds one more path to each,
 * it doesn't change what they do.
 */
export function MoreScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user } = useAuth();
  const { colors, radii, spacing } = useTheme();

  const displayLabel = user?.displayName || user?.email || user?.phoneNumber || 'Member';

  return (
    <ScrollView
      contentContainerStyle={[styles.container, { backgroundColor: colors.background }]}
      testID="more-screen"
    >
      <Pressable
        testID="more-profile-link"
        accessibilityRole="button"
        onPress={() => navigation.navigate('Profile')}
        style={[
          styles.profileRow,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderRadius: radii.card,
            padding: spacing.lg,
          },
        ]}
      >
        <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
          <Text style={styles.avatarLabel}>{displayLabel.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.profileName, { color: colors.text }]}>{displayLabel}</Text>
          <Text style={[styles.profileHint, { color: colors.secondaryText }]}>
            View profile
          </Text>
        </View>
        <View style={[styles.chevron, { borderColor: colors.secondaryText }]} />
      </Pressable>

      <View style={styles.section}>
        <SectionHeader title="General" />
        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderRadius: radii.card,
            },
          ]}
        >
          <Pressable
            testID="more-notifications-link"
            accessibilityRole="button"
            onPress={() => navigation.navigate('NotificationCenter')}
            style={[styles.row, { padding: spacing.md }]}
          >
            <Text style={[styles.rowLabel, { color: colors.text }]}>Notifications</Text>
            <View style={[styles.chevron, { borderColor: colors.secondaryText }]} />
          </Pressable>
          <Pressable
            testID="more-settings-link"
            accessibilityRole="button"
            onPress={() => navigation.navigate('Settings')}
            style={[
              styles.row,
              styles.divider,
              { borderTopColor: colors.border, padding: spacing.md },
            ]}
          >
            <Text style={[styles.rowLabel, { color: colors.text }]}>Settings</Text>
            <View style={[styles.chevron, { borderColor: colors.secondaryText }]} />
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 20, gap: 22 },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLabel: { color: '#FFFFFF', fontSize: 19, fontWeight: '600' },
  profileName: { fontSize: 16, fontWeight: '600' },
  profileHint: { fontSize: 12.5, marginTop: 2 },
  section: { gap: 12 },
  card: { borderWidth: StyleSheet.hairlineWidth },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  divider: { borderTopWidth: StyleSheet.hairlineWidth },
  rowLabel: { fontSize: 15, fontWeight: '500' },
  chevron: {
    width: 8,
    height: 8,
    borderRightWidth: 1.5,
    borderTopWidth: 1.5,
    transform: [{ rotate: '45deg' }],
  },
});
