import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../../context/AuthContext';
import { usePreferences } from '../../context/PreferencesContext';
import { useTheme } from '../../theme';
import { useTranslation } from '../../i18n';
import { Tappable } from '../../theme/ui/Tappable';
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
  const { memberName } = usePreferences();
  const { colors, radii, spacing, type } = useTheme();
  const { t } = useTranslation();

  // M7: the PROFILE's name first. Firebase Auth's displayName is empty
  // for a member who signed up with an email address and typed their name
  // in onboarding -- onboarding writes the Firestore profile, not the
  // Auth record -- so this row greeted them by their email address.
  // The final fallback is a WORD rather than a name, so it is translated:
  // a Telugu interface should not address the member in English.
  const displayLabel =
    memberName || user?.displayName || user?.email || user?.phoneNumber || t('common.member');

  return (
    <ScrollView
      contentContainerStyle={[styles.container, { backgroundColor: colors.background }]}
      testID="more-screen"
    >
      <Tappable
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
          <Text style={[type.title, { color: colors.onPrimary }]}>
            {displayLabel.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[type.label, { color: colors.text }]}>{displayLabel}</Text>
          <Text
            style={[type.caption, styles.profileHint, { color: colors.secondaryText }]}
          >
            {t('more.viewProfile')}
          </Text>
        </View>
        <View style={[styles.chevron, { borderColor: colors.secondaryText }]} />
      </Tappable>

      <View style={styles.section}>
        <SectionHeader title={t('more.grow')} />
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
          <Tappable
            testID="more-plans-link"
            accessibilityRole="button"
            onPress={() => navigation.navigate('PlansList')}
            style={[styles.row, { padding: spacing.md }]}
          >
            <Text style={[type.label, { color: colors.text }]}>
              {t('more.readingPlans')}
            </Text>
            <View style={[styles.chevron, { borderColor: colors.secondaryText }]} />
          </Tappable>
          {/* The SHARED wall -- what "Prayers" means to a member, and
              what Home's Prayers tile opens. */}
          <Tappable
            testID="more-prayer-wall-link"
            accessibilityRole="button"
            onPress={() => navigation.navigate('PrayerWall')}
            style={[
              styles.row,
              styles.divider,
              { borderTopColor: colors.border, padding: spacing.md },
            ]}
          >
            <Text style={[type.label, { color: colors.text }]}>{t('more.prayers')}</Text>
            <View style={[styles.chevron, { borderColor: colors.secondaryText }]} />
          </Tappable>
          {/* The PRIVATE journal at users/{uid}/prayers. It keeps its own
              row, but named for what it is rather than sharing the word
              "Prayers" with the wall above -- two rows called almost the
              same thing is what a tester read as one feature listed
              twice. It is deliberately NOT a Home tile: a personal list
              nobody else can see is something a member goes looking for,
              not a front door. */}
          <Tappable
            testID="more-prayers-link"
            accessibilityRole="button"
            onPress={() => navigation.navigate('Prayers')}
            style={[
              styles.row,
              styles.divider,
              { borderTopColor: colors.border, padding: spacing.md },
            ]}
          >
            <Text style={[type.label, { color: colors.text }]}>
              {t('more.myPrayerJournal')}
            </Text>
            <View style={[styles.chevron, { borderColor: colors.secondaryText }]} />
          </Tappable>
          <Tappable
            testID="more-community-link"
            accessibilityRole="button"
            onPress={() => navigation.navigate('CommunityList')}
            style={[
              styles.row,
              styles.divider,
              { borderTopColor: colors.border, padding: spacing.md },
            ]}
          >
            <Text style={[type.label, { color: colors.text }]}>
              {t('more.community')}
            </Text>
            <View style={[styles.chevron, { borderColor: colors.secondaryText }]} />
          </Tappable>
          {/* M7. The group chat, distinct from the admin-authored
              community posts above it. */}
          <Tappable
            testID="more-chat-link"
            accessibilityRole="button"
            onPress={() => navigation.navigate('CommunityChat')}
            style={[
              styles.row,
              styles.divider,
              { borderTopColor: colors.border, padding: spacing.md },
            ]}
          >
            <Text style={[type.label, { color: colors.text }]}>{t('chat.title')}</Text>
            <View style={[styles.chevron, { borderColor: colors.secondaryText }]} />
          </Tappable>
          {/* M6. Media lives here rather than in the bottom bar, which
              stays Home | Bible | Songs | Events | More exactly as it
              was -- the same decision Announcements and Community
              already follow. Home carries a short strip with a "See
              all" into the same screen. */}
          <Tappable
            testID="more-media-link"
            accessibilityRole="button"
            onPress={() => navigation.navigate('MediaFeed')}
            style={[
              styles.row,
              styles.divider,
              { borderTopColor: colors.border, padding: spacing.md },
            ]}
          >
            <Text style={[type.label, { color: colors.text }]}>{t('media.title')}</Text>
            <View style={[styles.chevron, { borderColor: colors.secondaryText }]} />
          </Tappable>
          <Tappable
            testID="more-saved-media-link"
            accessibilityRole="button"
            onPress={() => navigation.navigate('SavedMedia')}
            style={[
              styles.row,
              styles.divider,
              { borderTopColor: colors.border, padding: spacing.md },
            ]}
          >
            <Text style={[type.label, { color: colors.text }]}>
              {t('media.savedTitle')}
            </Text>
            <View style={[styles.chevron, { borderColor: colors.secondaryText }]} />
          </Tappable>
        </View>
      </View>

      <View style={styles.section}>
        <SectionHeader title={t('more.general')} />
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
          <Tappable
            testID="more-notifications-link"
            accessibilityRole="button"
            onPress={() => navigation.navigate('NotificationCenter')}
            style={[styles.row, { padding: spacing.md }]}
          >
            <Text style={[type.label, { color: colors.text }]}>
              {t('more.notifications')}
            </Text>
            <View style={[styles.chevron, { borderColor: colors.secondaryText }]} />
          </Tappable>
          <Tappable
            testID="more-settings-link"
            accessibilityRole="button"
            onPress={() => navigation.navigate('Settings')}
            style={[
              styles.row,
              styles.divider,
              { borderTopColor: colors.border, padding: spacing.md },
            ]}
          >
            <Text style={[type.label, { color: colors.text }]}>{t('more.settings')}</Text>
            <View style={[styles.chevron, { borderColor: colors.secondaryText }]} />
          </Tappable>
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
  profileHint: { marginTop: 2 },
  section: { gap: 12 },
  card: { borderWidth: StyleSheet.hairlineWidth },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  divider: { borderTopWidth: StyleSheet.hairlineWidth },
  chevron: {
    width: 8,
    height: 8,
    borderRightWidth: 1.5,
    borderTopWidth: 1.5,
    transform: [{ rotate: '45deg' }],
  },
});
