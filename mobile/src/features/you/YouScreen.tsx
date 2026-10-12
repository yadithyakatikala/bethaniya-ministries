import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  Avatar,
  Badge,
  Icon,
  IconButton,
  UnderlineTabs,
  contentTextStyle,
  useTheme,
} from '../../theme';
import { useTranslation } from '../../i18n';
import { useAuth } from '../../context/AuthContext';
import { useMemberIdentity } from '../../context/useMemberIdentity';
import { useRouteTab } from '../../navigation/useRouteTab';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { ProfileScreen } from '../profile/ProfileScreen';
import { SavedScreen } from './SavedScreen';

type Props = NativeStackScreenProps<RootStackParamList, 'You'>;

/**
 * You: the member's own corner. At the top, who they are -- a monogram, their
 * name, their email and whether it is verified -- with the bell
 * (Notifications) and the sliders (Settings) at the right; under it two tabs,
 * what they have SAVED and their PROFILE.
 *
 * It replaces the More tab, whose list was spread over the tabs and the shelf:
 * Profile and Settings and Notifications are the member's, so they are here.
 *
 * NO PHOTOS. The monogram is the member's initial, with its vowel signs, in
 * the serif of its script (decision H6: the church's plan cannot store a
 * picture, so none is asked for).
 *
 * The name is the member's own text, so it takes the face of the script it is
 * written in (the design's rule S5). A member with no name at all -- a phone
 * sign-in that skipped onboarding -- is shown by their number, then by the
 * word "Member", never by a blank.
 */
export function YouScreen({ navigation, route }: Props) {
  const { colors, layout, type } = useTheme();
  const { t, appLanguage } = useTranslation();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { displayName } = useMemberIdentity();
  const [tab, setTab] = useRouteTab(route.params?.tab, 'saved');

  const name = displayName || user?.phoneNumber || t('common.member');
  const contact = user?.email || user?.phoneNumber || '';
  const verified = Boolean(user?.email && user.emailVerified);

  return (
    <View
      testID="you-screen"
      style={[styles.screen, { backgroundColor: colors.paper, paddingTop: insets.top }]}
    >
      <View style={{ paddingHorizontal: layout.screenMargin }}>
        <View style={styles.top}>
          <View style={styles.grow} />
          <IconButton
            testID="you-notifications-button"
            accessibilityLabel={t('more.notifications')}
            onPress={() => navigation.navigate('NotificationCenter')}
          >
            <Icon name="bell" size={24} />
          </IconButton>
          <IconButton
            testID="you-settings-button"
            accessibilityLabel={t('more.settings')}
            onPress={() => navigation.navigate('Settings')}
          >
            <Icon name="sliders" size={24} />
          </IconButton>
        </View>

        <View style={styles.who} testID="you-header">
          <Avatar name={name} size={72} testID="you-avatar" />
          <View style={styles.text}>
            <Text
              accessibilityRole="header"
              testID="you-name"
              numberOfLines={2}
              style={[
                contentTextStyle(name, {
                  size: 26,
                  line: 32,
                  teSize: 24,
                  teLine: 38,
                  weight: 'semiBold',
                  fallback: appLanguage,
                }),
                { color: colors.ink },
              ]}
            >
              {name}
            </Text>
            {contact ? (
              <View style={styles.contact}>
                <Text
                  testID="you-contact"
                  numberOfLines={1}
                  style={[type.caption, styles.address, { color: colors.inkMuted }]}
                >
                  {contact}
                </Text>
                {verified ? (
                  <Badge
                    testID="you-verified"
                    variant="success"
                    label={t('profile.emailVerified')}
                  />
                ) : null}
              </View>
            ) : null}
          </View>
        </View>

        <UnderlineTabs
          testID="you-tabs"
          selected={tab}
          onSelect={setTab}
          tabs={[
            { value: 'saved', label: t('you.tabSaved') },
            { value: 'profile', label: t('profile.title') },
          ]}
        />
      </View>
      {tab === 'saved' ? <SavedScreen /> : <ProfileScreen />}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  // The glyphs of the two buttons line up with the margin, not their 44-point targets.
  top: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginRight: -10,
  },
  grow: { flex: 1, minWidth: 0 },
  who: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingTop: 4,
    paddingBottom: 20,
  },
  text: { flex: 1, minWidth: 0, gap: 3 },
  contact: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  address: { flexShrink: 1 },
});
