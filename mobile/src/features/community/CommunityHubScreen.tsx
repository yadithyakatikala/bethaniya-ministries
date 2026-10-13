import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenTitle, UnderlineTabs, useTheme } from '../../theme';
import { useTranslation } from '../../i18n';
import { useRouteTab } from '../../navigation/useRouteTab';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { UpdatesFeed } from '../updates/UpdatesFeed';
import { CommunityChatScreen } from './CommunityChatScreen';

type Props = NativeStackScreenProps<RootStackParamList, 'CommunityHub'>;

/**
 * Community: ONE destination for the church family -- what the church says
 * (UPDATES: announcements and posts, as one feed) and what the church says to
 * itself (CHAT) -- with the shelf of Events, Songs and Photos and videos under
 * the Updates tab.
 *
 * Community and the chat were separate places with separate tiles, and a
 * tester reported them as the same feature; they are the two tabs of one
 * place now. The chat's own screen, with its message box that rides above the
 * keyboard, is unchanged inside it.
 */
export function CommunityHubScreen({ route }: Props) {
  const { colors, layout } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useRouteTab(route.params?.tab, 'updates');

  const header = (
    <>
      <ScreenTitle title={t('nav.community')} />
      <UnderlineTabs
        testID="community-tabs"
        selected={tab}
        onSelect={setTab}
        tabs={[
          { value: 'updates', label: t('community.tabUpdates') },
          { value: 'chat', label: t('community.tabChat') },
        ]}
      />
    </>
  );

  return (
    <View
      testID="community-hub"
      style={[styles.screen, { backgroundColor: colors.paper, paddingTop: insets.top }]}
    >
      {tab === 'updates' ? (
        <UpdatesFeed header={header} />
      ) : (
        <>
          <View style={{ paddingHorizontal: layout.screenMargin }}>{header}</View>
          <CommunityChatScreen />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({ screen: { flex: 1 } });
