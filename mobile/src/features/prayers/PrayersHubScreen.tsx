import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenTitle, UnderlineTabs, useTheme } from '../../theme';
import { useTranslation } from '../../i18n';
import { useRouteTab } from '../../navigation/useRouteTab';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { PrayerWallScreen } from '../prayer-wall/PrayerWallScreen';
import { PrayersScreen } from './PrayersScreen';

type Props = NativeStackScreenProps<RootStackParamList, 'PrayersHub'>;

/**
 * Prayers: ONE destination with two views -- the church's REQUESTS (the shared
 * wall) and MY JOURNAL (private to the member).
 *
 * They used to be two places reached from two tiles and then from More, and a
 * tester reported them as one feature listed twice. They are one tab now, with
 * the two views as underlined tabs under the title.
 */
export function PrayersHubScreen({ route }: Props) {
  const { colors, layout } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useRouteTab(route.params?.tab, 'requests');

  return (
    <View
      testID="prayers-hub"
      style={[styles.screen, { backgroundColor: colors.paper, paddingTop: insets.top }]}
    >
      <View style={{ paddingHorizontal: layout.screenMargin }}>
        <ScreenTitle title={t('nav.prayers')} />
        <UnderlineTabs
          testID="prayers-tabs"
          selected={tab}
          onSelect={setTab}
          tabs={[
            { value: 'requests', label: t('prayers.tabRequests') },
            { value: 'journal', label: t('prayers.tabJournal') },
          ]}
        />
      </View>
      {tab === 'requests' ? <PrayerWallScreen /> : <PrayersScreen />}
    </View>
  );
}

const styles = StyleSheet.create({ screen: { flex: 1 } });
